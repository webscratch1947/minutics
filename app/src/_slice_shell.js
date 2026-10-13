import { jsx, jsxs } from 'react/jsx-runtime';
import { useState, useEffect, useRef } from 'react';
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
    return 'Demo ' + min + ':' + (sec < 10 ? '0' : '') + sec;
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
    /* Idle bar: subtle accent outline so the strip reads as a deliberate
       card instead of blending into the dark page (user request). */
    return jsxs('div', {
      className: 'flex items-center gap-2 px-4 py-2 bg-[#060d28] text-white/40 text-xs font-bold border-b-2 border-accent/40',
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
        className: 'w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse'
      }),
      jsx('span', {
        className: 'flex-1 truncate',
        children: (activity ? activity.name : 'Activity') + ' — ' + timeStr
      }),
      jsx(DemoClock, { tone: 'text-white/75' }),
      jsx('button', {
        onClick: stopTimer,
        className: 'bg-white/15 text-white border-none rounded-full px-2.5 py-1 text-[10px] font-extrabold shrink-0',
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

/* ── UI layout editor (hold → drag → persisted positions) ───────────────
   Boxes marked with data-lt-move can be repositioned in editor mode. The
   saved offsets are absolute positions inside the shared scroll container
   (main, which is position:relative) and are re-applied on every render
   pass, so the layout survives reloads and route switches. */
const UI_LAYOUT_KEY = 'lt_ui_layout_v1';

function uiLayoutRead() {
  try {
    const o = JSON.parse(localStorage.getItem(UI_LAYOUT_KEY) || '{}');
    return (o && typeof o === 'object') ? o : {};
  } catch (e) { return {}; }
}
function uiLayoutWrite(o) {
  try { localStorage.setItem(UI_LAYOUT_KEY, JSON.stringify(o)); } catch (e) {}
}
export function uiLayoutHasEntries() {
  const o = uiLayoutRead();
  for (const k in o) { if (o[k] && typeof o[k].x === 'number') return true; }
  return false;
}
export function applyUiLayout() {
  let store;
  try { store = uiLayoutRead(); } catch (e) { return; }
  const nodes = document.querySelectorAll('[data-lt-move]');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    /* Never fight an in-progress drag (the periodic re-apply pass would
       otherwise snap the box back to its last saved spot). */
    if (el.classList && el.classList.contains('lt-dragging')) continue;
    const s = store[el.getAttribute('data-lt-move')];
    if (s && typeof s.x === 'number') {
      el.style.position = 'absolute';
      el.style.left = s.x + 'px';
      el.style.top = s.y + 'px';
      if (s.w) el.style.width = s.w + 'px';
      el.style.zIndex = '4';
      el.style.margin = '0px';
    } else if (el.style.position === 'absolute' && el.style.left) {
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
      el.style.zIndex = '';
      el.style.margin = '';
    }
  }
}

/* Pointer controller: long-press (350ms) a marked box to lift it, drag to
   move (text/buttons stay attached — the whole box moves), release to save. */
let _uiBound = false;
let _hold = null;
let _dragEl = null;
let _dragStart = null;
let _justDragged = false;

function uiEditorBind() {
  if (_uiBound) return;
  _uiBound = true;

  const editing = () => document.body.classList.contains('lt-ui-editing');

  const down = (e) => {
    if (!editing() || _dragEl) return;
    const el = (e.target && e.target.closest) ? e.target.closest('[data-lt-move]') : null;
    if (!el) return;
    _justDragged = false;
    const px = e.clientX, py = e.clientY;
    _hold = { el: el, x: px, y: py, t: setTimeout(() => {
      if (!_hold) return;
      _dragEl = _hold.el;
      _dragStart = {
        px: px, py: py,
        ox: _dragEl.offsetLeft, oy: _dragEl.offsetTop,
        w: _dragEl.offsetWidth,
        key: _dragEl.getAttribute('data-lt-move')
      };
      try {
        _dragEl.classList.add('lt-dragging');
        document.body.style.userSelect = 'none';
        if (navigator.vibrate) navigator.vibrate(10);
      } catch (err) {}
    }, 350) };
  };

  const move = (e) => {
    if (_hold && !_dragEl) {
      if (Math.abs(e.clientX - _hold.x) > 10 || Math.abs(e.clientY - _hold.y) > 10) {
        clearTimeout(_hold.t);
        _hold = null;
      }
      return;
    }
    if (!_dragEl) return;
    try { e.preventDefault(); } catch (err) {}
    _dragEl.style.left = (_dragStart.ox + (e.clientX - _dragStart.px)) + 'px';
    _dragEl.style.top = (_dragStart.oy + (e.clientY - _dragStart.py)) + 'px';
  };

  const up = () => {
    if (_hold) { clearTimeout(_hold.t); _hold = null; }
    if (!_dragEl) return;
    try {
      const store = uiLayoutRead();
      store[_dragStart.key] = {
        x: parseInt(_dragEl.style.left, 10) || 0,
        y: parseInt(_dragEl.style.top, 10) || 0,
        w: _dragStart.w
      };
      uiLayoutWrite(store);
      _dragEl.classList.remove('lt-dragging');
    } catch (err) {}
    document.body.style.userSelect = '';
    _dragEl = null;
    _dragStart = null;
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
  'body.lt-ui-editing [data-lt-move]{outline:1px dashed rgba(0,194,168,.55);outline-offset:-2px;touch-action:none;cursor:grab}',
  'body.lt-ui-editing [data-lt-move].lt-dragging{outline:2px solid #00C2A8;cursor:grabbing;box-shadow:0 14px 34px rgba(4,9,30,.35);opacity:.96;z-index:60!important;transition:none}'
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
     render so the keyed page wrapper mounts with its class already set. */
  const animRef = useRef({ prev: pathname, dir: 0 });
  if (animRef.current.prev !== pathname) {
    const pi = tabIndex(animRef.current.prev);
    const ni = tabIndex(pathname);
    animRef.current = {
      prev: pathname,
      dir: (pi >= 0 && ni >= 0 && pi !== ni) ? (ni > pi ? 1 : -1) : 1
    };
  }
  const enterDir = animRef.current.dir;

  /* Horizontal swipe state */
  const gRef = useRef({ active: false, locked: null, startX: 0, startY: 0, width: 0 });
  const [dragX, setDragX] = useState(0);
  const [peek, setPeek] = useState(null);
  const [tracking, setTracking] = useState(false);

  /* UI editor state */
  const [editorOn, setEditorOn] = useState(false);

  useEffect(() => {
    const onOpen = () => setEditorOn(true);
    const onDone = () => setEditorOn(false);
    window.addEventListener('lt-ui-editor-open', onOpen);
    window.addEventListener('lt-ui-editor-done', onDone);
    return () => {
      window.removeEventListener('lt-ui-editor-open', onOpen);
      window.removeEventListener('lt-ui-editor-done', onDone);
    };
  }, []);

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

  const onTouchStart = (e) => {
    if (editorOn) return;
    if (!e.touches || e.touches.length !== 1) {
      gRef.current.locked = 'v';
      return;
    }
    const t = e.touches[0];
    gRef.current = {
      active: true, locked: null,
      startX: t.clientX, startY: t.clientY,
      width: shellRef.current ? shellRef.current.clientWidth : 0
    };
  };

  const onTouchMove = (e) => {
    const g = gRef.current;
    if (!g.active || g.locked === 'v' || !e.touches || !e.touches.length) return;
    const t = e.touches[0];
    const dx = t.clientX - g.startX;
    const dy = t.clientY - g.startY;
    if (!g.locked) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        g.locked = 'h';
        setTracking(true);
      } else if (Math.abs(dy) > 14) {
        g.locked = 'v';
        return;
      } else {
        return;
      }
    }
    if (g.locked !== 'h') return;
    const idx = tabIndex(pathname);
    const nextIdx = dx > 0 ? idx - 1 : idx + 1;
    const has = idx >= 0 && nextIdx >= 0 && nextIdx < TABS.length;
    let x = has ? dx : dx * 0.22;
    const w = g.width || 1;
    if (x > w) x = w;
    if (x < -w) x = -w;
    setDragX(x);
    setPeek(has ? TABS[nextIdx] : null);
  };

  const onTouchEnd = () => {
    const g = gRef.current;
    g.active = false;
    if (g.locked !== 'h') { g.locked = null; return; }
    g.locked = null;
    setTracking(false);
    const w = g.width || 1;
    const target = peek;
    if (target && Math.abs(dragX) > w * 0.26) {
      /* Commit: glide fully to the edge, then navigate — the new tab
         mounts with its own slide-in from the same side. */
      setDragX(dragX > 0 ? w : -w);
      setTimeout(() => {
        navigate(target);
        setDragX(0);
        setPeek(null);
      }, 230);
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
    try { localStorage.removeItem(UI_LAYOUT_KEY); } catch (err) {}
    applyUiLayout();
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
            className: cn('h-full', enterDir === 1 ? 'lt-page-in-r' : enterDir === -1 ? 'lt-page-in-l' : ''),
            style: {
              transform: dragX ? 'translateX(' + dragX + 'px)' : undefined,
              transition: tracking ? 'none' : 'transform 240ms cubic-bezier(.22,.61,.36,1)'
            },
            children: jsx('main', {
              className: 'relative h-full overflow-y-auto overscroll-contain pb-[calc(96px+env(safe-area-inset-bottom,0px))] no-scrollbar',
              children: jsx(AppRoutes, { profile })
            })
          }),
          peek ? jsx('div', {
            key: 'peek-' + peek,
            className: 'absolute inset-0 bg-background pointer-events-none overflow-hidden',
            style: {
              transform: 'translateX(' + (dragX + (dragX > 0 ? -paneW : paneW)) + 'px)',
              transition: tracking ? 'none' : 'transform 240ms cubic-bezier(.22,.61,.36,1)'
            },
            children: jsx(AppRoutes, {
              profile,
              location: { pathname: peek, search: '', hash: '', state: null, key: 'peek' }
            })
          }) : null
        ]
      }),
      jsx(ck, {}),
      editorOn ? jsxs('div', {
        className: 'fixed left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1.5 bg-[#04091e] text-white rounded-full px-2 py-1.5 shadow-[0_10px_30px_rgba(4,9,30,.4)] border border-white/10',
        style: { bottom: 'calc(70px + env(safe-area-inset-bottom, 0px))' },
        children: [
          jsx('span', { className: 'text-[10px] font-bold text-white/70 pl-1 pr-0.5', children: 'Hold a box to move it' }),
          jsx('button', {
            className: 'w-7 h-7 rounded-full bg-white/10 text-white text-xs font-black active:bg-white/20',
            onPointerDown: scrollMain(-1),
            'aria-label': 'Scroll up',
            children: '\u25B2'
          }),
          jsx('button', {
            className: 'w-7 h-7 rounded-full bg-white/10 text-white text-xs font-black active:bg-white/20',
            onPointerDown: scrollMain(1),
            'aria-label': 'Scroll down',
            children: '\u25BC'
          }),
          jsx('button', {
            className: 'h-7 px-2.5 rounded-full bg-white/10 text-white text-[11px] font-black active:bg-white/20',
            onPointerDown: resetLayout,
            children: 'Reset'
          }),
          jsx('button', {
            className: 'h-7 px-3 rounded-full bg-accent text-black text-[11px] font-black active:opacity-80',
            onPointerDown: (e) => { e.preventDefault(); setEditorOn(false); try { window.dispatchEvent(new CustomEvent('lt-ui-editor-done')); } catch (err) {} },
            children: 'Done'
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

  return jsx("div", {
    className: "fixed inset-x-0 z-50 px-3",
    style: {
      bottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
      pointerEvents: "none"
    },
    children: jsx("nav", {
      className: "pointer-events-auto mx-auto w-full max-w-[406px] bg-white rounded-full border border-border px-2 py-1.5 flex items-center",
      style: { boxShadow: "0 10px 30px rgba(4, 9, 30, 0.18)" },
      children: uk.map(({ href: t, icon: n, label: r }) => {
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
