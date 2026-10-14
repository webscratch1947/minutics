const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIST = path.join(__dirname, 'app', 'dist');
const PORT = 8154;

// serve app/dist
const http = require('http');
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const f = path.join(DIST, p);
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); res.end('nf'); return; }
    const ext = path.extname(f);
    const ct = ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : ext === '.html' ? 'text/html' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct }); res.end(d);
  });
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message.slice(0, 200)));

  await page.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1200));

  // Enter the demo: welcome screen -> Get started -> demo button
  async function enterDemo() {
    // welcome -> gate
    let el = await page.$('.lt-auth-wcta');
    if (el) { await el.click(); await new Promise(r => setTimeout(r, 900)); }
    // demo button (may be on gate)
    el = await page.$('.lt-auth-demobtn');
    if (el) { await el.click(); await new Promise(r => setTimeout(r, 1500)); }
    // kill any overlay-permission modal repeatedly
    await page.evaluate(() => {
      window.__kill = setInterval(() => {
        const s = document.getElementById('lt-overlay-perm-skip'); if (s) s.click();
        const m = document.getElementById('lt-overlay-perm-modal'); if (m) m.remove();
      }, 120);
    });
    await new Promise(r => setTimeout(r, 600));
  }

  await enterDemo();
  await new Promise(r => setTimeout(r, 800));

  const out = {};

  async function getBoxes() {
    return await page.evaluate(() => Array.from(document.querySelectorAll('[data-lt-move]'))
      .map(el => ({ key: el.getAttribute('data-lt-move'), order: el.style.order }))
      .filter(x => x.order !== '' && x.order != null));
  }

  // ---- Test A: open editor from Settings should land on Timer ----
  await page.evaluate(() => { location.hash = '#/settings'; });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lt-ui-editor-open')));
  await new Promise(r => setTimeout(r, 600));
  out.settingsJumpHash = await page.evaluate(() => location.hash);
  out.editingClassOnOpen = await page.evaluate(() => document.body.classList.contains('lt-ui-editing'));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lt-ui-editor-done')));
  await new Promise(r => setTimeout(r, 300));

  // ---- Test B: swap symmetry — call the real swap logic in-page ----
  await page.evaluate(() => { location.hash = '#/'; });
  await new Promise(r => setTimeout(r, 800));
  await page.evaluate(() => { localStorage.removeItem('lt_ui_order_v1'); });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await enterDemo();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lt-ui-editor-open')));
  await new Promise(r => setTimeout(r, 500));

  out.before = await getBoxes();

  // Pull the real swap/normalize functions out of the bundle via a synthetic drag:
  // simulate pointerdown on box A (hold 350ms), pointermove onto box B, pointerup.
  async function dragSwap(ia, ib) {
    return await page.evaluate(async (ia, ib) => {
      const boxes = Array.from(document.querySelectorAll('[data-lt-move]'));
      const A = boxes[ia], B = boxes[ib];
      if (!A || !B) return 'missing';
      const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
      const cx = ra.left + ra.width/2, cy = ra.top + ra.height/2;
      const tx = rb.left + rb.width/2, ty = rb.top + rb.height/2;
      const down = new PointerEvent('pointerdown', { bubbles:true, clientX:cx, clientY:cy, pointerId:1 });
      A.dispatchEvent(down);
      await new Promise(r => setTimeout(r, 400)); // hold
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles:true, clientX:tx, clientY:ty, pointerId:1 }));
      await new Promise(r => setTimeout(r, 60));
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, clientX:tx, clientY:ty, pointerId:1 }));
      await new Promise(r => setTimeout(r, 400));
      return 'ok';
    }, ia, ib);
  }

  // forward: box0 -> box1
  out.fwd = await dragSwap(0, 1);
  out.afterFwd = await getBoxes();
  out.storeAfterFwd = await page.evaluate(() => localStorage.getItem('lt_ui_order_v1'));

  // reverse: restore then box1 -> box0 (this used to fail)
  await page.evaluate(() => localStorage.removeItem('lt_ui_order_v1'));
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));
  await enterDemo();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lt-ui-editor-open')));
  await new Promise(r => setTimeout(r, 500));
  out.rev = await dragSwap(1, 0);
  out.afterRev = await getBoxes();
  out.storeAfterRev = await page.evaluate(() => localStorage.getItem('lt_ui_order_v1'));

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lt-ui-editor-done')));
  await new Promise(r => setTimeout(r, 300));

  // diagnostic: what's on screen?
  out.debug = await page.evaluate(() => ({
    authed: document.body.classList.contains('lt-authed'),
    hasGate: !!document.getElementById('lt-auth-gate'),
    hasRoot: !!document.getElementById('root'),
    buttons: Array.from(document.querySelectorAll('button')).map(b => (b.textContent||'').trim()).filter(Boolean).slice(0, 20),
    bodyLen: (document.body.innerText||'').length
  }));
  out.errors = errs.slice(0, 10);
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
  server.close();
  process.exit(0);
})();
