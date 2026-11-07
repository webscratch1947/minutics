import { useEffect, useRef, useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';

/* ── Android permissions onboarding ───────────────────────────────────────
   Shown right after the welcome step, Android app only. Every row reflects
   the REAL system state via AndroidBridge.getPermissionStatus(); the user
   cannot leave this step until all of them are granted.

   Tapping Allow opens the FULL text guide first. The real Android settings
   screen opens only from the guide's own button. Permissions that are a
   single system dialog (Notifications, Background) skip the guide entirely.

   The sheet closes via the × button or by dragging the top handle down. */ 

export function isAndroidNative() {
  try { return !!(window.AndroidBridge && window.AndroidBridge.getPermissionStatus); } catch { return false; }
}

const LOGO = './assets/icons/logo-192.png';

export const PERMISSION_ROWS = [
  {
    key: 'overlay',
    title: 'Display over other apps',
    desc: 'Shows reminder popups above your other apps.',
    icon: 'overlay',
    steps: [
      'Find Minutics in this list.',
      'Tap Minutics.',
      'Turn on Allow display over other apps.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'popup',
    title: 'Display pop-up windows',
    desc: 'Lets reminders appear while you are inside another app.',
    icon: 'popup',
    steps: [
      'Tap Display pop-up windows.',
      'Turn the switch on.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'background',
    title: 'Background',
    desc: 'Keeps your reminders alive when Minutics is closed.',
    icon: 'battery',
    steps: [
      'Tap Allow on the Android prompt.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'autostart',
    title: 'Auto Start',
    desc: 'Restarts reminders automatically after a reboot.',
    icon: 'autostart',
    steps: [
      'Find Minutics in the Auto Start list.',
      'Turn its Auto Start switch on.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    desc: 'Counts reels and shorts for Doom scroll stopper.',
    icon: 'accessibility',
    steps: [
      'Tap Downloaded apps (or Installed services).',
      'Tap Minutics.',
      'Turn the service on, then tap Allow.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'notifications',
    title: 'Notifications',
    desc: 'Sends routine reminders and your daily report.',
    icon: 'bell',
    steps: [
      'Tap Allow on the Android prompt.',
      'Go back to Minutics — this row turns green.'
    ]
  }
];

function readStatus() {
  try {
    var raw = window.AndroidBridge.getPermissionStatus();
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw || {};
  } catch (e) { return {}; }
}

function allGranted(s) {
  if (!s) return false;
  return PERMISSION_ROWS.every(function (r) { return !!s[r.key]; });
}

function needsGuide(key) {
  return key !== 'notifications' && key !== 'background';
}

/* ── Icons ──────────────────────────────────────────────────────────────── */
function PermIcon({ name, size }) {
  var s = size || 20;
  var common = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'overlay') return jsxs('svg', Object.assign({}, common, { children: [
    jsx('rect', { x: 3, y: 4, width: 18, height: 14, rx: 2 }),
    jsx('rect', { x: 8, y: 9, width: 11, height: 11, rx: 2, fill: 'currentColor', opacity: 0.22 }),
    jsx('path', { d: 'M8 9h11v11' })
  ] }));
  if (name === 'popup') return jsxs('svg', Object.assign({}, common, { children: [
    jsx('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2 }),
    jsx('path', { d: 'M7 9h6M7 13h10M7 17h4' })
  ] }));
  if (name === 'battery') return jsxs('svg', Object.assign({}, common, { children: [
    jsx('rect', { x: 2, y: 7, width: 17, height: 10, rx: 2 }),
    jsx('path', { d: 'M22 11v2' }),
    jsx('path', { d: 'M5 10v4M8.5 10v4M12 10v4' })
  ] }));
  if (name === 'autostart') return jsxs('svg', Object.assign({}, common, { children: [
    jsx('path', { d: 'M21 12a9 9 0 1 1-3.2-6.9' }),
    jsx('path', { d: 'M21 3v6h-6' })
  ] }));
  if (name === 'accessibility') return jsxs('svg', Object.assign({}, common, { children: [
    jsx('circle', { cx: 12, cy: 4.5, r: 2 }),
    jsx('path', { d: 'M5 8h14M12 8v6M12 14l-3 7M12 14l3 7' })
  ] }));
  return jsxs('svg', Object.assign({}, common, { children: [
    jsx('path', { d: 'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' }),
    jsx('path', { d: 'M10 21h4' })
  ] }));
}

/* ── Text guide sheet ───────────────────────────────────────────────────── */
function GuideSheet({ perm, index, onOpenSettings, onClose }) {
  var [dragY, setDragY] = useState(0);
  var [closing, setClosing] = useState(false);
  var startY = useRef(null);

  useEffect(function () {
    var prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function () { document.body.style.overflow = prev; };
  }, []);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(function () { onClose(); }, 280);
  }

  function onTouchStart(e) { try { startY.current = e.touches[0].clientY; } catch (err) {} }
  function onTouchMove(e) {
    if (startY.current == null) return;
    var dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  }
  function onTouchEnd() {
    if (dragY > 120) requestClose();
    else setDragY(0);
    startY.current = null;
  }

  return createPortal(
    jsx('div', {
      className: 'lt-guide' + (closing ? ' is-closing' : ''),
      role: 'dialog',
      'aria-modal': 'true',
      'data-perm-tutorial': perm.key,
      onClick: function (e) {
        if (e.target === e.currentTarget) requestClose();
      },
      children: jsxs('div', {
        className: 'lt-guide-sheet',
        style: dragY ? { transform: 'translateY(' + dragY + 'px)', transition: 'none' } : undefined,
        children: [
          jsx('span', {
            className: 'lt-guide-grip',
            onTouchStart: onTouchStart,
            onTouchMove: onTouchMove,
            onTouchEnd: onTouchEnd
          }),
          jsxs('div', { className: 'lt-guide-head', children: [
            jsx('span', { className: 'lt-guide-icon', children: jsx(PermIcon, { name: perm.icon, size: 20 }) }),
            jsxs('div', { className: 'lt-guide-title', children: [
              jsx('p', { className: 'lt-guide-eyebrow', children: 'Permission ' + (index + 1) + ' of ' + PERMISSION_ROWS.length }),
              jsx('h3', { children: perm.title })
            ] }),
            jsx('button', {
              type: 'button', className: 'lt-guide-x', 'aria-label': 'Close tutorial',
              'data-guide-close': '1', onClick: requestClose, children: '\u2715'
            })
          ] }),
          jsx('p', { className: 'lt-guide-desc', children: perm.desc }),
          jsx('ol', { className: 'lt-guide-steps', children: perm.steps.map(function (s, i) {
            return jsx('li', {
              children: jsxs('span', { children: [
                jsx('b', { children: String(i + 1) }),
                jsx('span', { children: s })
              ] })
            }, i);
          }) }),
          jsx('button', {
            type: 'button', className: 'lt-guide-primary', 'data-guide-open-settings': '1',
            onClick: onOpenSettings, children: 'Open Android settings'
          }),
          jsx('button', {
            type: 'button', className: 'lt-guide-secondary', 'data-guide-gotit': '1',
            onClick: requestClose, children: 'Got it, I’ll do it myself'
          })
        ]
      })
    }),
    document.body
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
function ensurePermStyles() {
  if (document.getElementById('lt-perm-css')) return;
  var st = document.createElement('style');
  st.id = 'lt-perm-css';
  st.textContent = [
    '.lt-perm-row{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#fff;border:1px solid #E7E5DC;border-radius:16px;box-shadow:0 4px 14px rgba(20,32,80,.07);margin-bottom:10px}',
    '.lt-perm-row.is-on{border-color:#BBF7D0;background:#F6FEF9}',
    '.lt-perm-row-icon{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#F1ECE0;color:#157347;flex-shrink:0}',
    '.lt-perm-row.is-on .lt-perm-row-icon{background:#DCFCE7}',
    '.lt-perm-row-body{flex:1;min-width:0}',
    '.lt-perm-row-body b{display:block;font-size:14px;color:#14162E;font-weight:800;line-height:1.25}',
    '.lt-perm-row-body span{display:block;font-size:12px;color:#6B7280;margin-top:2px;line-height:1.35}',
    '.lt-perm-allow{border:none;border-radius:999px;padding:9px 16px;font-size:12.5px;font-weight:800;color:#fff;background:#157347;cursor:pointer;flex-shrink:0}',
    '.lt-perm-allow:active{transform:scale(.97)}',
    '.lt-perm-check{width:30px;height:30px;border-radius:999px;background:#157347;color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;flex-shrink:0}',
    '.lt-perm-note{font-size:12px;color:#6B7280;text-align:center;line-height:1.45;margin:6px 4px 0}',

    '.lt-guide{position:fixed;inset:0;z-index:2147483200;background:rgba(9,13,22,.62);display:flex;align-items:flex-end;justify-content:center;animation:ltGuideFade .18s ease}',
    '.lt-guide.is-closing{animation:ltGuideFadeOut .28s ease forwards}',
    '@keyframes ltGuideFade{from{opacity:0}to{opacity:1}}',
    '@keyframes ltGuideFadeOut{to{opacity:0}}',
    '.lt-guide-sheet{width:100%;max-width:430px;max-height:94dvh;overflow:auto;background:linear-gradient(180deg,#F6F4EE 0%,#FFFFFF 100%);border-radius:26px 26px 0 0;padding:8px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(0,0,0,.4);animation:ltGuideUp .28s cubic-bezier(.22,.61,.36,1);touch-action:pan-y}',
    '.lt-guide.is-closing .lt-guide-sheet{animation:ltGuideDown .28s cubic-bezier(.4,0,.6,1) forwards}',
    '@keyframes ltGuideUp{from{transform:translateY(26px);opacity:.4}to{transform:none;opacity:1}}',
    '@keyframes ltGuideDown{to{transform:translateY(100%);opacity:.6}}',
    '@media(min-width:520px){.lt-guide{align-items:center}.lt-guide-sheet{border-radius:26px;max-height:90dvh}}',
    '@keyframes ltGuideUp{from{transform:translateY(26px);opacity:.4}to{transform:none;opacity:1}}',
    '.lt-guide-grip{display:block;width:46px;height:5px;border-radius:999px;background:#C9C2B2;margin:2px auto 12px;cursor:grab;touch-action:none}',
    '.lt-guide-grip:active{cursor:grabbing;background:#A8A090}',
    '.lt-guide-head{display:flex;align-items:center;gap:12px;margin-bottom:6px}',
    '.lt-guide-icon{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#DCFCE7,#BBF7D0);color:#157347;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px -4px rgba(21,115,71,.4)}',
    '.lt-guide-title{flex:1;min-width:0}',
    '.lt-guide-eyebrow{font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#9AA1AE;margin:0 0 2px}',
    '.lt-guide-title h3{font-size:20px;font-weight:900;color:#14162E;margin:0;line-height:1.15}',
    '.lt-guide-x{width:34px;height:34px;border-radius:999px;background:#F1ECE0;border:none;font-size:17px;color:#9AA1AE;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.lt-guide-desc{font-size:13.5px;color:#5B6478;line-height:1.5;margin:4px 0 14px;padding:0 2px}',

    '.lt-guide-steps{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-direction:column;gap:8px;position:relative}',
    '.lt-guide-steps::before{content:"";position:absolute;left:19px;top:12px;bottom:12px;width:2px;background:linear-gradient(180deg,#E9E4D7,#E9E4D7);border-radius:2px}',
    '.lt-guide-steps li{position:relative;padding-left:0;cursor:pointer}',
    '.lt-guide-steps li>span{display:flex;gap:14px;align-items:flex-start;font-size:13.5px;line-height:1.45;color:#5B6478;padding:10px 12px 10px 8px;border-radius:12px;transition:background .25s,color .25s,transform .2s}',
    '.lt-guide-steps li.is-active>span{background:#fff;color:#14162E;box-shadow:0 4px 14px rgba(20,32,80,.08);transform:translateX(2px)}',
    '.lt-guide-steps b{width:26px;height:26px;border-radius:999px;background:#E9E4D7;color:#7A8494;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;transition:all .25s;position:relative;z-index:1}',
    '.lt-guide-steps li.is-active b{background:linear-gradient(135deg,#157347,#1FA060);color:#fff;box-shadow:0 4px 10px -2px rgba(21,115,71,.5)}',
    '.lt-guide-steps li>span span{flex:1}',

    '.lt-guide-primary{width:100%;border:none;border-radius:14px;padding:14px;background:linear-gradient(135deg,#157347,#1FA060);color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px -8px rgba(21,115,71,.7);margin-top:2px}',
    '.lt-guide-primary:active{transform:scale(.985)}',
    '.lt-guide-secondary{width:100%;border:none;background:none;color:#7A8494;font-size:13px;font-weight:700;padding:10px 0 2px;cursor:pointer}',

    '.lt-perm-mini{position:fixed;left:12px;right:12px;bottom:86px;z-index:2147483200;display:flex;align-items:center;gap:9px;background:#14162E;color:#fff;border-radius:16px;padding:10px 11px;box-shadow:0 10px 30px rgba(0,0,0,.35);animation:ltPermMini .25s cubic-bezier(.22,.61,.36,1)}',
    '@keyframes ltPermMini{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}',
    '.lt-perm-mini-icon{width:32px;height:32px;border-radius:10px;background:rgba(34,197,94,.2);color:#4ADE80;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.lt-perm-mini-body{flex:1;min-width:0}',
    '.lt-perm-mini-body b{display:block;font-size:12.5px;font-weight:800;line-height:1.2}',
    '.lt-perm-mini-body span{display:block;font-size:10.5px;color:rgba(255,255,255,.62);margin-top:1px}',
    '.lt-perm-mini-open{border:none;border-radius:999px;padding:7px 12px;background:#22C55E;color:#06230F;font-size:11px;font-weight:900;cursor:pointer;flex-shrink:0}',
    '.lt-perm-mini-x{background:none;border:none;color:rgba(255,255,255,.5);font-size:15px;cursor:pointer;padding:3px;flex-shrink:0}'
  ].join('');
  document.head.appendChild(st);
}

/* ── The onboarding step ────────────────────────────────────────────────── */
export function PermissionsStep({ onChange }) {
  var [status, setStatus] = useState(readStatus);
  var [tutorial, setTutorial] = useState(null);
  var statusRef = useRef(status);
  statusRef.current = status;

  useEffect(function () {
    ensurePermStyles();
    var update = function (next) {
      statusRef.current = next;
      setStatus(next);
      if (onChange) onChange(allGranted(next));
    };
    update(readStatus());

    var onChanged = function (e) {
      var detail = e && e.detail ? e.detail : null;
      update(detail && typeof detail === 'object' ? detail : readStatus());
    };
    window.addEventListener('ltPermissionsChanged', onChanged);

    var iv = setInterval(function () {
      var next = readStatus();
      if (JSON.stringify(next) !== JSON.stringify(statusRef.current)) update(next);
    }, 1200);

    return function () {
      window.removeEventListener('ltPermissionsChanged', onChanged);
      clearInterval(iv);
    };
  }, []);

  var open = function (perm) {
    if (!needsGuide(perm.key)) {
      try { window.AndroidBridge.openPermissionSetting(perm.key); } catch (e) {}
      return;
    }
    setTutorial(perm);
  };

  var openSettings = function (perm) {
    try { window.AndroidBridge.openPermissionSetting(perm.key); } catch (e) {}
    setTutorial(null);
  };

  var grantedCount = PERMISSION_ROWS.filter(function (r) { return status && status[r.key]; }).length;

  return jsxs('div', { children: [
    jsx('h2', {
      className: 'text-[23px] leading-tight font-extrabold tracking-tight text-[#14162E] text-center mb-1',
      children: 'Turn on the essentials'
    }),
    jsxs('p', {
      className: 'text-[13px] text-[#5B6478] text-center leading-relaxed mb-3 px-1',
      children: [
        'Minutics needs these to remind you on time and to count your reels. ',
        jsx('b', { children: grantedCount + ' of ' + PERMISSION_ROWS.length + ' done' })
      ]
    }),
    jsx('div', { children: PERMISSION_ROWS.map(function (perm) {
      var on = !!(status && status[perm.key]);
      return jsxs('div', {
        className: 'lt-perm-row' + (on ? ' is-on' : ''),
        'data-perm-key': perm.key,
        children: [
          jsx('span', { className: 'lt-perm-row-icon', children: jsx(PermIcon, { name: perm.icon }) }),
          jsxs('div', { className: 'lt-perm-row-body', children: [
            jsx('b', { children: perm.title }),
            jsx('span', { children: perm.desc })
          ] }),
          on
            ? jsx('span', { className: 'lt-perm-check', 'aria-label': 'Granted', children: '\u2713' })
            : jsx('button', {
                type: 'button',
                className: 'lt-perm-allow',
                'data-perm-allow': perm.key,
                onClick: function () { open(perm); },
                children: 'Allow'
              })
        ]
      }, perm.key);
    }) }),
    jsx('p', { className: 'lt-perm-note', children: 'You cannot continue until every row shows a green tick.' }),
    tutorial ? jsx(GuideSheet, {
      perm: tutorial,
      index: PERMISSION_ROWS.findIndex(function (r) { return r.key === tutorial.key; }),
      onOpenSettings: function () { openSettings(tutorial); },
      onClose: function () { setTutorial(null); }
    }) : null
  ] });
}

export { allGranted };
