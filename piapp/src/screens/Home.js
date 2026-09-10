// React & JSX
import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';

// App logic
import { getStore, setStore, nextId, enrichBlocksForRange } from '../lib/storage.js';
import { calcRemainingTime, calcPercentLived, msToBreakdown } from '../lib/lifeCalc.js';
import { getRandomColor } from '../lib/constants.js';
import { blocksKey, activitiesKey, todayStatsKey } from '../lib/queryKeys.js';
import { useActivities } from '../hooks/useActivities.js';
import { useBlocks } from '../hooks/useBlocks.js';
import { useCreateBlock } from '../hooks/useCreateBlock.js';
import { useUpdateBlock } from '../hooks/useUpdateBlock.js';
import { useCreateActivity } from '../hooks/useCreateActivity.js';
import { useUpdateActivity } from '../hooks/useUpdateActivity.js';
import { useDeleteActivity } from '../hooks/useDeleteActivity.js';
import { useTodayStats } from '../hooks/useTodayStats.js';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/cn.js';

// Icons
import { Timer as Ty, CalendarClock as Jb, Clock as Zb, Play as nk, Trash2 as lk, Square as rh, Plus as rk, Pencil as tk } from 'lucide-react';

// ─── LT Timer Panel ─────────────────────────────────────────────────────────
// Collapsible panel containing the retirement countdown timer.
// Toggles open/closed with a full-width button.

function LTTimerPanel({ profile }) {
  const [open, setOpen] = useState(true); // default expanded like compiled

  return jsxs('div', {
    'data-lt-enhancement': 'retirement',
    className: 'relative',
    children: [
      // Toggle button — "v" when open, "^" when closed
      jsx('button', {
        type: 'button',
        onClick: () => setOpen(!open),
        className: 'w-full h-8 flex items-center justify-center bg-primary text-white transition-colors pointer-events-auto',
        title: open ? 'Hide timer' : 'Show timer',
        'aria-label': open ? 'Hide timer' : 'Show timer',
        children: jsx('span', {
          className: 'text-xs',
          children: open ? 'v' : '^'
        })
      }),
      // Animated container — maxHeight transitions 0 → 320px
      jsx('div', {
        className: 'overflow-hidden transition-all duration-300 ease-in-out',
        style: { maxHeight: open ? '320px' : '0px' },
        children: jsx(RetirementCountdown, { profile })
      })
    ]
  });
}

// ─── Retirement Countdown (MC) ─────────────────────────────────────────────
// Displays remaining life time with 5-column grid (years, days, hours, min, sec).
// Updates live every 1 second.

function RetirementCountdown({ profile }) {
  const [remainingMs, setRemainingMs] = useState(() => calcRemainingTime(profile));
  const percentLived = calcPercentLived(profile);

  useEffect(() => {
    setRemainingMs(calcRemainingTime(profile));
    const interval = setInterval(() => setRemainingMs(calcRemainingTime(profile)), 1000);
    return () => clearInterval(interval);
  }, [profile]);

  const breakdown = msToBreakdown(remainingMs);
  const planLabel = 'Basic';
  const deathDate = new Date(profile.dob);
  deathDate.setFullYear(deathDate.getFullYear() + (profile.lifespanYears || 80));
  const retirementDateStr = deathDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return jsxs('div', {
    'data-lt-enhancement': 'retirement',
    className: 'bg-primary text-white px-5 pt-8 pb-6',
    children: [
      // Title row with plan badge
      jsxs('div', {
        className: 'flex items-center justify-between mb-5',
        children: [
          jsxs('p', {
            className: 'text-xs font-semibold text-white/40 uppercase tracking-widest m-0',
            children: [profile.name, "'s Remaining Retirement Time"]
          }),
          jsxs('span', {
            className: 'flex items-center gap-1 bg-white/10 text-white/70 text-[11px] font-bold px-2.5 py-1 rounded-full',
            children: ['\u2605 ', planLabel]
          })
        ]
      }),
      // Retirement date
      retirementDateStr && jsxs('p', {
        className: 'text-[11px] font-semibold text-white/50 mb-4 flex items-center gap-1.5',
        children: ['\uD83C\uDFAF Retirement date: ', jsx('span', { className: 'text-white/70', children: retirementDateStr })]
      }),
      // 5-column grid: years, days, hours, min, sec
      jsxs('div', {
        className: 'grid grid-cols-5 gap-2 mb-5',
        children: [
          jsx(TimeDigit, { value: breakdown.years, label: 'years' }),
          jsx(TimeDigit, { value: breakdown.days, label: 'days' }),
          jsx(TimeDigit, { value: breakdown.hours, label: 'hours' }),
          jsx(TimeDigit, { value: breakdown.minutes, label: 'min' }),
          jsx(TimeDigit, { value: breakdown.seconds, label: 'sec', accent: true })
        ]
      }),
      // Progress bar
      jsx('div', {
        className: 'h-1 w-full bg-white/10 overflow-hidden mb-2',
        children: jsx('div', {
          className: 'h-full bg-accent',
          style: { width: `${percentLived}%` }
        })
      }),
      // Footer: percent lived + minutes left
      jsxs('div', {
        className: 'flex justify-between text-[11px] text-white/35 font-medium',
        children: [
          jsxs('span', { children: [percentLived.toFixed(1), '% lived'] }),
          jsxs('span', { children: [breakdown.totalMinutes.toLocaleString(), ' min left'] })
        ]
      })
    ]
  });
}

// ─── Time Digit (jo) ────────────────────────────────────────────────────────
// Single digit cell in the countdown grid. Shows value with leading zero pad.

function TimeDigit({ value, label, accent }) {
  return jsxs('div', {
    className: 'flex flex-col items-center bg-white/8 py-3 gap-0.5',
    children: [
      jsx('span', {
        className: cn(
          'font-black tabular-nums leading-none',
          accent ? 'text-accent text-2xl' : 'text-white text-2xl'
        ),
        children: String(value).padStart(2, '0')
      }),
      jsx('span', {
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
  const [perMinute, setPerMinute] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
      return stored && stored.perMinute ? stored.perMinute : 0;
    } catch { return 0; }
  });

  const [dailyHours, setDailyHours] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
      return stored && stored.hours ? stored.hours : 8;
    } catch { return 8; }
  });

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
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

  return jsxs('div', {
    'data-lt-enhancement': 'saved-value',
    className: 'bg-primary text-white px-5 py-4',
    children: [
      jsx('p', {
        className: 'text-xs font-semibold text-white/50 uppercase tracking-widest mb-1',
        children: "Today's time value left"
      }),
      jsxs('p', {
        className: 'text-2xl font-black',
        children: ['Rs.', valueLeft.toFixed(2)]
      }),
      jsx('div', {
        className: 'h-1 w-full bg-white/10 overflow-hidden mt-3',
        children: jsx('div', {
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
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(0);
  const [recent, setRecent] = useState(() => {
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

  return jsx(BottomSheet, {
    onDismiss: onClose,
    children: jsxs('div', {
      className: 'flex flex-col',
      children: [
        // Search input
        jsx('div', {
          className: 'px-3 pt-3 pb-2',
          children: jsx('input', {
            type: 'text',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            placeholder: 'Search emoji',
            className: 'w-full bg-secondary rounded-full px-4 py-2 text-sm outline-none'
          })
        }),
        // Category tab bar (hidden when searching)
        !query && jsx('div', {
          className: 'flex border-b border-border',
          style: { overflowX: 'auto', whiteSpace: 'nowrap' },
          children: categories.map((cat, idx) =>
            jsx('button', {
              type: 'button',
              onClick: () => setActiveCat(idx),
              style: { flexShrink: 0 },
              className: cn(
                'px-3 py-2 text-lg border-b',
                activeCat === idx ? 'text-primary border-primary' : 'text-muted-foreground border-transparent'
              ),
              children: cat.icon
            }, cat.name)
          )
        }),
        // Emoji grid
        shown.length
          ? jsx('div', {
              className: 'px-3 py-3',
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(8,1fr)',
                gap: '4px',
                maxHeight: '50vh',
                overflowY: 'auto'
              },
              children: shown.map((emoji, idx) =>
                jsx('button', {
                  type: 'button',
                  onClick: () => pickEmoji(emoji),
                  className: cn(
                    'w-9 h-9 flex items-center justify-center text-xl rounded hover:bg-secondary',
                    value === emoji ? 'bg-secondary' : ''
                  ),
                  children: emoji
                }, idx)
              )
            })
          : // Empty state
            jsx('div', {
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const deleteActivity = useDeleteActivity();
  const queryClient = useQueryClient();
  const updateActivity = useUpdateActivity();

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [editName, setEditName] = useState(activity.name);
  const [editEmoji, setEditEmoji] = useState(activity.emoji || '');

  // Live elapsed timer when activity is active
  useEffect(() => {
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
          queryClient.invalidateQueries({ queryKey: activitiesKey() }); // activities
          queryClient.invalidateQueries({ queryKey: blocksKey() }); // blocks
          queryClient.invalidateQueries({ queryKey: todayStatsKey() }); // today-stats
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
        queryClient.invalidateQueries({ queryKey: activitiesKey() });
        queryClient.invalidateQueries({ queryKey: blocksKey() });
        queryClient.invalidateQueries({ queryKey: todayStatsKey() });
        setShowEdit(false);
      }
    });
  };

  return jsxs(Fragment, {
    children: [
      // Main row
      jsxs('div', {
        role: 'button',
        tabIndex: 0,
        onClick: onTap,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTap();
          }
        },
        className: cn('group flex items-center w-full cursor-pointer select-none transition-colors bg-white hover:bg-secondary'),
        style: { borderLeft: isActive ? `4px solid ${activity.color}` : '4px solid transparent' },
        children: [
          // Left section: emoji/dot + name + edit button
          jsxs('div', {
            className: 'flex items-center flex-1 min-w-0 px-5 py-5 gap-4',
            children: [
              // Emoji or colored dot
              activity.emoji
                ? jsx('span', {
                    className: 'text-lg leading-none shrink-0 w-5 text-center',
                    children: activity.emoji
                  })
                : jsx('div', {
                    className: cn('w-2.5 h-2.5 shrink-0', isActive && 'animate-pulse'),
                    style: { backgroundColor: activity.color }
                  }),
              // Activity name
              jsx('span', {
                className: 'text-base font-semibold flex-1 min-w-0 text-foreground',
                children: activity.name
              }),
              // Edit button
              jsx('button', {
                onClick: openEdit,
                className: 'w-8 h-8 flex items-center justify-center border border-transparent hover:border-primary hover:text-primary text-muted-foreground transition-all shrink-0',
                title: 'Edit',
                children: jsx('span', {
                  className: 'text-sm',
                  children: 'Edit'
                })
              })
            ]
          }),
          // Right section: elapsed time + play/clock + trash
          jsxs('div', {
            className: 'flex items-center gap-2 px-4 shrink-0',
            children: [
              // Elapsed time display (when active)
              isActive && jsx('span', {
                className: 'font-mono text-sm font-bold tabular-nums',
                style: { color: activity.color },
                children: formatElapsed(elapsedSeconds)
              }),
              // Play/Clock icon button
              jsx('div', {
                className: cn(
                  'w-8 h-8 flex items-center justify-center border transition-colors',
                  isActive ? 'border-current' : 'border-border group-hover:border-foreground'
                ),
                style: isActive ? { borderColor: activity.color, color: activity.color } : {},
                children: isActive
                  ? jsx(Zb, { className: 'w-4 h-4' })        // Clock icon when running
                  : jsx(nk, { className: 'w-4 h-4 text-muted-foreground group-hover:text-foreground' }) // Play icon when stopped
              }),
              // Trash button
              jsx('button', {
                onClick: handleDelete,
                className: 'w-8 h-8 flex items-center justify-center border border-transparent hover:border-destructive hover:text-destructive text-muted-foreground transition-all',
                children: jsx(lk, { className: 'w-4 h-4' })
              })
            ]
          })
        ]
      }),
      // Edit activity modal
      showEdit && jsx(BottomSheet, {
        onDismiss: () => setShowEdit(false),
        children: jsxs('div', {
          className: 'flex flex-col',
          children: [
            // Header with emoji button
            jsxs('div', {
              className: 'px-5 pt-5 pb-3 border-b border-border flex items-center gap-3',
              children: [
                jsx('button', {
                  type: 'button',
                  onClick: () => setShowPicker(true),
                  className: 'w-11 h-11 flex items-center justify-center text-2xl bg-secondary border border-border shrink-0',
                  children: editEmoji || '+'
                }),
                jsxs('div', {
                  children: [
                    jsx('p', {
                      className: 'font-bold text-foreground',
                      children: 'Edit activity'
                    }),
                    jsx('p', {
                      className: 'text-xs text-muted-foreground',
                      children: 'Tap the icon to change emoji'
                    })
                  ]
                })
              ]
            }),
            // Name input
            jsx('div', {
              className: 'px-5 py-4',
              children: jsx('input', {
                type: 'text',
                value: editName,
                onChange: (e) => setEditName(e.target.value),
                className: 'w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground'
              })
            }),
            // Cancel / Save buttons
            jsxs('div', {
              className: 'flex border-t border-border',
              children: [
                jsx('button', {
                  onClick: () => setShowEdit(false),
                  className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                  children: 'Cancel'
                }),
                jsx('button', {
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
      showPicker && jsx(LTEmojiPicker, {
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
  return jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onDismiss,
    children: [
      // Backdrop
      jsx('div', {
        className: 'absolute inset-0 bg-black/50'
      }),
      // Panel
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[80dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          jsx('div', {
            className: 'overflow-y-auto flex-1',
            children: children
          }),
          // Bottom spacer for safe area
          jsx('div', {
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
  return jsxs('div', {
    className: 'px-5 pt-5 pb-3 border-b border-border flex items-center gap-3',
    children: [
      // Emoji or colored dot
      activity.emoji
        ? jsx('span', {
            className: 'text-lg leading-none shrink-0 w-5 text-center',
            children: activity.emoji
          })
        : jsx('div', {
            className: 'w-3 h-3 shrink-0',
            style: { backgroundColor: activity.color }
          }),
      // Name + subtitle
      jsxs('div', {
        children: [
          jsx('p', {
            className: 'font-bold text-foreground leading-tight',
            children: activity.name
          }),
          jsx('p', {
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
  return jsxs('button', {
    onClick,
    className: 'w-full flex items-center gap-4 px-5 py-4 border-b border-border hover:bg-secondary transition-colors text-left',
    children: [
      jsx('div', {
        className: 'shrink-0 text-foreground',
        children: icon
      }),
      jsxs('div', {
        children: [
          jsx('p', {
            className: cn('font-semibold text-sm', labelClass || 'text-foreground'),
            children: label
          }),
          jsx('p', {
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

  return jsxs('div', {
    className: 'flex-1',
    children: [
      jsx('label', {
        className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2',
        children: label
      }),
      jsxs('div', {
        className: 'flex items-center gap-1',
        children: [
          // Hour select (1-12)
          jsx('select', {
            value: time.h,
            onChange: (e) => onChange({ ...time, h: Number(e.target.value) }),
            className: cn(inputClass, 'w-14'),
            children: Array.from({ length: 12 }, (_, i) => i + 1).map(h =>
              jsx('option', { value: h, children: String(h).padStart(2, '0') }, h)
            )
          }),
          jsx('span', {
            className: 'font-bold text-foreground text-lg',
            children: ':'
          }),
          // Minute select (0-59)
          jsx('select', {
            value: time.m,
            onChange: (e) => onChange({ ...time, m: Number(e.target.value) }),
            className: cn(inputClass, 'w-14'),
            children: Array.from({ length: 60 }, (_, i) => i).map(m =>
              jsx('option', { value: m, children: String(m).padStart(2, '0') }, m)
            )
          }),
          // AM/PM toggle
          jsx('button', {
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
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [fromTime, setFromTime] = useState(() => getDefaultTime());
  const [toTime, setToTime] = useState(null);

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

  return jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onClose,
    children: [
      jsx('div', { className: 'absolute inset-0 bg-black/50' }),
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Header
          jsxs('div', {
            className: 'px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  jsx('div', {
                    className: 'w-3 h-3',
                    style: { backgroundColor: activity.color }
                  }),
                  jsxs('div', {
                    children: [
                      jsx('p', {
                        className: 'font-bold text-foreground',
                        children: activity.name
                      }),
                      jsx('p', {
                        className: 'text-xs text-muted-foreground',
                        children: 'Log a time block'
                      })
                    ]
                  })
                ]
              }),
              jsx('button', {
                onClick: onClose,
                className: 'text-muted-foreground px-2 py-1 text-sm',
                children: 'x'
              })
            ]
          }),
          // Form content
          jsxs('div', {
            className: 'overflow-y-auto flex-1 px-5 py-5 flex flex-col gap-4',
            children: [
              // From date
              jsxs('div', {
                children: [
                  jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'Date'
                  }),
                  jsx('input', {
                    type: 'date',
                    value: fromDate,
                    onChange: handleFromDateChange,
                    className: dateInputClass
                  })
                ]
              }),
              // From time
              jsx(TimePicker, {
                label: 'From',
                value: fromTime,
                onChange: setFromTime
              }),
              // Divider
              jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  jsx('div', { className: 'flex-1 h-px bg-border' }),
                  jsx('span', {
                    className: 'text-muted-foreground text-sm font-semibold',
                    children: 'TO'
                  }),
                  jsx('div', { className: 'flex-1 h-px bg-border' })
                ]
              }),
              // To date with "Ends next day" badge
              jsxs('div', {
                children: [
                  jsxs('label', {
                    className: 'flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: [
                      jsx('span', { children: 'End date' }),
                      spansDays && jsx('span', {
                        className: 'text-primary normal-case font-bold',
                        children: 'Ends next day'
                      })
                    ]
                  }),
                  jsx('input', {
                    type: 'date',
                    value: toDate,
                    min: fromDate,
                    onChange: (e) => setToDate(e.target.value),
                    className: dateInputClass
                  })
                ]
              }),
              // To time
              jsx(TimePicker, {
                label: 'To',
                value: toTime,
                onChange: setToTime
              }),
              // Duration preview
              durationMinutes !== null && durationMinutes > 0 && jsx('div', {
                className: 'bg-primary/5 border border-primary/20 px-4 py-3 text-center',
                children: jsx('p', {
                  className: 'text-sm font-bold text-primary',
                  children: durationMinutes >= 60
                    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                    : `${durationMinutes}m`
                })
              }),
              // Validation error
              toTime && durationMinutes !== null && durationMinutes <= 0 && jsx('p', {
                className: 'text-sm text-destructive font-medium text-center',
                children: 'End must be after start.'
              })
            ]
          }),
          // Cancel / Log block buttons
          jsxs('div', {
            className: 'flex border-t border-border shrink-0',
            children: [
              jsx('button', {
                onClick: onClose,
                className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                children: 'Cancel'
              }),
              jsx('button', {
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
          jsx('div', { className: 'h-20 bg-white shrink-0' })
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
  const [startValue, setStartValue] = useState(() => toLocalDatetime(block.startTime));
  const [endValue, setEndValue] = useState(() => toLocalDatetime(now.toISOString()));
  const [keepRunning, setKeepRunning] = useState(true); // default checked

  return jsxs('div', {
    className: 'fixed inset-0 z-[60] flex items-end',
    onClick: onClose,
    children: [
      jsx('div', { className: 'absolute inset-0 bg-black/50' }),
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white border-t border-border flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Header
          jsxs('div', {
            className: 'px-5 pt-5 pb-3 border-b border-border flex items-center justify-between shrink-0',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-3',
                children: [
                  jsx('div', {
                    className: 'w-3 h-3',
                    style: { backgroundColor: activity.color }
                  }),
                  jsxs('div', {
                    children: [
                      jsx('p', {
                        className: 'font-bold text-foreground',
                        children: 'Edit time block'
                      }),
                      jsx('p', {
                        className: 'text-xs text-muted-foreground',
                        children: activity.name
                      })
                    ]
                  })
                ]
              }),
              jsx('button', {
                onClick: onClose,
                className: 'text-muted-foreground px-2 py-1 text-sm',
                children: 'x'
              })
            ]
          }),
          // Form content
          jsxs('div', {
            className: 'overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4',
            children: [
              // Start time input
              jsxs('div', {
                children: [
                  jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'Start time'
                  }),
                  jsx('input', {
                    type: 'datetime-local',
                    value: startValue,
                    onChange: (e) => setStartValue(e.target.value),
                    className: 'w-full border border-border bg-secondary px-3 py-2.5 text-sm font-medium outline-none focus:border-primary text-foreground'
                  })
                ]
              }),
              // "Keep timer running" checkbox
              jsxs('label', {
                className: 'flex items-center gap-3 cursor-pointer select-none',
                children: [
                  jsx('input', {
                    type: 'checkbox',
                    checked: keepRunning,
                    onChange: (e) => setKeepRunning(e.target.checked),
                    className: 'w-4 h-4 accent-primary'
                  }),
                  jsx('span', {
                    className: 'text-sm font-medium text-foreground',
                    children: 'Keep timer running'
                  })
                ]
              }),
              // End time input (hidden when keepRunning is true)
              !keepRunning && jsxs('div', {
                children: [
                  jsx('label', {
                    className: 'block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5',
                    children: 'End time'
                  }),
                  jsx('input', {
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
          jsxs('div', {
            className: 'flex border-t border-border shrink-0',
            children: [
              jsx('button', {
                onClick: onClose,
                className: 'flex-1 py-4 text-muted-foreground font-semibold border-r border-border hover:bg-secondary text-sm',
                children: 'Cancel'
              }),
              jsx('button', {
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
          jsx('div', { className: 'h-20 bg-white shrink-0' })
        ]
      })
    ]
  });
}

// ─── Add Activity Bar (IC) ──────────────────────────────────────────────────
// Bottom bar for adding new activities with text input + emoji picker + add button.

function AddActivityBar() {
  const [name, setName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [showNewPicker, setShowNewPicker] = useState(false);
  const createActivity = useCreateActivity();
  const queryClient = useQueryClient();
  const inputRef = useRef(null); // zh = React

  const handleAdd = () => {
    if (!name.trim()) return;
    const randomColor = getRandomColor();
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
        queryClient.invalidateQueries({ queryKey: activitiesKey() }); // activities
        inputRef.current?.focus();
      }
    });
  };

  return jsxs(Fragment, {
    children: [
      // Add bar
      jsxs('div', {
        className: 'border-t border-border bg-white flex items-center',
        children: [
          // Text input
          jsx('input', {
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
          jsx('button', {
            type: 'button',
            onClick: () => setShowNewPicker(true),
            className: 'h-full px-4 py-4 flex items-center justify-center text-xl text-muted-foreground shrink-0',
            title: 'Choose emoji',
            children: newEmoji || '🙂'
          }),
          // Add button with Plus icon
          jsxs('button', {
            onClick: handleAdd,
            disabled: !name.trim() || createActivity.isPending,
            className: 'h-full px-5 py-4 flex items-center gap-2 bg-primary text-white font-semibold text-sm disabled:opacity-40 shrink-0',
            children: [
              jsx(rk, { className: 'w-4 h-4' }), // Plus icon
              'Add'
            ]
          })
        ]
      }),
      // Emoji picker for new activity
      showNewPicker && jsx(LTEmojiPicker, {
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

// ─── Life Progress Card (P6) ─────────────────────────────────────────────────
// Replaces enhancements.js buildLifeProgressCard().
// Shows greeting, SVG life progress ring, countdown, and daily time value.

function LifeProgressCard({ profile }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!profile) return null;

  const percentLived = calcPercentLived(profile);
  const remainingMs = calcRemainingTime(profile);
  const breakdown = msToBreakdown(remainingMs);

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (percentLived / 100) * circumference;

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

  // Time value
  let tvData = null;
  try {
    const stored = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
    if (stored && stored.perMinute) {
      const pm = Number(stored.perMinute);
      const dailyHours = Number(stored.hours) || 8;
      const nowDate = new Date(now);
      const secOfDay = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds();
      const remSecToday = 86400 - secOfDay;
      const dailyBudget = pm * 60 * dailyHours;
      const value = Math.max(0, dailyBudget * (remSecToday / 86400));
      const remHours = Math.floor(remSecToday / 3600);
      const remMin = Math.floor((remSecToday % 3600) / 60);
      tvData = { value, remHours, remMin, rate: pm * 60 };
    }
  } catch (e) { /* ignore */ }

  return jsxs('div', {
    className: 'mx-4 mt-3 flex flex-col gap-3',
    children: [
      // Top card: greeting + ring
      jsxs('div', {
        className: 'flex items-start justify-between gap-3 bg-background border border-border rounded-2xl p-4',
        children: [
          jsxs('div', {
            className: 'flex-1 min-w-0',
            children: [
              jsx('p', { className: 'text-sm font-semibold text-foreground/55 mb-1', children: greeting + ',' }),
              jsxs('h2', { className: 'text-[26px] font-black text-primary mb-2', children: [profile.name, ' \u2728'] }),
              jsx('p', { className: 'text-[13px] leading-relaxed text-foreground/60', children: 'Make today count. Your future is built by what you do now. \uD83D\uDC9B' })
            ]
          }),
          jsxs('div', {
            className: 'flex-shrink-0 flex flex-col items-center bg-white border border-border rounded-[14px] px-3 py-2.5',
            children: [
              jsx('p', { className: 'text-[9px] font-extrabold tracking-widest text-foreground/40 mb-1', children: 'LIFE PROGRESS' }),
              jsxs('div', {
                className: 'relative w-[88px] h-[88px] flex items-center justify-center',
                children: [
                  jsx('svg', {
                    width: 88, height: 88, viewBox: '0 0 100 100',
                    className: 'block',
                    style: { transform: 'rotate(-90deg)' },
                    children: jsxs(Fragment, {
                      children: [
                        jsx('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: 'hsl(var(--border))', strokeWidth: 8 }),
                        jsx('circle', { cx: 50, cy: 50, r: 44, fill: 'none', stroke: 'hsl(var(--accent))', strokeWidth: 8, strokeLinecap: 'round', strokeDasharray: circumference, strokeDashoffset: offset, style: { transition: 'stroke-dashoffset 0.4s ease' } })
                      ]
                    })
                  }),
                  jsx('div', {
                    className: 'absolute inset-0 flex items-center justify-center',
                    children: jsx('span', { className: 'text-[19px] font-black text-primary', children: Math.round(percentLived) + '%' })
                  })
                ]
              }),
              jsx('p', { className: 'text-[9px] font-semibold text-foreground/45 mt-1', children: 'of your life lived' })
            ]
          })
        ]
      }),
      // Countdown card
      jsxs('div', {
        className: 'bg-primary rounded-2xl p-4',
        children: [
          jsxs('div', {
            className: 'flex items-start justify-between gap-2.5 mb-3.5',
            children: [
              jsxs('div', {
                className: 'flex-1 min-w-0',
                children: [
                  jsx('p', { className: 'text-sm font-extrabold text-white', children: profile.name + '\u2019s Remaining Retirement Time' }),
                  jsx('p', { className: 'text-[13px] font-bold text-white/85 mt-0.5', children: '\uD83C\uDFC1 Target: \uD83C\uDFC3 ' + profile.dob })
                ]
              })
            ]
          }),
          jsxs('div', {
            className: 'grid grid-cols-5 gap-1.5',
            children: [
              jsx(LifeDigit, { value: breakdown.years, label: 'YEARS' }),
              jsx(LifeDigit, { value: breakdown.days, label: 'DAYS' }),
              jsx(LifeDigit, { value: breakdown.hours, label: 'HOURS' }),
              jsx(LifeDigit, { value: breakdown.minutes, label: 'MIN' }),
              jsx(LifeDigit, { value: breakdown.seconds, label: 'SEC', accent: true })
            ]
          })
        ]
      }),
      // Time value card
      tvData && jsxs('div', {
        className: 'border border-accent/30 bg-accent/10 rounded-2xl p-4 flex items-center justify-between gap-2.5',
        children: [
          jsxs('div', {
            children: [
              jsx('p', { className: 'text-[13px] font-extrabold text-primary', children: 'Today\u2019s Time Value' }),
              jsx('p', { className: 'text-[11px] text-foreground/50 mt-px', children: 'Your remaining time' }),
              jsx('p', { className: 'text-[22px] font-black text-accent mt-1.5', children: 'Rs.' + tvData.value.toFixed(2) }),
              jsx('p', { className: 'text-[11px] text-foreground/50 mt-0.5', children: tvData.remHours + 'h ' + tvData.remMin + 'm left' })
            ]
          }),
          jsx('span', {
            className: 'flex-shrink-0 bg-accent/15 text-accent rounded-full px-2.5 py-1.5 text-[10px] font-extrabold text-center leading-tight max-w-[96px]',
            children: 'Rs.' + Number(tvData.rate).toFixed(2) + '/hour'
          })
        ]
      })
    ]
  });
}

function LifeDigit({ value, label, accent }) {
  return jsxs('div', {
    className: 'flex flex-col items-center bg-white/8 rounded-[10px] py-2 px-0.5',
    children: [
      jsx('span', {
        className: cn('text-[17px] font-black text-white tabular-nums leading-none', accent && 'text-accent'),
        children: String(value).padStart(2, '0')
      }),
      jsx('span', {
        className: 'text-[8px] font-extrabold tracking-widest text-white/40 mt-0.5',
        children: label
      })
    ]
  });
}

// ─── Today at a Glance (P7) ──────────────────────────────────────────────────
// Recreates the compiled version's horizontal activity card grid.
// Always shows the top 4 activities with colored backgrounds and emojis.

function TodayGlance({ activities, blocks }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayBlocks = blocks.filter(b => {
    if (!b.startTime) return false;
    const start = new Date(b.startTime);
    const dateStr = start.toISOString().slice(0, 10);
    if (dateStr !== todayStr) return false;
    const end = b.endTime ? new Date(b.endTime) : new Date(now);
    return (end - start) > 0;
  });

  const activityMinutes = {};
  todayBlocks.forEach(b => {
    const end = b.endTime ? new Date(b.endTime) : new Date(now);
    const mins = Math.max(0, Math.round((end - new Date(b.startTime)) / 60000));
    activityMinutes[b.activityId] = (activityMinutes[b.activityId] || 0) + mins;
  });

  const totalMinutes = Object.values(activityMinutes).reduce((s, m) => s + m, 0);

  // Always show top 4 activities — sort by minutes desc, pad rest with 0
  const display = activities.slice(0, 4).map(a => ({
    ...a,
    minutes: activityMinutes[a.id] || 0
  }));

  if (display.length === 0) return null;

  const formatMins = (m) => {
    if (m === 0) return '0m';
    if (m < 60) return m + 'm';
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? h + 'h ' + rem + 'm' : h + 'h';
  };

  const colors = ['#FEF3C7', '#EDE9FE', '#FEE2E2', '#DCFCE7'];

  return jsxs('div', {
    className: 'mx-4 mt-3',
    children: [
      jsx('p', {
        className: 'text-[18px] font-black text-foreground mb-2.5',
        children: 'Today at a Glance'
      }),
      jsx('div', {
        className: 'grid gap-2',
        style: { gridTemplateColumns: 'repeat(' + display.length + ', 1fr)' },
        children: display.map((a, i) => {
          const pct = totalMinutes > 0 ? Math.round((a.minutes / totalMinutes) * 100) : 0;
          return jsxs('div', {
            className: 'rounded-xl p-3 flex flex-col items-center gap-1',
            style: { background: colors[i % colors.length] },
            children: [
              jsx('span', { className: 'text-xl', children: a.emoji || '\uD83C\uDFB3' }),
              jsx('span', { className: 'text-sm font-extrabold text-foreground', children: formatMins(a.minutes) }),
              jsx('span', {
                className: 'text-[9px] text-foreground/60 text-center w-full truncate',
                children: a.name
              }),
              jsx('div', {
                className: 'w-full h-[3px] rounded-full bg-black/10 overflow-hidden mt-0.5',
                children: jsx('div', {
                  className: 'h-full rounded-full',
                  style: { width: pct + '%', background: 'hsl(var(--primary))' }
                })
              })
            ]
          }, a.id);
        })
      })
    ]
  });
}

// ─── Eat the Frog (P8) ──────────────────────────────────────────────────────
// Replaces enhancements.js buildEatTheFrogCard().
// Shows top 3 starred tasks with inline editing, checkbox, and unstar.

const TASKS_KEY_RT = 'lt_tasks_v1';
const MAX_FROG_TASKS = 3;

function EatTheFrog() {
  const [tasks, setTasks] = useState(() => {
    try {
      const raw = localStorage.getItem(TASKS_KEY_RT);
      return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [, setTick] = useState(0);

  const saveTasks = (newTasks) => {
    localStorage.setItem(TASKS_KEY_RT, JSON.stringify(newTasks));
    setTasks(newTasks);
  };

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const starred = tasks.filter(t => t.starred && !t.completed);
  const slots = [];
  for (let i = 0; i < MAX_FROG_TASKS; i++) {
    slots.push(starred[i] || null);
  }

  const toggleComplete = (taskId) => {
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t);
    saveTasks(newTasks);
    setTick(n => n + 1);
  };

  const unstarTask = (taskId) => {
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, starred: false } : t);
    saveTasks(newTasks);
    setTick(n => n + 1);
  };

  const updateTitle = (taskId, title) => {
    if (!taskId) return; // empty slot
    const newTasks = tasks.map(t => t.id === taskId ? { ...t, title } : t);
    saveTasks(newTasks);
  };

  const createFromSlot = (title) => {
    if (!title.trim()) return;
    const newTask = {
      id: genId(),
      title: title.trim(),
      date: null,
      time: null,
      notes: '',
      completed: false,
      starred: true,
      createdAt: Date.now()
    };
    saveTasks([...tasks, newTask]);
    setTick(n => n + 1);
    return newTask.id;
  };

  return jsxs('div', {
    className: 'mx-4 mt-3 p-4 border border-border rounded-2xl bg-background',
    children: [
      jsx('p', { className: 'text-[15px] font-extrabold text-foreground flex items-center gap-1.5', children: ['\uD83D\uDC38 Eat the Frog'] }),
      jsx('p', { className: 'text-xs text-foreground/65 mt-0.5 mb-3', children: starred.length > 0 ? starred.length + ' most important task' + (starred.length !== 1 ? 's' : '') + ' today' : 'Add your most important tasks' }),
      slots.map((task, i) =>
        jsx(FrogSlot, {
          task,
          index: i,
          onToggle: toggleComplete,
          onUnstar: unstarTask,
          onUpdateTitle: updateTitle,
          onCreate: createFromSlot
        }, i)
      )
    ]
  });
}

function FrogSlot({ task, index, onToggle, onUnstar, onUpdateTitle, onCreate }) {
  const [localTitle, setLocalTitle] = useState(task ? task.title : '');
  const [slotTaskId, setSlotTaskId] = useState(task ? task.id : null);

  useEffect(() => {
    setLocalTitle(task ? task.title : '');
    setSlotTaskId(task ? task.id : null);
  }, [task?.id, task?.title]);

  const handleInput = (e) => {
    const val = e.target.value;
    setLocalTitle(val);
    if (slotTaskId) {
      onUpdateTitle(slotTaskId, val);
    } else if (val.trim()) {
      const newId = onCreate(val);
      if (newId) setSlotTaskId(newId);
    }
  };

  return jsxs('div', {
    className: 'flex items-center gap-2.5 py-2 border-t border-border first:border-t-0',
    children: [
      // Checkbox
      jsx('button', {
        type: 'button',
        onClick: () => slotTaskId && onToggle(slotTaskId),
        className: cn(
          'w-[22px] h-[22px] flex-shrink-0 rounded-full border-2 flex items-center justify-center text-xs text-white',
          task?.completed
            ? 'bg-green-500 border-green-500'
            : 'border-border bg-transparent',
          !slotTaskId && 'opacity-35 cursor-default'
        ),
        children: task?.completed ? '\u2713' : null
      }),
      // Title input
      jsx('input', {
        type: 'text',
        value: localTitle,
        onChange: handleInput,
        placeholder: 'Add an important task\u2026',
        className: cn(
          'flex-1 border border-border bg-secondary/30 text-sm text-foreground outline-none rounded-lg px-2.5 py-1.5 min-w-0',
          task?.completed && 'line-through opacity-50'
        )
      }),
      // Unstar
      jsx('button', {
        type: 'button',
        onClick: () => slotTaskId && onUnstar(slotTaskId),
        className: cn(
          'flex-shrink-0 p-1 text-[#f5a623]',
          !slotTaskId && 'invisible'
        ),
        children: jsx('svg', {
          width: 16, height: 16, viewBox: '0 0 24 24', fill: '#f5a623', stroke: '#f5a623', strokeWidth: 2,
          strokeLinecap: 'round', strokeLinejoin: 'round',
          children: jsx('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
        })
      })
    ]
  });
}

// ── Timer Screen (EXPORTED) ──────────────────────────────────────────
// Dashboard: Life Progress, Today at a Glance, Eat the Frog.
// Pure overview — no activity list, no timer controls.

export function TimerScreen({ profile }) {
  const { data: activities = [] } = useActivities();
  const { data: blocks = [] } = useBlocks();

  return jsxs('div', {
    'data-source-file': 'screens/Home.js',
    className: 'flex flex-col',
    children: [
      jsx(LifeProgressCard, { profile }),
      jsx(LTTimerPanel, { profile }),
      jsx(TodayGlance, { activities, blocks }),
      jsx(EatTheFrog, {})
    ]
  });
}

// ── Activity Screen (EXPORTED) ──────────────────────────────────────────
// Activity list + stats header + timer controls + all modals.
// Recreates the original compiled Activity tab UI in clean React.

function fmtMins(totalSec) {
  const m = Math.round(totalSec / 60);
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? h + 'h ' + rem + ' min' : h + 'h';
}

function calcFocusScore(statsActivities) {
  if (!statsActivities || statsActivities.length === 0) return 100;
  const penaltyNames = ['Time Waste', 'Social Media', 'Entertainment'];
  const boostNames = ['Work', 'Study', 'Exercise', 'Creative', 'Health'];
  let penaltyMin = 0, boostMin = 0;
  statsActivities.forEach(function (a) {
    const m = Math.round(a.totalSeconds / 60);
    const name = (a.activityName || '').toLowerCase();
    if (penaltyNames.some(p => name.includes(p.toLowerCase()))) penaltyMin += m;
    else if (boostNames.some(b => name.includes(b.toLowerCase()))) boostMin += m;
  });
  var score = 100 - penaltyMin + (boostMin * 0.25);
  return Math.min(100, Math.max(0, Math.round(score)));
}

function StatCard({ icon, iconBg, label, value, suffix }) {
  return jsxs('div', {
    className: 'rounded-2xl border border-black/[0.06] bg-card p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
    children: [
      jsx('div', {
        className: 'inline-flex items-center justify-center w-[30px] h-[30px] rounded-full text-sm mb-2',
        style: { background: iconBg },
        children: icon
      }),
      jsx('p', { className: 'text-xs text-muted-foreground mb-0.5', children: label }),
      jsxs('p', { className: 'text-xl font-extrabold text-foreground m-0', children: [
        value,
        suffix && jsx('span', { className: 'text-xs font-semibold text-muted-foreground ml-0.5', children: suffix })
      ] })
    ]
  });
}

export function ActivityScreen({ profile }) {
  const queryClient = useQueryClient();
  const { data: activities = [] } = useActivities();
  const { data: blocks = [] } = useBlocks();
  const { data: todayStats } = useTodayStats();
  const runningBlock = blocks.find(b => !b.endTime);

  const createBlock = useCreateBlock();
  const updateBlock = useUpdateBlock();

  const [selectedActivity, setSelectedActivity] = useState(null);
  const [activeBlockInfo, setActiveBlockInfo] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [logBlockActivity, setLogBlockActivity] = useState(null);

  const todayEntries = todayStats?.activities || [];
  const totalMinutesTracked = Math.round((todayStats?.totalSeconds || 0) / 60);

  let valueEarned = 0;
  try {
    const tv = JSON.parse(localStorage.getItem('lt_time_value_v1') || 'null');
    if (tv && tv.perMinute) valueEarned = tv.perMinute * totalMinutesTracked;
  } catch { /* ignore */ }

  const focusScore = calcFocusScore(todayEntries);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  const handleActivityTap = (activity) => {
    if (runningBlock?.activityId === activity.id) {
      setActiveBlockInfo({ block: runningBlock, activity });
    } else {
      setSelectedActivity(activity);
    }
  };

  const startTimer = (activity) => {
    const doCreate = () => {
      createBlock.mutate({
        data: { activityId: activity.id, startTime: new Date().toISOString() }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: blocksKey() });
          queryClient.invalidateQueries({ queryKey: todayStatsKey() });
        }
      });
    };
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

  const stopTimer = () => {
    if (!activeBlockInfo) return;
    updateBlock.mutate({
      id: activeBlockInfo.block.id,
      data: { endTime: new Date().toISOString() }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: blocksKey() });
        queryClient.invalidateQueries({ queryKey: todayStatsKey() });
        setActiveBlockInfo(null);
      }
    });
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: blocksKey() });
    queryClient.invalidateQueries({ queryKey: todayStatsKey() });
  };

  return jsxs('div', {
    'data-source-file': 'screens/Home.js',
    className: 'flex flex-col',
    children: [
      // Title header
      jsxs('div', {
        className: 'flex items-baseline justify-between gap-2.5 px-4 pt-4 pb-1 flex-wrap',
        children: [
          jsx('h1', { className: 'text-[26px] font-black text-foreground m-0', children: "Activity's" }),
          jsx('span', { className: 'text-xs font-semibold text-muted-foreground whitespace-nowrap', children: dateLabel })
        ]
      }),

      // 2x2 stats grid
      jsxs('div', {
        className: 'grid grid-cols-2 gap-2.5 px-4 pt-3 pb-1',
        children: [
          jsx(StatCard, { icon: '\u23F1', iconBg: '#DCFCE7', label: 'Time Tracked', value: fmtMins(totalMinutesTracked * 60) }),
          jsx(StatCard, { icon: '\uD83D\uDCB0', iconBg: '#FEF3C7', label: 'Value Earned', value: valueEarned > 0 ? 'Rs.' + valueEarned.toFixed(2) : '--', suffix: valueEarned > 0 ? undefined : '' }),
          jsx(StatCard, { icon: '\uD83C\uDFAF', iconBg: '#FEE2E2', label: 'Focus Score', value: focusScore, suffix: '/100' }),
          jsx(StatCard, { icon: '\uD83D\uDD25', iconBg: '#EDE9FE', label: 'Activities', value: activities.length })
        ]
      }),

      // Section label
      jsxs('div', {
        className: 'px-4 pt-3.5 pb-2',
        children: [
          jsx('p', { className: 'text-base font-extrabold text-foreground m-0', children: 'Your Activities' }),
          jsx('p', { className: 'text-[11px] font-semibold text-muted-foreground mt-[-4px] mb-0', children: "Default activities don't count toward achievements" })
        ]
      }),

      // Activity list
      jsxs('div', {
        className: 'flex flex-col divide-y divide-border',
        children: [
          activities.length === 0 && jsxs('div', {
            className: 'flex flex-col items-center justify-center py-20 px-8 text-center bg-background',
            children: [
              jsx(rh, { className: 'w-8 h-8 text-muted-foreground mb-4 opacity-30' }),
              jsx('p', { className: 'text-muted-foreground font-medium', children: 'No activities yet.' }),
              jsx('p', { className: 'text-sm text-muted-foreground mt-1', children: 'Add one below to start tracking.' })
            ]
          }),
          activities.map(activity =>
            jsx(ActivityCard, {
              activity,
              isActive: runningBlock?.activityId === activity.id,
              activeBlock: runningBlock?.activityId === activity.id ? runningBlock : null,
              onTap: () => handleActivityTap(activity)
            }, activity.id)
          )
        ]
      }),
      jsx(AddActivityBar, {}),

      selectedActivity && jsxs(BottomSheet, {
        onDismiss: () => setSelectedActivity(null),
        children: [
          jsx(ModalHeader, { activity: selectedActivity, subtitle: 'How do you want to track this?' }),
          jsx(ModalOption, {
            icon: jsx(Ty, { className: 'w-5 h-5' }),
            label: 'Start timer now',
            description: 'Live timer from right now',
            onClick: () => startTimer(selectedActivity)
          }),
          jsx(ModalOption, {
            icon: jsx(Jb, { className: 'w-5 h-5' }),
            label: 'Log a time block',
            description: 'Set a start and end time manually',
            onClick: () => { setLogBlockActivity(selectedActivity); setSelectedActivity(null); }
          })
        ]
      }),

      activeBlockInfo && jsxs(BottomSheet, {
        onDismiss: () => setActiveBlockInfo(null),
        children: [
          jsx(ModalHeader, { activity: activeBlockInfo.activity, subtitle: 'Timer is running' }),
          jsx(ModalOption, {
            icon: jsx(rh, { className: 'w-5 h-5 text-destructive' }),
            label: 'Stop timer',
            labelClass: 'text-destructive',
            description: 'Started at ' + formatTime(activeBlockInfo.block.startTime),
            onClick: stopTimer
          }),
          jsx(ModalOption, {
            icon: jsx(tk, { className: 'w-5 h-5' }),
            label: 'Edit time',
            description: 'Adjust start or end time',
            onClick: () => { setEditingBlock(activeBlockInfo); setActiveBlockInfo(null); }
          })
        ]
      }),

      logBlockActivity && jsx(LogTimeBlockModal, {
        activity: logBlockActivity,
        onClose: () => setLogBlockActivity(null),
        onSave: (startTime, endTime) => {
          const doCreate = () => {
            createBlock.mutate({
              data: { activityId: logBlockActivity.id, startTime, endTime }
            }, {
              onSuccess: () => { refreshAll(); setLogBlockActivity(null); }
            });
          };
          if (runningBlock) {
            updateBlock.mutate({ id: runningBlock.id, data: { endTime: new Date().toISOString() } }, { onSuccess: doCreate });
          } else {
            doCreate();
          }
        }
      }),

      editingBlock && jsx(EditTimeBlockModal, {
        block: editingBlock.block,
        activity: editingBlock.activity,
        onClose: () => setEditingBlock(null),
        onSave: (startTime, endTime) => {
          updateBlock.mutate({
            id: editingBlock.block.id,
            data: { startTime, endTime: endTime || undefined }
          }, {
            onSuccess: () => { refreshAll(); setEditingBlock(null); }
          });
        }
      })
    ]
  });
}
