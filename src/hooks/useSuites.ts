/**
 * Suites Hooks
 *
 * React Query hooks for fetching and managing guardrail suites, plus member
 * resolution (pinned versions + their input contracts).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { suitesApi } from '@/services/api/suitesApi';
import { guardrailsApi } from '@/services/api/guardrailsApi';
import type { CreateSuiteRequest, UpdateSuiteRequest } from '@/types/suite.types';
import type { GuardrailRef } from '@/types/guardrail.types';

export const suiteKeys = {
  all: ['suites'] as const,
  lists: () => [...suiteKeys.all, 'list'] as const,
  details: () => [...suiteKeys.all, 'detail'] as const,
  detail: (id: string) => [...suiteKeys.details(), id] as const,
  members: (refs: GuardrailRef[]) => [...suiteKeys.all, 'members', refs] as const,
  contract: (ref: GuardrailRef) => [...suiteKeys.all, 'contract', ref] as const,
  versions: (guardrailId: string) => ['guardrail-versions', guardrailId] as const,
};

export function useSuites() {
  return useQuery({
    queryKey: suiteKeys.lists(),
    queryFn: () => suitesApi.listSuites(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useSuite(id: string | null) {
  return useQuery({
    queryKey: suiteKeys.detail(id || ''),
    queryFn: () => suitesApi.getSuite(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/** Resolve a set of pinned refs to full member facets for display. */
export function useResolvedMembers(refs: GuardrailRef[]) {
  return useQuery({
    queryKey: suiteKeys.members(refs),
    queryFn: () => suitesApi.resolveSuiteMembers(refs),
    enabled: refs.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Fetch the published input contract for one pinned member. */
export function useMemberContract(ref: GuardrailRef | null) {
  return useQuery({
    queryKey: suiteKeys.contract(ref || { guardrailId: '', version: '' }),
    queryFn: () => suitesApi.resolveMemberContract(ref!),
    enabled: !!ref?.guardrailId && !!ref?.version,
    staleTime: 5 * 60 * 1000,
  });
}

/** All immutable versions for a guardrail (used when pinning in the builder). */
export function useGuardrailVersions(guardrailId: string | null) {
  return useQuery({
    queryKey: suiteKeys.versions(guardrailId || ''),
    queryFn: () => guardrailsApi.getGuardrailVersions(guardrailId!),
    enabled: !!guardrailId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateSuiteRequest) => suitesApi.createSuite(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suiteKeys.lists() }),
  });
}

export function useUpdateSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, request }: { suiteId: string; request: UpdateSuiteRequest }) =>
      suitesApi.updateSuite(suiteId, request),
    onSuccess: (_, { suiteId }) => {
      queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) });
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });
    },
  });
}

export function useDeleteSuite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) => suitesApi.deleteSuite(suiteId),
    onSuccess: (_, suiteId) => {
      queryClient.removeQueries({ queryKey: suiteKeys.detail(suiteId) });
      queryClient.invalidateQueries({ queryKey: suiteKeys.lists() });
    },
  });
}
