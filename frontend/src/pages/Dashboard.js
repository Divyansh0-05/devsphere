import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getAuthToken } from '../api/client';
import './Dashboard.css';

const LANGUAGE_OPTIONS = ['python', 'javascript', 'java', 'cpp'];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const formatUpdatedAt = (value) => {
  if (!value) {
    return 'Updated recently';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Updated recently';
  }

  return `Updated ${date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
};

function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    language: 'python',
  });

  const username = useMemo(() => getStoredUser().username || 'Developer', []);

  const fetchProjects = useCallback(async () => {
    if (!getAuthToken()) {
      navigate('/login', { replace: true });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data } = await api.get('/api/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setError(err.response?.data?.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const closeModal = () => {
    if (!creating) {
      setModalOpen(false);
      setForm({ name: '', description: '', language: 'python' });
      setError('');
    }
  };

  const handleCreateProject = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError('');

    try {
      const { data } = await api.post('/api/projects', form);
      await fetchProjects();
      setModalOpen(false);
      setForm({ name: '', description: '', language: 'python' });
      navigate(`/projects/${data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="dashboard-page">
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <p className="dashboard-kicker">Signed in as {username}</p>
            <h1>Your projects</h1>
          </div>

          <div className="dashboard-actions">
            <button
              className="dashboard-button dashboard-button--primary"
              type="button"
              onClick={() => setModalOpen(true)}
            >
              New Project
            </button>
            <button
              className="dashboard-button dashboard-button--ghost"
              type="button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </header>

        {loading && <div className="dashboard-status">Loading projects...</div>}
        {!loading && error && <div className="dashboard-error">{error}</div>}
        {!loading && !error && projects.length === 0 && (
          <div className="dashboard-empty">No projects yet. Create one to start coding.</div>
        )}

        {!loading && !error && projects.length > 0 && (
          <section className="project-grid" aria-label="Projects">
            {projects.map((project) => (
              <button
                className="project-card"
                key={project._id}
                type="button"
                onClick={() => navigate(`/projects/${project._id}`)}
              >
                <div className="project-card__top">
                  <h2>{project.name}</h2>
                  <span className="project-language">{project.language}</span>
                </div>
                <p>{project.description || 'No description yet.'}</p>
                <span className="project-updated">{formatUpdatedAt(project.updatedAt)}</span>
              </button>
            ))}
          </section>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
          <section
            className="project-modal"
            aria-labelledby="new-project-title"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="new-project-title">New Project</h2>
            <form className="project-form" onSubmit={handleCreateProject}>
              {error && <p className="dashboard-error">{error}</p>}

              <label className="project-field" htmlFor="project-name">
                Name
                <input
                  id="project-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  autoFocus
                />
              </label>

              <label className="project-field" htmlFor="project-description">
                Description
                <textarea
                  id="project-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                />
              </label>

              <label className="project-field" htmlFor="project-language">
                Language
                <select
                  id="project-language"
                  name="language"
                  value={form.language}
                  onChange={handleChange}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div className="project-form__actions">
                <button
                  className="dashboard-button dashboard-button--ghost"
                  type="button"
                  onClick={closeModal}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  className="dashboard-button dashboard-button--primary"
                  type="submit"
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Dashboard;
