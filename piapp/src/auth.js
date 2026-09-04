/* ══════════════════════════════════════════════════════════════════════════
   Minutics Pi — Pi Network Authentication Gate
   Pi Network sign-in only. No email/password — all authentication
   flows through the Pi SDK + server-side verification.
═══════════════════════════════════════════════════════════════════════════ */

const PI_APP_ID = "minutics";

function getApiOrigin() {
  if (typeof window !== "undefined" && window.location) {
    var h = window.location.hostname;
    if (h === "piapp.minutics.com" || h === "localhost") return "";
  }
  return "https://piapp.minutics.com";
}

/* ── Styles — visually identical to the normal Minutics auth gate ────── */
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
      opacity: 1; visibility: visible;
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
    .lt-auth-error {
      background: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px;
      color: #DC2626; font-size: 13px; padding: 11px 14px; line-height: 1.5;
      display: none;
    }
    .lt-auth-error.lt-auth-shown { display: block; animation: lt-auth-shake .4s; }
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
    .lt-auth-disclaimer {
      margin-top: 12px; font-size: 10px; line-height: 1.6; color: #6B7280;
      text-align: center;
    }
    .lt-auth-disclaimer b { font-weight: 600; color: #374151; }
    .lt-auth-pi-badge {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 16px; padding: 10px 16px; border-radius: 12px;
      background: #F3F0FF; color: #6D28D9; font-size: 13px; font-weight: 600;
    }
    .lt-auth-pi-badge svg { width: 18px; height: 18px; }
  `;
  document.head.appendChild(style);
}

/* ── Expose interface for Settings page logout ───────────────────────── */
var _piUser = null;
var _piAuthToken = null;
var _piSdkAccessToken = null;

window.LTAuth = {
  logout: function () {
    cleanupEnhancementVisuals();
    var apiOrigin = getApiOrigin();
    fetch(apiOrigin + "/api/pi/logout", {
      method: "POST",
      credentials: "include",
    }).catch(function () {});
    _piUser = null;
    _piAuthToken = null;
    _piSdkAccessToken = null;
    document.body.classList.remove("lt-authed");
    renderGate();
  },
  currentUser: function () {
    return _piUser;
  },
  getAccessToken: function () {
    return _piSdkAccessToken;
  },
};

/* ── Render the Pi login gate ───────────────────────────────────────── */
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
  gate.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:#Fdfbf7;color:#111827;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font-family:'Geist',-apple-system,sans-serif;opacity:1;visibility:visible;";
  gate.innerHTML =
    '<div class="lt-auth-blob"></div>' +
    '<div class="lt-auth-hero"><img src="./assets/auth/welcome-back.png" alt="Welcome to Minutics" /></div>' +
    '<main class="lt-auth-card">' +
      '<div class="lt-auth-head">' +
        '<h1 class="lt-auth-title">Welcome to Minutics</h1>' +
        '<p class="lt-auth-sub">Login or register with your Pi Network account</p>' +
      '</div>' +
      '<div class="lt-auth-error" id="lt-auth-error"></div>' +
      '<div class="lt-auth-submit-wrap">' +
        '<button class="lt-auth-submit" type="button" id="lt-auth-submit">' +
          '<span class="lt-auth-spinner"></span>' +
          '<span id="lt-auth-submit-label">Continue with Pi</span>' +
        '</button>' +
      '</div>' +
      '<div class="lt-auth-pi-badge">' +
        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>' +
        'Secured by Pi Network' +
      '</div>' +
      '<p class="lt-auth-disclaimer"><b>Please note:</b> your data (activities, budget, tasks, journal) is saved only on this device — it never leaves your phone. If you log in on another device, you\'ll start fresh there; your data won\'t carry over. We don\'t store your data on our own servers because we respect your privacy.</p>' +
    '</main>';
  document.body.appendChild(gate);

  var submitBtn = document.getElementById("lt-auth-submit");
  submitBtn.addEventListener("click", handlePiLogin);
}

function handlePiLogin() {
  var submitBtn = document.getElementById("lt-auth-submit");
  var submitLabel = document.getElementById("lt-auth-submit-label");

  submitBtn.disabled = true;
  submitBtn.classList.add("lt-auth-loading");
  submitLabel.textContent = "Connecting to Pi...";

  if (typeof Pi === "undefined") {
    showError("Pi Network SDK not loaded. Please open this app inside the Pi Browser.");
    submitBtn.disabled = false;
    submitBtn.classList.remove("lt-auth-loading");
    submitLabel.textContent = "Continue with Pi";
    return;
  }

  try {
    Pi.init({ appId: PI_APP_ID, version: "2.0" });
  } catch (e) {
    showError("Failed to initialize Pi SDK. Please try again.");
    submitBtn.disabled = false;
    submitBtn.classList.remove("lt-auth-loading");
    submitLabel.textContent = "Continue with Pi";
    return;
  }

  function onIncompletePaymentFound(payment) {
    console.log("Incomplete payment found:", payment);
    var apiOrigin = getApiOrigin();
    fetch(apiOrigin + "/api/pi/payments/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ paymentId: payment.identifier, accessToken: payment.accessToken }),
    }).catch(function (err) {
      console.error("Failed to complete incomplete payment:", err);
    });
  }

  Pi.authenticate(["payments", "username"], onIncompletePaymentFound)
    .then(function (authResult) {
      submitLabel.textContent = "Verifying...";
      var apiOrigin = getApiOrigin();
      return fetch(apiOrigin + "/api/pi/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accessToken: authResult.accessToken }),
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data, accessToken: authResult.accessToken }; });
      });
    })
    .then(function (result) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("lt-auth-loading");
      submitLabel.textContent = "Continue with Pi";

      if (!result.ok || !result.data || !result.data.user) {
        showError((result.data && result.data.error) || "Authentication failed. Please try again.");
        return;
      }

      _piUser = result.data.user;
      _piAuthToken = result.data.sessionToken || null;
      _piSdkAccessToken = result.accessToken || null;

      var gate = document.getElementById("lt-auth-gate");
      if (gate) gate.remove();
      document.body.classList.add("lt-authed");

      if (location.pathname !== "/") {
        history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    })
    .catch(function (err) {
      console.error("Pi auth error:", err);
      showError("Something went wrong. Please try again.");
      submitBtn.disabled = false;
      submitBtn.classList.remove("lt-auth-loading");
      submitLabel.textContent = "Continue with Pi";
    });
}

function showError(msg) {
  var el = document.getElementById("lt-auth-error");
  if (!el) return;
  el.classList.remove("lt-auth-shown");
  el.textContent = msg;
  void el.offsetWidth;
  el.classList.add("lt-auth-shown");
}

function cleanupEnhancementVisuals() {
  var elementsToRemove = [
    "lt-activity-limit",
    "lt-telegram-gate-overlay",
    "lt-telegram-gate-badge",
    "lt-upgrade-modal"
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

/* ── Ensure the Pi SDK is authenticated (required for createPayment) ── */
function ensurePiSdkAuthed() {
  if (typeof Pi === "undefined") return;
  try {
    Pi.init({ appId: PI_APP_ID, version: "2.0" });
  } catch (e) { return; }
  Pi.authenticate(["payments", "username"], function (payment) {
    var apiOrigin = getApiOrigin();
    fetch(apiOrigin + "/api/pi/payments/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ paymentId: payment.identifier }),
    }).catch(function () {});
  }).then(function (result) {
    if (result && result.accessToken) {
      _piSdkAccessToken = result.accessToken;
    }
  }).catch(function () {});
}

/* ── Check for existing session on page load ─────────────────────────── */
(function checkSession() {
  var apiOrigin = getApiOrigin();
  fetch(apiOrigin + "/api/pi/auth/me", {
    method: "GET",
    credentials: "include",
  })
    .then(function (res) {
      if (!res.ok) throw new Error("no session");
      return res.json();
    })
    .then(function (data) {
      if (data && data.user) {
        _piUser = data.user;
        document.body.classList.add("lt-authed");
        ensurePiSdkAuthed();
      } else {
        renderGate();
      }
    })
    .catch(function () {
      renderGate();
    });
})();
