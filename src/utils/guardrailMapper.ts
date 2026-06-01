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
import { normalizeResourceKind } from './resourceKind';
import { decodeDependenciesFromManifest } from './guardrailManifest';

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

export interface MapManifestExtras {
  /** Optional configuration document for the current version. */
  config?: GuardrailConfigurationDocument | null;
  /**
   * Rego source for the current version, fetched separately because the
   * manifest only stores a file reference (the actual rego text lives at the
   * /registry/rego endpoint). Empty string is fine when the source is missing.
   */
  regoCode?: string;
  /**
   * Sibling manifests (all versions of this guardrail, newest first) used to
   * populate the Versions tab. Pass an empty array — or omit — when only the
   * single pinned manifest matters (e.g. suite member resolution).
   */
  siblings?: GuardrailManifestDocument[];
}

/**
 * Map a full manifest document into a RegistryPolicy. The frontend `id` is the
 * manifest's metadata.name (which is the slug used as the registry primary
 * key). The Versions tab pulls from `siblings`; the Rego tab pulls from
 * `regoCode`. Both default to empty when the caller doesn't supply them.
 *
 * Every field is read defensively: a broken manifest (one shipped through the
 * registry with a missing `spec.target` block, an unexpected enum, etc.)
 * shouldn't crash the catalog mapping for the *other* manifests. Anything
 * missing falls back to the matching defaults the studio already accepts.
 */
export function mapManifestToPolicy(
  manifest: GuardrailManifestDocument,
  extras: MapManifestExtras = {}
): RegistryPolicy {
  const metadata = manifest?.metadata ?? ({} as GuardrailManifestDocument['metadata']);
  const spec = manifest?.spec ?? ({} as GuardrailManifestDocument['spec']);
  const { config, regoCode = '', siblings = [] } = extras;
  const content = config?.content ?? spec.configuration?.content ?? {};
  const target = spec.target ?? ({} as { resourceKind: unknown });
  const externalDeps = decodeDependenciesFromManifest(spec.externalDependencies);

  return {
    id: metadata.name ?? '',
    name: metadata.displayName || metadata.name || '(unnamed)',
    description: metadata.description ?? '',
    resourceKind: normalizeResourceKind(target.resourceKind),
    stage: spec.stage,
    enforcementType: spec.enforcement,
    status: mapGuardrailStatusToPolicy(spec.status),
    tags: metadata.labels ?? [],
    author: metadata.owner ?? '',
    createdAt: manifest?.createdAt ?? '',
    currentVersion: metadata.version ?? '0.0',
    // The Versions tab is informational — listing every published version
    // with its owner/timestamp. The full rego per historical version is not
    // fetched eagerly; expanding a row could lazy-load it, but today the row
    // just renders what the manifest carries.
    versions: siblings.map((m) => ({
      version: m?.metadata?.version ?? '0.0',
      createdAt: m?.createdAt ?? '',
      createdBy: m?.metadata?.owner ?? '',
      changelog: m?.metadata?.description ?? '',
      regoCode: m?.metadata?.version === metadata.version ? regoCode : '',
    })),
    regoCode,
    configJson: JSON.stringify(content, null, 2),
    externalDeps,
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
    resourceKind: normalizeResourceKind(metadata.resourceKind),
    stage: metadata.stage,
    enforcementType: metadata.enforcement,
    status: mapGuardrailStatusToPolicy(metadata.status),
    author: metadata.owner ?? '',
    currentVersion: metadata.version,
  };
}
