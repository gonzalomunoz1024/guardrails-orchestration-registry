import Editor from '@monaco-editor/react';
import { useCallback } from 'react';
import { AlertCircle, Expand, FileCode2 } from 'lucide-react';
import { usePolicyStore, useUIStore } from '@/store';
import { initializeMonaco, attachRegoDiagnostics, defaultEditorOptions } from '@/monaco/config';

interface RegoEditorPaneProps {
  policyId: string;
  onExpand: () => void;
}

function packageNameOf(code: string): string | null {
  const match = code.match(/^package\s+([a-z0-9_.]+)/m);
  return match ? match[1] : null;
}

export function RegoEditorPane({ policyId, onExpand }: RegoEditorPaneProps) {
  const { regoCode, setRegoCode } = usePolicyStore();
  const { resolvedTheme } = useUIStore();

  const currentPackage = packageNameOf(regoCode);
  const mismatch = Boolean(policyId) && Boolean(regoCode.trim()) && currentPackage !== policyId;

  const applyPackageFix = useCallback(() => {
    if (!policyId) return;
    const decl = `package ${policyId}`;
    if (/^package\s+[a-z0-9_.]+/m.test(regoCode)) {
      setRegoCode(regoCode.replace(/^package\s+[a-z0-9_.]+/m, decl));
    } else {
      setRegoCode(`${decl}\n\n${regoCode}`);
    }
  }, [policyId, regoCode, setRegoCode]);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Rego</h3>
          {policyId && (
            <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] truncate">
              package {policyId}
            </code>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {regoCode.split('\n').length} lines
          </span>
          <button
            onClick={onExpand}
            title="Expand"
            className="flex items-center px-1.5 py-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] transition-all"
          >
            <Expand className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {mismatch && (
        <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-warning-bg)]">
          <span className="flex items-center gap-2 text-sm text-[var(--color-warning)] min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Package should be{' '}
              <code className="font-mono font-semibold">{policyId}</code> to match the guardrail
            </span>
          </span>
          <button
            onClick={applyPackageFix}
            className="shrink-0 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--color-warning)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Fix
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--color-border-light)]">
        <Editor
          height="100%"
          language="rego"
          theme={resolvedTheme === 'dark' ? 'rego-dark' : 'rego-light'}
          value={regoCode}
          onChange={(value) => setRegoCode(value || '')}
          onMount={(editor, monaco) => {
            initializeMonaco(monaco);
            monaco.editor.setTheme(resolvedTheme === 'dark' ? 'rego-dark' : 'rego-light');
            attachRegoDiagnostics(monaco, editor);
          }}
          options={defaultEditorOptions}
        />
      </div>
    </div>
  );
}
