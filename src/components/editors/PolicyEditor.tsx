import Editor, { OnMount } from '@monaco-editor/react';
import { useCallback, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { usePolicyStore, useUIStore } from '@/store';
import { initializeMonaco, defaultEditorOptions } from '@/monaco/config';
import { cn } from '@/utils';

interface PolicyEditorProps {
  className?: string;
}

export function PolicyEditor({ className }: PolicyEditorProps) {
  const { regoCode, setRegoCode } = usePolicyStore();
  const { resolvedTheme } = useUIStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    initializeMonaco(monaco);
    monaco.editor.setTheme(
      resolvedTheme === 'dark' ? 'rego-dark' : 'rego-light'
    );
  }, [resolvedTheme]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      setRegoCode(value || '');
    },
    [setRegoCode]
  );

  return (
    <div
      className={cn(
        'h-full flex flex-col rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface)]',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Policy (Rego)
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="rego"
          theme={resolvedTheme === 'dark' ? 'rego-dark' : 'rego-light'}
          value={regoCode}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={defaultEditorOptions}
          loading={
            <div className="flex items-center justify-center h-full text-[var(--color-text-tertiary)]">
              Loading editor...
            </div>
          }
        />
      </div>
    </div>
  );
}
