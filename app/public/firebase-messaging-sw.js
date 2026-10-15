/* Minutics background push router — owns EVERY push while the app is closed.

   (This file previously also imported firebase-messaging-compat with an
   onBackgroundMessage handler, so each message rendered twice under two
   different tags. All display now happens exactly once, right here.)

   Push kinds:
     data.check === "1"  → silent 10-min heartbeat from the GitHub cron.
                            Read the IndexedDB state mirror the open page
                            writes on its 60s heartbeat + pagehide, then
                            decide locally: idle nudge / Time Waste budget.
                            Nothing due → nothing is shown (never spam).
     anything else       → show title/body directly (Settings test button).

   localStorage is invisible to a service worker; the mirror in IndexedDB
   (lt_bg_state / kv / snapshot) is what makes closed-app checks possible.
   Values the SW persists (lastNudge, wasteNotifiedDay) are adopted back by
   the page, so web and SW never double-fire the same event. */

var TEN_MIN = 10 * 60 * 1000;
var IDB_NAME = "lt_bg_state";
var STORE = "kv";
var SNAP_KEY = "snapshot";

function idbOpen() {
  return new Promise(function (resolve, reject) {
    var rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = function () { try { rq.result.createObjectStore(STORE); } catch (e) {} };
    rq.onsuccess = function () { resolve(rq.result); };
    rq.onerror = function () { reject(rq.error); };
  });
}
function idbGet(key) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve) {
      var rq = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      rq.onsuccess = function () { resolve(rq.result || null); };
      rq.onerror = function () { resolve(null); };
    });
  }).catch(function () { return null; });
}
function idbPut(key, val) {
  return idbOpen().then(function (db) {
    return new Promise(function (resolve) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { resolve(false); };
    });
  }).catch(function () { return false; });
}

function dayKey(ts) {
  var d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dayStart(ts) {
  var d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function notify(title, body, tag) {
  return self.registration.showNotification(title, {
    body: body,
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: tag,
    requireInteraction: true,
    silent: false,
    data: { url: "./" }
  });
}

function runBgChecks(force) {
  return idbGet(SNAP_KEY).then(function (s) {
    if (!s || !s.profile) return;
    if (force) return decide(s);
    /* Any open window means the page's own timers are already running
       these checks — stay out of the way so nothing double-fires. */
    return clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      if (list && list.length) return;
      return decide(s);
    });
  }).catch(function () {});
}

function decide(s) {
  var now = Date.now();
  var today = dayKey(now);

  /* ── Time Waste budget — once per budget day (mirrors the web rule) ── */
  if (Number(s.wasteLimit) > 0) {
    var mins = 0;
    if (s.wasteDay === today) {
      mins = Number(s.wasteMins) || 0;
      /* A running waste timer keeps accruing after the page closed. */
      if (s.runningWasteSince && s.wasteCheckedAt && now > s.wasteCheckedAt) {
        mins += Math.floor((now - s.wasteCheckedAt) / 60000);
      }
    } else if (s.runningWasteSince) {
      /* Mirror is from a previous day — only a running block carries into
         today; completed entries re-baseline when the page next opens. */
      mins = Math.floor(Math.max(0, now - Math.max(Number(s.runningWasteSince), dayStart(now))) / 60000);
    }
    if (mins > Number(s.wasteLimit) && s.wasteNotifiedDay !== today) {
      s.wasteNotifiedDay = today;
      return idbPut(SNAP_KEY, s).then(function () {
        return notify(
          "Time Waste budget exceeded",
          "You've spent " + mins + " min on Time Waste \u2014 your " + s.wasteLimit +
            " min daily limit is crossed. Resets at midnight.",
          "minutics-waste"
        );
      });
    }
  }

  /* ── Idle nudge — 10 min with nothing running, spaced 10 min apart ── */
  if (!s.running && Number(s.idleSince) > 0) {
    if (now - Number(s.idleSince) >= TEN_MIN &&
        (!Number(s.lastNudge) || now - Number(s.lastNudge) >= TEN_MIN)) {
      s.lastNudge = now;
      return idbPut(SNAP_KEY, s).then(function () {
        return notify(
          "Still there?",
          "You haven't started an activity in a while \u2014 track what you're doing right now.",
          "minutics-idle-nudge"
        );
      });
    }
  }
}

self.addEventListener("push", function (event) {
  var payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  var data = payload.data || {};
  if (data.check === "1") {
    event.waitUntil(runBgChecks(false));
    return;
  }
  var title = (payload.notification && payload.notification.title) || data.title || "Minutics";
  var body = (payload.notification && payload.notification.body) || data.body || "";
  event.waitUntil(notify(title, body, data.tag || "minutics-bg"));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.includes(new URL(url, self.location.origin).pathname)) {
          return list[i].focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("message", function (event) {
  var d = (event && event.data) || {};
  if (d.type === "SHOW_NOTIFICATION") {
    event.waitUntil(notify(d.title || "Minutics", d.body || "", "minutics-test"));
  } else if (d.type === "RUN_CHECK") {
    event.waitUntil(runBgChecks(!!d.force));
  }
});
