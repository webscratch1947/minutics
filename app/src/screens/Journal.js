import { useState, useMemo, useEffect, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { getStore } from '../lib/storage.js';
import { enrichBlocksForRange } from '../lib/storage.js';
import { cn } from '../lib/cn.js';
import { CircleCheckBig as eh } from 'lucide-react';
import { useBlocks } from '../hooks/useBlocks.js';

/* ─── Helper Functions ──────────────────────────────────────────────────────── */

// Format seconds to human-readable duration
function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return totalSeconds + "s";
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return hours + "h " + minutes + "m";
  return minutes + "m";
}

// Format ISO string to 12-hour time "3:45 PM"
function formatTime12(isoString) {
  var d = new Date(isoString);
  var h = d.getHours();
  var m = d.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ampm;
}

// Format date to "dd/MM/yyyy"
function formatDate(date) {
  var d = new Date(date);
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

// Get day name abbreviation (Mon, Tue, etc.)
function getDayName(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(date).getDay()];
}

// Get day number
function getDayNum(date) {
  return new Date(date).getDate();
}

// Get start of week (Monday)
function getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get start of today (midnight as timestamp)
function getTodayStart() {
  var now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

// Get day start (midnight) for a given timestamp
function getDayStart(ts) {
  var d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// Check if two dates are the same calendar day
function isSameDay(a, b) {
  var da = new Date(a);
  var db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Enrich blocks for a given day range (clips cross-midnight blocks)
function enrichBlocksForDay(blocks, activities, dayStart, dayEnd) {
  var map = new Map();
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    var bStart = new Date(b.startTime).getTime();
    var bEnd = b.endTime ? new Date(b.endTime).getTime() : Date.now();
    var clippedStart = Math.max(bStart, dayStart);
    var clippedEnd = Math.min(bEnd, dayEnd);
    if (clippedEnd <= clippedStart) continue;

    // Find the activity for this block
    var act = null;
    for (var j = 0; j < activities.length; j++) {
      if (activities[j].id === b.activityId) {
        act = activities[j];
        break;
      }
    }
    if (!act) continue;

    var entry = map.get(act.id) || {
      activityId: act.id,
      activityName: act.name,
      activityColor: act.color,
      totalSeconds: 0,
      blocks: []
    };
    entry.totalSeconds += Math.round((clippedEnd - clippedStart) / 1000);
    entry.blocks.push({
      id: b.id,
      startTime: b.startTime,
      endTime: b.endTime || null,
      startedBefore: bStart < dayStart,
      continuesAfter: bEnd > dayEnd,
      durationSeconds: Math.round((clippedEnd - clippedStart) / 1000)
    });
    map.set(act.id, entry);
  }
  var result = Array.from(map.values()).sort(function(a, b) {
    return b.totalSeconds - a.totalSeconds;
  });
  return {
    totalSeconds: result.reduce(function(sum, a) { return sum + a.totalSeconds; }, 0),
    activities: result
  };
}

// Get install date from localStorage
function getInstallDate() {
  try {
    var d = localStorage.getItem("lifetime_install_date");
    return d ? new Date(d) : new Date();
  } catch { return new Date(); }
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export function JournalScreen() {
  // ── Data Queries ────────────────────────────────────────────────────────────

  // Get all blocks from react-query (auto-refreshes every 1s)
  var { data: blocks = [] } = useBlocks();

  // Read activities from localStorage (not exported from shared.js)
  var _activities_state = useState([]);
  var _activities = _activities_state[0];
  var setActivities = _activities_state[1];
  useEffect(function() {
    try {
      var store = JSON.parse(localStorage.getItem("lifetime_local_db_v1") || "{}");
      setActivities(Array.isArray(store.activities) ? store.activities : []);
    } catch {}
  }, []);

  // ── State ───────────────────────────────────────────────────────────────────
  var _expandedDay_state = useState(null);
  var expandedDay = _expandedDay_state[0];
  var setExpandedDay = _expandedDay_state[1];

  // ── Derived Data ────────────────────────────────────────────────────────────
  var now = new Date();
  var dayStartMs = getTodayStart();
  var dayEndMs = dayStartMs + 86400000;

  // Today stats: enriched blocks for today, computed locally
  var todayStats = useMemo(function() {
    return enrichBlocksForDay(blocks, _activities, dayStartMs, dayEndMs);
  }, [blocks, _activities, dayStartMs, dayEndMs]);

  var todayTotalSeconds = todayStats.totalSeconds;

  // Install date (first day of tracking)
  var installDate = getInstallDate();
  var installMidnight = getDayStart(installDate.getTime());

  // Build array of all days from install date to today (newest first)
  var totalDays = Math.floor((now.getTime() - installMidnight) / 86400000) + 1;
  var days = [];
  for (var idx = 0; idx < totalDays; idx++) {
    days.push(new Date(
      installDate.getFullYear(),
      installDate.getMonth(),
      installDate.getDate() + totalDays - 1 - idx
    ));
  }

  // Enrich each day with its blocks (clipped to that day)
  var dayGroups = days.map(function(d) {
    var dStart = getDayStart(d.getTime());
    var dEnd = dStart + 86400000;
    return enrichBlocksForDay(blocks, _activities, dStart, dEnd);
  });

  // ── Streak Calculation ──────────────────────────────────────────────────────
  // Start from today (index 0) if it has time, otherwise start from index 1
  var streakStart = (dayGroups.length > 0 && dayGroups[0].totalSeconds > 0) ? 0 : 1;
  var streak = 0;
  for (var si = streakStart; si < dayGroups.length; si++) {
    if (dayGroups[si].totalSeconds > 0) {
      streak++;
    } else {
      break;
    }
  }

  // ── Week Calendar Grid (Monday–Sunday) ──────────────────────────────────────
  var weekStart = getWeekStart(now);
  var weekDates = [];
  for (var wi = 0; wi < 7; wi++) {
    var wd = new Date(weekStart);
    wd.setDate(weekStart.getDate() + wi);
    weekDates.push(wd);
  }

  // Count how many days this week have logged time
  var weekLogged = 0;
  for (var wl = 0; wl < weekDates.length; wl++) {
    for (var dg = 0; dg < dayGroups.length; dg++) {
      if (isSameDay(days[dg], weekDates[wl]) && dayGroups[dg].totalSeconds > 0) {
        weekLogged++;
        break;
      }
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return jsxs("div", {
    "data-source-file": "screens/Journal_new.js",
    className: "flex flex-col",
    children: [

      // Keyframes: green pulse ring for today markers
      jsx("style", { children: "@keyframes journalPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,.55); } 50% { box-shadow: 0 0 0 7px rgba(22,163,74,0); } }" }, "kf"),

      /* ── 1. Hero + stats + week strip ────────────────────────────────────── */
      jsxs("div", {
        className: "px-4 pt-4",
        children: [

          /* HERO — today's total on a black card with a gold hard shadow */
          jsxs("div", {
            className: "relative overflow-hidden mb-3",
            style: { background: "#111114", borderRadius: "26px", padding: "20px 18px 18px", boxShadow: "7px 7px 0 #F59E0B" },
            children: [
              jsx("div", { style: { position: "absolute", top: "-54px", right: "-42px", width: "170px", height: "170px", borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,.45), rgba(245,158,11,0) 70%)", pointerEvents: "none" } }, "glow"),
              jsxs("div", { className: "flex items-center justify-between mb-3", children: [
                jsx("span", { style: { background: "#FCD34D", color: "#111114", fontSize: "9px", fontWeight: "900", letterSpacing: ".16em", textTransform: "uppercase", padding: "5px 11px", borderRadius: "999px" }, children: "Today" }, "pill"),
                jsx("span", { style: { color: "rgba(255,255,255,.5)", fontSize: "11px", fontWeight: "700", letterSpacing: ".04em" }, children: formatDateLong(now) }, "date")
              ]}, "row"),
              jsx("p", { style: { color: "#fff", fontSize: "50px", lineHeight: "1", fontWeight: "900", letterSpacing: "-.03em", margin: "0" }, children: todayTotalSeconds === 0 ? "0m" : formatDuration(todayTotalSeconds) }, "big"),
              jsx("p", { style: { color: "rgba(255,255,255,.55)", fontSize: "11px", fontWeight: "800", letterSpacing: ".16em", textTransform: "uppercase", margin: "8px 0 0" }, children: "tracked today" }, "sub"),
              todayStats.activities.length > 0 && jsx("div", {
                className: "mt-4 flex h-2.5 w-full overflow-hidden",
                style: { background: "rgba(255,255,255,.12)", borderRadius: "999px" },
                children: todayStats.activities.map(function(a) {
                  return jsx("div", {
                    style: {
                      width: (a.totalSeconds / Math.max(1, todayTotalSeconds) * 100) + "%",
                      backgroundColor: a.activityColor
                    },
                    className: "h-full"
                  }, a.activityId);
                })
              }, "bar")
            ]
          }, "hero"),

          /* Two hard-shadow stat cards */
          jsxs("div", { className: "grid grid-cols-2 gap-3 mb-3", children: [
            jsxs("div", {
              style: { background: "#FCD34D", border: "2px solid #111114", borderRadius: "20px", padding: "14px", boxShadow: "5px 5px 0 #111114" },
              children: [
                jsx("p", { style: { fontSize: "9px", fontWeight: "900", letterSpacing: ".14em", textTransform: "uppercase", color: "#78350F", margin: "0 0 6px" }, children: "🔥 Consistency" }, "l"),
                jsx("p", { style: { fontSize: "26px", fontWeight: "900", color: "#111114", margin: "0", letterSpacing: "-.02em", lineHeight: "1.1" }, children: streak + (streak === 1 ? " day" : " days") }, "n"),
                jsx("p", { style: { fontSize: "11px", fontWeight: "800", color: "#92400E", margin: "5px 0 0" }, children: streak > 0 ? "Keep showing up!" : "Start today!" }, "s")
              ]
            }, "streak"),
            jsxs("div", {
              style: { background: "#fff", border: "2px solid #111114", borderRadius: "20px", padding: "14px", boxShadow: "5px 5px 0 #111114" },
              children: [
                jsx("p", { style: { fontSize: "9px", fontWeight: "900", letterSpacing: ".14em", textTransform: "uppercase", color: "#57534E", margin: "0 0 6px" }, children: "This week" }, "l"),
                jsx("p", { style: { fontSize: "26px", fontWeight: "900", color: "#111114", margin: "0", letterSpacing: "-.02em", lineHeight: "1.1" }, children: weekLogged + (weekLogged === 1 ? " day" : " days") }, "n"),
                jsx("p", { style: { fontSize: "11px", fontWeight: "800", color: "#16A34A", margin: "5px 0 0" }, children: "Stay on track" }, "s")
              ]
            }, "week")
          ]}, "stats"),

          /* Week strip — bordered card with chunky day squares */
          jsx("div", {
            style: { background: "#fff", border: "2px solid #111114", borderRadius: "20px", padding: "12px 10px", boxShadow: "5px 5px 0 #111114" },
            children: jsxs("div", { className: "grid grid-cols-7 gap-1", children: weekDates.map(function(d, i) {
              var isToday = isSameDay(d, now);
              var tracked = false;
              for (var ti = 0; ti < dayGroups.length; ti++) {
                if (isSameDay(days[ti], d) && dayGroups[ti].totalSeconds > 0) { tracked = true; break; }
              }
              return jsxs("div", { className: "flex flex-col items-center gap-1.5", children: [
                jsx("span", { style: { fontSize: "9px", fontWeight: "900", textTransform: "uppercase", letterSpacing: ".06em", color: "#78716C" }, children: getDayName(d) }, "d"),
                jsx("div", {
                  className: "flex items-center justify-center",
                  style: {
                    width: "34px", height: "34px", borderRadius: "12px", fontSize: "13px", fontWeight: "900",
                    border: "2px solid #111114",
                    background: isToday ? "#111114" : (tracked ? "#16A34A" : "#fff"),
                    color: isToday ? "#FCD34D" : (tracked ? "#fff" : "#111114"),
                    boxShadow: isToday ? "3px 3px 0 #F59E0B" : "none"
                  },
                  children: getDayNum(d)
                }, "n"),
                jsx("span", { style: { width: "5px", height: "5px", borderRadius: "50%", background: tracked ? "#16a34a" : "rgba(17,17,20,.15)" } }, "t")
              ]}, i);
            })})
          }, "strip")
        ]
      }, "sec1"),

      /* ── 2. "THIS MONTH" label ────────────────────────────────────────────── */
      jsx("div", {
        className: "px-4 pt-6 pb-3",
        children: jsx("h2", {
          style: { display: "inline-block", fontSize: "12px", fontWeight: "900", letterSpacing: ".18em", textTransform: "uppercase", color: "#111114", borderBottom: "4px solid #F59E0B", paddingBottom: "4px", margin: "0" },
          children: "This month"
        })
      }, "sec2"),

      /* ── 3. Day cards ─────────────────────────────────────────────────────── */
      jsx("div", {
        className: "px-4 flex flex-col gap-3",
        children: dayGroups.map(function(dg, idx) {
          var dayDate = days[idx];
          var isToday = isSameDay(dayDate, now);
          var isOpen = expandedDay === idx;
          var activities = dg.activities;

          return jsxs("div", {
            style: { background: "#fff", border: "2px solid #111114", borderRadius: "20px", boxShadow: isToday ? "5px 5px 0 #F59E0B" : "5px 5px 0 #111114", overflow: "hidden" },
            children: [
              // Day row button (tap to expand)
              jsxs("button", {
                type: "button",
                onClick: function() { setExpandedDay(isOpen ? -1 : idx); },
                className: "w-full flex items-center justify-between",
                style: { padding: "12px 14px", background: "transparent", cursor: "pointer", WebkitTapHighlightColor: "transparent" },
                children: [
                  jsxs("div", { className: "flex items-center gap-3", children: [
                    jsx("div", {
                      className: "flex items-center justify-center shrink-0",
                      style: {
                        width: "44px", height: "44px", borderRadius: "14px",
                        background: isToday ? "#16A34A" : "#111114", color: "#fff",
                        fontSize: "18px", fontWeight: "900",
                        animation: isToday ? "journalPulse 1.6s ease-in-out infinite" : "none"
                      },
                      children: getDayNum(dayDate)
                    }, "sq"),
                    jsxs("div", { style: { textAlign: "left" }, children: [
                      jsx("p", { style: { fontSize: "14px", fontWeight: "900", color: "#111114", margin: 0, letterSpacing: "-.01em" }, children: formatDate(dayDate) }, "dt"),
                      jsx("p", { style: { fontSize: "10px", fontWeight: "800", color: "#A8A29E", margin: "2px 0 0", letterSpacing: ".08em", textTransform: "uppercase" }, children: getDayName(dayDate) }, "wd")
                    ]}, "col")
                  ]}, "left"),
                  jsxs("div", { className: "flex items-center gap-2", children: [
                    isToday && jsx("span", { style: { background: "#FCD34D", border: "1.5px solid #111114", color: "#111114", fontSize: "8px", fontWeight: "900", letterSpacing: ".12em", padding: "3px 8px", borderRadius: "999px" }, children: "TODAY" }, "tp"),
                    dg.totalSeconds > 0
                      ? jsx("span", { style: { background: "#111114", color: "#FCD34D", fontSize: "12px", fontWeight: "900", fontFamily: "ui-monospace, monospace", padding: "7px 12px", borderRadius: "999px" }, children: formatDuration(dg.totalSeconds) }, "dur")
                      : jsx("span", { style: { fontSize: "13px", fontWeight: "800", color: "#D6D3D1" }, children: "\u2014" }, "dur"),
                    jsx("span", { style: { fontSize: "10px", color: "#111114", fontWeight: "900", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }, children: "\u25B6" }, "ar")
                  ]}, "right")
                ]
              }, "btn"),

              // Expanded content: activity groups with individual blocks
              isOpen && (activities.length === 0
                ? jsx("div", {
                    style: { padding: "12px 16px", background: "#FAF8F3", borderTop: "2px solid #111114", fontSize: "12px", fontWeight: "700", color: "#78716C" },
                    children: "No time logged."
                  }, "empty")
                : jsx("div", {
                    style: { background: "#FAF8F3", borderTop: "2px solid #111114", padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: "8px" },
                    children: activities.map(function(a, ai) {
                      var activityTotal = a.blocks.reduce(function(sum, b) {
                        return sum + (b.durationSeconds || 0);
                      }, 0);
                      return jsxs("div", { children: [
                        // Activity header row (color bar + name + total)
                        jsxs("div", {
                          className: "flex items-center justify-between",
                          style: { background: "#fff", border: "1.5px solid rgba(17,17,20,.1)", borderLeft: "6px solid " + a.activityColor, borderRadius: "12px", padding: "9px 12px" },
                          children: [
                            jsx("span", { style: { fontSize: "13px", fontWeight: "900", color: a.activityColor }, children: a.activityName }, "an"),
                            jsx("span", { style: { background: "#111114", color: "#fff", fontSize: "11px", fontWeight: "900", fontFamily: "ui-monospace, monospace", padding: "5px 10px", borderRadius: "999px" }, children: formatDuration(activityTotal) }, "at")
                          ]
                        }, "ahdr"),
                        // Individual block rows
                        a.blocks.map(function(b) {
                          return jsxs("div", {
                            className: "flex items-center justify-between",
                            style: { background: "#fff", border: "1.5px solid rgba(17,17,20,.08)", borderLeft: "4px solid " + a.activityColor + "66", borderRadius: "10px", padding: "7px 12px" },
                            children: [
                              jsxs("span", { style: { fontSize: "12px", color: "#57534E", fontFamily: "ui-monospace, monospace" }, children: [
                                formatTime12(b.startTime),
                                // If block started before this day
                                b.startedBefore && jsx("span", { style: { fontSize: "10px", fontStyle: "italic" }, children: " (from prev. day)" }, "sb"),
                                // End time or running indicator
                                b.continuesAfter
                                  ? jsxs(Fragment, {
                                      children: [
                                        " \u2192 " + formatTime12(b.endTime),
                                        jsx("span", { style: { fontSize: "10px", fontStyle: "italic" }, children: " (continues next day)" }, "ca")
                                      ]
                                    })
                                  : (b.endTime
                                      ? " \u2192 " + formatTime12(b.endTime)
                                      : " \u00B7 running")
                              ] }, "times"),
                              jsx("span", { style: { fontSize: "12px", fontWeight: "900", color: "#111114", fontFamily: "ui-monospace, monospace" }, children: b.durationSeconds ? formatDuration(b.durationSeconds) : "\u2014" }, "bd")
                            ]
                          }, b.id);
                        })
                      ] }, ai);
                    })
                  }, "exp")
              )
            ]
          }, idx);
        })
      }, "sec3"),

      // Bottom spacer
      jsx("div", { className: "h-6" }, "sp")
    ]
  });
}

/* ─── Extra Helper ──────────────────────────────────────────────────────────── */

// Format date to long form "Wednesday, September 9"
function formatDateLong(date) {
  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  var d = new Date(date);
  return dayNames[d.getDay()] + ", " + monthNames[d.getMonth()] + " " + d.getDate();
}
