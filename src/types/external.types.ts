/**
 * Types for the External Dependencies feature.
 *
 * An external dependency fetches data from an HTTP API (described by an OpenAPI /
 * Swagger spec) and injects the response into the OPA evaluation input under
 * `input.external.<name>`.
 */

/** A known service the sandbox can pull external data from. */
export interface ExternalService {
  id: string;
  name: string;
  description: string;
  /** Base URL the data endpoints are served from. */
  baseUrl: string;
  /** URL of the OpenAPI/Swagger JSON document. */
  specUrl: string;
  /** Path to the human-facing Swagger UI page, if any. */
  docsUrl?: string;
}

/** A single request parameter parsed from an OpenAPI operation. */
export interface SwaggerParam {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  type: string;
  description?: string;
  example?: string;
}

/** A flattened, dotted response field parsed from an operation's response schema. */
export interface SwaggerField {
  path: string;
  type: string;
  description?: string;
  example?: unknown;
}

/** A single top-level field of a request body (for POST/PUT operations). */
export interface SwaggerBodyField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: unknown;
}

/** A single operation discovered in a spec (GET or POST). */
export interface SwaggerOperation {
  id: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  parameters: SwaggerParam[];
  /** Top-level request-body fields (POST/PUT); empty for GET. */
  bodyFields: SwaggerBodyField[];
  /** Flattened response fields (for the "available fields" browser). */
  responseFields: SwaggerField[];
  /** Example response payload pulled from the spec, if present. */
  sampleResponse?: unknown;
}

/** A parsed OpenAPI document reduced to what the sandbox needs. */
export interface ParsedSpec {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  operations: SwaggerOperation[];
}

export type ExternalDepStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Authentication config for a custom external service. Points at where the
 * credentials live in the (single, org-wide) HashiCorp Vault so the backend can
 * later fetch them, mint a bearer token, and call the API. The password is
 * treated as transient and is never persisted to local storage.
 */
export interface ExternalAuth {
  type: 'vault';
  /** Path to the secret in Vault, e.g. secret/data/my-api. */
  secretPath: string;
  username: string;
  /** Transient — not persisted; entered to prove out the flow. */
  password: string;
}

/** Where a request parameter's value comes from. */
export type ParamSource = 'static' | 'document' | 'configuration';

/**
 * A configured value for a request parameter. For `static`, `value` is the
 * literal. For `document`/`configuration`, `value` is a dotted path resolved
 * against the current document / configuration JSON at fetch time.
 */
export interface ExternalParam {
  source: ParamSource;
  value: string;
}

/**
 * A configured external dependency stored in the policy store. The fetched
 * `data` becomes `input.external[name]` during evaluation.
 */
export interface ExternalDependency {
  /** Stable client id. */
  id: string;
  /** Key under `input.external` — what the Rego policy references. */
  name: string;
  /** Selected service id, or 'custom'. */
  serviceId: string;
  /** Resolved base URL (allows custom services). */
  baseUrl: string;
  specUrl: string;
  /** Selected operation path + method. */
  operationId?: string;
  method: string;
  path: string;
  /** Request parameter configuration keyed by param name (path/query/header). */
  params: Record<string, ExternalParam>;
  /** Request body field bindings keyed by field name (POST/PUT). */
  body?: Record<string, ExternalParam>;
  /** Vault-based auth config (custom services only). */
  auth?: ExternalAuth;
  /** Last fetched response payload. */
  data: unknown | null;
  status: ExternalDepStatus;
  error?: string;
  fetchedAt?: string;
}
