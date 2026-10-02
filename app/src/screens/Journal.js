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

      // Inject keyframe animation for today's glowing circle
      jsx("style", { children: "@keyframes journalPulse { 0%, 100% { box-shadow: 0 0 8px 2px rgba(22,163,74,0.6); } 50% { box-shadow: 0 0 16px 4px rgba(22,163,74,0.9); } }" }),      /* ── 1. Streak & Week Block ────────────────────────────────────────────── */
      jsxs("div", {
        className: "px-5 pt-5",
        children: [

          // Two cards side by side
          jsxs("div", {
            className: "grid grid-cols-2 gap-3 w-full mb-4",
            children: [

              // Consistency Streak card
              jsxs("div", {
                className: "rounded-2xl p-4",
                style: { backgroundColor: "#FEF3E2", border: "1px solid #FBD38D" },
                children: [
                  jsx("p", {
                    className: "text-xs font-bold uppercase tracking-widest mb-1",
                    style: { color: "#B45309" },
                    children: "Consistency Streak"
                  }),
                  jsxs("p", {
                    className: "text-2xl font-black text-foreground",
                    children: [streak, " ", streak === 1 ? "day" : "days"]
                  }),
                  jsx("p", {
                    className: "text-xs font-semibold mt-1",
                    style: { color: "#B45309" },
                    children: streak > 0 ? "Keep showing up!" : "Start today!"
                  })
                ]
              }),

              // This Week card
              jsxs("div", {
                className: "rounded-2xl p-4 bg-white border border-border",
                children: [
                  jsx("p", {
                    className: "text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1",
                    children: "This Week"
                  }),
                  jsxs("p", {
                    className: "text-2xl font-black text-foreground",
                    children: [weekLogged, " ", weekLogged === 1 ? "day" : "days", " logged"]
                  }),
                  jsx("p", {
                    className: "text-xs text-primary font-semibold mt-1",
                    children: "Stay on track"
                  })
                ]
              })
            ]
          }),

          // Week calendar grid (Mon–Sun)
          jsx("div", {
            className: "grid grid-cols-7 gap-1 w-full mb-2",
            children: weekDates.map(function(d, i) {
              var isToday = isSameDay(d, now);
              // Check if this day has tracked time
              var tracked = false;
              for (var ti = 0; ti < dayGroups.length; ti++) {
                if (isSameDay(days[ti], d) && dayGroups[ti].totalSeconds > 0) {
                  tracked = true;
                  break;
                }
              }
              return jsxs("div", {
                className: "flex flex-col items-center gap-1",
                children: [
                  // Day name label (Mon, Tue, etc.)
                  jsx("span", {
                    className: "text-xs font-bold text-muted-foreground",
                    children: getDayName(d)
                  }),
                   // Day number circle
                   jsx("div", {
                     className: "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                     style: isToday
                       ? { backgroundColor: "#16a34a", color: "#ffffff" }
                       : { color: "#1f2937" },
                     children: getDayNum(d)
                   }),
                  // Tracking dot (green if tracked, transparent if not)
                  jsx("span", {
                    className: "w-1 h-1 rounded-full",
                    style: { backgroundColor: tracked ? "#16a34a" : "transparent" }
                  })
                ]
              }, i);
            })
          })
        ]
      }),

      /* ── 2. Today's Time Summary (primary banner) ──────────────────────────── */
      jsxs("div", {
        className: "bg-primary text-white px-5 pt-10 pb-6",
        children: [
          // Full date: "Wednesday, September 9"
          jsx("p", {
            className: "text-xs font-semibold text-white/50 uppercase tracking-widest mb-1",
            children: formatDateLong(now)
          }),
          // Large time display
          jsx("p", {
            className: "text-4xl font-black",
            children: todayTotalSeconds === 0 ? "0 min" : formatDuration(todayTotalSeconds)
          }),
          // Subtitle
          jsx("p", {
            className: "text-white/50 text-sm mt-1",
            children: "tracked today"
          }),
          // Activity bar (horizontal segments proportional to time)
          todayStats.activities.length > 0 && jsx("div", {
            className: "mt-4 flex h-1.5 w-full bg-white/10 overflow-hidden",
            children: todayStats.activities.map(function(a) {
              return jsx("div", {
                style: {
                  width: (a.totalSeconds / Math.max(1, todayTotalSeconds) * 100) + "%",
                  backgroundColor: a.activityColor
                },
                className: "h-full"
              }, a.activityId);
            })
          })
        ]
      }),

      /* ── 3. "THIS MONTH" Day List ───────────────────────────────────────────── */
      jsxs("div", {
        className: "px-5 pt-5 pb-2",
        children: [
          jsx("h2", {
            className: "text-xs font-semibold text-muted-foreground uppercase tracking-widest",
            children: "This month"
          })
        ]
      }),
      jsx("div", {
        className: "flex flex-col divide-y divide-border border-t border-b border-border",
        children: dayGroups.map(function(dg, idx) {
          var dayDate = days[idx];
          var isToday = isSameDay(dayDate, now);
          var isOpen = expandedDay === idx;
          var activities = dg.activities;

          return jsxs("div", {
            children: [
              // Day row button (tap to expand)
              jsxs("button", {
                type: "button",
                onClick: function() { setExpandedDay(isOpen ? -1 : idx); },
                className: "w-full flex items-center justify-between px-5 py-4 bg-white",
                children: [
                  jsxs("div", {
                    className: "flex items-center gap-2.5",
                    children: [
                       // Circle indicator: solid green+pulse for today, solid black for other days
                       jsx("span", {
                         className: "w-3 h-3 shrink-0 rounded-full",
                         style: isToday
                           ? { backgroundColor: "#16a34a", animation: "journalPulse 1.5s ease-in-out infinite" }
                           : { backgroundColor: "#111827" }
                       }),
                       // Date label
                      jsx("span", {
                        className: "font-bold text-sm text-foreground",
                        children: formatDate(dayDate)
                      })
                    ]
                  }),
                  jsxs("div", {
                    className: "flex items-center gap-3",
                    children: [
                      // Total time for the day
                      jsx("span", {
                        className: "font-mono text-sm font-bold text-muted-foreground",
                        children: dg.totalSeconds > 0 ? formatDuration(dg.totalSeconds) : "\u2014"
                      }),
                      // Expand arrow (rotates when open)
                      jsx("span", {
                        className: "text-muted-foreground text-xs transition-transform " + (isOpen ? "rotate-90" : ""),
                        children: "\u25B6"
                      })
                    ]
                  })
                ]
              }),

              // Expanded content: activity groups with individual blocks
              isOpen && (activities.length === 0
                ? jsx("div", {
                    className: "px-5 py-4 text-sm text-muted-foreground bg-secondary",
                    children: "No time logged."
                  })
                : jsx("div", {
                    className: "bg-secondary",
                    children: activities.map(function(a, ai) {
                      var activityTotal = a.blocks.reduce(function(sum, b) {
                        return sum + (b.durationSeconds || 0);
                      }, 0);
                      return jsxs("div", {
                        children: [
                          // Activity header row (colored bar + name + total)
                          jsxs("div", {
                            className: "flex items-center justify-between px-5 py-2.5",
                            style: { borderLeft: "4px solid " + a.activityColor },
                            children: [
                              jsx("span", {
                                className: "font-bold text-sm",
                                style: { color: a.activityColor },
                                children: a.activityName
                              }),
                              jsx("span", {
                                className: "font-mono text-sm font-bold text-muted-foreground",
                                children: formatDuration(activityTotal)
                              })
                            ]
                          }),
                          // Individual block rows
                          a.blocks.map(function(b) {
                            return jsxs("div", {
                              className: "flex items-center justify-between px-5 py-2 pl-8",
                              style: { borderLeft: "4px solid " + a.activityColor + "40" },
                              children: [
                                jsxs("span", {
                                  className: "text-sm text-muted-foreground",
                                  children: [
                                    formatTime12(b.startTime),
                                    // If block started before this day
                                    b.startedBefore && jsx("span", {
                                      className: "text-xs italic",
                                      children: " (from prev. day)"
                                    }),
                                    // End time or running indicator
                                    b.continuesAfter
                                      ? jsxs(Fragment, {
                                          children: [
                                            " \u2192 " + formatTime12(b.endTime),
                                            jsx("span", {
                                              className: "text-xs italic",
                                              children: " (continues next day)"
                                            })
                                          ]
                                        })
                                      : (b.endTime
                                          ? " \u2192 " + formatTime12(b.endTime)
                                          : " \u00B7 running")
                                  ]
                                }),
                                jsx("span", {
                                  className: "font-mono text-sm font-semibold",
                                  children: b.durationSeconds
                                    ? formatDuration(b.durationSeconds)
                                    : "\u2014"
                                })
                              ]
                            }, b.id);
                          })
                        ]
                      }, ai);
                    })
                  })
              )
            ]
          }, idx);
        })
      }),

      // Bottom spacer
      jsx("div", { className: "h-6" })
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
