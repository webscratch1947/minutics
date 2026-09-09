/**
 * hooks/useUpdateBlock.js — Mutation to update a block's times
 * 
 * Replaces mangled export: jC
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStore, setStore } from '../lib/storage.js';
import { blocksKey } from '../lib/queryKeys.js';

export function useUpdateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const store = getStore();
      store.blocks = store.blocks.map(b => b.id === id ? { ...b, ...data } : b);
      setStore(store);
      return store.blocks.find(b => b.id === id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blocksKey });
    }
  });
}
