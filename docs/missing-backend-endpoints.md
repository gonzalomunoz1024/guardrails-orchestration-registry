# Missing Backend Endpoints

This document specifies backend endpoints required by the frontend that do not currently exist in the Guardrails Orchestrator Service.

---

## 1. Dashboard Statistics Aggregation

### Endpoint Purpose
Provides aggregated statistics for the dashboard view including total guardrails, active count, evaluation metrics, etc.

### Frontend Flow That Needs It
- `Dashboard.tsx` - Displays stat cards and evaluation metrics
- Currently uses: `mockDashboardStats`

### Specification

**HTTP Method:** GET

**Proposed Path:** `/api/v1/registry/stats` or `/api/v1/dashboard/stats`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:** None

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeRange` | string | No | Time range for evaluation stats (e.g., "24h", "7d", "30d") |

**Request Body:** None

**Example Request:**
```http
GET /api/v1/registry/stats?timeRange=24h
```

**Example Success Response (200 OK):**
```json
{
  "totalGuardrails": 6,
  "activeGuardrails": 4,
  "inactiveGuardrails": 2,
  "guardrailsByStatus": {
    "ACTIVE": 4,
    "INACTIVE": 1,
    "DRAFT": 1
  },
  "guardrailsByEnforcementType": {
    "MANDATORY": 3,
    "OPTIONAL": 3
  },
  "evaluations": {
    "total": 45230,
    "passed": 24826,
    "failed": 20404,
    "passRate": 54.8
  },
  "computedAt": "2024-03-21T08:30:00Z"
}
```

**Example Error Response (500 Internal Server Error):**
```json
{
  "error": "STATS_COMPUTATION_ERROR",
  "message": "Failed to compute dashboard statistics",
  "timestamp": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 200: Success
- 401: Unauthorized
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** HIGH - Dashboard is the landing page

**Naming Notes:** Backend should use "guardrails" terminology. Frontend will map to "policies".

---

## 2. Activity Events / Audit Log

### Endpoint Purpose
Provides a feed of recent activity events (guardrail created, updated, approved, evaluations run, etc.)

### Frontend Flow That Needs It
- `Dashboard.tsx` - "Recent Activity" section
- Currently uses: `mockActivityEvents`

### Specification

**HTTP Method:** GET

**Proposed Path:** `/api/v1/registry/activity` or `/api/v1/audit/events`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:** None

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 0) |
| `size` | number | No | Page size (default: 20, max: 100) |
| `guardrailId` | string | No | Filter by guardrail ID |
| `eventType` | string | No | Filter by event type |
| `userId` | string | No | Filter by user ID |
| `from` | string | No | ISO 8601 start timestamp |
| `to` | string | No | ISO 8601 end timestamp |

**Request Body:** None

**Example Request:**
```http
GET /api/v1/registry/activity?size=10&eventType=GUARDRAIL_CREATED
```

**Example Success Response (200 OK):**
```json
{
  "page": 0,
  "size": 10,
  "totalElements": 47,
  "totalPages": 5,
  "content": [
    {
      "id": "evt-001",
      "eventType": "GUARDRAIL_UPDATED",
      "guardrailId": "pol-001",
      "guardrailName": "Admin Access Control",
      "userId": "user-1",
      "userName": "Sarah Chen",
      "userAvatar": "https://example.com/avatar.jpg",
      "timestamp": "2024-03-21T08:00:00Z",
      "details": "Updated to version 2.1.0",
      "changes": {
        "version": { "from": "2.0.0", "to": "2.1.0" }
      }
    },
    {
      "id": "evt-002",
      "eventType": "BLAST_RADIUS_EXECUTED",
      "guardrailId": "pol-001",
      "guardrailName": "Admin Access Control",
      "userId": "user-1",
      "userName": "Sarah Chen",
      "timestamp": "2024-03-21T07:45:00Z",
      "details": "Tested against 15,420 records",
      "resultSummary": {
        "totalRecords": 15420,
        "allowed": 1928,
        "denied": 13492
      }
    }
  ]
}
```

**Expected Event Types:**
- `GUARDRAIL_CREATED`
- `GUARDRAIL_UPDATED`
- `GUARDRAIL_DELETED`
- `GUARDRAIL_ACTIVATED`
- `GUARDRAIL_DEACTIVATED`
- `CONFIGURATION_UPDATED`
- `BLAST_RADIUS_EXECUTED`
- `EVALUATION_COMPLETED`

**Example Error Response (400 Bad Request):**
```json
{
  "error": "INVALID_PARAMETER",
  "message": "Invalid event type: INVALID_TYPE",
  "timestamp": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 200: Success
- 400: Bad Request (invalid parameters)
- 401: Unauthorized
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** MEDIUM - Enhances dashboard but not critical

**Naming Notes:** Backend uses "guardrail", frontend displays as "policy"

---

## 3. Blast Radius Test Execution

### Endpoint Purpose
Triggers a blast radius test for a guardrail against a set of sample inputs/resources to determine the impact of the policy.

### Frontend Flow That Needs It
- `BlastRadius.tsx` - "Run Blast Radius Test" button
- Currently uses: Mock timeout with `mockBlastRadiusResults`

### Specification

**HTTP Method:** POST

**Proposed Path:** `/api/v1/registry/guardrails/{guardrailId}/blast-radius`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardrailId` | string | Yes | ID of the guardrail to test |

**Query Parameters:** None

**Request Body:**
```json
{
  "dataSource": "PRODUCTION_SAMPLE",
  "sampleSize": 10000,
  "filters": {
    "resourceType": "VIRTUAL_MACHINE",
    "environment": "production",
    "dateRange": {
      "from": "2024-03-01T00:00:00Z",
      "to": "2024-03-21T00:00:00Z"
    }
  },
  "includeInputSamples": true,
  "maxSamplesToReturn": 100
}
```

**Example Request:**
```http
POST /api/v1/registry/guardrails/pol-001/blast-radius
Content-Type: application/json

{
  "dataSource": "PRODUCTION_SAMPLE",
  "sampleSize": 10000
}
```

**Example Success Response (202 Accepted):**
```json
{
  "testId": "br-test-123",
  "guardrailId": "pol-001",
  "guardrailName": "Admin Access Control",
  "status": "RUNNING",
  "startedAt": "2024-03-21T08:30:00Z",
  "estimatedCompletionTime": "2024-03-21T08:32:00Z",
  "message": "Blast radius test started. Poll GET /api/v1/registry/blast-radius/{testId} for results."
}
```

**Example Error Response (404 Not Found):**
```json
{
  "error": "GUARDRAIL_NOT_FOUND",
  "message": "Guardrail with ID 'pol-999' not found",
  "timestamp": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 202: Accepted (test started)
- 400: Bad Request (invalid parameters)
- 401: Unauthorized
- 404: Guardrail not found
- 409: Conflict (test already running)
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** HIGH - Core feature for policy impact analysis

**Related Endpoint:** Needs GET endpoint to retrieve results (see #4)

---

## 4. Blast Radius Test Results

### Endpoint Purpose
Retrieves the results of a blast radius test by test ID, or lists recent blast radius results for a guardrail.

### Frontend Flow That Needs It
- `BlastRadius.tsx` - Displays test results and history
- Currently uses: `mockBlastRadiusResults`

### Specification

**HTTP Method:** GET

**Proposed Paths:**
- `/api/v1/registry/blast-radius/{testId}` - Get specific test result
- `/api/v1/registry/guardrails/{guardrailId}/blast-radius/history` - List test history

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `testId` | string | Yes (for single) | ID of the blast radius test |
| `guardrailId` | string | Yes (for history) | ID of the guardrail |

**Query Parameters (for history):**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `size` | number | No | Page size |

**Request Body:** None

**Example Request:**
```http
GET /api/v1/registry/blast-radius/br-test-123
```

**Example Success Response (200 OK):**
```json
{
  "id": "br-test-123",
  "guardrailId": "pol-001",
  "guardrailName": "Admin Access Control",
  "status": "COMPLETED",
  "executedAt": "2024-03-21T08:00:00Z",
  "executedBy": "Sarah Chen",
  "executionTimeMs": 4523,
  "summary": {
    "totalRecords": 15420,
    "allowedCount": 1928,
    "deniedCount": 13492,
    "errorCount": 0,
    "allowRate": 12.5,
    "denyRate": 87.5
  },
  "sampleResults": [
    {
      "id": "sr-001",
      "resourceType": "User",
      "resourceId": "usr-123",
      "resourceName": "john.doe@company.com",
      "decision": "ALLOW",
      "reason": "User has admin role",
      "input": {
        "user": { "role": "admin", "name": "John Doe" }
      }
    },
    {
      "id": "sr-002",
      "resourceType": "User",
      "resourceId": "usr-456",
      "resourceName": "jane.smith@company.com",
      "decision": "DENY",
      "reason": "User does not have admin role",
      "input": {
        "user": { "role": "user", "name": "Jane Smith" }
      }
    }
  ]
}
```

**Example Response for Running Test (200 OK):**
```json
{
  "id": "br-test-123",
  "guardrailId": "pol-001",
  "status": "RUNNING",
  "progress": {
    "processedRecords": 5000,
    "totalRecords": 15420,
    "percentComplete": 32.4
  },
  "startedAt": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 200: Success
- 401: Unauthorized
- 404: Test not found
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** HIGH - Required to display blast radius results

---

## 5. Guardrail Extended Metadata

### Endpoint Purpose
The current guardrail definition doesn't include fields needed by the frontend: `severity`, `category`, `tags`, `testCases`, `stats`, `versions`.

### Frontend Flow That Needs It
- `PolicyCatalog.tsx` - Filtering by category, severity; displaying tags
- `PolicyDetail.tsx` - Displaying stats, test cases, version history
- Currently uses: `mockPolicies` with rich metadata

### Options

**Option A: Extend Guardrail Definition Schema**

Add optional fields to the existing guardrail definition:

```json
{
  "id": "pol-001",
  "name": "Admin Access Control",
  "description": "...",
  "version": "2.1.0",
  "status": "ACTIVE",
  "enforcementType": "MANDATORY",
  "kind": "PRECHECK",
  "resourceType": "LIGHTSPEED",
  "resourceKind": "VIRTUAL_MACHINE",
  "owner": "Sarah Chen",

  "metadata": {
    "severity": "critical",
    "category": "access-control",
    "tags": ["rbac", "admin", "core"],
    "approvedBy": "Mike Johnson",
    "approvedAt": "2024-03-20T15:00:00Z"
  }
}
```

**Option B: Separate Metadata Endpoint**

**HTTP Method:** GET/PUT

**Proposed Path:** `/api/v1/registry/guardrails/{guardrailId}/metadata`

**Example Response:**
```json
{
  "guardrailId": "pol-001",
  "severity": "critical",
  "category": "access-control",
  "tags": ["rbac", "admin", "core"],
  "approvedBy": "Mike Johnson",
  "approvedAt": "2024-03-20T15:00:00Z"
}
```

**Priority:** MEDIUM - Frontend can work without these but UX is degraded

**Recommendation:** Option A (extend schema) is simpler and more cohesive

---

## 6. Guardrail Version History

### Endpoint Purpose
Provides version history for a guardrail, showing changes over time.

### Frontend Flow That Needs It
- `PolicyDetail.tsx` - "Versions" tab showing version history
- Currently uses: `mockPolicies[].versions`

### Specification

**HTTP Method:** GET

**Proposed Path:** `/api/v1/registry/guardrails/{guardrailId}/versions`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardrailId` | string | Yes | ID of the guardrail |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number |
| `size` | number | No | Page size |

**Request Body:** None

**Example Request:**
```http
GET /api/v1/registry/guardrails/pol-001/versions
```

**Example Success Response (200 OK):**
```json
{
  "guardrailId": "pol-001",
  "currentVersion": "2.1.0",
  "versions": [
    {
      "version": "2.1.0",
      "createdAt": "2024-03-20T14:45:00Z",
      "createdBy": "Sarah Chen",
      "changelog": "Added support for service accounts with admin privileges",
      "changes": {
        "description": { "from": "...", "to": "..." }
      }
    },
    {
      "version": "2.0.0",
      "createdAt": "2024-02-10T09:00:00Z",
      "createdBy": "Sarah Chen",
      "changelog": "Refactored to use new RBAC schema"
    },
    {
      "version": "1.0.0",
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": "Sarah Chen",
      "changelog": "Initial policy creation"
    }
  ]
}
```

**Expected Status Codes:**
- 200: Success
- 401: Unauthorized
- 404: Guardrail not found
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** LOW - Nice to have, not critical for MVP

---

## 7. Guardrail Evaluation Statistics

### Endpoint Purpose
Provides evaluation statistics for a specific guardrail (total evaluations, allow/deny rates, execution time).

### Frontend Flow That Needs It
- `PolicyDetail.tsx` - Stats display on overview tab
- `PolicyCatalog.tsx` - Shows eval count and allow rate on cards
- Currently uses: `mockPolicies[].stats`

### Specification

**HTTP Method:** GET

**Proposed Path:** `/api/v1/registry/guardrails/{guardrailId}/stats`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `guardrailId` | string | Yes | ID of the guardrail |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `timeRange` | string | No | Time range (e.g., "24h", "7d", "30d", "all") |

**Request Body:** None

**Example Request:**
```http
GET /api/v1/registry/guardrails/pol-001/stats?timeRange=30d
```

**Example Success Response (200 OK):**
```json
{
  "guardrailId": "pol-001",
  "guardrailName": "Admin Access Control",
  "timeRange": "30d",
  "computedAt": "2024-03-21T08:30:00Z",
  "stats": {
    "totalEvaluations": 125840,
    "passedEvaluations": 15730,
    "failedEvaluations": 110110,
    "allowRate": 12.5,
    "denyRate": 87.5,
    "avgExecutionTimeMs": 0.8,
    "p95ExecutionTimeMs": 1.2,
    "p99ExecutionTimeMs": 2.1,
    "lastEvaluatedAt": "2024-03-21T08:30:00Z"
  },
  "trend": {
    "evaluationsChange": 15.2,
    "allowRateChange": -2.1
  }
}
```

**Expected Status Codes:**
- 200: Success
- 401: Unauthorized
- 404: Guardrail not found
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** MEDIUM - Important for understanding policy effectiveness

**Note:** This data may be derivable from the evaluations endpoint, but a dedicated stats endpoint would be more efficient.

---

## 8. Test Cases Management

### Endpoint Purpose
CRUD operations for test cases associated with a guardrail.

### Frontend Flow That Needs It
- `PolicyDetail.tsx` - "Tests" tab showing test cases
- Currently uses: `mockPolicies[].testCases`

### Specification

**HTTP Methods:** GET, POST, PUT, DELETE

**Proposed Paths:**
- GET `/api/v1/registry/guardrails/{guardrailId}/test-cases` - List test cases
- POST `/api/v1/registry/guardrails/{guardrailId}/test-cases` - Create test case
- PUT `/api/v1/registry/guardrails/{guardrailId}/test-cases/{testCaseId}` - Update test case
- DELETE `/api/v1/registry/guardrails/{guardrailId}/test-cases/{testCaseId}` - Delete test case
- POST `/api/v1/registry/guardrails/{guardrailId}/test-cases/run` - Run all test cases

**Test Case Schema:**
```json
{
  "id": "tc-001",
  "name": "Admin user should be allowed",
  "description": "Users with admin role should have access",
  "input": {
    "user": { "role": "admin", "name": "John" }
  },
  "expectedResult": { "allow": true },
  "createdAt": "2024-03-20T14:00:00Z",
  "createdBy": "Sarah Chen"
}
```

**Run Test Cases Response:**
```json
{
  "guardrailId": "pol-001",
  "executedAt": "2024-03-21T08:30:00Z",
  "totalTests": 3,
  "passed": 3,
  "failed": 0,
  "results": [
    {
      "testCaseId": "tc-001",
      "name": "Admin user should be allowed",
      "passed": true,
      "actualResult": { "allow": true },
      "executionTimeMs": 0.5
    }
  ]
}
```

**Priority:** LOW - Can be deferred, manual testing is acceptable for MVP

---

## 9. Scope-Based Test Cases Fetch

### Endpoint Purpose
Fetches test case inputs from an external data source based on scope filters. Used during policy creation to retrieve real-world sample inputs for testing the policy against.

### Frontend Flow That Needs It
- `CreatePolicy.tsx` - "Scope" step (Step 3) where users specify Application ID, Organization, and Environment to fetch relevant test case inputs
- All three filter fields are optional - if none are provided, all test cases are returned
- Fetched test cases can be used as inputs in the policy editor for evaluation

### Specification

**HTTP Method:** GET

**Proposed Path:** `/api/v1/registry/test-inputs` or `/api/v1/scope/test-cases`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:** None

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `applicationId` | string | No | Filter by application ID |
| `organization` | string | No | Filter by organization/LOB |
| `environment` | string | No | Filter by environment (e.g., "dev", "staging", "prod") |
| `resourceType` | string | No | Filter by resource type (e.g., "lightspeed", "vmforge") |
| `resourceKind` | string | No | Filter by resource kind |
| `page` | number | No | Page number (default: 0) |
| `size` | number | No | Page size (default: 20, max: 100) |

**Request Body:** None

**Example Requests:**
```http
# Fetch all test cases (no filters)
GET /api/v1/registry/test-inputs

# Fetch test cases for a specific application
GET /api/v1/registry/test-inputs?applicationId=app-123

# Fetch test cases with multiple filters
GET /api/v1/registry/test-inputs?applicationId=app-123&environment=production&resourceType=lightspeed
```

**Example Success Response (200 OK):**
```json
{
  "page": 0,
  "size": 20,
  "totalElements": 156,
  "totalPages": 8,
  "content": [
    {
      "id": "tc-input-001",
      "name": "VM Provisioning Request - Large Instance",
      "description": "Sample input for provisioning a large VM in production",
      "applicationId": "app-123",
      "organization": "Platform Team",
      "environment": "production",
      "resourceType": "vmforge",
      "resourceKind": "VirtualMachine",
      "input": {
        "request": {
          "action": "provision",
          "resource": {
            "type": "virtual_machine",
            "size": "large",
            "region": "us-east-1"
          },
          "user": {
            "id": "user-456",
            "role": "developer",
            "department": "engineering"
          }
        }
      },
      "metadata": {
        "source": "production-logs",
        "capturedAt": "2024-03-15T10:30:00Z"
      }
    },
    {
      "id": "tc-input-002",
      "name": "AI Model Deployment Request",
      "description": "Sample input for deploying an AI model through Lightspeed",
      "applicationId": "app-789",
      "organization": "ML Ops",
      "environment": "staging",
      "resourceType": "lightspeed",
      "resourceKind": "ModelDeployment",
      "input": {
        "request": {
          "action": "deploy",
          "model": {
            "name": "recommendation-v2",
            "version": "2.1.0",
            "resources": {
              "gpu": 2,
              "memory": "32Gi"
            }
          },
          "user": {
            "id": "user-789",
            "role": "ml-engineer",
            "team": "recommendations"
          }
        }
      },
      "metadata": {
        "source": "staging-environment",
        "capturedAt": "2024-03-20T14:00:00Z"
      }
    }
  ],
  "filters": {
    "availableApplications": ["app-123", "app-456", "app-789"],
    "availableOrganizations": ["Platform Team", "ML Ops", "Security"],
    "availableEnvironments": ["dev", "staging", "production"]
  }
}
```

**Example Empty Response (200 OK):**
```json
{
  "page": 0,
  "size": 20,
  "totalElements": 0,
  "totalPages": 0,
  "content": [],
  "message": "No test cases found matching the specified filters"
}
```

**Example Error Response (400 Bad Request):**
```json
{
  "error": "INVALID_PARAMETER",
  "message": "Invalid environment value: 'invalid'. Must be one of: dev, staging, production",
  "timestamp": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 200: Success (may return empty content array)
- 400: Bad Request (invalid filter parameters)
- 401: Unauthorized
- 500: Internal Server Error

**Auth Requirements:** Bearer token required

**Priority:** HIGH - Required for the policy creation workflow to fetch real sample inputs

**Implementation Notes:**
- This endpoint should pull from historical evaluation data or a curated test data repository
- The `input` field should contain the actual JSON input that would be evaluated against a policy
- Consider caching frequently accessed test cases
- The `filters` object in the response helps the frontend populate dropdown options

**Frontend Usage:**
1. User enters filter criteria (all optional)
2. Frontend calls this endpoint with the filters
3. Results are displayed in a list
4. User can click "Use This Input" to populate the policy editor's input field with the test case's `input` value

---

## 10. Policy Code Storage (Rego)

### Endpoint Purpose
The backend currently stores guardrail definitions but not the actual Rego policy code. If policies need to be executable, the code must be stored.

### Frontend Flow That Needs It
- `PolicyDetail.tsx` - Displays policy code in editor
- `CreatePolicy.tsx` - Saves policy code
- Currently uses: `mockPolicies[].regoCode`

### Options

**Option A: Store in Guardrail Configuration**

Store Rego code as part of the configuration:

```json
{
  "guardrailId": "pol-001",
  "global": {
    "_regoPolicy": "package authz.admin\n\ndefault allow := false\n..."
  },
  "lobOverrides": {}
}
```

**Option B: Dedicated Policy Code Endpoint**

**Proposed Path:** `/api/v1/registry/guardrails/{guardrailId}/policy`

**PUT Request:**
```
Content-Type: text/plain

package authz.admin

default allow := false

allow if {
    input.user.role == "admin"
}
```

**GET Response:**
```
package authz.admin

default allow := false

allow if {
    input.user.role == "admin"
}
```

**Priority:** HIGH if policies need to be executable, LOW if they're just metadata

**Note:** This depends on whether the Guardrails Orchestrator actually executes OPA policies or delegates to a separate OPA server.

---

## 11. OPA Evaluation Passthrough

### Endpoint Purpose
Provides a passthrough to OPA for policy evaluation. This allows the frontend to talk to a single backend service instead of needing direct access to OPA.

### Frontend Flow That Needs It
- `CreatePolicy.tsx` - "Evaluate" button in the policy editor
- Policy testing/validation during development
- Currently: Frontend would need direct OPA access

### Specification

**HTTP Method:** POST

**Proposed Path:** `/api/v1/opa/evaluate`

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Path Parameters:** None

**Query Parameters:** None

**Request Body:**
```json
{
  "policy": "package authz.admin\n\ndefault allow := false\n\nallow if {\n    input.user.role == \"admin\"\n}",
  "input": {
    "user": {
      "role": "admin",
      "name": "John Doe"
    }
  },
  "data": {
    "roles": ["admin", "user", "viewer"]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `policy` | string | Yes | Rego policy code to evaluate |
| `input` | object | Yes | Input data for the policy |
| `data` | object | No | Reference data (OPA's `data` document) |

**Example Request:**
```http
POST /api/v1/opa/evaluate
Content-Type: application/json

{
  "policy": "package test\n\ndefault allow := false\n\nallow if input.admin == true",
  "input": { "admin": true }
}
```

**Example Success Response (200 OK):**
```json
{
  "result": {
    "allow": true
  },
  "metrics": {
    "evaluation_time_ms": 1.2,
    "compile_time_ms": 0.8
  }
}
```

**Example Error Response - Invalid Policy (400 Bad Request):**
```json
{
  "error": "POLICY_COMPILE_ERROR",
  "message": "1 error occurred: policy.rego:3: rego_parse_error: unexpected token",
  "location": {
    "file": "policy.rego",
    "row": 3,
    "col": 1
  }
}
```

**Example Error Response - Evaluation Error (400 Bad Request):**
```json
{
  "error": "EVALUATION_ERROR",
  "message": "undefined ref: input.user.roles",
  "timestamp": "2024-03-21T08:30:00Z"
}
```

**Expected Status Codes:**
- 200: Success - policy evaluated
- 400: Bad Request - invalid policy or evaluation error
- 401: Unauthorized
- 500: Internal Server Error - OPA unavailable
- 503: Service Unavailable - OPA connection failed

**Auth Requirements:** Bearer token required

**Priority:** HIGH - Required for policy development workflow

**Implementation Notes:**
The backend should:
1. Create a temporary policy in OPA with a unique ID (e.g., `playground-{uuid}`)
2. Upload any provided `data` to OPA
3. Evaluate the policy with the provided `input`
4. Clean up the temporary policy
5. Return the result

**Alternative: Validate-Only Endpoint**

For syntax validation without full evaluation:

**HTTP Method:** POST

**Proposed Path:** `/api/v1/opa/validate`

**Request Body:**
```json
{
  "policy": "package test\n\ndefault allow := false"
}
```

**Success Response (200 OK):**
```json
{
  "valid": true
}
```

**Error Response (400 Bad Request):**
```json
{
  "valid": false,
  "errors": [
    {
      "message": "rego_parse_error: unexpected token",
      "location": { "row": 3, "col": 1 }
    }
  ]
}
```

---

## Summary Table

| # | Endpoint | Priority | Required For |
|---|----------|----------|--------------|
| 1 | Dashboard Stats | HIGH | Dashboard landing page |
| 2 | Activity Events | MEDIUM | Dashboard activity feed |
| 3 | Blast Radius Execution | HIGH | Core blast radius feature |
| 4 | Blast Radius Results | HIGH | Core blast radius feature |
| 5 | Extended Metadata | MEDIUM | Filtering, categories, tags |
| 6 | Version History | LOW | Version tracking |
| 7 | Evaluation Stats | MEDIUM | Policy effectiveness metrics |
| 8 | Test Cases Management | LOW | Policy testing CRUD |
| 9 | Scope-Based Test Cases Fetch | HIGH | Policy creation workflow (fetch sample inputs) |
| 10 | Policy Code Storage | HIGH/LOW | Depends on execution model |
| 11 | OPA Evaluation Passthrough | HIGH | Policy editor evaluation |

---

## Composed Workflows

### Save Policy Workflow

The frontend "Save Policy" action requires:

1. **POST/PUT Guardrail Definition**
   - Endpoint: POST `/api/v1/registry/guardrails` (create) or PUT `.../guardrails/{id}` (update)
   - Contains: name, description, version, status, enforcementType, kind, resourceType, resourceKind, owner

2. **PUT Configuration**
   - Endpoint: PUT `/api/v1/registry/configurations/{guardrailId}`
   - Contains: global config object, lobOverrides
   - **Depends on:** guardrailId from step 1 (for new policies)

3. **(If supported) Store Policy Code**
   - Endpoint: PUT `/api/v1/registry/guardrails/{guardrailId}/policy` (proposed)
   - Contains: Rego code
   - **Depends on:** guardrailId from step 1

**Workflow Order:**
```
1. Create/Update Guardrail Definition → get guardrailId
2. Store Configuration using guardrailId
3. (Optional) Store Policy Code using guardrailId
```

**Error Handling:**
- If step 2 fails after step 1 succeeds, the frontend should:
  - Retry step 2
  - Or rollback step 1 (DELETE guardrail)
  - Or mark the save as partial failure and inform the user
