import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Pencil,
  Trash2,
  User,
  Calendar,
  Package,
  ChevronDown,
  ChevronRight,
  FileJson,
  ExternalLink,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { useSuite, useResolvedMembers, useMemberContract, useDeleteSuite } from '@/hooks/useSuites';
import { STAGE_LABELS, ENFORCEMENT_LABELS, RESOURCE_KIND_LABELS } from '@/types';
import type { SuiteMember } from '@/types/suite.types';
import type { GuardrailRef } from '@/types/guardrail.types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** A single pinned member row; expands to show its published input contract. */
function MemberRow({ member }: { member: SuiteMember }) {
  const [expanded, setExpanded] = useState(false);
  const ref: GuardrailRef = { guardrailId: member.guardrailId, version: member.version };
  const { data: contract, isLoading } = useMemberContract(expanded ? ref : null);
  const dangling = !member.guardrailName;

  return (
    <div className="border border-[var(--color-border-light)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]" />
          )}
          <div className="text-left min-w-0">
            <p className="font-medium text-[var(--color-text-primary)] truncate">
              {member.guardrailName || member.guardrailId}
              {dangling && (
                <span className="ml-2 text-xs text-[var(--color-error)]">(version not found)</span>
              )}
            </p>
            {member.description && (
              <p className="text-sm text-[var(--color-text-tertiary)] truncate">{member.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
            v{member.version}
          </span>
          {member.resourceKind && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
              {RESOURCE_KIND_LABELS[member.resourceKind]}
            </span>
          )}
          {member.stage && (
            <span className="hidden md:inline px-2 py-0.5 rounded-full text-xs bg-[var(--color-info-bg)] text-[var(--color-info)]">
              {STAGE_LABELS[member.stage]}
            </span>
          )}
          {member.enforcementType && (
            <span className="hidden md:inline px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
              {ENFORCEMENT_LABELS[member.enforcementType]}
            </span>
          )}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] uppercase">
            <FileJson className="w-3.5 h-3.5" />
            Input contract
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Resolving contract...
            </div>
          ) : contract?.schema ? (
            <>
              <pre className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-xs font-mono overflow-auto max-h-72">
                {JSON.stringify(contract.schema, null, 2)}
              </pre>
              {contract.examples.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    Examples ({contract.examples.length})
                  </p>
                  <div className="space-y-2">
                    {contract.examples.map((ex, i) => (
                      <div key={i} className="rounded-[var(--radius-sm)] bg-[var(--color-surface)] overflow-hidden">
                        <div className="px-3 py-1.5 text-xs font-mono text-[var(--color-text-secondary)] border-b border-[var(--color-border-light)]">
                          {ex.name}
                        </div>
                        <pre className="p-3 text-xs font-mono overflow-auto max-h-48">{ex.payload}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              This guardrail version has no published input contract.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SuiteDetail() {
  const { selectedSuiteId, setView, navigateToSuiteBuilder } = useRegistryStore();
  const { data: suite, isLoading, error } = useSuite(selectedSuiteId);
  const deleteSuite = useDeleteSuite();

  const refs = useMemo<GuardrailRef[]>(
    () => (suite?.members ?? []).map((m) => ({ guardrailId: m.guardrailId, version: m.version })),
    [suite]
  );
  const { data: resolvedMembers } = useResolvedMembers(refs);

  // Prefer the freshly-resolved facets; fall back to whatever the suite carried.
  const members: SuiteMember[] = resolvedMembers ?? suite?.members ?? [];

  // Aggregate the stage / enforcement mix across pinned members.
  const stageMix = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => m.stage && (counts[STAGE_LABELS[m.stage]] = (counts[STAGE_LABELS[m.stage]] || 0) + 1));
    return counts;
  }, [members]);

  const handleDelete = () => {
    if (!suite) return;
    if (!window.confirm(`Delete suite "${suite.name}"? This cannot be undone.`)) return;
    deleteSuite.mutate(suite.suiteId, { onSuccess: () => setView('suites') });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <Loader2 className="w-12 h-12 mb-3 animate-spin text-[var(--color-info)]" />
        <p className="text-lg font-medium">Loading suite...</p>
      </div>
    );
  }

  if (error || !suite) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)]">
        <AlertCircle className="w-12 h-12 mb-3 text-[var(--color-warning)]" />
        <p className="text-lg font-medium">Suite not found</p>
        <button
          onClick={() => setView('suites')}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to suites
        </button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]/80 backdrop-blur-xl">
        <div className="px-6 py-4">
          <button
            onClick={() => setView('suites')}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Suites
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">{suite.name}</h1>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{suite.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{suite.owner}</span>
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{formatDate(suite.createdAt)}</span>
                <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />{suite.members.length} guardrails</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigateToSuiteBuilder(suite.suiteId)}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium transition-all hover:bg-[var(--color-border-light)]"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteSuite.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-[var(--color-error)] font-medium transition-all hover:opacity-90 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>

          {Object.keys(stageMix).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(stageMix).map(([label, count]) => (
                <span
                  key={label}
                  className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-info-bg)] text-[var(--color-info)]"
                >
                  {count} × {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-[var(--color-text-secondary)]">
          <Package className="w-4 h-4" />
          Pinned guardrails
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-tertiary)]">
            <Package className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm">This suite has no members yet.</p>
            <button
              onClick={() => navigateToSuiteBuilder(suite.suiteId)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <Pencil className="w-4 h-4" />
              Add guardrails
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <MemberRow key={`${m.guardrailId}@${m.version}`} member={m} />
            ))}
          </div>
        )}

        <p className="mt-6 flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
          <ExternalLink className="w-3.5 h-3.5" />
          Members are pinned to immutable versions — updating a guardrail does not change this suite.
        </p>
      </div>
    </div>
  );
}
