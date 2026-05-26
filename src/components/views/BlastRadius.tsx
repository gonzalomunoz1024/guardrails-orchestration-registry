import { useState, useMemo } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { usePolicies } from '@/hooks';
import { mockPolicies, mockBlastRadiusResults } from '@/data/mockData';
import { cn } from '@/utils';
import type { BlastRadiusResult, BlastRadiusSample, RegistryPolicy } from '@/types';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SampleRow({ sample }: { sample: BlastRadiusSample }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[var(--color-border-light)] last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-surface-secondary)] transition-colors"
      >
        <div className="flex items-center gap-4">
          {sample.decision === 'allow' ? (
            <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
          ) : sample.decision === 'deny' ? (
            <XCircle className="w-5 h-5 text-[var(--color-error)]" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
          )}
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[var(--color-text-primary)]">
                {sample.resourceName}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
                {sample.resourceType}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-tertiary)]">{sample.reason}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium capitalize',
              sample.decision === 'allow' && 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
              sample.decision === 'deny' && 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
              sample.decision === 'error' && 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
            )}
          >
            {sample.decision}
          </span>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          ) : (
            <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pl-14">
          <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
            <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase">
              Input Data
            </span>
            <pre className="mt-2 text-sm font-mono text-[var(--color-text-primary)]">
              {JSON.stringify(sample.input, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, onSelect }: { result: BlastRadiusResult; onSelect: () => void }) {
  const allowPercent = Math.round((result.allowedCount / result.totalRecords) * 100);
  const denyPercent = Math.round((result.deniedCount / result.totalRecords) * 100);

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-5 rounded-[var(--radius-lg)] border border-[var(--color-border-light)]',
        'bg-[var(--color-surface)] shadow-[var(--shadow-card)]',
        'hover:border-[var(--color-info)] transition-all'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-[var(--color-text-primary)]">{result.policyName}</h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            {formatDate(result.executedAt)} by {result.executedBy}
          </p>
        </div>
        <Clock className="w-5 h-5 text-[var(--color-text-tertiary)]" />
      </div>

      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-[var(--color-text-secondary)]">
              {result.totalRecords.toLocaleString()} records tested
            </span>
            <span className="text-[var(--color-text-tertiary)]">
              {result.executionTimeMs}ms
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden flex">
            <div
              className="h-full bg-[var(--color-success)]"
              style={{ width: `${allowPercent}%` }}
            />
            <div
              className="h-full bg-[var(--color-error)]"
              style={{ width: `${denyPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-[var(--color-success)]" />
          <span className="text-[var(--color-text-secondary)]">
            {result.allowedCount.toLocaleString()} allowed ({allowPercent}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-[var(--color-error)]" />
          <span className="text-[var(--color-text-secondary)]">
            {result.deniedCount.toLocaleString()} denied ({denyPercent}%)
          </span>
        </div>
      </div>
    </button>
  );
}

export function BlastRadius() {
  const { selectedPolicyId } = useRegistryStore();

  // Fetch policies from backend
  const { data: backendPolicies } = usePolicies();

  // Use backend data if available, otherwise fall back to mock data
  const allPolicies = backendPolicies && backendPolicies.length > 0 ? backendPolicies : mockPolicies;

  const [selectedPolicy, setSelectedPolicy] = useState<RegistryPolicy | null>(
    selectedPolicyId ? allPolicies.find((p) => p.id === selectedPolicyId) || null : null
  );
  const [selectedResult, setSelectedResult] = useState<BlastRadiusResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [filterDecision, setFilterDecision] = useState<'all' | 'allow' | 'deny' | 'error'>('all');

  const activePolicies = allPolicies.filter((p) => p.status === 'active' || p.status === 'review');

  const filteredSamples = useMemo(() => {
    if (!selectedResult) return [];
    if (filterDecision === 'all') return selectedResult.sampleResults;
    return selectedResult.sampleResults.filter((s) => s.decision === filterDecision);
  }, [selectedResult, filterDecision]);

  const handleRunTest = () => {
    if (!selectedPolicy) return;
    setIsRunning(true);
    // Simulate running the test
    setTimeout(() => {
      setIsRunning(false);
      const existingResult = mockBlastRadiusResults.find((r) => r.policyId === selectedPolicy.id);
      if (existingResult) {
        setSelectedResult(existingResult);
      }
    }, 2000);
  };

  return (
    <div className="h-full flex">
      {/* Left Panel - Policy Selection & History */}
      <div className="w-80 border-r border-[var(--color-border-light)] flex flex-col">
        {/* Policy Selector */}
        <div className="p-4 border-b border-[var(--color-border-light)]">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            Select Guardrail to Test
          </label>
          <select
            value={selectedPolicy?.id || ''}
            onChange={(e) => {
              const policy = allPolicies.find((p) => p.id === e.target.value);
              setSelectedPolicy(policy || null);
              setSelectedResult(null);
            }}
            className={cn(
              'w-full px-3 py-2.5 rounded-[var(--radius-md)] text-sm',
              'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
              'border border-transparent focus:border-[var(--color-info)] focus:outline-none'
            )}
          >
            <option value="">Choose a policy...</option>
            {activePolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleRunTest}
            disabled={!selectedPolicy || isRunning}
            className={cn(
              'w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-[var(--radius-md)]',
              'bg-[var(--color-info)] text-white font-medium',
              'transition-all hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Running Test...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Blast Radius Test
              </>
            )}
          </button>
        </div>

        {/* Test History */}
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">
              Recent Tests
            </h3>
            <div className="space-y-3">
              {mockBlastRadiusResults.map((result) => (
                <ResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => setSelectedResult(result)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedResult ? (
          <>
            {/* Results Header */}
            <div className="p-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                    {selectedResult.policyName}
                  </h2>
                  <p className="text-sm text-[var(--color-text-tertiary)]">
                    Tested on {formatDate(selectedResult.executedAt)} by {selectedResult.executedBy}
                  </p>
                </div>
                <button
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                    'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                    'font-medium transition-all hover:bg-[var(--color-border-light)]'
                  )}
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Total Records</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {selectedResult.totalRecords.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
                  <p className="text-sm text-[var(--color-success)]">Allowed</p>
                  <p className="text-2xl font-semibold text-[var(--color-success)]">
                    {selectedResult.allowedCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)]">
                  <p className="text-sm text-[var(--color-error)]">Denied</p>
                  <p className="text-2xl font-semibold text-[var(--color-error)]">
                    {selectedResult.deniedCount.toLocaleString()}
                  </p>
                </div>
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">Execution Time</p>
                  <p className="text-2xl font-semibold text-[var(--color-text-primary)]">
                    {selectedResult.executionTimeMs}ms
                  </p>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="mt-4">
                <div className="h-4 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--color-success)] transition-all"
                    style={{
                      width: `${(selectedResult.allowedCount / selectedResult.totalRecords) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[var(--color-error)] transition-all"
                    style={{
                      width: `${(selectedResult.deniedCount / selectedResult.totalRecords) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-sm">
                  <span className="text-[var(--color-success)]">
                    {Math.round((selectedResult.allowedCount / selectedResult.totalRecords) * 100)}%
                    would be allowed
                  </span>
                  <span className="text-[var(--color-error)]">
                    {Math.round((selectedResult.deniedCount / selectedResult.totalRecords) * 100)}%
                    would be denied
                  </span>
                </div>
              </div>
            </div>

            {/* Sample Results */}
            <div className="flex-1 overflow-auto">
              <div className="p-4 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Filter className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">Sample Results</span>
                </div>
                <div className="flex items-center gap-2">
                  {(['all', 'allow', 'deny', 'error'] as const).map((decision) => (
                    <button
                      key={decision}
                      onClick={() => setFilterDecision(decision)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize',
                        filterDecision === decision
                          ? decision === 'allow'
                            ? 'bg-[var(--color-success)] text-white'
                            : decision === 'deny'
                              ? 'bg-[var(--color-error)] text-white'
                              : decision === 'error'
                                ? 'bg-[var(--color-warning)] text-white'
                                : 'bg-[var(--color-info)] text-white'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-light)]'
                      )}
                    >
                      {decision}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[var(--color-border-light)]">
                {filteredSamples.map((sample) => (
                  <SampleRow key={sample.id} sample={sample} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-tertiary)]">
            <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No test selected</p>
            <p className="text-sm mt-1">
              Select a guardrail and run a blast radius test, or view a previous test result
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
