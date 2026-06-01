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

import { applyReservedFields } from './reservedFields';

function schemaForValue(value: unknown): Record<string, unknown> {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    return { type: 'array', items: value.length > 0 ? schemaForValue(value[0]) : {} };
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
