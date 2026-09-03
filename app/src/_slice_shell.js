import { Ny, Hb, Pe, Ty, ek, Xb, ik, Cy, c } from './shared.js';

function LTAvatarInitial() {
  try {
    const p = Ny();
    if (p && p.name && p.name.trim()) return p.name.trim().charAt(0).toUpperCase();
  } catch (e) {}
  return "?";
}

function LTTopNav() {
  return c.jsxs("div", {
    className: "flex items-center justify-between px-4 py-3 sticky top-0",
    style: {
      zIndex: 40,
      backgroundColor: "#000000"
    },
    children: [c.jsx("span", {
      className: "font-black text-lg tracking-wide text-white",
      children: "LifeTime"
    }), c.jsx("div", {
      className: "w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-sm",
      style: {
        color: "#000000"
      },
      children: LTAvatarInitial()
    })]
  })
}

export function ak({
  children: e
}) {
  return c.jsxs("div", {
    className: "relative mx-auto max-w-[430px] w-full min-h-[100dvh] bg-background flex flex-col",
    children: [c.jsx(LTTopNav, {}), c.jsx("main", {
      className: "flex-1 overflow-y-auto pb-[64px] no-scrollbar",
      children: e
    }), c.jsx(ck, {})]
  })
}

const uk = [{
  href: "/",
  icon: Ty,
  label: "Timer"
}, {
  href: "/timeline",
  icon: ek,
  label: "Life Hub"
}, {
  href: "/journal",
  icon: Xb,
  label: "Journal"
}, {
  href: "/settings",
  icon: ik,
  label: "Settings"
}];

export function ck() {
  const [e] = Hb();
  return c.jsx("div", {
    className: "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border",
    style: {
      backgroundColor: "#ffffff",
      boxShadow: "0 -2px 10px rgba(0,0,0,0.1)"
    },
    children: c.jsx("div", {
      className: "max-w-[430px] mx-auto",
      style: {
        backgroundColor: "#ffffff",
        position: "relative",
        zIndex: 51
      },
      children: c.jsx("nav", {
        className: "flex items-stretch",
        style: {
          backgroundColor: "#ffffff",
          position: "relative",
          zIndex: 52
        },
        children: uk.map(({
          href: t,
          icon: n,
          label: r
        }) => {
          const o = t === "/" ? e === "/" : e.startsWith(t);
          return c.jsxs(Cy, {
            href: t,
            className: Pe("flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors text-[10px] font-semibold tracking-wide", o ? "text-primary lt-navtab-active" : "text-muted-foreground active:text-muted-foreground"),
            style: {
              position: "relative",
              zIndex: 53
            },
            children: [c.jsx(n, {
              className: Pe("w-5 h-5", o && "stroke-[2.5]")
            }), r]
          }, t)
        })
      })
    })
  })
}

export function dk() {
  return c.jsx("div", {
    className: "min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-6",
    children: c.jsxs("div", {
      className: "text-center max-w-sm",
      children: [c.jsxs("div", {
        className: "w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 relative",
        children: [c.jsx("div", {
          className: "absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"
        }), c.jsx("span", {
          className: "text-4xl",
          children: "🕰️"
        })]
      }), c.jsx("h1", {
        className: "text-4xl font-extrabold tracking-tight text-white mb-4",
        children: "Lost in Time"
      }), c.jsx("p", {
        className: "text-muted-foreground text-lg mb-8 leading-relaxed",
        children: "The page you are looking for has slipped away."
      }), c.jsx(Cy, {
        href: "/",
        className: "inline-flex items-center justify-center px-8 py-4 bg-white text-black rounded-2xl font-bold tracking-wide active:scale-95 transition-transform",
        children: "Return Home"
      })]
    })
  })
}