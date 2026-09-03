/* ══════════════════════════════════════════════════════════════════════════
   Lifetime — Firebase Authentication Gate
   Email/password sign-up & login only. No user data is stored in Firebase —
   auth is identity-only. All app data (activities, budget, tasks, etc.)
   stays exactly where it already lived: on this device.
══════════════════════════════════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

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

/* ── Demo account ─────────────────────────────────────────────────────────
   demo@gmail.com / 12345 — logs straight in from the Login page (no real
   Firebase account), auto-logs-out after 30 min, and wipes local data
   (all of localStorage, where Minutics keeps activities/budget/tasks/etc)
   on that timeout. Blocked from the Sign-up page — tells the user to log
   in instead. ────────────────────────────────────────────────────────── */
const DEMO_EMAIL = "demo@gmail.com";
const DEMO_PASSWORD = "12345";
const DEMO_DURATION_MS = 30 * 60 * 1000;
const DEMO_STORAGE_KEY = "lt-demo-session-started";
let demoTimerInterval = null;

function isDemoActive() {
  return !!localStorage.getItem(DEMO_STORAGE_KEY);
}

function demoTimeRemainingMs() {
  var started = parseInt(localStorage.getItem(DEMO_STORAGE_KEY) || "0", 10);
  if (!started) return 0;
  return DEMO_DURATION_MS - (Date.now() - started);
}

function startDemoSession(isNew) {
  if (isNew) localStorage.setItem(DEMO_STORAGE_KEY, String(Date.now()));
  var gate = document.getElementById("lt-auth-gate");
  if (gate) gate.remove();
  document.body.classList.add("lt-authed");
  showDemoTimer();
}

function endDemoSession() {
  if (demoTimerInterval) { clearInterval(demoTimerInterval); demoTimerInterval = null; }
  var widget = document.getElementById("lt-demo-timer");
  if (widget) widget.remove();
  localStorage.clear();
  document.body.classList.remove("lt-authed");
  renderGate("login");
  showError.postClear = true;
}

function showDemoTimer() {
  injectDemoTimerStyles();
  var existing = document.getElementById("lt-demo-timer");
  if (existing) existing.remove();

  var widget = document.createElement("div");
  widget.id = "lt-demo-timer";
  widget.innerHTML =
    '<span class="lt-demo-timer-dot"></span>' +
    '<span>Demo session — <b id="lt-demo-timer-clock">30:00</b> left</span>';
  document.body.appendChild(widget);

  function tick() {
    var remaining = demoTimeRemainingMs();
    if (remaining <= 0) {
      endDemoSession();
      return;
    }
    var totalSec = Math.ceil(remaining / 1000);
    var min = Math.floor(totalSec / 60);
    var sec = totalSec % 60;
    var clockEl = document.getElementById("lt-demo-timer-clock");
    if (clockEl) clockEl.textContent = min + ":" + (sec < 10 ? "0" : "") + sec;
  }

  tick();
  if (demoTimerInterval) clearInterval(demoTimerInterval);
  demoTimerInterval = setInterval(tick, 1000);
}

function injectDemoTimerStyles() {
  if (document.getElementById("lt-demo-timer-styles")) return;
  var style = document.createElement("style");
  style.id = "lt-demo-timer-styles";
  style.textContent = `
    #lt-demo-timer {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 999998;
      background: hsl(230 40% 16%); color: #fff;
      font-family: 'Inter', -apple-system, sans-serif; font-size: 12.5px;
      padding: 8px 14px; display: flex; align-items: center; gap: 8px;
      border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
    }
    #lt-demo-timer b { font-variant-numeric: tabular-nums; }
    .lt-demo-timer-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: hsl(0 80% 60%);
      animation: lt-demo-pulse 1.2s infinite;
    }
    @keyframes lt-demo-pulse {
      0%, 100% { opacity: 1; } 50% { opacity: .35; }
    }
  `;
  document.head.appendChild(style);
}

/* Expose logout for the Settings-page "Log out" row (added in lifetime-enhancements.js) */
window.LTAuth = {
  logout: function () {
    /* IMPORTANT: do NOT clear localStorage here. A previous fix wiped it on
       every logout to stop a stale "Pro" badge / old screen flashing back
       on the next login -- but that data (activities, profile, journal,
       budget, plan status, everything) is exactly what the app's own
       disclaimer promises stays on this device. Wiping it on logout meant
       logging out and back in on the SAME device -- even as the SAME
       account -- silently erased all of it and dropped the user back into
       onboarding. The stale-flash problem this was trying to solve is now
       fixed properly at the source (the auth gate overlay in this file is
       opaque from its very first frame instead of fading in), so nothing
       needs to be nuked here to prevent it. */
    
    // Clean up any enhancement visuals before logout to prevent flash
    cleanupEnhancementVisuals();
    
    signOut(auth).catch(function () {});
  },
  currentUser: function () {
    return auth.currentUser;
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
    .lt-auth-demo {
      margin-top: 24px; padding: 12px 14px; border-radius: 10px;
      background: #FEF3C7; color: #374151; font-size: 12px; line-height: 1.55;
    }
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
          '<p class="lt-auth-hint" id="lt-auth-pw-hint">Minimum 8 characters &amp; alphanumeric</p>' +
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
      '<div class="lt-auth-demo">Want to look around first? Try the demo — <b>' + DEMO_EMAIL + '</b> / <b>' + DEMO_PASSWORD + '</b>' + (isSignup ? " (log in with it, don't sign up)" : "") + '. Auto-logs-out and clears demo data after 30 min.</div>' +
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

  var pwHint = document.getElementById("lt-auth-pw-hint");
  var PW_OK = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

  if (isSignup) {
    pwInput.addEventListener("input", function () {
      if (!pwInput.value) {
        pwHint.className = "lt-auth-hint";
        pwInput.classList.remove("lt-auth-invalid");
        return;
      }
      var ok = PW_OK.test(pwInput.value);
      pwHint.className = "lt-auth-hint " + (ok ? "lt-auth-valid" : "lt-auth-invalid");
      pwInput.classList.toggle("lt-auth-invalid", !ok);
    });
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

    if (isSignup && !PW_OK.test(password)) {
      showError("Password must be at least 8 characters and include both letters and numbers.");
      pwInput.classList.add("lt-auth-invalid");
      pwInput.focus();
      return;
    }

    setLoading(true);

    if (email.toLowerCase() === DEMO_EMAIL) {
      if (isSignup) {
        showError("That's the demo account — please log in instead.");
        setLoading(false);
        return;
      }
      if (password !== DEMO_PASSWORD) {
        showError("Incorrect email or password.");
        setLoading(false);
        return;
      }
      startDemoSession(true);
      return;
    }

    var action = isSignup
      ? createUserWithEmailAndPassword(auth, email, password)
      : signInWithEmailAndPassword(auth, email, password);

    action
      .catch(function (err) {
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

    var apiOrigin = (typeof window.AndroidBridge !== "undefined" ||
                      location.hostname === "app.local" ||
                      location.protocol === "file:" || location.protocol === "")
      ? "https://app.minutics.com" : "";
    fetch(apiOrigin + "/api/send-reset-email", {
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
      .catch(function () {
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
  if (code.indexOf("weak-password") !== -1) return "Password should be at least 8 characters and include both letters and numbers.";
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

/* ── Auth state watcher: gate blocks the app until signed in ────────────── */
onAuthStateChanged(auth, function (user) {
  console.log("AUTH STATE CHANGED:", user ? "AUTHENTICATED" : "NOT AUTHENTICATED", user);
  if (isDemoActive()) return; /* demo session takes over the gate entirely */
  var gate = document.getElementById("lt-auth-gate");
  if (user) {
    console.log("Removing auth gate and adding lt-authed class");
    /* This is a real sign-in transition (the login gate was actually on
       screen a moment ago) only when `gate` is truthy here -- on a normal
       page load where Firebase silently restores an already-signed-in
       session, no gate ever gets created before this fires, so `gate` is
       null and we leave the user exactly on whatever route they loaded
       (e.g. a refresh on Settings correctly stays on Settings). But on a
       genuine login, the router's URL had simply been left wherever it was
       when the user logged out (this overlay never touched routing), so
       without this the app would silently reopen on that old tab -- e.g.
       landing back in Settings -- instead of the Timer home screen a
       fresh sign-in should start on. */
    if (gate) {
      gate.remove();
      if (location.pathname !== "/") {
        history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
    document.body.classList.add("lt-authed");
  } else {
    console.log("Removing lt-authed class and rendering login gate");
    document.body.classList.remove("lt-authed");
    
    // Clean up any enhancement visuals before showing login gate to prevent flash
    cleanupEnhancementVisuals();
    
    /* No localStorage.clear() here either -- see the note in LTAuth.logout()
       above. This branch fires on every path to signed-out (token expiry,
       revoked session, explicit log out, etc.), so clearing here was
       wiping the device's data just as often as the logout button was. */
    renderGate("login");
  }
});

/* Resume an in-progress demo session across page reloads (e.g. app restart) */
if (isDemoActive()) {
  if (demoTimeRemainingMs() > 0) {
    startDemoSession(false);
  } else {
    localStorage.clear();
  }
}
