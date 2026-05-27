# Backend Implementation Plan — Guardrail Restructure + Suites

This is the backend counterpart to the frontend change. It is written as small,
independently-shippable phases for the backend agent. The frontend mirrors the
backend DTOs in `src/types/guardrail.types.ts`; keep these contracts in sync.

**Wire conventions:** enums are `SCREAMING_SNAKE`; timestamps are ISO-8601 UTC;
all guardrail endpoints live under `/v1/registry`.

## North-star model

```jsonc
// Guardrail (immutable, versioned record)
{
  "guardrailId": "checkout_service_gate",   // renamed from id; stable slug
  "guardrailName": "Checkout Service Gate", // renamed from name
  "version": "1.0",                          // MAJOR.MINOR (no patch)
  "description": "...",
  "status": "DRAFT",                         // ACTIVE | INACTIVE | DRAFT
  "enforcementType": "MANDATORY",            // MANDATORY | OPTIONAL | WARNING  (+WARNING)
  "stage": "PRECHECK",                       // PRECHECK | APPROVAL | POSTCHECK (renamed from kind; +APPROVAL)
  "resourceKind": "VIRTUAL_MACHINE",         // CNAME | MONGODB | VIRTUAL_MACHINE (now an enum)
  "owner": "user@example.com",
  "createdAt": "2026-05-27T12:00:00Z",
  "scopeExclusions": [ { "lob": "...", "reason": "..." } ]
  // REMOVED: resourceType, updatedAt
}
```

**Hard rule:** `(guardrailId, version)` is unique and **immutable**. Once written,
a version's record + artifacts are never mutated. Suites pin specific
`(guardrailId, version)` pairs and must keep resolving them forever.

---

## Phase B1 — Model & enum migration

**Goal:** adopt the new field/enum set without versioning behavior yet.

- Rename columns/fields: `id → guardrailId`, `name → guardrailName`, `kind → stage`.
- `enforcementType`: add `WARNING`.
- `stage`: add `APPROVAL`.
- `resourceKind`: constrain to enum `{CNAME, MONGODB, VIRTUAL_MACHINE}` (map legacy values; default unknown → reject or `VIRTUAL_MACHINE` per migration policy).
- **Remove** `resourceType` and `updatedAt` from the model, DTOs, and persistence.
- `version` format becomes `MAJOR.MINOR` (validate `^\d+\.\d+$`); migrate existing `x.y.z → x.y`.

**Migration:** backfill existing rows (drop resourceType/updatedAt, coerce version, map kind→stage, map resourceKind). Preserve `createdAt`.

**Acceptance:** GET/POST/PUT compile against the new `GuardrailDefinition`,
`CreateGuardrailRequest`, `UpdateGuardrailRequest` shapes (see frontend mirror).
No endpoint returns `resourceType`/`updatedAt`.

---

## Phase B2 — Immutable versioning + uniqueness

**Goal:** make `(guardrailId, version)` the immutable primary key and change write semantics.

- Storage keyed by composite `(guardrailId, version)`. Enforce uniqueness; reject duplicate writes (HTTP 409).
- **POST `/v1/registry/guardrails`** → creates the guardrail at version **`1.0`**. 409 if `guardrailId` already exists at `1.0`.
- **PUT `/v1/registry/guardrails/{guardrailId}`** → does **not** mutate; creates a **new immutable version**:
  - Default: auto-increment **MINOR** from the current latest (`1.3 → 1.4`).
  - Explicit MAJOR bump via `?bump=major` (or body flag) → `1.x → 2.0`.
  - Returns the newly created `GuardrailDefinition`.
- **New** `GET /v1/registry/guardrails/{guardrailId}/versions` → `GuardrailRef[]` (`{guardrailId, version}` for all versions, newest first).
- **New** `GET /v1/registry/guardrails/{guardrailId}/versions/{version}` → full `GuardrailDefinition` for a pinned version.
- `GET /v1/registry/guardrails` (list) → latest version per `guardrailId`.

**Acceptance:** Publishing `1.1` leaves `1.0` byte-identical; `GET .../versions` lists both; fetching `1.0` after `1.1` exists still returns the original.

---

## Phase B3 — Input schema contract storage

**Goal:** persist + serve each guardrail version's input contract (JSON Schema + examples).

The frontend studio publishes, per version, to GitHub (source of truth):
```
guardrails/<guardrailId>/<version>/guardrail.yaml
guardrails/<guardrailId>/<version>/policy.rego
guardrails/<guardrailId>/<version>/configuration.yaml   # optional
guardrails/<guardrailId>/<version>/input-schema.json    # JSON Schema (draft-07) of the document
guardrails/<guardrailId>/<version>/examples/<name>.json # example input payloads
```

- Backend ingests (on PR merge/registration) and caches these artifacts keyed by `(guardrailId, version)`.
- **New** `GET /v1/registry/guardrails/{guardrailId}/versions/{version}/input-schema` →
  `{ "schema": <JSONSchema>, "examples": [ { "name": "...", "payload": {...} } ] }`.
- The schema describes the **document** (caller-supplied portion) only. The platform injects `guardrail`, `configuration`, `external` at evaluation time (do not require them from callers).

**Acceptance:** the endpoint returns the schema + examples that match the published artifacts for a pinned version.

---

## Phase B4 — Guardrail Suites

**Goal:** a grouping of pinned guardrail versions (unversioned, mutable grouping).

```jsonc
// GuardrailSuite
{
  "suiteId": "prod_release_suite",
  "name": "Production Release Suite",
  "description": "...",
  "owner": "user@example.com",
  "status": "DRAFT",                 // ACTIVE | INACTIVE | DRAFT
  "members": [
    { "guardrailId": "checkout_service_gate", "version": "1.0" },
    { "guardrailId": "repo_registered",        "version": "2.1" }
  ],
  "createdAt": "2026-05-27T12:00:00Z"
}
```

Endpoints (base `/v1/registry/suites`):
- `GET /v1/registry/suites` → `GuardrailSuite[]`.
- `GET /v1/registry/suites/{suiteId}` → full suite (members pinned).
- `POST /v1/registry/suites` → `{ name, description, owner, status, members: GuardrailRef[] }`.
- `PUT /v1/registry/suites/{suiteId}` → `{ name?, description?, status?, members? }`.
- `DELETE /v1/registry/suites/{suiteId}`.

**Validation:** every `member.{guardrailId, version}` must reference an existing
**immutable** guardrail version (Phase B2). Reject (HTTP 422) otherwise. Pins must
never auto-upgrade — store exactly what was submitted.

**Acceptance:** a suite pinning `1.0` continues to resolve `1.0` after `1.1` is
published; submitting a member for a non-existent version is rejected.

---

## Phase B5 — Evaluation & stats compatibility

**Goal:** keep evaluation/stats consistent with the new enums.

- Evaluation results: `enforcementType` may now be `WARNING`. Define semantics: `WARNING` failures are surfaced but **never block** (distinct from `OPTIONAL` if product wants a visible warning tier).
- `EvaluationSummary`: keep `mandatoryFailed`/`optionalFailed`; add `warningFailed`.
- Stats (`GET /v1/registry/stats`): group by `stage` (not the removed resourceType); include enforcement breakdown incl. `WARNING`.
- (Optional) Suite-level evaluation: evaluate all members of a suite for a given document and aggregate verdicts.

**Acceptance:** evaluating a `WARNING` guardrail that fails returns a non-blocking verdict tagged `WARNING`; stats no longer reference resourceType.

---

## Cross-cutting notes
- Keep the frontend mirror (`src/types/guardrail.types.ts`) authoritative for shapes; update both sides together.
- Prefer additive, versioned API changes; if a breaking cutover is needed, coordinate a single release.
- The studio is GitHub-publish-first; the backend should treat the GitHub artifacts as the source of truth for rego/config/input-schema and index/cache them per `(guardrailId, version)`.

## Suggested build order
B1 → B2 (versioning is the backbone) → B3 (input contracts) → B4 (suites depend on immutable pins) → B5.
