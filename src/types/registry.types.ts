export type PolicyStatus = 'draft' | 'review' | 'approved' | 'active' | 'deprecated';

// Canonical guardrail enums live in guardrail.types.ts; re-export for app-wide use.
export type { ResourceKind, Stage, EnforcementType, GuardrailStatus } from './guardrail.types';
import type { ResourceKind, Stage, EnforcementType } from './guardrail.types';

// Resource kinds use the backend's PascalCase form (acronyms preserved); the
// labels below are for display only.
export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  Any: 'Any',
  CNAME: 'CNAME',
  MongoDB: 'MongoDB',
  VirtualMachine: 'VirtualMachine',
};
export const STAGE_LABELS: Record<Stage, string> = {
  PRECHECK: 'PreCheck',
  APPROVAL: 'Approval',
  POSTCHECK: 'PostCheck',
};
export const ENFORCEMENT_LABELS: Record<EnforcementType, string> = {
  MANDATORY: 'Mandatory',
  OPTIONAL: 'Optional',
  WARNING: 'Warning',
};

// Keep for backwards compatibility during migration
export type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';
export type PolicyCategory = 'access-control' | 'compliance' | 'security' | 'cost' | 'operational';

export interface PolicyVersion {
  version: string;
  createdAt: string;
  createdBy: string;
  changelog: string;
  regoCode: string;
}

export interface PolicyTestCase {
  id: string;
  name: string;
  description: string;
  input: Record<string, unknown>;
  expectedResult: unknown;
  passed?: boolean;
  lastRun?: string;
}

export interface PolicyStats {
  totalEvaluations: number;
  allowRate: number;
  denyRate: number;
  avgExecutionTimeMs: number;
  lastEvaluated?: string;
}

export interface RegistryPolicy {
  id: string;
  name: string;
  description: string;
  resourceKind: ResourceKind;
  stage: Stage;
  enforcementType: EnforcementType;
  status: PolicyStatus;
  tags: string[];
  author: string;
  createdAt: string;
  currentVersion: string;
  versions: PolicyVersion[];
  regoCode: string;
  configJson: string;
  /** Path/URL to the published input schema artifact, if any. */
  inputSchemaRef?: string;
  /** JSON-stringified body of the published input schema, when embedded. */
  inputSchemaJson?: string;
  /** Decoded external dependencies, ready to drop into the studio on Edit. */
  externalDeps?: import('./external.types').ExternalDependency[];
  testCases: PolicyTestCase[];
  stats: PolicyStats;
  dependencies?: string[];
  approvedBy?: string;
  approvedAt?: string;
}

export interface BlastRadiusResult {
  id: string;
  policyId: string;
  policyName: string;
  executedAt: string;
  executedBy: string;
  totalRecords: number;
  allowedCount: number;
  deniedCount: number;
  errorCount: number;
  executionTimeMs: number;
  sampleResults: BlastRadiusSample[];
}

export interface BlastRadiusSample {
  id: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  decision: 'allow' | 'deny' | 'error';
  reason?: string;
  input: Record<string, unknown>;
}

export interface ActivityEvent {
  id: string;
  type: 'policy_created' | 'policy_updated' | 'policy_approved' | 'policy_activated' | 'blast_radius_run' | 'test_run';
  policyId?: string;
  policyName?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: string;
  details?: string;
}

export interface DashboardStats {
  totalPolicies: number;
  activePolicies: number;
  draftPolicies: number;
  pendingReview: number;
  totalEvaluationsToday: number;
  avgAllowRate: number;
  recentBlastRadiusTests: number;
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export interface RegistryStats {
  totalGuardrails: number;
  activeGuardrails: number;
  inactiveGuardrails: number;
  guardrailsByStatus: Record<string, number>;
  guardrailsByEnforcementType: Record<string, number>;
  evaluations: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  computedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'author' | 'reviewer' | 'viewer';
}

// Test Inputs (Scope-Based Test Cases)

/**
 * Raw source item from backend response
 * Backend may return either 'source' or '_source' field
 */
export interface TestInputSource {
  id?: string;
  source?: Record<string, unknown>;
  _source?: Record<string, unknown>;
}

/**
 * Normalized test input for frontend use
 */
export interface TestInput {
  id: string;
  name: string;
  description?: string;
  applicationId?: string;
  organization?: string;
  environment?: string;
  resourceType?: string;
  resourceKind?: string;
  input: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TestInputFilters {
  applicationId?: string;
  organization?: string;
  environment?: string;
  resourceType?: string;
  resourceKind?: string;
}

/**
 * Raw response from backend (OpenSearch format)
 * Note: Backend may return either 'hits' or 'sources' array
 */
export interface TestInputsRawResponse {
  scrollId: string | null;
  total: number;
  hits?: TestInputSource[];
  sources?: TestInputSource[];
}

/**
 * Normalized response for frontend use
 */
export interface TestInputsResponse {
  scrollId: string | null;
  total: number;
  hasMore: boolean;
  testInputs: TestInput[];
}
