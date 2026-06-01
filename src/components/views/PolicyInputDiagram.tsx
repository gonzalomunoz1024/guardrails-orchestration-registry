import {
  FileText,
  SlidersHorizontal,
  Cloud,
  Layers,
  FileCode2,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { cn } from '@/utils';
import type { ExternalDependency } from '@/types';

interface PolicyInputDiagramProps {
  /** The persisted configuration body, JSON-stringified. {} means no config. */
  configJson: string;
  /** Decoded external dependencies from the manifest. */
  externalDeps: ExternalDependency[];
  /** Hook into the parent's tab switcher so "View full code" opens the Rego tab. */
  onJumpToRego: () => void;
}

/**
 * Apple-flavored visual of how a guardrail evaluates a request:
 *
 *   ┌──────────┐
 *   │ Document │──┐
 *   └──────────┘  │   ┌──────────────┐    ┌──────────┐
 *                 ├──▶│ input bundle │───▶│   Rego   │──▶ Decision
 *   ┌──────────┐  │   └──────────────┘    └──────────┘
 *   │  Config  │──┤
 *   └──────────┘  │
 *   ┌──────────┐  │
 *   │ ext.foo  │──┘
 *   └──────────┘
 *
 * Replaces the old Policy Code Preview card on the Overview tab. Each source
 * row tells the author exactly where the data shows up under `input.*`, so
 * they can map a rego reference back to its origin without leaving the page.
 */
export function PolicyInputDiagram({
  configJson,
  externalDeps,
  onJumpToRego,
}: PolicyInputDiagramProps) {
  // The document is always present; config and externals are conditional.
  const trimmedConfig = configJson?.trim?.() ?? '';
  const hasConfig = trimmedConfig !== '' && trimmedConfig !== '{}';
  const deps = externalDeps ?? [];

  type Source = {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    /** Where the source lands in the merged input bundle. */
    path: string;
    /** Tiny caption under the path. */
    caption?: string;
  };

  const sources: Source[] = [
    {
      id: 'document',
      icon: FileText,
      label: 'Document',
      path: 'input.document.*',
      caption: 'The inbound request payload',
    },
    ...(hasConfig
      ? [
          {
            id: 'configuration',
            icon: SlidersHorizontal,
            label: 'Configuration',
            path: 'input.configuration',
            caption: 'Static data published with the guardrail',
          },
        ]
      : []),
    ...deps.map((d) => ({
      id: `external-${d.name}`,
      icon: Cloud,
      label: d.name || 'external',
      path: `input.external.${d.name || '…'}`,
      caption: d.method && d.path ? `${d.method} ${d.path}` : 'Fetched at evaluation time',
    })),
  ];

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <header className="px-6 py-5 border-b border-[var(--color-border-light)]">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
          How this guardrail evaluates input
        </h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Sources merge into a single OPA input bundle that the Rego policy reads at evaluation time.
        </p>
      </header>

      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,0.9fr)_auto_minmax(0,1fr)] gap-x-5 gap-y-6 items-center">
          {/* Column 1 — source stack */}
          <div className="flex flex-col gap-3 lg:gap-4">
            {sources.map((s) => (
              <SourceCard key={s.id} icon={s.icon} label={s.label} path={s.path} caption={s.caption} />
            ))}
          </div>

          <ArrowGutter />

          {/* Column 2 — combined input bundle */}
          <BundleCard sourceCount={sources.length} />

          <ArrowGutter />

          {/* Column 3 — rego + decision */}
          <div className="flex flex-col gap-4">
            <RegoCard onJumpToRego={onJumpToRego} />
            <div className="flex justify-center text-[var(--color-text-tertiary)]">
              <ChevronRight className="w-5 h-5 rotate-90" />
            </div>
            <DecisionCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceCard({
  icon: Icon,
  label,
  path,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  caption?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-info)]/50 hover:shadow-[var(--shadow-sm)] transition-all">
      <span className="shrink-0 mt-0.5 p-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{label}</p>
        <code className="block text-[11px] font-mono text-[var(--color-info)] truncate">{path}</code>
        {caption && (
          <p className="mt-0.5 text-[11px] text-[var(--color-text-tertiary)] truncate">{caption}</p>
        )}
      </div>
    </div>
  );
}

function BundleCard({ sourceCount }: { sourceCount: number }) {
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-info)]/30 bg-gradient-to-br from-[var(--color-info-bg)] to-[var(--color-surface)] p-5 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex w-10 h-10 items-center justify-center rounded-full bg-[var(--color-surface)] border border-[var(--color-info)]/30 text-[var(--color-info)] shadow-[var(--shadow-sm)]">
        <Layers className="w-5 h-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">Input bundle</p>
      <code className="block mt-1 text-[11px] font-mono text-[var(--color-info)]">input</code>
      <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
        Assembled from {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
      </p>
    </div>
  );
}

function RegoCard({ onJumpToRego }: { onJumpToRego: () => void }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex w-10 h-10 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]">
        <FileCode2 className="w-5 h-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">Rego policy</p>
      <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
        Reads <code className="font-mono">input</code> and returns a decision
      </p>
      <button
        onClick={onJumpToRego}
        className="mt-3 text-xs font-medium text-[var(--color-info)] hover:underline"
      >
        View full code
      </button>
    </div>
  );
}

function DecisionCard() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60 p-4 text-center">
      <div className="mx-auto flex w-8 h-8 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)]">
        <Shield className="w-4 h-4" />
      </div>
      <p className="mt-2 text-xs font-medium text-[var(--color-text-primary)]">Decision</p>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">allow · deny · warn</p>
    </div>
  );
}

/** A thin horizontal line that terminates in a chevron. Used between
 *  diagram columns so the eye follows source → bundle → rego at a glance. */
function ArrowGutter() {
  return (
    <div className={cn('hidden lg:flex items-center justify-center text-[var(--color-text-tertiary)]')}>
      <div className="flex items-center gap-1">
        <span className="w-6 h-px bg-[var(--color-border)]" />
        <ChevronRight className="w-4 h-4" />
      </div>
    </div>
  );
}
