import Editor from '@monaco-editor/react';
import {
  X,
  Plus,
  Trash2,
  FileJson,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Wand2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { usePolicyStore } from '@/store';
import { useUIStore } from '@/store';
import { defaultEditorOptions } from '@/monaco/config';
import {
  cn,
  deriveSchemaFromJson,
  RESERVED_FIELDS,
  applyReservedFields,
  findReservedFieldCollisions,
} from '@/utils';
import { useEffect, useMemo, useState } from 'react';
import { SchemaFieldEditor } from './SchemaFieldEditor';

interface InputSchemaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Authoring surface for a guardrail's input contract — the JSON Schema of the
 * document it evaluates, plus example payloads. Published per version as
 * input-schema.json + examples/<name>.json for suite adopters.
 */
export function InputSchemaDrawer({ isOpen, onClose }: InputSchemaDrawerProps) {
  const {
    inputJson,
    inputSchemaJson,
    setInputSchemaJson,
    inputSchemaAuto,
    setInputSchemaAuto,
    inputExamples,
    setInputExamples,
  } = usePolicyStore();
  const { resolvedTheme } = useUIStore();
  const editorTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Parse the current schema once per render so the hint/collision panel
  // can reflect what the editor actually contains right now.
  const parsedSchema = useMemo(() => {
    try {
      return JSON.parse(inputSchemaJson || '{}') as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [inputSchemaJson]);

  const collisions = useMemo(
    () => (parsedSchema ? findReservedFieldCollisions(parsedSchema) : []),
    [parsedSchema]
  );

  const applyReserved = () => {
    if (!parsedSchema) return;
    setInputSchemaJson(JSON.stringify(applyReservedFields(parsedSchema), null, 2));
    if (inputSchemaAuto) setInputSchemaAuto(false);
  };

  const [rawOpen, setRawOpen] = useState(false);

  if (!isOpen) return null;

  const regenerate = () => setInputSchemaJson(deriveSchemaFromJson(inputJson));

  // Hand a tree-editor change back to the store. Any tree mutation flips us
  // out of Auto so a subsequent doc edit doesn't clobber the author's
  // refinements (required-toggles, abstract types, etc.).
  const applyTreeChange = (next: Record<string, unknown>) => {
    setInputSchemaJson(JSON.stringify(next, null, 2));
    if (inputSchemaAuto) setInputSchemaAuto(false);
  };

  const addExample = () => {
    setInputExamples([
      ...inputExamples,
      { name: `example-${inputExamples.length + 1}`, payload: inputJson },
    ]);
  };

  const updateExample = (index: number, patch: Partial<{ name: string; payload: string }>) => {
    setInputExamples(inputExamples.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const removeExample = (index: number) => {
    setInputExamples(inputExamples.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          'absolute top-0 right-0 h-full w-full max-w-2xl flex flex-col',
          'bg-[var(--color-surface)] border-l border-[var(--color-border-light)] shadow-2xl animate-slide-in'
        )}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)]">
          <div className="flex items-center gap-2 min-w-0">
            <FileJson className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Input contract</h2>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                The schema of the document this guardrail evaluates, with examples.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Schema */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">JSON Schema</span>
              <div className="flex items-center gap-2">
                {/* Auto / Manual toggle */}
                <div className="flex p-0.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-secondary)] border border-[var(--color-border-light)] text-xs">
                  <button
                    onClick={() => {
                      setInputSchemaAuto(true);
                      regenerate();
                    }}
                    className={cn(
                      'px-2 py-1 rounded-[var(--radius-sm)] font-medium transition-all',
                      inputSchemaAuto
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-secondary)]'
                    )}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setInputSchemaAuto(false)}
                    className={cn(
                      'px-2 py-1 rounded-[var(--radius-sm)] font-medium transition-all',
                      !inputSchemaAuto
                        ? 'bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-secondary)]'
                    )}
                  >
                    Manual
                  </button>
                </div>
                <button
                  onClick={regenerate}
                  title="Re-derive from the current document"
                  className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface-secondary)] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Derive
                </button>
              </div>
            </div>
            <p className="mb-2 text-[11px] text-[var(--color-text-tertiary)]">
              {inputSchemaAuto
                ? 'Auto mode tracks the Document as you edit it. Switch to Manual to mark fields required, set types (including "any" for shapes that vary between callers), or add new ones.'
                : 'Manual mode — your refinements are preserved. "Derive" overwrites from the current Document.'}
            </p>

            {/* Orchestrator-reserved fields panel. The platform reads these on
                every inbound document — the schema must always allow them at
                their named locations with the right types. Customers may mark
                them required for their own observability. */}
            {collisions.length > 0 ? (
              <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[var(--color-error-bg)] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 w-4 h-4 text-[var(--color-error)] shrink-0" />
                  <div className="min-w-0 flex-1 text-[11px] text-[var(--color-text-secondary)]">
                    <p className="font-medium text-[var(--color-error)] mb-1">
                      Reserved field type collision
                    </p>
                    <ul className="space-y-0.5">
                      {collisions.map((c) => (
                        <li key={c.path}>
                          <code className="font-mono">{c.path}</code> must be{' '}
                          <code className="font-mono">{c.expected}</code> (found{' '}
                          <code className="font-mono">{c.found}</code>) — the orchestrator
                          writes it as a {c.expected}.
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={applyReserved}
                      className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium bg-[var(--color-surface)] hover:bg-[var(--color-surface-secondary)] transition-colors text-[var(--color-text-primary)] border border-[var(--color-border-light)]"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Fix reserved fields
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <details className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-border-light)] bg-[var(--color-surface-secondary)]/60 px-3 py-2.5">
                <summary className="cursor-pointer flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-success)]" />
                  Orchestrator-reserved fields
                  <span className="text-[var(--color-text-tertiary)] font-normal">
                    — always allowed; never disallow or re-type
                  </span>
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-text-secondary)]">
                  {RESERVED_FIELDS.map((field) => (
                    <li key={field.path} className="flex items-start gap-2">
                      <code className="font-mono text-[var(--color-text-primary)] shrink-0">
                        {field.path}
                      </code>
                      <span className="text-[var(--color-text-tertiary)]">
                        {field.type} · {field.note}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={applyReserved}
                  className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface)] transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Apply reserved fields to current schema
                </button>
              </details>
            )}

            {/* Tree editor — primary surface. Mark fields required, set
                types (including "any" for abstract metadata blobs), nest
                objects. Reserved fields show a lock badge. */}
            {parsedSchema ? (
              <SchemaFieldEditor schema={parsedSchema} onChange={applyTreeChange} />
            ) : (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[var(--color-error-bg)] px-4 py-3 text-xs text-[var(--color-error)]">
                The schema isn't valid JSON. Open the raw view below to fix it.
              </div>
            )}

            {/* Raw JSON — collapsible secondary surface for power users.
                Edits here flow back into the tree on next render. */}
            <details
              className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-light)]"
              open={rawOpen}
              onToggle={(e) => setRawOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60 transition-colors rounded-[var(--radius-md)]">
                {rawOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                Raw JSON
                <span className="ml-auto text-[var(--color-text-tertiary)] font-normal">
                  Power-user view. Edits flow back into the tree.
                </span>
              </summary>
              <div className="h-[40vh] min-h-[280px] border-t border-[var(--color-border-light)]">
                <Editor
                  height="100%"
                  language="json"
                  theme={editorTheme}
                  value={inputSchemaJson}
                  onChange={(v) => {
                    setInputSchemaJson(v || '{}');
                    if (inputSchemaAuto) setInputSchemaAuto(false);
                  }}
                  options={{ ...defaultEditorOptions, readOnly: inputSchemaAuto }}
                />
              </div>
            </details>
          </div>

          {/* Examples */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                Example payloads
              </span>
              <button
                onClick={addExample}
                className="flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-info)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add (from current document)
              </button>
            </div>
            {inputExamples.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                No examples yet. Adopters use these to understand a valid input.
              </p>
            ) : (
              <div className="space-y-3">
                {inputExamples.map((ex, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border-light)] overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--color-surface-secondary)] border-b border-[var(--color-border-light)]">
                      <input
                        value={ex.name}
                        onChange={(e) => updateExample(i, { name: e.target.value })}
                        placeholder="example name"
                        className="flex-1 bg-transparent text-xs font-mono text-[var(--color-text-primary)] outline-none"
                      />
                      <button
                        onClick={() => removeExample(i)}
                        title="Remove example"
                        className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={ex.payload}
                      onChange={(e) => updateExample(i, { payload: e.target.value })}
                      rows={5}
                      spellCheck={false}
                      className="w-full px-3 py-2 text-xs font-mono text-[var(--color-text-primary)] bg-[var(--color-surface)] outline-none resize-y"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[var(--color-border-light)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-info)] text-white font-medium transition-all hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
