// React & JSX
import { useState, useEffect, useRef, useMemo, useCallback, Fragment } from 'react';
import { jsx, jsxs } from 'react/jsx-runtime';

// App logic
import { getStore, setStore, nextId, enrichBlocksForRange } from '../lib/storage.js';
import { calcRemainingTime, calcPercentLived, msToBreakdown } from '../lib/lifeCalc.js';
import { getDistinctColor } from '../lib/constants.js';
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
import { isPro } from '../lib/settings.js';

// Icons
import { Timer as Ty, CalendarClock as Jb, Clock as Zb, Play as nk, Trash2 as lk, Square as rh, Plus as rk, Pencil as tk, IndianRupee as Ri, ChartColumn as Cc } from 'lucide-react';

const FREE_ACTIVITY_LIMIT = 5;
const FREE_TRIM_DAYS = 3;

// ─── LT Timer Panel ─────────────────────────────────────────────────────────
// Collapsible panel containing the retirement countdown timer.
// Toggles open/closed with a full-width button.

function LTTimerPanel({ profile }) {
  return jsx(RetirementCountdown, { profile });
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
  const deathDate = new Date(profile.dob);
  deathDate.setFullYear(deathDate.getFullYear() + (profile.lifespanYears || 80));
  const retirementDateStr = deathDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return jsxs('div', {
    'data-lt-enhancement': 'retirement',
    className: 'bg-primary text-white px-5 pt-6 pb-5 rounded-2xl mx-4',
    children: [
      // Title row with plan badge
      jsxs('div', {
        className: 'flex items-center gap-2 mb-4 min-w-0',
        children: [
          jsxs('p', {
            className: 'text-[12px] font-bold text-white m-0 uppercase tracking-wide leading-tight truncate',
            children: [profile.name, "'s Remaining Retirement Time"]
          }),
          jsxs('span', {
            className: 'shrink-0 flex items-center gap-1 bg-[#FDE68A]/15 text-[#FDE68A] text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
            children: ['\u2605 ', planLabel]
          })
        ]
      }),
      // Retirement date
      retirementDateStr && jsxs('p', {
        className: 'text-[12px] font-semibold text-white/60 mb-5 flex items-center gap-1.5',
        children: ['\uD83C\uDFAF Retirement date: ', jsx('span', { className: 'text-[#FDE68A]', children: retirementDateStr })]
      }),
      // 5-column grid: years, days, hours, min, sec
      jsxs('div', {
        className: 'grid grid-cols-5 gap-3 mb-5',
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
        className: 'h-1.5 w-full bg-white/10 overflow-hidden mb-2',
        children: jsx('div', {
          className: 'h-full bg-accent',
          style: { width: `${percentLived}%` }
        })
      }),
      // Footer: percent lived + minutes left
      jsxs('div', {
        className: 'flex justify-between text-[12px] text-white/40 font-medium',
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
    className: 'flex flex-col items-center bg-white/10 border border-white/20 rounded-xl py-3 px-2 gap-1',
    children: [
      jsx('span', {
        className: cn(
          'font-black tabular-nums leading-none',
          accent ? 'text-accent text-[26px]' : 'text-white text-[26px]'
        ),
        children: String(value).padStart(2, '0')
      }),
      jsx('span', {
        className: 'text-[10px] font-extrabold tracking-widest text-white/50 uppercase',
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
        className: cn(
          'group relative overflow-hidden flex items-center w-full cursor-pointer select-none rounded-2xl bg-white border transition-all',
          isActive
            ? 'border-accent/60 shadow-[0_12px_30px_rgba(0,194,168,0.18)]'
            : 'border-black/[.06] shadow-[0_6px_20px_rgba(15,23,42,0.05)] hover:shadow-[0_10px_26px_rgba(15,23,42,0.09)]'
        ),
        children: [
          // Activity color rail
          jsx('span', {
            'aria-hidden': true,
            className: 'absolute left-0 top-0 bottom-0 w-[5px]',
            style: { background: activity.color || '#00C2A8' }
          }),
          // Left: emoji tile + name/status + actions
          jsxs('div', {
            className: 'flex items-center flex-1 min-w-0 gap-3 pl-4 pr-2.5 py-2.5',
            children: [
              // Tinted emoji tile (or colored dot fallback)
              activity.emoji
                ? jsx('span', {
                    className: 'w-11 h-11 rounded-2xl flex items-center justify-center text-[20px] shrink-0',
                    style: {
                      background: (activity.color || '#00C2A8') + '22',
                      fontFamily: "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"
                    },
                    children: activity.emoji
                  })
                : jsx('span', {
                    className: 'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
                    style: { background: (activity.color || '#00C2A8') + '1A' },
                    children: jsx('span', {
                      className: cn('w-3 h-3 rounded-full', isActive && 'animate-pulse'),
                      style: { backgroundColor: activity.color }
                    })
                  }),
              // Name + status line
              jsxs('div', {
                className: 'flex-1 min-w-0',
                children: [
                  jsx('p', {
                    className: 'text-[15px] font-bold text-foreground m-0 truncate leading-tight',
                    children: activity.name
                  }),
                  jsx('p', {
                    className: cn('text-[11px] font-semibold mt-1 mb-0 truncate', isActive ? 'text-accent tabular-nums' : 'text-foreground/40'),
                    children: isActive ? `${formatElapsed(elapsedSeconds)} tracking` : 'Tap to start'
                  })
                ]
              }),
              // Right: edit + delete + run button
              jsxs('div', {
                className: 'flex items-center gap-1.5 shrink-0',
                children: [
                  jsx('button', {
                    onClick: openEdit,
                    title: 'Edit',
                    'data-lt-edit-replaced': '1',
                    className: 'w-8 h-8 flex items-center justify-center rounded-full text-foreground/35 hover:text-foreground hover:bg-foreground/5 transition-colors',
                    children: jsx(tk, { className: 'w-4 h-4' })
                  }),
                  jsx('button', {
                    onClick: handleDelete,
                    title: 'Remove',
                    className: 'w-8 h-8 flex items-center justify-center rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors',
                    children: jsx(lk, { className: 'w-4 h-4' })
                  }),
                  jsx('span', {
                    className: cn(
                      'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                      isActive ? 'text-white shadow-[0_6px_16px_rgba(0,0,0,0.18)]' : 'bg-black text-white group-hover:bg-black/85 group-hover:scale-105'
                    ),
                    style: isActive ? { backgroundColor: activity.color } : {},
                    children: isActive
                      ? jsx(Zb, { className: 'w-4 h-4' })
                      : jsx(nk, { className: 'w-4 h-4 ml-0.5' })
                  })
                ]
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
                  className: 'flex-1 py-4 text-red-500 font-bold hover:bg-red-50 text-sm',
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
        className: 'absolute inset-0 bg-black/55 backdrop-blur-[2px]'
      }),
      // Panel
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white rounded-t-[28px] shadow-[0_-24px_64px_rgba(15,23,42,0.28)] flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Drag handle — tap = back (dismisses the sheet, like a back button)
          jsx('button', {
            type: 'button',
            onClick: onDismiss,
            'aria-label': 'Back',
            className: 'flex justify-center items-center w-full pt-2.5 pb-1 shrink-0 cursor-pointer bg-transparent border-0 rounded-t-[28px] hover:bg-foreground/[.04] active:bg-foreground/[.08] transition-colors',
            children: jsx('span', { className: 'w-10 h-1.5 rounded-full bg-foreground/15' })
          }),
          jsx('div', {
            className: 'overflow-y-auto flex-1',
            children: children
          }),
          // Bottom spacer for safe area
          jsx('div', {
            className: 'h-16 bg-white shrink-0'
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
    className: 'px-5 pt-3 pb-4 flex items-center gap-3.5 border-b border-black/[.07]',
    children: [
      // Tinted emoji tile (or color tile fallback)
      activity.emoji
        ? jsx('span', {
            className: 'w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] shrink-0',
            style: {
              background: (activity.color || '#00C2A8') + '22',
              fontFamily: "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"
            },
            children: activity.emoji
          })
        : jsx('span', {
            className: 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
            style: { background: (activity.color || '#00C2A8') + '1A' },
            children: jsx('span', {
              className: 'w-3.5 h-3.5 rounded-full',
              style: { backgroundColor: activity.color }
            })
          }),
      // Name + subtitle
      jsxs('div', {
        className: 'min-w-0',
        children: [
          jsx('p', {
            className: 'font-bold text-foreground leading-tight text-[17px] font-black truncate m-0',
            children: activity.name
          }),
          jsx('p', {
            className: 'text-[13px] text-muted-foreground mt-1 mb-0 font-medium',
            children: subtitle
          })
        ]
      })
    ]
  });
}

// ─── Modal Option (Js) ──────────────────────────────────────────────────────
// Clickable option row for modals (icon + label + description + chevron).

function ModalOption({ icon, label, description, onClick, labelClass = '', primary = false }) {
  return jsxs('button', {
    onClick,
    className: cn(
      'flex items-center gap-3.5 px-4 py-3.5 mb-3 mx-4 w-[calc(100%-2rem)] rounded-2xl border text-left transition-all active:scale-[0.985]',
      'bg-black border-black text-white shadow-[0_14px_30px_rgba(0,0,0,0.30)] hover:bg-black/90'
    ),
    children: [
      jsx('div', {
        className: 'shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-white/15 text-white',
        children: icon
      }),
      jsxs('div', {
        className: 'flex-1 min-w-0',
        children: [
          jsx('p', {
            className: cn('font-bold text-[15px]', labelClass || 'text-white'),
            children: label
          }),
          jsx('p', {
            className: 'text-xs mt-1 font-medium text-white/60',
            children: description
          })
        ]
      }),
      jsx('svg', {
        className: 'w-4 h-4 shrink-0 text-white/50',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.5,
        children: jsx('path', { d: 'M9 6l6 6-6 6', strokeLinecap: 'round', strokeLinejoin: 'round' })
      })
    ]
  });
}

// ─── Time Picker (mh) ──────────────────────────────────────────────────────
// Classic analog clock face — tap the dial to set the hour (then the
// minute), switch mode via the digital readout, pick AM/PM, confirm.

function clockFaceSvgIcon() {
  return jsx('svg', {
    width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
    children: jsxs('g', { children: [
      jsx('circle', { cx: 12, cy: 12, r: 9 }),
      jsx('path', { d: 'M12 7.5V12l3 2' })
    ] })
  });
}

function TimePicker({ label, value, onChange, labelClass }) {
  const [open, setOpen] = useState(false);
  const time = value ?? { h: 12, m: 0, ampm: 'AM' };
  /* 12-hour dial: a stored h of 0 (legacy init) means 12 — never render or
     keep "00", which leaves no number selected on the dial. */
  const dispH = ((Number(time.h) % 12) || 12);
  const display = `${String(dispH).padStart(2, '0')}:${String(Number(time.m) || 0).padStart(2, '0')} ${time.ampm === 'PM' ? 'PM' : 'AM'}`;

  return jsxs('div', {
    className: 'flex-1',
    children: [
      jsx('label', {
        className: 'block text-[10px] font-black uppercase tracking-[0.14em] mb-2 ' + (labelClass || 'text-foreground/45'),
        children: label
      }),
      jsxs('button', {
        type: 'button',
        onClick: () => setOpen(true),
        className: 'w-full flex items-center justify-center gap-2.5 border border-black/[.08] bg-white text-foreground font-bold text-lg px-2 py-3 rounded-xl outline-none focus:border-black/40 cursor-pointer transition-colors active:bg-black/[.04]',
        children: [
          clockFaceSvgIcon(),
          jsx('span', { children: display })
        ]
      }),
      open && jsx(ClockFace, {
        initial: value,
        onCancel: () => setOpen(false),
        onConfirm: (v) => { onChange(v); setOpen(false); }
      })
    ]
  });
}

function ClockFace({ initial, onCancel, onConfirm }) {
  const base = initial ?? { h: 12, m: 0, ampm: 'AM' };
  /* Normalize into 1..12: a stored h of 0 used to open the dial with NO
     number circled (the hand just sat on top of 12). */
  const [h, setH] = useState(((Number(base.h) % 12) || 12));
  const [m, setM] = useState(Number(base.m) || 0);
  const [ampm, setAmpm] = useState(base.ampm === 'PM' ? 'PM' : 'AM');
  const [mode, setMode] = useState('h');
  const modeRef = useRef(null);
  modeRef.current = mode;

  const pickFromDial = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    if (Math.sqrt(x * x + y * y) < 24) return false; // ignore dead center
    let ang = Math.atan2(x, -y) * 180 / Math.PI;
    if (ang < 0) ang += 360;
    if (mode === 'h') {
      let hh = Math.round(ang / 30) % 12;
      setH(hh === 0 ? 12 : hh);
    } else {
      setM(Math.round(ang / 6) % 60);
    }
    return true;
  };

  // Press-and-drag: picking starts immediately on pointerdown and keeps
  // tracking while held (pointer captured to the dial so re-renders don't
  // interrupt it); hour→minute hand-off happens on release.
  const dialDrag = useRef(null);
  const onDialDown = (e) => {
    if (dialDrag.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
    dialDrag.current = { picked: pickFromDial(e) };
  };
  const onDialMove = (e) => {
    if (!dialDrag.current) return;
    if (pickFromDial(e)) dialDrag.current.picked = true;
  };
  const onDialUp = () => {
    if (!dialDrag.current) return;
    const picked = dialDrag.current.picked;
    dialDrag.current = null;
    if (picked && modeRef.current === 'h') setMode('m');
  };

  const handAng = mode === 'h' ? ((h % 12) * 30) : (m * 6);
  const nums = [];
  for (let i = 0; i < 12; i++) {
    const val = mode === 'h' ? (i === 0 ? 12 : i) : (i * 5);
    const angDeg = mode === 'h' ? (val * 30) : (val * 6);
    const a = angDeg * Math.PI / 180;
    const rx = 50 + 38.5 * Math.sin(a);
    const ry = 50 - 38.5 * Math.cos(a);
    const sel = mode === 'h' ? (val === h) : (val === m);
    nums.push(
      jsx('span', {
        key: val,
        className: 'absolute w-8 h-8 -ml-4 -mt-4 rounded-full flex items-center justify-center text-[13.5px] font-bold pointer-events-none select-none ' +
          (sel ? 'bg-black text-white shadow-[0_4px_10px_rgba(0,0,0,.25)]' : 'text-foreground/75'),
        style: { left: rx + '%', top: ry + '%' },
        children: String(val).padStart(2, '0')
      }, val)
    );
  }

  return jsxs('div', {
    className: 'fixed inset-0 z-[80] flex justify-center overflow-y-auto bg-black/55 backdrop-blur-[2px] p-5',
    onClick: onCancel,
    children: [
      jsxs('div', {
        className: 'w-full max-w-[330px] my-auto bg-white rounded-3xl p-5 shadow-[0_24px_60px_rgba(0,0,0,.35)]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Digital readout — big circle on the active segment; tap to switch dial mode
          jsxs('div', {
            className: 'flex items-center justify-center gap-1 mb-4',
            children: [
              jsx('button', {
                type: 'button',
                onClick: () => setMode('h'),
                className: 'w-[56px] h-[56px] rounded-full flex items-center justify-center text-[29px] font-black leading-none transition-colors ' +
                  (mode === 'h' ? 'bg-black text-white shadow-[0_6px_16px_rgba(0,0,0,.3)]' : 'text-foreground/40'),
                children: String(h).padStart(2, '0')
              }),
              jsx('span', { className: 'text-[30px] font-black text-foreground/60 leading-none', children: ':' }),
              jsx('button', {
                type: 'button',
                onClick: () => setMode('m'),
                className: 'w-[56px] h-[56px] rounded-full flex items-center justify-center text-[29px] font-black leading-none transition-colors ' +
                  (mode === 'm' ? 'bg-black text-white shadow-[0_6px_16px_rgba(0,0,0,.3)]' : 'text-foreground/40'),
                children: String(m).padStart(2, '0')
              }),
              jsx('span', { className: 'text-[14px] font-black text-foreground/45 ml-1.5 self-start mt-3.5', children: ampm })
            ]
          }),
          // Clock dial — press and hold to pick, drag around to sweep, release to continue
          jsxs('div', {
            className: 'relative w-[240px] h-[240px] rounded-full border border-black/10 bg-[#Fdfbf7] mx-auto cursor-pointer select-none touch-none',
            onPointerDown: onDialDown,
            onPointerMove: onDialMove,
            onPointerUp: onDialUp,
            onPointerCancel: onDialUp,
            children: [
              jsx('div', {
                className: 'absolute left-1/2 top-1/2 w-[3px] -ml-[1.5px] bg-black/80 rounded-full pointer-events-none',
                style: { height: '37%', transformOrigin: '50% 0%', transform: 'rotate(' + (handAng + 180) + 'deg)' },
                children: jsx('div', {
                  className: 'absolute left-1/2 -ml-2 -bottom-[7px] w-4 h-4 rounded-full bg-black'
                })
              }),
              jsx('div', { className: 'absolute left-1/2 top-1/2 w-2.5 h-2.5 -ml-[5px] -mt-[5px] rounded-full bg-black pointer-events-none' }),
              nums
            ]
          }),
          // AM / PM
          jsxs('div', {
            className: 'flex justify-center gap-2 mt-4',
            children: ['AM', 'PM'].map((p) =>
              jsx('button', {
                type: 'button',
                onClick: () => setAmpm(p),
                className: 'px-6 py-2 rounded-full text-[13px] font-black border transition-colors ' +
                  (ampm === p ? 'bg-black text-white border-black' : 'bg-white text-foreground/50 border-black/10'),
                children: p
              }, p)
            )
          }),
          // Cancel / OK — Cancel pinned left, OK pinned right
          jsxs('div', {
            className: 'flex justify-between gap-4 mt-4',
            children: [
              jsx('button', {
                type: 'button',
                onClick: onCancel,
                className: 'py-2.5 px-5 text-[13.5px] font-black text-red-500 bg-white border border-red-200 hover:bg-red-50 rounded-full cursor-pointer transition-colors',
                children: 'Cancel'
              }),
              jsx('button', {
                type: 'button',
                onClick: () => onConfirm({ h, m, ampm }),
                className: 'py-2.5 px-5 text-[13.5px] font-black text-white bg-black hover:bg-black/85 rounded-full cursor-pointer transition-colors',
                children: 'OK'
              })
            ]
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
  // Clean defaults: start and end both 00:00 — nothing pre-filled.
  const [fromTime, setFromTime] = useState({ h: 12, m: 0, ampm: 'AM' });
  const [toTime, setToTime] = useState({ h: 12, m: 0, ampm: 'AM' });

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

  // Duration; if To is strictly before From on the same day, treat as
  // overnight (+24h) so blocks like 9:47 AM → 12:00 AM work. Equal times
  // mean no duration at all: the pill stays hidden and Log block is locked.
  let durationMinutes = null;
  let endTimestamp = toTimestamp;
  let wrapsNextDay = false;
  if (fromTimestamp && toTimestamp) {
    const fromMs = new Date(fromTimestamp).getTime();
    let endMs = new Date(toTimestamp).getTime();
    if (endMs < fromMs) {
      endMs += 24 * 60 * 60 * 1000;
      wrapsNextDay = true;
      endTimestamp = new Date(endMs).toISOString();
    }
    durationMinutes = Math.round((endMs - fromMs) / 60000);
  }

  const isValid = durationMinutes !== null && durationMinutes > 0;
  const spansDays = fromDate !== toDate || wrapsNextDay;

  const dateInputClass = 'border border-black/[.08] bg-white text-foreground font-semibold text-sm px-3.5 py-3 rounded-xl outline-none focus:border-black/40 w-full';

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
      jsx('div', { className: 'absolute inset-0 bg-black/55 backdrop-blur-[2px]' }),
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white rounded-t-[28px] shadow-[0_-24px_64px_rgba(15,23,42,0.28)] flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Drag handle — tap = back (dismisses the sheet, like a back button)
          jsx('button', {
            type: 'button',
            onClick: onClose,
            'aria-label': 'Back',
            className: 'flex justify-center items-center w-full pt-2.5 pb-1 shrink-0 cursor-pointer bg-transparent border-0 rounded-t-[28px] hover:bg-foreground/[.04] active:bg-foreground/[.08] transition-colors',
            children: jsx('span', { className: 'w-10 h-1.5 rounded-full bg-foreground/15' })
          }),
          // Header
          jsxs('div', {
            className: 'px-5 pt-2 pb-4 flex items-center justify-between shrink-0',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-3.5',
                children: [
                  activity.emoji
                    ? jsx('span', {
                        className: 'w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] shrink-0',
                        style: {
                          background: (activity.color || '#00C2A8') + '22',
                          fontFamily: "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"
                        },
                        children: activity.emoji
                      })
                    : jsx('span', {
                        className: 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                        style: { background: (activity.color || '#00C2A8') + '1A' },
                        children: jsx('span', {
                          className: 'w-3.5 h-3.5 rounded-full',
                          style: { backgroundColor: activity.color }
                        })
                      }),
                  jsxs('div', {
                    className: 'min-w-0',
                    children: [
                      jsx('p', {
                        className: 'font-bold text-foreground leading-tight text-[17px] font-black truncate m-0',
                        children: activity.name
                      }),
                      jsx('p', {
                        className: 'text-[13px] text-muted-foreground mt-1 mb-0 font-medium',
                        children: 'Log a time block'
                      })
                    ]
                  })
                ]
              }),
              jsx('button', {
                onClick: onClose,
                className: 'w-9 h-9 flex items-center justify-center rounded-full bg-black/[.05] text-foreground/50 hover:text-foreground hover:bg-black/10 transition-colors shrink-0',
                children: jsx('svg', {
                  className: 'w-4 h-4',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2.5,
                  children: jsx('path', { d: 'M6 6l12 12M18 6L6 18', strokeLinecap: 'round' })
                })
              })
            ]
          }),
          // Form content
          jsxs('div', {
            className: 'overflow-y-auto flex-1 px-5 pb-5 flex flex-col gap-3',
            children: [
              // From date
              jsxs('div', {
                className: 'rounded-2xl border border-black/[.08] bg-black/[.03] p-3.5',
                children: [
                  jsx('label', {
                    className: 'block text-[10px] font-black text-foreground/45 uppercase tracking-[.14em] mb-2',
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
              jsxs('div', {
                className: 'rounded-2xl border border-black/[.08] bg-black/[.03] p-3.5',
                children: [
                  jsx(TimePicker, {
                    label: 'From',
                    value: fromTime,
                    onChange: setFromTime
                  })
                ]
              }),
              // Divider
              jsxs('div', {
                className: 'flex items-center gap-3 py-0.5',
                children: [
                  jsx('div', { className: 'flex-1 h-px bg-black/10' }),
                  jsx('span', {
                    className: 'text-foreground/35 text-[11px] font-black uppercase tracking-[0.18em]',
                    children: 'to'
                  }),
                  jsx('div', { className: 'flex-1 h-px bg-black/10' })
                ]
              }),
              // To date with "Ends next day" badge — same neutral tint as the rest
              jsxs('div', {
                className: 'rounded-2xl border border-black/[.08] bg-black/[.03] p-3.5',
                children: [
                  jsxs('label', {
                    className: 'flex items-center justify-between text-[10px] font-black text-foreground/45 uppercase tracking-[.14em] mb-2',
                    children: [
                      jsx('span', { children: 'End date' }),
                      spansDays && jsx('span', {
                        className: 'text-foreground/70 normal-case font-black tracking-normal',
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
              jsxs('div', {
                className: 'rounded-2xl border border-black/[.08] bg-black/[.03] p-3.5',
                children: [
                  jsx(TimePicker, {
                    label: 'To',
                    value: toTime,
                    onChange: setToTime
                  })
                ]
              })
            ]
          }),
          // Sticky footer: duration + actions (compact so it never crowds the form)
          jsxs('div', {
            className: 'shrink-0 bg-white border-t border-black/[.07] pb-[env(safe-area-inset-bottom)] rounded-b-[28px]',
            children: [
              // Duration preview
              durationMinutes !== null && durationMinutes > 0 && jsx('div', {
                className: 'px-5 pt-3 pb-1 text-center',
                children: jsx('p', {
                  className: 'inline-block text-sm font-black text-white bg-black rounded-full px-4 py-1.5',
                  children: durationMinutes >= 60
                    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                    : `${durationMinutes}m`
                })
              }),
              // Cancel / Log block buttons
              jsxs('div', {
                  className: 'flex gap-2.5 px-4 py-3.5',
                  children: [
                    jsx('button', {
                      onClick: onClose,
                      className: 'flex-1 py-3.5 text-red-500 font-black bg-white border border-red-200 hover:bg-red-50 rounded-xl text-sm transition-colors',
                      children: 'Cancel'
                    }),
                  jsx('button', {
                    onClick: (e) => {
                      e.stopPropagation();
                      e.nativeEvent.stopImmediatePropagation();
                      e.nativeEvent.stopPropagation();
                      if (isValid && fromTimestamp && endTimestamp) {
                        onSave(fromTimestamp, endTimestamp);
                      }
                    },
                    disabled: !isValid,
                    className: 'flex-1 py-3.5 text-white font-black bg-black hover:bg-black/85 rounded-xl text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors',
                    children: 'Log block'
                  })
                ]
              })
            ]
          })
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
      jsx('div', { className: 'absolute inset-0 bg-black/55 backdrop-blur-[2px]' }),
      jsxs('div', {
        className: 'relative w-full max-w-[430px] mx-auto bg-white rounded-t-[28px] shadow-[0_-24px_64px_rgba(15,23,42,0.28)] flex flex-col max-h-[85dvh]',
        onClick: (e) => e.stopPropagation(),
        children: [
          // Drag handle — tap = back (dismisses the sheet, like a back button)
          jsx('button', {
            type: 'button',
            onClick: onClose,
            'aria-label': 'Back',
            className: 'flex justify-center items-center w-full pt-2.5 pb-1 shrink-0 cursor-pointer bg-transparent border-0 rounded-t-[28px] hover:bg-foreground/[.04] active:bg-foreground/[.08] transition-colors',
            children: jsx('span', { className: 'w-10 h-1.5 rounded-full bg-foreground/15' })
          }),
          // Header
          jsxs('div', {
            className: 'px-5 pt-2 pb-4 flex items-center justify-between shrink-0',
            children: [
              jsxs('div', {
                className: 'flex items-center gap-3.5',
                children: [
                  activity.emoji
                    ? jsx('span', {
                        className: 'w-12 h-12 rounded-2xl flex items-center justify-center text-[22px] shrink-0',
                        style: {
                          background: (activity.color || '#00C2A8') + '22',
                          fontFamily: "'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif"
                        },
                        children: activity.emoji
                      })
                    : jsx('span', {
                        className: 'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                        style: { background: (activity.color || '#00C2A8') + '1A' },
                        children: jsx('span', {
                          className: 'w-3.5 h-3.5 rounded-full',
                          style: { backgroundColor: activity.color }
                        })
                      }),
                  jsxs('div', {
                    className: 'min-w-0',
                    children: [
                      jsx('p', {
                        className: 'font-bold text-foreground leading-tight text-[17px] font-black truncate m-0',
                        children: 'Edit time block'
                      }),
                      jsx('p', {
                        className: 'text-[13px] text-muted-foreground mt-1 mb-0 font-medium',
                        children: activity.name
                      })
                    ]
                  })
                ]
              }),
              jsx('button', {
                onClick: onClose,
                className: 'w-9 h-9 flex items-center justify-center rounded-full bg-black/[.05] text-foreground/50 hover:text-foreground hover:bg-black/10 transition-colors shrink-0',
                children: jsx('svg', {
                  className: 'w-4 h-4',
                  viewBox: '0 0 24 24',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 2.5,
                  children: jsx('path', { d: 'M6 6l12 12M18 6L6 18', strokeLinecap: 'round' })
                })
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
                    className: 'block text-[10px] font-black text-foreground/45 uppercase tracking-[0.14em] mb-2',
                    children: 'Start time'
                  }),
                  jsx('input', {
                    type: 'datetime-local',
                    value: startValue,
                    onChange: (e) => setStartValue(e.target.value),
                    className: 'w-full border border-black/[.08] bg-black/[.035] px-3.5 py-3 rounded-xl text-sm font-semibold outline-none focus:border-black/40 text-foreground'
                  })
                ]
              }),
              // "Keep timer running" checkbox
              jsxs('label', {
                className: 'flex items-center gap-3 cursor-pointer select-none rounded-xl border border-black/[.07] bg-[#Fdfbf7] px-3.5 py-3',
                children: [
                  jsx('input', {
                    type: 'checkbox',
                    checked: keepRunning,
                    onChange: (e) => setKeepRunning(e.target.checked),
                    className: 'w-4 h-4 accent-black'
                  }),
                  jsx('span', {
                    className: 'text-sm font-bold text-foreground',
                    children: 'Keep timer running'
                  })
                ]
              }),
              // End time input (hidden when keepRunning is true)
              !keepRunning && jsxs('div', {
                children: [
                  jsx('label', {
                    className: 'block text-[10px] font-black text-foreground/45 uppercase tracking-[0.14em] mb-2',
                    children: 'End time'
                  }),
                  jsx('input', {
                    type: 'datetime-local',
                    value: endValue,
                    onChange: (e) => setEndValue(e.target.value),
                    className: 'w-full border border-black/[.08] bg-black/[.035] px-3.5 py-3 rounded-xl text-sm font-semibold outline-none focus:border-black/40 text-foreground'
                  })
                ]
              })
            ]
          }),
          // Cancel / Save buttons
          jsxs('div', {
            className: 'flex gap-2.5 px-4 py-3.5 border-t border-black/[.07] shrink-0 rounded-b-[28px]',
            children: [
              jsx('button', {
                onClick: onClose,
                className: 'flex-1 py-3.5 text-red-500 font-black bg-white border border-red-200 hover:bg-red-50 rounded-xl text-sm transition-colors',
                children: 'Cancel'
              }),
              jsx('button', {
                onClick: () => {
                  const startTime = new Date(startValue).toISOString();
                  const endTime = keepRunning ? null : new Date(endValue).toISOString();
                  onSave(startTime, endTime);
                },
                className: 'flex-1 py-3.5 text-white font-black bg-black hover:bg-black/85 rounded-xl text-sm transition-colors',
                children: 'Save'
              })
            ]
          }),
          // Bottom spacer
          jsx('div', { className: 'h-8 bg-white shrink-0' })
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
  const { data: activities = [] } = useActivities();
  const freePlan = !isPro();
  const atLimit = freePlan && activities.length >= FREE_ACTIVITY_LIMIT;
  const overLimit = freePlan && activities.length > FREE_ACTIVITY_LIMIT;
  let trimDaysLeft = FREE_TRIM_DAYS;
  try {
    const armedAt = JSON.parse(localStorage.getItem('lt_downgrade_at_v1') || 'null');
    if (armedAt) trimDaysLeft = Math.max(1, Math.ceil((Number(armedAt) + FREE_TRIM_DAYS * 86400000 - Date.now()) / 86400000));
  } catch (e) { /* ignore */ }

  const handleAdd = () => {
    if (!name.trim()) return;
    if (atLimit) return;
    const randomColor = getDistinctColor(activities.map((a) => a.color));
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
        className: cn(
          'mx-4 mt-3 mb-1 rounded-2xl flex items-center gap-1 pr-2 pl-4 border',
          atLimit
            ? 'bg-red-50 border-red-300 shadow-[0_6px_20px_rgba(239,68,68,0.12)]'
            : 'bg-white border-black/[.06] shadow-[0_6px_20px_rgba(15,23,42,0.05)]'
        ),
        children: [
          // Text input
          jsx('input', {
            ref: inputRef,
            type: 'text',
            value: name,
            disabled: atLimit,
            onChange: (e) => setName(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') handleAdd();
            },
            placeholder: atLimit ? 'Free plan limit reached (' + activities.length + '/' + FREE_ACTIVITY_LIMIT + ')' : 'New activity...',
            className: 'flex-1 bg-transparent text-foreground placeholder:text-foreground/35 disabled:placeholder:text-red-400 outline-none py-3.5 text-[15px] font-semibold min-w-0 disabled:opacity-70'
          }),
          // Emoji picker button (shows selected emoji or 🙂 default)
          jsx('button', {
            type: 'button',
            disabled: atLimit,
            onClick: () => setShowNewPicker(true),
            className: 'w-9 h-9 rounded-full bg-foreground/[0.05] hover:bg-foreground/10 flex items-center justify-center text-lg shrink-0 transition-colors disabled:opacity-40',
            title: 'Choose emoji',
            children: newEmoji || '🙂'
          }),
          // Add button (black)
          jsxs('button', {
            onClick: handleAdd,
            disabled: atLimit || !name.trim() || createActivity.isPending,
            className: 'h-9 px-4 rounded-full bg-black text-white font-extrabold text-[13px] flex items-center gap-1.5 disabled:opacity-40 shrink-0 transition-all hover:bg-black/85',
            children: [
              jsx(rk, { className: 'w-4 h-4' }),
              'Add'
            ]
          })
        ]
      }),
      // Free-plan limit warning
      atLimit && jsxs('div', {
        className: 'mx-4 mt-2 mb-3 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-200 px-3 py-2',
        children: [
          jsx('span', {
            className: 'flex-1 text-[11px] font-bold text-red-600 leading-snug',
            children: overLimit
              ? 'You have ' + activities.length + ' of ' + FREE_ACTIVITY_LIMIT + ' activities. Remove an activity — or in ' + trimDaysLeft + ' day' + (trimDaysLeft === 1 ? '' : 's') + ' a random extra activity is removed automatically.'
              : 'Free plan limit reached — you have ' + activities.length + ' of ' + FREE_ACTIVITY_LIMIT + ' activities. Remove an activity to add more.'
          }),
          jsx('button', {
            onClick: () => { if (window.LTPlan && window.LTPlan.showPlansScreen) window.LTPlan.showPlansScreen(); },
            className: 'shrink-0 h-7 px-3 rounded-full bg-black text-white text-[10px] font-extrabold uppercase tracking-wider hover:bg-black/85',
            children: 'Upgrade'
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
  const deathDate = new Date(profile.dob);
  deathDate.setFullYear(deathDate.getFullYear() + (profile.lifespanYears || 80));
  const retirementDateStr = deathDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (percentLived / 100) * circumference;

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';

  const planLabel = (() => { const p = localStorage.getItem('lt_plan_v1'); if (!p) return 'Free'; try { const v = JSON.parse(p); return v === 'basic' ? 'Basic' : v === 'yearly' ? '1 Year' : v === 'lifetime' || v === 'pro' ? 'Lifetime' : 'Free'; } catch { return 'Free'; } })();

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
      tvData = {
        value, remHours, remMin, rate: pm * 60,
        spent: Math.max(0, dailyBudget - value),
        elapsedFrac: secOfDay / 86400,
        pct: Math.max(0, Math.min(100, Math.ceil((remSecToday / 86400) * 100)))
      };
    }
  } catch (e) { /* ignore */ }

  let tvSplit = null;
  if (tvData) {
    const s = tvData.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const dot = s.indexOf('.');
    tvSplit = [s.slice(0, dot), s.slice(dot + 1)];
  }

  // Area chart for the money timer — deterministic day-decline curve with a
  // marker dot at the current position and a "% left" tooltip bubble.
  let tvChart = null;
  if (tvData) {
    const CW = 280, CH = 56;
    const yAt = (f) => 8 + f * 36 + 3 * Math.sin(f * Math.PI * 2.6);
    const N = 48;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      d += (i === 0 ? 'M' : 'L') + (f * CW).toFixed(1) + ' ' + yAt(f).toFixed(1) + ' ';
    }
    d = d.trim();
    const ef = Math.max(0, Math.min(0.975, tvData.elapsedFrac || 0));
    tvChart = {
      line: d,
      area: d + ' L' + CW + ' ' + CH + ' L0 ' + CH + ' Z',
      dx: ef * CW,
      dy: yAt(ef),
      tipX: Math.max(27, Math.min(CW - 27, ef * CW)),
      tipY: Math.max(1, yAt(ef) - 23)
    };
  }
  const tvMoney = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const tvTile = (o) => jsxs('div', {
    className: cn('rounded-2xl px-2 py-2 flex flex-col gap-1 min-w-0 overflow-hidden', o.bg),
    children: [
      jsx('span', {
        className: cn('w-5 h-5 rounded-full flex items-center justify-center shrink-0', o.chip),
        children: jsx(o.icon, { className: 'w-3 h-3 ' + o.iconCls })
      }),
      jsxs('span', {
        className: 'flex items-baseline gap-0.5 min-w-0',
        children: [
          o.sym && jsx('span', { className: cn('text-[8px] font-black shrink-0', o.valCls), children: o.sym }),
          jsx('span', { className: cn('text-[10.5px] font-black tabular-nums leading-none truncate', o.valCls), children: o.amount })
        ]
      }),
      jsx('span', { className: 'text-[8.5px] font-bold text-foreground/45 leading-none truncate', children: o.label })
    ]
  });

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
      // Compact countdown card
      jsxs('div', {
        className: 'bg-primary rounded-2xl px-4 py-4',
        children: [
          jsxs('div', {
            className: 'flex flex-wrap items-center gap-x-2 gap-y-1 mb-2',
            children: [
              jsx('p', {
                className: 'text-[12px] font-bold text-white m-0 uppercase tracking-wide leading-tight',
                children: [profile.name, "'s Remaining Retirement Time"]
              }),
              jsxs('span', {
                className: 'flex items-center gap-1 bg-[#FDE68A]/15 text-[#FDE68A] text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap',
                children: ['\u2605 ' + planLabel]
              })
            ]
          }),
          retirementDateStr && jsxs('p', {
            className: 'text-[11px] font-semibold text-white/60 mb-3',
            children: ['\uD83C\uDFAF Retirement date: ', jsx('span', { className: 'text-[#FDE68A]', children: retirementDateStr })]
          }),
          jsxs('div', {
            className: 'grid grid-cols-5 gap-2',
            children: [
              jsx(LifeDigit, { value: breakdown.years, label: 'YEARS' }),
              jsx(LifeDigit, { value: breakdown.days, label: 'DAYS' }),
              jsx(LifeDigit, { value: breakdown.hours, label: 'HOURS' }),
              jsx(LifeDigit, { value: breakdown.minutes, label: 'MIN' }),
              jsx(LifeDigit, { value: breakdown.seconds, label: 'SEC', accent: true })
            ]
          }),
          jsx('div', {
            className: 'h-1 w-full bg-white/10 overflow-hidden mt-3',
            children: jsx('div', {
              className: 'h-full bg-accent',
              style: { width: `${percentLived}%` }
            })
          }),
          jsxs('div', {
            className: 'flex justify-between text-[10px] text-white/35 font-medium mt-1.5',
            children: [
              jsxs('span', { children: [percentLived.toFixed(1), '% lived'] }),
              jsxs('span', { children: [breakdown.totalMinutes.toLocaleString(), ' min left'] })
            ]
          })
        ]
      }),
      // Money timer — reference-style card: header, remaining row, big
      // number, area chart, segmented bar + three stat tiles.
      tvData && jsxs('div', {
        className: 'relative bg-white border border-black/[.06] rounded-2xl px-4 py-3.5 shadow-[0_10px_34px_rgba(15,23,42,0.07)] overflow-hidden',
        style: { backgroundImage: 'radial-gradient(120% 90% at 100% 0%, rgba(0,194,168,0.08), rgba(0,194,168,0) 55%)' },
        children: [
          jsxs('div', {
            className: 'flex items-center justify-between',
            children: [
              jsxs('span', {
                className: 'flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-foreground/55 whitespace-nowrap',
                children: [
                  jsx('span', { className: 'inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse shrink-0' }),
                  'Today\u2019s Money Timer'
                ]
              }),
              jsxs('span', {
                className: 'inline-flex items-baseline gap-1 bg-accent/10 border border-accent/25 rounded-full px-2.5 py-1 shrink-0',
                children: [
                  jsx('span', { className: 'text-[12px] font-black text-accent tabular-nums leading-none', children: 'Rs.' + Number(tvData.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }),
                  jsx('span', { className: 'text-[8px] font-extrabold tracking-widest text-accent/60', children: '/h' })
                ]
              })
            ]
          }),
          jsxs('div', {
            className: 'mt-2.5 flex items-center justify-between gap-3',
            children: [
              jsx('p', { className: 'text-[9.5px] font-bold uppercase tracking-[0.18em] text-foreground/45', children: 'Remaining budget' }),
              jsxs('span', {
                className: 'shrink-0 inline-flex items-center gap-1 text-[11px] font-extrabold tracking-wide text-foreground/50 tabular-nums',
                children: [
                  jsx(Zb, { className: 'w-3 h-3 text-foreground/35' }),
                  tvData.remHours + 'h ' + tvData.remMin + 'min',
                  jsx('span', { className: 'text-foreground/35', children: ' LEFT' })
                ]
              })
            ]
          }),
          jsxs('div', {
            className: 'mt-1.5 relative flex items-baseline gap-1.5 min-w-0',
            children: [
              jsx('span', { className: 'text-[17px] font-black text-accent/70 leading-none', children: 'Rs.' }),
              jsxs('span', {
                className: 'relative flex items-baseline min-w-0',
                children: [
                  jsx('span', { className: 'text-[42px] font-black leading-none tracking-tight tabular-nums bg-gradient-to-br from-accent to-emerald-600 bg-clip-text text-transparent', children: tvSplit[0] }),
                  jsx('span', { className: 'text-[21px] font-black leading-none tabular-nums text-accent/70 ml-0.5', children: '.' + tvSplit[1] })
                ]
              })
            ]
          }),
          // Area chart — day-decline curve, marker dot + "% left" bubble
          tvChart && jsx('div', {
            className: 'mt-2',
            children: jsxs('svg', {
              viewBox: '0 0 280 56',
              className: 'w-full h-auto block',
              children: [
                jsx('defs', {
                  children: jsxs('linearGradient', {
                    id: 'ltTvChartFill', x1: '0', y1: '0', x2: '0', y2: '1',
                    children: [
                      jsx('stop', { offset: '0%', stopColor: '#00C2A8', stopOpacity: 0.32 }),
                      jsx('stop', { offset: '100%', stopColor: '#00C2A8', stopOpacity: 0.02 })
                    ]
                  })
                }),
                jsx('path', { d: tvChart.area, fill: 'url(#ltTvChartFill)', stroke: 'none' }),
                jsx('path', { d: tvChart.line, fill: 'none', stroke: '#00C2A8', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
                jsx('rect', { x: tvChart.tipX - 25, y: tvChart.tipY, width: 50, height: 15, rx: 7.5, fill: '#E6FAF6', stroke: '#00C2A8', strokeOpacity: 0.35 }),
                jsx('text', { x: tvChart.tipX, y: tvChart.tipY + 10.5, textAnchor: 'middle', fontSize: 8.5, fontWeight: 800, fill: '#00A98F', children: tvData.pct + '% left' }),
                jsx('circle', { cx: tvChart.dx, cy: tvChart.dy, r: 4, fill: '#00C2A8', stroke: '#fff', strokeWidth: 2 })
              ]
            })
          }),
          // Segmented bar — partial fill from the left = remaining today
          jsxs('div', {
            className: 'flex gap-[2px] mt-3 pt-3 border-t border-foreground/10',
            children:
              Array.from({ length: 9 }, (_, k) => {
                const fill = Math.max(0, Math.min(1, (tvData.pct / 100) * 9 - k));
                return jsx('span', {
                  className: 'relative h-2 flex-1 rounded-full bg-foreground/[0.08] overflow-hidden',
                  children: fill > 0 && jsx('span', {
                    className: 'absolute inset-y-0 left-0 bg-accent rounded-full',
                    style: { width: (fill * 100).toFixed(1) + '%' }
                  })
                }, k);
              })
          }),
          jsxs('div', {
            className: 'flex items-center justify-between mt-1.5',
            children: [
              jsx('span', { className: 'text-[9px] font-extrabold uppercase tracking-[0.14em] text-foreground/35', children: '12 AM' }),
              jsx('span', { className: 'text-[9.5px] font-bold text-foreground/50 tabular-nums', children: tvData.pct + '% of today\u2019s value left' }),
              jsx('span', { className: 'text-[9px] font-extrabold uppercase tracking-[0.14em] text-foreground/35', children: '12 AM' })
            ]
          }),
          // Three stat tiles: spent today / per hour / remaining
          jsxs('div', {
            className: 'grid grid-cols-3 gap-2 mt-3',
            children: [
              tvTile({ bg: 'bg-accent/10', chip: 'bg-accent/20', icon: Ri, iconCls: 'text-accent', sym: 'Rs.', amount: tvMoney(tvData.spent), valCls: 'text-accent', label: 'Spent Today' }),
              tvTile({ bg: 'bg-violet-500/10', chip: 'bg-violet-500/15', icon: Cc, iconCls: 'text-violet-600', sym: 'Rs.', amount: tvMoney(tvData.rate), valCls: 'text-foreground', label: 'Per Hour' }),
              tvTile({ bg: 'bg-amber-500/10', chip: 'bg-amber-500/15', icon: Zb, iconCls: 'text-amber-600', sym: '', amount: tvData.remHours + 'h ' + tvData.remMin + 'min', valCls: 'text-foreground', label: 'Remaining' })
            ]
          })
        ]
      })
    ]
  });
}

function LifeDigit({ value, label, accent }) {
  return jsxs('div', {
    className: 'flex flex-col items-center bg-white/10 border border-white/20 rounded-xl py-2.5 px-1',
    children: [
      jsx('span', {
        className: cn('text-[17px] font-black text-white tabular-nums leading-none', accent && 'text-accent'),
        children: String(value).padStart(2, '0')
      }),
      jsx('span', {
        className: 'text-[8px] font-extrabold tracking-widest text-white/50 mt-0.5',
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

  const localDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const todayStr = localDay(new Date());
  const todayBlocks = blocks.filter(b => {
    if (!b.startTime) return false;
    const start = new Date(b.startTime);
    const dateStr = localDay(start);
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

  // Top 4: most minutes today first, then most all-time usage
  const lifetimeMinutes = {};
  blocks.forEach(b => {
    if (!b.startTime || !b.activityId) return;
    const startMs = new Date(b.startTime).getTime();
    const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
    if (!(endMs > startMs)) return;
    lifetimeMinutes[b.activityId] = (lifetimeMinutes[b.activityId] || 0) + Math.round((endMs - startMs) / 60000);
  });
  const display = activities
    .map(a => ({
      ...a,
      minutes: activityMinutes[a.id] || 0,
      lifetime: lifetimeMinutes[a.id] || 0
    }))
    .sort((x, y) => (y.minutes - x.minutes) || (y.lifetime - x.lifetime))
    .slice(0, 4);

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
            className: 'rounded-xl p-2 flex flex-col items-center gap-0.5 min-w-0 overflow-hidden',
            style: { background: colors[i % colors.length] },
            children: [
              jsx('span', { className: 'text-lg leading-none', children: a.emoji || '\uD83C\uDFB3' }),
              jsx('span', { className: 'text-[11px] font-extrabold text-foreground leading-tight whitespace-nowrap', children: formatMins(a.minutes) }),
              jsx('span', {
                className: 'text-[8px] text-foreground/60 text-center w-full truncate leading-tight',
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

  const starred = tasks.filter(t => t.starred);
  /* Slots hold INCOMPLETE starred tasks first: completing one drops it down
     the list so the next queued starred task switches into the card right
     away (it used to sit there "finished" while queued tasks never appeared).
     Completed ones only keep a visible slot while there is room left. */
  const incompleteStarred = starred.filter(t => !t.completed);
  const doneStarred = starred.filter(t => t.completed);
  const slotPool = incompleteStarred.concat(doneStarred);
  const slots = [];
  for (let i = 0; i < MAX_FROG_TASKS; i++) {
    slots.push(slotPool[i] || null);
  }
  const doneCount = starred.filter(t => t.completed).length;
  const activeCount = starred.length - doneCount;
  const progMax = Math.max(MAX_FROG_TASKS, starred.length);
  const progPct = Math.round((doneCount / Math.max(1, progMax)) * 100);

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
    className: 'mx-4 mt-3 rounded-3xl border border-black/[.06] bg-white shadow-[0_10px_34px_rgba(15,23,42,0.07)] overflow-hidden',
    style: { backgroundImage: 'radial-gradient(130% 100% at 100% 0%, rgba(0,194,168,0.10), rgba(0,194,168,0) 55%),' + 'radial-gradient(90% 80% at 0% 100%, rgba(0,194,168,0.05), rgba(0,194,168,0) 60%)' },
    children: [
      jsxs('div', {
        className: 'flex items-start justify-between gap-3 px-4 pt-4',
        children: [
          jsxs('div', { className: 'min-w-0', children: [
            jsxs('p', { className: 'flex items-center gap-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-foreground/55', children: [
              jsx('span', { className: 'inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse' }),
              'Eat the Frog'
            ]}),
            jsx('p', { className: 'text-[19px] font-black text-foreground mt-1 leading-tight', children: activeCount > 0 ? 'Beat your ' + activeCount + ' top task' + (activeCount !== 1 ? 's' : '') : 'Add your top tasks' }),
            jsx('p', { className: 'text-[11.5px] text-foreground/55 mt-0.5', children: 'Finish what matters before anything else' })
          ]}),
          jsx('img', { src: './assets/eat-the-frog.png', alt: '', className: 'w-[74px] h-[74px] object-contain -mt-1 -mr-1 shrink-0' })
        ]
      }),
      jsxs('div', {
        className: 'flex items-center gap-2.5 px-4 mt-3',
        children: [
          jsx('div', {
            className: 'flex-1 h-2 rounded-full bg-foreground/10 overflow-hidden',
            children: jsx('div', {
              className: 'h-full rounded-full bg-accent transition-[width] duration-500',
              style: { width: progPct + '%' }
            })
          }),
          jsx('span', {
            className: 'text-[10px] font-extrabold text-foreground/50 tabular-nums shrink-0',
            children: doneCount + '/' + progMax + ' done'
          })
        ]
      }),
      jsx('div', {
        className: 'flex flex-col gap-2 px-4 pt-3 pb-4',
        children: slots.map((task, i) =>
          jsx(FrogSlot, {
            task,
            index: i,
            onToggle: toggleComplete,
            onUnstar: unstarTask,
            onUpdateTitle: updateTitle,
            onCreate: createFromSlot
          }, i)
        )
      })
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
    className: cn(
      'flex items-center gap-2.5 rounded-2xl border border-black/20 px-3 py-2.5 transition-colors',
      task?.completed
        ? 'bg-accent/10'
        : task
          ? 'bg-foreground/[0.04]'
          : 'bg-white'
    ),
    children: [
      // Checkbox
      jsx('button', {
        type: 'button',
        onClick: () => slotTaskId && onToggle(slotTaskId),
        className: cn(
          'w-[22px] h-[22px] flex-shrink-0 rounded-full border-2 flex items-center justify-center text-[11px] font-black text-white transition-colors',
          task?.completed
            ? 'bg-accent border-accent'
            : 'border-black/30 bg-white hover:border-accent',
          !slotTaskId && 'opacity-35 cursor-default'
        ),
        children: task?.completed ? '\u2713' : null
      }),
      // Title input
      jsx('input', {
        type: 'text',
        value: localTitle,
        onChange: handleInput,
        placeholder: index === 0 ? 'Add your most important task\u2026' : 'Add another task\u2026',
        className: cn(
          'flex-1 bg-transparent border-none text-sm text-foreground outline-none min-w-0 py-0.5 placeholder:text-foreground/35',
          task?.completed && 'line-through opacity-55'
        )
      }),
      // Unstar
      jsx('button', {
        type: 'button',
        onClick: () => slotTaskId && onUnstar(slotTaskId),
        title: 'Remove from Eat the Frog',
        className: cn(
          'flex-shrink-0 p-1 text-[#f5a623] hover:scale-110 transition-transform',
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

function StatCard({ icon, iconBg, label, value, suffix, danger }) {
  return jsxs('div', {
    className: 'rounded-3xl border border-black/[.06] bg-white p-4 shadow-[0_10px_34px_rgba(15,23,42,0.07)]',
    children: [
      jsx('div', {
        className: 'w-9 h-9 rounded-full flex items-center justify-center text-base mb-2.5',
        style: { background: iconBg },
        children: icon
      }),
      jsx('p', { className: 'text-[9.5px] font-extrabold uppercase tracking-[0.16em] text-foreground/45 m-0 mb-1', children: label }),
      jsxs('p', { className: cn('text-[21px] font-black m-0 leading-none tabular-nums', danger ? 'text-red-500' : 'text-foreground'), children: [
        value,
        suffix && jsx('span', { className: 'text-[11px] font-bold text-foreground/40 ml-0.5', children: suffix })
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

  const todayBlockCount = blocks.filter((b) => {
    const d = new Date(b.startTime);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }).length;

  const focusScore = calcFocusScore(todayEntries);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  const freePlan = !isPro();
  const limitReached = freePlan && activities.length >= FREE_ACTIVITY_LIMIT;

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
        className: 'flex items-center justify-between gap-2.5 px-4 pt-4 pb-1',
        children: [
          jsx('h1', { className: 'text-[26px] font-black text-foreground m-0 leading-none', children: 'Activity' }),
          jsxs('span', {
            className: 'inline-flex items-center gap-1.5 text-[11px] font-bold text-foreground/55 bg-white border border-black/[.06] rounded-full px-3 py-1.5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] whitespace-nowrap',
            children: [
              jsx('span', { className: 'w-1.5 h-1.5 rounded-full bg-accent' }),
              dateLabel
            ]
          })
        ]
      }),

      // 2x2 stats grid
      jsxs('div', {
        className: 'grid grid-cols-2 gap-3 px-4 pt-3.5 pb-1',
        children: [
          jsx(StatCard, { icon: '⏱', iconBg: '#DCFCE7', label: 'Time Tracked', value: fmtMins(totalMinutesTracked * 60) }),
          jsx(StatCard, { icon: '📋', iconBg: '#E0F2FE', label: 'Blocks Today', value: todayBlockCount }),
          jsx(StatCard, { icon: '🎯', iconBg: '#FEE2E2', label: 'Focus Score', value: focusScore, suffix: '/100' }),
          jsx(StatCard, { icon: '🔥', iconBg: '#EDE9FE', label: 'Activities', value: freePlan ? activities.length + ' / ' + FREE_ACTIVITY_LIMIT : activities.length, danger: limitReached })
        ]
      }),

      // Section label
      jsxs('div', {
        className: 'flex items-end justify-between gap-2 px-4 pt-4 pb-2.5',
        children: [
          jsxs('div', {
            className: 'min-w-0',
            children: [
              jsx('p', { className: 'text-[17px] font-black text-foreground m-0 leading-tight', children: 'Your Activities' }),
              jsx('p', { className: 'text-[11px] font-semibold text-muted-foreground mt-0.5 mb-0', children: "Default activities don't count toward achievements" })
            ]
          }),
          activities.length > 0 && jsx('span', {
            className: cn(
              'shrink-0 text-[10px] font-extrabold uppercase tracking-[0.12em] rounded-full px-2.5 py-1.5 border',
              limitReached
                ? 'bg-red-500 text-white border-red-600 shadow-[0_6px_16px_rgba(239,68,68,0.35)]'
                : 'text-foreground/45 bg-white border-black/[.06]'
            ),
            children: freePlan ? activities.length + ' / ' + FREE_ACTIVITY_LIMIT : activities.length + ' total'
          })
        ]
      }),

      // Activity list
      jsxs('div', {
        className: 'flex flex-col gap-2.5 px-4',
        children: [
          activities.length === 0 && jsxs('div', {
            className: 'flex flex-col items-center justify-center py-12 px-8 text-center bg-white rounded-3xl border border-black/[.06] shadow-[0_10px_34px_rgba(15,23,42,0.07)]',
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
            primary: true,
            onClick: (e) => {
              e.nativeEvent.stopImmediatePropagation();
              startTimer(selectedActivity);
            }
          }),
          jsx(ModalOption, {
            icon: jsx(Jb, { className: 'w-5 h-5' }),
            label: 'Log a time block',
            description: 'Set a start and end time manually',
            onClick: (e) => {
              e.nativeEvent.stopImmediatePropagation();
              setLogBlockActivity(selectedActivity);
              setSelectedActivity(null);
            }
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
