/**
 * hooks/useCreateBlock.js — Mutation to create a new time block
 * 
 * Replaces mangled export: NC
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStore, setStore, nextId } from '../lib/storage.js';
import { blocksKey } from '../lib/queryKeys.js';

export function useCreateBlock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data }) => {
      const store = getStore();
      const block = { id: nextId(store.blocks), ...data };
      store.blocks.push(block);
      setStore(store);
      return block;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blocksKey });
    }
  });
}
