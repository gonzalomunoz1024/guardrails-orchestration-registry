import { useEffect, useRef } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/utils';

interface InputStructurePreviewProps {
  /** The roots to render — typically `{ document, configuration, external }`. */
  input: Record<string, unknown>;
  /**
   * Dotted path inside `input` that should be highlighted (e.g.
   * `document.metadata.appId`). When this matches a rendered key the row
   * smoothly highlights and auto-scrolls into view. Pass null to clear.
   */
  activePath: string | null;
}

/**
 * Read-only YAML-shaped view of the assembled OPA input. Built bespoke (not
 * via js-yaml) so every key carries a `data-path` attribute we can resolve at
 * highlight time — that's what makes the External Dependency editor's path
 * pickers feel like they're pointing at real structure instead of opening
 * blind. Apple-styled: generous gutter, no braces, soft accent on the active
 * row, smooth scroll-into-view.
 */
export function InputStructurePreview({ input, activePath }: InputStructurePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smoothly scroll the active line into view whenever the path changes.
  // Apple-feel: keep the row off the top edge with some headroom so the user
  // sees a bit of surrounding context.
  useEffect(() => {
    if (!activePath || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-path="${cssEscape(activePath)}"]`
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePath]);

  const lines = renderInputLines(input);

  return (
    <div className="h-full min-h-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60">
        <Layers className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Input structure
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)]">
          read-only · for reference
        </span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-auto py-3 px-4 text-[12px] font-mono leading-[1.7] text-[var(--color-text-secondary)]"
      >
        {lines.length === 0 ? (
          <p className="text-[11px] text-[var(--color-text-tertiary)] italic">
            No document, configuration, or external data yet.
          </p>
        ) : (
          lines.map((line, i) => (
            <PreviewLine key={i} line={line} active={activePath === line.path} />
          ))
        )}
      </div>
    </div>
  );
}

interface PreviewLineProps {
  line: RenderLine;
  active: boolean;
}

function PreviewLine({ line, active }: PreviewLineProps) {
  return (
    <div
      data-path={line.path ?? undefined}
      className={cn(
        'flex items-baseline rounded-[6px] px-2 -mx-2 transition-colors duration-200',
        active && 'bg-[var(--color-info-bg)]'
      )}
      style={{ paddingLeft: `${line.depth * 16 + 8}px` }}
    >
      {line.key !== null && (
        <span
          className={cn(
            'text-[var(--color-text-primary)] transition-colors',
            active && 'text-[var(--color-info)] font-medium'
          )}
        >
          {line.key}
          <span className="text-[var(--color-text-tertiary)]">:</span>
        </span>
      )}
      {line.valueText !== null && (
        <span className={cn('ml-2', valueClass(line.valueKind))}>{line.valueText}</span>
      )}
    </div>
  );
}

interface RenderLine {
  depth: number;
  key: string | null;
  path: string | null;
  valueText: string | null;
  valueKind: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'empty';
}

/** Walk the input object and emit one RenderLine per key. */
function renderInputLines(value: unknown, prefix = '', depth = 0, out: RenderLine[] = []): RenderLine[] {
  if (value == null || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    if (value.length === 0) return out;
    value.forEach((item, i) => {
      const itemPath = `${prefix}.${i}`;
      const key = `- [${i}]`;
      pushValue(out, depth, key, itemPath, item);
      if (item && typeof item === 'object') {
        renderInputLines(item, itemPath, depth + 1, out);
      }
    });
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    pushValue(out, depth, k, path, v);
    if (v && typeof v === 'object') {
      renderInputLines(v, path, depth + 1, out);
    }
  }
  return out;
}

function pushValue(
  out: RenderLine[],
  depth: number,
  key: string,
  path: string,
  v: unknown
): void {
  if (v === null) {
    out.push({ depth, key, path, valueText: 'null', valueKind: 'null' });
    return;
  }
  if (Array.isArray(v)) {
    out.push({
      depth,
      key,
      path,
      valueText: v.length === 0 ? '[]' : '',
      valueKind: v.length === 0 ? 'empty' : 'array',
    });
    return;
  }
  if (typeof v === 'object') {
    const entries = Object.keys(v as Record<string, unknown>);
    out.push({
      depth,
      key,
      path,
      valueText: entries.length === 0 ? '{}' : '',
      valueKind: entries.length === 0 ? 'empty' : 'object',
    });
    return;
  }
  if (typeof v === 'string') {
    // Keep YAML feel: quote only when the string would otherwise be ambiguous.
    const needsQuotes = /[:#\n]|^\s|\s$|^$/.test(v);
    out.push({
      depth,
      key,
      path,
      valueText: needsQuotes ? JSON.stringify(v) : v,
      valueKind: 'string',
    });
    return;
  }
  out.push({
    depth,
    key,
    path,
    valueText: String(v),
    valueKind: typeof v === 'number' ? 'number' : 'boolean',
  });
}

function valueClass(kind: RenderLine['valueKind']): string {
  switch (kind) {
    case 'string':
      return 'text-[var(--color-text-secondary)]';
    case 'number':
      return 'text-[var(--color-info)]';
    case 'boolean':
      return 'text-[var(--color-info)]';
    case 'null':
      return 'text-[var(--color-text-tertiary)] italic';
    case 'empty':
      return 'text-[var(--color-text-tertiary)]';
    default:
      return 'text-[var(--color-text-tertiary)]';
  }
}

/** Tiny CSS.escape polyfill — paths contain dots which are valid in attr
 * selectors but `metadata.appId` would otherwise collapse to "metadata"
 * inside querySelector. */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/(["\\])/g, '\\$1');
}
