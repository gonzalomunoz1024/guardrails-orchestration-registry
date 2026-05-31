# Missing backend endpoints

Tracks endpoints the Studio UI invokes that the current `tap-guardrails-registry-service` REGISTRY_API.md does not document. Each entry below carries the request contract, the response shape the UI expects today, and a sample payload so backend has a working spec to implement (or to explicitly deprecate, in which case the UI should drop the consumer).

> Last updated: 2026-05-31, alongside the front-end migration to the manifest-based registry contract.

---

## 1. Registry stats

**Path:** `GET /v1/utilities/registry/stats`
**Query:** `timeRange` — one of `1h`, `6h`, `24h`, `7d`, `30d` (default `24h`).
**Status:** Called by the Studio's Dashboard via `useStats()` → `guardrailsApi.getStats()`. Not listed in the new REGISTRY_API.md. The dashboard renders zeroed counts when the request fails or returns empty, but a working endpoint is needed for the headline summary cards.

### Why it's needed

The Dashboard is the first view a guardrail author lands on; the summary cards (total/active/inactive guardrails, evaluation pass rate, enforcement mix) are how they orient themselves before drilling into a specific policy. Computing these client-side would require iterating every manifest + every evaluation per render — fine for tens of policies, too expensive once we cross a few hundred.

### Expected response shape

```json
{
  "totalGuardrails": 42,
  "activeGuardrails": 30,
  "inactiveGuardrails": 12,
  "guardrailsByStatus": {
    "ACTIVE": 30,
    "INACTIVE": 8,
    "DRAFT": 4
  },
  "guardrailsByEnforcementType": {
    "MANDATORY": 18,
    "OPTIONAL": 19,
    "WARNING": 5
  },
  "evaluations": {
    "total": 12450,
    "passed": 11203,
    "failed": 1247,
    "passRate": 0.8998
  },
  "computedAt": "2026-05-31T12:00:00Z"
}
```

### Notes for the backend

- `guardrails*` counts come from `guardrail_manifests` (count distinct `metadata.name` for total; partition by `spec.status` and `spec.enforcement` for the maps).
- `evaluations.*` should respect `timeRange` — aggregate from the orchestrator's evaluation store.
- `computedAt` is the only field the UI never displays but uses for cache freshness; ISO 8601 UTC is fine.
- A `404` from this endpoint is treated as "not implemented yet" and the Dashboard falls back to zeros without erroring out, so shipping without `evaluations.*` (just guardrail counts) is acceptable as a first cut.

---

## Notes on what is *not* missing

These endpoints exist in REGISTRY_API.md and the UI now hits them directly:

| Frontend call | Wire endpoint |
|---|---|
| `guardrailsApi.listManifests` / `listPolicies` | `GET /v1/utilities/registry/manifests` |
| `guardrailsApi.listManifestsByName` / `getGuardrailVersions` | `GET /v1/utilities/registry/manifests/{name}` |
| `guardrailsApi.getManifest` / `getPolicyAt` | `GET /v1/utilities/registry/manifests/{name}/{version}` |
| `guardrailsApi.getInputSchema` | `GET /v1/utilities/registry/guardrails/{name}/{version}/schema` |
| `guardrailsApi.getMetadata` | `GET /v1/utilities/registry/guardrails/{name}/{version}/metadata` |
| `guardrailsApi.listConfigurations` | `GET /v1/utilities/registry/configurations` |
| `guardrailsApi.getConfiguration` | `GET /v1/utilities/registry/configurations/{name}/{version}` |
| `guardrailsApi.getRegoSource` | `GET /v1/utilities/registry/rego/{name}/{version}/source` |
| `guardrailsApi.getOpaBundle` | `GET /v1/utilities/registry/opa/bundle` |
| `guardrailsApi.getTestInputs` | `GET /v1/utilities/registry/test-inputs` |
| `suitesApi.*` | `/v1/utilities/registry/suites*` |
| Evaluations | `/v1/utilities/evaluations/*` (orchestrator-side) |

Writes flow through GitHub PRs (`SubmitPolicyModal` → branch → PR → GitHub Actions → backend `POST /registry/manifests` + `POST /registry/rego/{name}/{version}`); no direct UI → registry write paths.
