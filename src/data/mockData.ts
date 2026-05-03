import type {
  RegistryPolicy,
  BlastRadiusResult,
  ActivityEvent,
  DashboardStats,
  User,
} from '@/types/registry.types';

export const currentUser: User = {
  id: 'user-1',
  name: 'Sarah Chen',
  email: 'sarah.chen@company.com',
  avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  role: 'admin',
};

export const mockPolicies: RegistryPolicy[] = [
  {
    id: 'pol-001',
    name: 'Admin Access Control',
    description: 'Restricts administrative actions to users with admin role. This policy ensures that sensitive operations like user management, system configuration, and audit log access are only available to authorized administrators.',
    category: 'access-control',
    severity: 'critical',
    status: 'active',
    tags: ['rbac', 'admin', 'core'],
    author: 'Sarah Chen',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-03-20T14:45:00Z',
    currentVersion: '2.1.0',
    versions: [
      {
        version: '2.1.0',
        createdAt: '2024-03-20T14:45:00Z',
        createdBy: 'Sarah Chen',
        changelog: 'Added support for service accounts with admin privileges',
        regoCode: `package authz.admin

default allow := false

allow if {
    input.user.role == "admin"
}

allow if {
    input.user.type == "service_account"
    input.user.permissions[_] == "admin:*"
}`,
      },
      {
        version: '2.0.0',
        createdAt: '2024-02-10T09:00:00Z',
        createdBy: 'Sarah Chen',
        changelog: 'Refactored to use new RBAC schema',
        regoCode: `package authz.admin

default allow := false

allow if {
    input.user.role == "admin"
}`,
      },
      {
        version: '1.0.0',
        createdAt: '2024-01-15T10:30:00Z',
        createdBy: 'Sarah Chen',
        changelog: 'Initial policy creation',
        regoCode: `package authz.admin

default allow := false

allow if {
    input.user.is_admin == true
}`,
      },
    ],
    regoCode: `package authz.admin

default allow := false

allow if {
    input.user.role == "admin"
}

allow if {
    input.user.type == "service_account"
    input.user.permissions[_] == "admin:*"
}`,
    configJson: '{}',
    testCases: [
      {
        id: 'tc-001',
        name: 'Admin user should be allowed',
        description: 'Users with admin role should have access',
        input: { user: { role: 'admin', name: 'John' } },
        expectedResult: { allow: true },
        passed: true,
        lastRun: '2024-03-20T14:50:00Z',
      },
      {
        id: 'tc-002',
        name: 'Regular user should be denied',
        description: 'Users without admin role should be denied',
        input: { user: { role: 'user', name: 'Jane' } },
        expectedResult: { allow: false },
        passed: true,
        lastRun: '2024-03-20T14:50:00Z',
      },
      {
        id: 'tc-003',
        name: 'Service account with admin permissions',
        description: 'Service accounts with admin:* permission should be allowed',
        input: { user: { type: 'service_account', permissions: ['admin:*'] } },
        expectedResult: { allow: true },
        passed: true,
        lastRun: '2024-03-20T14:50:00Z',
      },
    ],
    stats: {
      totalEvaluations: 125840,
      allowRate: 12.5,
      denyRate: 87.5,
      avgExecutionTimeMs: 0.8,
      lastEvaluated: '2024-03-21T08:30:00Z',
    },
    approvedBy: 'Mike Johnson',
    approvedAt: '2024-03-20T15:00:00Z',
  },
  {
    id: 'pol-002',
    name: 'PII Data Access',
    description: 'Controls access to personally identifiable information based on data classification and user clearance level. Ensures GDPR and CCPA compliance.',
    category: 'compliance',
    severity: 'critical',
    status: 'active',
    tags: ['pii', 'gdpr', 'ccpa', 'data-protection'],
    author: 'Mike Johnson',
    createdAt: '2024-02-01T11:00:00Z',
    updatedAt: '2024-03-18T16:20:00Z',
    currentVersion: '1.2.0',
    versions: [
      {
        version: '1.2.0',
        createdAt: '2024-03-18T16:20:00Z',
        createdBy: 'Mike Johnson',
        changelog: 'Added region-based access controls for GDPR',
        regoCode: `package compliance.pii

default allow := false

allow if {
    input.user.clearance_level >= input.data.classification_level
    valid_purpose
    valid_region
}

valid_purpose if {
    input.purpose in input.user.approved_purposes
}

valid_region if {
    input.data.region == input.user.region
}

valid_region if {
    input.user.global_access == true
}`,
      },
    ],
    regoCode: `package compliance.pii

default allow := false

allow if {
    input.user.clearance_level >= input.data.classification_level
    valid_purpose
    valid_region
}

valid_purpose if {
    input.purpose in input.user.approved_purposes
}

valid_region if {
    input.data.region == input.user.region
}

valid_region if {
    input.user.global_access == true
}`,
    configJson: JSON.stringify({
      classification_levels: {
        public: 0,
        internal: 1,
        confidential: 2,
        restricted: 3,
      },
    }, null, 2),
    testCases: [
      {
        id: 'tc-004',
        name: 'Authorized access to PII',
        description: 'User with proper clearance should access PII',
        input: {
          user: { clearance_level: 3, approved_purposes: ['support'], region: 'EU', global_access: false },
          data: { classification_level: 2, region: 'EU' },
          purpose: 'support',
        },
        expectedResult: { allow: true },
        passed: true,
        lastRun: '2024-03-19T10:00:00Z',
      },
    ],
    stats: {
      totalEvaluations: 89420,
      allowRate: 34.2,
      denyRate: 65.8,
      avgExecutionTimeMs: 1.2,
      lastEvaluated: '2024-03-21T08:25:00Z',
    },
    approvedBy: 'Sarah Chen',
    approvedAt: '2024-03-18T17:00:00Z',
  },
  {
    id: 'pol-003',
    name: 'Cost Center Budget Limits',
    description: 'Enforces spending limits per cost center and requires additional approval for expenditures exceeding thresholds.',
    category: 'cost',
    severity: 'high',
    status: 'active',
    tags: ['budget', 'finance', 'approval'],
    author: 'Lisa Park',
    createdAt: '2024-01-20T09:15:00Z',
    updatedAt: '2024-03-10T11:30:00Z',
    currentVersion: '1.1.0',
    versions: [
      {
        version: '1.1.0',
        createdAt: '2024-03-10T11:30:00Z',
        createdBy: 'Lisa Park',
        changelog: 'Added quarterly budget rollover support',
        regoCode: `package cost.budget

default allow := false
default requires_approval := false

allow if {
    input.amount <= data.cost_centers[input.cost_center].limit
    input.amount <= remaining_budget
}

requires_approval if {
    input.amount > data.cost_centers[input.cost_center].approval_threshold
}

remaining_budget := data.cost_centers[input.cost_center].budget - data.cost_centers[input.cost_center].spent`,
      },
    ],
    regoCode: `package cost.budget

default allow := false
default requires_approval := false

allow if {
    input.amount <= data.cost_centers[input.cost_center].limit
    input.amount <= remaining_budget
}

requires_approval if {
    input.amount > data.cost_centers[input.cost_center].approval_threshold
}

remaining_budget := data.cost_centers[input.cost_center].budget - data.cost_centers[input.cost_center].spent`,
    configJson: JSON.stringify({
      cost_centers: {
        engineering: { budget: 500000, spent: 320000, limit: 50000, approval_threshold: 10000 },
        marketing: { budget: 200000, spent: 150000, limit: 25000, approval_threshold: 5000 },
        operations: { budget: 300000, spent: 180000, limit: 30000, approval_threshold: 8000 },
      },
    }, null, 2),
    testCases: [],
    stats: {
      totalEvaluations: 15230,
      allowRate: 78.4,
      denyRate: 21.6,
      avgExecutionTimeMs: 0.5,
      lastEvaluated: '2024-03-21T07:45:00Z',
    },
    approvedBy: 'Mike Johnson',
    approvedAt: '2024-03-10T14:00:00Z',
  },
  {
    id: 'pol-004',
    name: 'API Rate Limiting',
    description: 'Enforces rate limits on API endpoints based on user tier and endpoint sensitivity. Prevents abuse and ensures fair usage.',
    category: 'operational',
    severity: 'medium',
    status: 'active',
    tags: ['api', 'rate-limit', 'throttling'],
    author: 'Alex Rivera',
    createdAt: '2024-02-15T14:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    currentVersion: '1.0.1',
    versions: [
      {
        version: '1.0.1',
        createdAt: '2024-03-15T10:00:00Z',
        createdBy: 'Alex Rivera',
        changelog: 'Fixed edge case with burst limits',
        regoCode: `package api.ratelimit

default allow := false

allow if {
    user_tier := data.users[input.user_id].tier
    endpoint_limits := data.endpoints[input.endpoint].limits[user_tier]
    input.request_count <= endpoint_limits.per_minute
}

allow if {
    input.user_id in data.exempt_users
}`,
      },
    ],
    regoCode: `package api.ratelimit

default allow := false

allow if {
    user_tier := data.users[input.user_id].tier
    endpoint_limits := data.endpoints[input.endpoint].limits[user_tier]
    input.request_count <= endpoint_limits.per_minute
}

allow if {
    input.user_id in data.exempt_users
}`,
    configJson: JSON.stringify({
      endpoints: {
        '/api/search': { limits: { free: { per_minute: 10 }, pro: { per_minute: 100 }, enterprise: { per_minute: 1000 } } },
        '/api/export': { limits: { free: { per_minute: 1 }, pro: { per_minute: 10 }, enterprise: { per_minute: 100 } } },
      },
      exempt_users: ['system', 'admin'],
    }, null, 2),
    testCases: [],
    stats: {
      totalEvaluations: 2450000,
      allowRate: 94.2,
      denyRate: 5.8,
      avgExecutionTimeMs: 0.3,
      lastEvaluated: '2024-03-21T08:30:00Z',
    },
    approvedBy: 'Sarah Chen',
    approvedAt: '2024-03-15T11:00:00Z',
  },
  {
    id: 'pol-005',
    name: 'Production Deployment Guard',
    description: 'Controls deployments to production environment. Requires passing CI/CD checks, security scans, and approval from designated reviewers.',
    category: 'security',
    severity: 'critical',
    status: 'review',
    tags: ['deployment', 'cicd', 'production', 'security'],
    author: 'Sarah Chen',
    createdAt: '2024-03-19T09:00:00Z',
    updatedAt: '2024-03-20T16:00:00Z',
    currentVersion: '0.2.0',
    versions: [
      {
        version: '0.2.0',
        createdAt: '2024-03-20T16:00:00Z',
        createdBy: 'Sarah Chen',
        changelog: 'Added vulnerability scan requirements',
        regoCode: `package deploy.production

default allow := false

allow if {
    input.environment == "production"
    all_checks_passed
    security_approved
    has_required_approvals
}

all_checks_passed if {
    input.ci.status == "success"
    input.ci.coverage >= 80
    input.ci.lint_errors == 0
}

security_approved if {
    input.security_scan.critical == 0
    input.security_scan.high == 0
}

has_required_approvals if {
    count(input.approvals) >= 2
    some approval in input.approvals
    approval.role == "tech_lead"
}`,
      },
    ],
    regoCode: `package deploy.production

default allow := false

allow if {
    input.environment == "production"
    all_checks_passed
    security_approved
    has_required_approvals
}

all_checks_passed if {
    input.ci.status == "success"
    input.ci.coverage >= 80
    input.ci.lint_errors == 0
}

security_approved if {
    input.security_scan.critical == 0
    input.security_scan.high == 0
}

has_required_approvals if {
    count(input.approvals) >= 2
    some approval in input.approvals
    approval.role == "tech_lead"
}`,
    configJson: '{}',
    testCases: [
      {
        id: 'tc-005',
        name: 'Valid production deployment',
        description: 'Deployment with all requirements met',
        input: {
          environment: 'production',
          ci: { status: 'success', coverage: 85, lint_errors: 0 },
          security_scan: { critical: 0, high: 0, medium: 2 },
          approvals: [
            { user: 'john', role: 'tech_lead' },
            { user: 'jane', role: 'developer' },
          ],
        },
        expectedResult: { allow: true },
        passed: true,
        lastRun: '2024-03-20T16:30:00Z',
      },
    ],
    stats: {
      totalEvaluations: 0,
      allowRate: 0,
      denyRate: 0,
      avgExecutionTimeMs: 0,
    },
  },
  {
    id: 'pol-006',
    name: 'Data Retention Compliance',
    description: 'Enforces data retention policies based on data type and regulatory requirements. Ensures automatic deletion of expired data.',
    category: 'compliance',
    severity: 'high',
    status: 'draft',
    tags: ['retention', 'compliance', 'data-lifecycle'],
    author: 'Mike Johnson',
    createdAt: '2024-03-21T08:00:00Z',
    updatedAt: '2024-03-21T08:00:00Z',
    currentVersion: '0.1.0',
    versions: [
      {
        version: '0.1.0',
        createdAt: '2024-03-21T08:00:00Z',
        createdBy: 'Mike Johnson',
        changelog: 'Initial draft',
        regoCode: `package compliance.retention

default action := "retain"

action := "delete" if {
    time.now_ns() > input.data.expires_at
}

action := "archive" if {
    input.data.age_days > data.retention_rules[input.data.type].archive_after
    input.data.age_days <= data.retention_rules[input.data.type].delete_after
}`,
      },
    ],
    regoCode: `package compliance.retention

default action := "retain"

action := "delete" if {
    time.now_ns() > input.data.expires_at
}

action := "archive" if {
    input.data.age_days > data.retention_rules[input.data.type].archive_after
    input.data.age_days <= data.retention_rules[input.data.type].delete_after
}`,
    configJson: JSON.stringify({
      retention_rules: {
        logs: { archive_after: 30, delete_after: 90 },
        user_data: { archive_after: 365, delete_after: 730 },
        financial: { archive_after: 2555, delete_after: 3650 },
      },
    }, null, 2),
    testCases: [],
    stats: {
      totalEvaluations: 0,
      allowRate: 0,
      denyRate: 0,
      avgExecutionTimeMs: 0,
    },
  },
];

export const mockBlastRadiusResults: BlastRadiusResult[] = [
  {
    id: 'br-001',
    policyId: 'pol-001',
    policyName: 'Admin Access Control',
    executedAt: '2024-03-21T08:00:00Z',
    executedBy: 'Sarah Chen',
    totalRecords: 15420,
    allowedCount: 1928,
    deniedCount: 13492,
    errorCount: 0,
    executionTimeMs: 4523,
    sampleResults: [
      {
        id: 'sr-001',
        resourceType: 'User',
        resourceId: 'usr-123',
        resourceName: 'john.doe@company.com',
        decision: 'allow',
        reason: 'User has admin role',
        input: { user: { role: 'admin', name: 'John Doe' } },
      },
      {
        id: 'sr-002',
        resourceType: 'User',
        resourceId: 'usr-456',
        resourceName: 'jane.smith@company.com',
        decision: 'deny',
        reason: 'User does not have admin role',
        input: { user: { role: 'user', name: 'Jane Smith' } },
      },
      {
        id: 'sr-003',
        resourceType: 'ServiceAccount',
        resourceId: 'sa-001',
        resourceName: 'ci-pipeline',
        decision: 'allow',
        reason: 'Service account has admin:* permission',
        input: { user: { type: 'service_account', permissions: ['admin:*'] } },
      },
      {
        id: 'sr-004',
        resourceType: 'User',
        resourceId: 'usr-789',
        resourceName: 'bob.wilson@company.com',
        decision: 'deny',
        reason: 'User does not have admin role',
        input: { user: { role: 'viewer', name: 'Bob Wilson' } },
      },
      {
        id: 'sr-005',
        resourceType: 'ServiceAccount',
        resourceId: 'sa-002',
        resourceName: 'monitoring-agent',
        decision: 'deny',
        reason: 'Service account lacks admin permissions',
        input: { user: { type: 'service_account', permissions: ['read:*'] } },
      },
    ],
  },
  {
    id: 'br-002',
    policyId: 'pol-002',
    policyName: 'PII Data Access',
    executedAt: '2024-03-20T15:30:00Z',
    executedBy: 'Mike Johnson',
    totalRecords: 8930,
    allowedCount: 3054,
    deniedCount: 5876,
    errorCount: 0,
    executionTimeMs: 3210,
    sampleResults: [
      {
        id: 'sr-006',
        resourceType: 'DataRequest',
        resourceId: 'req-001',
        resourceName: 'Customer Export - EU',
        decision: 'allow',
        reason: 'User has sufficient clearance and matching region',
        input: {
          user: { clearance_level: 3, approved_purposes: ['support'], region: 'EU' },
          data: { classification_level: 2, region: 'EU' },
          purpose: 'support',
        },
      },
      {
        id: 'sr-007',
        resourceType: 'DataRequest',
        resourceId: 'req-002',
        resourceName: 'Customer Export - US',
        decision: 'deny',
        reason: 'Region mismatch',
        input: {
          user: { clearance_level: 3, approved_purposes: ['support'], region: 'EU' },
          data: { classification_level: 2, region: 'US' },
          purpose: 'support',
        },
      },
    ],
  },
];

export const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'evt-001',
    type: 'blast_radius_run',
    policyId: 'pol-001',
    policyName: 'Admin Access Control',
    userId: 'user-1',
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    timestamp: '2024-03-21T08:00:00Z',
    details: 'Tested against 15,420 records',
  },
  {
    id: 'evt-002',
    type: 'policy_updated',
    policyId: 'pol-005',
    policyName: 'Production Deployment Guard',
    userId: 'user-1',
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    timestamp: '2024-03-20T16:00:00Z',
    details: 'Updated to version 0.2.0',
  },
  {
    id: 'evt-003',
    type: 'policy_approved',
    policyId: 'pol-002',
    policyName: 'PII Data Access',
    userId: 'user-1',
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    timestamp: '2024-03-18T17:00:00Z',
    details: 'Approved for production',
  },
  {
    id: 'evt-004',
    type: 'blast_radius_run',
    policyId: 'pol-002',
    policyName: 'PII Data Access',
    userId: 'user-2',
    userName: 'Mike Johnson',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    timestamp: '2024-03-20T15:30:00Z',
    details: 'Tested against 8,930 records',
  },
  {
    id: 'evt-005',
    type: 'policy_created',
    policyId: 'pol-006',
    policyName: 'Data Retention Compliance',
    userId: 'user-2',
    userName: 'Mike Johnson',
    userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    timestamp: '2024-03-21T08:00:00Z',
    details: 'Created new draft policy',
  },
  {
    id: 'evt-006',
    type: 'test_run',
    policyId: 'pol-005',
    policyName: 'Production Deployment Guard',
    userId: 'user-1',
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    timestamp: '2024-03-20T16:30:00Z',
    details: '1 test passed',
  },
  {
    id: 'evt-007',
    type: 'policy_activated',
    policyId: 'pol-004',
    policyName: 'API Rate Limiting',
    userId: 'user-1',
    userName: 'Sarah Chen',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    timestamp: '2024-03-15T11:30:00Z',
    details: 'Deployed to production',
  },
];

export const mockDashboardStats: DashboardStats = {
  totalPolicies: 6,
  activePolicies: 4,
  draftPolicies: 1,
  pendingReview: 1,
  totalEvaluationsToday: 45230,
  avgAllowRate: 54.8,
  recentBlastRadiusTests: 2,
};
