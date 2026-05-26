import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  ExternalLink,
  Sliders,
  Trash2,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import {
  EXTERNAL_SERVICES,
  CUSTOM_SERVICE_ID,
} from '@/services/external/externalServices';
import { cn } from '@/utils';
import type { ExternalDependency } from '@/types';
import { ExternalDependencyModal } from './ExternalDependencyModal';

interface ExternalDependencyCardProps {
  dep: ExternalDependency;
}

function sanitizeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

export function ExternalDependencyCard({ dep }: ExternalDependencyCardProps) {
  const { updateExternalDep, removeExternalDep } = usePolicyStore();

  const [explorerOpen, setExplorerOpen] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState(dep.baseUrl);
  const [customSpecUrl, setCustomSpecUrl] = useState(dep.specUrl);

  const isCustom = dep.serviceId === CUSTOM_SERVICE_ID;
  const service = EXTERNAL_SERVICES.find((s) => s.id === dep.serviceId);

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
    // Selecting a service pops the explorer for more real estate.
    setExplorerOpen(true);
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
          {dep.status === 'error' && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--color-error)]">
              <AlertCircle className="w-3.5 h-3.5" /> error
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
                onClick={() => {
                  updateExternalDep(dep.id, { baseUrl: customBaseUrl, specUrl: customSpecUrl });
                  if (customSpecUrl) setExplorerOpen(true);
                }}
                disabled={!customSpecUrl}
                className="px-3 py-1.5 rounded-[var(--radius-sm)] bg-[var(--color-info)] text-white text-xs font-medium disabled:opacity-50"
              >
                Load
              </button>
            </div>
          </div>
        )}

        {/* Selected endpoint summary + explorer launcher */}
        {dep.specUrl && (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-xs text-[var(--color-text-secondary)]">
              {dep.path ? (
                <span className="flex items-center gap-1.5 truncate">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-info-bg)] text-[var(--color-info)]">
                    {dep.method}
                  </span>
                  <code className="font-mono truncate">{dep.path}</code>
                </span>
              ) : (
                <span className="text-[var(--color-text-tertiary)]">No endpoint selected</span>
              )}
            </div>
            <button
              onClick={() => setExplorerOpen(true)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-sm font-medium text-[var(--color-text-primary)]',
                'border border-[var(--color-border-light)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors'
              )}
            >
              <Sliders className="w-3.5 h-3.5" />
              API explorer
            </button>
          </div>
        )}

        {dep.status === 'error' && dep.error && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-error)]">
            <AlertCircle className="w-3.5 h-3.5" /> {dep.error}
          </p>
        )}
      </div>

      <ExternalDependencyModal
        dep={dep}
        isOpen={explorerOpen}
        onClose={() => setExplorerOpen(false)}
      />
    </div>
  );
}
