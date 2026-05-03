/**
 * Policies Hooks
 *
 * React Query hooks for fetching and managing policies from the backend.
 * Uses guardrailsApi service which maps backend guardrails to frontend policies.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { guardrailsApi, GuardrailsApiError } from '@/services/api';
import type { RegistryPolicy } from '@/types/registry.types';

// Query keys for cache management
export const policyKeys = {
  all: ['policies'] as const,
  lists: () => [...policyKeys.all, 'list'] as const,
  list: (filters?: { status?: string; category?: string }) =>
    [...policyKeys.lists(), filters] as const,
  details: () => [...policyKeys.all, 'detail'] as const,
  detail: (id: string) => [...policyKeys.details(), id] as const,
};

/**
 * Fetch all policies
 */
export function usePolicies() {
  return useQuery({
    queryKey: policyKeys.lists(),
    queryFn: () => guardrailsApi.listPolicies(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Fetch a single policy by ID
 */
export function usePolicy(id: string | null) {
  return useQuery({
    queryKey: policyKeys.detail(id || ''),
    queryFn: () => guardrailsApi.getPolicy(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Create a new policy
 */
export function useCreatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      policy,
      additionalFields,
    }: {
      policy: Partial<RegistryPolicy>;
      additionalFields?: {
        enforcementType?: 'MANDATORY' | 'OPTIONAL';
        kind?: 'PRECHECK' | 'POSTCHECK';
        resourceType?: string;
        resourceKind?: string;
      };
    }) => {
      return guardrailsApi.savePolicy(policy, true, additionalFields);
    },
    onSuccess: () => {
      // Invalidate the policies list to refetch
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
    onError: (error: GuardrailsApiError) => {
      console.error('[useCreatePolicy] Create failed:', error.message);
    },
  });
}

/**
 * Update an existing policy
 */
export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      policy,
      additionalFields,
    }: {
      policy: Partial<RegistryPolicy> & { id: string };
      additionalFields?: {
        enforcementType?: 'MANDATORY' | 'OPTIONAL';
        kind?: 'PRECHECK' | 'POSTCHECK';
        resourceType?: string;
        resourceKind?: string;
      };
    }) => {
      return guardrailsApi.savePolicy(policy, false, additionalFields);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific policy and the list
      queryClient.invalidateQueries({ queryKey: policyKeys.detail(variables.policy.id) });
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
    onError: (error: GuardrailsApiError) => {
      console.error('[useUpdatePolicy] Update failed:', error.message);
    },
  });
}

/**
 * Delete a policy
 */
export function useDeletePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => guardrailsApi.deletePolicy(id),
    onSuccess: (_, id) => {
      // Remove from cache and invalidate list
      queryClient.removeQueries({ queryKey: policyKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: policyKeys.lists() });
    },
    onError: (error: GuardrailsApiError) => {
      console.error('[useDeletePolicy] Delete failed:', error.message);
    },
  });
}

/**
 * Save policy hook - handles both create and update
 */
export function useSavePolicy() {
  const createMutation = useCreatePolicy();
  const updateMutation = useUpdatePolicy();

  return {
    savePolicy: async (
      policy: Partial<RegistryPolicy>,
      isNew: boolean,
      additionalFields?: {
        enforcementType?: 'MANDATORY' | 'OPTIONAL';
        kind?: 'PRECHECK' | 'POSTCHECK';
        resourceType?: string;
        resourceKind?: string;
      }
    ) => {
      if (isNew) {
        return createMutation.mutateAsync({ policy, additionalFields });
      } else {
        if (!policy.id) {
          throw new Error('Policy ID is required for update');
        }
        return updateMutation.mutateAsync({
          policy: policy as Partial<RegistryPolicy> & { id: string },
          additionalFields,
        });
      }
    },
    isLoading: createMutation.isPending || updateMutation.isPending,
    error: createMutation.error || updateMutation.error,
    reset: () => {
      createMutation.reset();
      updateMutation.reset();
    },
  };
}
