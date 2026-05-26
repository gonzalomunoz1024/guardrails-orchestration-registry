import type * as Monaco from 'monaco-editor';
import { getRegoInputShape, onRegoInputShapeChange } from './regoInputShape';

/**
 * Live diagnostics for `input.*` references in a Rego policy.
 *
 * Scans the policy for dotted `input` paths and, walking the current input
 * shape, marks any segment that doesn't exist with a warning squiggle (whose
 * message shows on hover). Validation is conservative to avoid false positives:
 * it only flags a key that is missing from a known object, treats the optional
 * `input.configuration` / `input.external` namespaces as opaque when absent, and
 * stops descending once it reaches an array, primitive, or unfetched value.
 */

const MARKER_OWNER = 'rego-input-path';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Mask comments and string literals with spaces (preserving offsets) so the
 * path scanner never matches `input` inside a comment or string.
 */
function maskCommentsAndStrings(text: string): string {
  const out = text.split('');
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '#') {
      while (i < n && text[i] !== '\n') out[i++] = ' ';
    } else if (c === '"' || c === '`') {
      const quote = c;
      out[i++] = ' ';
      while (i < n && text[i] !== quote) {
        if (quote === '"' && text[i] === '\\' && i + 1 < n) out[i++] = ' ';
        out[i++] = ' ';
      }
      if (i < n) out[i++] = ' ';
    } else {
      i++;
    }
  }
  return out.join('');
}

interface MissingSegment {
  /** Segment index within the path (0 = `input`). */
  index: number;
  key: string;
  /** The path up to and including the missing key, e.g. `input.user.rol`. */
  fullPath: string;
  parentPath: string;
}

/** Find the first path segment that doesn't resolve against the shape. */
function firstMissingSegment(segments: string[]): MissingSegment | null {
  if (segments[0] !== 'input') return null;
  let node: unknown = getRegoInputShape();
  for (let i = 1; i < segments.length; i++) {
    // Can only validate keys against a concrete object; otherwise give up.
    if (!isPlainObject(node)) return null;
    const key = segments[i];
    if (key in node) {
      node = (node as Record<string, unknown>)[key];
      continue;
    }
    // Optional, user-addable namespaces are opaque when not currently present.
    if (i === 1 && (key === 'configuration' || key === 'external')) return null;
    return {
      index: i,
      key,
      fullPath: segments.slice(0, i + 1).join('.'),
      parentPath: segments.slice(0, i).join('.'),
    };
  }
  return null;
}

function computeMarkers(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel
): Monaco.editor.IMarkerData[] {
  const text = model.getValue();
  const masked = maskCommentsAndStrings(text);
  const markers: Monaco.editor.IMarkerData[] = [];

  // Match `input` followed by one or more `.identifier` segments.
  const regex = /\binput((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(masked)) !== null) {
    const segments = match[0].split('.');
    const missing = firstMissingSegment(segments);
    if (!missing) continue;

    // Offset of the missing key within the source: 'input' + each `.seg`.
    let rel = 'input'.length;
    for (let j = 1; j < missing.index; j++) rel += 1 + segments[j].length;
    rel += 1; // the dot before the missing key
    const keyStart = match.index + rel;
    const keyEnd = keyStart + missing.key.length;

    const start = model.getPositionAt(keyStart);
    const end = model.getPositionAt(keyEnd);

    markers.push({
      severity: monaco.MarkerSeverity.Warning,
      message: `"${missing.key}" does not exist on \`${missing.parentPath}\`. This path is not present in the current input (document + configuration + external data).`,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
      source: 'input',
    });
  }

  return markers;
}

/**
 * Attach live input-path diagnostics to a Rego editor. Re-validates on edits
 * and whenever the input shape changes. Cleans up when the editor is disposed.
 */
export function attachRegoDiagnostics(
  monaco: typeof Monaco,
  editor: Monaco.editor.IStandaloneCodeEditor
): void {
  const model = editor.getModel();
  if (!model) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const validate = () => {
    monaco.editor.setModelMarkers(model, MARKER_OWNER, computeMarkers(monaco, model));
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(validate, 200);
  };

  validate();
  const contentSub = model.onDidChangeContent(schedule);
  const offShape = onRegoInputShapeChange(schedule);

  editor.onDidDispose(() => {
    if (timer) clearTimeout(timer);
    contentSub.dispose();
    offShape();
  });
}
