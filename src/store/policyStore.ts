import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PolicyMetadata } from '@/types';

interface PolicyState {
  regoCode: string;
  inputJson: string;
  configJson: string;
  metadata: PolicyMetadata;
  isDirty: boolean;

  setRegoCode: (code: string) => void;
  setInputJson: (json: string) => void;
  setConfigJson: (json: string) => void;
  updateMetadata: (metadata: Partial<PolicyMetadata>) => void;
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

allow if {
    input.user.role == "admin"
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
      metadata: initialMetadata,
      isDirty: false,

      setRegoCode: (code) => set({ regoCode: code, isDirty: true }),
      setInputJson: (json) => set({ inputJson: json, isDirty: true }),
      setConfigJson: (json) => set({ configJson: json, isDirty: true }),
      updateMetadata: (metadata) =>
        set((state) => ({
          metadata: { ...state.metadata, ...metadata },
          isDirty: true,
        })),
      resetPolicy: () =>
        set({
          regoCode: defaultRegoCode,
          inputJson: defaultInputJson,
          configJson: defaultConfigJson,
          metadata: initialMetadata,
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
        metadata: state.metadata,
      }),
    }
  )
);
