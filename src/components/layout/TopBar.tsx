import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Moon, Sun, LogOut, ChevronDown, Compass } from 'lucide-react';
import { useTheme } from '@/hooks';
import { useRegistryStore } from '@/store/registryStore';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils';

interface AppNotification {
  id: string;
  title: string;
  detail?: string;
  unread?: boolean;
}

function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // No notification feed wired up yet — surface an honest empty state.
  const notifications: AppNotification[] = [];
  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        title="Notifications"
        aria-label="Notifications"
        className={cn(
          'relative p-2 rounded-[var(--radius-md)] transition-all',
          'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-surface-secondary)]',
          isOpen && 'bg-[var(--color-surface-secondary)]'
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-error)]" />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full mt-2 w-80 max-h-96 overflow-auto py-1',
            'rounded-[var(--radius-md)] border border-[var(--color-border-light)]',
            'bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-fade-in z-50'
          )}
        >
          <div className="px-3 py-2 border-b border-[var(--color-border-light)]">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </span>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <Bell className="w-6 h-6 text-[var(--color-text-tertiary)]" />
              <p className="text-sm text-[var(--color-text-secondary)]">You're all caught up</p>
              <p className="text-xs text-[var(--color-text-tertiary)]">No new notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2 px-3 py-2.5 hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                {n.unread && (
                  <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-[var(--color-info)]" />
                )}
                <div className={cn('min-w-0', !n.unread && 'pl-4')}>
                  <p className="text-sm text-[var(--color-text-primary)]">{n.title}</p>
                  {n.detail && (
                    <p className="text-xs text-[var(--color-text-tertiary)]">{n.detail}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface UserMenuProps {
  user: {
    login: string;
    name: string | null;
    avatar_url: string;
  };
  onLogout: () => void;
}

function UserMenu({ user, onLogout }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-3 p-1.5 pr-3 rounded-[var(--radius-md)] transition-all',
          'hover:bg-[var(--color-surface-secondary)]',
          isOpen && 'bg-[var(--color-surface-secondary)]'
        )}
      >
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-8 h-8 rounded-full object-cover border-2 border-[var(--color-border-light)]"
        />
        <div className="text-left">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {user.name || user.login}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            @{user.login}
          </p>
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-[var(--color-text-tertiary)] transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {isOpen && (
        <div className={cn(
          'absolute right-0 top-full mt-2 w-48 py-1',
          'rounded-[var(--radius-md)] border border-[var(--color-border-light)]',
          'bg-[var(--color-surface)] shadow-[var(--shadow-lg)]',
          'animate-fade-in z-50'
        )}>
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 text-sm',
              'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]',
              'transition-colors'
            )}
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

const viewTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  policies: 'Guardrail Catalog',
  'policy-detail': 'Guardrail Details',
  'blast-radius': 'Blast Radius Testing',
  'create-policy': 'Create New Guardrail',
};

export function TopBar() {
  const { currentView, searchQuery, setSearchQuery } = useRegistryStore();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
      {/* Title */}
      <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
        {viewTitles[currentView] || 'Guardrail Registry'}
      </h1>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        {(currentView === 'policies' || currentView === 'dashboard') && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              placeholder="Search guardrails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                'w-64 pl-9 pr-4 py-2 rounded-[var(--radius-md)]',
                'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]',
                'placeholder:text-[var(--color-text-tertiary)]',
                'border border-transparent focus:border-[var(--color-info)] focus:outline-none',
                'transition-all text-sm'
              )}
            />
          </div>
        )}

        {/* Onboarding / tour — opens a static explainer page that we ship in
            public/ so a newcomer can read how the guardrail studio works
            without needing a guide. New tab so it doesn't yank them out of
            whatever they were doing. */}
        <a
          href="/onboarding.html"
          target="_blank"
          rel="noopener noreferrer"
          title="How Guardrail Studio works"
          aria-label="How Guardrail Studio works"
          className={cn(
            'p-2 rounded-[var(--radius-md)] transition-all',
            'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-surface-secondary)]'
          )}
        >
          <Compass className="w-5 h-5" />
        </a>

        {/* Notifications */}
        <NotificationsMenu />

        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          className={cn(
            'p-2 rounded-[var(--radius-md)] transition-all',
            'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-surface-secondary)]'
          )}
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-[var(--color-border-light)]" />

        {/* User Menu */}
        {user && (
          <UserMenu user={user} onLogout={logout} />
        )}
      </div>
    </header>
  );
}
