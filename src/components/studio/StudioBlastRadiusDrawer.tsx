import { useEffect, useMemo, useState } from 'react';
import {
  AppWindow,
  Building2,
  ChevronDown,
  ChevronUp,
  Database,
  Loader2,
  Play,
  Server,
  X,
  Zap,
} from 'lucide-react';
import { usePolicyStore, useBlastRunStore } from '@/store';
import { useTestInputs, useResourceTypeConfig } from '@/hooks';
import { BlastRadiusExecutionModal } from '@/components/modals';
import { ComingSoonBanner } from '@/components/common/ComingSoonBanner';
import { cn } from '@/utils';
import type { TestInput } from '@/types/registry.types';
import type { EnforcementType } from '@/types/guardrail.types';

interface BlastGuardrailInfo {
  id: string;
  name: string;
  version: string;
  enforcementType: EnforcementType;
}

interface StudioBlastRadiusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  guardrailInfo: BlastGuardrailInfo;
}

const fieldClass =
  'w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] focus:border-[var(--color-info)] focus:outline-none transition-colors text-sm';

export function StudioBlastRadiusDrawer({ isOpen, onClose, guardrailInfo }: StudioBlastRadiusDrawerProps) {
  const { regoCode, configJson, resourceType, resourceKind, setInputJson } = usePolicyStore();
  const startRun = useBlastRunStore((s) => s.start);
  const { supportsBlastRadius, testInputsDisabledMessage } = useResourceTypeConfig(resourceType);

  const [applicationId, setApplicationId] = useState('');
  const [organization, setOrganization] = useState('');
  const [environment, setEnvironment] = useState('');
  const [shouldFetch, setShouldFetch] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [executionOpen, setExecutionOpen] = useState(false);

  const filters = useMemo(
    () => ({
      applicationId: applicationId || undefined,
      organization: organization || undefined,
      environment: environment || undefined,
      resourceKind: resourceType === 'lightspeed' ? resourceKind || undefined : undefined,
    }),
    [applicationId, organization, environment, resourceKind, resourceType]
  );

  const {
    testInputs,
    totalHits,
    hasMore,
    isLoading: isFetching,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useTestInputs({ filters, enabled: shouldFetch && supportsBlastRadius, resourceType });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // When the drawer opens and a run is in progress or finished, surface it.
  useEffect(() => {
    if (isOpen && useBlastRunStore.getState().status !== 'idle') {
      setExecutionOpen(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const fetchCases = () => (shouldFetch ? refetch() : setShouldFetch(true));

  const loadIntoSandbox = (testInput: TestInput) => {
    setInputJson(JSON.stringify(testInput.input, null, 2));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'absolute top-0 right-0 h-full w-full max-w-2xl flex flex-col',
          'bg-[var(--color-surface)] border-l border-[var(--color-border-light)] shadow-2xl animate-slide-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)]">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              Blast radius
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              Evaluate this guardrail against real test cases to gauge its impact
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {!supportsBlastRadius ? (
            <ComingSoonBanner
              message={
                testInputsDisabledMessage ||
                'Blast radius testing is not available for this resource type.'
              }
            />
          ) : (
            <>
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    <AppWindow className="w-3.5 h-3.5" /> Application ID
                  </span>
                  <input
                    value={applicationId}
                    onChange={(e) => setApplicationId(e.target.value)}
                    placeholder="e.g., app-001"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Organization
                  </span>
                  <input
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="e.g., acme-corp"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                    <Server className="w-3.5 h-3.5" /> Environment
                  </span>
                  <input
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="e.g., production"
                    className={fieldClass}
                  />
                </label>
                {resourceType === 'lightspeed' && resourceKind && (
                  <label className="block">
                    <span className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">
                      Resource kind
                    </span>
                    <input value={resourceKind} disabled className={cn(fieldClass, 'opacity-60')} />
                  </label>
                )}
              </div>

              <button
                onClick={fetchCases}
                disabled={isFetching}
                className={cn(
                  'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-[var(--radius-md)]',
                  'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)]',
                  'text-sm font-medium transition-all hover:border-[var(--color-info)] hover:text-[var(--color-info)]',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                {isFetching ? 'Fetching…' : 'Fetch test cases'}
              </button>

              {/* Results */}
              {shouldFetch && (
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)] text-xs font-medium text-[var(--color-text-secondary)]">
                    {isFetching
                      ? 'Loading…'
                      : `${testInputs.length} of ${totalHits} test case${totalHits !== 1 ? 's' : ''}`}
                  </div>
                  <div className="divide-y divide-[var(--color-border-light)] max-h-[40vh] overflow-auto">
                    {testInputs.length > 0 ? (
                      <>
                        {testInputs.map((ti) => (
                          <div key={ti.id} className="p-3">
                            <button
                              onClick={() => setExpanded(expanded === ti.id ? null : ti.id)}
                              className="w-full flex items-center justify-between gap-2 text-left"
                            >
                              <span className="min-w-0 flex items-center gap-2">
                                <code className="text-xs font-mono text-[var(--color-text-primary)] truncate">
                                  {(ti.metadata?.correlationId as string) || ti.name}
                                </code>
                                {ti.applicationId && (
                                  <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                                    {ti.applicationId}
                                  </span>
                                )}
                              </span>
                              {expanded === ti.id ? (
                                <ChevronUp className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                              )}
                            </button>
                            {expanded === ti.id && (
                              <div className="mt-3 space-y-2">
                                <pre className="max-h-56 overflow-auto rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-3 text-xs font-mono text-[var(--color-text-primary)]">
                                  {JSON.stringify(ti.input, null, 2)}
                                </pre>
                                <button
                                  onClick={() => loadIntoSandbox(ti)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border-light)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Load into sandbox
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {hasMore && (
                          <div className="p-3 text-center">
                            <button
                              onClick={() => fetchNextPage()}
                              disabled={isFetchingNextPage}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                            >
                              {isFetchingNextPage ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                              Load more ({totalHits - testInputs.length} remaining)
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">
                        {isFetching ? 'Searching for matching test inputs…' : 'No test cases found. Adjust the filters or leave them empty.'}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — execute */}
        {supportsBlastRadius && (
          <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[var(--color-border-light)]">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {testInputs.length > 0
                ? `Ready to run against ${testInputs.length} test case${testInputs.length !== 1 ? 's' : ''}`
                : 'Fetch test cases to run a blast radius'}
            </span>
            <button
              onClick={() => {
                startRun({ testInputs, regoCode, configJson, guardrailInfo });
                setExecutionOpen(true);
              }}
              disabled={testInputs.length === 0 || !regoCode.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Zap className="w-4 h-4" />
              Run blast radius
            </button>
          </div>
        )}
      </div>

      <BlastRadiusExecutionModal
        isOpen={executionOpen}
        onClose={() => setExecutionOpen(false)}
        testInputs={testInputs}
        regoCode={regoCode}
        configJson={configJson}
        guardrailInfo={guardrailInfo}
      />
    </div>
  );
}
