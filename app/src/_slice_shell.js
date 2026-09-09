import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { getProfile } from './lib/profile.js';
import { BookOpen, LayoutGrid, Settings, Timer } from 'lucide-react';
import { cn } from './lib/cn.js';

function LTAvatarInitial() {
  try {
    const p = getProfile();
    if (p && p.name && p.name.trim()) return p.name.trim().charAt(0).toUpperCase();
  } catch (e) {}
  return "?";
}

function LTTopNav() {
  return null;
}

export function ak({
  children: e
}) {
  return jsxs("div", {
    className: "relative mx-auto max-w-[430px] w-full min-h-[100dvh] bg-background flex flex-col",
    children: [jsx(LTTopNav, {}), jsx("main", {
      className: "flex-1 overflow-y-auto pb-[64px] no-scrollbar",
      children: e
    }), jsx(ck, {})]
  })
}

const uk = [{
  href: "/",
  icon: Timer,
  label: "Timer"
}, {
  href: "/timeline",
  icon: LayoutGrid,
  label: "Life Hub"
}, {
  href: "/journal",
  icon: BookOpen,
  label: "Journal"
}, {
  href: "/settings",
  icon: Settings,
  label: "Settings"
}];

export function ck() {
  const [e] = useLocation();
  return jsx("div", {
    className: "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border",
    style: {
      backgroundColor: "#ffffff",
      boxShadow: "0 -2px 10px rgba(0,0,0,0.1)"
    },
    children: jsx("div", {
      className: "max-w-[430px] mx-auto",
      style: {
        backgroundColor: "#ffffff",
        position: "relative",
        zIndex: 51
      },
      children: jsx("nav", {
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
          return jsxs(Link, {
            href: t,
            className: cn("flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors text-[10px] font-semibold tracking-wide", o ? "text-primary lt-navtab-active" : "text-muted-foreground active:text-muted-foreground"),
            style: {
              position: "relative",
              zIndex: 53
            },
            children: [jsx(n, {
              className: cn("w-5 h-5", o && "stroke-[2.5]")
            }), r]
          }, t)
        })
      })
    })
  })
}

export function dk() {
  return jsx("div", {
    className: "min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background px-6",
    children: jsxs("div", {
      className: "text-center max-w-sm",
      children: [jsxs("div", {
        className: "w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 relative",
        children: [jsx("div", {
          className: "absolute inset-0 bg-white/10 rounded-full blur-xl animate-pulse"
        }), jsx("span", {
          className: "text-4xl",
          children: "🕰️"
        })]
      }), jsx("h1", {
        className: "text-4xl font-extrabold tracking-tight text-white mb-4",
        children: "Lost in Time"
      }), jsx("p", {
        className: "text-muted-foreground text-lg mb-8 leading-relaxed",
        children: "The page you are looking for has slipped away."
      }), jsx(Link, {
        href: "/",
        className: "inline-flex items-center justify-center px-8 py-4 bg-white text-black rounded-2xl font-bold tracking-wide active:scale-95 transition-transform",
        children: "Return Home"
      })]
    })
  })
}