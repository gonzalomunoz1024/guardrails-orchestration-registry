import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { usePolicyStore } from '@/store';
import { cn } from '@/utils';
import {
  RESOURCE_KIND_LABELS,
  STAGE_LABELS,
  ENFORCEMENT_LABELS,
} from '@/types/registry.types';
import type {
  ResourceKind,
  Stage,
  EnforcementType,
  GuardrailStatus,
} from '@/types/guardrail.types';

// `ANY` is pinned to the top so the wildcard option is the easiest pick as the
// list grows; the rest stay in display-label order.
const resourceKinds: { value: ResourceKind; label: string }[] = [
  { value: 'ANY', label: RESOURCE_KIND_LABELS.ANY },
  { value: 'CNAME', label: RESOURCE_KIND_LABELS.CNAME },
  { value: 'MONGODB', label: RESOURCE_KIND_LABELS.MONGODB },
  { value: 'VIRTUAL_MACHINE', label: RESOURCE_KIND_LABELS.VIRTUAL_MACHINE },
];

const stages: { value: Stage; label: string }[] = [
  { value: 'PRECHECK', label: STAGE_LABELS.PRECHECK },
  { value: 'APPROVAL', label: STAGE_LABELS.APPROVAL },
  { value: 'POSTCHECK', label: STAGE_LABELS.POSTCHECK },
];

const statuses: { value: GuardrailStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const enforcementTypes: { value: EnforcementType; label: string; hint: string }[] = [
  { value: 'MANDATORY', label: ENFORCEMENT_LABELS.MANDATORY, hint: 'Must pass for the action to proceed' },
  { value: 'OPTIONAL', label: ENFORCEMENT_LABELS.OPTIONAL, hint: 'Advisory — failures are logged but allowed' },
  { value: 'WARNING', label: ENFORCEMENT_LABELS.WARNING, hint: 'Surfaces a warning but never blocks' },
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

/**
 * The field stack shared by the side-drawer (StudioDetailsDrawer) and the
 * centered create modal (NewGuardrailDetailsModal). All fields read/write
 * through usePolicyStore directly so either wrapper can be opened/closed
 * independently — the data is the single source of truth.
 *
 * Props:
 *   - showVersionHint: render the smart-version line under Name. The side
 *     drawer shows it (so authors can see what publishing will bump). The
 *     create modal hides it since the version is locked to 1.0 on a brand-
 *     new guardrail anyway.
 */
export function GuardrailDetailsFields({
  showVersionHint = true,
}: {
  showVersionHint?: boolean;
}) {
  const {
    metadata,
    updateMetadata,
    resourceKind,
    setResourceKind,
    stage,
    setStage,
    status,
    setStatus,
    enforcementType,
    setEnforcementType,
    tags,
    setTags,
    baseVersion,
  } = usePolicyStore();
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  return (
    <div className="space-y-5">
      <div>
        <Label>Name</Label>
        <input
          value={metadata.name}
          onChange={(e) => updateMetadata({ name: e.target.value })}
          placeholder="e.g., VM Size Limit Guardrail"
          className={fieldClass}
          autoFocus
        />
        {showVersionHint && (
          // Smart version hint reflects the contract-diff rule:
          //   new guardrail → publishes as 1.0
          //   no contract change → version stays (metadata-only update)
          //   contract changed → version bumped from baseVersion.
          <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
            {baseVersion === null ? (
              <>
                New guardrail · publishes as{' '}
                <code className="font-mono">{metadata.version}</code>
              </>
            ) : metadata.version === baseVersion ? (
              <>
                Version <code className="font-mono">{metadata.version}</code> · metadata-only
                update (no version bump).
              </>
            ) : (
              <>
                Version <code className="font-mono">{metadata.version}</code>{' '}
                <span className="text-[var(--color-info)]">(was {baseVersion})</span> · contract
                changed, minor bumped.
              </>
            )}
          </p>
        )}
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
        <Label>Kind</Label>
        <select
          value={resourceKind}
          onChange={(e) => setResourceKind(e.target.value as ResourceKind)}
          className={fieldClass}
        >
          {resourceKinds.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {resourceKind === 'ANY' && (
          <p className="mt-1.5 text-xs text-[var(--color-text-tertiary)]">
            Applies to every resource kind — useful for org-wide rules.
          </p>
        )}
      </div>

      <div>
        <Label>Stage</Label>
        <Segmented value={stage} options={stages} onChange={setStage} />
      </div>

      <div>
        <Label>Status</Label>
        <Segmented value={status} options={statuses} onChange={setStatus} />
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
  );
}
