import { useState, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { getProfile, clearProfile } from '../lib/profile.js';
import { getTelegramSettings, saveTelegramSettings, sendTelegramReport } from '../lib/telegram.js';
import { getCurrency, setCurrency } from '../lib/currency.js';
import { saveGoalType, getGoalType } from '../lib/settings.js';
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

/**
 * Pill-style toggle switch.
 * @param {{ enabled: boolean, onToggle: () => void }} props
 */
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

/**
 * Uppercase section heading label.
 */
function SectionLabel(props) {
  return jsx("p", {
    className: "text-xs font-semibold uppercase tracking-wider text-gray-400",
    children: props.children
  });
}

/**
 * Settings row: label + description on the left, children (controls) on the right.
 */
function SettingsRow(props) {
  return jsxs("div", {
    className: "flex items-center justify-between py-2",
    children: [
      jsxs("div", {
        className: "flex-1 mr-4",
        children: [
          jsx("p", { className: "text-sm font-medium text-gray-900", children: props.label }),
          props.desc ? jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: props.desc }) : null
        ]
      }),
      jsx("div", { children: props.children })
    ]
  });
}

/* ═══════════════════════════════════════════════════════════════
   SettingsScreen — main exported component
   ═══════════════════════════════════════════════════════════════ */

export function SettingsScreen() {
  /* ── profile ── */
  var profile = getProfile();
  var profileName = (profile && profile.name) ? profile.name : "Signed in";

  /* ── plan ── */
  var rawPlan = localStorage.getItem("lt_plan_v1") || "free";
  var isPro = rawPlan === "basic" || rawPlan === "yearly" || rawPlan === "lifetime" || rawPlan === "pro";
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

  /* ── web notifications permission ── */
  var _notifPermState = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  var notifPermission = _notifPermState[0];
  var setNotifPermission = _notifPermState[1];

  /* ── telegram ── */
  var tgSettings = getTelegramSettings();
  var _tgTokenState = useState((tgSettings && tgSettings.telegramBotToken) || "");
  var tgToken = _tgTokenState[0];
  var setTgToken = _tgTokenState[1];
  var _tgChatIdState = useState((tgSettings && tgSettings.chatId) || "");
  var tgChatId = _tgChatIdState[0];
  var setTgChatId = _tgChatIdState[1];
  var _tgTimeState = useState((tgSettings && tgSettings.dailyReportTime) || "21:00");
  var tgTime = _tgTimeState[0];
  var setTgTime = _tgTimeState[1];
  var tgConnected = tgSettings && tgSettings.connected;
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
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
    }
  }

  function handleEnableNotifications() {
    if (typeof Notification !== "undefined") {
      Notification.requestPermission().then(function (perm) { setNotifPermission(perm); });
    }
  }

  function handleResetProfile() {
    if (confirm("Are you sure? This will remove all your profile data.")) {
      clearProfile();
      window.location.reload();
    }
  }

  function handleSaveTelegram() {
    setTgSaving(true);
    saveTelegramSettings({
      telegramBotToken: tgToken,
      chatId: tgChatId,
      dailyReportTime: tgTime
    });
    setTimeout(function () { setTgSaving(false); }, 600);
  }

  function handleTestTelegram() {
    setTgTestLoading(true);
    setTgTestResult(null);
    sendTelegramReport(tgToken, tgChatId, "Test from Minutics — your Telegram integration is working!")
      .then(function (ok) {
        setTgTestResult(ok ? "success" : "error");
        setTgTestLoading(false);
      })
      .catch(function () {
        setTgTestResult("error");
        setTgTestLoading(false);
      });
  }

  /* ── render ── */

  return jsx("div", {
    className: "px-5 py-6 flex flex-col gap-6",
    children: jsxs(Fragment, {
      children: [

        /* ─── a. Account ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Account" }),
            jsxs(SettingsRow, {
              label: profileName,
              desc: "Your data stays on this device",
              children: null
            }),
            jsx("button", {
              onClick: handleResetProfile,
              className: "w-full rounded-xl bg-red-50 py-2.5 text-sm font-medium text-red-600 active:bg-red-100 transition",
              children: "Reset Profile"
            })
          ]
        }),

        /* ─── b. Plan ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Plan" }),
            jsxs(SettingsRow, {
              label: planLabel,
              desc: isPro ? "Pro features unlocked" : "Free tier",
              children: isPro ? jsx("span", { className: "text-lg", children: "\u2B50" }) : null
            }),
            jsx("button", {
              className: "w-full rounded-xl bg-primary/10 py-2.5 text-sm font-medium text-primary active:bg-primary/20 transition",
              children: "View Plans"
            })
          ]
        }),

        /* ─── c. Display Currency ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Display Currency" }),
            jsxs(SettingsRow, {
              label: currentCurrencyObj.flag + " " + currentCurrencyObj.label,
              desc: currentCurrencyObj.code + " (" + currentCurrencyObj.symbol + ") \u2022 " + currentCurrencyObj.locale,
              children: jsx("button", {
                onClick: function () { setShowPicker(!showPicker); },
                className: "rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 active:bg-gray-200 transition",
                children: showPicker ? "Close" : "Change"
              })
            }),
            showPicker ? jsx("div", {
              className: "flex flex-col gap-1.5 mt-1",
              children: CURRENCIES.map(function (cur) {
                var isActive = cur.code === selectedCurrencyCode;
                return jsx("button", {
                  onClick: function () { handleCurrencyChange(cur.code); },
                  className: [
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition",
                    isActive ? "bg-primary/10 ring-1 ring-primary" : "bg-white active:bg-gray-50"
                  ].join(" "),
                  children: jsxs(Fragment, {
                    children: [
                      jsx("span", { className: "text-xl", children: cur.flag }),
                      jsxs("span", {
                        className: "flex-1",
                        children: [
                          jsx("span", { className: "text-sm font-medium text-gray-900", children: cur.label }),
                          jsx("span", { className: "text-xs text-gray-500 ml-2", children: cur.code + " " + cur.symbol })
                        ]
                      }),
                      isActive ? jsx(eh, { className: "h-4 w-4 text-primary" }) : null
                    ]
                  })
                });
              })
            }) : null
          ]
        }),

        /* ─── d. Goal Type ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Goal Type" }),
            jsx("div", {
              className: "grid grid-cols-2 gap-2",
              children: GOAL_OPTIONS.map(function (opt) {
                var isActive = goalType === opt.type;
                return jsx("button", {
                  onClick: function () { handleGoalChange(opt.type); },
                  className: [
                    "rounded-xl py-2.5 px-3 text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 active:bg-gray-200"
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
                "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm",
                "placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              ].join(" ")
            }) : null
          ]
        }),

        /* ─── e. Features ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Features" }),
            jsx(SettingsRow, {
              label: "Smart Nudges",
              desc: "Personalized reminders based on your spending",
              children: jsx(Toggle, { enabled: nudgesEnabled, onToggle: handleNudgesToggle })
            }),
            jsxs(SettingsRow, {
              label: "Website Notifications",
              desc: notifPermission === "granted"
                ? "Notifications are enabled"
                : notifPermission === "denied"
                  ? "Blocked by browser settings"
                  : "Receive alerts in your browser",
              children: notifPermission === "granted"
                ? jsx("span", {
                    className: [
                      "inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1",
                      "text-xs font-medium text-green-700"
                    ].join(" "),
                    children: "On"
                  })
                : jsx("button", {
                    onClick: handleEnableNotifications,
                    disabled: notifPermission === "denied",
                    className: [
                      "rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700",
                      "active:bg-gray-200 transition",
                      notifPermission === "denied" ? "opacity-40 cursor-not-allowed" : ""
                    ].join(" "),
                    children: "Enable"
                  })
            })
          ]
        }),

        /* ─── f. Telegram Daily Reports ─── */
        jsxs("section", {
          className: "flex flex-col gap-3",
          children: [
            jsx(SectionLabel, { children: "Telegram Daily Reports" }),

            /* connection status */
            jsxs("div", {
              className: [
                "flex items-center gap-2 rounded-xl px-4 py-3",
                tgConnected ? "bg-green-50" : "bg-gray-50"
              ].join(" "),
              children: [
                jsx(eh, {
                  className: [
                    "h-5 w-5",
                    tgConnected ? "text-green-500" : "text-gray-400"
                  ].join(" ")
                }),
                jsx("span", {
                  className: [
                    "text-sm font-medium",
                    tgConnected ? "text-green-700" : "text-gray-500"
                  ].join(" "),
                  children: tgConnected ? "Connected" : "Not connected"
                })
              ]
            }),

            /* bot token */
            jsxs("div", {
              className: "flex flex-col gap-1",
              children: [
                jsx("label", {
                  className: "text-xs font-medium text-gray-500",
                  children: "Bot Token"
                }),
                jsx("input", {
                  type: "text",
                  value: tgToken,
                  onChange: function (e) { setTgToken(e.target.value); },
                  placeholder: "123456:ABCdefGHIjklMNOpqrsTUVwxyz",
                  className: [
                    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm",
                    "placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  ].join(" ")
                })
              ]
            }),

            /* chat ID */
            jsxs("div", {
              className: "flex flex-col gap-1",
              children: [
                jsx("label", {
                  className: "text-xs font-medium text-gray-500",
                  children: "Chat ID"
                }),
                jsx("input", {
                  type: "text",
                  value: tgChatId,
                  onChange: function (e) { setTgChatId(e.target.value); },
                  placeholder: "e.g. 987654321",
                  className: [
                    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm",
                    "placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  ].join(" ")
                })
              ]
            }),

            /* daily report time */
            jsxs("div", {
              className: "flex flex-col gap-1",
              children: [
                jsx("label", {
                  className: "text-xs font-medium text-gray-500",
                  children: "Daily Report Time"
                }),
                jsx("input", {
                  type: "time",
                  value: tgTime,
                  onChange: function (e) { setTgTime(e.target.value); },
                  className: [
                    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm",
                    "focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  ].join(" ")
                })
              ]
            }),

            /* save button */
            jsx("button", {
              onClick: handleSaveTelegram,
              disabled: tgSaving || !tgToken || !tgChatId,
              className: [
                "w-full rounded-xl py-2.5 text-sm font-medium transition",
                tgSaving || !tgToken || !tgChatId
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-primary text-white active:bg-primary/90"
              ].join(" "),
              children: tgSaving ? "Saving\u2026" : "Save Telegram Settings"
            }),

            /* test button */
            jsx("button", {
              onClick: handleTestTelegram,
              disabled: tgTestLoading || !tgToken || !tgChatId,
              className: [
                "w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium transition",
                tgTestLoading || !tgToken || !tgChatId
                  ? "border-gray-200 text-gray-400 cursor-not-allowed"
                  : "border-gray-300 text-gray-700 active:bg-gray-50"
              ].join(" "),
              children: tgTestLoading ? "Sending test\u2026" : "Send Test Report"
            }),

            /* test result banner */
            tgTestResult === "success"
              ? jsx("div", {
                  className: "rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-700",
                  children: "Test message sent successfully!"
                })
              : tgTestResult === "error"
                ? jsx("div", {
                    className: "rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600",
                    children: "Failed to send test message. Check your token and chat ID."
                  })
                : null
          ]
        })
      ]
    })
  });
}
