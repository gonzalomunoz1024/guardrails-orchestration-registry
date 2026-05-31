import { useEffect } from 'react';
import { Shield, Check } from 'lucide-react';
import { cn, slugifyName } from '@/utils';
import { usePolicyStore } from '@/store';
import { GuardrailDetailsFields } from '@/components/studio/GuardrailDetailsFields';

interface NewGuardrailDetailsModalProps {
  isOpen: boolean;
  /** Called when the user accepts the form — gives the parent a chance to
   *  realign the rego package name with the freshly-entered slug. */
  onDone: () => void;
  /** Called when the user backs out — parent should reset the studio and
   *  navigate away (typically back to the catalog). */
  onCancel: () => void;
}

/**
 * The first thing an author sees after clicking "Create Guardrail". Gates the
 * studio behind the Details form so the rego package can be derived from a
 * real name (rather than the placeholder "package policy") before any code is
 * written. Centered card, not a side drawer — it's a foreground task, not a
 * sidecar.
 */
export function NewGuardrailDetailsModal({ isOpen, onDone, onCancel }: NewGuardrailDetailsModalProps) {
  const name = usePolicyStore((s) => s.metadata.name);
  const slug = slugifyName(name);
  const canContinue = slug.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop — click intentionally cancels so the user can back out. */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={onCancel}
      />

      <div
        className={cn(
          'relative w-full max-w-lg max-h-[90vh] flex flex-col',
          'rounded-[var(--radius-xl)] overflow-hidden',
          'bg-[var(--color-surface)] shadow-2xl border border-[var(--color-border-light)]',
          'animate-fade-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--color-border-light)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
              <Shield className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Create a new guardrail
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                Set the basics first. Your rego package name is derived from the guardrail name, so
                naming it up front keeps everything in sync.
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <GuardrailDetailsFields showVersionHint={false} />
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/40">
          <button
            onClick={onCancel}
            className={cn(
              'px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium',
              'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
              'hover:bg-[var(--color-surface-secondary)] transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            onClick={onDone}
            disabled={!canContinue}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
              'bg-[var(--color-info)] text-white text-sm font-medium',
              'transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Check className="w-4 h-4" />
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
