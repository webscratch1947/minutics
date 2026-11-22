/**
 * telegram.js — Telegram daily report integration
 * 
 * Replaces mangled exports: Ns (getTelegramSettings), gh (saveTelegramSettings),
 *   Iy (sendTelegramReport), RC (getTelegramReportData), UC (updateLastSummaryDate)
 */


const TELEGRAM_KEY = "lifetime_telegram_settings_v1";

/** Turn raw Telegram descriptions into actionable hints */
function friendlyTgError(desc) {
  if (/invalid token|unauthorized/i.test(desc)) return "Bot token looks invalid — copy the fresh token from @BotFather.";
  if (/chat not found/i.test(desc)) return "Chat ID not found — open your bot in Telegram and press Start first, then use your numeric ID from @userinfobot.";
  return desc;
}

/** Trim or return null */
function nullableTrim(str) {
  return (str ?? "").trim() || null;
}

/** Which account produced this message — embedded in every report so the
    receiving chat can tell senders apart (many testers push to one bot). */
function reportAccountLine() {
  try {
    var u = (window.LTAuth && window.LTAuth.currentUser) ? window.LTAuth.currentUser() : null;
    if (u && u.email) return u.email;
    if (u && u.uid) return "uid:" + String(u.uid).slice(0, 14);
  } catch (e) {}
  try {
    if (localStorage.getItem("lt-demo-session-started")) return "Early Access Demo (not signed in)";
  } catch (e) {}
  return "unknown";
}

/** Read telegram settings from localStorage (was: Ns) */
export function getTelegramSettings() {
  try {
    const raw = localStorage.getItem(TELEGRAM_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const token = nullableTrim(data.telegramBotToken);
    const chatId = nullableTrim(data.telegramChatId);
    return {
      telegramBotToken: token,
      telegramChatId: chatId,
      telegramConnected: !!(isPro() && token && chatId),
      dailyReportTime: data.dailyReportTime || "21:00",
      lastSummaryDate: data.lastSummaryDate || null,
      /* Time-of-day the last report actually went out for — lets a report
         fire again the same day when the user changes the report time. */
      lastSummaryTime: data.lastSummaryTime || null
    };
  } catch {
    return {
      telegramBotToken: null,
      telegramChatId: null,
      telegramConnected: false,
      dailyReportTime: "21:00",
      lastSummaryDate: null,
      lastSummaryTime: null
    };
  }
}

/* ── Server schedule snapshot ─────────────────────────────────────────────
   Pushes {bot token, chat id, report time, tz, latest report text, last
   sent marker} to /api/telegram, where it lives in our Firebase
   custom claims. The server cron then sends the daily report even when
   this browser/app is closed. No-op without a Firebase session (piapp). */
var _lastSchedulePush = 0;
export function pushTelegramSchedule(opts) {
  opts = opts || {};
  try {
    if (!window.LTAuth || !window.LTAuth.getToken) return Promise.resolve(false);
    /* force = push immediately (post-send marker must reach the server
       before its next cron ping, or the report double-sends). */
    var minGap = opts.force ? 0 : 10 * 60 * 1000;
    var now = Date.now();
    if (now - _lastSchedulePush < minGap) return Promise.resolve(false);
    _lastSchedulePush = now;
    var s = getTelegramSettings();
    /* Ambient pushes must not wipe the server schedule when this device
       simply has no settings yet (fresh install). Explicit force pushes
       (save / disconnect / post-send) still go through. */
    if (!s.telegramBotToken && !opts.force) return Promise.resolve(false);
    return window.LTAuth.getToken().then(function (idToken) {
      if (!idToken) return false;
      var payload = JSON.stringify({
        token: s.telegramBotToken || "",
        chatId: s.telegramChatId || "",
        time: s.dailyReportTime || "21:00",
        tzOffset: new Date().getTimezoneOffset(),
        text: getTelegramReportData(),
        action: "store", connected: !!s.telegramConnected,
        lastSentDate: s.lastSummaryDate || "",
        lastSentTime: s.lastSummaryTime || ""
      });
      var hdrs = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      };
      var origin = window.location.origin;
      var send = function (base) {
        return fetch(base + "/api/telegram", {
          method: "POST", headers: hdrs, body: payload
        }).then(function (r) { return !!(r && r.ok); });
      };
      return send(origin).then(function (ok) {
        if (ok) return true;
        /* Android WebView origin (appassets.androidplatform.net) has no
           /api route — without this fallback the phone's time changes and
           send markers NEVER reach the server cron. */
        if (origin.indexOf("appassets.androidplatform.net") !== -1) {
          return send("https://app.minutics.com");
        }
        return false;
      }).then(function (ok) {
        /* A FAILED force push is how duplicates are born: the local marker
           says "sent today" while the server still thinks yesterday, and
           the next stale-claims adoption rolls local back → re-send on the
           next app open. Retry once shortly after; the periodic 10-min
           push (which reads the same local markers) heals anything else. */
        if (!ok && opts.force && !opts._retry) {
          setTimeout(function () {
            pushTelegramSchedule({ force: true, _retry: true });
          }, 4000);
        }
        return ok;
      });
    }).catch(function () { return false; });
  } catch {
    return Promise.resolve(false);
  }
}

/* Belt #2: record "report for <date> at <time> already went out" directly
   on the server via action=mark — authenticated by possession of the bot
   token, NOT the Firebase ID token, so it works even when the ID-token
   claims push (action=store) fails. serverSentCurrentReport reads exactly
   this marker before any catch-up send, so this closes the
   "local says sent, server says not-sent → duplicate on next open" gap. */
export function markServerSent(token, date, time) {
  try {
    if (!token || !date) return Promise.resolve(false);
    var origin = window.location.origin;
    var payload = JSON.stringify({ action: "mark", k: token, sd: date, st: time || "" });
    var send = function (base) {
      return fetch(base + "/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      }).then(function (r) { return !!(r && r.ok); });
    };
    return send(origin).then(function (ok) {
      if (ok) return true;
      if (origin.indexOf("appassets.androidplatform.net") !== -1) {
        return send("https://app.minutics.com");
      }
      return false;
    }).catch(function () { return false; });
  } catch { return Promise.resolve(false); }
}

/** True when ANOTHER user already schedules reports with this bot token.
    null = couldn't check (no session / offline) → caller should proceed. */
export function checkTelegramTokenInUse(token) {
  try {
    if (!token || !window.LTAuth || !window.LTAuth.getToken) return Promise.resolve(null);
    return window.LTAuth.getToken().then(function (idToken) {
      if (!idToken) return null;
      var payload = JSON.stringify({ action: "checkToken", token: token });
      var hdrs = { "Content-Type": "application/json", "Authorization": "Bearer " + idToken };
      var origin = window.location.origin;
      var send = function (base) {
        return fetch(base + "/api/telegram", { method: "POST", headers: hdrs, body: payload })
          .then(function (r) { return (r && r.ok) ? r.json() : null; })
          .then(function (d) { return (d && d.ok) ? !!d.used : null; })
          .catch(function () { return null; });
      };
      return send(origin).then(function (res) {
        if (res !== null) return res;
        if (origin.indexOf("appassets.androidplatform.net") !== -1) {
          return send("https://app.minutics.com");
        }
        return null;
      });
    }).catch(function () { return null; });
  } catch {
    return Promise.resolve(null);
  }
}

/** Save telegram settings + sync Android bridge (was: gh) */
export function saveTelegramSettings(settings) {
  const existing = getTelegramSettings();
  const token = nullableTrim(settings.telegramBotToken);
  const chatId = nullableTrim(settings.telegramChatId);
  const saved = {
    telegramBotToken: token,
    telegramChatId: chatId,
    telegramConnected: !!(isPro() && token && chatId),
    dailyReportTime: settings.dailyReportTime || "21:00",
    lastSummaryDate: existing.lastSummaryDate || null,
    lastSummaryTime: existing.lastSummaryTime || null
  };
  localStorage.setItem(TELEGRAM_KEY, JSON.stringify(saved));
  
  // Sync with Android bridge if available
  try {
    const bridge = window.AndroidBridge;
    if (bridge) {
      if (saved.telegramConnected) {
        bridge.syncReportData && bridge.syncReportData(
          saved.telegramBotToken || "",
          saved.telegramChatId || "",
          getTelegramReportData(),
          saved.lastSummaryDate || "",
          saved.lastSummaryTime || ""
        );
        bridge.scheduleReport && bridge.scheduleReport(saved.dailyReportTime);
      } else {
        bridge.cancelReport && bridge.cancelReport();
      }
    }
  } catch {}

  /* Mirror the new schedule to the server (fire-and-forget) so reports can
     be sent while this device is closed; also clears the server copy on
     disconnect. */
  pushTelegramSchedule({ force: true });

  return saved;
}

/** Send a message via Telegram — Vercel proxy first, direct API fallback (was: Iy) */
export async function sendTelegramReport(token, chatId, text) {
  if (!token || !chatId) {
    return { success: false, message: "Add bot token and chat ID first" };
  }
  /* Tag the message with the sending account (skipped when the text already
     carries it — the daily report built by getTelegramReportData does). */
  if (text && text.indexOf("Account:") === -1) {
    text = text + "\n👤 Account: " + reportAccountLine();
  }
  /* 1) Server proxy — the only path that exists on the deployed website.
        In the Android WebView (appassets.androidplatform.net) this route
        does not exist, so a failure here falls through to (2). */
  try {
    var idToken = null;
    if (window.LTAuth && window.LTAuth.getToken) {
      idToken = await window.LTAuth.getToken();
    }
    const origin = window.location.origin;
    const headers = { "Content-Type": "application/json" };
    if (idToken) headers["Authorization"] = "Bearer " + idToken;
    const resp = await fetch(origin + "/api/telegram-send", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ token, chatId, text })
    });
    const data = await resp.json();
    if (data && data.ok) return { success: true, message: "Message sent!" };
    /* Telegram itself rejected it (bad token / chat ID) — that's the real answer */
    if (data && data.description) return { success: false, message: friendlyTgError(data.description) };
  } catch {} /* proxy unreachable — fall through */

  /* 2) Direct call to Telegram. api.telegram.org sends
        Access-Control-Allow-Origin: * so this works from the Android
        WebView and the browser alike, using the user's own bot token. */
  try {
    const resp = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const data = await resp.json();
    if (data && data.ok) return { success: true, message: "Message sent!" };
    return {
      success: false,
      message: (data && data.description)
        ? friendlyTgError(data.description)
        : "Telegram rejected the message. Check token and chat ID."
    };
  } catch {
    return { success: false, message: "Could not reach Telegram" };
  }
}

/** Generate formatted report text for today's activity (was: RC) */
const REPORT_GAINS = ["work", "business", "study", "learn", "learning", "read", "write", "writing", "code", "coding", "project", "deep work", "exercise", "fitness", "gym", "walk", "run", "running", "meditat", "mindful", "yoga", "creat", "hobby", "skill", "develop", "practice", "research", "plan", "journal", "language"];
const REPORT_LOSSES = ["waste", "doom", "scroll", "reel", "short", "instagram", "tiktok", "youtube", "facebook", "snapchat", "twitter", "x (twitter", "netflix", "prime video", "tv", "movie", "gaming", "game", "games", "nothing", "idle", "sleeping late", "binge"];

/* Strip any leading emoji from a name so report lines are text only. */
function stripEmoji(s) {
  return String(s || "").replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "").replace(/\s+/g, " ").trim();
}

function nameHas(name, list) {
  const n = String(name || "").toLowerCase();
  return list.some(k => n.indexOf(k) !== -1);
}

function fmtMinutes(mins) {
  const m = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return (h > 0 ? h + "h " : "") + String(rem).padStart(2, "0") + "m";
}

export function getTelegramReportData() {
  try {
    const now = new Date();
    /* Use the SAME computation the app's Productivity Score tool shows — no
       separate keyword guessing here. boostMin = real productive minutes,
       wasteMin = real Time Waste minutes, both from the live store. */
    let productive = 0, wasted = 0, score = null;
    try {
      const fn = window.LTProductivityScoreToday;
      if (typeof fn === "function") {
        const idx = fn();
        if (idx) {
          productive = Math.round(idx.boostMin || 0);
          wasted = Math.round(idx.wasteMin || 0);
          score = idx.score;
        }
      }
    } catch (e) {}

    const total = productive + wasted;
    /* Use the REAL score the app shows (the tool's 0-100 value), never a
       re-derived ratio. Fall back only if the app hasn't exposed it yet. */
    const productivity = (score !== null && score !== undefined)
      ? String(score)
      : (total > 0 ? ((productive / total) * 100).toFixed(1) : "0.0");

    /* Real activities tracked today, with names only — any per-activity
       emoji is stripped for the MESSAGE (the app UI keeps its emojis). */
    let activityLines = [];
    try {
      const store = JSON.parse(localStorage.getItem("lifetime_local_db_v1") || "{}");
      const blocks = store.blocks || [];
      const activities = store.activities || [];
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const byName = new Map();
      for (const b of blocks) {
        const bs = new Date(b.startTime).getTime();
        const be = b.endTime ? new Date(b.endTime).getTime() : Date.now();
        const cs = Math.max(bs, dayStart), ce = Math.min(be, dayEnd);
        if (ce <= cs) continue;
        const act = activities.find(a => a.id === b.activityId);
        if (!act) continue;
        const name = stripEmoji(act.name || "Activity");
        byName.set(name, (byName.get(name) || 0) + Math.round((ce - cs) / 60000));
      }
      activityLines = [...byName.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, mins]) => "• " + name + ": " + fmtMinutes(mins));
    } catch (e) {}

    const dateStr = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    let out =
      "📊 MINUTICS | DAILY REPORT\n" +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      "📅 Date: " + dateStr + "\n" +
      "👤 Account: " + reportAccountLine() + "\n\n" +
      "📈 Productivity Score: " + productivity + "%\n\n" +
      (activityLines.length > 0
        ? "📋 ACTIVITIES\n" + activityLines.join("\n") + "\n"
        : "📋 ACTIVITIES\nNo activity tracked today.\n") +
      "━━━━━━━━━━━━━━━━━━━━";

    /* Routine tracker — only include if the user actually has routines. */
    try {
      const routines = JSON.parse(localStorage.getItem("lt_routine_items_v1") || "[]");
      if (Array.isArray(routines) && routines.length > 0) {
        const t = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
        const doneState = JSON.parse(localStorage.getItem("lt_routine_done_v1") || "{}");
        const doneIds = (doneState && doneState.date === t && doneState.ids) ? doneState.ids : {};
        const done = routines.filter(r => doneIds[r.id]);
        const notDone = routines.filter(r => !doneIds[r.id]);
        const pct = Math.round((done.length / routines.length) * 100);
        out += "\n🎯 ROUTINE TRACKER\n\n";
        out += "📊 Daily Completion: " + done.length + "/" + routines.length + " (" + pct + "%)\n\n";
        if (done.length > 0) {
          out += "✅ COMPLETED (" + done.length + ")\n";
          done.forEach(r => { out += "• " + stripEmoji(r.name) + "\n"; });
          out += "\n";
        }
        if (notDone.length > 0) {
          out += "❌ NOT COMPLETED (" + notDone.length + ")\n";
          notDone.forEach(r => { out += "• " + stripEmoji(r.name) + "\n"; });
        }
      }
    } catch (e) {}

    return out.trimEnd();
  } catch {
    const d = new Date();
    return "📊 MINUTICS | DAILY REPORT\n━━━━━━━━━━━━━━━━━━━━\n\n📅 Date: " +
      d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) +
      "\n👤 Account: " + reportAccountLine() + "\n\nNo data available.";
  }
}

/** Update last summary date (was: UC) — also records WHICH report time the
    send was for, so changing the time later re-arms the same-day report. */
export function updateLastSummaryDate(date) {
  try {
    const settings = getTelegramSettings();
    settings.lastSummaryDate = date;
    settings.lastSummaryTime = settings.dailyReportTime || "21:00";
    localStorage.setItem(TELEGRAM_KEY, JSON.stringify(settings));
  } catch {}
}
import { isPro } from './settings.js';
