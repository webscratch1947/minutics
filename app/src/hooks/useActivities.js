/**
 * hooks/useActivities.js — Query for non-archived activities
 * 
 * Replaces mangled export: kC
 */
import { useQuery } from '@tanstack/react-query';
import { getStore } from '../lib/storage.js';
import { activitiesKey } from '../lib/queryKeys.js';

export function useActivities() {
  return useQuery({
    queryKey: activitiesKey(),
    queryFn: () => getStore().activities.filter(a => !a.archived)
  });
}
