import { useEffect } from 'react';
import { getStore, setStore, nextId } from '../lib/storage.js';
import { COLOR_PALETTE } from '../lib/constants.js';
import { getTelegramSettings, getTelegramReportData, updateLastSummaryDate, sendTelegramReport } from '../lib/telegram.js';

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
      try {
        const b = window.AndroidBridge;
        if (b) {
          b.syncReportData && b.syncReportData(n.telegramBotToken || "", n.telegramChatId || "", getTelegramReportData(), n.lastSummaryDate || "");
          b.scheduleReport && b.scheduleReport(n.dailyReportTime)
        }
      } catch {}
      const r = new Date,
        o = `${String(r.getHours()).padStart(2,"0")}:${String(r.getMinutes()).padStart(2,"0")}`,
        s = r.toLocaleDateString("en-CA");
      o !== n.dailyReportTime || n.lastSummaryDate === s || (updateLastSummaryDate(s), sendTelegramReport(n.telegramBotToken, n.telegramChatId, getTelegramReportData()))
    };
    e();
    const t = window.setInterval(e, 30 * 1e3);
    return () => window.clearInterval(t)
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
    const newId = nextId(data.activities);
    const color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    data.activities.push({
      id: newId,
      name: String(name).trim(),
      color: color,
      emoji: emoji || "🙂"
    });
    setStore(data);
  } catch {}
};
