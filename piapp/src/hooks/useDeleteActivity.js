/**
 * hooks/useDeleteActivity.js — Mutation to soft-delete (archive) an activity
 * 
 * Replaces mangled export: TC
 * Archives the activity and stops any running block for it.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStore, setStore } from '../lib/storage.js';
import { activitiesKey, blocksKey } from '../lib/queryKeys.js';

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      const store = getStore();
      // Archive the activity
      store.activities = store.activities.map(a =>
        a.id === id ? { ...a, archived: true } : a
      );
      // Stop any running block for this activity
      store.blocks = store.blocks.map(b =>
        b.activityId === id && !b.endTime
          ? { ...b, endTime: new Date().toISOString() }
          : b
      );
      setStore(store);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey() });
      queryClient.invalidateQueries({ queryKey: blocksKey() });
    }
  });
}
