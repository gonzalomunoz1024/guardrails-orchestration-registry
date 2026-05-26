import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import {
  EXTERNAL_SERVICES,
  CUSTOM_SERVICE_ID,
  buildRequestUrl,
  fetchExternalData,
  fetchSpec,
} from '@/services/external/externalServices';
import { cn } from '@/utils';
import type { ExternalDependency, ParsedSpec, SwaggerOperation } from '@/types';
import { SwaggerFieldList } from './SwaggerFieldList';

interface ExternalDependencyCardProps {
  dep: ExternalDependency;
}

function sanitizeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

export function ExternalDependencyCard({ dep }: ExternalDependencyCardProps) {
  const { updateExternalDep, removeExternalDep } = usePolicyStore();

  const [spec, setSpec] = useState<ParsedSpec | null>(null);
  const [specStatus, setSpecStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [specError, setSpecError] = useState<string | null>(null);

  const [customBaseUrl, setCustomBaseUrl] = useState(dep.baseUrl);
  const [customSpecUrl, setCustomSpecUrl] = useState(dep.specUrl);

  const [showFields, setShowFields] = useState(true);
  const [showData, setShowData] = useState(true);

  const isCustom = dep.serviceId === CUSTOM_SERVICE_ID;
  const service = EXTERNAL_SERVICES.find((s) => s.id === dep.serviceId);
  const selectedOp: SwaggerOperation | undefined = spec?.operations.find(
    (o) => o.id === dep.operationId
  );

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
        e instanceof Error
          ? `${e.message}. Is the mock service running?`
          : 'Failed to load spec'
      );
    }
  }, []);

  // Auto-load the spec whenever the spec URL changes (catalog services + custom commits).
  useEffect(() => {
    if (dep.specUrl) loadSpec(dep.specUrl, dep.baseUrl);
    else setSpec(null);
  }, [dep.specUrl, dep.baseUrl, loadSpec]);

  const handleServiceChange = (serviceId: string) => {
    if (serviceId === CUSTOM_SERVICE_ID) {
      setCustomBaseUrl('');
      setCustomSpecUrl('');
      updateExternalDep(dep.id, {
        serviceId: CUSTOM_SERVICE_ID,
        baseUrl: '',
        specUrl: '',
        operationId: undefined,
        path: '',
        params: {},
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
      name: dep.name || sanitizeName(svc.id),
      baseUrl: svc.baseUrl,
      specUrl: svc.specUrl,
      operationId: undefined,
      path: '',
      params: {},
      data: null,
      status: 'idle',
      error: undefined,
    });
  };

  const handleOperationChange = (operationId: string) => {
    const op = spec?.operations.find((o) => o.id === operationId);
    if (!op) return;
    const params: Record<string, string> = {};
    for (const p of op.parameters) {
      if (p.example != null) params[p.name] = String(p.example);
    }
    updateExternalDep(dep.id, {
      operationId: op.id,
      path: op.path,
      method: op.method,
      params,
      data: null,
      status: 'idle',
      error: undefined,
    });
  };

  const handleFetch = async () => {
    if (!dep.path) return;
    const url = buildRequestUrl(dep.baseUrl, dep.path, selectedOp, dep.params);
    updateExternalDep(dep.id, { status: 'loading', error: undefined });
    try {
      const data = await fetchExternalData(url);
      updateExternalDep(dep.id, {
        data,
        status: 'success',
        fetchedAt: new Date().toISOString(),
        error: undefined,
      });
    } catch (e) {
      updateExternalDep(dep.id, {
        status: 'error',
        error: e instanceof Error ? e.message : 'Request failed',
        data: null,
      });
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-2 min-w-0">
          <Cloud className="w-4 h-4 text-[var(--color-info)] shrink-0" />
          <code className="text-xs font-mono text-[var(--color-text-secondary)] truncate">
            input.external.{dep.name || '…'}
          </code>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {dep.status === 'success' && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-success)]">
              <CheckCircle2 className="w-3.5 h-3.5" /> fetched
            </span>
          )}
          {service?.docsUrl && (
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Swagger docs"
              className="p-1 rounded hover:bg-[var(--color-border-light)] text-[var(--color-text-tertiary)] hover:text-[var(--color-info)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => removeExternalDep(dep.id)}
            title="Remove dependency"
            className="p-1 rounded hover:bg-[var(--color-error-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Name + Service */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              Reference name
            </span>
            <input
              value={dep.name}
              onChange={(e) => updateExternalDep(dep.id, { name: sanitizeName(e.target.value) })}
              placeholder="dependency"
              className="mt-1 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-mono text-[var(--color-text-primary)] focus:border-[var(--color-info)] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              Service
            </span>
            <select
              value={dep.serviceId || ''}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-info)] outline-none"
            >
              <option value="" disabled>
                Select a service…
              </option>
              {EXTERNAL_SERVICES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={CUSTOM_SERVICE_ID}>Custom URL…</option>
            </select>
          </label>
        </div>

        {service && (
          <p className="text-[11px] text-[var(--color-text-tertiary)]">{service.description}</p>
        )}

        {/* Custom URL entry */}
        {isCustom && (
          <div className="space-y-2 p-2 rounded-[var(--radius-md)] bg-[var(--color-surface-secondary)]">
            <input
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              placeholder="Base URL (https://api.example.com)"
              className="w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
            />
            <div className="flex gap-2">
              <input
                value={customSpecUrl}
                onChange={(e) => setCustomSpecUrl(e.target.value)}
                placeholder="OpenAPI spec URL (…/openapi.json)"
                className="flex-1 px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
              />
              <button
                onClick={() =>
                  updateExternalDep(dep.id, { baseUrl: customBaseUrl, specUrl: customSpecUrl })
                }
                disabled={!customSpecUrl}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-info)] text-white text-xs font-medium disabled:opacity-50"
              >
                Load
              </button>
            </div>
          </div>
        )}

        {/* Spec status */}
        {specStatus === 'loading' && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading API spec…
          </p>
        )}
        {specStatus === 'error' && specError && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="w-3.5 h-3.5" /> {specError}
          </p>
        )}

        {/* Operation selection */}
        {spec && (
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              Endpoint
            </span>
            <select
              value={dep.operationId || ''}
              onChange={(e) => handleOperationChange(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-info)] outline-none"
            >
              <option value="" disabled>
                Select an endpoint…
              </option>
              {spec.operations.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.method} {op.path} {op.summary ? `— ${op.summary}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Parameters */}
        {selectedOp && selectedOp.parameters.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              Parameters
            </span>
            {selectedOp.parameters.map((p) => (
              <label key={p.name} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-xs font-mono text-[var(--color-text-secondary)]">
                  {p.name}
                  {p.required && <span className="text-[var(--color-error)]">*</span>}
                  <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">({p.in})</span>
                </span>
                <input
                  value={dep.params[p.name] ?? ''}
                  onChange={(e) =>
                    updateExternalDep(dep.id, {
                      params: { ...dep.params, [p.name]: e.target.value },
                    })
                  }
                  placeholder={p.example ? String(p.example) : p.type}
                  className="flex-1 px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-mono text-[var(--color-text-primary)] outline-none focus:border-[var(--color-info)]"
                />
              </label>
            ))}
          </div>
        )}

        {/* Fetch button */}
        {selectedOp && (
          <button
            onClick={handleFetch}
            disabled={dep.status === 'loading'}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)]',
              'bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {dep.status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : dep.status === 'success' ? (
              <RefreshCw className="w-4 h-4" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {dep.status === 'loading'
              ? 'Fetching…'
              : dep.status === 'success'
                ? 'Re-fetch'
                : 'Fetch data'}
          </button>
        )}

        {dep.status === 'error' && dep.error && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="w-3.5 h-3.5" /> {dep.error}
          </p>
        )}

        {/* Available fields */}
        {selectedOp && (
          <div>
            <button
              onClick={() => setShowFields((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {showFields ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Available fields (click to copy a Rego reference)
            </button>
            {showFields && (
              <div className="mt-1.5">
                <SwaggerFieldList fields={selectedOp.responseFields} depName={dep.name} />
              </div>
            )}
          </div>
        )}

        {/* Fetched data preview */}
        {dep.data != null && (
          <div>
            <button
              onClick={() => setShowData((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              {showData ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Fetched data
              {dep.fetchedAt && (
                <span className="ml-1 text-[10px] text-[var(--color-text-tertiary)]">
                  {new Date(dep.fetchedAt).toLocaleTimeString()}
                </span>
              )}
            </button>
            {showData && (
              <pre className="mt-1.5 max-h-40 overflow-auto rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)] px-3 py-2 text-xs font-mono text-[var(--color-text-secondary)]">
                {JSON.stringify(dep.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
