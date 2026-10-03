/**
 * constants.js — Shared constants
 * 
 * Replaces mangled export: fh (COLOR_PALETTE)
 */

/** Random color palette for new activities */
export const COLOR_PALETTE = [
  "#3B82F6",
  "#00897B",
  "#D97706",
  "#7C3AED",
  "#E11D48",
  "#BE185D",
  "#15803D",
  "#B91C1C"
];

/** Get a random color from the palette */
export function getRandomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/**
 * Pick a palette color that is visually distinct (RGB distance >= 90) from
 * every already-used color, so no two activities share a near-identical
 * color. Falls back to the best-scoring palette color if none qualifies.
 */
export function getDistinctColor(usedColors) {
  const used = (Array.isArray(usedColors) ? usedColors : [])
    .map(hexToRgb)
    .filter(Boolean);
  let best = COLOR_PALETTE[0];
  let bestScore = -1;
  for (const c of COLOR_PALETTE) {
    const rgb = hexToRgb(c);
    if (!rgb) continue;
    const minD = used.length
      ? Math.min.apply(null, used.map((u) => colorDist(rgb, u)))
      : Infinity;
    if (minD > bestScore) {
      bestScore = minD;
      best = c;
      if (minD >= 90) break;
    }
  }
  return best;
}
