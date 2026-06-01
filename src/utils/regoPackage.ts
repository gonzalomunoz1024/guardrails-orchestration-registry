/**
 * Per-version rego package namespacing.
 *
 * Without this, every version of a guardrail publishes `package <slug>` and
 * OPA's bundle compiler refuses to merge two versions in the same namespace:
 *
 *   multiple default rules data.approved_images.allow found at:
 *     - approved-images@1.0
 *     - approved-images@1.1
 *
 * The fix is to suffix the package with the MAJOR.MINOR so each version
 * lives at its own `data.<slug>.v<major>_<minor>` path. Dashes in the slug
 * become underscores too — Rego identifiers can't carry dashes.
 *
 * The studio's edit experience is unchanged: authors type whatever package
 * directive they want; this helper rewrites it just before the rego is
 * written to GitHub so the published artifact always compiles cleanly.
 */

/** Convert "1.2" → "v1_2". Falls back to v1_0 on a malformed version. */
export function versionSuffix(version: string | undefined | null): string {
  const m = (version ?? '').match(/^(\d+)\.(\d+)$/);
  if (!m) return 'v1_0';
  return `v${m[1]}_${m[2]}`;
}

/**
 * Rewrite the first `package …` directive in `rego` so its trailing segment
 * is the version suffix derived from `version`. If the directive already has
 * a `.vX_Y` suffix it gets replaced; otherwise it's appended. If there's no
 * `package` directive at all we leave the input untouched — the caller has
 * a different problem to solve.
 */
export function appendVersionToRegoPackage(rego: string, version: string): string {
  const suffix = versionSuffix(version);
  return rego.replace(/^(package\s+)([\w.]+)/m, (_match, prefix, pkg) => {
    // Strip a trailing .vN_M if present so we don't stack suffixes when
    // editing an already-versioned rego from a previous publish.
    const stripped = pkg.replace(/\.v\d+_\d+$/, '');
    return `${prefix}${stripped}.${suffix}`;
  });
}
