import { useEffect } from 'react';
import { jsx } from 'react/jsx-runtime';
import { getStore, setStore, nextId } from '../lib/storage.js';
import { getTelegramSettings, saveTelegramSettings, getTelegramReportData, updateLastSummaryDate, sendTelegramReport, pushTelegramSchedule } from '../lib/telegram.js';
import { COLOR_PALETTE } from '../lib/constants.js';

/* ── Server-scheduler state (Firebase custom claims, key `tgs`) ──────────
   /api/telegram-cron stamps a heartbeat (tgs.b) every time it runs. While
   that heartbeat is fresh the SERVER owns sending the daily report — we
   disarm the native alarm, mirror its last-sent marker and skip local
   sends. When the heartbeat goes stale (no scheduler attached, or it
   stopped) everything falls back to the local alarm + catch-up path,
   exactly as before this feature existed. */
var _srvCache = null; /* {b, sd, st, t} from claims | null */
var _claimsCheckedAt = 0;

function readTgsClaim(token) {
  try {
    var part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    var bytes = Uint8Array.from(atob(part), function (c) { return c.charCodeAt(0); });
    var payload = JSON.parse(new TextDecoder().decode(bytes));
    return payload && payload.tgs ? payload.tgs : null;
  } catch { return null; }
}

function refreshSrvClaims(force) {
  try {
    if (!window.LTAuth || !window.LTAuth.getToken) return Promise.resolve(null);
    var now = Date.now();
    if (!force && _claimsCheckedAt && now - _claimsCheckedAt < 120000) {
      return Promise.resolve(_srvCache);
    }
    _claimsCheckedAt = now;
    return window.LTAuth.getToken(true).then(function (tok) {
      _srvCache = tok ? readTgsClaim(tok) : null;
      return _srvCache;
    }).catch(function () { return _srvCache; });
  } catch { return Promise.resolve(_srvCache); }
}

function serverActive() {
  var b = _srvCache && Number(_srvCache.b);
  return !!(b && Date.now() - b < 15 * 60 * 1000);
}

/* Adopt server last-sent markers from claims whenever they are newer than
   local state — NOT gated on heartbeat freshness: another tab, the phone,
   or the server itself may already have sent today's report. Returns true
   when claims say the CURRENT configured report already went out today. */
function adoptClaimsMarkers(n) {
  try {
    var c = _srvCache;
    if (!c || !c.sd) return false;
    if (n.lastSummaryDate !== c.sd || (n.lastSummaryTime || "") !== (c.st || "")) {
      try {
        var s = getTelegramSettings();
        s.lastSummaryDate = c.sd;
        s.lastSummaryTime = c.st || s.dailyReportTime;
        localStorage.setItem("lifetime_telegram_settings_v1", JSON.stringify(s));
      } catch {}
      n.lastSummaryDate = c.sd;
      n.lastSummaryTime = c.st || n.dailyReportTime;
      try {
        var b = window.AndroidBridge;
        b && b.syncReportData && b.syncReportData(
          n.telegramBotToken || "", n.telegramChatId || "",
          getTelegramReportData(), c.sd, c.st || ""
        );
      } catch {}
    }
    var today = new Date().toLocaleDateString("en-CA");
    return c.sd === today && (c.st || "") === (n.dailyReportTime || "21:00");
  } catch { return false; }
}

/* Server sent (or owns) today's report: adopt its marker and disarm the
   native alarm so the two paths can never double-send. */
function enterServerMode(n) {
  adoptClaimsMarkers(n);
  try {
    var b = window.AndroidBridge;
    b && b.cancelReport && b.cancelReport();
  } catch {}
}

export function HC() {
  useEffect(() => {
    const e = () => {
      const n = getTelegramSettings();
      if (!n.telegramConnected) {
        try {
          const b = window.AndroidBridge;
          b && b.cancelReport && b.cancelReport()
        } catch {}
        return
      }
      /* Keep server-scheduler state fresh (throttled to 2 min) and push a
         schedule/report snapshot every ~10 min so the server always has
         today's text — plus a force-push when the tab is being hidden. */
      refreshSrvClaims(false);
      pushTelegramSchedule();
      try {
        if (document.visibilityState === "hidden") pushTelegramSchedule({ force: true });
      } catch {}
      /* Pull markers another sender may have written since last tick. */
      adoptClaimsMarkers(n);
      if (serverActive()) {
        enterServerMode(n);
        return;
      }
      /* Pull last-sent date from the native alarm (it may have fired
         while the app was backgrounded) so we don't double-send. */
      try {
        const b = window.AndroidBridge;
        if (b && b.getLastSentDate) {
          const nativeSent = b.getLastSentDate();
          const nativeTime = b.getLastSentTime ? (b.getLastSentTime() || "") : "";
          if (nativeSent && (n.lastSummaryDate !== nativeSent || (nativeTime && (n.lastSummaryTime || "") !== nativeTime))) {
            updateLastSummaryDate(nativeSent);
            n.lastSummaryDate = nativeSent;
            n.lastSummaryTime = n.dailyReportTime || "21:00";
          }
        }
      } catch {}
      try {
        const b = window.AndroidBridge;
        if (b) {
          b.syncReportData && b.syncReportData(n.telegramBotToken || "", n.telegramChatId || "", getTelegramReportData(), n.lastSummaryDate || "", n.lastSummaryTime || "");
          b.scheduleReport && b.scheduleReport(n.dailyReportTime)
        }
      } catch {}
      /* Catch-up: fire any time AFTER the scheduled time today (not only
         on the exact minute — background throttling used to miss it).
         Keyed on day + report TIME, not day alone: if the user changes the
         time after today's report went out, the new time still fires. */
      const now = new Date();
      const today = now.toLocaleDateString("en-CA");
      const parts = (n.dailyReportTime || "21:00").split(":");
      const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
        parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, 0, 0);
      const notYetSent = n.lastSummaryDate !== today || (n.lastSummaryTime || "") !== (n.dailyReportTime || "21:00");
      /* On Android the exact native alarm fires first at the scheduled
         minute; JS only covers after a 90s grace so both paths can't send
         the same report. On the web there is no native path — send at once. */
      const graceMs = window.AndroidBridge ? 90 * 1000 : 0;
      if (now.getTime() >= scheduled.getTime() + graceMs && notYetSent) {
        /* One last fresh claims pull right before sending: if the server
           scheduler fired within the last minute, it already sent this
           report and we must not duplicate it. */
        refreshSrvClaims(true).then(function() {
          /* Someone (server cron, other tab, phone) may already have sent
             today's report — claims are the source of truth. */
          if (adoptClaimsMarkers(n)) return;
          if (serverActive()) {
            enterServerMode(n);
            return;
          }
          /* Also check if native just attempted (within 5 min) — native
             retries on failure but only writes lastSent on success. */
          try {
            const b = window.AndroidBridge;
            if (b && b.getLastAttemptTime) {
              const nativeAttempt = b.getLastAttemptTime();
              if (nativeAttempt && now.getTime() - nativeAttempt < 5 * 60 * 1000) {
                /* Native recently tried (success or pending retry) — skip JS send. */
                return;
              }
            }
          } catch {}
          sendTelegramReport(n.telegramBotToken, n.telegramChatId, getTelegramReportData()).then(function(result) {
          if (result && result.success) {
            updateLastSummaryDate(today);
            /* Tell the server scheduler immediately so it won't re-send
               this report on its next run. */
            pushTelegramSchedule({ force: true });
            try {
              const b = window.AndroidBridge;
              if (b) {
                b.syncReportData && b.syncReportData(n.telegramBotToken || "", n.telegramChatId || "", getTelegramReportData(), today, n.dailyReportTime || "21:00");
                b.scheduleReport && b.scheduleReport(n.dailyReportTime);
              }
            } catch {}
          }
          });
        });
      }
    };
    e();
    const t = window.setInterval(e, 30 * 1e3);
    const onFocus = () => e();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    }
  }, []);
  useEffect(() => {
    const tick = () => {
      try {
        const data = getStore(),
          act = data.activities || [],
          blk = data.blocks || [],
          running = blk.filter(x => !x.endTime).map(x => {
            const a = act.find(a2 => a2.id === x.activityId);
            return {
              id: x.id,
              activityId: x.activityId,
              name: (a && a.name) || "Unknown",
              color: (a && a.color) || "#888",
              startTime: x.startTime
            }
          }),
          b = window.AndroidBridge;
        b && b.updateRunningNotification && b.updateRunningNotification(JSON.stringify(running));
        const trackedIds = new Set(blk.map(x => x.activityId)),
          trackedCount = act.filter(a => trackedIds.has(a.id)).length,
          totalCount = act.length;
        let mostName = "",
          mostSeconds = 0;
        for (const a of act) {
          const secs = blk.filter(x => x.activityId === a.id).reduce((sum, x) => {
            const end = x.endTime ? new Date(x.endTime).getTime() : Date.now();
            return sum + Math.max(0, Math.floor((end - new Date(x.startTime).getTime()) / 1e3))
          }, 0);
          if (secs > mostSeconds) {
            mostSeconds = secs;
            mostName = a.name
          }
        }
        b && b.updateWidgetData && b.updateWidgetData(String(trackedCount), String(totalCount), mostName, String(mostSeconds));
        b && b.syncActivitiesList && b.syncActivitiesList(JSON.stringify(act.map(x => ({
          id: x.id,
          name: x.name,
          emoji: x.emoji || "",
          color: x.color || "#888"
        }))))
      } catch {}
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t)
  }, []);
  return null
}

window.__lifetimeStopActivity = function(blockId) {
  try {
    const data = getStore(),
      blk = data.blocks.find(b => String(b.id) === String(blockId));
    if (blk && !blk.endTime) {
      blk.endTime = new Date().toISOString();
      setStore(data)
    }
  } catch {}
};

window.__lifetimeStartActivityFromWidget = function(activityId, mode, minutes) {
  try {
    const data = getStore();
    if (!data.activities || data.activities.length === 0) return;
    const act = data.activities.find(a => String(a.id) === String(activityId)) || data.activities[0];
    if (!act) return;
    const now = new Date().toISOString();
    const running = data.blocks.find(b => !b.endTime);
    if (running) {
      running.endTime = now
    }
    const newBlock = {
      id: Date.now() % 1e9 | 0,
      activityId: act.id,
      name: act.name,
      color: act.color || "#E8A838",
      startTime: now,
      endTime: null,
      totalSeconds: 0
    };
    if (mode === "duration" && minutes > 0) {
      newBlock.targetSeconds = Number(minutes) * 60;
      setTimeout(function() {
        try {
          const d2 = getStore(),
            b2 = d2.blocks.find(b => b.id === newBlock.id);
          if (b2 && !b2.endTime) {
            b2.endTime = new Date().toISOString();
            b2.totalSeconds = Number(minutes) * 60;
            setStore(d2)
          }
        } catch {}
      }, Number(minutes) * 60 * 1000);
    }
    data.blocks.push(newBlock);
    setStore(data);
  } catch {}
};

window.__lifetimeAddActivityFromWidget = function(name, emoji) {
  try {
    if (!name || !String(name).trim()) return;
    const data = getStore();
    const id = nextId(data.activities);
    const color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    data.activities.push({
      id: id,
      name: String(name).trim(),
      color: color,
      emoji: emoji || "🙂"
    });
    setStore(data);
  } catch {}
};
