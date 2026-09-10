/**
 * cn.js — Tailwind class merging utility
 * 
 * Replaces mangled export: Pe (cn)
 * Combines clsx (conditional classes) + tailwind-merge (deduplication)
 */

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge class names with Tailwind conflict resolution (was: Pe) */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
