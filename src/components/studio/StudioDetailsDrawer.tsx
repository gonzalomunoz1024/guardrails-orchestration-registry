import { useEffect, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { usePolicyStore } from '@/store';
import { cn } from '@/utils';
import type { ResourceType } from '@/types/registry.types';
import type { EnforcementType } from '@/types/guardrail.types';

interface StudioDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const resourceTypes: { value: ResourceType; label: string }[] = [
  { value: 'lightspeed', label: 'Lightspeed' },
  { value: 'vmforge', label: 'VMForge' },
  { value: 'other', label: 'Other' },
];

const enforcementTypes: { value: EnforcementType; label: string; hint: string }[] = [
  { value: 'MANDATORY', label: 'Mandatory', hint: 'Must pass for the action to proceed' },
  { value: 'OPTIONAL', label: 'Optional', hint: 'Advisory — failures are logged but allowed' },
];

const fieldClass =
  'w-full px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] focus:border-[var(--color-info)] focus:outline-none transition-colors text-sm';

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-0.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all',
            value === opt.value
              ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
      {children}
    </label>
  );
}

export function StudioDetailsDrawer({ isOpen, onClose }: StudioDetailsDrawerProps) {
  const {
    metadata,
    updateMetadata,
    resourceType,
    setResourceType,
    resourceKind,
    setResourceKind,
    enforcementType,
    setEnforcementType,
    tags,
    setTags,
  } = usePolicyStore();
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

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
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <Label>Guardrail name</Label>
            <input
              value={metadata.name}
              onChange={(e) => updateMetadata({ name: e.target.value })}
              placeholder="e.g., VM Size Limit Guardrail"
              className={fieldClass}
            />
          </div>

          <div>
            <Label>Description</Label>
            <textarea
              value={metadata.description}
              onChange={(e) => updateMetadata({ description: e.target.value })}
              placeholder="Describe what this guardrail does and when it applies…"
              rows={3}
              className={cn(fieldClass, 'resize-none')}
            />
          </div>

          <div>
            <Label>Resource type</Label>
            <Segmented value={resourceType} options={resourceTypes} onChange={setResourceType} />
          </div>

          <div>
            <Label>Resource kind</Label>
            <input
              value={resourceKind}
              onChange={(e) => setResourceKind(e.target.value)}
              placeholder={resourceType === 'lightspeed' ? 'e.g., playbook' : 'e.g., virtual_machine'}
              className={fieldClass}
            />
          </div>

          <div>
            <Label>Enforcement</Label>
            <Segmented
              value={enforcementType}
              options={enforcementTypes}
              onChange={setEnforcementType}
            />
            <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
              {enforcementTypes.find((e) => e.value === enforcementType)?.hint}
            </p>
          </div>

          <div>
            <Label>Tags</Label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag and press Enter"
                className={fieldClass}
              />
              <button
                onClick={addTag}
                className="shrink-0 px-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-light)] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                  >
                    {tag}
                    <button
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      className="hover:text-[var(--color-error)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
