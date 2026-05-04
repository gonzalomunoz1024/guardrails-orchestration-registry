import { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Minimize2 } from 'lucide-react';
import { cn } from '@/utils';
import { defaultEditorOptions } from '@/monaco/config';

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  language: 'json' | 'rego';
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  theme: string;
}

export function EditorModal({
  isOpen,
  onClose,
  title,
  subtitle,
  language,
  value,
  onChange,
  readOnly = false,
  theme,
}: EditorModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          "relative w-full h-full max-w-6xl max-h-[90vh]",
          "rounded-2xl overflow-hidden",
          "bg-[var(--color-surface)] shadow-2xl",
          "flex flex-col",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-4">
            {/* Traffic light dots - Apple style */}
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors"
                title="Close"
              />
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="h-4 w-px bg-[var(--color-border-light)]" />
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
              {subtitle && (
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-tertiary)] mr-2">
              {language === 'json' ? 'JSON' : 'Rego'} • {value.split('\n').length} lines
            </span>
            <button
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                "text-sm font-medium text-[var(--color-text-secondary)]",
                "bg-[var(--color-surface-secondary)]",
                "hover:bg-[var(--color-border-light)] transition-all",
                "border border-[var(--color-border-light)]"
              )}
            >
              <Minimize2 className="w-4 h-4" />
              Done
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            language={language}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            value={value}
            onChange={(val) => onChange?.(val || '')}
            options={{
              ...defaultEditorOptions,
              readOnly,
              fontSize: 14,
              padding: { top: 20, bottom: 20 },
              lineNumbers: 'on',
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
            }}
          />
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
            <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] font-mono">Esc</kbd> to close</span>
            {!readOnly && <span>Changes are saved automatically</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
