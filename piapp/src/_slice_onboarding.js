import { useState } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';
import { saveProfile } from './lib/profile.js';

export function mk({
  onComplete: e
}) {
  const [t, n] = useState("intro"), [r, o] = useState(""), [s, i] = useState(""), [l, a] = useState(85), [dY, setDY] = useState(""), [dM, setDM] = useState(""), [dD, setDD] = useState(""), u = (() => {
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
  })(), f = (() => {
    const g = new Date;
    return g.setFullYear(g.getFullYear() - 5), g.toISOString().slice(0, 10)
  })(), p = () => {
    const _dobValid = /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
    if (!r.trim() || !s || !_dobValid) return;
    const g = {
      name: r.trim(),
      dob: s,
      lifespanYears: l
    };
    saveProfile(g);
    showSetupLoader(g);
  };

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
       white gap that used to appear after “Setting up your app…”. */
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
  return t === "intro" ? jsx("div", {
    className: "min-h-[100dvh] bg-primary flex flex-col items-center justify-center px-8 text-white",
    children: jsxs("div", {
      className: "max-w-sm w-full",
      children: [jsx("div", {
        className: "w-12 h-12 bg-accent flex items-center justify-center mb-8",
        children: jsxs("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2.5",
          strokeLinecap: "square",
          children: [jsx("circle", {
            cx: "12",
            cy: "12",
            r: "10"
          }), jsx("polyline", {
            points: "12 6 12 12 16 14"
          })]
        })
      }), jsxs("h1", {
        className: "text-4xl font-black tracking-tight mb-4 leading-tight",
        children: ["Your life,", jsx("br", {}), "in seconds."]
      }), jsx("p", {
        className: "text-white/70 text-base leading-relaxed mb-10",
        children: "Lifetime shows you exactly how much of your remaining time goes into each activity — so every second you spend is a choice, not an accident."
      }), jsx("button", {
        onClick: () => n("form"),
        className: "w-full py-4 bg-accent text-primary font-bold text-base tracking-wide",
        children: "Start my countdown →"
      })]
    })
  }) : jsxs("div", {
    className: "min-h-[100dvh] bg-background flex flex-col",
    children: [jsxs("div", {
      className: "bg-primary px-6 pt-12 pb-8",
      children: [jsx("h2", {
        className: "text-white text-2xl font-bold",
        children: "Set up your profile"
      }), jsx("p", {
        className: "text-white/60 text-sm mt-1",
        children: "This calculates your life countdown."
      })]
    }), jsx("div", {
      className: "flex-1 overflow-y-auto",
      children: jsxs("div", {
        className: "flex flex-col divide-y divide-border",
        children: [jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: "Your name"
          }), jsx("input", {
            type: "text",
            value: r,
            onChange: g => o(g.target.value),
            placeholder: "e.g. Alex",
            className: "w-full bg-transparent text-foreground text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
          })]
        }), jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: "Date of birth"
          }), (() => {
            /* Keep the list current without allowing the in-progress year.
               In 2026 the newest option is 2025; when 2027 begins it becomes 2026. */
            const _maxYear = new Date().getFullYear() - 1;
            const _minYear = 1920;
            const _selY = dY;
            const _selM = dM;
            const _selD = dD;
            const _months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const _daysInMonth = (_selY && _selM) ? new Date(Number(_selY), Number(_selM), 0).getDate() : 31;
            const _updateDob = (y, m, d) => {
              setDY(y);
              setDM(m);
              setDD(d);
              if (y && m && d) {
                const dd = String(d).padStart(2, "0"),
                  mm = String(m).padStart(2, "0");
                i(y + "-" + mm + "-" + dd)
              } else {
                i("")
              }
            };
            const _selStyle = "flex-1 bg-muted text-foreground text-base font-bold outline-none border border-border rounded-xl px-3 py-3 text-center focus:border-primary focus:ring-2 focus:ring-primary/30 transition-colors";
            return jsxs("div", {
              className: "flex items-center gap-2",
              children: [jsxs("select", {
                value: _selD,
                onChange: g => {
                  _updateDob(_selY, _selM, g.target.value)
                },
                className: _selStyle,
                children: [jsx("option", {
                  value: "",
                  children: "Day"
                }, ...[]), Array.from({
                  length: _daysInMonth
                }, (_, idx) => idx + 1).map(d => jsx("option", {
                  value: String(d).padStart(2, "0"),
                  children: String(d).padStart(2, "0")
                }, d))]
              }), jsxs("select", {
                value: _selM,
                onChange: g => {
                  _updateDob(_selY, g.target.value, _selD)
                },
                className: _selStyle,
                children: [jsx("option", {
                  value: "",
                  children: "Month"
                }, ...[]), ..._months.map((m, idx) => jsx("option", {
                  value: String(idx + 1).padStart(2, "0"),
                  children: m
                }, idx + 1))]
              }), jsxs("select", {
                value: _selY,
                onChange: g => {
                  _updateDob(g.target.value, _selM, _selD)
                },
                className: _selStyle,
                children: [jsx("option", {
                  value: "",
                  children: "Year"
                }, ...[]), ...Array.from({
                  length: _maxYear - _minYear + 1
                }, (_, idx) => _maxYear - idx).map(y => jsx("option", {
                  value: String(y),
                  children: String(y)
                }, y))]
              })]
            })
          })()]
        }), jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [jsxs("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: ["Retire date — ", jsx("span", {
              className: "text-primary font-bold",
              children: d
            })]
          }), jsx("input", {
            type: "range",
            min: s ? Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / (365.25 * 24 * 3600 * 1000))) : 0,
            max: 100,
            value: l,
            onChange: g => a(Number(g.target.value)),
            className: "w-full accent-primary"
          }), jsxs("div", {
            className: "flex justify-between text-xs text-muted-foreground mt-1",
            children: [jsx("span", {
              children: s ? `${Math.max(0,Math.floor((Date.now()-new Date(s).getTime())/(365.25*24*3600*1000)))} yrs` : "0 yrs"
            }), jsx("span", {
              children: "100 yrs"
            })]
          })]
        }), u && s && jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3",
            children: "Your timeline"
          }), jsxs("div", {
            className: "flex h-4 w-full border border-border overflow-hidden",
            children: [jsx("div", {
              className: "h-full bg-primary",
              style: {
                width: `${u.lived/l*100}%`
              }
            }), jsx("div", {
              className: "h-full",
              style: {
                width: `${u.left/l*100}%`,
                backgroundColor: "hsl(var(--accent))",
                opacity: .3
              }
            })]
          }), jsxs("div", {
            className: "flex justify-between text-xs text-muted-foreground mt-2",
            children: [jsxs("span", {
              children: [Math.floor(u.lived), " yrs lived"]
            }), jsxs("span", {
              children: [Math.floor(u.left), " yrs remaining"]
            })]
          }), u.left > 0 && jsxs("p", {
            className: "text-sm text-muted-foreground mt-3 font-medium",
            children: ["You have ~", jsx("strong", {
              className: "text-foreground",
              children: Math.floor(u.left * 365.25).toLocaleString()
            }), " days left."]
          })]
        })]
      })
    }), jsx("div", {
      className: "border-t border-border bg-white p-4",
      children: jsx("button", {
        onClick: p,
        disabled: !r.trim() || !s,
        className: "w-full py-4 bg-primary text-white font-bold text-base disabled:opacity-40 transition-opacity",
        children: "Start my countdown"
      })
    })]
  })
}
