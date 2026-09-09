import {
  c,
  la,
  w
} from "../shared.js";

var LT_TOOLS = [
  { id: "timevalue",   icon: null,     symbol: "\u20B9", label: "Time Value Calculator", desc: "Set your salary and know the value of every minute.",         bg: "#DBEAFE", fg: "#2563EB", category: "time",         locked: false },
  { id: "budget",      icon: null,     symbol: "\uD83D\uDCB3", label: "Budget Tracker",     desc: "Manage income, expenses and your balance.",                 bg: "#FEF3C7", fg: "#B45309", category: "finance",      locked: false },
  { id: "emi",         icon: null,     symbol: "\uD83E\uDDEE", label: "EMI Calculator",     desc: "Plan your loans and calculate EMI smartly.",               bg: "#E0E7FF", fg: "#4338CA", category: "finance",      locked: false },
  { id: "compound",    icon: null,     symbol: "\uD83D\uDCC8", label: "Compound Interest",  desc: "See how your money grows when compounding.",               bg: "#FCE7F3", fg: "#BE185D", category: "finance",      locked: false },
  { id: "gram",        icon: null,     symbol: "\uD83D\uDCD6", label: "Knowledge Gram",     desc: "Track what you learn and grow every day.",                 bg: "#D1FAE5", fg: "#047857", category: "productivity", locked: false },
  { id: "tasks",       icon: null,     symbol: "\u2705",       label: "My Tasks",           desc: "Organize your tasks and things to do.",                    bg: "#DCFCE7", fg: "#15803D", category: "productivity", locked: false },
  { id: "routine",     icon: null,     symbol: "\uD83D\uDD52", label: "Routine Trackers",   desc: "Build your daily time table and tick off each slot.",       bg: "#E0F2FE", fg: "#0369A1", category: "time",         locked: false },
  { id: "lifevalue",   icon: null,     symbol: "\u2764\uFE0F", label: "Life Value",         desc: "Calculate and improve your overall life value.",           bg: "#FEE2E2", fg: "#B91C1C", category: "time",         locked: false },
  { id: "opp",         icon: null,     symbol: "\u25C6",       label: "Opportunity Cost",   desc: "See what else your time or money could do.",              bg: "#E0F2FE", fg: "#0369A1", category: "finance",      locked: false },
  { id: "itemcost",    icon: null,     symbol: "\uD83D\uDED2", label: "Item Time Cost Calculator", desc: "See how many hours of work an item really costs.",  bg: "#FFEDD5", fg: "#C2410C", category: "finance",      locked: false },
  { id: "prodscore",   icon: null,     symbol: "\uD83D\uDCCA", label: "Productivity Score", desc: "Your 0-100 score for today, from real logged time.",       bg: "#EEF2FF", fg: "#4F46E5", category: "productivity", locked: false },
  { id: "focus",       icon: null,     symbol: "\uD83C\uDFA7", label: "Focus Mode",         desc: "25-min focus timer with ambient sounds.",                   bg: "#ECFDF5", fg: "#059669", category: "time",         locked: false },
  { id: "wastebudget", icon: null,     symbol: "\u26A0\uFE0F", label: "Time Waste Budget",  desc: "Set a daily waste limit and get a red alert.",             bg: "#FEF2F2", fg: "#DC2626", category: "time",         locked: false },
  { id: "achievements",icon: null,     symbol: "\uD83C\uDFC1", label: "Achievements",       desc: "Milestones and badges you've unlocked.",                   bg: "#FFF7ED", fg: "#C2410C", category: "productivity", locked: false },
  { id: "bucketlist",  icon: null,     symbol: "\uD83C\uDF1F", label: "Bucket List",        desc: "Your dreams and goals \u2014 check them off for life.",    bg: "#F5F3FF", fg: "#6D28D9", category: "productivity", locked: false },
  { id: "sixjars",     icon: "jar",    symbol: "\uD83E\uDEB4", label: "6 Jars",             desc: "Split your salary into 6 purposeful money jars.",          bg: "#F0FDF4", fg: "#166534", category: "finance",      locked: false }
];

var LT_FILTERS = [
  { id: "all",          label: "All" },
  { id: "time",         label: "Time" },
  { id: "finance",      label: "Finance" },
  { id: "productivity", label: "Productivity" }
];

function isProLocal() {
  try {
    var p = JSON.parse(localStorage.getItem("lt_plan_v1") || '"free"');
    return p === "basic" || p === "yearly" || p === "lifetime" || p === "pro";
  } catch { return false; }
}

function getCurrencySymbol() {
  try {
    var c = JSON.parse(localStorage.getItem("lt_currency_v1") || "null");
    if (c && c.symbol) return c.symbol;
  } catch {}
  return "\u20B9";
}

export function LifeHubScreen({
  profile: e
}) {
  const [view, setView] = w.useState("list");
  const [search, setSearch] = w.useState("");
  const [activeCat, setActiveCat] = w.useState("all");
  const [salary, setSalary] = w.useState(() => {
    try { var r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null"); return r && r.salary ? String(r.salary) : ""; } catch { return ""; }
  });
  const [hours, setHours] = w.useState(() => {
    try { var r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null"); return r && r.hours ? String(r.hours) : "8"; } catch { return "8"; }
  });
  const [days, setDays] = w.useState(() => {
    try { var r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null"); return r && r.days ? String(r.days) : ""; } catch { return ""; }
  });
  const s = parseFloat(salary) || 0,
    h = parseFloat(hours) || 8,
    d = parseFloat(days) || 22,
    totalMinutes = h * d * 60,
    perMinute = totalMinutes > 0 ? s / totalMinutes : 0,
    perHour = perMinute * 60,
    perDay = perHour * h;
  const [saved, setSaved] = w.useState(false);
  const saveTimeValue = () => {
    try {
      localStorage.setItem("lt_time_value_v1", JSON.stringify({ perMinute, salary: s, hours: h, days: d, savedAt: Date.now() }));
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };
  const [screenHours, setScreenHours] = w.useState("");
  const sh = parseFloat(screenHours) || 0,
    remainMs = e && e.dob && e.lifespanYears ? la(e) : 0,
    remainDays = remainMs / 86400000,
    totalScreenHours = sh * remainDays,
    totalScreenYears = totalScreenHours / 24 / 365.25,
    weeklyHours = sh * 7,
    monthlyHours = sh * 30;

  var isPro = isProLocal();
  var currSymbol = getCurrencySymbol();

  var tools = LT_TOOLS.map(function (t) {
    var tool = Object.assign({}, t);
    if (tool.id === "timevalue") tool.symbol = currSymbol;
    if (tool.id === "budget" || tool.id === "lifevalue") tool.locked = !isPro;
    return tool;
  });

  var filtered = tools.filter(function (t) {
    if (t.locked) return false;
    var matchesSearch = !search || (t.label + " " + t.desc).toLowerCase().indexOf(search.toLowerCase()) !== -1;
    var matchesCat = activeCat === "all" || t.category === activeCat;
    return matchesSearch && matchesCat;
  });
  var lockedTools = tools.filter(function (t) { return t.locked; });

  var Header = function (title, desc) {
    return c.jsxs("div", {
      className: "px-4 pt-5",
      children: [c.jsxs("div", {
        className: "flex items-start justify-between gap-3",
        children: [c.jsxs("div", {
          children: [c.jsx("p", {
            className: "text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground mb-1",
            children: "Life Hub"
          }), c.jsx("h1", {
            className: "text-[26px] font-black",
            children: title
          }), desc && c.jsx("p", {
            className: "text-[13px] text-muted-foreground mt-1",
            children: desc
          })]
        }), c.jsx("button", {
          type: "button",
          onClick: function () { setView("list"); },
          className: "shrink-0 border border-border bg-white px-3 py-2 text-[13px] font-bold hover:bg-secondary",
          children: "\u2190 Back"
        })]
      })]
    });
  };

  if (view === "list") {
    return c.jsxs("div", {
      className: "p-4",
      children: [
        c.jsx("h1", { className: "text-2xl font-bold mb-4", children: "Life Hub" }),
        c.jsxs("div", {
          className: "relative mb-3",
          children: [
            c.jsx("span", { className: "absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm", children: "\uD83D\uDD0D" }),
            c.jsx("input", {
              type: "text",
              value: search,
              onChange: function (ev) { setSearch(ev.target.value); },
              placeholder: "Search tools...",
              className: "w-full bg-secondary border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm font-medium outline-none focus:border-primary"
            }),
            search && c.jsx("button", {
              type: "button",
              onClick: function () { setSearch(""); },
              className: "absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm",
              children: "\u2715"
            })
          ]
        }),
        c.jsx("div", {
          className: "flex gap-2 mb-4 overflow-x-auto",
          children: LT_FILTERS.map(function (f) {
            return c.jsx("button", {
              type: "button",
              onClick: function () { setActiveCat(f.id); },
              className: "shrink-0 px-3.5 py-1.5 text-xs font-bold border " + (activeCat === f.id ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border"),
              children: f.label
            }, f.id);
          })
        }),
        c.jsx("div", {
          className: "grid grid-cols-2 gap-3",
          children: filtered.map(function (t) {
            return c.jsxs("button", {
              type: "button",
              "data-lifetime-tool": t.id,
              "data-lt-category": t.category,
              "data-lt-tile-injected": "1",
              className: "flex flex-col items-start text-left relative p-4 rounded-2xl bg-white border border-black/[.06] shadow-[0_1px_2px_rgba(0,0,0,.04)] gap-2",
              children: [
                c.jsx("div", {
                  className: "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                  style: { background: t.bg, color: t.fg },
                  children: t.icon === "jar" ? c.jsx("img", { src: "assets/icons/jar-savings.png", alt: "", style: { width: "70%", height: "70%", objectFit: "contain", display: "block" } }) : t.symbol
                }),
                c.jsx("span", { className: "font-bold text-sm text-foreground", children: t.label }),
                c.jsx("span", { className: "text-xs text-muted-foreground leading-[1.3]", children: t.desc })
              ]
            }, t.id);
          })
        }),
        lockedTools.length > 0 && c.jsxs("div", {
          className: "mt-4",
          children: [
            c.jsx("p", { className: "text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2", children: "Premium" }),
            c.jsx("div", {
              className: "grid grid-cols-2 gap-3",
              children: lockedTools.map(function (t) {
                return c.jsxs("button", {
                  type: "button",
                  className: "flex flex-col items-start text-left relative p-4 rounded-2xl bg-white border border-black/[.06] shadow-[0_1px_2px_rgba(0,0,0,.04)] gap-2 opacity-55",
                  children: [
                    c.jsx("span", { className: "absolute top-2.5 right-2.5 text-xs", children: "\uD83D\uDD12" }),
                    c.jsx("div", {
                      className: "w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0",
                      style: { background: t.bg, color: t.fg },
                      children: t.symbol
                    }),
                    c.jsx("span", { className: "font-bold text-sm text-foreground", children: t.label }),
                    c.jsx("span", { className: "text-xs text-muted-foreground leading-[1.3]", children: t.desc })
                  ]
                }, t.id);
              })
            })
          ]
        }),
        filtered.length === 0 && lockedTools.length === 0 && c.jsx("div", {
          className: "text-center py-10 text-sm text-muted-foreground",
          children: "No tools match your search."
        })
      ]
    });
  }

  if (view === "time") {
    return c.jsxs("div", {
      className: "pb-6",
      children: [
        Header("Time Value Calculator", "Track the value of your time every minute."),
        c.jsxs("div", {
          className: "px-4",
          children: [
            c.jsxs("div", { className: "flex justify-between border-t border-b py-3 mb-4", children: [
              c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Type" }), c.jsx("div", { className: "text-sm font-semibold", children: "Finance" })] }),
              c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Unit" }), c.jsx("div", { className: "text-sm font-semibold", children: "Per Minute" })] }),
              c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Provider" }), c.jsx("div", { className: "text-sm font-semibold", children: "Life Hub" })] })
            ]}),
            c.jsx("div", { className: "text-sm font-semibold mb-2", children: "Detail" }),
            c.jsxs("div", { className: "space-y-2 mb-4", children: [
              c.jsxs("div", { children: [c.jsx("label", { className: "text-sm font-semibold block mb-1", children: "Monthly salary (" + currSymbol + ")" }), c.jsx("input", { type: "number", value: salary, onChange: function (t) { setSalary(t.target.value); }, className: "w-full border rounded-xl p-2", placeholder: "e.g. 50000" })] }),
              c.jsxs("div", { children: [c.jsx("label", { className: "text-sm font-semibold block mb-1", children: "Working hours per day" }), c.jsx("input", { type: "number", value: hours, onChange: function (t) { setHours(t.target.value); }, className: "w-full border rounded-xl p-2", placeholder: "e.g. 8" })] }),
              c.jsxs("div", { children: [c.jsx("label", { className: "text-sm font-semibold block mb-1", children: "Working days per month" }), c.jsx("input", { type: "number", value: days, onChange: function (t) { setDays(t.target.value); }, className: "w-full border rounded-xl p-2", placeholder: "e.g. 22" })] })
            ]}),
            c.jsxs("div", { className: "border rounded-xl p-4 bg-secondary mb-4", children: [
              c.jsx("div", { className: "text-sm text-muted-foreground mb-1", children: "Your time is worth" }),
              c.jsxs("div", { className: "text-2xl font-bold mb-2", children: [currSymbol, perMinute.toFixed(2), " / minute"] }),
              c.jsxs("div", { className: "text-sm text-muted-foreground", children: [currSymbol, perHour.toFixed(2), " / hour  \u2022  ", currSymbol, perDay.toFixed(2), " / day"] })
            ]}),
            c.jsx("button", { type: "button", onClick: saveTimeValue, disabled: perMinute <= 0, className: "w-full py-3 bg-primary text-white font-semibold rounded-xl disabled:opacity-40", children: saved ? "Saved \u2713" : "Save" })
          ]
        })
      ]
    });
  }

  return c.jsxs("div", {
    className: "pb-6",
    children: [
      Header("Screen Time \u2192 Life Cost", "Monitor your screen time and digital balance."),
      c.jsxs("div", {
        className: "px-4",
        children: [
          c.jsxs("div", { className: "flex justify-between border-t border-b py-3 mb-4", children: [
            c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Type" }), c.jsx("div", { className: "text-sm font-semibold", children: "Life" })] }),
            c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Unit" }), c.jsx("div", { className: "text-sm font-semibold", children: "Years" })] }),
            c.jsxs("div", { className: "flex-1 text-center", children: [c.jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Provider" }), c.jsx("div", { className: "text-sm font-semibold", children: "Life Hub" })] })
          ]}),
          c.jsx("div", { className: "text-sm font-semibold mb-2", children: "Detail" }),
          c.jsx("div", { className: "space-y-2 mb-4", children: c.jsxs("div", { children: [c.jsx("label", { className: "text-sm font-semibold block mb-1", children: "Daily screen time (hours)" }), c.jsx("input", { type: "number", value: screenHours, onChange: function (t) { setScreenHours(t.target.value); }, className: "w-full border rounded-xl p-2", placeholder: "e.g. 4" })] }) }),
          c.jsxs("div", { className: "border rounded-xl p-4 bg-secondary", children: [
            c.jsx("div", { className: "text-sm text-muted-foreground mb-1", children: "At this rate, for the rest of your life you'll spend" }),
            c.jsxs("div", { className: "text-2xl font-bold mb-2", children: [totalScreenYears.toFixed(1), " years on your phone"] }),
            c.jsxs("div", { className: "text-sm text-muted-foreground", children: [Math.round(weeklyHours), " hrs / week  \u2022  ", Math.round(monthlyHours), " hrs / month"] })
          ]})
        ]
      })
    ]
  });
}
