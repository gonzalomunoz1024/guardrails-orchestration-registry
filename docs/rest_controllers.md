# REST Controllers — Postman Reference

Every endpoint the UI calls, with realistic request bodies and example responses.

## Base URL

All endpoints are absolute paths under **`/v1/utilities`** — there is no `/api`
prefix.

For Postman, set a collection variable:

| Variable | Example value |
|----------|----------------|
| `{{baseUrl}}` | `http://localhost:8181` |

Then prefix every request with `{{baseUrl}}` (e.g.
`{{baseUrl}}/v1/utilities/registry/guardrails`). All requests use:

```
Content-Type: application/json
Accept: application/json
```

### Enum reference

Wire format is `SCREAMING_SNAKE`. The UI maps these to display labels.

| Enum | Allowed values |
|------|----------------|
| `status` | `ACTIVE`, `INACTIVE`, `DRAFT` |
| `enforcementType` | `MANDATORY`, `OPTIONAL`, `WARNING` |
| `stage` | `PRECHECK`, `APPROVAL`, `POSTCHECK` |
| `resourceKind` | `CNAME`, `MONGODB`, `VIRTUAL_MACHINE` |
| `verdict` / `overallVerdict` | `PASSED`, `FAILED` |

`version` is always `MAJOR.MINOR` (e.g. `"1.0"`). `(guardrailId, version)` is
the immutable composite key.

---

## Guardrails (Registry)

### `GET /v1/utilities/registry/guardrails`
List the latest version of every guardrail.

**Response 200**
```json
[
  {
    "guardrailId": "checkout-service-deployment-gate",
    "guardrailName": "Checkout Service Deployment Gate",
    "version": "1.2",
    "status": "ACTIVE",
    "enforcementType": "MANDATORY",
    "stage": "PRECHECK",
    "resourceKind": "VIRTUAL_MACHINE"
  },
  {
    "guardrailId": "mongo-shard-key-required",
    "guardrailName": "MongoDB shard key required",
    "version": "1.0",
    "status": "DRAFT",
    "enforcementType": "WARNING",
    "stage": "PRECHECK",
    "resourceKind": "MONGODB"
  }
]
```

---

### `GET /v1/utilities/registry/guardrails/{guardrailId}`
Fetch the latest version of one guardrail (full definition).

**Path params**
- `guardrailId` — e.g. `checkout-service-deployment-gate`

**Response 200**
```json
{
  "guardrailId": "checkout-service-deployment-gate",
  "guardrailName": "Checkout Service Deployment Gate",
  "description": "Blocks deployments unless the repo is registered and a VM order exists.",
  "version": "1.2",
  "status": "ACTIVE",
  "enforcementType": "MANDATORY",
  "stage": "PRECHECK",
  "resourceKind": "VIRTUAL_MACHINE",
  "owner": "platform-team",
  "scopeExclusions": [
    { "lob": "research", "reason": "Sandbox-only; opted out via change advisory board." }
  ],
  "createdAt": "2026-04-12T15:08:22Z"
}
```

---

### `POST /v1/utilities/registry/guardrails`
Create a new guardrail at version `1.0`. The server returns 409 if
`guardrailId` already exists at `1.0`.

**Body**
```json
{
  "guardrailId": "checkout-service-deployment-gate",
  "guardrailName": "Checkout Service Deployment Gate",
  "description": "Blocks deployments unless the repo is registered and a VM order exists.",
  "version": "1.0",
  "status": "DRAFT",
  "enforcementType": "MANDATORY",
  "stage": "PRECHECK",
  "resourceKind": "VIRTUAL_MACHINE",
  "owner": "platform-team",
  "scopeExclusions": []
}
```

**Response 201** — full `GuardrailDefinition` (same shape as the GET single response above).

---

### `PUT /v1/utilities/registry/guardrails/{guardrailId}`
**Does not mutate.** Creates a **new immutable version**; the server
auto-increments the MINOR component (e.g. `1.2` → `1.3`). Callers omit
`version` — the server derives it.

**Path params**
- `guardrailId`

**Body** (all fields optional; send only what changed)
```json
{
  "guardrailName": "Checkout Service Deployment Gate",
  "description": "Now also requires an approved change ticket.",
  "status": "ACTIVE",
  "enforcementType": "MANDATORY",
  "stage": "PRECHECK",
  "resourceKind": "VIRTUAL_MACHINE",
  "owner": "platform-team",
  "scopeExclusions": [
    { "lob": "research", "reason": "Sandbox-only." }
  ]
}
```

**Response 200** — full `GuardrailDefinition` of the new version (e.g.
`"version": "1.3"`).

---

### `DELETE /v1/utilities/registry/guardrails/{guardrailId}`
Delete the guardrail (and its configuration). Idempotent — returns 204 on
success.

**Path params**
- `guardrailId`

**Response 204** — no body.

---

### `GET /v1/utilities/registry/guardrails/{guardrailId}/versions`
List every immutable version of a guardrail (newest first).

**Path params**
- `guardrailId`

**Response 200**
```json
[
  { "guardrailId": "checkout-service-deployment-gate", "version": "1.2" },
  { "guardrailId": "checkout-service-deployment-gate", "version": "1.1" },
  { "guardrailId": "checkout-service-deployment-gate", "version": "1.0" }
]
```

---

### `GET /v1/utilities/registry/guardrails/{guardrailId}/versions/{version}`
Full `GuardrailDefinition` for a pinned version — used by suites to resolve
their members.

**Path params**
- `guardrailId`
- `version` — e.g. `1.0`

**Response 200** — same shape as the single-guardrail GET above (with the
pinned `version`).

---

### `GET /v1/utilities/registry/guardrails/{guardrailId}/versions/{version}/input-schema`
The published **input contract** (JSON Schema + example payloads) for a
guardrail version. Returns 404 if no contract has been published.

**Path params**
- `guardrailId`
- `version`

**Response 200**
```json
{
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "repository": {
        "type": "object",
        "properties": {
          "id":   { "type": "string" },
          "name": { "type": "string" }
        },
        "required": ["id", "name"]
      },
      "order": {
        "type": "object",
        "properties": {
          "orderId": { "type": "string" },
          "region":  { "type": "string" }
        },
        "required": ["orderId"]
      }
    },
    "required": ["repository", "order"]
  },
  "examples": [
    {
      "name": "happy-path",
      "payload": "{\n  \"repository\": { \"id\": \"checkout-svc\", \"name\": \"checkout-svc\" },\n  \"order\":      { \"orderId\": \"ORD-1001\", \"region\": \"us-east-1\" }\n}"
    },
    {
      "name": "missing-region",
      "payload": "{\n  \"repository\": { \"id\": \"checkout-svc\", \"name\": \"checkout-svc\" },\n  \"order\":      { \"orderId\": \"ORD-1002\" }\n}"
    }
  ]
}
```

---

## Configurations (Registry)

### `GET /v1/utilities/registry/configurations`
List every configuration record.

**Response 200**
```json
[
  {
    "guardrailId": "checkout-service-deployment-gate",
    "global":      { "approvedRegion": "us-east-1", "allowAll": false },
    "lobOverrides": {
      "payments": { "approvedRegion": "us-west-2" }
    }
  }
]
```

---

### `GET /v1/utilities/registry/configurations/{guardrailId}`
Configuration for one guardrail. Returns 404 if none exists.

**Path params**
- `guardrailId`

**Response 200**
```json
{
  "guardrailId": "checkout-service-deployment-gate",
  "global":      { "approvedRegion": "us-east-1", "allowAll": false },
  "lobOverrides": {
    "payments": { "approvedRegion": "us-west-2" }
  }
}
```

---

### `PUT /v1/utilities/registry/configurations/{guardrailId}`
Upsert (create-or-replace) configuration.

**Path params**
- `guardrailId`

**Body**
```json
{
  "global": {
    "approvedRegion": "us-east-1",
    "allowAll": false
  },
  "lobOverrides": {
    "payments": { "approvedRegion": "us-west-2" }
  }
}
```

**Response 200** — full `GuardrailConfiguration`.

---

### `DELETE /v1/utilities/registry/configurations/{guardrailId}`
Remove the configuration. 404 is acceptable / idempotent.

**Response 204** — no body.

---

## Suites (Registry)

A **Guardrail Suite** is an unversioned, mutable grouping that **pins
`(guardrailId, version)`** members. Updating a guardrail never changes what
a suite resolves.

### `GET /v1/utilities/registry/suites`
List every suite.

**Response 200**
```json
[
  {
    "suiteId": "production-readiness",
    "name": "Production Readiness",
    "description": "Checks every new service must pass before going live.",
    "owner": "platform-team",
    "status": "ACTIVE",
    "members": [
      {
        "guardrailId": "checkout-service-deployment-gate",
        "version": "1.0",
        "guardrailName": "Checkout Service Deployment Gate",
        "stage": "PRECHECK",
        "enforcementType": "MANDATORY",
        "resourceKind": "VIRTUAL_MACHINE",
        "status": "ACTIVE"
      },
      {
        "guardrailId": "mongo-shard-key-required",
        "version": "1.0",
        "guardrailName": "MongoDB shard key required",
        "stage": "PRECHECK",
        "enforcementType": "WARNING",
        "resourceKind": "MONGODB",
        "status": "ACTIVE"
      }
    ],
    "createdAt": "2026-05-02T09:14:00Z"
  }
]
```

---

### `GET /v1/utilities/registry/suites/{suiteId}`
One suite — same shape as a list entry.

**Path params**
- `suiteId`

---

### `POST /v1/utilities/registry/suites`
Create a suite. **Members are passed as `GuardrailRef[]`** — only
`guardrailId` + `version`. The server resolves display facets on read.

**Body**
```json
{
  "name": "Production Readiness",
  "description": "Checks every new service must pass before going live.",
  "owner": "platform-team",
  "status": "DRAFT",
  "members": [
    { "guardrailId": "checkout-service-deployment-gate", "version": "1.0" },
    { "guardrailId": "mongo-shard-key-required",         "version": "1.0" }
  ]
}
```

**Response 201** — full `GuardrailSuite` (with resolved member facets).

**Validation:** the server rejects any member whose `(guardrailId, version)`
does not reference an existing immutable guardrail version.

---

### `PUT /v1/utilities/registry/suites/{suiteId}`
Update a suite. All fields are optional. `members` (when present) replaces
the full pinned set.

**Path params**
- `suiteId`

**Body**
```json
{
  "name": "Production Readiness",
  "description": "Adds the MongoDB warning guardrail.",
  "status": "ACTIVE",
  "members": [
    { "guardrailId": "checkout-service-deployment-gate", "version": "1.2" },
    { "guardrailId": "mongo-shard-key-required",         "version": "1.0" }
  ]
}
```

**Response 200** — full `GuardrailSuite`.

---

### `DELETE /v1/utilities/registry/suites/{suiteId}`
**Response 204** — no body.

---

## Stats (Registry)

### `GET /v1/utilities/registry/stats?timeRange=24h`
Aggregate counts the dashboard uses.

**Query params**
- `timeRange` — one of `1h | 6h | 24h | 7d | 30d` (default `24h`).

**Response 200**
```json
{
  "totalGuardrails": 12,
  "activeGuardrails": 9,
  "inactiveGuardrails": 3,
  "guardrailsByStatus": {
    "ACTIVE": 9,
    "DRAFT": 2,
    "INACTIVE": 1
  },
  "guardrailsByEnforcementType": {
    "MANDATORY": 7,
    "OPTIONAL": 3,
    "WARNING": 2
  },
  "evaluations": {
    "total":    14820,
    "passed":   14201,
    "failed":     619,
    "passRate":   95.82
  },
  "computedAt": "2026-05-29T08:00:00Z"
}
```

---

## Test Inputs (Registry)

Backed by OpenSearch scroll — returns raw `_source` hits used to drive
Blast Radius testing in the UI.

### `GET /v1/utilities/registry/test-inputs`

**Query params** (all optional)
- `applicationId`, `organization`, `environment`, `resourceType`, `resourceKind`
- `scrollId` — when continuing a previous scroll. **If `scrollId` is set,
  filters are ignored** (they live in the scroll context).
- `limit` — page size (default `50`).

Example:
`GET /v1/utilities/registry/test-inputs?applicationId=checkout-svc&environment=prod&limit=25`

**Response 200**
```json
{
  "scrollId": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAA…",
  "total": 1284,
  "hits": [
    {
      "id": "evt-9a4f0e",
      "_source": {
        "metadata": { "eventId": "evt-9a4f0e", "correlationId": "corr-001" },
        "spec": {
          "metadata": {
            "appId": "checkout-svc",
            "organization": "payments",
            "environment": "prod",
            "resourceType": "deployment",
            "resourceKind": "VIRTUAL_MACHINE",
            "guardrailId": "checkout-service-deployment-gate",
            "name": "checkout-svc/prod/deploy-9a4f0e"
          }
        },
        "kind": "VIRTUAL_MACHINE",
        "repository": { "id": "checkout-svc", "name": "checkout-svc" },
        "order":      { "orderId": "ORD-1001", "region": "us-east-1" }
      }
    }
  ]
}
```

Continue the scroll:
`GET /v1/utilities/registry/test-inputs?scrollId=DXF1ZXJ5QW5kRmV0Y2gBAAAAAAAA…&limit=25`

---

## Evaluations

### `GET /v1/utilities/evaluations/all?page=0&size=20`
Paginated list of completed evaluations.

**Query params**
- `page` — 0-indexed (default `0`)
- `size` — page size (default `20`)

**Response 200**
```json
{
  "page": 0,
  "size": 20,
  "totalElements": 1284,
  "totalPages": 65,
  "content": [
    {
      "eventId": "evt-9a4f0e",
      "correlationId": "corr-001",
      "appId": "checkout-svc",
      "overallVerdict": "PASSED",
      "occurredAt": "2026-05-29T07:55:12Z",
      "source":   { "service": "checkout-svc", "version": "2026.05.29-1", "requestedBy": "ci-bot" },
      "metadata": { "environment": "prod", "cluster": "use1-prod", "namespace": "checkout" },
      "summary": {
        "totalEvaluated":   2,
        "totalPassed":      2,
        "totalFailed":      0,
        "mandatoryFailed":  0,
        "optionalFailed":   0
      },
      "evaluations": [
        {
          "guardrailId": "checkout-service-deployment-gate",
          "guardrailName": "Checkout Service Deployment Gate",
          "verdict": "PASSED",
          "enforcementType": "MANDATORY"
        }
      ]
    }
  ]
}
```

---

### `GET /v1/utilities/evaluations/{eventId}`
Single evaluation record — same shape as one entry in the `content` array above.

**Path params**
- `eventId`

---

### `GET /v1/utilities/evaluations?correlationId={correlationId}`
Every evaluation record sharing a correlation id (i.e. all the guardrails run
for one upstream request).

**Query params**
- `correlationId` (required)

**Response 200** — `EvaluationRecord[]`.

---

### `GET /v1/utilities/evaluations/app/{appId}`
Evaluation history for one application.

**Path params**
- `appId`

**Response 200** — `EvaluationRecord[]`.

---

## OPA Passthrough

Used by the Policy Studio to run live evaluation/validation against the
embedded OPA. The backend proxies to OPA.

### `POST /v1/utilities/opa/evaluate`
Evaluate one Rego policy with a synthetic input.

**Body**
```json
{
  "policy": "package guardrail\n\ndefault allow = false\nallow if input.repository.id != \"\"\n",
  "input": {
    "guardrail": {
      "id": "checkout-service-deployment-gate",
      "name": "Checkout Service Deployment Gate",
      "version": "1.0",
      "enforcementType": "MANDATORY"
    },
    "configuration": {
      "approvedRegion": "us-east-1"
    },
    "external": {
      "repoRegistry": { "status": "REGISTERED", "owner": "checkout-team" }
    },
    "repository": { "id": "checkout-svc", "name": "checkout-svc" },
    "order":      { "orderId": "ORD-1001", "region": "us-east-1" }
  }
}
```

**Response 200**
```json
{
  "result": { "allow": true }
}
```

**Response 400 (compile error — surfaced verbatim from OPA)**
```json
{
  "code": "rego_parse_error",
  "message": "rego_parse_error: unexpected eof token",
  "errors": [
    {
      "code": "rego_parse_error",
      "message": "unexpected eof token",
      "location": { "file": "policy.rego", "row": 4, "col": 1 }
    }
  ]
}
```

---

### `POST /v1/utilities/opa/validate`
Validate Rego syntax without executing.

**Body**
```json
{
  "policy": "package guardrail\n\nallow if input.repository.id != \"\"\n"
}
```

**Response 200 (valid)**
```json
{ "valid": true }
```

**Response 200 (invalid)**
```json
{
  "valid": false,
  "errors": [
    { "message": "rego_parse_error: unexpected eof token" }
  ]
}
```

---

## Policies (legacy)

Older endpoints retained for the `policyApi` client. Most of the UI now uses
the `/registry/guardrails` paths above — these are kept for backward
compatibility.

### `GET /v1/utilities/policies` — list `Policy[]`
### `GET /v1/utilities/policies/{id}` — one `Policy`
### `POST /v1/utilities/policies` — create
### `PUT /v1/utilities/policies/{id}` — update
### `DELETE /v1/utilities/policies/{id}` — delete

### `POST /v1/utilities/policies/validate`
**Body**
```json
{ "code": "package p\n\ndefault allow = false\n" }
```
**Response 200**
```json
{ "valid": true, "errors": [] }
```

---

## Datasources

Backs the studio's datasource browser (`useDatasources`).

### `GET /v1/utilities/datasources`
**Response 200**
```json
[
  {
    "id": "approved-regions",
    "name": "Approved regions",
    "description": "Region allowlist sourced from compliance.",
    "type": "static",
    "schema": { "type": "array", "items": { "type": "string" } }
  }
]
```

### `GET /v1/utilities/datasources/{id}`
**Response 200** — one `Datasource` (same shape as a list entry).

### `GET /v1/utilities/datasources/{id}/value`
The resolved value the studio injects into the OPA input.

**Response 200**
```json
{
  "id": "approved-regions",
  "value": ["us-east-1", "us-west-2", "eu-west-1"],
  "fetchedAt": "2026-05-29T08:00:00Z"
}
```

---

## Error responses (any controller)

```json
{
  "error":     "ValidationError",
  "message":   "guardrailName is required",
  "timestamp": "2026-05-29T08:00:00Z",
  "path":      "/v1/utilities/registry/guardrails",
  "status":    400
}
```

Common shapes you'll see:

| Status | Meaning |
|--------|---------|
| 400 | Malformed body / bad enum value / missing required field |
| 404 | Resource (or `(guardrailId, version)`) does not exist |
| 409 | Conflict — e.g. `guardrailId` already exists at `1.0` |
| 5xx | Backend or OPA outage; check logs |
