/**
 * Guardrail Suite types.
 *
 * A suite is a customer-assembled, *unversioned* mutable grouping that pins
 * specific immutable guardrail versions by (guardrailId, version). Incrementing
 * a guardrail never changes what a suite references — the suite keeps resolving
 * the version it pinned until an owner explicitly re-pins it.
 */
import type {
  GuardrailRef,
  Stage,
  EnforcementType,
  ResourceKind,
  GuardrailStatus,
} from './guardrail.types';

export type SuiteStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

/** A pinned member of a suite, enriched with display facets when resolved. */
export interface SuiteMember extends GuardrailRef {
  guardrailName?: string;
  description?: string;
  stage?: Stage;
  enforcementType?: EnforcementType;
  resourceKind?: ResourceKind;
  status?: GuardrailStatus;
  /** Path/URL to the member version's published input-schema artifact. */
  inputSchemaRef?: string;
}

export interface GuardrailSuite {
  suiteId: string;
  name: string;
  description: string;
  owner: string;
  status: SuiteStatus;
  members: SuiteMember[];
  createdAt: string;
}

export interface CreateSuiteRequest {
  name: string;
  description: string;
  owner: string;
  status: SuiteStatus;
  members: GuardrailRef[];
}

export interface UpdateSuiteRequest {
  name?: string;
  description?: string;
  status?: SuiteStatus;
  members?: GuardrailRef[];
}

/** The input contract a suite member expects, resolved from its published artifact. */
export interface ResolvedMemberContract {
  guardrailId: string;
  version: string;
  schema: Record<string, unknown> | null;
  examples: { name: string; payload: string }[];
}
