import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExternalDependency, PolicyMetadata } from '@/types';
import type { ResourceType } from '@/types/registry.types';
import type { EnforcementType } from '@/types/guardrail.types';

interface PolicyState {
  regoCode: string;
  inputJson: string;
  configJson: string;
  /** Whether the static configuration block is part of the input. */
  configEnabled: boolean;
  /** Dynamic external dependencies injected under input.external.<name>. */
  externalDeps: ExternalDependency[];
  metadata: PolicyMetadata;
  // Authoring details (persisted so a draft fully survives a reload).
  resourceType: ResourceType;
  resourceKind: string;
  enforcementType: EnforcementType;
  tags: string[];
  /** ISO timestamp of the last explicit "Save draft", or null. */
  lastSavedAt: string | null;
  isDirty: boolean;

  setRegoCode: (code: string) => void;
  setInputJson: (json: string) => void;
  setConfigJson: (json: string) => void;
  setConfigEnabled: (enabled: boolean) => void;
  addExternalDep: (dep: ExternalDependency) => void;
  updateExternalDep: (id: string, patch: Partial<ExternalDependency>) => void;
  removeExternalDep: (id: string) => void;
  updateMetadata: (metadata: Partial<PolicyMetadata>) => void;
  setResourceType: (rt: ResourceType) => void;
  setResourceKind: (rk: string) => void;
  setEnforcementType: (et: EnforcementType) => void;
  setTags: (tags: string[]) => void;
  saveDraft: () => void;
  resetPolicy: () => void;
  markClean: () => void;
}

const initialMetadata: PolicyMetadata = {
  name: '',
  description: '',
  tags: [],
  version: '1.0.0',
  author: '',
};

const defaultRegoCode = `package policy

default allow := false

# Example: Check input data directly
allow if {
    input.user.role == "admin"
}

# Example: Use configuration data
allow if {
    input.configuration.allowAll == true
}

# Example: Deny with message based on guardrail
deny[msg] if {
    input.guardrail.enforcementType == "MANDATORY"
    not allow
    msg := sprintf("Guardrail %s: access denied", [input.guardrail.name])
}
`;

const defaultInputJson = `{
  "user": {
    "role": "admin"
  }
}`;

const defaultConfigJson = '{}';

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set) => ({
      regoCode: defaultRegoCode,
      inputJson: defaultInputJson,
      configJson: defaultConfigJson,
      configEnabled: false,
      externalDeps: [],
      metadata: initialMetadata,
      resourceType: 'lightspeed',
      resourceKind: '',
      enforcementType: 'MANDATORY',
      tags: [],
      lastSavedAt: null,
      isDirty: false,

      setRegoCode: (code) => set({ regoCode: code, isDirty: true }),
      setInputJson: (json) => set({ inputJson: json, isDirty: true }),
      setConfigJson: (json) => set({ configJson: json, isDirty: true }),
      setConfigEnabled: (enabled) => set({ configEnabled: enabled, isDirty: true }),
      addExternalDep: (dep) =>
        set((state) => ({ externalDeps: [...state.externalDeps, dep], isDirty: true })),
      updateExternalDep: (id, patch) =>
        set((state) => ({
          externalDeps: state.externalDeps.map((d) =>
            d.id === id ? { ...d, ...patch } : d
          ),
          isDirty: true,
        })),
      removeExternalDep: (id) =>
        set((state) => ({
          externalDeps: state.externalDeps.filter((d) => d.id !== id),
          isDirty: true,
        })),
      updateMetadata: (metadata) =>
        set((state) => ({
          metadata: { ...state.metadata, ...metadata },
          isDirty: true,
        })),
      setResourceType: (resourceType) => set({ resourceType, isDirty: true }),
      setResourceKind: (resourceKind) => set({ resourceKind, isDirty: true }),
      setEnforcementType: (enforcementType) => set({ enforcementType, isDirty: true }),
      setTags: (tags) => set({ tags, isDirty: true }),
      saveDraft: () => set({ lastSavedAt: new Date().toISOString(), isDirty: false }),
      resetPolicy: () =>
        set({
          regoCode: defaultRegoCode,
          inputJson: defaultInputJson,
          configJson: defaultConfigJson,
          configEnabled: false,
          externalDeps: [],
          metadata: initialMetadata,
          resourceType: 'lightspeed',
          resourceKind: '',
          enforcementType: 'MANDATORY',
          tags: [],
          lastSavedAt: null,
          isDirty: false,
        }),
      markClean: () => set({ isDirty: false }),
    }),
    {
      name: 'policy-storage',
      partialize: (state) => ({
        regoCode: state.regoCode,
        inputJson: state.inputJson,
        configJson: state.configJson,
        configEnabled: state.configEnabled,
        // Never persist Vault passwords to local storage.
        externalDeps: state.externalDeps.map((d) =>
          d.auth ? { ...d, auth: { ...d.auth, password: '' } } : d
        ),
        metadata: state.metadata,
        resourceType: state.resourceType,
        resourceKind: state.resourceKind,
        enforcementType: state.enforcementType,
        tags: state.tags,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);
