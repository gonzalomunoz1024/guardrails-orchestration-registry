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
 * Inverse of appendVersionToRegoPackage: strip a trailing `.vN_M` segment
 * from the first `package …` directive. The publish flow adds the suffix
 * so each version lives at its own bundle path; the studio's *edit* flow
 * doesn't want to display it — authors think in terms of the bare package
 * name, OPA linters flag the suffix as "package should match the guardrail
 * slug", and any manual fix-up the author makes to delete the suffix
 * registers as a contract change and forces a spurious version bump.
 * Strip on load, append on publish — the suffix stays an artifact of the
 * published file, not of the in-editor source.
 */
export function stripVersionFromRegoPackage(rego: string): string {
  // Lazy `+?` plus the lookahead anchor means we only peel off a `.vN_M`
  // that's the LAST segment of the package directive — not one buried in
  // the middle of a chained path like `foo.v1_0.bar` (unlikely, but we
  // shouldn't silently mangle it).
  return rego.replace(/^(package\s+[\w.]+?)\.v\d+_\d+(?=\s|$)/m, '$1');
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
