/**
 * Evaluations Hooks
 *
 * React Query hooks for fetching evaluation records from the backend.
 */

import { useQuery } from '@tanstack/react-query';
import { guardrailsApi } from '@/services/api';

// Query keys for cache management
export const evaluationKeys = {
  all: ['evaluations'] as const,
  lists: () => [...evaluationKeys.all, 'list'] as const,
  list: (page: number, size: number) => [...evaluationKeys.lists(), { page, size }] as const,
  details: () => [...evaluationKeys.all, 'detail'] as const,
  detail: (eventId: string) => [...evaluationKeys.details(), eventId] as const,
  byCorrelation: (correlationId: string) =>
    [...evaluationKeys.all, 'correlation', correlationId] as const,
  byApp: (appId: string) => [...evaluationKeys.all, 'app', appId] as const,
};

/**
 * Fetch paginated evaluations
 */
export function useEvaluations(page = 0, size = 20) {
  return useQuery({
    queryKey: evaluationKeys.list(page, size),
    queryFn: () => guardrailsApi.listEvaluations(page, size),
    staleTime: 1 * 60 * 1000, // 1 minute - evaluations change frequently
    retry: 2,
  });
}

/**
 * Fetch a single evaluation by event ID
 */
export function useEvaluation(eventId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.detail(eventId || ''),
    queryFn: () => guardrailsApi.getEvaluation(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch evaluations by correlation ID
 */
export function useEvaluationsByCorrelation(correlationId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.byCorrelation(correlationId || ''),
    queryFn: () => guardrailsApi.getEvaluationsByCorrelationId(correlationId!),
    enabled: !!correlationId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch evaluation history for an application
 */
export function useEvaluationsByApp(appId: string | null) {
  return useQuery({
    queryKey: evaluationKeys.byApp(appId || ''),
    queryFn: () => guardrailsApi.getEvaluationsByAppId(appId!),
    enabled: !!appId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
