# Hydrating the Guardrail Detail page — stats + evaluation history

This is the backend + integration plan for the bug where the policy detail
page shows zeroed-out stats — Total Evaluations, Allow Rate, Deny Rate, Avg
Execution — no matter how many evaluations have run.

The orchestrator already emits a `ResourceGuardrailsResponseEvent` to
OpenSearch for every evaluation request. Each event carries a per-guardrail
result entry under `spec.results.evaluations[]`. The registry needs two new
endpoints that turn those raw events into the data the UI is built around.

Frontend mirror lives at `src/types/registry.types.ts` (`PolicyStats`); keep
the two in sync.

---

## 1. Source document — `ResourceGuardrailsResponseEvent`

One document per inbound evaluation request, indexed in OpenSearch (same
cluster the test-inputs API already scrolls). Verbatim shape captured from
the production index:

```jsonc
{
  "apiVersion": "policy.lightspeed.wellsfargo.net/v1",
  "kind": "ResourceGuardrailsResponseEvent",
  "metadata": {
    "name": "lab/cml-27/mongodb.yaml",
    "eventId": "a9312ccc-7ec3-4662-89e8-a26334b8bdda",
    "timestamp": "2026-06-03T01:05:19.111712017Z",
    "source": { "service": "guardrails-client-service", "version": "1.0.0" },
    "correlationId": "bb9709b2-iolo-4dc5-92ee-99dfd2e6qqgz"
  },
  "spec": {
    "appId": "CANARY",
    "results": {
      "overall": {
        "result": "FAILED",            // PASSED | FAILED
        "evaluated": 1,
        "passed": 0,
        "failed": 1,
        "pending": 0,
        "detailed": {
          "mandatory": { "passed": 0, "failed": 1, "pending": 0 },
          "optional":  { "passed": 0, "failed": 0, "pending": 0 }
        }
      },
      // The slice we actually need — one entry per guardrail run.
      "evaluations": [
        {
          "guardrailId": "lightspeed-allow-list",
          "version": "1.1",
          "enforcementType": "MANDATORY", // MANDATORY | OPTIONAL | WARNING
          "result": "FAILED",             // PASSED | FAILED | PENDING
          "reason": "input-schema validation failed: …",
          "evaluatedAt": "2026-06-03T01:05:18.971408Z"
        }
      ]
    },
    "status": {
      "status": "FAILURE",                // SUCCESS | FAILURE
      "state":  "GUARDRAILS_RESPONSE",
      "message": "Failures in guardrails evaluations",
      "code":   1234
    }
  }
}
```

Each request → one document → N `spec.results.evaluations[]` entries (one
per guardrail that ran). To compute stats for a single guardrail you filter
events on `spec.results.evaluations.guardrailId == <id>` and (optionally)
`spec.results.evaluations.version == <version>`, then count `result` values
across the matching nested entries.

**One open question.** The nested entry has `evaluatedAt` but no duration.
For `avgExecutionTimeMs` either:
  a. the orchestrator starts emitting a `durationMs` (or `evaluationTimeMs`)
     field on each entry, **or**
  b. we drop the field from the UI until we have a real source.
The plan below assumes (a) — backend folks decide which it is. If we go
with (b), strike the avg-execution card from the detail page and remove
`avgExecutionTimeMs` from `PolicyStats`.

---

## 2. New endpoints

Two endpoints, parallel to how `/test-inputs` already serves OpenSearch.

### 2a. Aggregated stats — what the detail page needs *today*

```
GET /v1/utilities/registry/guardrails/{guardrailId}/stats
    ?version=<version>           // optional; omit for "all versions"
    &timeRange=<24h|7d|30d|all>  // default "30d"
```

Response:

```jsonc
{
  "guardrailId": "lightspeed-allow-list",
  "version":     "1.1",          // null/omitted when timeRange covers all versions
  "timeRange":   "30d",
  "totalEvaluations":    1234,
  "passed":              800,
  "failed":              434,
  "pending":             0,
  "allowRate":           64.8,   // % passed   (passed / totalEvaluations * 100)
  "denyRate":            35.2,   // % failed
  "avgExecutionTimeMs":  12,     // omit when duration isn't emitted (see §1)
  "lastEvaluated":       "2026-06-03T01:05:18.971408Z",
  "computedAt":          "2026-06-03T01:10:00.000Z"
}
```

The detail page (`src/components/views/PolicyDetail.tsx:489`) reads exactly
these fields out of `policy.stats`; the mapper at
`src/utils/guardrailMapper.ts:102` will assign them through (see §4).

#### OpenSearch aggregation query

`nested` aggregation under `spec.results.evaluations`, filtered to the
target guardrail. One round-trip; cheap.

```jsonc
POST /<events-index>/_search
{
  "size": 0,
  "query": {
    "bool": {
      "filter": [
        { "term":  { "kind": "ResourceGuardrailsResponseEvent" } },
        { "range": { "metadata.timestamp": { "gte": "now-30d" } } },
        {
          "nested": {
            "path": "spec.results.evaluations",
            "query": {
              "bool": {
                "filter": [
                  { "term": { "spec.results.evaluations.guardrailId": "lightspeed-allow-list" } }
                  // when version is supplied:
                  // { "term": { "spec.results.evaluations.version": "1.1" } }
                ]
              }
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "evals": {
      "nested": { "path": "spec.results.evaluations" },
      "aggs": {
        "for_this_guardrail": {
          "filter": {
            "bool": {
              "filter": [
                { "term": { "spec.results.evaluations.guardrailId": "lightspeed-allow-list" } }
                // version filter mirrors the outer one
              ]
            }
          },
          "aggs": {
            "by_result":     { "terms": { "field": "spec.results.evaluations.result", "size": 5 } },
            "avg_duration":  { "avg":   { "field": "spec.results.evaluations.durationMs" } },
            "last_evaluated":{ "max":   { "field": "spec.results.evaluations.evaluatedAt" } }
          }
        }
      }
    }
  }
}
```

Then in service code:

```text
totalEvaluations    = sum of buckets in by_result
passed              = bucket["PASSED"].doc_count   (default 0)
failed              = bucket["FAILED"].doc_count   (default 0)
pending             = bucket["PENDING"].doc_count  (default 0)
allowRate           = round(passed * 100 / max(totalEvaluations, 1), 1)
denyRate            = round(failed * 100 / max(totalEvaluations, 1), 1)
avgExecutionTimeMs  = round(avg_duration.value)
lastEvaluated       = last_evaluated.value_as_string
```

**Mapping rules** (please write these down; the UI assumes them):

  - `PASSED` counts as an allow.
  - `FAILED` counts as a deny **only** when the entry's
    `enforcementType` is `MANDATORY`. `WARNING` failures should NOT count
    against deny rate — they're informational. `OPTIONAL` failures count
    as failed but not as deny.
  - `PENDING` doesn't count toward either rate but does count toward
    `totalEvaluations`.

If you decide to follow the simpler "FAILED = deny" rule instead, document
that and the UI will adjust. The frontend currently treats `denyRate` as
"requests this guardrail would have blocked," so the enforcement-aware
version is the more honest one.

#### Validation

  - `guardrailId` must exist in `guardrail_manifests`. If not → 404.
  - `version`, when supplied, must be a published version of that
    guardrail. If not → 404.
  - `timeRange` validated against the enum; unknown → 400.

#### Caching

Per-guardrail stats are eligible for short-window caching (60–120s) keyed
on `(guardrailId, version, timeRange)`. Stale window is fine — the detail
page is browsed, not a hot path.

---

### 2b. Paginated evaluation history — for the future Tests/History tab

Same scroll shape as `/test-inputs` so the frontend can reuse the existing
pagination scaffolding.

```
GET /v1/utilities/registry/guardrails/{guardrailId}/evaluations
    ?version=<version>           // optional
    &timeRange=<24h|7d|30d|all>  // default "30d"
    &result=<PASSED|FAILED|PENDING>  // optional
    &appId=<...>                 // optional, narrows by request appId
    &organization=<...>          // optional
    &scrollId=<cursor>           // continue a prior scroll
    &limit=50                    // 1..200
```

Response:

```jsonc
{
  "scrollId": "DXF1ZXJ5...",     // null when there are no more pages
  "total":    1234,
  "evaluations": [
    {
      "eventId":         "a9312ccc-…",
      "correlationId":   "bb9709b2-…",
      "appId":           "CANARY",
      "occurredAt":      "2026-06-03T01:05:18.971408Z",
      "guardrailId":     "lightspeed-allow-list",
      "version":         "1.1",
      "enforcementType": "MANDATORY",
      "result":          "FAILED",
      "reason":          "input-schema validation failed: …",
      "durationMs":      12,           // when emitted; see §1
      "request": {                     // metadata copied from the parent event
        "service":       "guardrails-client-service",
        "name":          "lab/cml-27/mongodb.yaml"
      }
    }
    // …
  ]
}
```

Each row is a *flattened* nested entry: one entry per `(eventId,
guardrailId)` pair. Pagination matches `/test-inputs` so we get to reuse
`scrollId` + `hasMore` directly.

Server-side this is a `_search?scroll=2m` against the same index, with a
nested query like §2a's, paged at `limit` per call. Subsequent calls hit
`_search/scroll` with the cursor.

---

## 3. Why two endpoints, not one

  - **Catalog list** wants four cheap numbers per guardrail at most; the
    aggregation endpoint serves it in O(1) per row.
  - **Detail page** wants the same four numbers *and* eventually a list of
    recent evaluations the user can drill into.
  - Calling the paginated endpoint and aggregating client-side ties latency
    to evaluation volume — a popular guardrail would scroll thousands of
    events on every page open.

If only one ships, ship §2a. The detail page is broken without it.

---

## 4. Frontend integration

Once the endpoints exist:

**`src/services/api/guardrailsApi.ts`** — two new methods:

```ts
getGuardrailStats(name, version?, timeRange = '30d'): Promise<GuardrailStats>
getGuardrailEvaluations(name, opts): Promise<GuardrailEvaluationsResponse>
```

Both go through the same error/console wrapping the rest of the file uses
(`statusOf`, `GuardrailsApiError`). 404 maps to "no stats yet" — return a
zero record rather than throwing, so the catalog doesn't break for brand-
new guardrails.

**`src/utils/guardrailMapper.ts:102`** — drop the hardcoded zeros. Two
options, in order of preference:

  - Have `getPolicy` fetch the stats endpoint in parallel with the rest of
    its loads (already a `Promise.all` in there) and pass the result into
    the mapper as another field on `MapManifestExtras`. The mapper assigns
    `policy.stats` directly.
  - If we want the detail view to load fast and the stats card to fill in
    after, fetch the stats in a separate `useGuardrailStats(id, version)`
    hook and render a skeleton while it's pending. Less elegant but useful
    if the aggregation is slow.

**`src/types/registry.types.ts`** — `PolicyStats` is already the shape
backed by §2a, with the exception of `lastEvaluated` (already optional).
Add `pending?: number` if we want to surface PENDING separately on the UI.

**`src/components/views/PolicyDetail.tsx`** — no change needed; the four
cards already read `policy.stats.*`. Surface a loading skeleton if you
went with the separate-hook approach.

---

## 5. Suggested build order

  1. **§2a (aggregated stats endpoint)** — unblocks the detail page.
     Acceptance: refresh a guardrail with recent evaluations and see real
     numbers instead of zeros.
  2. **`src/utils/guardrailMapper.ts` wiring** — drop the zeros, plumb the
     stats in via `MapManifestExtras` or via the deferred hook.
  3. **§2b (paginated evaluations endpoint)** — once the Tests tab gets a
     real history view (currently a placeholder pointing at Blast Radius).
  4. **`durationMs` emission** — needed for the Avg Execution card to be
     anything other than 0. Defer if engineering effort is high; remove
     the card and the field from `PolicyStats` until it lands.

---

## 6. Cross-cutting notes

  - Index hygiene: the nested `spec.results.evaluations` mapping must be
    `nested` (not `object`) for the aggregations above to attribute counts
    to the right guardrail. If the index is currently flattened, you'll
    see inflated counts when a single event runs multiple guardrails.
    Check `_mapping` before shipping.
  - Time fields: store and query against `metadata.timestamp` (event-level)
    for filtering, and `spec.results.evaluations.evaluatedAt` (nested) for
    `lastEvaluated`. The two can drift by milliseconds; that's fine.
  - The frontend's existing `/v1/utilities/evaluations/*` endpoints
    (`listEvaluations`, `getEvaluation`, `getEvaluationsByCorrelationId`)
    return `EvaluationRecord`, which is the *event-level* projection — a
    different shape from §2b. Keep both: §2b is the per-guardrail flattened
    slice; the existing endpoints are the per-request rollup.
