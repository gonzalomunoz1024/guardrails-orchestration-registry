# The Guardrail Manifest (`guardrail.yaml`)

A **kube-like declarative manifest** that is published as the fourth artifact of a
guardrail — alongside `guardrail.rego` (the policy) and `configuration.json` (its
static data). It is the contract the backend registers and reconciles so it knows
**how to assemble the OPA evaluation input at enforcement time**.

```
rego/<id>.rego                 # the Rego policy
guardrails/<id>.yaml           # ← this manifest: how to build the input
configurations/<id>.yaml       # the GuardrailConfiguration (static data, optional)
```

## Why it exists

In the studio you compose the OPA `input` from three sources — the **document**
being evaluated, static **configuration**, and dynamic **external dependencies**
fetched from APIs. At runtime the backend must rebuild that exact shape:

```jsonc
input = {
  ...document,                                  // the resource being evaluated
  guardrail:     { id, name, version, enforcementType },   // synthesized by the backend
  configuration: { ... },                       // looked up from the config table (if used)
  external: { <name>: <fetched API response> }  // one per external dependency
}
```

The manifest tells the backend, declaratively, how to do steps it can't infer from
the Rego alone: **look up the right configuration row**, **call each external API**
(substituting parameters from the document or configuration), and **assemble** the
result before evaluating the policy.

> Design principle: the manifest captures **authoring intent only**. It never
> contains fetched data, client ids, statuses, or timestamps. Optional sections are
> omitted entirely when unused, so a trivial guardrail stays tiny (see [Minimal](#minimal-example)).

---

## Anatomy

### Top level

| Field | Type | Notes |
|-------|------|-------|
| `apiVersion` | string | `guardrails.dev/v1alpha1`. `alpha` because the schema is still evolving. |
| `kind` | string | Always `Guardrail`. |
| `metadata` | object | Identity & descriptive facets. |
| `spec` | object | Behavior: enforcement, target, policy ref, and **input assembly**. |

A `status` block (conditions, resolved digests) exists at runtime but is
**controller-managed** — you never author it.

### `metadata`

| Field | Maps from (studio) | Notes |
|-------|--------------------|-------|
| `name` | derived from policy name | DNS-1123 slug; the stable guardrail **id** and Rego package basis. |
| `displayName` | `metadata.name` | Human-friendly name. |
| `version` | `metadata.version` | Semver; bump per registered revision. |
| `description` | `metadata.description` | Optional. |
| `owner` | `metadata.author` | Optional. |
| `labels` | `tags` | Selectable facets (rendered as a list). |
| `annotations` | — | Free-form review aids (runbook links, rationale). Don't affect behavior. |

### `spec`

| Field | Type / values | Maps from | Meaning |
|-------|---------------|-----------|---------|
| `enforcement` | `MANDATORY` \| `OPTIONAL` | `enforcementType` | Drives fail-closed vs fail-open (see [Failure modes](#failure-modes)). |
| `stage` | `PRECHECK` \| `POSTCHECK` | (defaults `PRECHECK`) | When the guardrail runs. |
| `target.resourceType` | enum | `resourceType` (uppercased) | Which system it applies to (`LIGHTSPEED`, `VMFORGE`, …). |
| `target.resourceKind` | string | `resourceKind` | Specific kind within the type. |
| `policy.file` | path | — | The sibling Rego file (`guardrail.rego`). |
| `policy.package` | string | derived | The package/entrypoint the backend queries. |
| `document.source` | `request` \| `inline` | — | Production uses `request` (the resource is supplied per call). |
| `configuration` | object | present iff `configEnabled` | **Omit entirely** to mean "no configuration." |
| `externalDependencies` | list | `externalDeps` | **Omit entirely** when there are none. |

### `spec.configuration` (optional)

Present only when the guardrail uses static configuration. Tells the backend to
resolve the correct row from the configuration table and merge it at
`input.configuration`.

```yaml
configuration:
  file: configuration.json     # seed/fallback artifact
  lookup:
    table: guardrail_configuration
    onMissing: fail            # fail | empty | default
```

#### The configuration artifact (`configurations/<id>.yaml`)

When configuration is used, the data itself is published as its own kube-like
resource (not a bare key/value dump), so it's reviewable and versionable like the
guardrail. The backend resolves it from the configuration table and merges
`spec.data` at `input.configuration`.

```yaml
apiVersion: guardrails.dev/v1alpha1
kind: GuardrailConfiguration
metadata:
  name: checkout-service-deployment-gate   # ties the config to its guardrail
spec:
  data:
    allowAll: false
    approvedRegion: us-east-1
```

### `spec.externalDependencies[]` (optional)

Each entry becomes `input.external.<name>`. The backend calls the API and binds
each parameter from one of three sources.

```yaml
externalDependencies:
  - name: repoRegistry          # → input.external.repoRegistry  (must be a valid identifier)
    service: repo-registry      # service id from the catalog, or "custom"
    baseUrl: http://localhost:4001
    spec: http://localhost:4001/openapi.json
    request:
      method: GET
      path: /repos/{repoId}
      parameters:
        repoId: { document: repository.id }   # see parameter binding below
    response:
      select: ""                # "" = whole body; or a dotted path to narrow it
    onError: failClosed         # failClosed | failOpen | inherit (default)
    fallback: { status: unknown }   # value used at input.external.<name> when failOpen
    dependsOn: []               # optional: names of deps that must resolve first (DAG)
```

#### Parameter binding — the source is the key

A parameter's value comes from exactly one source, encoded as the **key** of the
binding so it reads as plain English in review:

| Form | Means |
|------|-------|
| `{ value: "v2" }` | A **static** literal. |
| `{ document: order.id }` | A **dotted path** into the document. |
| `{ config: approvedRegion }` | A **dotted path** into the resolved configuration. |
| `{ from: { dependency: repoRegistry, path: deployment.orderId } }` | A path into **another dependency's** response (requires a `dependsOn` edge). |

Paths are **dotted** (e.g. `a.b.0.c`, numeric segments index arrays) — the same
syntax the studio and Rego use. Missing **required path params** are an error
(never templated as an empty string); missing optional query/header params are
omitted.

---

## How the backend executes it

```
document arrives
  → resolve configuration   (lookup row by target + scope)        [if configuration present]
  → resolve dependencies    (bind params from document/config/other deps; fetch; select)
  → assemble input          ({ ...document, guardrail, configuration?, external? })
  → evaluate policy.package against the input
```

Independent dependencies may be fetched in parallel; `dependsOn` (or a
`from.dependency` binding) creates ordering edges. The graph must be acyclic.

### Failure modes

| Situation | `MANDATORY` | `OPTIONAL` |
|-----------|-------------|------------|
| Config lookup misses (`onMissing: fail`) | Fail **closed** (synthetic deny) | Fail **open** (guardrail skipped) |
| Dependency fetch fails (`onError: inherit`) | Fail **closed** | Fail **open** |
| Dependency with `onError: failOpen` | Use `fallback`, continue | Use `fallback`, continue |
| Rego compile/eval error | Fail **closed** (always) | Fail **closed** (always) |

A synthetic infra-failure deny is tagged distinctly from a policy-authored deny so
operators can tell an outage apart from a real denial.

### Secrets

External calls that need credentials reference a secret — they are **never inlined**:

```yaml
request:
  auth:
    type: bearer                # none | bearer | apiKey | basic
    secretRef: { name: repo-registry-token, key: token }
```

---

## Register-time validation

The backend rejects a manifest unless:

1. It validates against the `guardrails.dev/v1alpha1` schema.
2. `policy.package` matches the `package` declared in `guardrail.rego`.
3. Every `dependsOn` / `from.dependency` reference exists, is acyclic, and resolves earlier.
4. Each `service` is in the catalog (or `custom` with an inline `baseUrl`/`spec`); required OpenAPI params are bound.
5. Path bindings are dotted (no JSONPath metacharacters); every `{placeholder}` in a path has a matching `path` parameter.
6. No secret material is inlined; each `secretRef` exists.
7. `external.<name>` keys are unique and valid identifiers (so `input.external.<name>` is addressable).

---

## Full example

See [`docs/examples/checkout-service-deployment-gate.guardrail.yaml`](./examples/checkout-service-deployment-gate.guardrail.yaml)
for a complete, annotated guardrail that pulls `repo-registry` and `vm-order` data.

## Minimal example

With `configEnabled: false` and no dependencies, both optional blocks vanish:

```yaml
apiVersion: guardrails.dev/v1alpha1
kind: Guardrail
metadata:
  name: admin-only
  displayName: "Admin Only"
  version: 1.0.0
spec:
  enforcement: MANDATORY
  stage: PRECHECK
  target:
    resourceType: LIGHTSPEED
    resourceKind: CONTAINER
  policy:
    file: guardrail.rego
    package: data.admin_only
  document:
    source: request
```

The backend infers: no `input.configuration`, no `input.external` — the input is
just `{ ...document, guardrail }`.

---

## Generating it

The studio generates this manifest from your authored state
(`src/utils/guardrailManifest.ts`). Open the **Manifest** button in the Policy
Studio header to preview the live `guardrail.yaml` for the current guardrail.
