import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  FileText,
  SlidersHorizontal,
  Cloud,
  Wand2,
  Expand,
  X,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { usePolicyStore, useUIStore } from '@/store';
import { useInputShape } from '@/hooks';
import { defaultEditorOptions } from '@/monaco/config';
import { cn, isValidJson, parseJson, findMissingReservedFields } from '@/utils';
import type { GuardrailInfo } from '@/utils';
import { ExternalDependenciesSection } from './ExternalDependenciesSection';
import { CombinedInputPreview } from './CombinedInputPreview';

interface InputModuleProps {
  guardrailInfo: GuardrailInfo;
  onExpandInput: () => void;
  onExpandConfig: () => void;
}

/** Count top-level keys of a JSON object string, or null if not an object. */
function countKeys(json: string): number | null {
  const parsed = parseJson(json);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? Object.keys(parsed).length
    : null;
}

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  invalid?: boolean;
  open: boolean;
  onToggle: () => void;
  /** Compact status shown in the header (always visible). */
  summary?: React.ReactNode;
  /** Controls shown on the right when expanded. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  icon,
  title,
  badge,
  invalid,
  open,
  onToggle,
  summary,
  actions,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--color-surface)]">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 cursor-pointer select-none',
          'bg-[var(--color-surface-secondary)] hover:bg-[var(--color-border-light)] transition-colors',
          open && 'border-b border-[var(--color-border-light)]'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] shrink-0" />
          )}
          <span className="text-[var(--color-text-secondary)] shrink-0">{icon}</span>
          <span className="text-sm font-medium text-[var(--color-text-primary)] shrink-0">
            {title}
          </span>
          {badge && (
            <code className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)] shrink-0">
              {badge}
            </code>
          )}
          {invalid && (
            <span className="text-[11px] text-[var(--color-error)] shrink-0">Invalid JSON</span>
          )}
          {!invalid && summary && (
            <span className="text-[11px] text-[var(--color-text-tertiary)] truncate">
              {summary}
            </span>
          )}
        </div>
        {open && actions && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {open && children}
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'flex items-center justify-center p-1 rounded-md transition-all',
        danger
          ? 'text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
      )}
    >
      {icon}
    </button>
  );
}

type EditorHandle = { focus: () => void; onDidBlurEditorWidget: (cb: () => void) => void };

/**
 * A JSON editor that only grabs the scroll wheel once you click into it. An
 * invisible overlay sits on top so wheel events scroll the surrounding panel;
 * clicking focuses the editor (overlay lifts), and it re-arms on blur.
 */
function GuardedEditor({
  value,
  theme,
  onChange,
}: {
  value: string;
  theme: string;
  onChange: (v: string | undefined) => void;
}) {
  const [active, setActive] = useState(false);
  const ref = useRef<EditorHandle | null>(null);
  return (
    <div className="relative h-full">
      <Editor
        height="100%"
        language="json"
        theme={theme}
        value={value}
        onChange={onChange}
        onMount={(editor) => {
          ref.current = editor;
          editor.onDidBlurEditorWidget(() => setActive(false));
        }}
        options={{ ...defaultEditorOptions, scrollbar: { alwaysConsumeMouseWheel: false } }}
      />
      {!active && (
        <div
          className="absolute inset-0 z-10 cursor-text"
          title="Click to edit"
          onMouseDown={() => {
            setActive(true);
            setTimeout(() => ref.current?.focus(), 0);
          }}
        />
      )}
    </div>
  );
}

export function InputModule({ guardrailInfo, onExpandInput, onExpandConfig }: InputModuleProps) {
  const {
    inputJson,
    setInputJson,
    configJson,
    setConfigJson,
    configEnabled,
    setConfigEnabled,
    externalDeps,
  } = usePolicyStore();
  const { resolvedTheme } = useUIStore();

  // 'sources' = edit document/config/external; 'combined' = view merged input.
  const [viewMode, setViewMode] = useState<'sources' | 'combined'>('sources');
  // Per-section collapse state. All open by default.
  const [open, setOpen] = useState({ document: true, configuration: true, external: true });
  const toggle = (key: keyof typeof open) =>
    setOpen((s) => ({ ...s, [key]: !s[key] }));
  const anyOpen = open.document || open.configuration || open.external;
  const setAll = (value: boolean) =>
    setOpen({ document: value, configuration: value, external: value });

  // Drives the Rego autocomplete and the combined preview below.
  const shape = useInputShape(guardrailInfo);

  const editorTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs';

  const beautify = (json: string, setter: (v: string) => void) => {
    try {
      setter(JSON.stringify(JSON.parse(json), null, 2));
    } catch {
      /* leave invalid JSON untouched */
    }
  };

  const docKeys = countKeys(inputJson);
  const configKeys = countKeys(configJson);
  const fetchedCount = externalDeps.filter((d) => d.status === 'success').length;

  // Orchestrator-reserved paths missing from the sample document. We only
  // compute when the JSON parses — the section already shows an Invalid JSON
  // chip in the header for the broken case, so stacking another warning would
  // be noise.
  const parsedInput = isValidJson(inputJson) ? parseJson(inputJson) : null;
  const missingReserved = parsedInput !== null ? findMissingReservedFields(parsedInput) : [];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Input</h3>
          <p className="text-xs text-[var(--color-text-tertiary)] truncate">
            Document, configuration &amp; external data — combined into{' '}
            <code className="font-mono">input</code>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {viewMode === 'sources' && (
            <button
              onClick={() => setAll(!anyOpen)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-all"
            >
              {anyOpen ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Collapse all
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Expand all
                </>
              )}
            </button>
          )}
          <button
            onClick={() => setViewMode((m) => (m === 'combined' ? 'sources' : 'combined'))}
            title="Toggle combined input view"
            aria-pressed={viewMode === 'combined'}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all',
              viewMode === 'combined'
                ? 'bg-[var(--color-info)] text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Combined input
          </button>
        </div>
      </div>

      {viewMode === 'sources' ? (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1">
        {/* 1. Document */}
        <CollapsibleSection
          icon={<FileText className="w-4 h-4" />}
          title="Document"
          badge="input.*"
          invalid={!isValidJson(inputJson)}
          open={open.document}
          onToggle={() => toggle('document')}
          summary={docKeys != null ? `${docKeys} field${docKeys === 1 ? '' : 's'}` : undefined}
          actions={
            <>
              <ToolbarButton
                icon={<Wand2 className="w-3.5 h-3.5" />}
                label="Beautify"
                onClick={() => beautify(inputJson, setInputJson)}
              />
              <ToolbarButton
                icon={<Expand className="w-3.5 h-3.5" />}
                label="Expand"
                onClick={onExpandInput}
              />
            </>
          }
        >
          {missingReserved.length > 0 && (
            <div className="px-3 pt-3">
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-[var(--color-warning)] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                    Missing orchestrator-reserved {missingReserved.length === 1 ? 'field' : 'fields'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    Inbound traffic always carries these. Add them to your sample so the policy
                    sees the same shape it will see in production.
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {missingReserved.map((path) => (
                      <li key={path}>
                        <code className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                          {path}
                        </code>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          <div className="h-[200px]">
            <GuardedEditor
              theme={editorTheme}
              value={inputJson}
              onChange={(v) => setInputJson(v || '{}')}
            />
          </div>
        </CollapsibleSection>

        {/* 2. Configuration (static, optional) */}
        {configEnabled ? (
          <CollapsibleSection
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="Configuration"
            badge="input.configuration"
            invalid={!isValidJson(configJson)}
            open={open.configuration}
            onToggle={() => toggle('configuration')}
            summary={
              configKeys != null
                ? `${configKeys} key${configKeys === 1 ? '' : 's'}`
                : undefined
            }
            actions={
              <>
                <ToolbarButton
                  icon={<Wand2 className="w-3.5 h-3.5" />}
                  label="Beautify"
                  onClick={() => beautify(configJson, setConfigJson)}
                />
                <ToolbarButton
                  icon={<Expand className="w-3.5 h-3.5" />}
                  label="Expand"
                  onClick={onExpandConfig}
                />
                <ToolbarButton
                  icon={<X className="w-3.5 h-3.5" />}
                  label="Remove"
                  danger
                  onClick={() => setConfigEnabled(false)}
                />
              </>
            }
          >
            <div className="h-[160px]">
              <GuardedEditor
                theme={editorTheme}
                value={configJson}
                onChange={(v) => setConfigJson(v || '{}')}
              />
            </div>
          </CollapsibleSection>
        ) : (
          <button
            onClick={() => setConfigEnabled(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-info)] hover:text-[var(--color-info)] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add static configuration
            <code className="text-[10px] font-mono text-[var(--color-text-tertiary)]">
              input.configuration
            </code>
          </button>
        )}

        {/* 3. External dependencies (dynamic) */}
        <CollapsibleSection
          icon={<Cloud className="w-4 h-4" />}
          title="External dependencies"
          badge="input.external.*"
          open={open.external}
          onToggle={() => toggle('external')}
          summary={
            externalDeps.length === 0
              ? 'none'
              : `${externalDeps.length} ${externalDeps.length === 1 ? 'dependency' : 'dependencies'}${
                  fetchedCount > 0 ? ` · ${fetchedCount} fetched` : ''
                }`
          }
        >
          <div className="p-3">
            <ExternalDependenciesSection />
          </div>
        </CollapsibleSection>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <CombinedInputPreview input={shape} />
        </div>
      )}
    </div>
  );
}
