import { useState, useEffect, useRef, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createPortal } from 'react-dom';
import { saveProfile } from './lib/profile.js';
import { getCurrency, getCurrencySymbol } from './lib/currency.js';

const STEPS = ["welcome", "name", "dob", "salary"];
const IMGS = {
  welcome: "./assets/onboarding/welcome.png",
  name: "./assets/onboarding/name.png",
  dob: "./assets/onboarding/dob.png",
  salary: "./assets/onboarding/salary.png"
};
const GREEN = "#157347";

/* ── DOB pickers (month / year) ──────────────────────────────────────────
   The native <select> popup is an unstyled OS control that clashes badly
   with this card. These buttons open a themed sheet in the app's own   style: rounded chips, green selection, smooth entrance, auto-centred on   the current value. No native dropdown anywhere in onboarding. */
const PICKER_STYLE_ID = "lt-onb-picker-css";
if (typeof document !== "undefined" && !document.getElementById(PICKER_STYLE_ID)) {
  const st = document.createElement("style");
  st.id = PICKER_STYLE_ID;
  st.textContent =
    "@keyframes ltPkFade{from{opacity:0;}to{opacity:1;}}" +
    "@keyframes ltPkIn{from{opacity:0;transform:translateY(14px) scale(.97);}to{opacity:1;transform:none;}}";
  document.head.appendChild(st);
}

function SheetPicker({ title, display, value, options, onPick }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const sel = listRef.current && listRef.current.querySelector("[data-sel]");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "center" });
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const btn = jsx("button", {
    type: "button",
    "aria-haspopup": "listbox",
    onClick: () => setOpen(true),
    /* Value centred in the box (user request: values were hugging the far
       left with dead space on the right); the chevron stays pinned right. */
    className: "relative flex-1 flex items-center justify-center gap-1.5 bg-[#F5F6F8] border border-black/10 text-gray-900 text-base font-bold rounded-xl px-3 py-3 min-w-0 active:bg-white active:border-[#157347] transition-colors",
    children: [
      jsx("span", { className: "truncate", children: display }),
      jsx("svg", {
        width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "#6b7280",
        strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round",
        className: "shrink-0 absolute right-3",
        children: jsx("path", { d: "m6 9 6 6 6-6" })
      })
    ]
  });

  if (!open) return btn;
  return jsxs(Fragment, {
    children: [
      btn,
      createPortal(jsxs("div", {
        className: "fixed inset-0 z-[2147483000] flex items-end justify-center",
        style: { animation: "ltPkFade .16s ease both" },
        onClick: () => setOpen(false),
        children: [
          jsx("div", { className: "absolute inset-0 bg-black/45" }),
          jsxs("div", {
            ref: listRef,
            role: "listbox",
            "aria-label": title,
            onClick: g => g.stopPropagation(),
            className: "relative w-[88%] max-w-[350px] max-h-[60vh] overflow-y-auto overscroll-contain bg-white rounded-3xl p-3 pb-5",
            style: { animation: "ltPkIn .24s cubic-bezier(.2,.9,.3,1) both", boxShadow: "0 24px 60px rgba(2,32,72,.35)" },
            children: [
              jsx("div", { className: "px-1.5 pb-2.5 pt-1 text-[11px] font-black uppercase tracking-[.18em] text-gray-400", children: title }),
              jsx("div", { className: "grid grid-cols-3 gap-1.5", children: options.map(o => {
                const sel = String(o.v) === String(value);
                return jsx("button", {
                  type: "button",
                  "data-sel": sel ? "1" : undefined,
                  onClick: () => { onPick(o.v); setOpen(false); },
                  /* Every option sits in its own visible box (user request);
                     the chosen one fills green. */
                  className: (sel
                    ? "bg-[#157347] text-white border border-[#157347] shadow-[0_4px_10px_rgba(21,115,71,.3)]"
                    : "bg-[#F3F4F6] border border-black/10 text-gray-700 active:bg-white active:border-[#157347]") +
                    " py-2.5 rounded-xl text-sm font-bold transition-colors",
                  children: o.label
                }, o.v);
              }) })
            ]
          })
        ]
      }), document.body)
    ]
  });
}

/* Load every step illustration the moment the app opens (while the auth
   splash is still on screen). whenImageReady() holds a step transition
   until that image is downloaded AND decoded, so the next screen never
   shows a blank/loading pop-in when the user clicks Get Started / Next. */
const IMG_LOAD = {};
const IMG_READY = {};
Object.keys(IMGS).forEach((step) => {
  IMG_LOAD[step] = new Promise((resolve) => {
    const im = new Image();
    const done = () => { IMG_READY[step] = true; resolve(); };
    im.onload = () => { if (im.decode) im.decode().then(done, done); else done(); };
    im.onerror = done;
    im.src = IMGS[step];
  });
});
/* Warm the setup-loader background NOW (app open), not when the loader
   appears â€" the "Setting up your appâ€¦" screen must never pop in bare. */
try { const _sr = new Image(); _sr.src = "./assets/onboarding/setup-robot.png"; } catch {}
/* The idle animation is created + fetched AT APP OPEN (not when the loader
   shows). showSetupLoader() MOVES this same element into the loader, so its
   bytes and first frame are already warm — the animation starts instantly
   instead of showing the static poster for seconds first. */
const SETUP_ANIM = (() => {
  try {
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.poster = "./assets/onboarding/setup-robot.png";
    v.src = "./assets/onboarding/setup-anim.mp4";
    v.load();
    return v;
  } catch { return null; }
})();
function whenImageReady(step, cb) {
  const p = IMG_LOAD[step];
  if (!p || IMG_READY[step]) { cb(); return; }
  p.then(cb);
}

/* Singular-aware year labels ("1 year", never "1 years"). */
function yrs(n) {
  return n === 1 ? "1 year" : n + " years";
}
function yrsShort(n) {
  return n === 1 ? "1 yr" : n + " yrs";
}

export function mk({
  onComplete: e
}) {
  const [t, n] = useState("welcome"), [r, o] = useState(""), [s, i] = useState(""), [l, a] = useState(85), [dY, setDY] = useState(""), [dM, setDM] = useState(""), [dD, setDD] = useState(""), [sal, setSal] = useState(""), u = (() => {
    if (!s) return null;
    const g = new Date(s),
      v = new Date(g);
    v.setFullYear(v.getFullYear() + l);
    const x = (v.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1e3),
      k = (Date.now() - g.getTime()) / (365.25 * 24 * 3600 * 1e3);
    return {
      left: Math.max(0, x),
      lived: Math.max(0, k)
    }
  })(), d = (() => {
    if (u) return `${yrs(Math.floor(u.left))} left`;
    if (s) {
      const Hb = new Date(s);
      const Ib = Math.floor((Date.now() - Hb.getTime()) / (365.25 * 24 * 3600 * 1e3));
      return `${yrs(Math.max(0,l-Ib))} left`
    }
    return yrs(l)
  })(), idx = STEPS.indexOf(t), sym = (() => {
    try { return getCurrencySymbol(getCurrency().code); } catch { return "Rs."; }
  })();

  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const salaryNum = parseFloat(sal) || 0;

  function finish(saveSalary) {
    if (!r.trim() || !dobValid) return;
    const profile = {
      name: r.trim(),
      dob: s,
      lifespanYears: l
    };
    if (saveSalary && salaryNum > 0) {
      const hours = 8, days = 22;
      try {
        localStorage.setItem("lt_time_value_v1", JSON.stringify({
          perMinute: salaryNum / (hours * days * 60),
          salary: salaryNum,
          hours: hours,
          days: days,
          savedAt: Date.now()
        }));
      } catch {}
    }
    saveProfile(profile);
    showSetupLoader(profile);
  }

  function showSetupLoader(profileData) {
    /* â”€â”€â”€ PHASE 0: inject a CSS override that FORCES #root to stay hidden
       even after lt-authed is added. This prevents the flash of unstyled
       content that happens because React renders asynchronously â€” lt-authed
       gets added, #root becomes display:block, but enhancements haven't
       applied yet. We remove this rule only after enhancements are done. */
    var killSwitch = document.createElement("style");
    killSwitch.id = "lt-root-killswitch";
    killSwitch.textContent = "body.lt-authed #root{display:none!important}";
    (document.head || document.documentElement).appendChild(killSwitch);

    /* Phase 1: single playthrough of the idle animation (NO loop — when it
       ends, setup ends) + a progress bar that mirrors the playhead.
       Background set with
       LONGHAND properties â€” the old single-line `background:` shorthand
       silently failed to parse in some engines and left the loader
       transparent (you saw the bare cream page instead of space). */
    var loader = document.createElement("div");
    loader.id = "lt-signin-loader";
    loader.style.cssText = "position:fixed;inset:0;z-index:2147483647;" +
      "display:flex;flex-direction:column;align-items:center;justify-content:flex-end;" +
      "padding-bottom:26vh;gap:13px;transition:opacity .5s ease;opacity:1;";
    loader.style.backgroundColor = "#EEF1F7";
    /* Static art behind the video as last-resort fallback layer. */
    loader.style.backgroundImage = "url('./assets/onboarding/setup-robot.png')," +
      "radial-gradient(130% 95% at 50% 18%, #FFFFFF 0%, #E9EDF5 55%, #DCE2EE 100%)";
    loader.style.backgroundSize = "cover, cover";
    loader.style.backgroundPosition = "center 35%, center";
    loader.style.backgroundRepeat = "no-repeat, no-repeat";
    loader.innerHTML =
      '<p style="color:#3B4252;font-size:15px;font-weight:600;margin:0;font-family:inherit;text-shadow:0 1px 6px rgba(255,255,255,.85);position:relative">Setting up your app...</p>' +
      '<div class="lt-setup-bar" style="position:relative"><span class="lt-setup-bar-fill"></span></div>' +
      '<style>' +
      '.lt-setup-bar{width:min(240px,64vw);height:7px;border-radius:99px;background:rgba(17,24,39,.12);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.07)}' +
      '.lt-setup-bar-fill{position:absolute;left:0;top:0;width:0%;height:100%;border-radius:99px;background:linear-gradient(90deg,#4F46E5,#7C3AED);transition:width .15s linear;box-shadow:0 0 8px rgba(79,70,229,.45)}' +
      '</style>';
    /* Move the module-warmed video INTO the loader as the FIRST child (so
       the text/bar paint above it). Single playthrough (loop=false): when
       "ended" fires the setup ends. */
    var vid = SETUP_ANIM, videoDone = false;
    if (vid) {
      loader.insertBefore(vid, loader.firstChild);
      vid.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0";
      vid.loop = false;
      vid.muted = true;
      vid.defaultMuted = true;
      vid.addEventListener("ended", function () { videoDone = true; tryFinish(); });
      vid.addEventListener("error", function () {
        vid.style.display = "none";
        videoDone = true;
        tryFinish();
      });
      try { var pl = vid.play(); if (pl && pl.catch) pl.catch(function () {}); } catch {}
    } else {
      videoDone = true;
    }
    (document.body || document.documentElement).appendChild(loader);

    /* Progress bar — mirrors the REAL animation playhead (0→98% across the
       5s playthrough; boot-time curve as fallback when metadata is missing).
       It is forced to exactly 100% only by finishBar() at the moment BOTH
       the animation and the boot are done — the loader never fades on a
       non-full bar, so it can't stall at 99% or "finish" at 90%. */
    var fill = loader.querySelector(".lt-setup-bar-fill");
    var barDone = false;
    var barT0 = (window.performance && performance.now()) || 0;
    (function barTick(now) {
      if (barDone || !fill) return;
      var p;
      if (vid && vid.duration > 0 && isFinite(vid.duration)) {
        p = (vid.currentTime / vid.duration) * 98;
      } else {
        var el = (now || 0) - barT0;
        p = el < 3000
          ? (el / 3000) * 55
          : 55 + 40 * (1 - Math.exp(-(el - 3000) / 4500));
      }
      if (p > 98) p = 98;
      fill.style.width = p.toFixed(2) + "%";
      requestAnimationFrame(barTick);
    })(barT0);
    function finishBar() {
      if (barDone || !fill) return;
      barDone = true;
      fill.style.transition = "width .3s ease-out";
      fill.style.width = "100%";
    }

    /* Finish ONLY when both are true: the animation completed its single
       playthrough (no loop, so users never see it restart) AND the app is
       ready. Bar hits 100% exactly at that instant, settles, then fades. */
    var appReady = false, finished = false;
    function tryFinish() {
      if (finished || !videoDone || !appReady) return;
      finished = true;
      finishBar();
      setTimeout(function () {
        requestAnimationFrame(function () {
          loader.style.opacity = "0";
          setTimeout(function () {
            if (loader.parentNode) loader.parentNode.removeChild(loader);
          }, 500);
        });
      }, 420);
    }
    /* Safety: broken/unsupported media must never hang the loader — after
       15s fall back to boot-time alone. */
    var mediaSafety = setTimeout(function () { videoDone = true; tryFinish(); }, 15000);

    /* ABSOLUTE FAILSAFE: onComplete crashing (or enhancements never
       applying) must NEVER leave #root hidden forever behind the kill
       switch or the loader stuck on screen. Force the reveal after 12s. */
    setTimeout(function () {
      var ks = document.getElementById("lt-root-killswitch");
      if (ks && ks.parentNode) ks.parentNode.removeChild(ks);
      var ld = document.getElementById("lt-signin-loader");
      if (ld && ld.parentNode) {
        ld.style.opacity = "0";
        setTimeout(function () { if (ld.parentNode) ld.parentNode.removeChild(ld); }, 500);
      }
    }, 12000);

    /* Phase 2: render the main app immediately under the loader, then
       reveal the app as soon as React and the enhancement pass have
       settled — so once the animation ends the screen closes right away. */
    setTimeout(function () {
      try { e(profileData); } catch (err) { console.error("onboarding onComplete failed:", err); }
      /* Poll: wait for enhancements to apply (life-progress card or
         enhancement markers exist + body has lt-authed), then reveal the
         app underneath the still-opaque loader. */
      var checks = 0;
      var readyTimer = setInterval(function () {
        checks++;
        var hasAuth = document.body.classList.contains("lt-authed");
        var hasProgress = !!document.getElementById("lt-life-progress");
        var hasGlance = !!document.querySelector("[data-lt-enhancement]");
        if ((hasAuth && (hasProgress || hasGlance)) || checks > 100) {
          clearInterval(readyTimer);
          var ks = document.getElementById("lt-root-killswitch");
          if (ks && ks.parentNode) ks.parentNode.removeChild(ks);
          clearTimeout(mediaSafety);
          appReady = true;
          tryFinish();
        }
      }, 50);
    }, 100);
  }

  /* â”€â”€ shared chrome: back button + progress dots â”€â”€ */
  // Re-kick the preload when onboarding mounts (covers cache evictions).
  useEffect(() => {
    Object.keys(IMGS).forEach((k) => { const im = new Image(); im.src = IMGS[k]; });
  }, []);

  // Switch steps only once the target image is fully ready.
  const go = (step) => whenImageReady(step, () => n(step));

  const backBtn = idx > 0
    ? jsx("button", {
        type: "button",
        onClick: () => go(STEPS[idx - 1]),
        "aria-label": "Go back",
        className: "w-9 h-9 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 shrink-0",
        children: jsx("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", children: jsx("polyline", { points: "15 18 9 12 15 6" }) })
      })
    : jsx("div", { className: "w-9 shrink-0" });

  const dots = jsxs("div", {
    className: "flex-1 flex items-center justify-center gap-2",
    children: STEPS.map((_, k) => jsx("span", {
      className: "rounded-full transition-all",
      style: k <= idx
        ? { width: k === idx ? 20 : 8, height: 8, background: GREEN }
        : { width: 8, height: 8, background: "#E5E7EB" }
    }, k))
  });

  /* All four illustrations stay MOUNTED (inactive ones hidden) so a step
     switch is a pure visibility toggle â€” never a remount that blanks the
     <img> for a few frames while it reloads/re-decodes (the 0.3s flicker). */
  const img = jsxs("div", {
    className: "relative w-full max-w-[330px] mx-auto h-[42vh]",
    children: STEPS.map((step) => jsx("img", {
      src: IMGS[step],
      alt: "",
      draggable: false,
      "aria-hidden": step !== t,
      className: "absolute inset-0 w-full h-full object-contain select-none",
      style: { visibility: step === t ? "visible" : "hidden" }
    }, step))
  });

  const label = (text) => jsx("label", {
    className: "block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2",
    children: text
  });

  const nextBtn = (onClick, disabled, text) => jsx("button", {
    type: "button",
    onClick: onClick,
    disabled: disabled,
    className: "w-full py-4 rounded-xl font-bold text-base text-white transition-opacity",
    style: { background: GREEN, opacity: disabled ? 0.4 : 1 },
    children: text
  });

  /* â”€â”€ step bodies â”€â”€ */
  let body = null, footer = null;

  if (t === "welcome") {
    body = jsxs("div", {
      className: "text-center pt-10",
      children: [
        img,
        jsx("p", {
          className: "text-gray-500 text-sm leading-relaxed mt-2 px-2",
          children: "A few quick questions and your minutes will start tracking."
        })
      ]
    });
    footer = nextBtn(() => go("name"), false, "Get Started \u2192");
  }

  if (t === "name") {
    body = jsxs("div", {
      children: [
        img,
        jsx("div", { className: "mt-2", children: jsxs("div", {
          className: "bg-white border border-black/[.08] rounded-2xl px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.07)]",
          children: [
            label("Your name"),
            jsx("input", {
              type: "text",
              value: r,
              onChange: g => o(g.target.value.replace(/[^A-Za-z\s]/g, "")),
              placeholder: "e.g. Alex",
              autoFocus: true,
              className: "w-full bg-[#F5F6F8] border border-black/10 text-gray-900 text-lg font-semibold rounded-xl px-3.5 py-3 outline-none placeholder:text-gray-400 focus:bg-white focus:border-[#157347] focus:ring-2 focus:ring-[#157347]/15 transition-all"
            })
          ]
        }) })
      ]
    });
    footer = nextBtn(() => go("dob"), !r.trim(), "Next \u2192");
  }

  if (t === "dob") {
    const _maxYear = new Date().getFullYear();
    const _minYear = 1920;
    const _months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    /* Calendar view month/year: the picked DOB when set, otherwise the
       current month — so the day grid always renders something tappable. */
    const _now = new Date();
    const _viewY = dY || String(_now.getFullYear());
    const _viewM = dM || String(_now.getMonth() + 1).padStart(2, "0");
    const _viewYear = Number(_viewY);
    const _viewMonth = Number(_viewM);
    const _daysInMonth = new Date(_viewYear, _viewMonth, 0).getDate();
    const _firstWeekday = new Date(_viewYear, _viewMonth - 1, 1).getDay();
    const _ageYears = s
      ? Math.min(100, Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / (365.25 * 24 * 3600 * 1000))))
      : 0;
    const _updateDob = (y, m, dd) => {
      setDY(y);
      setDM(m);
      setDD(dd);
      if (y && m && dd) {
        const dayStr = String(dd).padStart(2, "0"),
          monStr = String(m).padStart(2, "0");
        i(y + "-" + monStr + "-" + dayStr);
        /* Keep retire age inside the slider range: never below the user's
           current age and never above 100 (min must stay <= max). */
        const age = Math.min(100, Math.max(0, Math.floor((Date.now() - new Date(y + "-" + monStr + "-" + dayStr).getTime()) / (365.25 * 24 * 3600 * 1000))));
        a(prev => Math.min(100, Math.max(prev, age)));
      } else {
        i("");
      }
    };
    body = jsxs("div", {
      children: [
        img,
        jsxs("div", { className: "mt-2 bg-white border border-black/[.08] rounded-2xl px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.07)]", children: [
          label("Date of birth"),
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsx(SheetPicker, {
                title: "Month",
                display: _months[_viewMonth - 1],
                value: _viewM,
                options: _months.map((mn, ii) => ({ v: String(ii + 1).padStart(2, "0"), label: mn })),
                onPick: v => _updateDob(dY || _viewY, v, dD)
              }),
              jsx(SheetPicker, {
                title: "Year",
                display: _viewY,
                value: _viewY,
                options: Array.from({ length: _maxYear - _minYear + 1 }, (_, ii) => {
                  const yy = _maxYear - ii;
                  return { v: String(yy), label: String(yy) };
                }),
                onPick: v => _updateDob(v, dM || _viewM, dD)
              })
            ]
          }),
          /* Calendar: weekday header + day grid. Tapping a day sets the DOB
             in one gesture (replaces the old Day/Month/Year triple — the day
             dropdown was the awkward one). Future dates are disabled. */
          jsx("div", {
            className: "grid grid-cols-7 gap-1 mt-3",
            children: ["S", "M", "T", "W", "T", "F", "S"].map((dn, ii) =>
              jsx("span", { className: "text-center text-[10px] font-black text-gray-400 py-1", children: dn }, "wd" + ii)
            )
          }),
          jsx("div", {
            className: "grid grid-cols-7 gap-1",
            children: [
              ...Array.from({ length: _firstWeekday }, (_, ii) => jsx("span", { key: "pad" + ii })),
              ...Array.from({ length: _daysInMonth }, (_, ii) => {
                const dd = ii + 1;
                const dd2 = String(dd).padStart(2, "0");
                const isSel = dD === dd2 && Number(dM) === _viewMonth && Number(dY) === _viewYear;
                const isFuture = new Date(_viewYear, _viewMonth - 1, dd).getTime() > _now.getTime();
                return jsx("button", {
                  type: "button",
                  disabled: isFuture,
                  onClick: () => _updateDob(_viewY, _viewM, dd2),
                  /* Every day is a visible circle chip (owner request); the
                     selected day keeps its filled green circle, future days
                     stay bare so "not pickable" still reads instantly. */
                  className: isSel
                    ? "h-9 w-9 mx-auto rounded-full bg-[#157347] text-white text-[13px] font-black shadow-[0_4px_10px_rgba(21,115,71,.35)]"
                    : isFuture
                      ? "h-9 w-9 mx-auto rounded-full text-gray-300 text-[13px] font-bold cursor-default"
                      : "h-9 w-9 mx-auto rounded-full bg-[#F1ECE0] border border-black/[.12] text-gray-800 text-[13px] font-bold shadow-[0_2px_6px_rgba(15,23,42,.09)] hover:bg-[#E9E2D2] hover:border-[#157347]/30 active:bg-[#DCFCE7] transition-colors",
                  children: String(dd)
                }, "day" + dd);
              })
            ]
          })
        ]}),
        jsxs("div", { className: "mt-3 bg-white border border-black/[.08] rounded-2xl px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.07)]", children: [
          jsxs("label", {
            className: "block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2",
            children: ["Retire age \u2014 ", jsx("span", { style: { color: GREEN }, children: d })]
          }),
          jsx("input", {
            type: "range",
            min: _ageYears,
            max: 100,
            step: 1,
            value: Math.min(100, Math.max(l, _ageYears)),
            onChange: g => a(Number(g.target.value)),
            className: "w-full accent-[#157347]"
          }),
          jsxs("div", {
            className: "flex justify-between text-xs text-gray-400 mt-1",
            children: [
              jsx("span", { children: yrsShort(_ageYears) }),
              jsx("span", { children: "100 yrs" })
            ]
          })
        ]}),
        u && s && jsxs("div", { className: "mt-3 bg-white border border-black/[.08] rounded-2xl px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.07)]", children: [
          label("Your timeline"),
          jsxs("div", {
            className: "flex h-4 w-full border border-[#E5DFCF] overflow-hidden rounded-full",
            children: [
              jsx("div", { className: "h-full", style: { width: `${Math.min(100, u.lived / Math.max(1, l) * 100)}%`, background: GREEN } }),
              jsx("div", { className: "h-full", style: { width: `${Math.min(100, u.left / Math.max(1, l) * 100)}%`, background: GREEN, opacity: .25 } })
            ]
          }),
          jsxs("div", {
            className: "flex justify-between text-xs text-gray-400 mt-2",
            children: [
              jsx("span", { children: [yrsShort(Math.floor(u.lived)), " lived"] }),
              jsx("span", { children: [yrsShort(Math.floor(u.left)), " remaining"] })
            ]
          }),
          u.left > 0 && jsxs("p", {
            className: "text-sm text-gray-500 mt-2 font-medium",
            children: ["You have ~", jsx("strong", { style: { color: GREEN }, children: Math.floor(u.left * 365.25).toLocaleString() }), " days left."]
          })
        ]})
      ]
    });
    footer = nextBtn(() => go("salary"), !dobValid, "Next \u2192");
  }

  if (t === "salary") {
    body = jsxs("div", {
      children: [
        img,
        jsx("div", { className: "mt-2", children: jsxs("div", {
          /* Compact card (user: "the box of the salary is too big"): tighter
             padding + a lighter input — the card takes ~1/3 less height. */
          className: "bg-white border border-black/[.08] rounded-2xl px-3.5 py-3 shadow-[0_6px_20px_rgba(15,23,42,0.07)]",
          children: [
            label("Your monthly salary"),
            jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                jsx("span", { className: "text-base font-black text-gray-400 shrink-0", children: sym }),
                jsx("input", {
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  value: sal,
                  onChange: g => setSal(g.target.value),
                  placeholder: "e.g. 50,000",
                  autoFocus: true,
                  className: "w-full bg-[#F5F6F8] border border-black/10 rounded-xl px-3 py-2.5 text-gray-900 text-[15px] font-semibold outline-none placeholder:text-gray-400 focus:bg-white focus:border-[#157347] focus:ring-2 focus:ring-[#157347]/15 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                })
              ]
            }),
            jsx("p", {
              className: "text-[11px] text-gray-400 mt-1.5 leading-relaxed",
              children: "Powers your Time Value Calculator \u2014 the value of every minute. You can change this later in Life Hub."
            })
          ]
        }) })
      ]
    });
    footer = jsxs("div", {
      className: "flex flex-col gap-2",
      children: [
        nextBtn(() => finish(true), !(salaryNum > 0), "Next \u2192"),
        jsx("button", {
          type: "button",
          onClick: () => finish(false),
          className: "w-full py-3 text-sm font-bold text-white rounded-xl transition-colors active:opacity-80",
          style: { background: "#DC2626" },
          children: "Skip for now"
        })
      ]
    });
  }

  return jsxs("div", {
    className: "min-h-[100dvh] bg-[#FDFBF7] flex flex-col",
    children: [
      jsxs("div", {
        className: "flex items-center gap-2 px-4 pt-10 pb-3",
        children: [backBtn, dots, jsx("div", { className: "w-9 shrink-0" })]
      }),
      jsx("div", {
        className: "flex-1 overflow-y-auto px-6 pb-4",
        children: body
      }),
      jsx("div", {
        /* safe-area: on Android 15 (targetSdk 35) the platform draws the
           page behind the system navigation bar, which covered the
           "Next" / "Get Started" CTAs — pad by the inset (0 when the
           native opt-out keeps content between the bars). */
        className: "px-6 pt-3 pb-8 bg-[#FDFBF7]",
        style: { paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))" },
        children: footer
      })
    ]
  });
}
