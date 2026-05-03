import { X, GitPullRequest, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';
import { useCreatePR, useGitHubAuth } from '@/hooks';
import { usePolicyStore, useUIStore } from '@/store';
import { slugify } from '@/utils';

export function CreatePRModal() {
  const { isCreatePRModalOpen, setCreatePRModalOpen } = useUIStore();
  const { isAuthenticated, user, logout } = useGitHubAuth();
  const { metadata } = usePolicyStore();
  const { createPR, isCreating, error, prResult, reset } = useCreatePR();

  if (!isCreatePRModalOpen) return null;

  const handleClose = () => {
    reset();
    setCreatePRModalOpen(false);
  };

  const policySlug = slugify(metadata.name || 'policy');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg mx-4 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-fade-in">
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-info-bg)]">
              <GitPullRequest className="w-5 h-5 text-[var(--color-info)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Create Pull Request
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        <div className="p-6">
          {prResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-success-bg)]">
                <CheckCircle className="w-5 h-5 text-[var(--color-success)]" />
                <span className="text-sm font-medium text-[var(--color-success)]">
                  Pull Request created successfully!
                </span>
              </div>

              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  PR #{prResult.prNumber}
                </p>
                <a
                  href={prResult.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[var(--color-info)] hover:underline"
                >
                  View Pull Request
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
              >
                Done
              </button>
            </div>
          )}

          {error && !prResult && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)]">
              <AlertCircle className="w-5 h-5 text-[var(--color-error)]" />
              <span className="text-sm text-[var(--color-error)]">
                {error.message}
              </span>
            </div>
          )}

          {!isAuthenticated && !prResult && (
            <div className="space-y-4 text-center">
              <AlertCircle className="w-12 h-12 mx-auto text-[var(--color-warning)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                You need to be signed in to create a pull request.
                Please refresh the page to sign in.
              </p>
              <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium transition-all hover:bg-[var(--color-border-light)]"
              >
                Close
              </button>
            </div>
          )}

          {isAuthenticated && !prResult && (
            <div className="space-y-4">
              {/* Signed in user info */}
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
                <div className="flex items-center gap-3">
                  {user?.avatar_url && (
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {user?.name || user?.login}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      @{user?.login}
                    </p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Sign out
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">
                    Policy Name
                  </span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {metadata.name || 'Unnamed Policy'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">
                    Files to Create
                  </span>
                  <span className="font-mono text-xs text-[var(--color-text-primary)]">
                    2 files
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] font-mono text-xs text-[var(--color-text-secondary)]">
                <div>policies/{policySlug}.rego</div>
                <div>configuration/{policySlug}.json</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] font-medium transition-all hover:bg-[var(--color-border-light)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createPR()}
                  disabled={isCreating || !metadata.name}
                  className="flex-1 px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create PR'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
