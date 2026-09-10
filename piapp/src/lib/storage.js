/**
 * storage.js — Core localStorage data layer
 * 
 * Replaces mangled exports: Xt (getStore), Cl (setStore), Ly (nextId), Qc (enrichBlock)
 * localStorage key: "lifetime_local_db_v1"
 * Data shape: { activities: Activity[], blocks: Block[] }
 */

const DB_KEY = "lifetime_local_db_v1";

/**
 * @typedef {{ id: number, name: string, emoji?: string, color: string, archived?: boolean }} Activity
 * @typedef {{ id: number, activityId: number, startTime: string, endTime?: string, durationSeconds?: number }} Block
 * @typedef {{ activities: Activity[], blocks: Block[] }} Store
 */

function defaultStore() {
  return { activities: [], blocks: [] };
}

/** Read the full store from localStorage (was: Xt) */
export function getStore() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw);
    return {
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks.map(recalcBlock) : []
    };
  } catch {
    return defaultStore();
  }
}

/** Write the full store to localStorage (was: Cl) */
export function setStore(store) {
  localStorage.setItem(DB_KEY, JSON.stringify(store));
}

/** Generate next sequential integer ID for an array of items (was: Ly) */
export function nextId(items) {
  return Math.max(0, ...items.map(item => item.id)) + 1;
}

/** Recalculate durationSeconds on a block (was: Qc) */
export function recalcBlock(block) {
  const endMs = block.endTime ? new Date(block.endTime).getTime() : Date.now();
  const startMs = new Date(block.startTime).getTime();
  return {
    ...block,
    durationSeconds: Math.max(0, Math.floor((endMs - startMs) / 1000))
  };
}

/** Attach activity name + color to a block (was: SC — used inside enrichBlocksForDay) */
export function enrichSingleBlock(block, activities) {
  const activity = activities.find(a => a.id === block.activityId);
  return {
    ...recalcBlock(block),
    activityName: activity?.name,
    activityColor: activity?.color
  };
}

/** Clip blocks to a time range and aggregate by activity (was: Yc) */
export function enrichBlocksForRange(blocks, activities, rangeStart, rangeEnd) {
  const map = new Map();
  for (const block of blocks) {
    const blockStartMs = new Date(block.startTime).getTime();
    const blockEndMs = block.endTime ? new Date(block.endTime).getTime() : Date.now();
    const clippedStart = Math.max(blockStartMs, rangeStart);
    const clippedEnd = Math.min(blockEndMs, rangeEnd);
    if (clippedEnd <= clippedStart) continue;
    
    const activity = activities.find(a => a.id === block.activityId);
    if (!activity) continue;
    
    const entry = map.get(activity.id) ?? {
      activityId: activity.id,
      activityName: activity.name,
      activityColor: activity.color,
      totalSeconds: 0
    };
    entry.totalSeconds += Math.round((clippedEnd - clippedStart) / 1000);
    map.set(activity.id, entry);
  }
  
  const sorted = [...map.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
  return {
    totalSeconds: sorted.reduce((sum, a) => sum + a.totalSeconds, 0),
    activities: sorted
  };
}
