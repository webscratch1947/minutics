import { useEffect, useRef, useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';

/* ── Android permissions onboarding ───────────────────────────────────────
   Shown right after the welcome step, Android app only (window.AndroidBridge
   is injected by MainActivity). Every row reflects the REAL system state via
   AndroidBridge.getPermissionStatus(); the user cannot leave this step until
   all of them are granted.

   Each Allow opens the real Android settings screen AND a tutorial overlay
   with the numbered steps, a looping spoken walkthrough (Web Speech API —
   no recorded assets) and an animated mock of the Android settings screen
   showing where to tap. "Got it" collapses the tutorial into a small
   floating card that stays on screen and keeps the audio looping until the
   permission is actually granted. */

export function isAndroidNative() {
  try { return !!(window.AndroidBridge && window.AndroidBridge.getPermissionStatus); } catch { return false; }
}

export const PERMISSION_ROWS = [
  {
    key: 'overlay',
    title: 'Display over other apps',
    desc: 'Shows reminder popups above your other apps.',
    icon: 'overlay',
    steps: [
      'On the app info screen, tap Display over other apps.',
      'Turn on Allow display over other apps.',
      'Come back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'popup',
    title: 'Display pop-up windows',
    desc: 'Lets reminders appear while you are inside another app.',
    icon: 'popup',
    steps: [
      'On the app info screen, find Display pop-up windows.',
      'Turn the switch on.',
      'Come back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'background',
    title: 'Background',
    desc: 'Keeps your reminders alive when Minutics is closed.',
    icon: 'battery',
    steps: [
      'Tap Battery or Background activity.',
      'Choose Unrestricted or No restrictions.',
      'Come back to Minutics — this row turns green.'
    ]
  },
  {
    key: 'autostart',
    title: 'Auto Start',
    desc: 'Restarts reminders automatically after a reboot.',
    icon: 'autostart',
    steps: [
      'Open Auto Start in your phone’s security app.',
      'Find Minutics in the list.',
      'Turn its switch on, then come back.'
    ]
  },
  {
    key: 'accessibility',
    title: 'Accessibility',
    desc: 'Counts reels and shorts for Doom scroll stopper.',
    icon: 'accessibility',
    steps: [
      'Open Settings, then Accessibility.',
      'Tap Downloaded apps or Installed services.',
      'Tap Minutics Doom scroll stopper and turn it on.'
    ]
  },
  {
    key: 'notifications',
    title: 'Notifications',
    desc: 'Sends routine reminders and your daily report.',
    icon: 'bell',
    steps: [
      'Tap Notifications.',
      'Turn on All Minutics notifications.',
      'Allow the permission prompt if it appears.'
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

/* ── Looping spoken walkthrough ─────────────────────────────────────────── */
function useLoopingSpeech(text, active) {
  useEffect(function () {
    if (!active || !text) return undefined;
    var synth = window.speechSynthesis;
    if (!synth) return undefined;
    var cancelled = false;
    var timer = null;
    var speak = function () {
      if (cancelled) return;
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.rate = 0.94;
        u.pitch = 1.02;
        u.onend = function () { if (!cancelled) timer = setTimeout(speak, 800); };
        u.onerror = function () { if (!cancelled) timer = setTimeout(speak, 1800); };
        synth.cancel();
        synth.speak(u);
      } catch (e) {}
    };
    speak();
    return function () {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try { synth.cancel(); } catch (e) {}
    };
  }, [text, active]);
}

/* ── Icons (inline SVG so no assets are needed) ─────────────────────────── */
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

/* ── Animated Android-settings mock ─────────────────────────────────────── */
function SettingsMock({ perm }) {
  var target = 0;
  if (perm.key === 'overlay' || perm.key === 'popup') target = 1;
  if (perm.key === 'background') target = 2;
  if (perm.key === 'autostart') target = 1;
  if (perm.key === 'accessibility') target = 2;
  if (perm.key === 'notifications') target = 1;
  var rows = ['App info', 'Permission', 'Battery', 'Notifications'];
  var titles = {
    overlay: ['Display over other apps', 'Allow display over other apps'],
    popup: ['Display pop-up windows', 'Allow pop-up windows'],
    background: ['Battery', 'Unrestricted'],
    autostart: ['Auto Start', 'Allow auto start'],
    accessibility: ['Downloaded apps', 'Minutics Doom scroll stopper'],
    notifications: ['Notifications', 'Allow notifications']
  }[perm.key] || ['Permission', 'Allow'];
  var rowLabel = {
    overlay: 'Display over other apps',
    popup: 'Display pop-up windows',
    background: 'Battery',
    autostart: 'Auto Start',
    accessibility: 'Accessibility',
    notifications: 'Notifications'
  }[perm.key] || 'Permission';

  return jsxs('div', {
    className: 'lt-perm-mock',
    children: [
      jsxs('div', { className: 'lt-perm-mock-bar', children: [
        jsx('span', { className: 'lt-perm-mock-dot' }),
        jsx('span', { className: 'lt-perm-mock-title', children: perm.key === 'accessibility' ? 'Settings' : 'App info' })
      ] }),
      jsxs('div', { className: 'lt-perm-mock-body', children: [
        jsx('div', { className: 'lt-perm-mock-app', children: [
          jsx('span', { className: 'lt-perm-mock-logo', children: 'M' }),
          jsxs('div', { children: [
            jsx('b', { children: 'Minutics' }),
            jsx('span', { children: perm.key === 'accessibility' ? 'Installed services' : 'Your app' })
          ] })
        ] }),
        rows.map(function (label, i) {
          return jsxs('div', {
            className: 'lt-perm-mock-row' + (i === target ? ' is-target' : ''),
            children: [
              jsx('span', { children: i === target ? rowLabel : label }),
              i === target
                ? jsx('span', { className: 'lt-perm-mock-toggle' + (i === target ? ' is-on' : ''), children: jsx('i', {}) })
                : jsx('span', { className: 'lt-perm-mock-chev', children: '›' })
            ]
          }, label + i);
        }),
        jsx('div', { className: 'lt-perm-mock-sub', children: titles[0] }),
        jsx('div', { className: 'lt-perm-mock-sub is-value', children: titles[1] })
      ] }),
      jsx('span', { className: 'lt-perm-mock-finger', 'aria-hidden': true }),
      jsx('span', { className: 'lt-perm-mock-ripple', 'aria-hidden': true })
    ]
  });
}

/* ── Tutorial overlay (big) ─────────────────────────────────────────────── */
function TutorialOverlay({ perm, onGotIt }) {
  useLoopingSpeech(
    perm.title + '. ' + perm.steps.map(function (s, i) { return 'Step ' + (i + 1) + ': ' + s; }).join(' '),
    true
  );
  return createPortal(
    jsx('div', {
      className: 'lt-perm-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      children: jsxs('div', { className: 'lt-perm-card', children: [
        jsxs('div', { className: 'lt-perm-card-head', children: [
          jsx('span', { className: 'lt-perm-card-icon', children: jsx(PermIcon, { name: perm.icon, size: 22 }) }),
          jsxs('div', { children: [
            jsx('p', { className: 'lt-perm-eyebrow', children: 'Permission tutorial' }),
            jsx('h3', { children: perm.title })
          ] }),
          jsx('button', {
            type: 'button', className: 'lt-perm-x', 'aria-label': 'Close tutorial',
            onClick: onGotIt, children: '\u2715'
          })
        ] }),
        jsx(SettingsMock, { perm: perm }),
        jsx('ol', { className: 'lt-perm-steps', children: perm.steps.map(function (s, i) {
          return jsx('li', { children: jsxs('span', { children: [
            jsx('b', { children: String(i + 1) }),
            jsx('span', { children: s })
          ] }) }, i);
        }) }),
        jsx('p', { className: 'lt-perm-audio-note', children: 'Audio is playing and will loop until you finish.' }),
        jsx('button', { type: 'button', className: 'lt-perm-gotit', onClick: onGotIt, children: 'Got it' })
      ] })
    }),
    document.body
  );
}

/* ── Small persistent card (after "Got it") ─────────────────────────────── */
function MiniTutorial({ perm, onOpen, onClose }) {
  useLoopingSpeech(
    perm.title + '. ' + perm.steps.map(function (s, i) { return 'Step ' + (i + 1) + ': ' + s; }).join(' '),
    true
  );
  return createPortal(
    jsxs('div', { className: 'lt-perm-mini', role: 'status', children: [
      jsx('span', { className: 'lt-perm-mini-icon', children: jsx(PermIcon, { name: perm.icon, size: 18 }) }),
      jsxs('div', { className: 'lt-perm-mini-body', children: [
        jsx('b', { children: perm.title }),
        jsx('span', { children: 'Tap Allow again to finish. Audio keeps playing.' })
      ] }),
      jsx('button', { type: 'button', className: 'lt-perm-mini-open', onClick: onOpen, children: 'Open' }),
      jsx('button', { type: 'button', className: 'lt-perm-mini-x', 'aria-label': 'Stop tutorial', onClick: onClose, children: '\u2715' })
    ] }),
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
    '.lt-perm-overlay{position:fixed;inset:0;z-index:2147483200;background:rgba(10,14,26,.6);display:flex;align-items:center;justify-content:center;padding:18px;animation:ltPermFade .2s ease}',
    '@keyframes ltPermFade{from{opacity:0}to{opacity:1}}',
    '.lt-perm-card{width:100%;max-width:380px;max-height:calc(100dvh - 36px);overflow:auto;background:#fff;border-radius:24px;padding:18px 18px 16px;box-shadow:0 20px 50px rgba(0,0,0,.35);animation:ltPermPop .26s cubic-bezier(.22,.61,.36,1)}',
    '@keyframes ltPermPop{from{transform:translateY(18px) scale(.97);opacity:0}to{transform:none;opacity:1}}',
    '.lt-perm-card-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}',
    '.lt-perm-card-icon{width:44px;height:44px;border-radius:14px;background:#DCFCE7;color:#157347;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.lt-perm-eyebrow{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#9AA1AE;margin:0 0 2px}',
    '.lt-perm-card-head h3{font-size:18px;font-weight:900;color:#14162E;margin:0;line-height:1.2}',
    '.lt-perm-x{margin-left:auto;background:none;border:none;font-size:18px;color:#9AA1AE;cursor:pointer;padding:4px}',
    '.lt-perm-steps{list-style:none;margin:12px 0 8px;padding:0;display:flex;flex-direction:column;gap:8px}',
    '.lt-perm-steps li>span{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.4;color:#374151}',
    '.lt-perm-steps b{width:22px;height:22px;border-radius:999px;background:#157347;color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}',
    '.lt-perm-audio-note{font-size:11.5px;color:#9AA1AE;text-align:center;margin:2px 0 12px}',
    '.lt-perm-gotit{width:100%;border:none;border-radius:14px;padding:13px;background:#157347;color:#fff;font-size:15px;font-weight:800;cursor:pointer}',
    '.lt-perm-gotit:active{transform:scale(.98)}',
    '.lt-perm-mini{position:fixed;left:12px;right:12px;bottom:86px;z-index:2147483200;display:flex;align-items:center;gap:10px;background:#14162E;color:#fff;border-radius:16px;padding:11px 12px;box-shadow:0 10px 30px rgba(0,0,0,.35);animation:ltPermMini .25s cubic-bezier(.22,.61,.36,1)}',
    '@keyframes ltPermMini{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}',
    '.lt-perm-mini-icon{width:34px;height:34px;border-radius:11px;background:rgba(34,197,94,.2);color:#4ADE80;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.lt-perm-mini-body{flex:1;min-width:0}',
    '.lt-perm-mini-body b{display:block;font-size:13px;font-weight:800}',
    '.lt-perm-mini-body span{display:block;font-size:11px;color:rgba(255,255,255,.62);margin-top:1px}',
    '.lt-perm-mini-open{border:none;border-radius:999px;padding:8px 13px;background:#22C55E;color:#06230F;font-size:11.5px;font-weight:900;cursor:pointer;flex-shrink:0}',
    '.lt-perm-mini-x{background:none;border:none;color:rgba(255,255,255,.5);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0}',
    '.lt-perm-mock{position:relative;background:#0F1116;border-radius:18px;padding:12px 10px 10px;overflow:hidden;margin-bottom:12px;border:1px solid rgba(255,255,255,.08)}',
    '.lt-perm-mock-bar{display:flex;align-items:center;gap:6px;padding:0 4px 8px}',
    '.lt-perm-mock-dot{width:8px;height:8px;border-radius:999px;background:#4ADE80}',
    '.lt-perm-mock-title{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.45)}',
    '.lt-perm-mock-body{background:#1B1E26;border-radius:12px;padding:9px;display:flex;flex-direction:column;gap:6px}',
    '.lt-perm-mock-app{display:flex;align-items:center;gap:8px;padding:6px 6px 8px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:2px}',
    '.lt-perm-mock-logo{width:26px;height:26px;border-radius:8px;background:#157347;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}',
    '.lt-perm-mock-app b{display:block;font-size:11.5px;color:#fff;line-height:1.2}',
    '.lt-perm-mock-app span{display:block;font-size:9.5px;color:rgba(255,255,255,.45)}',
    '.lt-perm-mock-row{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#242833;border-radius:9px;padding:9px 10px;font-size:10.5px;color:rgba(255,255,255,.78);position:relative}',
    '.lt-perm-mock-row.is-target{outline:2px solid #22C55E;outline-offset:1px;background:#203026;color:#fff;animation:ltPermTarget 2.4s ease-in-out infinite}',
    '@keyframes ltPermTarget{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}50%{box-shadow:0 0 0 6px rgba(34,197,94,.18)}}',
    '.lt-perm-mock-chev{color:rgba(255,255,255,.3);font-size:14px}',
    '.lt-perm-mock-toggle{width:30px;height:17px;border-radius:999px;background:#3A3F4C;position:relative;flex-shrink:0}',
    '.lt-perm-mock-toggle i{position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:999px;background:#fff}',
    '.lt-perm-mock-toggle.is-on{background:#22C55E;animation:ltPermToggleBg 2.4s ease-in-out infinite}',
    '.lt-perm-mock-toggle.is-on i{animation:ltPermKnob 2.4s ease-in-out infinite}',
    '@keyframes ltPermToggleBg{0%,25%{background:#3A3F4C}55%,100%{background:#22C55E}}',
    '@keyframes ltPermKnob{0%,25%{left:2px}55%,100%{left:15px}}',
    '.lt-perm-mock-sub{font-size:9.5px;color:rgba(255,255,255,.4);padding:2px 4px}',
    '.lt-perm-mock-sub.is-value{color:#4ADE80;font-weight:800}',
    '.lt-perm-mock-finger{position:absolute;width:22px;height:22px;border-radius:999px;background:rgba(255,255,255,.9);box-shadow:0 4px 10px rgba(0,0,0,.45);left:50%;top:52%;animation:ltPermTap 2.4s ease-in-out infinite}',
    '.lt-perm-mock-finger:after{content:"";position:absolute;inset:6px;border-radius:999px;background:#157347}',
    '@keyframes ltPermTap{0%{transform:translate(58px,54px) scale(1);opacity:0}18%{transform:translate(28px,34px) scale(1);opacity:1}45%{transform:translate(4px,10px) scale(.86);opacity:1}60%{transform:translate(4px,10px) scale(1);opacity:1}82%{transform:translate(28px,34px) scale(1);opacity:.9}100%{transform:translate(58px,54px) scale(1);opacity:0}}',
    '.lt-perm-mock-ripple{position:absolute;width:34px;height:34px;border-radius:999px;border:2px solid rgba(34,197,94,.65);left:50%;top:52%;margin:8px 0 0 8px;animation:ltPermRipple 2.4s ease-out infinite}',
    '@keyframes ltPermRipple{0%,40%{transform:scale(.2);opacity:0}55%{opacity:.9}85%,100%{transform:scale(1.5);opacity:0}}'
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

    /* Backup poll — onResume fires the event, but some OEMs deliver it
       before the settings toggle has settled. */
    var iv = setInterval(function () {
      var next = readStatus();
      if (JSON.stringify(next) !== JSON.stringify(statusRef.current)) update(next);
    }, 1200);

    return function () {
      window.removeEventListener('ltPermissionsChanged', onChanged);
      clearInterval(iv);
    };
  }, []);

  /* The mini card must disappear the moment the permission is granted. */
  useEffect(function () {
    if (!mini) return;
    if (status && status[mini.key]) {
      setMini(null);
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
    }
  }, [status, mini]);

  var open = function (perm) {
    try { window.AndroidBridge.openPermissionSetting(perm.key); } catch (e) {}
    setTutorial(perm);
    setMini(null);
  };

  var gotIt = function () {
    if (tutorial) { setMini(tutorial); setTutorial(null); }
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
    jsx('p', { className: 'lt-perm-note', children: 'You cannot continue until every row shows a green tick. Tap Allow to open the real Android screen and follow the tutorial.' }),
    tutorial ? jsx(TutorialOverlay, { perm: tutorial, onGotIt: gotIt }) : null,
    mini ? jsx(MiniTutorial, {
      perm: mini,
      onOpen: function () { open(mini); },
      onClose: function () { setMini(null); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
    }) : null
  ] });
}

export { allGranted };
