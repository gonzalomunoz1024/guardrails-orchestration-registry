import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { cn } from '@/utils';
import { evaluationApi } from '@/services/api';
import type { TestInput } from '@/types/registry.types';
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
  guardrailInfo: GuardrailInfo;
}

type ExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'error';

interface ExecutionResult {
  testInputId: string;
  status: ExecutionStatus;
  result?: unknown;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Build the inputBundle for OPA evaluation
 * Contains: guardrail metadata, configuration, and resource (test input data)
 */
function buildInputBundle(
  resource: Record<string, unknown>,
  guardrailInfo: GuardrailInfo,
  configuration: Record<string, unknown>
): Record<string, unknown> {
  return {
    guardrail: {
      id: guardrailInfo.id,
      name: guardrailInfo.name,
      version: guardrailInfo.version,
      enforcementType: guardrailInfo.enforcementType,
    },
    configuration: configuration,
    resource: resource,
  };
}

export function BlastRadiusExecutionModal({
  isOpen,
  onClose,
  testInputs,
  regoCode,
  configJson,
  guardrailInfo,
}: BlastRadiusExecutionModalProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<Map<string, ExecutionResult>>(new Map());
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsExecuting(false);
      setHasStarted(false);
      setCurrentIndex(0);
      setResults(new Map());
      setExpandedResult(null);
    }
  }, [isOpen]);

  // Parse configuration JSON
  const configuration = (() => {
    try {
      return JSON.parse(configJson || '{}');
    } catch {
      return {};
    }
  })();

  // Execute a single test case
  const executeTestCase = useCallback(async (testInput: TestInput): Promise<ExecutionResult> => {
    const startTime = performance.now();

    try {
      // Use the test input's data as the resource
      const resource = testInput.input || {};
      const inputBundle = buildInputBundle(resource, guardrailInfo, configuration);

      const response = await evaluationApi.evaluate(regoCode, inputBundle);

      const executionTimeMs = performance.now() - startTime;

      // Determine if the result indicates pass or fail
      // Convention: result.allow === true means passed
      const resultObj = response.result as Record<string, unknown> | undefined;
      const passed = resultObj?.allow === true || resultObj?.result === true;

      return {
        testInputId: testInput.id,
        status: passed ? 'passed' : 'failed',
        result: response.result,
        executionTimeMs,
      };
    } catch (error) {
      return {
        testInputId: testInput.id,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTimeMs: performance.now() - startTime,
      };
    }
  }, [regoCode, configuration, guardrailInfo]);

  // Run all test cases sequentially
  const runAllTests = useCallback(async () => {
    setIsExecuting(true);
    setHasStarted(true);
    setCurrentIndex(0);
    setResults(new Map());

    for (let i = 0; i < testInputs.length; i++) {
      setCurrentIndex(i);
      const testInput = testInputs[i];

      // Mark as running
      setResults(prev => new Map(prev).set(testInput.id, {
        testInputId: testInput.id,
        status: 'running',
      }));

      // Execute
      const result = await executeTestCase(testInput);

      // Update with result
      setResults(prev => new Map(prev).set(testInput.id, result));

      // Small delay for visual effect
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsExecuting(false);
  }, [testInputs, executeTestCase]);

  // Calculate summary stats
  const passedCount = Array.from(results.values()).filter(r => r.status === 'passed').length;
  const failedCount = Array.from(results.values()).filter(r => r.status === 'failed').length;
  const errorCount = Array.from(results.values()).filter(r => r.status === 'error').length;
  const completedCount = passedCount + failedCount + errorCount;
  const passRate = completedCount > 0 ? Math.round((passedCount / completedCount) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isExecuting ? onClose : undefined}
      />

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
            disabled={isExecuting}
            className={cn(
              'p-2.5 rounded-xl transition-all',
              'hover:bg-[var(--color-surface-secondary)]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
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
                        <h4 className="font-medium text-[var(--color-text-primary)] truncate">
                          {testInput.name}
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
                    <div className="px-4 pb-4">
                      <div className="p-4 rounded-lg bg-[var(--color-surface-secondary)] font-mono text-sm overflow-auto max-h-48">
                        <pre className="text-[var(--color-text-primary)]">
                          {result.error
                            ? result.error
                            : JSON.stringify(result.result, null, 2)}
                        </pre>
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
              disabled={isExecuting}
              className={cn(
                'px-6 py-3 rounded-xl font-medium transition-all',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-secondary)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {hasStarted && !isExecuting ? 'Close' : 'Cancel'}
            </button>

            {!hasStarted ? (
              <button
                onClick={runAllTests}
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
              <button
                onClick={runAllTests}
                className={cn(
                  'flex items-center gap-3 px-8 py-3 rounded-xl',
                  'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                  'border border-[var(--color-border-light)]',
                  'font-medium transition-all hover:bg-[var(--color-border-light)]'
                )}
              >
                <Play className="w-5 h-5" />
                Run Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
