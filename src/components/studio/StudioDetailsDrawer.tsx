import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import { GuardrailDetailsFields } from './GuardrailDetailsFields';

interface StudioDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StudioDetailsDrawer({ isOpen, onClose }: StudioDetailsDrawerProps) {
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
          'absolute top-0 right-0 h-full w-full max-w-md flex flex-col',
          'bg-[var(--color-surface)] border-l border-[var(--color-border-light)] shadow-2xl',
          'animate-slide-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Guardrail Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          <GuardrailDetailsFields />
        </div>

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
