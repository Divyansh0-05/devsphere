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

const getProjectOwnerId = (project) => {
  if (!project?.owner) {
    return '';
  }

  if (typeof project.owner === 'string') {
    return project.owner;
  }

  return project.owner._id || project.owner.id || '';
};

const getOwnerLabel = (project) => {
  if (!project?.owner || typeof project.owner === 'string') {
    return '';
  }

  return project.owner.username || project.owner.email || '';
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
  const currentUserId = useMemo(() => getStoredUser().id || getStoredUser()._id || '', []);
  const ownedProjects = useMemo(
    () => projects.filter((project) => getProjectOwnerId(project) === currentUserId),
    [currentUserId, projects],
  );
  const sharedProjects = useMemo(
    () => projects.filter((project) => getProjectOwnerId(project) !== currentUserId),
    [currentUserId, projects],
  );

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
        {!loading && !error && (
          <div className="dashboard-sections">
            <section className="dashboard-section" aria-labelledby="owned-projects-title">
              <div className="dashboard-section__header">
                <h2 id="owned-projects-title">Your Projects ({ownedProjects.length})</h2>
              </div>

              {ownedProjects.length === 0 ? (
                <div className="dashboard-empty">Create a project to start building your workspace.</div>
              ) : (
                <div className="project-grid">
                  {ownedProjects.map((project) => (
                    <button
                      className="project-card"
                      key={project._id}
                      type="button"
                      onClick={() => navigate(`/projects/${project._id}`)}
                    >
                      <div className="project-card__top">
                        <h3>{project.name}</h3>
                        <span className="project-language">{project.language}</span>
                      </div>
                      <p>{project.description || 'No description yet.'}</p>
                      <span className="project-updated">{formatUpdatedAt(project.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="dashboard-section" aria-labelledby="shared-projects-title">
              <div className="dashboard-section__header">
                <h2 id="shared-projects-title">Shared With You ({sharedProjects.length})</h2>
              </div>

              {sharedProjects.length === 0 ? (
                <div className="dashboard-empty">No shared projects yet.</div>
              ) : (
                <div className="project-grid">
                  {sharedProjects.map((project) => {
                    const ownerLabel = getOwnerLabel(project);

                    return (
                      <button
                        className="project-card"
                        key={project._id}
                        type="button"
                        onClick={() => navigate(`/projects/${project._id}`)}
                      >
                        <div className="project-card__top">
                          <h3>{project.name}</h3>
                          <div className="project-card__badges">
                            <span className="project-shared">Shared</span>
                            <span className="project-language">{project.language}</span>
                          </div>
                        </div>
                        <p>{project.description || 'No description yet.'}</p>
                        {ownerLabel && (
                          <span className="project-owner">Owner: {ownerLabel}</span>
                        )}
                        <span className="project-updated">{formatUpdatedAt(project.updatedAt)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
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
