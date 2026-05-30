/**
 * Backend DTO Types for Guardrails Orchestrator Service
 *
 * These types represent the actual backend API contracts.
 * The frontend uses RegistryPolicy, which is mapped from these types.
 */

// Enums matching backend values (SCREAMING_SNAKE on the wire)
export type GuardrailStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type EnforcementType = 'MANDATORY' | 'OPTIONAL' | 'WARNING';
/** Lifecycle stage a guardrail runs at (renamed from GuardrailKind). */
export type Stage = 'PRECHECK' | 'APPROVAL' | 'POSTCHECK';
/**
 * `ANY` is a wildcard — the guardrail applies regardless of the resource kind.
 * Useful for org-wide rules that aren't bound to a specific kind.
 */
export type ResourceKind = 'ANY' | 'CNAME' | 'MONGODB' | 'VIRTUAL_MACHINE';
export type EvaluationVerdict = 'PASSED' | 'FAILED';

/** Immutable composite key. A suite pins a guardrail by (guardrailId, version). */
export interface GuardrailRef {
  guardrailId: string;
  version: string;
}

/**
 * Guardrail Definition - Backend DTO (an immutable versioned record)
 * GET/POST/PUT /v1/utilities/registry/guardrails
 */
export interface GuardrailDefinition {
  guardrailId: string;
  guardrailName: string;
  description: string;
  version: string; // MAJOR.MINOR, e.g. "1.0"
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  stage: Stage;
  resourceKind: ResourceKind;
  owner: string;
  scopeExclusions?: ScopeExclusion[];
  createdAt: string;
}

export interface ScopeExclusion {
  lob: string;
  reason?: string;
}

/**
 * Guardrail Configuration - Backend DTO
 * GET /v1/utilities/registry/configurations/{guardrailId}
 */
export interface GuardrailConfiguration {
  guardrailId: string;
  global: Record<string, unknown>;
  lobOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Configuration List Item - Backend DTO
 * GET /v1/utilities/registry/configurations
 */
export interface ConfigurationListItem {
  guardrailId: string;
  global: Record<string, unknown>;
  lobOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Evaluation Record - Backend DTO
 * GET /v1/utilities/evaluations/{eventId}
 */
export interface EvaluationRecord {
  eventId: string;
  correlationId: string;
  appId: string;
  overallVerdict: EvaluationVerdict;
  occurredAt: string;
  source: EvaluationSource;
  metadata: EvaluationMetadata;
  summary: EvaluationSummary;
  evaluations: IndividualEvaluation[];
}

export interface EvaluationSource {
  service: string;
  version: string;
  requestedBy: string;
}

export interface EvaluationMetadata {
  environment: string;
  cluster: string;
  namespace: string;
}

export interface EvaluationSummary {
  totalEvaluated: number;
  totalPassed: number;
  totalFailed: number;
  mandatoryFailed: number;
  optionalFailed: number;
}

export interface IndividualEvaluation {
  guardrailId: string;
  guardrailName: string;
  verdict: EvaluationVerdict;
  enforcementType: EnforcementType;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * Paginated Evaluation List - Backend DTO
 * GET /v1/utilities/evaluations/all
 */
export interface PaginatedEvaluations {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: EvaluationRecord[];
}

/**
 * Paginated Response - Generic Backend DTO
 */
export interface PaginatedResponse<T> {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: T[];
}

/**
 * API Error Response - Backend DTO
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path?: string;
  status?: number;
}
