/**
 * queryKeys.js — React Query key factories
 * 
 * Replaces mangled exports: Ho (blocksKey), Kc (activitiesKey),
 *   Qo (todayStatsKey), bC (weekStatsKey)
 */

/** Query key for time blocks (was: Ho) */
export const blocksKey = ["local", "blocks"];

/** Query key for activities (was: Kc) */
export const activitiesKey = ["local", "activities"];

/** Query key for today's stats (was: Qo) */
export const todayStatsKey = ["local", "today-stats"];

/** Query key for week stats (was: bC) */
export const weekStatsKey = ["local", "week-stats"];
