import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Play,
  Plus,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import {
  EXTERNAL_SERVICES,
  CUSTOM_SERVICE_ID,
  VAULT_ADDRESS,
  buildRequestUrl,
  fetchSpec,
  getByPath,
  flattenLeafPaths,
} from '@/services/external/externalServices';
import { cn, parseJson } from '@/utils';
import type {
  ExternalDependency,
  ExternalExtraQueryParam,
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

interface BindingRowProps {
  name: string;
  /** Where the value goes: the param `in` (path/query/header) or "body". */
  kindLabel: string;
  type: string;
  required: boolean;
  example?: unknown;
  cfg: ExternalParam;
  onChange: (patch: Partial<ExternalParam>) => void;
  docPaths: string[];
  configPaths: string[];
  /** Preview string of the resolved value (for document/config sources). */
  resolvedPreview: string;
  idPrefix: string;
}

/**
 * One bindable field row — a value sourced from a static literal, a path in the
 * document, or a path in the configuration. Used for both request parameters and
 * request-body fields so the experience is identical.
 */
function BindingRow({
  name,
  kindLabel,
  type,
  required,
  example,
  cfg,
  onChange,
  docPaths,
  configPaths,
  resolvedPreview,
  idPrefix,
}: BindingRowProps) {
  const listId = `${idPrefix}-${name}`;
  const suggestions = cfg.source === 'document' ? docPaths : configPaths;
  const isStructured = type === 'object' || type === 'array';
  const valueClass =
    'flex-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]';

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <div className="w-32 shrink-0 pt-1.5">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {name}
            {required && <span className="text-[var(--color-error)]">*</span>}
          </span>
          <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
            {kindLabel} · {type}
          </span>
        </div>

        <select
          value={cfg.source}
          onChange={(e) => onChange({ source: e.target.value as ParamSource, value: '' })}
          className="shrink-0 px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="static">{sourceLabel.static}</option>
          <option value="document">{sourceLabel.document}</option>
          <option value="configuration">{sourceLabel.configuration}</option>
        </select>

        {cfg.source === 'static' ? (
          isStructured ? (
            <textarea
              value={cfg.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={
                example != null
                  ? JSON.stringify(example)
                  : type === 'array'
                    ? '[ … ]  (JSON)'
                    : '{ … }  (JSON)'
              }
              rows={3}
              className={cn(valueClass, 'resize-y leading-relaxed')}
            />
          ) : (
            <input
              value={cfg.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={example != null ? String(example) : type}
              className={valueClass}
            />
          )
        ) : (
          <>
            <input
              list={listId}
              value={cfg.value}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder={`path in ${cfg.source} (e.g. user.role)`}
              className={valueClass}
            />
            <datalist id={listId}>
              {suggestions.map((path) => (
                <option key={path} value={path} />
              ))}
            </datalist>
          </>
        )}
      </div>

      {cfg.source !== 'static' && (
        <div className="pl-[8.5rem] text-[10px] text-[var(--color-text-tertiary)]">
          {isStructured ? 'binds the object/array at' : 'resolves to'}{' '}
          {resolvedPreview ? (
            <code className="text-[var(--color-text-secondary)]">{resolvedPreview}</code>
          ) : (
            <span className="text-[var(--color-warning)]">(not found in {cfg.source})</span>
          )}
        </div>
      )}
    </div>
  );
}

interface ExtraQueryParamsSectionProps {
  extras: ExternalExtraQueryParam[];
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onChangeName: (idx: number, name: string) => void;
  onChangeParam: (idx: number, patch: Partial<ExternalParam>) => void;
  resolveParam: (param: ExternalParam) => string;
  docPaths: string[];
  configPaths: string[];
  idPrefix: string;
}

/**
 * Editor for query keys the OpenAPI spec doesn't declare — dynamic filters
 * like `attributes.app_id=CLAUT` that real APIs accept but don't enumerate.
 * Each row has an editable name, the same static/document/configuration
 * source picker as declared parameters, and a value/path field. Rows are
 * appended to the request URL after the spec-declared query parameters.
 */
function ExtraQueryParamsSection({
  extras,
  onAdd,
  onRemove,
  onChangeName,
  onChangeParam,
  resolveParam,
  docPaths,
  configPaths,
  idPrefix,
}: ExtraQueryParamsSectionProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Extra query parameters
          <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--color-text-tertiary)]">
            (not in spec — appended to the URL)
          </span>
        </h4>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface-secondary)] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {extras.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          No extras. Add a row for dynamic filters like{' '}
          <code className="font-mono">attributes.app_id=CLAUT</code>.
        </p>
      ) : (
        extras.map((entry, idx) => (
          <ExtraQueryParamRow
            key={idx}
            entry={entry}
            preview={entry.param.source === 'static' ? entry.param.value : resolveParam(entry.param)}
            onChangeName={(name) => onChangeName(idx, name)}
            onChangeParam={(patch) => onChangeParam(idx, patch)}
            onRemove={() => onRemove(idx)}
            docPaths={docPaths}
            configPaths={configPaths}
            idPrefix={`${idPrefix}-${idx}`}
          />
        ))
      )}
    </div>
  );
}

interface ExtraQueryParamRowProps {
  entry: ExternalExtraQueryParam;
  preview: string;
  onChangeName: (name: string) => void;
  onChangeParam: (patch: Partial<ExternalParam>) => void;
  onRemove: () => void;
  docPaths: string[];
  configPaths: string[];
  idPrefix: string;
}

function ExtraQueryParamRow({
  entry,
  preview,
  onChangeName,
  onChangeParam,
  onRemove,
  docPaths,
  configPaths,
  idPrefix,
}: ExtraQueryParamRowProps) {
  const listId = `${idPrefix}-list`;
  const suggestions = entry.param.source === 'document' ? docPaths : configPaths;
  const valueClass =
    'flex-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]';
  return (
    <div className="space-y-1">
      <div className="flex items-start gap-2">
        <input
          value={entry.name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="attributes.app_id"
          className="w-44 shrink-0 px-2.5 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
        />
        <select
          value={entry.param.source}
          onChange={(e) =>
            onChangeParam({ source: e.target.value as ParamSource, value: '' })
          }
          className="shrink-0 px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-info)]"
        >
          <option value="static">{sourceLabel.static}</option>
          <option value="document">{sourceLabel.document}</option>
          <option value="configuration">{sourceLabel.configuration}</option>
        </select>
        {entry.param.source === 'static' ? (
          <input
            value={entry.param.value}
            onChange={(e) => onChangeParam({ value: e.target.value })}
            placeholder="CLAUT"
            className={valueClass}
          />
        ) : (
          <>
            <input
              list={listId}
              value={entry.param.value}
              onChange={(e) => onChangeParam({ value: e.target.value })}
              placeholder={`path in ${entry.param.source} (e.g. metadata.appId)`}
              className={valueClass}
            />
            <datalist id={listId}>
              {suggestions.map((path) => (
                <option key={path} value={path} />
              ))}
            </datalist>
          </>
        )}
        <button
          onClick={onRemove}
          aria-label="Remove extra query parameter"
          className="shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {entry.param.source !== 'static' && (
        <div className="pl-[11.75rem] text-[10px] text-[var(--color-text-tertiary)]">
          resolves to{' '}
          {preview ? (
            <code className="text-[var(--color-text-secondary)]">{preview}</code>
          ) : (
            <span className="text-[var(--color-warning)]">(not found in {entry.param.source})</span>
          )}
        </div>
      )}
    </div>
  );
}

export function ExternalDependencyModal({ dep, isOpen, onClose }: ExternalDependencyModalProps) {
  const { updateExternalDep, externalDeps, inputJson, configJson } = usePolicyStore();

  const [spec, setSpec] = useState<ParsedSpec | null>(null);
  const [specStatus, setSpecStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [specError, setSpecError] = useState<string | null>(null);

  const [expandedOpId, setExpandedOpId] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, Record<string, ExternalParam>>>({});
  const [bodies, setBodies] = useState<Record<string, Record<string, ExternalParam>>>({});
  // Undeclared query params keyed by operation id. Authors add these for
  // dynamic filter keys the OpenAPI spec doesn't enumerate (e.g.
  // `attributes.app_id=CLAUT`). Stored as an array so duplicate keys and
  // insertion order are preservable.
  const [extrasByOp, setExtrasByOp] = useState<Record<string, ExternalExtraQueryParam[]>>({});
  const [responses, setResponses] = useState<Record<string, ExecResult>>({});
  const [executing, setExecuting] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [customBaseUrl, setCustomBaseUrl] = useState(dep.baseUrl);
  const [customSpecUrl, setCustomSpecUrl] = useState(dep.specUrl);

  const isCustom = dep.serviceId === CUSTOM_SERVICE_ID;

  // Auto-generate a unique reference name (the user does not name dependencies).
  const makeUniqueName = (base: string): string => {
    const taken = externalDeps.filter((d) => d.id !== dep.id).map((d) => d.name);
    const safe = sanitizeName(base) || 'external';
    if (!taken.includes(safe)) return safe;
    let i = 2;
    while (taken.includes(`${safe}_${i}`)) i++;
    return `${safe}_${i}`;
  };

  const handleServiceChange = (serviceId: string) => {
    if (serviceId === CUSTOM_SERVICE_ID) {
      setCustomBaseUrl('');
      setCustomSpecUrl('');
      updateExternalDep(dep.id, {
        serviceId: CUSTOM_SERVICE_ID,
        name: makeUniqueName('external'),
        baseUrl: '',
        specUrl: '',
        operationId: undefined,
        path: '',
        params: {},
        body: undefined,
        auth: undefined,
        data: null,
        status: 'idle',
        error: undefined,
      });
      return;
    }
    const svc = EXTERNAL_SERVICES.find((s) => s.id === serviceId);
    if (!svc) return;
    updateExternalDep(dep.id, {
      serviceId: svc.id,
      name: makeUniqueName(svc.id),
      baseUrl: svc.baseUrl,
      specUrl: svc.specUrl,
      operationId: undefined,
      path: '',
      params: {},
      body: undefined,
      // Registered services are pre-integrated — never carry Vault auth.
      auth: undefined,
      data: null,
      status: 'idle',
      error: undefined,
    });
  };

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

  // Seed body field bindings from examples (static by default).
  const seedBody = useCallback((op: SwaggerOperation): Record<string, ExternalParam> => {
    const seed: Record<string, ExternalParam> = {};
    for (const f of op.bodyFields) {
      seed[f.name] = { source: 'static', value: f.example != null ? String(f.example) : '' };
    }
    return seed;
  }, []);

  const bodyFor = useCallback(
    (op: SwaggerOperation): Record<string, ExternalParam> => bodies[op.id] ?? seedBody(op),
    [bodies, seedBody]
  );

  // Resolve a body binding to a typed JS value (numbers/booleans/objects, not strings).
  const resolveTyped = useCallback(
    (param: ExternalParam, type: string): unknown => {
      if (param.source === 'static') {
        const v = param.value;
        if (v === '') return undefined;
        if (type === 'number' || type === 'integer') {
          const n = Number(v);
          return Number.isNaN(n) ? v : n;
        }
        if (type === 'boolean') return v === 'true' || v === '1';
        if (type === 'object' || type === 'array') {
          try {
            return JSON.parse(v);
          } catch {
            return v;
          }
        }
        return v;
      }
      const root = parseJson(param.source === 'document' ? inputJson : configJson) ?? {};
      return getByPath(root, param.value);
    },
    [inputJson, configJson]
  );

  // Assemble the typed JSON body for an operation (omitting empty optional fields).
  const resolvedBody = useCallback(
    (op: SwaggerOperation): Record<string, unknown> => {
      const map = bodyFor(op);
      const out: Record<string, unknown> = {};
      for (const f of op.bodyFields) {
        const value = resolveTyped(map[f.name] ?? { source: 'static', value: '' }, f.type);
        if (value !== undefined) out[f.name] = value;
      }
      return out;
    },
    [bodyFor, resolveTyped]
  );

  // Undeclared-query-param accessors, hoisted above `execute` because they're
  // called from inside its closure to assemble the request URL and persist
  // the trimmed extras on success.
  const extrasFor = useCallback(
    (op: SwaggerOperation): ExternalExtraQueryParam[] => extrasByOp[op.id] ?? [],
    [extrasByOp]
  );

  const resolvedExtras = useCallback(
    (op: SwaggerOperation): { name: string; value: string }[] =>
      extrasFor(op).map((e) => ({ name: e.name.trim(), value: resolveParam(e.param) })),
    [extrasFor, resolveParam]
  );

  const execute = useCallback(
    async (op: SwaggerOperation) => {
      const opParams = paramsFor(op);
      const resolved = resolvedValues(op);
      const opExtras = extrasFor(op).filter((e) => e.name.trim().length > 0);
      const url = buildRequestUrl(dep.baseUrl, op.path, op, resolved, resolvedExtras(op));
      const hasBody = op.bodyFields.length > 0;
      const opBody = hasBody ? bodyFor(op) : {};
      setExecuting(op.id);
      const start = performance.now();
      try {
        const res = await fetch(url, {
          method: op.method,
          headers: hasBody
            ? { Accept: 'application/json', 'Content-Type': 'application/json' }
            : { Accept: 'application/json' },
          body: hasBody ? JSON.stringify(resolvedBody(op)) : undefined,
        });
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
            body: hasBody ? opBody : undefined,
            // Persist trimmed-name extras only (drop blank rows). Stored
            // separately from `params` so the orchestrator can append them
            // to the query string without consulting an `in` field.
            extraQueryParams: opExtras.length > 0 ? opExtras : undefined,
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
    [dep.baseUrl, dep.id, paramsFor, resolvedValues, extrasFor, resolvedExtras, bodyFor, resolvedBody, updateExternalDep]
  );

  // Expand an operation: seed its params, then auto-execute if all required
  // parameters resolve and it hasn't been run yet this session.
  const expandOp = useCallback(
    (op: SwaggerOperation) => {
      setExpandedOpId(op.id);
      setParams((prev) => (prev[op.id] ? prev : { ...prev, [op.id]: seedParams(op) }));
      setBodies((prev) => (prev[op.id] ? prev : { ...prev, [op.id]: seedBody(op) }));

      // Only auto-execute GET (reads). POST is body-driven/mutating — run on demand.
      const resolved = resolvedValues(op);
      const missingRequired = op.parameters.some((p) => p.required && !resolved[p.name]);
      if (op.method === 'GET' && !responses[op.id] && !missingRequired) {
        // Defer so seeded params state settles before the request.
        setTimeout(() => execute(op), 0);
      }
    },
    [execute, resolvedValues, responses, seedParams, seedBody]
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

  const setBodyParam = (opId: string, name: string, patch: Partial<ExternalParam>) =>
    setBodies((prev) => {
      const current = prev[opId]?.[name] ?? { source: 'static', value: '' };
      return { ...prev, [opId]: { ...prev[opId], [name]: { ...current, ...patch } } };
    });

  const addExtra = (opId: string) =>
    setExtrasByOp((prev) => ({
      ...prev,
      [opId]: [...(prev[opId] ?? []), { name: '', param: { source: 'static', value: '' } }],
    }));

  const removeExtra = (opId: string, idx: number) =>
    setExtrasByOp((prev) => ({
      ...prev,
      [opId]: (prev[opId] ?? []).filter((_, i) => i !== idx),
    }));

  const updateExtraName = (opId: string, idx: number, name: string) =>
    setExtrasByOp((prev) => ({
      ...prev,
      [opId]: (prev[opId] ?? []).map((e, i) => (i === idx ? { ...e, name } : e)),
    }));

  const updateExtraParam = (opId: string, idx: number, patch: Partial<ExternalParam>) =>
    setExtrasByOp((prev) => ({
      ...prev,
      [opId]: (prev[opId] ?? []).map((e, i) =>
        i === idx ? { ...e, param: { ...e.param, ...patch } } : e
      ),
    }));

  // Load the spec when the modal opens; pre-expand the selected endpoint.
  useEffect(() => {
    if (isOpen && dep.specUrl) {
      loadSpec(dep.specUrl, dep.baseUrl);
      setExpandedOpId(dep.operationId ?? null);
    }
  }, [isOpen, dep.specUrl, dep.baseUrl, dep.operationId, loadSpec]);

  // Hydrate extras for the active operation when the modal opens, so authors
  // see their previously-saved query keys instead of an empty section.
  // Declared params/body are intentionally NOT hydrated here — that's a
  // pre-existing limitation; the extras lookup is additive so we don't
  // regress it but at least the new feature persists across reopens.
  useEffect(() => {
    if (!isOpen || !dep.operationId) return;
    const existing = dep.extraQueryParams;
    if (!existing || existing.length === 0) return;
    setExtrasByOp((prev) => (prev[dep.operationId!] ? prev : { ...prev, [dep.operationId!]: existing }));
  }, [isOpen, dep.operationId, dep.extraQueryParams]);

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
          <div className="shrink-0 flex items-center gap-1">
            {dep.specUrl && (
              <a
                href={dep.specUrl.replace(/\/openapi\.json$/, '/docs')}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original Swagger docs"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Swagger
              </a>
            )}
            <button
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Service selector + auto-assigned reference */}
        <div className="shrink-0 px-6 py-3 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)] space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Service</span>
              <select
                value={dep.serviceId || ''}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-info)] outline-none"
              >
                <option value="" disabled>
                  Choose a service…
                </option>
                {EXTERNAL_SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={CUSTOM_SERVICE_ID}>Custom URL…</option>
              </select>
            </label>
            {dep.name && (
              <span className="text-xs text-[var(--color-text-tertiary)]">
                injected as{' '}
                <code className="font-mono text-[var(--color-text-secondary)]">
                  input.external.{dep.name}
                </code>
              </span>
            )}
          </div>

          {isCustom && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="Base URL (https://api.example.com)"
                className="flex-1 min-w-[160px] px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
              />
              <input
                value={customSpecUrl}
                onChange={(e) => setCustomSpecUrl(e.target.value)}
                placeholder="OpenAPI spec URL (…/openapi.json)"
                className="flex-1 min-w-[160px] px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
              />
              <button
                onClick={() => updateExternalDep(dep.id, { baseUrl: customBaseUrl, specUrl: customSpecUrl })}
                disabled={!customSpecUrl}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-info)] text-white text-xs font-medium disabled:opacity-50"
              >
                Load
              </button>
            </div>
          )}

          {/* Authentication — custom services only (registered ones are pre-integrated). */}
          {isCustom && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(dep.auth)}
                  onChange={(e) =>
                    updateExternalDep(dep.id, {
                      auth: e.target.checked
                        ? { type: 'vault', secretPath: '', usernameKey: 'username', passwordKey: 'password' }
                        : undefined,
                    })
                  }
                  className="accent-[var(--color-info)]"
                />
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  <Lock className="w-3.5 h-3.5" />
                  Requires authentication (HashiCorp Vault)
                </span>
              </label>

              {dep.auth && (
                <div className="space-y-2 p-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-border-light)]">
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-tertiary)]">
                    <Lock className="w-3 h-3" />
                    Vault
                    <code className="font-mono text-[var(--color-text-secondary)]">{VAULT_ADDRESS}</code>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                      Secret path
                    </span>
                    <input
                      value={dep.auth.secretPath}
                      onChange={(e) =>
                        updateExternalDep(dep.id, { auth: { ...dep.auth!, secretPath: e.target.value } })
                      }
                      placeholder="secret/data/my-api"
                      className="mt-0.5 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                    />
                  </label>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                        Username key
                      </span>
                      <input
                        value={dep.auth.usernameKey}
                        onChange={(e) =>
                          updateExternalDep(dep.id, { auth: { ...dep.auth!, usernameKey: e.target.value } })
                        }
                        placeholder="username"
                        className="mt-0.5 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                      />
                    </label>
                    <label className="flex-1">
                      <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                        Password key
                      </span>
                      <input
                        value={dep.auth.passwordKey}
                        onChange={(e) =>
                          updateExternalDep(dep.id, { auth: { ...dep.auth!, passwordKey: e.target.value } })
                        }
                        placeholder="password"
                        className="mt-0.5 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                      />
                    </label>
                  </div>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
                    These are the secret path and field keys in Vault — not real credentials. At
                    enforcement time the backend reads the secret, mints a bearer token, and calls
                    the API with it.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-2">
          {!dep.serviceId && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ExternalLink className="w-7 h-7 text-[var(--color-text-tertiary)]" />
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Choose a service to begin
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                Pick a service above to browse its endpoints and pull data into your input.
              </p>
            </div>
          )}
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
            const opBody = bodyFor(op);
            const resolved = resolvedValues(op);
            const reqUrl = buildRequestUrl(dep.baseUrl, op.path, op, resolved, resolvedExtras(op));
            const bodyObj = op.bodyFields.length > 0 ? resolvedBody(op) : null;
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
                        {op.parameters.map((p) => (
                          <BindingRow
                            key={p.name}
                            name={p.name}
                            kindLabel={p.in}
                            type={p.type}
                            required={p.required}
                            example={p.example}
                            cfg={opParams[p.name] ?? { source: 'static', value: '' }}
                            onChange={(patch) => setParam(op.id, p.name, patch)}
                            docPaths={docPaths}
                            configPaths={configPaths}
                            resolvedPreview={resolved[p.name]}
                            idPrefix={`p-${op.id}`}
                          />
                        ))}
                      </div>
                    )}

                    {/* Extra query parameters — dynamic filter keys the spec
                        doesn't declare (e.g. `attributes.app_id=CLAUT`). */}
                    <ExtraQueryParamsSection
                      extras={extrasFor(op)}
                      onAdd={() => addExtra(op.id)}
                      onRemove={(idx) => removeExtra(op.id, idx)}
                      onChangeName={(idx, name) => updateExtraName(op.id, idx, name)}
                      onChangeParam={(idx, patch) => updateExtraParam(op.id, idx, patch)}
                      resolveParam={resolveParam}
                      docPaths={docPaths}
                      configPaths={configPaths}
                      idPrefix={`x-${op.id}`}
                    />

                    {/* Request body */}
                    {op.bodyFields.length > 0 && (
                      <div className="space-y-2.5">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          Request body
                          <span className="ml-1.5 font-normal normal-case tracking-normal text-[var(--color-text-tertiary)]">
                            (assembled into a JSON body)
                          </span>
                        </h4>
                        {op.bodyFields.map((f) => {
                          const cfg = opBody[f.name] ?? { source: 'static', value: '' };
                          const preview =
                            cfg.source === 'static'
                              ? cfg.value
                              : (() => {
                                  const v = resolveTyped(cfg, f.type);
                                  return v === undefined
                                    ? ''
                                    : typeof v === 'object'
                                      ? JSON.stringify(v)
                                      : String(v);
                                })();
                          return (
                            <BindingRow
                              key={f.name}
                              name={f.name}
                              kindLabel="body"
                              type={f.type}
                              required={f.required}
                              example={f.example}
                              cfg={cfg}
                              onChange={(patch) => setBodyParam(op.id, f.name, patch)}
                              docPaths={docPaths}
                              configPaths={configPaths}
                              resolvedPreview={preview}
                              idPrefix={`b-${op.id}`}
                            />
                          );
                        })}

                        {/* Live JSON body preview */}
                        {bodyObj && (
                          <div className="pt-1">
                            <span className="text-[10px] text-[var(--color-text-tertiary)]">
                              Body to send
                            </span>
                            <pre className="mt-1 max-h-40 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] px-3 py-2 text-[11px] font-mono text-[var(--color-text-secondary)]">
                              {JSON.stringify(bodyObj, null, 2)}
                            </pre>
                          </div>
                        )}
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
