/**
 * queryKeys.js — React Query key factories
 * 
 * Replaces mangled exports: Ho (blocksKey), Kc (activitiesKey),
 *   Qo (todayStatsKey), bC (weekStatsKey)
 */

/** Query key for time blocks (was: Ho) */
export function blocksKey() { return ["local", "blocks"]; }

/** Query key for activities (was: Kc) */
export function activitiesKey() { return ["local", "activities"]; }

/** Query key for today's stats (was: Qo) */
export function todayStatsKey() { return ["local", "today-stats"]; }

/** Query key for week stats (was: bC) */
export function weekStatsKey() { return ["local", "week-stats"]; }
