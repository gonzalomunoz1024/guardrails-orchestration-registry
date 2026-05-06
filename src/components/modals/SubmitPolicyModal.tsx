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
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import yaml from 'js-yaml';
import { Octokit } from 'octokit';
import { cn } from '@/utils';
import { useAuthStore } from '@/store/authStore';
import { useResourceTypeConfig } from '@/hooks/useResourceTypeConfig';
import { ComingSoonBanner } from '@/components/common/ComingSoonBanner';
import type { EnforcementType, GuardrailKind } from '@/types/guardrail.types';
import type { FrontendResourceType } from '@/types/registry.types';

// Shared PAT for GitHub operations (bypasses OAuth App restrictions)
const GITHUB_PAT = import.meta.env.VITE_GITHUB_PAT;

interface PolicyMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  status: string;
  enforcementType: EnforcementType;
  kind: GuardrailKind;
  resourceType: string;
  resourceKind?: string;
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
  /** Resource type for determining PR creation availability */
  resourceType: FrontendResourceType;
}

type SubmitStatus = 'idle' | 'creating' | 'success' | 'error';

interface StepLog {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export function SubmitPolicyModal({
  isOpen,
  onClose,
  policyId,
  regoCode,
  configJson,
  metadata,
  resourceType,
}: SubmitPolicyModalProps) {
  const { user } = useAuthStore();
  const { config, prCreationEnabled, prCreationDisabledMessage } = useResourceTypeConfig(resourceType);

  // Get GitHub repo config from resource type config
  const UPSTREAM_OWNER = config.prCreation.github?.owner ?? '';
  const UPSTREAM_REPO = config.prCreation.github?.repo ?? '';
  const [githubStatus, setGithubStatus] = useState<SubmitStatus>('idle');
  const [githubError, setGithubError] = useState<string | null>(null);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [copiedPrUrl, setCopiedPrUrl] = useState(false);

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

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGithubStatus('idle');
      setGithubError(null);
      setStepLogs([]);
      setPrUrl(null);
      setCopiedPrUrl(false);
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

  // Generate YAML content for metadata
  const generateMetadataYaml = (): string => {
    // Format version as major.minor only (e.g., 1.0, 1.1)
    const formatVersion = (version: string): string => {
      const parts = version.split('.');
      if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
      }
      return version;
    };

    const now = new Date().toISOString();

    const metadataObj = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      version: formatVersion(metadata.version),
      status: metadata.status,
      enforcementType: metadata.enforcementType,
      kind: metadata.kind,
      resourceType: metadata.resourceType,
      ...(metadata.resourceKind && { resourceKind: metadata.resourceKind }),
      owner: user?.name || user?.login || metadata.owner,
      tags: metadata.tags,
      createdAt: now,
      updatedAt: now,
    };
    return yaml.dump(metadataObj, { indent: 2, lineWidth: -1 });
  };

  // Generate YAML content for configuration
  const generateConfigYaml = (): string => {
    const config = getConfigObject();
    return yaml.dump(config, { indent: 2, lineWidth: -1 });
  };

  // Download as ZIP
  const handleDownloadZip = async () => {
    const zip = new JSZip();

    // Create folder structure
    const regoFolder = zip.folder('rego');
    const guardrailsFolder = zip.folder('guardrails');
    const configurationsFolder = zip.folder('configurations');

    // Add files
    regoFolder?.file(`${policyId}.rego`, regoCode);
    guardrailsFolder?.file(`${policyId}.yaml`, generateMetadataYaml());
    configurationsFolder?.file(`${policyId}.yaml`, generateConfigYaml());

    // Generate and download
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${policyId}-policy.zip`);
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
    const branchName = `feature/policy-${policyId}-${Date.now()}`;
    let defaultBranch = 'main';
    let baseSha = '';

    // Step 1: Get repo info (default branch)
    updateStep('Get repository info', 'running');
    try {
      const { data: repo } = await octokit.rest.repos.get({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
      });
      defaultBranch = repo.default_branch;
      updateStep('Get repository info', 'success', `Default branch: ${defaultBranch}`);
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

    // Step 3: Create blobs for all files
    updateStep('Create file blobs', 'running');
    let regoBlob: string, guardrailBlob: string, configBlob: string;
    try {
      const [regoBlobRes, guardrailBlobRes, configBlobRes] = await Promise.all([
        octokit.rest.git.createBlob({
          owner: UPSTREAM_OWNER,
          repo: UPSTREAM_REPO,
          content: btoa(unescape(encodeURIComponent(regoCode))),
          encoding: 'base64',
        }),
        octokit.rest.git.createBlob({
          owner: UPSTREAM_OWNER,
          repo: UPSTREAM_REPO,
          content: btoa(unescape(encodeURIComponent(generateMetadataYaml()))),
          encoding: 'base64',
        }),
        octokit.rest.git.createBlob({
          owner: UPSTREAM_OWNER,
          repo: UPSTREAM_REPO,
          content: btoa(unescape(encodeURIComponent(generateConfigYaml()))),
          encoding: 'base64',
        }),
      ]);
      regoBlob = regoBlobRes.data.sha;
      guardrailBlob = guardrailBlobRes.data.sha;
      configBlob = configBlobRes.data.sha;
      updateStep('Create file blobs', 'success', '3 blobs created');
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
        tree: [
          {
            path: `rego/${policyId}.rego`,
            mode: '100644',
            type: 'blob',
            sha: regoBlob,
          },
          {
            path: `guardrails/${policyId}.yaml`,
            mode: '100644',
            type: 'blob',
            sha: guardrailBlob,
          },
          {
            path: `configurations/${policyId}.yaml`,
            mode: '100644',
            type: 'blob',
            sha: configBlob,
          },
        ],
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
        message: `Add policy: ${policyId}\n\nSubmitted by: @${user.login}\n\nFiles added:\n- rego/${policyId}.rego\n- guardrails/${policyId}.yaml\n- configurations/${policyId}.yaml`,
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
      const prBody = `## New Policy: ${metadata.name}

${metadata.description}

### Submitted By
**@${user.login}** via OPA Policy Registry

### Files Added
- \`rego/${policyId}.rego\` - Rego policy code
- \`guardrails/${policyId}.yaml\` - Guardrail metadata
- \`configurations/${policyId}.yaml\` - Policy configuration

### Policy Details
| Field | Value |
|-------|-------|
| **ID** | \`${policyId}\` |
| **Name** | ${metadata.name} |
| **Version** | ${metadata.version} |
| **Status** | ${metadata.status} |
| **Enforcement** | ${metadata.enforcementType} |
| **Kind** | ${metadata.kind} |
| **Resource Type** | ${metadata.resourceType} |
${metadata.resourceKind ? `| **Resource Kind** | ${metadata.resourceKind} |` : ''}
| **Tags** | ${metadata.tags.length > 0 ? metadata.tags.join(', ') : 'None'} |

---
*Submitted by @${user.login} via OPA Policy Registry*`;

      const { data: pr } = await octokit.rest.pulls.create({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        title: `[Policy] Add ${metadata.name} (by @${user.login})`,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-2xl',
          'rounded-2xl overflow-hidden',
          'bg-[var(--color-surface)] shadow-2xl',
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
                Submit Policy
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {metadata.name} ({policyId})
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
        <div className="p-6 space-y-6">
          {/* File Preview */}
          <div className="rounded-xl bg-[var(--color-surface-secondary)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <FolderTree className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Files to be created
              </span>
            </div>
            <div className="space-y-1 font-mono text-sm text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-info)]">rego/</span>
                <span>{policyId}.rego</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-success)]">guardrails/</span>
                <span>{policyId}.yaml</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-warning)]">configurations/</span>
                <span>{policyId}.yaml</span>
              </div>
            </div>
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
                    {policyId}-policy.zip
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
  );
}
