import {
  c,
  la,
  w
} from "../shared.js";

export function LifeHubScreen({
  profile: e
}) {
  const [view, setView] = w.useState("list");
  const _ltv = () => {
    try {
      return JSON.parse(localStorage.getItem("lt_time_value_v1") || "null") || {}
    } catch {
      return {}
    }
  };
  const [salary, setSalary] = w.useState(() => {
    const r = _ltv();
    return r.salary ? String(r.salary) : ""
  }), [hours, setHours] = w.useState(() => {
    const r = _ltv();
    return r.hours ? String(r.hours) : "8"
  }), [days, setDays] = w.useState(() => {
    const r = _ltv();
    return r.days ? String(r.days) : ""
  });
  const s = parseFloat(salary) || 0,
    h = parseFloat(hours) || 8,
    d = parseFloat(days) || 22,
    totalMinutes = h * d * 60,
    perMinute = totalMinutes > 0 ? s / totalMinutes : 0,
    perHour = perMinute * 60,
    perDay = perHour * h;
  const [saved, setSaved] = w.useState(!1), saveTimeValue = () => {
    try {
      localStorage.setItem("lt_time_value_v1", JSON.stringify({
        perMinute,
        salary: s,
        hours: h,
        days: d,
        savedAt: Date.now()
      }))
    } catch {}
    setSaved(!0), setTimeout(() => setSaved(!1), 2000)
  };
  const [screenHours, setScreenHours] = w.useState("");
  const sh = parseFloat(screenHours) || 0,
    remainMs = e && e.dob && e.lifespanYears ? la(e) : 0,
    remainDays = remainMs / 86400000,
    totalScreenHours = sh * remainDays,
    totalScreenYears = totalScreenHours / 24 / 365.25,
    weeklyHours = sh * 7,
    monthlyHours = sh * 30;
  const Header = (icon, title, desc) => c.jsx("div", {
    className: "px-4 pt-5",
    children: c.jsxs("div", {
      className: "lt-tool-top",
      children: [c.jsxs("div", {
        children: [c.jsx("p", {
          className: "lt-tool-kicker",
          children: "Life Hub"
        }), c.jsx("h1", {
          className: "lt-tool-heading",
          children: title
        }), desc && c.jsx("p", {
          className: "lt-tool-description",
          children: desc
        })]
      }), c.jsx("button", {
        type: "button",
        onClick: () => setView("list"),
        className: "lt-tool-close",
        children: "← Back"
      })]
    })
  });
  const AppTile = (icon, label, onClick) => c.jsxs("button", {
    type: "button",
    onClick,
    style: {
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box"
    },
    className: "flex flex-col items-center gap-2 text-center",
    children: [c.jsx("div", {
      className: "w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-bold shadow",
      style: {
        boxSizing: "border-box"
      },
      children: icon
    }), c.jsx("span", {
      className: "text-xs truncate",
      style: {
        width: "100%"
      },
      children: label
    })]
  });
  if (view === "list") return c.jsxs("div", {
    "data-source-file": "screens/LifeHub.js",
    className: "p-4",
    children: [c.jsx("h1", {
      className: "text-2xl font-bold mb-4",
      children: "Life Hub"
    }), c.jsx("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: "16px",
        width: "100%"
      },
      children: [AppTile("₹", "Time Value", () => setView("time")), AppTile("⏱", "Screen Time", () => setView("screen"))]
    })]
  });
  if (view === "time") return c.jsxs("div", {
    "data-source-file": "screens/LifeHub.js",
    className: "pb-6",
    children: [Header("₹", "Time Value Calculator", "Track the value of your time every minute."), c.jsxs("div", {
      className: "px-4",
      children: [c.jsxs("div", {
        className: "flex justify-between border-t border-b py-3 mb-4",
        children: [c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Type"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Finance"
          })]
        }), c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Unit"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Per Minute"
          })]
        }), c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Provider"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Life Hub"
          })]
        })]
      }), c.jsx("div", {
        className: "text-sm font-semibold mb-2",
        children: "Detail"
      }), c.jsxs("div", {
        className: "space-y-2 mb-4",
        children: [c.jsxs("div", {
          children: [c.jsx("label", {
            className: "text-sm font-semibold block mb-1",
            children: "Monthly salary (₹)"
          }), c.jsx("input", {
            type: "number",
            value: salary,
            onChange: t => setSalary(t.target.value),
            className: "w-full border rounded-xl p-2",
            placeholder: "e.g. 50000"
          })]
        }), c.jsxs("div", {
          children: [c.jsx("label", {
            className: "text-sm font-semibold block mb-1",
            children: "Working hours per day"
          }), c.jsx("input", {
            type: "number",
            value: hours,
            onChange: t => setHours(t.target.value),
            className: "w-full border rounded-xl p-2",
            placeholder: "e.g. 8"
          })]
        }), c.jsxs("div", {
          children: [c.jsx("label", {
            className: "text-sm font-semibold block mb-1",
            children: "Working days per month"
          }), c.jsx("input", {
            type: "number",
            value: days,
            onChange: t => setDays(t.target.value),
            className: "w-full border rounded-xl p-2",
            placeholder: "e.g. 22"
          })]
        })]
      }), c.jsxs("div", {
        className: "border rounded-xl p-4 bg-secondary mb-4",
        children: [c.jsx("div", {
          className: "text-sm text-muted-foreground mb-1",
          children: "Your time is worth"
        }), c.jsxs("div", {
          className: "text-2xl font-bold mb-2",
          children: ["₹", perMinute.toFixed(2), " / minute"]
        }), c.jsxs("div", {
          className: "text-sm text-muted-foreground",
          children: ["₹", perHour.toFixed(2), " / hour  •  ₹", perDay.toFixed(2), " / day"]
        })]
      }), c.jsx("button", {
        type: "button",
        onClick: saveTimeValue,
        disabled: perMinute <= 0,
        className: "w-full py-3 bg-primary text-white font-semibold rounded-xl disabled:opacity-40",
        children: saved ? "Saved ✓" : "Save"
      })]
    })]
  });
  return c.jsxs("div", {
    "data-source-file": "screens/LifeHub.js",
    className: "pb-6",
    children: [Header("⏱", "Screen Time → Life Cost", "Monitor your screen time and digital balance."), c.jsxs("div", {
      className: "px-4",
      children: [c.jsxs("div", {
        className: "flex justify-between border-t border-b py-3 mb-4",
        children: [c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Type"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Life"
          })]
        }), c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Unit"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Years"
          })]
        }), c.jsxs("div", {
          className: "flex-1 text-center",
          children: [c.jsx("div", {
            className: "text-xs uppercase tracking-wide text-muted-foreground",
            children: "Provider"
          }), c.jsx("div", {
            className: "text-sm font-semibold",
            children: "Life Hub"
          })]
        })]
      }), c.jsx("div", {
        className: "text-sm font-semibold mb-2",
        children: "Detail"
      }), c.jsx("div", {
        className: "space-y-2 mb-4",
        children: c.jsxs("div", {
          children: [c.jsx("label", {
            className: "text-sm font-semibold block mb-1",
            children: "Daily screen time (hours)"
          }), c.jsx("input", {
            type: "number",
            value: screenHours,
            onChange: t => setScreenHours(t.target.value),
            className: "w-full border rounded-xl p-2",
            placeholder: "e.g. 4"
          })]
        })
      }), c.jsxs("div", {
        className: "border rounded-xl p-4 bg-secondary",
        children: [c.jsx("div", {
          className: "text-sm text-muted-foreground mb-1",
          children: "At this rate, for the rest of your life you'll spend"
        }), c.jsxs("div", {
          className: "text-2xl font-bold mb-2",
          children: [totalScreenYears.toFixed(1), " years on your phone"]
        }), c.jsxs("div", {
          className: "text-sm text-muted-foreground",
          children: [Math.round(weeklyHours), " hrs / week  •  ", Math.round(monthlyHours), " hrs / month"]
        })]
      })]
    })]
  })
}
