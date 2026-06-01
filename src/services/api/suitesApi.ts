/**
 * Suites API Service
 *
 * CRUD for guardrail suites plus member resolution. Wire shape mirrors
 * REGISTRY_API.md §6 — POST upserts on `suiteId` (body carries the id),
 * PUT applies a partial update, suite payloads use `displayName`.
 *
 * Member resolution pulls the flat metadata projection per pinned
 * (guardrailId, version) — cheaper than fetching the full manifest body, and
 * gives us everything the UI displays (displayName, stage, enforcement, etc).
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

const SUITES_PATH = '/v1/utilities/registry/suites';

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status;
}

export const suitesApi = {
  listSuites: async (): Promise<GuardrailSuite[]> => {
    try {
      const response = await apiClient.get<GuardrailSuite[]>(SUITES_PATH);
      return response.data;
    } catch (error) {
      console.error('[suitesApi] Failed to list suites:', error);
      throw new GuardrailsApiError('Failed to fetch suites', statusOf(error), SUITES_PATH, error);
    }
  },

  getSuite: async (suiteId: string): Promise<GuardrailSuite> => {
    const path = `${SUITES_PATH}/${suiteId}`;
    try {
      const response = await apiClient.get<GuardrailSuite>(path);
      return response.data;
    } catch (error) {
      console.error(`[suitesApi] Failed to get suite ${suiteId}:`, error);
      throw new GuardrailsApiError(`Failed to fetch suite ${suiteId}`, statusOf(error), path, error);
    }
  },

  /** POST upserts on `suiteId`; the body carries the id. Returns the persisted record. */
  createSuite: async (request: CreateSuiteRequest): Promise<GuardrailSuite> => {
    try {
      const response = await apiClient.post<GuardrailSuite>(SUITES_PATH, request);
      return response.data;
    } catch (error) {
      console.error('[suitesApi] Failed to create suite:', error);
      throw new GuardrailsApiError('Failed to create suite', statusOf(error), SUITES_PATH, error);
    }
  },

  /** PUT applies a partial update — omitted fields keep their existing value. */
  updateSuite: async (suiteId: string, request: UpdateSuiteRequest): Promise<GuardrailSuite> => {
    const path = `${SUITES_PATH}/${suiteId}`;
    try {
      const response = await apiClient.put<GuardrailSuite>(path, request);
      return response.data;
    } catch (error) {
      console.error(`[suitesApi] Failed to update suite ${suiteId}:`, error);
      throw new GuardrailsApiError(`Failed to update suite ${suiteId}`, statusOf(error), path, error);
    }
  },

  deleteSuite: async (suiteId: string): Promise<void> => {
    const path = `${SUITES_PATH}/${suiteId}`;
    try {
      await apiClient.delete(path);
    } catch (error) {
      console.error(`[suitesApi] Failed to delete suite ${suiteId}:`, error);
      throw new GuardrailsApiError(`Failed to delete suite ${suiteId}`, statusOf(error), path, error);
    }
  },

  /**
   * Resolve a set of pinned members to display facets via the metadata
   * projection endpoint. Per-member fields the registry persists but the
   * projection doesn't carry (e.g. `exclusions`) are passed through from the
   * input so they survive the round-trip. Missing versions are returned with
   * just the ref + passthrough so the UI can surface a dangling pin rather
   * than failing the whole resolve.
   */
  resolveSuiteMembers: async (members: SuiteMember[]): Promise<SuiteMember[]> => {
    return Promise.all(
      members.map(async (input): Promise<SuiteMember> => {
        try {
          const m = await guardrailsApi.getMetadata(input.guardrailId, input.version);
          return {
            guardrailId: input.guardrailId,
            version: input.version,
            displayName: m.displayName ?? m.name,
            description: m.description,
            stage: m.stage,
            enforcement: m.enforcement,
            resourceKind: m.resourceKind,
            status: m.status,
            exclusions: input.exclusions,
          };
        } catch {
          return {
            guardrailId: input.guardrailId,
            version: input.version,
            exclusions: input.exclusions,
          };
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
