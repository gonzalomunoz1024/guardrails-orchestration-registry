import { Play, Moon, Sun, RotateCcw, GitPullRequest } from 'lucide-react';
import { useTheme, useEvaluate } from '@/hooks';
import { usePolicyStore, useUIStore, useEvaluationStore } from '@/store';
import { cn } from '@/utils';

export function Header() {
  const { setTheme, resolvedTheme } = useTheme();
  const { evaluate, isEvaluating } = useEvaluate();
  const { resetPolicy, isDirty } = usePolicyStore();
  const { setCreatePRModalOpen } = useUIStore();
  const { clearResult } = useEvaluationStore();

  const handleReset = () => {
    resetPolicy();
    clearResult();
  };

  const handleThemeToggle = () => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]/80 backdrop-blur-xl">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              OPA Policy Registry
            </h1>
            {isDirty && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                Unsaved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className={cn(
                'p-2 rounded-[var(--radius-md)] transition-all',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-secondary)]'
              )}
              title="Reset policy"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={handleThemeToggle}
              className={cn(
                'p-2 rounded-[var(--radius-md)] transition-all',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-secondary)]'
              )}
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <div className="w-px h-6 bg-[var(--color-border-light)] mx-1" />

            <button
              onClick={() => setCreatePRModalOpen(true)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'font-medium transition-all hover:bg-[var(--color-border-light)]'
              )}
            >
              <GitPullRequest className="w-4 h-4" />
              <span className="hidden sm:inline">Create PR</span>
            </button>

            <button
              onClick={evaluate}
              disabled={isEvaluating}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-info)] text-white font-medium',
                'transition-all hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Play className="w-4 h-4" />
              <span>{isEvaluating ? 'Evaluating...' : 'Evaluate'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
