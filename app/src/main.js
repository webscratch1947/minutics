import { createRoot } from 'react-dom/client';
import { jsx } from 'react/jsx-runtime';
import { QC } from './app/AppRoot.js';
import { getStore, setStore } from './lib/storage.js';

(function seedDefaultActivitiesEarly() {
  var SEEDED_KEY = "lt_default_activities_seeded_v2";
  var DB_KEY = "lifetime_local_db_v1";
  var COLORS = ["#1B1F3B","#00897B","#D97706","#7C3AED","#1D4ED8","#BE185D","#15803D","#B91C1C"];
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(function () {});
}
