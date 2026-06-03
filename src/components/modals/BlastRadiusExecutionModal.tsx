import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  X,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  BarChart3,
  Zap,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { cn, downloadBlastRadiusReport } from '@/utils';
import { useBlastRunStore } from '@/store';
import type { ExternalDependency, TestInput } from '@/types';
import type { EnforcementType } from '@/types/guardrail.types';

interface GuardrailInfo {
  id: string;
  name: string;
  version: string;
  enforcementType: EnforcementType;
}

interface BlastRadiusExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  testInputs: TestInput[];
  regoCode: string;
  configJson: string;
  /** Whether the static configuration is part of the input bundle. */
  configEnabled: boolean;
  /** Configured external dependencies — refetched per test input. */
  externalDeps: ExternalDependency[];
  guardrailInfo: GuardrailInfo;
}

export function BlastRadiusExecutionModal({
  isOpen,
  onClose,
  testInputs: propTestInputs,
  regoCode,
  configJson,
  configEnabled,
  externalDeps,
  guardrailInfo,
}: BlastRadiusExecutionModalProps) {
  const run = useBlastRunStore();
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // The blast run store is a singleton — minimizing the modal keeps the
  // current run going. The price is that an old run for guardrail A
  // sticks around in the store even after the user has navigated to
  // guardrail B; opening the modal on B would otherwise render A's
  // testInputs and results. Reset the store when the modal opens for a
  // guardrail different from whatever last ran (or didn't), so the user
  // gets a clean "Start Analysis" surface instead of stale details from
  // some other guardrail.
  useEffect(() => {
    if (!isOpen) return;
    const lastGuardrailId = run.guardrail?.id;
    if (lastGuardrailId && lastGuardrailId !== guardrailInfo.id) {
      run.reset();
    }
    // run is a snapshot; we want this to fire when isOpen flips on or the
    // guardrail identity changes, not on every internal store update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, guardrailInfo.id]);

  // Run lifecycle lives in the store so it keeps going when the modal is minimized.
  const isExecuting = run.status === 'running';
  const hasStarted = run.status !== 'idle';
  const currentIndex = run.currentIndex;
  // Once a run exists, show its own inputs; otherwise the current selection.
  const testInputs = hasStarted && run.testInputs.length ? run.testInputs : propTestInputs;
  const configuration = run.configuration;
  const results = useMemo(() => new Map(Object.entries(run.results)), [run.results]);

  const startRun = () =>
    run.start({
      testInputs: propTestInputs,
      regoCode,
      configJson,
      configEnabled,
      externalDeps,
      guardrailInfo,
    });

  // Calculate summary stats
  const passedCount = Array.from(results.values()).filter(r => r.status === 'passed').length;
  const failedCount = Array.from(results.values()).filter(r => r.status === 'failed').length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const completedCount = passedCount + failedCount + errorCount;
  const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

  // Download results as JSON
  const handleDownloadResults = useCallback(() => {
    const exportData = {
      summary: {
        guardrailId: guardrailInfo.id,
        guardrailName: guardrailInfo.name,
        guardrailVersion: guardrailInfo.version,
        enforcementType: guardrailInfo.enforcementType,
        totalTests: testInputs.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        passRate: `${passRate}%`,
        executedAt: new Date().toISOString(),
      },
      configuration: configuration,
      testResults: testInputs.map(testInput => {
        const result = results.get(testInput.id);
        return {
          testId: testInput.id,
          testName: testInput.name,
          correlationId: testInput.metadata?.correlationId || null,
          applicationId: testInput.applicationId || null,
          status: result?.status || 'pending',
          executionTimeMs: result?.executionTimeMs || null,
          input: testInput.input,
          output: result?.result || null,
          error: result?.error || null,
          // Per-test external-dep fetches (URL + response or error) so the
          // JSON dump matches the modal's expanded sections.
          externalDependencies:
            result?.fetchedDeps?.map((f) => ({
              name: f.name,
              method: (f.dep.method || 'GET').toUpperCase(),
              url: f.url,
              status: f.status,
              data: f.data,
              error: f.error ?? null,
            })) ?? [],
        };
      }),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blast-radius-${guardrailInfo.id}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [testInputs, results, guardrailInfo, configuration, passedCount, failedCount, errorCount, passRate]);

  // Download a polished, self-contained HTML report (print → PDF).
  const handleDownloadReport = useCallback(() => {
    downloadBlastRadiusReport({
      guardrail: {
        id: guardrailInfo.id,
        name: guardrailInfo.name,
        version: guardrailInfo.version,
        enforcementType: guardrailInfo.enforcementType,
      },
      executedAt: new Date().toISOString(),
      configuration,
      summary: {
        total: testInputs.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        passRate,
      },
      tests: testInputs.map((testInput) => {
        const r = results.get(testInput.id);
        return {
          name: (testInput.metadata?.correlationId as string) || testInput.name,
          correlationId: (testInput.metadata?.correlationId as string) || null,
          applicationId: testInput.applicationId || null,
          status: r?.status ?? 'pending',
          executionTimeMs: r?.executionTimeMs ?? null,
          input: testInput.input,
          output: r?.result ?? null,
          error: r?.error ?? null,
          // Same per-test external-dep snapshot the modal renders. Lets the
          // printed report stand alone as triage evidence.
          fetchedDeps: r?.fetchedDeps?.map((f) => ({
            name: f.name,
            method: (f.dep.method || 'GET').toUpperCase(),
            url: f.url,
            status: f.status,
            data: f.data,
            error: f.error ?? null,
          })),
        };
      }),
    });
  }, [testInputs, results, guardrailInfo, configuration, passedCount, failedCount, errorCount, passRate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] mx-4 rounded-3xl bg-[var(--color-surface)] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--color-border-light)] bg-gradient-to-r from-[var(--color-surface)] to-[var(--color-surface-secondary)]">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-[var(--color-info)] to-[var(--color-success)] shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Blast Radius Analysis
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {testInputs.length} test case{testInputs.length !== 1 ? 's' : ''} to evaluate
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title={isExecuting ? 'Minimize — keeps running in the background' : 'Close'}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              'hover:bg-[var(--color-surface-secondary)]'
            )}
          >
            <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        {/* Summary Stats - Only show after started */}
        {hasStarted && (
          <div className="px-8 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {completedCount}/{testInputs.length}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  Completed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-success)]">
                  {passedCount}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  Passed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-error)]">
                  {failedCount}
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  Failed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--color-info)]">
                  {passRate}%
                </div>
                <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                  Pass Rate
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--color-info)] to-[var(--color-success)] transition-all duration-300"
                style={{ width: `${(completedCount / testInputs.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Test Cases List */}
        <div className="flex-1 overflow-auto px-8 py-4">
          <div className="space-y-2">
            {testInputs.map((testInput, index) => {
              const result = results.get(testInput.id);
              const isExpanded = expandedResult === testInput.id;
              const isCurrent = isExecuting && index === currentIndex;

              return (
                <div
                  key={testInput.id}
                  className={cn(
                    'rounded-xl border transition-all duration-200',
                    isCurrent
                      ? 'border-[var(--color-info)] bg-[var(--color-info-bg)] shadow-md'
                      : result?.status === 'passed'
                        ? 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)]/50'
                        : result?.status === 'failed'
                          ? 'border-[var(--color-error)]/30 bg-[var(--color-error-bg)]/50'
                          : result?.status === 'error'
                            ? 'border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)]/50'
                            : 'border-[var(--color-border-light)] bg-[var(--color-surface)]'
                  )}
                >
                  <button
                    onClick={() => result && setExpandedResult(isExpanded ? null : testInput.id)}
                    disabled={!result || result.status === 'running'}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    {/* Status Icon */}
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      result?.status === 'running'
                        ? 'bg-[var(--color-info)] text-white'
                        : result?.status === 'passed'
                          ? 'bg-[var(--color-success)] text-white'
                          : result?.status === 'failed'
                            ? 'bg-[var(--color-error)] text-white'
                            : result?.status === 'error'
                              ? 'bg-[var(--color-warning)] text-white'
                              : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                    )}>
                      {result?.status === 'running' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : result?.status === 'passed' ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : result?.status === 'failed' ? (
                        <XCircle className="w-5 h-5" />
                      ) : result?.status === 'error' ? (
                        <AlertCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>

                    {/* Test Case Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-[var(--color-text-primary)] truncate font-mono text-sm">
                          {(testInput.metadata?.correlationId as string) || testInput.name}
                        </h4>
                        {testInput.applicationId && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] flex-shrink-0">
                            {testInput.applicationId}
                          </span>
                        )}
                      </div>
                      {result?.executionTimeMs && (
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                          {result.executionTimeMs.toFixed(0)}ms
                        </p>
                      )}
                    </div>

                    {/* Expand Icon */}
                    {result && result.status !== 'running' && (
                      <div className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded Result */}
                  {isExpanded && result && (
                    <div className="px-4 pb-4 space-y-3">
                      {/* Document — the test input payload that drove this evaluation. */}
                      <InputSection
                        label="Document"
                        sublabel="input.document.*"
                        body={JSON.stringify(testInput.input ?? {}, null, 2)}
                      />

                      {/* External dependencies — one block per dep, with the
                          resolved URL and the response body so authors can
                          tell why a verdict went the way it did. */}
                      {result.fetchedDeps && result.fetchedDeps.length > 0 && (
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
                            External dependencies
                          </label>
                          {result.fetchedDeps.map((f) => (
                            <div
                              key={f.name}
                              className={cn(
                                'rounded-lg border overflow-hidden',
                                f.status === 'error'
                                  ? 'border-[var(--color-error)]/30 bg-[var(--color-error-bg)]/40'
                                  : 'border-[var(--color-border-light)] bg-[var(--color-surface)]'
                              )}
                            >
                              <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center justify-between gap-2 text-[11px]">
                                <code className="font-mono text-[var(--color-info)] truncate">
                                  input.external.{f.name}
                                </code>
                                <span className="font-mono text-[var(--color-text-tertiary)] truncate">
                                  {(f.dep.method || 'GET').toUpperCase()} {f.url}
                                </span>
                              </div>
                              <pre className="px-3 py-2 font-mono text-xs overflow-auto max-h-40 text-[var(--color-text-secondary)]">
                                {f.error
                                  ? f.error
                                  : JSON.stringify(f.data, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Configuration — the static block, present only when
                          the guardrail opted in. */}
                      {configEnabled && (
                        <InputSection
                          label="Configuration"
                          sublabel="input.configuration"
                          body={JSON.stringify(run.configuration ?? {}, null, 2)}
                        />
                      )}

                      {/* Output Section */}
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-tertiary)] mb-1.5 uppercase tracking-wide">
                          {result.error ? 'Error' : 'Output'}
                        </label>
                        <div className={cn(
                          "p-3 rounded-lg font-mono text-xs overflow-auto max-h-32",
                          result.status === 'passed'
                            ? 'bg-[var(--color-success-bg)] border border-[var(--color-success)]/30'
                            : result.status === 'failed'
                              ? 'bg-[var(--color-error-bg)] border border-[var(--color-error)]/30'
                              : 'bg-[var(--color-warning-bg)] border border-[var(--color-warning)]/30'
                        )}>
                          <pre className={cn(
                            result.status === 'passed'
                              ? 'text-[var(--color-success)]'
                              : result.status === 'failed'
                                ? 'text-[var(--color-error)]'
                                : 'text-[var(--color-warning)]'
                          )}>
                            {result.error
                              ? result.error
                              : JSON.stringify(result.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-[var(--color-border-light)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className={cn(
                'px-6 py-3 rounded-xl font-medium transition-all',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-secondary)]'
              )}
            >
              {isExecuting ? 'Run in background' : hasStarted ? 'Close' : 'Cancel'}
            </button>

            {!hasStarted ? (
              <button
                onClick={startRun}
                className={cn(
                  'flex items-center gap-3 px-8 py-3 rounded-xl',
                  'bg-gradient-to-r from-[var(--color-info)] to-[var(--color-success)]',
                  'text-white font-semibold',
                  'shadow-lg shadow-[var(--color-info)]/25',
                  'transition-all duration-300 hover:shadow-xl hover:shadow-[var(--color-info)]/30 hover:scale-[1.02]'
                )}
              >
                <Zap className="w-5 h-5" />
                Start Analysis
              </button>
            ) : isExecuting ? (
              <div className="flex items-center gap-3 px-8 py-3 text-[var(--color-text-secondary)]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">
                  Running... ({currentIndex + 1}/{testInputs.length})
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadReport}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl',
                    'bg-[var(--color-info)] text-white',
                    'font-medium transition-all hover:opacity-90'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
                <button
                  onClick={handleDownloadResults}
                  title="Download raw JSON"
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-xl',
                    'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                    'border border-[var(--color-border-light)]',
                    'font-medium transition-all hover:bg-[var(--color-border-light)]'
                  )}
                >
                  JSON
                </button>
                <button
                  onClick={startRun}
                  className={cn(
                    'flex items-center gap-2 px-6 py-3 rounded-xl',
                    'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                    'border border-[var(--color-border-light)]',
                    'font-medium transition-all hover:bg-[var(--color-border-light)]'
                  )}
                >
                  <Play className="w-4 h-4" />
                  Run Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Labeled JSON block used by the expanded result. Two lines of header
 *  (the section name and the `input.*` path it lands on) plus a scrollable
 *  monospace body. */
function InputSection({
  label,
  sublabel,
  body,
}: {
  label: string;
  sublabel?: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          {label}
        </label>
        {sublabel && (
          <code className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
            {sublabel}
          </code>
        )}
      </div>
      <div className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] font-mono text-xs overflow-auto max-h-40">
        <pre className="text-[var(--color-text-secondary)]">{body}</pre>
      </div>
    </div>
  );
}
