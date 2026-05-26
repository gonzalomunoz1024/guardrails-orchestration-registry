import { useState } from 'react';
import { Check, Copy, Layers } from 'lucide-react';
import { cn } from '@/utils';

interface CombinedInputPreviewProps {
  /** The fully assembled OPA input. */
  input: Record<string, unknown>;
}

/**
 * Full-height, read-only view of the assembled OPA input — the merge of the
 * document, static configuration, and external-dependency data that the policy
 * evaluates against. Shown when the Input panel is switched to "Combined" mode.
 */
export function CombinedInputPreview({ input }: CombinedInputPreviewProps) {
  const json = JSON.stringify(input, null, 2);
  const topKeys = Object.keys(input);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="h-full min-h-0 flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden shadow-[var(--shadow-card)]">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)]">
        <Layers className="w-3.5 h-3.5 text-[var(--color-text-secondary)] shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] shrink-0">
          Combined Input
        </span>
        <code className="font-mono text-[10px] text-[var(--color-text-tertiary)] truncate">
          input = {`{ ${topKeys.join(', ')} }`}
        </code>
        <button
          onClick={copy}
          title="Copy JSON"
          aria-label="Copy JSON"
          className={cn(
            'ml-auto shrink-0 flex items-center justify-center p-1 rounded-md transition-all',
            copied
              ? 'text-[var(--color-success)]'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="flex-1 min-h-0 overflow-auto px-3 py-2 text-xs font-mono leading-relaxed text-[var(--color-text-secondary)]">
        {json}
      </pre>
    </div>
  );
}
