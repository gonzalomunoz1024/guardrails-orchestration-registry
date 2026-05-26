import Editor from '@monaco-editor/react';
import { FileText, SlidersHorizontal, Cloud, Wand2, Expand, X, Plus } from 'lucide-react';
import { usePolicyStore, useUIStore } from '@/store';
import { useInputShape } from '@/hooks';
import { defaultEditorOptions } from '@/monaco/config';
import { cn, isValidJson } from '@/utils';
import type { GuardrailInfo } from '@/utils';
import { ExternalDependenciesSection } from './ExternalDependenciesSection';
import { CombinedInputPreview } from './CombinedInputPreview';

interface InputModuleProps {
  guardrailInfo: GuardrailInfo;
  onExpandInput: () => void;
  onExpandConfig: () => void;
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  invalid?: boolean;
  actions?: React.ReactNode;
}

function SectionHeader({ icon, title, badge, invalid, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[var(--color-text-secondary)]">{icon}</span>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{title}</span>
        {badge && (
          <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-text-tertiary)] border border-[var(--color-border-light)]">
            {badge}
          </code>
        )}
        {invalid && <span className="text-[11px] text-[var(--color-error)]">Invalid JSON</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
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
      className={cn(
        'flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-all',
        danger
          ? 'text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-bg)]'
          : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]'
      )}
    >
      {icon}
      {label}
    </button>
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
  } = usePolicyStore();
  const { resolvedTheme } = useUIStore();

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

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Input</h3>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            Document, configuration &amp; external data — combined into{' '}
            <code className="font-mono">input</code>
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {/* 1. Document */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--color-surface)]">
          <SectionHeader
            icon={<FileText className="w-4 h-4" />}
            title="Document"
            badge="input.*"
            invalid={!isValidJson(inputJson)}
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
          />
          <div className="h-[200px]">
            <Editor
              height="100%"
              language="json"
              theme={editorTheme}
              value={inputJson}
              onChange={(v) => setInputJson(v || '{}')}
              options={defaultEditorOptions}
            />
          </div>
        </div>

        {/* 2. Configuration (static, optional) */}
        {configEnabled ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-light)] overflow-hidden shadow-[var(--shadow-card)] bg-[var(--color-surface)]">
            <SectionHeader
              icon={<SlidersHorizontal className="w-4 h-4" />}
              title="Configuration"
              badge="input.configuration"
              invalid={!isValidJson(configJson)}
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
            />
            <div className="h-[160px]">
              <Editor
                height="100%"
                language="json"
                theme={editorTheme}
                value={configJson}
                onChange={(v) => setConfigJson(v || '{}')}
                options={defaultEditorOptions}
              />
            </div>
          </div>
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
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Cloud className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              External dependencies
            </span>
            <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
              input.external.*
            </code>
          </div>
          <ExternalDependenciesSection />
        </div>

        {/* 4. Combined preview */}
        <CombinedInputPreview input={shape} />
      </div>
    </div>
  );
}
