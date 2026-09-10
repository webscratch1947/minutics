/**
 * settings.js — App settings helpers
 * 
 * Replaces mangled export: th (saveGoalType)
 * localStorage key: "lt_goal_type_v1"
 */

/** Read a JSON value from localStorage */
export function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

/** Write a JSON value to localStorage */
export function writeJson(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/** Save goal type setting (was: th) */
export function saveGoalType(goalType) {
  writeJson("lt_goal_type_v1", goalType);
}

/** Read goal type setting */
export function getGoalType() {
  return readJson("lt_goal_type_v1", { type: "retirement", milestoneLabel: "Milestone" });
}

/** Read plan */
export function getPlan() {
  try {
    return JSON.parse(localStorage.getItem("lt_plan_v1") || '"free"');
  } catch {
    return "free";
  }
}

/** Check if user is on a paid plan */
export function isPro() {
  const plan = getPlan();
  return plan === "basic" || plan === "yearly" || plan === "lifetime" || plan === "pro";
}
