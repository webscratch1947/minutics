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

/* Expose logout for the Settings-page "Log out" row (added in lifetime-enhancements.js) */
window.LTAuth = {
  logout: function () {
    signOut(auth).catch(function () {});
  },
  currentUser: function () {
    return auth.currentUser;
  },
};

/* ── Styles — matches the app's own light theme: white bg, navy primary,
   sharp corners (the app itself uses --radius: 0px), Inter font ──────────── */
function injectStyles() {
  if (document.getElementById("lt-auth-styles")) return;
  var style = document.createElement("style");
  style.id = "lt-auth-styles";
  style.textContent = `
    #lt-auth-gate {
      position: fixed; inset: 0; z-index: 999999;
      background: #ffffff;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 24px; box-sizing: border-box;
      font-family: 'Inter', -apple-system, sans-serif;
      overflow-y: auto;
    }
    #lt-auth-gate * { box-sizing: border-box; }
    .lt-auth-card { width: 100%; max-width: 380px; }
    .lt-auth-brand {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; margin-bottom: 28px;
    }
    .lt-auth-brand-mark {
      width: 36px; height: 36px; background: hsl(230 40% 16%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 16px;
    }
    .lt-auth-brand-name { font-size: 16px; font-weight: 800; color: hsl(230 40% 16%); }
    .lt-auth-title {
      color: hsl(230 40% 16%); font-size: 21px; font-weight: 800; margin: 0 0 4px;
      text-align: center;
    }
    .lt-auth-sub {
      color: hsl(220 10% 48%); font-size: 13px; margin: 0 0 24px;
      text-align: center;
    }
    .lt-auth-field { margin-bottom: 14px; }
    .lt-auth-field label {
      display: block; color: hsl(220 10% 48%); font-size: 11px;
      font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      margin-bottom: 6px;
    }
    .lt-auth-field input {
      width: 100%; background: hsl(220 15% 97%);
      border: 1px solid hsl(220 13% 88%); border-radius: 0;
      padding: 13px 14px; color: hsl(230 40% 16%); font-size: 15px; outline: none;
      font-family: 'Inter', sans-serif;
    }
    .lt-auth-field input:focus { border-color: hsl(230 40% 16%); }
    .lt-auth-submit {
      width: 100%; background: hsl(230 40% 16%); border: none; border-radius: 0;
      color: #fff; font-size: 15px; font-weight: 700; padding: 14px;
      cursor: pointer; margin-top: 4px; font-family: 'Inter', sans-serif;
    }
    .lt-auth-submit:disabled { opacity: .55; }
    .lt-auth-error {
      background: hsl(0 72% 97%); border: 1px solid hsl(0 72% 88%);
      color: hsl(0 72% 45%); font-size: 12.5px; padding: 11px 12px;
      margin-bottom: 14px; display: none;
    }
    .lt-auth-error.lt-success {
      background: hsl(150 60% 96%); border-color: hsl(150 50% 80%); color: hsl(150 60% 30%);
    }
    .lt-auth-switch {
      text-align: center; margin-top: 20px; font-size: 13px;
      color: hsl(220 10% 48%);
    }
    .lt-auth-switch a {
      color: hsl(230 40% 16%); text-decoration: underline; font-weight: 700; cursor: pointer;
    }
    .lt-auth-pw-wrap { position: relative; }
    .lt-auth-pw-wrap input { padding-right: 44px; }
    .lt-auth-pw-toggle {
      position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
      background: none; border: none; font-size: 17px; cursor: pointer;
      padding: 8px; line-height: 1; opacity: .65;
    }
    .lt-auth-disclaimer {
      margin-top: 22px; padding: 13px 14px;
      background: hsl(220 15% 97%); border: 1px solid hsl(220 13% 90%);
      color: hsl(220 10% 40%); font-size: 11.5px; line-height: 1.55;
    }
    .lt-auth-disclaimer b { color: hsl(230 40% 16%); }
  `;
  document.head.appendChild(style);
}

/* ── Render login/signup form ──────────────────────────────────────────── */
function renderGate(mode) {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) existing.remove();

  var isSignup = mode === "signup";
  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.innerHTML =
    '<div class="lt-auth-card">' +
      '<div class="lt-auth-brand"><div class="lt-auth-brand-mark">M</div><span class="lt-auth-brand-name">Minutics</span></div>' +
      '<p class="lt-auth-title">' + (isSignup ? "Create your account" : "Welcome back") + '</p>' +
      '<p class="lt-auth-sub">' + (isSignup ? "Set up Minutics to get started" : "Log in to continue") + '</p>' +
      '<div class="lt-auth-error" id="lt-auth-error"></div>' +
      '<form id="lt-auth-form">' +
        '<div class="lt-auth-field"><label>Email</label><input type="email" id="lt-auth-email" autocomplete="email" required></div>' +
        '<div class="lt-auth-field"><label>Password</label>' +
          '<div class="lt-auth-pw-wrap">' +
            '<input type="password" id="lt-auth-password" autocomplete="' + (isSignup ? "new-password" : "current-password") + '" minlength="6" required>' +
            '<button type="button" class="lt-auth-pw-toggle" id="lt-auth-pw-toggle" aria-label="Show password">\uD83D\uDC41</button>' +
          '</div>' +
        '</div>' +
        '<button class="lt-auth-submit" type="submit" id="lt-auth-submit">' + (isSignup ? "Sign up" : "Log in") + '</button>' +
      '</form>' +
      '<p class="lt-auth-switch">' +
        (isSignup ? 'Already have an account? <a id="lt-auth-switch-link">Log in</a>' : "New here? " + '<a id="lt-auth-switch-link">Create an account</a>') +
      '</p>' +
      '<div class="lt-auth-disclaimer"><b>Please note:</b> your data (activities, budget, tasks, journal) is saved only on this device — it never leaves your phone. If you log in on another device, you\u2019ll start fresh there; your data won\u2019t carry over. We don\u2019t store your data on our own servers because we respect your privacy.</div>' +
    '</div>';
  document.body.appendChild(gate);

  document.getElementById("lt-auth-switch-link").addEventListener("click", function () {
    renderGate(isSignup ? "login" : "signup");
  });

  var pwInput = document.getElementById("lt-auth-password");
  var pwToggle = document.getElementById("lt-auth-pw-toggle");
  pwToggle.addEventListener("click", function () {
    var showing = pwInput.type === "text";
    pwInput.type = showing ? "password" : "text";
    pwToggle.textContent = showing ? "\uD83D\uDC41" : "\uD83D\uDE48";
    pwToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  var form = document.getElementById("lt-auth-form");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = document.getElementById("lt-auth-email").value.trim();
    var password = document.getElementById("lt-auth-password").value;
    var submitBtn = document.getElementById("lt-auth-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = isSignup ? "Signing up..." : "Logging in...";
    hideError();

    var action = isSignup
      ? createUserWithEmailAndPassword(auth, email, password)
      : signInWithEmailAndPassword(auth, email, password);

    action
      .catch(function (err) {
        showError(friendlyError(err));
        submitBtn.disabled = false;
        submitBtn.textContent = isSignup ? "Sign up" : "Log in";
      });
    /* On success, onAuthStateChanged (below) removes the gate automatically */
  });
}

function showError(msg, isSuccess) {
  var el = document.getElementById("lt-auth-error");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.classList.toggle("lt-success", !!isSuccess);
}
function hideError() {
  var el = document.getElementById("lt-auth-error");
  if (el) el.style.display = "none";
}

function friendlyError(err) {
  var code = (err && err.code) || "";
  if (code.indexOf("email-already-in-use") !== -1) return "That email already has an account — try logging in instead.";
  if (code.indexOf("invalid-email") !== -1) return "That email address doesn't look right.";
  if (code.indexOf("weak-password") !== -1) return "Password should be at least 6 characters.";
  if (code.indexOf("user-not-found") !== -1 || code.indexOf("invalid-credential") !== -1 || code.indexOf("wrong-password") !== -1) return "Incorrect email or password.";
  if (code.indexOf("too-many-requests") !== -1) return "Too many attempts — please wait a moment and try again.";
  if (code.indexOf("network-request-failed") !== -1) return "Network error — check your connection.";
  return "Something went wrong. Please try again.";
}

/* ── Auth state watcher: gate blocks the app until signed in ────────────── */
onAuthStateChanged(auth, function (user) {
  var gate = document.getElementById("lt-auth-gate");
  if (user) {
    if (gate) gate.remove();
    document.body.classList.add("lt-authed");
  } else {
    document.body.classList.remove("lt-authed");
    renderGate("login");
  }
});
