import {
  buildRequestUrlFromBindings,
  getByPath,
  viaProxy,
} from '@/services/external/externalServices';
import type { ExternalDependency, ExternalParam } from '@/types';

/**
 * Per-document fetch of every configured external dependency on a guardrail.
 *
 * The studio's sandbox lets an author fetch a dep once against the current
 * editor document. Blast radius is different: we need to fetch each dep
 * *again* for every test input the user is running through, because the
 * dep's parameters resolve against the test input's document and would
 * otherwise come back with stale data. The orchestrator does the same
 * thing at enforcement time — we mirror it client-side so the studio's
 * blast results match what production would see.
 */

export interface FetchedDep {
  /** Same name the policy reads at `input.external.<name>`. */
  name: string;
  /** The dep that produced this fetch — useful for the UI to label things. */
  dep: ExternalDependency;
  /** Fully resolved URL we hit. Shown in the result for triage. */
  url: string;
  /** Response body parsed as JSON (or text if not JSON), null on failure. */
  data: unknown | null;
  status: 'success' | 'error';
  /** Human-readable error message when status === 'error'. */
  error?: string;
}

function resolveParamValue(
  param: ExternalParam,
  document: Record<string, unknown>,
  configuration: Record<string, unknown>
): string {
  if (param.source === 'static') return param.value;
  const root = param.source === 'document' ? document : configuration;
  const v = getByPath(root, param.value);
  if (v == null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function resolveBodyEntryValue(
  param: ExternalParam,
  document: Record<string, unknown>,
  configuration: Record<string, unknown>
): unknown {
  if (param.source === 'static') {
    // For static body fields, try to parse as JSON first (so authors can
    // hand-edit nested objects in the studio); fall back to the raw string
    // when that doesn't parse — same loose behavior the sandbox uses.
    const v = param.value;
    if (v === '') return undefined;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  const root = param.source === 'document' ? document : configuration;
  return getByPath(root, param.value);
}

function assembleBody(
  bodyMap: Record<string, ExternalParam> | undefined,
  document: Record<string, unknown>,
  configuration: Record<string, unknown>
): Record<string, unknown> | null {
  if (!bodyMap || Object.keys(bodyMap).length === 0) return null;
  const out: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(bodyMap)) {
    const value = resolveBodyEntryValue(p, document, configuration);
    if (value !== undefined) out[name] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function fetchOneDep(
  dep: ExternalDependency,
  document: Record<string, unknown>,
  configuration: Record<string, unknown>
): Promise<FetchedDep> {
  if (!dep.name || !dep.path || !dep.baseUrl) {
    return {
      name: dep.name || '(unnamed)',
      dep,
      url: '',
      data: null,
      status: 'error',
      error: 'Dependency is missing name, path, or baseUrl',
    };
  }

  const resolvedParams: Record<string, string> = {};
  for (const [name, p] of Object.entries(dep.params ?? {})) {
    resolvedParams[name] = resolveParamValue(p, document, configuration);
  }
  const resolvedExtras = (dep.extraQueryParams ?? [])
    .filter((e) => e.name.trim())
    .map((e) => ({
      name: e.name.trim(),
      value: resolveParamValue(e.param, document, configuration),
    }));

  const url = buildRequestUrlFromBindings(dep.baseUrl, dep.path, resolvedParams, resolvedExtras);
  const body = assembleBody(dep.body, document, configuration);
  const method = (dep.method || 'GET').toUpperCase();

  try {
    // viaProxy keeps the call same-origin so CORS doesn't block this in the
    // browser; the proxy forwards method + headers + body verbatim.
    const res = await fetch(viaProxy(url), {
      method,
      headers:
        body !== null
          ? { Accept: 'application/json', 'Content-Type': 'application/json' }
          : { Accept: 'application/json' },
      body: body !== null ? JSON.stringify(body) : undefined,
    });
    let data: unknown;
    try {
      data = await res.clone().json();
    } catch {
      data = await res.text();
    }
    if (!res.ok) {
      return {
        name: dep.name,
        dep,
        url,
        data,
        status: 'error',
        error: `HTTP ${res.status}`,
      };
    }
    return { name: dep.name, dep, url, data, status: 'success' };
  } catch (e) {
    return {
      name: dep.name,
      dep,
      url,
      data: null,
      status: 'error',
      error: e instanceof Error ? e.message : 'Fetch failed',
    };
  }
}

/**
 * Fetch all `deps` in parallel for one document. Returns one entry per dep
 * (success or error) so the caller can decide whether to abort the test or
 * proceed with partial data.
 */
export async function fetchDepsForDocument(
  deps: ExternalDependency[],
  document: Record<string, unknown>,
  configuration: Record<string, unknown>
): Promise<FetchedDep[]> {
  if (!deps || deps.length === 0) return [];
  return Promise.all(deps.map((d) => fetchOneDep(d, document, configuration)));
}
