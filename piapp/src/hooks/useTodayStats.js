/**
 * hooks/useTodayStats.js — Query for today's activity summary (auto-refreshes every 1s)
 * 
 * Replaces mangled export: CC
 */
import { useQuery } from '@tanstack/react-query';
import { getStore } from '../lib/storage.js';
import { enrichBlocksForRange } from '../lib/storage.js';
import { todayStatsKey } from '../lib/queryKeys.js';

export function useTodayStats() {
  return useQuery({
    queryKey: todayStatsKey(),
    queryFn: () => {
      const store = getStore();
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return enrichBlocksForRange(store.blocks, store.activities, dayStart, dayStart + 86400000);
    },
    refetchInterval: 1000
  });
}
