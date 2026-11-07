import { useEffect, useRef, useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';

/* ── Android permissions onboarding ───────────────────────────────────────
   Shown right after the welcome step, Android app only. Every row reflects
   the REAL system state via AndroidBridge.getPermissionStatus(); the user
   cannot leave this step until all of them are granted.

   Tapping Allow opens the FULL tutorial first. The real Android settings
   screen opens only from the tutorial's own button, so the guide is never
   skipped behind the system UI. Permissions that are just a single system
   dialog (Notifications, Background) skip the guide entirely.

   The tutorial sheet can be closed by tapping × or by dragging the top
   handle downwards. */ 

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
      'Search for Minutics in the list.',
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
      'Turn its switch on.',
      'Go back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    desc: 'Counts reels and shorts for Doom scroll stopper.',
    icon: 'accessibility',
    steps: [
      'Tap Downloaded apps.',
      'Tap Minutics Doom scroll stopper.',
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

/* Permissions that are a single system dialog need no tutorial. */
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

/* ── Animated walkthrough scenes (match the real opened screen) ─────────── */
function scenesFor(key) {
  switch (key) {
    case 'overlay': return [
      { type: 'list', title: 'Display over other apps', items: ['Minutics', 'WhatsApp', 'Instagram', 'YouTube'], target: 'Minutics', caption: 'Search for Minutics' },
      { type: 'toggle', title: 'Minutics', label: 'Allow display over other apps', caption: 'Turn on Allow display over other apps' },
      { type: 'done', caption: 'Go back to Minutics' }
    ];
    case 'popup': return [
      { type: 'appinfo', target: 'Display pop-up windows', caption: 'Tap Display pop-up windows' },
      { type: 'toggle', title: 'Display pop-up windows', label: 'Allow pop-up windows', caption: 'Turn the switch on' },
      { type: 'done', caption: 'Go back to Minutics' }
    ];
    case 'autostart': return [
      { type: 'list', title: 'Auto Start', items: ['Minutics', 'Instagram', 'WhatsApp', 'Spotify'], target: 'Minutics', caption: 'Find Minutics' },
      { type: 'toggle', title: 'Auto start', label: 'Allow auto start', caption: 'Turn the switch on' },
      { type: 'done', caption: 'Go back to Minutics' }
    ];
    case 'accessibility': return [
      { type: 'home', target: 'Accessibility', caption: 'Open Settings, then Accessibility' },
      { type: 'list', title: 'Downloaded apps', items: ['Minutics Doom scroll stopper', 'TalkBack', 'Select to Speak', 'Switch Access', 'Voice Access'], target: 'Minutics Doom scroll stopper', caption: 'Tap Minutics Doom scroll stopper' },
      { type: 'dialog', caption: 'Tap Allow on the prompt' }
    ];
    default: return [
      { type: 'appinfo', target: 'Permission', caption: 'Tap the permission' },
      { type: 'toggle', title: 'Permission', label: 'Allow', caption: 'Turn the switch on' },
      { type: 'done', caption: 'Go back to Minutics' }
    ];
  }
}

function TapFinger() {
  return jsx('span', { className: 'lt-mock-finger', 'aria-hidden': true });
}

function MockStatus() {
  return jsxs('div', { className: 'lt-mock-status', children: [
    jsx('span', { children: '10:24' }),
    jsx('span', { children: '78%' })
  ] });
}

function MockHome({ scene }) {
  var base = ['Network & internet', 'Connected devices', 'Apps', 'Notifications', 'Battery', 'Accessibility'];
  var rows = base.indexOf(scene.target) === -1
    ? base.slice(0, 5).concat([scene.target])
    : base;
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsx('div', { className: 'lt-mock-h1', children: 'Settings' }),
    jsx('div', { className: 'lt-mock-search', children: 'Search settings' }),
    jsx('div', { className: 'lt-mock-list', children: rows.map(function (label) {
      var on = label === scene.target;
      return jsxs('div', { className: 'lt-mock-item' + (on ? ' is-target' : ''), children: [
        jsx('span', { children: label }),
        jsx('span', { className: 'lt-mock-chev', children: '\u203A' }),
        on ? jsx(TapFinger, {}) : null
      ] }, label);
    }) })
  ] });
}

function MockAppInfo({ scene }) {
  var rows = ['Notifications', 'Permissions', 'Battery', scene.target];
  rows = rows.filter(function (v, i, a) { return a.indexOf(v) === i; });
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsxs('div', { className: 'lt-mock-appbar', children: [
      jsx('span', { className: 'lt-mock-back', children: '\u2039' }),
      jsx('img', { src: LOGO, alt: '' }),
      jsx('b', { children: 'Minutics Settings' })
    ] }),
    jsxs('div', { className: 'lt-mock-card', children: [
      jsx('img', { src: LOGO, alt: '' }),
      jsxs('div', { children: [
        jsx('b', { children: 'Minutics' }),
        jsx('span', { children: 'v1.1.0' })
      ] })
    ] }),
    jsx('div', { className: 'lt-mock-list', children: rows.map(function (label) {
      var on = label === scene.target;
      return jsxs('div', { className: 'lt-mock-item' + (on ? ' is-target' : ''), children: [
        jsx('span', { children: label }),
        jsx('span', { className: 'lt-mock-chev', children: '\u203A' }),
        on ? jsx(TapFinger, {}) : null
      ] }, label);
    }) })
  ] });
}

function MockList({ scene }) {
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsxs('div', { className: 'lt-mock-appbar', children: [
      jsx('span', { className: 'lt-mock-back', children: '\u2039' }),
      jsx('b', { children: scene.title })
    ] }),
    jsx('div', { className: 'lt-mock-search', children: 'Search' }),
    jsx('div', { className: 'lt-mock-list lt-mock-list-tall', children: scene.items.map(function (label) {
      var on = label === scene.target;
      return jsxs('div', { className: 'lt-mock-item' + (on ? ' is-target' : ''), children: [
        jsx('span', { children: label }),
        jsx('span', { className: 'lt-mock-chev', children: '\u203A' }),
        on ? jsx(TapFinger, {}) : null
      ] }, label);
    }) })
  ] });
}

function MockToggle({ scene }) {
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsxs('div', { className: 'lt-mock-appbar', children: [
      jsx('span', { className: 'lt-mock-back', children: '\u2039' }),
      jsx('b', { children: scene.title })
    ] }),
    jsxs('div', { className: 'lt-mock-togglecard', children: [
      jsx('img', { src: LOGO, alt: '' }),
      jsxs('div', { className: 'lt-mock-toggletext', children: [
        jsx('b', { children: scene.label }),
        jsx('span', { children: 'Minutics' })
      ] }),
      jsxs('span', { className: 'lt-mock-switch', children: [jsx('i', {})] })
    ] }),
    jsx('p', { className: 'lt-mock-hint', children: 'Tap the switch, then come back to Minutics.' }),
    jsx('span', { className: 'lt-mock-allowed', children: '\u2713 Allowed' }),
    jsx(TapFinger, {})
  ] });
}

function MockDialog({ scene }) {
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsxs('div', { className: 'lt-mock-dialog', children: [
      jsx('b', { children: 'Minutics' }),
      jsx('p', { children: 'Allow Minutics to perform this action?' }),
      jsxs('div', { className: 'lt-mock-dialog-btns', children: [
        jsx('span', { className: 'lt-mock-dialog-cancel', children: 'Deny' }),
        jsxs('span', { className: 'lt-mock-dialog-ok', children: ['Allow', jsx(TapFinger, {})] })
      ] })
    ] })
  ] });
}

function MockDone({ scene }) {
  return jsxs('div', { className: 'lt-mock-body', children: [
    jsx(MockStatus, {}),
    jsxs('div', { className: 'lt-mock-done', children: [
      jsx('span', { className: 'lt-mock-done-tick', children: '\u2713' }),
      jsx('b', { children: 'Granted' }),
      jsx('span', { children: 'Back to Minutics' })
    ] })
  ] });
}

function renderScene(scene) {
  if (scene.type === 'home') return jsx(MockHome, { scene: scene });
  if (scene.type === 'appinfo') return jsx(MockAppInfo, { scene: scene });
  if (scene.type === 'list') return jsx(MockList, { scene: scene });
  if (scene.type === 'toggle') return jsx(MockToggle, { scene: scene });
  if (scene.type === 'dialog') return jsx(MockDialog, { scene: scene });
  if (scene.type === 'done') return jsx(MockDone, { scene: scene });
  return jsx(MockHome, { scene: scene });
}

function PhoneMock({ scenes, scene }) {
  return jsxs('div', { className: 'lt-guide-phone', 'aria-hidden': true, children: [
    jsx('span', { className: 'lt-guide-notch' }),
    jsx('div', { className: 'lt-guide-screen', children: scenes.map(function (s, i) {
      return jsx('div', {
        className: 'lt-mock-scene' + (i === scene ? ' is-active' : ''),
        children: renderScene(s)
      }, i);
    }) })
  ] });
}

/* ── Tutorial sheet ─────────────────────────────────────────────────────── */
function GuideSheet({ perm, index, onOpenSettings, onClose }) {
  var [scene, setScene] = useState(0);
  var [dragY, setDragY] = useState(0);
  var startY = useRef(null);
  var scenes = scenesFor(perm.key);

  useEffect(function () {
    setScene(0);
    var iv = setInterval(function () {
      setScene(function (s) { return (s + 1) % scenes.length; });
    }, 3800);
    return function () { clearInterval(iv); };
  }, [perm.key]);

  function onTouchStart(e) {
    try { startY.current = e.touches[0].clientY; } catch (err) {}
  }
  function onTouchMove(e) {
    if (startY.current == null) return;
    var dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  }
  function onTouchEnd() {
    if (dragY > 70) onClose();
    setDragY(0);
    startY.current = null;
  }

  return createPortal(
    jsx('div', {
      className: 'lt-guide',
      role: 'dialog',
      'aria-modal': 'true',
      'data-perm-tutorial': perm.key,
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
              'data-guide-close': '1', onClick: onClose, children: '\u2715'
            })
          ] }),
          jsx(PhoneMock, { scenes: scenes, scene: scene }),
          jsx('div', { className: 'lt-guide-dots', children: scenes.map(function (_, i) {
            return jsx('span', { className: 'lt-guide-dot' + (i === scene ? ' is-on' : '') }, i);
          }) }),
          jsx('p', { className: 'lt-guide-caption', children: scenes[scene] ? scenes[scene].caption : '' }),
          jsx('ol', { className: 'lt-guide-steps', children: perm.steps.map(function (s, i) {
            return jsx('li', {
              className: i === scene ? 'is-active' : '',
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
            onClick: onClose, children: 'Got it, I’ll do it myself'
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
    '@keyframes ltGuideFade{from{opacity:0}to{opacity:1}}',
    '.lt-guide-sheet{width:100%;max-width:430px;max-height:94dvh;overflow:auto;background:#F6F4EE;border-radius:26px 26px 0 0;padding:8px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -18px 50px rgba(0,0,0,.4);animation:ltGuideUp .28s cubic-bezier(.22,.61,.36,1);touch-action:pan-y}',
    '@media(min-width:520px){.lt-guide{align-items:center}.lt-guide-sheet{border-radius:26px;max-height:90dvh}}',
    '@keyframes ltGuideUp{from{transform:translateY(26px);opacity:.4}to{transform:none;opacity:1}}',
    '.lt-guide-grip{display:block;width:46px;height:5px;border-radius:999px;background:#C9C2B2;margin:2px auto 10px;cursor:grab;touch-action:none}',
    '.lt-guide-grip:active{cursor:grabbing;background:#A8A090}',
    '.lt-guide-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
    '.lt-guide-icon{width:40px;height:40px;border-radius:13px;background:#DCFCE7;color:#157347;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.lt-guide-title{flex:1;min-width:0}',
    '.lt-guide-eyebrow{font-size:9.5px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#9AA1AE;margin:0 0 1px}',
    '.lt-guide-title h3{font-size:18px;font-weight:900;color:#14162E;margin:0;line-height:1.15}',
    '.lt-guide-x{background:none;border:none;font-size:17px;color:#9AA1AE;cursor:pointer;padding:4px;flex-shrink:0}',

    '.lt-guide-phone{position:relative;width:214px;height:192px;margin:0 auto 8px;border:5px solid #23262E;border-radius:24px;background:#F7F8FA;overflow:hidden;box-shadow:0 14px 30px -14px rgba(20,32,80,.45)}',
    '.lt-guide-notch{position:absolute;left:50%;top:3px;width:38px;height:5px;margin-left:-19px;border-radius:999px;background:#23262E;z-index:5}',
    '.lt-guide-screen{position:absolute;inset:0;overflow:hidden;border-radius:18px;background:#F7F8FA}',
    '.lt-mock-scene{position:absolute;inset:0;opacity:0;transform:translateX(12px);transition:opacity .32s ease,transform .32s ease;pointer-events:none}',
    '.lt-mock-scene.is-active{opacity:1;transform:none}',
    '.lt-mock-body{position:absolute;inset:0;display:flex;flex-direction:column}',
    '.lt-mock-status{display:flex;justify-content:space-between;align-items:center;font-size:7px;font-weight:700;color:#1A1C22;padding:5px 9px 3px}',
    '.lt-mock-h1{font-size:13px;font-weight:900;color:#14162E;padding:0 9px 4px}',
    '.lt-mock-search{margin:0 8px 5px;background:#E9EBEF;border-radius:6px;font-size:6.5px;color:#6B7280;padding:3px 6px}',
    '.lt-mock-list{display:flex;flex-direction:column;gap:3px;padding:0 8px;overflow:hidden}',
    '.lt-mock-list-tall{gap:5px;padding-top:2px}',
    '.lt-mock-item{position:relative;display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:17px;padding:2px 6px;background:#fff;border-radius:5px;font-size:7.5px;font-weight:600;color:#1A1C22;line-height:1.15}',
    '.lt-mock-item.is-target{background:#ECFDF3;box-shadow:0 0 0 1.5px #22C55E inset;animation:ltMockTarget 2.4s ease-in-out infinite}',
    '@keyframes ltMockTarget{0%,100%{box-shadow:0 0 0 1.5px #22C55E inset}50%{box-shadow:0 0 0 2.5px rgba(34,197,94,.45) inset}}',
    '.lt-mock-chev{color:#9AA1AE;font-size:9px;line-height:1}',
    '.lt-mock-item.is-target .lt-mock-chev{opacity:0}',
    '.lt-mock-appbar{display:flex;align-items:center;gap:5px;padding:2px 9px 5px;color:#14162E}',
    '.lt-mock-appbar img{width:13px;height:13px;border-radius:4px}',
    '.lt-mock-appbar b{font-size:8.5px;font-weight:800}',
    '.lt-mock-back{font-size:12px;line-height:1;color:#1A1C22;margin-right:1px}',
    '.lt-mock-card{display:flex;align-items:center;gap:7px;margin:0 8px 6px;padding:5px 7px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(20,32,80,.08)}',
    '.lt-mock-card img{width:24px;height:24px;border-radius:7px}',
    '.lt-mock-card b{display:block;font-size:9px;font-weight:900;color:#14162E;line-height:1.1}',
    '.lt-mock-card span{display:block;font-size:6.5px;color:#8B93A1;line-height:1.3}',
    '.lt-mock-option{padding:4px 6px;align-items:center}',
    '.lt-mock-option-text b{display:block;font-size:7.5px;font-weight:800;line-height:1.1}',
    '.lt-mock-option-text i{display:block;font-style:normal;font-size:6px;color:#8B93A1;line-height:1.3}',
    '.lt-mock-radio{width:12px;height:12px;border-radius:999px;border:1.5px solid #C9CFD8;display:flex;align-items:center;justify-content:center;font-size:7px;color:#fff;flex-shrink:0}',
    '.lt-mock-option.is-picked .lt-mock-radio{background:#22C55E;border-color:#22C55E}',
    '.lt-mock-togglecard{display:flex;align-items:center;gap:7px;margin:4px 8px 0;padding:6px 7px;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(20,32,80,.08);position:relative}',
    '.lt-mock-togglecard img{width:22px;height:22px;border-radius:6px;flex-shrink:0}',
    '.lt-mock-toggletext{flex:1;min-width:0}',
    '.lt-mock-toggletext b{display:block;font-size:7.5px;font-weight:800;color:#14162E;line-height:1.15}',
    '.lt-mock-toggletext span{display:block;font-size:6.2px;color:#8B93A1;line-height:1.3}',
    '.lt-mock-switch{position:relative;width:26px;height:15px;border-radius:999px;background:#3A3F4C;flex-shrink:0;animation:ltMockSwitchBg 3.8s ease-in-out infinite}',
    '.lt-mock-switch i{position:absolute;top:2px;left:2px;width:11px;height:11px;border-radius:999px;background:#fff;animation:ltMockSwitchKnob 3.8s ease-in-out infinite}',
    '@keyframes ltMockSwitchBg{0%,35%{background:#3A3F4C}55%,100%{background:#22C55E}}',
    '@keyframes ltMockSwitchKnob{0%,35%{left:2px}55%,100%{left:13px}}',
    '.lt-mock-hint{margin:6px 10px 0;font-size:6.5px;line-height:1.35;color:#6B7280}',
    '.lt-mock-allowed{align-self:flex-start;margin:5px 10px 0;padding:2px 7px;border-radius:999px;background:#DCFCE7;color:#157347;font-size:6.5px;font-weight:900;opacity:0;animation:ltMockAllowed 3.8s ease-in-out infinite}',
    '@keyframes ltMockAllowed{0%,50%{opacity:0;transform:translateY(3px)}65%,100%{opacity:1;transform:none}}',
    '.lt-mock-finger{position:absolute;right:9px;top:50%;width:15px;height:15px;margin-top:-7.5px;border-radius:999px;background:rgba(20,22,46,.9);box-shadow:0 2px 6px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.85);animation:ltMockTap 2.4s ease-in-out infinite;z-index:4}',
    '.lt-mock-finger:after{content:"";position:absolute;inset:4px;border-radius:999px;background:#fff;opacity:.9}',
    '@keyframes ltMockTap{0%,100%{transform:translate(8px,4px) scale(1);opacity:0}20%{transform:translate(2px,0) scale(1);opacity:1}42%{transform:translate(0,0) scale(.82);opacity:1}58%{transform:translate(0,0) scale(1);opacity:1}80%{transform:translate(2px,0) scale(1);opacity:.9}}',
    '.lt-mock-dialog{margin:18px 10px 0;padding:10px 10px 8px;background:#fff;border-radius:10px;box-shadow:0 2px 10px rgba(20,32,80,.12)}',
    '.lt-mock-dialog b{display:block;font-size:9px;font-weight:900;color:#14162E;margin-bottom:4px}',
    '.lt-mock-dialog p{margin:0 0 8px;font-size:7px;color:#5B6478;line-height:1.35}',
    '.lt-mock-dialog-btns{display:flex;justify-content:flex-end;gap:10px;font-size:7.5px;font-weight:800}',
    '.lt-mock-dialog-cancel{color:#6B7280;padding:3px 6px}',
    '.lt-mock-dialog-ok{color:#157347;padding:3px 6px;border-radius:6px;background:#ECFDF3;position:relative}',
    '.lt-mock-done{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px}',
    '.lt-mock-done-tick{width:30px;height:30px;border-radius:999px;background:#22C55E;color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900}',
    '.lt-mock-done b{font-size:10px;font-weight:900;color:#14162E}',
    '.lt-mock-done span{font-size:7px;color:#6B7280}',

    '.lt-guide-dots{display:flex;justify-content:center;gap:5px;margin:2px 0 6px}',
    '.lt-guide-dot{width:6px;height:6px;border-radius:999px;background:#D5CFC1;transition:all .25s}',
    '.lt-guide-dot.is-on{width:16px;background:#157347}',
    '.lt-guide-caption{text-align:center;font-size:12px;font-weight:800;color:#157347;margin:0 0 8px}',
    '.lt-guide-steps{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.lt-guide-steps li>span{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:#5B6478;padding:6px 8px;border-radius:10px;transition:background .25s,color .25s}',
    '.lt-guide-steps li.is-active>span{background:#fff;color:#14162E;box-shadow:0 2px 8px rgba(20,32,80,.07)}',
    '.lt-guide-steps b{width:20px;height:20px;border-radius:999px;background:#E9E4D7;color:#7A8494;font-size:10.5px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;transition:all .25s}',
    '.lt-guide-steps li.is-active b{background:#157347;color:#fff}',
    '.lt-guide-primary{width:100%;border:none;border-radius:14px;padding:13px;background:#157347;color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 18px -10px rgba(21,115,71,.7)}',
    '.lt-guide-primary:active{transform:scale(.985)}',
    '.lt-guide-secondary{width:100%;border:none;background:none;color:#7A8494;font-size:12.5px;font-weight:700;padding:10px 0 2px;cursor:pointer}'
  ].join('');
  document.head.appendChild(st);
}

/* ── The onboarding step ────────────────────────────────────────────────── */
export function PermissionsStep({ onChange }) {
  var [status, setStatus] = useState(readStatus);
  var [tutorial, setTutorial] = useState(null);
  var [mini, setMini] = useState(null);
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

  useEffect(function () {
    if (!mini) return;
    if (status && status[mini.key]) {
      setMini(null);
    }
  }, [status, mini]);

  /* Permissions that are a single system dialog skip the guide entirely. */
  var open = function (perm) {
    if (!needsGuide(perm.key)) {
      try { window.AndroidBridge.openPermissionSetting(perm.key); } catch (e) {}
      setMini(null);
      return;
    }
    setTutorial(perm);
    setMini(null);
  };

  var openSettings = function (perm) {
    try { window.AndroidBridge.openPermissionSetting(perm.key); } catch (e) {}
    setTutorial(null);
    setMini(perm);
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
      onClose: function () { setMini(tutorial); setTutorial(null); }
    }) : null,
    mini ? jsx('div', {
      className: 'lt-perm-mini',
      role: 'status',
      'data-perm-mini': mini.key,
      children: jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: '9px', width: '100%' }, children: [
        jsx('span', { className: 'lt-perm-mini-icon', children: jsx(PermIcon, { name: mini.icon, size: 18 }) }),
        jsxs('div', { className: 'lt-perm-mini-body', children: [
          jsx('b', { children: mini.title }),
          jsx('span', { children: 'Finish in Android settings, then come back.' })
        ] }),
        jsx('button', { type: 'button', className: 'lt-perm-mini-open', onClick: function () { open(mini); }, children: 'Open' }),
        jsx('button', { type: 'button', className: 'lt-perm-mini-x', 'aria-label': 'Stop tutorial', onClick: function () { setMini(null); }, children: '\u2715' })
      ] })
    }) : null
  ] });
}

export { allGranted };
