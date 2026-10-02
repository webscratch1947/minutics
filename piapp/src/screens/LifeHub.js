// Life Hub — Complete screen with 3 views: tool list, time value calculator, and life cost calculator

import { useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { calcRemainingTime } from '../lib/lifeCalc.js';
import { getCurrency, getCurrencySymbol } from '../lib/currency.js';
import { isPro } from '../lib/settings.js';
import { cn } from '../lib/cn.js';
import { Play as nk, Pencil as tk } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Tool Definitions ────────────────────────────────────────────────────────

/** All available tools in the Life Hub */
var LT_TOOLS = [
  { id: "timevalue",   symbol: "timevalue",  label: "Time Value Calculator",     desc: "Know the value of every minute",          category: "time",         locked: false },
  { id: "budget",      symbol: "\uD83D\uDCB3", label: "Budget Tracker",          desc: "Manage income, expenses and balance",     category: "finance",      locked: true  },
  { id: "emi",         symbol: "\uD83E\uDDEE", label: "EMI Calculator",          desc: "Plan loans and calculate EMI",           category: "finance",      locked: false },
  { id: "compound",    symbol: "\uD83D\uDCC8", label: "Compound Interest",       desc: "See money growth with compounding",      category: "finance",      locked: false },
  { id: "gram",        symbol: "\uD83D\uDCD6", label: "Knowledge Gram",          desc: "Track what you learn daily",             category: "productivity", locked: false },
  { id: "tasks",       symbol: "\u2705",       label: "My Tasks",                desc: "Organize tasks and things to do",        category: "productivity", locked: false },
  { id: "routine",     symbol: "\uD83D\uDD52", label: "Routine Trackers",        desc: "Build daily timetable, tick off slots",  category: "time",         locked: false },
  { id: "lifevalue",   symbol: "\u2764\uFE0F", label: "Life Value",              desc: "Calculate and improve overall life value",category: "time",         locked: true  },
  { id: "opp",         symbol: "\u25C6",       label: "Opportunity Cost",        desc: "See what time/money could do instead",   category: "finance",      locked: false },
  { id: "itemcost",    symbol: "\uD83D\uDED2", label: "Item Time Cost Calculator",desc: "Hours of work an item really costs",    category: "finance",      locked: false },
  { id: "prodscore",   symbol: "\uD83D\uDCCA", label: "Productivity Score",      desc: "0-100 score for today from logged time", category: "productivity", locked: false },
  { id: "focus",       symbol: "\uD83C\uDFA7", label: "Focus Mode",              desc: "25-min focus timer with ambient sounds", category: "time",         locked: false },
  { id: "wastebudget", symbol: "\u26A0\uFE0F", label: "Time Waste Budget",       desc: "Daily waste limit with red alert",       category: "time",         locked: false },
  { id: "achievements",symbol: "\uD83C\uDFC1", label: "Achievements",            desc: "Milestones and badges unlocked",         category: "productivity", locked: false },
  { id: "bucketlist",  symbol: "\uD83C\uDF1F", label: "Bucket List",             desc: "Dreams/goals \u2014 check off for life", category: "productivity", locked: false },
  { id: "sixjars",     symbol: "\uD83E\uDED4", label: "6 Jars",                  desc: "Split salary into 6 money jars",         category: "finance",      locked: false }
];

/** Category filter options */
var LT_FILTERS = [
  { key: "all",          label: "All" },
  { key: "time",         label: "Time" },
  { key: "finance",      label: "Finance" },
  { key: "productivity", label: "Productivity" }
];

// ─── Color Palettes for Tool Tiles ───────────────────────────────────────────

var TOOL_COLORS = {
  timevalue:   { bg: "#DBEAFE", fg: "#2563EB" },
  budget:      { bg: "#FEF3C7", fg: "#B45309" },
  emi:         { bg: "#E0E7FF", fg: "#4338CA" },
  compound:    { bg: "#FCE7F3", fg: "#BE185D" },
  gram:        { bg: "#D1FAE5", fg: "#047857" },
  tasks:       { bg: "#DCFCE7", fg: "#15803D" },
  routine:     { bg: "#E0F2FE", fg: "#0369A1" },
  lifevalue:   { bg: "#FEE2E2", fg: "#B91C1C" },
  opp:         { bg: "#E0F2FE", fg: "#0369A1" },
  itemcost:    { bg: "#FFEDD5", fg: "#C2410C" },
  prodscore:   { bg: "#EEF2FF", fg: "#4F46E5" },
  focus:       { bg: "#ECFDF5", fg: "#059669" },
  wastebudget: { bg: "#FEF2F2", fg: "#DC2626" },
  achievements:{ bg: "#FFF7ED", fg: "#C2410C" },
  bucketlist:  { bg: "#F5F3FF", fg: "#6D28D9" },
  sixjars:     { bg: "#F0FDF4", fg: "#166534" }
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function LifeHubScreen({ profile }) {
  // ── View state: "list" (default), "time" (Time Value Calc), "life" (Screen Time → Life Cost)
  var _viewState = useState("list");
  var view = _viewState[0];
  var setView = _viewState[1];

  // ── Search bar state
  var _searchState = useState("");
  var search = _searchState[0];
  var setSearch = _searchState[1];

  // ── Active category filter ("all", "time", "finance", "productivity")
  var _catState = useState("all");
  var activeCat = _catState[0];
  var setActiveCat = _catState[1];

  // ── Time Value Calculator inputs (loaded from localStorage)
  var _salaryState = useState(function () {
    try {
      var stored = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
      return stored && stored.salary ? String(stored.salary) : "";
    } catch { return ""; }
  });
  var salary = _salaryState[0];
  var setSalary = _salaryState[1];

  var _hoursState = useState(function () {
    try {
      var stored = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
      return stored && stored.hours ? String(stored.hours) : "8";
    } catch { return "8"; }
  });
  var hours = _hoursState[0];
  var setHours = _hoursState[1];

  var _daysState = useState(function () {
    try {
      var stored = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
      return stored && stored.days ? String(stored.days) : "";
    } catch { return ""; }
  });
  var days = _daysState[0];
  var setDays = _daysState[1];

  // ── Time Value calculated values
  var salaryNum = parseFloat(salary) || 0;
  var hoursNum = parseFloat(hours) || 8;
  var daysNum = parseFloat(days) || 22;
  var totalMinutes = hoursNum * daysNum * 60;
  var perMinute = totalMinutes > 0 ? salaryNum / totalMinutes : 0;
  var perHour = perMinute * 60;
  var perDay = perHour * hoursNum;

  // ── "Saved" indicator state
  var _savedState = useState(false);
  var saved = _savedState[0];
  var setSaved = _savedState[1];

  /** Save time value data to localStorage */
  var saveTimeValue = function () {
    try {
      localStorage.setItem("lt_time_value_v1", JSON.stringify({
        perMinute: perMinute,
        salary: salaryNum,
        hours: hoursNum,
        days: daysNum,
        savedAt: Date.now()
      }));
    } catch { /* ignore */ }
    setSaved(true);
    setTimeout(function () { setSaved(false); }, 2000);
  };

  // ── Screen Time → Life Cost input
  var _screenHoursState = useState("");
  var screenHours = _screenHoursState[0];
  var setScreenHours = _screenHoursState[1];

  // ── Life Cost calculated values
  var screenHoursNum = parseFloat(screenHours) || 0;
  var remainMs = (profile && profile.dob && profile.lifespanYears) ? calcRemainingTime(profile) : 0;
  var remainDays = remainMs / 86400000;
  var totalScreenHours = screenHoursNum * remainDays;
  var totalScreenYears = totalScreenHours / 24 / 365.25;
  var weeklyHours = screenHoursNum * 7;
  var monthlyHours = screenHoursNum * 30;

  // ── Determine pro status and currency
  // isPro is imported from settings.js
  var currSymbol = getCurrencySymbol();

  // ── Apply dynamic colors to tools
  var tools = LT_TOOLS.map(function (t) {
    var tool = Object.assign({}, t);
    // Time Value Calculator uses the user's currency symbol
    if (tool.id === "timevalue") tool.symbol = "\u23F1\uFE0F";
    // Budget and Life Value are PRO-only
    if (tool.id === "budget" || tool.id === "lifevalue") tool.locked = !isPro();
    return tool;
  });

  // ── Filter tools by search and category (exclude locked from main grid)
  var filtered = tools.filter(function (t) {
    if (t.locked) return false;
    var matchesSearch = !search ||
      (t.label + " " + t.desc).toLowerCase().indexOf(search.toLowerCase()) !== -1;
    var matchesCat = activeCat === "all" || t.category === activeCat;
    return matchesSearch && matchesCat;
  });

  // ── Separate locked tools for Premium section (respects search + category)
  var lockedTools = tools.filter(function (t) { return t.locked; });
  var filteredLocked = lockedTools.filter(function (t) {
    var matchesSearch = !search ||
      (t.label + " " + t.desc).toLowerCase().indexOf(search.toLowerCase()) !== -1;
    var matchesCat = activeCat === "all" || t.category === activeCat;
    return matchesSearch && matchesCat;
  });

  // ── Shared header component for sub-views (time, life)
  var Header = function (title, desc) {
    return jsxs("div", {
      className: "px-4 pt-5",
      children: [
        jsxs("div", {
          className: "flex items-start justify-between gap-3",
          children: [
            jsxs("div", {
              children: [
                jsx("p", {
                  className: "text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground mb-1",
                  children: "Life Hub"
                }),
                jsx("h1", {
                  className: "text-[26px] font-black",
                  children: title
                }),
                desc && jsx("p", {
                  className: "text-[13px] text-muted-foreground mt-1",
                  children: desc
                })
              ]
            }),
            jsx("button", {
              type: "button",
              onClick: function () { setView("list"); },
              className: "shrink-0 border border-border bg-white px-3 py-2 text-[13px] font-bold hover:bg-secondary",
              children: "\u2190 Back"
            })
          ]
        })
      ]
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: "list" — Tool Grid
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "list") {
    var isDefaultView = !search && activeCat === "all";
    var catLabel = { time: "Time", finance: "Finance", productivity: "Productivity" };
    var colorsOf = function (t) { return TOOL_COLORS[t.id] || { bg: "#F3F4F6", fg: "#374151" }; };

    var iconTile = function (t, cls, white) {
      var c = colorsOf(t);
      return jsx("div", {
        className: cls,
        style: white ? { background: "#fff" } : { background: c.bg, color: c.fg },
        children: t.id === "sixjars"
          ? jsx("img", {
              src: "assets/icons/jar-savings.png",
              alt: "",
              style: { width: "70%", height: "70%", objectFit: "contain", display: "block" }
            })
          : t.symbol
      });
    };

    var chevron = function (size) {
      return jsx("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round",
        children: jsx("path", { d: "m9 18 6-6-6-6" })
      });
    };

    // ── Featured Time Value card — default view only ──
    var featured = null;
    if (isDefaultView) featured = filtered.filter(function (t) { return t.id === "timevalue"; })[0] || null;
    var rest = featured ? filtered.filter(function (t) { return t.id !== "timevalue"; }) : filtered;

    // ── Wide spotlight card (Routine Trackers) — default view only ──
    var spotlight = null;
    if (isDefaultView) {
      spotlight = rest.filter(function (t) { return t.id === "routine"; })[0] || null;
      if (spotlight) rest = rest.filter(function (t) { return t.id !== "routine"; });
    }

    // ── An odd trailing tile becomes full-width so no column dangles ──
    var tail = null;
    if (!spotlight && rest.length % 2 === 1) {
      tail = rest[rest.length - 1];
      rest = rest.slice(0, -1);
    }
    var head = rest.slice(0, 4);
    var body = rest.slice(4);

    var smallCard = function (t) {
      var c = colorsOf(t);
      return jsxs("button", {
        type: "button",
        "data-lifetime-tool": t.id,
        "data-lt-category": t.category,
        "data-lt-tile-injected": "1",
        className: "flex flex-col items-start text-left relative p-4 rounded-2xl bg-white border border-black/[.06] shadow-[0_1px_3px_rgba(0,0,0,.05)] gap-2 transition hover:border-black/15 hover:shadow-[0_6px_18px_rgba(0,0,0,.08)] active:scale-[.98]",
        children: [
          iconTile(t, "w-11 h-11 rounded-xl flex items-center justify-center text-[21px] shrink-0"),
          jsx("span", { className: "font-bold text-sm text-foreground leading-snug", children: t.label }),
          jsx("span", { className: "text-xs text-muted-foreground leading-[1.35]", children: t.desc }),
          jsx("span", {
            className: "mt-auto pt-1 px-1.5 py-0.5 rounded-md bg-secondary text-[9px] font-black uppercase tracking-wider text-muted-foreground",
            children: catLabel[t.category] || t.category
          })
        ]
      }, t.id);
    };

    var featuredCard = featured && jsxs("button", {
      type: "button",
      "data-lifetime-tool": featured.id,
      "data-lt-category": featured.category,
      "data-lt-tile-injected": "1",
      className: "col-span-2 w-full relative overflow-hidden rounded-3xl p-4 text-left bg-foreground text-background transition active:scale-[.99]",
      children: [
        jsx("div", { className: "absolute -right-10 -top-12 w-40 h-40 rounded-full pointer-events-none", style: { background: "rgba(255,255,255,.07)" } }),
        jsx("div", { className: "absolute -right-4 top-16 w-24 h-24 rounded-full pointer-events-none", style: { background: "rgba(255,255,255,.05)" } }),
        jsx("div", { className: "absolute -left-10 -bottom-14 w-32 h-32 rounded-full pointer-events-none", style: { background: "rgba(255,59,48,.18)" } }),
        jsxs("div", { className: "relative flex items-center gap-3.5", children: [
          iconTile(featured, "w-12 h-12 rounded-2xl flex items-center justify-center text-[23px] shrink-0", true),
          jsxs("div", { className: "flex-1 min-w-0", children: [
            jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
              jsx("span", { className: "font-black text-[17px] leading-tight", children: featured.label }),
              jsx("span", {
                className: "px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0",
                style: { background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)" },
                children: "Featured"
              })
            ]}),
            jsx("span", {
              className: "block text-xs mt-1 leading-[1.45]",
              style: { color: "rgba(253,251,247,.65)" },
              children: featured.desc
            })
          ]}),
          jsx("div", { className: "w-9 h-9 rounded-full bg-white text-foreground flex items-center justify-center shrink-0", children: chevron(15) })
        ]})
      ]
    }, "featured");

    var spotlightCard = spotlight && (function () {
      var c = colorsOf(spotlight);
      return jsxs("button", {
        type: "button",
        "data-lifetime-tool": spotlight.id,
        "data-lt-category": spotlight.category,
        "data-lt-tile-injected": "1",
        className: "col-span-2 flex items-center gap-3 p-3.5 rounded-2xl text-left transition active:scale-[.99]",
        style: { background: c.bg, border: "1px solid " + c.fg + "2e" },
        children: [
          iconTile(spotlight, "w-12 h-12 rounded-xl flex items-center justify-center text-[23px] shrink-0", true),
          jsxs("div", { className: "flex-1 min-w-0", children: [
            jsx("span", { className: "block font-black text-[15px] leading-tight", style: { color: c.fg }, children: spotlight.label }),
            jsx("span", {
              className: "block text-xs mt-0.5 leading-[1.4]",
              style: { color: "rgba(17,17,17,.6)" },
              children: spotlight.desc
            })
          ]}),
          jsx("div", { className: "w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0", style: { color: c.fg }, children: chevron(14) })
        ]
      }, "spotlight");
    })();

    var tailCard = tail && (function () {
      var c = colorsOf(tail);
      return jsxs("button", {
        type: "button",
        "data-lifetime-tool": tail.id,
        "data-lt-category": tail.category,
        "data-lt-tile-injected": "1",
        className: "col-span-2 flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-black/[.06] shadow-[0_1px_3px_rgba(0,0,0,.05)] text-left transition hover:border-black/15 hover:shadow-[0_6px_18px_rgba(0,0,0,.08)] active:scale-[.99]",
        children: [
          iconTile(tail, "w-11 h-11 rounded-xl flex items-center justify-center text-[21px] shrink-0"),
          jsxs("div", { className: "flex-1 min-w-0", children: [
            jsx("span", { className: "block font-bold text-sm text-foreground leading-snug", children: tail.label }),
            jsx("span", { className: "block text-xs text-muted-foreground leading-[1.35] mt-0.5", children: tail.desc })
          ]}),
          jsx("span", {
            className: "shrink-0 px-1.5 py-0.5 rounded-md bg-secondary text-[9px] font-black uppercase tracking-wider text-muted-foreground",
            children: catLabel[tail.category] || tail.category
          }),
          jsx("div", { className: "w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0", children: chevron(14) })
        ]
      }, "tail");
    })();

    return jsxs("div", {
      className: "flex flex-col bg-background p-4 pb-6",
      children: [
        // ── Title block ──
        jsxs("div", { className: "mb-4", children: [
          jsxs("div", { className: "flex items-center justify-between gap-3", children: [
            jsx("h1", { className: "text-[27px] font-black leading-none tracking-tight", children: "Life Hub" }),
            jsxs("span", {
              className: "shrink-0 px-2.5 py-1 rounded-full bg-white border border-black/[.07] text-[10px] font-black uppercase tracking-wider text-muted-foreground",
              children: [tools.length, " tools"]
            })
          ]}),
          jsx("p", {
            className: "text-[13px] text-muted-foreground mt-1.5 font-medium",
            children: "Every Minutics tool — search, filter and open."
          })
        ]}),

        // ── Search bar ──
        jsxs("div", {
          className: "relative mb-3",
          children: [
            jsx("svg", {
              className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none",
              width: 15, height: 15, viewBox: "0 0 24 24", fill: "none",
              stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round",
              children: jsxs("g", { children: [jsx("circle", { cx: 11, cy: 11, r: 8 }), jsx("path", { d: "m21 21-4.3-4.3" })] })
            }),
            jsx("input", {
              type: "text",
              value: search,
              onChange: function (ev) { setSearch(ev.target.value); },
              placeholder: "Search tools...",
              className: "w-full bg-white border border-black/[.07] rounded-full pl-10 pr-11 py-2.5 text-sm font-medium outline-none focus:border-foreground/40 shadow-[0_1px_2px_rgba(0,0,0,.04)] placeholder:text-muted-foreground placeholder:font-normal"
            }),
            search && jsx("button", {
              type: "button",
              onClick: function () { setSearch(""); },
              className: "absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-secondary text-muted-foreground text-xs font-bold flex items-center justify-center",
              children: "\u2715"
            })
          ]
        }),

        // ── Category filter pills ──
        jsx("div", {
          className: "flex gap-2 mb-4 overflow-x-auto no-scrollbar",
          children: LT_FILTERS.map(function (f) {
            return jsx("button", {
              type: "button",
              onClick: function () { setActiveCat(f.key); },
              className: "shrink-0 px-4 py-1.5 text-xs font-bold rounded-full border transition-colors " +
                (activeCat === f.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-white text-foreground border-black/[.07]"),
              children: f.label
            }, f.key);
          })
        }),

        // ── Bento tool grid ──
        jsx("div", {
          className: "grid grid-cols-2 gap-3",
          children: [
            featuredCard,
            head.map(smallCard),
            spotlightCard,
            body.map(smallCard),
            tailCard
          ]
        }),

        // ── Empty search state ──
        filtered.length === 0 && jsxs("div", {
          className: "text-center py-10",
          children: [
            jsx("div", { className: "text-2xl mb-2", children: "\uD83D\uDD0D" }),
            jsx("p", { className: "text-sm font-bold text-foreground", children: "No tools match your search." }),
            search && jsx("button", {
              type: "button",
              onClick: function () { setSearch(""); },
              className: "mt-3 px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-bold",
              children: "Clear search"
            })
          ]
        }),

        // ── Premium section (locked tools) ──
        filteredLocked.length > 0 && jsxs("div", {
          className: "mt-5 pb-4",
          children: [
            jsxs("div", {
              className: "flex items-center gap-2 mb-2.5",
              children: [
                jsx("p", {
                  className: "text-[10px] font-black text-muted-foreground uppercase tracking-[.14em]",
                  children: "Premium"
                }),
                jsx("div", { className: "h-px flex-1 bg-black/[.07]" })
              ]
            }),
            jsx("div", {
              className: "grid grid-cols-2 gap-3",
              children: filteredLocked.map(function (t) {
                var c = colorsOf(t);
                return jsxs("button", {
                  type: "button",
                  "data-lifetime-tool": t.id,
                  "data-lt-category": t.category,
                  "data-lt-tile-injected": "1",
                  onClick: function () {
                    alert("This is a Premium Feature. Upgrade to access it.");
                  },
                  className: "flex flex-col items-start text-left relative p-4 rounded-2xl bg-foreground text-background border border-white/10 gap-2 transition hover:opacity-90 active:scale-[.98]",
                  children: [
                    jsx("span", {
                      className: "absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-white text-foreground text-[9px] font-black uppercase tracking-wider",
                      children: "PRO"
                    }),
                    iconTile(t, "w-11 h-11 rounded-xl flex items-center justify-center text-[21px] shrink-0"),
                    jsx("span", { className: "font-bold text-sm text-background leading-snug", children: t.label }),
                    jsx("span", {
                      className: "text-xs leading-[1.35]",
                      style: { color: "rgba(253,251,247,.6)" },
                      children: t.desc
                    })
                  ]
                }, t.id);
              })
            })
          ]
        })
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: "time" — Time Value Calculator
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "time") {
    return jsxs("div", {
      className: "flex flex-col bg-background pb-6",
      children: [
        // ── Header with back button ──
        Header("Time Value Calculator", "Know the value of every minute."),

        jsxs("div", {
          className: "px-4",
          children: [
            // ── Metadata row ──
            jsxs("div", {
              className: "flex justify-between border-t border-b py-3 mb-4",
              children: [
                jsxs("div", {
                  className: "flex-1 text-center",
                  children: [
                    jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Type" }),
                    jsx("div", { className: "text-sm font-semibold", children: "Finance" })
                  ]
                }),
                jsxs("div", {
                  className: "flex-1 text-center",
                  children: [
                    jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Unit" }),
                    jsx("div", { className: "text-sm font-semibold", children: "Per Minute" })
                  ]
                }),
                jsxs("div", {
                  className: "flex-1 text-center",
                  children: [
                    jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Provider" }),
                    jsx("div", { className: "text-sm font-semibold", children: "Life Hub" })
                  ]
                })
              ]
            }),

            // ── Section label ──
            jsx("div", {
              className: "text-sm font-semibold mb-2",
              children: "Detail"
            }),

            // ── Input fields ──
            jsxs("div", {
              className: "space-y-2 mb-4",
              children: [
                // Monthly salary input with currency prefix
                jsxs("div", {
                  children: [
                    jsx("label", {
                      className: "text-sm font-semibold block mb-1",
                      children: "Monthly salary (" + currSymbol + ")"
                    }),
                    jsx("input", {
                      type: "number",
                      value: salary,
                      onChange: function (ev) { setSalary(ev.target.value); },
                      className: "w-full border rounded-xl p-2",
                      placeholder: "e.g. 50000"
                    })
                  ]
                }),
                // Working hours per day
                jsxs("div", {
                  children: [
                    jsx("label", {
                      className: "text-sm font-semibold block mb-1",
                      children: "Working hours per day"
                    }),
                    jsx("input", {
                      type: "number",
                      value: hours,
                      onChange: function (ev) { setHours(ev.target.value); },
                      className: "w-full border rounded-xl p-2",
                      placeholder: "e.g. 8"
                    })
                  ]
                }),
                // Working days per month
                jsxs("div", {
                  children: [
                    jsx("label", {
                      className: "text-sm font-semibold block mb-1",
                      children: "Working days per month"
                    }),
                    jsx("input", {
                      type: "number",
                      value: days,
                      onChange: function (ev) { setDays(ev.target.value); },
                      className: "w-full border rounded-xl p-2",
                      placeholder: "e.g. 22"
                    })
                  ]
                })
              ]
            }),

            // ── Display card ──
            jsxs("div", {
              className: "border rounded-xl p-4 bg-secondary mb-4",
              children: [
                jsx("div", {
                  className: "text-sm text-muted-foreground mb-1",
                  children: "Your time is worth"
                }),
                jsxs("div", {
                  className: "text-2xl font-bold mb-2",
                  children: [currSymbol, perMinute.toFixed(2), " / minute"]
                }),
                jsxs("div", {
                  className: "text-sm text-muted-foreground",
                  children: [
                    currSymbol, perHour.toFixed(2), " / hour  \u2022  ",
                    currSymbol, perDay.toFixed(2), " / day"
                  ]
                })
              ]
            }),

            // ── Save button ──
            jsx("button", {
              type: "button",
              onClick: saveTimeValue,
              disabled: perMinute <= 0,
              className: "w-full py-3 bg-primary text-white font-semibold rounded-xl disabled:opacity-40",
              children: saved ? "Saved \u2713" : "Save"
            })
          ]
        })
      ]
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: "life" — Screen Time → Life Cost
  // ═══════════════════════════════════════════════════════════════════════════
  return jsxs("div", {
    className: "flex flex-col bg-background pb-6",
    children: [
      // ── Header with back button ──
      Header("Screen Time \u2192 Life Cost", "See how screen time adds up over a lifetime."),

      jsxs("div", {
        className: "px-4",
        children: [
          // ── Metadata row ──
          jsxs("div", {
            className: "flex justify-between border-t border-b py-3 mb-4",
            children: [
              jsxs("div", {
                className: "flex-1 text-center",
                children: [
                  jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Type" }),
                  jsx("div", { className: "text-sm font-semibold", children: "Life" })
                ]
              }),
              jsxs("div", {
                className: "flex-1 text-center",
                children: [
                  jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Unit" }),
                  jsx("div", { className: "text-sm font-semibold", children: "Years" })
                ]
              }),
              jsxs("div", {
                className: "flex-1 text-center",
                children: [
                  jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Provider" }),
                  jsx("div", { className: "text-sm font-semibold", children: "Life Hub" })
                ]
              })
            ]
          }),

          // ── Section label ──
          jsx("div", {
            className: "text-sm font-semibold mb-2",
            children: "Detail"
          }),

          // ── Input: daily screen time ──
          jsx("div", {
            className: "space-y-2 mb-4",
            children: jsxs("div", {
              children: [
                jsx("label", {
                  className: "text-sm font-semibold block mb-1",
                  children: "Daily screen time (hours)"
                }),
                jsx("input", {
                  type: "number",
                  value: screenHours,
                  onChange: function (ev) { setScreenHours(ev.target.value); },
                  className: "w-full border rounded-xl p-2",
                  placeholder: "e.g. 4"
                })
              ]
            })
          }),

          // ── Display card ──
          jsxs("div", {
            className: "border rounded-xl p-4 bg-secondary",
            children: [
              jsx("div", {
                className: "text-sm text-muted-foreground mb-1",
                children: "At this rate, for the rest of your life you'll spend"
              }),
              jsxs("div", {
                className: "text-2xl font-bold mb-2",
                children: [totalScreenYears.toFixed(1), " years on your phone"]
              }),
              jsxs("div", {
                className: "text-sm text-muted-foreground",
                children: [
                  Math.round(weeklyHours), " hrs / week  \u2022  ",
                  Math.round(monthlyHours), " hrs / month"
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}
