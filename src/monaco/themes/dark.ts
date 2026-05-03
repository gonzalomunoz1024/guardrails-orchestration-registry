import type * as Monaco from 'monaco-editor';

export const regoDarkTheme: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '636366', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff7ab2', fontStyle: 'bold' },
    { token: 'predefined', foreground: 'b181f1' },
    { token: 'string', foreground: 'ff8170' },
    { token: 'string.escape', foreground: 'ffd60a' },
    { token: 'number', foreground: '64d2ff' },
    { token: 'number.float', foreground: '64d2ff' },
    { token: 'operator', foreground: 'f5f5f7' },
    { token: 'identifier', foreground: 'f5f5f7' },
    { token: 'delimiter', foreground: '86868b' },
  ],
  colors: {
    'editor.background': '#1c1c1e',
    'editor.foreground': '#f5f5f7',
    'editor.lineHighlightBackground': '#2c2c2e',
    'editorLineNumber.foreground': '#636366',
    'editorLineNumber.activeForeground': '#f5f5f7',
    'editor.selectionBackground': '#007aff4d',
    'editor.inactiveSelectionBackground': '#007aff26',
    'editorCursor.foreground': '#007aff',
    'editorWhitespace.foreground': '#38383a',
    'editorIndentGuide.background': '#2c2c2e',
    'editorIndentGuide.activeBackground': '#38383a',
  },
};
