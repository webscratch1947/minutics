import {
  Ay,
  CC,
  Hc,
  c,
  uh,
  w
} from "../shared.js";

export function JournalScreen() {
  const {
    data: e
  } = CC(), {
    data: n = []
  } = Ay(), [expandedDay, setExpandedDay] = w.useState(null), s = a => {
    if (a < 60) return `${a}s`;
    const u = Math.floor(a / 3600),
      d = Math.floor(a % 3600 / 60);
    return u > 0 ? `${u}h ${d}m` : `${d}m`
  }, i = a => {
    const date = new Date(a);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12; // Convert 0 to 12 for midnight
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours12}:${minutesStr} ${ampm}`;
  }, l = (e == null ? void 0 : e.totalSeconds) ?? 0, now = new Date, _installRaw = localStorage.getItem("lifetime_install_date"), _installDate = _installRaw ? new Date(_installRaw) : new Date(now.getFullYear(), now.getMonth(), 1), _installMidnight = new Date(_installDate.getFullYear(), _installDate.getMonth(), _installDate.getDate()), _totalDays = Math.floor((now - _installMidnight) / (864e5)) + 1, days = Array.from({
    length: _totalDays
  }, (_, idx) => new Date(_installDate.getFullYear(), _installDate.getMonth(), _installDate.getDate() + _totalDays - 1 - idx)), todayIdx = days.findIndex(d => Hc(d, now)),
  /* A block that crosses midnight belongs, in real terms, to two days —
     count only the slice of it that actually falls within each day
     instead of dumping the whole duration onto whichever day it started
     on. `_startedBefore` / `_continuesAfter` flag the clipped edges so
     the row can say so instead of silently showing a truncated range. */
  _nowMs = now.getTime(),
  _splitForDay = (b, dayStart, dayEnd) => {
    const s = new Date(b.startTime).getTime(),
      eRaw = b.endTime ? new Date(b.endTime).getTime() : _nowMs,
      os = Math.max(s, dayStart),
      oe = Math.min(eRaw, dayEnd);
    if (oe <= os) return null;
    return {
      ...b,
      _rangeStart: os,
      _rangeEnd: oe,
      _startedBefore: s < dayStart,
      _continuesAfter: eRaw > dayEnd,
      durationSeconds: Math.round((oe - os) / 1000)
    }
  },
  activeDay = expandedDay === null ? (todayIdx >= 0 ? todayIdx : 0) : expandedDay, dayGroups = days.map(d => {
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(),
      dayEnd = dayStart + 864e5,
      blocksForDay = n.map(b => _splitForDay(b, dayStart, dayEnd)).filter(Boolean),
      grouped = blocksForDay.reduce((acc, b) => (acc[b.activityId] || (acc[b.activityId] = {
        name: b.activityName || "Unknown",
        color: b.activityColor || "#888",
        blocks: []
      }), acc[b.activityId].blocks.push(b), acc), {}),
      total = blocksForDay.reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
    return {
      date: d,
      grouped,
      total
    }
  });
  const _streakStart = dayGroups.length && dayGroups[0].total > 0 ? 0 : 1;
  let streak = 0;
  for (let _i = _streakStart; _i < dayGroups.length; _i++) {
    if (dayGroups[_i].total > 0) streak++;
    else break;
  }
  const _dow = now.getDay();
  const weekDates = Array.from({
    length: 7
  }, (_, _i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - _dow + _i));
  const weekLogged = weekDates.filter(_d => dayGroups.some(_dg => Hc(_dg.date, _d) && _dg.total > 0)).length;
  const StreakWeekBlock = c.jsxs("div", {
    className: "px-5 pt-5",
    children: [c.jsxs("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(2,1fr)",
        gap: "12px",
        width: "100%"
      },
      className: "mb-4",
      children: [c.jsxs("div", {
        className: "rounded-2xl p-4",
        style: {
          backgroundColor: "#FEF3E2",
          border: "1px solid #FBD38D"
        },
        children: [c.jsx("p", {
          className: "text-xs font-bold uppercase tracking-widest mb-1",
          style: {
            color: "#B45309"
          },
          children: "Consistency Streak"
        }), c.jsxs("p", {
          className: "text-2xl font-black text-foreground",
          children: [streak, " ", streak === 1 ? "day" : "days"]
        }), c.jsx("p", {
          className: "text-xs font-semibold mt-1",
          style: {
            color: "#B45309"
          },
          children: streak > 0 ? "Keep showing up!" : "Start today!"
        })]
      }), c.jsxs("div", {
        className: "rounded-2xl p-4 bg-white border border-border",
        children: [c.jsx("p", {
          className: "text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1",
          children: "This Week"
        }), c.jsxs("p", {
          className: "text-2xl font-black text-foreground",
          children: [weekLogged, " ", weekLogged === 1 ? "day" : "days", " logged"]
        }), c.jsx("p", {
          className: "text-xs text-primary font-semibold mt-1",
          children: "Stay on track"
        })]
      })]
    }), c.jsx("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(7,1fr)",
        gap: "4px",
        width: "100%"
      },
      className: "mb-2",
      children: weekDates.map((d, _i) => {
        const isToday = Hc(d, now);
        const dg = dayGroups.find(x => Hc(x.date, d));
        const tracked = dg && dg.total > 0;
        return c.jsxs("div", {
          className: "flex flex-col items-center gap-1",
          children: [c.jsx("span", {
            className: "text-xs font-bold text-muted-foreground",
            children: uh(d, "EEE")
          }), c.jsx("div", {
            className: "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
            style: isToday ? {
              backgroundColor: "#16a34a",
              color: "#ffffff"
            } : {
              color: "#1f2937"
            },
            children: uh(d, "d")
          }), c.jsx("span", {
            className: "w-1 h-1 rounded-full",
            style: {
              backgroundColor: tracked ? "#16a34a" : "transparent"
            }
          })]
        }, _i)
      })
    })]
  });
  return c.jsxs("div", {
    "data-source-file": "screens/Journal.js",
    className: "flex flex-col",
    children: [StreakWeekBlock, c.jsxs("div", {
      className: "bg-primary text-white px-5 pt-10 pb-6",
      children: [c.jsx("p", {
        className: "text-xs font-semibold text-white/50 uppercase tracking-widest mb-1",
        children: uh(new Date, "EEEE, MMMM d")
      }), c.jsx("p", {
        className: "text-4xl font-black",
        children: l === 0 ? "0 min" : s(l)
      }), c.jsx("p", {
        className: "text-white/50 text-sm mt-1",
        children: "tracked today"
      }), (e == null ? void 0 : e.activities) && e.activities.length > 0 && c.jsx("div", {
        className: "mt-4 flex h-1.5 w-full bg-white/10 overflow-hidden",
        children: e.activities.map(a => c.jsx("div", {
          style: {
            width: `${a.totalSeconds/Math.max(1,l)*100}%`,
            backgroundColor: a.activityColor
          },
          className: "h-full"
        }, a.activityId))
      })]
    }), c.jsx("div", {
      className: "px-5 pt-5 pb-2",
      children: c.jsx("h2", {
        className: "text-xs font-semibold text-muted-foreground uppercase tracking-widest",
        children: "This month"
      })
    }), c.jsx("div", {
      className: "flex flex-col divide-y divide-border border-t border-b border-border",
      children: dayGroups.map((dg, idx) => {
        const isToday = Hc(dg.date, now),
          isOpen = activeDay === idx,
          groupVals = Object.values(dg.grouped);
        return c.jsxs("div", {
          children: [c.jsxs("button", {
            type: "button",
            onClick: () => setExpandedDay(isOpen ? -1 : idx),
            className: "w-full flex items-center justify-between px-5 py-4 bg-white",
            children: [c.jsxs("div", {
              className: "flex items-center gap-2.5",
              children: [isToday && c.jsxs("span", {
                className: "relative flex h-2.5 w-2.5 shrink-0",
                children: [c.jsx("span", {
                  className: "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"
                }), c.jsx("span", {
                  className: "relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"
                })]
              }), c.jsx("span", {
                className: "font-bold text-sm text-foreground",
                children: isToday ? uh(dg.date, "dd/MM/yyyy") : uh(dg.date, "dd/MM/yyyy")
              })]
            }), c.jsxs("div", {
              className: "flex items-center gap-3",
              children: [c.jsx("span", {
                className: "font-mono text-sm font-bold text-muted-foreground",
                children: dg.total > 0 ? s(dg.total) : "—"
              }), c.jsx("span", {
                className: `text-muted-foreground text-xs transition-transform ${isOpen?"rotate-90":""}`,
                children: "▶"
              })]
            })]
          }), isOpen && (groupVals.length === 0 ? c.jsx("div", {
            className: "px-5 py-4 text-sm text-muted-foreground bg-secondary",
            children: "No time logged."
          }) : c.jsx("div", {
            className: "bg-secondary",
            children: groupVals.map((a, u) => c.jsxs("div", {
              children: [c.jsxs("div", {
                className: "flex items-center justify-between px-5 py-2.5",
                style: {
                  borderLeft: `4px solid ${a.color}`
                },
                children: [c.jsx("span", {
                  className: "font-bold text-sm text-foreground",
                  children: a.name
                }), c.jsx("span", {
                  className: "font-mono text-sm font-bold text-muted-foreground",
                  children: s(a.blocks.reduce((f, p) => f + (p.durationSeconds || 0), 0))
                })]
              }), a.blocks.map(f => c.jsxs("div", {
                className: "flex items-center justify-between px-5 py-2 pl-8",
                style: {
                  borderLeft: `4px solid ${a.color}40`
                },
                children: [c.jsxs("span", {
                  className: "text-sm text-muted-foreground",
                  children: [i(f._rangeStart), f._startedBefore && c.jsx("span", {
                    className: "text-xs italic",
                    children: " (from prev. day)"
                  }), f._continuesAfter ? c.jsxs(w.Fragment, {
                    children: [` → ${i(f._rangeEnd)}`, c.jsx("span", {
                      className: "text-xs italic",
                      children: " (continues next day)"
                    })]
                  }) : (f.endTime ? ` → ${i(f._rangeEnd)}` : " · running")]
                }), c.jsx("span", {
                  className: "font-mono text-sm font-semibold",
                  children: f.durationSeconds ? s(f.durationSeconds) : "—"
                })]
              }, f.id))]
            }, u))
          }))]
        }, idx)
      })
    }), c.jsx("div", {
      className: "h-6"
    })]
  })
}
