import {
  Ay,
  Es,
  Ho,
  Jb,
  Kc,
  NC,
  PC,
  Pe,
  Qo,
  TC,
  Ty,
  UAC,
  Zb,
  c,
  fh,
  jC,
  jy,
  kC,
  la,
  lk,
  nk,
  pk,
  rh,
  rk,
  tk,
  w,
  zh
} from "../shared.js";

function LTTimerPanel({
  profile: e
}) {
  const [open, setOpen] = w.useState(!1);
  return c.jsxs("div", {
    className: "relative",
    children: [c.jsx("button", {
      type: "button",
      onClick: () => setOpen(!open),
      className: "w-full h-8 flex items-center justify-center bg-primary text-white transition-colors pointer-events-auto",
      title: open ? "Hide timer" : "Show timer",
      "aria-label": open ? "Hide timer" : "Show timer",
      children: c.jsx("span", {
        className: "text-xs",
        children: open ? "▲" : "▼"
      })
    }), c.jsx("div", {
      className: "overflow-hidden transition-all duration-300 ease-in-out",
      style: {
        maxHeight: open ? "320px" : "0px"
      },
      children: c.jsx(MC, {
        profile: e
      })
    })]
  })
}

export function HomeScreen({
  profile: e
}) {
  const t = Es(),
    {
      data: n = []
    } = kC(),
    {
      data: r = []
    } = Ay(),
    o = r.find(y => !y.endTime),
    s = NC(),
    i = jC(),
    [l, a] = w.useState(null),
    [u, d] = w.useState(null),
    [f, p] = w.useState(null),
    [g, v] = w.useState(null),
    x = y => {
      (o == null ? void 0 : o.activityId) === y.id ? d({
        block: o,
        activity: y
      }) : a(y)
    },
    k = y => {
      const S = () => {
        s.mutate({
          data: {
            activityId: y.id,
            startTime: new Date().toISOString()
          }
        }, {
          onSuccess: () => {
            t.invalidateQueries({
              queryKey: Ho()
            }), t.invalidateQueries({
              queryKey: Qo()
            })
          }
        })
      };
      o ? i.mutate({
        id: o.id,
        data: {
          endTime: new Date().toISOString()
        }
      }, {
        onSuccess: S
      }) : S(), a(null)
    },
    h = () => {
      u && i.mutate({
        id: u.block.id,
        data: {
          endTime: new Date().toISOString()
        }
      }, {
        onSuccess: () => {
          t.invalidateQueries({
            queryKey: Ho()
          }), t.invalidateQueries({
            queryKey: Qo()
          }), d(null)
        }
      })
    },
    m = () => {
      t.invalidateQueries({
        queryKey: Ho()
      }), t.invalidateQueries({
        queryKey: Qo()
      })
    };
  return c.jsxs("div", {
    "data-source-file": "screens/Home.js",
    className: "flex flex-col",
    children: [c.jsx(LTTimerPanel, {
      profile: e
    }), c.jsx(LTDailyValueBar, {}), c.jsxs("div", {
      className: "flex flex-col divide-y divide-border",
      children: [n.length === 0 && c.jsxs("div", {
        className: "flex flex-col items-center justify-center py-20 px-8 text-center bg-background",
        children: [c.jsx(rh, {
          className: "w-8 h-8 text-muted-foreground mb-4 opacity-30"
        }), c.jsx("p", {
          className: "text-muted-foreground font-medium",
          children: "No activities yet."
        }), c.jsx("p", {
          className: "text-sm text-muted-foreground mt-1",
          children: "Add one below to start tracking."
        })]
      }), n.map(y => c.jsx(DC, {
        activity: y,
        isActive: (o == null ? void 0 : o.activityId) === y.id,
        activeBlock: (o == null ? void 0 : o.activityId) === y.id ? o : null,
        onTap: () => x(y)
      }, y.id))]
    }), c.jsx(IC, {}), l && c.jsxs(hh, {
      onDismiss: () => a(null),
      children: [c.jsx(ph, {
        activity: l,
        subtitle: "How do you want to track this?"
      }), c.jsx(Js, {
        icon: c.jsx(Ty, {
          className: "w-5 h-5"
        }),
        label: "Start timer now",
        description: "Live timer from right now",
        onClick: () => k(l)
      }), c.jsx(Js, {
        icon: c.jsx(Jb, {
          className: "w-5 h-5"
        }),
        label: "Log a time block",
        description: "Set a start and end time manually",
        onClick: () => {
          v(l), a(null)
        }
      })]
    }), u && c.jsxs(hh, {
      onDismiss: () => d(null),
      children: [c.jsx(ph, {
        activity: u.activity,
        subtitle: "Timer is running"
      }), c.jsx(Js, {
        icon: c.jsx(rh, {
          className: "w-5 h-5 text-destructive"
        }),
        label: "Stop timer",
        labelClass: "text-destructive",
        description: `Started at ${FC(u.block.startTime)}`,
        onClick: h
      }), c.jsx(Js, {
        icon: c.jsx(tk, {
          className: "w-5 h-5"
        }),
        label: "Edit time",
        description: "Adjust start or end time",
        onClick: () => {
          p(u), d(null)
        }
      })]
    }), g && c.jsx(LC, {
      activity: g,
      onClose: () => v(null),
      onSave: (y, S) => {
        const C = () => {
          s.mutate({
            data: {
              activityId: g.id,
              startTime: y,
              endTime: S
            }
          }, {
            onSuccess: () => {
              m(), v(null)
            }
          })
        };
        o ? i.mutate({
          id: o.id,
          data: {
            endTime: new Date().toISOString()
          }
        }, {
          onSuccess: C
        }) : C()
      }
    }), f && c.jsx(AC, {
      block: f.block,
      activity: f.activity,
      onClose: () => p(null),
      onSave: (y, S) => {
        i.mutate({
          id: f.block.id,
          data: {
            startTime: y,
            endTime: S || void 0
          }
        }, {
          onSuccess: () => {
            m(), p(null)
          }
        })
      }
    })]
  })
}

function MC({
  profile: e
}) {
  const [t, n] = w.useState(() => la(e)), r = jy(e);
  w.useEffect(() => {
    n(la(e));
    const s = setInterval(() => n(la(e)), 1e3);
    return () => clearInterval(s)
  }, [e]);
  const o = pk(t);
  return c.jsxs("div", {
    className: "bg-primary text-white px-5 pt-8 pb-6",
    children: [c.jsxs("p", {
      className: "text-xs font-semibold text-white/40 uppercase tracking-widest mb-5",
      children: [e.name, "'s Remaining Retirement Time"]
    }), c.jsxs("div", {
      className: "grid grid-cols-5 gap-2 mb-5",
      children: [c.jsx(jo, {
        value: o.years,
        label: "years"
      }), c.jsx(jo, {
        value: o.days,
        label: "days"
      }), c.jsx(jo, {
        value: o.hours,
        label: "hours"
      }), c.jsx(jo, {
        value: o.minutes,
        label: "min"
      }), c.jsx(jo, {
        value: o.seconds,
        label: "sec",
        accent: !0
      })]
    }), c.jsx("div", {
      className: "h-1 w-full bg-white/10 overflow-hidden mb-2",
      children: c.jsx("div", {
        className: "h-full bg-accent",
        style: {
          width: `${r}%`
        }
      })
    }), c.jsxs("div", {
      className: "flex justify-between text-[11px] text-white/35 font-medium",
      children: [c.jsxs("span", {
        children: [r.toFixed(1), "% lived"]
      }), c.jsxs("span", {
        children: [o.totalMinutes.toLocaleString(), " min left"]
      })]
    })]
  })
}

function jo({
  value: e,
  label: t,
  accent: n
}) {
  return c.jsxs("div", {
    className: "flex flex-col items-center bg-white/8 py-3 gap-0.5",
    children: [c.jsx("span", {
      className: Pe("font-black tabular-nums leading-none", n ? "text-accent text-2xl" : "text-white text-2xl"),
      children: String(e).padStart(2, "0")
    }), c.jsx("span", {
      className: "text-[10px] font-semibold text-white/40 uppercase tracking-wide",
      children: t
    })]
  })
}

const LT_EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊", "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "🤑", "🤗", "🤔", "😐", "😑", "😶", "😏", "😒", "🙄", "😌", "😔", "😴", "🤒", "🥵", "🥶", "😵", "🤯", "🥳", "😎", "🤓", "🧐", "😕", "😮", "😲", "🥺", "😢", "😭", "😡", "😤", "👍", "👎", "👏", "🙌", "🙏", "💪", "✊", "🤝", "🖐️", "✍️", "💀", "👻", "👽", "🤖", "💩", "🔥", "⭐", "🌟", "✨", "⚡", "💧", "🌈", "☀️", "🌙", "☁️", "🎯", "🎨", "🎮", "🎧", "🎵", "🎸", "🎬", "🎭", "📚", "📖", "📝", "✏️", "💻", "🖥️", "💼", "📈", "📊", "📉", "🧠", "💡", "🔍", "🔧", "🔨", "⚙️", "🏋️", "🏃", "🚴", "⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏸", "🥊", "🧘", "🏊", "🚶", "🧗", "🛌", "🍎", "🍕", "🍔", "🍟", "🍣", "🍜", "🍩", "☕", "🍵", "🍺", "🍷", "🥗", "🍳", "🧹", "🧺", "🧼", "🚿", "🛁", "🛒", "💰", "💵", "💳", "🏠", "🏢", "🏥", "🏦", "🏫", "🚗", "🚕", "✈️", "🚌", "🚲", "🚀", "🐶", "🐱", "🐦", "🐟", "🌳", "🌱", "🌸", "🎓", "📅", "⏰", "🕒", "⏱️", "📱", "☎️", "📷", "🎤", "🎁", "💊", "🧘‍♂️", "🧘‍♀️", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "✅", "❌", "➕", "➖", "🔔", "🔕", "📌", "📍", "🚩", "🏁", "🗓️", "💤", "🧴", "🧠", "🕹️", "🛠️", "🧑‍💻", "🧑‍🍳", "🧑‍🏫", "🧑‍⚕️", "🧑‍🌾", "🧑‍🎨", "🧑‍🔧"];

const LT_EMOJI_KEYWORDS = {
  "😀": "grinning happy",
  "😃": "grinning happy joy",
  "😄": "smile happy joy",
  "😁": "grin happy",
  "😆": "laugh happy",
  "😅": "sweat laugh nervous",
  "🤣": "rofl laugh funny",
  "😂": "laugh cry funny",
  "🙂": "smile",
  "🙃": "upside down silly",
  "😉": "wink",
  "😊": "smile happy blush",
  "😇": "angel innocent",
  "🥰": "love heart smile",
  "😍": "love heart eyes",
  "🤩": "star eyes excited",
  "😘": "kiss love",
  "😋": "yum tongue tasty",
  "😛": "tongue playful",
  "🤑": "money greedy",
  "🤗": "hug",
  "🤔": "think thinking",
  "😐": "neutral face",
  "😑": "blank expressionless",
  "😶": "silent quiet",
  "😏": "smirk",
  "😒": "unamused annoyed",
  "🙄": "eyeroll annoyed",
  "😌": "relieved calm",
  "😔": "sad pensive",
  "😴": "sleep tired",
  "🤒": "sick ill",
  "🥵": "hot sweat",
  "🥶": "cold freezing",
  "😵": "dizzy confused",
  "🤯": "mind blown shocked",
  "🥳": "party celebrate",
  "😎": "cool sunglasses",
  "🤓": "nerd glasses",
  "🧐": "monocle curious",
  "😕": "confused",
  "😮": "surprised wow",
  "😲": "shocked astonished",
  "🥺": "pleading puppy eyes",
  "😢": "cry sad",
  "😭": "sob cry sad",
  "😡": "angry mad",
  "😤": "huff frustrated",
  "👍": "thumbsup like good",
  "👎": "thumbsdown dislike bad",
  "👏": "clap applause",
  "🙌": "hands celebrate praise",
  "🙏": "pray thanks please",
  "💪": "muscle strong flex",
  "✊": "fist power",
  "🤝": "handshake deal",
  "🖐️": "hand stop",
  "✍️": "writing hand",
  "💀": "skull dead",
  "👻": "ghost spooky",
  "👽": "alien ufo",
  "🤖": "robot bot",
  "💩": "poop",
  "🔥": "fire hot lit",
  "⭐": "star",
  "🌟": "star sparkle",
  "✨": "sparkles magic",
  "⚡": "lightning bolt energy",
  "💧": "water drop",
  "🌈": "rainbow",
  "☀️": "sun sunny",
  "🌙": "moon night",
  "☁️": "cloud",
  "🎯": "target goal aim",
  "🎨": "art paint",
  "🎮": "game controller gaming",
  "🎧": "headphones music",
  "🎵": "music note",
  "🎸": "guitar music",
  "🎬": "movie film clapper",
  "🎭": "theatre drama",
  "📚": "books study",
  "📖": "book read",
  "📝": "note write",
  "✏️": "pencil write edit",
  "💻": "laptop computer work",
  "🖥️": "desktop computer",
  "💼": "briefcase work job",
  "📈": "chart growth up",
  "📊": "chart bar stats",
  "📉": "chart down decline",
  "🧠": "brain",
  "💡": "idea bulb",
  "🔍": "search magnify",
  "🔧": "wrench tool fix",
  "🔨": "hammer tool build",
  "⚙️": "gear settings",
  "🏋️": "gym weights workout",
  "🏃": "run running",
  "🚴": "cycling bike",
  "⚽": "football soccer",
  "🏀": "basketball",
  "🏈": "american football",
  "⚾": "baseball",
  "🎾": "tennis",
  "🏐": "volleyball",
  "🏸": "badminton",
  "🥊": "boxing",
  "🧘": "yoga meditate",
  "🏊": "swim swimming",
  "🚶": "walk walking",
  "🧗": "climb climbing",
  "🛌": "rest sleep bed",
  "🍎": "apple fruit food",
  "🍕": "pizza food",
  "🍔": "burger food",
  "🍟": "fries food",
  "🍣": "sushi food",
  "🍜": "noodles food ramen",
  "🍩": "donut sweet food",
  "☕": "coffee drink",
  "🍵": "tea drink",
  "🍺": "beer drink",
  "🍷": "wine drink",
  "🥗": "salad healthy food",
  "🍳": "egg cooking breakfast",
  "🧹": "broom clean chore",
  "🧺": "laundry basket chore",
  "🧼": "soap clean hygiene",
  "🚿": "shower hygiene",
  "🛁": "bath hygiene",
  "🛒": "shopping cart",
  "💰": "money bag",
  "💵": "cash money dollar",
  "💳": "card payment",
  "🏠": "home house",
  "🏢": "office building",
  "🏥": "hospital",
  "🏦": "bank",
  "🏫": "school",
  "🚗": "car drive",
  "🚕": "taxi cab",
  "✈️": "flight plane travel",
  "🚌": "bus travel",
  "🚲": "bike bicycle",
  "🚀": "rocket launch",
  "🐶": "dog pet",
  "🐱": "cat pet",
  "🐦": "bird",
  "🐟": "fish",
  "🌳": "tree nature",
  "🌱": "plant seedling",
  "🌸": "flower blossom",
  "🎓": "graduation study",
  "📅": "calendar date",
  "⏰": "alarm clock time",
  "🕒": "clock time",
  "⏱️": "stopwatch timer",
  "📱": "phone mobile",
  "☎️": "phone call",
  "📷": "camera photo",
  "🎤": "mic sing karaoke",
  "🎁": "gift present",
  "💊": "pill medicine",
  "🧘‍♂️": "yoga meditate man",
  "🧘‍♀️": "yoga meditate woman",
  "❤️": "heart love red",
  "🧡": "heart orange",
  "💛": "heart yellow",
  "💚": "heart green",
  "💙": "heart blue",
  "💜": "heart purple",
  "🖤": "heart black",
  "🤍": "heart white",
  "💯": "hundred perfect",
  "✅": "check done complete",
  "❌": "cross wrong cancel",
  "➕": "plus add",
  "➖": "minus remove",
  "🔔": "bell notification",
  "🔕": "mute silent",
  "📌": "pin",
  "📍": "location pin",
  "🚩": "flag",
  "🏁": "finish flag race",
  "🗓️": "calendar schedule",
  "💤": "sleep zzz",
  "🧴": "lotion bottle",
  "🕹️": "joystick gaming",
  "🛠️": "tools fix",
  "🧑‍💻": "coder programmer work",
  "🧑‍🍳": "chef cook",
  "🧑‍🏫": "teacher",
  "🧑‍⚕️": "doctor health",
  "🧑‍🌾": "farmer",
  "🧑‍🎨": "artist",
  "🧑‍🔧": "mechanic fix"
};

function LTEmojiPicker({
  value: e,
  onSelect: t,
  onClose: n
}) {
  const [search, setSearch] = w.useState(""), [activeCat, setActiveCat] = w.useState(0), [recent, setRecent] = w.useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lt_recent_emojis") || "[]")
    } catch {
      return []
    }
  });
  const categories = [{
    name: "Recent",
    icon: "🕐",
    list: recent
  }, {
    name: "Smileys",
    icon: "😀",
    list: LT_EMOJIS.slice(0, 48)
  }, {
    name: "Gestures",
    icon: "👍",
    list: LT_EMOJIS.slice(48, 63)
  }, {
    name: "Nature",
    icon: "🌸",
    list: LT_EMOJIS.slice(63, 73)
  }, {
    name: "Activity",
    icon: "⚽",
    list: LT_EMOJIS.slice(73, 113)
  }, {
    name: "Food",
    icon: "🍔",
    list: LT_EMOJIS.slice(113, 135)
  }, {
    name: "Travel",
    icon: "🚗",
    list: LT_EMOJIS.slice(135, 154)
  }, {
    name: "Objects",
    icon: "💡",
    list: LT_EMOJIS.slice(154, 166)
  }, {
    name: "Symbols",
    icon: "🚩",
    list: LT_EMOJIS.slice(166, 198)
  }];
  const q = search.trim().toLowerCase(),
    shown = q ? LT_EMOJIS.filter(em => em.includes(search) || (LT_EMOJI_KEYWORDS[em] || "").includes(q)) : categories[activeCat].list,
    pick = em => {
      t(em);
      const next = [em, ...recent.filter(x => x !== em)].slice(0, 24);
      setRecent(next);
      try {
        localStorage.setItem("lt_recent_emojis", JSON.stringify(next))
      } catch {}
      n()
    };
  return c.jsx(hh, {
    onDismiss: n,
    children: c.jsxs("div", {
      className: "flex flex-col",
      children: [c.jsx("div", {
        className: "px-3 pt-3 pb-2",
        children: c.jsx("input", {
          type: "text",
          value: search,
          onChange: g => setSearch(g.target.value),
          placeholder: "Search emoji",
          className: "w-full bg-secondary rounded-full px-4 py-2 text-sm outline-none"
        })
      }), !q && c.jsx("div", {
        className: "flex border-b border-border",
        style: {
          overflowX: "auto",
          whiteSpace: "nowrap"
        },
        children: categories.map((cat, idx) => c.jsx("button", {
          type: "button",
          onClick: () => setActiveCat(idx),
          style: {
            flexShrink: 0
          },
          className: Pe("px-3 py-2 text-lg border-b", activeCat === idx ? "text-primary border-primary" : "text-muted-foreground border-transparent"),
          children: cat.icon
        }, cat.name))
      }), shown.length ? c.jsx("div", {
        className: "px-3 py-3",
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(8,1fr)",
          gap: "4px",
          maxHeight: "50vh",
          overflowY: "auto"
        },
        children: shown.map((em, idx) => c.jsx("button", {
          type: "button",
          onClick: () => pick(em),
          className: Pe("w-9 h-9 flex items-center justify-center text-xl rounded hover:bg-secondary", e === em ? "bg-secondary" : ""),
          children: em
        }, idx))
      }) : c.jsx("div", {
        className: "text-center text-sm text-muted-foreground py-6",
        children: q ? "No results" : "No recent emoji"
      })]
    })
  })
}

function DC({
  activity: e,
  isActive: t,
  activeBlock: n,
  onTap: r
}) {
  const [o, s] = w.useState(0), i = TC(), l = Es(), ed = UAC(), [showEdit, setShowEdit] = w.useState(!1), [showPicker, setShowPicker] = w.useState(!1), [editName, setEditName] = w.useState(e.name), [editEmoji, setEditEmoji] = w.useState(e.emoji || "");
  w.useEffect(() => {
    if (t && (n != null && n.startTime)) {
      const d = new Date(n.startTime).getTime();
      s(Math.floor((Date.now() - d) / 1e3));
      const f = setInterval(() => s(Math.floor((Date.now() - d) / 1e3)), 1e3);
      return () => clearInterval(f)
    }
    s(0)
  }, [t, n]);
  const a = d => {
      const f = Math.floor(d / 3600),
        p = Math.floor(d % 3600 / 60),
        g = d % 60;
      return f > 0 ? `${f}:${String(p).padStart(2,"0")}:${String(g).padStart(2,"0")}` : `${String(p).padStart(2,"0")}:${String(g).padStart(2,"0")}`
    },
    u = d => {
      d.stopPropagation(), confirm(`Remove "${e.name}"? It'll stop appearing in your activity list, but your tracked time for it stays in your Journal.`) && i.mutate({
        id: e.id
      }, {
        onSuccess: () => {
          l.invalidateQueries({
            queryKey: Kc()
          }), l.invalidateQueries({
            queryKey: Ho()
          }), l.invalidateQueries({
            queryKey: Qo()
          })
        }
      })
    },
    openEdit = d => {
      d.stopPropagation(), setEditName(e.name), setEditEmoji(e.emoji || ""), setShowEdit(!0)
    },
    saveEdit = () => {
      editName.trim() && ed.mutate({
        id: e.id,
        data: {
          name: editName.trim(),
          emoji: editEmoji
        }
      }, {
        onSuccess: () => {
          l.invalidateQueries({
            queryKey: Kc()
          }), l.invalidateQueries({
            queryKey: Ho()
          }), l.invalidateQueries({
            queryKey: Qo()
          }), setShowEdit(!1)
        }
      })
    };
  return c.jsxs(w.Fragment, {
    children: [c.jsxs("div", {
      role: "button",
      tabIndex: 0,
      onClick: r,
      onKeyDown: d => {
        (d.key === "Enter" || d.key === " ") && (d.preventDefault(), r())
      },
      className: Pe("group flex items-center w-full cursor-pointer select-none transition-colors bg-white hover:bg-secondary"),
      style: {
        borderLeft: t ? `4px solid ${e.color}` : "4px solid transparent"
      },
      children: [c.jsxs("div", {
        className: "flex items-center flex-1 min-w-0 px-5 py-5 gap-4",
        children: [e.emoji ? c.jsx("span", {
          className: "text-lg leading-none shrink-0 w-5 text-center",
          children: e.emoji
        }) : c.jsx("div", {
          className: Pe("w-2.5 h-2.5 shrink-0", t && "animate-pulse"),
          style: {
            backgroundColor: e.color
          }
        }), c.jsx("span", {
          className: "text-base font-semibold flex-1 min-w-0 text-foreground",
          children: e.name
        }), c.jsx("button", {
          onClick: openEdit,
          className: "w-8 h-8 flex items-center justify-center border border-transparent hover:border-primary hover:text-primary text-muted-foreground transition-all shrink-0",
          title: "Edit",
          children: c.jsx("span", {
            className: "text-sm",
            children: "✏️"
          })
        })]
      }), c.jsxs("div", {
        className: "flex items-center gap-2 px-4 shrink-0",
        children: [t && c.jsx("span", {
          className: "font-mono text-sm font-bold tabular-nums",
          style: {
            color: e.color
          },
          children: a(o)
        }), c.jsx("div", {
          className: Pe("w-8 h-8 flex items-center justify-center border transition-colors", t ? "border-current" : "border-border group-hover:border-foreground"),
          style: t ? {
            borderColor: e.color,
            color: e.color
          } : {},
          children: t ? c.jsx(Zb, {
            className: "w-4 h-4"
          }) : c.jsx(nk, {
            className: "w-4 h-4 text-muted-foreground group-hover:text-foreground"
          })
        }), c.jsx("button", {
          onClick: u,
          className: "w-8 h-8 flex items-center justify-center border border-transparent hover:border-destructive hover:text-destructive text-muted-foreground transition-all",
          children: c.jsx(lk, {
            className: "w-4 h-4"
          })
        })]
      })]
    }), showEdit && c.jsx(hh, {
      onDismiss: () => setShowEdit(!1),
      children: c.jsxs("div", {
        className: "flex flex-col",
        children: [c.jsxs("div", {
          className: "px-5 pt-5 pb-3 border-b border-border flex items-center gap-3",
          children: [c.jsx("button", {
            type: "button",
            onClick: () => setShowPicker(!0),
            className: "w-11 h-11 flex items-center justify-center text-2xl bg-secondary border border-border shrink-0",
            children: editEmoji || "➕"
          }), c.jsxs("div", {
            children: [c.jsx("p", {
              className: "font-bold text-foreground",
              children: "Edit activity"
            }), c.jsx("p", {
              className: "text-xs text-muted-foreground",
              children: "Tap the icon to change emoji"
            })]
          })]
        }), c.jsx("div", {
          className: "px-5 py-4",
          children: c.jsx("input", {
            type: "text",
            value: editName,
            onChange: d => setEditName(d.target.value),
            className: "w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground"
          })
        }), c.jsxs("div", {
          className: "flex border-t border-border",
          children: [c.jsx("button", {
            onClick: () => setShowEdit(!1),
            className: "flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm",
            children: "Cancel"
          }), c.jsx("button", {
            onClick: saveEdit,
            disabled: !editName.trim(),
            className: "flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm disabled:opacity-40",
            children: "Save"
          })]
        })]
      })
    }), showPicker && c.jsx(LTEmojiPicker, {
      value: editEmoji,
      onSelect: setEditEmoji,
      onClose: () => setShowPicker(!1)
    })]
  })
}

function hh({
  children: e,
  onDismiss: t
}) {
  return c.jsxs("div", {
    className: "fixed inset-0 z-[60] flex items-end",
    onClick: t,
    children: [c.jsx("div", {
      className: "absolute inset-0 bg-black/50"
    }), c.jsxs("div", {
      className: "relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[80dvh]",
      onClick: n => n.stopPropagation(),
      children: [c.jsx("div", {
        className: "overflow-y-auto flex-1",
        children: e
      }), c.jsx("div", {
        className: "h-20 bg-white shrink-0"
      })]
    })]
  })
}

function ph({
  activity: e,
  subtitle: t
}) {
  return c.jsxs("div", {
    className: "px-5 pt-5 pb-3 border-b border-border flex items-center gap-3",
    children: [e.emoji ? c.jsx("span", {
      className: "text-lg leading-none shrink-0 w-5 text-center",
      children: e.emoji
    }) : c.jsx("div", {
      className: "w-3 h-3 shrink-0",
      style: {
        backgroundColor: e.color
      }
    }), c.jsxs("div", {
      children: [c.jsx("p", {
        className: "font-bold text-foreground leading-tight",
        children: e.name
      }), c.jsx("p", {
        className: "text-xs text-muted-foreground mt-0.5",
        children: t
      })]
    })]
  })
}

function Js({
  icon: e,
  label: t,
  description: n,
  onClick: r,
  labelClass: o = ""
}) {
  return c.jsxs("button", {
    onClick: r,
    className: "w-full flex items-center gap-4 px-5 py-4 border-b border-border hover:bg-secondary transition-colors text-left",
    children: [c.jsx("div", {
      className: "shrink-0 text-foreground",
      children: e
    }), c.jsxs("div", {
      children: [c.jsx("p", {
        className: Pe("font-semibold text-sm", o || "text-foreground"),
        children: t
      }), c.jsx("p", {
        className: "text-xs text-muted-foreground mt-0.5",
        children: n
      })]
    })]
  })
}

function _C() {
  const e = new Date,
    t = e.getHours();
  return {
    h: t % 12 === 0 ? 12 : t % 12,
    m: e.getMinutes(),
    ampm: t < 12 ? "AM" : "PM"
  }
}

function ua(e) {
  let t = e.h % 12;
  return e.ampm === "PM" && (t += 12), `${String(t).padStart(2,"0")}:${String(e.m).padStart(2,"0")}`
}

function mh({
  label: e,
  value: t,
  onChange: n
}) {
  const r = t ?? {
      h: 12,
      m: 0,
      ampm: "AM"
    },
    o = "border border-border bg-secondary text-foreground font-bold text-lg px-2 py-2.5 outline-none focus:border-primary appearance-none text-center";
  return c.jsxs("div", {
    className: "flex-1",
    children: [c.jsx("label", {
      className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2",
      children: e
    }), c.jsxs("div", {
      className: "flex items-center gap-1",
      children: [c.jsx("select", {
        value: r.h,
        onChange: s => n({
          ...r,
          h: Number(s.target.value)
        }),
        className: Pe(o, "w-14"),
        children: Array.from({
          length: 12
        }, (s, i) => i + 1).map(s => c.jsx("option", {
          value: s,
          children: String(s).padStart(2, "0")
        }, s))
      }), c.jsx("span", {
        className: "font-bold text-foreground text-lg",
        children: ":"
      }), c.jsx("select", {
        value: r.m,
        onChange: s => n({
          ...r,
          m: Number(s.target.value)
        }),
        className: Pe(o, "w-14"),
        children: Array.from({
          length: 60
        }, (s, i) => i).map(s => c.jsx("option", {
          value: s,
          children: String(s).padStart(2, "0")
        }, s))
      }), c.jsx("button", {
        type: "button",
        onClick: () => n({
          ...r,
          ampm: r.ampm === "AM" ? "PM" : "AM"
        }),
        className: "border border-border bg-secondary text-foreground font-bold text-sm px-2 py-2.5 w-12 hover:bg-primary hover:text-white transition-colors",
        children: r.ampm
      })]
    })]
  })
}

function LC({
  activity: e,
  onClose: t,
  onSave: n
}) {
  const today = new Date().toLocaleDateString("en-CA"),
    [fromDate, setFromDate] = w.useState(today),
    [toDate, setToDate] = w.useState(today),
    [r, o] = w.useState(() => _C()), [s, i] = w.useState(null),
    a = (dateStr, f) => new Date(`${dateStr}T${ua(f)}`).toISOString(),
    fromTs = r ? a(fromDate, r) : null,
    toTs = s ? a(toDate, s) : null,
    u = fromTs && toTs ? Math.round((new Date(toTs).getTime() - new Date(fromTs).getTime()) / 6e4) : null,
    d = u !== null && u > 0,
    spansDays = fromDate !== toDate,
    dateInputCls = "border border-border bg-secondary text-foreground font-medium text-sm px-3 py-2 outline-none focus:border-primary w-full",
    onFromDateChange = v => {
      const nv = v.target.value;
      setFromDate(nv);
      /* Keep "To" from silently landing before "From" — nudge it forward
         to match, same as it already defaults to match on open. */
      if (toDate < nv) setToDate(nv);
    };
  return c.jsxs("div", {
    className: "fixed inset-0 z-[60] flex items-end",
    onClick: t,
    children: [c.jsx("div", {
      className: "absolute inset-0 bg-black/50"
    }), c.jsxs("div", {
      className: "relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]",
      onClick: f => f.stopPropagation(),
      children: [c.jsxs("div", {
        className: "px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0",
        children: [c.jsxs("div", {
          className: "flex items-center gap-3",
          children: [c.jsx("div", {
            className: "w-3 h-3",
            style: {
              backgroundColor: e.color
            }
          }), c.jsxs("div", {
            children: [c.jsx("p", {
              className: "font-bold text-foreground",
              children: e.name
            }), c.jsx("p", {
              className: "text-xs text-muted-foreground",
              children: "Log a time block"
            })]
          })]
        }), c.jsx("button", {
          onClick: t,
          className: "text-muted-foreground px-2 py-1 text-sm",
          children: "✕"
        })]
      }), c.jsxs("div", {
        className: "overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4",
        children: [c.jsxs("div", {
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
            children: "Date"
          }), c.jsx("input", {
            type: "date",
            value: fromDate,
            onChange: onFromDateChange,
            className: dateInputCls
          })]
        }), c.jsx(mh, {
          label: "From",
          value: r,
          onChange: o
        }), c.jsxs("div", {
          className: "flex items-center gap-3",
          children: [c.jsx("div", {
            className: "flex-1 h-px bg-border"
          }), c.jsx("span", {
            className: "text-muted-foreground text-sm font-semibold",
            children: "TO"
          }), c.jsx("div", {
            className: "flex-1 h-px bg-border"
          })]
        }), c.jsxs("div", {
          children: [c.jsxs("label", {
            className: "flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
            children: [c.jsx("span", {
              children: "End date"
            }), spansDays && c.jsx("span", {
              className: "text-primary normal-case font-bold",
              children: "Ends next day"
            })]
          }), c.jsx("input", {
            type: "date",
            value: toDate,
            min: fromDate,
            onChange: v => setToDate(v.target.value),
            className: dateInputCls
          })]
        }), c.jsx(mh, {
          label: "To",
          value: s,
          onChange: i
        }), u !== null && u > 0 && c.jsx("div", {
          className: "bg-primary/5 border border-primary/20 px-4 py-3 text-center",
          children: c.jsx("p", {
            className: "text-sm font-bold text-primary",
            children: u >= 60 ? `${Math.floor(u/60)}h ${u%60}m` : `${u}m`
          })
        }), s && u !== null && u <= 0 && c.jsx("p", {
          className: "text-sm text-destructive font-medium text-center",
          children: "End must be after start."
        })]
      }), c.jsxs("div", {
        className: "flex border-t border-border shrink-0",
        children: [c.jsx("button", {
          onClick: t,
          className: "flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm",
          children: "Cancel"
        }), c.jsx("button", {
          onClick: () => d && fromTs && toTs && n(fromTs, toTs),
          disabled: !d,
          className: "flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm disabled:opacity-40",
          children: "Log block"
        })]
      }), c.jsx("div", {
        className: "h-20 bg-white shrink-0"
      })]
    })]
  })
}

function AC({
  block: e,
  activity: t,
  onClose: n,
  onSave: r
}) {
  const o = g => String(g).padStart(2, "0"),
    s = g => {
      const v = new Date(g);
      return `${v.getFullYear()}-${o(v.getMonth()+1)}-${o(v.getDate())}T${o(v.getHours())}:${o(v.getMinutes())}`
    },
    i = new Date,
    [l, a] = w.useState(() => s(e.startTime)),
    [u, d] = w.useState(() => s(i.toISOString())),
    [f, p] = w.useState(!0);
  return c.jsxs("div", {
    className: "fixed inset-0 z-[60] flex items-end",
    onClick: n,
    children: [c.jsx("div", {
      className: "absolute inset-0 bg-black/50"
    }), c.jsxs("div", {
      className: "relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]",
      onClick: g => g.stopPropagation(),
      children: [c.jsxs("div", {
        className: "px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0",
        children: [c.jsxs("div", {
          className: "flex items-center gap-3",
          children: [c.jsx("div", {
            className: "w-3 h-3",
            style: {
              backgroundColor: t.color
            }
          }), c.jsxs("div", {
            children: [c.jsx("p", {
              className: "font-bold text-foreground",
              children: "Edit time block"
            }), c.jsx("p", {
              className: "text-xs text-muted-foreground",
              children: t.name
            })]
          })]
        }), c.jsx("button", {
          onClick: n,
          className: "text-muted-foreground px-2 py-1 text-sm",
          children: "✕"
        })]
      }), c.jsxs("div", {
        className: "overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4",
        children: [c.jsxs("div", {
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
            children: "Start time"
          }), c.jsx("input", {
            type: "datetime-local",
            value: l,
            onChange: g => a(g.target.value),
            className: "w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground"
          })]
        }), c.jsxs("label", {
          className: "flex items-center gap-3 cursor-pointer select-none",
          children: [c.jsx("input", {
            type: "checkbox",
            checked: f,
            onChange: g => p(g.target.checked),
            className: "w-4 h-4 accent-primary"
          }), c.jsx("span", {
            className: "text-sm font-medium text-foreground",
            children: "Keep timer running"
          })]
        }), !f && c.jsxs("div", {
          children: [c.jsx("label", {
            className: "block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5",
            children: "End time"
          }), c.jsx("input", {
            type: "datetime-local",
            value: u,
            onChange: g => d(g.target.value),
            className: "w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground"
          })]
        })]
      }), c.jsxs("div", {
        className: "flex border-t border-border shrink-0",
        children: [c.jsx("button", {
          onClick: n,
          className: "flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm",
          children: "Cancel"
        }), c.jsx("button", {
          onClick: () => r(new Date(l).toISOString(), f ? null : new Date(u).toISOString()),
          className: "flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm",
          children: "Save"
        })]
      }), c.jsx("div", {
        className: "h-20 bg-white shrink-0"
      })]
    })]
  })
}

function IC() {
  const [e, t] = w.useState(""), [newEmoji, setNewEmoji] = w.useState(""), [showNewPicker, setShowNewPicker] = w.useState(!1), n = PC(), r = Es(), o = zh.useRef(null), s = () => {
    if (!e.trim()) return;
    const i = fh[Math.floor(Math.random() * fh.length)];
    n.mutate({
      data: {
        name: e.trim(),
        color: i,
        emoji: newEmoji
      }
    }, {
      onSuccess: () => {
        var l;
        t(""), setNewEmoji(""), r.invalidateQueries({
          queryKey: Kc()
        }), (l = o.current) == null || l.focus()
      }
    })
  };
  return c.jsxs(w.Fragment, {
    children: [c.jsxs("div", {
      className: "border-t border-border bg-white flex items-center",
      children: [c.jsx("input", {
        ref: o,
        type: "text",
        value: e,
        onChange: i => t(i.target.value),
        onKeyDown: i => {
          i.key === "Enter" && s()
        },
        placeholder: "New activity...",
        className: "flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none px-2 py-4 text-base font-medium min-w-0"
      }), c.jsx("button", {
        type: "button",
        onClick: () => setShowNewPicker(!0),
        className: "h-full px-4 py-4 flex items-center justify-center text-xl text-muted-foreground shrink-0",
        title: "Choose emoji",
        children: newEmoji || "🙂"
      }), c.jsxs("button", {
        onClick: s,
        disabled: !e.trim() || n.isPending,
        className: "h-full px-5 py-4 flex items-center gap-2 bg-primary text-white font-semibold text-sm disabled:opacity-40 shrink-0",
        children: [c.jsx(rk, {
          className: "w-4 h-4"
        }), "Add"]
      })]
    }), showNewPicker && c.jsx(LTEmojiPicker, {
      value: newEmoji,
      onSelect: setNewEmoji,
      onClose: () => setShowNewPicker(!1)
    })]
  })
}

function FC(e) {
  return new Date(e).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  })
}

function LTDailyValueBar() {
  const [pv, setPv] = w.useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
      return r && r.perMinute ? r.perMinute : 0
    } catch {
      return 0
    }
  }), [dailyHours, setDailyHours] = w.useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
      return r && r.hours ? r.hours : 8
    } catch {
      return 8
    }
  }), [now, setNow] = w.useState(Date.now());
  w.useEffect(() => {
    const iv = setInterval(() => {
      setNow(Date.now());
      try {
        const r = JSON.parse(localStorage.getItem("lt_time_value_v1") || "null");
        setPv(r && r.perMinute ? r.perMinute : 0);
        setDailyHours(r && r.hours ? r.hours : 8)
      } catch {}
    }, 1e3);
    return () => clearInterval(iv)
  }, []);
  if (!pv) return null;
  const dt = new Date(now),
    startOfDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime(),
    endOfDay = startOfDay + 864e5,
    minutesLeft = Math.max(0, (endOfDay - now) / 6e4),
    fracLeft = Math.max(0, Math.min(1, minutesLeft / 1440)),
    dailyBudget = pv * 60 * dailyHours,
    valueLeft = dailyBudget * fracLeft;
  return c.jsxs("div", {
    className: "bg-primary text-white px-5 py-4",
    children: [c.jsx("p", {
      className: "text-xs font-semibold text-white/50 uppercase tracking-widest mb-1",
      children: "Today's time value left"
    }), c.jsxs("p", {
      className: "text-2xl font-black",
      children: ["₹", valueLeft.toFixed(2)]
    }), c.jsx("div", {
      className: "h-1 w-full bg-white/10 overflow-hidden mt-3",
      children: c.jsx("div", {
        className: "h-full bg-accent",
        style: {
          width: `${fracLeft*100}%`
        }
      })
    })]
  })
}
