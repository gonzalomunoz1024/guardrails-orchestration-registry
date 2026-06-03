import { useEffect, useRef } from 'react';
import { usePolicyStore } from '@/store';
import { fetchOneDep } from '@/utils/fetchDepsForDocument';
import { parseJson } from '@/utils';
import { useDebounce } from './useDebounce';

/**
 * Keep every configured external dependency's `data` in sync with the current
 * input document and configuration. Without this, an author editing the
 * document in Studio would have to open each dep modal and click Execute to
 * see updated `input.external.*` values; evaluation would otherwise run
 * against the stale data captured the last time someone hit Execute.
 *
 * A dep is "configured" once the modal's Execute has been clicked at least
 * once and persisted a path/method/baseUrl. Idle deps (the user added the
 * row but never selected an operation) are left alone.
 *
 * Edits are debounced to avoid hammering upstream APIs on every keystroke.
 */
export function useAutoRefetchDeps(): void {
  const inputJson = usePolicyStore((s) => s.inputJson);
  const configJson = usePolicyStore((s) => s.configJson);
  const externalDeps = usePolicyStore((s) => s.externalDeps);
  const updateExternalDepRuntime = usePolicyStore((s) => s.updateExternalDepRuntime);

  // Debounce the document/config text so we only fetch when typing pauses.
  // 700ms matches the studio's evaluation debounce — the refetch lands just
  // before the next auto-evaluation does, so OPA sees fresh data.
  const debouncedKey = useDebounce(`${inputJson}::${configJson}`, 700);

  // Guard against overlapping refetch waves: a wave that's in-flight when
  // the user keeps typing should resolve before the next one starts. We
  // tag each wave and ignore stale results on settle.
  const waveRef = useRef(0);

  useEffect(() => {
    const document = parseJson(inputJson);
    const configuration = parseJson(configJson);
    // Both must parse, otherwise we'd send `{}` and clobber good data with
    // a 4xx response from upstream. Wait for valid JSON.
    if (!document || typeof document !== 'object') return;
    if (!configuration || typeof configuration !== 'object') return;

    const configured = externalDeps.filter(
      (d) => d.path && d.method && d.baseUrl
    );
    if (configured.length === 0) return;

    const wave = ++waveRef.current;

    for (const dep of configured) {
      updateExternalDepRuntime(dep.id, { status: 'loading', error: undefined });
      fetchOneDep(
        dep,
        document as Record<string, unknown>,
        configuration as Record<string, unknown>
      ).then((result) => {
        // A newer wave kicked off; drop this result.
        if (waveRef.current !== wave) return;
        if (result.status === 'success') {
          updateExternalDepRuntime(dep.id, {
            data: result.data,
            status: 'success',
            error: undefined,
            fetchedAt: new Date().toISOString(),
          });
        } else {
          updateExternalDepRuntime(dep.id, {
            status: 'error',
            error: result.error,
          });
        }
      });
    }
    // updateExternalDep is stable from Zustand; depending on it would
    // re-fire this effect unnecessarily. externalDeps is intentionally
    // excluded so refetches don't loop on their own data writes — we only
    // refetch when the document, configuration, or dep config changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey, externalDeps.length, externalDepsConfigKey(externalDeps)]);
}

/**
 * Stringify the request-shaping fields of every dep so a change in path,
 * method, params, or body bindings triggers a refetch even when the document
 * hasn't changed. Excludes `data`/`status`/`fetchedAt` so the effect doesn't
 * re-fire on its own writes.
 */
function externalDepsConfigKey(deps: { id: string; path: string; method: string; baseUrl: string; params: unknown; body?: unknown; extraQueryParams?: unknown }[]): string {
  return deps
    .map((d) => JSON.stringify([d.id, d.path, d.method, d.baseUrl, d.params, d.body, d.extraQueryParams]))
    .join('|');
}
