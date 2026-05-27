/**
 * Guardrail Mapper
 *
 * Maps between backend Guardrail DTOs and frontend RegistryPolicy models.
 * Handles the naming mismatch (backend: guardrail, frontend: policy).
 */

import type {
  GuardrailDefinition,
  GuardrailConfiguration,
  GuardrailStatus,
  EnforcementType,
  Stage,
  ResourceKind,
  CreateGuardrailRequest,
  UpdateGuardrailRequest,
  UpsertConfigurationRequest,
} from '@/types/guardrail.types';
import type { RegistryPolicy, PolicyStatus } from '@/types/registry.types';

/**
 * Maps backend GuardrailStatus to frontend PolicyStatus
 */
export function mapGuardrailStatusToPolicy(status: GuardrailStatus): PolicyStatus {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'INACTIVE':
      return 'deprecated';
    case 'DRAFT':
      return 'draft';
    default:
      return 'draft';
  }
}

/**
 * Maps frontend PolicyStatus to backend GuardrailStatus
 */
export function mapPolicyStatusToGuardrail(status: PolicyStatus): GuardrailStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'approved':
      return 'ACTIVE';
    case 'review':
      return 'DRAFT'; // Backend doesn't have review status
    case 'deprecated':
      return 'INACTIVE';
    case 'draft':
    default:
      return 'DRAFT';
  }
}

/**
 * Maps a Guardrail Definition + Configuration to a RegistryPolicy
 *
 * Note: Many frontend fields don't exist in the backend and will use defaults:
 * - regoCode: Empty string (not stored in backend)
 * - testCases: Empty array (not in backend)
 * - stats: Zeroed (not in backend)
 * - versions: Empty (not in backend)
 * - tags: Empty (not in backend)
 */
export function mapGuardrailToPolicy(
  guardrail: GuardrailDefinition,
  config?: GuardrailConfiguration | null
): RegistryPolicy {
  return {
    id: guardrail.guardrailId,
    name: guardrail.guardrailName,
    description: guardrail.description,
    resourceKind: guardrail.resourceKind,
    stage: guardrail.stage,
    enforcementType: guardrail.enforcementType,
    status: mapGuardrailStatusToPolicy(guardrail.status),
    tags: [], // Not in backend
    author: guardrail.owner,
    createdAt: guardrail.createdAt,
    currentVersion: guardrail.version,
    versions: [], // Fed by the versions endpoint
    regoCode: '', // Not stored in backend guardrail definition
    configJson: config ? JSON.stringify(config.global, null, 2) : '{}',
    testCases: [], // Not in backend
    stats: {
      // Would need separate stats endpoint
      totalEvaluations: 0,
      allowRate: 0,
      denyRate: 0,
      avgExecutionTimeMs: 0,
    },
  };
}

/**
 * Maps multiple guardrails to policies
 */
export function mapGuardrailsToPolices(
  guardrails: GuardrailDefinition[],
  configs?: Map<string, GuardrailConfiguration>
): RegistryPolicy[] {
  return guardrails.map((g) => mapGuardrailToPolicy(g, configs?.get(g.guardrailId)));
}

/**
 * Creates a Guardrail Definition request from frontend policy data
 */
export function mapPolicyToCreateGuardrailRequest(
  policy: Partial<RegistryPolicy>,
  additionalFields: {
    enforcementType?: EnforcementType;
    stage?: Stage;
    resourceKind?: ResourceKind;
  } = {}
): CreateGuardrailRequest {
  // Generate an ID if not provided
  const guardrailId = policy.id || `guardrail-${Date.now()}`;

  return {
    guardrailId,
    guardrailName: policy.name || 'Untitled Guardrail',
    description: policy.description || '',
    version: policy.currentVersion || '1.0',
    status: mapPolicyStatusToGuardrail(policy.status || 'draft'),
    enforcementType: additionalFields.enforcementType || policy.enforcementType || 'OPTIONAL',
    stage: additionalFields.stage || policy.stage || 'PRECHECK',
    resourceKind: additionalFields.resourceKind || policy.resourceKind || 'VIRTUAL_MACHINE',
    owner: policy.author || 'unknown',
  };
}

/**
 * Creates an Update Guardrail request from frontend policy data.
 * Note: version is NOT sent — the backend derives the new immutable version.
 */
export function mapPolicyToUpdateGuardrailRequest(
  policy: Partial<RegistryPolicy>
): UpdateGuardrailRequest {
  const request: UpdateGuardrailRequest = {};

  if (policy.name !== undefined) request.guardrailName = policy.name;
  if (policy.description !== undefined) request.description = policy.description;
  if (policy.status !== undefined) request.status = mapPolicyStatusToGuardrail(policy.status);
  if (policy.stage !== undefined) request.stage = policy.stage;
  if (policy.enforcementType !== undefined) request.enforcementType = policy.enforcementType;
  if (policy.resourceKind !== undefined) request.resourceKind = policy.resourceKind;
  if (policy.author !== undefined) request.owner = policy.author;

  return request;
}

/**
 * Creates a Configuration upsert request from frontend policy config
 */
export function mapPolicyConfigToUpsertRequest(
  configJson: string
): UpsertConfigurationRequest {
  let global: Record<string, unknown> = {};

  try {
    global = JSON.parse(configJson);
  } catch {
    console.warn('Failed to parse config JSON, using empty object');
  }

  return {
    global,
    lobOverrides: {},
  };
}

/**
 * Extracts configuration JSON from a GuardrailConfiguration
 */
export function extractConfigJson(config: GuardrailConfiguration | null): string {
  if (!config) return '{}';
  return JSON.stringify(config.global, null, 2);
}
