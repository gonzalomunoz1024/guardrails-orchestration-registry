import type * as Monaco from 'monaco-editor';

export const regoLanguageConfig: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: '#',
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '`', close: '`' },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
  folding: {
    markers: {
      start: /^\s*#\s*region\b/,
      end: /^\s*#\s*endregion\b/,
    },
  },
};

export const regoMonarchTokens: Monaco.languages.IMonarchLanguage = {
  defaultToken: 'invalid',

  keywords: [
    'package',
    'import',
    'as',
    'default',
    'else',
    'not',
    'with',
    'null',
    'true',
    'false',
    'some',
    'every',
    'in',
    'if',
    'contains',
  ],

  operators: [
    '=',
    '==',
    '!=',
    '<',
    '>',
    '<=',
    '>=',
    '+',
    '-',
    '*',
    '/',
    '%',
    '&',
    '|',
    ':=',
  ],

  builtins: [
    'count',
    'sum',
    'product',
    'max',
    'min',
    'sort',
    'array.concat',
    'array.slice',
    'intersection',
    'union',
    'concat',
    'contains',
    'endswith',
    'startswith',
    'lower',
    'upper',
    'trim',
    'split',
    'sprintf',
    'format_int',
    'indexof',
    'replace',
    'is_array',
    'is_boolean',
    'is_null',
    'is_number',
    'is_object',
    'is_set',
    'is_string',
    'type_name',
    'json.marshal',
    'json.unmarshal',
    'base64.encode',
    'base64.decode',
    'time.now_ns',
    'time.parse_ns',
    'http.send',
    'opa.runtime',
    'trace',
    'print',
  ],

  tokenizer: {
    root: [
      [/#.*$/, 'comment'],
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string_double'],
      [/`/, 'string', '@string_raw'],
      [/\d+\.\d+/, 'number.float'],
      [/\d+/, 'number'],
      [
        /[a-zA-Z_]\w*/,
        {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'predefined',
            '@default': 'identifier',
          },
        },
      ],
      [/:=|==|!=|<=|>=|[=<>+\-*/%&|]/, 'operator'],
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      [/\s+/, 'white'],
    ],
    string_double: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
    string_raw: [
      [/[^`]+/, 'string'],
      [/`/, 'string', '@pop'],
    ],
  },
};

export function registerRegoLanguage(monaco: typeof Monaco) {
  monaco.languages.register({ id: 'rego' });
  monaco.languages.setLanguageConfiguration('rego', regoLanguageConfig);
  monaco.languages.setMonarchTokensProvider('rego', regoMonarchTokens);

  // Register completions
  monaco.languages.registerCompletionItemProvider('rego', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [
        ...(regoMonarchTokens.keywords as string[]).map((keyword: string) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        })),
        ...(regoMonarchTokens.builtins as string[]).map((builtin: string) => ({
          label: builtin,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: builtin.includes('.') ? builtin : `${builtin}()`,
          range,
        })),
      ];

      return { suggestions };
    },
  });
}
