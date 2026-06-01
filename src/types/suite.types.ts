/**
 * Guardrail Suite types.
 *
 * A suite is a customer-assembled, *unversioned* mutable grouping that pins
 * specific immutable guardrail versions by (guardrailId, version). Incrementing
 * a guardrail never changes what a suite references — the suite keeps resolving
 * the version it pinned until an owner explicitly re-pins it.
 *
 * Wire shape mirrors REGISTRY_API.md §6. The primary key is `suiteId`; POST
 * /registry/suites is an idempotent upsert on `suiteId`. PUT applies a partial
 * update; omitted fields are preserved.
 */
import type {
  GuardrailRef,
  Stage,
  EnforcementType,
  ResourceKind,
  GuardrailStatus,
} from './guardrail.types';

export type SuiteStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

/**
 * Per-member scope filter. When the orchestrator evaluates a suite for an
 * inbound document, the determinator drops a member for that request iff at
 * least one of its `exclusions` matches the request's (appId, organization).
 *
 * Match rule: an entry matches when every key it sets equals the request's
 * value at that key. So `{ appId: "app-123" }` excludes every request from
 * app-123 regardless of organization; `{ appId: "app-123", organization:
 * "platform" }` excludes only the (app-123, platform) intersection.
 *
 * At least one of `appId` / `organization` must be set — empty entries are
 * rejected so authors don't accidentally disable a check for everyone.
 */
export interface MemberExclusion {
  appId?: string;
  organization?: string;
  /** Short free-text note for audit ("not relevant to platform team", etc). */
  reason?: string;
}

/**
 * Wire shape for a member in a create/update suite request. Extends the bare
 * pin with optional per-member overrides that the registry persists verbatim.
 */
export interface SuiteMemberPin extends GuardrailRef {
  exclusions?: MemberExclusion[];
}

/** A pinned member of a suite, enriched with display facets when resolved. */
export interface SuiteMember extends GuardrailRef {
  /** Human-readable name (from manifest metadata.displayName). */
  displayName?: string;
  description?: string;
  stage?: Stage;
  /** Enforcement level (wire field is `enforcement`, not `enforcementType`). */
  enforcement?: EnforcementType;
  resourceKind?: ResourceKind;
  status?: GuardrailStatus;
  /** Path/URL to the member version's published input-schema artifact. */
  inputSchemaRef?: string;
  /** Scope filters; see MemberExclusion. */
  exclusions?: MemberExclusion[];
}

export interface GuardrailSuite {
  suiteId: string;
  displayName: string;
  description: string;
  owner: string;
  /**
   * Defaults to ACTIVE server-side when omitted on POST; INACTIVE and DRAFT
   * suites are not evaluatable (orchestrator gates on status == ACTIVE).
   */
  status: SuiteStatus;
  members: SuiteMember[];
  /** Members whose (guardrailId, version) does not resolve in guardrail_manifests. */
  nonApplicableMembers?: GuardrailRef[];
  createdAt?: string;
  updatedAt?: string;
}

/** Upsert payload. POST keys on `suiteId`; blank/missing suiteId is 400. */
export interface CreateSuiteRequest {
  suiteId: string;
  displayName: string;
  description: string;
  owner: string;
  /** Optional on POST. Server defaults to ACTIVE. */
  status?: SuiteStatus;
  members: SuiteMemberPin[];
}

/** Partial update; omitted fields keep the existing value. */
export interface UpdateSuiteRequest {
  displayName?: string;
  description?: string;
  status?: SuiteStatus;
  members?: SuiteMemberPin[];
}

/** The input contract a suite member expects, resolved from its published artifact. */
export interface ResolvedMemberContract {
  guardrailId: string;
  version: string;
  schema: Record<string, unknown> | null;
  examples: { name: string; payload: string }[];
}
