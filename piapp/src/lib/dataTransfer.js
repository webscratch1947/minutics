/**
 * dataTransfer.js — Download / Load the whole app database as one file.
 *
 * Paid-plan feature (Settings → Data).
 *
 *  - buildBackup(): every localStorage entry EXCEPT Firebase session state,
 *    the active-uid marker, and plan keys (plan state must never travel in
 *    a file — it only comes from the payment flow). Plan keys nested inside
 *    lt_ns_* account snapshots are stripped too.
 *
 *  - loadDataFile(): validates the file, runs the premium-content scan, and
 *    only then (paid plan + clean pass) replaces all live keys with the
 *    file's contents. Device session, plan, and other accounts' lt_ns_*
 *    snapshots are preserved. Mirrors written keys to Android native
 *    storage so readJson (which prefers the bridge) sees the new data.
 *
 *  - The premium scan runs for EVERY load, independently of the plan check,
 *    so even a bypassed UI can't sneak Budget Tracker data, >5 activities,
 *    etc. into a free account.
 */

import { isPro } from "./settings.js";

var PLAN_KEYS = ["lt_plan_v1", "lt_plan_since_v1", "lt_plan_grace_v1", "lt_downgrade_at_v1"];
/* Identity data never travels in a file: name (and email — which only ever
   lives in Firebase auth) come from login/register on the target device. */
var IDENTITY_KEYS = ["lifetime_profile"];
var FREE_ACTIVITY_LIMIT = 5;
var FREE_STARRED_LIMIT = 3;

function isSessionKey(k) {
  return k === "lt_active_uid" || k.indexOf("firebase:") === 0;
}
function isPlanKey(k) {
  return PLAN_KEYS.indexOf(k) !== -1;
}
function isIdentityKey(k) {
  return IDENTITY_KEYS.indexOf(k) !== -1;
}
function parseJson(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}
function nonEmptyStored(v) {
  if (Array.isArray(v)) return v.length > 0;
  if (v && typeof v === "object") return Object.keys(v).length > 0;
  return v !== null && v !== undefined && v !== "" && v !== false;
}
/* Plan keys and identity (profile name/email) must not survive inside
   lt_ns_* account snapshots — a hand-edited file could otherwise smuggle
   them through a nested blob. */
function stripPlanKeysInSnapshot(str) {
  var obj = parseJson(str);
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (var i = 0; i < PLAN_KEYS.length; i++) delete obj[PLAN_KEYS[i]];
    for (var j = 0; j < IDENTITY_KEYS.length; j++) delete obj[IDENTITY_KEYS[j]];
    return JSON.stringify(obj);
  }
  return str;
}

/* ── Export ────────────────────────────────────────────────────────────── */
export function buildBackup() {
  var data = {};
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k || isSessionKey(k) || isPlanKey(k) || isIdentityKey(k)) continue;
    var v = localStorage.getItem(k);
    if (k.indexOf("lt_ns_") === 0) v = stripPlanKeysInSnapshot(v);
    data[k] = v;
  }
  return {
    app: "minutics",
    kind: "minutics-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: data
  };
}

/* ── Premium-content scan (plan-independent — the anti-bypass layer) ───── */
export function scanPremiumFeatures(data) {
  var found = [];

  var db = parseJson(data["lifetime_local_db_v1"]);
  if (db && Array.isArray(db.activities)) {
    var active = db.activities.filter(function (a) {
      return a && !a.archived && !a.isDefault;
    }).length;
    if (active > FREE_ACTIVITY_LIMIT) found.push("more than 5 activities");
  }

  if (nonEmptyStored(parseJson(data["lt_budget_tracker_v1"]))) found.push("Budget Tracker");
  if (nonEmptyStored(parseJson(data["lt_emi_history_v1"]))) found.push("EMI history");
  if (nonEmptyStored(parseJson(data["lt_compound_history_v1"]))) found.push("Compound history");
  if (nonEmptyStored(parseJson(data["lt_opp_history_v1"]))) found.push("Opportunity history");
  if (nonEmptyStored(parseJson(data["lt_itemcost_history_v1"]))) found.push("Item cost history");

  var tasks = parseJson(data["lt_tasks_v1"]);
  if (Array.isArray(tasks)) {
    var starred = tasks.filter(function (t) { return t && t.starred; }).length;
    if (starred > FREE_STARRED_LIMIT) found.push("more than 3 starred tasks");
  }

  var tg = parseJson(data["lifetime_telegram_settings_v1"]);
  if (tg && tg.telegramBotToken && tg.telegramChatId) found.push("Telegram daily reports");

  return found;
}

/* ── Import ────────────────────────────────────────────────────────────── */
function applyData(data) {
  var nativeKeys = window.LT_NATIVE_KEYS || {};
  var bridge = window.AndroidBridge;
  var canNative = !!(bridge && typeof bridge.savePersistent === "function");

  /* 1. Remove every live app key (same reservation rules as Reset:
        keep session, plan, and lt_ns_* snapshots on this device). */
  var toRemove = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (!k) continue;
    if (isSessionKey(k) || isPlanKey(k) || isIdentityKey(k) || k.indexOf("lt_ns_") === 0) continue;
    toRemove.push(k);
  }
  for (var r = 0; r < toRemove.length; r++) {
    var rk = toRemove[r];
    try { localStorage.removeItem(rk); } catch (e) {}
    /* Native mirror prefers its own copy on read — write "" (readJson
       treats empty as missing) for keys the file won't refill. */
    if (canNative && nativeKeys[rk]) {
      try { bridge.savePersistent(rk, ""); } catch (e) {}
    }
  }

  /* 2. Write the file's keys, exact strings. */
  var written = 0;
  Object.keys(data).forEach(function (k) {
    var v = data[k];
    if (k === "lt_active_uid" || isPlanKey(k) || isIdentityKey(k) || k.indexOf("firebase:") === 0) return;
    if (v === null || v === undefined) return;
    if (typeof v !== "string") { try { v = JSON.stringify(v); } catch (e) { return; } }
    if (k.indexOf("lt_ns_") === 0) v = stripPlanKeysInSnapshot(v);
    try { localStorage.setItem(k, v); written++; } catch (e) { return; }
    if (canNative && nativeKeys[k]) {
      try { bridge.savePersistent(k, v); } catch (e) {}
    }
  });
  return written;
}

export function loadDataFile(file) {
  return file.text().then(function (text) {
    var parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { return null; }
    if (!parsed || parsed.app !== "minutics" || parsed.kind !== "minutics-backup"
        || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
      return null;
    }
    return parsed.data;
  }).then(function (data) {
    if (!data) {
      return { ok: false, message: "This is not a valid Minutics backup file." };
    }
    /* Scan BEFORE the plan gate so a bypassed UI still hits the
       premium-data rejection with its exact message. */
    var premium = scanPremiumFeatures(data);
    if (!isPro()) {
      if (premium.length) {
        return {
          ok: false,
          message: "This data has premium feature data (" + premium.join(", ")
            + "). You will need to purchase a plan to load this data."
        };
      }
      return { ok: false, message: "This feature is only available for the 1 Year Plan." };
    }
    try {
      applyData(data);
    } catch (e) {
      return { ok: false, message: "Could not load data: " + ((e && e.message) || e) };
    }
    return { ok: true, message: "Data loaded successfully. The app will now refresh." };
  }).catch(function () {
    return { ok: false, message: "Could not read the selected file." };
  });
}
