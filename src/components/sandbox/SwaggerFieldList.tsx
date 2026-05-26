import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/utils';
import type { SwaggerField } from '@/types';

interface SwaggerFieldListProps {
  fields: SwaggerField[];
  /** Dependency name, used to build the `input.external.<name>.<field>` ref. */
  depName: string;
}

/**
 * Browser for the response fields discovered in a Swagger operation. Each row
 * shows the dotted Rego reference and type; clicking copies the reference so it
 * can be pasted straight into a policy.
 */
export function SwaggerFieldList({ fields, depName }: SwaggerFieldListProps) {
  const [copied, setCopied] = useState<string | null>(null);

  if (fields.length === 0) {
    return (
      <p className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
        No documented response fields for this endpoint.
      </p>
    );
  }

  const refFor = (path: string) =>
    `input.external.${depName || 'dependency'}.${path}`;

  const copy = (path: string) => {
    const ref = refFor(path);
    navigator.clipboard?.writeText(ref);
    setCopied(path);
    setTimeout(() => setCopied((c) => (c === path ? null : c)), 1200);
  };

  return (
    <div className="max-h-44 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border-light)] divide-y divide-[var(--color-border-light)]">
      {fields.map((field) => (
        <button
          key={field.path}
          onClick={() => copy(field.path)}
          title={`Copy ${refFor(field.path)}`}
          className="w-full flex items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-[var(--color-surface-secondary)] transition-colors group"
        >
          <span className="min-w-0 flex items-center gap-2">
            <code className="truncate text-xs font-mono text-[var(--color-text-primary)]">
              {field.path}
            </code>
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
              {field.type}
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 transition-opacity',
              copied === field.path
                ? 'opacity-100 text-[var(--color-success)]'
                : 'opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)]'
            )}
          >
            {copied === field.path ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
