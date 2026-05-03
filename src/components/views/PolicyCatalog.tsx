import { useMemo } from 'react';
import {
  Filter,
  Grid,
  List,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  TrendingUp,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { usePolicies } from '@/hooks';
import { mockPolicies } from '@/data/mockData';
import { cn } from '@/utils';
import type { RegistryPolicy, PolicyCategory, PolicyStatus, PolicySeverity } from '@/types';

const categories: { value: PolicyCategory | null; label: string }[] = [
  { value: null, label: 'All Categories' },
  { value: 'access-control', label: 'Access Control' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'security', label: 'Security' },
  { value: 'cost', label: 'Cost' },
  { value: 'operational', label: 'Operational' },
];

const statuses: { value: PolicyStatus | null; label: string }[] = [
  { value: null, label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'In Review' },
  { value: 'draft', label: 'Draft' },
  { value: 'deprecated', label: 'Deprecated' },
];

function getSeverityColor(severity: PolicySeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-[var(--color-error-bg)] text-[var(--color-error)]';
    case 'high':
      return 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]';
    case 'medium':
      return 'bg-[var(--color-info-bg)] text-[var(--color-info)]';
    case 'low':
      return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }
}

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

function getCategoryIcon(category: PolicyCategory) {
  switch (category) {
    case 'access-control':
      return <Shield className="w-4 h-4" />;
    case 'security':
      return <Shield className="w-4 h-4" />;
    default:
      return <Tag className="w-4 h-4" />;
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
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
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getSeverityColor(policy.severity))}>
              {policy.severity}
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

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {policy.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
          >
            {tag}
          </span>
        ))}
        {policy.tags.length > 3 && (
          <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
            +{policy.tags.length - 3}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-[var(--color-border-light)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
            {getCategoryIcon(policy.category)}
            <span className="capitalize">{policy.category.replace('-', ' ')}</span>
          </div>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            v{policy.currentVersion}
          </span>
        </div>
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

export function PolicyCatalog() {
  const {
    searchQuery,
    selectedCategory,
    selectedStatus,
    setSelectedCategory,
    setSelectedStatus,
    navigateToPolicy,
  } = useRegistryStore();

  // Fetch policies from backend with fallback to mock data
  const { data: backendPolicies, isLoading, error, refetch } = usePolicies();

  // Use backend data if available, otherwise fall back to mock data
  const policies = backendPolicies && backendPolicies.length > 0 ? backendPolicies : mockPolicies;

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSearch =
        !searchQuery ||
        policy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !selectedCategory || policy.category === selectedCategory;
      const matchesStatus = !selectedStatus || policy.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [searchQuery, selectedCategory, selectedStatus]);

  const statusCounts = useMemo(() => {
    return {
      all: policies.length,
      active: policies.filter((p) => p.status === 'active').length,
      review: policies.filter((p) => p.status === 'review').length,
      draft: policies.filter((p) => p.status === 'draft').length,
    };
  }, [policies]);

  return (
    <div className="h-full flex flex-col">
      {/* Filters Bar */}
      <div className="p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-[var(--color-text-tertiary)]" />

            {/* Category Filter */}
            <select
              value={selectedCategory || ''}
              onChange={(e) => setSelectedCategory((e.target.value as PolicyCategory) || null)}
              className={cn(
                'px-3 py-2 rounded-[var(--radius-md)] text-sm',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
              )}
            >
              {categories.map((cat) => (
                <option key={cat.value || 'all'} value={cat.value || ''}>
                  {cat.label}
                </option>
              ))}
            </select>

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

          {/* View Toggle & Count */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--color-text-tertiary)]">
              {filteredPolicies.length} {filteredPolicies.length === 1 ? 'policy' : 'policies'}
            </span>
            <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
              <button className="p-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] shadow-sm">
                <Grid className="w-4 h-4 text-[var(--color-text-primary)]" />
              </button>
              <button className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setSelectedStatus(null)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              !selectedStatus
                ? 'bg-[var(--color-info)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
            )}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setSelectedStatus('active')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              selectedStatus === 'active'
                ? 'bg-[var(--color-success)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
            )}
          >
            Active ({statusCounts.active})
          </button>
          <button
            onClick={() => setSelectedStatus('review')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              selectedStatus === 'review'
                ? 'bg-[var(--color-warning)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
            )}
          >
            In Review ({statusCounts.review})
          </button>
          <button
            onClick={() => setSelectedStatus('draft')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              selectedStatus === 'draft'
                ? 'bg-[var(--color-text-tertiary)] text-white'
                : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
            )}
          >
            Drafts ({statusCounts.draft})
          </button>
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
        ) : filteredPolicies.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onClick={() => navigateToPolicy(policy)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-tertiary)]">
            <AlertCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No policies found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
