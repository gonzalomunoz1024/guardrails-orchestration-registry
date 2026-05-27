/**
 * Suites API Service
 *
 * CRUD for guardrail suites plus member resolution. A suite pins immutable
 * (guardrailId, version) members; resolving a suite fetches each pinned version
 * and its published input contract so adopters know what each member expects.
 */

import { apiClient } from './client';
import { guardrailsApi, GuardrailsApiError } from './guardrailsApi';
import type {
  GuardrailSuite,
  CreateSuiteRequest,
  UpdateSuiteRequest,
  SuiteMember,
  ResolvedMemberContract,
} from '@/types/suite.types';
import type { GuardrailRef } from '@/types/guardrail.types';

const SUITES_PATH = '/v1/registry/suites';

export const suitesApi = {
  listSuites: async (): Promise<GuardrailSuite[]> => {
    try {
      const response = await apiClient.get<GuardrailSuite[]>(SUITES_PATH);
      return response.data;
    } catch (error) {
      console.error('[suitesApi] Failed to list suites:', error);
      throw new GuardrailsApiError(
        'Failed to fetch suites list',
        (error as { response?: { status?: number } })?.response?.status,
        SUITES_PATH,
        error
      );
    }
  },

  getSuite: async (suiteId: string): Promise<GuardrailSuite> => {
    try {
      const response = await apiClient.get<GuardrailSuite>(`${SUITES_PATH}/${suiteId}`);
      return response.data;
    } catch (error) {
      console.error(`[suitesApi] Failed to get suite ${suiteId}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch suite: ${suiteId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${SUITES_PATH}/${suiteId}`,
        error
      );
    }
  },

  createSuite: async (request: CreateSuiteRequest): Promise<GuardrailSuite> => {
    try {
      const response = await apiClient.post<GuardrailSuite>(SUITES_PATH, request);
      return response.data;
    } catch (error) {
      console.error('[suitesApi] Failed to create suite:', error);
      throw new GuardrailsApiError(
        'Failed to create suite',
        (error as { response?: { status?: number } })?.response?.status,
        SUITES_PATH,
        error
      );
    }
  },

  updateSuite: async (suiteId: string, request: UpdateSuiteRequest): Promise<GuardrailSuite> => {
    try {
      const response = await apiClient.put<GuardrailSuite>(`${SUITES_PATH}/${suiteId}`, request);
      return response.data;
    } catch (error) {
      console.error(`[suitesApi] Failed to update suite ${suiteId}:`, error);
      throw new GuardrailsApiError(
        `Failed to update suite: ${suiteId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${SUITES_PATH}/${suiteId}`,
        error
      );
    }
  },

  deleteSuite: async (suiteId: string): Promise<void> => {
    try {
      await apiClient.delete(`${SUITES_PATH}/${suiteId}`);
    } catch (error) {
      console.error(`[suitesApi] Failed to delete suite ${suiteId}:`, error);
      throw new GuardrailsApiError(
        `Failed to delete suite: ${suiteId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${SUITES_PATH}/${suiteId}`,
        error
      );
    }
  },

  /**
   * Resolve a set of pinned members to full display facets by fetching each
   * (guardrailId, version). Missing versions are returned with just the ref so
   * the UI can flag a dangling pin rather than failing the whole resolve.
   */
  resolveSuiteMembers: async (refs: GuardrailRef[]): Promise<SuiteMember[]> => {
    return Promise.all(
      refs.map(async (ref): Promise<SuiteMember> => {
        try {
          const g = await guardrailsApi.getGuardrailVersion(ref.guardrailId, ref.version);
          return {
            guardrailId: ref.guardrailId,
            version: ref.version,
            guardrailName: g.guardrailName,
            description: g.description,
            stage: g.stage,
            enforcementType: g.enforcementType,
            resourceKind: g.resourceKind,
            status: g.status,
          };
        } catch {
          return { guardrailId: ref.guardrailId, version: ref.version };
        }
      })
    );
  },

  /** Fetch the published input contract for a single pinned member. */
  resolveMemberContract: async (ref: GuardrailRef): Promise<ResolvedMemberContract> => {
    const { schema, examples } = await guardrailsApi.getInputSchema(ref.guardrailId, ref.version);
    return { guardrailId: ref.guardrailId, version: ref.version, schema, examples };
  },
};
