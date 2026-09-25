/* ══════════════════════════════════════════════════════════════════════════
   Lifetime — Firebase Authentication Gate
   Email/password sign-up & login only. No user data is stored in Firebase —
   auth is identity-only. All app data (activities, budget, tasks, etc.)
   stays exactly where it already lived: on this device.
══════════════════════════════════════════════════════════════════════════ */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBXruwmDU9SAX4nAe5_Do-x-5qmi_SFh7E",
  authDomain: "lifetime-a4bde.firebaseapp.com",
  projectId: "lifetime-a4bde",
  storageBucket: "lifetime-a4bde.firebasestorage.app",
  messagingSenderId: "330723236770",
  appId: "1:330723236770:web:7df53f2dba32fe87b0f0fb",
  measurementId: "G-L9CHDHYXNN",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ── Per-account localStorage namespaces ─────────────────────────────────
   Every Firebase UID owns a private slice of localStorage. On logout /
   account switch the current app keys are snapshotted into lt_ns_<uid>
   and wiped; on login the target uid's snapshot is restored. A brand-new
   account finds no snapshot → completely fresh database → onboarding. */
var ACTIVE_UID_KEY = "lt_active_uid";
var _lastSeenUid = null;
var _justSignedUp = false;
var _prevAuthState; /* undefined | null | user — genuine-login detection */

function nsKey(uid) { return "lt_ns_" + uid; }
function isReservedKey(k) {
  return k === ACTIVE_UID_KEY || k.indexOf("lt_ns_") === 0 || k.indexOf("firebase:") === 0;
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

/* Expose logout for the Settings-page "Log out" row (added in lifetime-enhancements.js) */
window.LTAuth = {
  logout: function () {
    /* IMPORTANT: do NOT clear localStorage here. */
    
    // Clean up any enhancement visuals before logout to prevent flash
    cleanupEnhancementVisuals();
    
    // Force #root invisible during logout so old UI can't flash.
    // Do NOT clear innerHTML — that breaks React's virtual DOM and the
    // nav bar disappears on re-login.
    var root = document.getElementById("root");
    if (root) root.style.cssText = "display:none!important";
    
    signOut(auth).catch(function () {});
  },
  currentUser: function () {
    return auth.currentUser;
  },
  getToken: function (force) {
    var user = auth.currentUser;
    if (!user) return Promise.resolve(null);
    /* force=true bypasses the 1-hour token cache — needed to read fresh
       custom claims (the report scheduler's heartbeat / last-sent state). */
    return force ? user.getIdToken(true) : user.getIdToken();
  },
};

/* ── Styles — matches the supplied Login/Register mock exactly: cream +
   amber illustration header, white rounded-t-3xl sheet, Geist font ──────── */
function injectStyles() {
  if (document.getElementById("lt-auth-styles")) return;

  var fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap";
  document.head.appendChild(fontLink);

  var style = document.createElement("style");
  style.id = "lt-auth-styles";
  style.textContent = `
    #lt-auth-gate {
      position: fixed; inset: 0; z-index: 999999;
      background: #Fdfbf7; color: #111827;
      display: flex; flex-direction: column; justify-content: flex-end;
      overflow: hidden;
      font-family: 'Geist', -apple-system, sans-serif;
      /* NOTE: no opacity animation on this element itself. It has to be
         100% opaque from the very first painted frame -- whatever screen
         was on-screen a moment ago (an authenticated Settings page, a
         stale "Pro" badge, etc.) is still mounted behind this overlay for
         a beat, and animating THIS element's opacity made that stale
         screen bleed through as a visible flash during the fade. Only the
         children fade now; the opaque background never does. */
    }
    #lt-auth-gate * { box-sizing: border-box; }
    #lt-auth-gate > * { animation: lt-auth-fade .35s ease; }
    @keyframes lt-auth-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes lt-auth-shake {
      10%, 90% { transform: translateX(-1px); }
      20%, 80% { transform: translateX(2px); }
      30%, 50%, 70% { transform: translateX(-4px); }
      40%, 60% { transform: translateX(4px); }
    }
    .lt-auth-blob {
      position: absolute; top: 0; left: 0; width: 100%; height: 60%;
      background: #fef3c7; border-radius: 0 0 50% 50%;
      transform: scale(1.5) translateY(-20%); z-index: -1;
    }
    .lt-auth-hero {
      flex: 1; display: flex; align-items: center; justify-content: center;
      padding: 40px 24px 32px; background: #FFFBEB; min-height: 0;
    }
    .lt-auth-hero img {
      width: 100%; max-width: 280px; object-fit: contain;
      animation: lt-auth-fade .5s ease;
    }
    .lt-auth-card {
      background: #ffffff; border-radius: 24px 24px 0 0;
      box-shadow: 0 -10px 40px -15px rgba(0,0,0,.1);
      padding: 32px 24px 48px; z-index: 10;
      width: 100%; max-width: 420px; margin: 0 auto;
      max-height: 65vh; overflow-y: auto;
      display: flex; flex-direction: column;
    }
    .lt-auth-head { text-align: center; margin-bottom: 32px; }
    .lt-auth-title { font-size: 24px; font-weight: 600; color: #111827; margin: 0; }
    .lt-auth-sub { font-size: 14px; color: #6B7280; margin: 4px 0 0; }
    #lt-auth-form { flex: 1; display: flex; flex-direction: column; gap: 16px; }
    .lt-auth-field { position: relative; }
    .lt-auth-field-icon {
      position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
      width: 20px; height: 20px; color: #6B7280; pointer-events: none;
    }
    .lt-auth-field input {
      width: 100%; padding: 14px 12px 14px 44px;
      border: 1px solid #D1D5DB; border-radius: 12px;
      color: #111827; background: #fff; font-size: 15px; outline: none;
      font-family: 'Geist', sans-serif; transition: border-color .15s, box-shadow .15s;
    }
    .lt-auth-field input::placeholder { color: #9CA3AF; }
    .lt-auth-field input:focus {
      border-color: #4F46E5; box-shadow: 0 0 0 2px rgba(79,70,229,.35);
    }
    .lt-auth-field input.lt-auth-invalid { border-color: #dc2626; }
    .lt-auth-field input.lt-auth-has-toggle { padding-right: 44px; }
    .lt-auth-pw-toggle {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      background: none; border: none; padding: 0; cursor: pointer; color: #6B7280;
      -webkit-tap-highlight-color: transparent;
    }
    .lt-auth-pw-toggle svg { width: 20px; height: 20px; }
    .lt-auth-forgot { text-align: right; margin-top: 8px; }
    .lt-auth-forgot a {
      font-size: 13px; font-weight: 600; color: #4F46E5; cursor: pointer; text-underline-offset: 2px;
    }
    .lt-auth-forgot a:hover { text-decoration: underline; }
    .lt-auth-hint { margin-top: 8px; padding-left: 4px; font-size: 12px; color: #6B7280; }
    .lt-auth-hint.lt-auth-invalid { color: #dc2626; }
    .lt-auth-hint.lt-auth-valid { color: #16a34a; }
    .lt-auth-submit-wrap { padding-top: 8px; }
    .lt-auth-submit {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
      background: #111827; border: none; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.05);
      color: #fff; font-size: 16px; font-weight: 600; padding: 16px;
      cursor: pointer; font-family: 'Geist', sans-serif; transition: background .15s, opacity .15s;
    }
    .lt-auth-submit:hover:not(:disabled) { background: #000; }
    .lt-auth-submit:disabled { opacity: .6; cursor: default; }
    .lt-auth-spinner {
      width: 16px; height: 16px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      animation: lt-auth-spin .7s linear infinite; display: none;
    }
    .lt-auth-submit.lt-auth-loading .lt-auth-spinner { display: inline-block; }
    @keyframes lt-auth-spin { to { transform: rotate(360deg); } }
    .lt-auth-error {
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px;
      color: #DC2626; font-size: 13px; padding: 11px 14px; line-height: 1.5;
      display: none;
    }
    .lt-auth-error.lt-auth-shown { display: block; animation: lt-auth-shake .4s; }
    .lt-auth-error.lt-success { background: #F0FDF4; border-color: #BBF7D0; color: #16A34A; }
    .lt-auth-switch { margin-top: 24px; text-align: center; font-size: 14px; color: #4B5563; }
    .lt-auth-switch a {
      font-weight: 600; color: #111827; cursor: pointer; text-underline-offset: 2px;
    }
    .lt-auth-switch a:hover { color: #4F46E5; }
    .lt-auth-disclaimer {
      margin-top: 12px; font-size: 10px; line-height: 1.6; color: #6B7280;
    }
    .lt-auth-disclaimer b { font-weight: 600; color: #374151; }
  `;
  document.head.appendChild(style);
}

/* ── Render login/signup form ──────────────────────────────────────────── */
function renderGate(mode) {
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

  if (mode === "forgot") { renderForgotGate(); return; }

  var isSignup = mode === "signup";
  var MAIL_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var LOCK_ICON = '<svg class="lt-auth-field-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var EYE_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var EYE_OFF_ICON = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"></path></svg>';
  var heroSrc = isSignup ? "./assets/auth/create-account.png" : "./assets/auth/welcome-back.png";
  var heroAlt = isSignup ? "Create account illustration" : "Welcome back illustration";

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  // Ensure the gate is fully opaque immediately to prevent any flash of underlying content
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;color:#111827;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-blob"></div>' +
    '<div class="lt-auth-hero"><img src="' + heroSrc + '" alt="' + heroAlt + '" /></div>' +
    '<main class="lt-auth-card">' +
      '<div class="lt-auth-head">' +
        '<h1 class="lt-auth-title">' + (isSignup ? "Create Account" : "Welcome back") + '</h1>' +
        '<p class="lt-auth-sub">Log in to continue</p>' +
      '</div>' +
      '<div class="lt-auth-error" id="lt-auth-error"></div>' +
      '<form id="lt-auth-form" novalidate>' +
        '<div class="lt-auth-field">' + MAIL_ICON + '<input type="email" id="lt-auth-email" placeholder="Enter email" autocomplete="email" required></div>' +
        '<div>' +
          '<div class="lt-auth-field">' + LOCK_ICON + '<input type="password" id="lt-auth-password" class="lt-auth-has-toggle" placeholder="Enter password" autocomplete="' + (isSignup ? "new-password" : "current-password") + '" required>' +
            '<button type="button" class="lt-auth-pw-toggle" id="lt-auth-pw-toggle" aria-label="Show password">' + EYE_ICON + '</button>' +
          '</div>' +
          '<p class="lt-auth-hint" id="lt-auth-pw-hint">Password must be at least 6 characters</p>' +
          (isSignup ? "" : '<p class="lt-auth-forgot"><a id="lt-auth-forgot-link">Forgot password?</a></p>') +
        '</div>' +
        '<div class="lt-auth-submit-wrap">' +
          '<button class="lt-auth-submit" type="submit" id="lt-auth-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-auth-submit-label">' + (isSignup ? "Sign up" : "Login") + '</span>' +
          '</button>' +
        '</div>' +
      '</form>' +
      '<p class="lt-auth-switch">' +
        (isSignup ? "Already have an account? " + '<a id="lt-auth-switch-link">Log in</a>' : "Don't have an account? " + '<a id="lt-auth-switch-link">Sign up</a>') +
      '</p>' +
      '<p class="lt-auth-disclaimer"><b>Please note:</b> your data (activities, budget, tasks, journal) is saved only on this device — it never leaves your phone. If you log in on another device, you\u2019ll start fresh there; your data won\u2019t carry over. We don\u2019t store your data on our own servers because we respect your privacy.</p>' +
    '</main>';
  document.body.appendChild(gate);

  document.getElementById("lt-auth-switch-link").addEventListener("click", function () {
    renderGate(isSignup ? "login" : "signup");
  });

  var pwInput = document.getElementById("lt-auth-password");
  var pwToggle = document.getElementById("lt-auth-pw-toggle");
  pwToggle.addEventListener("click", function () {
    var showing = pwInput.type === "text";
    pwInput.type = showing ? "password" : "text";
    pwToggle.innerHTML = showing ? EYE_ICON : EYE_OFF_ICON;
    pwToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  var forgotLink = document.getElementById("lt-auth-forgot-link");
  if (forgotLink) {
    forgotLink.addEventListener("click", function () { renderGate("forgot"); });
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

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("lt-auth-email").value.trim();
    var password = pwInput.value;
    hideError();

    setLoading(true);

    if (isSignup) _justSignedUp = true;

    var action = isSignup
      ? createUserWithEmailAndPassword(auth, email, password)
      : signInWithEmailAndPassword(auth, email, password);

    action
      .catch(function (err) {
        _justSignedUp = false;
        showError(friendlyError(err));
        setLoading(false);
      });
    /* On success, onAuthStateChanged (below) removes the gate automatically */
  });
}

/* ── Forgot password screen — collects an email, then asks our own
   serverless endpoint (which sends the reset email through Brevo, not
   Firebase's default mailer) to email a reset link ─────────────────── */
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

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  // Ensure the gate is fully opaque immediately to prevent any flash of underlying content
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;color:#111827;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-blob"></div>' +
    '<div class="lt-auth-hero"><img src="./assets/auth/welcome-back.png" alt="Reset password illustration" /></div>' +
    '<main class="lt-auth-card">' +
      '<div class="lt-auth-head">' +
        '<h1 class="lt-auth-title">Reset password</h1>' +
        '<p class="lt-auth-sub">We\u2019ll email you a link to reset it</p>' +
      '</div>' +
      '<div class="lt-auth-error" id="lt-auth-error"></div>' +
      '<form id="lt-forgot-form" novalidate>' +
        '<div class="lt-auth-field">' + MAIL_ICON + '<input type="email" id="lt-forgot-email" placeholder="Enter email" autocomplete="email" required></div>' +
        '<div class="lt-auth-submit-wrap">' +
          '<button class="lt-auth-submit" type="submit" id="lt-forgot-submit">' +
            '<span class="lt-auth-spinner"></span>' +
            '<span id="lt-forgot-submit-label">Send reset link</span>' +
          '</button>' +
        '</div>' +
      '</form>' +
      '<p class="lt-auth-switch"><a id="lt-forgot-back-link">Back to login</a></p>' +
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
    submitLabel.textContent = loading ? "Sending..." : "Send reset link";
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("lt-forgot-email").value.trim();
    hideError();
    if (!email) { showError("Enter your email first."); return; }
    setLoading(true);

    /* Always use the full deployed URL so the request works from any
       context (Android WebView from file://, app.local, custom scheme, etc.) */
    fetch("https://app.minutics.com/api/send-reset-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        setLoading(false);
        /* Always show the same success message regardless of whether the
           account exists — never confirm/deny an email is registered. */
        showError("If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).", true);
      })
      .catch(function (err) {
        console.error("send-reset-email failed:", err);
        setLoading(false);
        showError("Network error — check your connection and try again.");
      });
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
  var code = (err && err.code) || "";
  if (code.indexOf("email-already-in-use") !== -1) return "That email already has an account — try logging in instead.";
  if (code.indexOf("invalid-email") !== -1) return "That email address doesn't look right.";
  if (code.indexOf("weak-password") !== -1) return "Password must be at least 6 characters.";
  if (code.indexOf("user-not-found") !== -1 || code.indexOf("invalid-credential") !== -1 || code.indexOf("wrong-password") !== -1) return "Incorrect email or password.";
  if (code.indexOf("too-many-requests") !== -1) return "Too many attempts — please wait a moment and try again.";
  if (code.indexOf("network-request-failed") !== -1) return "Network error — check your connection.";
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

/* ── Safety: if IndexedDB crashes and onAuthStateChanged never fires,
   re-render a working login gate after 8s so the user isn't stuck on a
   grey screen with no way in. NEVER bypasses auth. Only fires when
   Firebase never responded. ─────────────────────────────────────────── */
var _authStateChangedFired = false;
setTimeout(function () {
  if (!_authStateChangedFired) {
    console.warn("AUTH SAFETY: Firebase never responded — re-rendering login gate (never bypassing auth)");
    document.body.classList.remove("lt-authed");
    renderGate("login");
  }
}, 8000);

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
  document.body.appendChild(gate);
})();

/* ── Auth state watcher: gate blocks the app until signed in ────────────── */
onAuthStateChanged(auth, function (user) {
  _authStateChangedFired = true;
  console.log("AUTH STATE CHANGED:", user ? "AUTHENTICATED" : "NOT AUTHENTICATED", user);
  var gate = document.getElementById("lt-auth-gate");
  var storageChanged = false;
  if (user) {
    console.log("Removing auth gate and adding lt-authed class");
    /* Swap per-account storage BEFORE any UI reads it. */
    storageChanged = reconcileStorage(user);
    _lastSeenUid = user.uid;
    var genuineLogin = _prevAuthState === null;
    _prevAuthState = user;
    if (storageChanged) announceUserChanged();
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
    /* Clear ALL inline styles that logout sets on #root (including !important) */
    var root = document.getElementById("root");
    if (root) root.removeAttribute("style");
    /* Keep the opaque auth gate in place until the authenticated UI has
       painted. Removing it first caused a brief white frame after sign-up.
       If storage was just swapped for another account, wait until React
       confirms the remount (lt-user-changed-applied) so stale UI never
       flashes between gate removal and the remount commit. */
    var dropGate = function () {
      var g = document.getElementById("lt-auth-gate");
      if (!g) return;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { g.remove(); });
      });
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
    /* Park the outgoing account's data under its uid and wipe the live
       keys so the next account (or a fresh signup) starts clean. */
    storageChanged = reconcileStorage(null);
    _prevAuthState = null;
    if (storageChanged) announceUserChanged();
    document.body.classList.remove("lt-authed");

    // Clean up any enhancement visuals before showing login gate to prevent flash
    cleanupEnhancementVisuals();

    renderGate("login");
  }
});
