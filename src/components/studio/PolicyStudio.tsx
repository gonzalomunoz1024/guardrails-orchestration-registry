import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { Play, Loader2, Sliders, Radius, Send, Check, Shield, FileCode2, FileJson, X } from 'lucide-react';
import { InputModule } from '@/components/sandbox';
import { OutputPanel } from '@/components/panels';
import { EditorModal, SubmitPolicyModal } from '@/components/modals';
import { usePolicyStore, useEvaluationStore, useUIStore, useDraftStore, useBlastRunStore } from '@/store';
import { useEvaluate, useDebounce } from '@/hooks';
import { cn, isValidJson, toGuardrailYaml, deriveSchemaFromJson } from '@/utils';
import { StudioDetailsDrawer } from './StudioDetailsDrawer';
import { StudioBlastRadiusDrawer } from './StudioBlastRadiusDrawer';
import { InputSchemaDrawer } from './InputSchemaDrawer';
import { ManifestDrawer } from './ManifestDrawer';
import { RegoEditorPane } from './RegoEditorPane';
import { slugifyName } from '@/utils';

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
    >
      <span
        className={cn(
          'relative w-8 h-[18px] rounded-full transition-colors',
          checked ? 'bg-[var(--color-info)]' : 'bg-[var(--color-border)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-[14px] h-[14px] rounded-full bg-white transition-transform',
            checked && 'translate-x-[14px]'
          )}
        />
      </span>
      {label}
    </button>
  );
}

const handleBar = (
  <div className="h-12 w-1 rounded-full bg-[var(--color-border-light)] group-hover:bg-[var(--color-info)] transition-colors" />
);

export function PolicyStudio() {
  const {
    regoCode,
    setRegoCode,
    inputJson,
    setInputJson,
    configJson,
    setConfigJson,
    configEnabled,
    externalDeps,
    metadata,
    updateMetadata,
    resourceKind,
    stage,
    status,
    enforcementType,
    tags,
    inputSchemaAuto,
    setInputSchemaJson,
    lastSavedAt,
    isDirty,
    saveDraft,
  } = usePolicyStore();
  const { result } = useEvaluationStore();
  const { resolvedTheme } = useUIStore();
  const upsertDraft = useDraftStore((s) => s.upsertDraft);

  // Background blast-radius run state (drives the red dot + completion toast).
  const blastStatus = useBlastRunStore((s) => s.status);
  const blastSeen = useBlastRunStore((s) => s.seen);
  const blastFinishedTick = useBlastRunStore((s) => s.finishedTick);
  const markBlastSeen = useBlastRunStore((s) => s.markSeen);
  const showBlastDot = blastStatus === 'done' && !blastSeen;
  const [blastToast, setBlastToast] = useState<{ passed: number; total: number } | null>(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [blastOpen, setBlastOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [expandedEditor, setExpandedEditor] = useState<'input' | 'config' | 'output' | 'rego' | 'manifest' | null>(null);
  const [autoRun, setAutoRun] = useState(true);

  const policyId = slugifyName(metadata.name);

  const guardrailInfo = useMemo(
    () => ({ id: policyId, name: metadata.name, version: metadata.version, enforcementType }),
    [policyId, metadata.name, metadata.version, enforcementType]
  );

  const { evaluate, isEvaluating } = useEvaluate({ guardrailInfo });

  // Auto-evaluate (debounced) when the policy or its input changes.
  const evaluateRef = useRef(evaluate);
  evaluateRef.current = evaluate;
  const evalKey = useMemo(
    () =>
      JSON.stringify({
        regoCode,
        inputJson,
        configJson,
        configEnabled,
        ext: externalDeps.map((d) => ({ n: d.name, d: d.data })),
        enforcementType,
        policyId,
      }),
    [regoCode, inputJson, configJson, configEnabled, externalDeps, enforcementType, policyId]
  );
  const debouncedKey = useDebounce(evalKey, 700);
  useEffect(() => {
    if (!autoRun) return;
    if (!regoCode.trim() || !isValidJson(inputJson)) return;
    if (configEnabled && !isValidJson(configJson)) return;
    evaluateRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKey, autoRun]);

  // Keep the input schema in sync with the document while in auto mode.
  useEffect(() => {
    if (inputSchemaAuto) setInputSchemaJson(deriveSchemaFromJson(inputJson));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputJson, inputSchemaAuto]);

  const manifestYaml = useMemo(
    () =>
      toGuardrailYaml({
        metadata,
        resourceKind,
        enforcementType,
        stage,
        status,
        tags,
        configEnabled,
        externalDeps,
      }),
    [metadata, resourceKind, enforcementType, stage, status, tags, configEnabled, externalDeps]
  );

  const savedLabel = isDirty
    ? 'Unsaved changes'
    : lastSavedAt
      ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null;

  // All Guardrail Details fields except tags are required before submitting.
  // (resource kind, stage, status and enforcement always carry an enum value.)
  const missingDetails: string[] = [];
  if (!metadata.name.trim()) missingDetails.push('name');
  if (!metadata.description.trim()) missingDetails.push('description');
  const canSubmit = missingDetails.length === 0;

  const handleSaveDraft = () => {
    saveDraft();
    if (policyId) {
      upsertDraft({
        id: policyId,
        name: metadata.name,
        resourceKind,
        stage,
        enforcementType,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Surface a completion toast when a (possibly minimized) blast-radius run finishes.
  useEffect(() => {
    if (blastFinishedTick === 0) return;
    const { results, testInputs } = useBlastRunStore.getState();
    const passed = Object.values(results).filter((r) => r.status === 'passed').length;
    setBlastToast({ passed, total: testInputs.length });
    const timer = setTimeout(() => setBlastToast(null), 6000);
    return () => clearTimeout(timer);
  }, [blastFinishedTick]);

  const openBlast = () => {
    setBlastOpen(true);
    markBlastSeen();
    setBlastToast(null);
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[var(--color-surface-secondary)]">
      {/* Studio header */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 border-b border-[var(--color-border-light)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-info)] to-purple-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <input
              value={metadata.name}
              onChange={(e) => updateMetadata({ name: e.target.value })}
              placeholder="Untitled guardrail"
              className="w-full bg-transparent text-base font-semibold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
            />
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
              <code className="font-mono">package {policyId || '—'}</code>
              {savedLabel && (
                <>
                  <span>·</span>
                  <span>{savedLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDetailsOpen(true)}
            title={
              canSubmit
                ? 'Edit guardrail details'
                : `Missing: ${missingDetails.join(', ')}`
            }
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <Sliders className="w-4 h-4" />
            Details
            {!canSubmit && (
              <span
                aria-label="Guardrail details incomplete"
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-error)] ring-2 ring-[var(--color-surface)]"
              />
            )}
          </button>
          <button
            onClick={openBlast}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <Radius className="w-4 h-4" />
            Blast radius
            {showBlastDot && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--color-error)]" />
            )}
            {blastStatus === 'running' && (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--color-info)]" />
            )}
          </button>
          <button
            onClick={() => setSchemaOpen(true)}
            title="Author the input schema contract + examples"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <FileJson className="w-4 h-4" />
            Input contract
          </button>
          <button
            onClick={() => setExpandedEditor('manifest')}
            title="View the Guardrail manifest the backend will register"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <FileCode2 className="w-4 h-4" />
            Manifest
          </button>

          <div className="h-5 w-px bg-[var(--color-border-light)] mx-1" />

          <Switch checked={autoRun} onChange={setAutoRun} label="Auto-run" />
          <button
            onClick={() => evaluate()}
            disabled={isEvaluating}
            className={cn(
              'flex items-center gap-2 px-4 py-1.5 rounded-[var(--radius-md)]',
              'bg-[var(--color-info)] text-white text-sm font-medium transition-all hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run
          </button>

          <div className="h-5 w-px bg-[var(--color-border-light)] mx-1" />

          <button
            onClick={handleSaveDraft}
            disabled={!isDirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            {!isDirty && lastSavedAt ? <Check className="w-4 h-4 text-[var(--color-success)]" /> : null}
            {!isDirty && lastSavedAt ? 'Saved' : 'Save draft'}
          </button>
          <button
            onClick={() => setSubmitOpen(true)}
            disabled={!canSubmit}
            title={canSubmit ? undefined : `Complete in Details: ${missingDetails.join(', ')}`}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-[var(--radius-md)]',
              'bg-[var(--color-text-primary)] text-[var(--color-surface)] text-sm font-medium transition-all hover:opacity-90',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
            Submit
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 min-h-0 p-4">
        <Group orientation="horizontal" className="h-full">
          <Panel defaultSize="30%" minSize="20%">
            <InputModule
              guardrailInfo={guardrailInfo}
              onExpandInput={() => setExpandedEditor('input')}
              onExpandConfig={() => setExpandedEditor('config')}
            />
          </Panel>

          <Separator className="w-2 flex items-center justify-center group cursor-col-resize">
            {handleBar}
          </Separator>

          <Panel defaultSize="44%" minSize="25%">
            <RegoEditorPane policyId={policyId} onExpand={() => setExpandedEditor('rego')} />
          </Panel>

          <Separator className="w-2 flex items-center justify-center group cursor-col-resize">
            {handleBar}
          </Separator>

          <Panel defaultSize="26%" minSize="18%">
            <OutputPanel onExpand={() => setExpandedEditor('output')} />
          </Panel>
        </Group>
      </div>

      {/* Drawers & modals */}
      <StudioDetailsDrawer isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} />

      <InputSchemaDrawer isOpen={schemaOpen} onClose={() => setSchemaOpen(false)} />

      <StudioBlastRadiusDrawer
        isOpen={blastOpen}
        onClose={() => setBlastOpen(false)}
        guardrailInfo={guardrailInfo}
      />

      <EditorModal
        isOpen={expandedEditor === 'rego'}
        onClose={() => setExpandedEditor(null)}
        title="Rego"
        subtitle="Rego policy code"
        language="rego"
        value={regoCode}
        onChange={setRegoCode}
        theme={resolvedTheme}
      />
      <EditorModal
        isOpen={expandedEditor === 'input'}
        onClose={() => setExpandedEditor(null)}
        title="Document"
        subtitle="The resource being evaluated (input.*)"
        language="json"
        value={inputJson}
        onChange={setInputJson}
        theme={resolvedTheme}
      />
      <EditorModal
        isOpen={expandedEditor === 'config'}
        onClose={() => setExpandedEditor(null)}
        title="Configuration"
        subtitle="Static data accessible via input.configuration"
        language="json"
        value={configJson}
        onChange={setConfigJson}
        theme={resolvedTheme}
      />
      <EditorModal
        isOpen={expandedEditor === 'output'}
        onClose={() => setExpandedEditor(null)}
        title="Result"
        subtitle="Guardrail evaluation result"
        language="json"
        value={result ? JSON.stringify(result.result ?? result.error, null, 2) : '{}'}
        readOnly
        theme={resolvedTheme}
      />
      <ManifestDrawer
        isOpen={expandedEditor === 'manifest'}
        onClose={() => setExpandedEditor(null)}
        value={manifestYaml}
        theme={resolvedTheme}
      />

      <SubmitPolicyModal
        isOpen={submitOpen}
        onClose={() => setSubmitOpen(false)}
        policyId={policyId}
        regoCode={regoCode}
        configJson={configJson}
        metadata={{
          id: policyId,
          name: metadata.name,
          description: metadata.description,
          version: metadata.version,
          status,
          enforcementType,
          stage,
          resourceKind,
          owner: metadata.author || 'current-user',
          tags,
        }}
      />

      {/* Background blast-radius completion toast */}
      {blastToast && (
        <div className="fixed top-4 right-4 z-[60] w-80 rounded-[var(--radius-lg)] border border-[var(--color-border-light)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] p-4 animate-slide-in">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--color-success-bg)] shrink-0">
              <Radius className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Blast radius complete
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {blastToast.passed}/{blastToast.total} allowed
              </p>
              <button
                onClick={openBlast}
                className="mt-1.5 text-xs font-medium text-[var(--color-info)] hover:underline"
              >
                View results
              </button>
            </div>
            <button
              onClick={() => setBlastToast(null)}
              className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
