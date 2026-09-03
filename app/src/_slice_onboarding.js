import { w, c, fk } from './shared.js';

export function mk({
  onComplete: e
}) {
  const [t, n] = w.useState("intro"), [r, o] = w.useState(""), [s, i] = w.useState(""), [l, a] = w.useState(85), [dY, setDY] = w.useState(""), [dM, setDM] = w.useState(""), [dD, setDD] = w.useState(""), u = (() => {
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
    fk(g);
    try {
      if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "default") {
        window.Notification.requestPermission().then(function() {
          e(g);
        }).catch(function() {
          e(g);
        });
        return;
      }
    } catch (_) {}
    e(g)
  };
  return t === "intro" ? c.jsx("div", {
    className: "min-h-[100dvh] bg-primary flex flex-col items-center justify-center px-8 text-white",
    children: c.jsxs("div", {
      className: "max-w-sm w-full",
      children: [c.jsx("div", {
        className: "w-12 h-12 bg-accent flex items-center justify-center mb-8",
        children: c.jsxs("svg", {
          width: "24",
          height: "24",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2.5",
          strokeLinecap: "square",
          children: [c.jsx("circle", {
            cx: "12",
            cy: "12",
            r: "10"
          }), c.jsx("polyline", {
            points: "12 6 12 12 16 14"
          })]
        })
      }), c.jsxs("h1", {
        className: "text-4xl font-black tracking-tight mb-4 leading-tight",
        children: ["Your life,", c.jsx("br", {}), "in seconds."]
      }), c.jsx("p", {
        className: "text-white/70 text-base leading-relaxed mb-10",
        children: "Lifetime shows you exactly how much of your remaining time goes into each activity — so every second you spend is a choice, not an accident."
      }), c.jsx("button", {
        onClick: () => n("form"),
        className: "w-full py-4 bg-accent text-primary font-bold text-base tracking-wide",
        children: "Start my countdown →"
      })]
    })
  }) : c.jsxs("div", {
    className: "min-h-[100dvh] bg-background flex flex-col",
    children: [c.jsxs("div", {
      className: "bg-primary px-6 pt-12 pb-8",
      children: [c.jsx("h2", {
        className: "text-white text-2xl font-bold",
        children: "Set up your profile"
      }), c.jsx("p", {
        className: "text-white/60 text-sm mt-1",
        children: "This calculates your life countdown."
      })]
    }), c.jsx("div", {
      className: "flex-1 overflow-y-auto",
      children: c.jsxs("div", {
        className: "flex flex-col divide-y divide-border",
        children: [c.jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: "Your name"
          }), c.jsx("input", {
            type: "text",
            value: r,
            onChange: g => o(g.target.value),
            placeholder: "e.g. Alex",
            className: "w-full bg-transparent text-foreground text-lg font-semibold outline-none placeholder:text-muted-foreground/50"
          })]
        }), c.jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: "Date of birth"
          }), (() => {
            const _maxYear = new Date().getFullYear() - 5;
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
            return c.jsxs("div", {
              className: "flex items-center gap-2",
              children: [c.jsxs("select", {
                value: _selD,
                onChange: g => {
                  _updateDob(_selY, _selM, g.target.value)
                },
                className: _selStyle,
                children: [c.jsx("option", {
                  value: "",
                  children: "Day"
                }, ...[]), Array.from({
                  length: _daysInMonth
                }, (_, idx) => idx + 1).map(d => c.jsx("option", {
                  value: String(d).padStart(2, "0"),
                  children: String(d).padStart(2, "0")
                }, d))]
              }), c.jsxs("select", {
                value: _selM,
                onChange: g => {
                  _updateDob(_selY, g.target.value, _selD)
                },
                className: _selStyle,
                children: [c.jsx("option", {
                  value: "",
                  children: "Month"
                }, ...[]), ..._months.map((m, idx) => c.jsx("option", {
                  value: String(idx + 1).padStart(2, "0"),
                  children: m
                }, idx + 1))]
              }), c.jsxs("select", {
                value: _selY,
                onChange: g => {
                  _updateDob(g.target.value, _selM, _selD)
                },
                className: _selStyle,
                children: [c.jsx("option", {
                  value: "",
                  children: "Year"
                }, ...[]), ...Array.from({
                  length: _maxYear - _minYear + 1
                }, (_, idx) => _maxYear - idx).map(y => c.jsx("option", {
                  value: String(y),
                  children: String(y)
                }, y))]
              })]
            })
          })()]
        }), c.jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [c.jsxs("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
            children: ["Retire date — ", c.jsx("span", {
              className: "text-primary font-bold",
              children: d
            })]
          }), c.jsx("input", {
            type: "range",
            min: s ? Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / (365.25 * 24 * 3600 * 1000))) : 0,
            max: 100,
            value: l,
            onChange: g => a(Number(g.target.value)),
            className: "w-full accent-primary"
          }), c.jsxs("div", {
            className: "flex justify-between text-xs text-muted-foreground mt-1",
            children: [c.jsx("span", {
              children: s ? `${Math.max(0,Math.floor((Date.now()-new Date(s).getTime())/(365.25*24*3600*1000)))} yrs` : "0 yrs"
            }), c.jsx("span", {
              children: "100 yrs"
            })]
          })]
        }), u && s && c.jsxs("div", {
          className: "bg-card px-6 py-5",
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3",
            children: "Your timeline"
          }), c.jsxs("div", {
            className: "flex h-4 w-full border border-border overflow-hidden",
            children: [c.jsx("div", {
              className: "h-full bg-primary",
              style: {
                width: `${u.lived/l*100}%`
              }
            }), c.jsx("div", {
              className: "h-full",
              style: {
                width: `${u.left/l*100}%`,
                backgroundColor: "hsl(var(--accent))",
                opacity: .3
              }
            })]
          }), c.jsxs("div", {
            className: "flex justify-between text-xs text-muted-foreground mt-2",
            children: [c.jsxs("span", {
              children: [Math.floor(u.lived), " yrs lived"]
            }), c.jsxs("span", {
              children: [Math.floor(u.left), " yrs remaining"]
            })]
          }), u.left > 0 && c.jsxs("p", {
            className: "text-sm text-muted-foreground mt-3 font-medium",
            children: ["You have ~", c.jsx("strong", {
              className: "text-foreground",
              children: Math.floor(u.left * 365.25).toLocaleString()
            }), " days left."]
          })]
        })]
      })
    }), c.jsx("div", {
      className: "border-t border-border bg-white p-4",
      children: c.jsx("button", {
        onClick: p,
        disabled: !r.trim() || !s,
        className: "w-full py-4 bg-primary text-white font-bold text-base disabled:opacity-40 transition-opacity",
        children: "Start my countdown"
      })
    })]
  })
}