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
}

export const RESERVED_FIELDS: ReservedField[] = [
  {
    path: 'apiVersion',
    type: 'string',
    note: 'Routes inbound documents to the correct resource converter. Any string works today.',
  },
  {
    path: 'kind',
    type: 'string',
    note: 'Surfaced in inbound logs. No routing or validation impact.',
  },
  {
    path: 'metadata',
    type: 'object',
    note: 'Customer-driven envelope; forwarded verbatim into input.document.metadata.',
  },
  {
    path: 'metadata.correlationId',
    type: 'string',
    note: 'Mongo _id of the evaluation record. Server mints a UUID when absent.',
  },
  {
    path: 'metadata.name',
    type: 'string',
    note: 'Logical resource name; surfaced on the evaluation record.',
  },
  {
    path: 'spec',
    type: 'object',
    note: 'Customer-driven envelope; forwarded verbatim into input.document.spec.',
  },
  {
    path: 'spec.metadata',
    type: 'object',
    note: 'Customer metadata block under spec; carries appId / organization.',
  },
  {
    path: 'spec.metadata.appId',
    type: 'string',
    note: "Drives applicability matching against each guardrail's applicability rules.",
  },
  {
    path: 'spec.metadata.organization',
    type: 'string',
    note: 'Used to derive the LOB on the evaluation record and downstream events.',
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
