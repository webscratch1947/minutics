import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, LayoutGrid, ListTodo, Settings, Timer } from 'lucide-react';
import { cn } from './lib/cn.js';
import { useBlocks } from './hooks/useBlocks.js';
import { useActivities } from './hooks/useActivities.js';
import { useUpdateBlock } from './hooks/useUpdateBlock.js';
import { useQueryClient } from '@tanstack/react-query';
import { blocksKey } from './lib/queryKeys.js';
import { HC } from './app/AndroidBridge.js';
import { TimerScreen, ActivityScreen } from './screens/Home.js';
import { LifeHubScreen } from './screens/LifeHub.js';
import { SettingsScreen } from './screens/Settings.js';
import { JournalScreen } from './screens/Journal.js';

/* Early Access Demo countdown — rendered INSIDE the top status bar so it
   never floats over it (the old fixed pill covered "No activity running").
   Reads window.LTDemo directly; this component re-renders every second
   with LTTopNav's clock. Uses displayMs(): the monotonic display clock
   that counts straight down from the original start — it never jumps back
   to 30:00 when the session renews (the old countdown-reset loop). */
function demoClockText() {
  try {
    const api = window.LTDemo;
    if (!api || !api.isActive || !api.isActive()) return null;
    const remaining = (api.displayMs ? api.displayMs() : api.remainingMs());
    if (!(remaining > 0)) return null;
    const totalSec = Math.ceil(remaining / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    /* "Demo time left 23:18" — makes it obvious this is the fixed
       30-minute demo window counting down, not a session clock. */
    return 'Demo time left ' + min + ':' + (sec < 10 ? '0' : '') + sec;
  } catch (e) { return null; }
}

function DemoClock({ tone }) {
  const text = demoClockText();
  if (!text) return null;
  return jsx('span', {
    className: 'shrink-0 text-[11px] font-bold tabular-nums ' + (tone || 'text-white/55'),
    children: text
  });
}

function LTTopNav() {
  const { data: blocks = [] } = useBlocks();
  const { data: activities = [] } = useActivities();
  const updateBlock = useUpdateBlock();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const running = blocks.find(b => !b.endTime);

  if (!running) {
    /* Idle bar: bright accent outline on all four sides (top/down/sides)
       so the strip reads as a deliberate card (user request). */
    return jsxs('div', {
      className: 'flex items-center gap-2 px-4 py-2 bg-[#060d28] text-white/40 text-xs font-bold border-2 border-accent/70',
      style: { paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' },
      children: [
        jsx('span', {
          className: 'w-2.5 h-2.5 rounded-full bg-white/20 shrink-0'
        }),
        jsx('span', {
          className: 'flex-1 truncate',
          children: 'No activity running'
        }),
        jsx(DemoClock, {})
      ]
    });
  }

  const activity = activities.find(a => a.id === running.activityId);
  const elapsed = Math.floor((now - new Date(running.startTime).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  const stopTimer = (event) => {
    event.stopPropagation();
    updateBlock.mutate({
      id: running.id,
      data: { endTime: new Date().toISOString() }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: blocksKey() });
        navigate('/activity');
      }
    });
  };

  return jsxs('div', {
    className: 'flex items-center gap-2 px-4 py-2 bg-[#04091e] text-white text-xs font-bold cursor-pointer',
    style: { paddingTop: 'calc(8px + env(safe-area-inset-top, 0px))' },
    role: 'button',
    tabIndex: 0,
    onClick: () => navigate('/activity'),
    onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/activity'); },
    children: [
      jsx('span', {
        className: 'w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse'
      }),
      jsx('span', {
        className: 'flex-1 truncate',
        children: (activity ? activity.name : 'Activity') + ' — ' + timeStr
      }),
      jsx(DemoClock, { tone: 'text-white/75' }),
      jsx('button', {
        onClick: stopTimer,
        className: 'bg-white/15 text-white border-none rounded-full px-2 py-0.5 text-[9px] font-extrabold shrink-0',
        children: 'Stop'
      })
    ]
  });
}

/* Fires a window event on every route change so enhancements.js can run its
   pass immediately. The MutationObserver path is throttled to one run per
   500ms, so a fast tab switch right after another one dropped the new
   screen's pass and painted the previous screen's injected UI. */
function RouteWatcher() {
  const { pathname } = useLocation();
  useEffect(() => {
    /* Reset the shared scroll container so switching tabs never inherits
       the previous tab's scroll offset (e.g. Timer scrolled → Life Hub). */
    const main = document.querySelector('#root main') || document.querySelector('main');
    if (main) main.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('lt-route-change', { detail: pathname })); } catch (e) {}
  }, [pathname]);
  return null;
}

/* ── Shared route table (the swipe peek renders the same routes at a
      neighbour path, so the definitions live here, not in AppRoot). ── */
function AppRoutes({ profile, location }) {
  return jsxs(Routes, {
    location: location,
    children: [
      jsx(Route, { path: '/', element: jsx(TimerScreen, { profile }) }),
      jsx(Route, { path: '/activity', element: jsx(ActivityScreen, { profile }) }),
      jsx(Route, { path: '/timeline', element: jsx(LifeHubScreen, { profile }) }),
      jsx(Route, { path: '/journal', element: jsx(JournalScreen, {}) }),
      jsx(Route, { path: '/settings', element: jsx(SettingsScreen, {}) }),
      jsx(Route, { path: '*', element: jsx(dk, {}) })
    ]
  });
}

/* ── UI layout editor (hold a box → drop on another → swap places) ─────
   Boxes marked with data-lt-move can be reordered by SWAPPING them with a
   sibling box: sizes, margins and alignment never change — only the visual
   order (CSS order inside the shared flex/grid parent). The store is a
   flat map of box key → order number and survives reloads/route changes. */
const UI_ORDER_KEY = 'lt_ui_order_v1';
const UI_LAYOUT_KEY = 'lt_ui_layout_v1'; // legacy absolute-position store
/* One-time cleanup: anyone who used the old free-position editor gets a
   clean default layout back. */
try { localStorage.removeItem(UI_LAYOUT_KEY); } catch (e) {}

function uiOrderRead() {
  try {
    const o = JSON.parse(localStorage.getItem(UI_ORDER_KEY) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (e) { return {}; }
}
function uiOrderWrite(o) {
  try { localStorage.setItem(UI_ORDER_KEY, JSON.stringify(o)); } catch (e) {}
}
/* Effective order value of a box: stored number, or its natural DOM slot. */
function uiOrderEff(el, store) {
  const s = store[el.getAttribute('data-lt-move')];
  if (typeof s === 'number') return s;
  return Array.prototype.indexOf.call(el.parentElement.children, el) + 1;
}
export function uiLayoutHasEntries() {
  const o = uiOrderRead();
  for (const k in o) { if (typeof o[k] === 'number') return true; }
  return false;
}
export function applyUiLayout() {
  let store;
  try { store = uiOrderRead(); } catch (e) { return; }
  /* Collect the parents of every marked box, and scrub any leftover
     absolute positioning from the old editor. */
  const parents = [];
  const seen = [];
  const nodes = document.querySelectorAll('[data-lt-move]');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    /* Never fight an in-progress drag. */
    if (el.classList && el.classList.contains('lt-dragging')) continue;
    if (el.style.position === 'absolute') {
      el.style.position = ''; el.style.left = ''; el.style.top = '';
      el.style.width = ''; el.style.zIndex = ''; el.style.margin = '';
    }
    const p = el.parentElement;
    if (p && seen.indexOf(p) === -1) { seen.push(p); parents.push(p); }
  }
  /* Assign an order value to EVERY child of each such parent — unmarked
     siblings get their natural slot so a marked box can never jump past
     them accidentally; marked boxes get their stored value. */
  for (let pi = 0; pi < parents.length; pi++) {
    const kids = parents[pi].children;
    for (let j = 0; j < kids.length; j++) {
      const el = kids[j];
      const key = el.getAttribute ? el.getAttribute('data-lt-move') : null;
      const s = key ? store[key] : undefined;
      el.style.order = (typeof s === 'number') ? String(s) : String(j + 1);
    }
  }
}

/* Pointer controller: long-press (350ms) a marked box to pick it up, drag
   it over a SIBLING box (highlighted as the drop target), release to swap
   the two boxes' persisted order. Same size, same alignment — only the
   order changes. */
let _uiBound = false;
let _hold = null;
let _dragEl = null;
let _dropEl = null;
let _justDragged = false;

function uiSwapFindTarget(x, y) {
  if (!_dragEl) return null;
  const el = document.elementFromPoint(x, y);
  if (!el || !el.closest) return null;
  const parent = _dragEl.parentElement;
  if (!parent) return null;
  /* Walk up to the direct child of the dragged box's parent that contains
     the hit point. Marked boxes can be NESTED (e.g. timer.block contains
     timer.hero, both marked), so closest('[data-lt-move]') would resolve to
     the inner box and fail the sibling check — "drop on the timer card"
     would then never register. Resolving to the top-level sibling keeps the
     rule (same parent, same size, same line) and makes the whole card a
     valid drop zone. */
  let node = el;
  while (node && node.parentElement !== parent) node = node.parentElement;
  if (!node || node === parent) return null;     // not inside a child of the parent
  if (node === _dragEl) return null;            // over the dragged box itself
  if (node.contains && node.contains(_dragEl)) return null;
  if (!node.hasAttribute || !node.hasAttribute('data-lt-move')) return null;
  return node;
}
function uiSwapSetTarget(t) {
  if (_dropEl === t) return;
  if (_dropEl) _dropEl.classList.remove('lt-swap-target');
  _dropEl = t;
  if (_dropEl) _dropEl.classList.add('lt-swap-target');
}
/* Give EVERY marked sibling a contiguous order in its parent's current DOM
   order, so any later swap is a clean exchange of two numbers in the SAME
   space. Without this, an unstored box fell back to its DOM index (1,2,3…)
   and swapping it with a stored box (e.g. order 5) produced an asymmetric
   5↔1 exchange — which is why dragging "Timer" onto a stored box never
   moved it, while dragging a stored box onto "Timer" did. */
/* Snapshot each box's CURRENT rendered order (style.order if set, else its
   natural DOM slot) into a contiguous 1..N sequence per parent. This puts
   every box in the SAME numeric space so any swap is a clean two-way
   exchange. Reading style.order (not DOM index) is essential: after a swap
   the CSS `order` reflow has already moved the boxes, so DOM index is stale. */
function uiOrderNormalize(store) {
  const nodes = Array.prototype.slice.call(document.querySelectorAll('[data-lt-move]'));
  const parents = [];
  nodes.forEach((el) => {
    const p = el.parentElement;
    if (p && parents.indexOf(p) === -1) parents.push(p);
  });
  parents.forEach((p) => {
    const kids = Array.prototype.slice.call(p.children)
      .filter((c) => c.hasAttribute && c.hasAttribute('data-lt-move'));
    kids.sort((a, b) => {
      const oa = (a.style && a.style.order !== '' && a.style.order != null) ? parseInt(a.style.order, 10) : NaN;
      const ob = (b.style && b.style.order !== '' && b.style.order != null) ? parseInt(b.style.order, 10) : NaN;
      /* Fallback to LIVE DOM index for boxes with no style.order yet (DOM
         index, NOT build order — a box may have moved in the DOM). */
      const va = isNaN(oa) ? (p.children.indexOf(a) + 1) : oa;
      const vb = isNaN(ob) ? (p.children.indexOf(b) + 1) : ob;
      return va - vb;
    });
    kids.forEach((c, j) => {
      const key = c.getAttribute('data-lt-move');
      if (key) store[key] = j + 1;
    });
  });
  return store;
}
function uiSwapBoxes(a, b) {
  let st = uiOrderRead();
  st = uiOrderNormalize(st);
  const ea = uiOrderEff(a, st);
  const eb = uiOrderEff(b, st);
  /* BUG FIX: these used to write to `store`, which is not in scope here —
     the normalized copy lives in `st`. That ReferenceError was swallowed by
     the drop handler's try/catch, so the swap silently did nothing (the
     "swap doesn't work at all" report). Write to `st` and persist it. */
  st[a.getAttribute('data-lt-move')] = eb;
  st[b.getAttribute('data-lt-move')] = ea;
  uiOrderWrite(st);
}

function uiEditorBind() {
  if (_uiBound) return;
  _uiBound = true;

  const editing = () => document.body.classList.contains('lt-ui-editing');

  /* Picks the held box up: bright outline, rides the finger from here. */
  const activate = () => {
    if (!_hold || _dragEl) return;
    _dragEl = _hold.el;
    try {
      _dragEl.classList.add('lt-dragging');
      document.body.style.userSelect = 'none';
      if (navigator.vibrate) navigator.vibrate(10);
    } catch (err) {}
  };

  const down = (e) => {
    if (!editing() || _dragEl) return;
    const el = (e.target && e.target.closest) ? e.target.closest('[data-lt-move]') : null;
    if (!el) return;
    _justDragged = false;
    const px = e.clientX, py = e.clientY;
    _hold = { el: el, x: px, y: py, t: setTimeout(() => { activate(); }, 300) };
  };

  const move = (e) => {
    if (_hold && !_dragEl) {
      const hx = Math.abs(e.clientX - _hold.x), hy = Math.abs(e.clientY - _hold.y);
      if (hx > 8 || hy > 8) {
        /* Moving before the hold completes means the user is ALREADY
           dragging — pick the box up now. Cancelling here was the main
           reason drags "never worked": every real finger drifts a few
           pixels, so the hold almost always got thrown away. */
        clearTimeout(_hold.t);
        activate();
      }
      return;
    }
    if (!_dragEl || !_hold) return;
    try { e.preventDefault(); } catch (err) {}
    /* Hold near a screen edge → the page SLOWLY scrolls with the drag (both
       directions) so a box below the fold can still be reached. */
    const m = document.querySelector('#root main') || document.querySelector('main');
    if (m) {
      const prevScroll = m.scrollTop;
      const r = m.getBoundingClientRect();
      if (e.clientY > r.bottom - 90) m.scrollTop += 7;
      else if (e.clientY < r.top + 90) m.scrollTop -= 7;
      /* Re-baseline the grab point by however much the page actually moved,
         so the box stays glued under the cursor instead of drifting away as
         the content slides beneath a stale offset. */
      const scrolled = m.scrollTop - prevScroll;
      if (scrolled) _hold.y -= scrolled;
    }
    /* The box rides the finger (visual only — no layout change). */
    _dragEl.style.transform = 'translate(' + (e.clientX - _hold.x) + 'px,' +
      (e.clientY - _hold.y) + 'px) scale(1.02)';
    uiSwapSetTarget(uiSwapFindTarget(e.clientX, e.clientY));
  };

  const up = () => {
    if (_hold) { clearTimeout(_hold.t); }
    if (!_dragEl) { _hold = null; return; }
    const target = _dropEl;
    const drag = _dragEl;
    try {
      if (target) {
        /* FLIP both boxes: capture where each sits under the finger, do the
           swap (both get their new order immediately), then animate each box
           from its old rect to its new one. Animating only the dragged box
           (the old way) left the target snapped to its new slot instantly and
           flashed the dragged box back to its origin for a frame — the
           "split-second flash then swap" the user saw. */
        const dragR1 = drag.getBoundingClientRect();
        const targR1 = target.getBoundingClientRect();
        uiSwapBoxes(drag, target);
        applyUiLayout();
        const dragR2 = drag.getBoundingClientRect();
        const targR2 = target.getBoundingClientRect();
        const anim = (el, r1, r2) => {
          const dx = r1.left - r2.left, dy = r1.top - r2.top;
          if (!dx && !dy) return;
          el.style.transition = 'none';
          el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          void el.offsetWidth; /* reflow — arm the transition */
          el.style.transition = 'transform .28s cubic-bezier(.22,.61,.36,1)';
          el.style.transform = '';
          setTimeout(() => { el.style.transition = ''; }, 320);
        };
        drag.classList.remove('lt-dragging');
        anim(drag, dragR1, dragR2);
        anim(target, targR1, targR2);
        if (navigator.vibrate) navigator.vibrate(20);
      } else {
        drag.classList.remove('lt-dragging');
        drag.style.transform = '';
      }
    } catch (err) {}
    uiSwapSetTarget(null);
    document.body.style.userSelect = '';
    _dragEl = null;
    _hold = null;
    _justDragged = true;
    setTimeout(() => { _justDragged = false; }, 400);
    applyUiLayout();
  };

  const click = (e) => {
    if (_justDragged) {
      e.stopPropagation();
      e.preventDefault();
      _justDragged = false;
    }
  };

  window.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerup', up, true);
  window.addEventListener('pointercancel', up, true);
  window.addEventListener('click', click, true);
}

/* Global styles: tab-slide keyframes + editor affordances. Rendered once
   by the shell (always mounted), also used by enhancements overlays. */
const SHELL_CSS = [
  '@keyframes lt-page-in-r{from{transform:translateX(100%)}to{transform:translateX(0)}}',
  '@keyframes lt-page-in-l{from{transform:translateX(-100%)}to{transform:translateX(0)}}',
  '.lt-page-in-r{animation:lt-page-in-r .3s cubic-bezier(.22,.61,.36,1)}',
  '.lt-page-in-l{animation:lt-page-in-l .3s cubic-bezier(.22,.61,.36,1)}',
  '@keyframes lt-sheet-up{from{transform:translateY(100%)}to{transform:translateY(0)}}',
  '@keyframes lt-fade-in{from{opacity:0}to{opacity:1}}',
  '.lt-sheet-in{animation:lt-sheet-up .26s cubic-bezier(.22,.61,.36,1)}',
  '.lt-fade-in{animation:lt-fade-in .2s ease}',
  'body.lt-ui-editing [data-lt-move]{outline:1px dashed rgba(0,194,168,.55);outline-offset:-2px;touch-action:none;cursor:grab;transition:order .28s cubic-bezier(.22,.61,.36,1),outline .15s,box-shadow .15s}',
  'body.lt-ui-editing [data-lt-move].lt-dragging{outline:2px solid #00C2A8;cursor:grabbing;box-shadow:0 14px 34px rgba(4,9,30,.35);opacity:.96;pointer-events:none;z-index:60!important;transition:none;will-change:transform}',
  'body.lt-ui-editing [data-lt-move].lt-swap-target{outline:2px solid #FFB020;outline-offset:-2px;box-shadow:0 0 0 5px rgba(255,176,32,.25)}'
].join('');

/* ── Shell ─────────────────────────────────────────────────────────────
   - demo countdown lives in the top bar (see demoClockText)
   - horizontal swipe between tabs with a live peek of the neighbour tab
   - smooth slide animation on every tab switch (tap or swipe)
   - optional UI layout editor overlay                    */
export function ak({ profile }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const shellRef = useRef(null);

  /* Enter-direction for the slide animation: computed synchronously during
     render so the keyed page wrapper mounts with its class already set.
     suppressAnimRef: a swipe COMMIT navigates while the target page is
     already half-visible under the finger — the new page must continue
     gliding from that offset instead of re-sliding in from the edge. */
  const animRef = useRef({ prev: pathname, dir: 0 });
  const suppressAnimRef = useRef(false);
  if (animRef.current.prev !== pathname) {
    const pi = tabIndex(animRef.current.prev);
    const ni = tabIndex(pathname);
    const suppress = suppressAnimRef.current;
    suppressAnimRef.current = false;
    animRef.current = {
      prev: pathname,
      dir: suppress ? 0 : ((pi >= 0 && ni >= 0 && pi !== ni) ? (ni > pi ? 1 : -1) : 1)
    };
  }
  const enterDir = animRef.current.dir;

  /* Horizontal swipe state (x/sign track the finger during the gesture) */
  const gRef = useRef({ active: false, locked: null, startX: 0, startY: 0, width: 0, x: 0, sign: 0 });
  const [dragX, setDragX] = useState(0);
  const [peek, setPeek] = useState(null);
  const [tracking, setTracking] = useState(false);
  /* Imperative style targets. pointermove fires up to ~120×/s — pushing
     dragX through React re-rendered the whole page tree on EVERY event,
     which made the slide feel heavy and then suddenly "detach". During the
     gesture the transforms are written straight to the DOM; React only
     writes these styles when dragX/peek/tracking actually change (lock,
     direction flip, release), so the imperative values stick. */
  const wrapRef = useRef(null);
  const peekRef = useRef(null);
  const applyDragStyles = (x) => {
    const w = gRef.current.width || 1;
    if (wrapRef.current) wrapRef.current.style.transform = x ? 'translateX(' + x + 'px)' : '';
    if (peekRef.current) peekRef.current.style.transform = 'translateX(' + (x + (x > 0 ? -w : w)) + 'px)';
  };

  /* UI editor state */
  const [editorOn, setEditorOn] = useState(false);
  const [resetFlash, setResetFlash] = useState(false);

  useEffect(() => {
    /* The editor only makes sense on the three editable tabs. Opening it
       from Settings / Life Hub jumps straight to Timer so the user never
       lands in the editor with nothing to edit. */
    const onOpen = () => {
      setEditorOn(true);
      /* The app is hash-routed (#/settings), so location.pathname is always
         "/" — read the hash instead, or the jump never fires. Delay a tick so
         it lands after whatever screen is opening the editor (e.g. Settings'
         own handler) and isn't immediately overridden. */
      try {
        const h = (window.location.hash || '').replace(/^#/, '') || '/';
        if (h === '/timeline' || h === '/settings' ||
            h.indexOf('/timeline') === 0 || h.indexOf('/settings') === 0) {
          setTimeout(() => { try { navigate('/'); } catch (err) {} }, 0);
        }
      } catch (err) {}
    };
    const onDone = () => setEditorOn(false);
    window.addEventListener('lt-ui-editor-open', onOpen);
    window.addEventListener('lt-ui-editor-done', onDone);
    return () => {
      window.removeEventListener('lt-ui-editor-open', onOpen);
      window.removeEventListener('lt-ui-editor-done', onDone);
    };
  }, [navigate]);

  useEffect(() => {
    document.body.classList.toggle('lt-ui-editing', editorOn);
    uiEditorBind();
    applyUiLayout();
    const iv = setInterval(applyUiLayout, editorOn ? 600 : 1600);
    const onRoute = () => setTimeout(applyUiLayout, 0);
    window.addEventListener('lt-route-change', onRoute);
    return () => {
      clearInterval(iv);
      window.removeEventListener('lt-route-change', onRoute);
      document.body.classList.remove('lt-ui-editing');
    };
  }, [editorOn]);

  const glideTRef = useRef(null);
  const glideTargetRef = useRef(null);

  /* Page trees are memoized: drag-state changes (setDragX on a direction
     flip or neighbor change) used to re-render BOTH full route trees
     mid-gesture — that re-render storm was the swipe "flicker". Now only
     the wrapper's style updates; the screens themselves are untouched
     until the pathname actually changes. */
  const pageEl = useMemo(() => jsx('main', {
    className: 'relative h-full overflow-y-auto overscroll-contain pb-[calc(96px+env(safe-area-inset-bottom,0px))] no-scrollbar',
    children: jsx(AppRoutes, { profile })
  }), [pathname, profile]);

  const peekEl = useMemo(() => (peek ? jsx(AppRoutes, {
    profile,
    location: { pathname: peek, search: '', hash: '', state: null, key: 'peek' }
  }) : null), [peek, profile]);

  /* Completes an in-flight swipe commit: the target page (the peek pane,
     which has been gliding to rest) is swapped for the real current route
     in one batch — both render identical content at the same offset, so the
     swap is invisible. The enter animation is suppressed, so there is no
     re-slide and no teleport. */
  const finishCommit = () => {
    if (!glideTRef.current) return;
    clearTimeout(glideTRef.current);
    glideTRef.current = null;
    suppressAnimRef.current = true;
    navigate(glideTargetRef.current);
    glideTargetRef.current = null;
    setDragX(0);
    setPeek(null);
  };

  const onTouchStart = (e) => {
    if (editorOn) return;
    /* A new gesture finishes any in-flight commit right away so the stale
       timer can never stomp this gesture's dragX. */
    if (glideTRef.current) finishCommit();
    if (!e.touches || e.touches.length !== 1) {
      gRef.current.locked = 'v';
      return;
    }
    const t = e.touches[0];
    gRef.current = {
      active: true, locked: null,
      startX: t.clientX, startY: t.clientY,
      width: shellRef.current ? shellRef.current.clientWidth : 0,
      x: 0, sign: 0
    };
  };

  const onTouchMove = (e) => {
    const g = gRef.current;
    if (!g.active || g.locked === 'v' || !e.touches || !e.touches.length) return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    if (!g.locked) {
      /* Lock fast (8px): the page attaches to the finger almost
         immediately — the old 14px dead zone felt like resistance and then
         a sudden release. The 1.15× direction ratio keeps vertical list
         scrolling from ever starting a slide. */
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        g.locked = 'h';
        const idx0 = tabIndex(pathname);
        const next0 = dx > 0 ? idx0 - 1 : idx0 + 1;
        const has0 = idx0 >= 0 && next0 >= 0 && next0 < TABS.length;
        let x0 = has0 ? dx : dx * 0.22;
        const w0 = g.width || 1;
        if (x0 > w0) x0 = w0;
        if (x0 < -w0) x0 = -w0;
        g.x = x0;
        g.sign = dx > 0 ? 1 : -1;
        setTracking(true);
        setDragX(x0); /* one render — styles are correct from the start */
        setPeek(has0 ? TABS[next0] : null);
        return;
      }
      if (Math.abs(dy) > 14) { g.locked = 'v'; return; }
      return;
    }
    if (g.locked !== 'h') return;
    const idx = tabIndex(pathname);
    const nextIdx = dx > 0 ? idx - 1 : idx + 1;
    const has = idx >= 0 && nextIdx >= 0 && nextIdx < TABS.length;
    let x = has ? dx : dx * 0.22;
    const w = g.width || 1;
    if (x > w) x = w;
    if (x < -w) x = -w;
    g.x = x;
    const sign = x > 0 ? 1 : x < 0 ? -1 : g.sign;
    if ((has ? TABS[nextIdx] : null) !== peek || sign !== g.sign) {
      /* Neighbour or direction changed → one state sync (rare), then
         straight back to imperative updates. */
      g.sign = sign;
      setDragX(x);
      setPeek(has ? TABS[nextIdx] : null);
      return;
    }
    applyDragStyles(x);
  };

  const onTouchEnd = () => {
    const g = gRef.current;
    g.active = false;
    if (g.locked !== 'h') { g.locked = null; return; }
    g.locked = null;
    setTracking(false);
    const w = g.width || 1;
    const x = g.x || 0;
    const target = peek;
    if (target && Math.abs(x) > w * 0.26) {
      /* Commit WITHOUT a jump: glide the whole strip to the edge (the
         target page — the peek pane — continues its slide from exactly
         where the finger left off) and then swap it for the real route in
         one batch, with the enter animation suppressed. The result is one
         continuous slide, no teleport, no re-entry animation. */
      setDragX(x > 0 ? w : -w);
      glideTargetRef.current = target;
      glideTRef.current = setTimeout(finishCommit, 250);
    } else {
      setDragX(0);
      setPeek(null);
    }
  };

  const scrollMain = (dir) => (e) => {
    e.preventDefault();
    const m = document.querySelector('#root main') || document.querySelector('main');
    if (m) m.scrollBy({ top: dir * m.clientHeight * 0.7, behavior: 'smooth' });
  };

  const resetLayout = (e) => {
    e.preventDefault();
    try {
      localStorage.removeItem(UI_ORDER_KEY);
      localStorage.removeItem(UI_LAYOUT_KEY);
    } catch (err) {}
    applyUiLayout();
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 1400);
  };

  const paneW = gRef.current.width || 0;

  return jsxs('div', {
    ref: shellRef,
    className: 'relative mx-auto max-w-[430px] w-full h-[100dvh] overflow-hidden bg-transparent flex flex-col',
    style: { touchAction: 'pan-y' },
    onTouchStart: onTouchStart,
    onTouchMove: onTouchMove,
    onTouchEnd: onTouchTouchEndGuard(onTouchEnd),
    children: [
      jsx('style', { children: SHELL_CSS }),
      jsx(RouteWatcher, {}),
      jsx(HC, {}),
      jsx(LTTopNav, {}),
      jsx('div', {
        ref: undefined,
        className: 'relative flex-1 min-h-0 overflow-hidden',
        children: [
          jsx('div', {
            key: pathname,
            ref: wrapRef,
            className: cn('h-full', enterDir === 1 ? 'lt-page-in-r' : enterDir === -1 ? 'lt-page-in-l' : ''),
            style: {
              transform: dragX ? 'translateX(' + dragX + 'px)' : undefined,
              transition: tracking ? 'none' : 'transform 240ms cubic-bezier(.22,.61,.36,1)'
            },
            children: pageEl
          }),
          peek ? jsx('div', {
            key: 'peek-' + peek,
            ref: peekRef,
            /* Mark the peeked route so enhancements (e.g. Journal Full view
               buttons) know a copy of that page is live even before the route
               actually commits — otherwise the peeked Journal looked incomplete
               (no Full view pill) during the hold-slide. */
            'data-lt-peek': peek,
            className: 'absolute inset-0 pointer-events-none overflow-hidden',
            style: {
              transform: 'translateX(' + (dragX + (dragX > 0 ? -paneW : paneW)) + 'px)',
              transition: tracking ? 'none' : 'transform 240ms cubic-bezier(.22,.61,.36,1)'
            },
            children: peekEl
          }) : null
        ]
      }),
      jsx(ck, {}),
      editorOn ? jsxs('div', {
        className: 'fixed left-1/2 -translate-x-1/2 z-[70] w-[min(344px,calc(100vw-20px))] rounded-2xl bg-[#04091e]/95 backdrop-blur-md border border-white/10 shadow-[0_18px_50px_rgba(4,9,30,.55)] px-3.5 py-3',
        style: { bottom: 'calc(74px + env(safe-area-inset-bottom, 0px))' },
        children: [
          jsxs('div', {
            className: 'flex items-start gap-2 pb-2.5',
            children: [
              jsx('span', { className: 'text-accent text-[13px] leading-none mt-[1px]', children: '\u2725' }),
              jsx('span', { className: 'text-[11.5px] leading-snug font-semibold text-white/75', children: 'Hold a box, then drop it on another to swap \u2014 same size, same line.' })
            ]
          }),
          jsxs('div', {
            className: 'flex items-center justify-between gap-2',
            children: [
              jsxs('div', { className: 'flex items-center gap-1.5', children: [
                jsx('button', {
                  className: 'w-8 h-8 rounded-xl bg-white/10 text-white/85 text-[11px] font-black active:bg-white/20 transition',
                  onPointerDown: scrollMain(-1),
                  'aria-label': 'Scroll up',
                  children: '\u25B2'
                }),
                jsx('button', {
                  className: 'w-8 h-8 rounded-xl bg-white/10 text-white/85 text-[11px] font-black active:bg-white/20 transition',
                  onPointerDown: scrollMain(1),
                  'aria-label': 'Scroll down',
                  children: '\u25BC'
                })
              ]}),
              jsxs('div', { className: 'flex items-center gap-1.5', children: [
                jsx('button', {
                  className: 'h-9 min-w-[74px] px-4 rounded-full border border-white/15 text-white/85 text-[11px] font-bold active:bg-white/10 transition',
                  onPointerDown: resetLayout,
                  children: resetFlash ? 'Reset \u2713' : 'Reset'
                }),
                jsx('button', {
                  className: 'h-9 px-6 rounded-full bg-accent text-black text-[11px] font-black tracking-wide active:opacity-80 transition shadow-[0_6px_18px_rgba(0,194,168,.35)]',
                  onPointerDown: (e) => { e.preventDefault(); setEditorOn(false); try { window.dispatchEvent(new CustomEvent('lt-ui-editor-done')); } catch (err) {} },
                  children: 'Done'
                })
              ]})
            ]
          })
        ]
      }) : null
    ]
  });
}

/* Guard: tolerate touchend arriving after state resets. */
function onTouchTouchEndGuard(fn) {
  return (e) => { try { fn(e); } catch (err) {} };
}

/* Tab order — must match the bottom nav (ck). */
const TABS = ['/', '/activity', '/timeline', '/journal', '/settings'];

function tabIndex(path) {
  for (let i = 0; i < TABS.length; i++) {
    const t = TABS[i];
    if (t === '/' ? path === '/' : path.indexOf(t) === 0) return i;
  }
  return -1;
}

const uk = [{
  href: "/",
  icon: Timer,
  label: "Timer"
}, {
  href: "/activity",
  icon: ListTodo,
  label: "Activity"
}, {
  href: "/timeline",
  icon: LayoutGrid,
  label: "Life Hub"
}, {
  href: "/journal",
  icon: BookOpen,
  label: "Journal"
}, {
  href: "/settings",
  icon: Settings,
  label: "Settings"
}];

/* Floating pill bottom nav — five equal flat tabs, no elevated centre
    button: Timer, Activity, Life Hub, Journal, Settings. */
export function ck() {
  const { pathname: e } = useLocation();
  /* While the UI editor is open, only the three editable tabs (Timer,
     Activity, Journal) stay reachable — Life Hub + Settings are hidden so
     the editor can't touch them. Reacts to the same events the shell uses. */
  const [editing, setEditing] = useState(
    () => typeof document !== 'undefined' && document.body.classList.contains('lt-ui-editing')
  );
  useEffect(() => {
    const on = () => setEditing(true);
    const off = () => setEditing(false);
    window.addEventListener('lt-ui-editor-open', on);
    window.addEventListener('lt-ui-editor-done', off);
    return () => {
      window.removeEventListener('lt-ui-editor-open', on);
      window.removeEventListener('lt-ui-editor-done', off);
    };
  }, []);
  const items = editing
    ? uk.filter((it) => it.href !== '/timeline' && it.href !== '/settings')
    : uk;

  return jsx("div", {
    className: "fixed inset-x-0 z-50 px-3",
    style: {
      bottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
      pointerEvents: "none"
    },
    children: jsx("nav", {
      className: "pointer-events-auto mx-auto w-full max-w-[406px] bg-white rounded-full border border-border px-2 py-1.5 flex items-center",
      style: { boxShadow: "0 10px 30px rgba(4, 9, 30, 0.18)" },
      children: items.map(({ href: t, icon: n, label: r }) => {
        const o = t === "/" ? e === "/" : e.startsWith(t);
        return jsxs(Link, {
          to: t,
          className: cn("flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full transition-colors text-[10px] font-semibold tracking-wide", o ? "text-primary bg-secondary" : "text-muted-foreground active:text-muted-foreground"),
          children: [jsx(n, {
            className: cn("w-[18px] h-[18px]", o && "stroke-[2.5]")
          }), jsx('span', { className: 'w-full text-center truncate', children: r })]
        }, t);
      })
    })
  });
}

export function dk() {
  return jsx("div", {
    className: "min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-6",
    children: jsxs("div", {
      className: "text-center max-w-sm",
      children: [jsxs("div", {
        className: "w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 relative",
        children: [jsx("div", {
          className: "absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"
        }), jsx("span", {
          className: "text-4xl",
          children: "🕰️"
        })]
      }), jsx("h1", {
        className: "text-4xl font-extrabold tracking-tight text-white mb-4",
        children: "Lost in Time"
      }), jsx("p", {
        className: "text-muted-foreground text-lg mb-8 leading-relaxed",
        children: "The page you are looking for has slipped away."
      }), jsx(Link, {
        to: "/",
        className: "inline-flex items-center justify-center px-8 py-4 bg-white text-black rounded-2xl font-bold tracking-wide active:scale-95 transition-transform",
        children: "Return Home"
      })]
    })
  })
}
