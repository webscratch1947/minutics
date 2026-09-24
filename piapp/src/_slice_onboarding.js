import { useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
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
    if (u) return `${Math.floor(u.left)} years left`;
    if (s) {
      const Hb = new Date(s);
      const Ib = Math.floor((Date.now() - Hb.getTime()) / (365.25 * 24 * 3600 * 1e3));
      return `${Math.max(0,l-Ib)} years left`
    }
    return `${l} years`
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
    /* ─── PHASE 0: inject a CSS override that FORCES #root to stay hidden
       even after lt-authed is added. This prevents the flash of unstyled
       content that happens because React renders asynchronously — lt-authed
       gets added, #root becomes display:block, but enhancements haven't
       applied yet. We remove this rule only after enhancements are done. */
    var killSwitch = document.createElement("style");
    killSwitch.id = "lt-root-killswitch";
    killSwitch.textContent = "body.lt-authed #root{display:none!important}";
    (document.head || document.documentElement).appendChild(killSwitch);

    /* Phase 1: loading spinner */
    var loader = document.createElement("div");
    loader.id = "lt-signin-loader";
    loader.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:hsl(230 40% 16%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;transition:opacity .5s ease;opacity:1;";
    loader.innerHTML =
      '<div style="width:48px;height:48px;border:3px solid rgba(255,255,255,.15);border-top-color:#fff;border-radius:50%;animation:lt-spin .8s linear infinite"></div>' +
      '<p style="color:rgba(255,255,255,.8);font-size:15px;font-weight:600;margin:0;font-family:inherit">Setting up your app...</p>' +
      '<style>@keyframes lt-spin{to{transform:rotate(360deg)}}</style>';
    (document.body || document.documentElement).appendChild(loader);

    /* Phase 2: render the main app first, but keep this opaque loader over it
       until React and the enhancement pass have settled. This prevents the
       white gap that used to appear after \u201CSetting up your app\u2026". */
    setTimeout(function () {
      e(profileData);
      /* Poll: wait for enhancements to apply (life-progress card or
         enhancement markers exist + body has lt-authed), then reveal the
         app and only afterwards fade the loader away. */
      var checks = 0;
      var readyTimer = setInterval(function () {
        checks++;
        var hasAuth = document.body.classList.contains("lt-authed");
        var hasProgress = !!document.getElementById("lt-life-progress");
        var hasGlance = !!document.querySelector("[data-lt-enhancement]");
        if ((hasAuth && (hasProgress || hasGlance)) || checks > 50) {
          clearInterval(readyTimer);
          var ks = document.getElementById("lt-root-killswitch");
          if (ks && ks.parentNode) ks.parentNode.removeChild(ks);
          requestAnimationFrame(function () {
            loader.style.opacity = "0";
            setTimeout(function () {
              if (loader.parentNode) loader.parentNode.removeChild(loader);
            }, 500);
          });
        }
      }, 80);
    }, 3000);
  }

  /* ── shared chrome: back button + progress dots ── */
  const backBtn = idx > 0
    ? jsx("button", {
        type: "button",
        onClick: () => n(STEPS[idx - 1]),
        "aria-label": "Go back",
        className: "w-9 h-9 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 shrink-0",
        children: jsx("svg", { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round", children: jsx("polyline", { points: "15 18 9 12 15 6" }) })
      })
    : jsx("div", { className: "w-9 shrink-0" });

  const dots = jsxs("div", {
    className: "flex items-center justify-center gap-2",
    children: STEPS.map((_, k) => jsx("span", {
      className: "rounded-full transition-all",
      style: k <= idx
        ? { width: k === idx ? 20 : 8, height: 8, background: GREEN }
        : { width: 8, height: 8, background: "#E5E7EB" }
    }, k))
  });

  const img = jsx("img", {
    src: IMGS[t],
    alt: "",
    draggable: false,
    className: "w-full max-w-[330px] mx-auto object-contain select-none",
    style: { maxHeight: "42vh" }
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

  /* ── step bodies ── */
  let body = null, footer = null;

  if (t === "welcome") {
    body = jsxs("div", {
      className: "text-center",
      children: [
        img,
        jsx("p", {
          className: "text-gray-500 text-sm leading-relaxed mt-2 px-2",
          children: "A few quick questions and your life countdown will be ready."
        })
      ]
    });
    footer = nextBtn(() => n("name"), false, "Get Started \u2192");
  }

  if (t === "name") {
    body = jsxs("div", {
      children: [
        img,
        jsx("div", { className: "mt-2", children: jsxs("div", {
          className: "bg-white border border-[#E5DFCF] rounded-2xl px-4 py-4",
          children: [
            label("Your name"),
            jsx("input", {
              type: "text",
              value: r,
              onChange: g => o(g.target.value),
              placeholder: "e.g. Alex",
              autoFocus: true,
              className: "w-full bg-transparent text-gray-900 text-lg font-semibold outline-none placeholder:text-gray-300"
            })
          ]
        }) })
      ]
    });
    footer = nextBtn(() => n("dob"), !r.trim(), "Next \u2192");
  }

  if (t === "dob") {
    const _maxYear = new Date().getFullYear() - 1;
    const _minYear = 1920;
    const _months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const _daysInMonth = (dY && dM) ? new Date(Number(dY), Number(dM), 0).getDate() : 31;
    const _updateDob = (y, m, dd) => {
      setDY(y);
      setDM(m);
      setDD(dd);
      if (y && m && dd) {
        const dayStr = String(dd).padStart(2, "0"),
          monStr = String(m).padStart(2, "0");
        i(y + "-" + monStr + "-" + dayStr);
      } else {
        i("");
      }
    };
    const _selStyle = "flex-1 bg-white text-gray-900 text-base font-bold outline-none border border-[#E5DFCF] rounded-xl px-2 py-3 text-center focus:border-[#157347] transition-colors min-w-0";
    body = jsxs("div", {
      children: [
        img,
        jsxs("div", { className: "mt-2 bg-white border border-[#E5DFCF] rounded-2xl px-4 py-4", children: [
          label("Date of birth"),
          jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              jsxs("select", {
                value: dD,
                onChange: g => _updateDob(dY, dM, g.target.value),
                className: _selStyle,
                children: [
                  jsx("option", { value: "", children: "Day" }, "d0"),
                  Array.from({ length: _daysInMonth }, (_, ii) => ii + 1).map(dd => jsx("option", { value: String(dd).padStart(2, "0"), children: String(dd).padStart(2, "0") }, dd))
                ]
              }),
              jsxs("select", {
                value: dM,
                onChange: g => _updateDob(dY, g.target.value, dD),
                className: _selStyle,
                children: [
                  jsx("option", { value: "", children: "Month" }, "m0"),
                  ..._months.map((mname, ii) => jsx("option", { value: String(ii + 1).padStart(2, "0"), children: mname }, ii + 1))
                ]
              }),
              jsxs("select", {
                value: dY,
                onChange: g => _updateDob(g.target.value, dM, dD),
                className: _selStyle,
                children: [
                  jsx("option", { value: "", children: "Year" }, "y0"),
                  ...Array.from({ length: _maxYear - _minYear + 1 }, (_, ii) => _maxYear - ii).map(yy => jsx("option", { value: String(yy), children: String(yy) }, yy))
                ]
              })
            ]
          })
        ]}),
        jsxs("div", { className: "mt-3 bg-white border border-[#E5DFCF] rounded-2xl px-4 py-4", children: [
          jsxs("label", {
            className: "block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2",
            children: ["Retire age \u2014 ", jsx("span", { style: { color: GREEN }, children: d })]
          }),
          jsx("input", {
            type: "range",
            min: s ? Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / (365.25 * 24 * 3600 * 1000))) : 0,
            max: 100,
            value: l,
            onChange: g => a(Number(g.target.value)),
            className: "w-full accent-[#157347]"
          }),
          jsxs("div", {
            className: "flex justify-between text-xs text-gray-400 mt-1",
            children: [
              jsx("span", { children: s ? `${Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / (365.25 * 24 * 3600 * 1000)))} yrs` : "0 yrs" }),
              jsx("span", { children: "100 yrs" })
            ]
          })
        ]}),
        u && s && jsxs("div", { className: "mt-3 bg-white border border-[#E5DFCF] rounded-2xl px-4 py-4", children: [
          label("Your timeline"),
          jsxs("div", {
            className: "flex h-4 w-full border border-[#E5DFCF] overflow-hidden rounded-full",
            children: [
              jsx("div", { className: "h-full", style: { width: `${u.lived / l * 100}%`, background: GREEN } }),
              jsx("div", { className: "h-full", style: { width: `${u.left / l * 100}%`, background: GREEN, opacity: .25 } })
            ]
          }),
          jsxs("div", {
            className: "flex justify-between text-xs text-gray-400 mt-2",
            children: [
              jsxs("span", { children: [Math.floor(u.lived), " yrs lived"] }),
              jsxs("span", { children: [Math.floor(u.left), " yrs remaining"] })
            ]
          }),
          u.left > 0 && jsxs("p", {
            className: "text-sm text-gray-500 mt-2 font-medium",
            children: ["You have ~", jsx("strong", { style: { color: GREEN }, children: Math.floor(u.left * 365.25).toLocaleString() }), " days left."]
          })
        ]})
      ]
    });
    footer = nextBtn(() => n("salary"), !dobValid, "Next \u2192");
  }

  if (t === "salary") {
    body = jsxs("div", {
      children: [
        img,
        jsx("div", { className: "mt-2", children: jsxs("div", {
          className: "bg-white border border-[#E5DFCF] rounded-2xl px-4 py-4",
          children: [
            label("Your monthly salary"),
            jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                jsx("span", { className: "text-xl font-black text-gray-400 shrink-0", children: sym }),
                jsx("input", {
                  type: "number",
                  inputMode: "decimal",
                  min: 0,
                  value: sal,
                  onChange: g => setSal(g.target.value),
                  placeholder: "e.g. 50,000",
                  autoFocus: true,
                  className: "w-full bg-transparent text-gray-900 text-lg font-semibold outline-none placeholder:text-gray-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                })
              ]
            }),
            jsx("p", {
              className: "text-xs text-gray-400 mt-2 leading-relaxed",
              children: "Powers your Time Value Calculator \u2014 the value of every minute. You can change this later in Life Hub."
            })
          ]
        }) })
      ]
    });
    footer = jsxs("div", {
      className: "flex flex-col gap-1",
      children: [
        nextBtn(() => finish(true), !(salaryNum > 0), "Next \u2192"),
        jsx("button", {
          type: "button",
          onClick: () => finish(false),
          className: "w-full py-3 text-sm font-semibold text-gray-400 active:text-gray-600",
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
        className: "px-6 pt-3 pb-8 bg-[#FDFBF7]",
        children: footer
      })
    ]
  });
}
