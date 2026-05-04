import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Activity,
  Radius,
  ArrowRight,
  GitPullRequest,
  Play,
  Shield,
  Zap,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { usePolicies, useStats } from '@/hooks';
import { mockActivityEvents, mockPolicies } from '@/data/mockData';
import { cn } from '@/utils';
import type { ActivityEvent, DashboardStats } from '@/types';

// statCards is now computed inside the component to use dynamic data

function getEventIcon(type: ActivityEvent['type']) {
  switch (type) {
    case 'policy_created':
      return <FileText className="w-4 h-4" />;
    case 'policy_updated':
      return <GitPullRequest className="w-4 h-4" />;
    case 'policy_approved':
      return <CheckCircle className="w-4 h-4" />;
    case 'policy_activated':
      return <Zap className="w-4 h-4" />;
    case 'blast_radius_run':
      return <Radius className="w-4 h-4" />;
    case 'test_run':
      return <Play className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}

function getEventColor(type: ActivityEvent['type']) {
  switch (type) {
    case 'policy_approved':
    case 'policy_activated':
      return 'text-[var(--color-success)] bg-[var(--color-success-bg)]';
    case 'blast_radius_run':
      return 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]';
    case 'policy_created':
    case 'policy_updated':
      return 'text-[var(--color-info)] bg-[var(--color-info-bg)]';
    default:
      return 'text-[var(--color-text-secondary)] bg-[var(--color-surface-secondary)]';
  }
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return 'Just now';
}

function getEventText(event: ActivityEvent): string {
  switch (event.type) {
    case 'policy_created':
      return `created "${event.policyName}"`;
    case 'policy_updated':
      return `updated "${event.policyName}"`;
    case 'policy_approved':
      return `approved "${event.policyName}"`;
    case 'policy_activated':
      return `activated "${event.policyName}"`;
    case 'blast_radius_run':
      return `ran blast radius on "${event.policyName}"`;
    case 'test_run':
      return `ran tests on "${event.policyName}"`;
    default:
      return 'performed an action';
  }
}

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
        totalPolicies: backendStats.totalPolicies,
        activePolicies: backendStats.activePolicies,
        draftPolicies: backendStats.draftPolicies,
        pendingReview: backendStats.pendingReview,
        totalEvaluationsToday: backendStats.totalEvaluations,
        avgAllowRate: backendStats.avgAllowRate,
        recentBlastRadiusTests: backendStats.recentBlastRadiusTests,
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

  const recentPolicies = policies.slice(0, 3);
  // Filter active policies (was previously filtered by severity='critical')
  const activePoliciesList = policies.filter((p) => p.status === 'active');

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
        {/* Activity Feed */}
        <div className="lg:col-span-2 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Activity</h2>
            <Activity className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </div>
          <div className="p-4 space-y-4">
            {mockActivityEvents.slice(0, 6).map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className={cn('p-2 rounded-[var(--radius-md)]', getEventColor(event.type))}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-primary)]">
                    <span className="font-medium">{event.userName}</span>{' '}
                    {getEventText(event)}
                  </p>
                  {event.details && (
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                      {event.details}
                    </p>
                  )}
                </div>
                <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
                  {formatTimeAgo(event.timestamp)}
                </span>
              </div>
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

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Policies */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
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

        {/* Critical Policies */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[var(--color-error)]" />
              <h2 className="font-semibold text-[var(--color-text-primary)]">Critical Policies</h2>
            </div>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {activePoliciesList.length} active
            </span>
          </div>
          <div className="divide-y divide-[var(--color-border-light)]">
            {activePoliciesList.map((policy) => (
              <button
                key={policy.id}
                onClick={() => navigateToPolicy(policy)}
                className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-surface-secondary)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">
                    {policy.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      v{policy.currentVersion}
                    </span>
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {policy.stats.totalEvaluations.toLocaleString()} evals
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[var(--color-success)]">
                    {policy.stats.allowRate}%
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">allow rate</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
