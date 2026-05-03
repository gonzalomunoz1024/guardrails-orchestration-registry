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
  CreateGuardrailRequest,
  UpdateGuardrailRequest,
  UpsertConfigurationRequest,
} from '@/types/guardrail.types';
import type { RegistryPolicy, PolicyStatus, PolicyCategory, PolicySeverity } from '@/types/registry.types';

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
 * Infers category from guardrail properties
 * Since backend doesn't have category, we infer from resourceType/kind
 */
export function inferCategory(guardrail: GuardrailDefinition): PolicyCategory {
  // Default inference based on resource type or kind
  if (guardrail.kind === 'PRECHECK') {
    return 'security';
  }
  if (guardrail.resourceType === 'LIGHTSPEED') {
    return 'operational';
  }
  return 'access-control';
}

/**
 * Infers severity from enforcement type
 * Since backend doesn't have severity, we infer from enforcementType
 */
export function inferSeverity(guardrail: GuardrailDefinition): PolicySeverity {
  return guardrail.enforcementType === 'MANDATORY' ? 'critical' : 'medium';
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
    id: guardrail.id,
    name: guardrail.name,
    description: guardrail.description,
    category: inferCategory(guardrail),
    severity: inferSeverity(guardrail),
    status: mapGuardrailStatusToPolicy(guardrail.status),
    tags: [], // Not in backend
    author: guardrail.owner,
    createdAt: guardrail.createdAt,
    updatedAt: guardrail.updatedAt,
    currentVersion: guardrail.version,
    versions: [], // Not in backend - would need separate endpoint
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
    // Store backend-specific fields in a way frontend can access if needed
    // These can be used when displaying or editing
  };
}

/**
 * Maps multiple guardrails to policies
 */
export function mapGuardrailsToPolices(
  guardrails: GuardrailDefinition[],
  configs?: Map<string, GuardrailConfiguration>
): RegistryPolicy[] {
  return guardrails.map((g) => mapGuardrailToPolicy(g, configs?.get(g.id)));
}

/**
 * Creates a Guardrail Definition request from frontend policy data
 */
export function mapPolicyToCreateGuardrailRequest(
  policy: Partial<RegistryPolicy>,
  additionalFields: {
    enforcementType?: 'MANDATORY' | 'OPTIONAL';
    kind?: 'PRECHECK' | 'POSTCHECK';
    resourceType?: string;
    resourceKind?: string;
  } = {}
): CreateGuardrailRequest {
  // Generate an ID if not provided
  const id = policy.id || `guardrail-${Date.now()}`;

  return {
    id,
    name: policy.name || 'Untitled Policy',
    description: policy.description || '',
    version: policy.currentVersion || '1.0.0',
    status: mapPolicyStatusToGuardrail(policy.status || 'draft'),
    enforcementType: additionalFields.enforcementType || 'OPTIONAL',
    kind: additionalFields.kind || 'PRECHECK',
    resourceType: (additionalFields.resourceType as 'LIGHTSPEED') || 'LIGHTSPEED',
    resourceKind: (additionalFields.resourceKind as 'VIRTUAL_MACHINE') || 'VIRTUAL_MACHINE',
    owner: policy.author || 'unknown',
  };
}

/**
 * Creates an Update Guardrail request from frontend policy data
 */
export function mapPolicyToUpdateGuardrailRequest(
  policy: Partial<RegistryPolicy>
): UpdateGuardrailRequest {
  const request: UpdateGuardrailRequest = {};

  if (policy.name !== undefined) request.name = policy.name;
  if (policy.description !== undefined) request.description = policy.description;
  if (policy.currentVersion !== undefined) request.version = policy.currentVersion;
  if (policy.status !== undefined) request.status = mapPolicyStatusToGuardrail(policy.status);
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
