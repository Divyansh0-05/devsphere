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

  return (
    <div className="monaco-editor-container">
      <MonacoEditor
        height="100%"
        language={monacoLanguage}
        value={editorValue}
        theme="vs-dark"
        onChange={(value) => onChange?.(value ?? '')}
        options={{
          fontSize: 14,
          lineNumbers: 'on',
          automaticLayout: true,
          minimap: { enabled: false },
          smoothScrolling: true,
          readOnly,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}

export default Editor;
