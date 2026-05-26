import { CheckCircle, XCircle, Loader2, Clock, Expand, Ban } from 'lucide-react';
import { useEvaluationStore } from '@/store';
import { cn, formatDuration } from '@/utils';

interface OutputPanelProps {
  className?: string;
  /** When provided, shows an expand affordance in the header. */
  onExpand?: () => void;
}

/** Pull human-readable deny/violation messages out of an OPA result object. */
function extractDenyMessages(result: unknown): string[] {
  if (typeof result !== 'object' || result === null) return [];
  const obj = result as Record<string, unknown>;
  const keys = ['deny', 'denies', 'violation', 'violations', 'deny_messages', 'errors'];
  const out: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.push(item);
        else if (item && typeof item === 'object' && 'msg' in item)
          out.push(String((item as Record<string, unknown>).msg));
        else out.push(JSON.stringify(item));
      }
    } else if (typeof value === 'string') {
      out.push(value);
    }
  }
  return out;
}

export function OutputPanel({ className, onExpand }: OutputPanelProps) {
  const { result, isEvaluating } = useEvaluationStore();

  const resultObj =
    result?.success && typeof result.result === 'object' && result.result !== null
      ? (result.result as Record<string, unknown>)
      : undefined;
  const hasAllow = resultObj && 'allow' in resultObj;
  const isAllowed = hasAllow && resultObj!.allow === true;
  const isDenied = hasAllow && resultObj!.allow === false;
  const denyMessages = result?.success ? extractDenyMessages(result.result) : [];

  return (
    <div
      className={cn(
        'h-full flex flex-col rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface)]',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Result
        </span>
        <div className="flex items-center gap-2">
          {result?.executionTime && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
              <Clock className="w-3 h-3" />
              {formatDuration(result.executionTime * 1_000_000)}
            </span>
          )}
          {onExpand && result && (
            <button
              onClick={onExpand}
              title="Expand"
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-all"
            >
              <Expand className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {isEvaluating ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-info)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Evaluating guardrail…
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
                    {isAllowed ? 'Allowed' : isDenied ? 'Denied' : 'Evaluation complete'}
                  </span>
                </div>

                {/* Deny / violation messages */}
                {denyMessages.length > 0 && (
                  <ul className="space-y-1.5">
                    {denyMessages.map((msg, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-[var(--radius-md)] bg-[var(--color-error-bg)]"
                      >
                        <Ban className="w-4 h-4 text-[var(--color-error)] shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--color-error)]">{msg}</span>
                      </li>
                    ))}
                  </ul>
                )}

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
                    Evaluation error
                  </span>
                  <pre className="mt-2 text-xs font-mono text-[var(--color-error)] whitespace-pre-wrap break-words">
                    {result.error}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--color-text-tertiary)] gap-1">
            <p className="text-sm">No result yet</p>
            <p className="text-xs">Run the guardrail to see the decision here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
