import { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  Radius,
  GitBranch,
  User,
  Calendar,
  Tag,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { useUIStore } from '@/store';
import { usePolicy } from '@/hooks';
import { defaultEditorOptions } from '@/monaco/config';
import { cn } from '@/utils';
import type { PolicyTestCase, PolicyVersion } from '@/types';
import { RESOURCE_KIND_LABELS } from '@/types';

type Tab = 'overview' | 'code' | 'tests' | 'versions' | 'config';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function TestCaseRow({ test }: { test: PolicyTestCase }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(test.input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-[var(--color-border-light)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          {test.passed ? (
            <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
          ) : test.passed === false ? (
            <XCircle className="w-5 h-5 text-[var(--color-error)]" />
          ) : (
            <Clock className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          )}
          <div className="text-left">
            <p className="font-medium text-[var(--color-text-primary)]">{test.name}</p>
            <p className="text-sm text-[var(--color-text-tertiary)]">{test.description}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
        )}
      </button>
      {expanded && (
        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
              Test Input
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-[var(--color-info)] hover:underline"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-sm font-mono overflow-auto">
            {JSON.stringify(test.input, null, 2)}
          </pre>
          <div className="mt-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
              Expected Result
            </span>
            <pre className="mt-1 p-3 rounded-[var(--radius-sm)] bg-[var(--color-surface)] text-sm font-mono">
              {JSON.stringify(test.expectedResult, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function VersionRow({ version, isCurrent }: { version: PolicyVersion; isCurrent: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[var(--color-border-light)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--color-text-primary)]">v{version.version}</span>
              {isCurrent && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-success-bg)] text-[var(--color-success)]">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)]">{version.changelog}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-[var(--color-text-secondary)]">{version.createdBy}</p>
            <p className="text-[var(--color-text-tertiary)]">{formatDate(version.createdAt)}</p>
          </div>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[var(--color-border-light)]">
          <pre className="p-4 text-sm font-mono bg-[var(--color-surface-tertiary)] overflow-auto max-h-64">
            {version.regoCode}
          </pre>
        </div>
      )}
    </div>
  );
}

export function PolicyDetail() {
  const { selectedPolicyId, setView, navigateToBlastRadius } = useRegistryStore();
  const { resolvedTheme } = useUIStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Fetch policy from backend
  const { data: backendPolicy, isLoading } = usePolicy(selectedPolicyId);
  const policy = backendPolicy;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-info)]" />
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--color-text-tertiary)]">Guardrail not found</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'code', label: 'Rego' },
    { id: 'tests', label: `Tests (${policy.testCases.length})` },
    { id: 'versions', label: `Versions (${policy.versions.length})` },
    { id: 'config', label: 'Configuration' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <button
          onClick={() => setView('policies')}
          className="flex items-center gap-2 text-sm text-[var(--color-info)] hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Guardrails
        </button>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {policy.name}
              </h1>
              <span
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium capitalize',
                  policy.status === 'active' && 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
                  policy.status === 'review' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
                  policy.status === 'draft' && 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]'
                )}
              >
                {policy.status}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                {RESOURCE_KIND_LABELS[policy.resourceKind]}
              </span>
            </div>
            <p className="text-[var(--color-text-secondary)] max-w-2xl">{policy.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToBlastRadius(policy.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'font-medium transition-all hover:bg-[var(--color-border-light)]'
              )}
            >
              <Radius className="w-4 h-4" />
              Blast Radius
            </button>
            <button
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-info)] text-white',
                'font-medium transition-all hover:opacity-90'
              )}
            >
              <Play className="w-4 h-4" />
              Run Tests
            </button>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <User className="w-4 h-4" />
            {policy.author}
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <Calendar className="w-4 h-4" />
            Created {formatDate(policy.createdAt)}
          </div>
          <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <GitBranch className="w-4 h-4" />
            v{policy.currentVersion}
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 mt-4">
          <Tag className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          {policy.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-6 -mb-6 border-b border-[var(--color-border-light)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-[var(--color-info)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-info)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Total Evaluations</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                    {policy.stats.totalEvaluations.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Allow Rate</p>
                  <p className="text-2xl font-semibold text-[var(--color-success)] mt-1">
                    {policy.stats.allowRate}%
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Deny Rate</p>
                  <p className="text-2xl font-semibold text-[var(--color-error)] mt-1">
                    {policy.stats.denyRate}%
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Avg. Execution</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)] mt-1">
                    {policy.stats.avgExecutionTimeMs}ms
                  </p>
                </div>
              </div>

              {/* Quick Code Preview */}
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Policy Code Preview
                  </span>
                  <button
                    onClick={() => setActiveTab('code')}
                    className="text-sm text-[var(--color-info)] hover:underline"
                  >
                    View full code
                  </button>
                </div>
                <pre className="p-4 text-sm font-mono bg-[var(--color-surface)] overflow-auto max-h-48">
                  {policy.regoCode.split('\n').slice(0, 10).join('\n')}
                  {policy.regoCode.split('\n').length > 10 && '\n...'}
                </pre>
              </div>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-4">
              {policy.approvedBy && (
                <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-5 h-5 text-[var(--color-success)]" />
                    <span className="font-medium text-[var(--color-text-primary)]">Approved</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    By {policy.approvedBy}
                  </p>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    {formatDate(policy.approvedAt!)}
                  </p>
                </div>
              )}

              <div className="p-4 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)]">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-[var(--color-info)]" />
                  <span className="font-medium text-[var(--color-text-primary)]">Resource</span>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {RESOURCE_KIND_LABELS[policy.resourceKind]}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  {policy.stage}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="h-[600px] rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden">
            <Editor
              height="100%"
              language="rego"
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
              value={policy.regoCode}
              options={{
                ...defaultEditorOptions,
                readOnly: true,
              }}
            />
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="space-y-3">
            {policy.testCases.length > 0 ? (
              policy.testCases.map((test) => <TestCaseRow key={test.id} test={test} />)
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--color-text-tertiary)]">
                <p className="text-lg font-medium">No tests defined</p>
                <p className="text-sm">Add test cases to validate this guardrail</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'versions' && (
          <div className="space-y-3">
            {policy.versions.map((version) => (
              <VersionRow
                key={version.version}
                version={version}
                isCurrent={version.version === policy.currentVersion}
              />
            ))}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="h-[400px] rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden">
            <Editor
              height="100%"
              language="json"
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
              value={policy.configJson}
              options={{
                ...defaultEditorOptions,
                readOnly: true,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
