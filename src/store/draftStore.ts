import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExternalDependency, PolicyMetadata } from '@/types';
import type { ResourceKind, Stage, EnforcementType, GuardrailStatus } from '@/types/guardrail.types';
import { normalizeResourceKind } from '@/utils/resourceKind';
import type { InputExample } from './policyStore';

/**
 * Full snapshot of the studio body for a saved draft. This is what
 * "Resume draft" restores into the active studio (policyStore).
 *
 * Keep this in lockstep with the persisted slice of policyStore so resume
 * is a complete round-trip.
 */
export interface GuardrailDraftBody {
  regoCode: string;
  inputJson: string;
  configJson: string;
  configEnabled: boolean;
  externalDeps: ExternalDependency[];
  metadata: PolicyMetadata;
  resourceKind: ResourceKind;
  stage: Stage;
  status: GuardrailStatus;
  enforcementType: EnforcementType;
  tags: string[];
  inputSchemaJson: string;
  inputSchemaAuto: boolean;
  inputExamples: InputExample[];
  baseVersion: string | null;
  baseRego: string | null;
  baseInputSchemaJson: string | null;
  baseInputExamplesJson: string | null;
}

/**
 * A locally saved guardrail draft (created via "Save draft" in the studio, or
 * auto-snapshotted when the user starts a new draft).
 *
 * Top-level fields are display facets (used by the catalog list). The full
 * studio state lives under `body` so Resume can restore it.
 *
 * When the studio submits a PR for this draft we tag it with `prUrl` +
 * `submittedAt` so the catalog can flip the row from "Local draft" to
 * "In review" until the backend indexes the merged manifest (at which point
 * the catalog's id dedupe hides the draft and the published row takes over).
 */
export interface GuardrailDraft {
  id: string;
  name: string;
  resourceKind: ResourceKind;
  stage: Stage;
  enforcementType: EnforcementType;
  status: GuardrailStatus;
  updatedAt: string;
  body: GuardrailDraftBody;
  /** GitHub PR URL once Submit succeeded. Presence flips the catalog badge. */
  prUrl?: string;
  /** ISO timestamp of the PR creation. */
  submittedAt?: string;
}

interface DraftState {
  drafts: GuardrailDraft[];
  upsertDraft: (draft: GuardrailDraft) => void;
  removeDraft: (id: string) => void;
  getDraft: (id: string) => GuardrailDraft | undefined;
  /** Tag a draft as in-review after a PR was opened. No-op if id is unknown. */
  markDraftSubmitted: (id: string, prUrl: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: [],
      upsertDraft: (draft) =>
        set((state) => ({
          drafts: [...state.drafts.filter((d) => d.id !== draft.id), draft],
        })),
      removeDraft: (id) =>
        set((state) => ({ drafts: state.drafts.filter((d) => d.id !== id) })),
      getDraft: (id) => get().drafts.find((d) => d.id === id),
      markDraftSubmitted: (id, prUrl) =>
        set((state) => ({
          drafts: state.drafts.map((d) =>
            d.id === id ? { ...d, prUrl, submittedAt: new Date().toISOString() } : d
          ),
        })),
    }),
    {
      name: 'guardrail-drafts',
      version: 3,
      // Migrations:
      //   v1 → v2: drafts had no body and were never resumable. Drop them so
      //            the catalog stops listing un-resumable zombie rows.
      //   v2 → v3: resourceKind moved from SCREAMING_SNAKE to PascalCase
      //            (VIRTUAL_MACHINE → VirtualMachine, etc.). Normalize the
      //            top-level facet and the nested body field.
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        const drafts = Array.isArray(state.drafts) ? (state.drafts as GuardrailDraft[]) : [];
        const cleaned = drafts
          .filter((d) => d && typeof d === 'object' && 'body' in d)
          .map((d) => ({
            ...d,
            resourceKind: normalizeResourceKind(d.resourceKind),
            body: { ...d.body, resourceKind: normalizeResourceKind(d.body?.resourceKind) },
          }));
        return { drafts: cleaned } as unknown as DraftState;
      },
    }
  )
);
