import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api, { getAuthToken } from '../api/client';
import Editor from '../components/Editor';
import './ProjectEditorPage.css';

const LANGUAGE_OPTIONS = ['python', 'javascript', 'java', 'cpp'];
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const getStoredUsername = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.username || user.email || 'Anonymous';
  } catch {
    return 'Anonymous';
  }
};

const getPresenceColor = (username = '') => {
  let hash = 0;

  for (let index = 0; index < username.length; index += 1) {
    hash = (hash * 31 + username.charCodeAt(index)) % 360;
  }

  return `hsl(${hash}, 64%, 48%)`;
};

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
  const [activeUsers, setActiveUsers] = useState([]);
  const [collaborationNotice, setCollaborationNotice] = useState('');

  const socketRef = useRef(null);
  const latestCodeRef = useRef('');
  const applyingRemoteUpdateRef = useRef(false);

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
    latestCodeRef.current = code;
  }, [code]);

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

    return undefined;
  }, [id]);

  useEffect(() => {
    if (loading || error || !getAuthToken()) {
      return undefined;
    }

    const username = getStoredUsername();
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-project', {
        projectId: id,
        username,
      });
    });

    socket.on('code-update', ({ code: incomingCode }) => {
      if (typeof incomingCode !== 'string' || incomingCode === latestCodeRef.current) {
        return;
      }

      applyingRemoteUpdateRef.current = true;
      latestCodeRef.current = incomingCode;
      setCode(incomingCode);

      requestAnimationFrame(() => {
        applyingRemoteUpdateRef.current = false;
      });
    });

    socket.on('active-users', (users) => {
      setActiveUsers(Array.isArray(users) ? users : []);
    });

    socket.on('user-joined', ({ username: joinedUsername }) => {
      if (joinedUsername) {
        setCollaborationNotice(`${joinedUsername} joined`);
      }
    });

    socket.on('user-left', ({ username: leftUsername }) => {
      if (leftUsername) {
        setCollaborationNotice(`${leftUsername} left`);
      }
    });

    return () => {
      socket.emit('leave-project', { projectId: id });
      socket.removeAllListeners();
      socket.disconnect();

      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [error, id, loading]);

  useEffect(() => {
    if (!collaborationNotice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCollaborationNotice('');
    }, 2500);

    return () => window.clearTimeout(timeoutId);
  }, [collaborationNotice]);

  const handleCodeChange = useCallback((nextCode) => {
    if (nextCode === latestCodeRef.current) {
      return;
    }

    latestCodeRef.current = nextCode;
    setCode(nextCode);

    if (!applyingRemoteUpdateRef.current && socketRef.current?.connected) {
      socketRef.current.emit('code-change', {
        projectId: id,
        code: nextCode,
      });
    }
  }, [id]);

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
          <div className="editor-presence" aria-label="Active collaborators">
            <div className="editor-presence__avatars">
              {activeUsers.map((user) => (
                <span
                  className="editor-presence__avatar"
                  key={user.socketId}
                  title={user.username}
                  style={{ backgroundColor: getPresenceColor(user.username) }}
                >
                  {(user.username || '?').slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
            <span className="editor-presence__count">
              {activeUsers.length} active
            </span>
            {collaborationNotice && (
              <span className="editor-presence__notice">{collaborationNotice}</span>
            )}
          </div>

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
