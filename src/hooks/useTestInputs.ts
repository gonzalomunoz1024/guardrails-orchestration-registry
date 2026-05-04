/**
 * Test Inputs Hook
 *
 * React Query hook for fetching test inputs from the backend using OpenSearch scroll pagination.
 * Supports infinite scrolling / "Load More" pattern.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';
import type { TestInputFilters, TestInputsResponse, TestInput } from '@/types/registry.types';

// Query keys for cache management
export const testInputsKeys = {
  all: ['testInputs'] as const,
  list: (filters?: TestInputFilters) => [...testInputsKeys.all, 'list', filters] as const,
};

interface UseTestInputsOptions {
  filters?: TestInputFilters;
  limit?: number;
  enabled?: boolean;
}

interface UseTestInputsResult {
  /** All test inputs loaded so far (flattened from all pages) */
  testInputs: TestInput[];
  /** Total number of hits from OpenSearch */
  totalHits: number;
  /** Whether more results are available */
  hasMore: boolean;
  /** Available filter options from the initial response */
  availableFilters?: TestInputsResponse['filters'];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Loading state for fetching next page */
  isFetchingNextPage: boolean;
  /** Error state */
  error: Error | null;
  /** Fetch the next page of results */
  fetchNextPage: () => void;
  /** Refetch from the beginning with current filters */
  refetch: () => void;
}

/**
 * Fetch test inputs with OpenSearch scroll-based pagination
 *
 * @example
 * ```tsx
 * const { testInputs, hasMore, fetchNextPage, isLoading } = useTestInputs({
 *   filters: { applicationId: 'app-123', environment: 'production' },
 *   limit: 50,
 * });
 *
 * // Render list with "Load More" button
 * return (
 *   <>
 *     {testInputs.map(input => <TestInputCard key={input.id} input={input} />)}
 *     {hasMore && <button onClick={fetchNextPage}>Load More</button>}
 *   </>
 * );
 * ```
 */
export function useTestInputs(options: UseTestInputsOptions = {}): UseTestInputsResult {
  const { filters, limit = 50, enabled = true } = options;

  const query = useInfiniteQuery({
    queryKey: testInputsKeys.list(filters),
    queryFn: async ({ pageParam }) => {
      // pageParam is the scrollId from previous page, undefined for first page
      return guardrailsApi.getTestInputs(filters, pageParam as string | undefined, limit);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // Return scrollId if there are more results, otherwise undefined to stop pagination
      return lastPage.hasMore ? lastPage.scrollId : undefined;
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
  });

  // Flatten all pages into a single array of test inputs
  const testInputs = query.data?.pages.flatMap((page) => page.content) ?? [];

  // Get metadata from first page
  const firstPage = query.data?.pages[0];
  const totalHits = firstPage?.totalHits ?? 0;
  const availableFilters = firstPage?.filters;

  // Check if there are more results to load
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const hasMore = lastPage?.hasMore ?? false;

  return {
    testInputs,
    totalHits,
    hasMore,
    availableFilters,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    fetchNextPage: () => query.fetchNextPage(),
    refetch: () => query.refetch(),
  };
}
