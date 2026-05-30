import { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
  GitFork,
  Download,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  FolderTree,
  Copy,
  Check,
  Shield,
  User as UserIcon,
  Tag,
  Hash,
  FileCode2,
  FileJson,
  Boxes,
  Eye,
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Octokit } from 'octokit';
import Editor from '@monaco-editor/react';
import { cn, toGuardrailYaml, toGuardrailConfigurationYaml } from '@/utils';
import { useAuthStore } from '@/store/authStore';
import { usePolicyStore, useUIStore } from '@/store';
import { defaultEditorOptions } from '@/monaco/config';
import { useGuardrailConfig } from '@/hooks/useGuardrailConfig';
import { ComingSoonBanner } from '@/components/common/ComingSoonBanner';
import type { EnforcementType, Stage, ResourceKind, GuardrailStatus } from '@/types/guardrail.types';
import { STAGE_LABELS, ENFORCEMENT_LABELS, RESOURCE_KIND_LABELS } from '@/types';

// Shared PAT for GitHub operations (bypasses OAuth App restrictions)
const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT;

interface PolicyMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  stage: Stage;
  resourceKind: ResourceKind;
  owner: string;
  tags: string[];
}

interface SubmitPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyId: string;
  regoCode: string;
  configJson: string;
  metadata: PolicyMetadata;
}

type SubmitStatus = 'idle' | 'creating' | 'success' | 'error';

interface StepLog {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

/** Compact icon + label + value row for the Guardrail Details card. */
function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="flex items-center gap-1.5 text-[var(--color-text-tertiary)] uppercase tracking-wider text-[10px] font-medium">
        <Icon className="w-3 h-3" />
        {label}
      </dt>
      <dd className={cn('min-w-0 text-[var(--color-text-primary)]', mono && 'font-mono text-[12px]')}>
        {value}
      </dd>
    </>
  );
}

/** Resolve a file icon from its extension; falls back to a generic doc icon. */
function FileIcon({ path }: { path: string }) {
  if (path.endsWith('.rego'))
    return <FileCode2 className="w-3.5 h-3.5 text-[var(--color-info)]" />;
  if (path.endsWith('.yaml') || path.endsWith('.yml'))
    return <Boxes className="w-3.5 h-3.5 text-[var(--color-warning)]" />;
  if (path.endsWith('.json'))
    return <FileJson className="w-3.5 h-3.5 text-[var(--color-success)]" />;
  return <FileText className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />;
}

/** Compact "1.2 KB" / "412 B" formatter for the file-size hint. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Pick a Monaco language id from a path's extension. */
function languageForPath(path: string): string {
  if (path.endsWith('.rego')) return 'rego';
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.json')) return 'json';
  return 'plaintext';
}

export function SubmitPolicyModal({
  isOpen,
  onClose,
  policyId,
  regoCode,
  configJson,
  metadata,
}: SubmitPolicyModalProps) {
  const { user } = useAuthStore();
  const {
    externalDeps,
    configEnabled,
    inputSchemaJson,
    inputExamples,
    baseVersion,
  } = usePolicyStore();
  const { resolvedTheme } = useUIStore();
  // Metadata-only publishes (no contract change) target the existing version
  // dir and only rewrite guardrail.yaml + configuration.yaml. The pre-flight
  // immutability check is inverted: it expects the dir to already exist.
  const metadataOnly = baseVersion !== null && metadata.version === baseVersion;
  const { config, prCreationEnabled, prCreationDisabledMessage } = useGuardrailConfig();

  // Global GitHub publish target.
  const UPSTREAM_OWNER = config.github.owner;
  const UPSTREAM_REPO = config.github.repo;
  const TARGET_BRANCH = config.github.defaultBranch ?? 'main';
  const [githubStatus, setGithubStatus] = useState<SubmitStatus>('idle');
  const [githubError, setGithubError] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [copiedPrUrl, setCopiedPrUrl] = useState(false);
  // Path of the artifact file currently being previewed in the side sub-modal.
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Helper to update step log
  const updateStep = (step: string, status: StepLog['status'], message?: string) => {
    setStepLogs(prev => {
      const existing = prev.findIndex(s => s.step === step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { step, status, message };
        return updated;
      }
      return [...prev, { step, status, message }];
    });
  };

  // Handle escape key — closes the preview overlay first if it's open, then
  // (on a second press, or when no preview is open) closes the Submit modal.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewPath) setPreviewPath(null);
      else onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, previewPath]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGithubStatus('idle');
      setGithubError(null);
      setStepLogs([]);
      setPrUrl(null);
      setCopiedPrUrl(false);
      setPreviewPath(null);
    }
  }, [isOpen]);

  // Parse configuration JSON
  const getConfigObject = (): Record<string, unknown> => {
    try {
      return JSON.parse(configJson || '{}');
    } catch {
      return {};
    }
  };

  // Generate the kube-like Guardrail manifest (guardrails/<id>.yaml). This is the
  // registration spec the backend reads to assemble the OPA input at enforcement
  // time (config lookup + external dependency fetches). See docs/guardrail-manifest.md.
  // Immutable, versioned artifact directory: guardrails/<id>/<version>/...
  const versionDir = `guardrails/${policyId}/${metadata.version}`;

  const slugExample = (name: string, i: number): string =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `example-${i + 1}`;

  // Example payloads to publish under examples/.
  const exampleArtifacts = inputExamples
    .filter((e) => e.payload.trim())
    .map((e, i) => ({ file: `examples/${slugExample(e.name, i)}.json`, payload: e.payload }));

  const generateManifestYaml = (): string =>
    toGuardrailYaml({
      metadata: {
        name: metadata.name,
        description: metadata.description,
        tags: metadata.tags,
        version: metadata.version,
        author: user?.name || user?.login || metadata.owner,
      },
      resourceKind: metadata.resourceKind,
      enforcementType: metadata.enforcementType,
      stage: metadata.stage,
      status: metadata.status,
      tags: metadata.tags,
      configEnabled,
      externalDeps,
      policyFile: 'policy.rego',
      configFile: 'configuration.yaml',
      inputSchema: { file: 'input-schema.json', examples: exampleArtifacts.map((e) => e.file) },
    });

  // Generate the kube-like GuardrailConfiguration (configuration.yaml).
  const generateConfigYaml = (): string =>
    toGuardrailConfigurationYaml({ name: metadata.name, data: getConfigObject() });

  /**
   * The set of files published for this guardrail version.
   *   - Contract change (or brand-new guardrail): full snapshot (policy.rego,
   *     guardrail.yaml, input-schema.json, configuration.yaml, examples/*).
   *   - Metadata-only update: only guardrail.yaml + configuration.yaml. The
   *     contract files in the existing dir are untouched, preserving the
   *     immutability suites pinned against.
   */
  const buildArtifactFiles = (): { path: string; content: string }[] => {
    if (metadataOnly) {
      const files: { path: string; content: string }[] = [
        { path: `${versionDir}/guardrail.yaml`, content: generateManifestYaml() },
      ];
      if (configEnabled) {
        files.push({ path: `${versionDir}/configuration.yaml`, content: generateConfigYaml() });
      }
      return files;
    }
    const files: { path: string; content: string }[] = [
      { path: `${versionDir}/policy.rego`, content: regoCode },
      { path: `${versionDir}/guardrail.yaml`, content: generateManifestYaml() },
      { path: `${versionDir}/input-schema.json`, content: inputSchemaJson || '{}' },
    ];
    if (configEnabled) {
      files.push({ path: `${versionDir}/configuration.yaml`, content: generateConfigYaml() });
    }
    for (const ex of exampleArtifacts) {
      files.push({ path: `${versionDir}/${ex.file}`, content: ex.payload });
    }
    return files;
  };

  // Download as ZIP (mirrors the published versioned layout)
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    for (const f of buildArtifactFiles()) {
      zip.file(f.path, f.content);
    }
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${policyId}-${metadata.version}.zip`);
  };

  // Create GitHub PR using shared PAT (bypasses OAuth App restrictions)
  // User OAuth is still used for identity/attribution in the PR
  const handleCreatePR = async () => {
    // Check if user is logged in (for attribution)
    if (!user) {
      setGithubError('Not authenticated. Please log in with GitHub first.');
      setGithubStatus('error');
      return;
    }

    // Check if PAT is configured
    if (!GITHUB_PAT) {
      setGithubError('GitHub PAT not configured. Please set VITE_GITHUB_PAT environment variable.');
      setGithubStatus('error');
      return;
    }

    setGithubStatus('creating');
    setGithubError(null);
    setStepLogs([]);

    // Use shared PAT for all GitHub operations
    const octokit = new Octokit({ auth: GITHUB_PAT });
    const branchPrefix = metadataOnly ? 'metadata' : 'policy';
    const branchName = `feature/${branchPrefix}-${policyId}-${Date.now()}`;
    const defaultBranch = TARGET_BRANCH;
    let baseSha = '';

    // Step 1: Verify repo + target branch exist
    updateStep('Get repository info', 'running');
    try {
      await octokit.rest.repos.get({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
      });
      updateStep('Get repository info', 'success', `Target branch: ${defaultBranch}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Get repository info', 'error', msg);
      setGithubError(`Failed to get repo info: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 2: Get latest commit SHA
    updateStep('Get latest commit', 'running');
    try {
      const { data: ref } = await octokit.rest.git.getRef({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        ref: `heads/${defaultBranch}`,
      });
      baseSha = ref.object.sha;
      updateStep('Get latest commit', 'success', `SHA: ${baseSha.substring(0, 7)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Get latest commit', 'error', msg);
      setGithubError(`Failed to get commit SHA: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 2b: Version dir check.
    //   - Contract change / new guardrail: dir must NOT exist (immutability).
    //   - Metadata-only update: dir SHOULD exist; we're rewriting just the
    //     mutable artifacts (guardrail.yaml + configuration.yaml) and leaving
    //     policy.rego, input-schema.json, examples/* in place.
    const stepLabel = metadataOnly ? 'Check version exists' : 'Check version is new';
    updateStep(stepLabel, 'running', versionDir);
    try {
      await octokit.rest.repos.getContent({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        path: versionDir,
        ref: defaultBranch,
      });
      if (metadataOnly) {
        updateStep(stepLabel, 'success', `${metadata.version} exists — updating metadata`);
      } else {
        // Contract changed but the target dir already has artifacts — refuse to overwrite.
        updateStep(stepLabel, 'error', 'Version already exists');
        setGithubError(
          `Version ${metadata.version} of "${policyId}" already exists and is immutable. ` +
            `Bump the version (updates increment the minor version) before publishing.`
        );
        setGithubStatus('error');
        return;
      }
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status !== 404) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        updateStep(stepLabel, 'error', msg);
        setGithubError(`Failed to verify version: ${msg}`);
        setGithubStatus('error');
        return;
      }
      if (metadataOnly) {
        // 404 here is unexpected — a metadata-only update needs an existing dir
        // to overlay. Bail out clearly so the user knows what happened.
        updateStep(stepLabel, 'error', `${metadata.version} not published yet`);
        setGithubError(
          `Cannot apply a metadata-only update: version ${metadata.version} of "${policyId}" ` +
            `has not been published yet. Make a contract change to publish a new version.`
        );
        setGithubStatus('error');
        return;
      }
      // 404 = path does not exist → safe to publish this brand-new contract.
      updateStep(stepLabel, 'success', `${metadata.version} is new`);
    }

    // Step 3: Create blobs for all artifact files
    updateStep('Create file blobs', 'running');
    const artifactFiles = buildArtifactFiles();
    let treeEntries: { path: string; mode: '100644'; type: 'blob'; sha: string }[];
    try {
      const createBlob = (content: string) =>
        octokit.rest.git.createBlob({
          owner: UPSTREAM_OWNER,
          repo: UPSTREAM_REPO,
          content: btoa(unescape(encodeURIComponent(content))),
          encoding: 'base64',
        });

      const blobResults = await Promise.all(artifactFiles.map((f) => createBlob(f.content)));
      treeEntries = artifactFiles.map((f, i) => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        sha: blobResults[i].data.sha,
      }));
      updateStep('Create file blobs', 'success', `${blobResults.length} blobs created`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Create file blobs', 'error', msg);
      setGithubError(`Failed to create blobs: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 4: Get base tree
    updateStep('Get base tree', 'running');
    let baseTreeSha: string;
    try {
      const { data: commit } = await octokit.rest.git.getCommit({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        commit_sha: baseSha,
      });
      baseTreeSha = commit.tree.sha;
      updateStep('Get base tree', 'success', `Tree: ${baseTreeSha.substring(0, 7)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Get base tree', 'error', msg);
      setGithubError(`Failed to get base tree: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 5: Create new tree with all files
    updateStep('Create tree', 'running');
    let newTreeSha: string;
    try {
      const { data: newTree } = await octokit.rest.git.createTree({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        base_tree: baseTreeSha,
        tree: treeEntries,
      });
      newTreeSha = newTree.sha;
      updateStep('Create tree', 'success', `Tree: ${newTreeSha.substring(0, 7)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Create tree', 'error', msg);
      setGithubError(`Failed to create tree: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 6: Create commit
    updateStep('Create commit', 'running');
    let newCommitSha: string;
    try {
      const { data: newCommit } = await octokit.rest.git.createCommit({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        message:
          (metadataOnly
            ? `Update metadata for guardrail ${policyId}@${metadata.version}`
            : `Add guardrail ${policyId}@${metadata.version}`) +
          `\n\nSubmitted by: @${user.login}\n\n` +
          (metadataOnly ? 'Files updated:\n' : 'Files added:\n') +
          artifactFiles.map((f) => `- ${f.path}`).join('\n'),
        tree: newTreeSha,
        parents: [baseSha],
      });
      newCommitSha = newCommit.sha;
      updateStep('Create commit', 'success', `Commit: ${newCommitSha.substring(0, 7)}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Create commit', 'error', msg);
      setGithubError(`Failed to create commit: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 7: Create branch pointing to commit
    updateStep('Create branch', 'running', branchName);
    try {
      await octokit.rest.git.createRef({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        ref: `refs/heads/${branchName}`,
        sha: newCommitSha,
      });
      updateStep('Create branch', 'success', branchName);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Create branch', 'error', msg);
      setGithubError(`Failed to create branch: ${msg}`);
      setGithubStatus('error');
      return;
    }

    // Step 8: Create Pull Request
    updateStep('Create Pull Request', 'running');
    try {
      const prHeading = metadataOnly
        ? `## Metadata update: ${metadata.name} @ ${metadata.version}`
        : `## New Policy: ${metadata.name}`;
      const prFilesHeading = metadataOnly ? 'Files Updated' : 'Files Added';
      const prScopeLine = metadataOnly
        ? `Metadata-only update — the contract (policy.rego, input-schema.json, examples/) is unchanged at v${metadata.version}.`
        : '';
      const prBody = `${prHeading}

${metadata.description}

${prScopeLine ? prScopeLine + '\n\n' : ''}### Submitted By
**@${user.login}** via OPA Guardrail Registry

### ${prFilesHeading}
${artifactFiles.map((f) => `- \`${f.path}\``).join('\n')}

### Guardrail Details
| Field | Value |
|-------|-------|
| **ID** | \`${policyId}\` |
| **Name** | ${metadata.name} |
| **Version** | ${metadata.version} |
| **Status** | ${metadata.status} |
| **Enforcement** | ${metadata.enforcementType} |
| **Stage** | ${metadata.stage} |
| **Resource Kind** | ${metadata.resourceKind} |
| **Tags** | ${metadata.tags.length > 0 ? metadata.tags.join(', ') : 'None'} |

---
*Submitted by @${user.login} via OPA Guardrail Registry*`;

      const prTitle = metadataOnly
        ? `[Policy] Update ${metadata.name} metadata @ ${metadata.version} (by @${user.login})`
        : `[Policy] Add ${metadata.name} (by @${user.login})`;
      const { data: pr } = await octokit.rest.pulls.create({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        title: prTitle,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      updateStep('Create Pull Request', 'success', `PR #${pr.number}`);
      setPrUrl(pr.html_url);
      setGithubStatus('success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      updateStep('Create Pull Request', 'error', msg);
      setGithubError(`Failed to create PR: ${msg}`);
      setGithubStatus('error');
    }
  };

  const handleCopyPrUrl = async () => {
    if (prUrl) {
      await navigator.clipboard.writeText(prUrl);
      setCopiedPrUrl(true);
      setTimeout(() => setCopiedPrUrl(false), 2000);
    }
  };

  if (!isOpen) return null;

  // The artifact whose contents the side preview is showing (if any).
  const previewFile = previewPath
    ? buildArtifactFiles().find((f) => f.path === previewPath) ?? null
    : null;

  const handleCopyPreview = async () => {
    if (!previewFile) return;
    await navigator.clipboard.writeText(previewFile.content);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-4xl max-h-[92vh] flex flex-col',
          'rounded-2xl overflow-hidden',
          'bg-[var(--color-surface)] shadow-2xl border border-[var(--color-border-light)]',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[var(--color-success)] to-[var(--color-info)]">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {metadataOnly ? 'Update Metadata' : 'Submit Guardrail'}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {metadata.name} ({policyId})
                {metadataOnly && (
                  <span className="ml-2 text-[var(--color-info)]">
                    · v{metadata.version} contract unchanged
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* Details + Files (two-column on lg+) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Guardrail Details */}
            <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
              <header className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60">
                <Shield className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Guardrail Details
                </h3>
              </header>
              <div className="p-5 space-y-4">
                {/* Name + Description */}
                <div>
                  <h4 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                    {metadata.name || 'Untitled guardrail'}
                  </h4>
                  {metadata.description && (
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] line-clamp-3">
                      {metadata.description}
                    </p>
                  )}
                </div>

                {/* Status chips row */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold',
                    metadata.status === 'ACTIVE'   && 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
                    metadata.status === 'DRAFT'    && 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
                    metadata.status === 'INACTIVE' && 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
                  )}>
                    {metadata.status.charAt(0) + metadata.status.slice(1).toLowerCase()}
                  </span>
                  <span className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold bg-[var(--color-info-bg)] text-[var(--color-info)]">
                    {STAGE_LABELS[metadata.stage]}
                  </span>
                  <span className={cn(
                    'px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold',
                    metadata.enforcementType === 'MANDATORY' && 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
                    metadata.enforcementType === 'WARNING'   && 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
                    metadata.enforcementType === 'OPTIONAL'  && 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
                  )}>
                    {ENFORCEMENT_LABELS[metadata.enforcementType]}
                  </span>
                  <span className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-semibold bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                    {RESOURCE_KIND_LABELS[metadata.resourceKind]}
                  </span>
                </div>

                {/* Identity rows */}
                <dl className="grid grid-cols-[6.5rem_1fr] gap-y-2 text-xs">
                  <DetailRow icon={Hash} label="ID" value={policyId} mono />
                  <DetailRow icon={GitBranch} label="Version" value={metadata.version} mono />
                  <DetailRow icon={UserIcon} label="Owner" value={metadata.owner || user?.login || '—'} />
                  <DetailRow
                    icon={Tag}
                    label="Tags"
                    value={
                      metadata.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {metadata.tags.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded-full text-[11px] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[var(--color-text-tertiary)]">None</span>
                      )
                    }
                  />
                </dl>

                <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">
                  Updating a published guardrail bumps the minor version; <code className="font-mono">(id, version)</code> is immutable.
                </p>
              </div>
            </section>

            {/* Files to be created */}
            <section className="rounded-2xl border border-[var(--color-border-light)] bg-[var(--color-surface)] overflow-hidden">
              <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Files to be created
                  </h3>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]">
                  {buildArtifactFiles().length} files
                </span>
              </header>
              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] font-mono">
                  <FolderTree className="w-3.5 h-3.5" />
                  {versionDir}/
                </div>
                <ul className="mt-2 space-y-1">
                  {buildArtifactFiles().map((f, i, arr) => {
                    const rel = f.path.slice(versionDir.length + 1);
                    const last = i === arr.length - 1;
                    return (
                      <li key={f.path}>
                        <button
                          type="button"
                          onClick={() => setPreviewPath(f.path)}
                          title={`Preview ${rel}`}
                          className={cn(
                            'group w-full flex items-center gap-2 px-1.5 py-1 rounded-[var(--radius-sm)]',
                            'font-mono text-sm text-[var(--color-text-secondary)] text-left',
                            'hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] transition-colors'
                          )}
                        >
                          <span className="text-[var(--color-text-tertiary)] w-3">{last ? '└' : '├'}</span>
                          <FileIcon path={rel} />
                          <span className="truncate flex-1">{rel}</span>
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {formatBytes(new Blob([f.content]).size)}
                          </span>
                          <Eye className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] opacity-60 group-hover:opacity-100 group-hover:text-[var(--color-info)] transition-all" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
                  Click any file to preview the exact contents that will be published / downloaded.
                </p>
              </div>
            </section>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GitHub PR Card */}
            <div
              className={cn(
                'rounded-xl border-2 p-5 transition-all',
                !prCreationEnabled
                  ? 'border-[var(--color-border-light)] bg-[var(--color-surface)]'
                  : githubStatus === 'success'
                    ? 'border-[var(--color-success)] bg-[var(--color-success-bg)]'
                    : githubStatus === 'error'
                      ? 'border-[var(--color-error)] bg-[var(--color-error-bg)]'
                      : 'border-[var(--color-border-light)] bg-[var(--color-surface)]'
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2.5 rounded-xl',
                      !prCreationEnabled
                        ? 'bg-[var(--color-text-tertiary)]'
                        : githubStatus === 'success'
                          ? 'bg-[var(--color-success)]'
                          : 'bg-[#24292f]'
                    )}
                  >
                    {githubStatus === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <GitBranch className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-primary)]">
                      Publish to GitHub
                    </h3>
                    {prCreationEnabled && UPSTREAM_OWNER && UPSTREAM_REPO && (
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {UPSTREAM_OWNER}/{UPSTREAM_REPO}
                      </p>
                    )}
                  </div>
                </div>
                {prCreationEnabled && user && (
                  <div className="flex items-center gap-2">
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {user.login}
                    </span>
                  </div>
                )}
              </div>

              {/* Show Coming Soon banner if PR creation is disabled */}
              {!prCreationEnabled ? (
                <ComingSoonBanner
                  message={prCreationDisabledMessage || 'GitHub PR creation is not available for this resource type.'}
                />
              ) : githubStatus === 'success' && prUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
                    <CheckCircle className="w-4 h-4" />
                    <span>Pull request created!</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                        'bg-[var(--color-info)] text-white font-medium text-sm',
                        'hover:opacity-90 transition-all'
                      )}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View PR
                    </a>
                    <button
                      onClick={handleCopyPrUrl}
                      className={cn(
                        'p-2.5 rounded-lg border transition-all',
                        copiedPrUrl
                          ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
                          : 'border-[var(--color-border-light)] hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]'
                      )}
                      title="Copy PR URL"
                    >
                      {copiedPrUrl ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ) : githubStatus === 'error' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-[var(--color-error)]">
                    <AlertCircle className="w-4 h-4" />
                    <span className="break-all">{githubError || 'Failed to create PR'}</span>
                  </div>
                  {/* Step logs for debugging */}
                  {stepLogs.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border-light)] max-h-48 overflow-y-auto">
                      <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Step Details:</p>
                      <div className="space-y-1.5">
                        {stepLogs.map((log, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {log.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />}
                            {log.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />}
                            {log.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-[var(--color-info)] animate-spin flex-shrink-0 mt-0.5" />}
                            {log.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-[var(--color-border)] flex-shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <span className={cn(
                                'font-medium',
                                log.status === 'success' && 'text-[var(--color-success)]',
                                log.status === 'error' && 'text-[var(--color-error)]',
                                log.status === 'running' && 'text-[var(--color-info)]',
                                log.status === 'pending' && 'text-[var(--color-text-tertiary)]'
                              )}>
                                {log.step}
                              </span>
                              {log.message && (
                                <p className="text-[var(--color-text-tertiary)] break-all">{log.message}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleCreatePR}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                      'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                      'font-medium text-sm border border-[var(--color-border-light)]',
                      'hover:bg-[var(--color-border-light)] transition-all'
                    )}
                  >
                    Try Again
                  </button>
                </div>
              ) : githubStatus === 'creating' ? (
                <div className="space-y-3">
                  {/* Step logs during creation */}
                  <div className="p-3 rounded-lg bg-[var(--color-surface-secondary)] max-h-48 overflow-y-auto">
                    <div className="space-y-1.5">
                      {stepLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          {log.status === 'success' && <CheckCircle className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0 mt-0.5" />}
                          {log.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />}
                          {log.status === 'running' && <Loader2 className="w-3.5 h-3.5 text-[var(--color-info)] animate-spin flex-shrink-0 mt-0.5" />}
                          {log.status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-[var(--color-border)] flex-shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <span className={cn(
                              'font-medium',
                              log.status === 'success' && 'text-[var(--color-success)]',
                              log.status === 'error' && 'text-[var(--color-error)]',
                              log.status === 'running' && 'text-[var(--color-info)]',
                              log.status === 'pending' && 'text-[var(--color-text-tertiary)]'
                            )}>
                              {log.step}
                            </span>
                            {log.message && (
                              <p className="text-[var(--color-text-tertiary)] break-all">{log.message}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {stepLogs.length === 0 && (
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Initializing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCreatePR}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                    'bg-[#24292f] text-white font-medium text-sm',
                    'hover:bg-[#32383f] transition-all'
                  )}
                >
                  <GitFork className="w-4 h-4" />
                  Create Pull Request
                </button>
              )}
            </div>

            {/* Download ZIP Card */}
            <div className="rounded-xl border-2 border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-[var(--color-info)]">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">
                    Download ZIP
                  </h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {policyId}-guardrail.zip
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownloadZip}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                  'bg-[var(--color-info)] text-white font-medium text-sm',
                  'hover:opacity-90 transition-all'
                )}
              >
                <Download className="w-4 h-4" />
                Download Files
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--color-text-tertiary)]">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] font-mono">Esc</kbd> to close
            </span>
            <button
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-surface-secondary)] transition-all'
              )}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* File preview overlay — sits above the Submit modal so the user can
        eyeball each artifact's exact content before publishing. */}
    {previewFile && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewPath(null)}
        />
        <div
          className={cn(
            'relative w-full max-w-3xl max-h-[88vh] flex flex-col',
            'rounded-2xl overflow-hidden',
            'bg-[var(--color-surface)] shadow-2xl border border-[var(--color-border-light)]',
            'animate-in fade-in zoom-in-95 duration-200'
          )}
        >
          {/* Preview header */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--color-border-light)]">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon path={previewFile.path} />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                  {previewFile.path.slice(versionDir.length + 1)}
                </h3>
                <p className="text-[11px] text-[var(--color-text-tertiary)] font-mono truncate">
                  {previewFile.path}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-[var(--color-text-tertiary)] mr-1">
                {formatBytes(new Blob([previewFile.content]).size)}
              </span>
              <button
                onClick={handleCopyPreview}
                title="Copy contents"
                className={cn(
                  'p-2 rounded-[var(--radius-md)] transition-all border',
                  copiedPreview
                    ? 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
                    : 'border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
                )}
              >
                {copiedPreview ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setPreviewPath(null)}
                title="Close preview"
                className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Preview body */}
          <div className="flex-1 min-h-0 p-4">
            <div className="h-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)]">
              <Editor
                height="100%"
                language={languageForPath(previewFile.path)}
                theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
                value={previewFile.content}
                options={{
                  ...defaultEditorOptions,
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  lineNumbers: 'on',
                  fontSize: 13,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
