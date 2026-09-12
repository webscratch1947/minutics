/**
 * hooks/useCreateActivity.js — Mutation to create a new activity
 * 
 * Replaces mangled export: PC
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStore, setStore, nextId } from '../lib/storage.js';
import { activitiesKey } from '../lib/queryKeys.js';

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }) => {
      const store = getStore();
      const activity = { id: nextId(store.activities), ...data };
      store.activities.push(activity);
      setStore(store);
      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey() });
    }
  });
}
