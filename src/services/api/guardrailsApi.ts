/**
 * Guardrails API Service
 *
 * Handles communication with the Guardrails Orchestrator Service backend.
 * Maps backend guardrail/configuration endpoints to frontend policy operations.
 */

import { apiClient } from './client';
import type {
  GuardrailDefinition,
  GuardrailConfiguration,
  ConfigurationListItem,
  EvaluationRecord,
  PaginatedResponse,
  GuardrailRef,
} from '@/types/guardrail.types';
import type {
  RegistryPolicy,
  RegistryStats,
  TimeRange,
  TestInputFilters,
  TestInputsResponse,
  TestInputsRawResponse,
  TestInput,
  TestInputSource,
} from '@/types/registry.types';
import { mapGuardrailToPolicy } from '@/utils/guardrailMapper';

// Base paths for the backend API — all endpoints live under /v1/utilities
const GUARDRAILS_PATH = '/v1/utilities/registry/guardrails';
const CONFIGURATIONS_PATH = '/v1/utilities/registry/configurations';
const EVALUATIONS_PATH = '/v1/utilities/evaluations';
const STATS_PATH = '/v1/utilities/registry/stats';
const TEST_INPUTS_PATH = '/v1/utilities/registry/test-inputs';

/**
 * Error class for API errors with additional context
 */
export class GuardrailsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public endpoint?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'GuardrailsApiError';
  }
}

/**
 * Guardrails API Service
 */
export const guardrailsApi = {
  // ============================================
  // GUARDRAIL DEFINITION ENDPOINTS
  // ============================================

  /**
   * List all guardrail definitions
   */
  listGuardrails: async (): Promise<GuardrailDefinition[]> => {
    try {
      const response = await apiClient.get<GuardrailDefinition[]>(GUARDRAILS_PATH);
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list guardrails:', error);
      throw new GuardrailsApiError(
        'Failed to fetch guardrails list',
        (error as { response?: { status?: number } })?.response?.status,
        GUARDRAILS_PATH,
        error
      );
    }
  },

  /**
   * Get a single guardrail definition by ID
   */
  getGuardrail: async (id: string): Promise<GuardrailDefinition> => {
    try {
      const response = await apiClient.get<GuardrailDefinition>(`${GUARDRAILS_PATH}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get guardrail ${id}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch guardrail with ID: ${id}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${GUARDRAILS_PATH}/${id}`,
        error
      );
    }
  },

  /**
   * List all immutable versions of a guardrail (newest first per the backend).
   * GET /v1/utilities/registry/guardrails/{id}/versions
   */
  getGuardrailVersions: async (id: string): Promise<GuardrailRef[]> => {
    try {
      const response = await apiClient.get<GuardrailRef[]>(`${GUARDRAILS_PATH}/${id}/versions`);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to list versions for guardrail ${id}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch versions for guardrail: ${id}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${GUARDRAILS_PATH}/${id}/versions`,
        error
      );
    }
  },

  /**
   * Get a single immutable version of a guardrail.
   * GET /v1/utilities/registry/guardrails/{id}/versions/{version}
   */
  getGuardrailVersion: async (id: string, version: string): Promise<GuardrailDefinition> => {
    try {
      const response = await apiClient.get<GuardrailDefinition>(
        `${GUARDRAILS_PATH}/${id}/versions/${version}`
      );
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get guardrail ${id}@${version}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch guardrail ${id}@${version}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${GUARDRAILS_PATH}/${id}/versions/${version}`,
        error
      );
    }
  },

  /**
   * Get the published input contract for a guardrail version.
   * GET /v1/utilities/registry/guardrails/{id}/versions/{version}/input-schema
   */
  getInputSchema: async (
    id: string,
    version: string
  ): Promise<{ schema: Record<string, unknown> | null; examples: { name: string; payload: string }[] }> => {
    const path = `${GUARDRAILS_PATH}/${id}/versions/${version}/input-schema`;
    try {
      const response = await apiClient.get<{
        schema: Record<string, unknown> | null;
        examples?: { name: string; payload: string }[];
      }>(path);
      return { schema: response.data.schema ?? null, examples: response.data.examples ?? [] };
    } catch (error) {
      // No published contract yet is not fatal — adopters just see "none".
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return { schema: null, examples: [] };
      }
      console.error(`[guardrailsApi] Failed to get input schema for ${id}@${version}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch input schema for ${id}@${version}`,
        (error as { response?: { status?: number } })?.response?.status,
        path,
        error
      );
    }
  },

  // ============================================
  // CONFIGURATION ENDPOINTS
  // ============================================

  /**
   * List all configurations
   */
  listConfigurations: async (): Promise<ConfigurationListItem[]> => {
    try {
      const response = await apiClient.get<ConfigurationListItem[]>(CONFIGURATIONS_PATH);
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list configurations:', error);
      throw new GuardrailsApiError(
        'Failed to fetch configurations list',
        (error as { response?: { status?: number } })?.response?.status,
        CONFIGURATIONS_PATH,
        error
      );
    }
  },

  /**
   * Get configuration for a specific guardrail
   */
  getConfiguration: async (guardrailId: string): Promise<GuardrailConfiguration | null> => {
    try {
      const response = await apiClient.get<GuardrailConfiguration>(
        `${CONFIGURATIONS_PATH}/${guardrailId}`
      );
      return response.data;
    } catch (error) {
      // 404 is expected if no configuration exists yet
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return null;
      }
      console.error(`[guardrailsApi] Failed to get configuration for ${guardrailId}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch configuration for guardrail: ${guardrailId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${CONFIGURATIONS_PATH}/${guardrailId}`,
        error
      );
    }
  },

  // ============================================
  // EVALUATION ENDPOINTS
  // ============================================

  /**
   * Get all evaluations (paginated)
   */
  listEvaluations: async (
    page = 0,
    size = 20
  ): Promise<PaginatedResponse<EvaluationRecord>> => {
    try {
      const response = await apiClient.get<PaginatedResponse<EvaluationRecord>>(
        `${EVALUATIONS_PATH}/all`,
        { params: { page, size } }
      );
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list evaluations:', error);
      throw new GuardrailsApiError(
        'Failed to fetch evaluations list',
        (error as { response?: { status?: number } })?.response?.status,
        `${EVALUATIONS_PATH}/all`,
        error
      );
    }
  },

  /**
   * Get a single evaluation by event ID
   */
  getEvaluation: async (eventId: string): Promise<EvaluationRecord> => {
    try {
      const response = await apiClient.get<EvaluationRecord>(`${EVALUATIONS_PATH}/${eventId}`);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluation ${eventId}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch evaluation with ID: ${eventId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${EVALUATIONS_PATH}/${eventId}`,
        error
      );
    }
  },

  /**
   * Get evaluations by correlation ID
   */
  getEvaluationsByCorrelationId: async (correlationId: string): Promise<EvaluationRecord[]> => {
    try {
      const response = await apiClient.get<EvaluationRecord[]>(EVALUATIONS_PATH, {
        params: { correlationId },
      });
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluations for correlation ${correlationId}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch evaluations for correlation: ${correlationId}`,
        (error as { response?: { status?: number } })?.response?.status,
        EVALUATIONS_PATH,
        error
      );
    }
  },

  /**
   * Get evaluation history for an application
   */
  getEvaluationsByAppId: async (appId: string): Promise<EvaluationRecord[]> => {
    try {
      const response = await apiClient.get<EvaluationRecord[]>(`${EVALUATIONS_PATH}/app/${appId}`);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluations for app ${appId}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch evaluations for app: ${appId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${EVALUATIONS_PATH}/app/${appId}`,
        error
      );
    }
  },

  // ============================================
  // STATS ENDPOINTS
  // ============================================

  /**
   * Get registry statistics for a given time range
   */
  getStats: async (timeRange: TimeRange = '24h'): Promise<RegistryStats> => {
    try {
      const response = await apiClient.get<RegistryStats>(STATS_PATH, {
        params: { timeRange },
      });
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get stats for timeRange ${timeRange}:`, error);
      throw new GuardrailsApiError(
        `Failed to fetch registry stats`,
        (error as { response?: { status?: number } })?.response?.status,
        STATS_PATH,
        error
      );
    }
  },

  // ============================================
  // TEST INPUTS ENDPOINTS (OpenSearch Scroll)
  // ============================================

  /**
   * Map a raw OpenSearch source to a normalized TestInput
   * Handles nested structure: _source.spec.metadata contains appId, organization, etc.
   */
  _mapSourceToTestInput: (item: TestInputSource, index: number): TestInput => {
    // Backend may return 'source' or '_source' field
    const source = item.source || item._source;

    // The structure is: _source.spec.metadata.{appId, organization, ...}
    const spec = (source?.spec as Record<string, unknown>) || {};
    const specMetadata = (spec.metadata as Record<string, unknown>) || {};
    const topMetadata = (source?.metadata as Record<string, unknown>) || {};

    // Extract fields from spec.metadata (primary) or fallback to top-level
    const appId =
      (specMetadata.appId as string) ||
      (specMetadata.applicationId as string) ||
      (source?.appId as string) ||
      undefined;
    const org =
      (specMetadata.organization as string) ||
      (source?.organization as string) ||
      undefined;
    const env =
      (specMetadata.environment as string) ||
      (source?.environment as string) ||
      undefined;
    const resType =
      (specMetadata.resourceType as string) ||
      (source?.resourceType as string) ||
      undefined;
    const resKind =
      (source?.kind as string) ||
      (specMetadata.resourceKind as string) ||
      undefined;

    // Generate an ID from item.id, metadata, or use index
    const id =
      item.id ||
      (topMetadata.eventId as string) ||
      (topMetadata.correlationId as string) ||
      `test-input-${index}`;

    // Generate a name from available fields
    const name =
      (specMetadata.name as string) ||
      (source?.name as string) ||
      (topMetadata.eventId as string) ||
      `Test Input ${id.slice(0, 12)}`;

    // Description from source or generate one
    const guardrailId = specMetadata.guardrailId || source?.guardrailId;
    const description =
      (source?.description as string) ||
      (guardrailId ? `Evaluation for guardrail: ${guardrailId}` : undefined);

    // The actual input to use for policy testing - use the entire _source as the input
    // This allows the full evaluation context to be used when testing policies
    const input = source || {};

    return {
      id,
      name,
      description,
      applicationId: appId,
      organization: org,
      environment: env,
      resourceType: resType,
      resourceKind: resKind,
      input,
      metadata: topMetadata,
    };
  },

  /**
   * Fetch test inputs for policy testing (scope-based)
   * Uses OpenSearch scroll API for pagination
   *
   * @param filters - Optional filters for applicationId, organization, environment, etc.
   * @param scrollId - Scroll ID from previous request for pagination (omit for initial request)
   * @param limit - Number of results per batch (default: 50)
   */
  getTestInputs: async (
    filters?: TestInputFilters,
    scrollId?: string,
    limit: number = 50
  ): Promise<TestInputsResponse> => {
    try {
      const params: Record<string, string | number> = { limit };

      // If scrollId is provided, only pass scrollId (filters are in scroll context)
      if (scrollId) {
        params.scrollId = scrollId;
      } else {
        // Initial request - include filters
        if (filters?.applicationId) params.applicationId = filters.applicationId;
        if (filters?.organization) params.organization = filters.organization;
        if (filters?.environment) params.environment = filters.environment;
        if (filters?.resourceType) params.resourceType = filters.resourceType;
        if (filters?.resourceKind) params.resourceKind = filters.resourceKind;
      }

      const response = await apiClient.get<TestInputsRawResponse>(TEST_INPUTS_PATH, { params });
      const rawResponse = response.data;

      // Map raw OpenSearch response to normalized format
      // Backend may return either 'hits' or 'sources' array
      const sources = rawResponse.hits || rawResponse.sources || [];
      const testInputs = sources.map((item, index) => guardrailsApi._mapSourceToTestInput(item, index));

      // Determine if there are more results to fetch
      // If we received fewer sources than the limit, we've reached the end
      const hasMore = sources.length >= limit && rawResponse.scrollId !== null;

      return {
        scrollId: rawResponse.scrollId,
        total: rawResponse.total,
        hasMore,
        testInputs,
      };
    } catch (error) {
      console.error('[guardrailsApi] Failed to fetch test inputs:', error);
      throw new GuardrailsApiError(
        'Failed to fetch test inputs',
        (error as { response?: { status?: number } })?.response?.status,
        TEST_INPUTS_PATH,
        error
      );
    }
  },

  // ============================================
  // COMPOSED OPERATIONS (Frontend-friendly)
  // ============================================

  /**
   * Get all policies (guardrails with their configurations)
   * Maps backend data to frontend RegistryPolicy model
   */
  listPolicies: async (): Promise<RegistryPolicy[]> => {
    // Fetch guardrails and configurations in parallel
    const [guardrails, configurations] = await Promise.all([
      guardrailsApi.listGuardrails(),
      guardrailsApi.listConfigurations(),
    ]);

    // Create a map of configurations by guardrailId
    const configMap = new Map<string, GuardrailConfiguration>();
    configurations.forEach((config) => {
      configMap.set(config.guardrailId, config as GuardrailConfiguration);
    });

    // Map guardrails to policies with their configurations
    return guardrails.map((guardrail) =>
      mapGuardrailToPolicy(guardrail, configMap.get(guardrail.guardrailId) || null)
    );
  },

  /**
   * Get a single policy by ID (guardrail + configuration)
   * Maps backend data to frontend RegistryPolicy model
   */
  getPolicy: async (id: string): Promise<RegistryPolicy> => {
    // Fetch guardrail and configuration in parallel
    const [guardrail, config] = await Promise.all([
      guardrailsApi.getGuardrail(id),
      guardrailsApi.getConfiguration(id),
    ]);

    return mapGuardrailToPolicy(guardrail, config);
  },

};
