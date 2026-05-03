import type * as Monaco from 'monaco-editor';

export const regoLightTheme: Monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6e6e73', fontStyle: 'italic' },
    { token: 'keyword', foreground: '0066cc', fontStyle: 'bold' },
    { token: 'predefined', foreground: '5856d6' },
    { token: 'string', foreground: 'd12f1b' },
    { token: 'string.escape', foreground: 'ff9500' },
    { token: 'number', foreground: '1c7ed6' },
    { token: 'number.float', foreground: '1c7ed6' },
    { token: 'operator', foreground: '1d1d1f' },
    { token: 'identifier', foreground: '1d1d1f' },
    { token: 'delimiter', foreground: '6e6e73' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1d1d1f',
    'editor.lineHighlightBackground': '#f5f5f7',
    'editorLineNumber.foreground': '#86868b',
    'editorLineNumber.activeForeground': '#1d1d1f',
    'editor.selectionBackground': '#007aff33',
    'editor.inactiveSelectionBackground': '#007aff1a',
    'editorCursor.foreground': '#007aff',
    'editorWhitespace.foreground': '#d2d2d7',
    'editorIndentGuide.background': '#e8e8ed',
    'editorIndentGuide.activeBackground': '#d2d2d7',
  },
};
