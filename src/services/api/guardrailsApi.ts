/**
 * Guardrails API Service
 *
 * Talks to the tap-guardrails-registry-service. All reads use the new
 * /v1/utilities/registry/{manifests,guardrails,configurations,rego} endpoints
 * documented in REGISTRY_API.md. Writes go through the GitHub PR flow
 * (SubmitPolicyModal), not via this service.
 *
 * Endpoint map (frontend need → wire endpoint):
 *   list policies          GET /registry/manifests
 *   list versions of one   GET /registry/manifests/{name}
 *   get one manifest       GET /registry/manifests/{name}/{version}
 *   get input schema       GET /registry/guardrails/{name}/{version}/schema
 *   get header projection  GET /registry/guardrails/{name}/{version}/metadata
 *   list configurations    GET /registry/configurations
 *   get configuration      GET /registry/configurations/{name}/{version}
 *   get rego source        GET /registry/rego/{name}/{version}/source  (text/plain)
 *   evaluations            GET /evaluations/*  (orchestrator-side, unchanged)
 *   test inputs            GET /registry/test-inputs
 *   OPA bundle             GET /registry/opa/bundle  (application/gzip)
 *
 * /registry/stats is consumed but no longer in the spec — see
 * docs/missing-endpoints.md.
 */

import { apiClient } from './client';
import type {
  GuardrailManifestDocument,
  GuardrailMetadataProjection,
  GuardrailConfigurationDocument,
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
import { mapManifestToPolicy } from '@/utils/guardrailMapper';
import { parseVersion } from '@/utils/version';

/**
 * Sort manifests newest-first by parsed MAJOR.MINOR. We can't trust the
 * backend's order in transit — some endpoints sort by createdAt, others by
 * string version (which ranks "1.10" before "1.2"). Frontend sort makes the
 * catalog and detail views consistent regardless.
 */
function sortManifestsNewestFirst<T extends { metadata: { version: string } }>(manifests: T[]): T[] {
  return [...manifests].sort((a, b) => {
    const av = parseVersion(a.metadata.version);
    const bv = parseVersion(b.metadata.version);
    if (av.major !== bv.major) return bv.major - av.major;
    return bv.minor - av.minor;
  });
}

// Base paths — all endpoints live under /v1/utilities
const MANIFESTS_PATH = '/v1/utilities/registry/manifests';
const GUARDRAILS_PATH = '/v1/utilities/registry/guardrails';
const CONFIGURATIONS_PATH = '/v1/utilities/registry/configurations';
const REGO_PATH = '/v1/utilities/registry/rego';
const OPA_BUNDLE_PATH = '/v1/utilities/registry/opa/bundle';
const EVALUATIONS_PATH = '/v1/utilities/evaluations';
const STATS_PATH = '/v1/utilities/registry/stats';
const TEST_INPUTS_PATH = '/v1/utilities/registry/test-inputs';

/** API error with status + endpoint context. */
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

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | undefined)?.response?.status;
}

export const guardrailsApi = {
  // ============================================
  // MANIFESTS — canonical guardrail records
  // ============================================

  /** GET /registry/manifests — every persisted manifest in the registry. */
  listManifests: async (): Promise<GuardrailManifestDocument[]> => {
    try {
      const response = await apiClient.get<GuardrailManifestDocument[]>(MANIFESTS_PATH);
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list manifests:', error);
      throw new GuardrailsApiError('Failed to fetch manifests', statusOf(error), MANIFESTS_PATH, error);
    }
  },

  /** GET /registry/manifests/{name} — every version of one guardrail (newest first). */
  listManifestsByName: async (name: string): Promise<GuardrailManifestDocument[]> => {
    const path = `${MANIFESTS_PATH}/${name}`;
    try {
      const response = await apiClient.get<GuardrailManifestDocument[]>(path);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to list manifests for ${name}:`, error);
      throw new GuardrailsApiError(`Failed to fetch versions for ${name}`, statusOf(error), path, error);
    }
  },

  /** GET /registry/manifests/{name}/{version} — a single pinned manifest. */
  getManifest: async (name: string, version: string): Promise<GuardrailManifestDocument> => {
    const path = `${MANIFESTS_PATH}/${name}/${version}`;
    try {
      const response = await apiClient.get<GuardrailManifestDocument>(path);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get manifest ${name}@${version}:`, error);
      throw new GuardrailsApiError(`Failed to fetch manifest ${name}@${version}`, statusOf(error), path, error);
    }
  },

  // ============================================
  // GUARDRAIL PROJECTIONS (over manifests)
  // ============================================

  /**
   * GET /registry/guardrails/{name}/{version}/schema — JSON Schema stored at
   * spec.inputSchema.content. 404 when the manifest has no embedded schema.
   */
  getInputSchema: async (
    name: string,
    version: string
  ): Promise<{ schema: Record<string, unknown> | null; examples: { name: string; payload: string }[] }> => {
    const path = `${GUARDRAILS_PATH}/${name}/${version}/schema`;
    try {
      const response = await apiClient.get<
        | Record<string, unknown>
        | { schema: Record<string, unknown> | null; examples?: { name: string; payload: string }[] }
      >(path);
      const data = response.data;
      // The backend may return the JSON Schema directly or wrap it in { schema, examples }.
      if (data && typeof data === 'object' && 'schema' in data) {
        const wrapped = data as { schema: Record<string, unknown> | null; examples?: { name: string; payload: string }[] };
        return { schema: wrapped.schema ?? null, examples: wrapped.examples ?? [] };
      }
      return { schema: (data as Record<string, unknown>) ?? null, examples: [] };
    } catch (error) {
      if (statusOf(error) === 404) return { schema: null, examples: [] };
      console.error(`[guardrailsApi] Failed to get input schema for ${name}@${version}:`, error);
      throw new GuardrailsApiError(`Failed to fetch input schema for ${name}@${version}`, statusOf(error), path, error);
    }
  },

  /**
   * GET /registry/guardrails/{name}/{version}/metadata — flat header projection.
   * Returns the manifest's metadata + spec fields adopters need without the
   * full manifest body. 404 when the manifest does not exist.
   */
  getMetadata: async (name: string, version: string): Promise<GuardrailMetadataProjection> => {
    const path = `${GUARDRAILS_PATH}/${name}/${version}/metadata`;
    try {
      const response = await apiClient.get<GuardrailMetadataProjection>(path);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get metadata for ${name}@${version}:`, error);
      throw new GuardrailsApiError(`Failed to fetch metadata for ${name}@${version}`, statusOf(error), path, error);
    }
  },

  // ============================================
  // CONFIGURATIONS
  // ============================================

  /** GET /registry/configurations — every persisted configuration document. */
  listConfigurations: async (): Promise<GuardrailConfigurationDocument[]> => {
    try {
      const response = await apiClient.get<GuardrailConfigurationDocument[]>(CONFIGURATIONS_PATH);
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list configurations:', error);
      throw new GuardrailsApiError('Failed to fetch configurations', statusOf(error), CONFIGURATIONS_PATH, error);
    }
  },

  /** GET /registry/configurations/{name}/{version} — single configuration; null on 404. */
  getConfiguration: async (
    name: string,
    version: string
  ): Promise<GuardrailConfigurationDocument | null> => {
    const path = `${CONFIGURATIONS_PATH}/${name}/${version}`;
    try {
      const response = await apiClient.get<GuardrailConfigurationDocument>(path);
      return response.data;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      console.error(`[guardrailsApi] Failed to get configuration ${name}@${version}:`, error);
      throw new GuardrailsApiError(`Failed to fetch configuration ${name}@${version}`, statusOf(error), path, error);
    }
  },

  // ============================================
  // REGO
  // ============================================

  /** GET /registry/rego/{name}/{version}/source — raw rego text/plain. */
  getRegoSource: async (name: string, version: string): Promise<string> => {
    const path = `${REGO_PATH}/${name}/${version}/source`;
    try {
      const response = await apiClient.get<string>(path, {
        responseType: 'text',
        transformResponse: (data) => data,
      });
      return typeof response.data === 'string' ? response.data : String(response.data ?? '');
    } catch (error) {
      if (statusOf(error) === 404) return '';
      console.error(`[guardrailsApi] Failed to get rego source for ${name}@${version}:`, error);
      throw new GuardrailsApiError(`Failed to fetch rego source for ${name}@${version}`, statusOf(error), path, error);
    }
  },

  /** GET /registry/opa/bundle — USTAR tar.gz of every rego policy. */
  getOpaBundle: async (): Promise<Blob> => {
    try {
      const response = await apiClient.get<Blob>(OPA_BUNDLE_PATH, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to fetch OPA bundle:', error);
      throw new GuardrailsApiError('Failed to fetch OPA bundle', statusOf(error), OPA_BUNDLE_PATH, error);
    }
  },

  // ============================================
  // EVALUATIONS (orchestrator-side; path unchanged)
  // ============================================

  listEvaluations: async (page = 0, size = 20): Promise<PaginatedResponse<EvaluationRecord>> => {
    const path = `${EVALUATIONS_PATH}/all`;
    try {
      const response = await apiClient.get<PaginatedResponse<EvaluationRecord>>(path, {
        params: { page, size },
      });
      return response.data;
    } catch (error) {
      console.error('[guardrailsApi] Failed to list evaluations:', error);
      throw new GuardrailsApiError('Failed to fetch evaluations', statusOf(error), path, error);
    }
  },

  getEvaluation: async (eventId: string): Promise<EvaluationRecord> => {
    const path = `${EVALUATIONS_PATH}/${eventId}`;
    try {
      const response = await apiClient.get<EvaluationRecord>(path);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluation ${eventId}:`, error);
      throw new GuardrailsApiError(`Failed to fetch evaluation ${eventId}`, statusOf(error), path, error);
    }
  },

  getEvaluationsByCorrelationId: async (correlationId: string): Promise<EvaluationRecord[]> => {
    try {
      const response = await apiClient.get<EvaluationRecord[]>(EVALUATIONS_PATH, {
        params: { correlationId },
      });
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluations for correlation ${correlationId}:`, error);
      throw new GuardrailsApiError(`Failed to fetch evaluations for ${correlationId}`, statusOf(error), EVALUATIONS_PATH, error);
    }
  },

  getEvaluationsByAppId: async (appId: string): Promise<EvaluationRecord[]> => {
    const path = `${EVALUATIONS_PATH}/app/${appId}`;
    try {
      const response = await apiClient.get<EvaluationRecord[]>(path);
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get evaluations for app ${appId}:`, error);
      throw new GuardrailsApiError(`Failed to fetch evaluations for app ${appId}`, statusOf(error), path, error);
    }
  },

  // ============================================
  // STATS — endpoint is missing from REGISTRY_API.md (see docs/missing-endpoints.md)
  // ============================================

  /**
   * GET /registry/stats — not documented in the new REGISTRY_API.md but the
   * Dashboard still calls it. Backend needs to re-implement against the
   * guardrail_manifests collection. See docs/missing-endpoints.md.
   */
  getStats: async (timeRange: TimeRange = '24h'): Promise<RegistryStats> => {
    try {
      const response = await apiClient.get<RegistryStats>(STATS_PATH, { params: { timeRange } });
      return response.data;
    } catch (error) {
      console.error(`[guardrailsApi] Failed to get stats for ${timeRange}:`, error);
      throw new GuardrailsApiError('Failed to fetch registry stats', statusOf(error), STATS_PATH, error);
    }
  },

  // ============================================
  // TEST INPUTS (OpenSearch scroll)
  // ============================================

  /**
   * Normalize a raw OpenSearch hit into a TestInput. Handles both `source`
   * and `_source` envelopes; pulls appId/organization/environment from the
   * orchestrator-reserved top-level `metadata` block first, falling back to
   * legacy `spec.metadata` (pre-spec-customer-owned data) and finally
   * top-level fields for the oldest records.
   */
  _mapSourceToTestInput: (item: TestInputSource, index: number): TestInput => {
    const source = item.source || item._source;

    const topMetadata = (source?.metadata as Record<string, unknown>) || {};
    const spec = (source?.spec as Record<string, unknown>) || {};
    const specMetadata = (spec.metadata as Record<string, unknown>) || {};

    const appId =
      (topMetadata.appId as string) ||
      (specMetadata.appId as string) ||
      (specMetadata.applicationId as string) ||
      (source?.appId as string) ||
      undefined;
    const org =
      (topMetadata.organization as string) ||
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

    const id =
      item.id ||
      (topMetadata.eventId as string) ||
      (topMetadata.correlationId as string) ||
      `test-input-${index}`;

    const name =
      (topMetadata.name as string) ||
      (specMetadata.name as string) ||
      (source?.name as string) ||
      (topMetadata.eventId as string) ||
      `Test Input ${id.slice(0, 12)}`;

    const guardrailId = specMetadata.guardrailId || source?.guardrailId;
    const description =
      (source?.description as string) ||
      (guardrailId ? `Evaluation for guardrail: ${guardrailId}` : undefined);

    return {
      id,
      name,
      description,
      applicationId: appId,
      organization: org,
      environment: env,
      resourceType: resType,
      resourceKind: resKind,
      input: source || {},
      metadata: topMetadata,
    };
  },

  /**
   * GET /registry/test-inputs — recent evaluation inputs from OpenSearch.
   * Pass `scrollId` to continue a previous scroll; filters apply only on the
   * initial request.
   */
  getTestInputs: async (
    filters?: TestInputFilters,
    scrollId?: string,
    limit: number = 50
  ): Promise<TestInputsResponse> => {
    try {
      const params: Record<string, string | number> = { limit };
      if (scrollId) {
        params.scrollId = scrollId;
      } else {
        if (filters?.applicationId) params.applicationId = filters.applicationId;
        if (filters?.organization) params.organization = filters.organization;
        if (filters?.environment) params.environment = filters.environment;
        if (filters?.resourceType) params.resourceType = filters.resourceType;
        if (filters?.resourceKind) params.resourceKind = filters.resourceKind;
      }

      const response = await apiClient.get<TestInputsRawResponse>(TEST_INPUTS_PATH, { params });
      const rawResponse = response.data;

      const sources = rawResponse.hits || rawResponse.sources || [];
      const testInputs = sources.map((item, index) => guardrailsApi._mapSourceToTestInput(item, index));
      const hasMore = sources.length >= limit && rawResponse.scrollId !== null;

      return { scrollId: rawResponse.scrollId, total: rawResponse.total, hasMore, testInputs };
    } catch (error) {
      console.error('[guardrailsApi] Failed to fetch test inputs:', error);
      throw new GuardrailsApiError('Failed to fetch test inputs', statusOf(error), TEST_INPUTS_PATH, error);
    }
  },

  // ============================================
  // COMPOSED OPERATIONS
  // ============================================

  /**
   * Get every policy, joining the latest manifest per name with its persisted
   * configuration content. The manifest list is the source of truth for what
   * a policy is; configuration is a side table keyed by {name, version}.
   */
  listPolicies: async (): Promise<RegistryPolicy[]> => {
    // Configurations are auxiliary — losing them shouldn't fail the catalog.
    // Fall back to an empty list and log so we can triage from the console.
    let manifests: GuardrailManifestDocument[];
    let configurations: GuardrailConfigurationDocument[] = [];
    try {
      [manifests, configurations] = await Promise.all([
        guardrailsApi.listManifests(),
        guardrailsApi
          .listConfigurations()
          .catch((err): GuardrailConfigurationDocument[] => {
            console.warn('[guardrailsApi] listConfigurations failed; serving catalog without config bodies:', err);
            return [];
          }),
      ]);
    } catch (err) {
      console.error('[guardrailsApi] listManifests failed; cannot build catalog:', err);
      throw err;
    }

    const configByKey = new Map<string, GuardrailConfigurationDocument>();
    for (const c of configurations) configByKey.set(`${c.name}@${c.version}`, c);

    // /registry/manifests returns *every* persisted version. The catalog is
    // meant to show one row per guardrail (the latest); older versions live
    // behind the detail view's Versions tab. Group by metadata.name, keep
    // the highest MAJOR.MINOR per group, and map only those. Defensive on
    // every read — a single broken record (e.g. malformed YAML on disk)
    // should be skipped with a log, not kill the entire catalog.
    const latestByName = new Map<string, GuardrailManifestDocument>();
    for (const m of manifests) {
      const name = m?.metadata?.name;
      if (!name) {
        console.warn('[guardrailsApi] Skipping manifest with no metadata.name:', m);
        continue;
      }
      const incumbent = latestByName.get(name);
      if (!incumbent) {
        latestByName.set(name, m);
        continue;
      }
      const incV = parseVersion(incumbent.metadata.version);
      const newV = parseVersion(m.metadata.version);
      const newer =
        newV.major > incV.major || (newV.major === incV.major && newV.minor > incV.minor);
      if (newer) latestByName.set(name, m);
    }

    const policies: RegistryPolicy[] = [];
    for (const m of latestByName.values()) {
      try {
        const key = `${m.metadata.name}@${m.metadata.version}`;
        policies.push(mapManifestToPolicy(m, { config: configByKey.get(key) ?? null }));
      } catch (err) {
        console.error(
          `[guardrailsApi] Failed to map manifest ${m?.metadata?.name}@${m?.metadata?.version} — skipping. Raw manifest:`,
          m,
          err
        );
      }
    }
    return policies;
  },

  /**
   * Get one policy by id. `id` is the manifest's metadata.name; we resolve to
   * the latest version unless a specific version is requested via getPolicyAt.
   * Fetches the rego source and every sibling manifest in parallel with the
   * configuration so the detail view's Rego and Versions tabs both have data.
   */
  getPolicy: async (id: string): Promise<RegistryPolicy> => {
    const raw = await guardrailsApi.listManifestsByName(id);
    if (raw.length === 0) {
      throw new GuardrailsApiError(`No manifest found for ${id}`, 404, `${MANIFESTS_PATH}/${id}`);
    }
    // The spec says newest-first, but the wire is unreliable in practice
    // (some backend versions sort lexically, ranking "1.10" before "1.2").
    // Sort locally on parsed MAJOR.MINOR to keep "latest" well-defined.
    const siblings = sortManifestsNewestFirst(raw);
    const latest = siblings[0];
    const [config, regoCode] = await Promise.all([
      guardrailsApi.getConfiguration(latest.metadata.name, latest.metadata.version),
      guardrailsApi.getRegoSource(latest.metadata.name, latest.metadata.version),
    ]);
    return mapManifestToPolicy(latest, { config, regoCode, siblings });
  },

  /**
   * Get a policy pinned to a specific version. Mirrors suite member resolution.
   * Pulls the rego source alongside the manifest + configuration so callers
   * that hand the result to the studio (e.g. PolicyDetail's Edit button) get a
   * complete snapshot without an extra round-trip. The Versions tab on a
   * pinned read is left empty — it doesn't try to enumerate siblings.
   */
  getPolicyAt: async (ref: GuardrailRef): Promise<RegistryPolicy> => {
    const [manifest, config, regoCode] = await Promise.all([
      guardrailsApi.getManifest(ref.guardrailId, ref.version),
      guardrailsApi.getConfiguration(ref.guardrailId, ref.version),
      guardrailsApi.getRegoSource(ref.guardrailId, ref.version),
    ]);
    return mapManifestToPolicy(manifest, { config, regoCode });
  },

  /** List every (name, version) ref for a guardrail name — used by version pickers. */
  getGuardrailVersions: async (name: string): Promise<GuardrailRef[]> => {
    const manifests = await guardrailsApi.listManifestsByName(name);
    return manifests.map((m) => ({ guardrailId: m.metadata.name, version: m.metadata.version }));
  },
};
