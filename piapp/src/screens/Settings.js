import { useState, useEffect, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { getProfile } from '../lib/profile.js';
import { getTelegramSettings, saveTelegramSettings, sendTelegramReport } from '../lib/telegram.js';
import { getCurrency, setCurrency } from '../lib/currency.js';
import { saveGoalType, getGoalType, isPro as hasActivePaidPlan } from '../lib/settings.js';
import { readJson, writeJson } from '../lib/settings.js';
import { CircleCheckBig as eh } from 'lucide-react';

/* ── constants ── */

var CURRENCIES = [
  { code: "INR", symbol: "Rs.", label: "Indian Rupee", locale: "en-IN", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "EUR", symbol: "\u20AC", label: "Euro", locale: "de-DE", flag: "\uD83C\uDDEA\uD83C\uDDFA" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound", locale: "en-GB", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
  { code: "JPY", symbol: "\u00A5", label: "Japanese Yen", locale: "ja-JP", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "AED", symbol: "AED", label: "UAE Dirham", locale: "ar-AE", flag: "\uD83C\uDDE6\uD83C\uDDEA" },
  { code: "SAR", symbol: "SAR", label: "Saudi Riyal", locale: "ar-SA", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", locale: "en-AU", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", locale: "en-CA", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar", locale: "en-SG", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
  { code: "PKR", symbol: "\u20A8", label: "Pakistani Rupee", locale: "en-PK", flag: "\uD83C\uDDF5\uD83C\uDDF0" },
  { code: "BDT", symbol: "\u09F3", label: "Bangladeshi Taka", locale: "bn-BD", flag: "\uD83C\uDDE7\uD83C\uDDE9" },
  { code: "NGN", symbol: "\u20A6", label: "Nigerian Naira", locale: "en-NG", flag: "\uD83C\uDDF3\uD83C\uDDEC" },
  { code: "BRL", symbol: "R$", label: "Brazilian Real", locale: "pt-BR", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
  { code: "TRY", symbol: "\u20BA", label: "Turkish Lira", locale: "tr-TR", flag: "\uD83C\uDDF9\uD83C\uDDF7" }
];

var GOAL_OPTIONS = [
  { type: "retirement", label: "\uD83C\uDFD6\uFE0F Retirement" },
  { type: "age", label: "\uD83C\uDF82 Age Goal" },
  { type: "fire", label: "\uD83D\uDD25 FIRE" },
  { type: "milestone", label: "\uD83C\uDFAF Milestone" }
];

var PLANS = {
  free: "Free",
  basic: "Basic",
  yearly: "1 Year",
  lifetime: "Lifetime",
  pro: "Lifetime"
};

/* ── small UI components ── */

function Toggle(props) {
  return jsx("button", {
    onClick: props.onToggle,
    className: [
      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
      "transition-colors duration-200 ease-in-out focus:outline-none",
      props.enabled ? "bg-primary" : "bg-gray-300"
    ].join(" "),
    children: jsx("span", {
      className: [
        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0",
        "transition duration-200 ease-in-out",
        props.enabled ? "translate-x-5" : "translate-x-0"
      ].join(" ")
    })
  });
}

function SectionHeader(props) {
  return jsx("p", {
    className: "text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground px-1",
    children: props.children
  });
}

function Card(props) {
  return jsx("div", {
    className: "bg-white border border-border rounded-2xl overflow-hidden",
    children: props.children
  });
}

function CardRow(props) {
  return jsxs("div", {
    className: "flex items-center justify-between px-4 py-3.5",
    children: [
      jsxs("div", {
        className: "flex-1 min-w-0 mr-3",
        children: [
          jsx("p", { className: "text-sm font-semibold text-foreground", children: props.label }),
          props.desc ? jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: props.desc }) : null
        ]
      }),
      jsx("div", { className: "shrink-0", children: props.children })
    ]
  });
}

function Divider() {
  return jsx("div", { className: "h-px bg-border mx-4" });
}

function getAlertPermission() {
  try {
    if (window.AndroidBridge && window.AndroidBridge.getNotificationPermission) {
      return window.AndroidBridge.getNotificationPermission();
    }
  } catch (e) {}
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

/* ═══════════════════════════════════════════════════════════════
   SettingsScreen
   ═══════════════════════════════════════════════════════════════ */

export function SettingsScreen() {
  /* ── plan re-render trigger ── */
  var _planTick = useState(0);
  useEffect(function () {
    function onPlanChanged() { _planTick[1](function (n) { return n + 1; }); }
    window.addEventListener("lt-plan-changed", onPlanChanged);
    return function () { window.removeEventListener("lt-plan-changed", onPlanChanged); };
  }, []);

  /* ── profile ── */
  var profile = getProfile();
  var profileName = (profile && profile.name) ? profile.name : "User";
  var _userEmailInit = "";
  try {
    var _authUser = (window.LTAuth && window.LTAuth.currentUser && window.LTAuth.currentUser()) || null;
    _userEmailInit = (_authUser && _authUser.email) ? _authUser.email : "";
  } catch (e) {}
  var _userEmailState = useState(_userEmailInit);
  var userEmail = _userEmailState[0];
  var setUserEmail = _userEmailState[1];
  useEffect(function () {
    function refreshEmail() {
      try {
        var u = (window.LTAuth && window.LTAuth.currentUser && window.LTAuth.currentUser()) || null;
        var em = (u && u.email) ? u.email : "";
        if (em) setUserEmail(em);
      } catch (e) {}
    }
    refreshEmail();
    var t = setInterval(refreshEmail, 2000);
    setTimeout(function () { clearInterval(t); }, 10000);
    return function () { clearInterval(t); };
  }, []);

  /* ── plan ── */
  var rawPlan = localStorage.getItem("lt_plan_v1") || "free";
  try { rawPlan = JSON.parse(rawPlan); } catch { rawPlan = "free"; }
  var isPro = hasActivePaidPlan();
  var planLabel = PLANS[rawPlan] || "Free";

  /* ── currency ── */
  var savedCurrency = getCurrency();
  var currentCurrencyCode = (savedCurrency && savedCurrency.code) ? savedCurrency.code : "INR";
  var _currencyState = useState(currentCurrencyCode);
  var selectedCurrencyCode = _currencyState[0];
  var setSelectedCurrencyCode = _currencyState[1];
  var _showPickerState = useState(false);
  var showPicker = _showPickerState[0];
  var setShowPicker = _showPickerState[1];

  var currentCurrencyObj = CURRENCIES.find(function (c) { return c.code === selectedCurrencyCode; }) || CURRENCIES[0];

  /* ── goal type ── */
  var savedGoal = readJson("lt_goal_type_v1", { type: "retirement", milestoneLabel: "" });
  var _goalState = useState(savedGoal.type || "retirement");
  var goalType = _goalState[0];
  var setGoalType = _goalState[1];
  var _milestoneLabelState = useState(savedGoal.milestoneLabel || "");
  var milestoneLabel = _milestoneLabelState[0];
  var setMilestoneLabel = _milestoneLabelState[1];

  /* ── smart nudges ── */
  var _nudgesState = useState(localStorage.getItem("lt_notifs_enabled_v1") === "true");
  var nudgesEnabled = _nudgesState[0];
  var setNudgesEnabled = _nudgesState[1];

  /* ── alert notification permission (browser or Android bridge) ── */
  var _notifPermState = useState(getAlertPermission());
  var notifPermission = _notifPermState[0];
  var setNotifPermission = _notifPermState[1];
  var _notifTestState = useState(null);
  var notifTestStatus = _notifTestState[0];
  var setNotifTestStatus = _notifTestState[1];
  var _notifEnabledState = useState(localStorage.getItem("lt_alert_notifs_on_v1") !== "off");
  var notifEnabled = _notifEnabledState[0];
  var setNotifEnabled = _notifEnabledState[1];

  useEffect(function () {
    function onPermissionChanged(event) {
      setNotifPermission((event.detail && event.detail.permission) || getAlertPermission());
    }
    function refreshPermission() { setNotifPermission(getAlertPermission()); }
    function onVisibilityChange() { if (document.visibilityState === "visible") refreshPermission(); }
    window.addEventListener("minutics-notification-permission", onPermissionChanged);
    window.addEventListener("focus", refreshPermission);
    document.addEventListener("visibilitychange", onVisibilityChange);
    var permissionPoll = window.setInterval(refreshPermission, 1000);
    return function () {
      window.removeEventListener("minutics-notification-permission", onPermissionChanged);
      window.removeEventListener("focus", refreshPermission);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(permissionPoll);
    };
  }, []);

  /* ── telegram ── */
  var tgSettings = getTelegramSettings();
  var _tgTokenState = useState((tgSettings && tgSettings.telegramBotToken) || "");
  var tgToken = _tgTokenState[0];
  var setTgToken = _tgTokenState[1];
  var _tgChatIdState = useState((tgSettings && tgSettings.telegramChatId) || "");
  var tgChatId = _tgChatIdState[0];
  var setTgChatId = _tgChatIdState[1];
  var _tgTimeState = useState((tgSettings && tgSettings.dailyReportTime) || "21:00");
  var tgTime = _tgTimeState[0];
  var setTgTime = _tgTimeState[1];
  var tgConnected = tgSettings && tgSettings.telegramConnected;
  var _tgSavingState = useState(false);
  var tgSaving = _tgSavingState[0];
  var setTgSaving = _tgSavingState[1];
  var _tgTestResultState = useState(null);
  var tgTestResult = _tgTestResultState[0];
  var setTgTestResult = _tgTestResultState[1];
  var _tgTestLoadingState = useState(false);
  var tgTestLoading = _tgTestLoadingState[0];
  var setTgTestLoading = _tgTestLoadingState[1];

  /* ── handlers ── */

  function handleCurrencyChange(code) {
    setSelectedCurrencyCode(code);
    setCurrency(code);
    setShowPicker(false);
  }

  function handleGoalChange(type) {
    setGoalType(type);
    saveGoalType({ type: type, milestoneLabel: milestoneLabel });
  }

  function handleMilestoneLabelChange(val) {
    setMilestoneLabel(val);
    saveGoalType({ type: goalType, milestoneLabel: val });
  }

  function handleNudgesToggle() {
    var next = !nudgesEnabled;
    setNudgesEnabled(next);
    writeJson("lt_notifs_enabled_v1", next ? "true" : "false");
    if (next && getAlertPermission() === "default") handleEnableNotifications();
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
    }
  }

  function handleEnableNotifications() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.requestNotificationPermission) {
        window.AndroidBridge.requestNotificationPermission();
        return;
      }
    } catch (e) {}
    if (typeof Notification !== "undefined") Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
  }

  async function handleTestNotification() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.showTestNotification) {
        window.AndroidBridge.showTestNotification();
        return;
      }
    } catch (e) {}
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      setNotifTestStatus(null);
      try {
        var reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Minutics", {
          body: "Test alert: notifications are working.",
          icon: window.location.origin + "/favicon.png",
          image: window.location.origin + "/favicon.png",
          tag: "minutics-notification-test",
          requireInteraction: true,
          silent: false
        });
        setNotifTestStatus("sent");
      } catch (e) {
        console.warn("Notification failed:", e);
        setNotifTestStatus("error");
      }
    }
  }

  function handleResetProfile() {
    if (confirm("This will log you out and delete all profile + app data on this device. Your plan will be kept. Continue?")) {
      /* Preserve plan data before clearing localStorage */
      var planData = {};
      try {
        ["lt_plan_v1", "lt_plan_since_v1", "lt_plan_grace_v1"].forEach(function (k) {
          var v = localStorage.getItem(k);
          if (v !== null) planData[k] = v;
        });
      } catch (e) {}

      /* Clear everything */
      localStorage.clear();

      /* Restore plan data */
      Object.keys(planData).forEach(function (k) {
        localStorage.setItem(k, planData[k]);
      });

      /* Full logout via Pi auth, then reload so the React root re-mounts
         and re-checks getProfile() — without a reload the old profile stays
         in React state and the user lands back in the same app. */
      if (window.LTAuth && window.LTAuth.logout) {
        window.LTAuth.logout();
      }
      /* Always reload after a short delay to let Pi session clear complete.
         Using setTimeout avoids a race where the reload fires before the
         auth state change propagates. */
      setTimeout(function () { window.location.reload(); }, 300);
    }
  }

  function handleSaveTelegram() {
    if (!isPro) { alert("Telegram daily reports require an active paid plan."); return; }
    setTgSaving(true);
    saveTelegramSettings({
      telegramBotToken: tgToken,
      telegramChatId: tgChatId,
      dailyReportTime: tgTime
    });
    setTimeout(function () { setTgSaving(false); }, 600);
  }

  function handleTestTelegram() {
    if (!isPro) { alert("Telegram daily reports require an active paid plan."); return; }
    setTgTestLoading(true);
    setTgTestResult(null);
    sendTelegramReport(tgToken, tgChatId, "Test from Minutics \u2014 your Telegram integration is working!")
      .then(function (result) {
        setTgTestResult(result && result.success ? "success" : "error");
        setTgTestLoading(false);
      })
      .catch(function () {
        setTgTestResult("error");
        setTgTestLoading(false);
      });
  }

  /* ── initials helper ── */
  function getInitials(name) {
    return (name || "U").split(" ").map(function (w) { return w.charAt(0); }).join("").toUpperCase().slice(0, 2);
  }

  /* ── render ── */

  return jsxs("div", {
    className: "flex flex-col gap-5 pb-8",
    children: [

      /* ─── Profile Card ─── */
      jsxs("div", {
        className: "mx-4 mt-4 bg-white border border-border rounded-2xl overflow-hidden",
        children: [
          jsxs("div", {
            className: "bg-primary/5 px-5 pt-5 pb-4",
            children: [
              jsxs("div", {
                className: "flex items-center gap-4",
                children: [
                  jsx("div", {
                    className: "w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0",
                    children: jsx("span", {
                      className: "text-lg font-black text-primary",
                      children: getInitials(profileName)
                    })
                  }),
                  jsxs("div", {
                    className: "flex-1 min-w-0",
                    children: [
                      jsx("p", { className: "text-lg font-bold text-foreground truncate", children: profileName }),
                      jsx("p", { className: "text-xs text-muted-foreground mt-0.5 truncate", children: userEmail || "Your data stays on this device" })
                    ]
                  })
                ]
              })
            ]
          }),
          jsxs("div", {
            className: "flex border-t border-border",
            children: [
              jsx("button", {
                onClick: handleResetProfile,
                className: "flex-1 py-3 text-sm font-semibold text-red-500 active:bg-red-50 transition",
                children: "Reset Profile"
              })
            ]
          })
        ]
      }),

      /* ─── Plan ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Plan" }),
          jsx("div", {
            className: [
              "bg-white rounded-2xl overflow-hidden border-2",
              isPro ? "border-amber-400 shadow-md shadow-amber-100" : "border-border"
            ].join(" "),
            children: jsxs(Fragment, {
              children: [
                jsxs(CardRow, {
                  label: planLabel + " Plan",
                  desc: isPro ? "All premium features unlocked" : "Basic features included",
                  children: jsx("span", {
                    className: [
                      "inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1.5 rounded-lg border-2",
                      isPro ? "bg-amber-50 text-amber-600 border-amber-400" : "bg-gray-100 text-gray-500 border-gray-200"
                    ].join(" "),
                    children: isPro ? "\u2B50 " + planLabel : "Free"
                  })
                }),
                jsx(Divider, {}),
                jsx("div", {
                  className: "px-4 py-3",
                  children: jsx("button", {
                    onClick: function () {
                      if (typeof window !== "undefined" && window.LTPlan && window.LTPlan.showPlansScreen) {
                        window.LTPlan.showPlansScreen();
                      } else {
                        alert("Plans screen is managed from the main app.");
                      }
                    },
                    className: [
                      "w-full rounded-xl py-2.5 text-sm font-semibold transition border",
                      isPro
                        ? "bg-white text-foreground border-border active:bg-gray-50"
                        : "bg-primary/10 text-primary border-transparent active:bg-primary/20"
                    ].join(" "),
                    children: isPro ? "Manage Plan" : "View Plans"
                  })
                })
              ]
            })
          })
        ]
      }),

      /* ─── Display Currency ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Display Currency" }),
          jsx(Card, {
            children: jsxs(Fragment, {
              children: [
                jsxs(CardRow, {
                  label: currentCurrencyObj.flag + " " + currentCurrencyObj.label,
                  desc: currentCurrencyObj.code + " (" + currentCurrencyObj.symbol + ") \u2022 " + currentCurrencyObj.locale,
                  children: jsx("button", {
                    onClick: function () { setShowPicker(!showPicker); },
                    className: "rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary active:bg-primary/20 transition",
                    children: showPicker ? "Close" : "Change"
                  })
                }),
                showPicker ? jsx("div", {
                  className: "px-3 pb-3",
                  children: jsx("div", {
                    className: "flex flex-col gap-1",
                    children: CURRENCIES.map(function (cur) {
                      var isActive = cur.code === selectedCurrencyCode;
                      return jsx("button", {
                        onClick: function () { handleCurrencyChange(cur.code); },
                        className: [
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          isActive ? "bg-primary/10 ring-1 ring-primary" : "active:bg-gray-50"
                        ].join(" "),
                        children: jsxs(Fragment, {
                          children: [
                            jsx("span", { className: "text-lg", children: cur.flag }),
                            jsxs("span", {
                              className: "flex-1 min-w-0",
                              children: [
                                jsx("span", { className: "text-sm font-medium text-foreground block truncate", children: cur.label }),
                                jsx("span", { className: "text-[11px] text-muted-foreground", children: cur.code + " " + cur.symbol })
                              ]
                            }),
                            isActive ? jsx(eh, { className: "h-4 w-4 text-primary shrink-0" }) : null
                          ]
                        })
                      });
                    })
                  })
                }) : null
              ]
            })
          })
        ]
      }),

      /* ─── Goal Type ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Goal Type" }),
          jsx(Card, {
            children: jsxs("div", {
              className: "p-4",
              children: [
                jsx("div", {
                  className: "grid grid-cols-2 gap-2",
                  children: GOAL_OPTIONS.map(function (opt) {
                    var isActive = goalType === opt.type;
                    return jsx("button", {
                      onClick: function () { handleGoalChange(opt.type); },
                      className: [
                        "rounded-xl py-2.5 px-3 text-sm font-semibold transition border",
                        isActive
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-white text-foreground border-border active:bg-gray-50"
                      ].join(" "),
                      children: opt.label
                    });
                  })
                }),
                goalType === "milestone" ? jsx("input", {
                  type: "text",
                  value: milestoneLabel,
                  onChange: function (e) { handleMilestoneLabelChange(e.target.value); },
                  placeholder: "e.g. Buy a house, Pay off mortgage\u2026",
                  className: [
                    "w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm mt-3",
                    "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  ].join(" ")
                }) : null
              ]
            })
          })
        ]
      }),

      /* ─── Features ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Features" }),
          jsx(Card, {
            children: jsx(CardRow, {
              label: "Notifications",
              desc: "Please install our official app to use this feature"
            })
          })
        ]
      }),

      /* ─── Telegram Daily Reports ─── */
      jsxs("div", {
        className: "mx-4",
        children: [
          jsx(SectionHeader, { children: "Telegram Daily Reports" }),
          jsx(Card, {
            children: jsxs("div", {
              className: "relative flex flex-col",
              children: [
                !isPro && jsxs("button", {
                  type: "button",
                  onClick: function () { alert("Telegram daily reports need a paid plan. Click View Plans in Settings, then purchase any plan to unlock them."); },
                  className: "absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 rounded-xl bg-background/90 px-6 text-center",
                  children: [
                    jsx("span", { className: "text-2xl", children: "\uD83D\uDD12" }),
                    jsx("span", { className: "text-sm font-bold text-foreground", children: "Premium feature" }),
                    jsx("span", { className: "text-xs leading-relaxed text-muted-foreground", children: "Click View Plans in Settings, then purchase any plan to unlock Telegram daily reports." })
                  ]
                }),
                /* connection status */
                jsxs("div", {
                  className: [
                    "flex items-center gap-2.5 px-4 py-3",
                    tgConnected ? "bg-green-50" : "bg-gray-50"
                  ].join(" "),
                  children: [
                    jsx(eh, {
                      className: [
                        "h-4.5 w-4.5",
                        tgConnected ? "text-green-500" : "text-gray-400"
                      ].join(" ")
                    }),
                    jsx("span", {
                      className: [
                        "text-sm font-semibold",
                        tgConnected ? "text-green-600" : "text-gray-500"
                      ].join(" "),
                      children: tgConnected ? "Connected" : "Not connected"
                    })
                  ]
                }),
                jsx(Divider, {}),
                /* bot token */
                jsx("div", {
                  className: "px-4 pt-3 pb-1",
                  children: jsx("input", {
                    type: "text",
                    value: tgToken,
                    onChange: function (e) { setTgToken(e.target.value); },
                    placeholder: "Bot Token",
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                /* chat ID */
                jsx("div", {
                  className: "px-4 pt-2 pb-1",
                  children: jsx("input", {
                    type: "text",
                    value: tgChatId,
                    onChange: function (e) { setTgChatId(e.target.value); },
                    placeholder: "Chat ID",
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                /* daily report time */
                jsx("div", {
                  className: "px-4 pt-2 pb-3",
                  children: jsx("input", {
                    type: "time",
                    value: tgTime,
                    onChange: function (e) { setTgTime(e.target.value); },
                    className: [
                      "w-full rounded-xl border border-border bg-secondary px-3.5 py-2.5 text-sm",
                      "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ].join(" ")
                  })
                }),
                jsx(Divider, {}),
                /* buttons */
                jsxs("div", {
                  className: "flex divide-x divide-border",
                  children: [
                    jsx("button", {
                      onClick: handleSaveTelegram,
                      disabled: tgSaving || !tgToken || !tgChatId || !isPro,
                      className: [
                        "flex-1 py-3 text-sm font-semibold transition",
                        tgSaving || !tgToken || !tgChatId || !isPro
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-primary active:bg-primary/5"
                      ].join(" "),
                      children: tgSaving ? "Saving\u2026" : "Save"
                    }),
                    jsx("button", {
                      onClick: handleTestTelegram,
                      disabled: tgTestLoading || !tgToken || !tgChatId || !isPro,
                      className: [
                        "flex-1 py-3 text-sm font-semibold transition",
                        tgTestLoading || !tgToken || !tgChatId || !isPro
                          ? "text-muted-foreground cursor-not-allowed"
                          : "text-foreground active:bg-gray-50"
                      ].join(" "),
                      children: tgTestLoading ? "Sending\u2026" : "Test"
                    })
                  ]
                }),
                /* test result banner */
                tgTestResult === "success"
                  ? jsx("div", {
                      className: "mx-4 mb-4 rounded-xl bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-600",
                      children: "Test message sent!"
                    })
                  : tgTestResult === "error"
                    ? jsx("div", {
                        className: "mx-4 mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-500",
                        children: "Failed to send. Check your token and chat ID."
                      })
                    : null
              ]
            })
          })
        ]
      }),

      /* ─── Footer ─── */
      jsx("p", {
        className: "text-center text-[11px] text-muted-foreground mt-2",
        children: "Minutics \u2022 Your time, your value"
      })
    ]
  });
}
