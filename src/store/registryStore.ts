import { create } from 'zustand';
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

  setView: (view: ViewType) => void;
  selectPolicy: (policyId: string | null) => void;
  selectSuite: (suiteId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedResourceType: (resourceType: string | null) => void;
  setSelectedResourceKind: (resourceKind: string | null) => void;
  setSelectedStatus: (status: string | null) => void;
  toggleSidebar: () => void;
  navigateToPolicy: (policy: RegistryPolicy) => void;
  navigateToBlastRadius: (policyId?: string) => void;
  navigateToSuite: (suite: GuardrailSuite) => void;
  navigateToSuiteBuilder: (suiteId?: string) => void;
}

export const useRegistryStore = create<RegistryState>((set) => ({
  currentView: 'dashboard',
  selectedPolicyId: null,
  selectedSuiteId: null,
  searchQuery: '',
  selectedResourceType: null,
  selectedResourceKind: null,
  selectedStatus: null,
  sidebarCollapsed: false,

  setView: (view) => set({ currentView: view, selectedPolicyId: null, selectedSuiteId: null }),
  selectPolicy: (policyId) => set({ selectedPolicyId: policyId }),
  selectSuite: (suiteId) => set({ selectedSuiteId: suiteId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedResourceType: (resourceType) => set({ selectedResourceType: resourceType }),
  setSelectedResourceKind: (resourceKind) => set({ selectedResourceKind: resourceKind }),
  setSelectedStatus: (status) => set({ selectedStatus: status }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
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
}));
