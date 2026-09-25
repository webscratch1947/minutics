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
    var minGap = opts.force ? 60 * 1000 : 10 * 60 * 1000;
    var now = Date.now();
    if (now - _lastSchedulePush < minGap) return Promise.resolve(false);
    _lastSchedulePush = now;
    var s = getTelegramSettings();
    return window.LTAuth.getToken().then(function (idToken) {
      if (!idToken) return false;
      return fetch(window.location.origin + "/api/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({
          token: s.telegramBotToken || "",
          chatId: s.telegramChatId || "",
          time: s.dailyReportTime || "21:00",
          tzOffset: new Date().getTimezoneOffset(),
          text: getTelegramReportData(),
          action: "store", connected: !!s.telegramConnected,
          lastSentDate: s.lastSummaryDate || "",
          lastSentTime: s.lastSummaryTime || ""
        })
      }).then(function (r) { return !!(r && r.ok); }).catch(function () { return false; });
    }).catch(function () { return false; });
  } catch {
    return Promise.resolve(false);
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

/** Send a message — Vercel proxy first, direct Telegram API fallback (was: Iy) */
export async function sendTelegramReport(token, chatId, text) {
  if (!token || !chatId) {
    return { success: false, message: "Add bot token and chat ID first" };
  }
  /* 1) Server proxy — exists only on the deployed website. In the Android
        WebView this route 404s, and piapp has no Firebase session so the
        endpoint may 401; either way we fall through to (2). */
  try {
    const origin = window.location.origin;
    const resp = await fetch(origin + "/api/telegram-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, chatId, text })
    });
    const data = await resp.json();
    if (data && data.ok) return { success: true, message: "Message sent!" };
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
export function getTelegramReportData() {
  try {
    const store = JSON.parse(localStorage.getItem("lifetime_local_db_v1") || "{}");
    const blocks = store.blocks || [];
    const activities = store.activities || [];
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    
    const map = new Map();
    for (const b of blocks) {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
      const cStart = Math.max(bStart, dayStart);
      const cEnd = Math.min(bEnd, dayEnd);
      if (cEnd <= cStart) continue;
      const act = activities.find(a => a.id === b.activityId);
      if (!act) continue;
      const entry = map.get(act.id) || { name: act.name, seconds: 0 };
      entry.seconds += Math.round((cEnd - cStart) / 1000);
      map.set(act.id, entry);
    }
    
    const lines = [...map.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .map(e => {
        const h = Math.floor(e.seconds / 3600);
        const m = Math.floor((e.seconds % 3600) / 60);
        return `${e.name}: ${h > 0 ? h + "h " : ""}${m}m`;
      });
    
    const total = [...map.values()].reduce((s, e) => s + e.seconds, 0);
    const totalH = Math.floor(total / 3600);
    const totalM = Math.floor((total % 3600) / 60);
    
    return `📊 Daily Report — ${now.toLocaleDateString("en-IN")}\n\n` +
      lines.join("\n") +
      `\n\n⏱ Total: ${totalH}h ${totalM}m`;
  } catch {
    return "📊 Daily Report — No data available";
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
