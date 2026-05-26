import type {
  ExternalService,
  ParsedSpec,
  SwaggerBodyField,
  SwaggerField,
  SwaggerOperation,
  SwaggerParam,
} from '@/types';

/**
 * Catalog of demo external services. These ship with the repo under
 * `mock-services/` and expose Swagger pages + OpenAPI specs.
 */
export const EXTERNAL_SERVICES: ExternalService[] = [
  {
    id: 'repo-registry',
    name: 'Repository Registry',
    description: 'Is a repository registered, and what is its registration metadata?',
    baseUrl: 'http://localhost:4001',
    specUrl: 'http://localhost:4001/openapi.json',
    docsUrl: 'http://localhost:4001/docs',
  },
  {
    id: 'vm-order',
    name: 'VM Order Service',
    description: 'Status of a virtual machine provisioning order.',
    baseUrl: 'http://localhost:4002',
    specUrl: 'http://localhost:4002/openapi.json',
    docsUrl: 'http://localhost:4002/docs',
  },
];

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

/** Parse a raw OpenAPI document into the reduced shape the sandbox uses. */
export function parseSpec(doc: JsonObject, fallbackBaseUrl: string): ParsedSpec {
  const info = (doc.info as JsonObject) || {};
  const servers = (doc.servers as JsonObject[]) || [];
  const baseUrl = (servers[0]?.url as string) || fallbackBaseUrl;
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
    operations,
  };
}

/** Fetch and parse an OpenAPI spec from a URL. */
export async function fetchSpec(specUrl: string, fallbackBaseUrl: string): Promise<ParsedSpec> {
  const res = await fetch(specUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to load spec (${res.status})`);
  const doc = (await res.json()) as JsonObject;
  return parseSpec(doc, fallbackBaseUrl);
}

/** Substitute `{param}` path placeholders and append query params. */
export function buildRequestUrl(
  baseUrl: string,
  path: string,
  operation: SwaggerOperation | undefined,
  params: Record<string, string>
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
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText})`);
  }
  return res.json();
}
