/**
 * hooks/useBlocks.js — Query for all time blocks (auto-refreshes every 1s)
 * 
 * Replaces mangled export: Ay
 */
import { useQuery } from '@tanstack/react-query';
import { getStore, recalcBlock } from '../lib/storage.js';
import { blocksKey } from '../lib/queryKeys.js';
import { enrichSingleBlock } from '../lib/storage.js';

export function useBlocks() {
  return useQuery({
    queryKey: blocksKey,
    queryFn: () => {
      const store = getStore();
      return store.blocks.map(b => enrichSingleBlock(b, store.activities));
    },
    refetchInterval: 1000
  });
}
