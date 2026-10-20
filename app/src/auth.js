/* ══════════════════════════════════════════════════════════════════════════
   Lifetime — AWS Cognito Authentication Gate (identity moved off Firebase)
   Email/password sign-up, email-code verification, login and password
   reset all run against the Minutics Cognito user pool. No user data is
   stored in Cognito — auth is identity-only. All app data (activities,
   budget, tasks, etc.) stays exactly where it already lived: on this
   device.

   Sessions: Cognito hands out a short-lived access/ID token pair plus a
   refresh token valid for 365 days. Every launch and every token read goes
   through getSession(), which silently refreshes with the refresh token
   whenever the tokens have expired — so a user who keeps their account
   stays signed in for up to a whole year, not one hour.
   Firebase remains ONLY for push notifications (FCM) — never identity.
══════════════════════════════════════════════════════════════════════════ */

import { initializeApp } from "firebase/app";
import { ltAlert } from "./ui_dialog.js";
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from "amazon-cognito-identity-js";
import { pushTelegramSchedule } from "./lib/telegram.js";

/* Push notifications (FCM) still live on Firebase — auth does not. */
const firebaseConfig = {
  apiKey: "AIzaSyBXruwmDU9SAX4nAe5_Do-x-5qmi_SFh7E",
  authDomain: "lifetime-a4bde.firebaseapp.com",
  projectId: "lifetime-a4bde",
  storageBucket: "lifetime-a4bde.firebasestorage.app",
  messagingSenderId: "330723236770",
  appId: "1:330723236770:web:7df53f2dba32fe87b0f0fb",
  measurementId: "G-L9CHDHYXNN",
};
initializeApp(firebaseConfig);

/* ── Cognito user pool (Minutics AWS account, ap-south-1) ───────────────
   These are public identifiers, not secrets — the pool enforces identity,
   the app client enforces the password policy (8+ chars, upper, lower,
   number). Refresh tokens live 365 days (set at pool creation), which is
   what makes the "stays logged in for a year" behavior possible. */
var COG_POOL_ID = "ap-south-1_QAdugNxC2";
var COG_CLIENT_ID = "8kq0askdobsj49crut3fg9akf";
var _cogPool = new CognitoUserPool({ UserPoolId: COG_POOL_ID, ClientId: COG_CLIENT_ID });
var _cogUser = null;        /* raw CognitoUser currently signed in (or null) */
var _cogCurrentUser = null; /* the lightweight wrapper handed to the app */

/* ── Per-account localStorage namespaces ─────────────────────────────────
   Every Firebase UID owns a private slice of localStorage. On logout /
   account switch the current app keys are snapshotted into lt_ns_<uid>
   and wiped; on login the target uid's snapshot is restored. A brand-new
   account finds no snapshot → completely fresh database → onboarding. */
var ACTIVE_UID_KEY = "lt_active_uid";
var _lastSeenUid = null;
var _justSignedUp = false;
var _prevAuthState; /* undefined | null | user — genuine-login detection */
var _logoutInProgress = false; /* a real signOut() is in flight (set by
    LTAuth.logout / forceLogoutSingleSession) — distinguishes a genuine
    sign-out from a transient IndexedDB read failure that reports null */

/* ── Early Access Demo ───────────────────────────────────────────────────
   DEMO_MODE=true is the shipped Early Access Demo of the web app: the
   login/register gate offers a 30-minute premium demo account whose data
   is fully wiped when the timer runs out. Real Firebase register/login
   still works, but while demo mode is on, free accounts can't buy a plan
   (the paywall shows an "under construction — use the demo" notice).
   To end the early-access period, flip DEMO_MODE to false: the demo
   button disappears, the paywall sells normally, and the next time a real
   account signs in on a browser that ever ran a demo (the
   lt_early_access_demo_v1 marker survives every wipe; it is a flag, not
   user data) that account is granted a free Lifetime plan — demo data
   itself is never imported into real accounts. ─────────────────────────── */
var DEMO_MODE = true;
var DEMO_SESSION_KEY = "lt-demo-session-started";
/* Sliding renewal stamp (activity pushed it forward). Kept separate from
   DEMO_SESSION_KEY so the VISIBLE countdown can count down monotonically
   from the original start while the session itself never expires in use. */
var DEMO_RENEW_KEY = "lt-demo-session-renewed";
/* Set only when the demo is ended ON PURPOSE — Log out, Delete account, or
   the timer reaching zero. This stamp must survive every wipe (it lives on
   its own key) so a renewal can never resurrect a demo the user closed. */
var DEMO_DEAD_KEY = "lt_demo_dead_at_v1";
var DEMO_HISTORY_KEY = "lt_early_access_demo_v1";
var DEMO_DURATION_MS = 30 * 60 * 1000;
var DEMO_UID = "early-access-demo";
var _demoTimerInterval = null;

function nsKey(uid) { return "lt_ns_" + uid; }
function isReservedKey(k) {
  /* Demo keys are device-level session state, never account data: they
     must not be snapshotted into lt_ns_* blobs nor wiped by clearAppKeys
     (only wipeDemoData / _killDemoForRealAuth remove them).
     CognitoIdentityServiceProvider.* is the Cognito SDK's own session
     store (LastAuthUser + token cache) — it is the session itself, not
     app data, so it is never snapshotted or wiped with account keys. */
  return k === ACTIVE_UID_KEY || k.indexOf("lt_ns_") === 0 || k.indexOf("firebase:") === 0
    || k.indexOf("CognitoIdentityServiceProvider.") === 0
    || k === DEMO_SESSION_KEY || k === DEMO_RENEW_KEY || k === DEMO_HISTORY_KEY;
}
function appKeys() {
  var out = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && !isReservedKey(k)) out.push(k);
  }
  return out;
}
function getMarker() {
  try { return localStorage.getItem(ACTIVE_UID_KEY); } catch (e) { return null; }
}
function setMarker(uid) {
  try {
    if (uid) localStorage.setItem(ACTIVE_UID_KEY, uid);
    else localStorage.removeItem(ACTIVE_UID_KEY);
  } catch (e) {}
}

/* ── Single-device sessions: see the DynamoDB-backed section below
    (claim/check against /api/session). ─────────────────────────────── */

function apiOrigin() {
  var o = location.origin || "";
  if (o.indexOf("minutics.com") !== -1) return "";        /* production — same origin */
  if (o.indexOf("localhost") !== -1 || o.indexOf("127.0.0.1") !== -1) return "";
  return "https://app.minutics.com";                      /* Android WebView (appassets) etc. */
}

/* ── Cognito session wrapper ────────────────────────────────────────────
   Everything downstream (storage namespacing, Settings, telegram, the
   Android bridge) used to read Firebase's user object — only .uid, .email
   and .getIdToken() were ever touched. This wrapper keeps exactly that   shape over a Cognito session, so nothing else in the app changed. */
function _jwtPayload(jwt) {
  try {
    var body = String(jwt).split(".")[1] || "";
    body = body.replace(/-/g, "+").replace(/_/g, "/");
    while (body.length % 4) body += "=";
    return JSON.parse(atob(body));
  } catch (e) { return null; }
}
function wrapCogUser(cogUser, session) {
  var payload = null;
  try { payload = session ? _jwtPayload(session.getIdToken()) : null; } catch (e) {}
  return {
    uid: (payload && payload.sub) || (cogUser && cogUser.getUsername && cogUser.getUsername()) || "",
    email: (payload && payload.email) || (cogUser && cogUser.getUsername && cogUser.getUsername()) || "",
    getIdToken: function (force) {
      return new Promise(function (resolve) {
        if (!cogUser) { resolve(null); return; }
        cogUser.getSession(function (err, s) {
          if (err || !s) { resolve(null); return; }
          if (!force) { resolve(s.getIdToken()); return; }
          /* force = bypass the cached token and refresh right now (used
             by the session watch and the report scheduler's heartbeat).
             The refresh token is valid for a year — a failed refresh here
             is a real "signed out", never an hour-expiry artefact. */
          s.refresh(function (e2, s2) {
            resolve(e2 ? s.getIdToken() : s2.getIdToken());
          });
        });
      });
    }
  };
}

/* ── Single-device sessions ─────────────────────────────────────────────
   Same rule as the Firebase days: an account is allowed on ONE device —
   last login wins. A genuine login POSTs {deviceId, mode:"claim"} to
   /api/session, which stores it on the user's row in the MinuticsUsers
   DynamoDB table. Every signed-in client re-checks once a minute
   (mode:"check", read-only) and signs itself out the moment another
   device owns the claim. When the server is offline or its AWS keys are
   not configured it answers degraded and the check no-ops — a server
   hiccup must never kick a device. ─────────────────────────────────── */
var DEVICE_ID_KEY = "lt_device_id_v1";
var _sessionWatchTimer = null;
var _claimGraceUntil = 0;

function getDeviceId() {
  try {
    var id = localStorage.getItem(DEVICE_ID_KEY);
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch (e) { return "d-fallback-device"; }
}

function _sessionPost(body) {
  if (!_cogCurrentUser) return Promise.resolve(null);
  return _cogCurrentUser.getIdToken(false).then(function (tok) {
    if (!tok) return null;
    return fetch(apiOrigin() + "/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
      body: JSON.stringify(body)
    }).then(function (r) { return (r && r.ok) ? r.json() : null; });
  }).catch(function () { return null; });
}

function claimSessionNow() {
  if (!_cogCurrentUser) return;
  _claimGraceUntil = Date.now() + 20000; /* grace: never kick a device racing its own claim */
  _sessionPost({ deviceId: getDeviceId(), mode: "claim" }).catch(function () { /* offline — lands on the next successful login */ });
}

function forceLogoutSingleSession() {
  stopSessionWatch();
  _logoutInProgress = true;
  try { if (_cogUser) _cogUser.signOut(); } catch (e) {}
  _cogUser = null;
  _cogCurrentUser = null;
  setTimeout(function () {
    notifySignedOut();
    setTimeout(function () {
      ltAlert("This account is only allowed on one device. You were signed out here — log in again on this device to take over.");
    }, 400);
  }, 10);
}

function checkSessionClaim() {
  if (!_cogCurrentUser) return;
  _sessionPost({ mode: "check" }).then(function (d) {
    if (!d || !d.device) return; /* degraded server / no claim yet — never kick */
    if (d.device === getDeviceId()) return;
    if (Date.now() < _claimGraceUntil) { claimSessionNow(); return; } /* still registering this device */
    forceLogoutSingleSession();
  });
}

function _sessionOnVisible() { if (!document.hidden) checkSessionClaim(); }

function startSessionWatch() {
  if (_sessionWatchTimer) return;
  _sessionWatchTimer = setInterval(checkSessionClaim, 60000);
  document.addEventListener("visibilitychange", _sessionOnVisible);
  setTimeout(checkSessionClaim, 8000);
}

/* Telegram daily reports must never outlive a session. On logout / account
   deletion stop EVERY sender at once:
     - the native Android alarm — cancelReport() also clears the stored
       prefs, otherwise BootReceiver / the next app launch / the receiver
       itself re-arm the alarm from prefs and reports keep coming forever;
     - the local credentials (lifetime_telegram_settings_v1 is account
       data: it must not survive into the welcome screen or the next
       account);
     - the server cron's schedule — pushing an empty schedule while the ID
       token is still valid makes /api/telegram delete the tgs claims. */
function disconnectTelegramAll() {
  try {
    var b = window.AndroidBridge;
    if (b && b.cancelReport) b.cancelReport();
  } catch (e) {}
  try { localStorage.removeItem("lifetime_telegram_settings_v1"); } catch (e) {}
  try { pushTelegramSchedule({ force: true }); } catch (e) {}
}

function stopSessionWatch() {
  if (_sessionWatchTimer) { clearInterval(_sessionWatchTimer); _sessionWatchTimer = null; }
  document.removeEventListener("visibilitychange", _sessionOnVisible);
}
function snapshotAccount(uid) {
  if (!uid) return;
  var data = {};
  appKeys().forEach(function (k) { data[k] = localStorage.getItem(k); });
  try { localStorage.setItem(nsKey(uid), JSON.stringify(data)); } catch (e) {}
}
function clearAppKeys() {
  appKeys().forEach(function (k) { localStorage.removeItem(k); });
}
function restoreAccount(uid) {
  clearAppKeys();
  var raw = null;
  try { raw = localStorage.getItem(nsKey(uid)); } catch (e) {}
  if (raw) {
    try {
      var data = JSON.parse(raw);
      Object.keys(data).forEach(function (k) { localStorage.setItem(k, data[k]); });
    } catch (e) {}
  }
  setMarker(uid);
}
/* Returns true when live app keys were swapped (React must re-read). */
function reconcileStorage(user) {
  var marker = getMarker();
  if (user) {
    var wasSignup = _justSignedUp;
    _justSignedUp = false;
    if (marker === user.uid) return false;
    if (marker) { /* switching A → B while A's data is live */
      if (appKeys().length > 0) snapshotAccount(marker); /* never overwrite a blob with empty data */
      restoreAccount(user.uid);
      return true;
    }
    if (wasSignup) { /* brand-new account: never inherit orphans */
      clearAppKeys();
      setMarker(user.uid);
      return true;
    }
    /* Known account (snapshot exists) → ALWAYS restore it, even if stray
       live keys are present. After logout, enhancement seeding can write
       default activities back before re-login; without this check those
       keys tripped the migration branch below and the account's real
       database was never restored (user saw onboarding on every re-login). */
    var hasSnapshot = false;
    try { hasSnapshot = !!localStorage.getItem(nsKey(user.uid)); } catch (e) {}
    if (hasSnapshot) {
      restoreAccount(user.uid);
      return true;
    }
    if (appKeys().length > 0) { /* first run of this feature / migration */
      setMarker(user.uid);
      return false;
    }
    restoreAccount(user.uid);
    return true;
  }
  /* Signed out: park current data under its owner and wipe live keys. */
  var owner = marker || _lastSeenUid;
  var changed = false;
  if (owner) {
    if (appKeys().length > 0) { snapshotAccount(owner); }
    clearAppKeys();
    setMarker(null);
    changed = true;
  }
  _lastSeenUid = null;
  return changed;
}
function announceUserChanged() {
  try { window.dispatchEvent(new CustomEvent("lt-user-changed")); } catch (e) {}
}

/* ── Post-login/register notification permission ─────────────────────────
   The app's safety net — Time Waste budget alerts and the "Still there?"
   idle nudge — only reaches the user when the app is CLOSED as a NATIVE
   notification (the WebView suspends every JS timer the moment the app is
   backgrounded). On Android 13+ that needs the POST_NOTIFICATIONS runtime
   grant, and nothing asked early enough: the only request used to fire
   inside showNotification() when the FIRST alert was already due — the
   alert itself was lost and the user never understood why nothing came
   later. Ask right after a genuine login / register (and demo start),
   once the app UI is on screen. No-op on the web (no AndroidBridge) and
   when permission is already granted; the native side owns the actual
   dialog + the permanently-denied → settings fallback. */
function maybeAskNotificationPermission() {
  try {
    var b = window.AndroidBridge;
    if (!b || typeof b.getNotificationPermission !== "function") return;
    if (b.getNotificationPermission() === "granted") return;
    setTimeout(function () {
      try {
        var bb = window.AndroidBridge;
        if (bb && typeof bb.requestNotificationPermission === "function") {
          bb.requestNotificationPermission();
        }
      } catch (e) {}
    }, 1200); /* after the gate drops and the first screen has painted */
  } catch (e) {}
}

/* ── Early Access Demo engine ──────────────────────────────────────────── */
function isDemoActive() {
  try {
    if (!localStorage.getItem(DEMO_SESSION_KEY)) return false;
    /* A demo that was ended on purpose is no longer active, even if a
       stale session key survived the wipe. */
    return !demoAlreadyEnded();
  } catch (e) { return false; }
}
/* EXPIRY clock — measured from the most recent renewal, so an app in use
   (or backgrounded on a phone) never expires. */
function demoTimeRemainingMs() {
  try {
    /* A demo that was ended on purpose is always expired, no matter what
       any stale renewal stamp still says. */
    if (demoAlreadyEnded()) return 0;
    /* Expiry is measured from the ORIGINAL start stamp only. Using
       max(started, renewed) let every activity bump slide the deadline
       forward, so an in-use demo could never reach zero — the countdown
       wrapped back to a fresh 30:00 after 30 minutes and the session looked
       immortal ("it faked it / loops back to 30 minutes"). Activity now
       keeps the APP alive (see bumpDemoSession) but never the DEADLINE. */
    var started = parseInt(localStorage.getItem(DEMO_SESSION_KEY) || "0", 10);
    if (!started) return 0;
    return DEMO_DURATION_MS - (Date.now() - started);
  } catch (e) { return 0; }
}
/* DISPLAY clock — always measured from the ORIGINAL start stamp, so the
   visible "Demo 30:00" counts straight down and never jumps back to 30:00
   when the session renews (the old countdown-reset "infinite loop"). After
   a full 30 minutes of active use it cleanly wraps to a fresh 30:00. */
function demoDisplayRemainingMs() {
  try {
    var started = parseInt(localStorage.getItem(DEMO_SESSION_KEY) || "0", 10);
    if (!started) return 0;
    var elapsed = Date.now() - started;
    if (elapsed < 0) elapsed = 0;
    return DEMO_DURATION_MS - (elapsed % DEMO_DURATION_MS);
  } catch (e) { return 0; }
}
function markDemoHistory() {
  /* Reserved key — survives every wipe (clearAppKeys skips it). After the
     demo is removed (DEMO_MODE=false) it unlocks a free Lifetime plan. */
  try { localStorage.setItem(DEMO_HISTORY_KEY, "1"); } catch (e) {}
}
function hasDemoHistory() {
  try { return localStorage.getItem(DEMO_HISTORY_KEY) === "1"; } catch (e) { return false; }
}
function _stopDemoTimer() {
  if (_demoTimerInterval) { clearInterval(_demoTimerInterval); _demoTimerInterval = null; }
  var w = document.getElementById("lt-demo-timer");
  if (w) w.remove();
}
/* Remove every trace of the demo account's data. Deliberately keeps:
   - lt_early_access_demo_v1 (early-access flag, not user data)
   - lt_ns_<real-uid> blobs (other accounts' parked data — never demo data)
   - lt_device_id_v1 is an appKey and does get cleared here; it regenerates
     on next use, which is harmless. */
function wipeDemoData() {
  try { clearAppKeys(); } catch (e) {}
  try { localStorage.removeItem(DEMO_SESSION_KEY); } catch (e) {}
  try { localStorage.removeItem(DEMO_RENEW_KEY); } catch (e) {}
  try { localStorage.removeItem(nsKey(DEMO_UID)); } catch (e) {}
  try { if (getMarker() === DEMO_UID) setMarker(null); } catch (e) {}
  try { localStorage.removeItem("lt_last_uid"); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  markDemoHistory();
}
function endDemoSession() {
  /* Stamp the end FIRST: once this lands, no renewal (activity bump or
     visibilitychange) can bring the demo back. The key is kept out of
     clearAppKeys so the wipe below can't erase it either. */
  try { localStorage.setItem(DEMO_DEAD_KEY, String(Date.now())); } catch (e) {}
  _stopDemoTimer();
  wipeDemoData();
  document.body.classList.remove("lt-authed");
  try { announceUserChanged(); } catch (e) {}
  renderGate("welcome"); /* demo key is gone → renders the normal welcome */
  /* Full teardown: reload once so NO in-memory React/enhancement state can
     survive the wipe and repopulate the next session (deleting the demo
     used to look like a mere "reset" — data came back). The wipe already
     removed the session key, so boot lands on the welcome screen and this
     can never loop. */
  var wipedClean = false;
  try { wipedClean = !isDemoActive(); } catch (e) { wipedClean = true; }
  if (wipedClean) {
    /* 400ms: also gives disconnectTelegramAll's schedule-purge fetch a
       moment to land before the page goes away. */
    try { setTimeout(function () { location.reload(); }, 400); } catch (e) {}
  }
}
/* A real sign-in always beats a demo session: wipe the demo completely
   FIRST so none of its data can be swept into the real account's
   lt_ns_* namespace by reconcileStorage. */
function killDemoForRealAuth() {
  _stopDemoTimer();
  wipeDemoData();
}
function enterDemo(isNew) {
  if (isNew) {
    /* A brand-new demo clears the "ended on purpose" stamp — the user is
       explicitly starting over, so the previous end no longer applies. */
    try { localStorage.removeItem(DEMO_DEAD_KEY); } catch (e) {}
    /* A new demo always starts from zero — every previous demo's data is
       removed before the fresh session begins. A live real account (only
       possible via a weird edge) is parked, never destroyed. */
    try { sessionStorage.clear(); } catch (e) {}
    try {
      var m = getMarker();
      if (m && m !== DEMO_UID) snapshotAccount(m);
      clearAppKeys();
      setMarker(DEMO_UID);
    } catch (e) {}
    markDemoHistory();
    try { localStorage.setItem(DEMO_SESSION_KEY, String(Date.now())); } catch (e) {}
    try { localStorage.removeItem(DEMO_RENEW_KEY); } catch (e) {}
    try { localStorage.removeItem("lt_last_uid"); } catch (e) {}
    /* Premium is free during the demo. */
    if (window.LTPlan && window.LTPlan.setPlan) {
      window.LTPlan.setPlan("lifetime");
    } else {
      try {
        localStorage.setItem("lt_plan_v1", JSON.stringify("lifetime"));
        localStorage.setItem("lt_plan_since_v1", JSON.stringify(Date.now()));
      } catch (e) {}
    }
    try { window.dispatchEvent(new Event("lt-plan-changed")); } catch (e) {}
    /* Land on the Timer home, exactly like a genuine login does. */
    var hasRoute = location.pathname !== "/" ||
      (location.hash && location.hash !== "#/" && location.hash !== "#");
    if (hasRoute) {
      try { history.pushState({}, "", "/"); window.dispatchEvent(new PopStateEvent("popstate")); } catch (e) {}
    }
    /* Starting a demo IS this demo build's login/register — same ask. */
    maybeAskNotificationPermission();
  }
  hideBootSplash();
  var g = document.getElementById("lt-auth-gate");
  if (g) g.remove();
  /* #lt-startup-splash is deliberately NOT touched here: it plays its full
     logo animation and releases itself (ended / 3s never-started / 7s hard
     cap). Dismissing it whenever auth won the race against the video is
     exactly why the splash appeared only "sometimes". */
  document.body.classList.add("lt-authed");
  var root = document.getElementById("root");
  if (root) root.removeAttribute("style");
  try { window.dispatchEvent(new CustomEvent("lt-user-changed")); } catch (e) {}
  showDemoTimer();
}
/* Keep the demo alive while it is actually in use: real input — or the
   tab/app returning to the foreground — pushes the started-at stamp
   forward, so an app being used (or simply backgrounded on a phone) is
   never kicked back to the welcome screen. Writes are throttled to once
   a minute; with no activity at all the demo still ends after 30 min. */
/* Set only when the demo is ended ON PURPOSE — Log out, Delete account, or
   the timer reaching zero. This stamp must survive every wipe (it lives on
   its own key) so a renewal can never resurrect a demo the user closed. */
function demoAlreadyEnded() {
  try {
    var dead = parseInt(localStorage.getItem(DEMO_DEAD_KEY) || "0", 10);
    if (!dead) return false;
    /* A stamp older than the current session belongs to a PREVIOUS demo —
       the user started a fresh one since, which is allowed. */
    var started = parseInt(localStorage.getItem(DEMO_SESSION_KEY) || "0", 10);
    return !started || dead >= started;
  } catch (e) { return false; }
}
function bumpDemoSession() {
  try {
    /* An ended demo is never renewed — this was the bug that made the
       "30 minute" demo immortal: every pointermove pushed the renewal
       stamp forward, so an app left in use simply never expired. */
    if (demoAlreadyEnded()) return;
    var started = parseInt(localStorage.getItem(DEMO_SESSION_KEY) || "0", 10);
    if (!started) return;
    var renewed = parseInt(localStorage.getItem(DEMO_RENEW_KEY) || "0", 10);
    var last = Math.max(started, renewed);
    if (Date.now() - last < 60000) return;
    /* Renewal moves the separate renew stamp only — the original start
       stamp (which drives the visible countdown) is never touched. */
    localStorage.setItem(DEMO_RENEW_KEY, String(Date.now()));
  } catch (e) {}
}
function showDemoTimer() {
  /* The visible countdown now lives inside the app's top status bar
     (DemoClock in _slice_shell.js) — the old floating pill covered the
     "No activity running" bar. This ticker only drives expiry. */
  var existing = document.getElementById("lt-demo-timer");
  if (existing) existing.remove();
  function tick() {
    var remaining = demoTimeRemainingMs();
    if (remaining > 0) return;
    /* The 30 minutes are up: end the demo NOW, even if the tab is hidden or
       the app was backgrounded. This was the "it fakes it / stops counting
       when I close it" bug — renewing here instead of ending meant a hidden
       tab silently got a fresh 30 minutes every time it was checked, so the
       demo could sit open for hours and then loop back to 30:00. */
    endDemoSession();
  }
  tick();
  if (_demoTimerInterval) clearInterval(_demoTimerInterval);
  _demoTimerInterval = setInterval(tick, 1000);
  /* Renew on real activity — the demo now closes only after 30 idle
     minutes, not after 30 wall-clock minutes of active use. */
  if (!window.__ltDemoActivityBound) {
    window.__ltDemoActivityBound = true;
    var evts = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "visibilitychange"];
    for (var i = 0; i < evts.length; i++) {
      window.addEventListener(evts[i], bumpDemoSession, { passive: true, capture: true });
    }
  }
}
/* Shared with enhancements.js (paywall messaging). */
window.LTDemo = {
  mode: function () { return DEMO_MODE; },
  isActive: isDemoActive,
  remainingMs: demoTimeRemainingMs,
  displayMs: demoDisplayRemainingMs,
  start: function () { enterDemo(true); },
  end: endDemoSession,
};

/* Expose logout for the Settings-page "Log out" row (added in lifetime-enhancements.js) */
window.LTAuth = {
  logout: function () {
    /* Demo session: "Log out" ends the demo — full data wipe, back to
       the welcome screen (never a Cognito signOut of a null user). */
    if (DEMO_MODE && isDemoActive()) { disconnectTelegramAll(); endDemoSession(); return; }
    /* IMPORTANT: do NOT clear localStorage here. */
    _logoutInProgress = true;

    // Clean up any enhancement visuals before logout to prevent flash
    cleanupEnhancementVisuals();

    // Force #root invisible during logout so old UI can't flash.
    // Do NOT clear innerHTML — that breaks React's virtual DOM and the
    // nav bar disappears on re-login.
    var root = document.getElementById("root");
    if (root) root.style.cssText = "display:none!important";

    /* Before the session goes away: kill the native alarm + local
       credentials and clear the server cron's schedule for this account. */
    disconnectTelegramAll();

    /* Cognito's local signOut is synchronous (clears the cached session);
       the null-state funnel below parks this account's data and renders
       the gate — exactly what Firebase's onAuthStateChanged(null) did. */
    _cogCurrentUser = null;
    try { if (_cogUser) _cogUser.signOut(); } catch (err) { console.error("signOut failed:", err); }
    _cogUser = null;
    notifySignedOut();
    /* FAILSAFE: if notifySignedOut somehow never rendered a gate, the
       #root stays hidden above and nothing is on screen → force the login
       gate after 5s. Guard: only when root is still hidden AND no gate
       exists (i.e. a quick re-login or a completed logout both leave this
       a no-op). */
    setTimeout(function () {
      if (document.getElementById("lt-auth-gate")) return;
      var r = document.getElementById("root");
      if (r && r.style.display === "none") renderGate("welcome");
    }, 5000);
  },
  currentUser: function () {
    return _cogCurrentUser;
  },
  getToken: function (force) {
    /* Returns this session's ID token (refreshed when force=true). With
       Cognito the session — not the token — is what lives for a year, so
       "force" refreshes from the long-lived refresh token; it can never
       log the user out. */
    if (!_cogCurrentUser) return Promise.resolve(null);
    return _cogCurrentUser.getIdToken(!!force);
  },
  /* Permanently delete the signed-in Cognito account. The session's own
     access token authorizes the delete — no server round-trip and no AWS
     keys needed. Resolves when Cognito confirms; the caller wipes local
     data afterwards (Settings). */
  deleteAccount: function () {
    return new Promise(function (resolve, reject) {
      var cu = _cogUser;
      if (!cu) { reject(new Error("Not signed in — log in again first.")); return; }
      cu.deleteUser(function (err) {
        if (err) reject(new Error((err && err.message) || "Could not delete account"));
        else resolve();
      });
    });
  },
  /* Absolute API origin for endpoints called from Settings ("" on web,
     https://app.minutics.com from the Android WebView / any non-app host). */
  apiOrigin: function () { return apiOrigin(); },
};

/* ── Styles — matches the supplied Login/Register mock exactly: cream +
   amber illustration header, white rounded-t-3xl sheet, Geist font ──────── */
function injectStyles() {
  if (document.getElementById("lt-auth-styles")) return;

  var fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "/fonts/geist.css"; /* self-hosted — no Google request, SRI-safe */
  document.head.appendChild(fontLink);

  var style = document.createElement("style");
  style.id = "lt-auth-styles";
  style.textContent = `
    #lt-auth-gate {
      position: fixed; inset: 0; z-index: 999999;
      background: #Fdfbf7; color: #111827;
      display: flex; align-items: flex-start; justify-content: center;
      overflow-y: auto; overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      font-family: 'Geist', -apple-system, sans-serif;
      /* NOTE: no opacity animation on this element itself. It has to be
         100% opaque at the very first painted frame -- whatever screen
         was on-screen a moment ago (an authenticated Settings page, a
         stale "Pro" badge, etc.) is still mounted behind this overlay for
         a beat, and animating THIS element's opacity made that stale
         screen bleed through as a visible flash during the fade. Only the
         children animate; the opaque background never does. */
    }
    #lt-auth-gate * { box-sizing: border-box; }
    @keyframes lt-auth-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lt-auth-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
    @keyframes lt-auth-shake {
      10%, 90% { transform: translateX(-1px); }
      20%, 80% { transform: translateX(2px); }
      30%, 50%, 70% { transform: translateX(-4px); }
      40%, 60% { transform: translateX(4px); }
    }
    @keyframes lt-auth-spin { to { transform: rotate(360deg); } }

    /* ── Dark auth screens (Login / Register / Forgot): navy backdrop with a
       soft violet glow + faint square grid, white card on top — the Rotta
       login layout translated into Minutics colors. ────────────────────── */
    .lt-auth-darkbg {
      position: fixed; inset: 0; z-index: 0; pointer-events: none;
      background:
        radial-gradient(130% 80% at 50% -25%, rgba(79,70,229,.42) 0%, rgba(79,70,229,0) 55%),
        radial-gradient(90% 70% at 115% 115%, rgba(147,51,234,.22) 0%, rgba(147,51,234,0) 60%),
        linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px);
      background-size: auto, auto, 46px 46px, 46px 46px;
      animation: lt-auth-fade .45s ease;
    }
    .lt-auth-scr {
      position: relative; z-index: 1; width: 100%; max-width: 460px;
      margin: auto; padding: 52px 22px calc(38px + env(safe-area-inset-bottom));
      animation: lt-auth-rise .5s cubic-bezier(.22,1,.36,1);
    }
    .lt-auth-back {
      width: 44px; height: 44px; border-radius: 50%;
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.16);
      color: #fff; display: flex; align-items: center; justify-content: center;
      cursor: pointer; margin-bottom: 28px; padding: 0;
      -webkit-tap-highlight-color: transparent; transition: background .15s;
    }
    .lt-auth-back:hover { background: rgba(255,255,255,.16); }
    .lt-auth-back svg { width: 20px; height: 20px; }
    .lt-auth-h1 {
      color: #fff; font-size: clamp(27px, 7.4vw, 32px); line-height: 1.2;
      font-weight: 700; letter-spacing: -.02em; margin: 0;
    }
    .lt-auth-sub2 { color: #A9AEC9; font-size: 14.5px; line-height: 1.55; margin: 10px 0 0; }
    .lt-auth-card {
      background: #fff; border-radius: 26px; margin-top: 28px;
      padding: 20px 18px 22px;
      box-shadow: 0 32px 64px -32px rgba(0,0,0,.6), 0 10px 26px -14px rgba(0,0,0,.35);
      animation: lt-auth-rise .5s cubic-bezier(.22,1,.36,1) .06s backwards;
    }
    /* segmented Login / Register switcher (sliding indicator) */
    .lt-auth-tabs {
      position: relative; display: grid; grid-template-columns: 1fr 1fr;
      background: #F0F0F5; border-radius: 999px; padding: 4px;
    }
    .lt-auth-tabs-ind {
      position: absolute; top: 4px; left: 4px;
      width: calc(50% - 4px); height: calc(100% - 8px);
      background: #fff; border-radius: 999px;
      box-shadow: 0 2px 8px rgba(17,24,39,.14);
      transition: transform .25s cubic-bezier(.22,1,.36,1);
    }
    .lt-auth-tabs[data-active="signup"] .lt-auth-tabs-ind { transform: translateX(100%); }
    .lt-auth-tab {
      position: relative; z-index: 1; border: none; background: none;
      padding: 11px 0; font-size: 14.5px; font-weight: 600; color: #9AA0B0;
      font-family: inherit; cursor: pointer; border-radius: 999px;
      transition: color .2s;
    }
    .lt-auth-tab.lt-auth-tab-on { color: #111827; font-weight: 700; }
    /* fields with static label above the value (Rotta style) */
    #lt-auth-form, #lt-forgot-form { display: block; margin-top: 16px; }
    .lt-auth-field {
      display: flex; align-items: center; gap: 12px;
      background: #fff; border: 1.5px solid #E8E8F0; border-radius: 16px;
      padding: 11px 14px; transition: border-color .15s, box-shadow .15s;
    }
    .lt-auth-field + .lt-auth-field { margin-top: 12px; }
    .lt-auth-field:focus-within { border-color: #4F46E5; box-shadow: 0 0 0 4px rgba(79,70,229,.13); }
    .lt-auth-field.lt-auth-invalid { border-color: #dc2626; }
    .lt-auth-field-icon { width: 20px; height: 20px; flex-shrink: 0; color: #9AA0B0; pointer-events: none; transition: color .15s; }
    .lt-auth-field:focus-within .lt-auth-field-icon { color: #4F46E5; }
    .lt-auth-fbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .lt-auth-flabel { font-size: 10.5px; font-weight: 600; letter-spacing: .03em; color: #9AA0B0; }
    .lt-auth-field input {
      width: 100%; border: none; outline: none; background: transparent;
      font-size: 15.5px; font-weight: 500; color: #111827;
      font-family: inherit; padding: 0;
    }
    .lt-auth-field input::placeholder { color: #C3C7D4; font-weight: 400; }
    .lt-auth-pw-toggle {
      flex-shrink: 0; width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; padding: 0; cursor: pointer;
      color: #9AA0B0; -webkit-tap-highlight-color: transparent; transition: color .15s;
    }
    .lt-auth-pw-toggle:hover { color: #111827; }
    .lt-auth-pw-toggle svg { width: 20px; height: 20px; }
    .lt-auth-hint { margin: 10px 0 0; font-size: 12px; color: #9AA0B0; }
    .lt-auth-frow { display: flex; justify-content: flex-end; margin-top: 12px; }
    .lt-auth-forgot { font-size: 13px; font-weight: 700; color: #4F46E5; cursor: pointer; text-underline-offset: 2px; }
    .lt-auth-forgot:hover { text-decoration: underline; }
    .lt-auth-submit {
      width: 100%; margin-top: 18px;
      display: flex; align-items: center; justify-content: center; gap: 9px;
      background: linear-gradient(135deg, #4F46E5 0%, #9333EA 100%);
      border: none; border-radius: 999px;
      color: #fff; font-size: 15.5px; font-weight: 700; letter-spacing: .01em;
      padding: 16px; cursor: pointer; font-family: inherit;
      box-shadow: 0 16px 34px -14px rgba(99,102,241,.85);
      transition: transform .15s, box-shadow .15s, filter .15s, opacity .15s;
    }
    .lt-auth-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 20px 40px -14px rgba(99,102,241,.95); }
    .lt-auth-submit:active:not(:disabled) { transform: translateY(0); }
    .lt-auth-submit:disabled { opacity: .65; cursor: default; box-shadow: none; }
    .lt-auth-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: lt-auth-spin .7s linear infinite; display: none;
    }
    .lt-auth-submit.lt-auth-loading .lt-auth-spinner { display: inline-block; }
    .lt-auth-error {
      display: none; background: #FEF2F2; border: 1px solid #FECACA;
      border-radius: 14px; color: #DC2626; font-size: 13px; padding: 11px 14px;
      line-height: 1.5; margin-bottom: 14px;
    }
    .lt-auth-error.lt-auth-shown { display: block; animation: lt-auth-shake .4s; }
    .lt-auth-error.lt-success { background: #F0FDF4; border-color: #BBF7D0; color: #16A34A; }
    .lt-auth-disclaimer {
      margin-top: 18px; padding-top: 14px; border-top: 1px solid #F0F0F5;
      font-size: 10.5px; line-height: 1.6; color: #9AA0B0; text-align: center;
    }
    .lt-auth-disclaimer b { font-weight: 600; color: #6B7280; }
    /* Early Access Demo CTA — sits under the login/register form on BOTH tabs */
    .lt-auth-demobtn {
      width: 100%; margin-top: 14px;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
      border: none; border-radius: 999px;
      padding: 13px 16px; cursor: pointer; font-family: inherit;
      color: #78350F;
      box-shadow: 0 14px 28px -14px rgba(245,158,11,.75);
      transition: transform .15s, filter .15s;
      -webkit-tap-highlight-color: transparent;
    }
    .lt-auth-demobtn:hover { transform: translateY(-1px); filter: brightness(1.05); }
    .lt-auth-demobtn:active { transform: translateY(0); }
    .lt-auth-demobtn-main { font-size: 15px; font-weight: 800; letter-spacing: .01em; }
    .lt-auth-demobtn-sub {
      font-size: 10.5px; font-weight: 700; opacity: .72; letter-spacing: .05em;
      text-transform: lowercase;
    }

    /* ── Welcome / "Get Started for Free" screen (Leafboard-style arch:
       starry navy dome with the brand badge sitting on the curve, name,
       tagline, gradient pill CTA). ────────────────────────────────────── */
    .lt-auth-welcome {
      position: relative; width: 100%; max-width: 520px; min-height: 100%;
      margin: auto; display: flex; flex-direction: column;
      animation: lt-auth-fade .45s ease;
    }
    .lt-auth-herowrap { position: relative; }
    .lt-auth-hero {
      position: relative; height: clamp(300px, 46vh, 430px); overflow: hidden;
      background: radial-gradient(95% 85% at 50% -15%, #2B3070 0%, #1B1E45 48%, #141634 100%);
      border-bottom-left-radius: 50% 96px;
      border-bottom-right-radius: 50% 96px;
    }
    .lt-auth-stars { position: absolute; inset: 0; width: 100%; height: 100%; }
    .lt-auth-badge {
      position: absolute; left: 50%; bottom: -46px; transform: translateX(-50%);
      width: 94px; height: 94px; border-radius: 50%; background: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 20px 44px -16px rgba(20,22,46,.5);
      /* no entrance animation: the rise keyframes overrode the badge's
         translateX(-50%) centering, so it rendered off-center and then
         snapped into place when the animation ended. Static = correct. */
    }
    .lt-auth-badge-logo { width: 76px; height: 76px; border-radius: 50%; object-fit: cover; display: block; }
    .lt-auth-wtext { text-align: center; padding: 110px 30px 0; }
    .lt-auth-wtitle { font-size: clamp(33px, 9vw, 40px); font-weight: 800; letter-spacing: -.03em; color: #14162E; margin: 0; }
    .lt-auth-wsub { font-size: 15.5px; line-height: 1.55; color: #6B7280; margin: 13px auto 0; max-width: 320px; }
    .lt-auth-wfoot {
      margin-top: auto; display: flex; flex-direction: column; align-items: center;
      padding: 30px 30px calc(36px + env(safe-area-inset-bottom));
    }
    .lt-auth-wcta {
      width: 100%; max-width: 340px;
      display: inline-flex; align-items: center; justify-content: center; gap: 10px;
      background: linear-gradient(135deg, #4F46E5 0%, #9333EA 100%);
      border: none; border-radius: 999px;
      color: #fff; font-size: 15.5px; font-weight: 700;
      padding: 17px 30px; cursor: pointer; font-family: inherit;
      box-shadow: 0 18px 40px -14px rgba(99,102,241,.8);
      transition: transform .15s, box-shadow .15s, filter .15s;
    }
    .lt-auth-wcta:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 24px 48px -16px rgba(99,102,241,.95); }
    .lt-auth-wcta:active { transform: translateY(0); }
    .lt-auth-wcta svg { width: 18px; height: 18px; transition: transform .2s; }
    .lt-auth-wcta:hover svg { transform: translateX(4px); }
    .lt-auth-wlogin { margin: 18px 0 0; font-size: 13.5px; color: #6B7280; }
    .lt-auth-wlogin a { color: #4F46E5; font-weight: 700; cursor: pointer; text-underline-offset: 2px; }
    .lt-auth-wlogin a:hover { text-decoration: underline; }
    .lt-auth-earlyaccess {
      display: inline-block; margin: 0 auto 14px;
      padding: 7px 16px; border-radius: 999px;
      background: linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%);
      color: #78350F;
      font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
      box-shadow: 0 10px 22px -10px rgba(245,158,11,.6);
    }

    @media (max-height: 680px) {
      .lt-auth-hero { height: 260px; }
      .lt-auth-wtext { padding-top: 100px; }
      .lt-auth-scr { padding-top: 34px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .lt-auth-darkbg, .lt-auth-scr, .lt-auth-card, .lt-auth-badge, .lt-auth-welcome { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* Typed email/password survive tab switches and back-navigation (the whole
   gate re-renders on every mode change). Cleared once a user signs in. */
var _gateDraft = { email: "", pw: "" };

function saveDraft() {
  try {
    var e = document.getElementById("lt-auth-email");
    var p = document.getElementById("lt-auth-password");
    if (e) _gateDraft.email = e.value;
    if (p) _gateDraft.pw = p.value;
  } catch {}
}
function applyDraft() {
  try {
    var e = document.getElementById("lt-auth-email");
    var p = document.getElementById("lt-auth-password");
    if (e && _gateDraft.email) e.value = _gateDraft.email;
    if (p && _gateDraft.pw) p.value = _gateDraft.pw;
  } catch {}
}

/* ── Render login/signup form ──────────────────────────────────────────── */
/* Fade the first-paint boot splash (index.html #lt-boot-splash) once a real
   screen — app or login gate — is ready underneath it. */
function hideBootSplash() {
  var b = document.getElementById("lt-boot-splash");
  if (!b) return;
  b.style.opacity = "0";
  setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 450);
}

function renderGate(mode) {
  /* An active Early Access Demo session resumes here (welcome is only
     ever requested by the signed-out paths); an expired one is wiped in
     full before the welcome screen is shown. */
  if (mode === "welcome" && DEMO_MODE && isDemoActive()) {
    if (demoTimeRemainingMs() > 0) { enterDemo(false); return; }
    endDemoSession(); return; /* wipes first — demo key gone → no recursion */
  }
  hideBootSplash();
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) {
    // When switching between auth screens (login <-> signup <-> forgot), 
    // we need to ensure no flash of the underlying app content
    existing.style.opacity = "1";
    existing.style.visibility = "visible";
    existing.remove();
  }

  // Clean up any Pro badge or enhancement visuals that might be lingering
  cleanupEnhancementVisuals();

  if (mode === "welcome") { renderWelcomeGate(); return; }
  if (mode === "forgot") { renderForgotGate(); return; }
  if (mode === "confirm") { renderConfirmGate(); return; }

  var isSignup = mode === "signup";
  var MAIL_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var LOCK_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var EYE_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var EYE_OFF_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var BACK_ICON = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  // Ensure the gate is fully opaque immediately to prevent any flash of underlying content
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:hsl(230 40% 16%);color:#111827;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-darkbg" aria-hidden="true"></div>' +
    '<main class="lt-auth-scr">' +
      '<button type="button" class="lt-auth-back" id="lt-auth-back-btn" aria-label="Back">' + BACK_ICON + '</button>' +
      '<h1 class="lt-auth-h1" id="lt-auth-h1">' + (isSignup ? "Go ahead and create your account" : "Welcome back to Minutics") + '</h1>' +
      '<p class="lt-auth-sub2" id="lt-auth-sub2">' + (isSignup ? "Sign up in seconds and start owning every minute" : "Log in to continue your Minutics journey") + '</p>' +
      '<section class="lt-auth-card">' +
        '<div class="lt-auth-error" id="lt-auth-error"></div>' +
        '<div class="lt-auth-tabs" data-active="' + (isSignup ? "signup" : "login") + '">' +
          '<span class="lt-auth-tabs-ind"></span>' +
          '<button type="button" class="lt-auth-tab' + (isSignup ? "" : " lt-auth-tab-on") + '" id="lt-auth-tab-login">Login</button>' +
          '<button type="button" class="lt-auth-tab' + (isSignup ? " lt-auth-tab-on" : "") + '" id="lt-auth-tab-signup">Register</button>' +
        '</div>' +
        '<form id="lt-auth-form" novalidate>' +
          '<div class="lt-auth-field">' + MAIL_ICON +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-auth-email">Email Address</label>' +
              '<input type="email" id="lt-auth-email" placeholder="you@example.com" autocomplete="email" required>' +
            '</div>' +
          '</div>' +
          '<div class="lt-auth-field">' + LOCK_ICON +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-auth-password">Password</label>' +
              '<input type="password" id="lt-auth-password" placeholder="Enter your password" autocomplete="' + (isSignup ? "new-password" : "current-password") + '" required>' +
            '</div>' +
            '<button type="button" class="lt-auth-pw-toggle" id="lt-auth-pw-toggle" aria-label="Show password">' + EYE_ICON + '</button>' +
          '</div>' +
          '<p class="lt-auth-hint" id="lt-auth-pw-hint" style="display:' + (isSignup ? "block" : "none") + '">Password must be 8+ characters with an uppercase letter, a lowercase letter and a number</p>' +
          '<div class="lt-auth-frow" id="lt-auth-forgot-row" style="display:' + (isSignup ? "none" : "flex") + '">' +
            '<button type="button" class="lt-auth-forgot" id="lt-auth-forgot-link">Forgot password?</button>' +
          '</div>' +
          '<button class="lt-auth-submit" type="submit" id="lt-auth-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-auth-submit-label">' + (isSignup ? "Sign up" : "Login") + '</span>' +
          '</button>' +
        '</form>' +
        (DEMO_MODE
          ? '<button type="button" class="lt-auth-demobtn" id="lt-auth-demo-btn">' +
              '<span class="lt-auth-demobtn-main">Use Demo Account 30 Minute</span>' +
              '<span class="lt-auth-demobtn-sub">auto delete all data</span>' +
            '</button>'
          : '') +
        '<p class="lt-auth-disclaimer"><b>Please note:</b> your data (activities, budget, tasks) is saved only on this device — it never leaves your phone. If you log in on another device, you\u2019ll start fresh there; your data won\u2019t carry over. We don\u2019t store your data on our own servers because we respect your privacy.</p>' +
      '</section>' +
    '</main>';
  document.body.appendChild(gate);
  applyDraft();

  document.getElementById("lt-auth-back-btn").addEventListener("click", function () {
    saveDraft();
    renderGate("welcome");
  });
  /* Tab switch happens IN PLACE — never re-render the gate (the full
     re-render made the card/heading disappear and reappear with the rise
     animation replaying). Values stay because nothing is recreated. */
  var tabLogin = document.getElementById("lt-auth-tab-login");
  var tabSignup = document.getElementById("lt-auth-tab-signup");
  function switchTab(toSignup) {
    if (isSignup === toSignup) return;
    isSignup = toSignup;
    document.querySelector("#lt-auth-gate .lt-auth-tabs").dataset.active = toSignup ? "signup" : "login";
    tabLogin.classList.toggle("lt-auth-tab-on", !toSignup);
    tabSignup.classList.toggle("lt-auth-tab-on", toSignup);
    document.getElementById("lt-auth-h1").textContent =
      toSignup ? "Go ahead and create your account" : "Welcome back to Minutics";
    document.getElementById("lt-auth-sub2").textContent =
      toSignup ? "Sign up in seconds and start owning every minute" : "Log in to continue your Minutics journey";
    document.getElementById("lt-auth-password").autocomplete =
      toSignup ? "new-password" : "current-password";
    document.getElementById("lt-auth-pw-hint").style.display = toSignup ? "block" : "none";
    document.getElementById("lt-auth-forgot-row").style.display = toSignup ? "none" : "flex";
    submitLabel.textContent = toSignup ? "Sign up" : "Login";
    hideError();
  }
  tabLogin.addEventListener("click", function () { switchTab(false); });
  tabSignup.addEventListener("click", function () { switchTab(true); });

  var forgotLink = document.getElementById("lt-auth-forgot-link");
  if (forgotLink) {
    forgotLink.addEventListener("click", function () {
      saveDraft();
      renderGate("forgot");
    });
  }

  var pwInput = document.getElementById("lt-auth-password");
  var pwToggle = document.getElementById("lt-auth-pw-toggle");
  pwToggle.addEventListener("click", function () {
    var showing = pwInput.type === "text";
    pwInput.type = showing ? "password" : "text";
    pwToggle.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
    pwToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  var demoBtn = document.getElementById("lt-auth-demo-btn");
  if (demoBtn) {
    demoBtn.addEventListener("click", function () { enterDemo(true); });
  }

  var form = document.getElementById("lt-auth-form");
  var submitBtn = document.getElementById("lt-auth-submit");
  var submitLabel = document.getElementById("lt-auth-submit-label");

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("lt-auth-loading", loading);
    submitLabel.textContent = loading
      ? (isSignup ? "Signing up..." : "Logging in...")
      : (isSignup ? "Sign up" : "Login");
  }
  _gateSetLoadingFn = setLoading;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("lt-auth-email").value.trim();
    var password = pwInput.value;
    hideError();
    if (!email) { showError("Enter your email first."); return; }
    if (isSignup && !ltPasswordLooksStrong(password)) {
      /* Same rule Cognito enforces server-side — check it here first so a
         weak password never burns a signup attempt. */
      showError("Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.");
      return;
    }

    setLoading(true);

    if (isSignup) {
      _justSignedUp = true;
      cognitoSignUp(email, password);
    } else {
      cognitoLogin(email, password);
    }
    /* On success the auth funnel (handleAuthUser) removes the gate */
  });
}

/* ── Cognito flows: sign-up → email code → auto-login; direct login ──── */
var _gateSetLoadingFn = null;
var _pendingConfirm = null; /* { email, password?, user } while verifying the email code */
function gateSetLoading(loading) {
  try { if (_gateSetLoadingFn) _gateSetLoadingFn(loading); } catch (e) {}
}
function ltPasswordLooksStrong(pw) {
  return pw.length >= 8 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
}

function cognitoSignUp(email, password) {
  try {
    _cogPool.signUp(email, password, [{ Name: "email", Value: email }], null, function (err, result) {
      if (err) {
        _justSignedUp = false;
        gateSetLoading(false);
        if (err && (err.code || err.name) === "UsernameExistsException") {
          /* Cognito tells us whether the existing account is still waiting
             for its email code — if so, jump straight back to the code
             screen instead of sending the user in a login circle. */
          _pendingConfirm = { email: email, password: password, user: null };
          renderGate("confirm");
          setTimeout(function () {
            showError("That email is signed up but not verified yet — enter the code we emailed you.");
          }, 0);
          return;
        }
        showError(friendlyError(err));
        return;
      }
      _pendingConfirm = { email: email, password: password, user: result && result.user };
      renderGate("confirm");
    });
  } catch (e) {
    _justSignedUp = false;
    gateSetLoading(false);
    showError("Something went wrong. Please try again.");
  }
}

function cognitoLogin(email, password) {
  try {
    var cogUser = new CognitoUser({ Username: email, Pool: _cogPool });
    var details = new AuthenticationDetails({ Username: email, Password: password });
    cogUser.authenticateUser(details, {
      onSuccess: function (session) {
        _cogUser = cogUser;
        handleAuthUser(wrapCogUser(cogUser, session));
        _gateDraft.email = ""; _gateDraft.pw = "";
      },
      onFailure: function (err) {
        _justSignedUp = false;
        gateSetLoading(false);
        var code = (err && (err.code || err.name)) || "";
        if (code === "UserNotConfirmedException") {
          /* Password verified, email code not yet entered — back to the
             code screen. No stored password here (fresh page load), so
             after confirming, the user returns to Login with a success
             note instead of being logged in silently. */
          _pendingConfirm = { email: email, password: null, user: cogUser };
          renderGate("confirm");
          setTimeout(function () {
            showError("Your email isn't verified yet — enter the code we emailed you.");
          }, 0);
          return;
        }
        showError(friendlyError(err));
      },
      newPasswordRequired: function () {
        gateSetLoading(false);
        showError("This account needs a password reset first — use Forgot password below.");
      }
    });
  } catch (e) {
    _justSignedUp = false;
    gateSetLoading(false);
    showError("Something went wrong. Please try again.");
  }
}

/* ── Welcome screen — "Get Started for Free": Leafboard-style arch (starry
   navy dome, brand badge sitting on the curve, tagline, gradient pill CTA).
   First thing an unauthenticated visitor sees. ─────────────────────────── */

function renderWelcomeGate() {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) existing.remove();

  var ARROW_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  try { var pre = new Image(); pre.src = "./assets/icons/logo-512.png"; } catch {}

  var STAR_PTS = [
    [18,62,1.3,.75],[52,30,.9,.45],[88,96,1.5,.85],[122,46,1,.55],[150,124,1.2,.65],
    [186,64,.9,.4],[216,26,1.4,.8],[248,106,1.1,.6],[280,54,1.6,.9],[312,132,1,.5],
    [346,40,1.3,.7],[378,96,1,.55],[32,152,1.2,.6],[70,206,1.5,.8],[106,166,.9,.45],
    [140,242,1.3,.7],[176,192,1,.5],[230,236,1.4,.75],[266,176,1.1,.6],[300,256,1.2,.65],
    [336,200,1,.5],[370,266,1.3,.7],[46,276,1.1,.6],[116,316,1.4,.75],[206,302,1,.5],
    [290,332,1.2,.65],[356,352,1.1,.55],[26,362,1.3,.7],[64,118,.8,.4],[198,150,.9,.45],
    [326,90,.9,.5],[252,60,.8,.4]
  ];
  var stars = STAR_PTS.map(function (p) {
    return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="#fff" opacity="' + p[3] + '"/>';
  }).join("");

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;color:#111827;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<main class="lt-auth-welcome">' +
      '<div class="lt-auth-herowrap">' +
        '<div class="lt-auth-hero">' +
          '<svg class="lt-auth-stars" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + stars + '</svg>' +
        '</div>' +
        '<div class="lt-auth-badge"><img class="lt-auth-badge-logo" src="./assets/icons/logo-512.png" alt="Minutics logo"></div>' +
      '</div>' +
      '<div class="lt-auth-wtext">' +
        (DEMO_MODE ? '<span class="lt-auth-earlyaccess">This Is An Early Access Demo</span>' : '') +
        '<h1 class="lt-auth-wtitle">Minutics</h1>' +
        '<p class="lt-auth-wsub">Turn your time into minutes you can actually see — then point them at what matters.</p>' +
      '</div>' +
      '<div class="lt-auth-wfoot">' +
        '<button type="button" class="lt-auth-wcta" id="lt-auth-get-started">Get Started for Free ' + ARROW_ICON + '</button>' +
        '<p class="lt-auth-wlogin">Already have an account? <a id="lt-auth-wlogin-link">Log in</a></p>' +
      '</div>' +
    '</main>';
  document.body.appendChild(gate);

  document.getElementById("lt-auth-get-started").addEventListener("click", function () {
    renderGate("signup");
  });
  document.getElementById("lt-auth-wlogin-link").addEventListener("click", function () {
    renderGate("login");
  });
}

/* ── Forgot password — step 1: collect the email; Cognito emails a 6-digit
   reset code. Step 2 (renderForgotCodeGate): enter the code + a new
   password. Same screens as before, engine now Cognito. ─────────────── */
function renderForgotGate() {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) {
    existing.style.opacity = "1";
    existing.style.visibility = "visible";
    existing.remove();
  }

  // Clean up any Pro badge or enhancement visuals that might be lingering
  cleanupEnhancementVisuals();

  var MAIL_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var BACK_ICON = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  // Ensure the gate is fully opaque immediately to prevent any flash of underlying content
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:hsl(230 40% 16%);color:#111827;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-darkbg" aria-hidden="true"></div>' +
    '<main class="lt-auth-scr">' +
      '<button type="button" class="lt-auth-back" id="lt-forgot-back-link" aria-label="Back to login">' + BACK_ICON + '</button>' +
      '<h1 class="lt-auth-h1">Reset your password</h1>' +
      '<p class="lt-auth-sub2">Enter your email and we\u2019ll send you a 6-digit code</p>' +
      '<section class="lt-auth-card">' +
        '<div class="lt-auth-error" id="lt-auth-error"></div>' +
        '<form id="lt-forgot-form" novalidate>' +
          '<div class="lt-auth-field">' + MAIL_ICON +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-forgot-email">Email Address</label>' +
              '<input type="email" id="lt-forgot-email" placeholder="you@example.com" autocomplete="email" required>' +
            '</div>' +
          '</div>' +
          '<button class="lt-auth-submit" type="submit" id="lt-forgot-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-forgot-submit-label">Send code</span>' +
          '</button>' +
        '</form>' +
      '</section>' +
    '</main>';
  document.body.appendChild(gate);

  document.getElementById("lt-forgot-back-link").addEventListener("click", function () {
    renderGate("login");
  });

  var form = document.getElementById("lt-forgot-form");
  var submitBtn = document.getElementById("lt-forgot-submit");
  var submitLabel = document.getElementById("lt-forgot-submit-label");

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("lt-auth-loading", loading);
    submitLabel.textContent = loading ? "Sending..." : "Send code";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("lt-forgot-email").value.trim();
    hideError();
    if (!email) { showError("Enter your email first."); return; }
    setLoading(true);

    try {
      var cogUser = new CognitoUser({ Username: email, Pool: _cogPool });
      var toCodeStep = function () {
        setLoading(false);
        renderForgotCodeGate(email, cogUser);
      };
      cogUser.forgotPassword({
        onSuccess: toCodeStep,
        inputVerificationCode: toCodeStep, /* some SDK versions land here */
        onFailure: function (err) {
          setLoading(false);
          var code = (err && (err.code || err.name)) || "";
          var msg = (err && err.message) || "";
          if (code === "LimitExceededException" || code === "TooManyRequestsException") {
            showError(friendlyError(err));
            return;
          }
          if (code === "InvalidParameterException" && msg.indexOf("no registered/verified") !== -1) {
            /* Unconfirmed account: Cognito refuses a password reset until
               the email is verified. The register flow already discloses
               pending accounts, so an honest, actionable hint is
               consistent — and much better than a dead generic message. */
            showError("That email is signed up but not verified yet — check your inbox for the verification code, or register again to get a new one.");
            return;
          }
          /* Never confirm/deny that an email is registered — the same
             generic answer as the old flow. */
          showError("If an account exists for that email, a reset code is on its way. Check your inbox (and spam folder).", true);
        }
      });
    } catch (err) {
      setLoading(false);
      showError("Network error — check your connection and try again.");
    }
  });
}

/* ── Forgot password — step 2: the emailed code + the new password ──── */
function renderForgotCodeGate(email, cogUser) {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) existing.remove();
  cleanupEnhancementVisuals();

  var LOCK_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var BACK_ICON = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:hsl(230 40% 16%);color:#111827;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-darkbg" aria-hidden="true"></div>' +
    '<main class="lt-auth-scr">' +
      '<button type="button" class="lt-auth-back" id="lt-forgot-back-link" aria-label="Back to login">' + BACK_ICON + '</button>' +
      '<h1 class="lt-auth-h1">Enter your reset code</h1>' +
      '<p class="lt-auth-sub2">We emailed a 6-digit code to ' + String(email).replace(/[<>&]/g, "") + '</p>' +
      '<section class="lt-auth-card">' +
        '<div class="lt-auth-error" id="lt-auth-error"></div>' +
        '<form id="lt-forgot-code-form" novalidate>' +
          '<div class="lt-auth-field">' +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-forgot-code">Verification code</label>' +
              '<input type="text" inputmode="numeric" id="lt-forgot-code" placeholder="123456" autocomplete="one-time-code" required>' +
            '</div>' +
          '</div>' +
          '<div class="lt-auth-field">' + LOCK_ICON +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-forgot-newpw">New password</label>' +
              '<input type="password" id="lt-forgot-newpw" placeholder="8+ chars, A-z, 0-9" autocomplete="new-password" required>' +
            '</div>' +
          '</div>' +
          '<p class="lt-auth-hint">Password must be 8+ characters with an uppercase letter, a lowercase letter and a number</p>' +
          '<button class="lt-auth-submit" type="submit" id="lt-forgot-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-forgot-submit-label">Reset password</span>' +
          '</button>' +
        '</form>' +
        '<div class="lt-auth-frow"><button type="button" class="lt-auth-forgot" id="lt-forgot-resend">Resend code</button></div>' +
      '</section>' +
    '</main>';
  document.body.appendChild(gate);

  document.getElementById("lt-forgot-back-link").addEventListener("click", function () {
    renderGate("login");
  });

  var submitBtn = document.getElementById("lt-forgot-submit");
  var submitLabel = document.getElementById("lt-forgot-submit-label");
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("lt-auth-loading", loading);
    submitLabel.textContent = loading ? "Resetting..." : "Reset password";
  }

  document.getElementById("lt-forgot-resend").addEventListener("click", function () {
    try {
      cogUser.forgotPassword({
        onSuccess: function () { showError("A new code is on its way.", true); },
        inputVerificationCode: function () { showError("A new code is on its way.", true); },
        onFailure: function (err) { showError(friendlyError(err)); }
      });
    } catch (e) { showError("Network error — check your connection and try again."); }
  });

  document.getElementById("lt-forgot-code-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = document.getElementById("lt-forgot-code").value.trim();
    var newPw = document.getElementById("lt-forgot-newpw").value;
    hideError();
    if (!code) { showError("Enter the code from your email."); return; }
    if (!ltPasswordLooksStrong(newPw)) {
      showError("Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.");
      return;
    }
    setLoading(true);
    try {
      cogUser.confirmPassword(code, newPw, {
        onSuccess: function () {
          setLoading(false);
          renderGate("login");
          setTimeout(function () {
            showError("Password reset — log in with your new password.", true);
          }, 0);
        },
        onFailure: function (err) {
          setLoading(false);
          showError(friendlyError(err));
        }
      });
    } catch (err) {
      setLoading(false);
      showError("Network error — check your connection and try again.");
    }
  });
}

/* ── Email verification (register step 2): Cognito signs the account up
   in a "waiting for code" state; the emailed 6-digit code confirms it.
   When we came straight from Sign up the password is still in memory and
   the confirm logs the user straight in; when it isn't (page reload /
   login hit UserNotConfirmedException), the user returns to Login. ──── */
function renderConfirmGate() {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) existing.remove();
  cleanupEnhancementVisuals();

  var p = _pendingConfirm || {};
  var email = p.email || "";

  var MAIL_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var BACK_ICON = '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:hsl(230 40% 16%);color:#111827;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-darkbg" aria-hidden="true"></div>' +
    '<main class="lt-auth-scr">' +
      '<button type="button" class="lt-auth-back" id="lt-confirm-back-btn" aria-label="Back">' + BACK_ICON + '</button>' +
      '<h1 class="lt-auth-h1">Verify your email</h1>' +
      '<p class="lt-auth-sub2">Enter the 6-digit code we sent to ' + String(email).replace(/[<>&]/g, "") + '</p>' +
      '<section class="lt-auth-card">' +
        '<div class="lt-auth-error" id="lt-auth-error"></div>' +
        '<form id="lt-confirm-form" novalidate>' +
          '<div class="lt-auth-field">' + MAIL_ICON +
            '<div class="lt-auth-fbody">' +
              '<label class="lt-auth-flabel" for="lt-confirm-code">Verification code</label>' +
              '<input type="text" inputmode="numeric" id="lt-confirm-code" placeholder="123456" autocomplete="one-time-code" required>' +
            '</div>' +
          '</div>' +
          '<button class="lt-auth-submit" type="submit" id="lt-confirm-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-confirm-submit-label">Verify email</span>' +
          '</button>' +
        '</form>' +
        '<div class="lt-auth-frow"><button type="button" class="lt-auth-forgot" id="lt-confirm-resend">Resend code</button></div>' +
      '</section>' +
    '</main>';
  document.body.appendChild(gate);

  document.getElementById("lt-confirm-back-btn").addEventListener("click", function () {
    renderGate("login");
  });

  var submitBtn = document.getElementById("lt-confirm-submit");
  var submitLabel = document.getElementById("lt-confirm-submit-label");
  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("lt-auth-loading", loading);
    submitLabel.textContent = loading ? "Verifying..." : "Verify email";
  }

  function cogUserForConfirm() {
    if (_pendingConfirm && _pendingConfirm.user) return _pendingConfirm.user;
    return new CognitoUser({ Username: email, Pool: _cogPool });
  }

  document.getElementById("lt-confirm-resend").addEventListener("click", function () {
    try {
      /* resendConfirmationCode uses a node-style (err, result) callback —
         NOT the { onSuccess, onFailure } map the other SDK calls take. */
      cogUserForConfirm().resendConfirmationCode(function (err) {
        if (err) { showError(friendlyError(err)); return; }
        showError("A new code is on its way. Check your inbox.", true);
      });
    } catch (e) { showError("Network error — check your connection and try again."); }
  });

  document.getElementById("lt-confirm-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var code = document.getElementById("lt-confirm-code").value.trim();
    hideError();
    if (!code) { showError("Enter the code from your email."); return; }
    setLoading(true);
    try {
      cogUserForConfirm().confirmRegistration(code, true, function (err) {
        if (err) {
          setLoading(false);
          showError(friendlyError(err));
          return;
        }
        var pw = _pendingConfirm && _pendingConfirm.password;
        if (pw) {
          /* Straight from Sign up — the password is right here: log the
             fresh account in immediately, exactly like Firebase's
             createUserWithEmailAndPassword used to. */
          cognitoLogin(email, pw);
          return;
        }
        renderGate("login");
        setTimeout(function () {
          showError("Email verified — log in to continue.", true);
        }, 0);
      });
    } catch (err) {
      setLoading(false);
      showError("Network error — check your connection and try again.");
    }
  });
}

function showError(msg, isSuccess) {
  var el = document.getElementById("lt-auth-error");
  if (!el) return;
  el.classList.remove("lt-auth-shown");
  el.textContent = msg;
  el.classList.toggle("lt-success", !!isSuccess);
  void el.offsetWidth; /* restart the shake animation on repeat errors */
  el.classList.add("lt-auth-shown");
}
function hideError() {
  var el = document.getElementById("lt-auth-error");
  if (el) el.classList.remove("lt-auth-shown");
}

function friendlyError(err) {
  /* Cognito errors carry the exception name in .code (sometimes .name). */
  var code = (err && (err.code || err.name)) || "";
  var msg = (err && err.message) || "";
  if (code === "UsernameExistsException") return "That email already has an account — try logging in instead.";
  if (code === "InvalidPasswordException") {
    if (/8|character|uppercase|lowercase|number/i.test(msg)) {
      return "Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.";
    }
    return msg || "That password doesn't meet the requirements.";
  }
  if (code === "InvalidParameterException" || code === "InvalidEmailAddressException") {
    if (/password/i.test(msg)) return "Password must be 8+ characters with an uppercase letter, a lowercase letter and a number.";
    return "That email address doesn't look right.";
  }
  if (code === "UserNotConfirmedException") return "Your email isn't verified yet — check your inbox for the verification code.";
  if (code === "CodeMismatchException") return "That code didn't match — check your email and try again.";
  if (code === "ExpiredCodeException") return "That code expired — request a new one.";
  if (code === "UserNotFoundException" || code === "NotAuthorizedException") return "Incorrect email or password.";
  if (code === "PasswordResetRequiredException") return "This account needs a password reset first — use Forgot password.";
  if (code === "LimitExceededException" || code === "TooManyRequestsException" || code === "TooManyFailedAttemptsException") {
    return "Too many attempts — please wait a moment and try again.";
  }
  if (/failed to fetch|networkerror|network request/i.test(msg)) return "Network error — check your connection.";
  return "Something went wrong. Please try again.";
}

/* ── Clean up any enhancement visuals that might be lingering ───────────── */
function cleanupEnhancementVisuals() {
  // Remove any Pro badges or enhancement-related DOM elements
  var elementsToRemove = [
    "lt-activity-limit",
    "lt-telegram-gate-overlay", 
    "lt-telegram-gate-badge",
    "lt-upgrade-modal"
  ];
  
  elementsToRemove.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  
  // Remove any dimmed attributes
  var dimmed = document.querySelectorAll("[data-lt-telegram-dimmed]");
  for (var d = 0; d < dimmed.length; d++) {
    dimmed[d].style.opacity = "";
    dimmed[d].style.filter = "";
    dimmed[d].style.pointerEvents = "";
    dimmed[d].removeAttribute("data-lt-telegram-dimmed");
  }
}

/* Transient IndexedDB failures on a refresh ("Data base is closing/hidden")
   surface as unhandled rejections out of Firebase's internal storage
   retries. They recover on the next read — log them as warnings instead of
   letting them hit the console as red errors. */
window.addEventListener("unhandledrejection", function (e) {
  var msg = "";
  try { msg = String((e && e.reason && (e.reason.message || e.reason)) || ""); } catch (err) {}
  if (/(base|database) is closing|closing\/hidden|database is blocked|aborterror/i.test(msg)) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    console.warn("AUTH STORAGE (transient):", msg);
  }
});

/* First response to a broken storage read: reload the page exactly once per
   tab. The session lives in IndexedDB; when that read bounces ("Data base
   is closing/hidden") Firebase either falls through to an empty store (null
   user) or never calls back at all — and a plain second refresh always
   fixed it. Automate that second refresh; only after it also fails do we
   show the login gate (still never bypassing auth). */
function _authTryRecover(reason) {
  if (_logoutInProgress) return false;   /* a real sign-out is ending here */
  if (!getMarker()) return false;        /* nobody was signed in on this device */
  try { if (sessionStorage.getItem("lt_auth_recovered")) return false; } catch (e) {}
  try { sessionStorage.setItem("lt_auth_recovered", "1"); } catch (e) {}
  console.warn("AUTH SAFETY: " + reason + " — reloading once to recover storage (marker " + getMarker() + ")");
  setTimeout(function () { try { location.reload(); } catch (e) {} }, 250);
  return true;
}

/* ── Safety: if IndexedDB crashes and onAuthStateChanged never fires,
   first try the one-shot storage-reload above; otherwise re-render a
   working login gate after 10s so the user isn't stuck on a grey screen
   with no way in. NEVER bypasses auth. Only fires when Firebase never
   responded. If the tab is hidden at that moment (bfcached / prerendered
   pages delay storage reads), wait until it is visible before giving up —
   Firebase usually resolves right after. ────────────────────────────────── */
var _authStateChangedFired = false;
function _authSafetyFire() {
  if (_authStateChangedFired) return;
  if (_authTryRecover("Firebase never responded")) return;
  console.warn("AUTH SAFETY: Firebase never responded — re-rendering login gate (never bypassing auth)");
  document.body.classList.remove("lt-authed");
  renderGate("welcome");
}
setTimeout(function () {
  if (_authStateChangedFired) return;
  if (document.visibilityState === "hidden") {
    var onVis = function () {
      if (document.visibilityState !== "hidden") {
        document.removeEventListener("visibilitychange", onVis);
        setTimeout(_authSafetyFire, 4000); /* give Firebase a beat once visible */
      }
    };
    document.addEventListener("visibilitychange", onVis);
    setTimeout(_authSafetyFire, 16000); /* absolute cap */
  } else {
    _authSafetyFire();
  }
}, 10000);

/* Pages restored from the back-forward cache can come back with a closed
   IndexedDB connection ("Database is closing/hidden"). If auth never
   resolved on such a restore, do a clean reload instead of showing a
   broken gate. */
window.addEventListener("pageshow", function (e) {
  if (e.persisted && !_authStateChangedFired) {
    try { location.reload(); } catch (err) {}
  }
});

/* Show a neutral opaque splash immediately so a Firebase/IndexedDB crash
   can never leave a blank grey screen — and so a signed-in user never
   flashes the LOGIN FORM on load. The real login form is only rendered
   once onAuthStateChanged confirms there is no session. */
(function renderStartupSplash() {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) existing.remove();
  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;";
  /* Never a dead white rectangle: show a spinner while auth resolves. */
  var spin = document.createElement("div");
  spin.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#6b7280;font-family:Inter,sans-serif;font-size:13px;font-weight:600;";
  spin.innerHTML = '<div style="width:36px;height:36px;border-radius:50%;border:3px solid rgba(26,33,64,.14);border-top-color:#1a2140;animation:lt-auth-spin .8s linear infinite;"></div><span>Loading\u2026</span>';
  gate.appendChild(spin);
  document.body.appendChild(gate);
})();

/* Firebase can hang forever (offline, blocked network, IndexedDB crash).
   The opaque startup gate would then sit there as a permanent white screen.
   After 7s with no auth answer: a device that signed in before enters the
   app with its local data; a brand-new device gets the login gate. */
setTimeout(function () {
  if (_authStateChangedFired) return;
  try {
    /* An active demo is its own fallback — resume it (or wipe it if
       the 30 minutes already ran out) regardless of Firebase state. */
    if (DEMO_MODE && isDemoActive()) {
      if (demoTimeRemainingMs() > 0) enterDemo(false);
      else endDemoSession();
      return;
    }
    var lastUid = localStorage.getItem("lt_last_uid");
    if (lastUid) {
      document.body.classList.add("lt-authed");
      var g = document.getElementById("lt-auth-gate");
      if (g) g.remove();
      var s = document.getElementById("lt-startup-splash");
      if (s && s.parentNode) s.parentNode.removeChild(s);
      var rootEl = document.getElementById("root");
      if (rootEl) rootEl.removeAttribute("style");
    } else {
      renderGate("welcome");
    }
  } catch (e) {}
}, 7000);

/* ── Auth state funnel: gate blocks the app until signed in ─────────────
   Firebase used to deliver this as onAuthStateChanged; Cognito has no
   listener, so the state machine is ours. EVERY path — boot restore
   (bootstrapAuth), login (cognitoLogin), signup-confirm auto-login,
   LTAuth.logout, the single-device kick — feeds handleAuthUser(), and
   the body below is the unchanged downstream logic (demo, storage
   namespacing, gate, route landing). */
function handleAuthUser(user) {
  _authStateChangedFired = true;
  console.log("AUTH STATE CHANGED:", user ? "AUTHENTICATED" : "NOT AUTHENTICATED", user);
  /* Active Early Access Demo wins over "signed out": resume it, or wipe
     it in full when the 30 minutes already ran out. Must run before the
     null-branch storage recovery below (a demo sets lt_active_uid, which
     would otherwise trigger a pointless reload loop). */
  if (!user && DEMO_MODE && isDemoActive()) {
    if (demoTimeRemainingMs() > 0) enterDemo(false);
    else endDemoSession();
    return;
  }
  /* A real sign-in always beats a demo session — wipe the demo first so
     none of its data can be swept into the real account's namespace. */
  if (user && isDemoActive()) killDemoForRealAuth();
  var gate = document.getElementById("lt-auth-gate");
  var storageChanged = false;
  if (user) {
    console.log("Removing auth gate and adding lt-authed class");
    _logoutInProgress = false;
    /* Surface the authenticated UI FIRST — no storage/session side effect
       below may ever strand the user on the opaque gate (white screen). */
    document.body.classList.add("lt-authed");
    try { localStorage.setItem("lt_last_uid", user.uid); } catch (e) {}
    /* Hard safety: whatever throws below, the gate and splash come off. */
    setTimeout(function () {
      try {
        /* Only if this same user is still the active session — a sign-out
           inside the window must win over the safety net. */
        if (_prevAuthState !== user || _logoutInProgress) return;
        document.body.classList.add("lt-authed");
        var g = document.getElementById("lt-auth-gate");
        if (g) g.remove();
        /* The startup splash keeps its own lifecycle (see enterDemo) —
           never cut it short here. */
        var r = document.getElementById("root");
        if (r) r.removeAttribute("style");
      } catch (e) {}
    }, 2500);
    /* Swap per-account storage BEFORE any UI reads it. */
    try { storageChanged = reconcileStorage(user); } catch (e) { storageChanged = false; }
    /* Early Access Demo has been removed (DEMO_MODE=false): a browser
       that ever ran a demo now gets a free Lifetime plan on any real
       sign-in. Demo data itself is never imported — wipeDemoData already
       removed it; only the lt_early_access_demo_v1 flag (not user data)
       survived, and it is cleaned up here too. */
    if (!DEMO_MODE && hasDemoHistory()) {
      try {
        if (window.LTPlan && window.LTPlan.setPlan) window.LTPlan.setPlan("lifetime");
        else {
          localStorage.setItem("lt_plan_v1", JSON.stringify("lifetime"));
          localStorage.setItem("lt_plan_since_v1", JSON.stringify(Date.now()));
        }
        try { localStorage.removeItem(DEMO_SESSION_KEY); } catch (e) {}
        try { localStorage.removeItem(DEMO_RENEW_KEY); } catch (e) {}
        try { localStorage.removeItem(nsKey(DEMO_UID)); } catch (e) {}
        storageChanged = true;
      } catch (e) {}
    }
    _lastSeenUid = user.uid;
    var genuineLogin = _prevAuthState === null;
    _prevAuthState = user;
    if (storageChanged) { try { announceUserChanged(); } catch (e) {} }
    /* Single-device session: an explicit login/register claims this device;
       the watch kicks us out the moment another device takes the claim. */
    if (genuineLogin) {
      try { claimSessionNow(); } catch (e) {}
      /* The background-alert grant belongs to this moment: login/register is
         when the user is paying attention, and without POST_NOTIFICATIONS
         every closed-app notification dies silently. */
      maybeAskNotificationPermission();
    }
    try { startSessionWatch(); } catch (e) {}
    /* A genuine sign-in transition (the login gate was actually on screen
       a moment ago) must land on the Timer home screen — the router's URL
       was left wherever it was when the user logged out. On a normal page
       load where Firebase silently restores a session, _prevAuthState is
       undefined (not null), so we leave the loaded route alone (a refresh
       on Settings correctly stays on Settings). App uses HashRouter, so
       the live route lives in location.hash, not pathname. */
    var hasRoute = location.pathname !== "/" ||
      (location.hash && location.hash !== "#/" && location.hash !== "#");
    if (genuineLogin && hasRoute) {
      history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    document.body.classList.add("lt-authed");
    _gateDraft.email = ""; _gateDraft.pw = "";
    /* Clear ALL inline styles that logout sets on #root (including !important) */
    var root = document.getElementById("root");
    if (root) root.removeAttribute("style");
    /* Keep the opaque auth gate in place until the authenticated UI has
       painted. Removing it first caused a brief white frame after sign-up.
       If storage was just swapped for another account, wait until React
       confirms the remount (lt-user-changed-applied) so stale UI never
       flashes between gate removal and the remount commit. */
    var dropGate = function () {
      hideBootSplash();
      var g = document.getElementById("lt-auth-gate");
      if (!g) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { g.remove(); });
      });
      /* If the splash video never started playing, the branded fallback
         animation has served its purpose — release it so the app shows. */
      if (!window.__ltSplashPlaying && window.__ltSplashDismiss) {
        window.__ltSplashDismiss();
      }
    };
    if (storageChanged) {
      var applied = false;
      var onApplied = function () {
        if (applied) return;
        applied = true;
        window.removeEventListener("lt-user-changed-applied", onApplied);
        dropGate();
      };
      window.addEventListener("lt-user-changed-applied", onApplied);
      setTimeout(onApplied, 1500); /* safety: never leave the gate stuck */
    } else {
      dropGate();
    }
  } else {
    console.log("Removing lt-authed class and rendering login gate");
    /* A null user while our active-account marker is still set — and no
       real sign-out is in flight — is the transient IndexedDB failure
       mode, not a genuine sign-out (genuine sign-outs flag
       _logoutInProgress; completed ones already cleared the marker).
       Reload once instead of dumping a signed-in user on the login
       screen. MUST run before reconcileStorage(null), which clears the
       marker. */
    if (_authTryRecover("got a null user while still signed in")) return;
    /* Genuine sign-out: drop the offline-recovery marker so the 7s
       fallback can't pull a signed-out user back into the app. */
    try { localStorage.removeItem("lt_last_uid"); } catch (e) {}
    /* Park the outgoing account's data under its uid and wipe the live
       keys so the next account (or a fresh signup) starts clean. */
    storageChanged = reconcileStorage(null);
    _prevAuthState = null;
    stopSessionWatch();
    if (storageChanged) announceUserChanged();
    document.body.classList.remove("lt-authed");

    // Clean up any enhancement visuals before showing login gate to prevent flash
    cleanupEnhancementVisuals();

    renderGate("welcome");
  }
}

/* The explicit sign-out paths (LTAuth.logout, single-device kick) have no
   Cognito event to wait for — they call the null funnel directly. */
function notifySignedOut() { handleAuthUser(null); }

/* ── Boot: restore a Cognito session if one exists on this device ──────
   getSession() transparently refreshes expired tokens with the refresh
   token (valid 365 days), so a user who keeps their account stays signed
   in across launches for up to a whole year. No session / revoked
   refresh / unreadable storage is simply "not signed in" → the gate. */
function bootstrapAuth() {
  try {
    var cu = _cogPool.getCurrentUser();
    if (!cu) { handleAuthUser(null); return; }
    cu.getSession(function (err, session) {
      /* Any error here (no cached session, refresh revoked, pool
         unreachable with nothing cached) reads as signed out — never as
         a bypass. */
      if (err || !session) { handleAuthUser(null); return; }
      _cogUser = cu;
      handleAuthUser(wrapCogUser(cu, session));
    });
  } catch (e) { handleAuthUser(null); }
}
bootstrapAuth();

