/**
 * Backend DTO Types for the Guardrails Registry Service.
 *
 * Shapes mirror the wire format documented in REGISTRY_API.md (apiVersion
 * "guardrails.dev/v1alpha1"). The canonical record is the manifest; reads
 * come back either as full manifests or as flat projections from
 * /registry/guardrails/{name}/{version}/{schema,metadata}. The frontend uses
 * RegistryPolicy as its internal model, populated from these wire types via
 * the guardrailMapper.
 */

// Enums matching backend values (SCREAMING_SNAKE on the wire)
export type GuardrailStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type EnforcementType = 'MANDATORY' | 'OPTIONAL' | 'WARNING';
/** Lifecycle stage a guardrail runs at (renamed from GuardrailKind). */
export type Stage = 'PRECHECK' | 'APPROVAL' | 'POSTCHECK';
/**
 * Resource kinds use the backend's PascalCase form on the wire (acronyms
 * preserved, e.g. `CNAME`, `MongoDB`). `Any` is a wildcard — the guardrail
 * applies regardless of the resource kind. Useful for org-wide rules that
 * aren't bound to a specific kind.
 */
export type ResourceKind = 'Any' | 'CNAME' | 'MongoDB' | 'VirtualMachine';
export type EvaluationVerdict = 'PASSED' | 'FAILED';

/** Immutable composite key. A suite pins a guardrail by (guardrailId, version). */
export interface GuardrailRef {
  guardrailId: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Manifest wire shape — POST/PUT /v1/utilities/registry/manifests*
// ---------------------------------------------------------------------------

export interface GuardrailManifestMetadata {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  owner?: string;
  labels?: string[];
}

export interface GuardrailPolicyRef {
  file: string;
  package: string;
}

export interface GuardrailDocumentRef {
  /** Where the orchestrator sources the document being evaluated. */
  source: string;
}

export interface GuardrailInputSchemaRef {
  /** Path of the published input schema artifact in the GitHub repo. */
  file: string;
  /**
   * Embedded JSON Schema body. Required as part of the declarative contract —
   * the registry stores this on every manifest write.
   */
  content?: Record<string, unknown>;
  /** Optional list of example input paths published alongside the schema. */
  examples?: string[];
}

export interface GuardrailConfigurationLookup {
  table: string; // 'guardrail_configurations'
  onMissing?: 'fail' | 'allow' | 'deny';
}

export interface GuardrailConfigurationFilter {
  byResourceKind?: boolean;
}

export interface GuardrailConfigurationRef {
  file: string;
  lookup?: GuardrailConfigurationLookup;
  filter?: GuardrailConfigurationFilter;
  /**
   * Embedded configuration data. When present, the registry extracts this
   * into the guardrail_configurations collection on manifest write.
   */
  content?: Record<string, unknown>;
}

export interface GuardrailManifestSpec {
  enforcement: EnforcementType;
  stage: Stage;
  status: GuardrailStatus;
  target: { resourceKind: ResourceKind };
  policy: GuardrailPolicyRef;
  document: GuardrailDocumentRef;
  inputSchema?: GuardrailInputSchemaRef;
  configuration?: GuardrailConfigurationRef;
  /** Reserved for future use; orchestrator may consume these. */
  externalDependencies?: Record<string, unknown>[];
}

/**
 * The canonical persisted manifest. Returned by:
 *   GET /v1/utilities/registry/manifests
 *   GET /v1/utilities/registry/manifests/{name}
 *   GET /v1/utilities/registry/manifests/{name}/{version}
 */
export interface GuardrailManifestDocument {
  id?: string;
  apiVersion: string;
  kind: string;
  metadata: GuardrailManifestMetadata;
  spec: GuardrailManifestSpec;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Flat header projection from
 *   GET /v1/utilities/registry/guardrails/{name}/{version}/metadata
 */
export interface GuardrailMetadataProjection {
  name: string;
  displayName?: string;
  version: string;
  description?: string;
  owner?: string;
  enforcement: EnforcementType;
  stage: Stage;
  status: GuardrailStatus;
  resourceKind: ResourceKind;
  policyPackage?: string;
}

// ---------------------------------------------------------------------------
// Configuration wire shape — /v1/utilities/registry/configurations*
// ---------------------------------------------------------------------------

/**
 * Persisted configuration document, keyed by `{name}@{version}`. Returned by:
 *   GET /v1/utilities/registry/configurations
 *   GET /v1/utilities/registry/configurations/{name}
 *   GET /v1/utilities/registry/configurations/{name}/{version}
 *   POST/PUT /v1/utilities/registry/configurations/{name}/{version}
 *
 * The orchestrator's MongoLookupTableAdapter returns `content` verbatim to OPA
 * as `input.configuration`, so the content shape is intentionally flat.
 */
export interface GuardrailConfigurationDocument {
  id: string;
  name: string;
  version: string;
  content: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Rego wire shape — /v1/utilities/registry/rego*
// ---------------------------------------------------------------------------

/**
 * Persisted rego policy document. Returned by:
 *   GET /v1/utilities/registry/rego
 *   GET /v1/utilities/registry/rego/{name}
 *   GET /v1/utilities/registry/rego/{name}/{version}
 *   POST/PUT /v1/utilities/registry/rego/{name}/{version}
 *
 * Use /v1/utilities/registry/rego/{name}/{version}/source for the raw rego
 * text/plain body.
 */
export interface GuardrailRegoDocument {
  id: string;
  name: string;
  version: string;
  packageName: string;
  source: string;
  sha256: string;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Evaluation records (orchestrator-side; path unchanged)
// ---------------------------------------------------------------------------

/**
 * Evaluation Record — Backend DTO from
 *   GET /v1/utilities/evaluations/{eventId}
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
 * Paginated Evaluation List — Backend DTO from
 *   GET /v1/utilities/evaluations/all
 */
export interface PaginatedEvaluations {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: EvaluationRecord[];
}

/** Paginated Response — Generic Backend DTO */
export interface PaginatedResponse<T> {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  content: T[];
}

/** API Error Response — Backend DTO */
export interface ApiErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  path?: string;
  status?: number;
}
