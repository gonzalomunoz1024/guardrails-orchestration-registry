/**
 * Stats Hook
 *
 * React Query hook for fetching registry statistics from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';
import type { TimeRange, RegistryStats } from '@/types/registry.types';

// Query keys for cache management
export const statsKeys = {
  all: ['stats'] as const,
  byTimeRange: (timeRange: TimeRange) => [...statsKeys.all, timeRange] as const,
};

/**
 * Fetch registry statistics for a given time range
 */
export function useStats(timeRange: TimeRange = '24h') {
  return useQuery<RegistryStats>({
    queryKey: statsKeys.byTimeRange(timeRange),
    queryFn: () => guardrailsApi.getStats(timeRange),
    staleTime: 60 * 1000, // 1 minute - stats should refresh more frequently
    retry: 2,
  });
}
