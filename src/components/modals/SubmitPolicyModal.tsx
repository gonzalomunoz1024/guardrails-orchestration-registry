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
import type { EnforcementType, GuardrailKind } from '@/types/guardrail.types';

// Upstream repository (the org repo where PRs will be merged)
const UPSTREAM_OWNER = 'wftgitsas-CHIEF-TECH-OFC';
const UPSTREAM_REPO = 'App-claut-schema-registry';

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
}

type SubmitStatus = 'idle' | 'creating' | 'success' | 'error';

export function SubmitPolicyModal({
  isOpen,
  onClose,
  policyId,
  regoCode,
  configJson,
  metadata,
}: SubmitPolicyModalProps) {
  const { accessToken, user } = useAuthStore();
  const [githubStatus, setGithubStatus] = useState<SubmitStatus>('idle');
  const [githubError, setGithubError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [copiedPrUrl, setCopiedPrUrl] = useState(false);

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
      setProgressMessage('');
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
    const metadataObj = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      status: metadata.status,
      enforcementType: metadata.enforcementType,
      kind: metadata.kind,
      resourceType: metadata.resourceType,
      ...(metadata.resourceKind && { resourceKind: metadata.resourceKind }),
      owner: metadata.owner,
      tags: metadata.tags,
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

  // Helper: Wait for fork to be ready (GitHub creates forks asynchronously)
  const waitForFork = async (octokit: Octokit, owner: string, repo: string, maxAttempts = 30): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const { data } = await octokit.rest.repos.get({ owner, repo });
        // Fork is ready when it's not empty (has commits)
        if (data.size > 0 || data.pushed_at) {
          return true;
        }
      } catch {
        // Fork not ready yet
      }
      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      setProgressMessage(`Waiting for fork to be ready... (${i + 1}/${maxAttempts})`);
    }
    return false;
  };

  // Helper: Get or create fork
  const getOrCreateFork = async (octokit: Octokit, userLogin: string): Promise<{ owner: string; repo: string }> => {
    // Check if user already has a fork
    try {
      setProgressMessage('Checking for existing fork...');
      const { data: fork } = await octokit.rest.repos.get({
        owner: userLogin,
        repo: UPSTREAM_REPO,
      });

      // Verify it's actually a fork of our target repo
      if (fork.fork && fork.parent?.full_name === `${UPSTREAM_OWNER}/${UPSTREAM_REPO}`) {
        setProgressMessage('Found existing fork');
        return { owner: userLogin, repo: UPSTREAM_REPO };
      }
    } catch {
      // No fork exists, will create one
    }

    // Create a new fork
    setProgressMessage('Creating fork of repository...');
    await octokit.rest.repos.createFork({
      owner: UPSTREAM_OWNER,
      repo: UPSTREAM_REPO,
    });

    // Wait for fork to be ready
    setProgressMessage('Fork created, waiting for it to be ready...');
    const isReady = await waitForFork(octokit, userLogin, UPSTREAM_REPO);

    if (!isReady) {
      throw new Error('Fork creation timed out. Please try again in a few moments.');
    }

    return { owner: userLogin, repo: UPSTREAM_REPO };
  };

  // Create GitHub PR using fork-based workflow
  // This bypasses org OAuth restrictions by writing to user's fork
  const handleCreatePR = async () => {
    if (!accessToken || !user) {
      setGithubError('Not authenticated. Please log in with GitHub first.');
      setGithubStatus('error');
      return;
    }

    setGithubStatus('creating');
    setGithubError(null);
    setProgressMessage('Initializing...');

    try {
      const octokit = new Octokit({ auth: accessToken });
      const branchName = `policy/${policyId}-${Date.now()}`;

      // Step 1: Get or create user's fork
      const fork = await getOrCreateFork(octokit, user.login);

      // Step 2: Get the default branch and latest SHA from upstream
      setProgressMessage('Getting upstream repository info...');
      const { data: upstreamRepo } = await octokit.rest.repos.get({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
      });
      const defaultBranch = upstreamRepo.default_branch;

      // Get the latest commit SHA from upstream's default branch
      const { data: upstreamRef } = await octokit.rest.git.getRef({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        ref: `heads/${defaultBranch}`,
      });
      const baseSha = upstreamRef.object.sha;

      // Step 3: Sync fork's default branch with upstream (to avoid conflicts)
      setProgressMessage('Syncing fork with upstream...');
      try {
        await octokit.rest.repos.mergeUpstream({
          owner: fork.owner,
          repo: fork.repo,
          branch: defaultBranch,
        });
      } catch {
        // May fail if already up to date, that's fine
      }

      // Step 4: Create branch in user's fork
      setProgressMessage('Creating branch in your fork...');
      await octokit.rest.git.createRef({
        owner: fork.owner,
        repo: fork.repo,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      // Step 5: Create files in user's fork
      setProgressMessage('Adding policy files...');

      // Create the rego policy file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: fork.owner,
        repo: fork.repo,
        path: `rego/${policyId}.rego`,
        message: `Add rego policy: ${policyId}`,
        content: btoa(unescape(encodeURIComponent(regoCode))), // Handle UTF-8
        branch: branchName,
      });

      // Create the guardrail metadata file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: fork.owner,
        repo: fork.repo,
        path: `guardrails/${policyId}.yaml`,
        message: `Add guardrail metadata: ${policyId}`,
        content: btoa(unescape(encodeURIComponent(generateMetadataYaml()))),
        branch: branchName,
      });

      // Create the configuration file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: fork.owner,
        repo: fork.repo,
        path: `configurations/${policyId}.yaml`,
        message: `Add configuration for: ${policyId}`,
        content: btoa(unescape(encodeURIComponent(generateConfigYaml()))),
        branch: branchName,
      });

      // Step 6: Create Pull Request from fork to upstream
      setProgressMessage('Creating pull request...');
      const prBody = `## New Policy: ${metadata.name}

${metadata.description}

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
| **Owner** | @${user.login} |
| **Tags** | ${metadata.tags.length > 0 ? metadata.tags.join(', ') : 'None'} |

---
*Created via OPA Policy Registry by @${user.login}*`;

      // Create PR from fork to upstream
      // head format: "username:branch" for cross-repo PRs
      const { data: pr } = await octokit.rest.pulls.create({
        owner: UPSTREAM_OWNER,
        repo: UPSTREAM_REPO,
        title: `[Policy] Add ${metadata.name}`,
        body: prBody,
        head: `${fork.owner}:${branchName}`,
        base: defaultBranch,
      });

      setPrUrl(pr.html_url);
      setProgressMessage('');
      setGithubStatus('success');
    } catch (error) {
      console.error('Failed to create PR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create pull request';
      setGithubError(errorMessage);
      setProgressMessage('');
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
                githubStatus === 'success'
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
                      githubStatus === 'success'
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
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {UPSTREAM_OWNER}/{UPSTREAM_REPO}
                    </p>
                  </div>
                </div>
                {user && (
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

              {githubStatus === 'success' && prUrl ? (
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
                    <span>{githubError || 'Failed to create PR'}</span>
                  </div>
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
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleCreatePR}
                    disabled={githubStatus === 'creating'}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
                      'bg-[#24292f] text-white font-medium text-sm',
                      'hover:bg-[#32383f] transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {githubStatus === 'creating' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating PR...
                      </>
                    ) : (
                      <>
                        <GitFork className="w-4 h-4" />
                        Create Pull Request
                      </>
                    )}
                  </button>
                  {githubStatus === 'creating' && progressMessage && (
                    <p className="text-xs text-center text-[var(--color-text-tertiary)]">
                      {progressMessage}
                    </p>
                  )}
                </div>
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
