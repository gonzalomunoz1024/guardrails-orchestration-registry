/**
 * MAJOR.MINOR version helpers. Guardrails use a two-part version (no patch);
 * updating a published guardrail bumps MINOR, a MAJOR bump is explicit, and
 * (guardrailId, version) is immutable.
 */

const VERSION_RE = /^\d+\.\d+$/;

export interface ParsedVersion {
  major: number;
  minor: number;
}

export function isValidVersion(version: string): boolean {
  return VERSION_RE.test(version.trim());
}

export function parseVersion(version: string): ParsedVersion {
  const [major, minor] = version.trim().split('.');
  return { major: Number(major) || 0, minor: Number(minor) || 0 };
}

export function formatVersion({ major, minor }: ParsedVersion): string {
  return `${major}.${minor}`;
}

/** Bump the minor component: 1.3 → 1.4. */
export function incrementMinor(version: string): string {
  const { major, minor } = parseVersion(version);
  return formatVersion({ major, minor: minor + 1 });
}

/** Bump the major component and reset minor: 1.3 → 2.0. */
export function incrementMajor(version: string): string {
  const { major } = parseVersion(version);
  return formatVersion({ major: major + 1, minor: 0 });
}

/**
 * The version to publish given a base (the loaded version, or null for new).
 * New guardrails start at 1.0; updates auto-increment minor unless an explicit
 * major bump is requested.
 */
export function nextPublishVersion(baseVersion: string | null, bump: 'minor' | 'major' = 'minor'): string {
  if (!baseVersion) return '1.0';
  return bump === 'major' ? incrementMajor(baseVersion) : incrementMinor(baseVersion);
}
