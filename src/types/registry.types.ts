export type PolicyStatus = 'draft' | 'review' | 'approved' | 'active' | 'deprecated';

// Frontend resource types (lowercase for display)
// Note: guardrail.types.ts has backend ResourceType with UPPERCASE values
export type FrontendResourceType = 'lightspeed' | 'vmforge';

// Alias for simpler usage in frontend components
export type ResourceType = FrontendResourceType;
export type ResourceKind = string; // Free-form for now, can be constrained later

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
  resourceType: ResourceType;
  resourceKind: string;
  status: PolicyStatus;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  currentVersion: string;
  versions: PolicyVersion[];
  regoCode: string;
  configJson: string;
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
  totalPolicies: number;
  activePolicies: number;
  draftPolicies: number;
  pendingReview: number;
  totalEvaluations: number;
  avgAllowRate: number;
  recentBlastRadiusTests: number;
  timeRange: TimeRange;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'author' | 'reviewer' | 'viewer';
}
