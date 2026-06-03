import type * as Monaco from 'monaco-editor';
import { registerRegoLanguage } from './languages/rego';
import { registerRegoInputCompletion } from './regoInputCompletion';
import { regoLightTheme } from './themes/light';
import { regoDarkTheme } from './themes/dark';

export { setRegoInputShape } from './regoInputShape';
export { attachRegoDiagnostics } from './regoInputDiagnostics';

let isInitialized = false;

export function initializeMonaco(monaco: typeof Monaco) {
  if (isInitialized) return;

  registerRegoLanguage(monaco);
  registerRegoInputCompletion(monaco);
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
    // Render overflow widgets (the hover popup, parameter hints, etc.) into
    // document.body instead of the editor's own DOM. Our editor lives inside
    // a `rounded` wrapper with `overflow-hidden`, which otherwise clips the
    // hover popup when the error is on one of the first few lines — the
    // popup tries to position above the line and gets cropped at the top.
    fixedOverflowWidgets: true,
    // Prefer hover below the line. Monaco still flips to above when there's
    // no room below; this just avoids the line-3-gets-cropped case where
    // it'd default to above with no fallback room.
    hover: { above: false },
  };
