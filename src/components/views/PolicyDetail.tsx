import { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
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
  FileJson,
  Loader2,
  Pencil,
} from 'lucide-react';
import { useRegistryStore } from '@/store/registryStore';
import { useUIStore, usePolicyStore } from '@/store';
import { usePolicy } from '@/hooks';
import { guardrailsApi } from '@/services/api';
import { defaultEditorOptions } from '@/monaco/config';
import { cn } from '@/utils';
import type { PolicyTestCase, PolicyVersion } from '@/types';
import { RESOURCE_KIND_LABELS } from '@/types';
import {
  stripVersionFromRegoPackage,
  deriveSchema,
  deriveSchemaFromJson,
  schemasAreStructurallyEqual,
} from '@/utils';
import { PolicyInputDiagram } from './PolicyInputDiagram';

type Tab = 'overview' | 'code' | 'schema' | 'tests' | 'versions' | 'config';

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

/**
 * RegistryPolicy.status is the frontend lowercase form; the studio (and the
 * backend) speak SCREAMING_SNAKE GuardrailStatus. Map back when loading for edit.
 */
function toGuardrailStatus(s: string): 'ACTIVE' | 'INACTIVE' | 'DRAFT' {
  if (s === 'active') return 'ACTIVE';
  if (s === 'draft') return 'DRAFT';
  return 'INACTIVE';
}

interface ReadOnlyEditorCardProps {
  language: 'rego' | 'json';
  value: string;
  theme: string;
  height: string;
  /** Short label rendered next to the copy button — "policy.rego", "configuration". */
  label: string;
}

/**
 * A bordered card wrapping a read-only Monaco editor with a small header
 * that carries a one-click Copy button. Used by the Rego and Configuration
 * tabs on the policy detail view so the author can grab the raw text
 * without selecting it by hand.
 */
function ReadOnlyEditorCard({ language, value, theme, height, label }: ReadOnlyEditorCardProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can fail in non-secure contexts — silently no-op rather
      // than throwing; the button just won't tick.
    }
  };

  return (
    <div
      className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden bg-[var(--color-surface)] flex flex-col"
      style={{ height }}
    >
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60">
        <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">{label}</span>
        <button
          onClick={handleCopy}
          title={copied ? 'Copied' : 'Copy to clipboard'}
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium transition-colors',
            copied
              ? 'text-[var(--color-success)] bg-[var(--color-success-bg)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]'
          )}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={language}
          theme={theme}
          value={value}
          options={{
            ...defaultEditorOptions,
            readOnly: true,
          }}
        />
      </div>
    </div>
  );
}

export function PolicyDetail() {
  const { selectedPolicyId, setView, setAutoOpenBlastRadius } = useRegistryStore();
  const { resolvedTheme } = useUIStore();
  const loadForEdit = usePolicyStore((s) => s.loadForEdit);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isLoadingBlast, setIsLoadingBlast] = useState(false);

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

  // Versions are newest-first per the registry contract; the head is the
  // latest published version. A stale Edit (editing 1.0 when 1.1 exists)
  // would either collide with the existing 1.1 on a contract bump or
  // mutate an immutable historical record on a metadata-only PUT — both
  // break the immutable-version contract. The button is disabled below
  // when this is true so the only editable target is the latest.
  const latestVersion = policy.versions[0]?.version;
  const isLatest = !latestVersion || policy.currentVersion === latestVersion;

  // Re-fetch the input contract AND the rego source for the version being
  // loaded so the studio's baseline is authoritative, even if the cached
  // policy got loaded before those pieces were wired in. Best-effort: empty
  // schema / empty rego if the backend doesn't have one published yet.
  // Shared by both Edit and Run-Blast-Radius.
  const loadPolicyIntoStudio = async () => {
    if (!policy) return;
    const [contract, regoSource] = await Promise.all([
      guardrailsApi
        .getInputSchema(policy.id, policy.currentVersion)
        .catch(() => ({ schema: null as Record<string, unknown> | null, examples: [] as { name: string; payload: string }[] })),
      guardrailsApi
        .getRegoSource(policy.id, policy.currentVersion)
        .catch(() => ''),
    ]);
    const inputSchemaJson = contract.schema ? JSON.stringify(contract.schema, null, 2) : '{}';
    const inputExamples = contract.examples ?? [];
    // Restore the document the schema was derived from. The studio's Edit
    // path defaulted inputJson to "{}" — which on a guardrail with a real
    // schema means the document and schema mismatch on the very first
    // render. Loading the first published example as the live document
    // makes them consistent again. When there are no published examples
    // the document stays blank and the studio's reserved-fields banner
    // surfaces what's missing.
    const inputJson = inputExamples[0]?.payload;
    // Decide whether the studio should run in Auto schema mode (doc edits
    // flow into the schema) on this Edit.
    //
    // The signal we trust: does the published schema match what we'd
    // locally derive from the example? Byte-equality on JSON.stringify
    // was the previous attempt and is too brittle — the backend round-
    // trips manifests through YAML/Mongo which reorders keys and drops
    // empty `required` arrays, so a schema that WAS auto-derived at
    // publish time rarely comes back byte-identical. We use a structural
    // compare (`schemasAreStructurallyEqual`) instead so the auto signal
    // survives the round-trip. If the structural compare fails the schema
    // really is hand-crafted; we stay in Manual and the Submit-time
    // divergence banner covers any drift.
    const inputSchemaAuto = (() => {
      if (!inputJson) return false;
      try {
        const localDerived = deriveSchema(JSON.parse(inputJson));
        const loaded = contract.schema;
        return !!loaded && schemasAreStructurallyEqual(localDerived, loaded);
      } catch {
        return false;
      }
    })();
    // When we've decided it's safe to run in Auto mode, normalize the
    // loaded schema string to the locally-derived form. They're
    // structurally equal but not byte-equal (because of the YAML round-
    // trip on the backend), and the studio's bump effect compares
    // strings — without this normalization the auto-derive effect would
    // run on mount, rewrite inputSchemaJson to the local form, drift
    // from baseInputSchemaJson, and bump the version spuriously before
    // the user touches anything.
    const normalizedInputSchemaJson =
      inputSchemaAuto && inputJson ? deriveSchemaFromJson(inputJson) : inputSchemaJson;
    const configJson = policy.configJson || '{}';
    const configEnabled = configJson.trim() !== '' && configJson.trim() !== '{}';
    // Strip the .vMAJOR_MINOR suffix the publish flow appended so the studio
    // shows the bare package name. Without this the author sees
    // `package foo.v1_0` in the editor, OPA linters flag it, and any fix-up
    // gets detected as a regoCode change by the bump effect — silently
    // bumping the version without the user intending a contract change.
    // The suffix is re-applied at publish time by appendVersionToRegoPackage.
    const rawRego = regoSource || policy.regoCode || '';
    const regoCode = stripVersionFromRegoPackage(rawRego);
    loadForEdit({
      regoCode,
      configJson,
      configEnabled,
      inputJson,
      inputSchemaJson: normalizedInputSchemaJson,
      inputSchemaAuto,
      inputExamples,
      externalDeps: policy.externalDeps,
      metadata: {
        name: policy.name,
        description: policy.description,
        tags: policy.tags,
        version: policy.currentVersion,
        author: policy.author,
      },
      resourceKind: policy.resourceKind,
      stage: policy.stage,
      status: toGuardrailStatus(policy.status),
      enforcementType: policy.enforcementType,
      tags: policy.tags,
      baseVersion: policy.currentVersion,
    });
  };

  const handleEdit = async () => {
    if (!policy) return;
    // Belt-and-braces: the button is disabled when not on the latest, but
    // any caller-spawned path would also fall through here as a no-op.
    if (!isLatest) return;
    setIsLoadingEdit(true);
    await loadPolicyIntoStudio();
    setIsLoadingEdit(false);
    setView('create-policy');
  };

  // The "Blast Radius" button on this detail view loads the policy into
  // the studio AND raises a one-shot flag so the studio pops its blast-
  // radius drawer on mount. Reuses every working piece of the studio's
  // existing blast-radius flow — test-input fetching, dep refetch per
  // test, the execution modal — instead of routing to the broken
  // standalone /blast-radius view.
  const handleRunBlastRadius = async () => {
    if (!policy) return;
    setIsLoadingBlast(true);
    await loadPolicyIntoStudio();
    setAutoOpenBlastRadius(true);
    setIsLoadingBlast(false);
    setView('create-policy');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'code', label: 'Rego' },
    { id: 'schema', label: 'Schema' },
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
              onClick={handleEdit}
              disabled={isLoadingEdit || !isLatest}
              title={
                isLatest
                  ? 'Open this guardrail in the studio for editing'
                  : `Editing is locked — v${policy.currentVersion} is no longer the latest version (v${latestVersion} exists). Open the latest to publish further changes.`
              }
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'font-medium transition-all hover:bg-[var(--color-border-light)]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoadingEdit ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Edit
            </button>
            <button
              onClick={handleRunBlastRadius}
              disabled={isLoadingBlast}
              title="Load this guardrail into the studio and open the blast-radius runner"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-info)] text-white',
                'font-medium transition-all hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isLoadingBlast ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Radius className="w-4 h-4" />
              )}
              Run Blast Radius
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
            {!isLatest && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-warning-bg)] text-[var(--color-warning)]">
                superseded by v{latestVersion}
              </span>
            )}
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

              {/* Input flow diagram — visual story of how the guardrail
                  assembles its OPA input from document + (optional) config
                  + external dependencies, and hands it to the Rego policy. */}
              <PolicyInputDiagram
                configJson={policy.configJson}
                externalDeps={policy.externalDeps ?? []}
                onJumpToRego={() => setActiveTab('code')}
              />
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
          <ReadOnlyEditorCard
            language="rego"
            value={policy.regoCode}
            theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
            height="600px"
            label="policy.rego"
          />
        )}

        {activeTab === 'schema' && (
          policy.inputSchemaJson ? (
            <ReadOnlyEditorCard
              language="json"
              value={policy.inputSchemaJson}
              theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
              height="600px"
              label="input-schema.json"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--color-text-tertiary)] px-6">
              <FileJson className="w-10 h-10 mb-3 text-[var(--color-text-tertiary)] opacity-60" />
              <p className="text-lg font-medium text-[var(--color-text-primary)]">
                No input schema published for this version
              </p>
              <p className="mt-1 text-sm max-w-md">
                Authors publish a JSON Schema alongside the rego so adopters know
                what shape the inbound document must have. This version was
                published without one — re-publish from the studio to attach one.
              </p>
            </div>
          )
        )}

        {activeTab === 'tests' && (
          <div className="space-y-3">
            {policy.testCases.length > 0 ? (
              policy.testCases.map((test) => <TestCaseRow key={test.id} test={test} />)
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center text-[var(--color-text-tertiary)] px-6">
                <Radius className="w-10 h-10 mb-3 text-[var(--color-text-tertiary)] opacity-60" />
                <p className="text-lg font-medium text-[var(--color-text-primary)]">
                  Inline test cases aren't authored here yet
                </p>
                <p className="mt-1 text-sm max-w-md">
                  This guardrail is validated against real evaluation history via Blast Radius —
                  the runner fetches recent inputs, refetches external dependencies per test, and
                  surfaces a verdict for each.
                </p>
                <button
                  onClick={handleRunBlastRadius}
                  disabled={isLoadingBlast}
                  className={cn(
                    'mt-4 flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)]',
                    'bg-[var(--color-info)] text-white text-sm font-medium',
                    'transition-all hover:opacity-90',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {isLoadingBlast ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Radius className="w-4 h-4" />
                  )}
                  Open Blast Radius
                </button>
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
          <ReadOnlyEditorCard
            language="json"
            value={policy.configJson}
            theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
            height="400px"
            label="configuration"
          />
        )}
      </div>
    </div>
  );
}
