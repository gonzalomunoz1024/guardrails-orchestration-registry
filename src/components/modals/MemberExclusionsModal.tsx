import { useEffect, useState } from 'react';
import { Filter, Plus, Trash2, X, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/utils';
import type { MemberExclusion } from '@/types/suite.types';

interface MemberExclusionsModalProps {
  isOpen: boolean;
  /** Name shown in the header so authors know which check they're scoping. */
  memberDisplayName: string;
  /** Current exclusion list — the modal works on a local draft and commits on save. */
  exclusions: MemberExclusion[];
  onSave: (next: MemberExclusion[]) => void;
  onCancel: () => void;
}

/**
 * Per-member exclusion editor for the suite builder. Authors add (appId,
 * organization) filters — each row is one exclusion entry. An entry with both
 * keys is treated as an intersection (only matches when both equal); an entry
 * with just one key matches every request that hits it. At least one of the
 * two keys must be set; an entirely-blank row is rejected by validation so an
 * author can't accidentally disable a check for every request.
 */
export function MemberExclusionsModal({
  isOpen,
  memberDisplayName,
  exclusions,
  onSave,
  onCancel,
}: MemberExclusionsModalProps) {
  const [draft, setDraft] = useState<MemberExclusion[]>([]);

  // Reset the local draft each time the modal opens so cancel actually backs
  // out, and so reopening doesn't show stale state from a previous member.
  useEffect(() => {
    if (isOpen) setDraft(exclusions.map((e) => ({ ...e })));
  }, [isOpen, exclusions]);

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

  const addRow = () => setDraft((prev) => [...prev, { appId: '', organization: '', reason: '' }]);
  const updateRow = (index: number, patch: Partial<MemberExclusion>) =>
    setDraft((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const removeRow = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  // An entry without at least one of appId / organization would match every
  // incoming request — that's never what an author actually meant.
  const blank = draft.some((e) => !e.appId?.trim() && !e.organization?.trim());

  const handleSave = () => {
    if (blank) return;
    onSave(
      draft.map((e) => ({
        appId: e.appId?.trim() || undefined,
        organization: e.organization?.trim() || undefined,
        reason: e.reason?.trim() || undefined,
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in"
        onClick={onCancel}
      />

      <div
        className={cn(
          'relative w-full max-w-2xl max-h-[90vh] flex flex-col',
          'rounded-[var(--radius-xl)] overflow-hidden',
          'bg-[var(--color-surface)] shadow-2xl border border-[var(--color-border-light)]',
          'animate-fade-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--color-border-light)]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="shrink-0 p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
              <Filter className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                Exclusions for{' '}
                <span className="font-mono">{memberDisplayName}</span>
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                When an incoming request matches one of these filters, the orchestrator's
                determinator skips this check for that request. Set <code>appId</code> and/or{' '}
                <code>organization</code> on each row — leave one blank to match any value.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {draft.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-[var(--color-text-tertiary)]">
              <Filter className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">No exclusions yet</p>
              <p className="text-xs">This check will run for every request in the suite.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {draft.map((entry, i) => (
                <ExclusionRow
                  key={i}
                  entry={entry}
                  onChange={(patch) => updateRow(i, patch)}
                  onRemove={() => removeRow(i)}
                />
              ))}
            </div>
          )}

          <button
            onClick={addRow}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add exclusion
          </button>

          {blank && (
            <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-text-primary)]">
                One or more exclusions have neither <code>appId</code> nor{' '}
                <code>organization</code> set — an empty filter would skip this check for every
                request. Fill in at least one key per row, or remove the empty rows.
              </p>
            </div>
          )}
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
            onClick={handleSave}
            disabled={blank}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
              'bg-[var(--color-info)] text-white text-sm font-medium',
              'transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Check className="w-4 h-4" />
            Save exclusions
          </button>
        </div>
      </div>
    </div>
  );
}

function ExclusionRow({
  entry,
  onChange,
  onRemove,
}: {
  entry: MemberExclusion;
  onChange: (patch: Partial<MemberExclusion>) => void;
  onRemove: () => void;
}) {
  const inputClass =
    'w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] focus:border-[var(--color-info)] focus:outline-none transition-colors text-sm';
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
            App ID
          </label>
          <input
            value={entry.appId ?? ''}
            onChange={(e) => onChange({ appId: e.target.value })}
            placeholder="app-123"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
            Organization
          </label>
          <input
            value={entry.organization ?? ''}
            onChange={(e) => onChange({ organization: e.target.value })}
            placeholder="platform"
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
            Reason (optional)
          </label>
          <input
            value={entry.reason ?? ''}
            onChange={(e) => onChange({ reason: e.target.value })}
            placeholder="Not relevant to platform team"
            className={inputClass}
          />
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
          aria-label="Remove exclusion"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
