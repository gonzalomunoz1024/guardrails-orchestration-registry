export type PolicyStatus = 'draft' | 'review' | 'approved' | 'active' | 'deprecated';
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
  category: PolicyCategory;
  severity: PolicySeverity;
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'author' | 'reviewer' | 'viewer';
}
