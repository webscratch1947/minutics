/* ══════════════════════════════════════════════════════════════════════════
   Minutics Pi — Pi Network Authentication Gate
   Uses the Pi SDK for identity. No user data is stored on our servers —
   auth is identity-only. All app data (activities, budget, tasks, etc.)
   stays exactly where it already lived: on this device.
══════════════════════════════════════════════════════════════════════════ */

/* ── Helpers ──────────────────────────────────────────────────────────── */
function getApiOrigin() {
  /* Always hit the live server so requests work from any context
     (Android WebView from file://, app.local, custom scheme, etc.) */
  return "https://piapp.minutics.com";
}

/* ── Demo account (kept for parity with the web app) ─────────────────── */
const DEMO_STORAGE_KEY = "lt-demo-session-started";
const DEMO_DURATION_MS = 30 * 60 * 1000;
let demoTimerInterval = null;

function isDemoActive() { return !!localStorage.getItem(DEMO_STORAGE_KEY); }
function demoTimeRemainingMs() {
  var started = parseInt(localStorage.getItem(DEMO_STORAGE_KEY) || "0", 10);
  if (!started) return 0;
  return DEMO_DURATION_MS - (Date.now() - started);
}
function startDemoSession(isNew) {
  if (isNew) localStorage.setItem(DEMO_STORAGE_KEY, String(Date.now()));
  var gate = document.getElementById("lt-auth-gate");
  if (gate) gate.remove();
  /* Wait one frame so React (main.js) has time to mount into #root before
     we make it visible via lt-authed. Without this, #root can appear empty
     on first load because the module script runs before React finishes its
     initial render. */
  requestAnimationFrame(function () {
    document.body.classList.add("lt-authed");
    var root = document.getElementById("root");
    if (root) root.removeAttribute("style");
    showDemoTimer();
  });
}
function endDemoSession() {
  if (demoTimerInterval) { clearInterval(demoTimerInterval); demoTimerInterval = null; }
  var widget = document.getElementById("lt-demo-timer");
  if (widget) widget.remove();
  localStorage.clear();
  document.body.classList.remove("lt-authed");
  renderGate();
}
function showDemoTimer() {
  injectDemoTimerStyles();
  var existing = document.getElementById("lt-demo-timer");
  if (existing) existing.remove();
  var widget = document.createElement("div");
  widget.id = "lt-demo-timer";
  widget.innerHTML =
    '<span class="lt-demo-timer-dot"></span>' +
    '<span>Demo — <b id="lt-demo-timer-clock">30:00</b></span>';
  document.body.appendChild(widget);
  function tick() {
    var remaining = demoTimeRemainingMs();
    if (remaining <= 0) { endDemoSession(); return; }
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
      padding: 8px 16px; display: flex; align-items: center; gap: 8px;
      border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,.18);
      white-space: nowrap; flex-shrink: 0;
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

/* ── Expose auth API for Settings / other modules ─────────────────────── */
window.LTAuth = {
  currentUser: function () { return window.__piUser || null; },
  logout: function () {
    cleanupEnhancementVisuals();
    var root = document.getElementById("root");
    if (root) root.style.cssText = "display:none!important";
    /* Clear local session state */
    window.__piUser = null;
    /* Tell server to clear the session cookie */
    fetch(getApiOrigin() + "/api/pi/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(function () {}).then(function () {
      renderGate();
    });
  },
  getPiUser: function () { return window.__piUser || null; },
};

/* ── Styles ───────────────────────────────────────────────────────────── */
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
    }
    #lt-auth-gate * { box-sizing: border-box; }
    #lt-auth-gate > * { animation: lt-auth-fade .35s ease; }
    @keyframes lt-auth-fade { from { opacity: 0; } to { opacity: 1; } }
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
      display: flex; flex-direction: column; align-items: center;
    }
    .lt-auth-head { text-align: center; margin-bottom: 32px; }
    .lt-auth-title { font-size: 24px; font-weight: 600; color: #111827; margin: 0; }
    .lt-auth-sub { font-size: 14px; color: #6B7280; margin: 4px 0 0; }
    .lt-auth-pi-btn {
      width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
      background: #FFC107; border: none; border-radius: 12px;
      color: #1a1a1a; font-size: 16px; font-weight: 700; padding: 16px 24px;
      cursor: pointer; font-family: 'Geist', sans-serif; transition: background .15s, opacity .15s;
      box-shadow: 0 2px 8px rgba(255,193,7,.35);
    }
    .lt-auth-pi-btn:hover:not(:disabled) { background: #FFB300; }
    .lt-auth-pi-btn:disabled { opacity: .6; cursor: default; }
    .lt-auth-pi-btn .lt-auth-spinner {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2.5px solid rgba(0,0,0,.2); border-top-color: #1a1a1a;
      animation: lt-auth-spin .7s linear infinite; display: none;
    }
    .lt-auth-pi-btn.lt-auth-loading .lt-auth-spinner { display: inline-block; }
    @keyframes lt-auth-spin { to { transform: rotate(360deg); } }
    .lt-auth-error {
      width: 100%;
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px;
      color: #DC2626; font-size: 13px; padding: 11px 14px; line-height: 1.5;
      display: none; margin-bottom: 12px;
    }
    .lt-auth-error.lt-auth-shown { display: block; }
    .lt-auth-error.lt-success { background: #F0FDF4; border-color: #BBF7D0; color: #16A34A; }
    .lt-auth-divider {
      width: 100%; display: flex; align-items: center; gap: 12px;
      margin: 20px 0; color: #9CA3AF; font-size: 12px;
    }
    .lt-auth-divider::before, .lt-auth-divider::after {
      content: ""; flex: 1; height: 1px; background: #E5E7EB;
    }
    .lt-auth-demo {
      margin-top: 20px; padding: 12px 14px; border-radius: 10px;
      background: #FEF3C7; color: #374151; font-size: 12px; line-height: 1.55;
      width: 100%;
    }
    .lt-auth-disclaimer {
      margin-top: 12px; font-size: 10px; line-height: 1.6; color: #6B7280;
      width: 100%;
    }
    .lt-auth-disclaimer b { font-weight: 600; color: #374151; }
  `;
  document.head.appendChild(style);
}

/* ── Render the login gate ────────────────────────────────────────────── */
function renderGate() {
  injectStyles();
  var existing = document.getElementById("lt-auth-gate");
  if (existing) {
    existing.style.opacity = "1";
    existing.style.visibility = "visible";
    existing.remove();
  }
  cleanupEnhancementVisuals();

  var gate = document.createElement("div");
  gate.id = "lt-auth-gate";
  gate.style.cssText = "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;color:#111827;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-blob"></div>' +
    '<div class="lt-auth-hero"><img src="./assets/auth/welcome-back.png" alt="Welcome illustration" /></div>' +
    '<main class="lt-auth-card">' +
      '<div class="lt-auth-head">' +
        '<h1 class="lt-auth-title">Welcome to Minutics</h1>' +
        '<p class="lt-auth-sub">Sign in with your Pi Network account</p>' +
      '</div>' +
      '<div class="lt-auth-error" id="lt-auth-error"></div>' +
      '<button class="lt-auth-pi-btn" id="lt-auth-pi-btn">' +
        '<span class="lt-auth-spinner"></span>' +
        '<span id="lt-auth-pi-label">Continue with Pi</span>' +
      '</button>' +
      '<div class="lt-auth-divider">or</div>' +
      '<div class="lt-auth-demo">Try the demo — auto-logs-out after 30 min. Data is wiped on timeout.</div>' +
      '<p class="lt-auth-disclaimer"><b>Please note:</b> your data (activities, budget, tasks, journal) is saved only on this device — it never leaves your phone. If you log in on another device, you\'ll start fresh there.</p>' +
    '</main>';
  document.body.appendChild(gate);

  var piBtn = document.getElementById("lt-auth-pi-btn");
  var piLabel = document.getElementById("lt-auth-pi-label");

  piBtn.addEventListener("click", function () {
    hideError();
    piBtn.disabled = true;
    piBtn.classList.add("lt-auth-loading");
    piLabel.textContent = "Connecting to Pi...";

    /* Check if Pi SDK is loaded */
    if (typeof window.Pi === "undefined") {
      showError("Pi Network SDK not loaded. Please open this app in the Pi Browser.");
      piBtn.disabled = false;
      piBtn.classList.remove("lt-auth-loading");
      piLabel.textContent = "Continue with Pi";
      return;
    }

    window.Pi.authenticate()
      .then(function (accessToken) {
        piLabel.textContent = "Verifying...";
        return fetch(getApiOrigin() + "/api/pi/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ accessToken: accessToken }),
        });
      })
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        if (!r.ok) {
          showError(r.data && r.data.error || "Authentication failed. Please try again.");
          piBtn.disabled = false;
          piBtn.classList.remove("lt-auth-loading");
          piLabel.textContent = "Continue with Pi";
          return;
        }
        /* Store user info locally */
        window.__piUser = r.data.user;
        /* Remove gate and show app */
        var g = document.getElementById("lt-auth-gate");
        if (g) g.remove();
        document.body.classList.add("lt-authed");
        var root = document.getElementById("root");
        if (root) root.removeAttribute("style");
      })
      .catch(function (err) {
        console.error("Pi auth error:", err);
        showError("Authentication failed — please try again.");
        piBtn.disabled = false;
        piBtn.classList.remove("lt-auth-loading");
        piLabel.textContent = "Continue with Pi";
      });
  });

  /* Demo button — clicking the demo text starts a demo session */
  var demoEl = gate.querySelector(".lt-auth-demo");
  if (demoEl) {
    demoEl.style.cursor = "pointer";
    demoEl.addEventListener("click", function () { startDemoSession(true); });
  }
}

/* ── Error helpers ────────────────────────────────────────────────────── */
function showError(msg, isSuccess) {
  var el = document.getElementById("lt-auth-error");
  if (!el) return;
  el.classList.remove("lt-auth-shown");
  el.textContent = msg;
  el.classList.toggle("lt-success", !!isSuccess);
  void el.offsetWidth;
  el.classList.add("lt-auth-shown");
}
function hideError() {
  var el = document.getElementById("lt-auth-error");
  if (el) el.classList.remove("lt-auth-shown");
}

/* ── Cleanup enhancement visuals ──────────────────────────────────────── */
function cleanupEnhancementVisuals() {
  var elementsToRemove = [
    "lt-activity-limit", "lt-telegram-gate-overlay",
    "lt-telegram-gate-badge", "lt-upgrade-modal"
  ];
  elementsToRemove.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  });
  var dimmed = document.querySelectorAll("[data-lt-telegram-dimmed]");
  for (var d = 0; d < dimmed.length; d++) {
    dimmed[d].style.opacity = "";
    dimmed[d].style.filter = "";
    dimmed[d].style.pointerEvents = "";
    dimmed[d].removeAttribute("data-lt-telegram-dimmed");
  }
}

/* ── Session check on load: verify existing session with server ──────── */
function checkExistingSession() {
  return fetch(getApiOrigin() + "/api/pi/auth/me", {
    method: "GET",
    credentials: "include",
  })
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      if (data && data.user) {
        window.__piUser = data.user;
        return data.user;
      }
      return null;
    })
    .catch(function () { return null; });
}

/* ── Init: check session → show app or gate ──────────────────────────── */
if (isDemoActive()) {
  if (demoTimeRemainingMs() > 0) {
    startDemoSession(false);
  } else {
    localStorage.clear();
    renderGate();
  }
} else {
  checkExistingSession().then(function (user) {
    if (user) {
      document.body.classList.add("lt-authed");
    } else {
      renderGate();
    }
  });
}
