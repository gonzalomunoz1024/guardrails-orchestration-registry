import { useQuery } from '@tanstack/react-query';
import { Octokit } from 'octokit';

export interface OpenGuardrailPR {
  number: number;
  title: string;
  url: string;
  author: string;
  /** Which submit mode the branch was created from. */
  mode: 'policy' | 'metadata';
  branch: string;
  createdAt: string;
}

interface UseOpenPRsArgs {
  owner: string;
  repo: string;
  policyId: string;
  baseBranch: string;
  enabled?: boolean;
}

/**
 * Find open PRs whose head branch was created by *this* studio for *this*
 * guardrail — i.e. branches matching `feature/{policy|metadata}-{policyId}-…`.
 * The submit modal surfaces these as a banner so authors can see their
 * in-flight submissions before they accidentally open a duplicate PR.
 *
 * Branch-prefix is the only stable identity signal — PR titles are user-
 * mutable and a diff-path filter would need an extra `pulls/{n}/files` call
 * per PR. The trade-off is that PRs created outside the studio won't be
 * detected, which is fine: the banner is a hint, not a hard gate.
 */
export function useOpenPRsForGuardrail({
  owner,
  repo,
  policyId,
  baseBranch,
  enabled = true,
}: UseOpenPRsArgs) {
  const pat = import.meta.env.VITE_GITHUB_PAT as string | undefined;
  return useQuery<OpenGuardrailPR[]>({
    queryKey: ['open-prs-for-guardrail', owner, repo, policyId, baseBranch],
    queryFn: async () => {
      const octokit = new Octokit({ auth: pat });
      const { data } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: 'open',
        base: baseBranch,
        per_page: 100,
      });
      const policyPrefix = `feature/policy-${policyId}-`;
      const metadataPrefix = `feature/metadata-${policyId}-`;
      return data
        .filter((pr) => {
          const ref = pr.head.ref;
          return ref.startsWith(policyPrefix) || ref.startsWith(metadataPrefix);
        })
        .map<OpenGuardrailPR>((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user?.login ?? 'unknown',
          mode: pr.head.ref.startsWith(metadataPrefix) ? 'metadata' : 'policy',
          branch: pr.head.ref,
          createdAt: pr.created_at,
        }));
    },
    enabled: Boolean(enabled && pat && owner && repo && policyId && baseBranch),
    // A new PR open / merge is a relatively rare event; 30s of caching keeps
    // tab-switches from re-hitting GitHub while still feeling fresh.
    staleTime: 30 * 1000,
    retry: false,
  });
}
