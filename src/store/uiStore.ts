import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
type SidePanel = 'datasources' | 'blastRadius' | 'metadata' | null;

interface UIState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  sidePanel: SidePanel;
  isCreatePRModalOpen: boolean;

  setTheme: (theme: Theme) => void;
  setResolvedTheme: (theme: 'light' | 'dark') => void;
  setSidePanel: (panel: SidePanel) => void;
  toggleSidePanel: (panel: SidePanel) => void;
  setCreatePRModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      resolvedTheme: 'light',
      sidePanel: null,
      isCreatePRModalOpen: false,

      setTheme: (theme) => set({ theme }),
      setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),
      setSidePanel: (sidePanel) => set({ sidePanel }),
      toggleSidePanel: (panel) =>
        set((state) => ({
          sidePanel: state.sidePanel === panel ? null : panel,
        })),
      setCreatePRModalOpen: (open) => set({ isCreatePRModalOpen: open }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidePanel: state.sidePanel,
      }),
    }
  )
);
