import { createRoot } from 'react-dom/client';
import { jsx } from 'react/jsx-runtime';
import { QC } from './app/AppRoot.js';
import { getStore, setStore } from './lib/storage.js';
import { mk, ONB_PREVIEW } from './_slice_onboarding.js';

(function seedDefaultActivitiesEarly() {
  var SEEDED_KEY = "lt_default_activities_seeded_v2";
  var DB_KEY = "lifetime_local_db_v1";
  var COLORS = ["#1B1F3B","#00897B","#D97706","#7C3AED","#E11D48","#BE185D","#15803D","#B91C1C"];
  try {
    if (localStorage.getItem(SEEDED_KEY) === "true") return;
    var db;
    try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { db = null; }
    if (!db || typeof db !== "object") db = {};
    if (!Array.isArray(db.activities)) db.activities = [];
    if (!Array.isArray(db.blocks)) db.blocks = [];
    var defaults = [
      { name: "Work",       emoji: "\uD83D\uDCBC" },
      { name: "Sleep",      emoji: "\uD83D\uDE34" },
      { name: "Time Waste", emoji: "\u23F3" },
      { name: "Exercise",   emoji: "\uD83C\uDFCB\uFE0F" },
      { name: "Eating",     emoji: "\uD83C\uDF7D\uFE0F" },
    ];
    var existing = {};
    db.activities.forEach(function (a) { if (a && a.name) existing[a.name.trim().toLowerCase()] = true; });
    var nextId = 1;
    db.activities.forEach(function (a) { if (a && a.id >= nextId) nextId = a.id + 1; });
    var added = false;
    defaults.forEach(function (d, idx) {
      if (existing[d.name.toLowerCase()]) return;
      db.activities.push({ id: nextId++, name: d.name, color: COLORS[idx % COLORS.length], emoji: d.emoji, isDefault: true });
      added = true;
    });
    if (added) localStorage.setItem(DB_KEY, JSON.stringify(db));
    localStorage.setItem(SEEDED_KEY, "true");
  } catch (e) { /* silent */ }
})();

console.log("MAIN.JS: Starting React app render");
const rootElement = document.getElementById("root");
console.log("MAIN.JS: Root element:", rootElement);
const root = createRoot(rootElement);
console.log("MAIN.JS: React root created:", root);
root.render(jsx(QC, {}));
console.log("MAIN.JS: React render called");

/* ── Onboarding review overlay (localhost ONLY — ONB_PREVIEW can never be
   true on the live site or inside the APK). Opening
   http://127.0.0.1:4181/?onboarding=new lands straight on the redesigned
   wizard — no welcome/register/login screen in front of it. It writes
   nothing: finishing or skipping unmounts it and the normal welcome
   screen is already sitting underneath. The moment the REAL app becomes
   authenticated (demo engine / a login — how the test suites enter), the
   overlay drops itself so the in-app onboarding (same redesign) shows
   instead — never two layers. ─────────────────────────────────────────── */
(function mountOnboardingPreview() {
  try {
    if (!ONB_PREVIEW) return;
    if (document.body && document.body.classList.contains("lt-authed")) return;
    /* Review-only: the wizard must be the ONLY thing on screen. Belt and
       braces with enhancements.js — sweep away any splash node that already
       painted (boot splash + emblem splash stacked in front of the wizard
       was the owner's "random loading animation" / "plays 2 times"), and
       silence the welcome-screen star field that runs hidden behind this
       overlay (per-frame work nobody can see). */
    ["lt-boot-splash", "lt-startup-splash"].forEach(function (id) {
      try {
        var n = document.getElementById(id);
        if (n && n.parentNode) n.parentNode.removeChild(n);
      } catch {}
    });
    try {
      document.body.classList.add("lt-onb-preview-active");
      var pvCss = document.createElement("style");
      pvCss.id = "lt-onb-preview-css";
      pvCss.textContent =
        "body.lt-onb-preview-active .lt-auth-stars circle," +
        "body.lt-onb-preview-active circle.lt-star-ambient," +
        "body.lt-onb-preview-active circle.lt-star-shine," +
        "body.lt-onb-preview-active .lt-auth-spark{animation:none!important;}";
      document.head.appendChild(pvCss);
    } catch {}
    const host = document.createElement("div");
    host.id = "lt-onb-preview";
    /* Sits above the gate (z 999999); the splash nodes are already gone. */
    host.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#FDFBF7;overflow-y:auto;-webkit-overflow-scrolling:touch;";
    document.body.appendChild(host);
    const root2 = createRoot(host);
    const close = function () {
      try { root2.unmount(); } catch {}
      try { if (host.parentNode) host.parentNode.removeChild(host); } catch {}
    };
    root2.render(jsx(mk, { preview: true, onComplete: close }));
    const ob = new MutationObserver(function () {
      if (document.body.classList.contains("lt-authed")) { ob.disconnect(); close(); }
    });
    ob.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  } catch {}
})();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/firebase-messaging-sw.js").catch(function () {});
  /* Legacy cleanup: older builds registered extra workers (sw.js,
     minutics-alerts-sw.js) that could keep stale app shells around and
     flash old UI. Keep only the messaging worker and drop any Cache
     Storage left behind by retired workers. */
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (r) {
      try {
        var s = r.active || r.installing || r.waiting;
        var u = (s && s.scriptURL) || "";
        if (u.indexOf("firebase-messaging-sw.js") === -1) r.unregister();
      } catch (e) {}
    });
  }).catch(function () {});
  if (window.caches && caches.keys) {
    caches.keys().then(function (ks) {
      ks.forEach(function (k) { caches.delete(k).catch(function () {}); });
    }).catch(function () {});
  }
}
