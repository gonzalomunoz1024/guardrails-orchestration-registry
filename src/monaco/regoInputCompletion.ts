import type * as Monaco from 'monaco-editor';
import { getRegoInputShape } from './regoInputShape';

/**
 * Dynamic Rego completion for the OPA evaluation input.
 *
 * The sandbox keeps a live "input shape" — the merged document + configuration +
 * external-dependency data + guardrail metadata — and this provider walks it so
 * that typing `input.`, `input.configuration.`, `input.external.<dep>.` etc.
 * offers the real available keys, with type and value hints.
 */

let registered = false;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Walk the shape following dotted path segments (the first must be `input`). */
function resolvePath(segments: string[]): Record<string, unknown> | null {
  if (segments.length === 0 || segments[0] !== 'input') return null;
  let node: unknown = getRegoInputShape();
  for (const seg of segments.slice(1)) {
    if (isPlainObject(node)) {
      node = node[seg];
    } else {
      return null;
    }
  }
  return isPlainObject(node) ? node : null;
}

function describe(value: unknown): { type: string; preview: string } {
  if (value === null) return { type: 'null', preview: 'null' };
  if (Array.isArray(value)) return { type: 'array', preview: `array (${value.length})` };
  if (isPlainObject(value)) {
    return { type: 'object', preview: `{ ${Object.keys(value).slice(0, 4).join(', ')}${Object.keys(value).length > 4 ? ', …' : ''} }` };
  }
  if (typeof value === 'string') {
    const trimmed = value.length > 40 ? `${value.slice(0, 40)}…` : value;
    return { type: 'string', preview: `"${trimmed}"` };
  }
  return { type: typeof value, preview: String(value) };
}

export function registerRegoInputCompletion(monaco: typeof Monaco): void {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider('rego', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Text on the line up to the partial word being typed.
      const lineText = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: word.startColumn,
      });

      // Member access only: the char before the word must be a dot, preceded by
      // a dotted identifier chain rooted at `input`.
      const match = lineText.match(/([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*)\.$/);
      if (!match) return { suggestions: [] };

      const segments = match[1].split('.');
      const target = resolvePath(segments);
      if (!target) return { suggestions: [] };

      const suggestions: Monaco.languages.CompletionItem[] = Object.entries(target).map(
        ([key, value]) => {
          const { type, preview } = describe(value);
          const kind =
            type === 'object'
              ? monaco.languages.CompletionItemKind.Module
              : type === 'array'
                ? monaco.languages.CompletionItemKind.Field
                : monaco.languages.CompletionItemKind.Property;
          return {
            label: key,
            kind,
            detail: `${type} · ${preview}`,
            documentation: {
              value: `\`${[...segments, key].join('.')}\`\n\n\`\`\`json\n${JSON.stringify(value, null, 2).slice(0, 600)}\n\`\`\``,
            },
            insertText: key,
            range,
          };
        }
      );

      return { suggestions };
    },
  });
}
