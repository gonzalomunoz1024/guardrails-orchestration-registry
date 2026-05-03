import Editor from '@monaco-editor/react';
import { useCallback } from 'react';
import { usePolicyStore, useUIStore } from '@/store';
import { defaultEditorOptions } from '@/monaco/config';
import { cn, isValidJson } from '@/utils';

interface InputEditorProps {
  className?: string;
}

export function InputEditor({ className }: InputEditorProps) {
  const { inputJson, setInputJson } = usePolicyStore();
  const { resolvedTheme } = useUIStore();

  const isValid = isValidJson(inputJson);

  const handleChange = useCallback(
    (value: string | undefined) => {
      setInputJson(value || '{}');
    },
    [setInputJson]
  );

  return (
    <div
      className={cn(
        'h-full flex flex-col rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface)]',
        !isValid && 'border-[var(--color-error)]',
        className
      )}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
          Input
        </span>
        {!isValid && (
          <span className="text-xs text-[var(--color-error)]">Invalid JSON</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="json"
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs'}
          value={inputJson}
          onChange={handleChange}
          options={{
            ...defaultEditorOptions,
            formatOnPaste: true,
            formatOnType: true,
          }}
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
