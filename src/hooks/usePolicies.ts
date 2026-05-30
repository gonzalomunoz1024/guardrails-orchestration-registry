/**
 * Policies Hooks
 *
 * React Query hooks for fetching policies from the backend.
 * Uses guardrailsApi service which maps backend guardrails to frontend policies.
 *
 * Writes/deletes are not exposed here — publish goes through the GitHub PR flow
 * in SubmitPolicyModal; the legacy registry write endpoints have been removed.
 */

import { useQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';

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
