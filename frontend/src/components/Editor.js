import { useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';

const LANGUAGE_MAP = {
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  cpp: 'cpp',
};

function Editor({ language, code, onChange, readOnly = false }) {
  const monacoLanguage = LANGUAGE_MAP[language] || 'python';
  const editorValue = code ?? '';
  const editorOptions = useMemo(() => ({
    fontSize: 14,
    lineNumbers: 'on',
    automaticLayout: true,
    minimap: { enabled: false },
    smoothScrolling: true,
    readOnly,
    scrollBeyondLastLine: false,
    wordWrap: 'on',
  }), [readOnly]);

  const handleMount = useCallback((editor) => {
    requestAnimationFrame(() => {
      editor.layout();
    });
  }, []);

  return (
    <div className="monaco-editor-container">
      <MonacoEditor
        width="100%"
        height="100%"
        language={monacoLanguage}
        value={editorValue}
        theme="vs-dark"
        onMount={handleMount}
        onChange={(value) => onChange?.(value ?? '')}
        options={editorOptions}
      />
    </div>
  );
}

export default Editor;
