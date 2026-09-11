/**
 * telegram.js — Telegram daily report integration
 * 
 * Replaces mangled exports: Ns (getTelegramSettings), gh (saveTelegramSettings),
 *   Iy (sendTelegramReport), RC (getTelegramReportData), UC (updateLastSummaryDate)
 */


const TELEGRAM_KEY = "lifetime_telegram_settings_v1";

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
      lastSummaryDate: data.lastSummaryDate || null
    };
  } catch {
    return {
      telegramBotToken: null,
      telegramChatId: null,
      telegramConnected: false,
      dailyReportTime: "21:00",
      lastSummaryDate: null
    };
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
    lastSummaryDate: existing.lastSummaryDate || null
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
          saved.lastSummaryDate || ""
        );
        bridge.scheduleReport && bridge.scheduleReport(saved.dailyReportTime);
      } else {
        bridge.cancelReport && bridge.cancelReport();
      }
    }
  } catch {}
  
  return saved;
}

/** Send a message via Telegram Bot API through Vercel proxy (was: Iy) */
export async function sendTelegramReport(token, chatId, text) {
  if (!isPro()) {
    return { success: false, message: "Telegram daily reports require an active paid plan." };
  }
  if (!token || !chatId) {
    return { success: false, message: "Add bot token and chat ID first" };
  }
  try {
    const origin = window.location.origin;
    const resp = await fetch(origin + "/api/telegram-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, chatId, text })
    });
    const data = await resp.json();
    return { success: data.ok, message: data.ok ? "Message sent!" : (data.description || "Failed") };
  } catch (err) {
    return { success: false, message: err.message || "Network error" };
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

/** Update last summary date (was: UC) */
export function updateLastSummaryDate(date) {
  try {
    const settings = getTelegramSettings();
    settings.lastSummaryDate = date;
    localStorage.setItem(TELEGRAM_KEY, JSON.stringify(settings));
  } catch {}
}
import { isPro } from './settings.js';
