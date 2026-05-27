import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  Loader2,
  Package,
  Check,
  FileJson,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { useAuthStore } from '@/store/authStore';
import { usePolicies } from '@/hooks';
import {
  useSuite,
  useCreateSuite,
  useUpdateSuite,
  useGuardrailVersions,
  useMemberContract,
} from '@/hooks/useSuites';
import { cn } from '@/utils';
import { RESOURCE_KIND_LABELS, STAGE_LABELS } from '@/types';
import type { SuiteStatus } from '@/types/suite.types';
import type { GuardrailRef } from '@/types/guardrail.types';

interface DraftMember {
  guardrailId: string;
  guardrailName: string;
  version: string; // pinned version
  resourceKind?: keyof typeof RESOURCE_KIND_LABELS;
  stage?: keyof typeof STAGE_LABELS;
}

const statuses: SuiteStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE'];

/** A pinned member row in the builder: choose the version, see contract presence. */
function MemberPin({
  member,
  onPin,
  onRemove,
}: {
  member: DraftMember;
  onPin: (version: string) => void;
  onRemove: () => void;
}) {
  const { data: versions, isLoading } = useGuardrailVersions(member.guardrailId);
  const ref: GuardrailRef = { guardrailId: member.guardrailId, version: member.version };
  const { data: contract } = useMemberContract(ref);

  // Fall back to the currently-pinned version if the versions endpoint is empty.
  const options = versions && versions.length > 0 ? versions.map((v) => v.version) : [member.version];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text-primary)] truncate">{member.guardrailName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
            {member.resourceKind && <span>{RESOURCE_KIND_LABELS[member.resourceKind]}</span>}
            {member.stage && <span>· {STAGE_LABELS[member.stage]}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            Pin
            <select
              value={member.version}
              onChange={(e) => onPin(e.target.value)}
              disabled={isLoading}
              className="px-2 py-1 rounded-[var(--radius-sm)] text-xs font-mono bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-transparent focus:border-[var(--color-info)] focus:outline-none"
            >
              {options.map((v) => (
                <option key={v} value={v}>
                  v{v}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onRemove}
            title="Remove from suite"
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <FileJson className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
        {contract?.schema ? (
          <span className="flex items-center gap-1 text-[var(--color-success)]">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Input contract published
            {contract.examples.length > 0 && ` · ${contract.examples.length} example(s)`}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
            <AlertCircle className="w-3.5 h-3.5" />
            No input contract for v{member.version}
          </span>
        )}
      </div>
    </div>
  );
}

export function SuiteBuilder() {
  const { selectedSuiteId, setView, navigateToSuite } = useRegistryStore();
  const owner = useAuthStore((s) => s.user?.login || s.user?.name || 'unknown');

  const isEditing = !!selectedSuiteId;
  const { data: existingSuite, isLoading: loadingSuite } = useSuite(selectedSuiteId);
  const { data: policies, isLoading: loadingPolicies } = usePolicies();
  const createSuite = useCreateSuite();
  const updateSuite = useUpdateSuite();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SuiteStatus>('DRAFT');
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [search, setSearch] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Prefill from an existing suite when editing.
  useEffect(() => {
    if (isEditing && existingSuite && !hydrated) {
      setName(existingSuite.name);
      setDescription(existingSuite.description);
      setStatus(existingSuite.status);
      setMembers(
        existingSuite.members.map((m) => ({
          guardrailId: m.guardrailId,
          guardrailName: m.guardrailName || m.guardrailId,
          version: m.version,
          resourceKind: m.resourceKind,
          stage: m.stage,
        }))
      );
      setHydrated(true);
    }
  }, [isEditing, existingSuite, hydrated]);

  const pinnedIds = useMemo(() => new Set(members.map((m) => m.guardrailId)), [members]);

  const available = useMemo(() => {
    const list = (policies ?? []).filter((p) => !pinnedIds.has(p.id));
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [policies, pinnedIds, search]);

  const addMember = (guardrailId: string, guardrailName: string, version: string, rk?: DraftMember['resourceKind'], st?: DraftMember['stage']) => {
    setMembers((prev) => [
      ...prev,
      { guardrailId, guardrailName, version, resourceKind: rk, stage: st },
    ]);
  };

  const pinVersion = (guardrailId: string, version: string) => {
    setMembers((prev) => prev.map((m) => (m.guardrailId === guardrailId ? { ...m, version } : m)));
  };

  const removeMember = (guardrailId: string) => {
    setMembers((prev) => prev.filter((m) => m.guardrailId !== guardrailId));
  };

  const canSave = name.trim().length > 0 && members.length > 0;
  const isSaving = createSuite.isPending || updateSuite.isPending;
  const saveError = createSuite.error || updateSuite.error;

  const handleSave = () => {
    const refs: GuardrailRef[] = members.map((m) => ({ guardrailId: m.guardrailId, version: m.version }));
    if (isEditing && selectedSuiteId) {
      updateSuite.mutate(
        { suiteId: selectedSuiteId, request: { name, description, status, members: refs } },
        { onSuccess: (suite) => navigateToSuite(suite) }
      );
    } else {
      createSuite.mutate(
        { name, description, owner, status, members: refs },
        { onSuccess: (suite) => navigateToSuite(suite) }
      );
    }
  };

  if (isEditing && loadingSuite) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <Loader2 className="w-12 h-12 mb-3 animate-spin text-[var(--color-info)]" />
        <p className="text-lg font-medium">Loading suite...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border-light)] bg-[var(--color-surface)] px-6 py-4">
        <button
          onClick={() => setView('suites')}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Suites
        </button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            {isEditing ? 'Edit suite' : 'Create suite'}
          </h1>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEditing ? 'Save changes' : 'Create suite'}
          </button>
        </div>
        {saveError && (
          <p className="mt-2 text-sm text-[var(--color-error)]">
            {(saveError as Error).message || 'Failed to save suite'}
          </p>
        )}
      </div>

      {/* Body: two columns */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-auto">
        {/* Left: metadata + available guardrails */}
        <div className="space-y-5">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Suite name <span className="text-[var(--color-error)]">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Readiness"
                className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-transparent focus:border-[var(--color-info)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What this suite checks for"
                className="w-full px-3 py-2 rounded-[var(--radius-md)] text-sm bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] border border-transparent focus:border-[var(--color-info)] focus:outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</label>
              <div className="flex p-0.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] w-fit">
                {statuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={cn(
                      'px-3 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-all capitalize',
                      status === s
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-secondary)]'
                    )}
                  >
                    {s.toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search guardrails to add..."
                className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>
            {loadingPolicies ? (
              <div className="flex items-center gap-2 py-6 justify-center text-sm text-[var(--color-text-tertiary)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading guardrails...
              </div>
            ) : available.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
                {pinnedIds.size > 0 ? 'All matching guardrails are already added.' : 'No guardrails found.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[420px] overflow-auto">
                {available.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addMember(p.id, p.name, p.currentVersion, p.resourceKind, p.stage)}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-secondary)] transition-colors text-left group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{p.name}</p>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {RESOURCE_KIND_LABELS[p.resourceKind]} · v{p.currentVersion}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-info)]" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: pinned members */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
            <Package className="w-4 h-4" />
            Suite members ({members.length})
          </div>
          {members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
              <Package className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">Add guardrails from the left to build your suite.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <MemberPin
                  key={m.guardrailId}
                  member={m}
                  onPin={(v) => pinVersion(m.guardrailId, v)}
                  onRemove={() => removeMember(m.guardrailId)}
                />
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-[var(--color-text-tertiary)]">
            Each member is pinned to a specific immutable version. Later guardrail updates won't change this suite.
          </p>
        </div>
      </div>
    </div>
  );
}
