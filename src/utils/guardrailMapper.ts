/**
 * Maps between backend wire DTOs and the frontend RegistryPolicy model.
 *
 * The wire shape (manifest) is faithful to REGISTRY_API.md; the frontend
 * shape (RegistryPolicy) is what the UI is built around. Keep the mapping
 * lossless where possible — anything the UI doesn't currently render but
 * the backend persists should pass through untouched so we don't accidentally
 * drop data on a round-trip read.
 */

import type {
  GuardrailManifestDocument,
  GuardrailConfigurationDocument,
  GuardrailMetadataProjection,
  GuardrailStatus,
} from '@/types/guardrail.types';
import type { RegistryPolicy, PolicyStatus } from '@/types/registry.types';

/** Backend GuardrailStatus → frontend PolicyStatus. */
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
 * Map a full manifest document (+ optional configuration content) into a
 * RegistryPolicy. The frontend `id` is the manifest's metadata.name (which is
 * the slug used as the registry primary key). regoCode stays empty here —
 * the UI fetches the raw rego source separately via guardrailsApi.getRegoSource.
 */
export function mapManifestToPolicy(
  manifest: GuardrailManifestDocument,
  config?: GuardrailConfigurationDocument | null
): RegistryPolicy {
  const { metadata, spec } = manifest;
  const content = config?.content ?? spec.configuration?.content ?? {};

  return {
    id: metadata.name,
    name: metadata.displayName || metadata.name,
    description: metadata.description ?? '',
    resourceKind: spec.target.resourceKind,
    stage: spec.stage,
    enforcementType: spec.enforcement,
    status: mapGuardrailStatusToPolicy(spec.status),
    tags: metadata.labels ?? [],
    author: metadata.owner ?? '',
    createdAt: manifest.createdAt ?? '',
    currentVersion: metadata.version,
    versions: [],
    regoCode: '',
    configJson: JSON.stringify(content, null, 2),
    testCases: [],
    stats: {
      totalEvaluations: 0,
      allowRate: 0,
      denyRate: 0,
      avgExecutionTimeMs: 0,
    },
  };
}

/**
 * Map a metadata projection (flat header) into a partial RegistryPolicy.
 * Useful for suite member resolution where we don't want to pull the full
 * manifest body for every pinned (name, version) pair.
 */
export function mapMetadataProjectionToPolicy(
  metadata: GuardrailMetadataProjection
): Pick<
  RegistryPolicy,
  | 'id'
  | 'name'
  | 'description'
  | 'resourceKind'
  | 'stage'
  | 'enforcementType'
  | 'status'
  | 'author'
  | 'currentVersion'
> {
  return {
    id: metadata.name,
    name: metadata.displayName || metadata.name,
    description: metadata.description ?? '',
    resourceKind: metadata.resourceKind,
    stage: metadata.stage,
    enforcementType: metadata.enforcement,
    status: mapGuardrailStatusToPolicy(metadata.status),
    author: metadata.owner ?? '',
    currentVersion: metadata.version,
  };
}
