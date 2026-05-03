/**
 * Backend DTO Types for Guardrails Orchestrator Service
 *
 * These types represent the actual backend API contracts.
 * The frontend uses RegistryPolicy, which is mapped from these types.
 */

// Enums matching backend values
export type GuardrailStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type EnforcementType = 'MANDATORY' | 'OPTIONAL';
export type GuardrailKind = 'PRECHECK' | 'POSTCHECK';
export type ResourceType = 'LIGHTSPEED' | 'VMFORGE' | 'MONGO_DB' | 'CUSTOM';
export type ResourceKind = 'VIRTUAL_MACHINE' | 'MONGO_DB' | 'CONTAINER' | 'NETWORK' | 'STORAGE';
export type EvaluationVerdict = 'PASSED' | 'FAILED';

/**
 * Guardrail Definition - Backend DTO
 * GET/POST/PUT /api/v1/registry/guardrails
 */
export interface GuardrailDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  kind: GuardrailKind;
  resourceType: ResourceType;
  resourceKind: ResourceKind;
  owner: string;
  scopeExclusions?: ScopeExclusion[];
  createdAt: string;
  updatedAt: string;
}

export interface ScopeExclusion {
  lob: string;
  reason?: string;
}

/**
 * Guardrail Definition List Item - Backend DTO
 * GET /api/v1/registry/guardrails (list response)
 */
export interface GuardrailListItem {
  id: string;
  name: string;
  version: string;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  kind: GuardrailKind;
  resourceType: ResourceType;
  resourceKind: ResourceKind;
}

/**
 * Create Guardrail Request - Backend DTO
 * POST /api/v1/registry/guardrails
 */
export interface CreateGuardrailRequest {
  id: string;
  name: string;
  description: string;
  version: string;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  kind: GuardrailKind;
  resourceType: ResourceType;
  resourceKind: ResourceKind;
  owner: string;
  scopeExclusions?: ScopeExclusion[];
}

/**
 * Update Guardrail Request - Backend DTO
 * PUT /api/v1/registry/guardrails/{id}
 */
export interface UpdateGuardrailRequest {
  name?: string;
  description?: string;
  version?: string;
  status?: GuardrailStatus;
  enforcementType?: EnforcementType;
  kind?: GuardrailKind;
  resourceType?: ResourceType;
  resourceKind?: ResourceKind;
  owner?: string;
  scopeExclusions?: ScopeExclusion[];
}

/**
 * Guardrail Configuration - Backend DTO
 * GET/PUT /api/v1/registry/configurations/{guardrailId}
 */
export interface GuardrailConfiguration {
  guardrailId: string;
  global: Record<string, unknown>;
  lobOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Configuration List Item - Backend DTO
 * GET /api/v1/registry/configurations
 */
export interface ConfigurationListItem {
  guardrailId: string;
  global: Record<string, unknown>;
  lobOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Create/Update Configuration Request - Backend DTO
 * PUT /api/v1/registry/configurations/{guardrailId}
 */
export interface UpsertConfigurationRequest {
  global: Record<string, unknown>;
  lobOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Evaluation Record - Backend DTO
 * GET /api/v1/evaluations/{eventId}
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
 * GET /api/v1/evaluations/all
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
