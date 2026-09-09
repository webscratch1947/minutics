/**
 * constants.js — Shared constants
 * 
 * Replaces mangled export: fh (COLOR_PALETTE)
 */

/** Random color palette for new activities */
export const COLOR_PALETTE = [
  "#1B1F3B",
  "#00897B",
  "#D97706",
  "#7C3AED",
  "#1D4ED8",
  "#BE185D",
  "#15803D",
  "#B91C1C"
];

/** Get a random color from the palette */
export function getRandomColor() {
  return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
}
