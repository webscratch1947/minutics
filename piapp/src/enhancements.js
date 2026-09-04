(function () {
  "use strict";

  /* ── Startup loading screen ────────────────────────────────────────────
     Plays the branded splash video once (no loop) and dismisses right
     after it ends — if the video is still going once we'd normally cut
     it, we let it finish and freeze on the last frame instead of jumping. */
  var _ltSplashDone = false;
  (function showStartupSplash() {
    var MAX_MS = 5000; /* fallback safety cap (video is ~4s) in case video events never fire */
    var splash  = document.createElement("div");
    splash.id   = "lt-startup-splash";
    splash.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;background:hsl(230 40% 16%);" +
      "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
      "gap:14px;transition:opacity .4s ease;opacity:1;pointer-events:none;overflow:hidden;";

    var video = document.createElement("video");
    video.id = "lt-startup-splash-video";
    video.src = "assets/lt/minutics_splash.mp4";
    video.autoplay = true;
    video.muted = false; /* keep audio — only mute as a fallback if the platform blocks unmuted autoplay */
    video.playsInline = true;
    video.preload = "auto";
    video.loop = false; /* play exactly once — do not loop */
    /* Stay invisible (background color shows through) until the video has an
       actual decoded frame ready — avoids the "broken video" flash at start. */
    video.style.cssText = "width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .15s ease;";
    video.addEventListener("loadeddata", function () {
      video.style.opacity = "1";
    });
    splash.appendChild(video);

    /* Small tap-to-unmute affordance, shown only if unmuted autoplay was
       blocked and we had to fall back to silent playback. */
    var unmuteBtn = document.createElement("button");
    unmuteBtn.id = "lt-startup-splash-unmute";
    unmuteBtn.type = "button";
    unmuteBtn.textContent = "\uD83D\uDD07 Tap for sound";
    unmuteBtn.style.cssText =
      "display:none;position:absolute;bottom:28px;left:50%;transform:translateX(-50%);" +
      "background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.35);" +
      "border-radius:999px;padding:9px 16px;font-size:13px;font-weight:700;" +
      "font-family:inherit;pointer-events:auto;-webkit-tap-highlight-color:transparent;";
    unmuteBtn.addEventListener("click", function () {
      video.muted = false;
      video.play().catch(function () {});
      unmuteBtn.style.display = "none";
    });
    splash.appendChild(unmuteBtn);
    (document.body || document.documentElement).appendChild(splash);

    var playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt.catch(function () {
        /* Unmuted autoplay was blocked — fall back to silent playback so the
           splash still shows, and offer a one-tap way to turn sound on. */
        video.muted = true;
        video.play().catch(function () {});
        unmuteBtn.style.display = "block";
      });
    }

    var dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      _ltSplashDone = true;
      splash.style.opacity = "0";
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
        [0, 200, 500, 1000].forEach(function (d) {
          setTimeout(function () {
            if (typeof lockTimerPageScroll === "function" &&
                location.pathname === "/" && _activeSubTab !== "activity") {
              lockTimerPageScroll();
            }
          }, d);
        });
      }, 450);
    }

    /* "ended" fires once the video finishes its single playthrough — freeze
       on that last frame for a beat, then dismiss. If the video errors or
       never starts (codec issue, etc.), MAX_MS still guarantees dismissal. */
    video.addEventListener("ended", function () {
      setTimeout(dismiss, 150);
    });
    video.addEventListener("error", dismiss);
    var playPromise = video.play();
    if (playPromise && playPromise.catch) playPromise.catch(dismiss);
    setTimeout(dismiss, MAX_MS);
  })();

  /* ── Storage keys ──────────────────────────────────────────────────────── */
  var BUDGET_KEY    = "lt_budget_tracker_v1";
  var EMI_KEY       = "lt_emi_history_v1";
  var COMPOUND_KEY  = "lt_compound_history_v1";
  var OPP_KEY        = "lt_opp_history_v1";
  var ITEMCOST_KEY   = "lt_itemcost_history_v1";
  var WASTE_BUDGET_KEY = "lt_waste_budget_v1";   /* { minutes: 45 } */
  var FOCUS_STATE_KEY  = "lt_focus_state_v1";     /* { endsAt, running } */
  var TASKS_KEY         = "lt_tasks_v1";
  var ROUTINE_KEY        = "lt_routine_items_v1";    /* array of {id,name,time,endTime} */
  var ROUTINE_DONE_KEY   = "lt_routine_done_v1";      /* { date:"YYYY-MM-DD", ids:{id:true} } — resets when date changes */
  var CATLOG_KEY        = "lt_category_log_v1";
  var TIMEVALUE_KEY     = "lt_time_value_v1";
  var STREAK_KEY        = "lt_selfdev_streak_v1";   /* { lastDate, count, badgeEarned } */
  var NUDGE_KEY         = "lt_idle_nudge_v3";       /* { noActivitySince, lastNudge } */
  var RUNNING_TIMER_KEY = "lt_running_timer_start_v1";
  var NATIVE_DB_KEY      = "lifetime_local_db_v1";
  var PROD_TOAST_KEY    = "lt_prod_toast_last_v1";
  var CURRENCY_KEY      = "lt_currency_v1";         /* { code: "INR"|"USD"|"EUR"|"GBP" } */
  var PLAN_KEY           = "lt_plan_v1";             /* "free" | "pro" — device-local until payments are wired up */
  var GOAL_TYPE_KEY      = "lt_goal_type_v1";        /* { type: "retirement"|"age"|"fire"|"milestone", milestoneLabel: "..." } */
  var PROFILE_KEY        = "lifetime_profile";       /* { name, dob, lifespanYears } — set during onboarding */
  var JARS_KEY           = "lt_6jars_v2";            /* 6-jar money management system config */
  var JARS_SALARY_KEY    = "lt_6jars_salary_v1";      /* 6-jar's own independent monthly salary — no longer tied to Time Value Calculator */

  /* ── Currency config ────────────────────────────────────────────────────── */
  var CURRENCIES = [
    { code: "INR", symbol: "\u20B9", label: "Indian Rupee",          locale: "en-IN", flag: "\uD83C\uDDEE\uD83C\uDDF3" },
    { code: "USD", symbol: "$",      label: "US Dollar",             locale: "en-US", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
    { code: "EUR", symbol: "\u20AC", label: "Euro",                  locale: "de-DE", flag: "\uD83C\uDDEA\uD83C\uDDFA" },
    { code: "GBP", symbol: "\u00A3", label: "British Pound",         locale: "en-GB", flag: "\uD83C\uDDEC\uD83C\uDDE7" },
    { code: "JPY", symbol: "\u00A5", label: "Japanese Yen",          locale: "ja-JP", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
    { code: "CNY", symbol: "\u00A5", label: "Chinese Yuan",          locale: "zh-CN", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
    { code: "AED", symbol: "\u062F.\u0625", label: "UAE Dirham",     locale: "ar-AE", flag: "\uD83C\uDDE6\uD83C\uDDEA" },
    { code: "SAR", symbol: "\u0631.\u0633", label: "Saudi Riyal",    locale: "ar-SA", flag: "\uD83C\uDDF8\uD83C\uDDE6" },
    { code: "AUD", symbol: "A$",     label: "Australian Dollar",     locale: "en-AU", flag: "\uD83C\uDDE6\uD83C\uDDFA" },
    { code: "CAD", symbol: "C$",     label: "Canadian Dollar",       locale: "en-CA", flag: "\uD83C\uDDE8\uD83C\uDDE6" },
    { code: "SGD", symbol: "S$",     label: "Singapore Dollar",      locale: "en-SG", flag: "\uD83C\uDDF8\uD83C\uDDEC" },
    { code: "CHF", symbol: "Fr",     label: "Swiss Franc",           locale: "de-CH", flag: "\uD83C\uDDE8\uD83C\uDDED" },
    { code: "HKD", symbol: "HK$",    label: "Hong Kong Dollar",      locale: "en-HK", flag: "\uD83C\uDDED\uD83C\uDDF0" },
    { code: "NZD", symbol: "NZ$",    label: "New Zealand Dollar",    locale: "en-NZ", flag: "\uD83C\uDDF3\uD83C\uDDFF" },
    { code: "MYR", symbol: "RM",     label: "Malaysian Ringgit",     locale: "ms-MY", flag: "\uD83C\uDDF2\uD83C\uDDFE" },
    { code: "IDR", symbol: "Rp",     label: "Indonesian Rupiah",     locale: "id-ID", flag: "\uD83C\uDDEE\uD83C\uDDE9" },
    { code: "PHP", symbol: "\u20B1", label: "Philippine Peso",       locale: "en-PH", flag: "\uD83C\uDDF5\uD83C\uDDED" },
    { code: "THB", symbol: "\u0E3F", label: "Thai Baht",             locale: "th-TH", flag: "\uD83C\uDDF9\uD83C\uDDED" },
    { code: "KRW", symbol: "\u20A9", label: "South Korean Won",      locale: "ko-KR", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
    { code: "TRY", symbol: "\u20BA", label: "Turkish Lira",          locale: "tr-TR", flag: "\uD83C\uDDF9\uD83C\uDDF7" },
    { code: "BRL", symbol: "R$",     label: "Brazilian Real",        locale: "pt-BR", flag: "\uD83C\uDDE7\uD83C\uDDF7" },
    { code: "MXN", symbol: "MX$",    label: "Mexican Peso",          locale: "es-MX", flag: "\uD83C\uDDF2\uD83C\uDDFD" },
    { code: "ZAR", symbol: "R",      label: "South African Rand",    locale: "en-ZA", flag: "\uD83C\uDDFF\uD83C\uDDE6" },
    { code: "NGN", symbol: "\u20A6", label: "Nigerian Naira",        locale: "en-NG", flag: "\uD83C\uDDF3\uD83C\uDDEC" },
    { code: "EGP", symbol: "\u00A3", label: "Egyptian Pound",        locale: "ar-EG", flag: "\uD83C\uDDEA\uD83C\uDDEC" },
    { code: "PKR", symbol: "\u20A8", label: "Pakistani Rupee",       locale: "en-PK", flag: "\uD83C\uDDF5\uD83C\uDDF0" },
    { code: "BDT", symbol: "\u09F3", label: "Bangladeshi Taka",      locale: "bn-BD", flag: "\uD83C\uDDE7\uD83C\uDDE9" },
    { code: "LKR", symbol: "\u20A8", label: "Sri Lankan Rupee",      locale: "en-LK", flag: "\uD83C\uDDF1\uD83C\uDDF0" },
    { code: "NPR", symbol: "\u20A8", label: "Nepalese Rupee",        locale: "ne-NP", flag: "\uD83C\uDDF3\uD83C\uDDF5" },
    { code: "SEK", symbol: "kr",     label: "Swedish Krona",         locale: "sv-SE", flag: "\uD83C\uDDF8\uD83C\uDDEA" },
    { code: "NOK", symbol: "kr",     label: "Norwegian Krone",       locale: "nb-NO", flag: "\uD83C\uDDF3\uD83C\uDDF4" },
    { code: "DKK", symbol: "kr",     label: "Danish Krone",          locale: "da-DK", flag: "\uD83C\uDDE9\uD83C\uDDF0" },
    { code: "RUB", symbol: "\u20BD", label: "Russian Ruble",         locale: "ru-RU", flag: "\uD83C\uDDF7\uD83C\uDDFA" },
    { code: "ILS", symbol: "\u20AA", label: "Israeli Shekel",        locale: "he-IL", flag: "\uD83C\uDDEE\uD83C\uDDF1" },
    { code: "KWD", symbol: "\u062F.\u0643", label: "Kuwaiti Dinar",  locale: "ar-KW", flag: "\uD83C\uDDF0\uD83C\uDDFC" },
    { code: "QAR", symbol: "\u0631.\u0642", label: "Qatari Riyal",   locale: "ar-QA", flag: "\uD83C\uDDF6\uD83C\uDDE6" },
    { code: "OMR", symbol: "\u0631.\u0639", label: "Omani Rial",     locale: "ar-OM", flag: "\uD83C\uDDF4\uD83C\uDDF2" },
    { code: "BHD", symbol: ".د.ب",   label: "Bahraini Dinar",        locale: "ar-BH", flag: "\uD83C\uDDE7\uD83C\uDDED" },
    { code: "MMK", symbol: "K",      label: "Myanmar Kyat",          locale: "my-MM", flag: "\uD83C\uDDF2\uD83C\uDDF2" },
    { code: "VND", symbol: "\u20AB", label: "Vietnamese Dong",       locale: "vi-VN", flag: "\uD83C\uDDFB\uD83C\uDDF3" }
  ];

  function getCurrency() {
    var saved = readJson(CURRENCY_KEY, { code: "INR" });
    return CURRENCIES.find(function (c) { return c.code === saved.code; }) || CURRENCIES[0];
  }

  function setCurrency(code) {
    writeJson(CURRENCY_KEY, { code: code });
  }

  /* ── Activity categories (15) ─────────────────────────────────────────── */
  var CATEGORIES = [
    "Duty / Work", "Time Waste", "Social Media", "Study / Learning",
    "Exercise / Fitness", "Sleep / Rest", "Family / Relationships",
    "Household Chores", "Entertainment", "Commute / Travel",
    "Health / Self-care", "Creative / Hobby", "Shopping / Errands",
    "Food / Cooking", "Other"
  ];
  /* categories counted as "wasted" time when calculating value lost */
  var WASTE_CATEGORIES = ["Time Waste", "Social Media", "Entertainment"];

  /* Typical hour-of-day productivity curve (0-100). General circadian
     pattern: rises through the morning, dips after lunch, small evening
     rebound, low overnight. Used only for the light on-device nudge —
     not a scientific measurement of the user. */
  var PRODUCTIVITY_CURVE = {
    0:15, 1:10, 2:8,  3:8,  4:10, 5:20, 6:35, 7:50,
    8:70, 9:88, 10:95,11:90,12:75,13:55,14:50,15:60,
    16:68,17:65,18:55,19:48,20:45,21:38,22:28,23:20
  };

  /* ── UI state ──────────────────────────────────────────────────────────── */
  var injectedStyle   = false;
  var injectedFrogStyle = false;
  var activeOverlay   = null;
  var budgetEditingId = null;
  var budgetAddingNew = false;
  var budgetQuery     = "";
  var budgetCategory  = "";
  var budgetPayment   = "";
  var gramCurrentId   = null;   /* which infographic's comments are open */
  var routineEditingId = null;  /* which routine item the sheet is editing, null = adding new */
  var _routineMidnightTimer = null; /* re-renders the tool if the date rolls over while it's open */
  var catModalRoot     = null;  /* category-selection popup element */
  var catModalMinutes  = 0;
  var catModalLabel    = "";
  var pendingBlockActivityName = ""; /* activity name captured when "Log a time block" is opened, used once the block is actually saved */
  var lifeValueShowCalc = false;

  /* The optional tag is captured when a live activity starts and held until
     the activity stops. A blank tag is valid and is never prompted for again. */
  var PENDING_TIMER_CAT_KEY = "lt_pending_timer_cat_v1";
  var PENDING_BLOCK_CAT_KEY = "lt_pending_block_cat_v1";
  var suppressTimerGate = false; /* true only for the one synthetic re-click we fire after Save, so it isn't gated again */

  /* ── Infographics ──────────────────────────────────────────────────────── */
  var GRAM_BASE      = "https://raw.githubusercontent.com/webscratch1947/infographics/main/";
  var GRAM_IDS       = ["001","002","003","004","005","006","007","008","009","010","011","012","013","014","017","018","019","020","021","022","023","024"];
  var GRAM_CACHE_KEY = "lt_gram_ids_cache_v1";
  var GRAM_CACHE_TTL = 10 * 60 * 1000;

  function gramLoadIds(callback) {
    var cache = readJson(GRAM_CACHE_KEY, null);
    if (cache && Array.isArray(cache.ids) && cache.ids.length && (Date.now() - (cache.ts || 0) < GRAM_CACHE_TTL)) {
      GRAM_IDS = cache.ids;
      callback();
      return;
    }
    fetch("https://api.github.com/repos/webscratch1947/infographics/contents/")
      .then(function (r) { return r.json(); })
      .then(function (files) {
        if (!Array.isArray(files)) { callback(); return; }
        var ids = files
          .filter(function (f) { return f.type === "file" && /\.jpg$/i.test(f.name); })
          .map(function (f) { return f.name.replace(/\.jpg$/i, ""); })
          .sort();
        if (ids.length) {
          GRAM_IDS = ids;
          writeJson(GRAM_CACHE_KEY, { ids: ids, ts: Date.now() });
        }
        callback();
      })
      .catch(function () { callback(); });
  }

  /* ── Shared likes/comments (visible to every device) ─────────────────────
     Stored as likes.json / comments.json inside the SAME GitHub repo the
     infographic images live in. Every device reads+writes those two files,
     so a like or comment made on one phone shows up on all of them.

     Writes go through our own /api/gram-write serverless function, which
     holds the GitHub token server-side (GH_WRITE_TOKEN env var on Vercel) —
     the token never ships in this client bundle or the app. ── */
  var GH_OWNER = "webscratch1947";
  var GH_REPO  = "infographics";
  var GH_API   = "https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/";
  /* Absolute origin for our own /api/ functions. When this app runs inside
     the Android WebView, pages are served from https://app.local (see
     MainActivity's LocalAssetWebViewClient) — NOT file://, so a protocol
     check alone never catches it. window.AndroidBridge is only ever
     injected by the native app, so it's the reliable signal. A relative
     "/api/..." path has nowhere real to resolve to under app.local — there's
     no server behind that host — so we must always target the real deployed
     domain in that case; on the actual website a relative path still works
     fine, but there's no harm in always using the full URL either way. */
  var LT_API_ORIGIN = (typeof window.AndroidBridge !== "undefined" ||
                        location.hostname === "app.local" ||
                        location.protocol === "file:" || location.protocol === "")
    ? "https://piapp.minutics.com"
    : "";
  var GH_WRITE_API = LT_API_ORIGIN + "/api/gram-write";
  var GRAM_REMOTE_TTL = 30 * 1000; /* re-fetch from GitHub at most every 30s */

  var GRAM_DEVICE_ID       = null;
  var GRAM_LIKES_REMOTE    = null;  /* { "001": ["deviceA","deviceB"], ... } */
  var GRAM_LIKES_SHA       = null;
  var GRAM_COMMENTS_REMOTE = null;  /* { "001": [{id,text,date,device}], ... } */
  var GRAM_COMMENTS_SHA    = null;
  var GRAM_REMOTE_TS       = 0;

  function gramDeviceId() {
    if (GRAM_DEVICE_ID) return GRAM_DEVICE_ID;
    var id = null;
    try {
      if (window.AndroidBridge && typeof window.AndroidBridge.getDeviceId === "function") {
        id = window.AndroidBridge.getDeviceId();
      }
    } catch (e) {}
    if (!id) {
      try { id = localStorage.getItem("lt_device_id"); } catch (e) {}
      if (!id) {
        id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
        try { localStorage.setItem("lt_device_id", id); } catch (e) {}
      }
    }
    GRAM_DEVICE_ID = id;
    return id;
  }

  function b64EncodeUtf8(str) { return btoa(unescape(encodeURIComponent(str))); }
  function b64DecodeUtf8(str) { return decodeURIComponent(escape(atob(str.replace(/\n/g, "")))); }

  function ghGetFile(path, cb) {
    /* Public repo — no token needed to read, so this works even if this
       device's GH_TOKEN is missing/wrong. Only writes need the token. */
    fetch(GH_API + path + "?t=" + Date.now(), { headers: { "Accept": "application/vnd.github+json" } })
      .then(function (r) {
        if (r.status === 404) return { __notfound: true };
        return r.json();
      })
      .then(function (data) {
        if (!data || data.__notfound) { cb(null, {}); return; }
        var json = {};
        try { json = JSON.parse(b64DecodeUtf8(data.content || "")); } catch (e) {}
        cb(data.sha || null, json);
      })
      .catch(function () { cb(undefined, null); });
  }

  function ghPutFile(path, obj, sha, message, cb, retried) {
    var body = { path: path, content: obj, message: message };
    if (sha) body.sha = sha;
    fetch(GH_WRITE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        if (r.status === 409 && !retried) {
          ghGetFile(path, function (freshSha, current) {
            /* merge our object on top of whatever's on the server now, then retry once */
            ghPutFile(path, obj, freshSha, message, cb, true);
          });
          return null;
        }
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      })
      .then(function (result) {
        if (!result) return;
        cb(result.ok, result.ok && result.data && result.data.content ? result.data.content.sha : null);
      })
      .catch(function () { cb(false, null); });
  }

  function gramSyncRemote(callback) {
    if (GRAM_LIKES_REMOTE && GRAM_COMMENTS_REMOTE && (Date.now() - GRAM_REMOTE_TS < GRAM_REMOTE_TTL)) {
      callback();
      return;
    }
    var pending = 2;
    function done() { pending--; if (pending === 0) { GRAM_REMOTE_TS = Date.now(); callback(); } }
    ghGetFile("likes.json", function (sha, json) {
      GRAM_LIKES_SHA = sha; GRAM_LIKES_REMOTE = json || {}; done();
    });
    ghGetFile("comments.json", function (sha, json) {
      GRAM_COMMENTS_SHA = sha; GRAM_COMMENTS_REMOTE = json || {}; done();
    });
  }

  /* ── Utilities ─────────────────────────────────────────────────────────── */

  var FREE_ACTIVITY_LIMIT = 5;
  var FREE_JOURNAL_DAYS   = 7;
  /* When a Pro user cancels/downgrades while holding MORE than
     FREE_ACTIVITY_LIMIT activities, they keep everything for a grace
     period. A warning shows the whole time; if they don't re-upgrade
     before the grace period ends, extra activities are auto-trimmed
     down to the limit (soft-deleted, same as manually removing one —
     already-tracked time stays in the Journal). */
  var ACTIVITY_GRACE_DAYS = 3;
  var ACTIVITY_GRACE_MS   = ACTIVITY_GRACE_DAYS * 24 * 60 * 60 * 1000;
  var DOWNGRADE_AT_KEY    = "lt_downgrade_at_v1";
  /* Pro journal history used to be a flat 30, which under-counts every month
     with 31 days. Now it's the actual number of days in the current calendar
     month, detected automatically — 28/29/30/31 as appropriate. */
  function proJournalDays() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  function isPro() {
    return readJson(PLAN_KEY, "free") === "pro";
  }
  function setPlan(plan) {
    var wasPro  = isPro();
    var newPlan = plan === "pro" ? "pro" : "free";
    writeJson(PLAN_KEY, newPlan);
    if (newPlan === "pro") {
      /* Re-upgraded (in time or otherwise) — clear any pending grace timer. */
      writeJson(DOWNGRADE_AT_KEY, null);
    } else if (wasPro && nonArchivedActivityCount() > FREE_ACTIVITY_LIMIT) {
      /* Just downgraded/cancelled while over the free limit — start the
         grace-period countdown (only if one isn't already running). */
      if (!readJson(DOWNGRADE_AT_KEY, null)) writeJson(DOWNGRADE_AT_KEY, Date.now());
    }
  }
  /* Exposed so a future Razorpay/webhook flow (or manual testing) can flip this */
  window.LTPlan = { isPro: isPro, setPlan: setPlan };

  var GOAL_TYPE_DEFAULTS = {
    retirement: { word: "Retirement", dateLabel: "Retirement date" },
    age:        { word: "Age Goal",   dateLabel: "Target date" },
    fire:       { word: "FIRE",       dateLabel: "FIRE date" }
    /* "milestone" uses a custom label, handled in getGoalType() */
  };

  function getGoalType() {
    var g = readJson(GOAL_TYPE_KEY, { type: "retirement", milestoneLabel: "Milestone" });
    if (g.type === "milestone") {
      var custom = (g.milestoneLabel || "Milestone").trim() || "Milestone";
      return { type: "milestone", word: custom, dateLabel: custom + " date" };
    }
    var def = GOAL_TYPE_DEFAULTS[g.type] || GOAL_TYPE_DEFAULTS.retirement;
    return { type: g.type || "retirement", word: def.word, dateLabel: def.dateLabel };
  }
  function setGoalType(type, milestoneLabel) {
    writeJson(GOAL_TYPE_KEY, { type: type, milestoneLabel: milestoneLabel || "Milestone" });
  }
  window.LTGoal = { get: getGoalType, set: setGoalType };

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — Life Progress + Goal Reach Countdown card (Timer tab)
     Mirrors the app's own native math EXACTLY:
       - dob must be parsed as `new Date(dob)` (no time suffix) because
         that's how the native bundle parses it (UTC midnight) — appending
         "T00:00:00" would parse as LOCAL midnight and silently drift the
         countdown by your UTC offset (this was the earlier bug).
       - title/wording follows the user's chosen Goal Type (Retirement /
         Age Goal / FIRE / Milestone) instead of a hardcoded label.
     The native collapsible countdown panel is hidden (not deleted) since
     this card fully replaces it — no more duplicate/conflicting timer.
  ══════════════════════════════════════════════════════════════════════════ */

  function getLtProfile() {
    var p = readJson(PROFILE_KEY, null);
    if (!p || !p.name || !p.dob || typeof p.lifespanYears !== "number") return null;
    return p;
  }

  function lifeGoalDate(profile) {
    var d = new Date(profile.dob);
    d.setFullYear(d.getFullYear() + profile.lifespanYears);
    return d;
  }

  function lifeStats(profile) {
    var dob = new Date(profile.dob);
    var end = lifeGoalDate(profile);
    var totalMs = end.getTime() - dob.getTime();
    var livedMs = Date.now() - dob.getTime();
    var percent = Math.min(100, Math.max(0, (livedMs / totalMs) * 100));
    var remainMs = Math.max(0, end.getTime() - Date.now());
    var totalSec = Math.floor(remainMs / 1000);
    var years = Math.floor(totalSec / (365.25 * 24 * 3600));
    var rem = totalSec - Math.floor(years * 365.25 * 24 * 3600);
    var days = Math.floor(rem / 86400); rem -= days * 86400;
    var hours = Math.floor(rem / 3600); rem -= hours * 3600;
    var minutes = Math.floor(rem / 60);
    var seconds = rem % 60;
    return {
      percent: percent, years: years, days: days, hours: hours,
      minutes: minutes, seconds: seconds,
      dateLabel: end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    };
  }

  function greetingWord() {
    var h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }

  function lpBox(id, label, accent) {
    return '<div class="lt-lp-box' + (accent ? " lt-lp-accent" : "") + '">' +
      '<span class="lt-lp-num" id="' + id + '">00</span>' +
      '<span class="lt-lp-lbl">' + label + '</span>' +
    '</div>';
  }

  /* Hide the native collapsible countdown panel — it's the "▲/▼" toggle
     bar plus the panel beneath it — since our card fully replaces it and
     showing both was a confusing duplicate/mismatched timer. */
  function hideNativeTimerPanel() {
    var toggle = Array.prototype.slice.call(document.querySelectorAll("button"))
      .find(function (b) { var t = (b.textContent || "").trim(); return t === "\u25B2" || t === "\u25BC"; });
    if (!toggle) return;
    var wrap = toggle.parentElement;
    if (wrap && wrap.style.display !== "none") wrap.style.display = "none";
  }

  /* Hide the native "Today's time value left" widget — replaced by our
     own live Time Value section inside #lt-life-progress. */
  function hideNativeTvWidget() {
    var label = Array.prototype.slice.call(document.querySelectorAll("p"))
      .find(function (el) { return el.children.length === 0 && el.textContent.trim() === "Today's time value left"; });
    if (!label) return;
    var card = label.parentElement;
    while (card && card !== document.body && card.style.display !== "none" &&
           (!card.className || card.className.indexOf("bg-primary") === -1)) {
      card = card.parentElement;
    }
    if (card && card !== document.body) card.style.display = "none";
  }

  /* Locate the native "New activity..." add-row and the activity list
     directly above it (they're adjacent siblings in the app's own markup) —
     these get tucked under the new pseudo "Activity" nav tab instead of
     always showing on the Timer tab. */
  function findActivityElements() {
    var input = document.querySelector('input[placeholder="New activity..."]');
    if (!input) return null;
    var addRow = input.parentElement;
    var list = addRow ? addRow.previousElementSibling : null;
    return { addRow: addRow, list: list };
  }

  var _activeSubTab = "timer"; /* "timer" | "activity" — our own pseudo-tab, both live on route "/" */

  function applySubTabVisibility() {
    var onTimerPage = location.pathname === "/";
    var lp = document.getElementById("lt-life-progress");
    if (lp) lp.style.display = (!onTimerPage || _activeSubTab === "activity") ? "none" : "";
    var glance = document.getElementById("lt-glance-section");
    if (glance) glance.style.display = (!onTimerPage || _activeSubTab === "activity") ? "none" : "";
    var quote = document.getElementById("lt-quote-section");
    /* Remove the decorative flower/quote card from the Timer page. */
    if (quote) quote.remove();
    var achTimer = document.getElementById("lt-timer-achievements");
    if (achTimer) achTimer.remove();
    var act = findActivityElements();
    if (act) {
      var show = (_activeSubTab === "activity" && onTimerPage) ? "" : "none";
      if (act.addRow) act.addRow.style.display = show;
      if (act.list) act.list.style.display = show;
    }
    if (_activeSubTab === "activity" && onTimerPage) {
      buildActivityStatsHeader();
    } else {
      var header = document.getElementById("lt-activity-header");
      if (header) header.style.display = "none";
    }
    lockTimerPageScroll();
  }

  /* Categories that hurt focus score when time is logged against them */
  var FOCUS_PENALTY_CATEGORIES = ["Time Waste", "Social Media", "Entertainment"];
  /* Categories that boost focus score */
  var FOCUS_BOOST_CATEGORIES   = ["Duty / Work", "Study / Learning", "Exercise / Fitness", "Creative / Hobby", "Health / Self-care"];

  /* Compute a 0-100 focus score from today's category log.
     Logic:
       - Start at 100.
       - For every minute in a penalty category: -1 pt.
       - For every minute in a boost category:   +0.25 pts, never above 100.
       - Result clamped 0-100. */
  function calcFocusScore(entries) {
    if (!entries || entries.length === 0) return 100;
    var penaltyMin = 0, boostMin = 0;
    entries.forEach(function (e) {
      var m = Number(e.minutes) || 0;
      if (FOCUS_PENALTY_CATEGORIES.indexOf(e.category) !== -1) penaltyMin += m;
      else if (FOCUS_BOOST_CATEGORIES.indexOf(e.category) !== -1) boostMin += m;
    });
    var score = 100 - penaltyMin + (boostMin * 0.25);
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /* Include the currently running, already-tagged activity in the cards.
     The timer is intentionally allowed to run without a tag; blank tags do
     not earn value or change focus score. */
  function todayEntriesIncludingLive() {
    var entries = catLogEntries().filter(function (e) { return e.date === today(); });
    var pending = readJson(PENDING_TIMER_CAT_KEY, null);
    var startedAt = Number(readJson(RUNNING_TIMER_KEY, 0));
    if (pending && pending.category && startedAt > 0) {
      var liveMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
      if (liveMinutes > 0) {
        entries.push({
          category: pending.category,
          minutes: liveMinutes,
          label: pending.label || "",
          reason: pending.reason || ""
        });
      }
    }
    return entries;
  }

  /* Full "Activity's" page chrome: date-stamped title + 4 stat cards +
     section label, sitting above the app's own native activity list/add
     row (those keep working exactly as before — we're only framing them). */
  function activityStatsForToday() {
    var entries = todayEntriesIncludingLive();
    var minutes = entries.reduce(function (s, e) { return s + (Number(e.minutes) || 0); }, 0);
    var rate = tvRateStored();
    /* Only tagged, non-waste minutes count toward Value Earned. */
    var productiveMinutes = entries.reduce(function (s, e) {
      return e.category && WASTE_CATEGORIES.indexOf(e.category) === -1
        ? s + (Number(e.minutes) || 0) : s;
    }, 0);
    var value = rate ? productiveMinutes * Number(rate.perMinute) : 0;
    return {
      minutes: minutes,
      value: value,
      hasValue: !!rate,
      focusScore: calcFocusScore(entries),
      activityCount: nonArchivedActivityCount()
    };
  }

  function buildActivityStatsHeader() {
    var act = findActivityElements();
    if (!act || !act.list || !act.addRow) return;
    var host = act.list.parentElement;
    if (!host) return;
    var header = document.getElementById("lt-activity-header");
    if (!header) {
      header = document.createElement("div");
      header.id = "lt-activity-header";
      header.setAttribute("data-lt-enhancement", "1");
    }
    /* Must sit directly above the activity list (Work/Sleep/etc) and the
       add row — NOT at the very top of host, which also holds the Timer
       panel / Daily Value bar as siblings. Re-assert every call since the
       app's own re-renders can reorder things. */
    if (header.nextElementSibling !== act.list || header.parentNode !== host) {
      host.insertBefore(header, act.list);
    }
    header.style.display = "";

    var s = activityStatsForToday();
    var dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });

    header.innerHTML =
      '<div class="lt-act-topline">' +
        '<h1 class="lt-act-title">Activity\u2019s</h1>' +
        '<span class="lt-act-date">' + escapeHtml(dateLabel) + '</span>' +
      '</div>' +
      '<div class="lt-act-stats-grid">' +
        '<div class="lt-act-stat-card">' +
          '<span class="lt-act-stat-icon" style="background:#DCFCE7">\u23F1</span>' +
          '<p class="lt-act-stat-label">Time Tracked</p>' +
          '<p class="lt-act-stat-value">' + fvFormatMinutes(s.minutes) + '</p>' +
        '</div>' +
         '<div class="lt-act-stat-card" id="lt-value-earned-card">' +
          '<span class="lt-act-stat-icon" style="background:#FEF3C7">\uD83D\uDCB0</span>' +
          '<p class="lt-act-stat-label">Value Earned</p>' +
           (s.hasValue
             ? '<p class="lt-act-stat-value">' + money(s.value) + '</p>'
             : '<p class="lt-add-time-value-label">Setup Time Value Calculator</p>') +
        '</div>' +
        '<div class="lt-act-stat-card">' +
          '<span class="lt-act-stat-icon" style="background:#FEE2E2">\uD83C\uDFAF</span>' +
          '<p class="lt-act-stat-label">Focus Score</p>' +
          '<p class="lt-act-stat-value">' + s.focusScore + '<span class="lt-act-stat-suffix">/100</span></p>' +
        '</div>' +
        '<div class="lt-act-stat-card">' +
          '<span class="lt-act-stat-icon" style="background:#EDE9FE">\uD83D\uDD25</span>' +
          '<p class="lt-act-stat-label">Activities</p>' +
          '<p class="lt-act-stat-value">' + s.activityCount + '</p>' +
        '</div>' +
      '</div>' +
      '<p class="lt-act-section-label">Your Activities</p>' +
      '<p style="font-size:11px;color:hsl(var(--muted-foreground));margin:-4px 16px 8px;font-weight:600">' +
        '⚠️ Default activities don’t count toward achievements' +
      '</p>' +
      (function () {
        var grace = downgradeGraceStatus();
        if (!grace) return "";
        var count = nonArchivedActivityCount();
        return '<p style="font-size:11px;color:#c0392b;background:#FDECEA;margin:0 16px 10px;padding:8px 10px;font-weight:700;line-height:1.4">' +
          '⚠️ You have ' + count + ' activities but the Free plan only allows ' + FREE_ACTIVITY_LIMIT + '. ' +
          'Upgrade to Pro within ' + grace.daysLeft + ' day' + (grace.daysLeft === 1 ? "" : "s") +
          ' or extra activities will be automatically removed.' +
        '</p>';
      })();

    var addTimeValue = document.getElementById("lt-add-time-value");
    if (addTimeValue) addTimeValue.addEventListener("click", goToTimeValueTool); /* no-op now: element is plain text, kept for safety if markup ever restores the button */
  }

  function activityTabClasses() {
    return "flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors text-[10px] font-semibold tracking-wide " +
      (_activeSubTab === "activity" ? "text-primary lt-navtab-active" : "text-muted-foreground");
  }

  function ensureActivityNavTab() {
    var nav = document.querySelector("nav.flex.items-stretch") || document.querySelector("nav");
    if (!nav) return;
    var btn = document.getElementById("lt-activity-navtab");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "lt-activity-navtab";
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><circle cx="12" cy="12" r="9"></circle><path d="M8 12l2.5 2.5L16 9"></path></svg><span>Activity</span>';
      /* One-way select, same as the other tabs — clicking it always
         switches TO Activity (never toggles back off on a second tap).
         If tapped from a different page, hop back to "/" first since the
         activity list only lives on that route, then arm the sub-tab. */
      btn.addEventListener("click", function () {
        /* Order matters: clicking the Timer <a> below fires its own click
           listener (attached further down) which sets _activeSubTab back
           to "timer" — that listener exists so switching between real
           tabs exits Activity mode. If we set "activity" BEFORE calling
           .click(), that listener immediately stomps it back to "timer",
           which is exactly why tapping Activity from another page used to
           land you back on Timer. Setting it AFTER makes it stick. */
        if (location.pathname !== "/") {
          var timerLink = nav.querySelector('a[href="/"]');
          if (timerLink) timerLink.click();
        }
        _activeSubTab = "activity";
        applySubTabVisibility();
        syncNavTabStyles();
        upsertRunningBanner();
        /* Route change is async (SPA re-render), so the Timer page's DOM
           (the activity list/add row) usually isn't mounted yet on this
           same tick — re-apply shortly after so it doesn't wait on the
           slower background poll to actually show Activity content. */
        setTimeout(function () { applySubTabVisibility(); syncNavTabStyles(); upsertRunningBanner(); }, 60);
        setTimeout(function () { applySubTabVisibility(); syncNavTabStyles(); upsertRunningBanner(); }, 250);
      });
      /* Clicking any of the real tabs (Timer included) exits Activity mode,
         same as switching between any other two tabs. This must NOT touch
         the Timer link's own highlight classes — React owns those and sets
         them correctly based on the real current route. Forcing them here
         was exactly why every tab used to show Timer as highlighted no
         matter which page was actually open. */
      Array.prototype.slice.call(nav.querySelectorAll("a")).forEach(function (a) {
        a.addEventListener("click", function () {
          _activeSubTab = "timer";
          applySubTabVisibility();
          syncNavTabStyles();
          upsertRunningBanner();
          /* Same reasoning as above — the destination page's own content
             (Life Hub / Journal / Settings) mounts a moment after the SPA
             route change, so re-check shortly after instead of waiting on
             the slower background poll. */
          setTimeout(upsertRunningBanner, 60);
          setTimeout(upsertRunningBanner, 250);
        });
      });
    }
    /* Always keep it positioned right after the Timer tab, not appended
       at the end — nav can get re-rendered by React, so re-assert order
       every cycle rather than only on first creation. */
    var timerLink = nav.querySelector('a[href="/"]');
    var desiredNext = timerLink ? timerLink.nextSibling : nav.firstChild;
    if (btn.previousSibling !== timerLink || desiredNext !== btn) {
      if (timerLink) nav.insertBefore(btn, timerLink.nextSibling);
      else nav.insertBefore(btn, nav.firstChild);
    }
    btn.style.display = "";
    syncNavTabStyles();
  }

  function syncNavTabStyles() {
    var btn = document.getElementById("lt-activity-navtab");
    if (btn) btn.className = activityTabClasses();
    var nav = document.querySelector("nav.flex.items-stretch") || document.querySelector("nav");
    if (!nav) return;
    /* The real Timer link's highlight classes (text-primary / lt-navtab-active
       vs text-muted-foreground) are set by React itself on every render,
       based on the actual current route — this file must never add or
       remove them directly, or they go stale the instant a real tab click
       fires. The ONLY thing we need to do here is dim the Timer link while
       our pseudo Activity tab is showing instead, which is done purely via
       a data attribute + CSS override below so it can never conflict with
       or outlive React's own class management. */
    if (_activeSubTab === "activity") {
      nav.setAttribute("data-lt-activity-mode", "1");
    } else {
      nav.removeAttribute("data-lt-activity-mode");
    }
  }

  /* Top bar restyle — swap the hardcoded black/white header for a light
     card with dark text, to match the app's own light color scheme.
     Colors only. The app's own LTTopNav component (checked directly in
     the compiled bundle) already renders as the FIRST child of the page's
     root flex column, before <main>, with "sticky top-0" baked into its
     own className — it was never structurally broken. Every earlier
     attempt here to also "fix" its position/order was solving a problem
     that didn't exist, and the DOM-reordering was itself what caused the
     bar to end up out of place. Leave positioning to the app; only touch
     colors, every tick, since the bar's background is also set inline by
     React on its own renders and gets reset on re-mounts. */
  function restyleTopNav() {
    var title = Array.prototype.slice.call(document.querySelectorAll("span"))
      .find(function (el) { return el.textContent.trim() === "LifeTime" && el.children.length === 0; });
    if (!title) return;
    var oldBar = title.parentElement;
    if (!oldBar) return;

    /* Permanently hide the original bar — we're not touching or
       restyling it anymore, it's replaced outright below. */
    oldBar.style.setProperty("display", "none", "important");

    /* Build a brand new bar once, then just keep its content in sync
       on every pass instead of tearing it down and rebuilding — avoids
       any flash/duplication from being re-inserted every tick. */
    var bar = document.getElementById("lt-new-topbar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "lt-new-topbar";
      bar.style.cssText =
        "position:sticky;top:0;z-index:40;display:flex;align-items:center;" +
        "justify-content:space-between;padding:14px 20px;" +
        "background-color:hsl(42 40% 95%);" +
        "border-bottom:1px solid hsl(220 15% 88%);" +
        "font-family:'Inter',sans-serif;";
      bar.innerHTML =
        '<span style="font-weight:800;font-size:17px;color:hsl(230 40% 16%);letter-spacing:-0.01em;">LifeTime</span>' +
        '<span id="lt-new-topbar-avatar" style="width:32px;height:32px;border-radius:50%;' +
        'background-color:hsl(230 40% 16%);color:#fff;font-weight:800;font-size:14px;' +
        'display:flex;align-items:center;justify-content:center;">N</span>';
      oldBar.parentElement.insertBefore(bar, oldBar);
    }

    /* Keep the avatar initial in sync with the saved profile name. */
    var avatar = document.getElementById("lt-new-topbar-avatar");
    if (avatar) {
      var profile = getLtProfile();
      var initial = (profile && profile.name) ? profile.name.trim().charAt(0).toUpperCase() : "N";
      if (avatar.textContent !== initial) avatar.textContent = initial;
    }
  }

  function clickNavTab(name) {
    var link = Array.prototype.slice.call(document.querySelectorAll("nav a,nav button"))
      .find(function (el) { return new RegExp(name, "i").test(el.textContent); });
    if (link) link.click();
  }

  function tvRateStored() {
    var stored = readJson("lt_time_value_v1", null);
    if (!stored || !Number(stored.perMinute)) return null;
    return stored;
  }

  function tickLifeProgressCard() {
    var card = document.getElementById("lt-life-progress");
    if (!card) return;
    var profile = getLtProfile();
    if (!profile) return;
    var s = lifeStats(profile);
    var circumference = 2 * Math.PI * 44;
    var offset = circumference - (s.percent / 100) * circumference;

    var fill = card.querySelector(".lt-lp-fill");
    if (fill) fill.setAttribute("stroke-dashoffset", offset.toFixed(1));
    var pctEl = document.getElementById("lt-lp-pct");
    if (pctEl) pctEl.textContent = Math.round(s.percent) + "%";

    var vals = { "lt-lp-y": s.years, "lt-lp-d": s.days, "lt-lp-h": s.hours, "lt-lp-mi": s.minutes, "lt-lp-s": s.seconds };
    Object.keys(vals).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(vals[id]).padStart(2, "0");
    });

    /* Live-decreasing Time Value section, same math as the native ticker */
    var tvSection = document.getElementById("lt-lp-tv");
    var stored = tvRateStored();
    if (stored) {
      var pm = Number(stored.perMinute);
      var dailyHours = Number(stored.hours) || 8;
      var now = new Date();
      var secOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      var remSecToday = 86400 - secOfDay;
      var dailyBudget = pm * 60 * dailyHours;
      var value = Math.max(0, dailyBudget * (remSecToday / 86400));
      var remHours = Math.floor(remSecToday / 3600);
      var remMin = Math.floor((remSecToday % 3600) / 60);

      if (tvSection) {
        var amtEl = document.getElementById("lt-lp-tv-amt");
        if (amtEl) amtEl.textContent = money(value);
        var leftEl = document.getElementById("lt-lp-tv-left");
        if (leftEl) leftEl.textContent = remHours + "h " + remMin + "m left";
        var rateEl = document.getElementById("lt-lp-tv-rate");
        if (rateEl) rateEl.textContent = money(pm * 60) + "/hour based on your income";
      }
    } else if (tvSection) {
      tvSection.style.display = "none";
    }

    hideNativeTimerPanel();
    hideNativeTvWidget();
    ensureActivityNavTab();
    applySubTabVisibility();
  }

  var MOTIVATIONAL_QUOTES = [
    "The best investment you can make is in yourself.",
    "Your time today builds your life tomorrow.",
    "Small steps daily lead to giant leaps yearly.",
    "Discipline is choosing between what you want now and what you want most.",
    "Every hour you invest in yourself compounds for life.",
    "Don\u2019t count the days, make the days count.",
    "Success is the sum of small efforts repeated day in and day out.",
    "You don\u2019t rise to the level of your goals, you fall to the level of your systems.",
    "The future belongs to those who prepare for it today.",
    "One day or day one \u2014 you decide.",
  ];

  function buildTimerAchievements() {
    /* Achievement section removed from timer home — this is a no-op now. */
    return;
    var lp = document.getElementById("lt-life-progress");
    if (!lp) return;

    var existing = document.getElementById("lt-timer-achievements");
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "lt-timer-achievements";
      existing.style.cssText = "margin:12px 16px 20px;box-sizing:border-box";
      /* Insert after quote section if present, else after glance, else after lp */
      var quote  = document.getElementById("lt-quote-section");
      var glance = document.getElementById("lt-glance-section");
      var anchor = quote || glance || lp;
      anchor.parentNode.insertBefore(existing, anchor.nextSibling);
    }

    var stats      = computeAchievementStats();
    var milestones = computeAutoMilestones(stats);
    var unlocked   = milestones.filter(function (m) { return m.current >= m.target; });
    var inProgress = milestones.filter(function (m) { return m.current > 0 && m.current < m.target; }).slice(0, 2);
    var userBadges = getUserBadges();

    var recentBadge = userBadges[0];
    var recentUnlocked = unlocked[unlocked.length - 1]; /* last unlocked */

    /* Only render a slot if there is a real badge — no empty "Add Achievement" boxes */
    function makeBadgeSlot(badge, idx, fullWidth) {
      if (!badge) return '';
      var base = 'border-radius:12px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;min-height:90px;' + (fullWidth ? 'width:100%;box-sizing:border-box;' : 'flex:1;');
      return '<div style="background:hsl(var(--accent)/.08);' + base + '" data-ta-badge="' + idx + '">' +
        '<span style="font-size:26px">' + escapeHtml(badge.icon || "\uD83C\uDFC5") + '</span>' +
        '<span style="font-size:11px;font-weight:700;text-align:center;color:hsl(var(--foreground))">' + escapeHtml(badge.name) + '</span>' +
        '<span style="font-size:10px;color:hsl(var(--muted-foreground))">Your badge</span>' +
      '</div>';
    }

    /* Build badge card HTML — only the slots that have real badges */
    var slot0 = makeBadgeSlot(userBadges[0], 0, true);
    var slot1 = makeBadgeSlot(userBadges[1], 1, false);
    var slot2 = makeBadgeSlot(userBadges[2], 2, false);
    var rowTwo = (slot1 || slot2)
      ? '<div style="display:flex;gap:10px;margin-top:10px">' + slot1 + slot2 + '</div>'
      : '';
    /* If the user has no badges yet, show a compact placeholder so the
       section header is still visible but no empty dashed boxes appear */
    var badgeBody = (slot0 || rowTwo)
      ? '<div style="background:hsl(var(--background));border:1px solid hsl(var(--border));border-radius:16px;padding:14px;">' + slot0 + rowTwo + '</div>'
      : '<div style="color:hsl(var(--muted-foreground));font-size:12px;padding:8px 2px">Earn your first badge — tap View All to see milestones.</div>';

    existing.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
        '<span style="font-size:18px;font-weight:900;color:hsl(var(--foreground))">Achievements</span>' +
        '<span id="lt-ta-viewall" style="font-size:13px;font-weight:700;color:hsl(var(--primary));cursor:pointer">View All</span>' +
      '</div>' +
      badgeBody;

    document.getElementById("lt-ta-viewall").addEventListener("click", function () {
      openOverlay(renderAchievements);
    });
    /* Any badge slot click → open achievement overlay so user can pick */
    existing.addEventListener("click", function (e) {
      var slot = e.target.closest("[data-ta-badge]");
      if (slot) openOverlay(renderAchievements);
    });
  }

  function buildGlanceSection() {
    var lp = document.getElementById("lt-life-progress");
    if (!lp) return;

    /* Collect today's usage */
    var todayEntries = catLogEntries().filter(function (e) { return e.date === today(); });
    var db = readJson(LOCAL_DB_KEY, { activities: [] });
    /* Deleting an activity in the native app is a soft-delete — it flags
       archived:true rather than removing it from storage. The native list
       correctly filters these out; this section wasn't, which is exactly
       why a deleted activity kept showing here indefinitely. */
    var activities = (Array.isArray(db.activities) ? db.activities : []).filter(function (a) { return !a.archived; });

    /* Count minutes per activity label for today */
    var usageMap = {};
    todayEntries.forEach(function (e) {
      var key = e.label || e.category || "Other";
      usageMap[key] = (usageMap[key] || 0) + (Number(e.minutes) || 0);
    });

    /* Build the 4 slots:
       - Used activities today come first, sorted by minutes desc
       - Remaining slots filled with unused activities from the list
       - Always exactly 4 slots shown */
    var validNames = {};
    activities.forEach(function (a) { validNames[a.name] = true; });

    /* A deleted (archived) activity can still have usage minutes logged
       for today — usageMap comes from the log, not the activity list — so
       without this check it kept showing here (with a wrong fallback
       emoji, since it could no longer find itself in the real list). */
    var usedNames = Object.keys(usageMap)
      .filter(function (n) { return usageMap[n] > 0 && validNames[n]; })
      .sort(function (a, b) { return usageMap[b] - usageMap[a]; })
      .slice(0, 4);

    var allNames = activities.map(function (a) { return a.name; });
    var unusedNames = allNames.filter(function (n) { return usageMap[n] === undefined || usageMap[n] === 0; });

    var slots = usedNames.slice();
    for (var si = 0; slots.length < 4 && si < unusedNames.length; si++) {
      slots.push(unusedNames[si]);
    }
    /* Only show as many cards as the user actually has activities for —
       up to 4. No more padding with dimmed "Empty" placeholder cards for
       activities that were deleted; the row should shrink to match what's
       really there, and disappear entirely (replaced by an empty-state
       message) once nothing is left. */

    var existing = document.getElementById("lt-glance-section");
    if (!existing) {
      existing = document.createElement("div");
      existing.id = "lt-glance-section";
      existing.style.cssText = "margin:12px 16px 0;box-sizing:border-box";
      lp.parentNode.insertBefore(existing, lp.nextSibling);
    }

    var GLANCE_ICONS = ["📖","💼","❤️","👥","⏱️","🏃","🍽️","🚗","📱","👨‍👩‍👧","💤","✏️"];
    function iconFor(name) {
      if (!name) return "➕";
      var act = activities.filter(function (a) { return a.name === name; })[0];
      if (act && act.emoji) return act.emoji;
      return GLANCE_ICONS[Math.abs(name.charCodeAt(0)) % GLANCE_ICONS.length];
    }
    function fmtMins(m) {
      if (!m) return "0m";
      var h = Math.floor(m / 60), min = m % 60;
      return h > 0 ? h + "h" + (min > 0 ? " " + min + " min" : "") : min + " min";
    }

    var CARD_COLORS = [
      { bg:"#FFF8E1", accent:"#F59E0B" },
      { bg:"#EDE9FE", accent:"#7C3AED" },
      { bg:"#FEE2E2", accent:"#EF4444" },
      { bg:"#E0F2FE", accent:"#0284C7" },
    ];

    var totalMinsToday = todayEntries.reduce(function (s, e) { return s + (Number(e.minutes) || 0); }, 0);

    /* Cards in a single horizontal row, one per remaining activity (max 4).
       Column count matches the actual slot count so 1 or 2 activities get
       cards the same size as a full row of 4 — not stretched or shrunk. */
    var cardsHtml = slots.length === 0
      ? '<div style="padding:22px 12px;text-align:center;color:hsl(var(--muted-foreground));font-size:13px;font-weight:600;background:hsl(var(--muted));border-radius:12px">No activities found</div>'
      : '<div style="display:grid;grid-template-columns:repeat(' + slots.length + ',1fr);gap:7px">' +
      slots.map(function (name, i) {
        var mins = name ? (usageMap[name] || 0) : 0;
        var used = mins > 0;
        var col  = CARD_COLORS[i % CARD_COLORS.length];
        var pct  = (used && totalMinsToday > 0) ? Math.min(100, Math.round((mins / totalMinsToday) * 100)) : 0;
        var label = name ? escapeHtml(name.length > 8 ? name.slice(0, 7) + "…" : name) : "Empty";
        var dimStyle = used ? "" : "opacity:0.55;";
        return (
          '<div style="background:' + col.bg + ';border-radius:12px;padding:9px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:2px;' + dimStyle + '">' +
            '<div style="font-size:20px;line-height:1.2">' + iconFor(name) + '</div>' +
            '<div style="font-size:12px;font-weight:800;color:#1a1a2e;line-height:1.1">' + fmtMins(mins) + '</div>' +
            '<div style="font-size:9px;color:#555;text-align:center;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%">' + label + '</div>' +
            '<div style="width:100%;height:3px;background:rgba(0,0,0,.1);border-radius:20px;overflow:hidden;margin-top:3px">' +
              '<div style="height:100%;width:' + pct + '%;background:' + col.accent + ';border-radius:20px;transition:width .6s"></div>' +
            '</div>' +
          '</div>'
        );
      }).join("") +
    '</div>';

    var viewAllHtml = todayEntries.length > 0 ? '<a style="font-size:13px;font-weight:700;color:hsl(var(--primary));cursor:pointer;text-decoration:none">View All</a>' : '';

    existing.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<span style="font-size:18px;font-weight:900;color:hsl(var(--foreground))">Today at a Glance</span>' +
        viewAllHtml +
      '</div>' +
      cardsHtml;

    /* Wire up the "View All" link to switch to the Activity sub-tab */
    var glanceViewAll = existing.querySelector("a");
    if (glanceViewAll) {
      glanceViewAll.addEventListener("click", function (e) {
        e.preventDefault();
        _activeSubTab = "activity";
        applySubTabVisibility();
        ensureActivityNavTab();
        upsertRunningBanner();
      });
    }
  }

  function buildQuotePlantSection() {
    var lp = document.getElementById("lt-life-progress");
    if (!lp || document.getElementById("lt-quote-section")) return;

    var dayOfLife = (function () {
      var birthStr = (function () {
        /* Try to get DOB from settings stored by app */
        try {
          var s = localStorage.getItem("lt_settings_v1") || localStorage.getItem("lifetime_settings");
          if (s) { var p = JSON.parse(s); if (p && p.dob) return p.dob; }
        } catch (_) {}
        return null;
      })();
      if (!birthStr) return null;
      var birth = new Date(birthStr);
      var now   = new Date();
      return Math.floor((now - birth) / 86400000) + 1;
    })();

    var quote = '\u201cLost, yesterday, somewhere between sunrise and sunset, two golden hours, each set with sixty diamond minutes. No reward is offered, for they are gone forever.\u201d \u2014 Horace Mann';

    var section = document.createElement("div");
    section.id = "lt-quote-section";
    section.style.cssText = "margin:12px 16px 0;box-sizing:border-box";
    section.innerHTML =
      '<div style="background:hsl(var(--primary));border-radius:18px;padding:18px 16px;display:flex;align-items:center;gap:14px;min-height:90px">' +
        '<div style="font-size:48px;line-height:1;flex-shrink:0" aria-hidden="true">🪴</div>' +
        '<div style="flex:1">' +
          '<p style="margin:0;font-size:13px;font-weight:600;color:rgba(255,255,255,.85);line-height:1.5">' + escapeHtml(quote) + '</p>' +
        '</div>' +
        (dayOfLife ?
          '<div style="flex-shrink:0;background:rgba(0,0,0,.3);border-radius:12px;padding:8px 10px;text-align:center">' +
            '<div style="font-size:9px;font-weight:800;letter-spacing:.06em;color:rgba(255,255,255,.6);margin-bottom:2px">DAY</div>' +
            '<div style="font-size:22px;font-weight:900;color:#fff;line-height:1">🏆</div>' +
            '<div style="font-size:9px;color:rgba(255,255,255,.6);margin-top:2px">' + dayOfLife.toLocaleString() + '</div>' +
          '</div>'
        : '') +
      '</div>';

    /* Insert after the glance section if it exists, else after lp */
    var glance = document.getElementById("lt-glance-section");
    var anchor = glance || lp;
    anchor.parentNode.insertBefore(section, anchor.nextSibling);
  }

  function buildLifeProgressCard() {
    if (location.pathname !== "/") {
      var existing = document.getElementById("lt-life-progress");
      if (existing) existing.remove();
      var g = document.getElementById("lt-glance-section");   if (g) g.remove();
      var q = document.getElementById("lt-quote-section");    if (q) q.remove();
      /* lt-timer-achievements intentionally removed */
      /* Activity tab stays visible/positioned on every route now — only
         its highlighted "active" state resets when you're not on Timer. */
      _activeSubTab = "timer";
      if (_lifeProgressTimer) { clearInterval(_lifeProgressTimer); _lifeProgressTimer = null; }
      ensureActivityNavTab();
      var header = document.getElementById("lt-activity-header");
      if (header) header.style.display = "none";
      return;
    }
    var profile = getLtProfile();
    if (!profile) return;
    var goal = getGoalType();
    var hasTv = !!tvRateStored();

    var card = document.getElementById("lt-life-progress");
    if (card) { tickLifeProgressCard(); return; }

    var host = document.querySelector("main") || document.body;
    card = document.createElement("div");
    card.id = "lt-life-progress";
    card.setAttribute("data-lt-enhancement", "1");
    host.insertBefore(card, host.firstChild);
    card.addEventListener("click", function (e) {
      if (e.target.closest("#lt-lp-viewplan")) clickNavTab("settings");

    });

    card.innerHTML =
      '<div class="lt-lp-top">' +
        '<div>' +
          '<p class="lt-lp-greet">' + greetingWord() + ',</p>' +
          '<h2 class="lt-lp-name">' + escapeHtml(profile.name) + ' \u2728</h2>' +
          '<p class="lt-lp-sub">Make today count. Your future is built by what you do now. \uD83D\uDC9B</p>' +
        '</div>' +
        '<div class="lt-lp-ringbox">' +
          '<p class="lt-lp-ringlabel">LIFE PROGRESS</p>' +
          '<div class="lt-lp-ringwrap">' +
            '<svg width="88" height="88" viewBox="0 0 100 100" class="lt-lp-ring">' +
              '<circle cx="50" cy="50" r="44" class="lt-lp-track"/>' +
              '<circle cx="50" cy="50" r="44" class="lt-lp-fill"/>' +
            '</svg>' +
            '<div class="lt-lp-ringtext"><span class="lt-lp-pct" id="lt-lp-pct">0%</span></div>' +
          '</div>' +
          '<p class="lt-lp-ringsub">of your life lived</p>' +
        '</div>' +
      '</div>' +
      '<div class="lt-lp-countdown">' +
        '<div class="lt-lp-cdhead">' +
          '<div>' +
            '<p class="lt-lp-cdtitle">' + escapeHtml(profile.name) + '\u2019s Remaining ' + goal.word + ' Time</p>' +
            '<p class="lt-lp-cddate">\uD83C\uDFC1 ' + goal.dateLabel + ': ' + lifeStats(profile).dateLabel + '</p>' +
          '</div>' +
          '<button id="lt-lp-viewplan" type="button">View Plan</button>' +
        '</div>' +
        '<div class="lt-lp-grid">' +
          lpBox("lt-lp-y", "YEARS") + lpBox("lt-lp-d", "DAYS") + lpBox("lt-lp-h", "HOURS") +
          lpBox("lt-lp-mi", "MIN") + lpBox("lt-lp-s", "SEC", true) +
        '</div>' +
      '</div>' +
      (hasTv ?
        '<div class="lt-lp-tv" id="lt-lp-tv">' +
          '<div>' +
            '<p class="lt-lp-tv-title">Today\u2019s Time Value</p>' +
            '<p class="lt-lp-tv-sub">Your remaining time</p>' +
            '<p class="lt-lp-tv-amt" id="lt-lp-tv-amt">' + money(0) + '</p>' +
            '<p class="lt-lp-tv-left" id="lt-lp-tv-left">\u2014</p>' +
          '</div>' +
          '<span class="lt-lp-tv-rate" id="lt-lp-tv-rate"></span>' +
        '</div>' : "");

    tickLifeProgressCard();

    if (!_lifeProgressTimer) {
      _lifeProgressTimer = setInterval(function () {
        if (location.pathname === "/" && document.getElementById("lt-life-progress")) {
          tickLifeProgressCard();
          buildGlanceSection();  /* live-update glance every tick */
          buildEatTheFrogCard();
        } else {
          clearInterval(_lifeProgressTimer); _lifeProgressTimer = null;
        }
      }, 1000);
    }

    buildGlanceSection();
    /* buildQuotePlantSection() intentionally not called — the quote card
       was removed from the app several versions ago. It was left wired up
       here (still being built every cycle, then torn down a moment later
       by applySubTabVisibility()'s cleanup) which is exactly why it could
       still flash briefly on cold start/first launch, before that cleanup
       had a chance to run. Not building it at all removes that gap. */
  }
  var _lifeProgressTimer = null;

  /* ══════════════════════════════════════════════════════════════════════════
     Eat the Frog — 3 most-important-tasks-of-the-day card on the Timer tab.
     Sits in normal document flow right after the glance/life-progress cards,
     so it automatically shifts position on its own whenever those cards
     grow/shrink (e.g. the "Today's Time Value" section appearing once
     someone sets up the Time Value Calculator) — no special handling
     needed, the page just reflows and scrolls like any other content.
  ══════════════════════════════════════════════════════════════════════════ */

  function addStyleFrog() {
    if (injectedFrogStyle) return;
    injectedFrogStyle = true;
    var s = document.createElement("style");
    s.textContent = [
      "#lt-frog-card{margin:12px 16px 0;padding:16px;border-radius:16px;background:hsl(var(--card));border:1px solid hsl(var(--border));box-sizing:border-box}",
      "#lt-frog-card .lt-frog-title{font-size:15px;font-weight:800;margin:0;display:flex;align-items:center;gap:6px}",
      "#lt-frog-card .lt-frog-sub{font-size:12px;opacity:.65;margin:2px 0 12px}",
      "#lt-frog-card .lt-frog-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid hsl(var(--border))}",
      "#lt-frog-card .lt-frog-row:first-of-type{border-top:none}",
      "#lt-frog-card .lt-frog-check{width:22px;height:22px;flex-shrink:0;border-radius:50%;border:2px solid hsl(var(--border));background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;-webkit-tap-highlight-color:transparent}",
      "#lt-frog-card .lt-frog-check.lt-frog-done{background:#16A34A;border-color:#16A34A}",
      "#lt-frog-card .lt-frog-check.lt-frog-check-empty{opacity:.35;cursor:default}",
      "#lt-frog-card .lt-frog-input{flex:1;border:none;background:transparent;font-size:14px;color:hsl(var(--foreground));outline:none;min-width:0}",
      "#lt-frog-card .lt-frog-input.lt-frog-done-text{text-decoration:line-through;opacity:.5}",
      "#lt-frog-card .lt-frog-input::placeholder{color:hsl(var(--muted-foreground))}",
      "#lt-frog-card .lt-frog-unstar{background:none;border:none;color:#f5a623;cursor:pointer;padding:4px;flex-shrink:0;display:flex;align-items:center;-webkit-tap-highlight-color:transparent}",
      "#lt-frog-card .lt-frog-unstar:active{transform:scale(.9)}",
      "#lt-frog-card .lt-frog-empty{font-size:13px;color:hsl(var(--muted-foreground));margin:4px 0 0}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* Eat the Frog always shows exactly MAX_STARRED_TASKS (3) rows.
     - Filled rows are a view onto whichever tasks (from My Tasks) are
       starred — starring a task in My Tasks, editing its title here or
       there, and checking it off here or there all read/write the SAME
       task object in TASKS_KEY, so every surface stays in sync automatically.
     - Empty rows (when fewer than 3 tasks are starred) are directly
       editable right here: typing into one creates a brand-new starred
       task in that slot on the spot — no need to go add it in My Tasks
       first. Because it's created already-starred, it can never push the
       total past MAX_STARRED_TASKS: as soon as all 3 slots are filled
       (whether typed here or starred over in My Tasks), starring a 4th
       task from My Tasks hits the normal "Eat the Frog is full" cap in
       toggleTaskStar(). And if only some slots are filled, starring a
       task from My Tasks simply lands in the next empty slot, since
       filled slots always render first (index 0..starred.length-1) and
       empty slots fill the remainder — there's nothing to "replace",
       it just naturally shows up there. */
  var _frogLastSignature = null; /* used to skip rebuilds when nothing changed */

  function frogSignature(tasks) {
    return tasks.map(function (t) { return t.id + ":" + t.title + ":" + (t.completed ? 1 : 0); }).join("|");
  }

  function buildEatTheFrogCard() {
    var onTimerTab = location.pathname === "/" && _activeSubTab !== "activity";
    var existing = document.getElementById("lt-frog-card");
    if (!onTimerTab) {
      if (existing) existing.remove();
      _frogLastSignature = null;
      return;
    }

    var starred = getStarredTasks().slice(0, MAX_STARRED_TASKS);
    var sig = frogSignature(starred);

    if (existing) {
      /* Only skip rebuilding when nothing actually changed. (We deliberately
         do NOT also check "is focus inside this card" here — every local
         edit path below updates _frogLastSignature itself right after the
         mutation, so the signature check alone already prevents typing from
         being interrupted. An extra focus check was here before and it
         caused a real bug: clicking the checkbox/star button focuses that
         very button, which sits inside `existing`, so the check blocked
         the button's own click handler from ever seeing its update take
         effect — the buttons looked broken even though the data underneath
         was saving correctly.) */
      if (sig === _frogLastSignature) return;
    }

    addStyleFrog();
    var anchor = document.getElementById("lt-glance-section") || document.getElementById("lt-life-progress");
    if (!anchor || !anchor.parentNode) return; /* not mounted yet — try again next tick */

    _frogLastSignature = sig;

    var card = existing || document.createElement("div");
    card.id = "lt-frog-card";
    card.setAttribute("data-lt-enhancement", "1");

    var rowsHtml = "";
    for (var i = 0; i < MAX_STARRED_TASKS; i++) {
      var t = starred[i];
      if (t) {
        rowsHtml +=
          '<div class="lt-frog-row">' +
            '<button type="button" class="lt-frog-check' + (t.completed ? " lt-frog-done" : "") + '" data-lt-frog-check="' + t.id + '">' + (t.completed ? "\u2713" : "") + '</button>' +
            '<input type="text" class="lt-frog-input' + (t.completed ? " lt-frog-done-text" : "") + '" data-lt-frog-input="' + t.id + '" placeholder="Task name" value="' + escapeHtml(t.title) + '" />' +
            '<button type="button" class="lt-frog-unstar" data-lt-frog-unstar="' + t.id + '" title="Remove from Eat the Frog">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f5a623" stroke="#f5a623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
            '</button>' +
          '</div>';
      } else {
        /* Empty slot — nothing starred here yet. Renders a live, editable
           row anyway; typing into it creates the task (see the delegated
           "input" handler below). The check/unstar controls stay inert
           (no id to act on) until that happens. */
        rowsHtml +=
          '<div class="lt-frog-row">' +
            '<button type="button" class="lt-frog-check lt-frog-check-empty" data-lt-frog-check="" disabled></button>' +
            '<input type="text" class="lt-frog-input" data-lt-frog-input="" placeholder="Add an important task\u2026" value="" />' +
            '<button type="button" class="lt-frog-unstar" data-lt-frog-unstar="" style="visibility:hidden" title="Remove from Eat the Frog">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="#f5a623" stroke="#f5a623" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
            '</button>' +
          '</div>';
      }
    }

    card.innerHTML =
      '<p class="lt-frog-title">\uD83D\uDC38 Eat the Frog</p>' +
      '<p class="lt-frog-sub">Your 3 most important tasks today</p>' +
      rowsHtml;

    if (!existing) anchor.parentNode.insertBefore(card, anchor.nextSibling);

    /* Delegated listeners, wired once on the card itself rather than per-row
       on every rebuild — a row's underlying task id can change (an empty
       slot becomes a real task the moment someone types into it) without
       needing to re-attach anything, since delegation always reads the
       current data-* attribute at click/input time. */
    if (!card.dataset.frogWired) {
      card.dataset.frogWired = "1";

      card.addEventListener("click", function (e) {
        var checkBtn = e.target.closest("[data-lt-frog-check]");
        if (checkBtn) {
          var cid = checkBtn.getAttribute("data-lt-frog-check");
          if (!cid) return; /* empty slot — nothing to toggle yet */
          var task = getAllTasks().find(function (tk) { return tk.id === cid; });
          if (!task) return;
          task.completed = !task.completed;
          upsertTask(task);
          checkBtn.classList.toggle("lt-frog-done", task.completed);
          checkBtn.textContent = task.completed ? "\u2713" : "";
          var rowInput = checkBtn.parentElement.querySelector("[data-lt-frog-input]");
          if (rowInput) rowInput.classList.toggle("lt-frog-done-text", task.completed);
          _frogLastSignature = frogSignature(getStarredTasks().slice(0, MAX_STARRED_TASKS));
          return;
        }
        var unstarBtn = e.target.closest("[data-lt-frog-unstar]");
        if (unstarBtn) {
          var uid = unstarBtn.getAttribute("data-lt-frog-unstar");
          if (!uid) return; /* empty slot — nothing to unstar */
          toggleTaskStar(uid);
          buildEatTheFrogCard();
        }
      });

      card.addEventListener("input", function (e) {
        var input = e.target.closest("[data-lt-frog-input]");
        if (!input) return;
        var id = input.getAttribute("data-lt-frog-input");

        if (!id) {
          /* Empty slot — first keystroke creates the task right here,
             already starred, so it stays pinned in this exact slot. */
          var val = input.value;
          if (!val.trim()) return; /* whitespace-only — not a task yet */
          if (getStarredTasks().length >= MAX_STARRED_TASKS) return; /* safety net; slot shouldn't exist if full */
          var newTask = { id: genId(), title: val, date: null, time: null, notes: "", completed: false, starred: true, createdAt: Date.now() };
          upsertTask(newTask);
          input.setAttribute("data-lt-frog-input", newTask.id);
          var row = input.closest(".lt-frog-row");
          if (row) {
            var checkBtn2 = row.querySelector("[data-lt-frog-check]");
            if (checkBtn2) {
              checkBtn2.setAttribute("data-lt-frog-check", newTask.id);
              checkBtn2.removeAttribute("disabled");
              checkBtn2.classList.remove("lt-frog-check-empty");
            }
            var unstarBtn2 = row.querySelector("[data-lt-frog-unstar]");
            if (unstarBtn2) {
              unstarBtn2.setAttribute("data-lt-frog-unstar", newTask.id);
              unstarBtn2.style.visibility = "";
            }
          }
          _frogLastSignature = frogSignature(getStarredTasks().slice(0, MAX_STARRED_TASKS));
          return;
        }

        var task2 = getAllTasks().find(function (tk) { return tk.id === id; });
        if (!task2) return;
        task2.title = input.value;
        upsertTask(task2);
        _frogLastSignature = frogSignature(getStarredTasks().slice(0, MAX_STARRED_TASKS));
      });

      /* focusout (unlike blur) bubbles, so it works with delegation.
         If a slot was created here and typed back down to empty, clean the
         title-less task up instead of leaving an orphaned starred task
         behind — the slot just goes back to being empty. */
      card.addEventListener("focusout", function (e) {
        var input = e.target.closest && e.target.closest("[data-lt-frog-input]");
        if (!input) return;
        var id = input.getAttribute("data-lt-frog-input");
        if (!id) return;
        var task3 = getAllTasks().find(function (tk) { return tk.id === id; });
        if (task3 && !task3.title.trim()) {
          removeTask(id);
          buildEatTheFrogCard();
        }
      });
    }
  }




  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  /* Native bridge helpers — used for other locally-persisted data.
     Likes/comments no longer go through here; see gramSyncRemote above. */
  var NATIVE_BRIDGE_KEYS = {};

  function hasBridge() {
    return typeof window.AndroidBridge !== "undefined" &&
           typeof window.AndroidBridge.savePersistent === "function" &&
           typeof window.AndroidBridge.loadPersistent === "function";
  }

  function readJson(key, fallback) {
    try {
      var raw = null;
      if (NATIVE_BRIDGE_KEYS[key] && hasBridge()) {
        raw = window.AndroidBridge.loadPersistent(key);
      }
      if (raw == null) {
        raw = localStorage.getItem(key);
      }
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try {
      var str = JSON.stringify(value);
      localStorage.setItem(key, str);
      if (NATIVE_BRIDGE_KEYS[key] && hasBridge()) {
        window.AndroidBridge.savePersistent(key, str);
      }
    } catch (_) {}
  }

  function money(v) {
    var cur = getCurrency();
    var num = (Number(v) || 0).toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return cur.symbol + num;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function formatDate(v) {
    if (!v) return "\u2014";
    var d = new Date(v + "T00:00:00");
    return isNaN(d.getTime()) ? v : d.toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" });
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  /* ── Deadline model ───────────────────────────────────────────────────────
     A task's "deadline" is entirely optional and is derived from whichever
     of date / time were actually set, per this rule:
       date + time  → deadline is exactly that day at that time
       time only    → deadline is TODAY at that time
       date only    → deadline is the START of that day (00:00) — i.e. the
                       task is due sometime *before* that day begins, not
                       "sometime during" it. Picking a bare date is meant to
                       mean "by the day before this one, at the latest".
       neither      → no deadline; task can never become overdue
  */
  function taskDeadlineMoment(dateStr, timeStr) {
    if (!dateStr && !timeStr) return null;
    var basis = dateStr || today();
    var clock = timeStr || "00:00";
    var d = new Date(basis + "T" + clock + ":00");
    return isNaN(d.getTime()) ? null : d;
  }

  function isTaskOverdue(dateStr, timeStr) {
    var dl = taskDeadlineMoment(dateStr, timeStr);
    return !!dl && Date.now() > dl.getTime();
  }

  /* Whole calendar days since the deadline passed — shown like Google
     Tasks' "X days overdue" chip. Returns 0 until the deadline has
     actually passed, then at least 1 immediately (even a minute past
     midnight already counts as "1 day"). */
  function taskMissedDays(dateStr, timeStr) {
    var dl = taskDeadlineMoment(dateStr, timeStr);
    if (!dl || Date.now() <= dl.getTime()) return 0;
    var dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round((today0 - dlDay) / 86400000));
  }

  function taskDateLabel(dateStr, completed, timeStr) {
    if ((!dateStr && !timeStr) || completed) return "";
    if (isTaskOverdue(dateStr, timeStr)) {
      var missed = taskMissedDays(dateStr, timeStr);
      return "\u26A0 " + missed + " day" + (missed === 1 ? "" : "s") + " overdue";
    }
    var now = new Date(); now.setHours(0,0,0,0);
    var tom = new Date(now); tom.setDate(tom.getDate() + 1);
    var basis = dateStr || today();
    var d = new Date(basis + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    var label;
    if (d.getTime() === now.getTime()) label = "Today";
    else if (d.getTime() === tom.getTime()) label = "Tomorrow";
    else label = d.toLocaleDateString("en-IN", { day:"numeric", month:"short" });
    if (timeStr) label += " \u00b7 " + formatTaskTime(timeStr);
    return label;
  }

  function formatTaskTime(timeStr) {
    var parts = (timeStr || "").split(":");
    if (parts.length < 2) return "";
    var h = parseInt(parts[0], 10), m = parts[1];
    if (isNaN(h)) return "";
    var ampm = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + ampm;
  }

  /* Kept for any other callers still expecting a date-only check; task
     rows themselves now use isTaskOverdue(date, time) so a same-day
     deadline (e.g. "today 3pm") turns red the moment it passes, not only
     after the calendar date rolls over. */
  function isOverdueDate(dateStr) {
    if (!dateStr) return false;
    var now = new Date(); now.setHours(0,0,0,0);
    return new Date(dateStr + "T00:00:00") < now;
  }

  /* ── Label fixes ───────────────────────────────────────────────────────── */

  function normalizeOriginalLabels() {
    var goal = getGoalType();
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      if (node.parentElement && node.parentElement.closest("[data-lt-enhancement]")) continue;
      var t = node.nodeValue;
      if (t.indexOf("years left") !== -1) node.nodeValue = t.replace(/years left/g, "years to " + goal.word.toLowerCase());
      if (t.indexOf("Retire date") !== -1) node.nodeValue = t.replace(/Retire date/g, goal.dateLabel);
      if (t.indexOf("Remaining Retirement Time") !== -1) node.nodeValue = t.replace(/Remaining Retirement Time/g, "Remaining " + goal.word + " Time");
      if (t.indexOf("date of birth and retire date") !== -1) node.nodeValue = t.replace(/date of birth and retire date/g, "date of birth and " + goal.dateLabel.toLowerCase());
      if (t === "\u270F\uFE0F" || t === "\u270F\uFE0F ") {
        var oldBtn = node.parentElement;
        if (!oldBtn || oldBtn.getAttribute("data-lt-edit-replaced")) continue;
        /* The emoji picker can be filtered down to a single pencil.  In that
           state its row contains only one button, so a button-count check
           cannot distinguish it from the activity edit control.  Only the
           real control (which the app marks title="Edit") may be relabeled;
           never rewrite a selectable emoji in a picker/popover. */
        var realEditButton = oldBtn.closest("button");
        var inEmojiPicker = oldBtn.closest(
          '[role="dialog"],[role="listbox"],[role="menu"],' +
          '[data-radix-popper-content-wrapper],[data-emoji-picker],' +
          'input[placeholder*="earch"]'
        );
        if (!realEditButton || realEditButton.getAttribute("title") !== "Edit" || inEmojiPicker) continue;
        /* Guard against the emoji picker: it also contains a pencil emoji
           as one of many selectable options in a dense grid/row of emoji
           buttons. A real "edit activity" pencil button sits alone next
           to a name label — not packed among 6+ other emoji buttons in
           the same row, like a palette is. */
        var pencilRow = oldBtn.closest("button") ? oldBtn.closest("button").parentElement : oldBtn.parentElement;
        var rowButtonCount = pencilRow ? pencilRow.querySelectorAll("button").length : 0;
        if (rowButtonCount > 5) continue;
        /* Skip rows rendered in a compact/mini context (e.g. the timer's
           activity-name suggestion strip) where the name label isn't
           actually visible — showing a bare "Edit" button with no
           attached label there looks broken, so just hide it instead. */
        var nameLbl = oldBtn.previousElementSibling;
        var rowEl = oldBtn.closest('[role="button"]') || oldBtn.parentElement;
        /* If the button (or its row) isn't actually laid out yet — e.g. the
           page just mounted or a tab panel is mid-transition — offsetWidth/
           getBoundingClientRect() can read 0 even for a perfectly normal
           row. Don't make a permanent decision on unreliable data; just
           skip this pass and let the next 1.5s run re-check once layout
           has settled. */
        if (oldBtn.offsetParent === null) continue;
        var nameLblMissing = !nameLbl || !nameLbl.textContent.trim();
        var nameLblHidden  = nameLbl && nameLbl.offsetParent !== null && nameLbl.offsetWidth === 0;
        var rowWidth = rowEl ? rowEl.getBoundingClientRect().width : 0;
        var isCompact = nameLblMissing || nameLblHidden || (rowWidth > 0 && rowWidth < 120);
        if (isCompact) {
          oldBtn.style.cssText = "display:none!important";
          oldBtn.setAttribute("data-lt-edit-replaced", "1");
          continue;
        }
        var newBtn = document.createElement("button");
        newBtn.type = "button";
        newBtn.textContent = "Edit";
        newBtn.className = "lt-edit-button";
        newBtn.setAttribute("aria-label", "Edit");
        newBtn.setAttribute("data-lt-edit-replaced", "1");
        /* Forward clicks to the original hidden button so React handlers fire */
        newBtn.addEventListener("click", function (orig) {
          return function (e) { e.stopPropagation(); orig.click(); };
        }(oldBtn));
        oldBtn.style.cssText = "display:none!important";
        oldBtn.setAttribute("data-lt-edit-replaced", "1");
        oldBtn.parentNode.insertBefore(newBtn, oldBtn);
        continue;
      }
      if (/\b\d+[sm]\b/.test(t)) {
        node.nodeValue = t.replace(/\b(\d+)s\b/g, "$1sec").replace(/\b(\d+)m\b/g, "$1min");
      }
      if (t === "0h") node.nodeValue = "0 hours";
    }
    document.querySelectorAll('button[title="Edit"]:not([data-lt-edit-replaced])').forEach(function (b) {
      if (b.offsetParent === null) return;
      var nameLbl = b.previousElementSibling;
      var rowEl = b.closest('[role="button"]') || b.parentElement;
      var nameLblMissing = !nameLbl || !nameLbl.textContent.trim();
      var nameLblHidden  = nameLbl && nameLbl.offsetParent !== null && nameLbl.offsetWidth === 0;
      var rowWidth = rowEl ? rowEl.getBoundingClientRect().width : 0;
      var isCompact = nameLblMissing || nameLblHidden || (rowWidth > 0 && rowWidth < 120);
      if (isCompact) {
        b.style.cssText = "display:none!important";
        b.setAttribute("data-lt-edit-replaced", "1");
        return;
      }
      var newBtn = document.createElement("button");
      newBtn.type = "button";
      newBtn.textContent = "Edit";
      newBtn.className = "lt-edit-button";
      newBtn.setAttribute("aria-label", "Edit");
      newBtn.setAttribute("data-lt-edit-replaced", "1");
      newBtn.addEventListener("click", function (orig) {
        return function (e) { e.stopPropagation(); orig.click(); };
      }(b));
      b.style.cssText = "display:none!important";
      b.setAttribute("data-lt-edit-replaced", "1");
      b.parentNode.insertBefore(newBtn, b);
    });
  }

  var _timeValueTimer = null;

  function updateSavedTimeValueCard() {
    var label = Array.prototype.slice.call(document.querySelectorAll("p,div,span"))
      .find(function (el) {
        return el.children.length === 0 && el.textContent.trim() === "Today's time value left";
      });
    if (!label) return;
    var card = label.parentElement;
    while (card && !card.classList.contains("bg-primary") && card !== document.body) {
      card = card.parentElement;
    }
    if (!card || card === document.body) card = label.parentElement;
    if (!card || card.getAttribute("data-lt-tv-enhanced") === "1") return;

    var stored = readJson("lt_time_value_v1", null);
    if (!stored || !Number(stored.perMinute)) return;
    var pm = Number(stored.perMinute);

    card.setAttribute("data-lt-tv-enhanced", "1");

    /* Find React's big rupee amount element (text-2xl) and mark it */
    function findBigEl() {
      var ps = card.querySelectorAll("p");
      for (var j = 0; j < ps.length; j++) {
        if (ps[j].className && String(ps[j].className).indexOf("text-2xl") !== -1) {
          ps[j].setAttribute("data-lt-tv-big", "1");
          return ps[j];
        }
      }
      return null;
    }
    findBigEl();

    /* Append small status row below React's progress bar */
    var labelRow = document.createElement("div");
    labelRow.id = "lt-tv-label-row";
    labelRow.style.cssText = "display:flex;justify-content:space-between;margin-top:4px;";
    labelRow.innerHTML =
      '<span id="lt-tv-elapsed" style="font-size:11px;color:rgba(255,255,255,.65);">--</span>' +
      '<span id="lt-tv-spent" style="font-size:11px;color:rgba(255,255,255,.65);text-align:right;"></span>';
    card.appendChild(labelRow);

    if (_timeValueTimer) clearInterval(_timeValueTimer);
    function tickTimeValue() {
      var elapsedEl = document.getElementById("lt-tv-elapsed");
      var spentEl   = document.getElementById("lt-tv-spent");
      if (!elapsedEl) { clearInterval(_timeValueTimer); _timeValueTimer = null; return; }

      var now      = new Date();
      var secOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      var remSec   = 86400 - secOfDay;
      var dailyHours = Number(stored.hours) || 8;
      var dailyBudget = pm * 60 * dailyHours;
      var fracLeft = remSec / 86400;
      var baseValue = dailyBudget * fracLeft;
      var pct = (secOfDay / 86400) * 100;

      /* Sum today's budget spend (resets naturally at midnight via today()) */
      var todayStr = today();
      var budgetData = readJson(BUDGET_KEY, []);
      var todaySpent = 0;
      if (Array.isArray(budgetData)) {
        for (var i = 0; i < budgetData.length; i++) {
          var item = budgetData[i];
          if (String(item.purchaseDate || "").slice(0, 10) === todayStr) {
            todaySpent += Number(item.amount) || 0;
          }
        }
      }
      var adjusted = Math.max(0, baseValue - todaySpent);

      /* Override the React big number with the adjusted value */
      var bigElem = card.querySelector("p[data-lt-tv-big]");
      if (!bigElem) bigElem = findBigEl();
      if (bigElem) {
        var newText = getCurrency().symbol + adjusted.toFixed(2);
        if (bigElem.textContent !== newText) bigElem.textContent = newText;
      }

      elapsedEl.textContent = pct.toFixed(1) + "% elapsed";
      if (spentEl) {
        spentEl.textContent = todaySpent > 0 ? ("\u2212" + money(todaySpent) + " spent") : "";
      }
    }
    tickTimeValue();
    _timeValueTimer = setInterval(tickTimeValue, 1000);
  }

  /* ── Styles ────────────────────────────────────────────────────────────── */

  function addStyle() {
    if (injectedStyle) return;
    injectedStyle = true;
    var s = document.createElement("style");
    s.textContent = [
      /* Our injected cards (life-progress, glance, Eat the Frog, etc.) sit
         as siblings BEFORE the native app's own root wrapper, which has a
         min-height of one full screen (100dvh) so its own nav bar stays
         pinned to the bottom of the screen when there's little content.
         Once our extra cards push total page height past one screen, that
         min-height became pure dead space below the real content and above
         the nav bar (a huge blank gap that looked like broken/endless
         scroll). Removing the min-height lets that wrapper size itself to
         its actual content — nav bar just follows directly after it. */
      ".lt-authed .max-w-\\[430px\\].min-h-\\[100dvh\\]{min-height:auto!important}",
      /* #root itself also carries a hard `min-h-screen` (100vh) from the
         base stylesheet (main.css), completely separate from the wrapper
         override right above. On every OTHER tab that's harmless — #root
         is the only thing in <body> so a full-screen minimum just fills
         the viewport. But our injected cards (life-progress, glance,
         Eat the Frog) are siblings placed BEFORE #root in <body>, not
         inside it, so their height stacks on top of #root's own forced
         100vh instead of sharing it. That guarantees roughly one extra
         full screen of blank scroll under the Timer tab no matter how
         short the real content is. Let #root size to its actual content
         too, same as the wrapper above. */
      ".lt-authed #root{min-height:auto!important}",
      /* ── New bottom-nav highlight system (replaces the old grey/bg-primary/5
         tap state, which stuck visibly on mobile after tapping a tab because
         it relied on a real CSS :hover rule that touch browsers keep applied
         until the next tap elsewhere). Active tab now gets a colored icon +
         label plus a small pill/dot under it — no background box, so there's
         nothing to "stick" after a tap. Tap highlight is also killed outright
         on every nav item so there is never a grey flash again. ── */
      "nav.flex.items-stretch, nav.flex.items-stretch *{-webkit-tap-highlight-color:transparent!important}",
      "nav.flex.items-stretch a, nav.flex.items-stretch button{background:transparent!important;position:relative}",
      "nav.flex.items-stretch a:active, nav.flex.items-stretch button:active{background:transparent!important}",
      ".lt-navtab-active{position:relative}",
      ".lt-navtab-active::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:16px;height:3px;border-radius:3px;background:hsl(var(--primary))}",
      "#lt-activity-navtab.lt-navtab-active-custom{color:hsl(var(--primary))}",
      "div.fixed.bottom-0.left-0.right-0.z-50{background:#fff!important;isolation:isolate;pointer-events:auto!important}",
      /* Dims the real Timer tab ONLY while the pseudo Activity tab is the
         active one — scoped strictly to the data attribute so it can never
         linger or fight with React's own route-based styling of that link. */
      "nav.flex.items-stretch[data-lt-activity-mode=\"1\"] a[href=\"/\"]{color:hsl(var(--muted-foreground))!important}",
      "nav.flex.items-stretch[data-lt-activity-mode=\"1\"] a[href=\"/\"].lt-navtab-active::after{display:none!important}",
      /* 6 Jars salary edit button + empty state + form */
      ".lt-jars-sum-empty{color:hsl(var(--muted-foreground))!important}",
      ".lt-jars-edit-salary-btn{border:none;cursor:pointer;font-family:inherit;font-weight:800;border-radius:12px;transition:all .15s ease}",
      ".lt-jars-edit-salary-btn--big{width:100%;padding:16px;font-size:15px;background:hsl(var(--primary));color:#fff}",
      ".lt-jars-edit-salary-btn--small{padding:7px 12px;font-size:12px;background:hsl(var(--secondary));color:hsl(var(--foreground));border:1px solid hsl(var(--border))}",
      ".lt-form-label{display:block;font-size:12px;font-weight:700;color:hsl(var(--muted-foreground));margin-bottom:6px}",
      ".lt-form-input{width:100%;box-sizing:border-box;padding:12px 14px;font-size:16px;font-weight:700;font-family:inherit;border:1px solid hsl(var(--border));border-radius:10px;background:hsl(var(--secondary));color:hsl(var(--foreground));outline:none}",
      ".lt-form-input:focus{border-color:hsl(var(--primary))}",
      /* edit button */
      ".lt-edit-button{display:inline-flex;align-items:center;justify-content:center;-webkit-appearance:none;appearance:none;border:1px solid hsl(var(--border));outline:none;box-shadow:none;padding:0 16px;height:36px;border-radius:6px;font-size:13px;font-weight:700;color:hsl(var(--primary));background:hsl(var(--background));cursor:pointer;font-family:inherit;line-height:1}",
      /* saved time-value card */
      "[data-lt-enhancement='saved-value']{background:hsl(var(--primary))!important;color:white!important;padding:16px 20px!important}",
      ".lt-value-label{font-size:10px!important;font-weight:700!important;letter-spacing:.12em!important;color:rgba(255,255,255,.55)!important;margin:0 0 4px!important}",
      ".lt-value-title{font-size:16px!important;font-weight:700!important;margin:0 0 14px!important;color:white!important}",
      ".lt-value-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px!important}",
      ".lt-value-grid strong{display:block;font-size:20px!important;color:white!important}",
      ".lt-value-grid span{display:block;font-size:11px!important;color:rgba(255,255,255,.6)!important;margin-top:3px!important}",
      ".lt-value-day-bar-wrap{margin-top:14px!important}",
      ".lt-value-day-bar-track{width:100%;height:6px;background:rgba(255,255,255,.2);border-radius:3px;overflow:hidden}",
      ".lt-value-day-bar-fill{height:100%;background:#fff;border-radius:3px;transition:width .8s linear}",
      ".lt-value-day-bar-labels{display:flex;justify-content:space-between;margin-top:5px}",
      ".lt-value-day-bar-labels span{font-size:11px!important;color:rgba(255,255,255,.65)!important}",
      /* Life Hub grid visual override -- keeps the underlying inline
         repeat(3..) style untouched so the injector can keep finding the
         grid on every pass; this class just overrides how it PAINTS. */
      ".lt-hub-grid-2col{grid-template-columns:repeat(2,1fr)!important;gap:12px!important}",
      /* Life Hub search + category filter */
      ".lt-hub-search-wrap{margin:0 0 14px}",
      ".lt-hub-search-box{position:relative;display:flex;align-items:center}",
      ".lt-hub-search-icon{position:absolute;left:14px;font-size:14px;opacity:.55;pointer-events:none}",
      ".lt-hub-search-input{width:100%;box-sizing:border-box;border:1px solid hsl(var(--border));background:hsl(var(--card));padding:11px 40px 11px 38px;border-radius:999px;font:inherit;font-size:14px;color:hsl(var(--foreground));outline:none}",
      ".lt-hub-search-input:focus{border-color:hsl(var(--primary))}",
      ".lt-hub-search-clear{position:absolute;right:6px;width:26px;height:26px;border-radius:50%;border:none;background:hsl(var(--secondary));color:hsl(var(--muted-foreground));font-size:11px;cursor:pointer;display:none;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}",
      ".lt-hub-filter-row{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:2px;-webkit-overflow-scrolling:touch}",
      ".lt-hub-filter-row::-webkit-scrollbar{display:none}",
      ".lt-hub-filter-chip{flex-shrink:0;border:1px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--foreground));font-size:12px;font-weight:700;padding:7px 14px;border-radius:999px;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".lt-hub-filter-chip.lt-hub-filter-active{background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff}",
      ".lt-hub-empty{text-align:center;padding:32px 16px;color:hsl(var(--muted-foreground));font-size:13px;grid-column:1/-1}",
      /* Activity's page (full design: title + date, 4 stat cards, section label) */
      ".lt-act-topline{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:16px 16px 4px;flex-wrap:wrap}",
      ".lt-act-title{font-size:26px;font-weight:900;margin:0;color:hsl(var(--foreground))}",
      ".lt-act-date{font-size:12px;color:hsl(var(--muted-foreground));font-weight:600;white-space:nowrap}",
      ".lt-act-stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:12px 16px 4px}",
      ".lt-act-stat-card{background:hsl(var(--card));border:1px solid rgba(0,0,0,0.06);border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)}",
      ".lt-act-stat-icon{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;font-size:14px;margin-bottom:8px}",
      ".lt-act-stat-label{font-size:12px;color:hsl(var(--muted-foreground));margin:0 0 2px}",
      ".lt-act-stat-value{font-size:20px;font-weight:800;margin:0;color:hsl(var(--foreground))}",
      ".lt-act-stat-suffix{font-size:12px;font-weight:600;color:hsl(var(--muted-foreground));margin-left:2px}",
      ".lt-add-time-value-label{font-size:11px;font-weight:700;color:hsl(var(--muted-foreground));margin-top:2px;line-height:1.3}",
      ".lt-act-section-label{font-size:16px;font-weight:800;margin:14px 16px 8px;color:hsl(var(--foreground))}",
      /* injected tiles */
      ".lt-injected-tile{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:6px!important;cursor:pointer!important;border:none!important;background:transparent!important;padding:0!important;margin:0!important;text-align:center!important;font-family:inherit!important;-webkit-tap-highlight-color:transparent}",
      ".lt-injected-tile:active .lt-tile-icon-wrap{opacity:.75}",
      ".lt-tile-icon-wrap{width:56px!important;height:56px!important;border-radius:14px!important;background:hsl(var(--secondary))!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:24px!important;color:hsl(var(--primary))!important;margin-bottom:2px!important}",
      ".lt-tile-label{font-size:11px!important;font-weight:600!important;color:hsl(var(--foreground))!important;line-height:1.3!important;max-width:68px!important}",
      /* overlay root */
      "#lt-overlay-root{position:fixed;inset:0;z-index:2147483647;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;touch-action:pan-y;overscroll-behavior:contain;background:hsl(var(--background));color:hsl(var(--foreground));box-sizing:border-box}",
      ".lt-tool-shell{max-width:700px;margin:0 auto;padding:20px 16px 100px;box-sizing:border-box;width:100%}",
      ".lt-tool-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px}",
      ".lt-tool-kicker{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:hsl(var(--muted-foreground));font-weight:800;margin:0 0 4px}",
      ".lt-tool-heading{font-size:26px;font-weight:900;margin:0;color:hsl(var(--foreground))}",
      ".lt-tool-description{font-size:13px;color:hsl(var(--muted-foreground));margin:6px 0 0}",
      ".lt-tool-close,.lt-tool-primary,.lt-tool-secondary,.lt-tool-danger{border:1px solid hsl(var(--border));padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;border-radius:9px;background:hsl(var(--background));color:hsl(var(--foreground));white-space:nowrap}",
      ".lt-tool-primary{background:hsl(var(--primary));border-color:hsl(var(--primary));color:white}",
      ".lt-tool-danger{color:hsl(var(--destructive));border-color:hsl(var(--destructive));background:transparent}",
      ".lt-tool-card{border:1px solid hsl(var(--border));background:hsl(var(--card));padding:16px;border-radius:14px;margin-bottom:14px}",
      ".lt-card-title{font-weight:800;font-size:16px;margin:0 0 10px;color:hsl(var(--foreground))}",
      ".lt-card-subtitle{font-size:12px;color:hsl(var(--muted-foreground));margin:-6px 0 14px}",
      ".lt-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}",
      ".lt-summary-card{border:1px solid hsl(var(--border));background:hsl(var(--secondary));padding:13px;border-radius:11px}",
      ".lt-summary-card small{display:block;text-transform:uppercase;letter-spacing:.1em;font-size:9px;color:hsl(var(--muted-foreground));font-weight:800}",
      ".lt-summary-card strong{display:block;font-size:20px;margin-top:5px;color:hsl(var(--foreground))}",
      ".lt-budget-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}",
      ".lt-budget-actions input,.lt-budget-actions select{flex:1;min-width:140px;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:9px 10px;border-radius:8px;color:hsl(var(--foreground));font:inherit;font-size:13px;box-sizing:border-box}",
      ".lt-table-wrap{overflow-x:auto;border:1px solid hsl(var(--border));border-radius:12px;background:hsl(var(--card))}",
      ".lt-budget-table{width:100%;border-collapse:collapse;min-width:700px;font-size:12px}",
      ".lt-budget-table th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;text-align:left;color:hsl(var(--muted-foreground));background:hsl(var(--secondary));padding:10px 9px;white-space:nowrap}",
      ".lt-budget-table td{border-top:1px solid hsl(var(--border));padding:10px 9px;vertical-align:middle;color:hsl(var(--foreground))}",
      ".lt-budget-table td:first-child{font-weight:700}",
      ".lt-cell-clamp{display:block;width:160px;overflow-x:auto;overflow-y:hidden;white-space:nowrap;line-height:1.4}",
      ".lt-tag{display:inline-block;padding:3px 7px;border-radius:5px;background:#d7f0df;color:#176538;font-size:10px;font-weight:700;white-space:nowrap}",
      ".lt-tag.blue{background:#d7e7f6;color:#14517d}",
      ".lt-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".lt-field{display:flex;flex-direction:column;gap:5px}",
      ".lt-field.full{grid-column:1/-1}",
      ".lt-field label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:hsl(var(--muted-foreground))}",
      ".lt-field input,.lt-field select,.lt-field textarea{width:100%;box-sizing:border-box;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:10px;border-radius:8px;color:hsl(var(--foreground));font:inherit;font-size:13px}",
      ".lt-field textarea{min-height:70px;resize:vertical}",
      ".lt-check{display:flex;align-items:center;gap:7px;font-size:13px;color:hsl(var(--foreground));padding:4px 0;grid-column:1/-1}",
      ".lt-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}",
      ".lt-calc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".lt-calc-result{background:hsl(var(--primary));color:white;border-radius:12px;padding:18px;margin-bottom:14px}",
      ".lt-calc-result small{display:block;color:rgba(255,255,255,.65);font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:800}",
      ".lt-calc-result strong{display:block;font-size:30px;margin-top:6px}",
      ".lt-calc-result p{font-size:12px;color:rgba(255,255,255,.75);margin:8px 0 0}",
      ".lt-history-row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid hsl(var(--border));padding:10px 0;font-size:13px}",
      ".lt-history-row:first-of-type{border-top:none;padding-top:0}",
      ".lt-empty{text-align:center;padding:28px;color:hsl(var(--muted-foreground));font-size:13px}",
      "@media(max-width:500px){.lt-summary-grid{grid-template-columns:1fr 1fr}.lt-form-grid,.lt-calc-grid{grid-template-columns:1fr}.lt-field.full{grid-column:auto}}",

      /* ── KnowledgeGram ──────────────────────────────────────────────────── */
      /* Overlay in gram mode: no inner scrollbar — feed handles its own */
      "#lt-overlay-root.lt-gram-mode{overflow:hidden!important;background:#000!important;padding:0!important}",
      /* Top bar */
      ".lt-gram-topbar{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:env(safe-area-inset-top,14px) 16px 12px;background:linear-gradient(to bottom,rgba(0,0,0,.65) 0%,transparent 100%);pointer-events:none}",
      ".lt-gram-topbar *{pointer-events:auto}",
      ".lt-gram-back-btn{background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}",
      ".lt-gram-topbar-title{color:#fff;font-size:17px;font-weight:700;letter-spacing:.01em}",
      /* Feed scroll-snap container */
      ".lt-gram-feed{height:100%;overflow-y:scroll;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}",
      ".lt-gram-feed::-webkit-scrollbar{display:none}",
      /* Each slide */
      ".lt-gram-slide{height:100vh;scroll-snap-align:start;position:relative;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}",
      ".lt-gram-img{width:100%;height:100%;object-fit:contain;display:block;-webkit-user-drag:none;user-select:none}",
      /* Right action bar */
      ".lt-gram-actions{position:absolute;right:12px;bottom:100px;display:flex;flex-direction:column;align-items:center;gap:22px;z-index:5}",
      ".lt-gram-action{display:flex;flex-direction:column;align-items:center;gap:4px}",
      ".lt-gram-action-btn{background:rgba(0,0,0,0.5);border:none;cursor:pointer;padding:10px;border-radius:50px;display:flex;flex-direction:column;align-items:center;gap:4px;-webkit-tap-highlight-color:transparent;min-width:52px}",
      ".lt-gram-action-btn:active{opacity:.7}",
      ".lt-gram-action-count{color:#fff;font-size:12px;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,1)}",
      /* Share / Save buttons reuse the same round-button look above.
         The saving state just dims + disables the button briefly while
         the watermarked image is being generated on <canvas>. */
      ".lt-gram-action-btn.lt-gram-saving{opacity:.55;pointer-events:none}",
      /* Block the browser's own long-press "Save image"/"Copy image" menu
         (mainly iOS Safari) on the raw <img> so the only way to actually
         get the picture out of the app is through the Save/Share buttons
         below, which always burn the minutics.com watermark into the
         exported pixels first via canvas. Without this a long-press could
         save the original, un-watermarked file straight from the DOM. */
      ".lt-gram-img{-webkit-touch-callout:none}",
      /* Comment panel */
      ".lt-gram-cp{position:absolute;bottom:0;left:0;right:0;height:68%;background:#1c1c1e;border-radius:20px 20px 0 0;transform:translateY(100%);transition:transform .35s cubic-bezier(.32,.72,0,1);z-index:20;display:flex;flex-direction:column;overflow:hidden}",
      ".lt-gram-cp-handle{width:36px;height:4px;background:#48484a;border-radius:2px;margin:10px auto 0;flex-shrink:0}",
      ".lt-gram-cp-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #2c2c2e;flex-shrink:0}",
      ".lt-gram-cp-title{color:#fff;font-size:15px;font-weight:700}",
      ".lt-gram-cp-close{background:none;border:none;color:#8e8e93;font-size:18px;cursor:pointer;padding:4px 8px;-webkit-tap-highlight-color:transparent}",
      ".lt-gram-cp-list{flex:1;overflow-y:auto;padding:8px 0;-webkit-overflow-scrolling:touch}",
      ".lt-gram-comment{display:flex;align-items:flex-start;gap:10px;padding:10px 16px;border-bottom:1px solid #2c2c2e}",
      ".lt-gram-comment-avatar{width:32px;height:32px;border-radius:50%;background:#48484a;display:flex;align-items:center;justify-content:center;color:#ebebf5;font-size:14px;font-weight:700;flex-shrink:0}",
      ".lt-gram-comment-body{flex:1;min-width:0}",
      ".lt-gram-comment-text{color:#fff;font-size:14px;margin:0 0 3px;line-height:1.4;word-break:break-word}",
      ".lt-gram-comment-date{color:#636366;font-size:11px}",
      ".lt-gram-comment-del{background:none;border:none;color:#636366;font-size:14px;cursor:pointer;padding:4px;flex-shrink:0;align-self:center;-webkit-tap-highlight-color:transparent}",
      ".lt-gram-cp-empty{text-align:center;padding:32px 16px;color:#636366;font-size:13px}",
      ".lt-gram-cp-input-row{display:flex;gap:8px;padding:10px 12px;padding-bottom:max(10px, env(safe-area-inset-bottom,10px));border-top:1px solid #2c2c2e;background:#1c1c1e;flex-shrink:0}",
      ".lt-gram-cp-input{flex:1;background:#2c2c2e;border:none;border-radius:20px;padding:10px 14px;color:#fff;font-size:14px;outline:none;font-family:inherit}",
      ".lt-gram-cp-input::placeholder{color:#636366}",
      ".lt-gram-cp-submit{background:#0a84ff;border:none;border-radius:20px;color:#fff;font-size:13px;font-weight:700;padding:10px 16px;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}",
      ".lt-gram-cp-submit:active{opacity:.8}",

      /* ── Tasks ──────────────────────────────────────────────────────────── */
      ".lt-tasks-section{margin-bottom:8px}",
      ".lt-tasks-section-label{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;padding:16px 16px 6px;color:hsl(var(--muted-foreground))}",
      ".lt-task-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid hsl(var(--border));border-left:3px solid transparent;-webkit-tap-highlight-color:transparent;transition:background .15s}",
      ".lt-task-item:last-child{border-bottom:none}",
      ".lt-task-item.lt-task-overdue{background:rgba(255,59,48,.07);border-left-color:#ff3b30}",
      ".lt-task-check{width:24px;height:24px;border-radius:50%;border:2px solid hsl(var(--border));background:transparent;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:all .15s}",
      ".lt-task-check.lt-task-checked{background:#34c759;border-color:#34c759}",
      ".lt-task-check.lt-task-check-overdue{border-color:#ff3b30}",
      ".lt-task-body{flex:1;min-width:0}",
      ".lt-task-title{display:block;font-size:15px;color:hsl(var(--foreground));line-height:1.35}",
      ".lt-task-title.lt-task-done{text-decoration:line-through;color:hsl(var(--muted-foreground))}",
      ".lt-task-date{display:block;font-size:11px;margin-top:2px;color:#8e8e93}",
      ".lt-task-date.lt-overdue{color:#ff3b30;font-weight:800}",
      ".lt-task-notes{display:block;font-size:11px;color:hsl(var(--muted-foreground));margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".lt-task-star{background:none;border:none;color:hsl(var(--muted-foreground));cursor:pointer;padding:6px;flex-shrink:0;display:flex;align-items:center;-webkit-tap-highlight-color:transparent}",
      ".lt-task-star.lt-task-starred{color:#f5a623}",
      ".lt-task-star:active{transform:scale(.9)}",
      ".lt-task-del{background:none;border:none;color:hsl(var(--muted-foreground));cursor:pointer;padding:6px;flex-shrink:0;display:flex;align-items:center;-webkit-tap-highlight-color:transparent}",
      ".lt-task-del:active{color:hsl(var(--destructive))}",
      ".lt-tasks-section-card{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:14px;margin-bottom:12px;overflow:hidden}",
      ".lt-tasks-completed-toggle{width:100%;text-align:left;background:none;border:none;cursor:pointer;padding:13px 16px;display:flex;align-items:center;justify-content:space-between;color:hsl(var(--muted-foreground));font-size:13px;font-weight:600;-webkit-tap-highlight-color:transparent}",
      ".lt-tasks-empty-state{text-align:center;padding:48px 24px;color:hsl(var(--muted-foreground))}",
      ".lt-tasks-empty-icon{font-size:48px;margin-bottom:12px;opacity:.35}",
      ".lt-tasks-empty-title{font-size:17px;font-weight:700;margin:0 0 6px;color:hsl(var(--foreground))}",
      ".lt-tasks-empty-sub{font-size:13px;margin:0}",
      /* FAB */
      ".lt-tasks-fab{position:fixed;bottom:calc(28px + env(safe-area-inset-bottom, 0px));right:20px;width:56px;height:56px;border-radius:50%;background:hsl(var(--primary));color:white;font-size:30px;font-weight:300;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;z-index:2147483000;-webkit-tap-highlight-color:transparent;line-height:1}",
      ".lt-tasks-fab:active{opacity:.85;transform:scale(.96)}",
      /* Add-task bottom sheet */
      ".lt-tasks-sheet{position:fixed;bottom:0;left:0;right:0;background:hsl(var(--card));border-radius:22px 22px 0 0;padding:14px 18px calc(24px + env(safe-area-inset-bottom, 0px));box-shadow:0 -4px 28px rgba(0,0,0,.18);transform:translateY(110%);transition:transform .35s cubic-bezier(.32,.72,0,1);z-index:2147483100;box-sizing:border-box;max-width:480px;margin:0 auto}",
      ".lt-tasks-sheet-handle{width:36px;height:4px;background:hsl(var(--border));border-radius:2px;margin:0 auto 14px}",
      ".lt-tasks-sheet-title{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:hsl(var(--muted-foreground));margin:0 0 12px}",
      ".lt-tasks-sheet-main{font-size:16px;width:100%;border:1.5px solid hsl(var(--border));background:hsl(var(--muted));color:hsl(var(--foreground));font-family:inherit;font-weight:600;padding:13px 14px;border-radius:14px;outline:none;caret-color:hsl(var(--primary));margin-bottom:14px;box-sizing:border-box;transition:border-color .15s}",
      ".lt-tasks-sheet-main:focus{border-color:hsl(var(--primary))}",
      ".lt-tasks-sheet-main::placeholder{color:hsl(var(--muted-foreground));font-weight:500}",
      /* Groups a set of sheet-rows into one soft card (e.g. the whole
         Deadline block: an optional day + an optional time together). */
      ".lt-sheet-group{background:hsl(var(--muted));border:1px solid hsl(var(--border));border-radius:14px;padding:2px 12px;margin-bottom:14px}",
      ".lt-sheet-group-title{display:flex;align-items:center;justify-content:space-between;padding:10px 0 2px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:hsl(var(--muted-foreground))}",
      ".lt-sheet-group-clear{background:none;border:none;color:#0369A1;font-size:11px;font-weight:800;cursor:pointer;padding:2px 0;font-family:inherit;text-transform:none;letter-spacing:normal;-webkit-tap-highlight-color:transparent}",
      ".lt-sheet-group-hint{font-size:11px;color:hsl(var(--muted-foreground));margin:0 0 10px;font-weight:600}",
      ".lt-tasks-sheet-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid hsl(var(--border))}",
      ".lt-sheet-group .lt-tasks-sheet-row{border-top:1px solid hsl(var(--border));padding:11px 0}",
      ".lt-sheet-group .lt-tasks-sheet-row:first-child{border-top:none}",
      ".lt-tasks-sheet-row-label{font-size:12px;font-weight:700;color:hsl(var(--muted-foreground));flex-shrink:0;width:44px}",
      ".lt-tasks-sheet-date{flex:1;border:1.5px solid hsl(var(--border));background:hsl(var(--card));color:hsl(var(--foreground));font:inherit;font-size:14px;font-weight:700;outline:none;padding:9px 12px;border-radius:12px;box-sizing:border-box}",
      ".lt-tasks-sheet-notes{font-size:14px;width:100%;border:1.5px solid hsl(var(--border));background:hsl(var(--muted));color:hsl(var(--foreground));font-family:inherit;font-weight:500;padding:12px 14px;border-radius:14px;outline:none;caret-color:hsl(var(--primary));box-sizing:border-box}",
      ".lt-tasks-sheet-notes::placeholder{color:hsl(var(--muted-foreground))}",
      ".lt-tasks-sheet-submit{margin-top:14px;width:100%;background:hsl(var(--primary));color:white;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;box-shadow:0 6px 16px rgba(0,0,0,.15)}",
      ".lt-tasks-sheet-submit:active{opacity:.85;transform:scale(.99)}",
      ".lt-tasks-sheet-dismiss{position:absolute;top:0;left:0;right:0;bottom:0;z-index:29;background:rgba(0,0,0,.25)}",

      /* ── 6 Jars System ───────────────────────────────────────────────── */
      ".lt-jars-summary{display:flex;gap:12px;margin-bottom:16px}",
      ".lt-jars-sum-item{flex:1;background:hsl(var(--secondary));border-radius:12px;padding:13px}",
      ".lt-jars-sum-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:hsl(var(--muted-foreground));margin:0 0 4px}",
      ".lt-jars-sum-val{display:block;font-size:18px;font-weight:900;color:hsl(var(--foreground));margin:0}",
      ".lt-jars-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}",
      ".lt-jar-card{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:16px;padding:14px 10px 12px;display:flex;flex-direction:column;align-items:center;gap:5px}",
      ".lt-jar-body-wrap{position:relative;width:64px;height:96px;background-image:url('assets/icons/jar-savings.png');background-size:contain;background-repeat:no-repeat;background-position:center}",
      /* Track marks the jar's actual glass interior — measured directly from
         the jar photo: lid/shoulder ends ~37% down, straight glass walls run
         to ~78% down before the bottom curves in, glass walls sit at ~17%/16%
         from the left/right edges. Using guessed numbers here previously let
         the liquid box spill out below the visible jar. */
      ".lt-jar-track{position:absolute;left:17%;right:16%;top:37%;bottom:22%;overflow:hidden;border-radius:0 0 8px 8px}",
      ".lt-jar-liquid{position:absolute;bottom:0;left:0;right:0;height:0%;opacity:.78;transition:height 1.6s cubic-bezier(.4,0,.2,1)}",
      ".lt-jar-shine{position:absolute;top:6px;left:6px;width:5px;height:14px;background:rgba(255,255,255,.4);border-radius:3px;transform:rotate(-15deg);pointer-events:none}",
      ".lt-jar-bubble{position:absolute;bottom:8px;right:6px;width:4px;height:4px;background:rgba(255,255,255,.5);border-radius:50%;animation:lt-jar-bob 2.2s ease-in-out infinite}",
      "@keyframes lt-jar-bob{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(-7px);opacity:.1}}",
      ".lt-jar-pct-pill{display:inline-block;color:#fff;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:800;margin-top:2px}",
      ".lt-jar-name{font-size:11px;font-weight:800;color:hsl(var(--foreground));text-align:center;margin:0;line-height:1.2}",
      ".lt-jar-saved{font-size:16px;font-weight:900;color:hsl(var(--foreground));margin:0}",
      ".lt-jar-monthly{font-size:10px;color:hsl(var(--muted-foreground));margin:0;font-weight:600}",
      ".lt-jars-settings-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:hsl(var(--secondary));border:1px solid hsl(var(--border));border-radius:12px;padding:13px 16px;font-size:14px;font-weight:700;color:hsl(var(--foreground));cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;margin-bottom:2px}",
      ".lt-jars-settings-btn:active{opacity:.8}",
      ".lt-jar-set-row{display:flex;align-items:center;gap:10px;padding:12px 2px;border-bottom:1px solid hsl(var(--border))}",
      ".lt-jar-set-row:last-child{border-bottom:none}",
      ".lt-jar-swatch{width:13px;height:13px;border-radius:50%;flex-shrink:0}",
      ".lt-jar-set-name{flex:1;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));padding:8px 10px;border-radius:8px;font:inherit;font-size:13px}",
      ".lt-jar-set-pct{border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));padding:8px;border-radius:8px;font:inherit;font-size:13px;font-weight:700;width:56px;text-align:center}",

      /* ── Routine Trackers ────────────────────────────────────────────── */
      ".lt-routine-resetnote{font-size:11px;color:hsl(var(--muted-foreground));margin:-4px 0 14px;font-weight:600}",
      ".lt-routine-list{display:flex;flex-direction:column;gap:14px;margin-bottom:16px}",
      ".lt-routine-item{display:flex;flex-direction:column;gap:10px;background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:20px;padding:18px 18px 16px;min-height:96px;-webkit-tap-highlight-color:transparent;box-shadow:0 1px 2px rgba(0,0,0,.04)}",
      ".lt-routine-item-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
      ".lt-routine-timerange{display:inline-block;font-size:13px;font-weight:800;letter-spacing:.2px;color:#0369A1;background:#E0F2FE;padding:6px 12px;border-radius:999px;line-height:1.2}",
      ".lt-routine-circle{flex-shrink:0;width:34px;height:34px;border-radius:50%;border:2px solid hsl(var(--border));display:flex;align-items:center;justify-content:center;cursor:pointer;background:transparent;color:transparent;font-size:16px;font-weight:900;transition:background .15s,border-color .15s,color .15s}",
      ".lt-routine-circle.done{background:#0369A1;border-color:#0369A1;color:#fff}",
      ".lt-routine-body{flex:1;min-width:0;cursor:pointer}",
      ".lt-routine-name{font-size:19px;font-weight:800;color:hsl(var(--foreground));margin:0;line-height:1.3}",
      ".lt-routine-name.done{text-decoration:line-through;color:hsl(var(--muted-foreground))}",
      ".lt-routine-time{font-size:12px;font-weight:700;color:#0369A1;margin:2px 0 0}",
      ".lt-routine-edit-hint{flex-shrink:0;font-size:11px;color:hsl(var(--muted-foreground));font-weight:600;align-self:flex-end}",
      ".lt-routine-sheet-delete{margin-top:10px;width:100%;background:transparent;color:#dc2626;border:1px solid #dc2626;border-radius:12px;padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}",
      ".lt-routine-sheet-delete:active{opacity:.8}",
      /* Routine poll-card look (WhatsApp-poll inspired) + multi-row add sheet + clock picker */
      ".lt-routine-poll{background:#e9fbe0;border:1px solid #cdeec0;border-radius:18px;padding:14px 14px 6px;margin-bottom:16px}",
      ".lt-routine-poll-q{font-size:15px;font-weight:800;color:#1a1a1a;margin:0 0 2px}",
      ".lt-routine-poll-sub{font-size:11px;color:#6b8f5c;font-weight:600;margin:0 0 12px;display:flex;align-items:center;gap:5px}",
      ".lt-routine-poll-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #d7ecc9}",
      ".lt-routine-poll-row:first-of-type{border-top:none}",
      ".lt-routine-poll-tick{flex-shrink:0;width:26px;height:26px;border-radius:50%;border:2px solid #9fc98a;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff;color:transparent;font-size:14px;font-weight:900;transition:background .15s,border-color .15s,color .15s}",
      ".lt-routine-poll-tick.done{background:#25b356;border-color:#25b356;color:#fff}",
      ".lt-routine-poll-tick.locked{opacity:.45;cursor:not-allowed}",
      ".lt-routine-poll-body{flex:1;min-width:0;cursor:pointer}",
      ".lt-routine-poll-name{font-size:15px;font-weight:700;color:#1a1a1a;margin:0;line-height:1.3}",
      ".lt-routine-poll-name.done{text-decoration:line-through;color:#7c9a72}",
      ".lt-routine-poll-time{font-size:11.5px;font-weight:700;color:#3f8f2d;margin:2px 0 0}",
      ".lt-routine-poll-edit{flex-shrink:0;font-size:11px;color:#6b8f5c;font-weight:700;-webkit-tap-highlight-color:transparent}",
      ".lt-routine-draftlist{display:flex;flex-direction:column;gap:14px;max-height:48vh;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-bottom:6px;padding:2px 2px 4px}",
      ".lt-routine-draftrow{border:1px solid hsl(var(--border));border-radius:18px;padding:16px 16px 15px;position:relative;background:hsl(var(--card));box-shadow:0 2px 10px rgba(0,0,0,.05)}",
      ".lt-routine-draftrow-remove{position:absolute;top:10px;right:10px;width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:hsl(var(--muted));border:none;border-radius:50%;color:hsl(var(--muted-foreground));font-size:12px;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}",
      ".lt-routine-draftrow-remove:active{opacity:.65}",
      "#lt-routine-sheet .lt-tasks-sheet-title{font-size:18px;letter-spacing:0;text-transform:none;font-weight:800;color:hsl(var(--foreground));margin-bottom:16px}",
      ".lt-routine-name-input{font-size:16px;width:100%;border:1.5px solid hsl(var(--border));background:hsl(var(--muted));color:hsl(var(--foreground));font-family:inherit;font-weight:700;padding:13px 14px;border-radius:14px;outline:none;caret-color:hsl(var(--primary));margin-bottom:12px;box-sizing:border-box;transition:border-color .15s}",
      ".lt-routine-name-input:focus{border-color:hsl(var(--primary))}",
      ".lt-routine-name-input::placeholder{color:hsl(var(--muted-foreground));font-weight:600}",
      ".lt-routine-sheet-timerow{display:flex;align-items:flex-end;gap:10px;margin:0}",
      ".lt-routine-timefield{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}",
      ".lt-routine-timefield-label{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:hsl(var(--muted-foreground));padding-left:3px}",
      ".lt-routine-addanother{width:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:hsl(var(--muted));border:1.5px dashed hsl(var(--border));color:#0369A1;border-radius:14px;padding:12px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;margin:4px 0 14px;-webkit-tap-highlight-color:transparent;transition:opacity .15s}",
      ".lt-routine-addanother:active{opacity:.65}",
      ".lt-routine-sheet-done{width:100%;background:transparent;color:hsl(var(--muted-foreground));border:none;padding:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent}",
      ".lt-clock-field{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;border:1.5px solid #bfe3fa;background:#eaf7ff;color:#0369A1;font:inherit;font-size:14px;font-weight:800;padding:11px 10px;border-radius:13px;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center;box-sizing:border-box;transition:opacity .15s}",
      ".lt-clock-field:active{opacity:.7}",
      ".lt-clock-field .lt-clock-icon{font-size:12px}",
      ".lt-clock-field .lt-clock-caret{font-size:9px;color:#0369A1;margin-left:2px}",
      ".lt-clock-field.lt-clock-empty{background:hsl(var(--muted));border-color:hsl(var(--border));color:hsl(var(--muted-foreground))}",
      ".lt-clock-field.lt-clock-empty .lt-clock-caret{color:hsl(var(--muted-foreground))}",
      ".lt-tasks-sheet-row:has(.lt-clock-field){border-top:none;padding:0;gap:8px}",
      /* Must sit ABOVE #lt-overlay-root (the full-screen Tasks/Routine panel,
         z-index:2147483647 — the max safe CSS z-index, can't go higher). Using
         the same value is fine: this element is always appended to <html>
         AFTER the panel already exists, and browsers break z-index ties by
         DOM order (later paints on top). Previously this was a lower value
         (2147483400), so the picker was rendered but sat BEHIND the panel —
         invisible until the panel was closed, which is exactly the bug where
         the time dialog only "appeared" after tapping Back. */
      "#lt-clockpicker-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px}",
      ".lt-clockpicker{width:100%;max-width:320px;background:hsl(var(--card));color:hsl(var(--foreground));border-radius:22px;padding:22px 20px 16px;box-sizing:border-box;box-shadow:0 20px 50px rgba(0,0,0,.35)}",
      ".lt-clockpicker-title{font-size:14px;font-weight:800;text-align:center;margin-bottom:18px;color:hsl(var(--muted-foreground))}",
      ".lt-clockpicker-row{display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:20px}",
      ".lt-clockpicker-select{-webkit-appearance:none;-moz-appearance:none;appearance:none;background:hsl(var(--muted));color:hsl(var(--foreground));border:1px solid hsl(var(--border));border-radius:12px;padding:12px 14px;font-size:17px;font-weight:800;font-family:inherit;text-align:center;text-align-last:center;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".lt-clockpicker-select:focus{outline:2px solid #0369A1}",
      ".lt-clockpicker-select.lt-clockpicker-ampm{min-width:64px}",
      ".lt-clockpicker-colon{font-size:20px;font-weight:800;padding:0 2px}",
      ".lt-clockpicker-actions{display:flex;justify-content:flex-end;gap:14px}",
      ".lt-clockpicker-actions button{background:none;border:none;color:#0369A1;font-size:13.5px;font-weight:800;cursor:pointer;padding:8px 6px;font-family:inherit;-webkit-tap-highlight-color:transparent}",
      ".lt-clockpicker-actions button.lt-cancel{color:hsl(var(--muted-foreground))}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ── Styles: smart nudge, running-timer banner, streak badge, opp-cost ──── */

  var injectedStyle3 = false;
  function addStyle3() {
    if (injectedStyle3) return;
    injectedStyle3 = true;
    var s = document.createElement("style");
    s.textContent = [
      /* Persistent top status bar (replaces the old bottom slide-up banner).
         Always visible, on every tab — shows either idle state or the
         running activity, so it never appears/disappears unexpectedly. */
      "#lt-top-status-bar{position:fixed;top:0;left:0;right:0;z-index:9500;display:flex;align-items:center;gap:8px;background:#04091e;color:#fff;padding:8px 14px;padding-top:calc(8px + env(safe-area-inset-top,0px));font-size:12px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.25)}",
      /* Reserve space at the top of the page for the bar (own height incl.
         safe-area) so it never overlaps the app's own header content. */
      "html.lt-has-top-status-bar body{padding-top:38px}",
      "html.lt-has-top-status-bar{scroll-padding-top:38px}",
      "#lt-top-status-bar .lt-ts-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.3);flex-shrink:0;transition:background .2s}",
      /* Bigger, unmistakably-circular blinking dot while an activity is
         running, plus a soft expanding ring behind it (like a live
         recording indicator) so it reads as \"running\" at a glance
         instead of blending into the bar as a small static mark. */
      "#lt-top-status-bar.lt-ts-running .lt-ts-dot{width:11px;height:11px;background:#ff3b30;animation:lt-pulse 1.2s infinite;position:relative}",
      "#lt-top-status-bar.lt-ts-running .lt-ts-dot::after{content:'';position:absolute;inset:-6px;border-radius:50%;border:2px solid #ff3b30;animation:lt-ring-pulse 1.6s infinite}",
      "@keyframes lt-ring-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}",
      /* The whole bar also blinks gently (not just the dot) while
         running, and gets a pointer cursor + tap feedback since it's now
         tappable (see click handler in upsertRunningBanner). */
      "#lt-top-status-bar.lt-ts-running{animation:lt-bar-blink 1.6s ease-in-out infinite;cursor:pointer}",
      "@keyframes lt-bar-blink{0%,100%{background:#04091e}50%{background:#160b0b}}",
      "#lt-top-status-bar.lt-ts-running:active{opacity:.85}",
      "#lt-top-status-bar .lt-ts-time{font-size:13px;font-weight:900;font-variant-numeric:tabular-nums}",
      "#lt-top-status-bar .lt-ts-label{flex:1;opacity:.8;font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#lt-top-status-bar .lt-ts-stop{background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:16px;padding:4px 10px;font-size:10px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;display:none}",
      "#lt-top-status-bar.lt-ts-running .lt-ts-stop{display:inline-block}",
      /* Smart nudge toast */
      "#lt-nudge-toast{position:fixed;bottom:80px;left:16px;right:16px;z-index:9100;background:#1a2036;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.4);transform:translateY(120%);opacity:0;transition:transform .35s cubic-bezier(.4,0,.2,1),opacity .35s}",
      "#lt-nudge-toast.lt-show{transform:translateY(0);opacity:1}",
      "#lt-nudge-toast .lt-nudge-icon{font-size:22px;flex-shrink:0;margin-top:1px}",
      "#lt-nudge-toast .lt-nudge-body p:first-child{color:#fff;font-size:13px;font-weight:800;margin:0 0 4px}",
      "#lt-nudge-toast .lt-nudge-body p:last-child{color:rgba(255,255,255,.65);font-size:12px;margin:0;line-height:1.5}",
      "#lt-nudge-toast-close{position:absolute;top:8px;right:10px;background:none;border:none;color:rgba(255,255,255,.4);font-size:16px;cursor:pointer;padding:2px 6px}",
      /* Streak / badge modal */
      "#lt-badge-overlay{position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:24px}",
      "#lt-badge-card{background:#04091e;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px 24px;text-align:center;width:100%;max-width:340px}",
      "#lt-badge-card .lt-badge-trophy{font-size:56px;margin-bottom:12px}",
      "#lt-badge-card h2{color:#fff;font-size:20px;font-weight:900;margin:0 0 6px}",
      "#lt-badge-card p{color:rgba(255,255,255,.65);font-size:13px;line-height:1.6;margin:0 0 20px}",
      "#lt-badge-card .lt-badge-name{display:inline-block;background:linear-gradient(135deg,#ffd700,#ff9500);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:22px;font-weight:900;margin:4px 0 16px}",
      "#lt-badge-card button{background:#fff;color:#04091e;border:none;border-radius:12px;padding:12px 28px;font-size:14px;font-weight:800;cursor:pointer;width:100%;-webkit-tap-highlight-color:transparent}",
      /* Opportunity cost tool (inside Life Hub) */
      ".lt-opp-card{background:#04091e;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px;margin-top:16px}",
      ".lt-opp-card h4{color:#fff;font-size:14px;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:7px}",
      ".lt-opp-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}",
      ".lt-opp-row label{color:rgba(255,255,255,.6);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;min-width:110px}",
      ".lt-opp-row input{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#fff;padding:7px 10px;font-size:13px;font-weight:600;-webkit-tap-highlight-color:transparent}",
      ".lt-opp-row input:focus{outline:none;border-color:rgba(255,255,255,.35)}",
      ".lt-opp-calc-btn{width:100%;background:#fff;color:#04091e;border:none;border-radius:10px;padding:11px;font-size:13px;font-weight:800;cursor:pointer;margin-top:4px;-webkit-tap-highlight-color:transparent}",
      ".lt-opp-result{background:rgba(255,255,255,.05);border-radius:10px;padding:14px;margin-top:12px;display:none}",
      ".lt-opp-result.lt-show{display:block}",
      ".lt-opp-result-num{color:#ffd700;font-size:26px;font-weight:900;margin:0 0 4px}",
      ".lt-opp-result-label{color:rgba(255,255,255,.6);font-size:12px;line-height:1.5;margin:0}",
      "@keyframes lt-pulse{0%,100%{opacity:1}50%{opacity:.3}}",
      /* Currency picker sheet */
      "#lt-curr-sheet{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,.55)}",
      "#lt-curr-sheet-card{background:#04091e;border-radius:20px 20px 0 0;padding:20px 16px 36px;width:100%;max-width:480px;margin:0 auto;box-sizing:border-box;max-height:80vh;display:flex;flex-direction:column}",
      "#lt-curr-sheet-card h3{color:#fff;font-size:16px;font-weight:900;margin:0 0 4px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0}",
      "#lt-curr-sheet-card h3 button{background:rgba(255,255,255,.12);border:none;color:#fff;width:28px;height:28px;border-radius:50%;font-size:14px;cursor:pointer}",
      "#lt-curr-search{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);border-radius:10px;color:#fff;padding:9px 12px;font-size:13px;margin-bottom:10px;margin-top:10px;box-sizing:border-box;flex-shrink:0}",
      "#lt-curr-search:focus{outline:none;border-color:rgba(255,255,255,.4)}",
      "#lt-curr-list{overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch}",
      ".lt-curr-option{display:flex;align-items:center;gap:12px;padding:14px 12px;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .15s}",
      ".lt-curr-option:active,.lt-curr-option.lt-selected{background:rgba(255,255,255,.1)}",
      ".lt-curr-option .lt-curr-flag{font-size:22px;width:36px;height:36px;flex-shrink:0;text-align:center;color:#fff;background:rgba(255,255,255,.1);border-radius:50%;display:flex;align-items:center;justify-content:center;line-height:1;overflow:hidden}",
      ".lt-curr-option .lt-curr-info{flex:1}",
      ".lt-curr-option .lt-curr-name{color:#fff;font-size:14px;font-weight:700}",
      ".lt-curr-option .lt-curr-sub{color:rgba(255,255,255,.5);font-size:11px;margin-top:1px}",
      ".lt-curr-option .lt-curr-check{color:#34c759;font-size:18px;opacity:0}",
      ".lt-curr-option.lt-selected .lt-curr-check{opacity:1}",
      /* Life Progress + Goal Reach Countdown card (Timer tab) */
      "#lt-life-progress{margin:12px 16px 0;box-sizing:border-box}",
      "#lt-life-progress *{box-sizing:border-box}",
      "#lt-life-progress .lt-lp-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:hsl(var(--background));border:1px solid hsl(var(--border));border-radius:16px;padding:16px}",
      "#lt-life-progress .lt-lp-greet{margin:0;font-size:14px;font-weight:600;color:hsl(var(--foreground)/.55)}",
      "#lt-life-progress .lt-lp-name{margin:4px 0 8px;font-size:26px;font-weight:900;color:hsl(var(--primary))}",
      "#lt-life-progress .lt-lp-sub{margin:0;font-size:13px;line-height:1.5;color:hsl(var(--foreground)/.6);max-width:180px}",
      "#lt-life-progress .lt-lp-ringbox{flex-shrink:0;display:flex;flex-direction:column;align-items:center;background:#fff;border:1px solid hsl(var(--border));border-radius:14px;padding:10px 12px}",
      "#lt-life-progress .lt-lp-ringlabel{margin:0 0 4px;font-size:9px;font-weight:800;letter-spacing:.06em;color:hsl(var(--foreground)/.4);white-space:nowrap}",
      "#lt-life-progress .lt-lp-ringwrap{position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center}",
      "#lt-life-progress .lt-lp-ring{transform:rotate(-90deg);display:block}",
      "#lt-life-progress .lt-lp-track{fill:none;stroke:hsl(var(--border));stroke-width:8}",
      "#lt-life-progress .lt-lp-fill{fill:none;stroke:hsl(var(--accent));stroke-width:8;stroke-linecap:round;stroke-dasharray:276.5;transition:stroke-dashoffset .4s ease}",
      "#lt-life-progress .lt-lp-ringtext{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}",
      "#lt-life-progress .lt-lp-pct{font-size:19px;font-weight:900;color:hsl(var(--primary))}",
      "#lt-life-progress .lt-lp-ringsub{margin:4px 0 0;font-size:9px;font-weight:600;color:hsl(var(--foreground)/.45);text-align:center;white-space:nowrap}",
      "#lt-life-progress .lt-lp-countdown{margin-top:10px;background:hsl(var(--primary));border-radius:16px;padding:16px}",
      "#lt-life-progress .lt-lp-cdhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px}",
      "#lt-life-progress .lt-lp-cdtitle{margin:0;font-size:14px;font-weight:800;color:#fff}",
      "#lt-life-progress .lt-lp-cddate{margin:3px 0 0;font-size:11px;font-weight:600;color:rgba(255,255,255,.5)}",
      "#lt-life-progress #lt-lp-viewplan{flex-shrink:0;background:rgba(255,255,255,.12);color:#fff;border:none;border-radius:10px;padding:7px 12px;font-size:11px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      "#lt-life-progress .lt-lp-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}",
      "#lt-life-progress .lt-lp-box{display:flex;flex-direction:column;align-items:center;background:rgba(255,255,255,.08);border-radius:10px;padding:8px 2px}",
      "#lt-life-progress .lt-lp-num{font-size:17px;font-weight:900;color:#fff;font-variant-numeric:tabular-nums}",
      "#lt-life-progress .lt-lp-box.lt-lp-accent .lt-lp-num{color:hsl(var(--accent))}",
      "#lt-life-progress .lt-lp-lbl{margin-top:2px;font-size:8px;font-weight:800;letter-spacing:.05em;color:rgba(255,255,255,.4)}",
      "#lt-life-progress .lt-lp-tv{margin-top:10px;background:hsl(var(--accent)/.1);border:1px solid hsl(var(--accent)/.3);border-radius:16px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:10px}",
      "#lt-life-progress .lt-lp-tv-title{margin:0;font-size:13px;font-weight:800;color:hsl(var(--primary))}",
      "#lt-life-progress .lt-lp-tv-sub{margin:1px 0 6px;font-size:11px;color:hsl(var(--foreground)/.5)}",
      "#lt-life-progress .lt-lp-tv-amt{margin:0;font-size:22px;font-weight:900;color:hsl(var(--accent))}",
      "#lt-life-progress .lt-lp-tv-left{margin:2px 0 0;font-size:11px;color:hsl(var(--foreground)/.5)}",
      "#lt-life-progress .lt-lp-tv-rate{flex-shrink:0;background:hsl(var(--accent)/.15);color:hsl(var(--accent));border-radius:20px;padding:6px 10px;font-size:10px;font-weight:800;text-align:center;max-width:96px;line-height:1.3}",

      /* Currency chip — shown in overlays */
      ".lt-curr-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:800;color:#fff;cursor:pointer;-webkit-tap-highlight-color:transparent;vertical-align:middle;margin-left:8px}",
      ".lt-curr-chip:active{opacity:.75}",
      /* Ensure overlay content never overflows horizontally */
      "#lt-overlay-root *{max-width:100%;box-sizing:border-box}",
      ".lt-tool-card{word-break:break-word}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ── Extra styles: productivity toast + category modal + life value ─────── */

  var injectedStyle2 = false;

  function addStyle2() {
    if (injectedStyle2) return;
    injectedStyle2 = true;
    var s = document.createElement("style");
    s.textContent = [
      /* Productivity toast */
      "#lt-prod-toast{position:fixed;left:14px;right:14px;bottom:18px;z-index:2147483000;background:#1c1c1e;color:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 26px rgba(0,0,0,.35);opacity:0;transform:translateY(12px);transition:opacity .25s,transform .25s}",
      "#lt-prod-toast.lt-show{opacity:1;transform:translateY(0)}",
      ".lt-prod-toast-body{flex:1;min-width:0}",
      ".lt-prod-toast-title{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.55);margin:0 0 3px}",
      ".lt-prod-toast-msg{font-size:13px;line-height:1.35;margin:0;color:#fff}",
      ".lt-prod-toast-close{background:none;border:none;color:rgba(255,255,255,.5);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0;-webkit-tap-highlight-color:transparent}",
      /* Category selection modal */
      "#lt-cat-modal-overlay{position:fixed;inset:0;z-index:2147483100;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center}",
      ".lt-cat-modal{width:100%;max-width:480px;background:hsl(var(--card));color:hsl(var(--foreground));border-radius:20px 20px 0 0;box-sizing:border-box;max-height:82vh;display:flex;flex-direction:column;overflow:hidden}",
      ".lt-cat-modal-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 18px 10px;flex:1 1 auto;min-height:0}",
      ".lt-cat-modal-head{display:flex;align-items:flex-start;gap:12px;margin:0 0 14px}",
      ".lt-cat-modal-head>div{flex:1;min-width:0}",
      ".lt-cat-modal-title{font-size:17px;font-weight:800;margin:0 0 3px}",
      ".lt-cat-modal-sub{font-size:12px;color:hsl(var(--muted-foreground));margin:0 0 14px}",
      ".lt-cat-modal-close{flex:0 0 auto;width:30px;height:30px;border:none;background:transparent;color:hsl(var(--muted-foreground));font-size:28px;line-height:26px;font-weight:400;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".lt-cat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}",
      ".lt-cat-chip{border:1px solid hsl(var(--border));background:hsl(var(--secondary));color:hsl(var(--foreground));border-radius:10px;padding:11px 8px;font-size:12.5px;font-weight:700;text-align:center;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      ".lt-cat-chip.lt-cat-selected{background:hsl(var(--primary));border-color:hsl(var(--primary));color:#fff}",
      ".lt-cat-reason{width:100%;min-height:70px;resize:vertical;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:10px;font:inherit;font-size:13px;box-sizing:border-box}",
      ".lt-cat-field-row{display:flex;gap:10px;margin-bottom:10px}",
      ".lt-cat-field-row .lt-field{flex:1}",
      ".lt-cat-modal-actions{display:flex;gap:8px;justify-content:flex-end;padding:12px 18px 18px;background:hsl(var(--card));border-top:1px solid hsl(var(--border));flex:0 0 auto}",
      /* Keep user-selected activity emoji in the platform's color emoji
         font. The WebView was inheriting the row's dark text color and
         rendering some emoji as black glyphs. */
      "main span,main div{font-family:inherit}",
      "main [data-emoji],main .emoji,main [class*='emoji']{font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif!important;color:initial!important;-webkit-text-fill-color:initial!important}",
      "main span.text-lg.leading-none.shrink-0.w-5.text-center,main button.text-2xl{font-family:'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif!important;color:initial!important;-webkit-text-fill-color:initial!important}",
      /* Life Value app */
      ".lt-lv-hero{background:hsl(var(--primary));color:#fff;border-radius:16px;padding:20px;margin-bottom:16px}",
      ".lt-lv-hero small{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:rgba(255,255,255,.6)}",
      ".lt-lv-hero strong{display:block;font-size:34px;margin-top:6px}",
      ".lt-lv-hero p{font-size:12.5px;color:rgba(255,255,255,.8);margin:8px 0 0}",
      ".lt-lv-adjusted{background:rgba(255,255,255,.14);border-radius:10px;padding:10px 12px;margin-top:12px}",
      ".lt-lv-adjusted small{color:rgba(255,255,255,.75)}",
      ".lt-lv-adjusted strong{font-size:20px;margin-top:2px}",
      ".lt-lv-row{display:flex;justify-content:space-between;align-items:center;border-top:1px solid hsl(var(--border));padding:11px 2px;font-size:13.5px}",
      ".lt-lv-row:first-child{border-top:none}",
      ".lt-lv-row-cat{display:flex;align-items:center;gap:8px}",
      ".lt-lv-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}",
      ".lt-lv-row-wrap{border-top:1px solid hsl(var(--border))}",
      ".lt-lv-row-wrap:first-child{border-top:none}",
      ".lt-lv-row-wrap .lt-lv-row{border-top:none;padding:11px 2px 4px}",
      ".lt-lv-items{padding:0 2px 10px 17px}",
      ".lt-lv-item{display:flex;justify-content:space-between;font-size:12px;color:hsl(var(--muted-foreground));padding:3px 0}",
      /* Journal "Full view" button */
      ".lt-fv-btn{display:inline-flex;align-items:center;gap:4px;border:1px solid hsl(var(--primary));color:hsl(var(--primary));background:#fff;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:800;letter-spacing:.02em;cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap}",
      ".lt-fv-btn:active{opacity:.7}",
      "#lt-fv-modal-overlay,#lt-fv-report-overlay,#lt-fv-share-overlay{position:fixed;inset:0;z-index:2147483200;background:rgba(0,0,0,.72);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;overflow-y:auto;padding:22px 16px 40px}",
      ".lt-fv-modal-head{width:100%;max-width:480px;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}",
      ".lt-fv-modal-head h3{color:#fff;font-size:15px;font-weight:800;margin:0}",
      ".lt-fv-modal-close{background:rgba(255,255,255,.12);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:15px;cursor:pointer}",
      ".lt-fv-card-wrap{width:100%;max-width:480px;background:#000;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.5)}",
      ".lt-fv-card-wrap img{display:block;width:100%;height:auto}",
      ".lt-fv-modal-actions{width:100%;max-width:480px;display:flex;gap:10px;margin-top:16px}",
      ".lt-fv-modal-actions button{flex:1;border:none;border-radius:12px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent}",
      "#lt-fv-share-btn{background:hsl(var(--primary));color:#fff}",
      "#lt-fv-save-btn{background:rgba(255,255,255,.14);color:#fff}",
      ".lt-fv-hint{width:100%;max-width:480px;color:rgba(255,255,255,.55);font-size:11.5px;text-align:center;margin-top:10px;line-height:1.4}",
      ".lt-fv-loading{color:rgba(255,255,255,.75);font-size:13px;padding:40px 0}",
      /* Journal report tab (stage 1) */
      ".lt-fv-report-card{width:100%;max-width:480px;background:#161a34;border-radius:14px;padding:18px;box-sizing:border-box;margin-bottom:14px}",
      ".lt-fv-donut{width:180px;height:180px;border-radius:50%;position:relative;margin:4px auto 18px}",
      ".lt-fv-donut-hole{position:absolute;inset:26px;background:#161a34;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}",
      ".lt-fv-donut-hole strong{color:#fff;font-size:19px;font-weight:800}",
      ".lt-fv-donut-hole span{color:rgba(255,255,255,.5);font-size:10px;font-weight:700;letter-spacing:.08em;margin-top:2px}",
      ".lt-fv-legend{display:flex;flex-direction:column;gap:2px}",
      ".lt-fv-row{display:flex;align-items:center;justify-content:space-between;padding:9px 2px;border-top:1px solid rgba(255,255,255,.08);font-size:13.5px}",
      ".lt-fv-row:first-child{border-top:none}",
      ".lt-fv-row-left{display:flex;align-items:center;gap:8px;color:#fff;font-weight:600}",
      ".lt-fv-row-right{color:rgba(255,255,255,.6);font-weight:600;font-variant-numeric:tabular-nums}",
      ".lt-fv-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}",
    ].join("");
    document.head.appendChild(s);
  }

  /* ── Productivity balloon nudge ───────────────────────────────────────── */

  function currentProductivityScore() {
    return PRODUCTIVITY_CURVE[new Date().getHours()];
  }

  function balloonSVG(score) {
    var fillColor = score >= 70 ? "#34c759" : score >= 40 ? "#ff9500" : "#ff3b30";
    var h = Math.max(6, Math.round(score * 0.44));
    return (
      '<svg width="40" height="54" viewBox="0 0 46 60" style="flex-shrink:0">' +
        '<defs><clipPath id="lt-balloon-clip"><path d="M23 4 C36 4 42 16 42 26 C42 38 33 46 27 48 L27 50 L19 50 L19 48 C13 46 4 38 4 26 C4 16 10 4 23 4 Z"/></clipPath></defs>' +
        '<path d="M23 4 C36 4 42 16 42 26 C42 38 33 46 27 48 L27 50 L19 50 L19 48 C13 46 4 38 4 26 C4 16 10 4 23 4 Z" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.3)"/>' +
        '<rect x="0" y="' + (50 - h) + '" width="46" height="' + h + '" fill="' + fillColor + '" clip-path="url(#lt-balloon-clip)"/>' +
        '<line x1="23" y1="50" x2="23" y2="58" stroke="rgba(255,255,255,.5)"/>' +
      '</svg>'
    );
  }

  function productivityMessage(score) {
    if (score >= 70) return "Great focus window \u2014 a good time to tackle your hardest task.";
    if (score >= 40) return "Moderate energy right now \u2014 fine for routine or medium-effort work.";
    return "Your productivity tends to be low at this hour \u2014 good time for light, low-effort tasks.";
  }

  function showProductivityToast() {
    addStyle2();
    /* No throttle — this used to skip showing again within 5 minutes,
       which is why starting activities back-to-back only showed it once.
       Now it shows every time an activity is started or logged. */
    var existing = document.getElementById("lt-prod-toast");
    if (existing) existing.remove();

    var score = currentProductivityScore();
    var el = document.createElement("div");
    el.id = "lt-prod-toast";
    el.innerHTML =
      balloonSVG(score) +
      '<div class="lt-prod-toast-body">' +
        '<p class="lt-prod-toast-title">Energy check \u00b7 ' + score + '%</p>' +
        '<p class="lt-prod-toast-msg">' + escapeHtml(productivityMessage(score)) + '</p>' +
      '</div>' +
      '<button class="lt-prod-toast-close" id="lt-prod-toast-close">\u2715</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("lt-show"); });

    function dismiss() {
      el.classList.remove("lt-show");
      setTimeout(function () { if (el.parentNode) el.remove(); }, 260);
    }
    var closeBtn = document.getElementById("lt-prod-toast-close");
    if (closeBtn) closeBtn.addEventListener("click", dismiss);
    setTimeout(dismiss, 8000);
  }

  /* ── Category selection modal (optional tag shown when a new timer starts) ─ */

  function catLogEntries() {
    var items = readJson(CATLOG_KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function closeCategoryModal(reason) {
    if (catModalRoot) {
      var root = catModalRoot;
      catModalRoot = null;
      root.remove();
      /* Closing the optional picker must never cancel the activity start. */
      if (reason !== "saved" && typeof root.__ltOnCancel === "function") {
        var onCancel = root.__ltOnCancel;
        root.__ltOnCancel = null;
        onCancel();
      }
    }
  }

  /* Finds the <input> that sits next to a label with exact text labelText
     (e.g. "Start time" / "End time"). Used for the *Journal's* "Edit time
     block" sheet, which really does use <input type="datetime-local">. */
  /* ── Replace native <input type="date"> with a simple Day/Month/Year
     picker — the OS/WebView native calendar requires tapping the year
     label to switch modes, which is a common source of confusion.
     This intercepts taps and shows three plain dropdowns instead. ──────── */
  function hijackDateInputs() {
    var inputs = document.querySelectorAll('input[type="date"]:not([data-lt-date-hijacked])');
    inputs.forEach(function (input) {
      input.setAttribute("data-lt-date-hijacked", "1");
      input.setAttribute("readonly", "readonly");
      input.addEventListener("click", function (e) {
        e.preventDefault();
        openSimpleDatePicker(input);
      });
      input.addEventListener("focus", function (e) {
        input.blur();
        openSimpleDatePicker(input);
      });
    });
  }

  function openSimpleDatePicker(input) {
    addStyle3();
    var existing = document.getElementById("lt-date-sheet");
    if (existing) existing.remove();

    var current = input.value ? new Date(input.value + "T00:00:00") : new Date();
    var maxDate = input.getAttribute("max") ? new Date(input.getAttribute("max") + "T00:00:00") : null;
    var minYear = 1920;
    var maxYear = maxDate ? maxDate.getFullYear() : new Date().getFullYear();

    var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    var sheet = document.createElement("div");
    sheet.id = "lt-date-sheet";
    sheet.style.cssText = "position:fixed;inset:0;z-index:999997;background:rgba(20,24,45,.55);display:flex;align-items:flex-end;justify-content:center;font-family:'Inter',sans-serif;";
    sheet.innerHTML =
      '<div style="width:100%;max-width:420px;background:#fff;padding:20px;box-sizing:border-box">' +
        '<p style="color:hsl(230 40% 16%);font-size:15px;font-weight:800;margin:0 0 14px">Select date</p>' +
        '<div style="display:flex;gap:8px;margin-bottom:16px">' +
          '<select id="lt-date-day" style="flex:1;padding:12px 8px;border:1px solid hsl(220 13% 85%);background:hsl(220 15% 97%);color:hsl(230 40% 16%);font-size:15px;font-family:inherit"></select>' +
          '<select id="lt-date-month" style="flex:1.6;padding:12px 8px;border:1px solid hsl(220 13% 85%);background:hsl(220 15% 97%);color:hsl(230 40% 16%);font-size:15px;font-family:inherit"></select>' +
          '<select id="lt-date-year" style="flex:1;padding:12px 8px;border:1px solid hsl(220 13% 85%);background:hsl(220 15% 97%);color:hsl(230 40% 16%);font-size:15px;font-family:inherit"></select>' +
        '</div>' +
        '<button id="lt-date-confirm" style="width:100%;background:hsl(230 40% 16%);border:none;color:#fff;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px">Confirm</button>' +
        '<button id="lt-date-cancel" style="width:100%;background:#fff;border:1px solid hsl(220 13% 85%);color:hsl(220 10% 40%);padding:12px;font-size:14px;cursor:pointer;font-family:inherit">Cancel</button>' +
      '</div>';
    document.body.appendChild(sheet);

    var daySel = document.getElementById("lt-date-day");
    var monthSel = document.getElementById("lt-date-month");
    var yearSel = document.getElementById("lt-date-year");

    for (var y = maxYear; y >= minYear; y--) {
      var yo = document.createElement("option"); yo.value = y; yo.textContent = y;
      yearSel.appendChild(yo);
    }
    months.forEach(function (m, idx) {
      var mo = document.createElement("option"); mo.value = idx; mo.textContent = m;
      monthSel.appendChild(mo);
    });
    function populateDays() {
      var y = parseInt(yearSel.value, 10), m = parseInt(monthSel.value, 10);
      var daysInMonth = new Date(y, m + 1, 0).getDate();
      var prevVal = daySel.value;
      daySel.innerHTML = "";
      for (var d = 1; d <= daysInMonth; d++) {
        var opt = document.createElement("option"); opt.value = d; opt.textContent = d;
        daySel.appendChild(opt);
      }
      if (prevVal && Number(prevVal) <= daysInMonth) daySel.value = prevVal;
    }
    yearSel.value = current.getFullYear();
    monthSel.value = current.getMonth();
    populateDays();
    daySel.value = current.getDate();
    monthSel.addEventListener("change", populateDays);
    yearSel.addEventListener("change", populateDays);

    document.getElementById("lt-date-cancel").addEventListener("click", function () { sheet.remove(); });
    sheet.addEventListener("click", function (e) { if (e.target === sheet) sheet.remove(); });
    document.getElementById("lt-date-confirm").addEventListener("click", function () {
      var y = yearSel.value, m = String(Number(monthSel.value) + 1).padStart(2, "0"), d = String(daySel.value).padStart(2, "0");
      var iso = y + "-" + m + "-" + d;
      var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeSetter.call(input, iso);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      sheet.remove();
    });
  }

  function findLabeledInput(labelText) {
    var labels = Array.prototype.slice.call(document.querySelectorAll("label"));
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || "").trim() === labelText) {
        var scope = labels[i].parentElement || document;
        var input = scope.querySelector("input");
        if (input) return input;
      }
    }
    return null;
  }

  /* The quick "Log a time block" sheet (opened from the Timer tab) is a
     totally different form from the Journal's "Edit time block" sheet —
     it has NO <input> elements at all. "From" / "To" are each an hour
     <select>, a minute <select>, and a plain AM/PM toggle <button>. This
     reads that trio next to a given label and returns minutes-since-
     midnight, converting 12-hour + AM/PM to 24-hour the same way the app
     itself does (hour % 12, +12 for PM). */
  function readFromToSelectMinutes(labelText) {
    var labels = Array.prototype.slice.call(document.querySelectorAll("label"));
    for (var i = 0; i < labels.length; i++) {
      if ((labels[i].textContent || "").trim() === labelText) {
        var scope = labels[i].parentElement || document;
        var selects = scope.querySelectorAll("select");
        var btn = scope.querySelector("button");
        if (selects.length >= 2 && btn) {
          var hour = parseInt(selects[0].value, 10);
          var minute = parseInt(selects[1].value, 10);
          if (isNaN(hour) || isNaN(minute)) return null;
          var ampm = (btn.textContent || "").trim().toUpperCase();
          var h24 = hour % 12;
          if (ampm === "PM") h24 += 12;
          return h24 * 60 + minute;
        }
      }
    }
    return null;
  }

  /* Secondary check: the same quick-add sheet also shows a live duration
     preview badge (e.g. "45m" or "1h 20m") the moment both From and To
     are set — read that as a cross-check / fallback since the app has
     already computed it for us. */
  function parseDurationBadgeText(t) {
    t = (t || "").trim();
    var mh = t.match(/(\d+)\s*h/);
    var mm = t.match(/(\d+)\s*m/);
    if (!mh && !mm) return null;
    return (mh ? parseInt(mh[1], 10) : 0) * 60 + (mm ? parseInt(mm[1], 10) : 0);
  }

  function getTimeBlockMinutesFromDom() {
    /* 1) The real quick-add "Log a time block" sheet: From/To hour+minute
       selects with an AM/PM button. */
    var fromMin = readFromToSelectMinutes("From");
    var toMin = readFromToSelectMinutes("To");
    if (fromMin != null && toMin != null) {
      var diff1 = toMin - fromMin;
      if (diff1 < 0) diff1 += 24 * 60; /* crossed midnight */
      if (diff1 > 0) return diff1;
    }

    /* 2) Fallback: read the app's own live duration preview badge next to
       the From/To selects, in case the label text ever changes. */
    var badges = document.querySelectorAll('[class*="bg-primary/5"]');
    for (var i = 0; i < badges.length; i++) {
      var p = badges[i].querySelector("p");
      if (p) {
        var badgeMin = parseDurationBadgeText(p.textContent);
        if (badgeMin != null && badgeMin > 0) return badgeMin;
      }
    }

    /* 3) The Journal's separate "Edit time block" sheet uses real
       <input type="datetime-local"> Start time / End time fields
       instead of selects — cover that case too. */
    var startInput = findLabeledInput("Start time");
    var endInput = findLabeledInput("End time");
    var a, b;
    if (startInput && endInput) {
      a = startInput.value;
      b = endInput.value;
    } else {
      var inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="datetime-local"]'));
      if (inputs.length < 2) {
        inputs = Array.prototype.slice.call(document.querySelectorAll('input[type="time"]'));
      }
      if (inputs.length < 2) return null;
      a = inputs[0].value;
      b = inputs[1].value;
    }
    if (!a || !b) return null;

    if (a.indexOf("T") !== -1) {
      var startMs = new Date(a).getTime();
      var endMs = new Date(b).getTime();
      if (isNaN(startMs) || isNaN(endMs)) return null;
      var diffMs = endMs - startMs;
      if (diffMs <= 0) return null;
      var diffMin = Math.round(diffMs / 60000);
      return diffMin > 0 ? diffMin : 1;
    }

    var pa = a.split(":"), pb = b.split(":");
    var startMin = (parseInt(pa[0], 10) * 60) + parseInt(pa[1], 10);
    var endMin   = (parseInt(pb[0], 10) * 60) + parseInt(pb[1], 10);
    var diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60; /* crossed midnight */
    return diff || null;
  }

  /* Generic small toast (distinct from the Energy check one above) used
     for quick warnings, e.g. when a time block couldn't be measured. */
  function showSimpleToast(title, msg) {
    addStyle2();
    var existing = document.getElementById("lt-simple-toast");
    if (existing) existing.remove();
    var el = document.createElement("div");
    el.id = "lt-simple-toast";
    el.setAttribute("style", "position:fixed;left:14px;right:14px;bottom:18px;z-index:2147483000;background:#1c1c1e;color:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 26px rgba(0,0,0,.35);opacity:0;transform:translateY(12px);transition:opacity .25s,transform .25s");
    el.innerHTML =
      '<div style="flex:1;min-width:0">' +
        '<p style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.55);margin:0 0 3px">' + escapeHtml(title) + '</p>' +
        '<p style="font-size:13px;line-height:1.35;margin:0;color:#fff">' + escapeHtml(msg) + '</p>' +
      '</div>' +
      '<button style="background:none;border:none;color:rgba(255,255,255,.5);font-size:16px;cursor:pointer;padding:4px;flex-shrink:0" id="lt-simple-toast-close">\u2715</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
    function dismiss() {
      el.style.opacity = "0"; el.style.transform = "translateY(12px)";
      setTimeout(function () { if (el.parentNode) el.remove(); }, 260);
    }
    var closeBtn = document.getElementById("lt-simple-toast-close");
    if (closeBtn) closeBtn.addEventListener("click", dismiss);
    setTimeout(dismiss, 6000);
  }

  /* Reads the name of the activity currently open in the "How do you want
     to track this?" picker sheet, so the category log can remember which
     activity it was for — even if the user never types anything into the
     optional Label field. */
  function getPickerActivityName(target) {
    var cur = target, depth = 0;
    while (cur && depth < 12) {
      if (cur.querySelector) {
        var header = cur.querySelector(".font-bold.text-foreground.leading-tight");
        if (header) return (header.textContent || "").trim();
      }
      cur = cur.parentElement;
      depth++;
    }
    return "";
  }

  /**
    * Category selection is optional and is offered when an activity STARTS.
    * The timer is allowed to start even if the picker is closed or ignored.
   *
   * opts:
   *   showDuration  — if false, the "Duration (minutes)" field is hidden
   *                    (used when we're asking at start-time and the
   *                    duration isn't known yet).
   *   onSave(result) — called with {category, label, minutes} instead of
   *                    the default behaviour of writing straight to the
   *                    category log. If omitted, defaults to logging
   *                    immediately (original behaviour), used for the
   *                    rare fallback case where we ask after the fact.
   */
  var SOCIAL_MEDIA_SUBS = [
    { id: "sm_useful",    label: "Useful / Knowledge",    penalty: false },
    { id: "sm_waste",     label: "Time Waste / Scrolling", penalty: true  }
  ];

  function openCategoryModal(prefillMinutes, activityLabel, opts) {
    addStyle2();
    closeCategoryModal();
    opts = opts || {};
    var showDuration = opts.showDuration !== false;
    catModalMinutes = prefillMinutes || 0;
    catModalLabel = activityLabel || "";

    var selected = null;
    var selectedSub = null; /* for Social Media */
    var root = document.createElement("div");
    root.id = "lt-cat-modal-overlay";
    root.innerHTML =
      '<div class="lt-cat-modal">' +
      '<div class="lt-cat-modal-scroll">' +
        '<div class="lt-cat-modal-head">' +
          '<div>' +
            '<p class="lt-cat-modal-title">What type of activity is this?</p>' +
            '<p class="lt-cat-modal-sub">Add an optional tag so Life Value can track where your time goes. You can close this and keep tracking. Saved only on this device.</p>' +
          '</div>' +
          '<button type="button" class="lt-cat-modal-close" id="lt-cat-close" aria-label="Close">\u00D7</button>' +
        '</div>' +
        (showDuration ?
        '<div class="lt-cat-field-row">' +
          '<div class="lt-field"><label>Duration</label>' +
            '<div style="display:flex;gap:6px">' +
              '<input id="lt-cat-minutes" type="number" min="0" style="flex:1" value="' + (catModalMinutes || "") + '">' +
              '<select id="lt-cat-unit" style="flex:0 0 auto;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:6px;padding:0 6px;font-size:13px">' +
                '<option value="1">min</option>' +
                '<option value="60">hr</option>' +
                '<option value="1440">day</option>' +
                '<option value="43200">month</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="lt-field"><label>Label (optional)</label><input id="lt-cat-label" type="text" placeholder="e.g. Instagram" value="' + escapeHtml(catModalLabel) + '"></div>' +
        '</div>'
        :
        '<div class="lt-cat-field-row">' +
          '<div class="lt-field" style="flex:1"><label>Label (optional)</label><input id="lt-cat-label" type="text" placeholder="e.g. Instagram" value="' + escapeHtml(catModalLabel) + '"></div>' +
        '</div>') +
        '<div class="lt-cat-grid" id="lt-cat-grid">' +
          CATEGORIES.map(function (c) {
            return '<button type="button" class="lt-cat-chip" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
          }).join("") +
        '</div>' +
        '<div id="lt-cat-reason-wrap" style="display:none;margin:0 0 14px">' +
          '<label style="display:block;font-size:11px;font-weight:800;color:hsl(var(--muted-foreground));margin:0 0 6px">Why was this time wasted? (optional)</label>' +
          '<textarea id="lt-cat-reason" class="lt-cat-reason" rows="2" placeholder="Write a short note about what happened..."></textarea>' +
        '</div>' +
        /* Social Media sub-picker — hidden until Social Media is selected */
        '<div id="lt-sm-subpicker" style="display:none;margin:10px 0 0">' +
          '<p style="font-size:12px;font-weight:700;color:hsl(var(--muted-foreground));margin:0 0 8px">What kind of Social Media?</p>' +
          '<div style="display:flex;flex-direction:column;gap:6px">' +
            SOCIAL_MEDIA_SUBS.map(function (s) {
              return '<button type="button" class="lt-sm-sub" data-sub="' + s.id + '" data-penalty="' + s.penalty + '" style="text-align:left;padding:10px 14px;border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">' + escapeHtml(s.label) + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +
      '</div>' +
        '<div class="lt-cat-modal-actions">' +
          '<button class="lt-tool-primary" id="lt-cat-save" style="width:100%">Save tag &amp; continue</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    catModalRoot = root;
    root.__ltOnCancel = opts.onCancel;

    root.addEventListener("click", function (e) {
      if (e.target.id === "lt-cat-close") {
        closeCategoryModal("cancel");
        return;
      }
      var chip = e.target.closest("[data-cat]");
      if (chip) {
        selected = chip.getAttribute("data-cat");
        selectedSub = null;
        root.querySelectorAll(".lt-cat-chip").forEach(function (c) { c.classList.remove("lt-cat-selected"); });
        chip.classList.add("lt-cat-selected");
        root.querySelectorAll(".lt-sm-sub").forEach(function (b) { b.style.background = "hsl(var(--background))"; });
        /* Show/hide sub-picker */
        var subPicker = document.getElementById("lt-sm-subpicker");
        if (subPicker) subPicker.style.display = selected === "Social Media" ? "block" : "none";
        var reasonWrap = document.getElementById("lt-cat-reason-wrap");
        if (reasonWrap) reasonWrap.style.display = selected === "Time Waste" ? "block" : "none";
        return;
      }
      var subBtn = e.target.closest("[data-sub]");
      if (subBtn) {
        selectedSub = subBtn.getAttribute("data-sub");
        root.querySelectorAll(".lt-sm-sub").forEach(function (b) { b.style.background = "hsl(var(--background))"; });
        subBtn.style.background = "hsl(var(--accent)/.15)";
        subBtn.style.borderColor = "hsl(var(--primary))";
        var reasonWrap2 = document.getElementById("lt-cat-reason-wrap");
        if (reasonWrap2) reasonWrap2.style.display =
          selected === "Social Media" && subBtn.getAttribute("data-penalty") === "true" ? "block" : "none";
        return;
      }
      if (e.target.id === "lt-cat-save") {
        var minutesInput = document.getElementById("lt-cat-minutes");
        var unitInput    = document.getElementById("lt-cat-unit");
        var labelInput   = document.getElementById("lt-cat-label");
        var reasonInput  = document.getElementById("lt-cat-reason");
        var rawVal  = Number(minutesInput && minutesInput.value) || 0;
        var unitMul = Number(unitInput && unitInput.value) || 1;
        var minutes = showDuration ? Math.round(rawVal * unitMul) : 0;
        var label   = (labelInput && labelInput.value.trim()) || "";
        var reason  = (reasonInput && reasonInput.value.trim()) || "";
        /* For Social Media, override category based on sub-choice */
        var finalCategory = selected || "";
        if (selected === "Social Media" && selectedSub) {
          var subInfo = SOCIAL_MEDIA_SUBS.filter(function (s) { return s.id === selectedSub; })[0];
          if (subInfo && subInfo.penalty) {
            finalCategory = "Time Waste"; /* counts as waste in focus/value */
          } else {
            finalCategory = "Study / Learning"; /* counts as productive */
          }
          label = label || (subInfo ? subInfo.label : "Social Media");
        }
        var result = { category: finalCategory, label: label, reason: reason, minutes: minutes };
        if (typeof opts.onSave === "function") {
          opts.onSave(result);
        } else {
          if (result.category) logCategoryEntry(result.category, result.label, result.minutes, result.reason);
        }
        closeCategoryModal("saved");
      }
    });
  }

  function logCategoryEntry(category, label, minutes, reason) {
    var entries = catLogEntries();
    entries.unshift({
      id: genId(), category: category, minutes: minutes || 0, label: label || "", reason: reason || "",
      date: today(), savedAt: new Date().toISOString()
    });
    writeJson(CATLOG_KEY, entries);
  }

  /* ── Tile injection ────────────────────────────────────────────────────── */

  /* Something unique to the real Life Hub screen (a native tile that only
     exists there) — used to make sure findTileGrid() never mistakes some
     other page's 3-column grid for the Life Hub grid. Without this check,
     a Timer-page grid that briefly matched the same CSS shape (e.g. right
     after deleting an activity, mid re-render) would get all 13 tool tiles
     injected into it. */
  function isActuallyOnLifeHubScreen() {
    var spans = document.querySelectorAll("button span");
    for (var i = 0; i < spans.length; i++) {
      var t = (spans[i].textContent || "").trim();
      if (t === "Time Value" || t === "Screen Time") return true;
    }
    return false;
  }

  function findTileGrid() {
    if (!isActuallyOnLifeHubScreen()) return null;
    var all = Array.prototype.slice.call(document.querySelectorAll("div"));
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest("[data-lt-enhancement],[data-lt-tile-injected]")) continue;
      var gtc = el.style && el.style.gridTemplateColumns;
      if (gtc && gtc.indexOf("repeat(3") !== -1 && el.children.length >= 1) return el;
    }
    return null;
  }

  /* Time Value is a NATIVE app tile (not injected by makeTile), so we find
     it by its label text and swap its icon in-place. */
  function replaceNativeTileIcon(labelText, imgSrc) {
    var spans = document.querySelectorAll("button span.truncate, button span");
    for (var i = 0; i < spans.length; i++) {
      if ((spans[i].textContent || "").trim() !== labelText) continue;
      var btn = spans[i].closest("button");
      if (!btn) continue;
      var iconDiv = btn.querySelector("div");
      if (!iconDiv || iconDiv.getAttribute("data-lt-logo-swapped") === "1") continue;
      iconDiv.setAttribute("data-lt-logo-swapped", "1");
      iconDiv.style.overflow = "hidden";
      iconDiv.innerHTML = "";
      var img = document.createElement("img");
      img.src = imgSrc;
      img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
      iconDiv.appendChild(img);
      return;
    }
  }

  var TILE_LOGOS = {
    timevalue:   "./assets/icons/time-value.png",
    budget:      "./assets/icons/budget-tracker.png",
    emi:         "./assets/icons/emi-calculator.png",
    compound:    "./assets/icons/compound-interest.png",
    gram:        "./assets/icons/knowledge-gram.png",
    tasks:       "./assets/icons/tasks.png",
    lifevalue:   "./assets/icons/life-value.png",
    opp:         "./assets/icons/opportunity-cost.png",
    achievements: "./assets/icons/achievements.png",
  };

  var LT_NATIVE_META = {
    "Time Value":  { desc: "Track the value of your time every minute.", bg: "#DBEAFE", fg: "#2563EB", category: "time" },
    "Screen Time": { desc: "Monitor your screen time and digital balance.", bg: "#EDE9FE", fg: "#7C3AED", category: "time" }
  };
  var LT_CARD_STYLE = "width:100%;min-width:0;box-sizing:border-box;position:relative;padding:16px;border-radius:16px;background:#fff;border:1px solid rgba(0,0,0,0.06);box-shadow:0 1px 2px rgba(0,0,0,0.04);gap:8px;display:flex;";
  var LT_ICON_STYLE = "width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;";
  var LT_LABEL_STYLE = "font-weight:700;font-size:14px;margin-top:4px;color:hsl(var(--foreground));";
  var LT_DESC_STYLE = "font-size:12px;color:hsl(var(--muted-foreground));line-height:1.3;";

  function makeTile(tool, symbol, label, desc, bg, fg, locked, category, imgSrc) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-lifetime-tool", tool);
    btn.setAttribute("data-lt-tile-injected", "1");
    btn.setAttribute("data-lt-category", category || "");
    btn.className = "flex flex-col items-start text-left";
    btn.style.cssText = LT_CARD_STYLE;
    var iconDiv = document.createElement("div");
    iconDiv.style.cssText = LT_ICON_STYLE + "background:" + bg + ";color:" + fg + ";";
    if (imgSrc) {
      var img = document.createElement("img");
      img.src = imgSrc;
      img.alt = "";
      img.style.cssText = "width:70%;height:70%;object-fit:contain;display:block";
      iconDiv.appendChild(img);
    } else {
      iconDiv.textContent = symbol;
    }
    if (locked) {
      iconDiv.style.opacity = ".55";
      var lock = document.createElement("span");
      lock.textContent = "\uD83D\uDD12";
      lock.style.cssText = "position:absolute;top:10px;right:10px;font-size:12px;";
      btn.appendChild(lock);
    }
    var labelDiv = document.createElement("div");
    labelDiv.style.cssText = LT_LABEL_STYLE;
    labelDiv.textContent = label;
    var descDiv = document.createElement("div");
    descDiv.style.cssText = LT_DESC_STYLE;
    descDiv.textContent = desc;
    btn.appendChild(iconDiv);
    btn.appendChild(labelDiv);
    btn.appendChild(descDiv);
    return btn;
  }

  /* Restyle the two native tiles (Time Value, Screen Time) into the same
     card look as the injected ones. Idempotent via data-lt-native-restyled. */
  function restyleNativeTiles(grid) {
    var spans = grid.querySelectorAll("button span");
    for (var i = 0; i < spans.length; i++) {
      var label = (spans[i].textContent || "").trim();
      var meta = LT_NATIVE_META[label];
      if (!meta) continue;
      var btn = spans[i].closest("button");
      if (!btn || btn.getAttribute("data-lt-native-restyled") === "1") continue;
      btn.setAttribute("data-lt-native-restyled", "1");
      btn.setAttribute("data-lt-category", meta.category || "");
      btn.className = "flex flex-col items-start text-left";
      btn.style.cssText = LT_CARD_STYLE;
      var iconDiv = btn.querySelector("div");
      if (iconDiv) {
        iconDiv.innerHTML = "";
        iconDiv.textContent = label === "Time Value" ? getCurrency().symbol : "\u23F1";
        iconDiv.style.cssText = LT_ICON_STYLE + "background:" + meta.bg + ";color:" + meta.fg + ";";
      }
      spans[i].style.cssText = LT_LABEL_STYLE;
      if (!btn.querySelector("[data-lt-native-desc]")) {
        var desc = document.createElement("div");
        desc.setAttribute("data-lt-native-desc", "1");
        desc.style.cssText = LT_DESC_STYLE;
        desc.textContent = meta.desc;
        btn.appendChild(desc);
      }
    }
  }

  function mountLifeHubTools() {
    if (activeOverlay) return;
    var grid = findTileGrid();
    if (!grid) {
      /* Not on the Life Hub list page right now -- clean up any tiles that
         leaked into another view due to React reusing DOM nodes across
         route changes, so they don't show up on the wrong page. Also drop
         our search/filter bar so it doesn't linger on other pages. */
      var stray = document.querySelectorAll("[data-lt-tile-injected]");
      for (var i = 0; i < stray.length; i++) stray[i].remove();
      var searchWrap = document.getElementById("lt-hub-search-wrap");
      if (searchWrap) searchWrap.remove();
      return;
    }
    grid.classList.add("lt-hub-grid-2col");
    if (!grid.querySelector("[data-lt-tile-injected]")) {
      grid.appendChild(makeTile("budget",   "\uD83D\uDCB3", "Budget Tracker",     "Manage income, expenses and your balance.",         "#FEF3C7", "#B45309", !isPro(), "finance"));
      grid.appendChild(makeTile("emi",      "\uD83E\uDDEE", "EMI Calculator",     "Plan your loans and calculate EMI smartly.",        "#E0E7FF", "#4338CA", false, "finance"));
      grid.appendChild(makeTile("compound", "\uD83D\uDCC8", "Compound Interest",  "See how your money grows when compounding.",         "#FCE7F3", "#BE185D", false, "finance"));
      grid.appendChild(makeTile("gram",     "\uD83D\uDCD6", "Knowledge Gram",     "Track what you learn and grow every day.",           "#D1FAE5", "#047857", false, "productivity"));
      grid.appendChild(makeTile("tasks",    "\u2705",       "My Tasks",           "Organize your tasks and things to do.",              "#DCFCE7", "#15803D", false, "productivity"));
      grid.appendChild(makeTile("routine",  "\uD83D\uDD52", "Routine Trackers",   "Build your daily time table and tick off each slot.", "#E0F2FE", "#0369A1", false, "time"));
      grid.appendChild(makeTile("lifevalue","\u2764\uFE0F", "Life Value",         "Calculate and improve your overall life value.",     "#FEE2E2", "#B91C1C", !isPro(), "time"));
      grid.appendChild(makeTile("opp",      "\u25C6",       "Opportunity Cost",   "See what else your time or money could do.",         "#E0F2FE", "#0369A1", false, "finance"));
      grid.appendChild(makeTile("itemcost", "\uD83D\uDED2", "Item Time Cost Calculator", "See how many hours of work an item really costs.", "#FFEDD5", "#C2410C", false, "finance"));
      grid.appendChild(makeTile("prodscore", "\uD83D\uDCCA", "Productivity Score", "Your 0-100 score for today, from real logged time.", "#EEF2FF", "#4F46E5", false, "productivity"));
      grid.appendChild(makeTile("focus",    "\uD83C\uDFA7", "Focus Mode",         "25-min focus timer with ambient sounds.",             "#ECFDF5", "#059669", false, "time"));
      grid.appendChild(makeTile("wastebudget", "\u26A0\uFE0F", "Time Waste Budget", "Set a daily waste limit and get a red alert.",       "#FEF2F2", "#DC2626", false, "time"));
      grid.appendChild(makeTile("achievements", "\uD83C\uDFC1", "Achievements",   "Milestones and badges you've unlocked.",             "#FFF7ED", "#C2410C", false, "productivity"));
      grid.appendChild(makeTile("bucketlist",   "\uD83C\uDF1F", "Bucket List",    "Your dreams and goals — check them off for life.",   "#F5F3FF", "#6D28D9", false, "productivity"));
      grid.appendChild(makeTile("sixjars",     "\uD83E\uDEB4", "6 Jars",         "Split your salary into 6 purposeful money jars.",    "#F0FDF4", "#166534", false, "finance", "assets/icons/jar-savings.png"));
    }
    restyleNativeTiles(grid);
    ensureLifeHubSearch(grid);
  }

  /* ── Life Hub search + category filter ───────────────────────────────── */

  var LT_HUB_FILTERS = [
    { id: "all",          label: "All" },
    { id: "time",         label: "Time" },
    { id: "finance",      label: "Finance" },
    { id: "productivity", label: "Productivity" }
  ];

  function ensureLifeHubSearch(grid) {
    var wrap = document.getElementById("lt-hub-search-wrap");
    if (wrap) {
      /* React can re-render the page and drop our node from the tree
         even though the id lookup above still finds a detached element
         on some builds — guard by checking it's actually attached. */
      if (wrap.isConnected && grid.parentElement && grid.parentElement.contains(wrap)) {
        applyLifeHubFilter();
        return;
      }
      wrap.remove();
    }
    wrap = document.createElement("div");
    wrap.id = "lt-hub-search-wrap";
    wrap.className = "lt-hub-search-wrap";
    wrap.innerHTML =
      '<div class="lt-hub-search-box">' +
        '<span class="lt-hub-search-icon">\uD83D\uDD0D</span>' +
        '<input id="lt-hub-search-input" class="lt-hub-search-input" type="text" placeholder="Search tools...">' +
        '<button type="button" id="lt-hub-search-clear" class="lt-hub-search-clear" aria-label="Clear search">\u2715</button>' +
      '</div>' +
      '<div class="lt-hub-filter-row" id="lt-hub-filter-row">' +
        LT_HUB_FILTERS.map(function (f) {
          return '<button type="button" class="lt-hub-filter-chip' + (f.id === "all" ? " lt-hub-filter-active" : "") + '" data-cat="' + f.id + '">' + escapeHtml(f.label) + '</button>';
        }).join("") +
      '</div>';
    grid.parentElement.insertBefore(wrap, grid);

    var input = wrap.querySelector("#lt-hub-search-input");
    var clearBtn = wrap.querySelector("#lt-hub-search-clear");
    input.addEventListener("input", applyLifeHubFilter);
    clearBtn.addEventListener("click", function () {
      input.value = "";
      applyLifeHubFilter();
      input.focus();
    });
    Array.prototype.slice.call(wrap.querySelectorAll(".lt-hub-filter-chip")).forEach(function (chip) {
      chip.addEventListener("click", function () {
        Array.prototype.slice.call(wrap.querySelectorAll(".lt-hub-filter-chip")).forEach(function (c) {
          c.classList.remove("lt-hub-filter-active");
        });
        chip.classList.add("lt-hub-filter-active");
        applyLifeHubFilter();
      });
    });
    applyLifeHubFilter();
  }

  function applyLifeHubFilter() {
    var grid = findTileGrid();
    var wrap = document.getElementById("lt-hub-search-wrap");
    if (!grid || !wrap) return;
    var input = wrap.querySelector("#lt-hub-search-input");
    var q = ((input && input.value) || "").trim().toLowerCase();
    var clearBtn = wrap.querySelector("#lt-hub-search-clear");
    if (clearBtn) clearBtn.style.display = q ? "" : "none";
    var activeChip = wrap.querySelector(".lt-hub-filter-active");
    var cat = activeChip ? activeChip.getAttribute("data-cat") : "all";
    var visibleCount = 0;
    Array.prototype.slice.call(grid.children).forEach(function (tile) {
      var text = (tile.textContent || "").toLowerCase();
      var tcat = tile.getAttribute("data-lt-category") || "";
      var matchesQ = !q || text.indexOf(q) !== -1;
      var matchesCat = cat === "all" || tcat === cat;
      var show = matchesQ && matchesCat;
      tile.style.display = show ? "" : "none";
      if (show) visibleCount++;
    });
    var empty = document.getElementById("lt-hub-empty");
    if (!visibleCount) {
      if (!empty) {
        empty = document.createElement("div");
        empty.id = "lt-hub-empty";
        empty.className = "lt-hub-empty";
        empty.textContent = "No tools match your search.";
        grid.parentElement.insertBefore(empty, grid.nextSibling);
      }
    } else if (empty) {
      empty.remove();
    }
  }

  /* ── Overlay management ────────────────────────────────────────────────── */

  function getOverlayRoot() {
    var r = document.getElementById("lt-overlay-root");
    if (!r) {
      r = document.createElement("div");
      r.id = "lt-overlay-root";
      document.documentElement.appendChild(r);
    }
    return r;
  }

  function closeOverlay() {
    var r = document.getElementById("lt-overlay-root");
    if (r) r.remove();
    activeOverlay   = null;
    budgetEditingId = null;
    budgetAddingNew = false;
    gramCurrentId   = null;
    routineEditingId = null;
    if (_routineMidnightTimer) { clearInterval(_routineMidnightTimer); _routineMidnightTimer = null; }
    /* These per-tool background tickers must be killed here, not just left
       to self-detect a missing DOM node — otherwise closing a tool with
       Back (instead of Stop) leaves a 1s interval running forever, and
       opening/closing tools repeatedly stacks these up, causing exactly
       the "everything feels delayed" lag from many timers firing every
       second in the background. */
    if (_wasteBudgetTimer) { clearInterval(_wasteBudgetTimer); _wasteBudgetTimer = null; }
    if (_focusInterval && !(readJson(FOCUS_STATE_KEY, {}).endsAt > Date.now())) {
      /* Only kill the focus ticker if a focus session isn't actually
         still running — an active focus timer should keep counting down
         in the background so it's correct when you come back to it. */
      clearInterval(_focusInterval); _focusInterval = null;
    }
    document.body.style.overflow = "";
    /* Hard safety net: the Knowledge Gram tool forces a solid black
       background on the overlay while open. If that class/style ever
       leaked onto <html>/<body> instead of staying scoped to the
       (now-removed) overlay node, scrub it here so no black background
       can persist over the app after closing. */
    document.documentElement.classList.remove("lt-gram-mode");
    document.body.classList.remove("lt-gram-mode");
    if (document.body.style.background === "#000" || document.body.style.backgroundColor === "#000") {
      document.body.style.background = "";
      document.body.style.backgroundColor = "";
    }
    if (document.documentElement.style.background === "#000" || document.documentElement.style.backgroundColor === "#000") {
      document.documentElement.style.background = "";
      document.documentElement.style.backgroundColor = "";
    }
    /* Achievement slots removed from timer home — no refresh needed */
  }

  function openOverlay(renderer) {
    closeOverlay();
    /* Push a history state so the Android back button fires popstate and
       closes the overlay instead of closing the app or going back in SPA. */
    history.pushState({ ltOverlay: true }, "");
    var root = getOverlayRoot();
    /* Mobile browsers/WebViews sometimes replay a "ghost click" ~300ms
       after the tap that opened this overlay, landing on whatever now
       sits at the same screen coordinates. If that happens to be the
       Tasks FAB (bottom-right, a common spot for a Life Hub tile too),
       the "New Task" sheet appears to open on its own. Tools can check
       this timestamp to ignore clicks that land suspiciously soon after
       opening. */
    root.dataset.openedAt = String(Date.now());
    document.body.style.overflow = "hidden";
    activeOverlay = root;
    root.addEventListener("click", function (e) {
      var action = e.target.closest("[data-lt-action]");
      if (!action) return;
      var name = action.getAttribute("data-lt-action");
      if (name === "close")          { closeOverlay(); }
      if (name === "budget-new")     { budgetEditingId = null; budgetAddingNew = true; renderBudget(); }
      if (name === "budget-edit")    { budgetEditingId = action.getAttribute("data-id"); budgetAddingNew = false; renderBudget(); }
      if (name === "budget-delete")  {
        var items = readJson(BUDGET_KEY, []);
        writeJson(BUDGET_KEY, items.filter(function (i) { return i.id !== action.getAttribute("data-id"); }));
        renderBudget();
      }
      if (name === "budget-cancel")  { budgetEditingId = null; budgetAddingNew = false; renderBudget(); }
      if (name === "emi-again")      { renderEmi(); }
      if (name === "compound-again") { renderCompound(); }
    });
    renderer();
  }

  /* ── Shared helpers ────────────────────────────────────────────────────── */

  function toolHeader(title, description) {
    return (
      '<div class="lt-tool-top">' +
        '<div>' +
          '<p class="lt-tool-kicker">Life Hub</p>' +
          '<h1 class="lt-tool-heading">' + escapeHtml(title) + '</h1>' +
          '<p class="lt-tool-description">' + escapeHtml(description) + '</p>' +
        '</div>' +
        '<button class="lt-tool-close" data-lt-action="close">\u2190 Back</button>' +
      '</div>'
    );
  }

  function field(label, name, value, placeholder, type, size, element) {
    var tag = element === "textarea" ? "textarea" : "input";
    var cls = "lt-field" + (size === "full" ? " full" : "");
    var attrs = 'name="' + name + '" placeholder="' + escapeHtml(placeholder || "") + '"';
    if (tag === "input") attrs += ' type="' + (type || "text") + '" value="' + escapeHtml(value || "") + '"';
    return '<div class="' + cls + '"><label>' + escapeHtml(label) + '</label><' + tag + ' ' + attrs + '>' +
      (tag === "textarea" ? escapeHtml(value || "") : "") + '</' + tag + '></div>';
  }

  /* ── Budget Tracker ────────────────────────────────────────────────────── */

  function budgetItems() {
    var items = readJson(BUDGET_KEY, []);
    return Array.isArray(items) ? items : [];
  }

  function datalistField(label, name, value, placeholder, listId, options) {
    var opts = options.map(function (o) { return '<option value="' + escapeHtml(o) + '">'; }).join("");
    return (
      '<div class="lt-field">' +
        '<label>' + escapeHtml(label) + '</label>' +
        '<input name="' + name + '" list="' + listId + '" value="' + escapeHtml(value || "") + '" placeholder="' + escapeHtml(placeholder) + '">' +
        '<datalist id="' + listId + '">' + opts + '</datalist>' +
      '</div>'
    );
  }

  function renderBudgetForm(item, categories, payments) {
    item = item || {};
    categories = categories || [];
    payments   = payments   || [];
    var isEdit = !!budgetEditingId;
    return (
      '<form class="lt-tool-card" data-lt-budget-form>' +
        '<p class="lt-card-title">' + (isEdit ? "Edit expense" : "New expense") + '</p>' +
        '<p class="lt-card-subtitle">Stored privately on this device only.</p>' +
        '<div class="lt-form-grid">' +
          field("Name", "name", item.name, "e.g. Electricity bill") +
          field("Amount paid (" + getCurrency().symbol + ")", "amount", item.amount, "0", "number") +
          field("Purchase date", "purchaseDate", item.purchaseDate || today(), "", "date") +
          datalistField("Category", "category", item.category, "e.g. Food", "lt-dl-category", categories) +
          datalistField("Payment method", "paymentMethod", item.paymentMethod, "e.g. UPI", "lt-dl-payment", payments) +
          field("Payment details", "paymentDetails", item.paymentDetails, "Bank, UPI app, card") +
          field("Valid until", "validUntil", item.validUntil, "", "date") +
          field("Phone number", "phone", item.phone, "Optional") +
          field("Email", "email", item.email, "Optional", "email") +
          '<label class="lt-check"><input type="checkbox" name="noValidation"' + (item.noValidation ? " checked" : "") + '> No validation</label>' +
          field("Notes", "notes", item.notes, "Optional notes", "text", "full", "textarea") +
        '</div>' +
        '<div class="lt-form-actions">' +
          '<button type="button" class="lt-tool-secondary" data-lt-action="budget-cancel">Cancel</button>' +
          '<button class="lt-tool-primary" type="submit">' + (isEdit ? "Save changes" : "Add expense") + '</button>' +
        '</div>' +
      '</form>'
    );
  }

  function renderBudget() {
    var items = budgetItems();
    var editing = budgetEditingId ? items.find(function (i) { return i.id === budgetEditingId; }) : null;
    var showForm = budgetAddingNew || !!budgetEditingId;

    var filtered = items.filter(function (i) {
      return (!budgetQuery || (i.name + " " + (i.notes || "") + " " + (i.paymentDetails || "")).toLowerCase().indexOf(budgetQuery.toLowerCase()) !== -1) &&
             (!budgetCategory || i.category === budgetCategory) &&
             (!budgetPayment  || i.paymentMethod === budgetPayment);
    });
    var total      = items.reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);
    var month      = new Date().toISOString().slice(0, 7);
    var monthTotal = items.filter(function (i) { return String(i.purchaseDate || "").slice(0, 7) === month; })
                         .reduce(function (s, i) { return s + (Number(i.amount) || 0); }, 0);
    var categories = Array.from(new Set(items.map(function (i) { return i.category; }).filter(Boolean)));
    var payments   = Array.from(new Set(items.map(function (i) { return i.paymentMethod; }).filter(Boolean)));

    var rows = filtered.map(function (i) {
      return '<tr>' +
        '<td><div class="lt-cell-clamp">' + escapeHtml(i.name || "Untitled") + '</div></td>' +
        '<td>' + escapeHtml(money(i.amount)) + '</td>' +
        '<td>' + escapeHtml(formatDate(i.purchaseDate)) + '</td>' +
        '<td><span class="lt-tag">' + escapeHtml(i.category || "Uncategorized") + '</span></td>' +
        '<td><span class="lt-tag blue">' + escapeHtml(i.paymentMethod || "\u2014") + '</span></td>' +
        '<td><div class="lt-cell-clamp">' + escapeHtml(i.paymentDetails || "\u2014") + '</div></td>' +
        '<td>' + escapeHtml(formatDate(i.validUntil)) + '</td>' +
        '<td>' + (i.noValidation ? "\u2713" : "\u2014") + '</td>' +
        '<td>' + escapeHtml(i.phone || "\u2014") + '</td>' +
        '<td>' + escapeHtml(i.email || "\u2014") + '</td>' +
        '<td><div class="lt-cell-clamp">' + escapeHtml(i.notes || "\u2014") + '</div></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="lt-tool-secondary" style="margin-right:6px" data-lt-action="budget-edit" data-id="' + escapeHtml(i.id) + '">Edit</button>' +
          '<button class="lt-tool-danger" data-lt-action="budget-delete" data-id="' + escapeHtml(i.id) + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join("");

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Budget Tracker", "Private expense tracking \u2014 stored only on this device.") +
        '<div class="lt-summary-grid">' +
          '<div class="lt-summary-card"><small>Expenses</small><strong>' + items.length + '</strong></div>' +
          '<div class="lt-summary-card"><small>Total paid</small><strong>' + escapeHtml(money(total)) + '</strong></div>' +
          '<div class="lt-summary-card"><small>This month</small><strong>' + escapeHtml(money(monthTotal)) + '</strong></div>' +
        '</div>' +
        (showForm ? renderBudgetForm(editing || {}, categories, payments) : "") +
        '<div class="lt-budget-actions">' +
          '<input data-lt-budget-search placeholder="Search expenses" value="' + escapeHtml(budgetQuery) + '">' +
          '<select data-lt-budget-category>' +
            '<option value="">All categories</option>' +
            categories.map(function (v) { return '<option' + (budgetCategory === v ? " selected" : "") + '>' + escapeHtml(v) + '</option>'; }).join("") +
          '</select>' +
          '<select data-lt-budget-payment>' +
            '<option value="">All payment methods</option>' +
            payments.map(function (v) { return '<option' + (budgetPayment === v ? " selected" : "") + '>' + escapeHtml(v) + '</option>'; }).join("") +
          '</select>' +
          (!showForm ? '<button class="lt-tool-primary" data-lt-action="budget-new">+ New expense</button>' : "") +
        '</div>' +
        '<div class="lt-table-wrap"><table class="lt-budget-table">' +
          '<thead><tr><th>Name</th><th>Amount</th><th>Date</th><th>Category</th><th>Payment</th><th>Details</th><th>Valid until</th><th>No val.</th><th>Phone</th><th>Email</th><th>Notes</th><th>Actions</th></tr></thead>' +
          '<tbody>' + (rows || '<tr><td colspan="12"><div class="lt-empty">No expenses yet. Tap \u201C+ New expense\u201D to add one.</div></td></tr>') + '</tbody>' +
        '</table></div>' +
      '</div>';

    var search = activeOverlay.querySelector("[data-lt-budget-search]");
    if (search) search.addEventListener("input", function () { budgetQuery = this.value; renderBudget(); });
    var catSel = activeOverlay.querySelector("[data-lt-budget-category]");
    if (catSel) catSel.addEventListener("change", function () { budgetCategory = this.value; renderBudget(); });
    var paySel = activeOverlay.querySelector("[data-lt-budget-payment]");
    if (paySel) paySel.addEventListener("change", function () { budgetPayment = this.value; renderBudget(); });

    var form = activeOverlay.querySelector("[data-lt-budget-form]");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(n) { return ((form.querySelector('[name="' + n + '"]') || {}).value || "").trim(); }
      var name = val("name");
      if (!name) return;
      var entry = {
        id: budgetEditingId || String(Date.now()),
        name: name,
        amount: Number(val("amount")) || 0,
        purchaseDate: val("purchaseDate") || today(),
        category: val("category"),
        paymentMethod: val("paymentMethod"),
        paymentDetails: val("paymentDetails"),
        validUntil: val("validUntil"),
        noValidation: !!((form.querySelector('[name="noValidation"]') || {}).checked),
        phone: val("phone"),
        email: val("email"),
        notes: val("notes"),
        savedAt: new Date().toISOString()
      };
      var saved = budgetItems();
      var idx = saved.findIndex(function (i) { return i.id === entry.id; });
      if (idx === -1) saved.unshift(entry); else saved[idx] = entry;
      writeJson(BUDGET_KEY, saved);
      budgetEditingId = null; budgetAddingNew = false;
      renderBudget();
    });
  }

  /* ── EMI Calculator ────────────────────────────────────────────────────── */

  function renderEmi() {
    var saved = readJson(EMI_KEY, []);
    var d = saved[0] || { principal: "", rate: "", months: "" };
    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("EMI Calculator", "Estimate monthly payments and total interest for a loan.") +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Loan details</p>' +
          '<form data-lt-emi-form>' +
            '<div class="lt-calc-grid">' +
              field("Loan amount (" + getCurrency().symbol + ")", "principal", d.principal, "e.g. 500000", "number") +
              field("Annual interest rate (%)", "rate", d.rate, "e.g. 10.5", "number") +
              field("Tenure (months)", "months", d.months, "e.g. 60", "number") +
            '</div>' +
            '<div class="lt-form-actions"><button class="lt-tool-primary" type="submit">Calculate</button></div>' +
          '</form>' +
        '</div>' +
        '<div data-lt-emi-result class="lt-tool-card lt-empty">Enter loan details above to see your EMI.</div>' +
      '</div>';
    var form = activeOverlay.querySelector("[data-lt-emi-form]");
    var result = activeOverlay.querySelector("[data-lt-emi-result]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(n) { return Number((form.querySelector('[name="' + n + '"]') || {}).value) || 0; }
      var principal = val("principal"), annual = val("rate"), months = val("months");
      if (!principal || !months) { result.textContent = "Please enter loan amount and tenure."; return; }
      var r = annual / 1200;
      var emi = r ? principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1) : principal / months;
      var total = emi * months, interest = total - principal;
      saved.unshift({ principal: principal, rate: annual, months: months, emi: emi, total: total, interest: interest, savedAt: new Date().toISOString() });
      writeJson(EMI_KEY, saved.slice(0, 10));
      result.className = "lt-tool-card";
      result.innerHTML =
        '<div class="lt-calc-result">' +
          '<small>Monthly EMI</small>' +
          '<strong>' + escapeHtml(money(emi)) + '</strong>' +
          '<p>Total: ' + escapeHtml(money(total)) + ' \u00B7 Interest: ' + escapeHtml(money(interest)) + '</p>' +
        '</div>' +
        '<div class="lt-history-row"><span>Loan amount</span><strong>' + escapeHtml(money(principal)) + '</strong></div>' +
        '<div class="lt-history-row"><span>Interest rate</span><strong>' + escapeHtml(annual + "% p.a.") + '</strong></div>' +
        '<div class="lt-history-row"><span>Tenure</span><strong>' + escapeHtml(months + " months") + '</strong></div>';
    });
  }

  /* ── Compound Interest ─────────────────────────────────────────────────── */

  function renderCompound() {
    var saved = readJson(COMPOUND_KEY, []);
    var d = saved[0] || { principal: "", contribution: "", rate: "", years: "", frequency: "12" };
    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Compound Interest", "See how consistent saving grows over time.") +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Savings plan</p>' +
          '<form data-lt-compound-form>' +
            '<div class="lt-calc-grid">' +
              field("Starting amount (" + getCurrency().symbol + ")", "principal", d.principal, "e.g. 10000", "number") +
              field("Monthly contribution (" + getCurrency().symbol + ")", "contribution", d.contribution, "e.g. 5000", "number") +
              field("Annual interest rate (%)", "rate", d.rate, "e.g. 12", "number") +
              field("Years", "years", d.years, "e.g. 10", "number") +
              '<div class="lt-field"><label>Compounds per year</label>' +
                '<select name="frequency">' +
                  '<option value="1"'  + (String(d.frequency) === "1"  ? " selected" : "") + '>Yearly</option>' +
                  '<option value="4"'  + (String(d.frequency) === "4"  ? " selected" : "") + '>Quarterly</option>' +
                  '<option value="12"' + (String(d.frequency) !== "1" && String(d.frequency) !== "4" ? " selected" : "") + '>Monthly</option>' +
                '</select></div>' +
            '</div>' +
            '<div class="lt-form-actions"><button class="lt-tool-primary" type="submit">Calculate</button></div>' +
          '</form>' +
        '</div>' +
        '<div data-lt-compound-result class="lt-tool-card lt-empty">Enter your savings plan above to calculate future value.</div>' +
      '</div>';
    var form = activeOverlay.querySelector("[data-lt-compound-form]");
    var result = activeOverlay.querySelector("[data-lt-compound-result]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(n) { return Number((form.querySelector('[name="' + n + '"]') || {}).value) || 0; }
      var principal = val("principal"), contribution = val("contribution"),
          annual = val("rate"), years = val("years"),
          frequency = Number((form.querySelector('[name="frequency"]') || {}).value) || 12;
      if (!years) { result.textContent = "Please enter the number of years."; return; }
      var periods = years * frequency, r = annual / 100 / frequency;
      var fp = principal * Math.pow(1 + r, periods);
      var fc = r ? (contribution * 12 / frequency) * ((Math.pow(1 + r, periods) - 1) / r) : contribution * 12 * years;
      var future = r ? fp + fc : principal + contribution * 12 * years;
      var invested = principal + contribution * 12 * years;
      var growth = future - invested;
      saved.unshift({ principal: principal, contribution: contribution, rate: annual, years: years, frequency: frequency, future: future, invested: invested, growth: growth, savedAt: new Date().toISOString() });
      writeJson(COMPOUND_KEY, saved.slice(0, 10));
      result.className = "lt-tool-card";
      result.innerHTML =
        '<div class="lt-calc-result">' +
          '<small>Future value after ' + escapeHtml(String(years)) + ' years</small>' +
          '<strong>' + escapeHtml(money(future)) + '</strong>' +
          '<p>Invested: ' + escapeHtml(money(invested)) + ' \u00B7 Growth: ' + escapeHtml(money(growth)) + '</p>' +
        '</div>' +
        '<div class="lt-history-row"><span>Starting amount</span><strong>' + escapeHtml(money(principal)) + '</strong></div>' +
        '<div class="lt-history-row"><span>Monthly contribution</span><strong>' + escapeHtml(money(contribution)) + '</strong></div>' +
        '<div class="lt-history-row"><span>Rate \u00B7 Duration</span><strong>' + escapeHtml(annual + "% \u00B7 " + years + " years") + '</strong></div>';
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * LIFE VALUE
   * Puts a rupee value on the user's 24 hours (based on their own inputs),
   * shows today's categorized activity log, and can subtract the cost of
   * wasted time (Time Waste / Social Media / Entertainment) from that value.
   * Everything reads/writes only to localStorage on this device.
   * ══════════════════════════════════════════════════════════════════════════ */

  /* Life Value never has its own copy of the time-value form — the app
     already has a dedicated "Time Value Calculator" tool in Life Hub
     (native React screen) that writes {salary,hours,days,perMinute} to
     TIMEVALUE_KEY ("lt_time_value_v1"). Life Value only ever reads that
     same key and, if it isn't set yet, sends the user to that tool. */
  function getTimeValue() { return readJson(TIMEVALUE_KEY, null); }

  function goToTimeValueTool() {
    closeOverlay();
    /* This whole hop — close overlay, switch route, wait for Life Hub to
       paint, hunt the DOM for the calculator tile, click it, wait for THAT
       screen to paint — used to happen with nothing covering the screen, so
       the user saw every intermediate frame: the raw native Life Hub grid
       (with its unstyled search box) flash by, then the calculator's own
       native screen flash by before our patches applied to it. Cover the
       whole hop with the nav mask and only lift it once the calculator
       screen is actually up (or we give up trying). */
    showNavMaskWithTimeout(3000);
    _activeSubTab = "timer";
    applySubTabVisibility();

    function findLeaf(text) {
      return Array.prototype.slice.call(document.querySelectorAll("*")).find(function (el) {
        return el.children.length === 0 && el.textContent.trim() === text;
      });
    }
    function clickCalculator(attemptsLeft) {
      var calculator = findLeaf("Time Value Calculator");
      if (calculator) {
        var direct = calculator.closest("button,[role='button'],a");
        if (direct) {
          direct.click();
          /* Give the calculator screen a moment to actually render before
             revealing it, then run a couple of enhancement passes so it's
             fully patched by the time it's shown. */
          setTimeout(function () { runEnhancementsImmediate(); }, 120);
          setTimeout(function () { runEnhancementsImmediate(); hideNavMask(); }, 280);
          return;
        }
      }
      /* Life Hub first shows its tile list. Tapping the Time Value tile
         changes the internal Life Hub view to the calculator screen. */
      var timeTile = findLeaf("Time Value");
      if (timeTile) {
        var tileButton = timeTile.closest("button,[role='button'],a") || timeTile.parentElement;
        if (tileButton) { tileButton.click(); }
      }
      if (attemptsLeft > 0) {
        setTimeout(function () { clickCalculator(attemptsLeft - 1); }, 120);
      } else {
        /* Ran out of attempts — don't leave the mask stuck up forever,
           reveal whatever state we ended up in. */
        hideNavMask();
      }
    }

    var hubLink = document.querySelector('nav a[href="/timeline"]') ||
      Array.prototype.slice.call(document.querySelectorAll("nav a,nav button")).find(function (el) {
        return /^Life Hub$/i.test((el.textContent || "").trim());
      });
    if (location.pathname !== "/timeline" && hubLink) hubLink.click();
    setTimeout(function () { clickCalculator(20); }, 180);
  }

  function renderLifeValueGate() {
    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Life Value", "Required: set up your time value first.") +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Time value not set up yet</p>' +
          '<p class="lt-card-subtitle">Life Value prices your day using the same numbers as the Time Value Calculator tool in Life Hub. Set it up there first, then reopen Life Value.</p>' +
          '<div class="lt-form-actions"><button class="lt-tool-primary" id="lt-lv-goto-tv">Go to Time Value Calculator</button></div>' +
        '</div>' +
      '</div>';
    var goBtn = document.getElementById("lt-lv-goto-tv");
    if (goBtn) goBtn.addEventListener("click", goToTimeValueTool);
  }

  function renderLifeValue() {
    var tv = getTimeValue();
    if (!tv || !Number(tv.perMinute)) { renderLifeValueGate(); return; }

    var perMinute = Number(tv.perMinute);
    var dailyHours = Number(tv.hours) || 8;
    var dayValue = perMinute * 60 * dailyHours; /* the same "/day" figure the Time Value Calculator shows */

    var runningStart = Number(readJson(RUNNING_TIMER_KEY, 0));
    var isRunning = runningStart > 0;
    var liveMinutes = isRunning ? Math.max(0, Math.round((Date.now() - runningStart) / 60000)) : 0;

    var entries = catLogEntries().filter(function (e) { return e.date === today(); });
    var byCat = {};
    entries.forEach(function (e) {
      var cat = e.category;
      if (!byCat[cat]) byCat[cat] = { minutes: 0, items: [] };
      byCat[cat].minutes += (Number(e.minutes) || 0);
      byCat[cat].items.push({ label: (e.label || "").trim(), minutes: Number(e.minutes) || 0 });
    });
    var catNames = Object.keys(byCat).sort(function (a, b) { return byCat[b].minutes - byCat[a].minutes; });

    var wasteMinutes = 0;
    catNames.forEach(function (c) {
      if (WASTE_CATEGORIES.indexOf(c) !== -1) wasteMinutes += byCat[c].minutes;
    });
    var wasteCost = wasteMinutes * perMinute;
    var adjusted = dayValue - wasteCost;

    /* Subtract today's budget spend from the main day value */
    var budgetData = readJson(BUDGET_KEY, []);
    var todayStr = today();
    var todaySpent = 0;
    if (Array.isArray(budgetData)) {
      for (var bi = 0; bi < budgetData.length; bi++) {
        var bitem = budgetData[bi];
        if (String(bitem.purchaseDate || "").slice(0, 10) === todayStr) {
          todaySpent += Number(bitem.amount) || 0;
        }
      }
    }
    var dayValueAdjusted = Math.max(0, dayValue - todaySpent);
    adjusted = Math.max(0, adjusted - todaySpent);

    var liveRow = isRunning
      ? '<div class="lt-lv-row"><span class="lt-lv-row-cat"><span class="lt-lv-dot" style="background:#ff9500"></span>Currently running \u2014 not yet categorized</span><span>' + liveMinutes + ' min so far</span></div>'
      : '';

    var rows = catNames.length
      ? catNames.map(function (c) {
          var mins = byCat[c].minutes;
          var isWaste = WASTE_CATEGORIES.indexOf(c) !== -1;
          var labeledItems = byCat[c].items.filter(function (it) { return it.label || it.reason; });
          var itemsHtml = labeledItems.length
            ? '<div class="lt-lv-items">' + labeledItems.map(function (it) {
                var itemText = it.label || "Activity";
                if (it.reason) itemText += " \u00B7 " + it.reason;
                return '<div class="lt-lv-item"><span>' + escapeHtml(itemText) + '</span><span>' + Math.round(it.minutes) + ' min</span></div>';
              }).join("") + '</div>'
            : "";
          return (
            '<div class="lt-lv-row-wrap">' +
              '<div class="lt-lv-row">' +
                '<span class="lt-lv-row-cat"><span class="lt-lv-dot" style="background:' + (isWaste ? "#ff3b30" : "#34c759") + '"></span>' + escapeHtml(c) + '</span>' +
                '<span>' + mins + ' min \u00b7 ' + escapeHtml(money(mins * perMinute)) + '</span>' +
              '</div>' +
              itemsHtml +
            '</div>'
          );
        }).join("")
      : "";

    var listBody = (liveRow + rows) || '<div class="lt-empty">No activity tagged yet today. Categorize a stopped timer or logged block to see it here.</div>';

    var heroExtra = "";
    if (lifeValueShowCalc === "blocked") {
      heroExtra = '<div class="lt-lv-adjusted"><small>Calculation paused</small><strong style="font-size:15px">Stop your activity to calculate</strong></div>';
    } else if (lifeValueShowCalc === true) {
      heroExtra = wasteMinutes > 0
        ? '<div class="lt-lv-adjusted"><small>After removing wasted time (' + wasteMinutes + ' min)</small><strong>' + escapeHtml(money(adjusted)) + '</strong></div>'
        : '<div class="lt-lv-adjusted"><strong>\uD83C\uDF89 No wasted time logged today</strong></div>';
    }

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Life Value", "The rupee value of your day, based on what you told Life Value.") +
        '<div class="lt-lv-hero">' +
          '<small>Value of your day</small>' +
          '<strong>' + escapeHtml(money(dayValueAdjusted)) + '</strong>' +
          '<p>Based on ' + escapeHtml(money(perMinute)) + '/min \u00b7 ' + dailyHours + ' working hrs/day' +
          (todaySpent > 0 ? ' \u00b7 \u2212' + escapeHtml(money(todaySpent)) + ' spent' : '') + '</p>' +
          heroExtra +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Today\u2019s activity</p>' +
          '<p class="lt-card-subtitle">Tagged automatically when you stop a timer or log a time block.</p>' +
          listBody +
        '</div>' +
        '<div class="lt-form-actions">' +
          '<button class="lt-tool-primary" id="lt-lv-calc">Calculate</button>' +
        '</div>' +
      '</div>';

    var calcBtn = document.getElementById("lt-lv-calc");
    if (calcBtn) calcBtn.addEventListener("click", function () {
      lifeValueShowCalc = isRunning ? "blocked" : true;
      renderLifeValue();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * KNOWLEDGE GRAM
   * Instagram Reels-style vertical scroll through infographics.
   * Likes and comments stored locally in localStorage.
   * ══════════════════════════════════════════════════════════════════════════ */

  function gramIsLiked(id)   { var arr = (GRAM_LIKES_REMOTE && GRAM_LIKES_REMOTE[id]) || []; return arr.indexOf(gramDeviceId()) !== -1; }
  function gramLikeCount(id) { return ((GRAM_LIKES_REMOTE && GRAM_LIKES_REMOTE[id]) || []).length; }
  function gramGetComments(id) { return (GRAM_COMMENTS_REMOTE && GRAM_COMMENTS_REMOTE[id]) || []; }

  function gramToggleLike(id) {
    if (!GRAM_LIKES_REMOTE) GRAM_LIKES_REMOTE = {};
    var arr = (GRAM_LIKES_REMOTE[id] || []).slice();
    var device = gramDeviceId();
    var idx = arr.indexOf(device);
    var nowLiked;
    if (idx === -1) { arr.push(device); nowLiked = true; } else { arr.splice(idx, 1); nowLiked = false; }
    GRAM_LIKES_REMOTE[id] = arr;
    ghPutFile("likes.json", GRAM_LIKES_REMOTE, GRAM_LIKES_SHA, "like " + id, function (ok, newSha) {
      if (ok && newSha) GRAM_LIKES_SHA = newSha;
    });
    return nowLiked;
  }

  function gramAddComment(gramId, text) {
    if (!GRAM_COMMENTS_REMOTE) GRAM_COMMENTS_REMOTE = {};
    if (!GRAM_COMMENTS_REMOTE[gramId]) GRAM_COMMENTS_REMOTE[gramId] = [];
    GRAM_COMMENTS_REMOTE[gramId].push({ id: genId(), text: text, date: new Date().toISOString(), device: gramDeviceId() });
    ghPutFile("comments.json", GRAM_COMMENTS_REMOTE, GRAM_COMMENTS_SHA, "comment " + gramId, function (ok, newSha) {
      if (ok && newSha) GRAM_COMMENTS_SHA = newSha;
    });
  }

  function gramDeleteComment(gramId, commentId) {
    if (!GRAM_COMMENTS_REMOTE || !GRAM_COMMENTS_REMOTE[gramId]) return;
    GRAM_COMMENTS_REMOTE[gramId] = GRAM_COMMENTS_REMOTE[gramId].filter(function (c) { return c.id !== commentId; });
    ghPutFile("comments.json", GRAM_COMMENTS_REMOTE, GRAM_COMMENTS_SHA, "delete comment " + gramId, function (ok, newSha) {
      if (ok && newSha) GRAM_COMMENTS_SHA = newSha;
    });
  }

  function gramRenderCommentList(id) {
    var list = document.getElementById("lt-gram-cp-list");
    if (!list) return;
    var comments = gramGetComments(id);
    if (comments.length === 0) {
      list.innerHTML = '<div class="lt-gram-cp-empty">No comments yet \u2014 be the first!</div>';
      return;
    }
    list.innerHTML = comments.map(function (c) {
      var d = new Date(c.date);
      var ds = isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return (
        '<div class="lt-gram-comment">' +
          '<div class="lt-gram-comment-avatar">Y</div>' +
          '<div class="lt-gram-comment-body">' +
            '<p class="lt-gram-comment-text">' + escapeHtml(c.text) + '</p>' +
            '<span class="lt-gram-comment-date">' + ds + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function gramShowComments(id) {
    gramCurrentId = id;
    var cp = document.getElementById("lt-gram-cp");
    if (!cp) return;
    cp.style.transform = "translateY(0)";
    gramRenderCommentList(id);
    setTimeout(function () {
      var inp = document.getElementById("lt-gram-cp-input");
      if (inp) inp.focus();
    }, 350);
  }

  function gramHideComments() {
    var cp = document.getElementById("lt-gram-cp");
    if (cp) cp.style.transform = "translateY(110%)";
    gramCurrentId = null;
  }

  function gramSubmitComment() {
    if (!gramCurrentId) return;
    var inp = document.getElementById("lt-gram-cp-input");
    if (!inp) return;
    var text = (inp.value || "").trim();
    if (!text) return;
    gramAddComment(gramCurrentId, text);
    inp.value = "";
    gramRenderCommentList(gramCurrentId);
    /* update the comment-count badge on the slide */
    var btn = activeOverlay.querySelector('[data-gram-comment="' + gramCurrentId + '"]');
    if (btn) {
      var count = gramGetComments(gramCurrentId).length;
      var badge = btn.querySelector(".lt-gram-action-count");
      if (badge) badge.textContent = String(count);
    }
  }

  /* ── Watermarking, Save, Share ────────────────────────────────────────
     Every exported copy of a gram image (saved to the device OR shared
     out to another app) goes through this canvas pipeline first, which
     draws the source image then burns a "minutics.com" watermark into
     the actual pixels at the bottom-left corner before ever producing a
     file. Because the watermark is baked into the pixel data itself
     (not an overlay in the DOM), it survives saving, sharing, or any
     further copying of that exported file — there's no version of the
     exported image that doesn't have it. The on-screen <img> itself
     stays completely unmodified (it's just for viewing); only the
     blob handed to Save/Share is watermarked. */
  function gramWatermarkedBlob(imgUrl, callback) {
    var img = new Image();
    img.crossOrigin = "anonymous"; /* required so canvas export isn't tainted by the cross-origin source */
    img.onload = function () {
      try {
        var canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        var text = "minutics.com";
        var fontSize = Math.max(16, Math.round(canvas.width * 0.028));
        ctx.font = "700 " + fontSize + "px Arial, Helvetica, sans-serif";
        var textW = ctx.measureText(text).width;
        var padX = fontSize * 0.55, padY = fontSize * 0.38;
        var pageMargin = Math.max(14, Math.round(canvas.width * 0.025));
        var boxW = textW + padX * 2;
        var boxH = fontSize + padY * 2;
        var boxX = pageMargin;
        var boxY = canvas.height - pageMargin - boxH;
        var r = boxH / 2;

        /* Semi-transparent rounded pill behind the text so it stays
           legible over both light and dark parts of any infographic. */
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.moveTo(boxX + r, boxY);
        ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, r);
        ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, r);
        ctx.arcTo(boxX, boxY + boxH, boxX, boxY, r);
        ctx.arcTo(boxX, boxY, boxX + boxW, boxY, r);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(text, boxX + padX, boxY + boxH / 2 + fontSize * 0.04);

        canvas.toBlob(function (blob) { callback(blob); }, "image/jpeg", 0.92);
      } catch (e) {
        callback(null);
      }
    };
    img.onerror = function () { callback(null); };
    img.src = imgUrl;
  }

  function gramImageUrl(id) {
    return GRAM_BASE + id + ".jpg?v=" + Math.floor(Date.now() / GRAM_CACHE_TTL);
  }

  var GRAM_SHARE_CAPTION = "Check this out on Minutics \u2014 make every minute count! \uD83D\uDCD6\u2728\nhttps://minutics.com";

  function gramSetBtnSaving(btn, saving) {
    if (!btn) return;
    if (saving) btn.classList.add("lt-gram-saving");
    else btn.classList.remove("lt-gram-saving");
  }

  function gramSaveImage(id, btn) {
    gramSetBtnSaving(btn, true);
    gramWatermarkedBlob(gramImageUrl(id), function (blob) {
      gramSetBtnSaving(btn, false);
      if (!blob) { alert("Couldn't save this image. Please try again."); return; }
      var objUrl = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = objUrl;
      a.download = "minutics-" + id + ".jpg";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(objUrl); }, 4000);
    });
  }

  function gramShareImage(id, btn) {
    gramSetBtnSaving(btn, true);
    gramWatermarkedBlob(gramImageUrl(id), function (blob) {
      gramSetBtnSaving(btn, false);

      if (blob && navigator.share && navigator.canShare) {
        var file = new File([blob], "minutics-" + id + ".jpg", { type: "image/jpeg" });
        var canShareFile = false;
        try { canShareFile = navigator.canShare({ files: [file] }); } catch (e) { canShareFile = false; }
        if (canShareFile) {
          navigator.share({ files: [file], title: "Minutics", text: GRAM_SHARE_CAPTION })
            .catch(function () { /* user cancelled — not an error */ });
          return;
        }
      }
      /* Fall back gracefully when the browser/device can't share files
         directly (older Android WebViews, most desktop browsers):
         share (or copy) the caption + link so the person can still post
         it manually, same idea as the "share text" apps like Paytm fall
         back to when a rich share sheet isn't available. */
      if (navigator.share) {
        navigator.share({ title: "Minutics", text: GRAM_SHARE_CAPTION, url: "https://minutics.com" })
          .catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(GRAM_SHARE_CAPTION).then(function () {
          alert("Your browser can't share images directly here, so we copied the caption + minutics.com link to your clipboard \u2014 paste it wherever you're sharing.");
        }).catch(function () { alert(GRAM_SHARE_CAPTION); });
      } else {
        alert(GRAM_SHARE_CAPTION);
      }
    });
  }

  function renderKnowledgeGram() {
    /* Switch overlay to full-screen black mode */
    activeOverlay.classList.add("lt-gram-mode");
    activeOverlay.style.cssText += ";overflow:hidden!important;background:#000!important;";

    var slides = GRAM_IDS.map(function (id) {
      var isLiked      = gramIsLiked(id);
      var likeCount     = gramLikeCount(id);
      var commentCount = gramGetComments(id).length;
      var heartFill    = isLiked ? "#ff3b5c" : "none";
      var heartStroke  = isLiked ? "#ff3b5c" : "#fff";

      return (
        '<div class="lt-gram-slide">' +
          '<img class="lt-gram-img" src="' + GRAM_BASE + id + '.jpg?v=' + Math.floor(Date.now() / GRAM_CACHE_TTL) + '" loading="lazy" decoding="async" alt="Infographic ' + id + '">' +
          '<div class="lt-gram-actions">' +
            /* Like button */
            '<div class="lt-gram-action">' +
              '<button class="lt-gram-action-btn" data-gram-like="' + id + '">' +
                '<svg width="32" height="32" viewBox="0 0 24 24" fill="' + heartFill + '" stroke="' + heartStroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
                '</svg>' +
                (likeCount > 0 ? '<span class="lt-gram-action-count">' + likeCount + '</span>' : '') +
              '</button>' +
            '</div>' +
            /* Comment button */
            '<div class="lt-gram-action">' +
              '<button class="lt-gram-action-btn" data-gram-comment="' + id + '">' +
                '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
                '</svg>' +
                (commentCount > 0 ? '<span class="lt-gram-action-count">' + commentCount + '</span>' : '') +
              '</button>' +
            '</div>' +
            /* Share button */
            '<div class="lt-gram-action">' +
              '<button class="lt-gram-action-btn" data-gram-share="' + id + '">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
            /* Save button */
            '<div class="lt-gram-action">' +
              '<button class="lt-gram-action-btn" data-gram-save="' + id + '">' +
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    activeOverlay.innerHTML = (
      /* Top bar — back + title */
      '<div class="lt-gram-topbar">' +
        '<button class="lt-gram-back-btn" data-lt-action="close">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>' +
        '</button>' +
        '<span class="lt-gram-topbar-title">Knowledge Gram</span>' +
        '<div style="width:40px"></div>' +
      '</div>' +
      /* Feed */
      '<div class="lt-gram-feed" id="lt-gram-feed" style="height:100%;position:absolute;inset:0;">' +
        slides +
      '</div>' +
      /* Comment panel (bottom sheet, starts off-screen) */
      '<div class="lt-gram-cp" id="lt-gram-cp">' +
        '<div class="lt-gram-cp-handle"></div>' +
        '<div class="lt-gram-cp-header">' +
          '<span class="lt-gram-cp-title">Comments</span>' +
          '<button class="lt-gram-cp-close" id="lt-gram-cp-close">\u2715</button>' +
        '</div>' +
        '<div class="lt-gram-cp-list" id="lt-gram-cp-list"></div>' +
        '<div class="lt-gram-cp-input-row">' +
          '<input id="lt-gram-cp-input" class="lt-gram-cp-input" type="text" placeholder="Write a comment\u2026">' +
          '<button id="lt-gram-cp-submit" class="lt-gram-cp-submit">Post</button>' +
        '</div>' +
      '</div>'
    );

    /* Wire events: likes, comments, close panel, submit comment */
    var overlay = activeOverlay;
    overlay.addEventListener("click", function (e) {
      /* Like */
      var likeBtn = e.target.closest("[data-gram-like]");
      if (likeBtn) {
        var id = likeBtn.getAttribute("data-gram-like");
        var nowLiked = gramToggleLike(id);
        var svg = likeBtn.querySelector("svg");
        if (svg) {
          svg.setAttribute("fill",   nowLiked ? "#ff3b5c" : "none");
          svg.setAttribute("stroke", nowLiked ? "#ff3b5c" : "#fff");
        }
        var existingBadge = likeBtn.querySelector(".lt-gram-action-count");
        var count = gramLikeCount(id);
        if (count > 0) {
          if (!existingBadge) {
            existingBadge = document.createElement("span");
            existingBadge.className = "lt-gram-action-count";
            likeBtn.appendChild(existingBadge);
          }
          existingBadge.textContent = String(count);
        } else if (existingBadge) {
          existingBadge.remove();
        }
        return;
      }
      /* Open comments */
      var commentBtn = e.target.closest("[data-gram-comment]");
      if (commentBtn && !e.target.closest("#lt-gram-cp")) {
        gramShowComments(commentBtn.getAttribute("data-gram-comment"));
        return;
      }
      /* Share (watermarked) */
      var shareBtn = e.target.closest("[data-gram-share]");
      if (shareBtn) { gramShareImage(shareBtn.getAttribute("data-gram-share"), shareBtn); return; }
      /* Save to device (watermarked) */
      var saveBtn = e.target.closest("[data-gram-save]");
      if (saveBtn) { gramSaveImage(saveBtn.getAttribute("data-gram-save"), saveBtn); return; }
      /* Close panel */
      if (e.target.id === "lt-gram-cp-close") { gramHideComments(); return; }
      /* Submit comment */
      if (e.target.id === "lt-gram-cp-submit") { gramSubmitComment(); return; }
      /* Delete comment */
      var delBtn = e.target.closest("[data-gram-del]");
      if (delBtn && gramCurrentId) {
        gramDeleteComment(gramCurrentId, delBtn.getAttribute("data-gram-del"));
        gramRenderCommentList(gramCurrentId);
        /* update badge count on slide after deletion */
        var delBadgeBtn = activeOverlay.querySelector('[data-gram-comment="' + gramCurrentId + '"]');
        if (delBadgeBtn) {
          var delCount = gramGetComments(gramCurrentId).length;
          var delBadge = delBadgeBtn.querySelector(".lt-gram-action-count");
          if (delCount > 0) {
            if (delBadge) delBadge.textContent = String(delCount);
            else { var sp = document.createElement('span'); sp.className = 'lt-gram-action-count'; sp.textContent = String(delCount); delBadgeBtn.appendChild(sp); }
          } else {
            if (delBadge) delBadge.parentNode.removeChild(delBadge);
          }
        }
        return;
      }
    });

    /* Enter key submits comment */
    var inp = document.getElementById("lt-gram-cp-input");
    if (inp) inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.keyCode === 13) gramSubmitComment();
    });

    /* Block desktop right-click "Save image as\u2026" on the raw <img> —
       that image has no watermark; Save/Share above are the only paths
       that should ever export a copy, and both always watermark first. */
    overlay.addEventListener("contextmenu", function (e) {
      if (e.target.closest(".lt-gram-img")) e.preventDefault();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
   * MY TASKS — Google Tasks-style
   * All data stored in localStorage. Organized by date sections.
   * ══════════════════════════════════════════════════════════════════════════ */

  function getAllTasks()   { var t = readJson(TASKS_KEY, []); return Array.isArray(t) ? t : []; }

  function upsertTask(task) {
    var tasks = getAllTasks();
    var idx = tasks.findIndex(function (t) { return t.id === task.id; });
    if (idx === -1) tasks.unshift(task); else tasks[idx] = task;
    writeJson(TASKS_KEY, tasks);
  }

  function removeTask(id) {
    writeJson(TASKS_KEY, getAllTasks().filter(function (t) { return t.id !== id; }));
  }

  var MAX_STARRED_TASKS = 3;

  function getStarredTasks() {
    return getAllTasks().filter(function (t) { return !!t.starred; });
  }

  /* Toggling a star is the one place the 3-task cap is enforced — both
     the Tasks app star button and (indirectly, via the same function)
     anything else that stars a task go through here, so the cap can never
     be bypassed.
     When the cap is already hit AND at least one of the 3 starred tasks
     is already completed, starring a new task auto-unstars that finished
     one to make room instead of blocking — a completed frog has already
     been "eaten", so it makes way for the next one automatically. Only
     when all 3 are still active does this return false (and leave the
     task untouched) so the caller can show the "full" warning. */
  function toggleTaskStar(id) {
    var task = getAllTasks().find(function (t) { return t.id === id; });
    if (!task) return true;
    if (!task.starred && getStarredTasks().length >= MAX_STARRED_TASKS) {
      var completedStarred = getStarredTasks().filter(function (t) { return t.completed; });
      if (completedStarred.length) {
        completedStarred[0].starred = false;
        upsertTask(completedStarred[0]);
      } else {
        return false;
      }
    }
    task.starred = !task.starred;
    upsertTask(task);
    return true;
  }

  function sectionFor(task) {
    if (task.completed) return "done";
    if (!task.date && !task.time) return "nodate";
    if (isTaskOverdue(task.date, task.time)) return "overdue";
    var now = new Date(); now.setHours(0,0,0,0);
    var tom = new Date(now); tom.setDate(tom.getDate() + 1);
    var basis = task.date || today();
    var d   = new Date(basis + "T00:00:00");
    if (d.getTime() === now.getTime()) return "today";
    if (d.getTime() === tom.getTime()) return "tomorrow";
    return "upcoming";
  }

  function makeTaskHTML(t) {
    var dl = taskDateLabel(t.date, t.completed, t.time);
    var overdue = !t.completed && isTaskOverdue(t.date, t.time);
    var checkIcon = t.completed
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '';
    var starFill = t.starred ? "#f5a623" : "none";
    var starStroke = t.starred ? "#f5a623" : "currentColor";
    return (
      '<div class="lt-task-item' + (overdue ? ' lt-task-overdue' : '') + '">' +
        '<button class="lt-task-check' + (t.completed ? ' lt-task-checked' : '') + (overdue ? ' lt-task-check-overdue' : '') + '" data-task-toggle="' + t.id + '">' + checkIcon + '</button>' +
        '<div class="lt-task-body">' +
          '<span class="lt-task-title' + (t.completed ? ' lt-task-done' : '') + '">' + escapeHtml(t.title) + '</span>' +
          (dl ? '<span class="lt-task-date' + (overdue ? ' lt-overdue' : '') + '">' + escapeHtml(dl) + '</span>' : '') +
          (t.notes ? '<span class="lt-task-notes">' + escapeHtml(t.notes) + '</span>' : '') +
        '</div>' +
        '<button class="lt-task-star' + (t.starred ? ' lt-task-starred' : '') + '" data-task-star="' + t.id + '" title="' + (t.starred ? "Remove from Eat the Frog" : "Add to Eat the Frog") + '">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + starFill + '" stroke="' + starStroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
        '</button>' +
        '<button class="lt-task-del" data-task-del="' + t.id + '">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>'
    );
  }

  function makeSection(label, colorHex, tasks) {
    if (!tasks.length) return "";
    return (
      '<div class="lt-tasks-section">' +
        '<div class="lt-tasks-section-label" style="color:' + colorHex + '">' + label + '</div>' +
        '<div class="lt-tasks-section-card">' + tasks.map(makeTaskHTML).join("") + '</div>' +
      '</div>'
    );
  }

  /* ── Dropdown time picker (replaces native <input type="time">) ─────────
     Renders a tappable "field" (button) showing the chosen time; tapping
     it opens a small dialog with Hour / Minute / AM-PM dropdowns — pick
     each, then confirm. Value is stored/returned as "HH:MM" 24-hour
     string, same format the rest of the app already expects. */

  function clockFieldHtml(id, value, placeholder) {
    var label = value ? formatRoutineTime(value) : (placeholder || "Select time");
    return (
      '<button type="button" id="' + id + '" class="lt-clock-field' + (value ? '' : ' lt-clock-empty') + '" data-value="' + escapeHtml(value || "") + '">' +
        '<span>' + escapeHtml(label) + '</span><span class="lt-clock-caret">\u25BC</span>' +
      '</button>'
    );
  }

  function clockFieldSetValue(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("data-value", value || "");
    el.classList.toggle("lt-clock-empty", !value);
    var span = el.querySelector("span");
    if (span) span.textContent = value ? formatRoutineTime(value) : "Select time";
  }

  function clockFieldValue(id) {
    var el = document.getElementById(id);
    return el ? (el.getAttribute("data-value") || "") : "";
  }

  var _clockPickerState = null;

  function pad2(n) { n = String(n); return n.length < 2 ? "0" + n : n; }

  function openClockPicker(initialHHMM, onDone) {
    addStyle2 && addStyle2();
    var now = new Date();
    var h24 = 9, mn = 0;
    if (initialHHMM && initialHHMM.indexOf(":") !== -1) {
      var p = initialHHMM.split(":");
      h24 = parseInt(p[0], 10) || 0;
      mn = parseInt(p[1], 10) || 0;
    } else {
      h24 = now.getHours(); mn = Math.round(now.getMinutes() / 5) * 5 % 60;
    }
    _clockPickerState = {
      pm: h24 >= 12,
      hour12: (h24 % 12) === 0 ? 12 : (h24 % 12),
      minute: mn - (mn % 5),
      onDone: onDone
    };
    renderClockPicker();
  }

  function closeClockPicker() {
    var ov = document.getElementById("lt-clockpicker-overlay");
    if (ov) ov.remove();
    _clockPickerState = null;
  }

  function clockPickerTo24() {
    var s = _clockPickerState;
    var h = s.hour12 % 12;
    if (s.pm) h += 12;
    return h;
  }

  function renderClockPicker() {
    var s = _clockPickerState;
    if (!s) return;
    var old = document.getElementById("lt-clockpicker-overlay");
    if (old) old.remove();

    var i;
    var hourOptions = "";
    for (i = 1; i <= 12; i++) {
      hourOptions += '<option value="' + i + '"' + (i === s.hour12 ? " selected" : "") + '>' + i + '</option>';
    }
    var minuteOptions = "";
    for (i = 0; i < 60; i += 5) {
      minuteOptions += '<option value="' + i + '"' + (i === s.minute ? " selected" : "") + '>' + pad2(i) + '</option>';
    }
    var ampmOptions =
      '<option value="am"' + (!s.pm ? " selected" : "") + '>AM</option>' +
      '<option value="pm"' + (s.pm ? " selected" : "") + '>PM</option>';

    var html = (
      '<div id="lt-clockpicker-overlay">' +
        '<div class="lt-clockpicker" role="dialog" aria-label="Select time">' +
          '<div class="lt-clockpicker-title">Select time</div>' +
          '<div class="lt-clockpicker-row">' +
            '<select class="lt-clockpicker-select" data-clocksel="hour" aria-label="Hour">' + hourOptions + '</select>' +
            '<span class="lt-clockpicker-colon">:</span>' +
            '<select class="lt-clockpicker-select" data-clocksel="minute" aria-label="Minute">' + minuteOptions + '</select>' +
            '<select class="lt-clockpicker-select lt-clockpicker-ampm" data-clocksel="ampm" aria-label="AM or PM">' + ampmOptions + '</select>' +
          '</div>' +
          '<div class="lt-clockpicker-actions">' +
            '<button type="button" class="lt-cancel" data-clockaction="cancel">Cancel</button>' +
            '<button type="button" data-clockaction="ok">OK</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    document.documentElement.appendChild(wrap.firstChild);

    var overlay = document.getElementById("lt-clockpicker-overlay");
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) { closeClockPicker(); return; }
      var actionEl = e.target.closest("[data-clockaction]");
      if (actionEl) {
        var action = actionEl.getAttribute("data-clockaction");
        if (action === "ok") {
          var h24 = clockPickerTo24();
          var result = pad2(h24) + ":" + pad2(_clockPickerState.minute);
          var cb = _clockPickerState.onDone;
          closeClockPicker();
          if (cb) cb(result);
        } else {
          closeClockPicker();
        }
      }
    });
    overlay.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-clocksel]");
      if (!sel) return;
      var kind = sel.getAttribute("data-clocksel");
      if (kind === "hour") _clockPickerState.hour12 = parseInt(sel.value, 10);
      else if (kind === "minute") _clockPickerState.minute = parseInt(sel.value, 10);
      else if (kind === "ampm") _clockPickerState.pm = sel.value === "pm";
    });
  }

  /* ── Routine Trackers — data helpers ───────────────────────────────────── */

  function routineItems() {
    var items = readJson(ROUTINE_KEY, []);
    if (!Array.isArray(items)) items = [];
    items.sort(function (a, b) {
      var ta = a.time || "", tb = b.time || "";
      return ta < tb ? -1 : (ta > tb ? 1 : 0);
    });
    return items;
  }

  function upsertRoutine(item) {
    var items = readJson(ROUTINE_KEY, []);
    if (!Array.isArray(items)) items = [];
    var idx = items.findIndex(function (i) { return i.id === item.id; });
    if (idx >= 0) items[idx] = item; else items.push(item);
    writeJson(ROUTINE_KEY, items);
  }

  function removeRoutine(id) {
    var items = readJson(ROUTINE_KEY, []);
    writeJson(ROUTINE_KEY, (items || []).filter(function (i) { return i.id !== id; }));
    /* also drop any stored completion for it so it doesn't linger */
    var state = routineDoneMap();
    if (state.ids[id]) { delete state.ids[id]; writeJson(ROUTINE_DONE_KEY, state); }
  }

  /* Reads today's completion set, auto-resetting it the moment the stored
     date no longer matches the real device date — this is what makes the
     time table "reset every 24 hours at 12:00 AM" without needing a
     separate cron/alarm: any read/write after midnight just starts fresh. */
  function routineDoneMap() {
    var state = readJson(ROUTINE_DONE_KEY, null);
    var t = today();
    if (!state || state.date !== t || typeof state.ids !== "object" || !state.ids) {
      state = { date: t, ids: {} };
      writeJson(ROUTINE_DONE_KEY, state);
    }
    return state;
  }

  function toggleRoutineDone(id) {
    var state = routineDoneMap();
    if (state.ids[id]) delete state.ids[id]; else state.ids[id] = true;
    writeJson(ROUTINE_DONE_KEY, state);
  }

  function formatRoutineTime(hhmm) {
    if (!hhmm) return "No time set";
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10), m = parts[1] || "00";
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ":" + m + " " + suffix;
  }

  function formatRoutineRange(startHHMM, endHHMM) {
    if (!startHHMM && !endHHMM) return "No time set";
    if (startHHMM && endHHMM) return formatRoutineTime(startHHMM) + " \u2013 " + formatRoutineTime(endHHMM);
    return formatRoutineTime(startHHMM || endHHMM);
  }

  /* Time-slot overlap protection — two routines can't claim overlapping
     minutes of the day. Rows with no start/end set are never checked
     (an "anytime" routine doesn't collide with anything). */
  function timeToMin(hhmm) {
    if (!hhmm) return null;
    var p = hhmm.split(":");
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  function findRoutineTimeConflict(startHHMM, endHHMM, excludeId, extraCandidates) {
    var sMin = timeToMin(startHHMM), eMin = timeToMin(endHHMM);
    if (sMin == null || eMin == null) return null; /* nothing to check against */
    if (eMin <= sMin) return { reason: "order" };
    var pool = routineItems().filter(function (i) { return i.id !== excludeId; });
    if (extraCandidates && extraCandidates.length) pool = pool.concat(extraCandidates);
    for (var i = 0; i < pool.length; i++) {
      var it = pool[i];
      var s2 = timeToMin(it.time), e2 = timeToMin(it.endTime);
      if (s2 == null || e2 == null) continue;
      if (sMin < e2 && s2 < eMin) return { reason: "overlap", item: it };
    }
    return null;
  }

  function clockButtonHtml(id, value) {
    var label = value ? formatRoutineTime(value) : "Select time";
    return (
      '<button type="button" id="' + id + '" class="lt-clock-field' + (value ? '' : ' lt-clock-empty') + '" data-value="' + escapeHtml(value || "") + '">' +
        '<span class="lt-clock-icon">\uD83D\uDD52</span><span>' + escapeHtml(label) + '</span><span class="lt-clock-caret">\u25BC</span>' +
      '</button>'
    );
  }

  /* ── "Add multiple in one sheet" draft rows ──────────────────────────────
     Mirrors the WhatsApp-poll "+ Add option" pattern: the New Routine sheet
     starts with one row, and "+ Add another routine" appends another empty
     row to the same sheet so several time slots can be created in one go. */
  var routineDraftRows = null;

  function newRoutineDraftRow() { return { uid: genId(), name: "", time: "", endTime: "" }; }

  function syncRoutineDraftFromDom() {
    if (!routineDraftRows) return;
    routineDraftRows.forEach(function (row) {
      var n = document.getElementById("lt-rdraft-name-" + row.uid);
      if (n) row.name = n.value;
      var t = document.getElementById("lt-rdraft-time-" + row.uid);
      if (t) row.time = t.getAttribute("data-value") || "";
      var et = document.getElementById("lt-rdraft-endtime-" + row.uid);
      if (et) row.endTime = et.getAttribute("data-value") || "";
    });
  }

  function draftRowHtml(row, showRemove) {
    return (
      '<div class="lt-routine-draftrow" data-draft-uid="' + row.uid + '">' +
        (showRemove ? '<button type="button" class="lt-routine-draftrow-remove" data-draft-remove="' + row.uid + '">\u2715</button>' : '') +
        '<input id="lt-rdraft-name-' + row.uid + '" class="lt-routine-name-input" type="text" placeholder="Routine name\u2026" value="' + escapeHtml(row.name || "") + '">' +
        '<div class="lt-routine-sheet-timerow">' +
          '<div class="lt-routine-timefield"><span class="lt-routine-timefield-label">Start</span>' + clockButtonHtml("lt-rdraft-time-" + row.uid, row.time) + '</div>' +
          '<div class="lt-routine-timefield"><span class="lt-routine-timefield-label">End</span>' + clockButtonHtml("lt-rdraft-endtime-" + row.uid, row.endTime) + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderRoutine() {
    activeOverlay.classList.remove("lt-gram-mode");
    activeOverlay.style.overflow = "";
    activeOverlay.style.background = "";

    var items = routineItems();
    var doneState = routineDoneMap();
    var doneCount = Object.keys(doneState.ids).length;
    var isEmpty = items.length === 0;
    var editing = routineEditingId ? items.find(function (i) { return i.id === routineEditingId; }) : null;
    var now = Date.now();

    /* Poll-card look, borrowed from the WhatsApp-poll interaction model:
       each row behaves like a private "I did it / I didn't" tick, not a
       shared vote — only this device's tick state is stored. */
    var listHtml = isEmpty
      ? '<div class="lt-tasks-empty-state">' +
          '<div class="lt-tasks-empty-icon">\uD83D\uDD52</div>' +
          '<p class="lt-tasks-empty-title">No routines yet</p>' +
          '<p class="lt-tasks-empty-sub">Tap \u2795 to build your first time slot</p>' +
        '</div>'
      : '<div class="lt-routine-poll">' +
          '<p class="lt-routine-poll-q">\uD83D\uDD52 Today\u2019s Routine</p>' +
          '<p class="lt-routine-poll-sub">Tap a circle to mark it done \u2014 tap again to undo</p>' +
          items.map(function (item) {
            var done = !!doneState.ids[item.id];
            var gate = item.endTime || item.time;
            var locked = false;
            if (!done && gate) {
              var p = gate.split(":");
              var target = new Date();
              target.setHours(parseInt(p[0], 10), parseInt(p[1], 10) || 0, 0, 0);
              if (now < target.getTime()) locked = true;
            }
            return (
              '<div class="lt-routine-poll-row">' +
                '<button class="lt-routine-poll-tick' + (done ? ' done' : '') + (locked ? ' locked' : '') + '" data-routine-toggle="' + item.id + '">\u2713</button>' +
                '<div class="lt-routine-poll-body" data-routine-edit="' + item.id + '">' +
                  '<p class="lt-routine-poll-name' + (done ? ' done' : '') + '">' + escapeHtml(item.name) + '</p>' +
                  '<p class="lt-routine-poll-time">' + formatRoutineRange(item.time, item.endTime) + '</p>' +
                '</div>' +
                '<span class="lt-routine-poll-edit" data-routine-edit="' + item.id + '">Edit</span>' +
              '</div>'
            );
          }).join("") +
        '</div>';

    var sheetInner;
    if (editing) {
      sheetInner = (
        '<p class="lt-tasks-sheet-title">Edit Routine</p>' +
        '<input id="lt-routine-name" class="lt-routine-name-input" type="text" placeholder="Routine name\u2026" value="' + escapeHtml(editing.name) + '">' +
        '<div class="lt-routine-sheet-timerow">' +
          '<div class="lt-routine-timefield"><span class="lt-routine-timefield-label">Start</span>' + clockButtonHtml("lt-routine-time", editing.time || "") + '</div>' +
          '<div class="lt-routine-timefield"><span class="lt-routine-timefield-label">End</span>' + clockButtonHtml("lt-routine-endtime", editing.endTime || "") + '</div>' +
        '</div>' +
        '<button class="lt-tasks-sheet-submit" id="lt-routine-submit">Save Changes</button>' +
        '<button class="lt-routine-sheet-delete" id="lt-routine-delete">Delete Routine</button>'
      );
    } else {
      if (!routineDraftRows || !routineDraftRows.length) routineDraftRows = [newRoutineDraftRow()];
      var multi = routineDraftRows.length > 1;
      sheetInner = (
        '<p class="lt-tasks-sheet-title">New Routine' + (multi ? 's' : '') + '</p>' +
        '<div class="lt-routine-draftlist">' +
          routineDraftRows.map(function (row) { return draftRowHtml(row, multi); }).join("") +
        '</div>' +
        '<button type="button" class="lt-routine-addanother" id="lt-routine-addanother">+ Add another routine</button>' +
        '<button class="lt-tasks-sheet-submit" id="lt-routine-submit">' + (multi ? ('Create ' + routineDraftRows.length + ' Routines') : 'Add Routine') + '</button>' +
        '<button type="button" class="lt-routine-sheet-done" id="lt-routine-sheetdone">Done</button>'
      );
    }

    activeOverlay.innerHTML = (
      '<div class="lt-tool-shell" style="padding-bottom:110px">' +
        '<div class="lt-tool-top">' +
          '<div>' +
            '<p class="lt-tool-kicker">Life Hub</p>' +
            '<h1 class="lt-tool-heading">Routine Trackers</h1>' +
            '<p class="lt-tool-description">' + (isEmpty ? 'Build your daily time table.' : (doneCount + ' of ' + items.length + ' done today')) + '</p>' +
          '</div>' +
          '<button class="lt-tool-close" data-lt-action="close">\u2190 Back</button>' +
        '</div>' +
        '<p class="lt-routine-resetnote">Ticks reset automatically every day at 12:00 AM \u2014 tick any slot independently, no need to finish the whole table.</p>' +
        listHtml +
        '<button class="lt-tasks-fab" id="lt-routine-fab">+</button>' +
      '</div>' +

      '<div class="lt-tasks-sheet" id="lt-routine-sheet">' +
        '<div class="lt-tasks-sheet-handle"></div>' +
        sheetInner +
      '</div>'
    );

    var overlay = activeOverlay;

    /* Re-check at most once a minute for a date rollover past midnight
       while the tool is left open, so the ticks visibly clear without
       needing to back out and reopen the tool. */
    if (_routineMidnightTimer) clearInterval(_routineMidnightTimer);
    _routineMidnightTimer = setInterval(function () {
      var fresh = readJson(ROUTINE_DONE_KEY, null);
      if (!fresh || fresh.date !== today()) renderRoutine();
    }, 60000);

    if (overlay.dataset.routineWired) return;
    overlay.dataset.routineWired = "1";
    overlay.addEventListener("click", function (e) {
      /* Clock-face field (used by both the single edit form and every
         draft row) — open the picker, write the chosen "HH:MM" straight
         into that field's data-value/label without a full re-render. */
      var clockBtn = e.target.closest(".lt-clock-field");
      if (clockBtn) {
        openClockPicker(clockBtn.getAttribute("data-value") || "", function (newVal) {
          clockFieldSetValue(clockBtn.id, newVal);
        });
        return;
      }

      var toggleBtn = e.target.closest("[data-routine-toggle]");
      if (toggleBtn) {
        var _rid = toggleBtn.getAttribute("data-routine-toggle");
        var _state = routineDoneMap();
        var _alreadyDone = !!_state.ids[_rid];
        if (!_alreadyDone) {
          var _item = routineItems().find(function (i) { return i.id === _rid; });
          var _gate = _item && (_item.endTime || _item.time);
          if (_gate) {
            var _parts = _gate.split(":");
            var _target = new Date();
            _target.setHours(parseInt(_parts[0], 10), parseInt(_parts[1], 10) || 0, 0, 0);
            if (Date.now() < _target.getTime()) {
              var _label = _item.endTime ? ("ends at " + formatRoutineTime(_item.endTime)) : ("starts at " + formatRoutineTime(_item.time));
              alert("You can't tick \"" + _item.name + "\" yet \u2014 it " + _label + ". Come back once that time arrives.");
              return;
            }
          }
        }
        toggleRoutineDone(_rid);
        renderRoutine();
        return;
      }
      var editBody = e.target.closest("[data-routine-edit]");
      if (editBody) {
        routineEditingId = editBody.getAttribute("data-routine-edit");
        routineDraftRows = null;
        renderRoutine();
        var s2 = document.getElementById("lt-routine-sheet");
        if (s2) s2.style.transform = "translateY(0)";
        return;
      }
      if (e.target.id === "lt-routine-fab") {
        if (Date.now() - Number(overlay.dataset.openedAt || 0) < 400) return;
        routineEditingId = null;
        routineDraftRows = [newRoutineDraftRow()];
        renderRoutine();
        var s3 = document.getElementById("lt-routine-sheet");
        if (s3) s3.style.transform = "translateY(0)";
        setTimeout(function () { var n = document.getElementById("lt-rdraft-name-" + routineDraftRows[0].uid); if (n) n.focus(); }, 100);
        return;
      }
      if (e.target.id === "lt-routine-addanother") {
        syncRoutineDraftFromDom();
        routineDraftRows.push(newRoutineDraftRow());
        renderRoutine();
        var sAdd = document.getElementById("lt-routine-sheet");
        if (sAdd) sAdd.style.transform = "translateY(0)";
        var lastRow = routineDraftRows[routineDraftRows.length - 1];
        setTimeout(function () { var n = document.getElementById("lt-rdraft-name-" + lastRow.uid); if (n) n.focus(); }, 50);
        return;
      }
      var removeBtn = e.target.closest("[data-draft-remove]");
      if (removeBtn) {
        syncRoutineDraftFromDom();
        var rmUid = removeBtn.getAttribute("data-draft-remove");
        routineDraftRows = routineDraftRows.filter(function (r) { return r.uid !== rmUid; });
        if (!routineDraftRows.length) routineDraftRows = [newRoutineDraftRow()];
        renderRoutine();
        var sRm = document.getElementById("lt-routine-sheet");
        if (sRm) sRm.style.transform = "translateY(0)";
        return;
      }
      if (e.target.id === "lt-routine-submit") {
        var editingNow = routineEditingId ? routineItems().find(function (i) { return i.id === routineEditingId; }) : null;
        if (editingNow) {
          var nameEl = document.getElementById("lt-routine-name");
          if (!nameEl) return;
          var name = (nameEl.value || "").trim();
          if (!name) { nameEl.focus(); return; }
          var timeVal = clockFieldValue("lt-routine-time");
          var endTimeVal = clockFieldValue("lt-routine-endtime");
          var conflict = findRoutineTimeConflict(timeVal, endTimeVal, routineEditingId, null);
          if (conflict) {
            if (conflict.reason === "order") { alert("End time must be after the start time."); }
            else { alert('"' + name + '" overlaps with "' + conflict.item.name + '" (' + formatRoutineRange(conflict.item.time, conflict.item.endTime) + '). Two routines can\'t share the same time slot.'); }
            return;
          }
          upsertRoutine({
            id: routineEditingId,
            name: name,
            time: timeVal,
            endTime: endTimeVal,
            createdAt: editingNow.createdAt || new Date().toISOString()
          });
          routineEditingId = null;
          renderRoutine();
          return;
        }

        syncRoutineDraftFromDom();
        var validRows = routineDraftRows.filter(function (r) { return (r.name || "").trim() !== "" || r.time || r.endTime; });
        if (!validRows.length) {
          var firstInput = document.getElementById("lt-rdraft-name-" + routineDraftRows[0].uid);
          if (firstInput) firstInput.focus();
          return;
        }
        for (var i = 0; i < validRows.length; i++) {
          var row = validRows[i];
          var rname = (row.name || "").trim();
          if (!rname) { alert("Please give every routine a name before saving (row " + (i + 1) + " is blank)."); return; }
          var others = validRows.slice(0, i).concat(validRows.slice(i + 1));
          var rowConflict = findRoutineTimeConflict(row.time, row.endTime, null, others);
          if (rowConflict) {
            if (rowConflict.reason === "order") { alert('"' + rname + '": end time must be after the start time.'); }
            else { alert('"' + rname + '" overlaps with "' + rowConflict.item.name + '" (' + formatRoutineRange(rowConflict.item.time, rowConflict.item.endTime) + '). Two routines can\'t share the same time slot.'); }
            return;
          }
        }
        validRows.forEach(function (row) {
          upsertRoutine({
            id: genId(),
            name: (row.name || "").trim(),
            time: row.time || "",
            endTime: row.endTime || "",
            createdAt: new Date().toISOString()
          });
        });
        routineDraftRows = null;
        renderRoutine();
        return;
      }
      if (e.target.id === "lt-routine-delete") {
        if (routineEditingId) removeRoutine(routineEditingId);
        routineEditingId = null;
        renderRoutine();
        return;
      }
      if (e.target.id === "lt-routine-sheetdone") {
        routineDraftRows = null;
        routineEditingId = null;
        var sDone = document.getElementById("lt-routine-sheet");
        if (sDone) sDone.style.transform = "translateY(110%)";
        return;
      }
      var sheet2 = document.getElementById("lt-routine-sheet");
      if (sheet2 && (sheet2.style.transform === "translateY(0px)" || sheet2.style.transform === "translateY(0)")) {
        if (!e.target.closest("#lt-routine-sheet")) {
          sheet2.style.transform = "translateY(110%)";
          routineEditingId = null;
          routineDraftRows = null;
        }
      }
    });

    overlay.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.keyCode === 13) && e.target && e.target.tagName === "INPUT" && e.target.closest("#lt-routine-sheet")) {
        e.preventDefault();
        var submitBtn = document.getElementById("lt-routine-submit");
        if (submitBtn) submitBtn.click();
      }
    });
  }


  function renderTasks() {
    /* Restore default overlay scroll */
    activeOverlay.classList.remove("lt-gram-mode");
    activeOverlay.style.overflow = "";
    activeOverlay.style.background = "";

    var all = getAllTasks();
    var buckets = { overdue:[], today:[], tomorrow:[], upcoming:[], nodate:[], done:[] };
    all.forEach(function (t) { buckets[sectionFor(t)].push(t); });
    /* sort upcoming by date */
    buckets.upcoming.sort(function (a, b) { return (a.date || "") < (b.date || "") ? -1 : 1; });

    var active = all.filter(function (t) { return !t.completed; }).length;
    var isEmpty = all.length === 0;

    var doneHtml = "";
    if (buckets.done.length) {
      doneHtml = (
        '<div class="lt-tasks-section">' +
          '<button class="lt-tasks-completed-toggle" id="lt-tasks-done-toggle">' +
            '<span>Completed (' + buckets.done.length + ')</span>' +
            '<span id="lt-done-arrow" style="font-size:10px">\u25BC</span>' +
          '</button>' +
          '<div id="lt-tasks-done-list">' +
            '<div class="lt-tasks-section-card">' + buckets.done.map(makeTaskHTML).join("") + '</div>' +
          '</div>' +
        '</div>'
      );
    }

    activeOverlay.innerHTML = (
      '<div class="lt-tool-shell" style="padding-bottom:110px">' +
        '<div class="lt-tool-top">' +
          '<div>' +
            '<p class="lt-tool-kicker">Life Hub</p>' +
            '<h1 class="lt-tool-heading">My Tasks</h1>' +
            '<p class="lt-tool-description">' + (active ? active + ' task' + (active === 1 ? '' : 's') + ' remaining' : 'All done!') + '</p>' +
          '</div>' +
          '<button class="lt-tool-close" data-lt-action="close">\u2190 Back</button>' +
        '</div>' +

        (isEmpty
          ? '<div class="lt-tasks-empty-state">' +
              '<div class="lt-tasks-empty-icon">\u2713</div>' +
              '<p class="lt-tasks-empty-title">No tasks yet</p>' +
              '<p class="lt-tasks-empty-sub">Tap \u2795 to add your first task</p>' +
            '</div>'
          : '') +

        makeSection("MISSED",   "#ff3b30", buckets.overdue) +
        makeSection("TODAY",     "#007aff", buckets.today) +
        makeSection("TOMORROW",  "#34c759", buckets.tomorrow) +
        makeSection("UPCOMING",  "#ff9500", buckets.upcoming) +
        makeSection("NO DATE",   "#8e8e93", buckets.nodate) +
        doneHtml +

        /* FAB */
        '<button class="lt-tasks-fab" id="lt-tasks-fab">+</button>' +
      '</div>' +

      /* Add-task bottom sheet (slides up over the list) */
      '<div class="lt-tasks-sheet" id="lt-tasks-sheet">' +
        '<div class="lt-tasks-sheet-handle"></div>' +
        '<p class="lt-tasks-sheet-title">New Task</p>' +
        '<input id="lt-task-name" class="lt-tasks-sheet-main" type="text" placeholder="Task name\u2026">' +
        '<div class="lt-sheet-group" id="lt-task-deadline-group">' +
          '<div class="lt-sheet-group-title"><span>Deadline</span><button type="button" class="lt-sheet-group-clear" id="lt-task-deadline-clear">Clear</button></div>' +
          '<div class="lt-tasks-sheet-row">' +
            '<span class="lt-tasks-sheet-row-label">Day</span>' +
            '<input id="lt-task-date" class="lt-tasks-sheet-date" type="date" value="">' +
          '</div>' +
          '<div class="lt-tasks-sheet-row">' +
            '<span class="lt-tasks-sheet-row-label">Time</span>' +
            clockButtonHtml("lt-task-time", "") +
          '</div>' +
        '</div>' +
        '<p class="lt-sheet-group-hint">Both optional \u2014 day + time is an exact deadline, time alone means today, day alone means before that day starts.</p>' +
        '<div class="lt-tasks-sheet-row" style="border-top:none;padding-top:0">' +
          '<input id="lt-task-notes" class="lt-tasks-sheet-notes" type="text" placeholder="Optional notes\u2026">' +
        '</div>' +
        '<button class="lt-tasks-sheet-submit" id="lt-task-submit">Add Task</button>' +
      '</div>'
    );

    /* Wire overlay events — attach ONCE per overlay open, not on every
       re-render, or clicks stack up (a tap toggles twice = looks like
       nothing happened) and deletes fire repeatedly. */
    var overlay = activeOverlay;
    if (overlay.dataset.tasksWired) return;
    overlay.dataset.tasksWired = "1";
    overlay.addEventListener("click", function (e) {
      /* Clock-face time picker for the Task sheet's Time field */
      var taskClockBtn = e.target.closest(".lt-clock-field");
      if (taskClockBtn) {
        openClockPicker(taskClockBtn.getAttribute("data-value") || "", function (newVal) {
          clockFieldSetValue(taskClockBtn.id, newVal);
        });
        return;
      }
      /* Clear the whole optional Deadline group (day + time) in one tap */
      if (e.target.id === "lt-task-deadline-clear") {
        var dEl = document.getElementById("lt-task-date");
        if (dEl) dEl.value = "";
        clockFieldSetValue("lt-task-time", "");
        return;
      }
      /* Toggle completion */
      var toggleBtn = e.target.closest("[data-task-toggle]");
      if (toggleBtn) {
        var id = toggleBtn.getAttribute("data-task-toggle");
        var task = getAllTasks().find(function (t) { return t.id === id; });
        if (task) { task.completed = !task.completed; upsertTask(task); renderTasks(); }
        return;
      }
      /* Star (add/remove from Eat the Frog, max 3) */
      var starBtn = e.target.closest("[data-task-star]");
      if (starBtn) {
        var starId = starBtn.getAttribute("data-task-star");
        var ok = toggleTaskStar(starId);
        if (!ok) {
          showSimpleToast("Eat the Frog is full", "Only 3 tasks can be starred at once — unstar one first.");
        }
        renderTasks();
        return;
      }
      /* Delete */
      var delBtn = e.target.closest("[data-task-del]");
      if (delBtn) {
        if (e.target.closest("#lt-tasks-sheet")) return; /* don't trigger inside sheet */
        removeTask(delBtn.getAttribute("data-task-del"));
        renderTasks();
        return;
      }
      /* FAB */
      if (e.target.id === "lt-tasks-fab") {
        /* Guard against the ghost-click-on-open issue described in
           openOverlay() above — ignore a tap on the FAB that lands within
           400ms of this tool having opened. */
        if (Date.now() - Number(overlay.dataset.openedAt || 0) < 400) return;
        var sheet = document.getElementById("lt-tasks-sheet");
        if (sheet) sheet.style.transform = "translateY(0)";
        setTimeout(function () { var n = document.getElementById("lt-task-name"); if (n) n.focus(); }, 100);
        return;
      }
      /* Submit */
      if (e.target.id === "lt-task-submit") {
        var nameEl = document.getElementById("lt-task-name");
        if (!nameEl) return;
        var title = (nameEl.value || "").trim();
        if (!title) { nameEl.focus(); return; }
        var dateEl  = document.getElementById("lt-task-date");
        var taskTimeVal = clockFieldValue("lt-task-time");
        var notesEl = document.getElementById("lt-task-notes");
        upsertTask({
          id: genId(), title: title,
          date:  (dateEl && dateEl.value) ? dateEl.value : null,
          time:  taskTimeVal || null,
          notes: (notesEl && notesEl.value.trim()) || "",
          completed: false,
          createdAt: new Date().toISOString()
        });
        renderTasks(); /* re-renders with new task and closes sheet */
        return;
      }
      /* Collapse/expand completed */
      if (e.target.closest("#lt-tasks-done-toggle")) {
        var doneList = document.getElementById("lt-tasks-done-list");
        var arrow    = document.getElementById("lt-done-arrow");
        if (doneList) {
          var hidden = doneList.style.display === "none";
          doneList.style.display = hidden ? "" : "none";
          if (arrow) arrow.textContent = hidden ? "\u25BC" : "\u25B6";
        }
        return;
      }
      /* Tap outside sheet closes it */
      var sheet = document.getElementById("lt-tasks-sheet");
      if (sheet && sheet.style.transform === "translateY(0px)" || (sheet && sheet.style.transform === "translateY(0)")) {
        if (!e.target.closest("#lt-tasks-sheet")) {
          sheet.style.transform = "translateY(110%)";
        }
      }
    });

    /* Enter key submits from name field */
    var nameInput = document.getElementById("lt-task-name");
    if (nameInput) nameInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.keyCode === 13) {
        var submitBtn = document.getElementById("lt-task-submit");
        if (submitBtn) submitBtn.click();
      }
    });
  }

  /* ── Free-plan activity cap ────────────────────────────────────────────── */
  var LOCAL_DB_KEY = "lifetime_local_db_v1";
  var DEFAULT_ACTIVITIES_SEEDED_KEY = "lt_default_activities_seeded_v2";
  var ACTIVITY_COLORS = ["#1B1F3B","#00897B","#D97706","#7C3AED","#1D4ED8","#BE185D","#15803D","#B91C1C"];

  /* Seed the app's common default activities on first run. Defaults remain
     available, but the Free-plan allowance applies to activities the user
     adds themselves. */
  var COMMUTE_RENAMED_KEY = "lt_commute_renamed_v1";
  function renameCommuteToTravelling() {
    if (readJson(COMMUTE_RENAMED_KEY, false)) return;
    var db = readJson(LOCAL_DB_KEY, { activities: [], blocks: [] });
    if (Array.isArray(db.activities)) {
      var changed = false;
      db.activities.forEach(function (a) {
        if (a && typeof a.name === "string" && a.name.trim().toLowerCase() === "commute") {
          a.name = "Travelling";
          changed = true;
        }
      });
      if (changed) writeJson(LOCAL_DB_KEY, db);
    }
    writeJson(COMMUTE_RENAMED_KEY, true);
  }

  function seedDefaultActivities() {
    renameCommuteToTravelling();
    /* Migration v2: remove the 3 extra auto-seeded defaults no longer in the set */
    var EXTRAS_REMOVED_KEY = "lt_extra_defaults_removed_v1";
    if (!readJson(EXTRAS_REMOVED_KEY, false)) {
      var dbMig = readJson(LOCAL_DB_KEY, { activities: [], blocks: [] });
      if (Array.isArray(dbMig.activities)) {
        var removeNames = ["travelling", "social media", "family time"];
        var before = dbMig.activities.length;
        dbMig.activities = dbMig.activities.filter(function (a) {
          return !(a.isDefault && removeNames.indexOf((a.name || "").trim().toLowerCase()) !== -1);
        });
        if (dbMig.activities.length !== before) writeJson(LOCAL_DB_KEY, dbMig);
      }
      writeJson(EXTRAS_REMOVED_KEY, true);
    }
    if (readJson(DEFAULT_ACTIVITIES_SEEDED_KEY, false)) return;
    var db = readJson(LOCAL_DB_KEY, { activities: [], blocks: [] });
    if (!Array.isArray(db.activities)) db.activities = [];
    if (!Array.isArray(db.blocks)) db.blocks = [];

    var defaults = [
      { name: "Work",         emoji: "\uD83D\uDCBC" },
      { name: "Sleep",        emoji: "\uD83D\uDE34" },
      { name: "Time Waste",   emoji: "\u23F3" },
      { name: "Exercise",     emoji: "\uD83C\uDFCB\uFE0F" },
      { name: "Eating",       emoji: "\uD83C\uDF7D\uFE0F" },
    ];

    var existingNames = {};
    db.activities.forEach(function (a) {
      existingNames[(a.name || "").trim().toLowerCase()] = true;
    });

    var nextId = Math.max(0, Math.max.apply(null, db.activities.map(function (a) { return a.id || 0; }).concat([0]))) + 1;
    var added = false;
    defaults.forEach(function (d, idx) {
      if (existingNames[d.name.toLowerCase()]) return; /* don't duplicate an activity the user already has */
      db.activities.push({
        id: nextId++,
        name: d.name,
        color: ACTIVITY_COLORS[idx % ACTIVITY_COLORS.length],
        emoji: d.emoji,
        isDefault: true,
      });
      added = true;
    });

    if (added) writeJson(LOCAL_DB_KEY, db);
    writeJson(DEFAULT_ACTIVITIES_SEEDED_KEY, true);
  }



  function currentActivityCount() {
    var db = readJson(LOCAL_DB_KEY, { activities: [] });
    return Array.isArray(db.activities) ? db.activities.length : 0;
  }

  /* Live count of activities that actually show in the list (excludes
     soft-deleted/archived ones) — the real number to compare against
     FREE_ACTIVITY_LIMIT when enforcing the downgrade grace period. */
  function nonArchivedActivityCount() {
    var db = readJson(LOCAL_DB_KEY, { activities: [] });
    if (!Array.isArray(db.activities)) return 0;
    return db.activities.filter(function (a) { return !a.archived; }).length;
  }

  /* Returns null if no warning should show, otherwise
     { daysLeft: <1-3> } for the downgrade banner. */
  function downgradeGraceStatus() {
    if (isPro()) return null;
    var downgradeAt = readJson(DOWNGRADE_AT_KEY, null);
    if (!downgradeAt) return null;
    if (nonArchivedActivityCount() <= FREE_ACTIVITY_LIMIT) return null;
    var msLeft = ACTIVITY_GRACE_MS - (Date.now() - downgradeAt);
    if (msLeft <= 0) return null; /* about to be/just been trimmed */
    return { daysLeft: Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000))) };
  }

  /* Soft-deletes random extra activities (same as the user's own "Remove"
     action — tracked time stays in the Journal) until the count is back
     down to FREE_ACTIVITY_LIMIT. */
  function trimActivitiesToLimit() {
    var db = readJson(LOCAL_DB_KEY, { activities: [] });
    if (!Array.isArray(db.activities)) return;
    var active = db.activities.filter(function (a) { return !a.archived; });
    var toRemove = active.length - FREE_ACTIVITY_LIMIT;
    while (toRemove > 0 && active.length > 0) {
      var idx = Math.floor(Math.random() * active.length);
      active.splice(idx, 1)[0].archived = true;
      toRemove--;
    }
    writeJson(LOCAL_DB_KEY, db);
  }

  /* Called on every enhancement pass (app open, tab switches, ~1.5s tick)
     so the trim happens automatically even if the user never opens the
     Activity tab again after downgrading. */
  function enforceActivityGraceIfNeeded() {
    if (isPro()) {
      if (readJson(DOWNGRADE_AT_KEY, null)) writeJson(DOWNGRADE_AT_KEY, null);
      return;
    }
    var downgradeAt = readJson(DOWNGRADE_AT_KEY, null);
    if (!downgradeAt) return;
    if (nonArchivedActivityCount() <= FREE_ACTIVITY_LIMIT) {
      writeJson(DOWNGRADE_AT_KEY, null);
      return;
    }
    if (Date.now() - downgradeAt >= ACTIVITY_GRACE_MS) {
      trimActivitiesToLimit();
      writeJson(DOWNGRADE_AT_KEY, null);
    }
  }

  function userActivityCount() {
    /* Count directly from DOM — always live, no storage lag after add/delete */
    var act = findActivityElements();
    if (act && act.list) {
      /* The native app renders each activity as a child element of the list container */
      var children = act.list.children;
      if (children && children.length > 0) return children.length;
    }
    /* Fallback: storage count (non-default activities only) */
    var db = readJson(LOCAL_DB_KEY, { activities: [] });
    if (!Array.isArray(db.activities)) return 0;
    return db.activities.filter(function (a) { return !a.isDefault; }).length;
  }

  function updateActivityLimitBadge() {
    if (_activeSubTab !== "activity") {
      var b = document.getElementById("lt-activity-limit");
      if (b) b.remove();
      return;
    }
    var act = findActivityElements();
    if (!act || !act.addRow) return;
    var host = act.addRow.parentElement;
    if (!host) return;
    var badge = document.getElementById("lt-activity-limit");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "lt-activity-limit";
      badge.setAttribute("data-lt-enhancement", "1");
      badge.style.cssText = "padding:8px 16px 7px;background:#fff;color:hsl(var(--muted-foreground));font-size:12px;font-weight:700;text-align:right;border-top:1px solid hsl(var(--border));";
    }
    /* Always re-assert position — the app's own re-renders can replace addRow
       and leave the badge stranded at its old spot, so this must run every call. */
    if (badge.previousElementSibling !== act.addRow || badge.parentElement !== host) {
      host.insertBefore(badge, act.addRow.nextSibling);
    }
    if (isPro()) {
      badge.textContent = "Pro \u00B7 Unlimited activities";
      badge.style.color = "hsl(var(--primary))";
    } else {
      var userCount = userActivityCount();
      badge.textContent = "Free plan \u00B7 " + userCount + "/" + FREE_ACTIVITY_LIMIT + " activities added";
      badge.style.color = userCount >= FREE_ACTIVITY_LIMIT ? "#c0392b" : "hsl(var(--muted-foreground))";
    }
  }

  document.addEventListener("click", function (e) {
    if (isPro()) return;
    var input = document.querySelector('input[placeholder="New activity..."]');
    if (!input) return;
    var addBtn = e.target.closest("button");
    if (!addBtn || addBtn.textContent.trim().indexOf("Add") !== 0) return;
    /* Only guard the Add-activity button, not other "Add" buttons elsewhere in the app */
    var wrap = input.closest("div");
    if (!wrap || !wrap.contains(addBtn)) return;
    if (userActivityCount() >= FREE_ACTIVITY_LIMIT) {
      e.preventDefault();
      e.stopPropagation();
      showUpgradePrompt("You can't add more than " + FREE_ACTIVITY_LIMIT + " activities on the Free plan. Remove an activity or upgrade to Pro.");
    }
  }, true);

  /* ── Click routing ─────────────────────────────────────────────────────── */

  document.addEventListener("click", function (e) {
    var tile = e.target.closest("[data-lifetime-tool]");
    if (!tile) return;
    e.preventDefault();
    e.stopPropagation();
    var tool = tile.getAttribute("data-lifetime-tool");
    if (tool === "budget" && !isPro()) { showUpgradePrompt("Budget Tracker is a Pro feature."); return; }
    if (tool === "budget")   openOverlay(renderBudget);
    if (tool === "emi")      openOverlay(renderEmi);
    if (tool === "compound") openOverlay(renderCompound);
    if (tool === "gram")     { gramLoadIds(function () { gramSyncRemote(function () { openOverlay(renderKnowledgeGram); }); }); return; }
    if (tool === "tasks")    openOverlay(renderTasks);
    if (tool === "routine")  openOverlay(renderRoutine);
    if (tool === "lifevalue") {
      if (!isPro()) { showUpgradePrompt("Life Value is a Pro feature."); return; }
      lifeValueShowCalc = false; openOverlay(renderLifeValue);
    }
    if (tool === "opp")       openOverlay(renderOpportunity);
    if (tool === "itemcost")  openOverlay(renderItemCost);
    if (tool === "prodscore") openOverlay(renderProductivityScore);
    if (tool === "focus")     openOverlay(renderFocusMode);
    if (tool === "wastebudget") openOverlay(renderWasteBudget);
    if (tool === "achievements") openOverlay(renderAchievements);
    if (tool === "bucketlist")   openOverlay(renderBucketList);
    if (tool === "sixjars")   openOverlay(renderSixJars);
  }, true);

  /* ── Upgrade prompt (shown when a free-plan user hits a gated feature) ── */
  function showUpgradePrompt(message) {
    addStyle3();
    var existing = document.getElementById("lt-upgrade-modal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "lt-upgrade-modal";
    modal.style.cssText = "position:fixed;inset:0;z-index:999998;background:rgba(20,24,45,.55);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif;";
    var isActivityLimit = /activities/i.test(message || "");
    modal.innerHTML =
      '<div style="width:100%;max-width:320px;background:#fff;border:1px solid hsl(220 13% 88%);padding:26px;text-align:center">' +
        '<div style="font-size:30px;margin-bottom:10px;color:' + (isActivityLimit ? "#d94264" : "hsl(230 40% 16%)") + '">' + (isActivityLimit ? "\u00D7" : "\u2B50") + '</div>' +
        '<p style="color:hsl(230 40% 16%);font-size:16px;font-weight:800;margin:0 0 6px">' + (isActivityLimit ? "Limit reached" : "Pro feature") + '</p>' +
        '<p style="color:hsl(220 10% 45%);font-size:13px;margin:0 0 20px;line-height:1.4">' + escapeHtml(message || "This is a Pro feature.") + '</p>' +
        '<button id="lt-upgrade-cta" style="width:100%;background:hsl(230 40% 16%);border:none;color:#fff;padding:13px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;font-family:inherit">View Plans</button>' +
        '<button id="lt-upgrade-close" style="width:100%;background:#fff;border:1px solid hsl(220 13% 85%);color:hsl(220 10% 40%);padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Not now</button>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    document.getElementById("lt-upgrade-close").addEventListener("click", function () { modal.remove(); });
    document.getElementById("lt-upgrade-cta").addEventListener("click", function () {
      modal.remove();
      showPlansScreen();
    });
  }

  /* ── Detect the app's own Start timer / Log block / Stop timer actions ──
     We never call preventDefault here, so the original app's own handler
     always runs normally — we only observe and layer our own UI on top.
     These rows are plain divs (not <button>), so we walk a few ancestor
     levels from the click looking for the smallest element whose text
     matches — not just real button/role/a tags. */

  function ancestorTextMatch(target, needle, maxDepth) {
    var cur = target, depth = 0;
    while (cur && depth < maxDepth) {
      var t = (cur.textContent || "").trim();
      if (t.indexOf(needle) !== -1 && t.length <= needle.length + 90) return cur;
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }

  /* The native action-sheet component renders a description paragraph even
     when its description prop is empty. On some WebView renders that empty
     paragraph collapses completely, making the same action look different
     depending on how the sheet was opened. Keep the four activity actions
     consistent without changing the native click behavior. */
  function ensureActivityActionDescriptions() {
    var descriptions = {
      "Start timer now": "Live timer from right now",
      "Log a time block": "Set a start and end time manually",
      "Stop timer": "Stop the active timer",
      "Edit time": "Adjust start or end time"
    };
    Array.prototype.slice.call(document.querySelectorAll("button")).forEach(function (button) {
      var paragraphs = Array.prototype.slice.call(button.querySelectorAll("p"));
      var labelNode = paragraphs[0];
      if (!labelNode) return;
      var label = (labelNode.textContent || "").trim();
      if (!descriptions[label]) return;
      var descriptionNode = paragraphs[1];
      if (!descriptionNode) {
        descriptionNode = document.createElement("p");
        descriptionNode.className = "text-xs text-muted-foreground mt-0.5";
        labelNode.parentElement.appendChild(descriptionNode);
      }
      if (!(descriptionNode.textContent || "").trim()) {
        descriptionNode.textContent = descriptions[label];
      }
    });
  }

  /* Helper: returns true only when the matched ancestor element is actually
     visible and within the main content area (not a nav button or hidden
     element) — prevents the category modal from randomly firing when the
     user taps nav tabs or other off-content areas. */
  function isVisibleContentElement(el) {
    if (!el) return false;
    /* Must be in the DOM and visible (offsetParent is null for display:none
       elements and their descendants). */
    if (el.offsetParent === null && el !== document.body) return false;
    /* Must not be inside a nav element — nav tab taps should never open
       the category modal even if the ancestor text search reaches that far. */
    if (el.closest && el.closest("nav, [data-lt-bottom-nav]")) return false;
    return true;
  }

  document.addEventListener("click", function (e) {
    var startMatch = ancestorTextMatch(e.target, "Start timer now", 7);
    if (startMatch && isVisibleContentElement(startMatch)) {
      if (suppressTimerGate) {
        /* This is our own synthetic re-click, fired after Save below, to
           actually let the real "start timer" action through. Let it run
           normally exactly once instead of gating it again. */
        suppressTimerGate = false;
        return;
      }
      /* Pause the original click only long enough to show the optional tag
         picker. The activity is started immediately, so closing the picker
         can never prevent or restart the timer. */
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (catModalRoot) return; /* already open — don't double-fire */
      var realStartBtn = startMatch;
      var timerActivityName = getPickerActivityName(e.target);
      var timerStartedForPrompt = false;
      function startTimerAfterOptionalTag() {
        if (timerStartedForPrompt) return;
        timerStartedForPrompt = true;
        writeJson(RUNNING_TIMER_KEY, Date.now());
        suppressTimerGate = true;
        realStartBtn.click();
        setTimeout(showProductivityToast, 200);
      }
      /* Ask for the optional category at start. The timer starts whether the
         user saves a tag, taps X, or leaves the picker open and backgrounds
         the app. */
      openCategoryModal(0, timerActivityName, {
        showDuration: false,
        onSave: function (result) {
          result.activityName = timerActivityName;
          writeJson(PENDING_TIMER_CAT_KEY, result.category ? result : null);
          startTimerAfterOptionalTag();
        },
        onCancel: function () {
          writeJson(PENDING_TIMER_CAT_KEY, null);
          startTimerAfterOptionalTag();
        }
      });
      return;
    }
    var logBlockMatch = ancestorTextMatch(e.target, "Log a time block", 7);
    if (logBlockMatch && isVisibleContentElement(logBlockMatch)) {
      /* Just remember which activity this is for. Category is now asked
         AFTER the block is actually logged (see "Log block" below), once
         the duration is known — not up front before any time is picked. */
      pendingBlockActivityName = getPickerActivityName(e.target);
      return;
    }
    var saveBlockMatch = ancestorTextMatch(e.target, "Log block", 7);
    if (saveBlockMatch && isVisibleContentElement(saveBlockMatch)) {
      /* Saving the manual time block. getTimeBlockMinutesFromDom() must
         run BEFORE the setTimeout below, since the native form (and its
         Start/End time inputs) may already be closing by the time the
         timeout fires. Category is asked here, now that the duration is
         known, instead of before the times were even picked. */
      var mins = getTimeBlockMinutesFromDom();
      var activityNameForBlock = pendingBlockActivityName;
      pendingBlockActivityName = "";
      setTimeout(function () {
        if (!mins || mins <= 0) {
          /* Don't silently log a 0-minute entry — that's how "Social
             Media 0 min" entries were showing up with nothing counted
             toward wasted time. Tell the user instead. */
          showSimpleToast("Time block not counted", "Couldn't read a valid start & end time, so this block wasn't added to Life Value. Try logging it again.");
          return;
        }
        if (catModalRoot) return; /* already open — don't double-fire */
        openCategoryModal(mins, activityNameForBlock, {
          showDuration: false,
          onSave: function (result) {
            logCategoryEntry(result.category, result.label, mins, result.reason);
            /* No productivity toast for time blocks — the user logged
               past time, so we don't know if they're working right now. */
          }
        });
      }, 350);
      return;
    }
    /* Stop timer is intentionally NOT matched by click text here — on this
       app it can be triggered by an icon-only control with no matching
       text, which made click detection miss it. See pollRunningTimer()
       below, which detects a stop by watching the running mm:ss counter
       disappear from the screen instead — works regardless of how the
       user triggers it. */
  }, true);

  /* ── Journal "Full view" \u2014 per-day donut chart + shareable card ─────────── */

  var FV_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

  function fvParseDurationText(t) {
    t = (t || "").trim();
    var h = 0, m = 0, s = 0, mh, mm, ms;
    mh = t.match(/(\d+)\s*h/); if (mh) h = parseInt(mh[1], 10);
    mm = t.match(/(\d+)\s*m/); if (mm) m = parseInt(mm[1], 10);
    ms = t.match(/(\d+)\s*s/); if (ms) s = parseInt(ms[1], 10);
    return h * 60 + m + (s / 60);
  }

  function fvGetProfile() {
    try {
      var raw = localStorage.getItem("lifetime_profile");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  /* Finds every day-row button in the Journal list (each contains a span
     with the dd/mm/yyyy date text) that we haven't already decorated. */
  function fvFindDateRows() {
    var spans = document.querySelectorAll("button span");
    var rows = [];
    for (var i = 0; i < spans.length; i++) {
      var txt = (spans[i].textContent || "").trim();
      if (!FV_DATE_RE.test(txt)) continue;
      var btn = spans[i].closest("button");
      if (!btn || btn.hasAttribute("data-lt-fv-injected")) continue;
      rows.push({ button: btn, dateText: txt });
    }
    return rows;
  }

  /* Reads the already-expanded (or about-to-expand) day's per-activity
     breakdown straight from the DOM, matching the app's own journal
     markup: each activity group's header div carries a
     "border-left: 4px solid <color>" inline style with the name + total
     duration inside it. */
  function fvScrapeExpandedDetail(rowButton) {
    var container = rowButton.parentElement;
    if (!container) return null;
    var detail = container.querySelector(":scope > div:not(:first-child)");
    if (!detail) return null;
    if (/no time logged/i.test(detail.textContent || "")) return [];
    var acts = [];
    var groups = detail.children;
    for (var i = 0; i < groups.length; i++) {
      var header = groups[i].firstElementChild;
      if (!header) continue;
      var style = header.getAttribute("style") || "";
      if (!/border-?left/i.test(style)) continue;
      var spans = header.querySelectorAll("span");
      if (!spans.length) continue;
      var name = spans[0].textContent.trim();
      var durText = spans[1] ? spans[1].textContent.trim() : "0m";
      var colorMatch = style.match(/solid\s*([^;]+)/i);
      var color = colorMatch ? colorMatch[1].trim() : "#7c8cff";
      acts.push({ name: name, color: color, minutes: fvParseDurationText(durText) });
    }
    return acts;
  }

  function fvScrapeJournalDay(rowButton, callback) {
    var already = fvScrapeExpandedDetail(rowButton);
    if (already !== null) { callback(already); return; }
    /* Not expanded yet \u2014 trigger the app's own row click to expand it,
       then wait for React to render before reading it. */
    rowButton.click();
    var attempts = 10;
    (function poll() {
      var data = fvScrapeExpandedDetail(rowButton);
      if (data !== null || attempts <= 0) { callback(data || []); return; }
      attempts--;
      setTimeout(poll, 120);
    })();
  }

  /* ── Drawing the shareable "visiting card" sized donut graphic ──────────── */

  function fvDrawCard(dateText, activities, sharerName) {
    var W = 1200, H = 686; /* ~ visiting-card aspect ratio */
    var canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext("2d");

    /* Background \u2014 app's own primary navy, as a subtle gradient */
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#1c2447");
    grad.addColorStop(1, "#10142b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    /* Faint decorative ring, top-right */
    ctx.beginPath();
    ctx.arc(W - 60, 60, 220, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 40;
    ctx.stroke();

    /* Brand \u2014 top-left */
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 40px Inter, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Minutics", 48, 44);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 18px Inter, Arial, sans-serif";
    ctx.fillText(dateText, 48, 94);

    var total = activities.reduce(function (s, a) { return s + a.minutes; }, 0);

    /* Donut chart */
    var cx = 330, cy = 400, rOuter = 190, rInner = 118;
    if (total > 0 && activities.length) {
      var start = -Math.PI / 2;
      activities.forEach(function (a) {
        var frac = a.minutes / total;
        var end = start + frac * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rOuter, start, end);
        ctx.closePath();
        ctx.fillStyle = a.color;
        ctx.fill();
        start = end;
      });
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fillStyle = "#161a34";
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fillStyle = "#161a34";
      ctx.fill();
    }

    /* Center label \u2014 total tracked time */
    var totalH = Math.floor(total / 60), totalM = Math.round(total % 60);
    var centerLabel = total > 0 ? (totalH > 0 ? (totalH + "h " + totalM + " min") : (totalM + " min")) : "No data";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "800 36px Inter, Arial, sans-serif";
    ctx.fillText(centerLabel, cx, cy - 20);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "600 14px Inter, Arial, sans-serif";
    ctx.fillText("TRACKED", cx, cy + 22);
    ctx.textAlign = "left";

    /* Legend \u2014 right side */
    var lx = 610, ly = 190, lineH = 44;
    var shown = activities.slice(0, 8);
    shown.forEach(function (a, i) {
      var y = ly + i * lineH;
      ctx.beginPath();
      ctx.arc(lx + 8, y + 10, 8, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 20px Inter, Arial, sans-serif";
      var name = a.name.length > 20 ? a.name.slice(0, 19) + "\u2026" : a.name;
      ctx.fillText(name, lx + 26, y);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "600 16px Inter, Arial, sans-serif";
      var mh = Math.floor(a.minutes / 60), mm2 = Math.round(a.minutes % 60);
      var durLabel = mh > 0 ? (mh + "h " + mm2 + " min") : (mm2 + " min") + (total ? "  \u00b7  " + Math.round(a.minutes / total * 100) + "%" : "");
      ctx.fillText(mh > 0 ? (mh + "h " + mm2 + " min  \u00b7  " + Math.round(a.minutes / total * 100) + "%") : durLabel, lx + 26, y + 22);
    });
    if (!shown.length) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "600 18px Inter, Arial, sans-serif";
      ctx.fillText("No activity tagged on this day.", lx, ly + 10);
    }

    /* Footer \u2014 sharer's name + tagline */
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 20px Inter, Arial, sans-serif";
    ctx.fillText("Shared by " + (sharerName || "a Minutics user"), 48, H - 66);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "600 14px Inter, Arial, sans-serif";
    ctx.fillText("Make every minute count \u2014 Minutics", 48, H - 38);

    return canvas;
  }

  function fvFormatMinutes(mins) {
    var h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return h > 0 ? (h + "h " + m + " min") : (m + " min");
  }

  function fvConicGradient(activities, total) {
    if (!total || !activities.length) return "conic-gradient(rgba(255,255,255,.08) 0 100%)";
    var acc = 0, stops = [];
    activities.forEach(function (a) {
      var startPct = (acc / total) * 100;
      acc += a.minutes;
      var endPct = (acc / total) * 100;
      stops.push(a.color + " " + startPct.toFixed(2) + "% " + endPct.toFixed(2) + "%");
    });
    return "conic-gradient(" + stops.join(",") + ")";
  }

  /* Stage 1: the report tab — chart, per-activity/category breakdown, and
     a summary, with its own "Share" button that leads to the shareable
     visiting-card image (stage 2). */
  function fvOpenReportModal(dateText, activities) {
    var total = activities.reduce(function (s, a) { return s + a.minutes; }, 0);
    var topActivity = activities.length ? activities[0] : null;

    var rowsHtml = activities.length
      ? activities.map(function (a) {
          var pct = total ? Math.round((a.minutes / total) * 100) : 0;
          return (
            '<div class="lt-fv-row">' +
              '<span class="lt-fv-row-left"><span class="lt-fv-dot" style="background:' + a.color + '"></span>' + escapeHtml(a.name) + '</span>' +
              '<span class="lt-fv-row-right">' + fvFormatMinutes(a.minutes) + ' \u00b7 ' + pct + '%</span>' +
            '</div>'
          );
        }).join("")
      : '<div class="lt-empty">No activity tagged on this day yet.</div>';

    var overlay = document.createElement("div");
    overlay.id = "lt-fv-report-overlay";
    overlay.innerHTML =
      '<div class="lt-fv-modal-head"><h3>Full view \u00b7 ' + escapeHtml(dateText) + '</h3><button class="lt-fv-modal-close" id="lt-fv-report-close">\u2715</button></div>' +
      '<div class="lt-fv-report-card">' +
        '<div class="lt-fv-donut" style="background:' + fvConicGradient(activities, total) + '">' +
          '<div class="lt-fv-donut-hole"><strong>' + (total ? fvFormatMinutes(total) : "\u2014") + '</strong><span>TRACKED</span></div>' +
        '</div>' +
        '<div class="lt-fv-legend">' + rowsHtml + '</div>' +
      '</div>' +
      '<div class="lt-fv-report-card">' +
        '<p class="lt-card-title" style="margin:0 0 10px;color:#fff">Summary</p>' +
        '<div class="lt-fv-row"><span class="lt-fv-row-left">Total tracked</span><span class="lt-fv-row-right">' + (total ? fvFormatMinutes(total) : "\u2014") + '</span></div>' +
        '<div class="lt-fv-row"><span class="lt-fv-row-left">Categories used</span><span class="lt-fv-row-right">' + activities.length + '</span></div>' +
        '<div class="lt-fv-row"><span class="lt-fv-row-left">Top category</span><span class="lt-fv-row-right">' + (topActivity ? '<span style="display:inline-flex;align-items:center;gap:5px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + topActivity.color + '"></span>' + escapeHtml(topActivity.name) + ' \u00b7 ' + fvFormatMinutes(topActivity.minutes) + '</span>' : "\u2014") + '</span></div>' +
      '</div>' +
      '<div class="lt-fv-modal-actions">' +
        '<button id="lt-fv-report-share-btn" style="background:hsl(var(--primary));color:#fff">Share</button>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.id === "lt-fv-report-close") { overlay.remove(); return; }
      if (e.target.id === "lt-fv-report-share-btn") {
        fvOpenShareCard(dateText, activities);
      }
    });
  }

  /* Stage 2: builds the visiting-card-shaped image and offers Share/Save
     (plus native long-press share/save on the <img> itself as a fallback). */
  function fvOpenShareCard(dateText, activities) {
    var profile = fvGetProfile();
    var sharerName = profile && profile.name ? profile.name : "";

    var overlay = document.createElement("div");
    overlay.id = "lt-fv-share-overlay";
    overlay.innerHTML =
      '<div class="lt-fv-modal-head"><h3>Share \u00b7 ' + escapeHtml(dateText) + '</h3><button class="lt-fv-modal-close" id="lt-fv-share-close">\u2715</button></div>' +
      '<div class="lt-fv-card-wrap" id="lt-fv-card-wrap"><div class="lt-fv-loading">Building your day\u2019s graphic\u2026</div></div>' +
      '<div class="lt-fv-modal-actions" id="lt-fv-actions" style="display:none">' +
        '<button id="lt-fv-share-btn">Share</button>' +
        '<button id="lt-fv-save-btn">Save image</button>' +
      '</div>' +
      '<p class="lt-fv-hint">Tip: you can also long-press the image above to save or share it directly to WhatsApp Status, Instagram, or anywhere else.</p>';
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.id === "lt-fv-share-close") { overlay.remove(); }
    });

    var canvas = fvDrawCard(dateText, activities, sharerName);
    var dataUrl = canvas.toDataURL("image/png");

    var wrap = document.getElementById("lt-fv-card-wrap");
    if (wrap) wrap.innerHTML = '<img src="' + dataUrl + '" alt="Minutics \u2014 ' + escapeHtml(dateText) + '">';
    var actions = document.getElementById("lt-fv-actions");
    if (actions) actions.style.display = "flex";

    function dataUrlToFile(url, filename) {
      var parts = url.split(",");
      var mime = parts[0].match(/:(.*?);/)[1];
      var bin = atob(parts[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new File([arr], filename, { type: mime });
    }

    var shareBtn = document.getElementById("lt-fv-share-btn");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      var file = dataUrlToFile(dataUrl, "lifetime-" + dateText.replace(/\//g, "-") + ".png");
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: "Minutics",
          text: "My day, tracked with Minutics."
        }).catch(function () {});
      } else if (window.AndroidShareBridge && typeof window.AndroidShareBridge.shareImagePng === "function") {
        window.AndroidShareBridge.shareImagePng(dataUrl);
      } else {
        alert("Sharing isn\u2019t supported directly here \u2014 long-press the image above and choose Share.");
      }
    });

    var saveBtn = document.getElementById("lt-fv-save-btn");
    if (saveBtn) saveBtn.addEventListener("click", function () {
      /* <a download> on a data: URL is silently ignored by Android WebView
         — that's why Save never did anything before. Use the native
         bridge to actually write the file when it's available, and only
         fall back to the <a> click on a real browser. */
      if (window.AndroidShareBridge && typeof window.AndroidShareBridge.saveImagePng === "function") {
        window.AndroidShareBridge.saveImagePng(dataUrl);
        return;
      }
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = "lifetime-" + dateText.replace(/\//g, "-") + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  function injectJournalFullView() {
    if (location.pathname.indexOf("journal") === -1) return;
    var rows = fvFindDateRows();
    var limit = isPro() ? proJournalDays() : FREE_JOURNAL_DAYS;
    rows.forEach(function (row, idx) {
      if (idx >= limit) {
        row.button.style.display = "none";
        return;
      } else if (row.button.style.display === "none") {
        row.button.style.display = "";
      }
      if (row.button.getAttribute("data-lt-fv-injected") === "1") return;
      row.button.setAttribute("data-lt-fv-injected", "1");
      /* Keep this control anchored to the date, not to the optional
         duration/arrow group.  The latter changes width when a journal day
         has no time or a short duration, which made Full view visibly jump
         between rows. */
      var dateSpan = Array.prototype.slice.call(row.button.querySelectorAll("span"))
        .filter(function (s) { return (s.textContent || "").trim() === row.dateText; })[0];
      var host = dateSpan && dateSpan.parentElement ? dateSpan.parentElement : row.button;
      var btn = document.createElement("span");
      btn.className = "lt-fv-btn";
      btn.setAttribute("role", "button");
      btn.textContent = "Full view";
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var dateText = row.dateText;
        fvScrapeJournalDay(row.button, function (activities) {
          activities = (activities || []).slice().sort(function (a, b) { return b.minutes - a.minutes; });
          fvOpenReportModal(dateText, activities);
        });
      });
      if (dateSpan && dateSpan.nextSibling) host.insertBefore(btn, dateSpan.nextSibling);
      else host.appendChild(btn);
    });
    /* Journal Pro-lock notice removed — journal history is no longer gated in-UI. */
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */

  var lastRunningTimerLabel = null;

  function findRunningTimerLabel() {
    /* Looks for the live mm:ss counter next to a running activity (e.g. the
       "00:28" shown beside the Edit button on the Work row). Requires an
       "Edit" label nearby to avoid matching unrelated clock-looking text. */
    var candidates = document.querySelectorAll("span,div,p,strong,b");
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.children.length !== 0) continue;
      var t = el.textContent.trim();
      if (!/^\d{1,2}:\d{2}$/.test(t)) continue;
      var cur = el, depth = 0, ok = false;
      while (cur && depth < 4) {
        if ((cur.textContent || "").indexOf("Edit") !== -1) { ok = true; break; }
        cur = cur.parentElement;
        depth++;
      }
      if (ok) return t;
    }
    return null;
  }

  /* The React screen is briefly unmounted during tab changes, so DOM text is
     not a reliable source of truth for whether an activity is running.
     The original app already persists its blocks locally; use that same state
     for start/stop detection and for the stop shortcut. */
  function getNativeRunningBlock() {
    try {
      var db = JSON.parse(localStorage.getItem(NATIVE_DB_KEY) || "null");
      var blocks = db && Array.isArray(db.blocks) ? db.blocks : [];
      return blocks.filter(function (b) { return b && !b.endTime; })[0] || null;
    } catch (_) {
      return null;
    }
  }

  function pollRunningTimer() {
    var runningBlock = getNativeRunningBlock();
    var label = findRunningTimerLabel();
    if (runningBlock) {
      var nativeStartedAt = new Date(runningBlock.startTime).getTime();
      if (nativeStartedAt > 0 && Number(readJson(RUNNING_TIMER_KEY, 0)) !== nativeStartedAt) {
        writeJson(RUNNING_TIMER_KEY, nativeStartedAt);
      }
    } else if (Number(readJson(RUNNING_TIMER_KEY, 0)) > 0) {
      /* The native block ended. This works even when the user stopped from
         another tab, the notification, or after returning from a tab switch. */
      var startedAt = Number(readJson(RUNNING_TIMER_KEY, 0));
      var elapsed = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 60000)) : 0;
      writeJson(RUNNING_TIMER_KEY, 0);
      var pendingTimerCat = readJson(PENDING_TIMER_CAT_KEY, null);
      if (pendingTimerCat && pendingTimerCat.category) {
        logCategoryEntry(pendingTimerCat.category, pendingTimerCat.label, elapsed, pendingTimerCat.reason);
      }
      /* Blank/closed tag is intentionally discarded without opening a modal. */
      writeJson(PENDING_TIMER_CAT_KEY, null);
    }
    lastRunningTimerLabel = label;
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 1 — Persistent top status bar
     Always visible at the top of every tab. Shows "No activity running"
     when idle, or the running activity + elapsed time + Stop when active.
     Replaces the old bottom slide-up banner, which used to appear/disappear
     depending on which tab you were on.
  ══════════════════════════════════════════════════════════════════════════ */

  var _statusBarTimer = null;

  function upsertRunningBanner() {
    addStyle3();
    /* The app only marks the page "lt-authed" once the user is actually
       signed in — before that (the pre-login splash / auth screens) there's
       no activity data to show a status for at all. It also shouldn't show
       during the "Your life, in seconds" / "Set up your profile" onboarding
       that runs after login but before a profile exists — there's nothing
       to be idle or running yet at that point either. */
    var hasProfile = false;
    try { hasProfile = !!localStorage.getItem("lifetime_profile"); } catch (e) {}
    if (!document.body.classList.contains("lt-authed") || !hasProfile) {
      var existingBar = document.getElementById("lt-top-status-bar");
      if (existingBar) existingBar.remove();
      document.documentElement.classList.remove("lt-has-top-status-bar");
      if (_statusBarTimer) { clearInterval(_statusBarTimer); _statusBarTimer = null; }
      return;
    }
    var nativeRunning = getNativeRunningBlock();
    var timerIsRunning = !!nativeRunning || Number(readJson(RUNNING_TIMER_KEY, 0)) > 0;

    document.documentElement.classList.add("lt-has-top-status-bar");
    var bar = document.getElementById("lt-top-status-bar");

    if (!bar) {
      bar = document.createElement("div");
      bar.id = "lt-top-status-bar";
      bar.innerHTML =
        '<span class="lt-ts-dot"></span>' +
        '<span class="lt-ts-time" id="lt-ts-time"></span>' +
        '<span class="lt-ts-label" id="lt-ts-label">No activity running</span>' +
        '<button class="lt-ts-stop" id="lt-ts-stop-btn">Stop \u25a0</button>';
      document.body.appendChild(bar);

      /* Stop the persisted native block directly. Opening a sheet and trying
         to click a text button was racy and could leave the block running.
         stopPropagation so this doesn't also trigger the bar's own
         "jump to Activity" handler below \u2014 Stop should just stop,
         not navigate anywhere. */
      document.getElementById("lt-ts-stop-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        var block = getNativeRunningBlock();
        if (block && typeof window.__lifetimeStopActivity === "function") {
          window.__lifetimeStopActivity(block.id);
        } else {
          var stopBtn = Array.prototype.slice.call(document.querySelectorAll("button"))
            .find(function (b) { return /^stop timer$/i.test(b.textContent.trim()); });
          if (stopBtn) stopBtn.click();
        }
      });

      /* Tapping anywhere else on the bar, while an activity is running,
         jumps straight to the Activity tab so you can see/manage it \u2014
         same as tapping the Activity pseudo-tab in the bottom nav. Only
         active while running (bar has no useful destination while idle). */
      bar.addEventListener("click", function (e) {
        if (!bar.classList.contains("lt-ts-running")) return;
        if (e.target.closest("#lt-ts-stop-btn")) return;
        var activityTab = document.getElementById("lt-activity-navtab");
        if (activityTab) activityTab.click();
      });
    }

    if (!timerIsRunning) {
      bar.classList.remove("lt-ts-running");
      var timeElIdle = document.getElementById("lt-ts-time");
      var labelElIdle = document.getElementById("lt-ts-label");
      if (timeElIdle) timeElIdle.textContent = "";
      if (labelElIdle) labelElIdle.textContent = "No activity running";
      if (_statusBarTimer) { clearInterval(_statusBarTimer); _statusBarTimer = null; }
      return;
    }

    bar.classList.add("lt-ts-running");

    /* Tick elapsed time + activity name */
    function tickBar() {
      var startedAt = Number(readJson(RUNNING_TIMER_KEY, 0));
      var elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      var m = Math.floor(elapsed / 60), s = elapsed % 60;
      var timeEl = document.getElementById("lt-ts-time");
      if (timeEl) timeEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;

      var pending = readJson(PENDING_TIMER_CAT_KEY, null);
      var labelEl = document.getElementById("lt-ts-label");
      if (labelEl) {
        labelEl.textContent = (pending && pending.category)
          ? (pending.activityName || pending.label || pending.category)
          : "Activity running";
      }
    }

    if (!_statusBarTimer) {
      tickBar();
      _statusBarTimer = setInterval(tickBar, 1000);
    }
  }

  /* ── Real OS notification for the running activity (web build) ──────────
     The in-app top bar above only exists while this tab is open and
     visible. On web that's not a real "running activity" notification the
     way the Android build has one — switch tabs or minimize the browser
     and it's just gone. This mirrors it with an actual system Notification
     that updates once a minute while the tab is hidden, and clears itself
     the moment the tab is focused again or the activity is stopped, using
     a fixed tag so it replaces in place instead of stacking duplicates. */
  var _runningSystemNotification = null;
  var _lastRunningNotifyMinute = -1;

  function closeRunningSystemNotification() {
    if (_runningSystemNotification) {
      try { _runningSystemNotification.close(); } catch (e) {}
      _runningSystemNotification = null;
    }
    _lastRunningNotifyMinute = -1;
  }

  function maybeNotifyRunningActivity() {
    if (typeof window === "undefined" || !("Notification" in window) || window.Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") { closeRunningSystemNotification(); return; }

    var nativeRunning = getNativeRunningBlock();
    var startedAt = Number(readJson(RUNNING_TIMER_KEY, 0));
    var timerIsRunning = !!nativeRunning || startedAt > 0;
    if (!timerIsRunning) { closeRunningSystemNotification(); return; }

    var elapsedMin = startedAt ? Math.floor((Date.now() - startedAt) / 60000) : 0;
    if (elapsedMin === _lastRunningNotifyMinute) return; /* already showing this minute's version */
    _lastRunningNotifyMinute = elapsedMin;

    var pending = readJson(PENDING_TIMER_CAT_KEY, null);
    var activityName = (pending && (pending.activityName || pending.label || pending.category)) || "an activity";
    var timeStr = elapsedMin < 1 ? "just started" : (elapsedMin + " min elapsed");

    try {
      _runningSystemNotification = new window.Notification("Tracking " + activityName, {
        body: timeStr + " \u2014 tap to return to Minutics.",
        tag: "minutics-running-activity",
        silent: true
      });
      _runningSystemNotification.onclick = function () {
        try { window.focus(); } catch (e) {}
        closeRunningSystemNotification();
      };
    } catch (e) {}
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") closeRunningSystemNotification();
  });
  setInterval(maybeNotifyRunningActivity, 15000);

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 2 — Idle Nudge: fires after 15min with no activity running.
     The previous implementation watched a running Waste timer, which meant
     the app could nudge users while they were already tracking something.
  ══════════════════════════════════════════════════════════════════════════ */

  var NUDGE_THRESHOLD_MS = 15 * 60 * 1000; /* 15 minutes */
  var _idleSystemNotification = null;

  function closeIdleSystemNotification() {
    if (_idleSystemNotification) {
      try { _idleSystemNotification.close(); } catch (e) {}
      _idleSystemNotification = null;
    }
  }

  function checkIdleNudge() {
    var hasProfileNow = false;
    try { hasProfileNow = !!localStorage.getItem("lifetime_profile"); } catch (e) {}
    if (!hasProfileNow || !document.body.classList.contains("lt-authed")) return;

    var runningBlock = getNativeRunningBlock();
    var nudgeData = readJson(NUDGE_KEY, {});

    if (runningBlock) {
      /* Starting any activity ends the idle session immediately. Also remove
         reminders that were queued just before the start tap. */
      closeIdleSystemNotification();
      if (nudgeData.noActivitySince) {
        nudgeData.noActivitySince = 0;
        writeJson(NUDGE_KEY, nudgeData);
      }
      var staleToast = document.getElementById("lt-nudge-toast");
      if (staleToast) staleToast.remove();
      return;
    }

    if (!nudgeData.noActivitySince) {
      nudgeData.noActivitySince = Date.now();
      writeJson(NUDGE_KEY, nudgeData);
      return;
    }

    var now = Date.now();
    if (now - nudgeData.noActivitySince < NUDGE_THRESHOLD_MS) return;
    if (nudgeData.lastNudge && (now - nudgeData.lastNudge) < NUDGE_THRESHOLD_MS) return;

    /* Re-read the source of truth immediately before notifying. This closes
       the race where an activity starts after the first check above but
       before a throttled background callback reaches Notification(). */
    if (getNativeRunningBlock()) {
      closeIdleSystemNotification();
      nudgeData.noActivitySince = 0;
      writeJson(NUDGE_KEY, nudgeData);
      return;
    }

    nudgeData.lastNudge = now;
    writeJson(NUDGE_KEY, nudgeData);

    /* On the web, use a system notification only when the tab is hidden;
       otherwise the visible toast is enough and avoids a duplicate alert. */
    if (document.visibilityState !== "visible" &&
        typeof window !== "undefined" && "Notification" in window &&
        window.Notification.permission === "granted") {
      try {
        closeIdleSystemNotification();
        _idleSystemNotification = new window.Notification("Still there?", {
          body: "You haven't started an activity in a while — track what you're doing right now.",
          tag: "minutics-idle-nudge"
        });
        _idleSystemNotification.onclose = function () {
          _idleSystemNotification = null;
        };
        return;
      } catch (e) {}
    }

    addStyle3();
    var toast = document.getElementById("lt-nudge-toast");
    if (toast) toast.remove();
    toast = document.createElement("div");
    toast.id = "lt-nudge-toast";
    toast.innerHTML =
      '<button id="lt-nudge-toast-close">\u2715</button>' +
      '<div class="lt-nudge-icon">\uD83D\uDCA1</div>' +
      '<div class="lt-nudge-body">' +
        '<p>Still there?</p>' +
        '<p>You haven\u2019t started an activity in a while \u2014 track what you\u2019re doing right now.</p>' +
      '</div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("lt-show"); });

    function dismissNudge() {
      toast.classList.remove("lt-show");
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 380);
    }
    document.getElementById("lt-nudge-toast-close").addEventListener("click", dismissNudge);
    setTimeout(dismissNudge, 12000);
  }

  /* Keep a hidden tab from retaining a stale reminder when the timer changes
     in another tab or when the user returns after starting an activity. */
  window.addEventListener("storage", function (event) {
    if (event.key === NATIVE_DB_KEY) checkIdleNudge();
  });
  document.addEventListener("visibilitychange", function () {
    checkIdleNudge();
  });

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 3 — Streaks & Time Master badge
     Tracks consecutive days with ≥60min of "Study / Learning" or
     "Duty / Work" logged. Awards badge at 7-day streak.
  ══════════════════════════════════════════════════════════════════════════ */

  var SELF_DEV_CATEGORIES = ["Study / Learning", "Duty / Work", "Self Development"];
  var SELF_DEV_MIN_MINUTES = 60;

  function updateStreak() {
    /* Streaks & Badges feature removed — no more tracking or popups. */
    var existingChip = document.getElementById("lt-streak-chip");
    if (existingChip) existingChip.remove();
    return;
    // eslint-disable-next-line no-unreachable
    addStyle3();
    var entries = catLogEntries();
    var todayStr = today();

    /* Sum self-dev minutes for today */
    var todayMin = 0;
    entries.forEach(function (e) {
      if (e.date === todayStr && SELF_DEV_CATEGORIES.indexOf(e.category) !== -1) {
        todayMin += Number(e.minutes) || 0;
      }
    });

    var streak = readJson(STREAK_KEY, { lastDate: "", count: 0, badgeEarned: false });

    if (todayMin >= SELF_DEV_MIN_MINUTES) {
      if (streak.lastDate !== todayStr) {
        /* Check if yesterday was the last streak day */
        var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        var isConsecutive = streak.lastDate === yesterday;
        streak.count = isConsecutive ? streak.count + 1 : 1;
        streak.lastDate = todayStr;
        writeJson(STREAK_KEY, streak);

        /* Award badge at 7 days */
        if (streak.count >= 7 && !streak.badgeEarned) {
          streak.badgeEarned = true;
          writeJson(STREAK_KEY, streak);
          showTimeMasterBadge(streak.count);
        }
      }
    }

    /* Streak chip on Timer tab removed — streak is shown in Journal instead. */
    var existingChip = document.getElementById("lt-streak-chip");
    if (existingChip) existingChip.remove();
  }

  function showTimeMasterBadge(count) {
    var overlay = document.createElement("div");
    overlay.id = "lt-badge-overlay";
    overlay.innerHTML =
      '<div id="lt-badge-card">' +
        '<div class="lt-badge-trophy">\uD83C\uDFC6</div>' +
        '<h2>You earned a badge!</h2>' +
        '<div class="lt-badge-name">\u2605 Time Master \u2605</div>' +
        '<p>You dedicated at least 1 hour to self-development for ' + count + ' consecutive days. That\'s incredible discipline \u2014 your future self thanks you.</p>' +
        '<button id="lt-badge-close-btn">Awesome!</button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById("lt-badge-close-btn").addEventListener("click", function () {
      overlay.remove();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 4 — Opportunity Cost Calculator (Life Hub tool)
  ══════════════════════════════════════════════════════════════════════════ */

  function renderOpportunity() {
    var saved = readJson(OPP_KEY, []);
    var d = saved[0] || { hrs: "1", rate: "12", target: "10000000" };
    var tv = readJson(TIMEVALUE_KEY, null);

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Opportunity Cost Calculator", "See what consistently investing your self-development hours could grow into.") +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Your inputs</p>' +
          '<form data-lt-opp-form>' +
            '<div class="lt-calc-grid">' +
              field("Self-development hrs/day", "hrs", d.hrs, "e.g. 1", "number") +
              field("Annual return %", "rate", d.rate, "e.g. 12", "number") +
              field("Target " + getCurrency().symbol, "target", d.target, "e.g. 10000000", "number") +
            '</div>' +
            '<div class="lt-form-actions"><button class="lt-tool-primary" type="submit">Calculate Freedom</button></div>' +
          '</form>' +
        '</div>' +
        '<div data-lt-opp-result class="lt-tool-card lt-empty">Enter your inputs above to see how far those hours could take you.</div>' +
      '</div>';

    var form = activeOverlay.querySelector("[data-lt-opp-form]");
    var result = activeOverlay.querySelector("[data-lt-opp-result]");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(n) { return Number((form.querySelector('[name="' + n + '"]') || {}).value) || 0; }
      var hrs    = Math.max(0.1, val("hrs") || 1);
      var rate   = Math.max(1, val("rate") || 12) / 100;
      var target = Math.max(1, val("target") || 10000000);

      var perMin = tv ? Number(tv.perMinute) : 0;
      /* Monthly investment = self-development hours converted to rupee value */
      var monthlyInvest = perMin > 0 ? (perMin * 60 * hrs * 30) : (hrs * 500 * 30);
      var monthRate     = rate / 12;

      /* Months to reach target via SIP formula: n = ln(1 + target*r/P) / ln(1+r) */
      var months = Math.log(1 + (target * monthRate) / monthlyInvest) / Math.log(1 + monthRate);
      var years  = months / 12;

      saved.unshift({ hrs: hrs, rate: rate * 100, target: target, monthlyInvest: monthlyInvest, years: years, savedAt: new Date().toISOString() });
      writeJson(OPP_KEY, saved.slice(0, 10));

      result.className = "lt-tool-card";
      if (!isFinite(years) || years <= 0) {
        result.innerHTML =
          '<div class="lt-calc-result">' +
            '<small>Time to freedom</small>' +
            '<strong>\u2014</strong>' +
            '<p>Adjust your inputs \u2014 target may be too high.</p>' +
          '</div>';
        return;
      }

      var yrs = Math.floor(years);
      var mos = Math.round((years - yrs) * 12);
      result.innerHTML =
        '<div class="lt-calc-result">' +
          '<small>Time to freedom</small>' +
          '<strong>' + escapeHtml(yrs + " yrs" + (mos > 0 ? " " + mos + " mo" : "")) + '</strong>' +
          '<p>If you invest ' + escapeHtml(money(Math.round(monthlyInvest))) + '/mo (the value of ' +
            hrs + 'h of self-development/day) at ' + Math.round(rate * 100) + '% annual return, ' +
            'you could reach ' + escapeHtml(money(target)) + ' financial freedom in ~' +
            yrs + ' year' + (yrs !== 1 ? 's' : '') + '.</p>' +
        '</div>' +
        '<div class="lt-history-row"><span>Self-development hrs/day</span><strong>' + escapeHtml(String(hrs)) + '</strong></div>' +
        '<div class="lt-history-row"><span>Annual return</span><strong>' + escapeHtml(Math.round(rate * 100) + "%") + '</strong></div>' +
        '<div class="lt-history-row"><span>Target</span><strong>' + escapeHtml(money(target)) + '</strong></div>';
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 4b — Item Time Cost Calculator (Life Hub tool)
     Enter a price -> shows how many hours/minutes of work it costs,
     using the per-minute rate from the Time Value Calculator.
  ══════════════════════════════════════════════════════════════════════════ */

  function renderItemCost() {
    var saved = readJson(ITEMCOST_KEY, []);
    var tv = readJson(TIMEVALUE_KEY, null);
    var d = saved[0] || { name: "", price: "" };

    if (!tv || !Number(tv.perMinute)) {
      activeOverlay.innerHTML =
        '<div class="lt-tool-shell">' +
          toolHeader("Item Time Cost Calculator", "See how many hours of work an item really costs.") +
          '<div class="lt-tool-card lt-empty">Set up the Time Value Calculator first (your salary and work hours) so we know your earning rate per minute.</div>' +
        '</div>';
      return;
    }

    var perMin = Number(tv.perMinute);

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Item Time Cost Calculator", "See how many hours of your life this purchase really costs.") +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">What are you buying?</p>' +
          '<form data-lt-itemcost-form>' +
            '<div class="lt-calc-grid">' +
              field("Item name (optional)", "name", d.name, "e.g. Sneakers", "text") +
              field("Price " + getCurrency().symbol, "price", d.price, "e.g. 5000", "number") +
            '</div>' +
            '<div class="lt-form-actions"><button class="lt-tool-primary" type="submit">Show Time Cost</button></div>' +
          '</form>' +
        '</div>' +
        '<div data-lt-itemcost-result class="lt-tool-card lt-empty">Enter a price above to see the work-hours cost.</div>' +
        (saved.length ? '<div class="lt-tool-card"><p class="lt-card-title">Recent</p><div data-lt-itemcost-history></div></div>' : '') +
      '</div>';

    var form = activeOverlay.querySelector("[data-lt-itemcost-form]");
    var result = activeOverlay.querySelector("[data-lt-itemcost-result]");

    function renderHistory() {
      var wrap = activeOverlay.querySelector("[data-lt-itemcost-history]");
      if (!wrap) return;
      wrap.innerHTML = saved.slice(0, 5).map(function (row) {
        return '<div class="lt-history-row"><span>' + escapeHtml(row.name || "Item") + ' \u00b7 ' + escapeHtml(money(row.price)) + '</span><strong>' + escapeHtml(fmtHrsMins(row.mins)) + '</strong></div>';
      }).join("");
    }
    function fmtHrsMins(m) {
      m = Math.round(m);
      var dutyHours = Number(tv.hours) || 8;
      var dutyMins = dutyHours * 60;
      var days = Math.floor(m / dutyMins);
      var remMin = m % dutyMins;
      var h = Math.floor(remMin / 60), min = remMin % 60;
      var parts = [];
      if (days > 0) parts.push(days + (days === 1 ? " day" : " days"));
      if (h > 0) parts.push(h + "h");
      if (min > 0 || parts.length === 0) parts.push(min + " min");
      return parts.join(" ");
    }
    renderHistory();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (form.querySelector('[name="name"]').value || "").trim();
      var price = Math.max(0, Number(form.querySelector('[name="price"]').value) || 0);

      if (price <= 0) {
        result.className = "lt-tool-card lt-empty";
        result.innerHTML = "Enter a valid price above.";
        return;
      }

      var mins = price / perMin;
      saved.unshift({ name: name, price: price, mins: mins, savedAt: new Date().toISOString() });
      writeJson(ITEMCOST_KEY, saved.slice(0, 10));

      result.className = "lt-tool-card";
      result.innerHTML =
        '<div class="lt-calc-result">' +
          '<small>Work time required</small>' +
          '<strong>' + escapeHtml(fmtHrsMins(mins)) + '</strong>' +
          '<p>' + (name ? escapeHtml(name) + " costs " : "This costs ") +
            'you ' + escapeHtml(fmtHrsMins(mins)) + ' of work \u2014 based on your rate of ' +
            escapeHtml(money(perMin)) + '/minute.</p>' +
        '</div>';

      var histCard = activeOverlay.querySelector("[data-lt-itemcost-history]");
      if (!histCard) {
        var card = document.createElement("div");
        card.className = "lt-tool-card";
        card.innerHTML = '<p class="lt-card-title">Recent</p><div data-lt-itemcost-history></div>';
        activeOverlay.querySelector(".lt-tool-shell").appendChild(card);
      }
      renderHistory();
    });
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — Productivity Score (0-100), computed from today's real logged
     time: Work / Self-dev / Fitness add points, Time Waste subtracts.
  ══════════════════════════════════════════════════════════════════════════ */

  var PRODSCORE_BOOST = ["Duty / Work", "Study / Learning", "Exercise / Fitness", "Creative / Hobby", "Health / Self-care"];

  function computeProductivityIndex(entries) {
    var boostMin = 0, wasteMin = 0;
    entries.forEach(function (e) {
      var m = Number(e.minutes) || 0;
      if (WASTE_CATEGORIES.indexOf(e.category) !== -1) wasteMin += m;
      else if (PRODSCORE_BOOST.indexOf(e.category) !== -1) boostMin += m;
    });
    var score = Math.round(50 + boostMin * 0.4 - wasteMin * 0.5);
    score = Math.min(100, Math.max(0, score));
    return { score: score, boostMin: boostMin, wasteMin: wasteMin };
  }

  function renderProductivityScore() {
    var entries = catLogEntries().filter(function (e) { return e.date === today(); });
    var idx = computeProductivityIndex(entries);
    var color = idx.score >= 70 ? "#059669" : idx.score >= 40 ? "#D97706" : "#DC2626";

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Productivity Score", "Your score for today, based on time actually logged.") +
        '<div class="lt-tool-card" style="text-align:center;">' +
          '<p class="lt-card-title">Today\u2019s score</p>' +
          '<div style="font-size:48px;font-weight:800;color:' + color + ';">' + idx.score + '<span style="font-size:20px;color:#9CA3AF;">/100</span></div>' +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<div class="lt-history-row"><span>Work / Self-dev / Fitness minutes</span><strong>+' + escapeHtml(String(idx.boostMin)) + '</strong></div>' +
          '<div class="lt-history-row"><span>Time Waste minutes</span><strong style="color:#DC2626;">-' + escapeHtml(String(idx.wasteMin)) + '</strong></div>' +
        '</div>' +
        '<div class="lt-tool-card lt-empty">Score starts at 50 each day: +0.4 per productive minute, -0.5 per wasted minute, clamped 0-100.</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — Focus Mode: 25-minute focus timer + ambient piano music.

     Audio is played via the native FocusMusicService (foreground service)
     so it continues even after the user closes the app. The JS side controls
     the service via the window.FocusMusicBridge JavascriptInterface.

     Volume is stored in focus state so it survives re-opens.
     The timer runs independently of music — user can stop music while
     keeping the timer, or stop both together.
  ══════════════════════════════════════════════════════════════════════════ */

  var _focusInterval = null;

  /* ── Music helpers ────────────────────────────────────────────────────── */

  function _bridge() {
    return (typeof window !== "undefined" && window.FocusMusicBridge) || null;
  }

  /* Web fallback: plain looping <audio> element, used whenever there's no
     native FocusMusicBridge (i.e. running as a web app, not the WebView APK). */
  var _webAudio = null;
  function _webAudioEl() {
    if (!_webAudio) {
      _webAudio = new Audio("./assets/focus_ambient_piano.mp3");
      _webAudio.loop = true;
    }
    return _webAudio;
  }

  function startPianoMusic(volume) {
    var b = _bridge();
    if (b) {
      try { b.startMusic(typeof volume === "number" ? volume : 0.5); } catch (_) {}
      return;
    }
    var el = _webAudioEl();
    el.volume = typeof volume === "number" ? volume : 0.5;
    el.play().catch(function () {});
  }

  function stopPianoMusic() {
    var b = _bridge();
    if (b) {
      try { b.stopMusic(); } catch (_) {}
      return;
    }
    if (_webAudio) { _webAudio.pause(); _webAudio.currentTime = 0; }
  }

  function setPianoVolume(volume) {
    var b = _bridge();
    if (b) {
      try { b.setVolume(typeof volume === "number" ? volume : 0.5); } catch (_) {}
      return;
    }
    if (_webAudio) { _webAudio.volume = typeof volume === "number" ? volume : 0.5; }
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  function renderFocusMode() {
    var state   = readJson(FOCUS_STATE_KEY, null);
    var isRunning = !!(state && state.endsAt && state.endsAt > Date.now());
    var musicOn   = !!(state && state.musicOn);          /* is music playing?  */
    var volume    = (state && typeof state.volume === "number") ? state.volume : 0.5;

    /* Helper: render the volume slider row */
    function volSliderHtml(vol) {
      return '<div style="margin-top:12px;">' +
               '<label style="font-size:13px;color:#6B7280;display:flex;align-items:center;gap:8px;">' +
                 '\uD83D\uDD0A Volume' +
                 '<input type="range" min="0" max="1" step="0.05" value="' + vol + '" ' +
                        'data-lt-focus-vol style="flex:1;accent-color:#059669;">' +
               '</label>' +
             '</div>';
    }

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Focus Mode", "25-minute focus timer with ambient piano music.") +
        '<div class="lt-tool-card" style="text-align:center;">' +
          '<div data-lt-focus-clock style="font-size:44px;font-weight:800;font-variant-numeric:tabular-nums;">' +
            (isRunning ? '00:00' : '25:00') +
          '</div>' +
          '<div class="lt-form-actions" style="justify-content:center;">' +
            '<button class="lt-tool-primary" data-lt-focus-start type="button">' +
              (isRunning ? 'Running\u2026' : 'Start') +
            '</button>' +
            '<button class="lt-tool-primary" data-lt-focus-stop type="button" style="background:#DC2626;">Stop</button>' +
          '</div>' +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Ambient Piano Music</p>' +
          '<p style="font-size:13px;color:#6B7280;margin:0 0 12px;">' +
            'Calm piano plays while you focus \u2014 continues even if you close the app.' +
          '</p>' +
          '<div class="lt-form-actions" style="flex-wrap:wrap;gap:8px;">' +
            '<button type="button" class="lt-tool-primary" data-lt-focus-music-toggle ' +
              'style="' + (musicOn ? 'background:#059669;' : 'background:#E5E7EB;color:#374151;') + '">' +
              (musicOn ? '\u23F8 Pause Music' : '\u25B6 Play Music') +
            '</button>' +
          '</div>' +
          (musicOn ? volSliderHtml(volume) : '') +
        '</div>' +
      '</div>';

    /* ── Clock ── */
    var clock    = activeOverlay.querySelector("[data-lt-focus-clock]");
    var startBtn = activeOverlay.querySelector("[data-lt-focus-start]");

    function fmt(sec) {
      var m = Math.floor(sec / 60), s = sec % 60;
      return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    function tick() {
      var st = readJson(FOCUS_STATE_KEY, null);
      if (!st || !st.endsAt) { clearInterval(_focusInterval); return; }
      var remain = Math.max(0, Math.round((st.endsAt - Date.now()) / 1000));
      if (clock) clock.textContent = fmt(remain);
      if (remain <= 0) {
        clearInterval(_focusInterval);
        /* Timer done — stop music too */
        stopPianoMusic();
        var done = readJson(FOCUS_STATE_KEY, {});
        done.endsAt  = null;
        done.musicOn = false;
        writeJson(FOCUS_STATE_KEY, done);
        if (startBtn) { startBtn.textContent = "Start"; startBtn.disabled = false; startBtn.style.opacity = ""; }
      }
    }

    /* ── Start button ── */
    activeOverlay.querySelector("[data-lt-focus-start]").addEventListener("click", function () {
      var st = readJson(FOCUS_STATE_KEY, { volume: 0.5 });
      st.endsAt  = Date.now() + 25 * 60 * 1000;
      /* Start music automatically when timer starts (if it wasn't explicitly paused) */
      var wasExplicitlyPaused = st.hasOwnProperty("musicOn") && !st.musicOn;
      if (!wasExplicitlyPaused) {
        st.musicOn = true;
        startPianoMusic(st.volume || 0.5);
      }
      writeJson(FOCUS_STATE_KEY, st);
      if (startBtn) { startBtn.textContent = "Running\u2026"; startBtn.disabled = true; startBtn.style.opacity = "0.6"; }
      if (_focusInterval) clearInterval(_focusInterval);
      _focusInterval = setInterval(tick, 1000);
      tick();
      renderFocusMode();
    });

    /* ── Stop button (stops timer AND music) ── */
    activeOverlay.querySelector("[data-lt-focus-stop]").addEventListener("click", function () {
      clearInterval(_focusInterval);
      stopPianoMusic();
      var st = readJson(FOCUS_STATE_KEY, {});
      st.endsAt  = null;
      st.musicOn = false;
      writeJson(FOCUS_STATE_KEY, st);
      if (clock)    clock.textContent = "25:00";
      if (startBtn) { startBtn.textContent = "Start"; startBtn.disabled = false; startBtn.style.opacity = ""; }
      renderFocusMode();
    });

    /* ── Music toggle (play/pause independently of timer) ── */
    var musicToggle = activeOverlay.querySelector("[data-lt-focus-music-toggle]");
    if (musicToggle) {
      musicToggle.addEventListener("click", function () {
        var st = readJson(FOCUS_STATE_KEY, { volume: 0.5 });
        st.musicOn = !st.musicOn;
        if (st.musicOn) {
          startPianoMusic(st.volume || 0.5);
        } else {
          stopPianoMusic();
        }
        writeJson(FOCUS_STATE_KEY, st);
        renderFocusMode();
      });
    }

    /* ── Volume slider ── */
    var volSlider = activeOverlay.querySelector("[data-lt-focus-vol]");
    if (volSlider) {
      volSlider.addEventListener("input", function () {
        var vol = parseFloat(this.value);
        setPianoVolume(vol);
        var st = readJson(FOCUS_STATE_KEY, {});
        st.volume = vol;
        writeJson(FOCUS_STATE_KEY, st);
      });
    }

    /* ── Resume if already running ── */
    if (isRunning) {
      if (startBtn) { startBtn.textContent = "Running\u2026"; startBtn.disabled = true; startBtn.style.opacity = "0.6"; }
      if (_focusInterval) clearInterval(_focusInterval);
      _focusInterval = setInterval(tick, 1000);
      tick();
      /* Resume music if it was on */
      if (musicOn) startPianoMusic(volume);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — Time Waste Budget & red alert
  ══════════════════════════════════════════════════════════════════════════ */

  var _wasteBudgetTimer = null;

  /* Logged (stopped/saved) waste minutes today, PLUS — if a timer is
     currently running and was tagged with a waste category at start —
     the live elapsed minutes of that still-running timer. Without this,
     picking "Time Waste" or the "Time Waste / Scrolling" Social Media
     sub-category appeared to do nothing, because nothing is written to
     the log until the timer is actually stopped (see pollRunningTimer). */
  function computeWasteMinutesToday() {
    var entries = catLogEntries().filter(function (e) { return e.date === today(); });
    var wasteMin = entries.reduce(function (s, e) {
      return WASTE_CATEGORIES.indexOf(e.category) !== -1 ? s + (Number(e.minutes) || 0) : s;
    }, 0);

    var pending = readJson(PENDING_TIMER_CAT_KEY, null);
    var runningStart = Number(readJson(RUNNING_TIMER_KEY, 0));
    if (pending && pending.category && WASTE_CATEGORIES.indexOf(pending.category) !== -1 && runningStart > 0) {
      wasteMin += Math.max(0, Math.round((Date.now() - runningStart) / 60000));
    }
    return wasteMin;
  }

  function renderWasteBudget() {
    var cfg = readJson(WASTE_BUDGET_KEY, { minutes: 45 });
    var wasteMin = computeWasteMinutesToday();
    var over = wasteMin > cfg.minutes;

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Time Waste Budget", "Set a daily limit for Time Waste and get an alert when you go over.") +
        '<div class="lt-tool-card" data-lt-waste-live style="text-align:center;' + (over ? "background:#FEF2F2;border-color:#FCA5A5;" : "") + '">' +
          '<p class="lt-card-title">Today\u2019s waste time</p>' +
          '<div data-lt-waste-mins style="font-size:36px;font-weight:800;color:' + (over ? "#DC2626" : "#111827") + ';">' + fvFormatMinutes(wasteMin) + '</div>' +
          '<p data-lt-waste-status style="color:' + (over ? "#DC2626" : "#6B7280") + ';font-weight:' + (over ? "700" : "400") + ';">' +
            (over ? "\u26A0\uFE0F Over your " + cfg.minutes + " min budget!" : "Budget: " + cfg.minutes + " min/day") +
          '</p>' +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Daily budget</p>' +
          '<form data-lt-waste-form>' +
            '<div class="lt-calc-grid">' + field("Minutes / day", "minutes", cfg.minutes, "e.g. 45", "number") + '</div>' +
            '<div class="lt-form-actions"><button class="lt-tool-primary" type="submit">Save Budget</button></div>' +
          '</form>' +
        '</div>' +
      '</div>';

    activeOverlay.querySelector("[data-lt-waste-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var minutes = Math.max(1, Number(this.querySelector('[name="minutes"]').value) || 45);
      writeJson(WASTE_BUDGET_KEY, { minutes: minutes });
      renderWasteBudget();
    });

    /* Keep the number live while this card is on screen, but only pay
       the cost of ticking (re-reading storage) when a waste timer is
       actually running — a flat number doesn't need to redraw every
       second, and doing so was adding needless work on every tap. */
    if (_wasteBudgetTimer) clearInterval(_wasteBudgetTimer);
    var pendingNow = readJson(PENDING_TIMER_CAT_KEY, null);
    var runningNow = Number(readJson(RUNNING_TIMER_KEY, 0));
    var waitingOnLiveTimer = pendingNow && pendingNow.category && WASTE_CATEGORIES.indexOf(pendingNow.category) !== -1 && runningNow > 0;
    if (waitingOnLiveTimer) {
      _wasteBudgetTimer = setInterval(function () {
        var card = activeOverlay && activeOverlay.querySelector("[data-lt-waste-live]");
        if (!card) { clearInterval(_wasteBudgetTimer); _wasteBudgetTimer = null; return; }
        var p = readJson(PENDING_TIMER_CAT_KEY, null);
        var r = Number(readJson(RUNNING_TIMER_KEY, 0));
        if (!(p && p.category && WASTE_CATEGORIES.indexOf(p.category) !== -1 && r > 0)) {
          clearInterval(_wasteBudgetTimer); _wasteBudgetTimer = null; return;
        }
        var cfgNow = readJson(WASTE_BUDGET_KEY, { minutes: 45 });
        var minsNow = computeWasteMinutesToday();
        var overNow = minsNow > cfgNow.minutes;
        card.style.background = overNow ? "#FEF2F2" : "";
        card.style.borderColor = overNow ? "#FCA5A5" : "";
        var minsEl = card.querySelector("[data-lt-waste-mins]");
        if (minsEl) { minsEl.style.color = overNow ? "#DC2626" : "#111827"; minsEl.textContent = fvFormatMinutes(minsNow); }
        var statusEl = card.querySelector("[data-lt-waste-status]");
        if (statusEl) {
          statusEl.style.color = overNow ? "#DC2626" : "#6B7280";
          statusEl.style.fontWeight = overNow ? "700" : "400";
          statusEl.textContent = overNow ? ("\u26A0\uFE0F Over your " + cfgNow.minutes + " min budget!") : ("Budget: " + cfgNow.minutes + " min/day");
        }
      }, 2000);
    }
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — Streaks & Badges page (surfaces the existing self-dev streak
     tracked in STREAK_KEY, plus tiered badges).
  ══════════════════════════════════════════════════════════════════════════ */

  var STREAK_BADGE_TIERS = [
    { days: 7,  name: "7-Day Focus Warrior" },
    { days: 14, name: "14-Day Time Master" },
    { days: 30, name: "30-Day Life Champion" }
  ];

  function renderStreaksBadges() {
    var streak = readJson(STREAK_KEY, { lastDate: "", count: 0 });

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Streaks & Badges", "Your self-development streak and the badges you\u2019ve unlocked.") +
        '<div class="lt-tool-card" style="text-align:center;">' +
          '<div style="font-size:40px;">\uD83D\uDD25</div>' +
          '<div style="font-size:32px;font-weight:800;">' + (streak.count || 0) + ' day' + (streak.count === 1 ? "" : "s") + '</div>' +
          '<p style="color:#6B7280;">Consecutive days with 1hr+ self-development</p>' +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Badges</p>' +
          STREAK_BADGE_TIERS.map(function (t) {
            var earned = (streak.count || 0) >= t.days;
            return '<div class="lt-history-row" style="' + (earned ? "" : "opacity:.45;") + '"><span>' + (earned ? "\uD83C\uDFC6" : "\uD83D\uDD12") + ' ' + escapeHtml(t.name) + '</span><strong>' + t.days + 'd</strong></div>';
          }).join("") +
        '</div>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE 5 — Achievements: meaningful milestones computed from real
     tracked data (not arbitrary badges).
  ══════════════════════════════════════════════════════════════════════════ */

  function computeAchievementStats() {
    var db = readJson(LOCAL_DB_KEY, { activities: [], blocks: [] });
    var activities = Array.isArray(db.activities) ? db.activities : [];
    var blocks = Array.isArray(db.blocks) ? db.blocks : [];
    var actById = {};
    activities.forEach(function (a) { actById[a.id] = a; });

    var learnRe = /learn|study|studying|course|read|book|class|tutorial/i;
    var fitRe   = /gym|work\s?out|running?|exercise|fitness|yoga|walk|sport|swim|cycl/i;

    var totalSeconds = 0, learningSeconds = 0, fitnessSeconds = 0;
    var datesSet = {};

    blocks.forEach(function (b) {
      if (!b.startTime) return;
      var start = new Date(b.startTime).getTime();
      var end = b.endTime ? new Date(b.endTime).getTime() : Date.now();
      var secs = Math.max(0, Math.floor((end - start) / 1000));
      totalSeconds += secs;
      var act = actById[b.activityId];
      var name = (act && act.name) || "";
      if (learnRe.test(name)) learningSeconds += secs;
      if (fitRe.test(name)) fitnessSeconds += secs;
      datesSet[new Date(b.startTime).toISOString().slice(0, 10)] = true;
    });

    var dates = Object.keys(datesSet).sort();
    var longestStreak = 0, currentRun = 0, prevDate = null;
    dates.forEach(function (d) {
      if (prevDate) {
        var diffDays = Math.round((new Date(d) - new Date(prevDate)) / 86400000);
        currentRun = diffDays === 1 ? currentRun + 1 : 1;
      } else {
        currentRun = 1;
      }
      if (currentRun > longestStreak) longestStreak = currentRun;
      prevDate = d;
    });

    return {
      totalHours: totalSeconds / 3600,
      learningHours: learningSeconds / 3600,
      fitnessHours: fitnessSeconds / 3600,
      consecutiveDays: longestStreak,
    };
  }

  /* ══════════════════════════════════════════════════════════════════════════
     BUCKET LIST — dreams & goals stored in local device storage
  ══════════════════════════════════════════════════════════════════════════ */
  var BUCKET_KEY = "lt_bucket_list_v1";

  function bucketItems() { return readJson(BUCKET_KEY, []); }
  function saveBucketItems(items) { writeJson(BUCKET_KEY, items); }

  function renderBucketList() {
    function rebuild() {
      var items = bucketItems();
      activeOverlay.innerHTML =
        '<div class="lt-tool-shell">' +
          toolHeader("Bucket List", "Your dreams and goals \u2014 check them off as you live them.") +
          '<div style="margin-bottom:12px">' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">' +
              '<input id="lt-bl-input" type="text" placeholder="Add a dream or goal\u2026" style="border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:10px;padding:10px 14px;font-size:14px;font-family:inherit;outline:none;width:100%;box-sizing:border-box">' +
              '<div style="display:flex;gap:8px;align-items:center">' +
                '<label style="font-size:12px;font-weight:600;color:hsl(var(--muted-foreground))">Target date (optional):</label>' +
                '<input id="lt-bl-date" type="date" style="border:1px solid hsl(var(--border));background:hsl(var(--background));color:hsl(var(--foreground));border-radius:8px;padding:6px 10px;font-size:13px;font-family:inherit;outline:none">' +
              '</div>' +
              '<button id="lt-bl-add" type="button" class="lt-tool-primary" style="align-self:flex-end;padding:9px 20px">Add Dream</button>' +
            '</div>' +
          '</div>' +
          '<div id="lt-bl-list">' +
            (items.length === 0 ? '<p style="text-align:center;color:hsl(var(--muted-foreground));font-size:13px;margin:24px 0">No dreams yet \u2014 add one above!</p>' :
              items.map(function (item) {
                var dateStr = item.date ? ' <span style="font-size:11px;color:hsl(var(--muted-foreground));margin-left:8px">\uD83D\uDCC5 ' + item.date + '</span>' : "";
                return (
                  '<div class="lt-tool-card" style="display:flex;align-items:center;gap:10px;opacity:' + (item.done ? ".55" : "1") + '">' +
                    '<button type="button" data-bl-done="' + item.id + '" style="flex-shrink:0;width:22px;height:22px;border-radius:50%;border:2px solid ' + (item.done ? "#4cd97b" : "hsl(var(--border))") + ';background:' + (item.done ? "#4cd97b" : "transparent") + ';cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:900">' + (item.done ? "\u2713" : "") + '</button>' +
                    '<span style="flex:1;font-size:14px;font-weight:600;text-decoration:' + (item.done ? "line-through" : "none") + '">' + escapeHtml(item.text) + dateStr + '</span>' +
                    '<button type="button" data-bl-del="' + item.id + '" style="flex-shrink:0;border:none;background:none;color:#ff4d4d;font-size:18px;cursor:pointer;line-height:1">\u00d7</button>' +
                  '</div>'
                );
              }).join("")
            ) +
          '</div>' +
        '</div>';

      document.getElementById("lt-bl-add").addEventListener("click", function () {
        var inp  = document.getElementById("lt-bl-input");
        var datI = document.getElementById("lt-bl-date");
        var text = (inp && inp.value.trim()) || "";
        if (!text) { inp && (inp.style.borderColor = "#ff4d4d"); return; }
        var items2 = bucketItems();
        items2.unshift({ id: genId(), text: text, date: datI && datI.value ? datI.value : "", done: false, createdAt: new Date().toISOString() });
        saveBucketItems(items2);
        rebuild();
      });

      if (activeOverlay._blClickFn) {
        activeOverlay.removeEventListener("click", activeOverlay._blClickFn);
        activeOverlay._blClickFn = null;
      }
      activeOverlay._blClickFn = function (e) {
        var doneBtn = e.target.closest("[data-bl-done]");
        if (doneBtn) {
          var id = doneBtn.getAttribute("data-bl-done");
          var items3 = bucketItems();
          items3 = items3.map(function (it) { return it.id === id ? Object.assign({}, it, { done: !it.done }) : it; });
          saveBucketItems(items3);
          rebuild();
          return;
        }
        var delBtn = e.target.closest("[data-bl-del]");
        if (delBtn) {
          var id2 = delBtn.getAttribute("data-bl-del");
          saveBucketItems(bucketItems().filter(function (it) { return it.id !== id2; }));
          rebuild();
        }
      };
      activeOverlay.addEventListener("click", activeOverlay._blClickFn);
    }
    rebuild();
  }

  var USER_BADGES_KEY = "lt_user_badges_v1"; /* up to 3 personal badges user adds */

  function getUserBadges() { return readJson(USER_BADGES_KEY, []); }
  function saveUserBadges(b) { writeJson(USER_BADGES_KEY, b); }

  function computeAutoMilestones(stats) {
    var db    = readJson(LOCAL_DB_KEY, { activities: [] });
    var allActs = Array.isArray(db.activities) ? db.activities : [];
    /* Default (seeded) activities don’t count toward achievements */
    var acts  = allActs.filter(function (a) { return !a.isDefault; });
    var catEntries = catLogEntries();
    var hasFirstActivity = acts.length > 0;
    var hasFirstLog      = catEntries.length > 0;
    var totalTrackedDays = Object.keys((function () {
      var d = {}; catEntries.forEach(function (e) { if (e.date) d[e.date] = true; }); return d;
    })()).length;

    return [
      /* ── EASY ──────────────────────────────────────────── */
      { id:"first_act",   tier:"easy",   icon:"🎯", label:"First Activity Created",      desc:"Create your first activity",                current: hasFirstActivity ? 1 : 0,    target:1,   unit:"" },
      { id:"first_log",   tier:"easy",   icon:"📝", label:"First Time Logged",           desc:"Log time for the first time",               current: hasFirstLog ? 1 : 0,         target:1,   unit:"" },
      { id:"days3",       tier:"easy",   icon:"🔥", label:"3-Day Streak",                desc:"Track time 3 days in a row",                current: Math.min(stats.consecutiveDays, 3),  target:3,   unit:"days" },
      { id:"hr5",         tier:"easy",   icon:"⏱️", label:"5 Hours Tracked",             desc:"Track a total of 5 hours",                  current: Math.min(stats.totalHours, 5),       target:5,   unit:"h" },
      { id:"acts5",       tier:"easy",   icon:"📋", label:"5 Activities Created",        desc:"Have at least 5 activities",                current: Math.min(acts.length, 5),            target:5,   unit:"" },
      /* ── MEDIUM ─────────────────────────────────────────── */
      { id:"days7",       tier:"medium", icon:"📅", label:"7-Day Streak",                desc:"Track time 7 days in a row",                current: Math.min(stats.consecutiveDays, 7),  target:7,   unit:"days" },
      { id:"hr50",        tier:"medium", icon:"💪", label:"50 Hours Tracked",            desc:"Track a total of 50 hours",                 current: Math.min(stats.totalHours, 50),      target:50,  unit:"h" },
      { id:"learn10",     tier:"medium", icon:"📚", label:"10 Hours of Learning",        desc:"Log 10h of learning/study activities",       current: Math.min(stats.learningHours, 10),   target:10,  unit:"h" },
      { id:"days30",      tier:"medium", icon:"🗓️", label:"30-Day Streak",               desc:"Track time 30 days in a row",               current: Math.min(stats.consecutiveDays, 30), target:30,  unit:"days" },
      { id:"fit20",       tier:"medium", icon:"🏋️", label:"20 Hours of Fitness",         desc:"Log 20h of fitness/exercise activities",     current: Math.min(stats.fitnessHours, 20),    target:20,  unit:"h" },
      /* ── HARD ───────────────────────────────────────────── */
      { id:"learn100",    tier:"hard",   icon:"🎓", label:"100 Hours of Learning",       desc:"Log 100h of learning activities",            current: stats.learningHours,                 target:100, unit:"h" },
      { id:"fit500",      tier:"hard",   icon:"🏆", label:"500 Hours of Fitness",        desc:"Log 500h of fitness activities",             current: stats.fitnessHours,                  target:500, unit:"h" },
      { id:"total1000",   tier:"hard",   icon:"💎", label:"1,000 Tracked Hours",         desc:"Track a total of 1,000 hours",              current: stats.totalHours,                    target:1000,unit:"h" },
      { id:"streak365",   tier:"hard",   icon:"🌟", label:"365-Day Streak",              desc:"Track time every day for a year",           current: stats.consecutiveDays,               target:365, unit:"days" },
    ];
  }

  function renderAchievements() {
    function rebuild() {
      var stats      = computeAchievementStats();
      var milestones = computeAutoMilestones(stats);
      var userBadges = getUserBadges();

      var TIER_COLOR = { easy:"#22c55e", medium:"#f59e0b", hard:"#6366f1" };
      var TIER_LABEL = { easy:"Easy", medium:"Medium", hard:"Hard" };

      function renderMilestone(m) {
        var pct      = Math.min(100, Math.round((m.current / m.target) * 100));
        var unlocked = m.current >= m.target;
        return (
          '<div class="lt-tool-card" style="opacity:' + (unlocked ? "1" : ".85") + ';margin-bottom:8px">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
              '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="font-size:20px;line-height:1">' + m.icon + '</span>' +
                '<div>' +
                  '<div style="font-weight:700;font-size:13px">' + escapeHtml(m.label) + '</div>' +
                  '<div style="font-size:11px;opacity:.6;margin-top:1px">' + escapeHtml(m.desc) + '</div>' +
                '</div>' +
              '</div>' +
              '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
                '<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;background:' + TIER_COLOR[m.tier] + '22;color:' + TIER_COLOR[m.tier] + ';margin-bottom:2px">' + TIER_LABEL[m.tier] + '</span><br>' +
                (unlocked ? '<span style="color:#4cd97b;font-weight:800;font-size:12px">✓ Done</span>' : '<span style="opacity:.6;font-size:11px">' + (m.unit ? Math.floor(m.current) + ' / ' + m.target + ' ' + m.unit : (m.current >= 1 ? "Done" : "Pending")) + '</span>') +
              '</div>' +
            '</div>' +
            '<div style="height:7px;background:hsl(var(--border));border-radius:20px;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + (unlocked ? "#4cd97b" : TIER_COLOR[m.tier]) + ';border-radius:20px;transition:width .5s"></div>' +
            '</div>' +
          '</div>'
        );
      }

      /* Group milestones by tier */
      var byTier = { easy: [], medium: [], hard: [] };
      milestones.forEach(function (m) { byTier[m.tier].push(m); });

      /* Only show already-saved badges (with remove button) — no dashed "add" slots */
      var savedBadgesHtml = "";
      if (userBadges.length > 0) {
        savedBadgesHtml = userBadges.map(function (b, i) {
          return (
            '<div class="lt-tool-card" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
              '<span style="font-size:24px">' + escapeHtml(b.icon || "\uD83C\uDFC5") + '</span>' +
              '<div style="flex:1">' +
                '<div style="font-weight:700;font-size:13px">' + escapeHtml(b.name) + '</div>' +
                (b.desc ? '<div style="font-size:11px;opacity:.6">' + escapeHtml(b.desc) + '</div>' : '') +
              '</div>' +
              '<button type="button" data-badge-del="' + i + '" style="border:none;background:none;color:#ff4d4d;font-size:18px;cursor:pointer;line-height:1">\xd7</button>' +
            '</div>'
          );
        }).join("");
      }

      /* Milestone cards that are selectable (unlocked → pin/unpin, locked → error) */
      function renderSelectableMilestone(m) {
        var pct      = Math.min(100, Math.round((m.current / m.target) * 100));
        var unlocked = m.current >= m.target;
        var badges3  = getUserBadges();
        var isPinned = badges3.some(function (b) { return b.milestoneId === m.id; });
        var pinnedMark = isPinned ? ' <span style="font-size:10px;color:#4cd97b;font-weight:800">\u2605 Pinned</span>' : '';
        /* Show a lock badge on achievements the user hasn't unlocked yet */
        var lockBadge = !unlocked
          ? '<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;background:rgba(150,150,150,.15);color:rgba(150,150,150,.9);margin-left:4px">\uD83D\uDD12 Locked</span>'
          : '';
        return (
          '<div class="lt-tool-card" data-milestone-id="' + m.id + '" style="opacity:' +
            (unlocked ? "1" : ".7") + ';margin-bottom:8px;cursor:' + (unlocked ? 'pointer' : 'default') + ';' +
            (isPinned ? 'border-color:#4cd97b;' : (unlocked ? 'border-color:hsl(var(--primary)/.3);' : 'border-style:dashed;')) +
          '">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
              '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">' +
                '<span style="font-size:20px;line-height:1;flex-shrink:0">' + (unlocked ? m.icon : '\uD83D\uDD12') + '</span>' +
                '<div style="min-width:0">' +
                  '<div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(m.label) + pinnedMark + '</div>' +
                  '<div style="font-size:11px;opacity:.6;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(m.desc) + '</div>' +
                '</div>' +
              '</div>' +
              '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
                '<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;background:' + TIER_COLOR[m.tier] + '22;color:' + TIER_COLOR[m.tier] + ';margin-bottom:2px">' + TIER_LABEL[m.tier] + '</span><br>' +
                (unlocked
                  ? '<span style="color:#4cd97b;font-weight:800;font-size:12px">\u2713 Done</span>'
                  : '<span style="opacity:.6;font-size:11px">' + (m.unit ? Math.floor(m.current) + ' / ' + m.target + ' ' + m.unit : (m.current >= 1 ? "Done" : "Pending")) + '</span>') +
              '</div>' +
            '</div>' +
            '<div style="height:7px;background:hsl(var(--border));border-radius:20px;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + (unlocked ? "#4cd97b" : TIER_COLOR[m.tier]) + ';border-radius:20px;transition:width .5s"></div>' +
            '</div>' +
          '</div>'
        );
      }

      activeOverlay.innerHTML =
        '<div class="lt-tool-shell">' +
          toolHeader("Achievements", "Real milestones from your tracked time \u2014 plus your own badges.") +

          /* Milestones by tier */
          '<p style="font-size:11px;font-weight:800;letter-spacing:.06em;color:hsl(var(--muted-foreground));margin:0 0 8px">EASY</p>' +
          byTier.easy.map(renderMilestone).join("") +
          '<p style="font-size:11px;font-weight:800;letter-spacing:.06em;color:hsl(var(--muted-foreground));margin:12px 0 8px">MEDIUM</p>' +
          byTier.medium.map(renderMilestone).join("") +
          '<p style="font-size:11px;font-weight:800;letter-spacing:.06em;color:hsl(var(--muted-foreground));margin:12px 0 8px">HARD</p>' +
          byTier.hard.map(renderMilestone).join("") +
        '</div>';

      /* Helper: small toast message */
      function showAchToast(msg) {
        var t = document.getElementById("lt-ach-toast");
        if (t) t.remove();
        t = document.createElement("div");
        t.id = "lt-ach-toast";
        t.style.cssText = "position:fixed;bottom:90px;left:16px;right:16px;z-index:2147483647;" +
          "background:#1a2036;color:#fff;border-radius:12px;padding:13px 16px;" +
          "font-size:13px;font-weight:700;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.5)";
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.remove(); }, 2800);
      }

      /* Click handler: remove saved badge OR tap a milestone card.
         Important: remove any previously attached handler before adding a
         fresh one so that multiple rebuild() calls don't stack listeners and
         cause double-firing or stale-closure issues. */
      if (activeOverlay._achClickFn) {
        activeOverlay.removeEventListener("click", activeOverlay._achClickFn);
        activeOverlay._achClickFn = null;
      }
      activeOverlay._achClickFn = function (e) {
        /* Remove a saved/pinned badge */
        var delBtn = e.target.closest("[data-badge-del]");
        if (delBtn) {
          var idx = parseInt(delBtn.getAttribute("data-badge-del"), 10);
          var badges2 = getUserBadges();
          badges2.splice(idx, 1);
          saveUserBadges(badges2);
          rebuild();
          buildTimerAchievements(); /* refresh home-screen slots */
          return;
        }
        /* Tap a milestone card */
        var milCard = e.target.closest("[data-milestone-id]");
        if (milCard) {
          /* Re-compute milestones fresh so rebuild() closures are never stale */
          var freshStats = computeAchievementStats();
          var freshMilestones = computeAutoMilestones(freshStats);
          var milId   = milCard.getAttribute("data-milestone-id");
          var mil     = freshMilestones.filter(function (m) { return m.id === milId; })[0];
          if (!mil) return;
          var badges3 = getUserBadges();
          var already = badges3.some(function (b) { return b.milestoneId === milId; });
          if (mil.current < mil.target) {
            showAchToast("You don\u2019t own this achievement / badge yet");
            return;
          }
          if (already) {
            /* Unpin */
            saveUserBadges(badges3.filter(function (b) { return b.milestoneId !== milId; }));
            rebuild();
            buildTimerAchievements(); /* refresh home-screen slots */
            return;
          }
          if (badges3.length >= 3) {
            showAchToast("Max 3 badges. Tap \xd7 on a pinned badge to remove it first.");
            return;
          }
          badges3.push({ milestoneId: milId, icon: mil.icon, name: mil.label, desc: mil.desc });
          saveUserBadges(badges3);
          rebuild();
          buildTimerAchievements(); /* refresh home-screen slots immediately */
        }
      };
      activeOverlay.addEventListener("click", activeOverlay._achClickFn);
    }
    rebuild();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CURRENCY PICKER — bottom sheet, callable from anywhere
  ══════════════════════════════════════════════════════════════════════════ */

  function showCurrencyPicker(onChanged) {
    addStyle3();
    var existing = document.getElementById("lt-curr-sheet");
    if (existing) existing.remove();

    var cur = getCurrency();

    function buildOptions(filter) {
      var list = CURRENCIES.filter(function (c) {
        if (!filter) return true;
        var q = filter.toLowerCase();
        return c.code.toLowerCase().indexOf(q) !== -1 || c.label.toLowerCase().indexOf(q) !== -1;
      });
      return list.map(function (c) {
        return (
          '<div class="lt-curr-option' + (c.code === cur.code ? " lt-selected" : "") + '" data-code="' + c.code + '">' +
            '<span class="lt-curr-flag">' + c.flag + '</span>' +
            '<div class="lt-curr-info">' +
              '<div class="lt-curr-name">' + c.label + '</div>' +
              '<div class="lt-curr-sub">' + c.symbol + ' \u00b7 ' + c.code + '</div>' +
            '</div>' +
            '<span class="lt-curr-check">\u2713</span>' +
          '</div>'
        );
      }).join("") || '<p style="color:rgba(255,255,255,.4);padding:16px;text-align:center;font-size:13px">No results</p>';
    }

    var sheet = document.createElement("div");
    sheet.id = "lt-curr-sheet";
    sheet.innerHTML =
      '<div id="lt-curr-sheet-card">' +
        '<h3>Currency <button id="lt-curr-close">\u2715</button></h3>' +
        '<input id="lt-curr-search" placeholder="\uD83D\uDD0D Search currency\u2026" type="text">' +
        '<div id="lt-curr-list">' + buildOptions("") + '</div>' +
      '</div>';
    document.body.appendChild(sheet);

    var searchEl = document.getElementById("lt-curr-search");
    var listEl   = document.getElementById("lt-curr-list");

    searchEl.addEventListener("input", function () {
      listEl.innerHTML = buildOptions(searchEl.value.trim());
    });

    sheet.addEventListener("click", function (e) {
      var opt = e.target.closest(".lt-curr-option");
      if (opt) {
        var code = opt.getAttribute("data-code");
        setCurrency(code);
        cur = getCurrency();
        sheet.remove();
        if (typeof onChanged === "function") onChanged(code);
        if (activeOverlay && activeOverlay._ltRenderFn) activeOverlay._ltRenderFn();
      }
      if (e.target.closest("#lt-curr-close") || e.target === sheet) sheet.remove();
    });
  }

  /* Injects a small "₹ INR ▾" chip into overlay headers so user can
     change currency without leaving the screen they're on. */
  function injectCurrencyChip(targetEl, onChanged) {
    if (!targetEl || targetEl.querySelector(".lt-curr-chip")) return;
    var cur = getCurrency();
    var chip = document.createElement("button");
    chip.className = "lt-curr-chip";
    chip.type = "button";
    chip.innerHTML = cur.symbol + " " + cur.code + " \u25BE";
    chip.addEventListener("click", function (e) {
      e.stopPropagation();
      showCurrencyPicker(function (code) {
        var newCur = getCurrency();
        chip.innerHTML = newCur.symbol + " " + newCur.code + " \u25BE";
        if (typeof onChanged === "function") onChanged(code);
      });
    });
    targetEl.appendChild(chip);
  }

  /* Currency switcher only lives in Settings. */
  function injectCurrencyChipsIntoOverlays() {
    if (location.pathname === "/settings") {
      safeRun(injectAccountCard);
      safeRun(gateTelegramSettings);
    } else {
      var stray = document.getElementById("lt-account-card");
      if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
      removeTelegramGateVisuals();
    }
  }

  /* ── Unified account card: Account / Plan / Currency, single light card ── */
  function injectAccountCard() {
    if (document.getElementById("lt-account-card")) return; /* don't tear down + rebuild every poll tick */
    var main = document.querySelector("main, [class*='settings'], [class*='content']") || document.querySelector("#root > div") || document.body;
    if (!main) return;
    addStyle3();

    var user = (window.LTAuth && window.LTAuth.currentUser()) || null;
    var cur = getCurrency();

    var card = document.createElement("div");
    card.id = "lt-account-card";
    card.setAttribute("data-lt-tile-injected", "1");
    card.style.cssText = "background:#fff;border:1px solid hsl(220 13% 88%);margin:0 0 16px;font-family:'Inter',sans-serif;";

    function rowLabel(text) {
      return '<p style="color:hsl(220 10% 48%);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">' + text + '</p>';
    }

    card.innerHTML =
      '<div style="padding:16px 20px;border-bottom:1px solid hsl(220 13% 92%)">' +
        rowLabel("Account") +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="min-width:0">' +
            '<p style="color:hsl(230 40% 16%);font-size:14px;font-weight:700;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (user && user.username ? escapeHtml(user.username) : (user && user.email ? escapeHtml(user.email) : "Signed in")) + '</p>' +
            '<p style="color:hsl(220 10% 55%);font-size:11px;margin:2px 0 0">\uD83D\uDFE3 Signed in via Pi Network</p>' +
          '</div>' +
          '<button id="lt-logout-btn" style="flex-shrink:0;background:#fff;border:1px solid hsl(0 72% 80%);color:hsl(0 72% 45%);padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Log out</button>' +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 20px;border-bottom:1px solid hsl(220 13% 92%)">' +
        rowLabel("Plan") +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<p style="color:hsl(230 40% 16%);font-size:14px;font-weight:700;margin:0">' + (isPro() ? "\u2B50 Pro" : "Free") + '</p>' +
          '<button id="lt-plan-toggle-btn" style="flex-shrink:0;background:#fff;border:1px solid hsl(230 40% 16%);color:hsl(230 40% 16%);padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">View Plans</button>' +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 20px">' +
        rowLabel("Display Currency") +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px">' +
          '<div style="display:flex;align-items:center;gap:10px;min-width:0">' +
            '<span style="font-size:22px">' + cur.flag + '</span>' +
            '<div style="min-width:0">' +
              '<p style="color:hsl(230 40% 16%);font-size:14px;font-weight:700;margin:0" id="lt-curr-settings-name">' + cur.label + '</p>' +
              '<p style="color:hsl(220 10% 55%);font-size:11px;margin:2px 0 0" id="lt-curr-settings-sub">' + cur.symbol + ' \u00b7 ' + cur.locale + '</p>' +
            '</div>' +
          '</div>' +
          '<button id="lt-curr-settings-btn" style="flex-shrink:0;background:#fff;border:1px solid hsl(220 13% 80%);color:hsl(230 40% 16%);padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Change</button>' +
        '</div>' +
      '</div>' +
      '<div style="padding:16px 20px;border-top:1px solid hsl(220 13% 92%)">' +
        rowLabel("Goal Type") +
        '<div id="lt-goal-type-options" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"></div>' +
        '<div id="lt-goal-milestone-input-wrap" style="display:none">' +
          '<input id="lt-goal-milestone-input" type="text" maxlength="24" placeholder="e.g. Buy a house" style="width:100%;background:hsl(220 15% 97%);border:1px solid hsl(220 13% 88%);padding:10px 12px;font-size:13px;color:hsl(230 40% 16%);font-family:inherit;box-sizing:border-box">' +
        '</div>' +
      '</div>';

    var goalOptions = [
      { type: "retirement", label: "\uD83C\uDFD6\uFE0F Retirement" },
      { type: "age",        label: "\uD83C\uDF82 Age Goal" },
      { type: "fire",       label: "\uD83D\uDD25 FIRE" },
      { type: "milestone",  label: "\uD83C\uDFAF Milestone" }
    ];
    var goalOptWrap = card.querySelector("#lt-goal-type-options");
    var storedGoal = readJson(GOAL_TYPE_KEY, { type: "retirement", milestoneLabel: "Milestone" });
    goalOptions.forEach(function (opt) {
      var active = storedGoal.type === opt.type;
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.label;
      b.style.cssText = "padding:10px 8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid " + (active ? "hsl(230 40% 16%)" : "hsl(220 13% 85%)") + ";background:" + (active ? "hsl(230 40% 16%)" : "#fff") + ";color:" + (active ? "#fff" : "hsl(230 40% 16%)") + ";";
      b.addEventListener("click", function () {
        setGoalType(opt.type, readJson(GOAL_TYPE_KEY, {}).milestoneLabel || "Milestone");
        card.remove();
        setTimeout(function () { safeRun(injectAccountCard); }, 0);
      });
      goalOptWrap.appendChild(b);
    });
    var milestoneWrap = card.querySelector("#lt-goal-milestone-input-wrap");
    if (storedGoal.type === "milestone") {
      milestoneWrap.style.display = "block";
      var mInput = card.querySelector("#lt-goal-milestone-input");
      mInput.value = storedGoal.milestoneLabel || "";
      mInput.addEventListener("change", function () {
        setGoalType("milestone", mInput.value.trim() || "Milestone");
      });
      mInput.addEventListener("blur", function () {
        setGoalType("milestone", mInput.value.trim() || "Milestone");
      });
    }

    /* IMPORTANT: never insert this as a *child* of `main` when `main` is
       a persistent, React-managed element (the app's own <main> route
       container, whose children React fully re-renders on every route
       change). Doing so used to add an untracked extra child into that
       node's child list; the next time React reconciled that subtree
       (e.g. leaving Settings and coming back to it) it could no longer
       match its expected DOM structure and would throw mid-commit,
       leaving the Settings screen stuck half-rendered (missing Profile /
       Browser permissions / Telegram sections and the bottom nav) until
       a full page reload started a fresh React tree. Inserting the card
       as a sibling BEFORE `main` keeps it completely outside React's own
       child list for that node, so it can never conflict with React's
       reconciliation no matter how many times Settings mounts/unmounts. */
    if (main !== document.body && main.parentNode) {
      main.parentNode.insertBefore(card, main);
    } else {
      main.insertBefore(card, main.firstChild);
    }

    document.getElementById("lt-logout-btn").addEventListener("click", function () {
      if (window.LTAuth) window.LTAuth.logout();
    });

    document.getElementById("lt-plan-toggle-btn").addEventListener("click", function () {
      showPlansScreen();
    });

    document.getElementById("lt-curr-settings-btn").addEventListener("click", function () {
      showCurrencyPicker(function () {
        var newCur = getCurrency();
        var nameEl = document.getElementById("lt-curr-settings-name");
        var subEl  = document.getElementById("lt-curr-settings-sub");
        var flagEl = card.querySelector("span[style*='font-size:22px']");
        if (nameEl) nameEl.textContent = newCur.label;
        if (subEl)  subEl.textContent  = newCur.symbol + " \u00b7 " + newCur.locale;
        if (flagEl) flagEl.textContent = newCur.flag;
      });
    });
  }

  /* ── Subscription plans selection screen (Pi app — real Pi payments) ── */
  var _plansPriceExpiresAt = 0;
  var _plansPriceTimer = null;
  var _plansPiUsdPrice = null;

  function getApiOrigin() {
    if (typeof window !== "undefined" && window.location) {
      var h = window.location.hostname;
      if (h === "piapp.minutics.com" || h === "localhost") return "";
    }
    return "https://piapp.minutics.com";
  }

  function fetchPiPrice(callback) {
    var apiOrigin = getApiOrigin();
    fetch(apiOrigin + "/api/price")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.piUsdPrice) {
          _plansPiUsdPrice = data.piUsdPrice;
          _plansPriceExpiresAt = data.expiresAt || 0;
          if (callback) callback(null, data);
        } else {
          if (callback) callback(new Error("No price data"));
        }
      })
      .catch(function (err) {
        if (callback) callback(err);
      });
  }

  function startPriceCountdown(el, expiresAt) {
    if (_plansPriceTimer) clearInterval(_plansPriceTimer);
    function tick() {
      var remaining = Math.max(0, expiresAt - Date.now());
      var mins = Math.floor(remaining / 60000);
      var secs = Math.floor((remaining % 60000) / 1000);
      if (el) el.textContent = "Price updates in " + mins + ":" + (secs < 10 ? "0" : "") + secs;
      if (remaining <= 0) {
        clearInterval(_plansPriceTimer);
        _plansPriceTimer = null;
      }
    }
    tick();
    _plansPriceTimer = setInterval(tick, 1000);
  }

  function showPlansScreen() {
    addStyle3();
    var existing = document.getElementById("lt-plans-modal");
    if (existing) existing.remove();

    var planDefs = [
      { id: "basic",    name: "Basic",    usd: 1,  period: "/month", desc: "Essential premium access for one month." },
      { id: "yearly",   name: "1 Year",   usd: 9,  period: "/year",  desc: "Full premium access for 12 months with one payment." },
      { id: "lifetime", name: "Lifetime", usd: 99, period: "",       desc: "Premium access with no expiration." },
    ];

    function piAmount(usd) {
      if (!_plansPiUsdPrice) return null;
      return (usd / _plansPiUsdPrice).toFixed(4);
    }

    function highlightPlan(planId, listEl) {
      listEl.querySelectorAll(".lt-plan-card").forEach(function (card) {
        var isActive = card.getAttribute("data-plan") === planId;
        card.style.borderColor = isActive ? "hsl(230 40% 16%)" : "hsl(220 13% 90%)";
        card.style.boxShadow = isActive ? "0 0 0 1px hsl(230 40% 16%), 0 4px 16px rgba(20,24,45,.1)" : (card.getAttribute("data-plan") === "yearly" ? "0 2px 12px rgba(0,0,0,.06)" : "0 1px 3px rgba(0,0,0,.03)");
        card.style.background = isActive ? "hsl(230 40% 97%)" : "#fff";
        var check = card.querySelector(".lt-plan-check");
        if (check) {
          check.style.background = isActive ? "hsl(230 40% 16%)" : "transparent";
          check.style.borderColor = isActive ? "hsl(230 40% 16%)" : (card.getAttribute("data-plan") === "yearly" ? "hsl(230 40% 16%)" : "hsl(220 13% 82%)");
          check.innerHTML = isActive ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '';
        }
      });
    }

    var selectedPlan = "yearly";

    var modal = document.createElement("div");
    modal.id = "lt-plans-modal";
    modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(20,24,45,.6);display:flex;align-items:center;justify-content:center;padding:20px;font-family:'Inter',sans-serif;";
    modal.innerHTML =
      '<div style="width:100%;max-width:520px;background:linear-gradient(180deg,#f8f7f4,#fff);border-radius:20px;box-shadow:0 25px 60px -12px rgba(0,0,0,.25);display:flex;flex-direction:column;max-height:90vh" id="lt-plans-card">' +
        '<div style="text-align:center;padding:28px 28px 0;flex-shrink:0">' +
          '<p style="color:hsl(230 40% 16%);font-size:20px;font-weight:800;margin:0 0 4px;letter-spacing:-.01em">Choose your plan</p>' +
          '<p style="color:hsl(220 10% 50%);font-size:13px;margin:0">Unlock all Minutics premium features</p>' +
        '</div>' +
        '<div id="lt-plans-timer-wrap" style="padding:0 28px;flex-shrink:0"></div>' +
        '<div id="lt-plans-list" style="display:flex;flex-direction:column;gap:14px;padding:16px 28px 0;overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;min-height:0"></div>' +
        '<div style="flex-shrink:0;padding:20px 28px 28px;border-top:1px solid hsl(220 13% 92%);margin-top:16px">' +
          '<div id="lt-plans-cta-wrap" style="text-align:center">' +
            '<button id="lt-plans-cta" style="width:100%;max-width:320px;background:hsl(230 40% 16%);border:none;color:#fff;padding:14px 24px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;border-radius:12px;transition:opacity .15s">Continue with 1 Year</button>' +
          '</div>' +
          '<button id="lt-plans-close" style="width:100%;background:transparent;border:none;color:hsl(220 10% 55%);padding:12px;font-size:13px;cursor:pointer;margin-top:2px;font-family:inherit">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    function closeModal() {
      modal.remove();
      if (_plansPriceTimer) { clearInterval(_plansPriceTimer); _plansPriceTimer = null; }
    }

    document.getElementById("lt-plans-close").addEventListener("click", closeModal);
    modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });

    function renderCards(piData) {
      var features = ["Premium features", "All Minutics tools"];
      var listEl = document.getElementById("lt-plans-list");
      if (!listEl) return;

      var planCards = planDefs.map(function (p, i) {
        var piAmt = piAmount(p.usd);
        var periodFeatures = p.id === "basic" ? ["1 month access"] : p.id === "yearly" ? ["12 months access", "One payment"] : ["Lifetime access", "No expiration"];
        var isPopular = p.id === "yearly";
        return '<div class="lt-plan-card" data-plan="' + p.id + '" style="background:#fff;border:2px solid ' + (isPopular ? "hsl(230 40% 16%)" : "hsl(220 13% 90%)") + ';border-radius:16px;padding:22px 22px 20px;cursor:pointer;transition:border-color .2s,box-shadow .2s;position:relative;box-shadow:' + (isPopular ? "0 2px 12px rgba(0,0,0,.06)" : "0 1px 3px rgba(0,0,0,.03)") + '">' +
          (isPopular ? '<div style="position:absolute;top:-11px;left:22px;background:hsl(230 40% 16%);color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:6px;letter-spacing:.03em">MOST POPULAR</div>' : '') +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">' +
            '<div style="flex:1">' +
              '<p style="color:hsl(220 10% 50%);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin:0 0 2px">' + p.name + '</p>' +
              '<div style="display:flex;align-items:baseline;gap:2px;margin:0 0 3px">' +
                '<span style="color:hsl(230 40% 16%);font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1">$' + p.usd + '</span>' +
                (p.period ? '<span style="color:hsl(220 10% 55%);font-size:13px;font-weight:600">' + p.period + '</span>' : '') +
              '</div>' +
              (piAmt ? '<p style="color:hsl(220 10% 50%);font-size:12px;margin:0">\u2248 ' + piAmt + ' PI</p>' : '<p style="color:hsl(220 10% 68%);font-size:12px;margin:0">Loading price\u2026</p>') +
            '</div>' +
            '<div class="lt-plan-check" style="width:24px;height:24px;border-radius:50%;border:2px solid ' + (isPopular ? "hsl(230 40% 16%)" : "hsl(220 13% 82%)") + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;transition:all .2s"></div>' +
          '</div>' +
          '<div style="border-top:1px solid hsl(220 13% 94%);padding-top:14px;margin-top:2px">' +
            '<p style="color:hsl(220 10% 45%);font-size:12.5px;margin:0 0 10px;line-height:1.45">' + p.desc + '</p>' +
            '<div style="display:flex;flex-direction:column;gap:7px">' +
              features.concat(periodFeatures).map(function (f) {
                return '<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:hsl(220 10% 38%);line-height:1.3"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="hsl(152 55% 42%)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' + f + '</div>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</div>';
      }).join("");

      listEl.innerHTML = planCards;

      var timerWrap = document.getElementById("lt-plans-timer-wrap");
      if (timerWrap) {
        if (piData && piData.expiresAt) {
          var remaining = Math.max(0, piData.expiresAt - Date.now());
          var mins = Math.floor(remaining / 60000);
          var secs = Math.floor((remaining % 60000) / 1000);
          timerWrap.innerHTML = '<p id="lt-plans-timer" style="color:hsl(220 10% 68%);font-size:11px;margin:0 0 16px;text-align:center;font-variant-numeric:tabular-nums">Price updates in ' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</p>';
          startPriceCountdown(document.getElementById("lt-plans-timer"), piData.expiresAt);
        } else {
          timerWrap.innerHTML = '';
        }
      }

      highlightPlan(selectedPlan, listEl);

      var piP = planDefs.find(function (x) { return x.id === selectedPlan; });
      var cta = document.getElementById("lt-plans-cta");
      if (cta) cta.textContent = "Continue with " + (piP ? piP.name : selectedPlan);

      listEl.querySelectorAll(".lt-plan-card").forEach(function (card) {
        card.addEventListener("click", function () {
          var planId = card.getAttribute("data-plan");
          if (selectedPlan === planId) {
            closeModal();
            showPiCheckout(planId);
          } else {
            selectedPlan = planId;
            highlightPlan(planId, listEl);
            var p = planDefs.find(function (x) { return x.id === planId; });
            if (cta) cta.textContent = "Continue with " + (p ? p.name : planId);
          }
        });
      });

      var ctaBtn = document.getElementById("lt-plans-cta");
      if (ctaBtn) {
        ctaBtn.addEventListener("click", function () {
          closeModal();
          showPiCheckout(selectedPlan);
        });
      }
    }

    if (_plansPiUsdPrice && Date.now() < _plansPriceExpiresAt) {
      renderCards({ piUsdPrice: _plansPiUsdPrice, expiresAt: _plansPriceExpiresAt });
    } else {
      renderCards(null);
      fetchPiPrice(function (err, data) {
        if (!err && data) renderCards(data);
      });
    }
  }

  /* Pi Network payment checkout for a specific plan */
  function showPiCheckout(planId) {
    var planDefs = { basic: { name: "Basic", usd: 1, period: "/month" }, yearly: { name: "1 Year", usd: 9, period: "/year" }, lifetime: { name: "Lifetime", usd: 99, period: "" } };
    var plan = planDefs[planId] || planDefs.yearly;

    addStyle3();
    var existing = document.getElementById("lt-checkout-modal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "lt-checkout-modal";
    modal.style.cssText = "position:fixed;inset:0;z-index:999999;background:rgba(20,24,45,.6);display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Inter',sans-serif;";
    modal.innerHTML =
      '<div style="width:100%;max-width:340px;background:#fff;border:1px solid hsl(220 13% 88%);padding:26px" id="lt-checkout-card">' +
        '<p style="color:hsl(220 10% 50%);font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px">Minutics ' + plan.name + '</p>' +
        '<p style="color:hsl(230 40% 16%);font-size:26px;font-weight:800;margin:0 0 2px">$' + plan.usd + '<span style="font-size:14px;color:hsl(220 10% 55%);font-weight:600">' + plan.period + '</span></p>' +
        '<p style="color:hsl(220 10% 50%);font-size:12px;margin:0 0 22px">Budget Tracker, full history & more</p>' +
        '<div id="lt-checkout-body">' +
          '<p style="color:hsl(220 10% 68%);font-size:11px;text-align:center;margin:0 0 12px">Fetching price and creating quote...</p>' +
          '<button id="lt-checkout-pay-btn" style="width:100%;background:#7C3AED;border:none;color:#fff;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;display:none;align-items:center;justify-content:center;gap:8px">\uD83D\uDFE3 Pay with Pi</button>' +
          '<button id="lt-checkout-cancel-btn" style="width:100%;background:transparent;border:none;color:hsl(220 10% 55%);padding:10px;font-size:12px;cursor:pointer;margin-top:6px;font-family:inherit">Close</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById("lt-checkout-cancel-btn").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

    /* Fetch price, create quote, then enable pay button */
    var currentQuote = null;
    fetchPiPrice(function (err, priceData) {
      if (err || !priceData) {
        var body = document.getElementById("lt-checkout-body");
        if (body) body.querySelector("p").textContent = "Unable to fetch Pi price. Please try again.";
        return;
      }
      var apiOrigin = getApiOrigin();
      fetch(apiOrigin + "/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planId: planId }),
      })
        .then(function (r) { return r.json(); })
        .then(function (quote) {
          currentQuote = quote;
          var piAmt = quote.piAmount ? quote.piAmount.toFixed(4) : "?";
          var body = document.getElementById("lt-checkout-body");
          if (!body) return;
          body.querySelector("p").textContent = "\u2248 " + piAmt + " PI ($" + quote.usdPrice + ")";
          var payBtn = document.getElementById("lt-checkout-pay-btn");
          payBtn.style.display = "flex";
          payBtn.textContent = "\uD83D\uDFE3 Pay " + piAmt + " PI";
        })
        .catch(function () {
          var body = document.getElementById("lt-checkout-body");
          if (body) body.querySelector("p").textContent = "Failed to create quote. Please try again.";
        });
    });

    document.getElementById("lt-checkout-pay-btn").addEventListener("click", function () {
      if (typeof Pi === "undefined") {
        alert("Pi Network SDK not loaded. Please open this app inside the Pi Browser.");
        return;
      }
      if (!currentQuote) {
        alert("Quote not ready. Please wait for the price to load.");
        return;
      }
      var btn = document.getElementById("lt-checkout-pay-btn");
      btn.disabled = true;
      btn.textContent = "Starting payment...";

      function showPayError(msg) {
        btn.disabled = false;
        btn.textContent = "\uD83D\uDFE3 Pay with Pi";
        var body = document.getElementById("lt-checkout-body");
        if (body && body.querySelector("p")) body.querySelector("p").textContent = msg;
      }

      function showProcessing() {
        var body = document.getElementById("lt-checkout-body");
        if (!body) return;
        body.innerHTML = '<div style="text-align:center;padding:30px 0"><div style="width:32px;height:32px;border:3px solid hsl(220 13% 88%);border-top-color:#7C3AED;border-radius:50%;margin:0 auto 14px;animation:lt-spin 0.8s linear infinite"></div><p style="color:hsl(220 10% 50%);font-size:13px;margin:0">Processing payment...</p></div>';
        if (!document.getElementById("lt-spin-kf")) {
          var kf = document.createElement("style");
          kf.id = "lt-spin-kf";
          kf.textContent = "@keyframes lt-spin{to{transform:rotate(360deg)}}";
          document.head.appendChild(kf);
        }
      }

      function showSuccess(label) {
        var body2 = document.getElementById("lt-checkout-body");
        if (!body2) return;
        body2.innerHTML =
          '<div style="text-align:center;padding:16px 0">' +
            '<div style="font-size:38px;margin-bottom:10px">\u2705</div>' +
            '<p style="color:hsl(230 40% 16%);font-size:15px;font-weight:800;margin:0 0 4px">Payment successful</p>' +
            '<p style="color:hsl(220 10% 50%);font-size:12px;margin:0 0 20px">You\'re now on Minutics ' + label + '</p>' +
            '<button id="lt-checkout-done-btn" style="width:100%;background:hsl(230 40% 16%);border:none;color:#fff;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Done</button>' +
          '</div>';
        document.getElementById("lt-checkout-done-btn").addEventListener("click", function () {
          modal.remove();
          setPlan("pro");
          refreshPlanGatedUI();
        });
      }

      function showErrorRetry() {
        var body3 = document.getElementById("lt-checkout-body");
        if (!body3) return;
        body3.innerHTML =
          '<div style="text-align:center;padding:16px 0">' +
            '<div style="font-size:38px;margin-bottom:10px">\u274C</div>' +
            '<p style="color:hsl(230 40% 16%);font-size:15px;font-weight:800;margin:0 0 4px">Payment failed</p>' +
            '<p style="color:hsl(220 10% 50%);font-size:12px;margin:0 0 20px">Please try again or check your Pi balance.</p>' +
            '<button id="lt-checkout-retry-btn" style="width:100%;background:#7C3AED;border:none;color:#fff;padding:13px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px">\uD83D\uDFE3 Try again</button>' +
            '<button id="lt-checkout-close2-btn" style="width:100%;background:transparent;border:none;color:hsl(220 10% 55%);padding:10px;font-size:12px;cursor:pointer;margin-top:6px;font-family:inherit">Close</button>' +
          '</div>';
        document.getElementById("lt-checkout-close2-btn").addEventListener("click", function () { modal.remove(); });
        document.getElementById("lt-checkout-retry-btn").addEventListener("click", function () {
          modal.remove();
          showPiCheckout(planId);
        });
      }

      var piAmount = currentQuote.piAmount;
      if (!Number.isFinite(piAmount) || piAmount <= 0) {
        showPayError("Invalid payment amount. Please try again.");
        return;
      }

      var planNames = { basic: "Minutics Basic", yearly: "Minutics 1 Year", lifetime: "Minutics Lifetime" };
      var memo = planNames[planId] || "Minutics Subscription";

      try {
        Pi.createPayment({
          amount: piAmount,
          memo: memo,
          metadata: { plan: planId, orderId: currentQuote.orderId },
        }, {
          onReadyForServerApproval: function (paymentId) {
            console.log("[Minutics] onReadyForServerApproval paymentId type=" + typeof paymentId + " len=" + (paymentId ? paymentId.length : 0));
            showProcessing();
            var apiOrigin = getApiOrigin();
            console.log("[Minutics] posting to " + apiOrigin + "/api/pi/payments/create");
            fetch(apiOrigin + "/api/pi/payments/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ paymentId: paymentId, quote: currentQuote }),
            }).then(function (r) {
              console.log("[Minutics] approve response status=" + r.status + " ok=" + r.ok);
              if (!r.ok) return r.json().then(function (d) {
                console.error("[Minutics] approve error body:", JSON.stringify(d));
                throw new Error(d.error || d.piMessage || "Payment approval failed");
              });
              return r.json().then(function (d) {
                console.log("[Minutics] approve success:", JSON.stringify(d).substring(0, 200));
              });
            }).catch(function (err) {
              console.error("Server approve failed:", err);
              showErrorRetry();
            });
          },
          onReadyForServerCompletion: function (paymentId, txid) {
            console.log("[Minutics] onReadyForServerCompletion paymentId len=" + (paymentId ? paymentId.length : 0) + " txid=" + (txid ? "present" : "missing"));
            var apiOrigin = getApiOrigin();
            fetch(apiOrigin + "/api/pi/payments/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ paymentId: paymentId, txid: txid, quote: currentQuote }),
            }).then(function (r) { return r.json(); }).then(function (d) {
              var label = (d && d.plan && d.plan.label) || plan.name;
              showSuccess(label);
            }).catch(function (err) {
              console.error("Server complete failed:", err);
              showErrorRetry();
            });
          },
          onError: function (error) {
            console.error("Pi payment error:", error);
            showPayError("Payment error: " + (error.message || "Please try again."));
          },
          onCancel: function (paymentId) {
            console.log("Pi payment cancelled:", paymentId);
            btn.disabled = false;
            btn.textContent = "\uD83D\uDFE3 Pay with Pi";
            var body = document.getElementById("lt-checkout-body");
            if (body && body.querySelector("p")) {
              var piAmt = currentQuote.piAmount ? currentQuote.piAmount.toFixed(4) : "?";
              body.querySelector("p").textContent = "\u2248 " + piAmt + " PI ($" + currentQuote.usdPrice + ")";
            }
          },
        });
      } catch (e) {
        console.error("Pi.createPayment threw:", e);
        showPayError("Could not start payment: " + (e.message || "Please try again."));
      }
    });
  }

  /* Re-render every plan-gated UI element after the plan changes */
  function refreshPlanGatedUI() {
    document.getElementById("lt-account-card") && document.getElementById("lt-account-card").remove();
    removeTelegramGateVisuals();
    document.querySelectorAll("[data-lt-tile-injected]").forEach(function (el) { el.remove(); });
    setTimeout(function () { safeRun(injectAccountCard); safeRun(gateTelegramSettings); }, 30);
  }

  /* ── Gate Telegram settings the same way Budget Tracker is gated: dim it,
     add a lock badge, and intercept taps with an upgrade prompt — instead
     of hiding it outright. ─────────────────────────────────────────────── */
  function removeTelegramGateVisuals() {
    var overlay = document.getElementById("lt-telegram-gate-overlay");
    if (overlay) overlay.remove();
    var badge = document.getElementById("lt-telegram-gate-badge");
    if (badge) badge.remove();
    var dimmed = document.querySelectorAll("[data-lt-telegram-dimmed]");
    for (var d = 0; d < dimmed.length; d++) {
      dimmed[d].style.opacity = "";
      dimmed[d].style.filter = "";
      dimmed[d].style.pointerEvents = "";
      dimmed[d].removeAttribute("data-lt-telegram-dimmed");
    }
  }

  function gateTelegramSettings() {
    if (isPro()) { removeTelegramGateVisuals(); return; }

    var headers = document.querySelectorAll("h2,h3,p");
    var headerWrap = null;
    for (var i = 0; i < headers.length; i++) {
      if (/telegram daily reports/i.test(headers[i].textContent || "")) {
        headerWrap = headers[i].closest("div") || headers[i];
        break;
      }
    }
    if (!headerWrap) {
      /* Not on this screen (or it hasn't rendered yet this pass) --
         clean up any leftover gate visuals so nothing lingers elsewhere. */
      removeTelegramGateVisuals();
      return;
    }
    var settingsBlock = headerWrap.nextElementSibling;

    /* Dim the real content IN PLACE, by setting styles directly on the
       nodes React already rendered -- never move/reparent them into a
       wrapper we create. Reparenting nodes React itself manages is
       unsafe: the next time React reconciles this part of the tree (e.g.
       leaving Settings and coming back to it) it can throw trying to
       update/remove a node that's no longer where it expects, which is
       exactly what could leave the whole Settings screen stuck
       half-rendered until a hard reload. */
    headerWrap.style.opacity = ".4";
    headerWrap.style.filter = "grayscale(.3)";
    headerWrap.style.pointerEvents = "none";
    headerWrap.setAttribute("data-lt-telegram-dimmed", "1");
    if (settingsBlock) {
      settingsBlock.style.opacity = ".4";
      settingsBlock.style.filter = "grayscale(.3)";
      settingsBlock.style.pointerEvents = "none";
      settingsBlock.setAttribute("data-lt-telegram-dimmed", "1");
    }

    /* Badge + click-catching overlay are free-floating elements appended
       to <body> (same pattern used everywhere else in this file for
       modals/overlays) instead of being inserted into the React-managed
       parent -- so they can be added, repositioned, or removed on every
       pass with zero risk to Settings' own DOM. Position is recomputed
       every call via positionVisuals() below (clamped so the overlay's
       click-catcher never reaches past the top of the fixed bottom nav
       bar), so it tracks the real content even if the layout shifts. */
    var overlay = document.getElementById("lt-telegram-gate-overlay");
    var badge = document.getElementById("lt-telegram-gate-badge");
    var isFirstAppearance = !overlay;

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "lt-telegram-gate-overlay";
      overlay.style.cssText = "position:absolute;z-index:1500;cursor:pointer;background:transparent;";
      overlay.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        showUpgradePrompt("Telegram daily reports are a Pro feature.");
      });
      document.body.appendChild(overlay);
    }
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "lt-telegram-gate-badge";
      badge.style.cssText = "position:absolute;z-index:1501;background:hsl(230 40% 16%);color:#fff;font-size:10px;font-weight:800;letter-spacing:.05em;padding:4px 9px;display:flex;align-items:center;gap:4px;pointer-events:none;";
      badge.innerHTML = "\uD83D\uDD12 PRO";
      document.body.appendChild(badge);
    }

    function positionVisuals() {
      var hRect = headerWrap.getBoundingClientRect();
      var bRect = (settingsBlock || headerWrap).getBoundingClientRect();
      var t = hRect.top + window.scrollY;
      var b = bRect.bottom + window.scrollY;
      var nav = document.querySelector(".fixed.bottom-0.left-0.right-0.z-50");
      if (nav) {
        var navT = nav.getBoundingClientRect().top + window.scrollY;
        if (b > navT) b = navT;
      }
      overlay.style.left = (hRect.left + window.scrollX) + "px";
      overlay.style.top = t + "px";
      overlay.style.width = hRect.width + "px";
      overlay.style.height = (b - t) + "px";
      badge.style.left = Math.max(0, hRect.right + window.scrollX - 78) + "px";
      badge.style.top = (t + 10) + "px";
    }

    /* First time this badge/overlay pair is created (e.g. right after
       navigating into Settings), the Telegram row's header text is
       already in the DOM but the rest of the screen -- the injected
       account card above it, the Goal Type buttons, etc. -- can still be
       a beat away from its final layout (React effects/data still
       settling). Positioning off that not-yet-settled rect is what put
       the badge up near the navy "Settings" banner for ~1s before the
       next poll/mutation pass recomputed it correctly and it visibly
       jumped down onto the Telegram row. Hide the pair on this first
       paint and reveal them only after multiple animation frames, by which
       point layout has settled, so they simply appear once, already in
       the right place -- no teleport. Every later call still repositions
       them live via positionVisuals() above, exactly as before. */
    if (isFirstAppearance) {
      overlay.style.visibility = "hidden";
      badge.style.visibility = "hidden";
      overlay.style.opacity = "0";
      badge.style.opacity = "0";
      
      // Use multiple animation frames to ensure layout is fully settled
      var framesToWait = 4;
      var frameCount = 0;
      
      function waitForSettledLayout() {
        frameCount++;
        if (frameCount < framesToWait) {
          requestAnimationFrame(waitForSettledLayout);
          return;
        }
        
        positionVisuals();
        overlay.style.visibility = "";
        badge.style.visibility = "";
        overlay.style.transition = "opacity 0.2s ease";
        badge.style.transition = "opacity 0.2s ease";
        overlay.style.opacity = "1";
        badge.style.opacity = "1";
      }
      
      requestAnimationFrame(waitForSettledLayout);
    } else {
      positionVisuals();
    }
  }

  /* Sweeps every text node in the document and swaps the literal "₹"
     glyph for the user's chosen currency symbol. Needed because the
     hardcoded ₹ in screens like the Time Value Calculator is baked
     into the compiled app bundle and re-renders as "₹" on every
     React update — this keeps it in sync with the saved currency. */
  function replaceRupeeGlobally() {
    var cur = getCurrency();
    if (cur.code === "INR") return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.indexOf("\u20B9") === -1) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (p && (p.tagName === "SCRIPT" || p.tagName === "STYLE" || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node, hits = [];
    while ((node = walker.nextNode())) hits.push(node);
    hits.forEach(function (n) {
      n.nodeValue = n.nodeValue.split("\u20B9").join(cur.symbol);
    });
    /* also cover input placeholder attributes that carry ₹ */
    document.querySelectorAll('input[placeholder*="\u20B9"]').forEach(function (inp) {
      inp.placeholder = inp.placeholder.split("\u20B9").join(cur.symbol);
    });
  }

  var nativeConfirm = window.confirm;
  window.confirm = function (msg) {
    if (typeof msg === "string" && msg.indexOf("date of birth and retire date") !== -1) {
      var goal = getGoalType();
      msg = msg.replace(/date of birth and retire date/g, "date of birth and " + goal.dateLabel.toLowerCase());
    }
    return nativeConfirm(msg);
  };

  /* ══════════════════════════════════════════════════════════════════════════
     FEATURE — 6 Jars Money Management System
     Implements T. Harv Eker's 6-jar system inside Life Hub.
     Reads the monthly salary from the Time Value Calculator (TIMEVALUE_KEY).
     If not set, shows a "setup required" gate identical to Life Value.
  ══════════════════════════════════════════════════════════════════════════ */

  var JARS_DEFAULTS = [
    { id: "nec",  name: "Necessities",       pct: 55, color: "#22c55e", light: "#dcfce7" },
    { id: "ffa",  name: "Financial Freedom", pct: 10, color: "#f59e0b", light: "#fef3c7" },
    { id: "ltss", name: "Long-Term Savings", pct: 10, color: "#8b5cf6", light: "#ede9fe" },
    { id: "ent",  name: "Entertainment/Fun", pct: 10, color: "#ef4444", light: "#fee2e2" },
    { id: "edu",  name: "Education/Knowledge", pct: 10, color: "#3b82f6", light: "#dbeafe" },
    { id: "give", name: "Donation",          pct:  5, color: "#ec4899", light: "#fce7f3" }
  ];

  function getJarsConfig() {
    var saved = readJson(JARS_KEY, null);
    if (!saved || !Array.isArray(saved.jars) || saved.jars.length !== 6) {
      var now = today();
      return {
        jars: JARS_DEFAULTS.map(function (d) {
          return { id: d.id, name: d.name, pct: d.pct, color: d.color, light: d.light, setupDate: now };
        }),
        setupDate: now
      };
    }
    return saved;
  }

  function saveJarsConfig(config) { writeJson(JARS_KEY, config); }

  /* 6 Jars now keeps its own monthly salary, set directly from within 6 Jars
     via the Edit button — it is completely independent of the Time Value
     Calculator now (no gate, no read/write coupling either direction).
     If nothing has been entered yet, this returns null and the UI shows an
     empty monthly-salary state instead of the old "setup required" gate. */
  function getJarsSalary() {
    var saved = readJson(JARS_SALARY_KEY, null);
    var v = saved && Number(saved.salary);
    return v > 0 ? v : null;
  }
  function setJarsSalary(v) {
    var n = Number(v);
    writeJson(JARS_SALARY_KEY, { salary: n > 0 ? n : null, updatedAt: Date.now() });
  }
  /* Back-compat alias used elsewhere in this file. */
  function getMonthlySalary() { return getJarsSalary(); }

  /* Fill = how far through the current calendar month we are (0 → 92 %). */
  function currentMonthFillPct() {
    var now  = new Date();
    var day  = now.getDate();                                          /* 1-31 */
    var last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); /* days in month */
    return Math.min(92, (day / last) * 92);
  }

  /* Render a single jar card HTML string.
     Primary number = monthly allocation (salary × pct%).
     Sub-label = estimated amount received so far this month. */
  function buildJarCard(jar, monthlySalary, idx) {
    var monthly     = monthlySalary * jar.pct / 100;
    var fillPct     = currentMonthFillPct();
    /* Amount received so far this month (pro-rated by day) */
    var soFarAmt    = monthly * (fillPct / 92);
    var delay       = (idx * 0.18).toFixed(2);
    return (
      '<div class="lt-jar-card">' +
        '<div class="lt-jar-body-wrap">' +
          '<div class="lt-jar-track">' +
            '<div class="lt-jar-liquid" id="lt-jliq-' + jar.id + '" style="background:' + jar.color + ';height:0%;transition-delay:' + delay + 's" data-fill="' + fillPct.toFixed(1) + '">' +
              '<div class="lt-jar-shine"></div>' +
              '<div class="lt-jar-bubble" style="animation-delay:' + (idx * 0.4).toFixed(1) + 's"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<span class="lt-jar-pct-pill" style="background:' + jar.color + '">' + jar.pct + '%</span>' +
        '<p class="lt-jar-name">' + escapeHtml(jar.name) + '</p>' +
        '<p class="lt-jar-saved">' + money(monthly) + '/mo</p>' +
        '<p class="lt-jar-monthly">~' + money(soFarAmt) + ' so far</p>' +
      '</div>'
    );
  }

  var _jarsAnimTimer = null;
  function triggerJarAnimation() {
    if (_jarsAnimTimer) clearTimeout(_jarsAnimTimer);
    _jarsAnimTimer = setTimeout(function () {
      document.querySelectorAll('.lt-jar-liquid[data-fill]').forEach(function (el) {
        el.style.height = (parseFloat(el.getAttribute('data-fill')) || 0) + '%';
      });
    }, 80);
  }

  function renderSixJars() {
    var monthlySalary = getJarsSalary();
    var config   = getJarsConfig();
    var totalPct = config.jars.reduce(function (s, j) { return s + (Number(j.pct) || 0); }, 0);

    /* Big primary "Set salary" button when nothing is set yet; once a salary
       exists it shrinks down to a small edit button next to the amount. */
    var salaryValHtml = monthlySalary
      ? '<span class="lt-jars-sum-val">' + money(monthlySalary) + '</span>'
      : '<span class="lt-jars-sum-val lt-jars-sum-empty">\u2014</span>';
    var editBtnHtml = monthlySalary
      ? '<button class="lt-jars-edit-salary-btn lt-jars-edit-salary-btn--small" id="lt-jars-edit-salary">\u270F\uFE0F Edit</button>'
      : '<button class="lt-jars-edit-salary-btn lt-jars-edit-salary-btn--big" id="lt-jars-edit-salary">Set Monthly Salary</button>';

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("6 Jars", "Your monthly salary split across 6 purposeful jars.") +
        '<div class="lt-jars-summary">' +
          '<div class="lt-jars-sum-item"><span class="lt-jars-sum-label">Monthly Salary</span>' + salaryValHtml + '</div>' +
          '<div class="lt-jars-sum-item"><span class="lt-jars-sum-label">Allocated</span><span class="lt-jars-sum-val">' + totalPct + '% of salary</span></div>' +
        '</div>' +
        '<div style="margin:-6px 0 16px">' + editBtnHtml + '</div>' +
        (monthlySalary ?
          '<div class="lt-jars-grid">' +
            config.jars.map(function (jar, i) { return buildJarCard(jar, monthlySalary, i); }).join("") +
          '</div>'
        :
          '<div class="lt-tool-card" style="text-align:center;padding:24px 16px;margin-bottom:16px">' +
            '<div style="display:flex;justify-content:center;align-items:center;margin-bottom:10px"><img src="assets/icons/jar-savings.png" style="width:64px;height:64px;object-fit:contain;opacity:.7"/></div>' +
            '<p class="lt-card-subtitle">Set your monthly salary above to see it split across the 6 jars.</p>' +
          '</div>'
        ) +
        '<button class="lt-jars-settings-btn" id="lt-jars-open-settings">\u2699\uFE0F\u2003Jar Settings</button>' +
      '</div>';

    if (monthlySalary) triggerJarAnimation();

    var settingsBtn = document.getElementById("lt-jars-open-settings");
    if (settingsBtn) settingsBtn.addEventListener("click", renderJarSettings);
    var editSalaryBtn = document.getElementById("lt-jars-edit-salary");
    if (editSalaryBtn) editSalaryBtn.addEventListener("click", renderJarSalaryEdit);
  }

  /* Small in-place sheet for setting/editing the 6 Jars monthly salary.
     Fully independent from the Time Value Calculator in both directions. */
  function renderJarSalaryEdit() {
    var current = getJarsSalary();
    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        toolHeader("Monthly Salary", "Used only for 6 Jars \u2014 separate from the Time Value Calculator.") +
        '<div class="lt-tool-card">' +
          '<label class="lt-form-label" for="lt-jars-salary-input">Monthly salary</label>' +
          '<input id="lt-jars-salary-input" class="lt-form-input" type="number" inputmode="decimal" min="0" step="1" placeholder="e.g. 50000" value="' + (current ? current : "") + '"/>' +
          '<div class="lt-form-actions" style="margin-top:16px;gap:10px">' +
            '<button class="lt-tool-secondary" id="lt-jars-salary-cancel">Cancel</button>' +
            '<button class="lt-tool-primary" id="lt-jars-salary-save">Save</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var input = document.getElementById("lt-jars-salary-input");
    var saveBtn = document.getElementById("lt-jars-salary-save");
    var cancelBtn = document.getElementById("lt-jars-salary-cancel");
    if (input) setTimeout(function () { input.focus(); }, 50);
    if (cancelBtn) cancelBtn.addEventListener("click", renderSixJars);
    if (saveBtn) saveBtn.addEventListener("click", function () {
      var v = input ? Number(input.value) : 0;
      setJarsSalary(v > 0 ? v : null);
      renderSixJars();
    });
  }

  function renderJarSettings() {
    var config = getJarsConfig();

    var rowsHtml = config.jars.map(function (jar, i) {
      return (
        '<div class="lt-jar-set-row">' +
          '<div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">' +
            '<div class="lt-jar-swatch" style="background:' + jar.color + '"></div>' +
            '<input class="lt-jar-set-name" data-idx="' + i + '" type="text" value="' + escapeHtml(jar.name) + '" maxlength="20" placeholder="Jar name"/>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
            '<input class="lt-jar-set-pct" data-idx="' + i + '" type="number" min="0" max="100" step="1" value="' + jar.pct + '"/>' +
            '<span style="font-size:12px;color:hsl(var(--muted-foreground));font-weight:700">%</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");

    var initTotal = config.jars.reduce(function (s, j) { return s + j.pct; }, 0);

    activeOverlay.innerHTML =
      '<div class="lt-tool-shell">' +
        '<div class="lt-tool-top">' +
          '<div>' +
            '<p class="lt-tool-kicker">Life Hub</p>' +
            '<h1 class="lt-tool-heading">Jar Settings</h1>' +
            '<p class="lt-tool-description">Rename jars and set monthly percentages. They should add up to 100%.</p>' +
          '</div>' +
          '<button class="lt-tool-close" id="lt-jar-back">\u2190 Back</button>' +
        '</div>' +
        '<div class="lt-tool-card">' +
          '<p class="lt-card-title">Your 6 jars</p>' +
          '<p class="lt-card-subtitle" id="lt-jar-total-msg">Total: ' + initTotal + '%' + (Math.abs(initTotal - 100) < 0.1 ? ' \u2713' : ' (should be 100%)') + '</p>' +
          '<div id="lt-jar-set-rows">' + rowsHtml + '</div>' +
        '</div>' +
        '<div class="lt-form-actions">' +
          '<button class="lt-tool-secondary" id="lt-jar-reset">Reset defaults</button>' +
          '<button class="lt-tool-primary" id="lt-jar-save">Save Settings</button>' +
        '</div>' +
      '</div>';

    function updateTotalLabel() {
      var total = 0;
      activeOverlay.querySelectorAll('.lt-jar-set-pct').forEach(function (inp) { total += Number(inp.value) || 0; });
      var msg = document.getElementById("lt-jar-total-msg");
      if (msg) {
        msg.textContent = "Total: " + total + "%" + (Math.abs(total - 100) < 0.1 ? " \u2713" : " (should be 100%)");
        msg.style.color = Math.abs(total - 100) < 0.1 ? "#22c55e" : "#ef4444";
      }
    }
    activeOverlay.querySelectorAll('.lt-jar-set-pct').forEach(function (inp) {
      inp.addEventListener('input', updateTotalLabel);
    });

    var backBtn = document.getElementById("lt-jar-back");
    if (backBtn) backBtn.addEventListener("click", renderSixJars);

    var resetBtn = document.getElementById("lt-jar-reset");
    if (resetBtn) resetBtn.addEventListener("click", function () {
      var now = today();
      saveJarsConfig({
        jars: JARS_DEFAULTS.map(function (d) {
          return { id: d.id, name: d.name, pct: d.pct, color: d.color, light: d.light, setupDate: now };
        }),
        setupDate: now
      });
      renderSixJars();
    });

    var saveBtn = document.getElementById("lt-jar-save");
    if (saveBtn) saveBtn.addEventListener("click", function () {
      var newJars = config.jars.map(function (jar, i) {
        var nameEl = activeOverlay.querySelector('.lt-jar-set-name[data-idx="' + i + '"]');
        var pctEl  = activeOverlay.querySelector('.lt-jar-set-pct[data-idx="' + i + '"]');
        var newName = (nameEl ? nameEl.value.trim() : "") || jar.name;
        var newPct  = pctEl ? Math.max(0, Math.min(100, Math.round(Number(pctEl.value) || 0))) : jar.pct;
        /* Reset setup date only if percentage changed so savings recalculate */
        var setupDate = (newPct !== jar.pct) ? today() : (jar.setupDate || today());
        return { id: jar.id, name: newName, pct: newPct, color: jar.color, light: jar.light, setupDate: setupDate };
      });
      var total = newJars.reduce(function (s, j) { return s + j.pct; }, 0);
      if (total <= 0 || total > 100) {
        alert("Percentages must add up to 100% or less. Currently: " + total + "%");
        return;
      }
      saveJarsConfig({ jars: newJars, setupDate: config.setupDate || today() });
      renderSixJars();
    });
  }

  /* Expose back-button handler for Android's onBackPressed */
  window.LTHandleBack = function () {
    if (activeOverlay) {
      closeOverlay();
      return true;
    }
    return false;
  };

  /* ── Timer tab: auto-scale content to screen size, no scrolling ───────────
     Bigger screen  → content zooms UP  to fill it.
     Smaller screen → content zooms DOWN to fit, nothing cut off.
     Activity sub-tab is exempt — it keeps normal scroll for its list.
     All other pages keep normal document scroll restored.

     RETRY LOGIC: on first app open (and returning from Activity tab) the
     React framework may not have finished painting when this first fires.
     We schedule up to MAX_RETRIES re-checks so the zoom always settles
     correctly without the user needing to switch tabs. */
  /* ── Timer-tab zoom: reliable single-pass implementation ─────────────────
     Clears zoom and opens overflow before measuring so scrollHeight always
     reflects the true 1× content height — not the clipped viewport height.
     Does NOT touch height/minHeight to avoid collapsing flex children.
     Returns true on success, false when DOM isn't ready yet.              */
  function applyTimerZoom() {
    /* Disabled — the Timer tab now uses plain normal scroll, same as
       every other tab, instead of this custom zoom-to-fit/no-scroll
       system. Kept as a no-op (rather than deleted) so the few remaining
       call sites below don't need to be touched. */
    return false;
    // eslint-disable-next-line no-unreachable
    var main = document.querySelector("main.overflow-y-auto") || document.querySelector("main");
    if (!main) return false;

    var navBar     = document.querySelector("nav");
    var navH       = (navBar && navBar.offsetHeight > 0) ? navBar.offsetHeight : 64;
    var containerH = window.innerHeight - navH;
    if (containerH <= 50) return false; /* viewport not ready */

    /* Set zoom to "1" (explicit) and open overflow so scrollHeight gives
       the true natural content height without any clamping. */
    main.style.zoom      = "1";
    main.style.overflowY = "visible";

    /* Reading scrollHeight forces a synchronous layout flush in Chromium */
    var naturalH = main.scrollHeight;

    /* Restore clip immediately */
    main.style.overflowY = "hidden";

    if (naturalH <= 50) return false; /* content not rendered yet */

    var rawScale = containerH / naturalH;
    var scale    = Math.max(0.68, Math.min(1.35, rawScale));

    /* If content is so tall that even the smallest allowed shrink (0.68x)
       still doesn't make it fit, don't keep clamping — that's what was
       cutting content off with no way to reach it. Fall back to normal
       scroll at the minimum readable scale instead, so everything is
       still reachable by scrolling down. */
    var stillOverflows = (naturalH * scale) > containerH + 1;

    main.style.zoom = String(scale);

    if (stillOverflows) {
      /* Let the page scroll instead of hiding the overflow. */
      document.documentElement.style.overflowY = "";
      document.body.style.overflowY             = "";
      main.style.overflowY               = "auto";
      main.style.webkitOverflowScrolling = "touch";
      main.style.paddingBottom           = "24px";
      return true;
    }

    /* Content fits at this scale — lock scroll as before. */
    document.documentElement.style.overflowY = "hidden";
    document.body.style.overflowY             = "hidden";
    window.scrollTo(0, 0);
    main.style.paddingBottom           = "0";
    main.style.webkitOverflowScrolling = "";
    return true;
  }

  /* Debounced zoom helper — collapses rapid duplicate calls into one */
  var _ltZoomDebounce = null;
  function scheduleZoom(delayMs) {
    clearTimeout(_ltZoomDebounce);
    _ltZoomDebounce = setTimeout(function () {
      if (location.pathname === "/" && _activeSubTab !== "activity") {
        applyTimerZoom();
      }
    }, delayMs || 0);
  }

  function lockTimerPageScroll() {
    /* The Timer tab used to have its own custom "auto-zoom to fit, no
       scroll" system (applyTimerZoom) that behaved completely differently
       from every other tab and was unreliable (mismeasurement, retries,
       content getting cut off/glitching depending on list length, keyboard,
       etc). That whole system is now disabled — the Timer tab just scrolls
       normally like every other tab, so this function unconditionally
       restores normal scroll everywhere. */
    var main = document.querySelector("main.overflow-y-auto") || document.querySelector("main");
    if (!main) return;

    document.documentElement.style.overflowY = "";
    document.body.style.overflowY             = "";
    main.style.overflowY               = "";
    main.style.minHeight               = "";
    main.style.height                  = "";
    main.style.zoom                    = "1";
    main.style.paddingBottom           = "";
    main.style.webkitOverflowScrolling = "touch";

    /* Reading scrollHeight forces Chromium to flush layout synchronously,
       so anything that just changed (cards resized/removed, #root's
       height rule above) is reflected immediately instead of leaving a
       stale, too-tall scroll range around until some unrelated layout
       event happens to trigger a recompute. This does NOT hide/replace
       `main` — an earlier version of this function briefly set
       `main.style.display = "none"` to force the same flush, but `main`
       is the actual scrollable element holding the user's scroll
       position, and hiding a scrollable element resets its scrollTop to
       0. That silently teleported the page to the top on every
       enhancement pass while scrolled anywhere. Reading scrollHeight
       gets the same forced-layout effect with no such side effect. */
    void main.scrollHeight;
  }

  /* Keep every user-facing duration on the same unit spelling. The native
     bundle uses the short "m" form in some refreshed list rows while the
     enhanced countdown uses "min". Normalizing text nodes at the DOM boundary
     prevents React re-renders from making the label appear to alternate. */
  function normalizeMinuteUnits() {
    if (!document.body) return;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      var parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/i.test(parent.tagName)) continue;
      var text = node.nodeValue || "";
      var normalized = text
        .replace(/(\d+)\s*m\b/g, "$1 min")
        .replace(/^(\s*)m(\s*)$/i, "$1min$2");
      if (normalized !== text) node.nodeValue = normalized;
    }
  }

  /* Every step below patches a live React tree that can re-render out from
     under us mid-pass (an element we looked up a line ago can already be
     gone). Each step used to run unguarded, so a single stale-element
     exception would abort the whole pass — including the later steps that
     restore normal scrolling and (crucially) whatever step the nav-mask
     handler was waiting on to call hideNavMask(). That's what caused the
     Settings screen to go permanently white: the mask went up, the pass
     threw partway through on that route, and nothing ever ran to lift it
     until a full reload reset everything. Wrapping every step individually
     means one bad step just gets skipped for this tick — everything else
     still runs, and the caller still gets back a normal return so its own
     cleanup (hideNavMask, etc.) always fires. */
  function safeRun(fn) {
    try { fn(); } catch (e) { if (window.console) console.error("[minutics enhancements]", fn.name || "step", e); }
  }

  function runEnhancements() {
    safeRun(addStyle);
    safeRun(addStyle2);
    safeRun(addStyle3);
    safeRun(seedDefaultActivities);
    safeRun(enforceActivityGraceIfNeeded);
    safeRun(updateActivityLimitBadge);
    safeRun(normalizeOriginalLabels);
    safeRun(hijackDateInputs);
    safeRun(ensureActivityActionDescriptions);
    safeRun(updateSavedTimeValueCard);
    safeRun(mountLifeHubTools);
    safeRun(pollRunningTimer);
    safeRun(injectJournalFullView);
    safeRun(upsertRunningBanner);
    safeRun(checkIdleNudge);
    safeRun(updateStreak);
    safeRun(buildLifeProgressCard);
    safeRun(buildEatTheFrogCard);
    safeRun(restyleTopNav);
    safeRun(injectCurrencyChipsIntoOverlays);
    safeRun(replaceRupeeGlobally);
    safeRun(normalizeMinuteUnits);
    safeRun(lockTimerPageScroll);
  }

  /* Runs the full enhancement pass, but throttled + de-duplicated so a burst
     of DOM mutations can't pile up multiple runs back-to-back (see notes at
     the bottom near where this is wired up to the MutationObserver). Kept
     at module scope so navigation handlers can also call the *immediate*
     variant below when a tab switch needs instant cleanup. */
  var _enhanceScheduled = false;
  var _lastEnhanceRun = 0;
  function scheduleEnhance() {
    if (_enhanceScheduled) return;
    _enhanceScheduled = true;
    window.requestAnimationFrame(function () {
      _enhanceScheduled = false;
      var now = Date.now();
      if (now - _lastEnhanceRun < 500) return;
      _lastEnhanceRun = now;
      if (!activeOverlay) runEnhancements();
    });
  }
  /* Bypasses the throttle entirely. Used right when we KNOW a tab/route
     changed (nav tap, pushState, popstate) — a normal throttled run can
     land up to ~500ms late, and if another tab switch happens inside that
     window the stray-tile cleanup in mountLifeHubTools() never gets a
     chance to run before the next mutation burst, which is exactly what
     let Life Hub tiles visibly leak into the Timer tab when switching
     quickly. This runs on the spot instead of waiting. */
  function runEnhancementsImmediate() {
    _enhanceScheduled = false;
    _lastEnhanceRun = Date.now();
    if (!activeOverlay) runEnhancements();
  }

  /* ── Nav-transition mask ──────────────────────────────────────────────────
     This whole enhancement layer works by watching the DOM after React has
     already painted, then hiding/restyling/replacing things a beat later
     (MutationObserver + a throttled poll). During any navigation — bottom
     nav taps, or the multi-step "jump to Time Value Calculator" flow — there
     is a real gap between "React painted the raw native screen" and "our
     script finished patching it", and in that gap the user briefly sees the
     unstyled native UI (raw Life Hub grid + its native search box, stray old
     tiles, etc.) before it's covered up. That's the flicker. Instead of
     trying to close that gap entirely (impossible with a polling patch),
     just paper over it visually: drop an opaque mask over the content the
     instant we know a transition is starting, and only lift it once a fresh
     enhancement pass has actually run. */
  var _navMaskEl = null;
  var _navMaskShownAt = 0;
  function showNavMask() {
    if (_navMaskEl) return;
    _navMaskShownAt = Date.now();
    _navMaskEl = document.createElement("div");
    _navMaskEl.id = "lt-nav-mask";
    /* Fall back to a real color instead of an unresolved CSS var. If
       document.body isn't fully styled yet (very early in a cold load,
       before the theme stylesheet has applied), `hsl(var(--background))`
       can resolve to nothing / black, which itself used to read as a
       "stuck black/white screen" even after the element was correctly
       removed on schedule. */
    var themeBg = "";
    try { themeBg = getComputedStyle(document.body).backgroundColor; } catch (e) {}
    _navMaskEl.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;" +
      "background:" + (themeBg && themeBg !== "rgba(0, 0, 0, 0)" ? themeBg : "#ffffff") + ";" +
      "pointer-events:none;";
    document.body.appendChild(_navMaskEl);
  }
  function hideNavMask() {
    if (!_navMaskEl) return;
    var el = _navMaskEl;
    _navMaskEl = null;
    _navMaskShownAt = 0;
    if (el.parentNode) el.parentNode.removeChild(el);
  }
  /* Safety net: never let the mask get stuck up if something in the
     transition flow fails to call hideNavMask(). */
  function showNavMaskWithTimeout(maxMs) {
    showNavMask();
    setTimeout(hideNavMask, maxMs || 1500);
  }
  /* Second, independent safety net. The per-call setTimeout above is only
     as reliable as the JS timer queue: if a burst of synchronous work (or
     another throw somewhere unrelated) delays that specific timer, the
     mask can still outlive its intended window. This watchdog doesn't
     depend on any call site remembering to schedule a cleanup — it just
     polls on its own and force-clears anything left over 2s, no matter
     what caused it or which code path was supposed to lift it. This is
     the actual fix for the "Settings screen stuck white" report: previously
     the *only* things that could lift the mask were the specific timers
     set up at the moment it was shown, and if any of those got skipped
     (or threw before reaching hideNavMask()), nothing else in the app
     would ever check on it again. */
  setInterval(function () {
    if (_navMaskEl && Date.now() - _navMaskShownAt > 2000) hideNavMask();
  }, 500);

  function installOverlayNavGuard() {
    function handleNav() { if (activeOverlay) closeOverlay(); runEnhancementsImmediate(); }
    window.addEventListener("popstate", handleNav);
    window.addEventListener("hashchange", handleNav);
    var _push = history.pushState;
    history.pushState = function () { var r = _push.apply(this, arguments); handleNav(); return r; };
    var _replace = history.replaceState;
    history.replaceState = function () { var r = _replace.apply(this, arguments); handleNav(); return r; };
    /* Fallback: bottom nav is plain buttons/links, not always routed via
       pushState — also close on any click outside the overlay itself. */
    document.addEventListener("click", function (e) {
      if (activeOverlay) {
        if (e.target.closest && e.target.closest("#lt-overlay-root")) return;
        var navBtn = e.target.closest("nav button, nav a, [data-lt-bottom-nav] button, [data-lt-bottom-nav] a");
        if (navBtn) closeOverlay();
      }
      /* Any tap on the bottom nav is a likely tab switch — even if we're
         not inside our own overlay right now. Schedule an immediate,
         throttle-bypassing cleanup pass shortly after so it lands once
         React has actually swapped the route content in, instead of
         racing it. But only mask/re-run if the tap is actually GOING
         somewhere new — re-tapping the tab you're already on shouldn't
         mask anything; that's what made it look like the page reloads
         in place when tapping the current tab. */
      var navTap = e.target.closest("nav button, nav a, [data-lt-bottom-nav] button, [data-lt-bottom-nav] a");
      if (navTap) {
        var isActivityTabTap = navTap.id === "lt-activity-navtab";
        var targetHref = navTap.getAttribute && navTap.getAttribute("href");
        var isSameTab = isActivityTabTap
          ? _activeSubTab === "activity"
          : (targetHref != null && targetHref === location.pathname && _activeSubTab !== "activity");
        if (!isSameTab) {
          showNavMaskWithTimeout(1000);
          setTimeout(function () { runEnhancementsImmediate(); hideNavMask(); }, 0);
          setTimeout(function () { runEnhancementsImmediate(); hideNavMask(); }, 120);
          /* Some screens (native Life Hub grid especially) still finish their
             own transition/render after 120ms on slower devices — take one
             more pass before fully trusting the page is settled. */
          setTimeout(function () { runEnhancementsImmediate(); hideNavMask(); }, 260);
        }
      }
    }, true);
  }

  function killHighlighting() {
    if (document.getElementById("lt-no-highlight-style")) return;
    var s = document.createElement("style");
    s.id = "lt-no-highlight-style";
    s.textContent =
      "*{-webkit-tap-highlight-color:transparent!important;" +
      "outline:none!important;box-shadow:none!important;}" +
      "*:focus,*:active,*:focus-visible{outline:none!important;" +
      "box-shadow:none!important;border-color:transparent!important;}";
    document.head.appendChild(s);
  }

  /* ── Display-over-other-apps (SYSTEM_ALERT_WINDOW) permission prompt ────
     Shown once profile setup is complete, for BOTH brand-new users (right
     after they finish onboarding) and pre-existing users who already have
     a profile from before this feature existed. Keeps re-checking on every
     load until the permission is actually granted OR the user explicitly
     skips it — a skip is permanent and the prompt never resurfaces after
     that (they can still grant it later from the phone's app settings). */
  var OVERLAY_SKIP_KEY = "lt_overlay_perm_skipped_v1";
  var _overlayModalShown = false;

  function overlayPermissionSkipped() {
    try { return localStorage.getItem(OVERLAY_SKIP_KEY) === "1"; } catch (e) { return false; }
  }

  function hasProfile() {
    try { return !!localStorage.getItem("lifetime_profile"); } catch (e) { return false; }
  }

  function showOverlayPermissionModal() {
    if (_overlayModalShown) return;
    if (document.getElementById("lt-overlay-perm-modal")) return;
    _overlayModalShown = true;

    var wrap = document.createElement("div");
    wrap.id = "lt-overlay-perm-modal";
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;" +
      "justify-content:center;background:rgba(0,0,0,0.5);";
    wrap.innerHTML =
      '<div style="width:100%;max-width:430px;background:#fff;border-top-left-radius:20px;' +
      'border-top-right-radius:20px;padding:24px 20px 20px;box-sizing:border-box;font-family:inherit;">' +
        '<p style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111;">Allow notifications?</p>' +
        '<p style="font-size:14px;line-height:1.5;color:#555;margin:0 0 20px;">' +
        'Minutics uses browser notifications to show routine reminders and your daily report, ' +
        'even when this tab isn\u2019t focused. You can change this anytime in your browser\u2019s site settings.' +
        '</p>' +
        '<button id="lt-overlay-perm-allow" style="width:100%;padding:14px;border:none;border-radius:12px;' +
        'background:#0369A1;color:#fff;font-weight:700;font-size:15px;margin-bottom:10px;">Allow</button>' +
        '<button id="lt-overlay-perm-skip" style="width:100%;padding:14px;border:1px solid #dc2626;' +
        'border-radius:12px;background:transparent;color:#dc2626;font-weight:700;font-size:15px;">' +
        'Skip, I will waste my time</button>' +
      '</div>';
    document.body.appendChild(wrap);

    document.getElementById("lt-overlay-perm-allow").addEventListener("click", function () {
      try {
        if (typeof window !== "undefined" && "Notification" in window) {
          window.Notification.requestPermission().then(function() {
            wrap.remove();
            _overlayModalShown = false;
          }).catch(function() {
            wrap.remove();
            _overlayModalShown = false;
          });
          return;
        }
      } catch (e) {}
      wrap.remove();
      _overlayModalShown = false;
    });
    document.getElementById("lt-overlay-perm-skip").addEventListener("click", function () {
      try { localStorage.setItem(OVERLAY_SKIP_KEY, "1"); } catch (e) {}
      wrap.remove();
      _overlayModalShown = false;
    });
  }

  function maybeShowOverlayPermissionModal() {
    if (!hasProfile()) return;          /* setup not finished yet */
    if (overlayPermissionSkipped()) return;
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (window.Notification.permission !== "default") return; /* already answered (granted or denied) */
      } else {
        return; /* Notifications not supported here at all */
      }
    } catch (e) { return; }
    showOverlayPermissionModal();
  }

  /* Re-check periodically: covers the moment a brand-new user finishes the
     onboarding form (profile appears mid-session) and covers returning to
     the app after granting/denying via the system Settings screen. */
  setInterval(maybeShowOverlayPermissionModal, 2000);

  document.addEventListener("DOMContentLoaded", function () {
    installOverlayNavGuard();
    killHighlighting();
    runEnhancements();
    setTimeout(maybeShowOverlayPermissionModal, 1200);
    /* Guard against a feedback loop: runEnhancements() itself writes to the
       DOM (restyled nav, replaced currency text, etc.), some of which is
       NOT wrapped in a [data-lt-enhancement]/[data-lt-tile-injected]
       container. Those writes count as "relevant" mutations, which used to
       immediately re-schedule another full runEnhancements() run, which
       writes to the DOM again, re-triggering the observer again — an
       unthrottled loop that quietly eats more and more CPU the longer the
       app sits idle, until an actual tap has to wait behind a backlog of
       queued runs (the multi-second freeze). Now: only one run may be
       scheduled at a time, and runs are throttled to at most one per 500ms
       (nav taps bypass this throttle via runEnhancementsImmediate above,
       so a fast tab switch still gets instant cleanup). */
    var observer = new MutationObserver(function (mutations) {
      if (activeOverlay) return;
      normalizeMinuteUnits();
      var relevant = mutations.some(function (m) {
        return !m.target.closest || !m.target.closest("[data-lt-enhancement],[data-lt-tile-injected]");
      });
      if (relevant) scheduleEnhance();
    });
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    /* Fast-poll for the first 9 seconds after cold start (well past the
       splash MAX_MS of 7s) so the zoom is always applied once the DOM is
       fully painted — not just during early partial renders. */
    var fastPolls = 0;
    var fastTimer = setInterval(function () {
      fastPolls++;
      if (!activeOverlay) runEnhancements();
      if (fastPolls >= 90) clearInterval(fastTimer); /* ~9s at 100ms */
    }, 100);
    setInterval(function () { if (!activeOverlay) runEnhancements(); }, 1500);

    /* Also re-apply zoom whenever the viewport resizes (rotation, etc.) */
    window.addEventListener("resize", function () {
      if (location.pathname === "/" && _activeSubTab !== "activity") {
        scheduleZoom(100);
      }
    });
  });
})();
