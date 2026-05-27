import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ResourceKind, Stage, EnforcementType, GuardrailStatus } from '@/types/guardrail.types';

/** A locally saved guardrail draft (created via "Save draft" in the studio). */
export interface GuardrailDraft {
  id: string;
  name: string;
  resourceKind: ResourceKind;
  stage: Stage;
  enforcementType: EnforcementType;
  status: GuardrailStatus;
  updatedAt: string;
}

interface DraftState {
  drafts: GuardrailDraft[];
  upsertDraft: (draft: GuardrailDraft) => void;
  removeDraft: (id: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: [],
      upsertDraft: (draft) =>
        set((state) => ({
          drafts: [...state.drafts.filter((d) => d.id !== draft.id), draft],
        })),
      removeDraft: (id) =>
        set((state) => ({ drafts: state.drafts.filter((d) => d.id !== id) })),
    }),
    { name: 'guardrail-drafts' }
  )
);
