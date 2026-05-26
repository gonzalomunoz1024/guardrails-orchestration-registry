import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { cn } from '@/utils';

interface CombinedInputPreviewProps {
  /** The fully assembled OPA input. */
  input: Record<string, unknown>;
}

/**
 * Read-only preview of the assembled OPA input — the merge of the document,
 * static configuration, and external-dependency data that the policy evaluates
 * against. Helps users see exactly what `input` looks like.
 */
export function CombinedInputPreview({ input }: CombinedInputPreviewProps) {
  const [open, setOpen] = useState(true);
  const json = JSON.stringify(input, null, 2);
  const topKeys = Object.keys(input);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden shadow-[var(--shadow-card)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border-light)] transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          <Layers className="w-3.5 h-3.5" />
          Combined Input
          <span className="font-mono lowercase tracking-normal text-[10px] text-[var(--color-text-tertiary)]">
            input = {`{ ${topKeys.join(', ')} }`}
          </span>
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        )}
      </button>
      {open && (
        <pre
          className={cn(
            'max-h-48 overflow-auto px-3 py-2 text-xs font-mono leading-relaxed',
            'text-[var(--color-text-secondary)]'
          )}
        >
          {json}
        </pre>
      )}
    </div>
  );
}
