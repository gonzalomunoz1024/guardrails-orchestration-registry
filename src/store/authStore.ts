import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  accessToken: string | null;

  setAuth: (user: GitHubUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      accessToken: null,

      setAuth: (user, token) =>
        set({
          isAuthenticated: true,
          user,
          accessToken: token,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
      }),
    }
  )
);
