/**
 * Cross-member schema conflict detection for suite assembly.
 *
 * Every guardrail in a suite runs on the same inbound document. Members for
 * the same resource kind therefore see the same input — if two of them
 * declare contradictory shapes for the same field path, one of them will
 * reject every input the other accepts. We surface this at *build* time so
 * authors find the conflict in the Suite Builder, not in production logs.
 *
 * What counts as a conflict:
 *   - Same dot-path declared with two non-"any" types across members in the
 *     same resource-kind group (e.g. `spec.size` is a string in guardrail A
 *     and an integer in guardrail B).
 *
 * What does NOT count as a conflict:
 *   - One member declares `metadata.appId`, another doesn't reference it.
 *     That's just the union of expected fields, not a contradiction.
 *   - A field's type is `any` on either side (no constraint).
 */

import type { ResolvedMemberContract } from '@/types/suite.types';

/** One member's contribution to the conflict report. */
export interface MemberSchemaInput {
  guardrailId: string;
  displayName: string;
  /** PascalCase resource-kind label, e.g. "VirtualMachine". */
  resourceKind: string;
  contract: ResolvedMemberContract | undefined;
}

export interface FieldTypeBinding {
  guardrailId: string;
  displayName: string;
  /** The declared JSON-Schema type for this path. */
  type: string;
}

export interface FieldTypeConflict {
  /** Dot path with `[]` for arrays — e.g. `spec.disks[].sizeGb`. */
  path: string;
  /** One entry per distinct type seen at this path. */
  bindings: FieldTypeBinding[];
}

export interface ResourceKindReport {
  resourceKind: string;
  /** Members that contributed schemas to the comparison. */
  comparedMembers: { guardrailId: string; displayName: string }[];
  /** Members in this group that don't have a published schema yet. */
  unschemaedMembers: { guardrailId: string; displayName: string }[];
  conflicts: FieldTypeConflict[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Walk a JSON Schema node and record every dot-path's declared type. Empty
 * object schemas (`{}`) and nodes with no `type` are recorded as `'any'`
 * so the comparison can treat them as "no constraint" rather than colliding
 * spuriously.
 */
function collectTypes(
  schema: unknown,
  prefix: string,
  out: Map<string, string>
): void {
  if (!isPlainObject(schema)) return;

  const t = typeof schema.type === 'string' ? schema.type : 'any';
  if (prefix) out.set(prefix, t);

  if (t === 'object' && isPlainObject(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) {
      const childPath = prefix ? `${prefix}.${name}` : name;
      collectTypes(child, childPath, out);
    }
  } else if (t === 'array' && isPlainObject(schema.items)) {
    collectTypes(schema.items, `${prefix}[]`, out);
  }
}

/**
 * Inspect a set of pinned suite members for cross-member schema conflicts.
 * Groups by resource kind first — only members targeting the same kind get
 * fed the same input, so cross-kind comparisons aren't meaningful.
 *
 * Returns one report per resource-kind group that has at least two members
 * AND at least one conflict. Groups with zero or one member, or with no
 * conflicts, are omitted. Callers render the result as warning cards.
 */
export function detectSuiteSchemaConflicts(
  members: MemberSchemaInput[]
): ResourceKindReport[] {
  const groups = new Map<string, MemberSchemaInput[]>();
  for (const m of members) {
    if (!m.resourceKind) continue;
    const arr = groups.get(m.resourceKind) ?? [];
    arr.push(m);
    groups.set(m.resourceKind, arr);
  }

  const reports: ResourceKindReport[] = [];
  for (const [resourceKind, groupMembers] of groups.entries()) {
    if (groupMembers.length < 2) continue;

    const schemaed = groupMembers.filter((m) => m.contract?.schema);
    const unschemaed = groupMembers
      .filter((m) => !m.contract?.schema)
      .map((m) => ({ guardrailId: m.guardrailId, displayName: m.displayName }));

    // Build path → (type → list of members declaring that type)
    const pathToTypes = new Map<string, Map<string, FieldTypeBinding[]>>();
    for (const m of schemaed) {
      const local = new Map<string, string>();
      collectTypes(m.contract!.schema!, '', local);
      for (const [path, type] of local.entries()) {
        if (type === 'any') continue;
        const byType = pathToTypes.get(path) ?? new Map<string, FieldTypeBinding[]>();
        const bucket = byType.get(type) ?? [];
        bucket.push({
          guardrailId: m.guardrailId,
          displayName: m.displayName,
          type,
        });
        byType.set(type, bucket);
        pathToTypes.set(path, byType);
      }
    }

    const conflicts: FieldTypeConflict[] = [];
    for (const [path, byType] of pathToTypes.entries()) {
      // A conflict requires at least two *distinct* concrete types declared
      // at this path. One-type entries are just the union case.
      if (byType.size < 2) continue;
      const flattened: FieldTypeBinding[] = [];
      for (const bucket of byType.values()) flattened.push(...bucket);
      conflicts.push({ path, bindings: flattened });
    }

    if (conflicts.length === 0 && unschemaed.length === 0) continue;

    // Sort conflicts shallowest path first — they're usually the most
    // important for the reader to see.
    conflicts.sort((a, b) => {
      const da = a.path.split('.').length;
      const db = b.path.split('.').length;
      if (da !== db) return da - db;
      return a.path.localeCompare(b.path);
    });

    reports.push({
      resourceKind,
      comparedMembers: schemaed.map((m) => ({
        guardrailId: m.guardrailId,
        displayName: m.displayName,
      })),
      unschemaedMembers: unschemaed,
      conflicts,
    });
  }

  // Most-conflicted groups first so the worst offender doesn't get buried.
  reports.sort((a, b) => b.conflicts.length - a.conflicts.length);
  return reports;
}
