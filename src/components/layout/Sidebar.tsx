import {
  LayoutDashboard,
  FileText,
  Radius,
  PlusCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useRegistryStore, type ViewType } from '@/store/registryStore';
import { cn } from '@/utils';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'policies', label: 'Policies', icon: <FileText className="w-5 h-5" /> },
  { id: 'blast-radius', label: 'Blast Radius', icon: <Radius className="w-5 h-5" /> },
  { id: 'create-policy', label: 'Create Policy', icon: <PlusCircle className="w-5 h-5" /> },
];

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar } = useRegistryStore();

  return (
    <aside
      className={cn(
        'h-full flex flex-col border-r border-[var(--color-border-light)] bg-[var(--color-surface)] transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--color-border-light)]">
        <div className={cn('flex items-center gap-3', sidebarCollapsed && 'justify-center w-full')}>
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-info)] to-purple-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-[var(--color-text-primary)]">
              Policy Registry
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all',
              currentView === item.id
                ? 'bg-[var(--color-info)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]',
              sidebarCollapsed && 'justify-center px-2'
            )}
            title={sidebarCollapsed ? item.label : undefined}
          >
            {item.icon}
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
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
            sidebarCollapsed && 'justify-center px-2'
          )}
          title={sidebarCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-5 h-5" />
          {!sidebarCollapsed && (
            <span className="text-sm font-medium">Settings</span>
          )}
        </button>

        <button
          onClick={toggleSidebar}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] transition-all mt-1',
            'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]',
            sidebarCollapsed && 'justify-center px-2'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
