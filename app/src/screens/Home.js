import {
  Ay,      // useBlocks — useQuery for all time blocks (refetch every 1s)
  Es,      // useQueryClient — for invalidating queries
  Ho,      // blocksQueryKey — ["local", "blocks"]
  Jb,      // CalendarClock icon (lucide)
  Kc,      // activitiesQueryKey — ["local", "activities"]
  NC,      // useCreateBlock — mutation to create a time block
  PC,      // useCreateActivity — mutation to create an activity
  Pe,      // cn — tailwind-merge utility (clsx + twMerge)
  Qo,      // todayStatsQueryKey — ["local", "today-stats"]
  TC,      // useDeleteActivity — mutation (archives activity, stops running block)
  Ty,      // Timer icon (lucide)
  UAC,     // useUpdateActivity — mutation to update activity name/emoji
  Zb,      // Clock icon (lucide)
  c,       // JSX runtime (React.createElement/jsxs)
  fh,      // COLOR_PALETTE — ["#1B1F3B","#00897B","#D97706","#7C3AED","#1D4ED8","#BE185D","#15803D","#B91C1C"]
  jC,      // useUpdateBlock — mutation to update a block's times
  jy,      // calcPercentLived(profile) — returns 0-100 percentage
  kC,      // useActivities — useQuery for non-archived activities
  la,      // calcRemainingTime(profile) — returns ms remaining until death date
  lk,      // Trash2 icon (lucide)
  nk,      // Play icon (lucide)
  pk,      // msToBreakdown(ms) — returns { years, days, hours, minutes, seconds, totalMinutes }
  rh,      // Square icon (lucide) — empty state icon
  rk,      // Plus icon (lucide) — add button icon
  tk,      // Pencil icon (lucide) — edit icon
  w,       // React
  zh       // React (alternate, same as w)
} from '../shared.js';

// ─── LT Timer Panel ─────────────────────────────────────────────────────────
// Collapsible panel containing the retirement countdown timer.
// Toggles open/closed with a full-width button.

function LTTimerPanel({ profile }) {
  const [open, setOpen] = w.useState(false); // default collapsed

  return c.jsxs('div', {
    'data-lt-enhancement': 'retirement',
    className: 'relative',
    children: [
      // Toggle button — "v" when open, "^" when closed
      c.jsx('button', {
        type: 'button',
        onClick: () => setOpen(!open),
        className: 'w-full h-8 flex items-center justify-center bg-primary text-white transition-colors pointer-events-auto',
        title: open ? 'Hide timer' : 'Show timer',
        'aria-label': open ? 'Hide timer' : 'Show timer',
        children: c.jsx('span', {
          className: 'text-xs',
          children: open ? 'v' : '^'
        })
      }),
      // Animated container — maxHeight transitions 0 → 320px
      c.jsx('div', {
        className: 'overflow-hidden transition-all duration-300 ease-in-out',
        style: { maxHeight: open ? '320px' : '0px' },
        children: c.jsx(RetirementCountdown, { profile })
      })
    ]
  });
}

// ─── Retirement Countdown (MC) ─────────────────────────────────────────────
// Displays remaining life time with 5-column grid (years, days, hours, min, sec).
// Updates live every 1 second.

function RetirementCountdown({ profile }) {
  const [remainingMs, setRemainingMs] = w.useState(() => la(profile)); // la = calcRemainingTime
  const percentLived = jy(profile); // jy = calcPercentLived

  w.useEffect(() => {
    setRemainingMs(la(profile));
    const interval = setInterval(() => setRemainingMs(la(profile)), 1000);
    return () => clearInterval(interval);
  }, [profile]);

  const breakdown = pk(remainingMs); // pk = msToBreakdown

  return c.jsxs('div', {
    'data-lt-enhancement': 'retirement',
    className: 'bg-primary text-white px-5 pt-8 pb-6',
    children: [
      // Title
      c.jsxs('p', {
        className: 'text-xs font-semibold text-white/40 uppercase tracking-widest mb-5',
        children: [profile.name, "'s Remaining Retirement Time"]
      }),
      // 5-column grid: years, days, hours, min, sec
      c.jsxs('div', {
        className: 'grid grid-cols-5 gap-2 mb-5',
        children: [
          c.jsx(TimeDigit, { value: breakdown.years, label: 'years' }),
          c.jsx(TimeDigit, { value: breakdown.days, label: 'days' }),
          c.jsx(TimeDigit, { value: breakdown.hours, label: 'hours' }),
          c.jsx(TimeDigit, { value: breakdown.minutes, label: 'min' }),
          c.jsx(TimeDigit, { value: breakdown.seconds, label: 'sec', accent: true })
        ]
      }),
      // Progress bar
      c.jsx('div', {
        className: 'h-1 w-full bg-white/10 overflow-hidden mb-2',
        children: c.jsx('div', {
          className: 'h-full bg-accent',
          style: { width: `${percentLived}%` }
        })
      }),
      // Footer: percent lived + minutes left
      c.jsxs('div', {
        className: 'flex justify-between text-[11px] text-white/35 font-medium',
        children: [
          c.jsxs('span', { children: [percentLived.toFixed(1), '% lived'] }),
          c.jsxs('span', { children: [breakdown.totalMinutes.toLocaleString(), ' min left'] })
        ]
      })
    ]
  });
}

// ─── Time Digit (jo) ────────────────────────────────────────────────────────
// Single digit cell in the countdown grid. Shows value with leading zero pad.

function TimeDigit({ value, label, accent }) {
  return c.jsxs('div', {
    className: 'flex flex-col items-center bg-white/8 py-3 gap-0.5',
    children: [
      c.jsx('span', {
        className: Pe(
          'font-black tabular-nums leading-none',
          accent ? 'text-accent text-2xl' : 'text-white text-2xl'
        ),
        children: String(value).padStart(2, '0')
      }),
      c.jsx('span', {
        className: 'text-[10px] font-semibold text-white/40 uppercase tracking-wide',
        children: label
      })
    ]
  });
}

// ─── LT Daily Value Bar ─────────────────────────────────────────────────────
// Shows remaining monetary value of today's time based on localStorage settings.
// Reads per-minute rate and daily hours from localStorage key "lt_time_value_v1".
// Live updates every 1 second.

function LTDailyValueBar() {
  const [perMinute, setPerMinute] = w.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
      return stored && stored.perMinute ? stored.perMinute : 0;
    } catch { return 0; }
  });

  const [dailyHours, setDailyHours] = w.useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
      return stored && stored.hours ? stored.hours : 8;
    } catch { return 8; }
  });

  const [now, setNow] = w.useState(Date.now());

  w.useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      try {
        const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
        setPerMinute(stored && stored.perMinute ? stored.perMinute : 0);
        setDailyHours(stored && stored.hours ? stored.hours : 8);
      } catch { /* ignore */ }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Return null if no perMinute rate is set
  if (!perMinute) return null;

  const nowDate = new Date(now);
  const startOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const endOfDay = startOfDay + 86400000; // 24 * 60 * 60 * 1000
  const minutesLeft = Math.max(0, (endOfDay - now) / 60000);
  const fractionLeft = Math.max(0, Math.min(1, minutesLeft / 1440));
  const dailyBudget = perMinute * 60 * dailyHours;
  const valueLeft = dailyBudget * fractionLeft;

  return c.jsxs('div', {
    'data-lt-enhancement': 'saved-value',
    className: 'bg-primary text-white px-5 py-4',
    children: [
      c.jsx('p', {
        className: 'text-xs font-semibold text-white/50 uppercase tracking-widest mb-1',
        children: "Today's time value left"
      }),
      c.jsxs('p', {
        className: 'text-2xl font-black',
        children: ['Rs.', valueLeft.toFixed(2)]
      }),
      c.jsx('div', {
        className: 'h-1 w-full bg-white/10 overflow-hidden mt-3',
        children: c.jsx('div', {
          className: 'h-full bg-accent',
          style: { width: `${fractionLeft * 100}%` }
        })
      })
    ]
  });
}

// ─── LT Emoji Picker ────────────────────────────────────────────────────────
// Full emoji picker with search, categories, and recent emojis.
// Stores recent emojis in localStorage "lt_recent_emojis" (max 24).

// Complete list of 198 emojis with correct Unicode
const LT_EMOJIS = [
  // Smileys (indices 0-47)
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😋', '😛', '🤑', '🤗', '🤔', '😐', '😑',
  '😶', '😏', '😒', '🙄', '😌', '😔', '😴', '🤒',
  '🥵', '🥶', '😵', '🤯', '🥳', '😎', '🤓', '🧐',
  '😕', '😮', '😲', '🥺', '😢', '😭', '😡', '😤',
  // Gestures (indices 48-62)
  '👍', '👎', '👏', '🙌', '🙏', '💪', '✊', '🤝',
  '🖐️', '✍️', '💀', '👻', '👽', '🤖', '💩',
  // Nature (indices 63-72)
  '🔥', '⭐', '🌟', '✨', '⚡', '💧', '🌈', '☀️',
  '🌙', '☁️',
  // Activity (indices 73-112)
  '🎯', '🎨', '🎮', '🎧', '🎵', '🎸', '🎬', '🎭',
  '📚', '📖', '📝', '✏️', '💻', '🖥️', '💼', '📈',
  '📊', '📉', '🧠', '💡', '🔍', '🔧', '🔨', '⚙️',
  '🏋️', '🏃', '🚴', '⚽', '🏀', '🏈', '⚾', '🎾',
  '🏐', '🏸', '🥊', '🧘', '🏊', '🚶', '🧗', '🛌',
  // Food (indices 113-134)
  '🍎', '🍕', '🍔', '🍟', '🍣', '🍜', '🍩', '☕',
  '🍵', '🍺', '🍷', '🥗', '🍳', '🧹', '🧺', '🧼',
  '🚿', '🛁', '🛒', '💰', '💵', '💳',
  // Travel (indices 135-153)
  '🏠', '🏢', '🏥', '🏦', '🏫', '🚗', '🚕', '✈️',
  '🚌', '🚲', '🚀', '🐕', '🐈', '🐦', '🐟', '🌲',
  '🌱', '🌸', '🎓',
  // Objects (indices 154-165)
  '📅', '⏰', '🕒', '⏱️', '📱', '☎️', '📷', '🎤',
  '🎁', '💊', '🧘‍♂️', '🧘‍♀️',
  // Symbols (indices 166-197)
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💯', '✅', '❌', '+', '-', '🔔', '🔕', '📌',
  '📍', '🚩', '🏁', '🗓️', '💤', '🧴', '🕹️', '🛠️',
  '🧑‍💻', '🧑‍🍳', '🧑‍🏫', '🧑‍⚕️', '🧑‍🌾', '🧑‍🎨', '🧑‍🔧'
];

// Keyword mapping for emoji search — correct emoji keys
const LT_EMOJI_KEYWORDS = {
  '😀': 'grinning happy',
  '😃': 'grinning happy joy',
  '😄': 'smile happy joy',
  '😁': 'grin happy',
  '😆': 'laugh happy',
  '😅': 'sweat laugh nervous',
  '🤣': 'rofl laugh funny',
  '😂': 'laugh cry funny',
  '🙂': 'smile',
  '🙃': 'upside down silly',
  '😉': 'wink',
  '😊': 'smile happy blush',
  '😇': 'angel innocent',
  '🥰': 'love heart smile',
  '😍': 'love heart eyes',
  '🤩': 'star eyes excited',
  '😘': 'kiss love',
  '😋': 'yum tongue tasty',
  '😛': 'tongue playful',
  '🤑': 'money greedy',
  '🤗': 'hug',
  '🤔': 'think thinking',
  '😐': 'neutral face',
  '😑': 'blank expressionless',
  '😶': 'silent quiet',
  '😏': 'smirk',
  '😒': 'unamused annoyed',
  '🙄': 'eyeroll annoyed',
  '😌': 'relieved calm',
  '😔': 'sad pensive',
  '😴': 'sleep tired',
  '🤒': 'sick ill',
  '🥵': 'hot sweat',
  '🥶': 'cold freezing',
  '😵': 'dizzy confused',
  '🤯': 'mind blown shocked',
  '🥳': 'party celebrate',
  '😎': 'cool sunglasses',
  '🤓': 'nerd glasses',
  '🧐': 'monocle curious',
  '😕': 'confused',
  '😮': 'surprised wow',
  '😲': 'shocked astonished',
  '🥺': 'pleading puppy eyes',
  '😢': 'cry sad',
  '😭': 'sob cry sad',
  '😡': 'angry mad',
  '😤': 'huff frustrated',
  '👍': 'thumbsup like good',
  '👎': 'thumbsdown dislike bad',
  '👏': 'clap applause',
  '🙌': 'hands celebrate praise',
  '🙏': 'pray thanks please',
  '💪': 'muscle strong flex',
  '✊': 'fist power',
  '🤝': 'handshake deal',
  '🖐️': 'hand stop',
  '✍️': 'writing hand',
  '💀': 'skull dead',
  '👻': 'ghost spooky',
  '👽': 'alien ufo',
  '🤖': 'robot bot',
  '💩': 'poop',
  '🔥': 'fire hot lit',
  '⭐': 'star',
  '🌟': 'star sparkle',
  '✨': 'sparkles magic',
  '⚡': 'lightning bolt energy',
  '💧': 'water drop',
  '🌈': 'rainbow',
  '☀️': 'sun sunny',
  '🌙': 'moon night',
  '☁️': 'cloud',
  '🎯': 'target goal aim',
  '🎨': 'art paint',
  '🎮': 'game controller gaming',
  '🎧': 'headphones music',
  '🎵': 'music note',
  '🎸': 'guitar music',
  '🎬': 'movie film clapper',
  '🎭': 'theatre drama',
  '📚': 'books study',
  '📖': 'book read',
  '📝': 'note write',
  '✏️': 'pencil write edit',
  '💻': 'laptop computer work',
  '🖥️': 'desktop computer',
  '💼': 'briefcase work job',
  '📈': 'chart growth up',
  '📊': 'chart bar stats',
  '📉': 'chart down decline',
  '🧠': 'brain',
  '💡': 'idea bulb',
  '🔍': 'search magnify',
  '🔧': 'wrench tool fix',
  '🔨': 'hammer tool build',
  '⚙️': 'gear settings',
  '🏋️': 'gym weights workout',
  '🏃': 'run running',
  '🚴': 'cycling bike',
  '⚽': 'football soccer',
  '🏀': 'basketball',
  '🏈': 'american football',
  '⚾': 'baseball',
  '🎾': 'tennis',
  '🏐': 'volleyball',
  '🏸': 'badminton',
  '🥊': 'boxing',
  '🧘': 'yoga meditate',
  '🏊': 'swim swimming',
  '🚶': 'walk walking',
  '🧗': 'climb climbing',
  '🛌': 'rest sleep bed',
  '🍎': 'apple fruit food',
  '🍕': 'pizza food',
  '🍔': 'burger food',
  '🍟': 'fries food',
  '🍣': 'sushi food',
  '🍜': 'noodles food ramen',
  '🍩': 'donut sweet food',
  '☕': 'coffee drink',
  '🍵': 'tea drink',
  '🍺': 'beer drink',
  '🍷': 'wine drink',
  '🥗': 'salad healthy food',
  '🍳': 'egg cooking breakfast',
  '🧹': 'broom clean chore',
  '🧺': 'laundry basket chore',
  '🧼': 'soap clean hygiene',
  '🚿': 'shower hygiene',
  '🛁': 'bath hygiene',
  '🛒': 'shopping cart',
  '💰': 'money bag',
  '💵': 'cash money dollar',
  '💳': 'card payment',
  '🏠': 'home house',
  '🏢': 'office building',
  '🏥': 'hospital',
  '🏦': 'bank',
  '🏫': 'school',
  '🚗': 'car drive',
  '🚕': 'taxi cab',
  '✈️': 'flight plane travel',
  '🚌': 'bus travel',
  '🚲': 'bike bicycle',
  '🚀': 'rocket launch',
  '🐕': 'dog pet',
  '🐈': 'cat pet',
  '🐦': 'bird',
  '🐟': 'fish',
  '🌲': 'tree nature',
  '🌱': 'plant seedling',
  '🌸': 'flower blossom',
  '🎓': 'graduation study',
  '📅': 'calendar date',
  '⏰': 'alarm clock time',
  '🕒': 'clock time',
  '⏱️': 'stopwatch timer',
  '📱': 'phone mobile',
  '☎️': 'phone call',
  '📷': 'camera photo',
  '🎤': 'mic sing karaoke',
  '🎁': 'gift present',
  '💊': 'pill medicine',
  '🧘‍♂️': 'yoga meditate man',
  '🧘‍♀️': 'yoga meditate woman',
  '❤️': 'heart love red',
  '🧡': 'heart orange',
  '💛': 'heart yellow',
  '💚': 'heart green',
  '💙': 'heart blue',
  '💜': 'heart purple',
  '🖤': 'heart black',
  '🤍': 'heart white',
  '💯': 'hundred perfect',
  '✅': 'check done complete',
  '❌': 'cross wrong cancel',
  '+': 'plus add',
  '-': 'minus remove',
  '🔔': 'bell notification',
  '🔕': 'mute silent',
  '📌': 'pin',
  '📍': 'location pin',
  '🚩': 'flag',
  '🏁': 'finish flag race',
  '🗓️': 'calendar schedule',
  '💤': 'sleep zzz',
  '🧴': 'lotion bottle',
  '🕹️': 'joystick gaming',
  '🛠️': 'tools fix',
  '🧑‍💻': 'coder programmer work',
  '🧑‍🍳': 'chef cook',
  '🧑‍🏫': 'teacher',
  '🧑‍⚕️': 'doctor health',
  '🧑‍🌾': 'farmer',
  '🧑‍🎨': 'artist',
  '🧑‍🔧': 'mechanic fix'
};

// Category definitions for the emoji picker
const EMOJI_CATEGORIES = [
  { name: 'Recent',  icon: '🕒', list: null }, // populated from state
  { name: 'Smileys', icon: '😀', emojis: LT_EMOJIS.slice(0, 48) },
  { name: 'Gestures', icon: '👍', emojis: LT_EMOJIS.slice(48, 63) },
  { name: 'Nature',  icon: '🌸', emojis: LT_EMOJIS.slice(63, 73) },
  { name: 'Activity', icon: '⚽', emojis: LT_EMOJIS.slice(73, 113) },
  { name: 'Food',    icon: '🍔', emojis: LT_EMOJIS.slice(113, 135) },
  { name: 'Travel',  icon: '🚗', emojis: LT_EMOJIS.slice(135, 154) },
  { name: 'Objects', icon: '💡', emojis: LT_EMOJIS.slice(154, 166) },
  { name: 'Symbols', icon: '🚩', emojis: LT_EMOJIS.slice(166, 198) }
];

function LTEmojiPicker({ value, onSelect, onClose }) {
  const [search, setSearch] = w.useState('');
  const [activeCat, setActiveCat] = w.useState(0);
  const [recent, setRecent] = w.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('lt_recent_emojis') || '[]');
    } catch {
      return [];
    }
  });

  // Build categories with recent list
  const categories = EMOJI_CATEGORIES.map((cat, idx) => {
    if (idx === 0) return { ...cat, list: recent };
    return { ...cat, list: cat.emojis };
  });

  const query = search.trim().toLowerCase();

  // Filter: if searching, filter by emoji character OR keyword; otherwise show category
  const shown = query
    ? LT_EMOJIS.filter(
        em => em.includes(search) || (LT_EMOJI_KEYWORDS[em] || '').includes(query)
      )
    : categories[activeCat].list;

  const pickEmoji = (emoji) => {
    onSelect(emoji);
    // Add to recent, remove duplicate, keep max 24
    const updated = [emoji, ...recent.filter(x => x !== emoji)].slice(0, 24);
    setRecent(updated);
    try {
      localStorage.setItem('lt_recent_emojis', JSON.stringify(updated));
    } catch { /* ignore */ }
    onClose();
  };

  return c.jsx(BottomSheet, {
    onDismiss: onClose,
    children: c.jsxs('div', {
      className: 'flex flex-col',
      children: [
        // Search input
        c.jsx('div', {
          className: 'px-3 pt-3 pb-2',
          children: c.jsx('input', {
            type: 'text',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Search emoji',
            className: 'w-full bg-secondary rounded-full px-4 py-2 text-sm outline-none'
          })
        }),
        // Category tab bar (hidden when searching)
        !query && c.jsx('div', {
          className: 'flex border-b border-border',
          style: { overflowX: 'auto', whiteSpace: 'nowrap' },
          children: categories.map((cat, idx) =>
            c.jsx('button', {
              type: 'button',
              onClick: () => setActiveCat(idx),
              style: { flexShrink: 0 },
              className: Pe(
                'px-3 py-2 text-lg border-b',
                activeCat === idx ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              ),
              children: cat.icon
            }, cat.name)
          )
        }),
        // Emoji grid
        shown.length
          ? c.jsx('div', {
              className: 'px-3 py-3',
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(8,1fr)',
                gap: '4px',
                maxHeight: '50vh',
                overflowY: 'auto'
              },
              children: shown.map((emoji, idx) =>
                c.jsx('button', {
                  type: 'button',
                  onClick: () => pickEmoji(emoji),
                  className: Pe(
                    'w-9 h-9 flex items-center justify-center text-xl rounded hover:bg-secondary',
                    value === emoji ? 'bg-secondary' : ''
                  ),
                  children: emoji
                }, idx)
              )
            })
          : // Empty state
            c.jsx('div', {
              className: 'text-center text-sm text-muted-foreground py-6',
              children: query ? 'No results' : 'No recent emoji'
            })
      ]
    })
  });
}

// ─── Activity Card (DC) ─────────────────────────────────────────────────────
// Individual activity row in the list. Shows emoji/icon, name, edit button,
// elapsed time (when active), play/clock button, and trash button.

function ActivityCard({ activity, isActive, activeBlock, onTap }) {
  const [elapsedSeconds, setElapsedSeconds] = w.useState(0);
  const deleteActivity = TC();   // TC = useDeleteActivity
  const queryClient = Es();      // Es = useQueryClient
  const updateActivity = UAC();  // UAC = useUpdateActivity

  // Edit modal state
  const [showEdit, setShowEdit] = w.useState(false);
  const [showPicker, setShowPicker] = w.useState(false);
  const [editName, setEditName] = w.useState(activity.name);
  const [editEmoji, setEditEmoji] = w.useState(activity.emoji || '');

  // Live elapsed timer when activity is active
  w.useEffect(() => {
    if (isActive && activeBlock?.startTime) {
      const startTime = new Date(activeBlock.startTime).getTime();
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      const interval = setInterval(
        () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000)),
        1000
      );
      return () => clearInterval(interval);
    }
    setElapsedSeconds(0);
  }, [isActive, activeBlock]);

  // Format seconds to H:MM:SS or MM:SS
  const formatElapsed = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Delete activity handler
  const handleDelete = (e) => {
    e.stopPropagation();
    if (confirm(`Remove "${activity.name}"? It'll stop appearing in your activity list, but your tracked time for it stays in your Journal.`)) {
      deleteActivity.mutate({ id: activity.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: Kc() }); // activities
          queryClient.invalidateQueries({ queryKey: Ho() }); // blocks
          queryClient.invalidateQueries({ queryKey: Qo() }); // today-stats
        }
      });
    }
  };

  // Open edit modal
  const openEdit = (e) => {
    e.stopPropagation();
    setEditName(activity.name);
    setEditEmoji(activity.emoji || '');
    setShowEdit(true);
  };

  // Save edited activity
  const saveEdit = () => {
    if (!editName.trim()) return;
    updateActivity.mutate({
      id: activity.id,
      data: { name: editName.trim(), emoji: editEmoji }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: Kc() });
        queryClient.invalidateQueries({ queryKey: Ho() });
        queryClient.invalidateQueries({ queryKey: Qo() });
        setShowEdit(false);
      }
    });
  };

  return c.jsxs(w.Fragment, {
    children: [
      // Main row
      c.jsxs('div', {
        role: 'button',
        tabIndex: 0,
        onClick: onTap,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap();
          }
        },
        className: Pe('group flex items-center w-full cursor-pointer select-none transition-colors bg-white hover:bg-secondary'),
        style: { borderLeft: isActive ? `4px solid ${activity.color}` : '4px solid transparent' },
        children: [
          // Left section: emoji/dot + name + edit button
          c.jsxs('div', {
            className: 'flex items-center flex-1 min-w-0 px-5 py-5 gap-4',
            children: [
              // Emoji or colored dot
              activity.emoji
                ? c.jsx('span', {
                    className: 'text-lg leading-none shrink-0 w-5 text-center',
                    children: activity.emoji
                  })
                : c.jsx('div', {
                    className: Pe('w-2.5 h-2.5 shrink-0', isActive && 'animate-pulse'),
                    style: { backgroundColor: activity.color }
                  }),
              // Activity name
              c.jsx('span', {
                className: 'text-base font-semibold flex-1 min-w-0 text-foreground',
                children: activity.name
              }),
              // Edit button
              c.jsx('button', {
                onClick: openEdit,
                className: 'w-8 h-8 flex items-center justify-center border border-transparent hover:border-primary hover:text-primary text-muted-foreground transition-all shrink-0',
                title: 'Edit',
                children: c.jsx('span', {
                  className: 'text-sm',
                  children: 'Edit'
                })
              })
            ]
          }),
          // Right section: elapsed time + play/clock + trash
          c.jsxs('div', {
            className: 'flex items-center gap-2 px-4 shrink-0',
            children: [
              // Elapsed time display (when active)
              isActive && c.jsx('span', {
                className: 'font-mono text-sm font-bold tabular-nums',
                style: { color: activity.color },
                children: formatElapsed(elapsedSeconds)
              }),
              // Play/Clock icon button
              c.jsx('div', {
                className: Pe(
                  'w-8 h-8 flex items-center justify-center border transition-colors',
                  isActive ? 'border-current' : 'border-border group-hover:border-foreground'
                ),
                style: isActive ? { borderColor: activity.color, color: activity.color } : {},
                children: isActive
                  ? c.jsx(Zb, { className: 'w-4 h-4' })        // Clock icon when running
                  : c.jsx(nk, { className: 'w-4 h-4 text-muted-foreground group-hover:text-foreground' }) // Play icon when stopped
              }),
              // Trash button
              c.jsx('button', {
                onClick: handleDelete,
                className: 'w-8 h-8 flex items-center justify-center border border-transparent hover:border-destructive hover:text-destructive text-muted-foreground transition-all',
                children: c.jsx(lk, { className: 'w-4 h-4' })
              })
            ]
          })
        ]
      }),
      // Edit activity modal
      showEdit && c.jsx(BottomSheet, {
        onDismiss: () => setShowEdit(false),
        children: c.jsxs('div', {
          className: 'flex flex-col',
          children: [
            // Header with emoji button
            c.jsxs('div', {
              className: 'px-5 pt-5 pb-3 border-b border-border flex items-center gap-3',
              children: [
                c.jsx('button', {
                  type: 'button',
                  onClick: () => setShowPicker(true),
                  className: 'w-11 h-11 flex items-center justify-center text-2xl bg-secondary border border-border shrink-0',
                  children: editEmoji || '+'
                }),
                c.jsxs('div', {
                  children: [
                    c.jsx('p', {
                      className: 'font-bold text-foreground',
                      children: 'Edit activity'
                    }),
                    c.jsx('p', {
                      className: 'text-xs text-muted-foreground',
                      children: 'Tap the icon to change emoji'
                    })
                  ]
                })
              ]
            }),
            // Name input
            c.jsx('div', {
              className: 'px-5 py-4',
              children: c.jsx('input', {
                type: 'text',
                value: editName,
                onChange: (e) => setEditName(e.target.value),
                className: 'w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground'
              })
            }),
            // Cancel / Save buttons
            c.jsxs('div', {
              className: 'flex border-t border-border',
              children: [
                c.jsx('button', {
                  onClick: () => setShowEdit(false),
                  className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                  children: 'Cancel'
                }),
                c.jsx('button', {
                  onClick: saveEdit,
                  disabled: !editName.trim(),
                  className: 'flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm disabled:opacity-40',
                  children: 'Save'
                })
              ]
            })
          ]
        })
      }),
      // Emoji picker (when editing)
      showPicker && c.jsx(LTEmojiPicker, {
        value: editEmoji,
        onSelect: setEditEmoji,
        onClose: () => setShowPicker(false)
      })
    ]
  });
}

// ─── Bottom Sheet (hh) ──────────────────────────────────────────────────────
// Modal overlay container — fixed overlay with backdrop, bottom-aligned panel.

function BottomSheet({ children, onDismiss }) {
  return c.jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onDismiss,
    children: [
      // Backdrop
      c.jsx('div', {
        className: 'absolute inset-0 bg-black/50'
      }),
      // Panel
      c.jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[80dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          c.jsx('div', {
            className: 'overflow-y-auto flex-1',
            children: children
          }),
          // Bottom spacer for safe area
          c.jsx('div', {
            className: 'h-20 bg-white shrink-0'
          })
        ]
      })
    ]
  });
}

// ─── Modal Header (ph) ──────────────────────────────────────────────────────
// Activity icon + name + subtitle header for modals.

function ModalHeader({ activity, subtitle }) {
  return c.jsxs('div', {
    className: 'px-5 pt-5 pb-3 border-b border-border flex items-center gap-3',
    children: [
      // Emoji or colored dot
      activity.emoji
        ? c.jsx('span', {
            className: 'text-lg leading-none shrink-0 w-5 text-center',
            children: activity.emoji
          })
        : c.jsx('div', {
            className: 'w-3 h-3 shrink-0',
            style: { backgroundColor: activity.color }
          }),
      // Name + subtitle
      c.jsxs('div', {
        children: [
          c.jsx('p', {
            className: 'font-bold text-foreground leading-tight',
            children: activity.name
          }),
          c.jsx('p', {
            className: 'text-xs text-muted-foreground mt-0.5',
            children: subtitle
          })
        ]
      })
    ]
  });
}

// ─── Modal Option (Js) ──────────────────────────────────────────────────────
// Clickable option row for modals (icon + label + description).

function ModalOption({ icon, label, description, onClick, labelClass = '' }) {
  return c.jsxs('button', {
    onClick,
    className: 'w-full flex items-center gap-4 px-5 py-4 border-b border-border hover:bg-secondary transition-colors text-left',
    children: [
      c.jsx('div', {
        className: 'shrink-0 text-foreground',
        children: icon
      }),
      c.jsxs('div', {
        children: [
          c.jsx('p', {
            className: Pe('font-semibold text-sm', labelClass || 'text-foreground'),
            children: label
          }),
          c.jsx('p', {
            className: 'text-xs text-muted-foreground mt-0.5',
            children: description
          })
        ]
      })
    ]
  });
}

// ─── Time Picker (mh) ──────────────────────────────────────────────────────
// Hour (1-12) + Minute (0-59) + AM/PM toggle

function TimePicker({ label, value, onChange }) {
  const time = value ?? { h: 12, m: 0, ampm: 'AM' };
  const inputClass = 'border border-border bg-secondary text-foreground font-bold text-lg px-2 py-2.5 outline-none focus:border-primary appearance-none text-center';

  return c.jsxs('div', {
    className: 'flex-1',
    children: [
      c.jsx('label', {
        className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2',
        children: label
      }),
      c.jsxs('div', {
        className: 'flex items-center gap-1',
        children: [
          // Hour select (1-12)
          c.jsx('select', {
            value: time.h,
            onChange: (e) => onChange({ ...time, h: Number(e.target.value) }),
            className: Pe(inputClass, 'w-14'),
            children: Array.from({ length: 12 }, (_, i) => i + 1).map(h =>
              c.jsx('option', { value: h, children: String(h).padStart(2, '0') }, h)
            )
          }),
          c.jsx('span', {
            className: 'font-bold text-foreground text-lg',
            children: ':'
          }),
          // Minute select (0-59)
          c.jsx('select', {
            value: time.m,
            onChange: (e) => onChange({ ...time, m: Number(e.target.value) }),
            className: Pe(inputClass, 'w-14'),
            children: Array.from({ length: 60 }, (_, i) => i).map(m =>
              c.jsx('option', { value: m, children: String(m).padStart(2, '0') }, m)
            )
          }),
          // AM/PM toggle
          c.jsx('button', {
            type: 'button',
            onClick: () => onChange({ ...time, ampm: time.ampm === 'AM' ? 'PM' : 'AM' }),
            className: 'border border-border bg-secondary text-foreground font-bold text-sm px-2 py-2.5 w-12 hover:bg-primary hover:text-white transition-colors',
            children: time.ampm
          })
        ]
      })
    ]
  });
}

// ─── Log Time Block Modal (LC) ──────────────────────────────────────────────
// Manual time entry: from date/time, to date/time, duration preview.

function LogTimeBlockModal({ activity, onClose, onSave }) {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
  const [fromDate, setFromDate] = w.useState(today);
  const [toDate, setToDate] = w.useState(today);
  const [fromTime, setFromTime] = w.useState(() => getDefaultTime());
  const [toTime, setToTime] = w.useState(null);

  // Get current time in { h, m, ampm } format
  function getDefaultTime() {
    const now = new Date();
    const hours = now.getHours();
    return {
      h: hours % 12 === 0 ? 12 : hours % 12,
      m: now.getMinutes(),
      ampm: hours < 12 ? 'AM' : 'PM'
    };
  }

  // Convert time object to ISO string
  const toISOString = (dateStr, timeObj) => {
    return new Date(`${dateStr}T${timeTo24(timeObj)}`).toISOString();
  };

  // Convert { h, m, ampm } to 24h "HH:MM" string
  const timeTo24 = (timeObj) => {
    let hours = timeObj.h % 12;
    if (timeObj.ampm === 'PM') hours += 12;
    return `${String(hours).padStart(2, '0')}:${String(timeObj.m).padStart(2, '0')}`;
  };

  const fromTimestamp = fromTime ? toISOString(fromDate, fromTime) : null;
  const toTimestamp = toTime ? toISOString(toDate, toTime) : null;

  // Calculate duration in minutes
  const durationMinutes = fromTimestamp && toTimestamp
    ? Math.round((new Date(toTimestamp).getTime() - new Date(fromTimestamp).getTime()) / 60000)
    : null;

  const isValid = durationMinutes !== null && durationMinutes > 0;
  const spansDays = fromDate !== toDate;

  const dateInputClass = 'border border-border bg-secondary text-foreground font-medium text-sm px-3 py-2 outline-none focus:border-primary w-full';

  // When "From" date changes, ensure "To" date doesn't go before it
  const handleFromDateChange = (e) => {
    const newFromDate = e.target.value;
    setFromDate(newFromDate);
    if (toDate < newFromDate) setToDate(newFromDate);
  };

  return c.jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onClose,
    children: [
      c.jsx('div', { className: 'absolute inset-0 bg-black/50' }),
      c.jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Header
          c.jsxs('div', {
            className: 'px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0',
            children: [
              c.jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  c.jsx('div', {
                    className: 'w-3 h-3',
                    style: { backgroundColor: activity.color }
                  }),
                  c.jsxs('div', {
                    children: [
                      c.jsx('p', {
                        className: 'font-bold text-foreground',
                        children: activity.name
                      }),
                      c.jsx('p', {
                        className: 'text-xs text-muted-foreground',
                        children: 'Log a time block'
                      })
                    ]
                  })
                ]
              }),
              c.jsx('button', {
                onClick: onClose,
                className: 'text-muted-foreground px-2 py-1 text-sm',
                children: 'x'
              })
            ]
          }),
          // Form content
          c.jsxs('div', {
            className: 'overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4',
            children: [
              // From date
              c.jsxs('div', {
                children: [
                  c.jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'Date'
                  }),
                  c.jsx('input', {
                    type: 'date',
                    value: fromDate,
                    onChange: handleFromDateChange,
                    className: dateInputClass
                  })
                ]
              }),
              // From time
              c.jsx(TimePicker, {
                label: 'From',
                value: fromTime,
                onChange: setFromTime
              }),
              // Divider
              c.jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  c.jsx('div', { className: 'flex-1 h-px bg-border' }),
                  c.jsx('span', {
                    className: 'text-muted-foreground text-sm font-semibold',
                    children: 'TO'
                  }),
                  c.jsx('div', { className: 'flex-1 h-px bg-border' })
                ]
              }),
              // To date with "Ends next day" badge
              c.jsxs('div', {
                children: [
                  c.jsxs('label', {
                    className: 'flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: [
                      c.jsx('span', { children: 'End date' }),
                      spansDays && c.jsx('span', {
                        className: 'text-primary normal-case font-bold',
                        children: 'Ends next day'
                      })
                    ]
                  }),
                  c.jsx('input', {
                    type: 'date',
                    value: toDate,
                    min: fromDate,
                    onChange: (e) => setToDate(e.target.value),
                    className: dateInputClass
                  })
                ]
              }),
              // To time
              c.jsx(TimePicker, {
                label: 'To',
                value: toTime,
                onChange: setToTime
              }),
              // Duration preview
              durationMinutes !== null && durationMinutes > 0 && c.jsx('div', {
                className: 'bg-primary/5 border border-primary/20 px-4 py-3 text-center',
                children: c.jsx('p', {
                  className: 'text-sm font-bold text-primary',
                  children: durationMinutes >= 60
                    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                    : `${durationMinutes}m`
                })
              }),
              // Validation error
              toTime && durationMinutes !== null && durationMinutes <= 0 && c.jsx('p', {
                className: 'text-sm text-destructive font-medium text-center',
                children: 'End must be after start.'
              })
            ]
          }),
          // Cancel / Log block buttons
          c.jsxs('div', {
            className: 'flex border-t border-border shrink-0',
            children: [
              c.jsx('button', {
                onClick: onClose,
                className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                children: 'Cancel'
              }),
              c.jsx('button', {
                onClick: () => {
                  if (isValid && fromTimestamp && toTimestamp) {
                    onSave(fromTimestamp, toTimestamp);
                  }
                },
                disabled: !isValid,
                className: 'flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm disabled:opacity-40',
                children: 'Log block'
              })
            ]
          }),
          // Bottom spacer
          c.jsx('div', { className: 'h-20 bg-white shrink-0' })
        ]
      })
    ]
  });
}

// ─── Edit Time Block Modal (AC) ─────────────────────────────────────────────
// Edit existing block's start/end time with "Keep timer running" checkbox.

function EditTimeBlockModal({ block, activity, onClose, onSave }) {
  // Helper: zero-pad a number to 2 digits
  const pad2 = (n) => String(n).padStart(2, '0');

  // Convert ISO string to datetime-local value
  const toLocalDatetime = (isoString) => {
    const d = new Date(isoString);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const now = new Date();
  const [startValue, setStartValue] = w.useState(() => toLocalDatetime(block.startTime));
  const [endValue, setEndValue] = w.useState(() => toLocalDatetime(now.toISOString()));
  const [keepRunning, setKeepRunning] = w.useState(true); // default checked

  return c.jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onClose,
    children: [
      c.jsx('div', { className: 'absolute inset-0 bg-black/50' }),
      c.jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Header
          c.jsxs('div', {
            className: 'px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0',
            children: [
              c.jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  c.jsx('div', {
                    className: 'w-3 h-3',
                    style: { backgroundColor: activity.color }
                  }),
                  c.jsxs('div', {
                    children: [
                      c.jsx('p', {
                        className: 'font-bold text-foreground',
                        children: 'Edit time block'
                      }),
                      c.jsx('p', {
                        className: 'text-xs text-muted-foreground',
                        children: activity.name
                      })
                    ]
                  })
                ]
              }),
              c.jsx('button', {
                onClick: onClose,
                className: 'text-muted-foreground px-2 py-1 text-sm',
                children: 'x'
              })
            ]
          }),
          // Form content
          c.jsxs('div', {
            className: 'overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4',
            children: [
              // Start time input
              c.jsxs('div', {
                children: [
                  c.jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'Start time'
                  }),
                  c.jsx('input', {
                    type: 'datetime-local',
                    value: startValue,
                    onChange: (e) => setStartValue(e.target.value),
                    className: 'w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground'
                  })
                ]
              }),
              // "Keep timer running" checkbox
              c.jsxs('label', {
                className: 'flex items-center gap-3 cursor-pointer select-none',
                children: [
                  c.jsx('input', {
                    type: 'checkbox',
                    checked: keepRunning,
                    onChange: (e) => setKeepRunning(e.target.checked),
                    className: 'w-4 h-4 accent-primary'
                  }),
                  c.jsx('span', {
                    className: 'text-sm font-medium text-foreground',
                    children: 'Keep timer running'
                  })
                ]
              }),
              // End time input (hidden when keepRunning is true)
              !keepRunning && c.jsxs('div', {
                children: [
                  c.jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'End time'
                  }),
                  c.jsx('input', {
                    type: 'datetime-local',
                    value: endValue,
                    onChange: (e) => setEndValue(e.target.value),
                    className: 'w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground'
                  })
                ]
              })
            ]
          }),
          // Cancel / Save buttons
          c.jsxs('div', {
            className: 'flex border-t border-border shrink-0',
            children: [
              c.jsx('button', {
                onClick: onClose,
                className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                children: 'Cancel'
              }),
              c.jsx('button', {
                onClick: () => {
                  const startTime = new Date(startValue).toISOString();
                  const endTime = keepRunning ? null : new Date(endValue).toISOString();
                  onSave(startTime, endTime);
                },
                className: 'flex-1 py-4 text-primary font-bold hover:bg-secondary text-sm',
                children: 'Save'
              })
            ]
          }),
          // Bottom spacer
          c.jsx('div', { className: 'h-20 bg-white shrink-0' })
        ]
      })
    ]
  });
}

// ─── Add Activity Bar (IC) ──────────────────────────────────────────────────
// Bottom bar for adding new activities with text input + emoji picker + add button.

function AddActivityBar() {
  const [name, setName] = w.useState('');
  const [newEmoji, setNewEmoji] = w.useState('');
  const [showNewPicker, setShowNewPicker] = w.useState(false);
  const createActivity = PC();  // PC = useCreateActivity
  const queryClient = Es();     // Es = useQueryClient
  const inputRef = zh.useRef(null); // zh = React

  const handleAdd = () => {
    if (!name.trim()) return;
    const randomColor = fh[Math.floor(Math.random() * fh.length)]; // fh = COLOR_PALETTE
    createActivity.mutate({
      data: {
        name: name.trim(),
        color: randomColor,
        emoji: newEmoji
      }
    }, {
      onSuccess: () => {
        setName('');
        setNewEmoji('');
        queryClient.invalidateQueries({ queryKey: Kc() }); // activities
        inputRef.current?.focus();
      }
    });
  };

  return c.jsxs(w.Fragment, {
    children: [
      // Add bar
      c.jsxs('div', {
        className: 'border-t border-border bg-white flex items-center',
        children: [
          // Text input
          c.jsx('input', {
            ref: inputRef,
            type: 'text',
            value: name,
            onChange: (e) => setName(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') handleAdd();
            },
            placeholder: 'New activity...',
            className: 'flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none px-2 py-4 text-base font-medium min-w-0'
          }),
          // Emoji picker button (shows selected emoji or 🙂 default)
          c.jsx('button', {
            type: 'button',
            onClick: () => setShowNewPicker(true),
            className: 'h-full px-4 py-4 flex items-center justify-center text-xl text-muted-foreground shrink-0',
            title: 'Choose emoji',
            children: newEmoji || '🙂'
          }),
          // Add button with Plus icon
          c.jsxs('button', {
            onClick: handleAdd,
            disabled: !name.trim() || createActivity.isPending,
            className: 'h-full px-5 py-4 flex items-center gap-2 bg-primary text-white font-semibold text-sm disabled:opacity-40 shrink-0',
            children: [
              c.jsx(rk, { className: 'w-4 h-4' }), // Plus icon
              'Add'
            ]
          })
        ]
      }),
      // Emoji picker for new activity
      showNewPicker && c.jsx(LTEmojiPicker, {
        value: newEmoji,
        onSelect: setNewEmoji,
        onClose: () => setShowNewPicker(false)
      })
    ]
  });
}

// ─── Format Time Helper ─────────────────────────────────────────────────────
// Formats an ISO timestamp to readable time string like "3:45 PM".

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
}

// ─── Home Screen (EXPORTED) ─────────────────────────────────────────────────
// Main Timer/Activity screen. Manages activity list, timer state, and all modals.

export function HomeScreen({ profile }) {
  const queryClient = Es();                         // Es = useQueryClient
  const { data: activities = [] } = kC();           // kC = useActivities
  const { data: blocks = [] } = Ay();               // Ay = useBlocks
  const runningBlock = blocks.find(b => !b.endTime); // Find currently running block

  const createBlock = NC();     // NC = useCreateBlock
  const updateBlock = jC();     // jC = useUpdateBlock

  // Modal state: selected activity for action sheet
  const [selectedActivity, setSelectedActivity] = w.useState(null);
  // Modal state: active block info for stop/edit sheet
  const [activeBlockInfo, setActiveBlockInfo] = w.useState(null);
  // Modal state: editing block for edit modal
  const [editingBlock, setEditingBlock] = w.useState(null);
  // Modal state: log time block activity
  const [logBlockActivity, setLogBlockActivity] = w.useState(null);

  // Handle tapping an activity
  const handleActivityTap = (activity) => {
    if (runningBlock?.activityId === activity.id) {
      // This activity has a running timer — show stop/edit sheet
      setActiveBlockInfo({ block: runningBlock, activity });
    } else {
      // No running timer for this activity — show action sheet
      setSelectedActivity(activity);
    }
  };

  // Start timer for an activity
  const startTimer = (activity) => {
    const doCreate = () => {
      createBlock.mutate({
        data: {
          activityId: activity.id,
          startTime: new Date().toISOString()
        }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: Ho() }); // blocks
          queryClient.invalidateQueries({ queryKey: Qo() }); // today-stats
        }
      });
    };

    // If there's already a running block, stop it first
    if (runningBlock) {
      updateBlock.mutate({
        id: runningBlock.id,
        data: { endTime: new Date().toISOString() }
      }, { onSuccess: doCreate });
    } else {
      doCreate();
    }

    setSelectedActivity(null);
  };

  // Stop the running timer
  const stopTimer = () => {
    if (!activeBlockInfo) return;
    updateBlock.mutate({
      id: activeBlockInfo.block.id,
      data: { endTime: new Date().toISOString() }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: Ho() }); // blocks
        queryClient.invalidateQueries({ queryKey: Qo() }); // today-stats
        setActiveBlockInfo(null);
      }
    });
  };

  // Refresh all queries
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: Ho() }); // blocks
    queryClient.invalidateQueries({ queryKey: Qo() }); // today-stats
  };

  return c.jsxs('div', {
    'data-source-file': 'screens/Home.js',
    className: 'flex flex-col',
    children: [
      // Retirement countdown panel (collapsible)
      c.jsx(LTTimerPanel, { profile }),
      // Daily value bar
      c.jsx(LTDailyValueBar, {}),
      // Activity list
      c.jsxs('div', {
        className: 'flex flex-col divide-y divide-border',
        children: [
          // Empty state
          activities.length === 0 && c.jsxs('div', {
            className: 'flex flex-col items-center justify-center py-20 px-8 text-center bg-background',
            children: [
              c.jsx(rh, { className: 'w-8 h-8 text-muted-foreground mb-4 opacity-30' }), // Square icon
              c.jsx('p', {
                className: 'text-muted-foreground font-medium',
                children: 'No activities yet.'
              }),
              c.jsx('p', {
                className: 'text-sm text-muted-foreground mt-1',
                children: 'Add one below to start tracking.'
              })
            ]
          }),
          // Activity rows
          activities.map(activity =>
            c.jsx(ActivityCard, {
              activity,
              isActive: runningBlock?.activityId === activity.id,
              activeBlock: runningBlock?.activityId === activity.id ? runningBlock : null,
              onTap: () => handleActivityTap(activity)
            }, activity.id)
          )
        ]
      }),
      // Add activity bar
      c.jsx(AddActivityBar, {}),

      // ─── Modal: Action Sheet (Start Timer / Log Time Block) ─────────────
      selectedActivity && c.jsxs(BottomSheet, {
        onDismiss: () => setSelectedActivity(null),
        children: [
          c.jsx(ModalHeader, {
            activity: selectedActivity,
            subtitle: 'How do you want to track this?'
          }),
          c.jsx(ModalOption, {
            icon: c.jsx(Ty, { className: 'w-5 h-5' }),     // Timer icon
            label: 'Start timer now',
            description: 'Live timer from right now',
            onClick: () => startTimer(selectedActivity)
          }),
          c.jsx(ModalOption, {
            icon: c.jsx(Jb, { className: 'w-5 h-5' }),     // CalendarClock icon
            label: 'Log a time block',
            description: 'Set a start and end time manually',
            onClick: () => {
              setLogBlockActivity(selectedActivity);
              setSelectedActivity(null);
            }
          })
        ]
      }),

      // ─── Modal: Active Timer Sheet (Stop / Edit) ────────────────────────
      activeBlockInfo && c.jsxs(BottomSheet, {
        onDismiss: () => setActiveBlockInfo(null),
        children: [
          c.jsx(ModalHeader, {
            activity: activeBlockInfo.activity,
            subtitle: 'Timer is running'
          }),
          c.jsx(ModalOption, {
            icon: c.jsx(rh, { className: 'w-5 h-5 text-destructive' }), // Square icon (destructive)
            label: 'Stop timer',
            labelClass: 'text-destructive',
            description: `Started at ${formatTime(activeBlockInfo.block.startTime)}`,
            onClick: stopTimer
          }),
          c.jsx(ModalOption, {
            icon: c.jsx(tk, { className: 'w-5 h-5' }),     // Pencil icon
            label: 'Edit time',
            description: 'Adjust start or end time',
            onClick: () => {
              setEditingBlock(activeBlockInfo);
              setActiveBlockInfo(null);
            }
          })
        ]
      }),

      // ─── Modal: Log Time Block ───────────────────────────────────────────
      logBlockActivity && c.jsx(LogTimeBlockModal, {
        activity: logBlockActivity,
        onClose: () => setLogBlockActivity(null),
        onSave: (startTime, endTime) => {
          const doCreate = () => {
            createBlock.mutate({
              data: {
                activityId: logBlockActivity.id,
                startTime,
                endTime
              }
            }, {
              onSuccess: () => {
                refreshAll();
                setLogBlockActivity(null);
              }
            });
          };
          // Stop existing running block first
          if (runningBlock) {
            updateBlock.mutate({
              id: runningBlock.id,
              data: { endTime: new Date().toISOString() }
            }, { onSuccess: doCreate });
          } else {
            doCreate();
          }
        }
      }),

      // ─── Modal: Edit Time Block ──────────────────────────────────────────
      editingBlock && c.jsx(EditTimeBlockModal, {
        block: editingBlock.block,
        activity: editingBlock.activity,
        onClose: () => setEditingBlock(null),
        onSave: (startTime, endTime) => {
          updateBlock.mutate({
            id: editingBlock.block.id,
            data: {
              startTime,
              endTime: endTime || undefined
            }
          }, {
            onSuccess: () => {
              refreshAll();
              setEditingBlock(null);
            }
          });
        }
      })
    ]
  });
}
