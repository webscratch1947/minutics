/**
 * hooks/useUpdateActivity.js — Mutation to update activity fields
 * 
 * Replaces mangled export: UAC
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStore, setStore } from '../lib/storage.js';
import { activitiesKey } from '../lib/queryKeys.js';

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const store = getStore();
      store.activities = store.activities.map(a => a.id === id ? { ...a, ...data } : a);
      setStore(store);
      return store.activities.find(a => a.id === id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activitiesKey });
    }
  });
}
