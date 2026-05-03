import type * as Monaco from 'monaco-editor';
import { registerRegoLanguage } from './languages/rego';
import { regoLightTheme } from './themes/light';
import { regoDarkTheme } from './themes/dark';

let isInitialized = false;

export function initializeMonaco(monaco: typeof Monaco) {
  if (isInitialized) return;

  registerRegoLanguage(monaco);
  monaco.editor.defineTheme('rego-light', regoLightTheme);
  monaco.editor.defineTheme('rego-dark', regoDarkTheme);

  isInitialized = true;
}

export const defaultEditorOptions: Monaco.editor.IStandaloneEditorConstructionOptions =
  {
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    fontLigatures: true,
    lineNumbers: 'on',
    roundedSelection: true,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    padding: { top: 16, bottom: 16 },
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    bracketPairColorization: { enabled: true },
  };
