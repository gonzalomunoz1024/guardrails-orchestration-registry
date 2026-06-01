# Guardrail Exclusions — Backend & Orchestrator Plan

Companion to the frontend change that lets a suite author exclude specific
`(appId, organization)` pairs from individual guardrails inside a suite. The
UI persists the intent on the suite; the orchestrator's determinator phase
filters excluded members out before evaluation.

This document is the backend + orchestrator counterpart. The frontend mirror
lives at `src/types/suite.types.ts` (the `MemberExclusion` / `SuiteMemberPin`
types); keep these contracts in sync.

---

## Problem

A suite is a flat list of pinned `(guardrailId, version)` checks. Today every
member runs against every request the suite is evaluated for. Real customers
need to opt specific applications or organizations out of specific checks —
"this VM-size guardrail is not relevant to the data-science platform, skip it
for `appId=ds-platform`" — without forking the suite or duplicating it.

## Solution shape

Per-member scope filters on the suite. The smallest unit of opt-out is the
`(suite, member)` pair, not the guardrail itself: the same guardrail may be
mandatory in one suite and excluded for a team in another.

```jsonc
// GuardrailSuite member with exclusions
{
  "guardrailId": "vm_size_limit",
  "version": "1.3",
  "exclusions": [
    { "appId": "ds-platform", "reason": "Custom VM sizing for ML jobs" },
    { "organization": "platform", "reason": "Internal infra exempt" },
    { "appId": "ml-app-1", "organization": "research" }
  ]
}
```

**Match semantics.** An entry matches an incoming request iff every key the
entry sets equals the request's value at that key. So:
- `{ appId: "ds-platform" }` matches every request from `ds-platform`,
  regardless of organization.
- `{ organization: "platform" }` matches every request from `organization=platform`.
- `{ appId: "ml-app-1", organization: "research" }` matches **only** the
  intersection — `appId=ml-app-1` AND `organization=research`.

An empty entry (`{}`) would match everything; the registry rejects it.

**Source of `appId` / `organization` on the request.** The orchestrator already
reads these from the inbound document at top-level `metadata.appId` and
`metadata.organization` per the orchestrator-reserved-fields spec
(`src/utils/reservedFields.ts`). No new request fields are introduced.

---

## Phase R1 — Registry: store exclusions on suite members

**Goal:** persist exclusions on every suite write; serve them back on every
read; never auto-merge or de-duplicate.

### Data model

Extend the `members` element on the suite document (Mongo collection
`guardrail_suites`). Members move from a tuple to a small object:

```jsonc
{
  "guardrailId": "vm_size_limit",
  "version": "1.3",
  "exclusions": [
    { "appId": "...", "organization": "...", "reason": "..." }
  ]
}
```

- `exclusions` is **optional**. Omitting it (or sending `[]`) means "no
  exclusions" — every request runs this check.
- `reason` is a free-text audit string; persisted verbatim, never used for
  matching.

### Wire contract

`POST /v1/utilities/registry/suites` and
`PUT /v1/utilities/registry/suites/{suiteId}` accept the richer member shape:

```jsonc
{
  "suiteId": "vm",
  "displayName": "VM",
  "description": "...",
  "owner": "user@example.com",
  "status": "ACTIVE",
  "members": [
    {
      "guardrailId": "vm_size_limit",
      "version": "1.3",
      "exclusions": [ { "appId": "ds-platform", "reason": "..." } ]
    },
    { "guardrailId": "vm_image_approved", "version": "2.0" }
  ]
}
```

`GET /v1/utilities/registry/suites/{suiteId}` returns the same shape verbatim.

**Backwards compatibility.** A member sent without an `exclusions` key MUST
persist with no exclusions and read back without an `exclusions` key (or with
an empty array — pick one and document it). Old clients that send just
`{ guardrailId, version }` continue to work unchanged.

### Validation

The registry rejects writes (HTTP 422) when:

1. Any exclusion entry has neither `appId` nor `organization` set (empty
   filter — would skip the check for every request).
2. `appId` / `organization` are present but not strings.
3. The exclusions array contains duplicate entries (same `(appId,
   organization)` pair); de-duplicate or reject — pick one and document.

### Indexing

For now no extra index is required. Exclusion lookup happens at read time;
the orchestrator loads the full suite document anyway.

### Acceptance

- POST/PUT round-trip a suite with mixed exclusions byte-identically.
- POST with `{ "exclusions": [{}] }` returns 422 with a clear message.
- An old client that sends only `{ guardrailId, version }` writes succeed and
  read back exactly as before.

---

## Phase O1 — Orchestrator: determinator filter

**Goal:** during determination (the phase that decides which guardrails apply
to a given request), drop any suite member whose exclusions match the
incoming request.

### Where this lives

In `tap-guardrails-orchestrator-service`, the determination phase is what
turns "the request matches suite X" into "evaluate guardrails A, B, C against
the request." The reference impl reads the suite, walks its members, and
emits a list of guardrails to run. Exclusion filtering is one new step in
that walk.

### Filter logic

For each member in the suite:

1. If the member has no `exclusions` or `exclusions.length === 0`, keep it.
2. Otherwise, for each entry in `member.exclusions`:
   - Let `matchAppId = entry.appId === undefined || entry.appId === request.appId`.
   - Let `matchOrg = entry.organization === undefined || entry.organization === request.organization`.
   - If both are true, the entry matches → drop the member and stop walking.
3. If no entry matched, keep the member.

`request.appId` / `request.organization` come from the inbound document at
`metadata.appId` / `metadata.organization` (orchestrator-reserved fields).
When either is absent on the request, the orchestrator should treat it as
the empty string (or undefined — pick one and document); an entry that
constrains a missing field never matches.

### Observability

Emit a structured log line per dropped member so audit can reconstruct why a
check didn't run:

```jsonc
{
  "level": "INFO",
  "msg": "guardrail excluded",
  "suiteId": "vm",
  "guardrailId": "vm_size_limit",
  "version": "1.3",
  "appId": "ds-platform",
  "organization": "research",
  "matchedExclusion": { "appId": "ds-platform" },
  "reason": "Custom VM sizing for ML jobs",
  "correlationId": "..."
}
```

The evaluation record should also reflect the skip: add a `skipped:
[{ guardrailId, version, reason }]` array on the per-suite verdict so the
final response makes the omission visible (no silent skips).

### Acceptance

- Suite `vm` with member `vm_size_limit@1.3` excluded for `appId=ds-platform`:
  - Request from `appId=ds-platform` → `vm_size_limit` is skipped; everything
    else in the suite runs.
  - Request from `appId=other` → `vm_size_limit` runs as before.
- Suite with an exclusion entry `{ appId: "X", organization: "Y" }`:
  - Request `(appId=X, organization=Y)` → skipped.
  - Request `(appId=X, organization=Z)` → not skipped (intersection requires
    both keys to match).
- Skipped guardrails appear in the evaluation record's `skipped` list with
  the matched exclusion reason.

---

## Phase R2 (optional) — Listing & analytics

Once exclusions are in production it'll be useful to ask:

- Which suites exclude `appId=X`? (`GET /v1/utilities/registry/suites?excludedAppId=X`)
- For a given guardrail, which suites exclude it for someone?
- Total skip count per `(suiteId, guardrailId)` over the last 24h, sourced
  from the determinator logs.

Defer until the determinator is in production and we have a real consumer
asking for the answer.

---

## Non-goals (for now)

- **Inclusion lists.** "Only run for these (appId, organization) pairs"
  inverts the model; punt until a customer asks.
- **Wildcards / globs.** `appId: "ds-*"` would be powerful but adds a parser
  and an attack surface; explicit values only.
- **Scoping by environment / resourceKind.** The current matching surface is
  intentionally narrow (`appId`, `organization`) so the determinator stays
  fast and the audit trail stays simple.
- **Per-guardrail-version exclusions inside the manifest.** Exclusions are a
  suite-level concern — the same guardrail version may be mandatory in one
  suite and excluded in another. Keep the manifest pure.

---

## Suggested build order

R1 (storage + wire) → O1 (determinator filter + skip logs) → R2 (analytics)
when the data justifies it.

## Cross-cutting notes

- Keep the frontend mirror in `src/types/suite.types.ts` authoritative for
  shapes; update both sides together.
- The frontend builder already submits the richer member shape today; until
  R1 lands, the backend will simply drop the `exclusions` field on write.
  That's safe — exclusions become a no-op — but means the UI will appear to
  forget them after a reload until R1 ships.
