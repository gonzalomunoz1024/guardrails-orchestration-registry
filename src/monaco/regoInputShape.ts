/**
 * Shared, live OPA input shape — the merged document + configuration +
 * external-dependency data + guardrail metadata. Both the Rego autocomplete
 * and the path diagnostics read from here, and subscribers are notified when
 * it changes so diagnostics can re-run.
 */

let currentShape: Record<string, unknown> = {};
const listeners = new Set<() => void>();

/** Update the input shape and notify subscribers. */
export function setRegoInputShape(shape: Record<string, unknown>): void {
  currentShape = shape ?? {};
  listeners.forEach((l) => l());
}

export function getRegoInputShape(): Record<string, unknown> {
  return currentShape;
}

/** Subscribe to shape changes. Returns an unsubscribe function. */
export function onRegoInputShapeChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
