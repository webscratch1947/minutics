import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { getProfile } from './lib/profile.js';
import { BookOpen, LayoutGrid, ListTodo, Settings, Timer } from 'lucide-react';
import { cn } from './lib/cn.js';
import { useBlocks } from './hooks/useBlocks.js';
import { useActivities } from './hooks/useActivities.js';
import { useUpdateBlock } from './hooks/useUpdateBlock.js';
import { useQueryClient } from '@tanstack/react-query';
import { blocksKey } from './lib/queryKeys.js';

function LTTopNav() {
  const { data: blocks = [] } = useBlocks();
  const { data: activities = [] } = useActivities();
  const updateBlock = useUpdateBlock();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const running = blocks.find(b => !b.endTime);

  if (!running) {
    return jsxs('div', {
      className: 'flex items-center gap-2 px-4 py-2 bg-[#04091e] text-white/40 text-xs font-bold',
      children: [
        jsx('span', {
          className: 'w-2.5 h-2.5 rounded-full bg-white/20 shrink-0'
        }),
        jsx('span', {
          className: 'flex-1 truncate',
          children: 'No activity running'
        })
      ]
    });
  }

  const activity = activities.find(a => a.id === running.activityId);
  const elapsed = Math.floor((now - new Date(running.startTime).getTime()) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');

  const stopTimer = (event) => {
    event.stopPropagation();
    updateBlock.mutate({
      id: running.id,
      data: { endTime: new Date().toISOString() }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: blocksKey });
        navigate('/activity');
      }
    });
  };

  return jsxs('div', {
    className: 'flex items-center gap-2 px-4 py-2 bg-[#04091e] text-white text-xs font-bold cursor-pointer',
    role: 'button',
    tabIndex: 0,
    onClick: () => navigate('/activity'),
    onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') navigate('/activity'); },
    children: [
      jsx('span', {
        className: 'w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-pulse'
      }),
      jsx('span', {
        className: 'flex-1 truncate',
        children: (activity ? activity.name : 'Activity') + ' — ' + timeStr
      }),
      jsx('button', {
        onClick: stopTimer,
        className: 'bg-white/15 text-white border-none rounded-full px-2.5 py-1 text-[10px] font-extrabold shrink-0',
        children: 'Stop'
      })
    ]
  });
}

export function ak({
  children: e
}) {
  return jsxs("div", {
    className: "relative mx-auto max-w-[430px] w-full h-[100dvh] overflow-hidden bg-background flex flex-col",
    children: [jsx(LTTopNav, {}), jsx("main", {
      className: "flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[88px] no-scrollbar",
      children: e
    }), jsx(ck, {})]
  })
}

const uk = [{
  href: "/",
  icon: Timer,
  label: "Timer"
}, {
  href: "/activity",
  icon: ListTodo,
  label: "Activity"
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
  const { pathname: e } = useLocation();
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
        children:         uk.map(({
          href: t,
          icon: n,
          label: r
        }) => {
          const o = t === "/" ? e === "/" : e.startsWith(t);
          return jsxs(Link, {
            to: t,
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
        to: "/",
        className: "inline-flex items-center justify-center px-8 py-4 bg-white text-black rounded-2xl font-bold tracking-wide active:scale-95 transition-transform",
        children: "Return Home"
      })]
    })
  })
}
