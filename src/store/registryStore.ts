import { create } from 'zustand';
import type { RegistryPolicy } from '@/types';

export type ViewType = 'dashboard' | 'policies' | 'policy-detail' | 'blast-radius' | 'create-policy';

interface RegistryState {
  currentView: ViewType;
  selectedPolicyId: string | null;
  searchQuery: string;
  selectedResourceType: string | null;
  selectedResourceKind: string | null;
  selectedStatus: string | null;
  sidebarCollapsed: boolean;

  setView: (view: ViewType) => void;
  selectPolicy: (policyId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSelectedResourceType: (resourceType: string | null) => void;
  setSelectedResourceKind: (resourceKind: string | null) => void;
  setSelectedStatus: (status: string | null) => void;
  toggleSidebar: () => void;
  navigateToPolicy: (policy: RegistryPolicy) => void;
  navigateToBlastRadius: (policyId?: string) => void;
}

export const useRegistryStore = create<RegistryState>((set) => ({
  currentView: 'dashboard',
  selectedPolicyId: null,
  searchQuery: '',
  selectedResourceType: null,
  selectedResourceKind: null,
  selectedStatus: null,
  sidebarCollapsed: false,

  setView: (view) => set({ currentView: view, selectedPolicyId: null }),
  selectPolicy: (policyId) => set({ selectedPolicyId: policyId }),
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
}));
