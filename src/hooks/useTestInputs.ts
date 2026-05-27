import { useInfiniteQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';
import { guardrailConfig } from '@/config/guardrailConfig';
import type { TestInputFilters, TestInput } from '@/types/registry.types';

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
  testInputs: TestInput[];
  totalHits: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  refetch: () => void;
  isDisabled: boolean;
  disabledMessage?: string;
}

export function useTestInputs(options: UseTestInputsOptions = {}): UseTestInputsResult {
  const { filters, limit = 50, enabled = true } = options;

  const testInputsEnabled = guardrailConfig.testInputs.enabled;

  const query = useInfiniteQuery({
    queryKey: testInputsKeys.list(filters),
    queryFn: async ({ pageParam }) => {
      return guardrailsApi.getTestInputs(filters, pageParam as string | undefined, limit);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.scrollId : undefined;
    },
    enabled: enabled && testInputsEnabled,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  if (!testInputsEnabled) {
    return {
      testInputs: [],
      totalHits: 0,
      hasMore: false,
      isLoading: false,
      isFetchingNextPage: false,
      error: null,
      fetchNextPage: () => {},
      refetch: () => {},
      isDisabled: true,
      disabledMessage: guardrailConfig.testInputs.disabledMessage,
    };
  }

  const testInputs = query.data?.pages.flatMap((page) => page.testInputs) ?? [];
  const firstPage = query.data?.pages[0];
  const totalHits = firstPage?.total ?? 0;
  const lastPage = query.data?.pages[query.data.pages.length - 1];
  const hasMore = lastPage?.hasMore ?? false;

  return {
    testInputs,
    totalHits,
    hasMore,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    fetchNextPage: () => query.fetchNextPage(),
    refetch: () => query.refetch(),
    isDisabled: false,
    disabledMessage: undefined,
  };
}
