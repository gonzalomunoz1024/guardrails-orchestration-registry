import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Radius,
  PlusCircle,
  Settings,
  Shield,
  Layers,
} from 'lucide-react';
import { useRegistryStore, type ViewType } from '@/store/registryStore';
import { startNewDraft } from '@/store/draftActions';
import { cn } from '@/utils';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'policies', label: 'Guardrails', icon: <FileText className="w-5 h-5" /> },
  { id: 'suites', label: 'Suites', icon: <Layers className="w-5 h-5" /> },
  { id: 'blast-radius', label: 'Blast Radius', icon: <Radius className="w-5 h-5" /> },
  { id: 'create-policy', label: 'Create Guardrail', icon: <PlusCircle className="w-5 h-5" /> },
];

export function Sidebar() {
  const { currentView, setView } = useRegistryStore();
  // Collapsed to an icon rail by default; expands while hovered.
  const [expanded, setExpanded] = useState(false);

  // Keep the section lit across its sub-views (detail/builder).
  const isActive = (id: ViewType) =>
    currentView === id ||
    (id === 'suites' && (currentView === 'suite-detail' || currentView === 'suite-builder')) ||
    (id === 'policies' && currentView === 'policy-detail');

  return (
    // Fixed-width rail footprint keeps page content from shifting; the panel
    // overlays on top when expanded.
    <div className="relative h-full w-16 shrink-0">
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          'absolute top-0 left-0 z-40 h-full flex flex-col',
          'border-r border-[var(--color-border-light)] bg-[var(--color-surface)]',
          'transition-all duration-300 ease-out',
          expanded ? 'w-64 shadow-[var(--shadow-lg)]' : 'w-16'
        )}
      >
        {/* Logo — doubles as the home button. */}
        <div className="h-14 flex items-center px-4 border-b border-[var(--color-border-light)]">
          <button
            onClick={() => setView('dashboard')}
            aria-label="Go to dashboard"
            className={cn(
              'flex items-center gap-3 rounded-[var(--radius-md)] outline-none',
              'focus-visible:ring-2 focus-visible:ring-[var(--color-info)]',
              !expanded && 'justify-center w-full'
            )}
          >
            <div className="w-8 h-8 shrink-0 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-info)] to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {expanded && (
              <span className="font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                Guardrail Registry
              </span>
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                // Create Guardrail always starts fresh — stash the current
                // studio body (if any) into draftStore so nothing is lost.
                if (item.id === 'create-policy') startNewDraft();
                setView(item.id);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all',
                isActive(item.id)
                  ? 'bg-[var(--color-info)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]',
                !expanded && 'justify-center px-2'
              )}
              title={!expanded ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {expanded && (
                <>
                  <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-white/20">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-[var(--color-border-light)]">
          <button
            onClick={() => {}}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all',
              'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]',
              !expanded && 'justify-center px-2'
            )}
            title={!expanded ? 'Settings' : undefined}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {expanded && <span className="text-sm font-medium whitespace-nowrap">Settings</span>}
          </button>
        </div>
      </aside>
    </div>
  );
}
