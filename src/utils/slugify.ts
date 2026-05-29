/**
 * Stable id derived from a guardrail's display name. Used as the package name
 * in the Rego policy and as the local-draft key.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
