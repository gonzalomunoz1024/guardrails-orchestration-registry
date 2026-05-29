import { useMemo, useState } from 'react';
import {
  Filter,
  Grid,
  List,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  Loader2,
  RefreshCw,
  Plus,
  FilePen,
  Trash2,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { usePolicies } from '@/hooks';
import { useDraftStore, usePolicyStore } from '@/store';
import { cn, slugifyName } from '@/utils';
import { RESOURCE_KIND_LABELS, type RegistryPolicy, type PolicyStatus } from '@/types';
import type { GuardrailDraft } from '@/store/draftStore';

const statuses: { value: PolicyStatus | null; label: string }[] = [
  { value: null, label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'In Review' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
];

function getStatusIcon(status: PolicyStatus) {
  switch (status) {
    case 'active':
      return <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />;
    case 'review':
      return <Clock className="w-4 h-4 text-[var(--color-warning)]" />;
    case 'draft':
      return <AlertCircle className="w-4 h-4 text-[var(--color-text-tertiary)]" />;
    case 'deprecated':
      return <AlertCircle className="w-4 h-4 text-[var(--color-error)]" />;
    default:
      return null;
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

interface PolicyTableProps {
  policies: RegistryPolicy[];
  onPolicyClick: (policy: RegistryPolicy) => void;
}

function PolicyTable({ policies, onPolicyClick }: PolicyTableProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Guardrail
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Resource Kind
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Version
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Evaluations
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Allow Rate
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-light)]">
          {policies.map((policy) => (
            <tr
              key={policy.id}
              onClick={() => onPolicyClick(policy)}
              className="hover:bg-[var(--color-surface-secondary)] cursor-pointer transition-colors"
            >
              <td className="px-4 py-4">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{policy.name}</p>
                  <p className="text-sm text-[var(--color-text-tertiary)] line-clamp-1">{policy.description}</p>
                </div>
              </td>
              <td className="px-4 py-4">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                  {RESOURCE_KIND_LABELS[policy.resourceKind]}
                </span>
              </td>
              <td className="px-4 py-4">
                <span className="flex items-center gap-1.5 text-sm">
                  {getStatusIcon(policy.status)}
                  <span className="capitalize text-[var(--color-text-secondary)]">{policy.status}</span>
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                v{policy.currentVersion}
              </td>
              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                {formatNumber(policy.stats.totalEvaluations)}
              </td>
              <td className="px-4 py-4">
                {policy.stats.totalEvaluations > 0 ? (
                  <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-success)]">
                    <TrendingUp className="w-3 h-3" />
                    {policy.stats.allowRate}%
                  </span>
                ) : (
                  <span className="text-sm text-[var(--color-text-tertiary)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PolicyCardProps {
  policy: RegistryPolicy;
  onClick: () => void;
}

function PolicyCard({ policy, onClick }: PolicyCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-5 rounded-[var(--radius-lg)] border border-[var(--color-border-light)]',
        'bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        'hover:border-[var(--color-info)] hover:shadow-[var(--shadow-md)]',
        'transition-all duration-200 group'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
              {RESOURCE_KIND_LABELS[policy.resourceKind]}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
              {getStatusIcon(policy.status)}
              <span className="capitalize">{policy.status}</span>
            </span>
          </div>
          <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-info)] transition-colors">
            {policy.name}
          </h3>
        </div>
        <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-info)] transition-colors" />
      </div>

      {/* Description */}
      <p className="mt-2 text-sm text-[var(--color-text-secondary)] line-clamp-2">
        {policy.description}
      </p>

      {/* Resource Kind & Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border-light)]">
          {policy.resourceKind}
        </span>
        {policy.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
          >
            {tag}
          </span>
        ))}
        {policy.tags.length > 2 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
            +{policy.tags.length - 2}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-tertiary)]">
          v{policy.currentVersion}
        </span>
        {policy.stats.totalEvaluations > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {formatNumber(policy.stats.totalEvaluations)} evals
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
              <TrendingUp className="w-3 h-3" />
              {policy.stats.allowRate}%
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

/** Time-since formatter for the "Saved X ago" footer on draft cards. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

interface DraftCardProps {
  draft: GuardrailDraft;
  onResume: () => void;
  onDiscard: () => void;
}

/** Local-only draft entry rendered alongside backend guardrails. */
function DraftCard({ draft, onResume, onDiscard }: DraftCardProps) {
  return (
    <div
      className={cn(
        'group relative w-full text-left p-5 rounded-[var(--radius-lg)]',
        'border border-dashed border-[var(--color-border)]',
        'bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        'hover:border-[var(--color-info)] hover:shadow-[var(--shadow-md)]',
        'transition-all duration-200'
      )}
    >
      <button
        onClick={onResume}
        className="absolute inset-0 rounded-[var(--radius-lg)]"
        aria-label={`Resume draft ${draft.name || 'Untitled'}`}
      />
      {/* Discard sits above the click overlay. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDiscard();
        }}
        title="Discard draft"
        className="absolute top-3 right-3 z-10 p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] hover:bg-[var(--color-surface-secondary)] transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <div className="relative pointer-events-none">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
            <FilePen className="w-3 h-3" />
            Local draft
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
            {RESOURCE_KIND_LABELS[draft.resourceKind]}
          </span>
        </div>
        <h3 className="font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-info)] transition-colors">
          {draft.name || 'Untitled draft'}
        </h3>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Saved in your browser, never sent to the backend.
        </p>

        <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>Saved {timeAgo(draft.updatedAt)}</span>
          <span className="flex items-center gap-1 text-[var(--color-info)] font-medium">
            Resume
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

interface DraftRowProps {
  draft: GuardrailDraft;
  onResume: () => void;
  onDiscard: () => void;
}

function DraftRow({ draft, onResume, onDiscard }: DraftRowProps) {
  return (
    <tr
      onClick={onResume}
      className="hover:bg-[var(--color-surface-secondary)] cursor-pointer transition-colors"
    >
      <td className="px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
              <FilePen className="w-3 h-3" />
              Local draft
            </span>
            <p className="font-medium text-[var(--color-text-primary)]">
              {draft.name || 'Untitled draft'}
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Saved in your browser, never sent to the backend.
          </p>
        </div>
      </td>
      <td className="px-4 py-4">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
          {RESOURCE_KIND_LABELS[draft.resourceKind]}
        </span>
      </td>
      <td className="px-4 py-4">
        <span className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
          <AlertCircle className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          Draft
        </span>
      </td>
      <td className="px-4 py-4 text-sm text-[var(--color-text-tertiary)]">—</td>
      <td className="px-4 py-4 text-sm text-[var(--color-text-tertiary)]">—</td>
      <td className="px-4 py-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDiscard();
          }}
          title="Discard draft"
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

type ViewMode = 'grid' | 'table';

export function PolicyCatalog() {
  const {
    searchQuery,
    selectedResourceKind,
    selectedStatus,
    setSelectedResourceKind,
    setSelectedStatus,
    navigateToPolicy,
    setView,
  } = useRegistryStore();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [resourceKindInput, setResourceKindInput] = useState('');

  // Fetch policies from backend with fallback to mock data
  const { data: backendPolicies, isLoading, error, refetch } = usePolicies();

  // Use backend data if available, otherwise fall back to mock data
  const policies = backendPolicies ?? [];

  // Local-only drafts saved via the studio's "Save draft" button.
  const drafts = useDraftStore((s) => s.drafts);
  const removeDraft = useDraftStore((s) => s.removeDraft);
  const resetPolicy = usePolicyStore((s) => s.resetPolicy);
  const currentPolicyName = usePolicyStore((s) => s.metadata.name);

  // Get unique resource kinds from policies for autocomplete
  const uniqueResourceKinds = useMemo(() => {
    const kinds = new Set(policies.map((p) => p.resourceKind));
    return Array.from(kinds).sort();
  }, [policies]);

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSearch =
        !searchQuery ||
        policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesResourceKind = !selectedResourceKind || policy.resourceKind.toLowerCase().includes(selectedResourceKind.toLowerCase());
      const matchesStatus = !selectedStatus || policy.status === selectedStatus;

      return matchesSearch && matchesResourceKind && matchesStatus;
    });
  }, [searchQuery, selectedResourceKind, selectedStatus, policies]);

  // Drafts are pinned at the top — they're locally saved authoring state, so
  // the same search/kind filters apply but the status filter only matches DRAFT.
  const filteredDrafts = useMemo(() => {
    if (selectedStatus && selectedStatus !== 'draft') return [];
    return drafts.filter((d) => {
      const matchesSearch =
        !searchQuery || (d.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesResourceKind =
        !selectedResourceKind ||
        d.resourceKind.toLowerCase().includes(selectedResourceKind.toLowerCase());
      return matchesSearch && matchesResourceKind;
    });
  }, [drafts, searchQuery, selectedResourceKind, selectedStatus]);

  const totalCount = filteredDrafts.length + filteredPolicies.length;

  const resumeDraft = () => setView('create-policy');

  const discardDraft = (draft: GuardrailDraft) => {
    removeDraft(draft.id);
    // If the studio's persisted body is this draft, clear it too so it doesn't
    // resurface the next time the user opens "Create New Guardrail".
    if (slugifyName(currentPolicyName) === draft.id) resetPolicy();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filters Bar */}
      <div className="p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-[var(--color-text-tertiary)]" />

            {/* Resource Kind Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by Resource Kind..."
                value={resourceKindInput}
                onChange={(e) => {
                  setResourceKindInput(e.target.value);
                  setSelectedResourceKind(e.target.value || null);
                }}
                list="resource-kinds"
                className={cn(
                  'px-3 py-2 rounded-[var(--radius-md)] text-sm w-48',
                  'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                  'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                  'placeholder:text-[var(--color-text-tertiary)]'
                )}
              />
              <datalist id="resource-kinds">
                {uniqueResourceKinds.map((kind) => (
                  <option key={kind} value={kind} />
                ))}
              </datalist>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus || ''}
              onChange={(e) => setSelectedStatus((e.target.value as PolicyStatus) || null)}
              className={cn(
                'px-3 py-2 rounded-[var(--radius-md)] text-sm',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
              )}
            >
              {statuses.map((status) => (
                <option key={status.value || 'all'} value={status.value || ''}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle, Count & Create Button */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {totalCount} {totalCount === 1 ? 'guardrail' : 'guardrails'}
              {filteredDrafts.length > 0 && (
                <span className="ml-1 text-[var(--color-warning)]">
                  ({filteredDrafts.length} draft{filteredDrafts.length === 1 ? '' : 's'})
                </span>
              )}
            </span>
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-[var(--radius-sm)] transition-all',
                  viewMode === 'grid'
                    ? 'bg-[var(--color-surface)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <Grid className={cn('w-4 h-4', viewMode === 'grid' && 'text-[var(--color-text-primary)]')} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-1.5 rounded-[var(--radius-sm)] transition-all',
                  viewMode === 'table'
                    ? 'bg-[var(--color-surface)] shadow-sm'
                    : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <List className={cn('w-4 h-4', viewMode === 'table' && 'text-[var(--color-text-primary)]')} />
              </button>
            </div>
            <button
              onClick={() => setView('create-policy')}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              Create Guardrail
            </button>
          </div>
        </div>

      </div>

      {/* Policy Grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <Loader2 className="w-12 h-12 mb-3 animate-spin text-[var(--color-info)]" />
            <p className="text-lg font-medium">Loading policies...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <AlertCircle className="w-12 h-12 mb-3 text-[var(--color-warning)]" />
            <p className="text-lg font-medium">Using cached data</p>
            <p className="text-sm mb-4">Could not connect to backend. Showing local data.</p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        ) : totalCount > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDrafts.map((draft) => (
                <DraftCard
                  key={`draft-${draft.id}`}
                  draft={draft}
                  onResume={resumeDraft}
                  onDiscard={() => discardDraft(draft)}
                />
              ))}
              {filteredPolicies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onClick={() => navigateToPolicy(policy)}
                />
              ))}
            </div>
          ) : filteredDrafts.length === 0 ? (
            <PolicyTable policies={filteredPolicies} onPolicyClick={navigateToPolicy} />
          ) : (
            // Unified table when drafts are present: single header, drafts on
            // top, policies below. (PolicyTable's policy-row layout matches the
            // columns we render for drafts, so they line up.)
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Guardrail</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Resource Kind</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Evaluations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Allow Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-light)]">
                  {filteredDrafts.map((draft) => (
                    <DraftRow
                      key={`draft-${draft.id}`}
                      draft={draft}
                      onResume={resumeDraft}
                      onDiscard={() => discardDraft(draft)}
                    />
                  ))}
                  {filteredPolicies.map((policy) => (
                    <tr
                      key={policy.id}
                      onClick={() => navigateToPolicy(policy)}
                      className="hover:bg-[var(--color-surface-secondary)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{policy.name}</p>
                          <p className="text-sm text-[var(--color-text-tertiary)] line-clamp-1">{policy.description}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                          {RESOURCE_KIND_LABELS[policy.resourceKind]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 text-sm">
                          {getStatusIcon(policy.status)}
                          <span className="capitalize text-[var(--color-text-secondary)]">{policy.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">v{policy.currentVersion}</td>
                      <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                        {formatNumber(policy.stats.totalEvaluations)}
                      </td>
                      <td className="px-4 py-4">
                        {policy.stats.totalEvaluations > 0 ? (
                          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-success)]">
                            <TrendingUp className="w-3 h-3" />
                            {policy.stats.allowRate}%
                          </span>
                        ) : (
                          <span className="text-sm text-[var(--color-text-tertiary)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No guardrails found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
