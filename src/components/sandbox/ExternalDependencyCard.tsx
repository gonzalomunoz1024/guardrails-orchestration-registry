import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Sliders,
  Trash2,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import { EXTERNAL_SERVICES } from '@/services/external/externalServices';
import { cn } from '@/utils';
import type { ExternalDependency } from '@/types';
import { ExternalDependencyModal } from './ExternalDependencyModal';

interface ExternalDependencyCardProps {
  dep: ExternalDependency;
  isExplorerOpen: boolean;
  onOpenExplorer: () => void;
  onCloseExplorer: () => void;
}

export function ExternalDependencyCard({
  dep,
  isExplorerOpen,
  onOpenExplorer,
  onCloseExplorer,
}: ExternalDependencyCardProps) {
  const { removeExternalDep } = usePolicyStore();
  const service = EXTERNAL_SERVICES.find((s) => s.id === dep.serviceId);
  const configured = Boolean(dep.serviceId);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-2 min-w-0">
          <Cloud className="w-4 h-4 text-[var(--color-info)] shrink-0" />
          <code className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
            input.external.{dep.name || '…'}
          </code>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {dep.status === 'success' && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" /> fetched
            </span>
          )}
          {dep.status === 'error' && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-error)]">
              <AlertCircle className="w-3.5 h-3.5" /> error
            </span>
          )}
          {service?.docsUrl && (
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Swagger docs"
              className="p-1 rounded hover:bg-[var(--color-border-light)] text-[var(--color-text-tertiary)] hover:text-[var(--color-info)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => removeExternalDep(dep.id)}
            title="Remove dependency"
            className="p-1 rounded hover:bg-[var(--color-error-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Summary of the current selection */}
        {configured ? (
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] min-w-0">
            <span className="font-medium text-[var(--color-text-primary)] truncate">
              {service?.name ?? 'Custom service'}
            </span>
            {dep.path ? (
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-info-bg)] text-[var(--color-info)]">
                  {dep.method}
                </span>
                <code className="font-mono truncate">{dep.path}</code>
              </span>
            ) : (
              <span className="text-[var(--color-text-tertiary)]">· no endpoint selected</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-tertiary)]">
            No service selected yet.
          </p>
        )}

        {/* Primary launcher — the obvious next step */}
        <button
          onClick={onOpenExplorer}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
            'bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90'
          )}
        >
          <Sliders className="w-4 h-4" />
          {configured ? 'Open API explorer' : 'Choose a service in API explorer'}
        </button>

        {dep.status === 'error' && dep.error && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="w-3.5 h-3.5" /> {dep.error}
          </p>
        )}
      </div>

      <ExternalDependencyModal dep={dep} isOpen={isExplorerOpen} onClose={onCloseExplorer} />
    </div>
  );
}
