/**
 * Cross-store actions tying the active studio (policyStore) to the saved draft
 * list (draftStore). Co-locating these keeps the "snapshot, reset, navigate"
 * dance in one place so the sidebar, catalog, and resume paths agree.
 */

import { usePolicyStore } from './policyStore';
import { useDraftStore, type GuardrailDraft, type GuardrailDraftBody } from './draftStore';
import { slugifyName } from '@/utils/slugify';

function mintDraftId(name: string): string {
  // Match the form the published manifest uses for metadata.name — dashed
  // slug, not the underscored form slugifyName produces for rego packages.
  // Otherwise the catalog's draft-vs-published dedupe (by id) mis-matches
  // and the user sees the same guardrail twice ("Local draft" + DRAFT).
  const slug = slugifyName(name).replace(/_/g, '-');
  if (slug) return slug;
  return `untitled-${Date.now()}`;
}

function extractBody(state: ReturnType<typeof usePolicyStore.getState>): GuardrailDraftBody {
  return {
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
    inputSchemaJson: state.inputSchemaJson,
    inputSchemaAuto: state.inputSchemaAuto,
    inputExamples: state.inputExamples,
    baseVersion: state.baseVersion,
    baseRego: state.baseRego,
    baseInputSchemaJson: state.baseInputSchemaJson,
    baseInputExamplesJson: state.baseInputExamplesJson,
  };
}

/**
 * Snapshot the current studio state into draftStore. Returns the persisted
 * draft, or null if there's nothing worth saving (clean store, no name, no
 * pinned draft id).
 */
export function snapshotCurrentDraft(): GuardrailDraft | null {
  const state = usePolicyStore.getState();
  const hasContent =
    state.isDirty || state.draftId !== null || state.metadata.name.trim() !== '';
  if (!hasContent) return null;

  const id = state.draftId ?? mintDraftId(state.metadata.name);
  const draft: GuardrailDraft = {
    id,
    name: state.metadata.name,
    resourceKind: state.resourceKind,
    stage: state.stage,
    enforcementType: state.enforcementType,
    status: state.status,
    updatedAt: new Date().toISOString(),
    body: extractBody(state),
  };
  useDraftStore.getState().upsertDraft(draft);
  if (!state.draftId) usePolicyStore.getState().setDraftId(id);
  return draft;
}

/**
 * Start a brand-new guardrail. Stashes the current studio body into draftStore
 * (if there's anything worth saving) so the user doesn't lose work, then
 * resets the studio to its initial empty state.
 */
export function startNewDraft(): void {
  snapshotCurrentDraft();
  usePolicyStore.getState().resetPolicy();
}

/**
 * Restore a saved draft into the active studio. Snapshots whatever is
 * currently in the studio first (in case it's a different unsaved draft)
 * before swapping in the picked draft's full body.
 */
export function resumeDraft(draft: GuardrailDraft): void {
  const current = usePolicyStore.getState();
  if (current.draftId !== draft.id) snapshotCurrentDraft();
  usePolicyStore.getState().loadDraft(draft.id, draft.body);
}
