import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { getAuthToken } from '../api/client';
import Editor from '../components/Editor';
import './ProjectEditorPage.css';

const LANGUAGE_OPTIONS = ['python', 'javascript', 'java', 'cpp'];

function ProjectEditorPage() {
  const { id } = useParams();
  const [projectName, setProjectName] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [executing, setExecuting] = useState(false);
  const [output, setOutput] = useState('');
  const [executionError, setExecutionError] = useState('');
  const [executionTime, setExecutionTime] = useState(null);

  const socketRef = useRef(null);

  const isReadOnly = loading || executing;

  const terminalContent = useMemo(() => {
    if (executing) {
      return 'Running code...\n';
    }

    if (executionError) {
      return executionError;
    }

    return output;
  }, [executing, executionError, output]);

  const terminalClassName = executionError && !executing
    ? 'editor-terminal editor-terminal--error'
    : 'editor-terminal';

  useEffect(() => {
    const token = getAuthToken();

    if (!token) {
      setError('Authentication required. Please log in and store your token in localStorage.');
      setLoading(false);
      return undefined;
    }

    const fetchProject = async () => {
      setLoading(true);
      setError('');

      try {
        const { data } = await api.get(`/api/projects/${id}`);
        setProjectName(data.name || 'Untitled Project');
        setCode(data.code ?? '');
        setLanguage(data.language || 'python');
      } catch (err) {
        const status = err.response?.status;

        if (status === 401) {
          setError('Session expired or invalid token. Please log in again.');
        } else if (status === 403) {
          setError('You do not have access to this project.');
        } else if (status === 404) {
          setError('Project not found.');
        } else {
          setError(err.response?.data?.message || 'Failed to load project.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProject();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [id]);

  const handleCodeChange = useCallback((nextCode) => {
    setCode(nextCode);
  }, []);

  const handleLanguageChange = useCallback((event) => {
    setLanguage(event.target.value);
  }, []);

  const handleRunCode = useCallback(async () => {
    if (executing) {
      return;
    }

    setExecuting(true);
    setOutput('');
    setExecutionError('');
    setExecutionTime(null);

    try {
      await api.put(`/api/projects/${id}`, { code, language });
      const { data } = await api.post(`/api/projects/${id}/execute`);

      setOutput(data.output || '');
      setExecutionError(data.error || '');
      setExecutionTime(data.executionTime ?? null);
    } catch (err) {
      const message = err.response?.data?.message
        || err.message
        || 'Execution failed.';

      if (err.response?.data?.error) {
        setExecutionError(err.response.data.error || message);
        setOutput(err.response.data.output || '');
        setExecutionTime(err.response.data.executionTime ?? null);
      } else {
        setExecutionError(message);
      }
    } finally {
      setExecuting(false);
    }
  }, [code, executing, id, language]);

  if (loading) {
    return (
      <div className="editor-page">
        <div className="editor-status">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-page">
        <div className="editor-status editor-status--error">{error}</div>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <div className="editor-header__info">
          <h1>{projectName}</h1>
          <span className="editor-header__meta">Project ID: {id}</span>
        </div>

        <div className="editor-header__actions">
          <label className="editor-language" htmlFor="language-select">
            Language
            <select
              id="language-select"
              value={language}
              onChange={handleLanguageChange}
              disabled={isReadOnly}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="editor-run-btn"
            onClick={handleRunCode}
            disabled={isReadOnly}
          >
            {executing ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </header>

      <main className="editor-main">
        <section className="editor-workspace">
          <Editor
            language={language}
            code={code}
            onChange={handleCodeChange}
            readOnly={isReadOnly}
          />
        </section>

        <section className="editor-output-panel">
          <div className="editor-output-header">
            <h2>Terminal</h2>
            {executionTime !== null && (
              <span className="editor-execution-time">
                Execution time: {executionTime} ms
              </span>
            )}
          </div>

          <pre className={terminalClassName}>
            {executing && <span className="editor-spinner" aria-hidden="true" />}
            {terminalContent || 'Run code to see output here.'}
          </pre>
        </section>
      </main>
    </div>
  );
}

export default ProjectEditorPage;
