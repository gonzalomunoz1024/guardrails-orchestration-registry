import { useInfiniteQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';
import { getResourceTypeConfig } from '@/config/resourceTypes';
import type { TestInputFilters, TestInput, FrontendResourceType } from '@/types/registry.types';

export const testInputsKeys = {
  all: ['testInputs'] as const,
  list: (filters?: TestInputFilters, resourceType?: FrontendResourceType) =>
    [...testInputsKeys.all, 'list', filters, resourceType] as const,
};

interface UseTestInputsOptions {
  filters?: TestInputFilters;
  limit?: number;
  enabled?: boolean;
  resourceType?: FrontendResourceType;
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
  const { filters, limit = 50, enabled = true, resourceType = 'lightspeed' } = options;

  const resourceTypeConfig = getResourceTypeConfig(resourceType);
  const isResourceTypeEnabled = resourceTypeConfig.testInputs.enabled;

  const query = useInfiniteQuery({
    queryKey: testInputsKeys.list(filters, resourceType),
    queryFn: async ({ pageParam }) => {
      return guardrailsApi.getTestInputs(filters, pageParam as string | undefined, limit);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.scrollId : undefined;
    },
    enabled: enabled && isResourceTypeEnabled,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  if (!isResourceTypeEnabled) {
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
      disabledMessage: resourceTypeConfig.testInputs.disabledMessage,
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
