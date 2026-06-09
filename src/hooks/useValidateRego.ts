import { useQuery } from '@tanstack/react-query';
import { evaluationApi } from '@/services/api';

/**
 * Validate a Rego policy against the backend's OPA validator. Returns a
 * TanStack query whose `data.valid` is the authoritative gate for "is it
 * safe to publish?" — callers should treat anything other than
 * `data.valid === true` (including isPending, isError, and network failure)
 * as a hard block. The PR/download paths bypass any client-side checks the
 * editor does, so this is the only line of defense before broken Rego
 * lands in the orchestrator's tarball.
 */
export function useValidateRego(regoCode: string, enabled = true) {
  const trimmed = regoCode.trim();
  return useQuery({
    queryKey: ['rego-validate', trimmed],
    queryFn: () => evaluationApi.validatePolicy(regoCode),
    enabled: enabled && trimmed.length > 0,
    // Result is a pure function of the rego text; cache so a re-open of the
    // submit modal doesn't re-hit the backend if the user didn't edit.
    staleTime: 5 * 60 * 1000,
    // Fail-safe: don't retry on network error. A retried success could
    // race the user clicking submit before the retry resolves.
    retry: false,
  });
}
