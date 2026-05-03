# Backend Integration Analysis

## Overview

This document analyzes the mapping between the frontend OPA Policy Registry and the backend Guardrails Orchestrator Service.

## Key Domain Mapping

| Frontend Concept | Backend Concept | Notes |
|-----------------|-----------------|-------|
| Policy | Guardrail | Same concept, different naming |
| Policy Configuration | Guardrail Configuration | Stored separately in backend |
| Policy Code (Rego) | Not stored in guardrail | Backend doesn't store Rego code |

## Backend API Endpoints (Available)

### Guardrail Definitions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/registry/guardrails` | List all guardrail definitions |
| GET | `/api/v1/registry/guardrails/{id}` | Get full guardrail definition |
| POST | `/api/v1/registry/guardrails` | Create new guardrail definition |
| PUT | `/api/v1/registry/guardrails/{id}` | Update existing guardrail |
| DELETE | `/api/v1/registry/guardrails/{id}` | Delete guardrail |

**Guardrail Definition Fields:**
- `id` (string)
- `name` (string)
- `version` (string)
- `status` (ACTIVE/INACTIVE)
- `enforcementType` (MANDATORY/OPTIONAL)
- `kind` (PRECHECK)
- `resourceType` (LIGHTSPEED/VMFORGE)
- `resourceKind` (VIRTUAL_MACHINE/MONGO_DB/etc.)
- `description` (string)
- `owner` (string)
- `scopeExclusions` (array)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

### Guardrail Configurations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/registry/configurations` | List all configurations |
| GET | `/api/v1/registry/configurations/{guardrailId}` | Get configuration by guardrailId |
| PUT | `/api/v1/registry/configurations/{guardrailId}` | Create/replace configuration (upsert) |
| PATCH | `/api/v1/registry/configurations/{guardrailId}` | Partially update configuration |
| DELETE | `/api/v1/registry/configurations/{guardrailId}` | Delete configuration |

**Configuration Fields:**
- `guardrailId` (string)
- `global` (object - key/value config)
- `lobOverrides` (object - LOB-specific overrides)

### Evaluations (Query)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/evaluations/{eventId}` | Get single evaluation by eventId |
| GET | `/api/v1/evaluations?correlationId={id}` | Query by correlationId |
| GET | `/api/v1/evaluations/record?correlationId={id}&name={name}` | Lookup by correlationId and name |
| GET | `/api/v1/evaluations/app/{appId}` | List evaluation history for app |
| GET | `/api/v1/evaluations/all` | Paginated audit table |

**Evaluation Record Fields:**
- `eventId` (string)
- `correlationId` (string)
- `appId` (string)
- `overallVerdict` (PASSED/FAILED)
- `occurredAt` (timestamp)
- `source` (object: service, version, requestedBy)
- `metadata` (object: environment, cluster, namespace)
- `summary` (object: totalEvaluated, totalPassed, totalFailed, mandatoryFailed, optionalFailed)
- `evaluations` (array of individual evaluations)

## Frontend Model to Backend Model Mapping

### RegistryPolicy (Frontend) vs Guardrail Definition (Backend)

| Frontend Field | Backend Field | Mapping Notes |
|---------------|---------------|---------------|
| `id` | `id` | Direct mapping |
| `name` | `name` | Direct mapping |
| `description` | `description` | Direct mapping |
| `currentVersion` | `version` | Same data, different name |
| `author` | `owner` | Same data, different name |
| `status` | `status` | Map: draft→INACTIVE, active→ACTIVE |
| `createdAt` | `createdAt` | Direct mapping |
| `updatedAt` | `updatedAt` | Direct mapping |
| `severity` | - | **NOT IN BACKEND** |
| `category` | - | **NOT IN BACKEND** |
| `tags` | - | **NOT IN BACKEND** |
| `regoCode` | - | **NOT IN BACKEND** (Rego not stored) |
| `configJson` | Separate Configuration endpoint | Stored in configurations |
| `testCases` | - | **NOT IN BACKEND** |
| `stats` | - | **NOT IN BACKEND** |
| `versions` | - | **NOT IN BACKEND** |
| `approvedBy` | - | **NOT IN BACKEND** |
| `approvedAt` | - | **NOT IN BACKEND** |
| - | `enforcementType` | **NOT IN FRONTEND** |
| - | `kind` | **NOT IN FRONTEND** |
| - | `resourceType` | **NOT IN FRONTEND** |
| - | `resourceKind` | **NOT IN FRONTEND** |
| - | `scopeExclusions` | **NOT IN FRONTEND** |

## Composed Workflows

### Save Policy (Frontend Action)

When the frontend saves a "policy", it must perform multiple backend calls:

1. **Create/Update Guardrail Definition**
   - POST `/api/v1/registry/guardrails` (create)
   - PUT `/api/v1/registry/guardrails/{id}` (update)

2. **Create/Update Configuration**
   - PUT `/api/v1/registry/configurations/{guardrailId}` (upsert)

**Important:** The guardrail must be created first to get the `guardrailId` needed for the configuration endpoint.

### Load Policy (Frontend Action)

When loading a policy for display:

1. GET `/api/v1/registry/guardrails/{id}` (get guardrail definition)
2. GET `/api/v1/registry/configurations/{guardrailId}` (get configuration)

## Integration Status

### Endpoints That Can Be Integrated

| Frontend Flow | Backend Endpoint | Status |
|--------------|------------------|--------|
| List Policies | GET /api/v1/registry/guardrails | Can integrate |
| Get Policy Detail | GET /api/v1/registry/guardrails/{id} + configurations | Can integrate |
| Create Policy | POST guardrails + PUT configurations | Can integrate |
| Update Policy | PUT guardrails + PUT configurations | Can integrate |
| Delete Policy | DELETE guardrails + configurations | Can integrate |
| List Evaluations | GET /api/v1/evaluations/all | Can integrate |
| Get Evaluation | GET /api/v1/evaluations/{eventId} | Can integrate |

### Endpoints That Are MISSING

See `docs/missing-backend-endpoints.md` for detailed specifications of required endpoints.
