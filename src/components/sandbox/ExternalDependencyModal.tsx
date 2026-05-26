import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Zap,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import {
  buildRequestUrl,
  fetchSpec,
  getByPath,
  flattenLeafPaths,
} from '@/services/external/externalServices';
import { cn, parseJson } from '@/utils';
import type {
  ExternalDependency,
  ExternalParam,
  ParamSource,
  ParsedSpec,
  SwaggerOperation,
} from '@/types';
import { SwaggerFieldList } from './SwaggerFieldList';

interface ExternalDependencyModalProps {
  dep: ExternalDependency;
  isOpen: boolean;
  onClose: () => void;
}

interface ExecResult {
  status?: number;
  ok: boolean;
  timeMs: number;
  body: unknown;
  error?: string;
}

const methodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-[var(--color-info-bg)] text-[var(--color-info)]';
    case 'POST':
      return 'bg-[var(--color-success-bg)] text-[var(--color-success)]';
    case 'DELETE':
      return 'bg-[var(--color-error-bg)] text-[var(--color-error)]';
    default:
      return 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]';
  }
};

function sanitizeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

const sourceLabel: Record<ParamSource, string> = {
  static: 'Static',
  document: 'Document',
  configuration: 'Config',
};

export function ExternalDependencyModal({ dep, isOpen, onClose }: ExternalDependencyModalProps) {
  const { updateExternalDep, inputJson, configJson } = usePolicyStore();

  const [spec, setSpec] = useState<ParsedSpec | null>(null);
  const [specStatus, setSpecStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [specError, setSpecError] = useState<string | null>(null);

  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, Record<string, ExternalParam>>>({});
  const [responses, setResponses] = useState<Record<string, ExecResult>>({});
  const [executing, setExecuting] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Available paths from the document / configuration, for the value pickers.
  const docPaths = useMemo(() => flattenLeafPaths(parseJson(inputJson) ?? {}), [inputJson]);
  const configPaths = useMemo(() => flattenLeafPaths(parseJson(configJson) ?? {}), [configJson]);

  const loadSpec = useCallback(async (specUrl: string, baseUrl: string) => {
    if (!specUrl) return;
    setSpecStatus('loading');
    setSpecError(null);
    try {
      const parsed = await fetchSpec(specUrl, baseUrl);
      setSpec(parsed);
      setSpecStatus('idle');
    } catch (e) {
      setSpec(null);
      setSpecStatus('error');
      setSpecError(
        e instanceof Error ? `${e.message}. Is the mock service running?` : 'Failed to load spec'
      );
    }
  }, []);

  // Seed parameter config for an operation from its examples (static by default).
  const seedParams = useCallback((op: SwaggerOperation): Record<string, ExternalParam> => {
    const seed: Record<string, ExternalParam> = {};
    for (const p of op.parameters) {
      seed[p.name] = { source: 'static', value: p.example != null ? String(p.example) : '' };
    }
    return seed;
  }, []);

  const paramsFor = useCallback(
    (op: SwaggerOperation): Record<string, ExternalParam> => params[op.id] ?? seedParams(op),
    [params, seedParams]
  );

  // Resolve a configured parameter to a concrete string value.
  const resolveParam = useCallback(
    (param: ExternalParam): string => {
      if (param.source === 'static') return param.value;
      const root = parseJson(param.source === 'document' ? inputJson : configJson) ?? {};
      const v = getByPath(root, param.value);
      if (v == null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    },
    [inputJson, configJson]
  );

  const resolvedValues = useCallback(
    (op: SwaggerOperation): Record<string, string> => {
      const map = paramsFor(op);
      const out: Record<string, string> = {};
      for (const p of op.parameters) out[p.name] = resolveParam(map[p.name] ?? { source: 'static', value: '' });
      return out;
    },
    [paramsFor, resolveParam]
  );

  const execute = useCallback(
    async (op: SwaggerOperation) => {
      const opParams = paramsFor(op);
      const resolved = resolvedValues(op);
      const url = buildRequestUrl(dep.baseUrl, op.path, op, resolved);
      setExecuting(op.id);
      const start = performance.now();
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const timeMs = Math.round(performance.now() - start);
        let body: unknown;
        try {
          body = await res.clone().json();
        } catch {
          body = await res.text();
        }
        setResponses((r) => ({ ...r, [op.id]: { status: res.status, ok: res.ok, timeMs, body } }));
        if (res.ok) {
          updateExternalDep(dep.id, {
            operationId: op.id,
            path: op.path,
            method: op.method,
            params: opParams,
            data: body,
            status: 'success',
            fetchedAt: new Date().toISOString(),
            error: undefined,
          });
        } else {
          updateExternalDep(dep.id, { status: 'error', error: `Request failed (${res.status})` });
        }
      } catch (e) {
        const timeMs = Math.round(performance.now() - start);
        const message = e instanceof Error ? e.message : 'Request failed';
        setResponses((r) => ({ ...r, [op.id]: { ok: false, timeMs, body: null, error: message } }));
        updateExternalDep(dep.id, { status: 'error', error: message });
      } finally {
        setExecuting(null);
      }
    },
    [dep.baseUrl, dep.id, paramsFor, resolvedValues, updateExternalDep]
  );

  // Expand an operation: seed its params, then auto-execute if all required
  // parameters resolve and it hasn't been run yet this session.
  const expandOp = useCallback(
    (op: SwaggerOperation) => {
      setExpandedOpId(op.id);
      setParams((prev) => (prev[op.id] ? prev : { ...prev, [op.id]: seedParams(op) }));

      const resolved = resolvedValues(op);
      const missingRequired = op.parameters.some((p) => p.required && !resolved[p.name]);
      if (!responses[op.id] && !missingRequired) {
        // Defer so seeded params state settles before the request.
        setTimeout(() => execute(op), 0);
      }
    },
    [execute, resolvedValues, responses, seedParams]
  );

  const toggleOp = (op: SwaggerOperation) => {
    if (expandedOpId === op.id) {
      setExpandedOpId(null);
      return;
    }
    expandOp(op);
  };

  const setParam = (opId: string, name: string, patch: Partial<ExternalParam>) =>
    setParams((prev) => {
      const current = prev[opId]?.[name] ?? { source: 'static', value: '' };
      return { ...prev, [opId]: { ...prev[opId], [name]: { ...current, ...patch } } };
    });

  // Load the spec when the modal opens; pre-expand the selected endpoint.
  useEffect(() => {
    if (isOpen && dep.specUrl) {
      loadSpec(dep.specUrl, dep.baseUrl);
      setExpandedOpId(dep.operationId ?? null);
    }
  }, [isOpen, dep.specUrl, dep.baseUrl, dep.operationId, loadSpec]);

  // Escape to close + lock background scroll.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copyUrl = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl((u) => (u === url ? null : u)), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div
        className={cn(
          'relative w-full max-w-3xl max-h-[88vh] flex flex-col',
          'rounded-[var(--radius-xl)] overflow-hidden bg-[var(--color-surface)] shadow-2xl',
          'animate-fade-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors"
                title="Close"
              />
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <div className="w-3 h-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="h-4 w-px bg-[var(--color-border-light)]" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                {spec?.title || 'API Explorer'}
                {spec?.version && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-tertiary)]">
                    v{spec.version}
                  </span>
                )}
              </h2>
              {spec?.description && (
                <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                  {spec.description}
                </p>
              )}
            </div>
          </div>
          {dep.specUrl && (
            <a
              href={dep.specUrl.replace(/\/openapi\.json$/, '/docs')}
              target="_blank"
              rel="noopener noreferrer"
              title="Open original Swagger docs"
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Swagger
            </a>
          )}
        </div>

        {/* Inject-as bar */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)]">
          <span className="text-xs text-[var(--color-text-secondary)]">Inject response as</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border)]">
            <code className="text-xs font-mono text-[var(--color-text-tertiary)]">
              input.external.
            </code>
            <input
              value={dep.name}
              onChange={(e) => updateExternalDep(dep.id, { name: sanitizeName(e.target.value) })}
              placeholder="dependency"
              className="w-32 bg-transparent text-xs font-mono text-[var(--color-text-primary)] outline-none"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
          {specStatus === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--color-text-tertiary)]">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading API spec…
            </div>
          )}
          {specStatus === 'error' && specError && (
            <div className="flex items-center gap-2 p-4 rounded-[var(--radius-md)] bg-[var(--color-error-bg)] text-sm text-[var(--color-error)]">
              <AlertCircle className="w-4 h-4 shrink-0" /> {specError}
            </div>
          )}

          {spec?.operations.map((op) => {
            const expanded = expandedOpId === op.id;
            const result = responses[op.id];
            const isActive = dep.operationId === op.id;
            const opParams = paramsFor(op);
            const resolved = resolvedValues(op);
            const reqUrl = buildRequestUrl(dep.baseUrl, op.path, op, resolved);
            return (
              <div
                key={op.id}
                className={cn(
                  'rounded-[var(--radius-lg)] border overflow-hidden transition-colors',
                  isActive ? 'border-[var(--color-info)]' : 'border-[var(--color-border-light)]'
                )}
              >
                {/* Operation row */}
                <button
                  onClick={() => toggleOp(op)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface-secondary)] transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
                  )}
                  <span
                    className={cn(
                      'shrink-0 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide',
                      methodColor(op.method)
                    )}
                  >
                    {op.method}
                  </span>
                  <code className="shrink-0 text-sm font-mono font-medium text-[var(--color-text-primary)]">
                    {op.path}
                  </code>
                  <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                    {op.summary}
                  </span>
                  {isActive && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-[var(--color-info)]">
                      <Zap className="w-3 h-3" /> active
                    </span>
                  )}
                </button>

                {/* Expanded body */}
                {expanded && (
                  <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[var(--color-border-light)]">
                    {op.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] pt-3">
                        {op.description}
                      </p>
                    )}

                    {/* Parameters */}
                    {op.parameters.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          Parameters
                        </h4>
                        {op.parameters.map((p) => {
                          const cfg = opParams[p.name] ?? { source: 'static', value: '' };
                          const listId = `paths-${op.id}-${p.name}`;
                          const suggestions = cfg.source === 'document' ? docPaths : configPaths;
                          return (
                            <div key={p.name} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-32 shrink-0">
                                  <code className="text-xs font-mono text-[var(--color-text-primary)]">
                                    {p.name}
                                    {p.required && (
                                      <span className="text-[var(--color-error)]">*</span>
                                    )}
                                  </code>
                                  <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
                                    {p.in}
                                  </span>
                                </div>

                                {/* Source selector */}
                                <select
                                  value={cfg.source}
                                  onChange={(e) =>
                                    setParam(op.id, p.name, {
                                      source: e.target.value as ParamSource,
                                      value: '',
                                    })
                                  }
                                  className="shrink-0 px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-info)]"
                                >
                                  <option value="static">{sourceLabel.static}</option>
                                  <option value="document">{sourceLabel.document}</option>
                                  <option value="configuration">{sourceLabel.configuration}</option>
                                </select>

                                {/* Value control */}
                                {cfg.source === 'static' ? (
                                  <input
                                    value={cfg.value}
                                    onChange={(e) => setParam(op.id, p.name, { value: e.target.value })}
                                    placeholder={p.example ? String(p.example) : p.type}
                                    className="flex-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                                  />
                                ) : (
                                  <input
                                    list={listId}
                                    value={cfg.value}
                                    onChange={(e) => setParam(op.id, p.name, { value: e.target.value })}
                                    placeholder={`path in ${cfg.source} (e.g. user.role)`}
                                    className="flex-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                                  />
                                )}
                                {cfg.source !== 'static' && (
                                  <datalist id={listId}>
                                    {suggestions.map((path) => (
                                      <option key={path} value={path} />
                                    ))}
                                  </datalist>
                                )}
                              </div>

                              {/* Resolved preview for dynamic sources */}
                              {cfg.source !== 'static' && (
                                <div className="pl-[8.5rem] text-[10px] text-[var(--color-text-tertiary)]">
                                  resolves to{' '}
                                  {resolved[p.name] ? (
                                    <code className="text-[var(--color-text-secondary)]">
                                      {resolved[p.name]}
                                    </code>
                                  ) : (
                                    <span className="text-[var(--color-warning)]">
                                      (not found in {cfg.source})
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Request URL + Execute */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => execute(op)}
                        disabled={executing === op.id}
                        className={cn(
                          'flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] shrink-0',
                          'bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                      >
                        {executing === op.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Execute
                      </button>
                      <button
                        onClick={() => copyUrl(reqUrl)}
                        title="Copy request URL"
                        className="flex items-center gap-1.5 min-w-0 flex-1 px-2.5 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {copiedUrl === reqUrl ? (
                          <Check className="w-3.5 h-3.5 shrink-0 text-[var(--color-success)]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <code className="truncate text-[11px] font-mono">{reqUrl}</code>
                      </button>
                    </div>

                    {/* Response */}
                    {result && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            Response
                          </h4>
                          {result.status != null && (
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold',
                                result.ok
                                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                                  : 'bg-[var(--color-error-bg)] text-[var(--color-error)]'
                              )}
                            >
                              {result.status}
                            </span>
                          )}
                          <span className="text-[10px] text-[var(--color-text-tertiary)]">
                            {result.timeMs} ms
                          </span>
                        </div>
                        {result.error ? (
                          <p className="flex items-center gap-2 text-xs text-[var(--color-error)]">
                            <AlertCircle className="w-3.5 h-3.5" /> {result.error}
                          </p>
                        ) : (
                          <pre className="max-h-56 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs font-mono text-[var(--color-text-secondary)]">
                            {typeof result.body === 'string'
                              ? result.body
                              : JSON.stringify(result.body, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}

                    {/* Response schema / fields */}
                    {op.responseFields.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          Response fields
                          <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--color-text-tertiary)]">
                            (click to copy a Rego reference)
                          </span>
                        </h4>
                        <SwaggerFieldList fields={op.responseFields} depName={dep.name} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3 border-t border-[var(--color-border-light)]">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {dep.status === 'success'
              ? `Injected from ${dep.method} ${dep.path}`
              : 'Execute an endpoint to inject its response'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
