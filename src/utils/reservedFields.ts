/**
 * Orchestrator-reserved fields for the inbound evaluation document.
 *
 * The guardrails orchestrator reads (never writes) these keys at the named
 * locations on every inbound request. The customer's manifest
 * `spec.inputSchema.content` is the single source of truth for what's
 * required and what types are allowed — so any input schema the Studio
 * publishes MUST:
 *
 *   1. Always allow these reserved keys at the named locations
 *      (never disallow them).
 *   2. Never collide with their declared types (e.g. don't make
 *      `metadata.correlationId` an integer when the orchestrator writes it
 *      as a string).
 *   3. Customers may mark any of them required for their own observability
 *      needs; the orchestrator itself never requires them.
 *
 * Source: MANDATORY: Orchestrator-Reserved Fields spec, May 2026.
 * Reference impl: ResourceGuardrailsRequestedDto / RawDocumentConverter /
 * RawDocument in tap-guardrails-orchestrator-service.
 */

export interface ReservedField {
  /** Dot-path from the inbound document root, e.g. `metadata.correlationId`. */
  path: string;
  /** JSON Schema primitive type the orchestrator writes/reads. */
  type: 'string' | 'object';
  /** Human-readable note for the UI hint panel. */
  note: string;
  /**
   * Whether the Studio should warn when this path is missing from a sample
   * document. The orchestrator itself doesn't require any reserved field, but
   * authors should know which envelope keys real inbound traffic will carry —
   * a guardrail that doesn't account for `metadata.appId` will silently
   * misbehave in production. correlationId is the one exception: the server
   * mints a UUID when absent, so an author leaving it out of a sample is fine.
   */
  required: boolean;
}

// Per the orchestrator spec: all reserved keys live at the top level or under
// `metadata`. `spec` is forwarded verbatim into input.document.spec but is
// fully customer-owned — no reserved sub-keys.
export const RESERVED_FIELDS: ReservedField[] = [
  {
    path: 'apiVersion',
    type: 'string',
    note: 'Routes inbound documents to the correct resource converter. Any string works today.',
    required: true,
  },
  {
    path: 'kind',
    type: 'string',
    note: 'Surfaced in inbound logs. No routing or validation impact.',
    required: true,
  },
  {
    path: 'metadata',
    type: 'object',
    note: 'Customer-driven envelope; forwarded verbatim into input.document.metadata. Carries the four reserved sub-keys below.',
    required: true,
  },
  {
    path: 'metadata.correlationId',
    type: 'string',
    note: 'Mongo _id of the evaluation record. Server mints a UUID when absent.',
    required: false,
  },
  {
    path: 'metadata.name',
    type: 'string',
    note: 'Logical resource name; surfaced on the evaluation record.',
    required: true,
  },
  {
    path: 'metadata.appId',
    type: 'string',
    note: "Drives applicability matching against each guardrail's applicability rules. When absent the applicability filter treats the request as having no appId.",
    required: true,
  },
  {
    path: 'metadata.organization',
    type: 'string',
    note: 'Used to derive the LOB on the evaluation record and downstream events.',
    required: true,
  },
  {
    path: 'spec',
    type: 'object',
    note: 'Fully customer-owned — no reserved sub-keys. Forwarded verbatim into input.document.spec for OPA.',
    required: true,
  },
];

type SchemaObject = Record<string, unknown>;

/** Walk a JSON Schema object down a dot-path; returns the leaf property
 *  schema or undefined if the path doesn't exist. Only follows `properties`
 *  chains — the only shape the auto-derive emits. */
export function getPropertyAtPath(schema: SchemaObject | undefined, path: string): SchemaObject | undefined {
  if (!schema || typeof schema !== 'object') return undefined;
  const segments = path.split('.');
  let cursor: SchemaObject | undefined = schema;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    const props = cursor.properties as SchemaObject | undefined;
    if (!props || typeof props !== 'object') return undefined;
    cursor = props[segment] as SchemaObject | undefined;
  }
  return cursor;
}

/** Set a property schema at a dot-path inside a JSON Schema tree, creating
 *  intermediate `{ type: 'object', properties: {} }` nodes as needed.
 *  Mutates and returns the root for chaining. */
function setPropertyAtPath(root: SchemaObject, path: string, leaf: SchemaObject): SchemaObject {
  const segments = path.split('.');
  let cursor = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    if (cursor.type !== 'object') cursor.type = 'object';
    if (!cursor.properties || typeof cursor.properties !== 'object') {
      cursor.properties = {};
    }
    const props = cursor.properties as SchemaObject;
    if (!props[segment] || typeof props[segment] !== 'object') {
      props[segment] = { type: 'object', properties: {} };
    }
    cursor = props[segment] as SchemaObject;
  }
  if (cursor.type !== 'object') cursor.type = 'object';
  if (!cursor.properties || typeof cursor.properties !== 'object') {
    cursor.properties = {};
  }
  const props = cursor.properties as SchemaObject;
  const last = segments[segments.length - 1];
  // Preserve any customer-authored description / required marker on the leaf;
  // only enforce the type so we don't clobber intentional additions.
  const existing = (typeof props[last] === 'object' && props[last] !== null
    ? (props[last] as SchemaObject)
    : {}) as SchemaObject;
  props[last] = { ...existing, ...leaf };
  return root;
}

/**
 * Merge the reserved-field declarations into a JSON Schema tree so it always
 * allows the orchestrator's envelope at the named locations with the right
 * types. Idempotent: re-running on an already-merged schema is a no-op.
 *
 * Leaves intermediate `required` arrays untouched — customers decide what's
 * required for their own observability; the orchestrator never requires
 * these itself.
 */
export function applyReservedFields(schema: SchemaObject): SchemaObject {
  const root: SchemaObject = { ...schema };
  if (root.type !== 'object') root.type = 'object';
  for (const field of RESERVED_FIELDS) {
    const leaf: SchemaObject = field.type === 'object' ? { type: 'object' } : { type: field.type };
    setPropertyAtPath(root, field.path, leaf);
  }
  return root;
}

/** Walk a plain JSON value down a dot-path; returns the value at the leaf or
 *  undefined if any segment is missing or traverses a non-object. */
function getValueAtPath(value: unknown, path: string): unknown {
  const segments = path.split('.');
  let cursor: unknown = value;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
    if (cursor === undefined) return undefined;
  }
  return cursor;
}

/**
 * Find which `required` reserved fields are missing from a parsed inbound
 * document. Returns the dot-paths in declaration order so the UI can list
 * the most-shallow issues first (apiVersion before metadata.appId).
 *
 * "Missing" means either:
 *   - the path doesn't exist, or
 *   - the value at the path is the wrong shape (e.g. `metadata` is a string
 *     instead of an object).
 *
 * Empty strings count as present — leaving the value blank is the customer's
 * problem, not a missing-field problem.
 */
export function findMissingReservedFields(doc: unknown): string[] {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    // A non-object document is missing every reserved path by definition;
    // surfacing the full list would be noise, so report the root issue only.
    return RESERVED_FIELDS.filter((f) => f.required).map((f) => f.path);
  }
  const missing: string[] = [];
  for (const field of RESERVED_FIELDS) {
    if (!field.required) continue;
    const value = getValueAtPath(doc, field.path);
    if (value === undefined) {
      missing.push(field.path);
      continue;
    }
    if (field.type === 'object') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        missing.push(field.path);
      }
    } else if (field.type === 'string') {
      if (typeof value !== 'string') missing.push(field.path);
    }
  }
  return missing;
}

export interface ReservedFieldCollision {
  path: string;
  expected: 'string' | 'object';
  found: string;
}

/**
 * Scan a customer-authored schema for reserved-field collisions: a leaf
 * whose declared `type` doesn't match what the orchestrator writes. Returns
 * an empty array when the schema is well-aligned (or when the reserved key
 * simply isn't declared yet).
 */
export function findReservedFieldCollisions(schema: SchemaObject): ReservedFieldCollision[] {
  const collisions: ReservedFieldCollision[] = [];
  for (const field of RESERVED_FIELDS) {
    const leaf = getPropertyAtPath(schema, field.path);
    if (!leaf) continue;
    const found = leaf.type;
    if (typeof found !== 'string') continue;
    if (found !== field.type) {
      collisions.push({ path: field.path, expected: field.type, found });
    }
  }
  return collisions;
}
