/**
 * lifeCalc.js — Life countdown calculations
 * 
 * Replaces mangled exports: la (calcRemainingTime), jy (calcPercentLived), pk (msToBreakdown)
 */

/**
 * Calculate milliseconds remaining until estimated death date (was: la)
 * @param {{ dob: string, lifespanYears: number }} profile
 * @returns {number} ms remaining (0 if past death date)
 */
export function calcRemainingTime(profile) {
  const dob = new Date(profile.dob);
  const deathDate = new Date(dob);
  deathDate.setFullYear(deathDate.getFullYear() + profile.lifespanYears);
  return Math.max(0, deathDate.getTime() - Date.now());
}

/**
 * Calculate percentage of life already lived (was: jy)
 * @param {{ dob: string, lifespanYears: number }} profile
 * @returns {number} 0-100
 */
export function calcPercentLived(profile) {
  const dob = new Date(profile.dob);
  const deathDate = new Date(dob);
  deathDate.setFullYear(deathDate.getFullYear() + profile.lifespanYears);
  const totalLifeMs = deathDate.getTime() - dob.getTime();
  const livedMs = Date.now() - dob.getTime();
  return Math.min(100, Math.max(0, (livedMs / totalLifeMs) * 100));
}

/**
 * Convert milliseconds to human-readable breakdown (was: pk)
 * @param {number} ms
 * @returns {{ years: number, days: number, hours: number, minutes: number, seconds: number, totalMinutes: number }}
 */
export function msToBreakdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const years = Math.floor(totalSeconds / (365.25 * 24 * 3600));
  let remainder = totalSeconds - Math.floor(years * 365.25 * 24 * 3600);
  const days = Math.floor(remainder / (24 * 3600));
  remainder -= days * 24 * 3600;
  const hours = Math.floor(remainder / 3600);
  remainder -= hours * 3600;
  const minutes = Math.floor(remainder / 60);
  const seconds = remainder % 60;
  return {
    years,
    days,
    hours,
    minutes,
    seconds,
    totalMinutes: Math.floor(ms / 60000)
  };
}
