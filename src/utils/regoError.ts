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

interface OpaErrorEntry {
  code?: string;
  message?: string;
  location?: {
    file?: string;
    row?: number;
    col?: number;
    line?: number;
    column?: number;
  };
}

interface OpaErrorBody {
  opa?: { code?: string; message?: string; errors?: OpaErrorEntry[] };
  error?: string;
  message?: string;
}

/**
 * Format an OPA error response body into a readable message, embedding the
 * source location as `(file:row:col)` so it both reads naturally and is
 * parseable by parseRegoErrorLocation for editor highlighting. Returns null if
 * the body doesn't look like an OPA error.
 *
 * Expected shape:
 *   { opa: { code, message, errors: [ { code, message, location: {file,row,col} } ] }, error? }
 */
export function formatOpaError(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const body = data as OpaErrorBody;
  const opa = body.opa;

  if (opa?.errors && opa.errors.length > 0) {
    const lines = opa.errors.map((e) => {
      const loc = e.location;
      const row = loc?.row ?? loc?.line;
      const col = loc?.col ?? loc?.column ?? 1;
      const at = row != null ? ` (${loc?.file || 'policy'}:${row}:${col})` : '';
      const code = e.code ? `${e.code}: ` : '';
      return `${code}${e.message ?? ''}${at}`;
    });
    const header = opa.message ? [opa.message] : [];
    return [...header, ...lines].join('\n');
  }

  if (typeof body.error === 'string') return body.error;
  if (typeof body.message === 'string') return body.message;
  return null;
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
