/**
 * vendor/reactQuery.js — Re-export React Query from node_modules
 * 
 * Replaces mangled exports: $w (QueryClient), kf (Provider), Af (DevTools), Es (useQueryClient)
 */
export { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
