import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';
import { useEvaluationStore } from '@/store';
import { cn, formatDuration } from '@/utils';

interface OutputPanelProps {
  className?: string;
}

export function OutputPanel({ className }: OutputPanelProps) {
  const { result, isEvaluating } = useEvaluationStore();

  const isAllowed =
    result?.success &&
    typeof result.result === 'object' &&
    result.result !== null &&
    'allow' in result.result &&
    result.result.allow === true;

  const isDenied =
    result?.success &&
    typeof result.result === 'object' &&
    result.result !== null &&
    'allow' in result.result &&
    result.result.allow === false;

  return (
    <div
      className={cn(
        'h-full flex flex-col rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface)]',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Output
        </span>
        {result?.executionTime && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
            <Clock className="w-3 h-3" />
            {formatDuration(result.executionTime * 1_000_000)}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {isEvaluating ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-info)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Evaluating policy...
            </span>
          </div>
        ) : result ? (
          <div className="space-y-4 animate-fade-in">
            {result.success ? (
              <>
                <div
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-[var(--radius-md)]',
                    isAllowed && 'bg-[var(--color-success-bg)]',
                    isDenied && 'bg-[var(--color-error-bg)]',
                    !isAllowed && !isDenied && 'bg-[var(--color-info-bg)]'
                  )}
                >
                  {isAllowed ? (
                    <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                  ) : isDenied ? (
                    <XCircle className="w-5 h-5 text-[var(--color-error)]" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-[var(--color-info)]" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-medium',
                      isAllowed && 'text-[var(--color-success)]',
                      isDenied && 'text-[var(--color-error)]',
                      !isAllowed && !isDenied && 'text-[var(--color-info)]'
                    )}
                  >
                    {isAllowed
                      ? 'Allowed'
                      : isDenied
                        ? 'Denied'
                        : 'Evaluation Complete'}
                  </span>
                </div>

                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] p-4">
                  <pre className="text-sm font-mono text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-error-bg)]">
                <XCircle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--color-error)]">
                    Evaluation Error
                  </span>
                  <pre className="mt-2 text-xs font-mono text-[var(--color-error)] whitespace-pre-wrap break-words">
                    {result.error}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
            <p className="text-sm">
              Click "Evaluate" to run the policy
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
