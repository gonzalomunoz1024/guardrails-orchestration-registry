import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RegistryPolicy } from '@/types';
import type { GuardrailSuite } from '@/types/suite.types';

export type ViewType =
  | 'dashboard'
  | 'policies'
  | 'policy-detail'
  | 'blast-radius'
  | 'create-policy'
  | 'suites'
  | 'suite-detail'
  | 'suite-builder';

interface RegistryState {
  currentView: ViewType;
  selectedPolicyId: string | null;
  selectedSuiteId: string | null;
  searchQuery: string;
  selectedResourceType: string | null;
  selectedResourceKind: string | null;
  selectedStatus: string | null;
  sidebarCollapsed: boolean;
  /**
   * One-shot hint from PolicyDetail's "Blast Radius" button: tells the
   * studio to pop its blast-radius drawer the moment it mounts so users
   * don't have to click "Blast radius" again after the load-into-studio
   * navigation. Cleared by the studio when consumed.
   */
  autoOpenBlastRadius: boolean;

  setView: (view: ViewType) => void;
  selectPolicy: (policyId: string | null) => void;
  selectSuite: (suiteId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedResourceType: (resourceType: string | null) => void;
  setSelectedResourceKind: (resourceKind: string | null) => void;
  setSelectedStatus: (status: string | null) => void;
  toggleSidebar: () => void;
  setAutoOpenBlastRadius: (open: boolean) => void;
  navigateToPolicy: (policy: RegistryPolicy) => void;
  navigateToBlastRadius: (policyId?: string) => void;
  navigateToSuite: (suite: GuardrailSuite) => void;
  navigateToSuiteBuilder: (suiteId?: string) => void;
}

/**
 * Persisted in localStorage so a browser refresh keeps the user on the same
 * view (catalog → catalog, suite-detail → suite-detail) instead of bouncing
 * back to the dashboard. Selected ids ride along so a refreshed detail page
 * re-resolves the same record from React Query on mount. Search/filters are
 * intentionally NOT persisted — they're transient input, not navigation.
 */
export const useRegistryStore = create<RegistryState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      selectedPolicyId: null,
      selectedSuiteId: null,
      searchQuery: '',
      selectedResourceType: null,
      selectedResourceKind: null,
      selectedStatus: null,
      sidebarCollapsed: false,
      autoOpenBlastRadius: false,

      setView: (view) => set({ currentView: view, selectedPolicyId: null, selectedSuiteId: null }),
      selectPolicy: (policyId) => set({ selectedPolicyId: policyId }),
      selectSuite: (suiteId) => set({ selectedSuiteId: suiteId }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedResourceType: (resourceType) => set({ selectedResourceType: resourceType }),
      setSelectedResourceKind: (resourceKind) => set({ selectedResourceKind: resourceKind }),
      setSelectedStatus: (status) => set({ selectedStatus: status }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setAutoOpenBlastRadius: (open) => set({ autoOpenBlastRadius: open }),
      navigateToPolicy: (policy) => set({ currentView: 'policy-detail', selectedPolicyId: policy.id }),
      navigateToBlastRadius: (policyId) => set({
        currentView: 'blast-radius',
        selectedPolicyId: policyId || null
      }),
      navigateToSuite: (suite) => set({ currentView: 'suite-detail', selectedSuiteId: suite.suiteId }),
      navigateToSuiteBuilder: (suiteId) => set({
        currentView: 'suite-builder',
        selectedSuiteId: suiteId || null,
      }),
    }),
    {
      name: 'registry-nav',
      version: 1,
      // Only the navigation slice rides through a refresh — filters and
      // search are transient and would surprise users if they came back.
      partialize: (state) => ({
        currentView: state.currentView,
        selectedPolicyId: state.selectedPolicyId,
        selectedSuiteId: state.selectedSuiteId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
