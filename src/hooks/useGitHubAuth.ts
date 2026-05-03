import { useCallback, useState } from 'react';
import { useAuthStore } from '@/store';
import { githubApi, DeviceCodeResponse, GitHubUser } from '@/services/api/githubApi';

export function useGitHubAuth() {
  const { isAuthenticated, user, setAuth, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);

  const loginWithDeviceFlow = useCallback(async (): Promise<GitHubUser | null> => {
    setIsLoading(true);
    setError(null);
    setDeviceCode(null);

    try {
      const result = await githubApi.loginWithDeviceFlow(
        (codeResponse) => {
          setDeviceCode(codeResponse);
        }
      );

      setAuth(result.user, result.token);
      return result.user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
      setDeviceCode(null);
    }
  }, [setAuth]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const cancelLogin = useCallback(() => {
    setDeviceCode(null);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isAuthenticated,
    user,
    loginWithDeviceFlow,
    logout,
    isLoading,
    error,
    deviceCode,
    clearError,
    cancelLogin,
  };
}
