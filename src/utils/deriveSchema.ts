/**
 * Derive a draft-07 JSON Schema from a sample document, so a guardrail can
 * publish the input contract that suite adopters must satisfy. The schema
 * describes the document (the caller-supplied portion of the OPA input); the
 * platform injects `guardrail` / `configuration` / `external` at runtime.
 *
 * The derived schema always carries the orchestrator-reserved envelope
 * (apiVersion / kind / metadata / spec) at the right types so it never
 * accidentally disallows what the platform always writes — even if the
 * customer omitted those keys from their sample document. See
 * src/utils/reservedFields.ts.
 */

import { applyReservedFields, stripOptionalReservedFields } from './reservedFields';

function schemaForValue(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    // For non-empty arrays we infer the element schema from the first item.
    // Empty arrays carry no information about element shape, so we emit the
    // bare `{ type: "array" }` rather than an `items: {}` placeholder — that
    // placeholder used to perpetually drift against schemas published before
    // it was added, causing every Edit to look like a contract change even
    // for pure config edits.
    return value.length > 0
      ? { type: 'array', items: schemaForValue(value[0]) }
      : { type: 'array' };
  }
  if (typeof value === 'object') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      properties[key] = schemaForValue(v);
      required.push(key);
    }
    const out: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) out.required = required;
    return out;
  }
  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

/** Build a draft-07 schema object from an already-parsed sample value. */
export function deriveSchema(value: unknown): Record<string, unknown> {
  const base = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    ...schemaForValue(value ?? {}),
  };
  return applyReservedFields(base);
}

/** Derive a pretty-printed JSON Schema string from a sample document string. */
export function deriveSchemaFromJson(json: string): string {
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(json || '{}');
  } catch {
    return '{}';
  }
  return JSON.stringify(deriveSchema(parsed), null, 2);
}

/**
 * Structural equality for JSON-shaped values, used to compare a published
 * schema (round-tripped through YAML/Mongo/the registry) against a
 * locally-derived schema. Byte-equality on the JSON.stringify of either
 * side is too brittle for this purpose:
 *
 *   - The backend YAML serializer reorders object keys.
 *   - It drops empty arrays — a `required: []` on the local side comes
 *     back as a missing `required` key on the wire.
 *   - Numeric / whitespace formatting can drift across the round-trip.
 *
 * This helper treats `required: []` as equivalent to a missing `required`
 * key, treats arrays as multisets when the key name is "required" or
 * "enum" (where order is semantically irrelevant) and otherwise positional,
 * and compares objects key-by-key without insertion-order sensitivity.
 *
 * Used to decide "is this published schema the auto-derive of the
 * published example?" without false negatives from cosmetic drift.
 */
export function schemasAreStructurallyEqual(a: unknown, b: unknown): boolean {
  // Normalize away legacy `required: false` reserved-field declarations.
  // Schemas published BEFORE applyReservedFields stopped force-injecting
  // optional reserved fields still carry e.g. `metadata.organization` even
  // when the source document didn't. After the change, the local derive
  // doesn't carry them. Stripping both sides means an Edit on a v1.4
  // guardrail still detects "this is the auto-derive form" and lands the
  // user in Auto mode.
  return compare(stripOptionalReservedFields(a), stripOptionalReservedFields(b), '');
}

function isEmptyPlainObject(v: unknown): boolean {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v as Record<string, unknown>).length === 0
  );
}

function compare(a: unknown, b: unknown, key: string): boolean {
  // Both arrays of strings under `required` (or `enum`) are sets, not lists.
  if (Array.isArray(a) && Array.isArray(b)) {
    const orderInsensitive = key === 'required' || key === 'enum';
    if (a.length !== b.length) return false;
    if (orderInsensitive) {
      const counts = new Map<string, number>();
      for (const x of a) counts.set(String(x), (counts.get(String(x)) ?? 0) + 1);
      for (const y of b) {
        const k = String(y);
        const n = counts.get(k);
        if (!n) return false;
        if (n === 1) counts.delete(k);
        else counts.set(k, n - 1);
      }
      return counts.size === 0;
    }
    return a.every((item, i) => compare(item, b[i], ''));
  }
  // One side array, the other not — except: `required: []` == `required` missing.
  if (Array.isArray(a) || Array.isArray(b)) {
    if (key === 'required') {
      const arr = (Array.isArray(a) ? a : b) as unknown[];
      const other = Array.isArray(a) ? b : a;
      return arr.length === 0 && other === undefined;
    }
    return false;
  }
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) {
    const av = ao[k];
    const bv = bo[k];
    // Tolerate `required: []` on either side against a missing key on the other.
    if (k === 'required') {
      if (av === undefined && Array.isArray(bv) && bv.length === 0) continue;
      if (bv === undefined && Array.isArray(av) && av.length === 0) continue;
    }
    // Tolerate `items: {}` (empty placeholder) on either side against a missing
    // `items` on the other. `{ type: "array" }` and `{ type: "array", items: {} }`
    // mean the same thing in JSON Schema — both leave element shape unconstrained.
    // The auto-derive used to emit the empty placeholder; older publishes (and
    // the new derive) don't. Treat them as equivalent so an Edit doesn't get
    // tagged as a contract change just because of this drift.
    if (k === 'items') {
      if (av === undefined && isEmptyPlainObject(bv)) continue;
      if (bv === undefined && isEmptyPlainObject(av)) continue;
    }
    if (!compare(av, bv, k)) return false;
  }
  return true;
}
