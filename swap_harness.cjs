// Mirrors the corrected uiOrderNormalize (reads style.order) + uiSwapBoxes.
let store = {};
const uiOrderRead = () => JSON.parse(JSON.stringify(store));
const uiOrderWrite = (o) => { store = JSON.parse(JSON.stringify(o)); };

let ALL_NODES = [];
function indexOf(el) { return ALL_NODES.indexOf(el); }
function uiOrderEff(el, st) {
  const s = st[el.getAttribute('data-lt-move')];
  if (typeof s === 'number') return s;
  return indexOf(el) + 1;
}
function uiOrderNormalize(st) {
  const nodes = ALL_NODES.slice();
  const parents = [];
  nodes.forEach((el) => {
    const p = el.parentElement;
    if (p && parents.indexOf(p) === -1) parents.push(p);
  });
  parents.forEach((p) => {
    const kids = p.children.filter((c) => c.getAttribute && c.getAttribute('data-lt-move'));
    kids.sort((a, b) => {
      const oa = (a.style && a.style.order !== '' && a.style.order != null && a.style.order !== undefined) ? parseInt(a.style.order, 10) : 0;
      const ob = (b.style && b.style.order !== '' && b.style.order != null && b.style.order != null) ? parseInt(b.style.order, 10) : 0;
      const va = (isNaN(oa) || oa === 0) ? (nodes.indexOf(a) + 1) : oa;
      const vb = (isNaN(ob) || ob === 0) ? (nodes.indexOf(b) + 1) : ob;
      return va - vb;
    });
    kids.forEach((c, j) => {
      const key = c.getAttribute('data-lt-move');
      if (key) st[key] = j + 1;
    });
  });
  return st;
}
function uiSwapBoxes(a, b) {
  let st = uiOrderRead();
  st = uiOrderNormalize(st);
  const ea = uiOrderEff(a, st);
  const eb = uiOrderEff(b, st);
  st[a.getAttribute('data-lt-move')] = eb;
  st[b.getAttribute('data-lt-move')] = ea;
  uiOrderWrite(st);
}
// applyUiLayout mirror (REAL code only sets style.order — it does NOT reorder
// the DOM children array; CSS `order` handles the visual layout).
function applyUiLayout() {
  ALL_NODES.forEach((el) => {
    const key = el.getAttribute('data-lt-move');
    if (store[key] != null) el.style.order = String(store[key]);
  });
}

function setup(parentKeys, storedOrder) {
  const parent = { children: [] };
  parentKeys.forEach((k, i) => {
    parent.children.push({ getAttribute: (a) => (a === 'data-lt-move' ? k : null), style: { order: '' }, parentElement: parent });
  });
  ALL_NODES = parent.children.slice();
  store = {};
  if (storedOrder) Object.assign(store, storedOrder);
  // simulate initial applyUiLayout
  applyUiLayout();
  return parent;
}
function orderSeq() { return ALL_NODES.map((c) => c.getAttribute('data-lt-move') + ':' + (c.style.order || '-')); }

const results = {};

// Scenario 1: unstored timer.hero dragged onto stored eat.the.frog (order 5)
{
  const p = setup(['timer.hero', 'timer.block', 'eat.the.frog', 'journal'], { 'eat.the.frog': 5, 'timer.block': 2, 'journal': 4 });
  const A = p.children[0], B = p.children[2];
  uiSwapBoxes(A, B);
  applyUiLayout();
  results.fwdSymmetric = (store['timer.hero'] === 5) && (store['eat.the.frog'] === 1);
  results.fwdSeq = orderSeq();
}
// Scenario 2: reverse
{
  const p = setup(['timer.hero', 'timer.block', 'eat.the.frog', 'journal'], { 'eat.the.frog': 5, 'timer.block': 2, 'journal': 4 });
  const A = p.children[2], B = p.children[0];
  uiSwapBoxes(A, B);
  applyUiLayout();
  results.revSymmetric = (store['eat.the.frog'] === 1) && (store['timer.hero'] === 5);
}
// Scenario 3: double swap restores
{
  const p = setup(['a', 'b', 'c'], {});
  const A = p.children[0], B = p.children[2];
  uiSwapBoxes(A, B); applyUiLayout();
  const once = JSON.parse(JSON.stringify(store));
  uiSwapBoxes(A, B); applyUiLayout();
  results.doubleSwapRestores = (store['a'] === once['c']) && (store['c'] === once['a']);
}
console.log(JSON.stringify(results, null, 2));
