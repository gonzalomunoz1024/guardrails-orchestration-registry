import { useMemo } from 'react';
import {
  Layers,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Package,
  CheckCircle,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { useSuites } from '@/hooks/useSuites';
import { cn } from '@/utils';
import type { GuardrailSuite, SuiteStatus } from '@/types/suite.types';

const STATUS_LABELS: Record<SuiteStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DRAFT: 'Draft',
};

function statusIcon(status: SuiteStatus) {
  switch (status) {
    case 'ACTIVE':
      return <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />;
    case 'DRAFT':
      return <AlertCircle className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
    case 'INACTIVE':
      return <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />;
  }
}

function SuiteCard({ suite, onClick }: { suite: GuardrailSuite; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-5 rounded-[var(--radius-lg)] border border-[var(--color-border-light)]',
        'bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        'hover:border-[var(--color-info)] hover:shadow-[var(--shadow-md)]',
        'transition-all duration-200 group'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
              {statusIcon(suite.status)}
              {STATUS_LABELS[suite.status]}
            </span>
          </div>
          <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-info)] transition-colors">
            {suite.displayName}
          </h3>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-info)] transition-colors" />
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-secondary)] line-clamp-2">
        {suite.description || 'No description'}
      </p>

      <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5" />
          {suite.members.length} {suite.members.length === 1 ? 'guardrail' : 'guardrails'}
        </span>
        <span>{suite.owner}</span>
      </div>
    </button>
  );
}

export function SuiteCatalog() {
  const { searchQuery, navigateToSuite, navigateToSuiteBuilder } = useRegistryStore();
  const { data, isLoading, error, refetch } = useSuites();

  const suites = data ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery) return suites;
    const q = searchQuery.toLowerCase();
    return suites.filter(
      (s) => s.displayName.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
    );
  }, [suites, searchQuery]);

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <Layers className="w-5 h-5" />
            <span className="text-sm font-medium">Guardrail Suites</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {filtered.length} {filtered.length === 1 ? 'suite' : 'suites'}
            </span>
            <button
              onClick={() => navigateToSuiteBuilder()}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Create Suite
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <Loader2 className="w-12 h-12 mb-3 animate-spin text-[var(--color-info)]" />
            <p className="text-lg font-medium">Loading suites...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <AlertCircle className="w-12 h-12 mb-3 text-[var(--color-warning)]" />
            <p className="text-lg font-medium">Could not load suites</p>
            <p className="text-sm mb-4">Could not connect to the backend.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((suite) => (
              <SuiteCard key={suite.suiteId} suite={suite} onClick={() => navigateToSuite(suite)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <Layers className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No suites yet</p>
            <p className="text-sm mb-4">Assemble guardrails into a suite to get started.</p>
            <button
              onClick={() => navigateToSuiteBuilder()}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Create Suite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
