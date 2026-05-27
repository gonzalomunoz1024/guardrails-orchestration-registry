/**
 * Parse an OPA/Rego error message for a source location so the studio can
 * highlight the offending line. OPA reports errors like:
 *   "policy.rego:7:12: rego_parse_error: unexpected assign token"
 *   "1 error occurred: policy.rego:5: rego_type_error: ..."
 * and occasionally "... on line 7".
 */
export interface RegoErrorLocation {
  line: number;
  column: number;
}

export function parseRegoErrorLocation(error: string | undefined | null): RegoErrorLocation | null {
  if (!error) return null;

  // file.rego:row:col  (or bare :row:col:)
  let m = error.match(/(?:\.rego)?:(\d+):(\d+)/);
  if (m) return { line: Number(m[1]), column: Number(m[2]) };

  // file.rego:row  (no column)
  m = error.match(/\.rego:(\d+)\b/);
  if (m) return { line: Number(m[1]), column: 1 };

  // "... line 7" fallback
  m = error.match(/\bline\s+(\d+)/i);
  if (m) return { line: Number(m[1]), column: 1 };

  return null;
}
