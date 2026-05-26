import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar, TopBar } from '@/components/layout';
import { Dashboard, PolicyCatalog, PolicyDetail, BlastRadius } from '@/components/views';
import { PolicyStudio } from '@/components/studio';
import { DeviceFlowLogin } from '@/components/auth/DeviceFlowLogin';
import { useRegistryStore } from '@/store/registryStore';
import { useAuthStore } from '@/store/authStore';
import { githubApi } from '@/services/api/githubApi';
import { useTheme } from '@/hooks';
import { Loader2 } from 'lucide-react';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function LoginScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="p-8 rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] border border-[var(--color-border-light)]">
        <DeviceFlowLogin />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-[var(--color-background)]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-info)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">Loading...</p>
      </div>
    </div>
  );
}

function AppContent() {
  useTheme();
  const { currentView } = useRegistryStore();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'policies':
        return <PolicyCatalog />;
      case 'policy-detail':
        return <PolicyDetail />;
      case 'blast-radius':
        return <BlastRadius />;
      case 'create-policy':
        return <PolicyStudio />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex bg-[var(--color-background)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-hidden bg-[var(--color-surface-secondary)]">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  useTheme();
  const { isAuthenticated, accessToken, setAuth, logout } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);

  // On mount, validate the stored token
  useEffect(() => {
    async function validateToken() {
      if (accessToken) {
        const user = await githubApi.validateToken(accessToken);
        if (user) {
          // Token is still valid, update user info in case it changed
          setAuth(user, accessToken);
        } else {
          // Token is invalid, logout
          logout();
        }
      }
      setIsValidating(false);
    }

    validateToken();
  }, [accessToken, setAuth, logout]);

  if (isValidating) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <AppContent />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedApp />
    </QueryClientProvider>
  );
}

export default App;
