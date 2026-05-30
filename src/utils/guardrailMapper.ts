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

