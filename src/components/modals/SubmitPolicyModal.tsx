import { useState, useEffect } from 'react';
import {
  X,
  GitBranch,
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

const GITHUB_REPO_OWNER = 'my_org';
const GITHUB_REPO_NAME = 'my_repo';

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

  // Create GitHub PR
  const handleCreatePR = async () => {
    if (!accessToken) {
      setGithubError('Not authenticated. Please log in with GitHub first.');
      setGithubStatus('error');
      return;
    }

    setGithubStatus('creating');
    setGithubError(null);

    try {
      const octokit = new Octokit({ auth: accessToken });
      const branchName = `policy/${policyId}-${Date.now()}`;

      // Get the default branch SHA
      const { data: repo } = await octokit.rest.repos.get({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
      });

      const defaultBranch = repo.default_branch;

      const { data: ref } = await octokit.rest.git.getRef({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        ref: `heads/${defaultBranch}`,
      });

      const baseSha = ref.object.sha;

      // Create a new branch
      await octokit.rest.git.createRef({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      });

      // Create the rego policy file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        path: `rego/${policyId}.rego`,
        message: `Add rego policy: ${policyId}`,
        content: btoa(regoCode),
        branch: branchName,
      });

      // Create the guardrail metadata file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        path: `guardrails/${policyId}.yaml`,
        message: `Add guardrail metadata: ${policyId}`,
        content: btoa(generateMetadataYaml()),
        branch: branchName,
      });

      // Create the configuration file
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        path: `configurations/${policyId}.yaml`,
        message: `Add configuration for: ${policyId}`,
        content: btoa(generateConfigYaml()),
        branch: branchName,
      });

      // Create the Pull Request
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
| **Owner** | @${user?.login || metadata.owner} |
| **Tags** | ${metadata.tags.length > 0 ? metadata.tags.join(', ') : 'None'} |

---
*Created via OPA Policy Registry by @${user?.login}*`;

      const { data: pr } = await octokit.rest.pulls.create({
        owner: GITHUB_REPO_OWNER,
        repo: GITHUB_REPO_NAME,
        title: `[Policy] Add ${metadata.name}`,
        body: prBody,
        head: branchName,
        base: defaultBranch,
      });

      setPrUrl(pr.html_url);
      setGithubStatus('success');
    } catch (error) {
      console.error('Failed to create PR:', error);
      setGithubError(error instanceof Error ? error.message : 'Failed to create pull request');
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
                      {GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}
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
                      <GitBranch className="w-4 h-4" />
                      Create Pull Request
                    </>
                  )}
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
