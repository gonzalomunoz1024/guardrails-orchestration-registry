import { useQuery } from '@tanstack/react-query';
import { evaluationApi } from '@/services/api';

/**
 * Validate a Rego policy by routing through the OPA evaluate endpoint —
 * there is no dedicated validate endpoint, and OPA parses + compiles the
 * policy before evaluating so a successful evaluate is a sufficient
 * validation. Returns a TanStack query whose `data.valid` is the
 * authoritative gate for "is it safe to publish?" — callers should treat
 * anything other than `data.valid === true` (including isPending, isError,
 * and network failure) as a hard block. The PR/download paths bypass any
 * client-side checks the editor does, so this is the only line of defense
 * before broken Rego lands in the orchestrator's tarball.
 *
 * `input` is the same input bundle the user would evaluate against — using
 * the real input catches a few more error classes than evaluating against
 * `{}`, at the cost of a false negative when their input itself is wrong,
 * which they'd see anyway when they evaluate.
 */
export function useValidateRego(
  regoCode: string,
  input: Record<string, unknown>,
  enabled = true
) {
  const trimmed = regoCode.trim();
  return useQuery({
    queryKey: ['rego-validate', trimmed, input],
    queryFn: () => evaluationApi.validatePolicy(regoCode, input),
    enabled: enabled && trimmed.length > 0,
    // Result is a pure function of (rego, input); cache so a re-open of
    // the submit modal doesn't re-hit the backend if neither changed.
    staleTime: 5 * 60 * 1000,
    // Fail-safe: don't retry on network error. A retried success could
    // race the user clicking submit before the retry resolves.
    retry: false,
  });
}
