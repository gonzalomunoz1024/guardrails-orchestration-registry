import type {
  ExternalService,
  ParsedSpec,
  SwaggerBodyField,
  SwaggerField,
  SwaggerOperation,
  SwaggerParam,
} from '@/types';

/**
 * Built-in services the dropdown advertises. Empty for now — every external
 * dependency is configured via the "Custom URL…" path. Add entries here once
 * real services are wired up.
 */
export const EXTERNAL_SERVICES: ExternalService[] = [];

export const CUSTOM_SERVICE_ID = 'custom';

/** The single, org-wide HashiCorp Vault address (override via VITE_VAULT_ADDR). */
export const VAULT_ADDRESS =
  (import.meta.env.VITE_VAULT_ADDR as string | undefined) || 'https://vault.internal';

// ---------------------------------------------------------------------------
// OpenAPI parsing
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

/** Resolve a local `$ref` (e.g. "#/components/schemas/App") against the doc. */
function resolveRef(ref: string, doc: JsonObject): JsonObject | null {
  if (!ref.startsWith('#/')) return null;
  const segments = ref.slice(2).split('/');
  let node: unknown = doc;
  for (const seg of segments) {
    if (node && typeof node === 'object') {
      node = (node as JsonObject)[seg];
    } else {
      return null;
    }
  }
  return (node as JsonObject) ?? null;
}

function deref(schema: JsonObject | null, doc: JsonObject, depth = 0): JsonObject | null {
  if (!schema || depth > 10) return schema;
  if (typeof schema.$ref === 'string') {
    return deref(resolveRef(schema.$ref, doc), doc, depth + 1);
  }
  return schema;
}

/** Flatten an object schema into dotted field descriptors. */
function flattenSchema(
  schema: JsonObject | null,
  doc: JsonObject,
  prefix = '',
  depth = 0,
  out: SwaggerField[] = []
): SwaggerField[] {
  const resolved = deref(schema, doc, depth);
  if (!resolved || depth > 8) return out;

  const type = (resolved.type as string) || (resolved.properties ? 'object' : 'any');

  if (type === 'array') {
    const items = deref(resolved.items as JsonObject, doc, depth);
    // Represent the array, then descend into element shape with [] notation.
    if (prefix) {
      out.push({ path: prefix, type: 'array', description: resolved.description as string });
    }
    flattenSchema(items, doc, `${prefix}[]`, depth + 1, out);
    return out;
  }

  if (type === 'object' && resolved.properties) {
    if (prefix) {
      out.push({ path: prefix, type: 'object', description: resolved.description as string });
    }
    const props = resolved.properties as JsonObject;
    for (const [key, value] of Object.entries(props)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      flattenSchema(value as JsonObject, doc, childPrefix, depth + 1, out);
    }
    return out;
  }

  if (prefix) {
    out.push({
      path: prefix,
      type,
      description: resolved.description as string,
      example: resolved.example,
    });
  }
  return out;
}

/** Extract a sample response from an operation's 200 response, if present. */
function extractSample(responses: JsonObject, doc: JsonObject): unknown {
  const ok = (responses['200'] || responses['201'] || responses['default']) as JsonObject | undefined;
  if (!ok) return undefined;
  const content = ok.content as JsonObject | undefined;
  const json = content?.['application/json'] as JsonObject | undefined;
  if (!json) return undefined;
  if (json.example !== undefined) return json.example;
  const schema = deref(json.schema as JsonObject, doc);
  if (schema?.example !== undefined) return schema.example;
  return undefined;
}

/**
 * Resolve the spec's declared server URL against the spec URL. OpenAPI lets
 * `servers[].url` be absolute or relative (e.g. just `/api/v1`); if no servers
 * are declared we fall back to the spec URL's origin. Either way the caller
 * doesn't need to supply a separate base URL.
 */
function resolveBaseUrl(declared: string | undefined, specUrl: string): string {
  if (declared) {
    try {
      return new URL(declared, specUrl).toString().replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }
  try {
    return new URL(specUrl).origin;
  } catch {
    return specUrl;
  }
}

/** Parse a raw OpenAPI document into the reduced shape the sandbox uses. */
export function parseSpec(doc: JsonObject, specUrl: string): ParsedSpec {
  const info = (doc.info as JsonObject) || {};
  const servers = (doc.servers as JsonObject[]) || [];
  const baseUrl = resolveBaseUrl(servers[0]?.url as string | undefined, specUrl);
  const externalDocs = doc.externalDocs as JsonObject | undefined;
  const rawDocsUrl = externalDocs?.url as string | undefined;
  let docsUrl: string | undefined;
  if (rawDocsUrl) {
    try {
      docsUrl = new URL(rawDocsUrl, specUrl).toString();
    } catch {
      docsUrl = rawDocsUrl;
    }
  }
  const paths = (doc.paths as JsonObject) || {};

  // Top-level fields of an operation's JSON request body (POST/PUT).
  const extractBodyFields = (op: JsonObject): SwaggerBodyField[] => {
    const rb = op.requestBody as JsonObject | undefined;
    const content = rb?.content as JsonObject | undefined;
    const json = content?.['application/json'] as JsonObject | undefined;
    const schema = deref(json?.schema as JsonObject, doc);
    if (!schema || !schema.properties) return [];
    const required = (schema.required as string[]) || [];
    return Object.entries(schema.properties as JsonObject).map(([name, raw]) => {
      const prop = deref(raw as JsonObject, doc) || {};
      return {
        name,
        type: (prop.type as string) || 'string',
        required: required.includes(name),
        description: prop.description as string,
        example: prop.example,
      };
    });
  };

  const operations: SwaggerOperation[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    const item = pathItem as JsonObject;
    // Surface GET (reads) and POST (body-driven queries/lookups).
    for (const method of ['get', 'post'] as const) {
      const op = item[method] as JsonObject | undefined;
      if (!op) continue;

      const rawParams = (op.parameters as JsonObject[]) || [];
      const parameters: SwaggerParam[] = rawParams.map((p) => {
        const ps = deref(p.schema as JsonObject, doc) || {};
        return {
          name: p.name as string,
          in: (p.in as SwaggerParam['in']) || 'query',
          required: Boolean(p.required),
          type: (ps.type as string) || 'string',
          description: p.description as string,
          example: (ps.example as string) ?? (p.example as string),
        };
      });

      const responses = (op.responses as JsonObject) || {};
      const okSchema = (() => {
        const ok = (responses['200'] || responses['201']) as JsonObject | undefined;
        const content = ok?.content as JsonObject | undefined;
        const json = content?.['application/json'] as JsonObject | undefined;
        return (json?.schema as JsonObject) || null;
      })();

      operations.push({
        id: (op.operationId as string) || `${method}:${path}`,
        method: method.toUpperCase(),
        path,
        summary: op.summary as string,
        description: op.description as string,
        parameters,
        bodyFields: method === 'post' ? extractBodyFields(op) : [],
        responseFields: flattenSchema(okSchema, doc),
        sampleResponse: extractSample(responses, doc),
      });
    }
  }

  return {
    title: (info.title as string) || 'API',
    version: (info.version as string) || '',
    description: info.description as string,
    baseUrl,
    docsUrl,
    operations,
  };
}

/**
 * `fetch()` throws `TypeError: Failed to fetch` for any network-layer failure
 * — CORS rejection, DNS failure, TLS error, offline, blocked by extension. The
 * browser refuses to disambiguate (the lack of detail is itself a CORS
 * protection), so the best we can do is replace the bare message with one that
 * names the likely upstream causes and points the user away from suspecting
 * our app.
 */
/**
 * Route external URLs through our own server (Vite dev plugin in development,
 * the equivalent route in serve.cjs in production) so the browser doesn't get
 * blocked by CORS on hosts that don't allowlist our origin.
 */
function viaProxy(url: string): string {
  return `/__external?url=${encodeURIComponent(url)}`;
}

function describeNetworkFailure(url: string): string {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw url */
  }
  return (
    `Couldn't reach ${host}. The server is unreachable or its response was ` +
    `blocked by the browser (commonly: CORS not allowed for this site, ` +
    `untrusted TLS certificate, or the host is offline / behind a VPN you ` +
    `aren't on). Opening the URL directly in a new browser tab will confirm ` +
    `whether the host itself is reachable.`
  );
}

/** Fetch and parse an OpenAPI spec from a URL. */
export async function fetchSpec(specUrl: string): Promise<ParsedSpec> {
  let res: Response;
  try {
    res = await fetch(viaProxy(specUrl), { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(describeNetworkFailure(specUrl));
  }
  if (!res.ok) throw new Error(`Spec request returned HTTP ${res.status} ${res.statusText}`);
  let doc: JsonObject;
  try {
    doc = (await res.json()) as JsonObject;
  } catch {
    throw new Error(`Response from ${specUrl} wasn't valid JSON — is this an OpenAPI spec URL?`);
  }
  return parseSpec(doc, specUrl);
}

/**
 * Substitute `{param}` path placeholders and append query params. `params`
 * carries the values for spec-declared parameters keyed by name; `extras` is
 * an ordered list of undeclared query keys (e.g. dynamic filters like
 * `attributes.app_id=...`) appended verbatim after the declared ones.
 * Duplicate keys are preserved (URLSearchParams.append, not .set), which
 * lets authors send `tag=a&tag=b`.
 */
export function buildRequestUrl(
  baseUrl: string,
  path: string,
  operation: SwaggerOperation | undefined,
  params: Record<string, string>,
  extras: { name: string; value: string }[] = []
): string {
  let resolvedPath = path;
  const query = new URLSearchParams();

  for (const param of operation?.parameters ?? []) {
    const value = params[param.name];
    if (param.in === 'path') {
      resolvedPath = resolvedPath.replace(
        `{${param.name}}`,
        encodeURIComponent(value ?? '')
      );
    } else if (param.in === 'query' && value) {
      query.set(param.name, value);
    }
  }

  for (const extra of extras) {
    if (!extra.name || !extra.value) continue;
    query.append(extra.name, extra.value);
  }

  const base = baseUrl.replace(/\/$/, '');
  const qs = query.toString();
  return `${base}${resolvedPath}${qs ? `?${qs}` : ''}`;
}

/**
 * Spec-free variant of buildRequestUrl for callers that have only a path
 * template and a flat param map (no swagger SwaggerOperation in hand). Used
 * by blast radius, which fetches external deps per test input without
 * re-fetching the spec every time. Path params are identified by the
 * `{name}` placeholders already in `path`; anything else goes to the query
 * string. `extras` is appended verbatim after declared query params and
 * preserves duplicate keys.
 */
export function buildRequestUrlFromBindings(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  extras: { name: string; value: string }[] = []
): string {
  const pathParamNames = new Set<string>();
  const resolvedPath = path.replace(/\{([^}]+)\}/g, (_, name) => {
    pathParamNames.add(name);
    return encodeURIComponent(params[name] ?? '');
  });

  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (pathParamNames.has(name)) continue;
    if (!value) continue;
    query.set(name, value);
  }
  for (const extra of extras) {
    if (!extra.name || !extra.value) continue;
    query.append(extra.name, extra.value);
  }

  const base = baseUrl.replace(/\/$/, '');
  const qs = query.toString();
  return `${base}${resolvedPath}${qs ? `?${qs}` : ''}`;
}

/** Read a dotted path (supports numeric array indices) out of a value. */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

/** Flatten an object/array into dotted paths to primitive leaves. */
export function flattenLeafPaths(
  value: unknown,
  prefix = '',
  out: string[] = [],
  depth = 0
): string[] {
  if (depth > 6 || value == null) {
    if (prefix && value == null) out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) =>
      flattenLeafPaths(v, prefix ? `${prefix}.${i}` : String(i), out, depth + 1)
    );
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flattenLeafPaths(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
    }
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

/** Fetch data for a configured external dependency. */
export async function fetchExternalData(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(viaProxy(url), { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error(describeNetworkFailure(url));
  }
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText})`);
  }
  return res.json();
}
