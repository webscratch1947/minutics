import { useState, useEffect, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';
import { getProfile } from '../lib/profile.js';
import { getTelegramSettings, saveTelegramSettings, sendTelegramReport, checkTelegramTokenInUse } from '../lib/telegram.js';
import { getCurrency, setCurrency } from '../lib/currency.js';
import { saveGoalType, getGoalType, isPro as hasActivePaidPlan } from '../lib/settings.js';
import { readJson, writeJson } from '../lib/settings.js';
import { buildBackup, loadDataFile } from '../lib/dataTransfer.js';
import { ltAlert, ltConfirmDanger } from '../ui_dialog.js';
import { CircleCheckBig as eh } from 'lucide-react';
import { a11yConsented, markA11yConsent } from '../permissions_onboarding.js';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

var _VAPID_KEY = "BKLC0IM70THg6XTfAm6HBEJXmptMaFaEy4WHVhl_L6MwFFEhOVleExlXV9mrvEwurnFPgXFkYHr2fp6iOeeFf0U";
var _fbMessaging = null;
try { _fbMessaging = getMessaging(getApp()); } catch (e) { console.warn("FCM init deferred:", e.message); }

var _VAPID_KEY = "BKLC0IM70THg6XTfAm6HBEJXmptMaFaEy4WHVhl_L6MwFFEhOVleExlXV9mrvEwurnFPgXFkYHr2fp6iOeeFf0U";

if (_fbMessaging) {
  onMessage(_fbMessaging, function (payload) {
    console.log("FCM foreground message:", payload);
  });
}

/* ── constants ── */

var CURRENCIES = [
  { code: "INR", symbol: "Rs.", label: "Indian Rupee", locale: "en-IN", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "EUR", symbol: "\u20AC", label: "Euro", locale: "de-DE", flag: "\uD83C\uDDEA\uD83C\uDDFA" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound", locale: "en-GB", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "JPY", symbol: "\u00A5", label: "Japanese Yen", locale: "ja-JP", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "AED", symbol: "AED", label: "UAE Dirham", locale: "ar-AE", flag: "\uD83C\uDDE6\uD83C\uDDEA" },
  { code: "SAR", symbol: "SAR", label: "Saudi Riyal", locale: "ar-SA", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", locale: "en-AU", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", locale: "en-CA", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", locale: "en-SG", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { code: "PKR", symbol: "\u20A8", label: "Pakistani Rupee", locale: "en-PK", flag: "\uD83C\uDDF5\uD83C\uDDF0" },
  { code: "BDT", symbol: "\u09F3", label: "Bangladeshi Taka", locale: "bn-BD", flag: "\uD83C\uDDE7\uD83C\uDDE9" },
  { code: "NGN", symbol: "\u20A6", label: "Nigerian Naira", locale: "en-NG", flag: "\uD83C\uDDF3\uD83C\uDDEC" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real", locale: "pt-BR", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { code: "TRY", symbol: "\u20BA", label: "Turkish Lira", locale: "tr-TR", flag: "\uD83C\uDDF9\uD83C\uDDF7" }
];

var GOAL_OPTIONS = [
  { type: "retirement", label: "\uD83C\uDFD6\uFE0F Retirement" },
  { type: "age", label: "\uD83C\uDF82 Age Goal" },
  { type: "fire", label: "\uD83D\uDD25 Freedom" },
  { type: "milestone", label: "\uD83C\uDFAF Milestone" }
];

var PLANS = {
  free: "Free",
  basic: "Basic",
  yearly: "1 Year",
  lifetime: "Lifetime",
  pro: "Lifetime"
};

/* ── small UI components ── */

function Toggle(props) {
  return jsx("button", {
    onClick: props.onToggle,
    style: {
      position: "relative",
      width: "48px",
      height: "28px",
      borderRadius: "14px",
      border: "none",
      cursor: "pointer",
      padding: 0,
      flexShrink: 0,
      background: props.enabled ? "#157347" : "#d1d5db",
      transition: "background .25s ease"
    },
    children: jsx("span", {
      style: {
        position: "absolute",
        top: "3px",
        left: props.enabled ? "23px" : "3px",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left .25s ease"
      }
    })
  });
}

function SectionHeader(props) {
  return jsx("p", {
    className: "text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground px-1",
    children: props.children
  });
}

function Card(props) {
  return jsx("div", {
    className: "bg-white border border-border rounded-2xl overflow-hidden",
    children: props.children
  });
}

function CardRow(props) {
  return jsxs("div", {
    className: "flex items-center justify-between px-4 py-3.5",
    children: [
      jsxs("div", {
        className: "flex-1 min-w-0 mr-3",
        children: [
          jsx("p", { className: "text-sm font-semibold text-foreground", children: props.label }),
          props.desc ? jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: props.desc }) : null
        ]
      }),
      jsx("div", { className: "shrink-0", children: props.children })
    ]
  });
}

function Divider() {
  return jsx("div", { className: "h-px bg-border mx-4" });
}

function getAlertPermission() {
  try {
    if (window.AndroidBridge && window.AndroidBridge.getNotificationPermission) {
      return window.AndroidBridge.getNotificationPermission();
    }
  } catch (e) {}
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

/* ═══════════════════════════════════════════════════════════════
   SettingsScreen
   ═══════════════════════════════════════════════════════════════ */

/* Permission guide shown from Settings before jumping to the system screen. */
var SETTINGS_GUIDES = {
  notifications: {
    title: 'Notifications',
    steps: ['Open the screen that appears.', 'Turn Minutics notifications ON (or OFF).', 'Come back to Minutics.']
  },
  overlay: {
    title: 'Display over other apps',
    steps: ['Find Minutics in the list.', 'Tap it.', 'Turn "Allow display over other apps" ON (or OFF).', 'Come back to Minutics.']
  },
  popup: {
    title: 'Pop-up in background',
    steps: ['Minutics app info opens.', 'Tap "Other permissions".', 'Tap "Open new windows while running in the background".', 'Choose "Always allow" (or deny), then come back.']
  },
  autostart: {
    title: 'Auto Start',
    steps: ['Find Minutics in the Auto Start list.', 'Turn its switch ON (or OFF).', 'Come back to Minutics.']
  },
  accessibility: {
    title: 'Accessibility',
    disclosure: 'To count reels and shorts, Minutics uses the Accessibility service to detect when a video is on screen for at least 3 seconds. We only see which app is open and the type of on-screen element. We do NOT read messages, passwords, form fields or anything you type, and nothing is sent off your device. This is optional and you can turn it off any time in Android Settings.',
    steps: ['Tap "Downloaded apps" (or Installed services).', 'Tap Minutics.', 'Turn the service ON (or OFF) and confirm.']
  }
};

function PermGuide({ permKey, onClose, onOpen }) {
  var g = SETTINGS_GUIDES[permKey] || { title: 'Permission', steps: [] };
  var [consent, setConsent] = useState(false);
  var [stage, setStage] = useState(0);
  /* Use the SAME brand-specific guide the onboarding uses (native profile). */
  try {
    var pr = (window.LTDeviceProfile && window.LTDeviceProfile())
      || (window.AndroidBridge && window.AndroidBridge.getDeviceProfile
          ? JSON.parse(window.AndroidBridge.getDeviceProfile()) : {});
    var keyMap = { notifications: null, overlay: 'overlaySteps', popup: 'popupSteps',
                   autostart: 'autostartSteps', background: 'batterySteps' };
    var nameMap = { overlay: 'overlayName', popup: 'popupName', autostart: 'autostartName' };
    var stepKey = keyMap[permKey];
    if (stepKey && pr[stepKey] && pr[stepKey].length) {
      g = { title: (nameMap[permKey] && pr[nameMap[permKey]]) || g.title, steps: pr[stepKey] };
    }
  } catch (e) {}
  return createPortal(
    jsx('div', { className: 'fixed inset-0 z-[9999] flex items-end justify-center bg-black/60', onClick: onClose, children:
    jsx('div', { className: 'w-full max-w-[430px] bg-white rounded-t-3xl p-5 pb-8', onClick: function(e){ e.stopPropagation(); }, children:
      jsxs(Fragment, { children: [
        jsx('div', { className: 'w-11 h-1 rounded-full bg-gray-300 mx-auto mb-4' }),
        jsx('h3', { className: 'text-lg font-extrabold text-[#14162E] m-0 mb-1', children: g.title }),
        g.disclosure
          ? jsxs('div', { style: { background:'#F0F7F2', border:'1px solid #BBF7D0', borderLeft:'4px solid #157347', borderRadius:14, padding:'12px 14px', marginBottom:12 }, children: [
              jsx('b', { style: { display:'block', fontSize:12.5, color:'#14532D', marginBottom:4 }, children: 'How Minutics uses this access' }),
              jsx('p', { style: { fontSize:12.5, color:'#3F5A48', lineHeight:1.5, margin:0 }, children: g.disclosure })
            ] })
          : null,
        g.disclosure && stage === 0
          ? jsx('label', { style: { display:'flex', gap:10, alignItems:'flex-start', fontSize:13, color:'#334155', margin:'0 2px 14px', cursor:'pointer' }, children: jsxs('span', { style: { display:'flex', gap:10, alignItems:'flex-start' }, children: [
              jsx('input', { type:'checkbox', 'data-settings-consent':'1', checked: consent, onChange: function(e){ setConsent(!!(e && e.target && e.target.checked)); }, style: { width:14, height:14, accentColor:'#157347', flexShrink:0, margin:'2px 0 0', cursor:'pointer' } }),
              jsx('span', { children: 'I understand and agree to this use' })
            ] }) })
          : null,
        !(g.disclosure && stage === 1)
          ? jsx('ol', { className: 'my-4 pl-5 text-sm text-[#5B6478] leading-6', children: g.steps.map(function(s,i){ return jsx('li', { children: s }, i); }) })
          : jsxs('div', { style: { background:'#F0F7F2', border:'1px solid #BBF7D0', borderRadius:14, padding:'12px 14px', marginBottom:12 }, children: [
              jsx('b', { style: { display:'block', fontSize:12.5, color:'#14532D', marginBottom:4 }, children: 'Confirm: turn on Accessibility for Minutics?' }),
              jsx('p', { style: { fontSize:12.5, color:'#3F5A48', lineHeight:1.5, margin:0 }, children: 'You agreed to the disclosure above. The next screen is Android Settings, where you can switch Minutics on. You can turn it off at any time.' })
            ] }),
        g.disclosure
          ? jsxs('div', { style: { display:'flex', gap:12, alignItems:'stretch', marginTop:4 }, children:
              stage === 0
                ? [
                    jsx('button', {
                      type: 'button', 'data-settings-decline': '1',
                      className: 'flex-1 rounded-full border border-[#C9C2B2] bg-white text-[#5B6478] font-bold py-3 text-[13px]',
                      onClick: onClose, children: 'No thanks'
                    }),
                    jsx('button', {
                      type: 'button', 'data-settings-confirm': '1',
                      className: 'flex-1 rounded-full text-white font-bold py-3 text-[13px] ' + (!consent ? 'bg-[#B7C2B9] cursor-not-allowed' : 'bg-[#157347]'),
                      disabled: !consent,
                      onClick: function(){ if (consent) setStage(1); },
                      children: 'I understand'
                    })
                  ]
                : [
                    jsx('button', {
                      type: 'button', 'data-settings-cancel': '1',
                      className: 'flex-1 rounded-full border border-[#C9C2B2] bg-white text-[#5B6478] font-bold py-3 text-[13px]',
                      onClick: function(){ setStage(0); }, children: 'Cancel'
                    }),
                    jsx('button', {
                      type: 'button', 'data-settings-open': '1',
                      className: 'flex-1 rounded-full bg-[#157347] text-white font-bold py-3 text-[13px]',
                      onClick: function(){ markA11yConsent(); onOpen(); },
                      children: 'Yes, open settings'
                    })
                  ]
            })
          : jsx('button', {
              type: 'button', 'data-settings-open': '1',
              className: 'w-full rounded-full bg-[#157347] text-white font-bold py-3',
              onClick: onOpen, children: 'Open Android settings'
            }),
        !g.disclosure
          ? jsx('button', { type: 'button', className: 'w-full bg-transparent text-[#8A8578] font-semibold py-3', onClick: onClose, children: 'Close' })
          : null
      ] })
    })
    })
  , document.body);
}

/* Status pill: shows the REAL state with an unambiguous word. */
function PermStatusBadge({ granted, unknown }) {
  var bg = unknown ? "#FEF3C7" : (granted ? "#DCFCE7" : "#FEE2E2");
  var fg = unknown ? "#92400E" : (granted ? "#157347" : "#B91C1C");
  return jsx("span", {
    style: {
      borderRadius: 999, padding: "5px 11px", fontSize: 11, fontWeight: 800,
      whiteSpace: "nowrap", background: bg, color: fg
    },
    children: unknown ? "Can't check" : (granted ? "Allowed" : "Not allowed")
  });
}

/* Direct-open button — no guide, jumps straight to the phone setting.
   Greyed out when the phone has no such settings screen. */
function PermOpenButton({ onClick, disabled }) {
  return jsx("button", {
    type: "button", onClick: disabled ? undefined : onClick, disabled: !!disabled,
    style: {
      borderRadius: 999, padding: "6px 14px", fontSize: 11, fontWeight: 800,
      whiteSpace: "nowrap", cursor: disabled ? "not-allowed" : "pointer", border: "0",
      background: disabled ? "#D1D5DB" : "#14162E",
      color: disabled ? "#9CA3AF" : "#fff",
      opacity: disabled ? 0.7 : 1
    },
    children: "Open"
  });
}

export function SettingsScreen() {
  var [permGuide, setPermGuide] = useState(null);
  var [deviceIsXiaomi, setDeviceIsXiaomi] = useState(false);
  var [deviceLabel, setDeviceLabel] = useState('');
  var [permNames, setPermNames] = useState({ overlay: 'Display over other apps', popup: 'Pop-up in background', autostart: 'Auto Start' });
  var [canOpenAutostart, setCanOpenAutostart] = useState(true);
  useEffect(function () {
    try {
      if (window.AndroidBridge && window.AndroidBridge.canOpenPermissionSetting) {
        setCanOpenAutostart(!!window.AndroidBridge.canOpenPermissionSetting("autostart"));
      }
    } catch (e) {}
  }, []);
  useEffect(function () {
    try {
      var pr = (window.LTDeviceProfile && window.LTDeviceProfile())
        || (window.AndroidBridge && window.AndroidBridge.getDeviceProfile
            ? JSON.parse(window.AndroidBridge.getDeviceProfile()) : {});
      setDeviceIsXiaomi(!!pr.miui);
      if (pr.device) setDeviceLabel(pr.device);
      setPermNames({
        overlay: pr.overlayName || 'Display over other apps',
        popup: pr.popupName || 'Pop-up in background',
        autostart: pr.autostartName || 'Auto Start'
      });
    } catch (e) {}
  }, []);
  var openPermDirect = function (key) {
    try {
      if (window.AndroidBridge && window.AndroidBridge.openPermissionSetting) {
        window.AndroidBridge.openPermissionSetting(key);
      }
    } catch (e) {}
  };
  var openPermWithGuide = function (key) {
    if (key === "accessibility" && a11yConsented()) { openPermDirect(key); return; }
    setPermGuide(key);
  };

  /* ── plan re-render trigger ── */
  var _planTick = useState(0);
  useEffect(function () {
    function onPlanChanged() { _planTick[1](function (n) { return n + 1; }); }
    window.addEventListener("lt-plan-changed", onPlanChanged);
    return function () { window.removeEventListener("lt-plan-changed", onPlanChanged); };
  }, []);

  /* ── profile ── */
  var profile = getProfile();
  var profileName = (profile && profile.name) ? profile.name : "User";
  var _userEmailInit = "";
  try {
    var _authUser = (window.LTAuth && window.LTAuth.currentUser && window.LTAuth.currentUser()) || null;
    _userEmailInit = (_authUser && _authUser.email) ? _authUser.email : "";
  } catch (e) {}
  var _userEmailState = useState(_userEmailInit);
  var userEmail = _userEmailState[0];
  var setUserEmail = _userEmailState[1];

  /* Profile picture: chosen locally, saved in localStorage so it survives
     restarts and stays on this device only. */
  var _photoState = useState(function () {
    try { return localStorage.getItem("lt_profile_photo_v1") || ""; } catch (e) { return ""; }
  });
  var profilePhoto = _photoState[0];
  var setProfilePhoto = _photoState[1];
  useEffect(function () {
    function refreshEmail() {
      try {
        var u = (window.LTAuth && window.LTAuth.currentUser && window.LTAuth.currentUser()) || null;
        var em = (u && u.email) ? u.email : "";
        if (em) setUserEmail(em);
      } catch (e) {}
    }
    refreshEmail();
    var t = setInterval(refreshEmail, 2000);
    setTimeout(function () { clearInterval(t); }, 10000);
    return function () { clearInterval(t); };
  }, []);

  /* ── plan ── */
  var rawPlan = localStorage.getItem("lt_plan_v1") || "free";
  try { rawPlan = JSON.parse(rawPlan); } catch { rawPlan = "free"; }
  var isPro = hasActivePaidPlan();
  var planLabel = PLANS[rawPlan] || "Free";

  /* ── currency ── */
  var savedCurrency = getCurrency();
  var currentCurrencyCode = (savedCurrency && savedCurrency.code) ? savedCurrency.code : "INR";
  var _currencyState = useState(currentCurrencyCode);
  var selectedCurrencyCode = _currencyState[0];
  var setSelectedCurrencyCode = _currencyState[1];
  var _showPickerState = useState(false);
  var showPicker = _showPickerState[0];
  var setShowPicker = _showPickerState[1];

  var currentCurrencyObj = CURRENCIES.find(function (c) { return c.code === selectedCurrencyCode; }) || CURRENCIES[0];

  /* ── goal type ── */
  var savedGoal = readJson("lt_goal_type_v1", { type: "retirement", milestoneLabel: "" });
  var _goalState = useState(savedGoal.type || "retirement");
  var goalType = _goalState[0];
  var setGoalType = _goalState[1];
  var _milestoneLabelState = useState(savedGoal.milestoneLabel || "");
  var milestoneLabel = _milestoneLabelState[0];
  var setMilestoneLabel = _milestoneLabelState[1];

  /* ── smart nudges ── */
  var _nudgesState = useState(localStorage.getItem("lt_notifs_enabled_v1") === "true");
  var nudgesEnabled = _nudgesState[0];
  var setNudgesEnabled = _nudgesState[1];

  /* ── alert notification permission (browser or Android bridge) ── */
  var _notifPermState = useState(getAlertPermission());
  var notifPermission = _notifPermState[0];
  var setNotifPermission = _notifPermState[1];
  var _notifTestState = useState(null);
  var notifTestStatus = _notifTestState[0];
  var setNotifTestStatus = _notifTestState[1];
  var _notifEnabledState = useState(localStorage.getItem("lt_alert_notifs_on_v1") !== "off");
  var notifEnabled = _notifEnabledState[0];
  var setNotifEnabled = _notifEnabledState[1];

  useEffect(function () {
    function onPermissionChanged(event) {
      setNotifPermission((event.detail && event.detail.permission) || getAlertPermission());
    }
    function refreshPermission() { setNotifPermission(getAlertPermission()); }
    function onVisibilityChange() { if (document.visibilityState === "visible") refreshPermission(); }
    window.addEventListener("minutics-notification-permission", onPermissionChanged);
    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", onVisibilityChange);
    var permissionPoll = window.setInterval(refreshPermission, 1000);
    return function () {
      window.removeEventListener("minutics-notification-permission", onPermissionChanged);
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(permissionPoll);
    };
  }, []);

  /* ── telegram ── */
  var tgSettings = getTelegramSettings();
  var _tgTokenState = useState((tgSettings && tgSettings.telegramBotToken) || "");
  var tgToken = _tgTokenState[0];
  var setTgToken = _tgTokenState[1];
  var _tgChatIdState = useState((tgSettings && tgSettings.telegramChatId) || "");
  var tgChatId = _tgChatIdState[0];
  var setTgChatId = _tgChatIdState[1];
  var _tgTimeState = useState((tgSettings && tgSettings.dailyReportTime) || "21:00");
  var tgTime = _tgTimeState[0];
  var setTgTime = _tgTimeState[1];
  var tgConnected = tgSettings && tgSettings.telegramConnected;
  var _tgSavingState = useState(false);
  var tgSaving = _tgSavingState[0];
  var setTgSaving = _tgSavingState[1];
  var _tgSavedState = useState(false);
  var tgSaved = _tgSavedState[0];
  var setTgSaved = _tgSavedState[1];
  var _tgTestResultState = useState(null);
  var tgTestResult = _tgTestResultState[0];
  var setTgTestResult = _tgTestResultState[1];
  var _tgTestMsgState = useState("");
  var tgTestMsg = _tgTestMsgState[0];
  var setTgTestMsg = _tgTestMsgState[1];
  var _tgTestLoadingState = useState(false);
  var tgTestLoading = _tgTestLoadingState[0];
  var setTgTestLoading = _tgTestLoadingState[1];

  /* ── permission usage toggles (Settings → Permissions) ── */
  var _permUseState = useState(function () {
    var m = readJson("lt_perm_use_v1", {});
    return { overlay: m.overlay !== false, autostart: m.autostart !== false,
             accessibility: m.accessibility !== false, notifications: m.notifications !== false };
  });
  var permUse = _permUseState[0];
  var setPermUse = _permUseState[1];

  /* Real permission state — no on/off switch here. */
  var _permStatusState = useState({ overlay: false, autostart: false, accessibility: false, popup: false });
  var permStatus = _permStatusState[0];
  var setPermStatus = _permStatusState[1];
  useEffect(function () {
    function refresh() {
      try {
        if (window.AndroidBridge && window.AndroidBridge.getPermissionStatus) {
          var raw = window.AndroidBridge.getPermissionStatus();
          var o = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (o) setPermStatus(o);
        }
      } catch (e) {}
    }
    refresh();
    var iv = window.setInterval(refresh, 2000);
    return function () { window.clearInterval(iv); };
  }, []);

  function handlePermToggle(key) {
    /* Click semantics follow what the switch SHOWS, not hidden flags:
       - switch is ON (green = granted AND in use) → click turns it off;
       - switch is OFF (grey, "not allowed yet") → click turns it on and,
         when the system-side grant is missing, jumps to the matching
         Android settings screen. Never the other way round. */
    var granted = !!permStatus[key];
    /* Accessibility must NEVER be switched on by the toggle itself — Google
       treats a toggle as insufficient consent. Show the two-step disclosure
       first; only an explicit "Yes, open settings" may continue. */
    if (key === "accessibility" && !granted) { openPermWithGuide(key); return; }
    var wasActive = granted && permUse[key] === true;
    var next = {};
    for (var k in permUse) next[k] = permUse[k];
    next[key] = wasActive ? false : true;
    setPermUse(next);
    writeJson("lt_perm_use_v1", next);
    /* Push the switch to native immediately so "off" really stops the channel
       before the next 5-second sync. */
    try { if (window.__ltSyncNotifState) window.__ltSyncNotifState(); } catch (e) {}
    if (key === "accessibility") {
      try {
        if (window.AndroidBridge && window.AndroidBridge.setDoomScrollEnabled) {
          window.AndroidBridge.setDoomScrollEnabled(next.accessibility);
        }
      } catch (e) {}
    }
    if (!wasActive && !granted) {
      if (key === 'accessibility') { openPermWithGuide(key); return; }
      try {
        if (window.AndroidBridge && window.AndroidBridge.openPermissionSetting) {
          window.AndroidBridge.openPermissionSetting(key);
        }
      } catch (e) {}
    }
  }

  /* ── handlers ── */
  /* The layout editor AND its Settings entry (Layout card / Reset button)
     are both gone — no editor means nothing to reset. Stale saved layouts
     are cleared once at startup in _slice_shell.js. */

  function handleCurrencyChange(code) {
    setSelectedCurrencyCode(code);
    setCurrency(code);
    setShowPicker(false);
    /* Tell every other screen (Home money timer, Time Value banner, etc.) to
       re-read the currency so no hardcoded Rs. lingers after a change. */
    try { window.dispatchEvent(new CustomEvent("lt-currency-changed", { detail: code })); } catch (e) {}
  }

  function handleGoalChange(type) {
    setGoalType(type);
    saveGoalType({ type: type, milestoneLabel: milestoneLabel });
  }

  function handleMilestoneLabelChange(val) {
    setMilestoneLabel(val);
    saveGoalType({ type: goalType, milestoneLabel: val });
  }

  function handleNudgesToggle() {
    var next = !nudgesEnabled;
    setNudgesEnabled(next);
    writeJson("lt_notifs_enabled_v1", next ? "true" : "false");
    if (next && getAlertPermission() === "default") handleEnableNotifications();
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
    }
  }

  function handleEnableNotifications() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
        window.AndroidBridge.requestNotificationPermission();
        return;
      }
    } catch (e) {}
    if (typeof Notification !== "undefined") Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
  }

  async function handleTestNotification() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.showTestNotification) {
        window.AndroidBridge.showTestNotification();
        return;
      }
    } catch (e) {}
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifTestStatus(null);
      try {
        if (!_fbMessaging) { _fbMessaging = getMessaging(getApp()); }
        console.log("FCM: requesting token...");
        var fcmToken = await getToken(_fbMessaging, { vapidKey: _VAPID_KEY });
        console.log("FCM: token received:", fcmToken ? fcmToken.substring(0, 30) + "..." : "null");
        if (!fcmToken) throw new Error("No FCM token received");
        localStorage.setItem("lt_fcm_token", fcmToken);

        console.log("FCM: calling /api/fcm-send...");
        var _apiOrigin = (window.LTAuth && window.LTAuth.apiOrigin) ? window.LTAuth.apiOrigin() : "";
        var resp = await fetch(_apiOrigin + "/api/fcm-send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fcmToken: fcmToken })
        });
        var data = await resp.json();
        console.log("FCM: server response:", resp.status, data);

        var reg = await navigator.serviceWorker.ready;
        reg.active.postMessage({
          type: "SHOW_NOTIFICATION",
          title: "Minutics",
          body: "Test alert: notifications are working."
        });
        if (data.ok) {
          setNotifTestStatus("sent");
        } else {
          console.warn("FCM server error:", data);
          setNotifTestStatus("error");
        }
      } catch (e) {
        console.error("Notification failed:", e);
        setNotifTestStatus("error");
      }
    }
  }

  /* ── delete account ────────────────────────────────────────────────
     Cognito first: LTAuth.deleteAccount() permanently removes the
     signed-in Minutics account (authorized by this session's own token —
     only ever this account, never anyone else's) and then best-effort
     drops this account's AWS ledger row with the same token, so the
     admin panel can't keep a ghost row. Only after Cognito
     confirms do we wipe this account's local data: live app keys, plan,
     identity, the lt_ns_<uid> snapshot, lt_active_uid, session keys,
     fcm token — everything. Other accounts' lt_ns_* snapshots on this
     device are NOT this account's data and are kept.
     Local-only failure (offline / server error) aborts before any wipe. */
  function wipeAccountStorage(uid) {
    var deadSnapshot = "lt_ns_" + uid;
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (k.indexOf("lt_ns_") === 0 && k !== deadSnapshot) continue;
      toRemove.push(k);
    }
    toRemove.forEach(function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    });
  }

  /* Real in-app popups — ltConfirmDanger/ltAlert (async, non-blocking). */
  async function handleDeleteAccount() {
    /* Demo account: no Firebase user exists — "delete" means end the demo
       (full local wipe + back to welcome), same as its logout path. */
    var demoActive = !!(window.LTDemo && window.LTDemo.isActive && window.LTDemo.isActive());
    if (demoActive) {
      if (!await ltConfirmDanger("Delete this demo account permanently?\n\n• ALL demo data is erased from this device\n• You return to the welcome screen\n\nThis cannot be undone.", "Delete demo account?", { yes: "Delete" })) return;
      if (window.LTAuth && window.LTAuth.logout) window.LTAuth.logout();
      ltAlert("This demo account and all of its data have been deleted.");
      return;
    }
    var u = (window.LTAuth && window.LTAuth.currentUser && window.LTAuth.currentUser()) || null;
    if (!u || !u.uid) { ltAlert("No account is signed in."); return; }
    if (!await ltConfirmDanger("Delete your account permanently?\n\n• Your account is deleted from Minutics — you can never log in with it again\n• ALL data for this account is erased from this device: activities, budget, tasks, profile AND your subscription plan\n\nThis cannot be undone.", "Delete account?", { yes: "Delete" })) return;
    if (!await ltConfirmDanger("Last confirmation: delete this account and everything in it?", "Last confirmation", { yes: "Delete" })) return;

    /* The account is deleted straight through Cognito by this session's
       own token (LTAuth.deleteAccount) — no server round-trip. Only after
       Cognito confirms do we wipe the local data below. */
    (window.LTAuth && window.LTAuth.deleteAccount ? window.LTAuth.deleteAccount() : Promise.reject(new Error("Not available")))
      .then(function () {
        /* Server confirmed — now (and only now) destroy the local data. */
        wipeAccountStorage(u.uid);
        if (window.LTAuth && window.LTAuth.logout) window.LTAuth.logout();
        /* Second pass while sign-out settles, in case an enhancement
           seeder or the SDK re-wrote a key during the async gap. */
        setTimeout(function () { wipeAccountStorage(u.uid); }, 800);
        ltAlert("Your account and all of its data have been deleted.").then(function () {
          if (!window.AndroidBridge) {
            setTimeout(function () { window.location.reload(); }, 300);
          }
        });
      })
      .catch(function (e) {
        ltAlert("Could not delete account: " + ((e && e.message) || e) + "\n\nNothing was removed from this device.");
      });
  }

  function handleSaveTelegram() {
    if (!isPro) { ltAlert("Telegram daily reports require an active paid plan."); return; }
    setTgSaving(true);
    setTgTestResult(null);
    setTgTestMsg("");
    var doSave = function () {
      saveTelegramSettings({
        telegramBotToken: tgToken,
        telegramChatId: tgChatId,
        dailyReportTime: tgTime
      });
      setTimeout(function () { setTgSaving(false); }, 600);
      /* Success flash: green "Saved ✓" for ~3.5s, then back to normal. */
      setTgSaved(true);
      setTimeout(function () { setTgSaved(false); }, 3500);
    };
    /* A bot token belongs to a single account — block the save with a clear
       error when someone else already schedules reports with this token. */
    checkTelegramTokenInUse((tgToken || "").trim())
      .then(function (inUse) {
        if (inUse) {
          setTgTestResult("error");
          setTgTestMsg("This bot token is already being used by another user. Try another bot token.");
          setTgSaving(false);
          return;
        }
        doSave();
      })
      .catch(doSave);
  }

  function handleTestTelegram() {
    if (!isPro) { setTgTestResult("error"); setTgTestMsg(""); setTgTestLoading(false); return; }
    setTgTestLoading(true);
    setTgTestResult(null);
    setTgTestMsg("");
    sendTelegramReport(tgToken, tgChatId, "Test from Minutics \u2014 your Telegram integration is working!")
      .then(function (result) {
        setTgTestResult(result && result.success ? "success" : "error");
        setTgTestMsg(result && result.message ? result.message : "");
        setTgTestLoading(false);
      })
      .catch(function () {
        setTgTestResult("error");
        setTgTestMsg("");
        setTgTestLoading(false);
      });
  }

  /* ── data download / load ── */
  /* UTF-8 → base64 without deprecated unescape: needed to hand JSON to the
     native Android bridge (JavascriptInterface only accepts simple types). */
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  /* Debounce: a single tap can deliver its click twice (the browser's own
     late click for a tap that also produced a synthesized one) — that was
     the "Backup saved shows again after OK" popup. One save per 3s max. */
  var _dlBusyAt = 0;
  function handleDownloadData() {
    if (Date.now() - _dlBusyAt < 3000) return;
    _dlBusyAt = Date.now();
    if (!isPro) { ltAlert("This feature is only available for the 1 Year Plan."); return; }
    try {
      var backup = buildBackup();
      var json = JSON.stringify(backup);
      var fname = "minutics-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      /* Android WebView ignores <a download> entirely (the file never
         reaches the device). Hand the payload to the native bridge, which
         writes it straight into the Downloads folder. */
      try {
        var bridge = window.AndroidBridge;
        if (bridge && typeof bridge.downloadFile === "function") {
          bridge.downloadFile("data:application/json;base64," + utf8ToBase64(json), "application/json", fname);
          ltAlert("Backup saved to your Downloads folder as:\n" + fname, "Backup saved");
          return;
        }
      } catch (eb) {}
      var blob = new Blob([json], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      ltAlert("Backup downloaded as:\n" + fname, "Backup saved");
    } catch (e) {
      ltAlert("Could not download data: " + ((e && e.message) || e));
    }
  }

  function handleLoadData() {
    if (!isPro) { ltAlert("This feature is only available for the 1 Year Plan."); return; }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) return;
      loadDataFile(f).then(function (res) {
        ltAlert(res.message, res.ok ? "Backup loaded" : "Load failed");
        if (res.ok) {
          /* Full remount from fresh localStorage — works on web AND the
             Android WebView (location.reload() is broken there). */
          try { window.dispatchEvent(new CustomEvent("lt-user-changed")); } catch (e) {}
        }
      });
    };
    input.click();
  }

  /* ── initials helper ── */
  function getInitials(name) {
    return (name || "U").split(" ").map(function (w) { return w.charAt(0); }).join("").toUpperCase().slice(0, 2);
  }

  /* ── render ── */

  return jsxs("div", {
    className: "flex flex-col gap-5 pb-8",
    children: [

      /* ─── Profile Card ─── */
      jsxs("div", {
        className: "mx-4 mt-4 bg-white border border-border rounded-2xl overflow-hidden",
        children: [
          jsxs("div", {
            className: "bg-primary/5 px-5 pt-5 pb-4",
            children: [
              jsxs("div", {
                className: "flex items-center gap-4",
                children: [
                  jsxs("div", {
                    className: "relative w-14 h-14 shrink-0",
                    children: [
                      jsx("div", {
                        className: "w-full h-full rounded-full bg-primary/10 flex items-center justify-center overflow-hidden",
                        children: profilePhoto
                          ? jsx("img", { src: profilePhoto, alt: "", className: "w-full h-full object-cover" })
                          : jsx("span", {
                              className: "text-lg font-black text-primary",
                              children: getInitials(profileName)
                            })
                      }),
                      jsx("button", {
                        type: "button",
                        onClick: function () {
                          var inp = document.getElementById("lt-profile-photo-input");
                          if (inp) inp.click();
                        },
                        title: "Change profile picture",
                        className: "absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center border-2 border-background",
                        children: "📷"
                      }),
                      jsx("input", {
                        id: "lt-profile-photo-input",
                        type: "file",
                        accept: "image/*",
                        style: { display: "none" },
                        onChange: function (e) {
                          var f = e.target.files && e.target.files[0];
                          if (!f) return;
                          var rd = new FileReader();
                          rd.onload = function () {
                            try {
                              localStorage.setItem("lt_profile_photo_v1", String(rd.result));
                              setProfilePhoto(String(rd.result));
                            } catch (err) {}
                          };
                          rd.readAsDataURL(f);
                          e.target.value = "";
                        }
                      })
                    ]
                  }),
                  jsxs("div", {
                    className: "flex-1 min-w-0",
                    children: [
                      jsx("p", { className: "text-lg font-bold text-foreground truncate", children: profileName }),
                      /* Only ever show a real email address here — a Cognito
                         user id (or nothing) renders no subtitle at all. */
                      (userEmail && userEmail.indexOf("@") !== -1)
                        ? jsx("p", { className: "text-xs text-muted-foreground mt-0.5 truncate", children: userEmail })
                        : null
                    ]
                  })
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex border-t border-border",
            children: [
              jsx("button", {
                onClick: handleDeleteAccount,
                className: "flex-1 py-3 text-sm font-semibold text-red-500 active:bg-red-50 transition border-r border-border",
                children: "Delete account"
              }),
              jsx("button", {
                onClick: function () {
                  if (window.LTAuth && window.LTAuth.logout) window.LTAuth.logout();
                },
                className: "flex-1 py-3 text-sm font-semibold text-red-500 active:bg-red-50 transition",
                children: "Log out"
              })
            ]
          })
        ]
      }),

      /* ─── Plan ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Plan" }),
          jsx("div", {
            className: [
              "bg-white rounded-2xl overflow-hidden border-2",
              isPro ? "border-amber-400 shadow-md shadow-amber-100" : "border-border"
            ].join(" "),
            children: jsxs(Fragment, {
              children: [
                jsxs(CardRow, {
                  label: planLabel + " Plan",
                  desc: isPro ? "All premium features unlocked" : "Basic features included",
                  children: jsx("span", {
                    className: [
                      "inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-lg border-2",
                      isPro ? "bg-amber-50 text-amber-600 border-amber-400" : "bg-gray-100 text-gray-500 border-gray-200"
                    ].join(" "),
                    children: isPro ? "\u2B50 " + planLabel : "Free"
                  })
                }),
                jsx(Divider, {}),
                jsx("div", {
                  className: "px-4 py-3",
                  children: jsx("button", {
                    onClick: function () {
                      if (typeof window !== "undefined" && window.LTPlan && window.LTPlan.showPlansScreen) {
                        window.LTPlan.showPlansScreen();
                      } else {
                        ltAlert("Plans screen is managed from the main app.");
                      }
                    },
                    className: [
                      "w-full rounded-xl py-2.5 text-sm font-semibold transition border",
                      isPro
                        ? "bg-white text-foreground border-border active:bg-gray-50"
                        : "bg-primary/10 text-primary border-transparent active:bg-primary/20"
                    ].join(" "),
                    children: isPro ? "Manage Plan" : "View Plans"
                  })
                })
              ]
            })
          })
        ]
      }),

      /* ─── Data (Download / Load) — paid plans only, hidden entirely on free ─── */
      isPro && jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Data" }),
          jsx(Card, {
            children: jsxs(Fragment, {
              children: [
                jsx(CardRow, {
                  label: "Download Data",
                  desc: "Save your complete Minutics data to a file",
                  children: jsx("button", {
                    onClick: handleDownloadData,
                    className: "rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/20 transition",
                    children: "Download"
                  })
                }),
                jsx(Divider, {}),
                jsx(CardRow, {
                  label: "Load Data",
                  desc: "Restore a backup file — everything, same to same",
                  children: jsx("button", {
                    onClick: handleLoadData,
                    className: "rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/20 transition",
                    children: "Load"
                  })
                })
              ]
            })
          })
        ]
      }),

      /* ─── Display Currency ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Display Currency" }),
          jsx(Card, {
            children: jsxs(Fragment, {
              children: [
                jsxs(CardRow, {
                  label: currentCurrencyObj.flag + " " + currentCurrencyObj.label,
                  desc: currentCurrencyObj.code + " (" + currentCurrencyObj.symbol + ") \u2022 " + currentCurrencyObj.locale,
                  children: jsx("button", {
                    onClick: function () { setShowPicker(!showPicker); },
                    className: "rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/20 transition",
                    children: showPicker ? "Close" : "Change"
                  })
                }),
                showPicker ? jsx("div", {
                  className: "px-3 pb-3",
                  children: jsx("div", {
                    className: "flex flex-col gap-1",
                    children: CURRENCIES.map(function (cur) {
                      var isActive = cur.code === selectedCurrencyCode;
                      return jsx("button", {
                        onClick: function () { handleCurrencyChange(cur.code); },
                        className: [
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          isActive ? "bg-primary/10 ring-1 ring-primary" : "active:bg-gray-50"
                        ].join(" "),
                        children: jsxs(Fragment, {
                          children: [
                            jsx("span", { className: "text-lg", children: cur.flag }),
                            jsxs("span", {
                              className: "flex-1 min-w-0",
                              children: [
                                jsx("span", { className: "text-sm font-medium text-foreground block truncate", children: cur.label }),
                                jsx("span", { className: "text-[11px] text-muted-foreground", children: cur.code + " " + cur.symbol })
                              ]
                            }),
                            isActive ? jsx(eh, { className: "h-4 w-4 text-primary shrink-0" }) : null
                          ]
                        })
                      });
                    })
                  })
                }) : null
              ]
            })
          })
        ]
      }),

      /* ─── Goal Type ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Goal Type" }),
          jsx(Card, {
            children: jsxs("div", {
              className: "p-4",
              children: [
                jsx("div", {
                  className: "grid grid-cols-2 gap-2",
                  children: GOAL_OPTIONS.map(function (opt) {
                    var isActive = goalType === opt.type;
                    return jsx("button", {
                      onClick: function () { handleGoalChange(opt.type); },
                      className: [
                        "rounded-xl py-2.5 px-3 text-sm font-semibold transition border",
                        isActive
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-foreground border-border active:bg-gray-50"
                      ].join(" "),
                      children: opt.label
                    });
                  })
                }),
                goalType === "milestone" ? jsx("input", {
                  type: "text",
                  value: milestoneLabel,
                  onChange: function (e) { handleMilestoneLabelChange(e.target.value); },
                  placeholder: "e.g. Buy a house, Pay off mortgage\u2026",
                  className: [
                    "w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm mt-3",
                    "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  ].join(" ")
                }) : null
              ]
            })
          })
        ]
      }),

      /* ─── Permissions ───
         Every permission the app can use, with an on/off toggle each.
         Off = Minutics stops using that permission's features (it never
         asks for it again and disables whatever depends on it). Turning a
         toggle back on re-enables the feature (and opens the Android
         setting if the system permission itself is still missing). */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Permissions" }),
          deviceLabel ? jsx('p', { className: 'px-1 mt-1 mb-2 text-[11px] font-semibold text-muted-foreground', children: 'Detected: ' + deviceLabel }) : null,
          jsx(Card, {
            children: jsxs(Fragment, {
              children: [
                !window.AndroidBridge ? jsx(CardRow, {
                  label: "Permissions",
                  desc: "Please install our official Android app to use these features"
                }) : jsxs(Fragment, { children: [
                  jsx(CardRow, {
                    label: "Notifications",
                    desc: permStatus.notifications ? "Granted - reminders reach you" : "Not granted - tap Open to allow",
                    children: jsxs("div", { className: "flex items-center gap-2", children: [
                      jsx(PermStatusBadge, { granted: !!permStatus.notifications }),
                      jsx(PermOpenButton, { onClick: function(){ openPermWithGuide("notifications"); } })
                    ] })
                  }),
                  jsx(Divider, {}),
                  jsx(CardRow, {
                    label: permNames.overlay,
                    desc: permStatus.overlay ? "Granted - popups show above other apps" : "Not granted - tap Open to allow",
                    children: jsxs("div", { className: "flex items-center gap-2", children: [
                      jsx(PermStatusBadge, { granted: !!permStatus.overlay }),
                      jsx(PermOpenButton, { onClick: function(){ openPermWithGuide("overlay"); } })
                    ] })
                  }),
                  deviceIsXiaomi ? jsx(Fragment, { children: [
                    jsx(Divider, {}),
                    jsx(CardRow, {
                    label: permNames.popup,
                    desc: permStatus.popup ? "Granted - alerts show with the app closed" : "Not granted - tap Open to allow",
                    children: jsxs("div", { className: "flex items-center gap-2", children: [
                      jsx(PermStatusBadge, { granted: !!permStatus.popup }),
                      jsx(PermOpenButton, { onClick: function(){ openPermWithGuide("popup"); } })
                    ] })
                  })
                  ] }) : null,
                  jsx(Divider, {}),
                  jsx(CardRow, {
                    label: permNames.autostart,
                    desc: permStatus.autostartState === 1
                      ? "Granted - app restarts after reboot"
                      : permStatus.autostartState === -1
                        ? "Not granted - tap Open to allow"
                        : "State can't be read on this phone - tap Open to check",
                    children: jsxs("div", { className: "flex items-center gap-2", children: [
                      jsx(PermStatusBadge, { granted: permStatus.autostartState === 1, unknown: permStatus.autostartState === 0 }),
                      jsx(PermOpenButton, { onClick: function(){ openPermWithGuide("autostart"); }, disabled: !canOpenAutostart })
                    ] })
                  }),
                  jsx(Divider, {}),
                  jsx(CardRow, {
                    label: "Accessibility",
                    desc: permStatus.accessibility ? "Granted - reels are counted" : "Not granted - optional, for Doom scroll stopper",
                    children: jsxs("div", { className: "flex items-center gap-2", children: [
                      jsx(PermStatusBadge, { granted: !!permStatus.accessibility }),
                      jsx(PermOpenButton, { onClick: function(){ openPermWithGuide("accessibility"); } })
                    ] })
                  })
                ] })
              ]
            })
          }),
          jsx("p", {
            className: "px-1 mt-2.5 text-[11px] leading-relaxed text-muted-foreground",
            children: "If you clicked Open and it did not work, the setting might already be enabled. You can always open your phone Settings and check if Minutics is enabled there."
          })
        ]
      }),


      /* ─── Telegram Daily Reports ─── */
      isPro ? jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Telegram Daily Reports" }),
          jsx(Card, {
            children: jsxs("div", {
              className: "flex flex-col",
              children: [
                /* connection status */
                jsxs("div", {
                  className: [
                    "flex items-center gap-2.5 px-4 py-3",
                    tgConnected ? "bg-green-50" : "bg-gray-50"
                  ].join(" "),
                  children: [
                    jsx(eh, {
                      className: [
                        "h-4.5 w-4.5",
                        tgConnected ? "text-green-500" : "text-gray-400"
                      ].join(" ")
                    }),
                    jsx("span", {
                      className: [
                        "text-sm font-semibold",
                        tgConnected ? "text-green-600" : "text-gray-500"
                      ].join(" "),
                      children: tgConnected ? "Connected" : "Not connected"
                    })
                  ]
                }),
                jsx(Divider, {}),
                /* bot token */
                jsx("div", {
                  className: "px-4 pt-3 pb-1",
                  children: jsx("input", {
                    type: "password",
                    value: tgToken,
                    onChange: function (e) { setTgToken(e.target.value); },
                    placeholder: "Bot Token",
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                /* chat ID */
                jsx("div", {
                  className: "px-4 pt-2 pb-1",
                  children: jsx("input", {
                    type: "password",
                    autoComplete: "off",
                    value: tgChatId,
                    onChange: function (e) { setTgChatId(e.target.value); },
                    placeholder: "Chat ID",
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                /* daily report time */
                jsx("div", {
                  className: "px-4 pt-2 pb-3",
                  children: jsx("input", {
                    type: "time",
                    value: tgTime,
                    onChange: function (e) { setTgTime(e.target.value); },
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                jsx(Divider, {}),
                /* buttons */
                jsxs("div", {
                  className: "flex divide-x divide-border",
                  children: [
                    jsx("button", {
                      onClick: handleSaveTelegram,
                      disabled: tgSaving || !tgToken || !tgChatId,
                      className: [
                        "flex-1 py-3 text-sm font-semibold transition",
                        tgSaved
                          ? "bg-green-600 text-white rounded-md"
                          : tgSaving || !tgToken || !tgChatId
                            ? "text-muted-foreground cursor-not-allowed"
                            : "text-primary active:bg-primary/5"
                      ].join(" "),
                      children: tgSaved ? "Saved \u2713" : tgSaving ? "Saving\u2026" : "Save"
                    }),
                    jsx("button", {
                      onClick: handleTestTelegram,
                      disabled: tgTestLoading || !tgToken || !tgChatId,
                      className: [
                        "flex-1 py-3 text-sm font-semibold transition",
                        tgTestLoading || !tgToken || !tgChatId
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-foreground active:bg-gray-50"
                      ].join(" "),
                      children: tgTestLoading ? "Sending\u2026" : "Test"
                    })
                  ]
                }),
                /* test result banner */
                tgTestResult === "success"
                  ? jsx("div", {
                      className: "mx-4 mb-4 rounded-xl bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-600",
                      children: "Test message sent!"
                    })
                  : tgTestResult === "error"
                    ? jsx("div", {
                        className: "mx-4 mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-500",
                        children: tgTestMsg || "Failed to send. Check your token and chat ID."
                      })
                    : null
              ]
            })
          })
        ]
      }) : jsx("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Telegram Daily Reports" }),
          jsx(Card, {
            children: jsxs("div", {
              className: "flex items-center gap-3 px-4 py-4 cursor-pointer active:bg-red-50/50 transition-colors",
              role: "button",
              onClick: function () {
                window.dispatchEvent(new CustomEvent("lt:upgrade", {
                  detail: "Telegram daily reports are a premium feature. Upgrade to unlock."
                }));
              },
              children: [
                jsx("span", { className: "text-2xl", children: "\uD83D\uDD12" }),
                jsxs("div", {
                  className: "flex-1",
                  children: [
                    jsx("p", { className: "text-sm font-bold text-foreground", children: "Premium feature" }),
                    jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: "Upgrade to unlock Telegram daily reports." })
                  ]
                }),
                jsx("span", { className: "text-muted-foreground text-sm font-bold", children: "\u203A" })
              ]
            })
          })
        ]
      }),

      /* ─── Footer ─── */
      jsx("p", {
        className: "text-center text-[11px] text-muted-foreground mt-2",
        children: "Minutics \u2022 Your time, your value"
      }),
      permGuide
        ? jsx(PermGuide, {
            permKey: permGuide,
            onClose: function () { setPermGuide(null); },
            onOpen: function () {
              var key = permGuide;
              setPermGuide(null);
              try {
                if (window.AndroidBridge && window.AndroidBridge.openPermissionSetting)
                  window.AndroidBridge.openPermissionSetting(key);
              } catch (e) {}
            }
          })
        : null
    ]
  });
}