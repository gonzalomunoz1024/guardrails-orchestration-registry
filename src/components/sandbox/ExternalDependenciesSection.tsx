import { useState } from 'react';
import { Cloud, Plus } from 'lucide-react';
import { usePolicyStore } from '@/store';
import type { ExternalDependency } from '@/types';
import { ExternalDependencyCard } from './ExternalDependencyCard';

/** A blank dependency — the service is chosen in the API explorer, not here. */
function createDependency(): ExternalDependency {
  return {
    id: crypto.randomUUID(),
    name: '',
    serviceId: '',
    baseUrl: '',
    specUrl: '',
    method: 'GET',
    path: '',
    params: {},
    data: null,
    status: 'idle',
  };
}

export function ExternalDependenciesSection() {
  const { externalDeps, addExternalDep } = usePolicyStore();
  // Which dependency's API explorer is open (also opened right after adding one).
  const [openDepId, setOpenDepId] = useState<string | null>(null);

  const handleAdd = () => {
    const dep = createDependency();
    addExternalDep(dep);
    setOpenDepId(dep.id);
  };

  return (
    <div className="space-y-3">
      {externalDeps.length === 0 ? (
        <button
          onClick={handleAdd}
          className="w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
        >
          <Cloud className="w-6 h-6" />
          <span className="text-sm font-medium">Add an external dependency</span>
          <span className="text-xs">Opens the API explorer to pick a service</span>
        </button>
      ) : (
        <>
          {externalDeps.map((dep) => (
            <ExternalDependencyCard
              key={dep.id}
              dep={dep}
              isExplorerOpen={openDepId === dep.id}
              onOpenExplorer={() => setOpenDepId(dep.id)}
              onCloseExplorer={() => setOpenDepId(null)}
            />
          ))}
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add another dependency
          </button>
        </>
      )}
    </div>
  );
}
