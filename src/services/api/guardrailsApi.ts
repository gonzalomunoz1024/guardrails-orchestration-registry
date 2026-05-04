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
  CreateGuardrailRequest,
  UpdateGuardrailRequest,
  UpsertConfigurationRequest,
  EvaluationRecord,
  PaginatedResponse,
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
import {
  mapGuardrailToPolicy,
  mapPolicyToCreateGuardrailRequest,
  mapPolicyToUpdateGuardrailRequest,
  mapPolicyConfigToUpsertRequest,
} from '@/utils/guardrailMapper';

// Base paths for the backend API
const GUARDRAILS_PATH = '/v1/registry/guardrails';
const CONFIGURATIONS_PATH = '/v1/registry/configurations';
const EVALUATIONS_PATH = '/v1/evaluations';
const STATS_PATH = '/v1/registry/stats';
const TEST_INPUTS_PATH = '/v1/registry/test-inputs';

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
   * Create a new guardrail definition
   */
  createGuardrail: async (request: CreateGuardrailRequest): Promise<GuardrailDefinition> => {
    try {
      const response = await apiClient.post<GuardrailDefinition>(GUARDRAILS_PATH, request);
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to create guardrail:', error);
      throw new GuardrailsApiError(
        'Failed to create guardrail',
        (error as { response?: { status?: number } })?.response?.status,
        GUARDRAILS_PATH,
        error
      );
    }
  },

  /**
   * Update an existing guardrail definition
   */
  updateGuardrail: async (id: string, request: UpdateGuardrailRequest): Promise<GuardrailDefinition> => {
    try {
      const response = await apiClient.put<GuardrailDefinition>(`${GUARDRAILS_PATH}/${id}`, request);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to update guardrail ${id}:`, error);
      throw new GuardrailsApiError(
        `Failed to update guardrail with ID: ${id}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${GUARDRAILS_PATH}/${id}`,
        error
      );
    }
  },

  /**
   * Delete a guardrail definition
   */
  deleteGuardrail: async (id: string): Promise<void> => {
    try {
      await apiClient.delete(`${GUARDRAILS_PATH}/${id}`);
    } catch (error) {
      console.error(`[guardrailsApi] Failed to delete guardrail ${id}:`, error);
      throw new GuardrailsApiError(
        `Failed to delete guardrail with ID: ${id}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${GUARDRAILS_PATH}/${id}`,
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

  /**
   * Create or update configuration for a guardrail (upsert)
   */
  upsertConfiguration: async (
    guardrailId: string,
    request: UpsertConfigurationRequest
  ): Promise<GuardrailConfiguration> => {
    try {
      const response = await apiClient.put<GuardrailConfiguration>(
        `${CONFIGURATIONS_PATH}/${guardrailId}`,
        request
      );
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to upsert configuration for ${guardrailId}:`, error);
      throw new GuardrailsApiError(
        `Failed to save configuration for guardrail: ${guardrailId}`,
        (error as { response?: { status?: number } })?.response?.status,
        `${CONFIGURATIONS_PATH}/${guardrailId}`,
        error
      );
    }
  },

  /**
   * Delete configuration for a guardrail
   */
  deleteConfiguration: async (guardrailId: string): Promise<void> => {
    try {
      await apiClient.delete(`${CONFIGURATIONS_PATH}/${guardrailId}`);
    } catch (error) {
      // 404 is acceptable - config might not exist
      if ((error as { response?: { status?: number } })?.response?.status === 404) {
        return;
      }
      console.error(`[guardrailsApi] Failed to delete configuration for ${guardrailId}:`, error);
      throw new GuardrailsApiError(
        `Failed to delete configuration for guardrail: ${guardrailId}`,
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
    console.log(`[mapSource ${index}] Input item:`, item);
    const source = item._source;

    if (!source) {
      console.warn(`[mapSource ${index}] No _source found in item!`);
    }

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

    // Generate an ID from metadata or use index
    const id =
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

      console.log('[getTestInputs] Params being sent:', params);

      const response = await apiClient.get<TestInputsRawResponse>(TEST_INPUTS_PATH, { params });
      const rawResponse = response.data;

      console.log('[getTestInputs] Response received:', {
        scrollId: rawResponse.scrollId,
        total: rawResponse.total,
        hitsCount: rawResponse.hits?.length ?? 0,
        sourcesCount: rawResponse.sources?.length ?? 0,
        rawKeys: Object.keys(rawResponse),
      });

      // Map raw OpenSearch response to normalized format
      // Backend may return either 'hits' or 'sources' array
      const sources = rawResponse.hits || rawResponse.sources || [];
      console.log('[getTestInputs] Sources array length:', sources.length);

      const testInputs = sources.map((item, index) => guardrailsApi._mapSourceToTestInput(item, index));
      console.log('[getTestInputs] Mapped testInputs count:', testInputs.length);

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
      mapGuardrailToPolicy(guardrail, configMap.get(guardrail.id) || null)
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

  /**
   * Save a policy (create or update guardrail + configuration)
   * This is a composed operation that handles both resources.
   *
   * @param policy - The policy data to save
   * @param isNew - Whether this is a new policy (create) or existing (update)
   * @param additionalFields - Backend-specific fields not in frontend model
   */
  savePolicy: async (
    policy: Partial<RegistryPolicy>,
    isNew: boolean,
    additionalFields?: {
      enforcementType?: 'MANDATORY' | 'OPTIONAL';
      kind?: 'PRECHECK' | 'POSTCHECK';
      resourceType?: string;
      resourceKind?: string;
    }
  ): Promise<{ guardrail: GuardrailDefinition; configuration: GuardrailConfiguration }> => {
    let savedGuardrail: GuardrailDefinition;

    // Step 1: Create or update the guardrail definition
    if (isNew) {
      const createRequest = mapPolicyToCreateGuardrailRequest(policy, additionalFields);
      savedGuardrail = await guardrailsApi.createGuardrail(createRequest);
    } else {
      if (!policy.id) {
        throw new GuardrailsApiError('Policy ID is required for update');
      }
      const updateRequest = mapPolicyToUpdateGuardrailRequest(policy);
      savedGuardrail = await guardrailsApi.updateGuardrail(policy.id, updateRequest);
    }

    // Step 2: Save the configuration
    const configRequest = mapPolicyConfigToUpsertRequest(policy.configJson || '{}');
    let savedConfiguration: GuardrailConfiguration;

    try {
      savedConfiguration = await guardrailsApi.upsertConfiguration(savedGuardrail.id, configRequest);
    } catch (configError) {
      // If configuration save fails after guardrail was created, we have partial success
      // Log the error but don't throw - return what we have
      console.error(
        `[guardrailsApi] Guardrail saved but configuration failed for ${savedGuardrail.id}:`,
        configError
      );

      // Return with empty configuration
      savedConfiguration = {
        guardrailId: savedGuardrail.id,
        global: {},
      };
    }

    return {
      guardrail: savedGuardrail,
      configuration: savedConfiguration,
    };
  },

  /**
   * Delete a policy (guardrail + configuration)
   */
  deletePolicy: async (id: string): Promise<void> => {
    // Delete configuration first (it depends on guardrail)
    // If it doesn't exist, that's fine
    await guardrailsApi.deleteConfiguration(id);

    // Then delete the guardrail
    await guardrailsApi.deleteGuardrail(id);
  },
};
