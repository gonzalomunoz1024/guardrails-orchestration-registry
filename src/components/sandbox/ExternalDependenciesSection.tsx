import { Cloud, Plus } from 'lucide-react';
import { usePolicyStore } from '@/store';
import { EXTERNAL_SERVICES } from '@/services/external/externalServices';
import type { ExternalDependency } from '@/types';
import { ExternalDependencyCard } from './ExternalDependencyCard';

function createDependency(): ExternalDependency {
  // Default to the first catalog service for a one-click happy path.
  const svc = EXTERNAL_SERVICES[0];
  return {
    id: crypto.randomUUID(),
    name: svc ? svc.id.replace(/-/g, '_') : 'dependency',
    serviceId: svc?.id ?? '',
    baseUrl: svc?.baseUrl ?? '',
    specUrl: svc?.specUrl ?? '',
    method: 'GET',
    path: '',
    params: {},
    data: null,
    status: 'idle',
  };
}

export function ExternalDependenciesSection() {
  const { externalDeps, addExternalDep } = usePolicyStore();

  return (
    <div className="space-y-3">
      {externalDeps.length === 0 ? (
        <button
          onClick={() => addExternalDep(createDependency())}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
        >
          <Cloud className="w-6 h-6" />
          <span className="text-sm font-medium">Add an external dependency</span>
          <span className="text-xs">Fetch live data from an API into input.external</span>
        </button>
      ) : (
        <>
          {externalDeps.map((dep) => (
            <ExternalDependencyCard key={dep.id} dep={dep} />
          ))}
          <button
            onClick={() => addExternalDep(createDependency())}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add another dependency
          </button>
        </>
      )}
    </div>
  );
}
