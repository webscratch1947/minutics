import {
  Iy,
  Ns,
  Ny,
  c,
  eh,
  gh,
  hk,
  nh,
  ok,
  sk,
  th,
  w
} from "../shared.js";

var CURRENCIES = [
  { code: "INR", symbol: "Rs.", label: "Indian Rupee",     locale: "en-IN", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { code: "USD", symbol: "$",      label: "US Dollar",        locale: "en-US", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "EUR", symbol: "\u20AC", label: "Euro",             locale: "de-DE", flag: "\uD83C\uDDEA\uD83C\uDDFA" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound",    locale: "en-GB", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "JPY", symbol: "\u00A5", label: "Japanese Yen",     locale: "ja-JP", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "AED", symbol: "AED",    label: "UAE Dirham",       locale: "ar-AE", flag: "\uD83C\uDDE6\uD83C\uDDEA" },
  { code: "SAR", symbol: "SAR",    label: "Saudi Riyal",      locale: "ar-SA", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { code: "AUD", symbol: "A$",     label: "Australian Dollar", locale: "en-AU", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { code: "CAD", symbol: "C$",     label: "Canadian Dollar",  locale: "en-CA", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  { code: "SGD", symbol: "S$",     label: "Singapore Dollar", locale: "en-SG", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { code: "PKR", symbol: "\u20A8", label: "Pakistani Rupee",  locale: "en-PK", flag: "\uD83C\uDDF5\uD83C\uDDF0" },
  { code: "BDT", symbol: "\u09F3", label: "Bangladeshi Taka", locale: "bn-BD", flag: "\uD83C\uDDE7\uD83C\uDDE9" },
  { code: "NGN", symbol: "\u20A6", label: "Nigerian Naira",   locale: "en-NG", flag: "\uD83C\uDDF3\uD83C\uDDEC" },
  { code: "BRL", symbol: "R$",     label: "Brazilian Real",   locale: "pt-BR", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { code: "TRY", symbol: "\u20BA", label: "Turkish Lira",     locale: "tr-TR", flag: "\uD83C\uDDF9\uD83C\uDDF7" }
];

var GOAL_OPTIONS = [
  { type: "retirement", label: "\uD83C\uDFD6\uFE0F Retirement" },
  { type: "age",        label: "\uD83C\uDF82 Age Goal" },
  { type: "fire",       label: "\uD83D\uDD25 FIRE" },
  { type: "milestone",  label: "\uD83C\uDFAF Milestone" }
];

function Toggle({ enabled, onToggle }) {
  return c.jsx("button", {
    type: "button",
    onClick: onToggle,
    className: "relative w-12 h-7 rounded-full transition-colors shrink-0 " + (enabled ? "bg-primary" : "bg-gray-300"),
    children: c.jsx("span", {
      className: "absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform " + (enabled ? "translate-x-5" : ""),
    })
  });
}

function SectionLabel({ children }) {
  return c.jsx("p", {
    className: "text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground mb-3",
    children: children
  });
}

function SettingsRow({ label, desc, children: right }) {
  return c.jsxs("div", {
    className: "flex items-center justify-between gap-3 py-3.5",
    children: [c.jsxs("div", {
      className: "min-w-0",
      children: [c.jsx("p", { className: "text-sm font-semibold text-foreground", children: label }), desc && c.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: desc })]
    }), right]
  });
}

export function SettingsScreen() {
  var k = Ny();
  var h = k ? new Date(k.dob) : null;
  if (h && k) h.setFullYear(h.getFullYear() + k.lifespanYears);

  var _readJson = function (key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
  };
  var _writeJson = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  };

  var [plan, setPlan] = w.useState(function () { return _readJson("lt_plan_v1", "free"); });
  var [goalType, setGoalTypeState] = w.useState(function () { return _readJson("lt_goal_type_v1", { type: "retirement", milestoneLabel: "Milestone" }); });
  var [milestoneLabel, setMilestoneLabel] = w.useState(function () { return goalType.milestoneLabel || "Milestone"; });
  var [currCode, setCurrCode] = w.useState(function () { return (_readJson("lt_currency_v1", { code: "INR" })).code || "INR"; });
  var [showCurrencyPicker, setShowCurrencyPicker] = w.useState(false);

  var curObj = CURRENCIES.find(function (c) { return c.code === currCode; }) || CURRENCIES[0];

  var [notifsEnabled, setNotifsEnabled] = w.useState(function () {
    return _readJson("lt_notifs_enabled_v1", true);
  });

  var [telegramBotToken, setTelegramBotToken] = w.useState("");
  var [telegramChatId, setTelegramChatId] = w.useState("");
  var [dailyReportTime, setDailyReportTime] = w.useState("21:00");
  var [telegramSaved, setTelegramSaved] = w.useState(false);
  var [telegramTesting, setTelegramTesting] = w.useState(false);
  var [telegramResult, setTelegramResult] = w.useState(null);
  var [telegramConnected, setTelegramConnected] = w.useState(false);

  w.useEffect(function () {
    var C = Ns();
    setTelegramBotToken(C.telegramBotToken || "");
    setTelegramChatId(C.telegramChatId || "");
    setDailyReportTime(C.dailyReportTime || "21:00");
    setTelegramConnected(!!C.telegramConnected);
  }, []);

  var [ovlGranted, setOvlGranted] = w.useState(null);
  w.useEffect(function () {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        setOvlGranted(window.Notification.permission === "granted");
      }
    } catch {}
  }, []);

  var requestOvl = function () {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        window.Notification.requestPermission().then(function (p) { setOvlGranted(p === "granted"); });
      }
    } catch {}
  };

  var saveTelegram = function () {
    setTelegramSaved(false);
    var C = gh({ telegramBotToken: telegramBotToken, telegramChatId: telegramChatId, dailyReportTime: dailyReportTime });
    setTelegramBotToken(C.telegramBotToken || "");
    setTelegramChatId(C.telegramChatId || "");
    setTelegramConnected(!!C.telegramConnected);
    setTelegramSaved(true);
    setTimeout(function () { setTelegramSaved(false); }, 2500);
  };

  var testTelegram = function () {
    setTelegramTesting(true);
    setTelegramResult(null);
    var C = gh({ telegramBotToken: telegramBotToken, telegramChatId: telegramChatId, dailyReportTime: dailyReportTime });
    Iy("Lifetime test message: Telegram is connected.", C).then(function (r) {
      setTelegramResult(r);
    }).catch(function () {
      setTelegramResult({ success: false, message: "Could not reach Telegram" });
    }).finally(function () {
      setTelegramTesting(false);
    });
  };

  var setGoalType = function (type, label) {
    var obj = { type: type, milestoneLabel: label || "Milestone" };
    setGoalTypeState(obj);
    setMilestoneLabel(label || "Milestone");
    _writeJson("lt_goal_type_v1", obj);
  };

  var setCurrency = function (code) {
    setCurrCode(code);
    _writeJson("lt_currency_v1", { code: code });
    setShowCurrencyPicker(false);
  };

  var toggleNotifs = function () {
    var next = !notifsEnabled;
    setNotifsEnabled(next);
    _writeJson("lt_notifs_enabled_v1", next);
    if (next && ovlGranted !== "granted") requestOvl();
  };

  var planName = plan === "basic" ? "Basic" : plan === "yearly" ? "1 Year" : plan === "lifetime" || plan === "pro" ? "Lifetime" : "Free";
  var isPro = plan === "basic" || plan === "yearly" || plan === "lifetime" || plan === "pro";

  var resetProfile = function () {
    if (!confirm("Reset your profile? You'll need to set up your date of birth and retire date again.")) return;
    hk();
    try {
      if (window.AndroidPermBridge && window.AndroidPermBridge.reloadApp) {
        window.AndroidPermBridge.reloadApp();
      } else {
        window.location.reload();
      }
    } catch (e) { window.location.reload(); }
  };

  return c.jsxs("div", {
    className: "flex flex-col",
    children: [
      c.jsxs("div", {
        className: "bg-primary text-white px-5 pt-10 pb-6",
        children: [c.jsx("p", { className: "text-xs font-semibold text-white/50 uppercase tracking-widest mb-1", children: "Settings" }), c.jsx("h1", { className: "text-2xl font-black", children: "Configure" })]
      }),

      c.jsxs("div", {
        className: "bg-white border-b border-border px-5",
        children: [
          c.jsx(SectionLabel, { children: "Account" }),
          c.jsxs("div", { className: "flex items-center justify-between", children: [
            c.jsxs("div", { children: [
              c.jsx("p", { className: "text-sm font-bold text-foreground", children: (k && k.name) || "Signed in" }),
              c.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: "Your data stays on this device" })
            ] }),
            c.jsx("button", { onClick: resetProfile, className: "shrink-0 border border-red-300 text-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-50 transition-colors", children: "Reset" })
          ] })
        ]
      }),

      c.jsxs("div", {
        className: "bg-white border-b border-border px-5",
        children: [
          c.jsx(SectionLabel, { children: "Plan" }),
          c.jsxs("div", { className: "flex items-center justify-between", children: [
            c.jsxs("div", { className: "flex items-center gap-2", children: [
              isPro && c.jsx("span", { className: "text-lg", children: "\u2B50" }),
              c.jsx("p", { className: "text-sm font-bold text-foreground", children: planName })
            ] }),
            !isPro && c.jsx("button", { onClick: function () { clickNavTab && clickNavTab("plans"); }, className: "shrink-0 border border-primary text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary hover:text-white transition-colors", children: "View Plans" })
          ] })
        ]
      }),

      c.jsxs("div", {
        className: "bg-white border-b border-border px-5",
        children: [
          c.jsx(SectionLabel, { children: "Display Currency" }),
          c.jsxs("div", {
            className: "flex items-center justify-between",
            children: [
              c.jsxs("div", { className: "flex items-center gap-3", children: [
                c.jsx("span", { className: "text-2xl", children: curObj.flag }),
                c.jsxs("div", { children: [
                  c.jsx("p", { className: "text-sm font-bold text-foreground", children: curObj.label }),
                  c.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: curObj.symbol + " \u00B7 " + curObj.locale })
                ] })
              ] }),
              c.jsx("button", { onClick: function () { setShowCurrencyPicker(!showCurrencyPicker); }, className: "shrink-0 border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-secondary transition-colors", children: "Change" })
            ]
          }),
          showCurrencyPicker && c.jsx("div", {
            className: "mt-2 mb-1 border border-border rounded-xl max-h-48 overflow-y-auto",
            children: CURRENCIES.map(function (cur) {
              return c.jsxs("button", {
                type: "button",
                onClick: function () { setCurrency(cur.code); },
                className: "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary border-b border-border last:border-0 " + (cur.code === currCode ? "bg-primary/5" : ""),
                children: [
                  c.jsx("span", { className: "text-lg", children: cur.flag }),
                  c.jsxs("div", { children: [
                    c.jsx("p", { className: "text-sm font-semibold text-foreground", children: cur.label }),
                    c.jsx("p", { className: "text-[11px] text-muted-foreground", children: cur.symbol + " \u00B7 " + cur.code })
                  ] }),
                  cur.code === currCode && c.jsx("span", { className: "ml-auto text-primary text-xs font-bold", children: "\u2713" })
                ]
              }, cur.code);
            })
          })
        ]
      }),

      c.jsxs("div", {
        className: "bg-white border-b border-border px-5",
        children: [
          c.jsx(SectionLabel, { children: "Goal Type" }),
          c.jsx("div", {
            className: "flex gap-2 mb-3",
            children: GOAL_OPTIONS.map(function (opt) {
              var active = goalType.type === opt.type;
              return c.jsx("button", {
                type: "button",
                onClick: function () { setGoalType(opt.type, milestoneLabel); },
                className: "px-3 py-2 text-xs font-bold border " + (active ? "bg-primary text-white border-primary" : "bg-white text-foreground border-border"),
                children: opt.label
              }, opt.type);
            })
          }),
          goalType.type === "milestone" && c.jsx("input", {
            type: "text",
            value: milestoneLabel,
            onChange: function (ev) { setMilestoneLabel(ev.target.value); setGoalType("milestone", ev.target.value); },
            placeholder: "e.g. Buy a house",
            className: "w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary mb-1"
          })
        ]
      }),

      c.jsxs("div", {
        className: "bg-white border-b border-border px-5",
        children: [
          c.jsx(SectionLabel, { children: "Features" }),
          c.jsx(SettingsRow, {
            label: "Smart Nudges",
            desc: "Get productivity tips based on time of day",
            children: c.jsx(Toggle, { enabled: notifsEnabled, onToggle: toggleNotifs })
          }),
          c.jsx(SettingsRow, {
            label: "Website Notifications",
            desc: ovlGranted === "granted" ? "Enabled \u2014 reminders can notify you" : "Tap to enable browser notifications",
            children: ovlGranted === "granted"
              ? c.jsx("span", { className: "text-xs font-bold text-green-700 shrink-0", children: "On" })
              : c.jsx("button", { onClick: requestOvl, className: "shrink-0 border border-primary text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary hover:text-white transition-colors", children: "Enable" })
          })
        ]
      }),

      c.jsx("div", {
        className: "px-5 pt-5 pb-2",
        children: c.jsx(SectionLabel, { children: "Telegram Daily Reports" })
      }),
      c.jsxs("div", {
        className: "flex flex-col divide-y divide-border border-t border-b border-border bg-white",
        children: [
          c.jsx("div", {
            className: "px-5 py-3 flex items-center gap-3",
            children: telegramConnected
              ? c.jsxs(c.Fragment, { children: [c.jsx(eh, { className: "w-4 h-4 text-green-500 shrink-0" }), c.jsx("span", { className: "text-sm font-medium text-green-700", children: "Connected \u2014 daily reports active" })] })
              : c.jsxs(c.Fragment, { children: [c.jsx(th, { className: "w-4 h-4 text-muted-foreground shrink-0" }), c.jsx("span", { className: "text-sm text-muted-foreground", children: "Not connected" })] })
          }),
          c.jsxs("div", { className: "px-5 py-4", children: [
            c.jsx("label", { className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5", children: "Bot token" }),
            c.jsx("input", { type: "text", value: telegramBotToken, onChange: function (ev) { setTelegramBotToken(ev.target.value); }, placeholder: "123456:ABCdef...", className: "w-full bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50" }),
            c.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Create a bot with @BotFather on Telegram." })
          ] }),
          c.jsxs("div", { className: "px-5 py-4", children: [
            c.jsx("label", { className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5", children: "Chat ID" }),
            c.jsx("input", { type: "text", value: telegramChatId, onChange: function (ev) { setTelegramChatId(ev.target.value); }, placeholder: "e.g. 987654321", className: "w-full bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50" }),
            c.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Your Telegram user ID. Message @userinfobot to find it." })
          ] }),
          c.jsxs("div", { className: "px-5 py-4", children: [
            c.jsx("label", { className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5", children: "Daily report time" }),
            c.jsx("input", { type: "time", value: dailyReportTime, onChange: function (ev) { setDailyReportTime(ev.target.value); }, className: "bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground" }),
            c.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "The server will send your summary at this time each day." })
          ] })
        ]
      }),
      telegramResult && c.jsx("div", {
        className: "mx-5 mt-3 px-4 py-3 border text-sm font-medium flex items-center gap-2 " + (telegramResult.success ? "border-green-300 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"),
        children: [telegramResult.success ? c.jsx(eh, { className: "w-4 h-4 shrink-0" }) : c.jsx(th, { className: "w-4 h-4 shrink-0" }), telegramResult.message]
      }),
      c.jsxs("div", { className: "flex gap-3 px-5 py-4", children: [
        c.jsxs("button", { onClick: saveTelegram, disabled: telegramTesting, className: "flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm disabled:opacity-40", children: [telegramTesting && c.jsx(nh, { className: "w-4 h-4 animate-spin" }), telegramSaved ? "Saved \u2713" : "Save settings"] }),
        c.jsxs("button", { onClick: testTelegram, disabled: telegramTesting || !telegramBotToken.trim() || !telegramChatId.trim(), className: "flex items-center gap-2 px-4 py-3.5 border border-border font-semibold text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition-colors", children: [telegramTesting ? c.jsx(nh, { className: "w-4 h-4 animate-spin" }) : c.jsx(sk, { className: "w-4 h-4" }), "Test"] })
      ] }),
      c.jsx("div", { className: "h-6" })
    ]
  });
}
