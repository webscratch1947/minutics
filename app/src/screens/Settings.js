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

export function SettingsScreen() {
  const [e, t] = w.useState(null), [n, r] = w.useState(""), [o, s] = w.useState(""), [i, l] = w.useState("21:00"), [a, u] = w.useState(!1), [d, f] = w.useState(!1), [p, g] = w.useState(null), [v, x] = w.useState(!1), k = Ny(), h = k ? new Date(k.dob) : null;
  h && k && h.setFullYear(h.getFullYear() + k.lifespanYears), w.useEffect(() => {
    const C = Ns();
    t(C), r(C.telegramBotToken ?? ""), s(C.telegramChatId ?? ""), l(C.dailyReportTime ?? "21:00")
  }, []);
  const [ovlGranted, setOvlGranted] = w.useState(null), [ovlSupported, setOvlSupported] = w.useState(!1);
  w.useEffect(() => {
    const checkOvl = () => {
      try {
        if (typeof window !== "undefined" && "Notification" in window) {
          setOvlSupported(!0);
          setOvlGranted(window.Notification.permission === "granted");
          return
        }
      } catch (e) {}
      setOvlSupported(!1)
    };
    checkOvl();
    const onVis = () => {
      if (document.visibilityState === "visible") checkOvl()
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis)
    }
  }, []);
  const requestOvl = () => {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        window.Notification.requestPermission().then(p => setOvlGranted(p === "granted"))
      }
    } catch (e) {}
  };
  const m = async () => {
    u(!0), x(!1);
    try {
      const C = gh({
        telegramBotToken: n,
        telegramChatId: o,
        dailyReportTime: i
      });
      r(C.telegramBotToken ?? ""), s(C.telegramChatId ?? ""), t(C), x(!0), setTimeout(() => x(!1), 2500)
    } finally {
      u(!1)
    }
  }, y = async () => {
    f(!0), g(null);
    try {
      const C = gh({
        telegramBotToken: n,
        telegramChatId: o,
        dailyReportTime: i
      });
      t(C);
      const E = await Iy("Lifetime test message: Telegram is connected.", C);
      g(E)
    } catch {
      g({
        success: !1,
        message: "Could not reach Telegram"
      })
    } finally {
      f(!1)
    }
  }, S = () => {
    if (!confirm("Reset your profile? You'll need to set up your date of birth and retire date again.")) return;
    hk();
    try {
      if (window.AndroidPermBridge && window.AndroidPermBridge.reloadApp) {
        window.AndroidPermBridge.reloadApp()
      } else {
        window.location.reload()
      }
    } catch (e) {
      window.location.reload()
    }
  };
  return c.jsxs("div", {
    className: "flex flex-col",
    children: [c.jsxs("div", {
      className: "bg-primary text-white px-5 pt-10 pb-6",
      children: [c.jsx("p", {
        className: "text-xs font-semibold text-white/50 uppercase tracking-widest mb-1",
        children: "Settings"
      }), c.jsx("h1", {
        className: "text-2xl font-black",
        children: "Configure"
      })]
    }), k && c.jsxs("div", {
      className: "bg-white border-b border-border px-5 py-4",
      children: [c.jsx("p", {
        className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
        children: "Profile"
      }), c.jsxs("div", {
        className: "flex flex-col gap-1 text-sm",
        children: [c.jsxs("div", {
          className: "flex justify-between",
          children: [c.jsx("span", {
            className: "text-muted-foreground",
            children: "Name"
          }), c.jsx("span", {
            className: "font-semibold",
            children: k.name
          })]
        }), c.jsxs("div", {
          className: "flex justify-between",
          children: [c.jsx("span", {
            className: "text-muted-foreground",
            children: "Date of birth"
          }), c.jsx("span", {
            className: "font-semibold",
            children: new Date(k.dob).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric"
            })
          })]
        }), c.jsxs("div", {
          className: "flex justify-between",
          children: [c.jsx("span", {
            className: "text-muted-foreground",
            children: "Retire date"
          }), c.jsx("span", {
            className: "font-semibold",
            children: h == null ? void 0 : h.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric"
            })
          })]
        })]
      }), c.jsxs("button", {
        onClick: S,
        className: "mt-4 flex items-center gap-2 text-sm text-destructive font-medium border border-destructive px-3 py-2 hover:bg-destructive hover:text-white transition-colors",
        children: [c.jsx(ok, {
          className: "w-3.5 h-3.5"
        }), "Reset profile"]
      })]
    }), ovlSupported && c.jsxs("div", {
      className: "bg-white border-b border-border px-5 py-4",
      children: [c.jsx("p", {
        className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
        children: "Browser permissions"
      }), c.jsxs("div", {
        className: "flex items-center justify-between gap-3",
        children: [c.jsxs("div", {
          className: "flex items-center gap-2",
          children: [ovlGranted ? c.jsx(eh, {
            className: "w-4 h-4 text-green-500 shrink-0"
          }) : c.jsx(th, {
            className: "w-4 h-4 text-muted-foreground shrink-0"
          }), c.jsxs("div", {
            children: [c.jsx("p", {
              className: "text-sm font-semibold text-foreground",
              children: "Website notifications"
            }), c.jsx("p", {
              className: "text-xs text-muted-foreground mt-0.5",
              children: ovlGranted ? "Enabled — reminders can notify you in this browser" : "Disabled or not yet asked — tap to enable"
            })]
          })]
        }), ovlGranted ? c.jsx("span", {
          className: "text-xs font-bold text-green-700 shrink-0",
          children: "On"
        }) : c.jsx("button", {
          onClick: requestOvl,
          className: "shrink-0 px-3 py-2 border border-primary text-primary font-semibold text-xs hover:bg-primary hover:text-white transition-colors",
          children: "Enable"
        })]
      })]
    }), c.jsx("div", {
      className: "px-5 pt-5 pb-2",
      children: c.jsx("h2", {
        className: "text-xs font-semibold text-muted-foreground uppercase tracking-widest",
        children: "Telegram daily reports"
      })
    }), c.jsxs("div", {
      className: "flex flex-col divide-y divide-border border-t border-b border-border bg-white",
      children: [c.jsx("div", {
        className: "px-5 py-3 flex items-center gap-3",
        children: e != null && e.telegramConnected ? c.jsxs(c.Fragment, {
          children: [c.jsx(eh, {
            className: "w-4 h-4 text-green-500 shrink-0"
          }), c.jsx("span", {
            className: "text-sm font-medium text-green-700",
            children: "Connected — daily reports active"
          })]
        }) : c.jsxs(c.Fragment, {
          children: [c.jsx(th, {
            className: "w-4 h-4 text-muted-foreground shrink-0"
          }), c.jsx("span", {
            className: "text-sm text-muted-foreground",
            children: "Not connected"
          })]
        })
      }), c.jsxs("div", {
        className: "px-5 py-4",
        children: [c.jsx("label", {
          className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
          children: "Bot token"
        }), c.jsx("input", {
          type: "text",
          value: n,
          onChange: C => r(C.target.value),
          placeholder: "123456:ABCdef...",
          className: "w-full bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50"
        }), c.jsx("p", {
          className: "text-xs text-muted-foreground mt-1",
          children: "Create a bot with @BotFather on Telegram."
        })]
      }), c.jsxs("div", {
        className: "px-5 py-4",
        children: [c.jsx("label", {
          className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
          children: "Chat ID"
        }), c.jsx("input", {
          type: "text",
          value: o,
          onChange: C => s(C.target.value),
          placeholder: "e.g. 987654321",
          className: "w-full bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50"
        }), c.jsx("p", {
          className: "text-xs text-muted-foreground mt-1",
          children: "Your Telegram user ID. Message @userinfobot to find it."
        })]
      }), c.jsxs("div", {
        className: "px-5 py-4",
        children: [c.jsx("label", {
          className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
          children: "Daily report time"
        }), c.jsx("input", {
          type: "time",
          value: i,
          onChange: C => l(C.target.value),
          className: "bg-secondary border border-border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground"
        }), c.jsx("p", {
          className: "text-xs text-muted-foreground mt-1",
          children: "The server will send your summary at this time each day."
        })]
      })]
    }), p && c.jsxs("div", {
      className: `mx-5 mt-3 px-4 py-3 border text-sm font-medium flex items-center gap-2 ${p.success?"border-green-300 bg-green-50 text-green-700":"border-red-300 bg-red-50 text-red-700"}`,
      children: [p.success ? c.jsx(eh, {
        className: "w-4 h-4 shrink-0"
      }) : c.jsx(th, {
        className: "w-4 h-4 shrink-0"
      }), p.message]
    }), c.jsxs("div", {
      className: "flex gap-3 px-5 py-4",
      children: [c.jsxs("button", {
        onClick: m,
        disabled: a,
        className: "flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white font-bold text-sm disabled:opacity-40",
        children: [a && c.jsx(nh, {
          className: "w-4 h-4 animate-spin"
        }), v ? "Saved ✓" : "Save settings"]
      }), c.jsxs("button", {
        onClick: y,
        disabled: d || !n.trim() || !o.trim(),
        className: "flex items-center gap-2 px-4 py-3.5 border border-border font-semibold text-sm text-foreground hover:bg-secondary disabled:opacity-40 transition-colors",
        children: [d ? c.jsx(nh, {
          className: "w-4 h-4 animate-spin"
        }) : c.jsx(sk, {
          className: "w-4 h-4"
        }), "Test"]
      })]
    }), c.jsx("div", {
      className: "h-6"
    })]
  })
}
