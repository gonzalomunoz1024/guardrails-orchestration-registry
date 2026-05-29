import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExternalDependency, PolicyMetadata } from '@/types';
import type { ResourceKind, Stage, EnforcementType, GuardrailStatus } from '@/types/guardrail.types';

export interface InputExample {
  name: string;
  payload: string;
}

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
  resourceKind: ResourceKind;
  stage: Stage;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  tags: string[];
  /** The version loaded when editing an existing guardrail (null = brand new). */
  baseVersion: string | null;
  // Contract baseline captured at load time. Used to decide whether the
  // version should auto-bump on publish (contract changed → bump minor; only
  // metadata changed → keep version, overwrite metadata files in place).
  baseRego: string | null;
  baseInputSchemaJson: string | null;
  baseInputExamplesJson: string | null;
  // Input schema contract (the document the policy evaluates).
  inputSchemaJson: string;
  inputSchemaAuto: boolean;
  inputExamples: InputExample[];
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
  setResourceKind: (rk: ResourceKind) => void;
  setStage: (stage: Stage) => void;
  setStatus: (status: GuardrailStatus) => void;
  setEnforcementType: (et: EnforcementType) => void;
  setTags: (tags: string[]) => void;
  setInputSchemaJson: (json: string) => void;
  setInputSchemaAuto: (auto: boolean) => void;
  setInputExamples: (examples: InputExample[]) => void;
  saveDraft: () => void;
  resetPolicy: () => void;
  markClean: () => void;
  /** Load an existing guardrail into the studio and pin the baseline. */
  loadForEdit: (payload: LoadForEditPayload) => void;
}

/**
 * Payload for `loadForEdit`. Caller passes the existing guardrail's full state
 * — the store snapshots it as the contract baseline so future edits can be
 * compared (rego/schema/examples → version bump; everything else → no bump).
 */
export interface LoadForEditPayload {
  regoCode: string;
  configJson: string;
  configEnabled: boolean;
  inputJson?: string;
  inputSchemaJson: string;
  inputExamples: InputExample[];
  externalDeps?: ExternalDependency[];
  metadata: PolicyMetadata;
  resourceKind: ResourceKind;
  stage: Stage;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  tags: string[];
  /** The current immutable version of the guardrail being edited. */
  baseVersion: string;
}

const initialMetadata: PolicyMetadata = {
  name: '',
  description: '',
  tags: [],
  version: '1.0',
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

const initialState = {
  regoCode: defaultRegoCode,
  inputJson: defaultInputJson,
  configJson: defaultConfigJson,
  configEnabled: false,
  externalDeps: [] as ExternalDependency[],
  metadata: initialMetadata,
  resourceKind: 'VIRTUAL_MACHINE' as ResourceKind,
  stage: 'PRECHECK' as Stage,
  status: 'DRAFT' as GuardrailStatus,
  enforcementType: 'MANDATORY' as EnforcementType,
  tags: [] as string[],
  baseVersion: null as string | null,
  baseRego: null as string | null,
  baseInputSchemaJson: null as string | null,
  baseInputExamplesJson: null as string | null,
  inputSchemaJson: '{}',
  inputSchemaAuto: true,
  inputExamples: [] as InputExample[],
  lastSavedAt: null as string | null,
  isDirty: false,
};

export const usePolicyStore = create<PolicyState>()(
  persist(
    (set) => ({
      ...initialState,

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
      setResourceKind: (resourceKind) => set({ resourceKind, isDirty: true }),
      setStage: (stage) => set({ stage, isDirty: true }),
      setStatus: (status) => set({ status, isDirty: true }),
      setEnforcementType: (enforcementType) => set({ enforcementType, isDirty: true }),
      setTags: (tags) => set({ tags, isDirty: true }),
      setInputSchemaJson: (inputSchemaJson) => set({ inputSchemaJson, isDirty: true }),
      setInputSchemaAuto: (inputSchemaAuto) => set({ inputSchemaAuto, isDirty: true }),
      setInputExamples: (inputExamples) => set({ inputExamples, isDirty: true }),
      saveDraft: () => set({ lastSavedAt: new Date().toISOString(), isDirty: false }),
      resetPolicy: () => set({ ...initialState }),
      markClean: () => set({ isDirty: false }),
      loadForEdit: (p) =>
        set({
          ...initialState,
          regoCode: p.regoCode,
          configJson: p.configJson,
          configEnabled: p.configEnabled,
          inputJson: p.inputJson ?? initialState.inputJson,
          externalDeps: p.externalDeps ?? [],
          metadata: { ...p.metadata },
          resourceKind: p.resourceKind,
          stage: p.stage,
          status: p.status,
          enforcementType: p.enforcementType,
          tags: p.tags,
          inputSchemaJson: p.inputSchemaJson,
          inputExamples: p.inputExamples,
          // Manual schema mode — we have a published contract; auto-derive
          // would clobber it on every Document keystroke.
          inputSchemaAuto: false,
          baseVersion: p.baseVersion,
          baseRego: p.regoCode,
          baseInputSchemaJson: p.inputSchemaJson,
          baseInputExamplesJson: JSON.stringify(p.inputExamples),
          isDirty: false,
          lastSavedAt: null,
        }),
    }),
    {
      name: 'policy-storage',
      version: 3,
      // Migrations:
      //   v1 → v2: resourceType removed; drop the stale field if present.
      //   v2 → v3: guardrail versions are MAJOR.MINOR only — truncate any
      //            persisted 3-segment metadata.version (e.g. "1.0.0" → "1.0").
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        delete state.resourceType;
        const meta = state.metadata as Record<string, unknown> | undefined;
        if (meta && typeof meta.version === 'string') {
          const m = meta.version.match(/^(\d+\.\d+)(?:\.\d+)?$/);
          if (m) meta.version = m[1];
          else meta.version = '1.0';
        }
        return state as unknown as PolicyState;
      },
      partialize: (state) => ({
        regoCode: state.regoCode,
        inputJson: state.inputJson,
        configJson: state.configJson,
        configEnabled: state.configEnabled,
        externalDeps: state.externalDeps,
        metadata: state.metadata,
        resourceKind: state.resourceKind,
        stage: state.stage,
        status: state.status,
        enforcementType: state.enforcementType,
        tags: state.tags,
        baseVersion: state.baseVersion,
        baseRego: state.baseRego,
        baseInputSchemaJson: state.baseInputSchemaJson,
        baseInputExamplesJson: state.baseInputExamplesJson,
        inputSchemaJson: state.inputSchemaJson,
        inputSchemaAuto: state.inputSchemaAuto,
        inputExamples: state.inputExamples,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);
