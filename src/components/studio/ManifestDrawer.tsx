import { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { X, FileCode2 } from 'lucide-react';
import { defaultEditorOptions } from '@/monaco/config';
import { cn } from '@/utils';

interface ManifestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** The generated guardrail.yaml manifest. */
  value: string;
  theme: string;
}

/**
 * Read-only preview of the registration manifest (`guardrail.yaml`). Styled as a
 * right slide-over to match the Input contract drawer.
 */
export function ManifestDrawer({ isOpen, onClose, value, theme }: ManifestDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
          <div className="flex items-center gap-2 min-w-0">
            <FileCode2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">guardrail.yaml</h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Registration manifest — how the backend assembles the input.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 px-6 py-5">
          <div className="h-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)]">
            <Editor
              height="100%"
              language="yaml"
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              value={value}
              options={{ ...defaultEditorOptions, readOnly: true, minimap: { enabled: false } }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border-light)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
