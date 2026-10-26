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

/* ── Onboarding redesign review flag — LOCALHOST ONLY ────────────────────
   The redesigned onboarding exists on the developer's machine and NOWHERE
   else until the owner approves it and flips ONB_NEW_DEFAULT to true:
     • only localhost / 127.0.0.1 can ever resolve the new design — even
       ?onboarding=new on the live site (or inside the APK) is ignored;
     • on localhost, ?onboarding=new switches this browser to the redesign
       (sticky via localStorage), ?onboarding=old switches back / clears it;
     • ONB_NEW_DEFAULT=false keeps the live site + APK on the current
       onboarding. Flipping it to true is what ships the redesign. */
const ONB_NEW_DEFAULT = false;
function onbLocalhostOnly() {
  try {
    const h = window.location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "";
  } catch { return false; }
}
function resolveOnbV2() {
  if (!onbLocalhostOnly()) {
    /* Not the dev machine: the redesign must never appear here — and any
       stray review flag a live URL could have planted is neutralized. */
    try { window.localStorage.removeItem("lt_onboarding_v2"); } catch {}
    return ONB_NEW_DEFAULT;
  }
  try {
    const q = new URLSearchParams(window.location.search).get("onboarding");
    if (q === "new") { window.localStorage.setItem("lt_onboarding_v2", "1"); return true; }
    if (q === "old") { window.localStorage.removeItem("lt_onboarding_v2"); return false; }
    return ONB_NEW_DEFAULT || window.localStorage.getItem("lt_onboarding_v2") === "1";
  } catch { return ONB_NEW_DEFAULT; }
}
const ONB_V2 = typeof window !== "undefined" ? resolveOnbV2() : ONB_NEW_DEFAULT;

/* ── Onboarding PREVIEW (localhost only, owner's review link) ────────────
   Opening localhost with ?onboarding=new must land DIRECTLY on the
   redesigned wizard — no welcome/register/login screen in front of it
   (the owner only asked for the onboarding to review, not the whole app).
   The preview never persists anything: finishing or skipping just returns
   to the normal welcome screen. If the real app takes over (demo engine /
   a login — the way tests enter), main.js drops the overlay and the
   in-app onboarding shows the same redesign. On the live site / in the APK
   the host gate above makes this impossible — no query param can ever
   trigger it there. */
const ONB_PREVIEW = (function () {
  try {
    return onbLocalhostOnly() && new URLSearchParams(window.location.search).get("onboarding") === "new";
  } catch { return false; }
})();
export { ONB_PREVIEW };

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

/* ── Redesigned onboarding chrome v5 (review-only, see ONB_NEW_DEFAULT) ──
   FULL REWORK after the owner rejected the sky/sheet version: this one
   deliberately does NOT reuse any login / register / Get-Started screen
   language — no navy star dome, no arch curve, no glassy dark chrome, no
   gradient pill CTA. Instead: a bright airy canvas — soft mint light
   fading down from the top, the mascot floating in it with a gentle bob
   and small glowing mint dots, a flat white content area, bold dark
   headings, solid green rounded CTA. The class name ".onb2-sky" is KEPT
   (the review suites key on it) but it is now the light illustration
   stage, not a night sky. Pure chrome — every functional element
   (pickers, calendar, chips, sliders, texts) is untouched, so all
   DOB-test contracts hold in BOTH modes. */
const ONB2_STYLE_ID = "lt-onb2-css";
if (typeof document !== "undefined" && !document.getElementById(ONB2_STYLE_ID)) {
  const st2 = document.createElement("style");
  st2.id = ONB2_STYLE_ID;
  st2.textContent =
    "@keyframes onb2In{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}" +
    "@keyframes onb2Float{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}" +
    "@keyframes onb2Dot{0%,100%{opacity:.35;transform:scale(.8);}50%{opacity:.95;transform:scale(1.1);}}" +
    "@keyframes onb2Glow{0%,100%{opacity:.55;}50%{opacity:.95;}}" +
    ".onb2-step{animation:onb2In .32s cubic-bezier(.22,1,.36,1) both;}" +
    /* Light illustration stage (class name kept for the review suites):
       a soft mint wash that fades into pure white — flat, no dome curve. */
    ".onb2-sky{" +
      "position:relative;flex-shrink:0;overflow:hidden;pointer-events:none;" +
      "background:radial-gradient(120% 95% at 50% -5%,#E4F6EC 0%,#F1FAF5 55%,#FFFFFF 100%);" +
    "}" +
    /* Soft mint halo behind the mascot. */
    ".onb2-glow{" +
      "position:absolute;left:50%;bottom:4px;width:min(300px,82%);height:150px;transform:translateX(-50%);" +
      "background:radial-gradient(50% 55% at 50% 55%,rgba(21,115,71,.15) 0%,rgba(21,115,71,0) 72%);" +
      "filter:blur(7px);animation:onb2Glow 5s ease-in-out infinite;pointer-events:none;" +
    "}" +
    /* The floating illustration (transparent PNG on the light stage) —
       a GREEN-tinted shadow, not the dark night-shadow of v3. */
    ".onb2-art{" +
      "animation:onb2Float 5.2s ease-in-out infinite;" +
      "filter:drop-shadow(0 16px 22px rgba(21,115,71,.16));" +
    "}" +
    /* Small glowing mint dots drifting around the mascot. */
    ".onb2-spark{" +
      "position:absolute;border-radius:50%;background:#34D399;pointer-events:none;" +
      "box-shadow:0 0 10px rgba(52,211,153,.75),0 0 22px rgba(52,211,153,.35);" +
      "animation:onb2Dot 4.6s ease-in-out infinite;" +
    "}" +
    /* Flat white content area (no curved lip, no drop shadow). */
    ".onb2-sheet{" +
      "position:relative;z-index:10;flex:1;min-height:0;" +
      "background:#FFFFFF;display:flex;flex-direction:column;" +
    "}" +
    "@media (prefers-reduced-motion:reduce){" +
      ".onb2-step,.onb2-art,.onb2-spark,.onb2-glow{animation:none!important;}" +
    "}";
  document.head.appendChild(st2);
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
  onComplete: e,
  /* preview: localhost review overlay — finish/skip must NOT save a profile
     or boot the app, they only hand control back to the welcome screen. */
  preview: pv
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
    /* Review preview: nothing is ever written — close and show the normal
       welcome screen again (localStorage + profile stay untouched). */
    if (pv) { try { if (e) e(null); } catch {} return; }
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
        className: ONB_V2
          ? "pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full text-gray-500 bg-white border border-black/10 shadow-sm active:bg-gray-50 shrink-0"
          : "w-9 h-9 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 shrink-0",
        children: jsx("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", children: jsx("polyline", { points: "15 18 9 12 15 6" }) })
      })
    : jsx("div", { className: "w-9 shrink-0" });

  /* Progress: v1 keeps the dots; v2 shows "Step x of 4" + filling
     segments — dark ink on the light stage (never white-on-navy). */
  const dots = ONB_V2
    ? jsxs("div", {
        className: "flex-1 flex flex-col items-center justify-center gap-1.5",
        children: [
          jsx("span", { className: "text-[11px] font-bold tracking-[.14em] uppercase text-gray-400", children: `Step ${idx + 1} of ${STEPS.length}` }),
          jsxs("div", { className: "flex w-[152px] gap-1.5", children: STEPS.map((_, k) => jsx("span", {
            key: k,
            className: "h-1.5 flex-1 rounded-full transition-all duration-300",
            style: k <= idx
              ? { background: GREEN }
              : { background: "#E5E7EB" }
          })) })
        ]
      })
    : jsxs("div", {
        className: "flex-1 flex items-center justify-center gap-2",
        children: STEPS.map((_, k) => jsx("span", {
          className: "rounded-full transition-all",
          style: k <= idx
            ? { width: k === idx ? 20 : 8, height: 8, background: GREEN }
            : { width: 8, height: 8, background: "#E5E7EB" }
        }, k))
      });

  /* Header (back + progress): v1 renders it on the cream page; v2 sits it
     INSIDE the light stage. pointer-events-auto is required here — the
     stage itself is pointer-events:none (art layer must not eat taps),
     which otherwise silently kills the back button. */
  const headerRow = jsxs("div", {
    className: "relative z-10 flex items-center gap-2 px-4 pt-10 pb-3",
    children: [backBtn, dots, jsx("div", { className: "w-9 shrink-0" })]
  });

  /* Stage height — ONE constant shared by the light stage and the art
     layer so the two always match. Kept modest so the form gets real
     room. */
  const DOME_H = "clamp(284px,42vh,374px)";

  /* v2 light stage: no star field, no night sky (that was the login
     screen's language) — just the soft mint wash with the header row. */
  const onb2Sky = ONB_V2
    ? jsxs("div", { className: "onb2-sky", style: { height: DOME_H },
        children: [
          headerRow
        ]
      })
    : null;

  /* All four illustrations stay MOUNTED (inactive ones hidden) so a step
     switch is a pure visibility toggle — never a remount that blanks the
     <img> for a few frames while it reloads/re-decodes (the 0.3s flicker).
     v2: no frame at all — the transparent PNG floats directly on the
     light stage (see artDome below); v1 keeps it inside the body. */
  const imgStack = jsxs("div", {
    className: ONB_V2
      ? "onb2-art relative w-[min(332px,90%)] h-[calc(100%-96px)] mx-auto"
      : "relative w-full max-w-[330px] mx-auto h-[42vh]",
    children: STEPS.map((step) => jsx("img", {
      src: IMGS[step],
      alt: "",
      draggable: false,
      "aria-hidden": step !== t,
      className: "absolute inset-0 w-full h-full object-contain select-none",
      style: { visibility: step === t ? "visible" : "hidden" }
    }, step))
  });
  /* v2 art layer: sits over the light stage (z above the content area,
     pointer-events off), bottom-aligned under the header. Height must
     equal the stage. Decorations are small glowing MINT dots (5), staggered
     — no gold night-sky sparkles here. */
  const artDome = ONB_V2
    ? jsx("div", {
        className: "pointer-events-none absolute inset-x-0 top-0 z-20 flex items-end justify-center pb-4",
        style: { height: DOME_H },
        "aria-hidden": true,
        children: [
          jsx("div", { className: "onb2-glow", "aria-hidden": true }),
          imgStack,
          jsx("span", { className: "onb2-spark", style: { left: "7%", bottom: "36%", width: 11, height: 11, animationDelay: "0s" } }, "s1"),
          jsx("span", { className: "onb2-spark", style: { right: "8%", bottom: "56%", width: 8, height: 8, animationDelay: "1.4s" } }, "s2"),
          jsx("span", { className: "onb2-spark", style: { right: "17%", bottom: "26%", width: 10, height: 10, animationDelay: "2.7s" } }, "s3"),
          jsx("span", { className: "onb2-spark", style: { left: "15%", bottom: "62%", width: 7, height: 7, animationDelay: "2.1s" } }, "s4"),
          jsx("span", { className: "onb2-spark", style: { right: "30%", bottom: "70%", width: 9, height: 9, animationDelay: "3.6s" } }, "s5")
        ]
      })
    : null;
  /* In v2 the art lives in the dome (artDome), not in the step bodies. */
  const bodyArt = ONB_V2 ? null : imgStack;

  const label = (text) => jsx("label", {
    className: "block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2",
    children: text
  });

  /* v2 CTA: SOLID green rounded button (no gradient, no pill — those
     belong to the login screens, which the owner wants kept out of the
     onboarding); CLEAN WARM GRAY when disabled (never the washed-out
     pale green the owner flagged). v1 keeps the original flat button. */
  const nextBtn = (onClick, disabled, text) => jsx("button", {
    type: "button",
    onClick: onClick,
    disabled: disabled,
    className: ONB_V2
      ? "w-full py-[17px] rounded-2xl font-bold text-[15.5px] transition-all active:scale-[.98]"
      : "w-full py-4 rounded-xl font-bold text-base text-white transition-opacity",
    style: ONB_V2
      ? (disabled
          ? { background: "#E9E4D7", color: "#9AA1AE", boxShadow: "none", cursor: "default" }
          : {
              background: GREEN,
              color: "#fff",
              boxShadow: "0 14px 28px -14px rgba(21,115,71,.65)"
            })
      : { background: GREEN, opacity: disabled ? 0.4 : 1 },
    children: text
  });

  /* Per-step headings (owner: every step needs a real title — the tiny
     uppercase field labels alone left the sheet feeling empty). */
  const head2 = (text) => ONB_V2
    ? jsx("h2", {
        className: "text-[23px] leading-tight font-extrabold tracking-tight text-[#14162E] text-center mb-3",
        children: text
      })
    : null;

  /* v3 card chrome: solid white cards resting on the cream sheet (the old
     frosted look only made sense over the old flat background). */
  const cardCls = ONB_V2
    ? "bg-white border border-black/[.06] rounded-3xl px-4 py-4 shadow-[0_10px_30px_rgba(20,32,80,0.10)]"
    : "bg-white border border-black/[.08] rounded-2xl px-4 py-4 shadow-[0_6px_20px_rgba(15,23,42,0.07)]";
  const cardClsTight = ONB_V2
    ? "bg-white border border-black/[.06] rounded-3xl px-3.5 py-3 shadow-[0_10px_30px_rgba(20,32,80,0.10)]"
    : "bg-white border border-black/[.08] rounded-2xl px-3.5 py-3 shadow-[0_6px_20px_rgba(15,23,42,0.07)]";

  /* â”€â”€ step bodies â”€â”€ */
  let body = null, footer = null;

  if (t === "welcome") {
    body = jsxs("div", {
      className: "text-center" + (ONB_V2 ? " pt-2" : " pt-10"),
      children: [
        bodyArt,
        ONB_V2 && jsx("h1", {
          className: "text-[26px] font-extrabold tracking-tight text-[#14162E] mt-1",
          children: "Let's set up your universe"
        }),
        jsx("p", {
          className: (ONB_V2 ? "text-[#5B6478]" : "text-gray-500") + " text-sm leading-relaxed mt-2 px-2 font-medium",
          children: "A few quick questions and your minutes will start tracking."
        })
      ]
    });
    footer = nextBtn(() => go("name"), false, "Get Started \u2192");
  }

  if (t === "name") {
    body = jsxs("div", {
      children: [
        bodyArt,
        head2("What should we call you?"),
        jsx("div", { className: "mt-1", children: jsxs("div", {
          className: cardCls,
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
        bodyArt,
        head2("When's your birthday?"),
        jsxs("div", { className: "mt-1 " + cardCls, children: [
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
        jsxs("div", { className: "mt-3 " + cardCls, children: [
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
        u && s && jsxs("div", { className: "mt-3 " + cardCls, children: [
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
        bodyArt,
        head2("What's your salary?"),
        jsx("div", { className: "mt-1", children: jsxs("div", {
          /* Compact card (user: "the box of the salary is too big"): tighter
             padding + a lighter input — the card takes ~1/3 less height. */
          className: cardClsTight,
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
                  className: "w-full bg-[#F5F6F8] border border-black/10 rounded-xl px-3.5 py-3 text-gray-900 text-base font-semibold outline-none placeholder:text-gray-400 focus:bg-white focus:border-[#157347] focus:ring-2 focus:ring-[#157347]/15 transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
          /* v2 demotes "Skip" to a quiet ghost link (the red block competed
             with the real CTA); v1 keeps the original red button. */
          className: ONB_V2
            ? "w-full py-3 text-sm font-bold text-gray-500 rounded-2xl transition-colors active:bg-black/5"
            : "w-full py-3 text-sm font-bold text-white rounded-xl transition-colors active:opacity-80",
          style: ONB_V2 ? undefined : { background: "#DC2626" },
          children: "Skip for now"
        })
      ]
    });
  }

  /* v2 body wrapper: gentle per-step rise so switching steps feels alive
     (this is the onboarding flow itself, NOT the login-screen open/close
     animation the owner asked to remove — that one stays gone). */
  const bodyWrap = ONB_V2
    ? jsx("div", { className: "onb2-step w-full", key: t, children: body })
    : body;

  const footerStyle = { paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))" };

  /* ── v2 root: light illustration stage + flat white content area ──────
     Bright mint-fade stage (header + floating mascot) → white area with
     the step body (scrollable) and the CTA. Deliberately NOT the login /
     register / Get-Started screen look. */
  if (ONB_V2) {
    return jsxs("div", {
      className: "relative min-h-[100dvh] flex flex-col bg-white overflow-hidden",
      children: [
        onb2Sky,
        artDome,
        jsxs("div", { className: "onb2-sheet", children: [
          jsx("div", {
            /* flex on the body: short steps (welcome/name/salary) sit
               naturally; the tall DOB step overflows and scrolls. */
            className: "flex flex-col flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-3",
            children: bodyWrap
          }),
          jsx("div", {
            className: "px-6 pt-2 pb-8",
            style: footerStyle,
            children: footer
          })
        ]})
      ]
    });
  }

  /* ── v1 root (unchanged original layout) ─────────────────────────────── */
  return jsxs("div", {
    className: "relative min-h-[100dvh] flex flex-col bg-[#FDFBF7]",
    children: [
      headerRow,
      jsx("div", {
        className: "relative z-10 flex-1 overflow-y-auto px-6 pb-4",
        children: bodyWrap
      }),
      jsx("div", {
        /* safe-area: on Android 15 (targetSdk 35) the platform draws the
           page behind the system navigation bar, which covered the
           "Next" / "Get Started" CTAs — pad by the inset (0 when the
           native opt-out keeps content between the bars). */
        className: "relative z-10 px-6 pt-3 pb-8 bg-[#FDFBF7]",
        style: footerStyle,
        children: footer
      })
    ]
  });
}
