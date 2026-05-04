import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Radius,
  ArrowRight,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { usePolicies, useStats } from '@/hooks';
import { mockPolicies } from '@/data/mockData';
import { cn } from '@/utils';
import type { DashboardStats } from '@/types';

export function Dashboard() {
  const { setView, navigateToPolicy, navigateToBlastRadius } = useRegistryStore();

  // Fetch policies from backend with fallback to mock data
  const { data: backendPolicies } = usePolicies();

  // Fetch stats from backend
  const { data: backendStats } = useStats('24h');

  // Use backend data if available, otherwise fall back to mock data
  const policies = backendPolicies && backendPolicies.length > 0 ? backendPolicies : mockPolicies;

  // Use backend stats if available, otherwise compute from policies
  const computedStats: DashboardStats = backendStats
    ? {
        totalPolicies: backendStats.totalGuardrails ?? 0,
        activePolicies: backendStats.activeGuardrails ?? 0,
        draftPolicies: backendStats.guardrailsByStatus?.DRAFT ?? 0,
        pendingReview: backendStats.guardrailsByStatus?.REVIEW ?? 0,
        totalEvaluationsToday: backendStats.evaluations?.total ?? 0,
        avgAllowRate: backendStats.evaluations?.passRate ?? 0,
        recentBlastRadiusTests: 0, // Not provided by backend yet
      }
    : {
        totalPolicies: policies.length,
        activePolicies: policies.filter((p) => p.status === 'active').length,
        draftPolicies: policies.filter((p) => p.status === 'draft').length,
        pendingReview: policies.filter((p) => p.status === 'review').length,
        totalEvaluationsToday: 0,
        avgAllowRate: 0,
        recentBlastRadiusTests: 0,
      };

  const recentPolicies = policies.slice(0, 5);

  const statCards = [
    {
      label: 'Total Policies',
      value: computedStats.totalPolicies,
      icon: FileText,
      color: 'var(--color-info)',
      bgColor: 'var(--color-info-bg)',
    },
    {
      label: 'Active',
      value: computedStats.activePolicies,
      icon: CheckCircle,
      color: 'var(--color-success)',
      bgColor: 'var(--color-success-bg)',
    },
    {
      label: 'Pending Review',
      value: computedStats.pendingReview,
      icon: Clock,
      color: 'var(--color-warning)',
      bgColor: 'var(--color-warning-bg)',
    },
    {
      label: 'Drafts',
      value: computedStats.draftPolicies,
      icon: AlertCircle,
      color: 'var(--color-text-tertiary)',
      bgColor: 'var(--color-surface-secondary)',
    },
  ];

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">{stat.label}</p>
                <p className="text-3xl font-semibold text-[var(--color-text-primary)] mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className="p-2.5 rounded-[var(--radius-md)]"
                style={{ backgroundColor: stat.bgColor }}
              >
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Policies */}
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Policies</h2>
            <button
              onClick={() => setView('policies')}
              className="text-sm text-[var(--color-info)] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {recentPolicies.map((policy) => (
              <button
                key={policy.id}
                onClick={() => navigateToPolicy(policy)}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">
                    {policy.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-tertiary)] truncate">
                    {policy.description}
                  </p>
                </div>
                <span
                  className={cn(
                    'ml-4 px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                    policy.status === 'active' && 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
                    policy.status === 'review' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
                    policy.status === 'draft' && 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                  )}
                >
                  {policy.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats & Actions */}
        <div className="space-y-6">
          {/* Evaluation Stats */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[var(--color-info)]" />
              <h3 className="font-semibold text-[var(--color-text-primary)]">Today's Evaluations</h3>
            </div>
            <p className="text-3xl font-bold text-[var(--color-text-primary)]">
              {computedStats.totalEvaluationsToday.toLocaleString()}
            </p>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-1">Allow Rate</p>
                <div className="h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-success)]"
                    style={{ width: `${computedStats.avgAllowRate}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-[var(--color-success)]">
                {computedStats.avgAllowRate}%
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-5">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => setView('create-policy')}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)]',
                  'bg-[var(--color-info)] text-white transition-all hover:opacity-90'
                )}
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Create New Policy</span>
              </button>
              <button
                onClick={() => navigateToBlastRadius()}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-[var(--radius-md)]',
                  'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                  'transition-all hover:bg-[var(--color-border-light)]'
                )}
              >
                <Radius className="w-5 h-5" />
                <span className="font-medium">Run Blast Radius Test</span>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
