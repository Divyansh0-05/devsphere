import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Admin.css';

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

function Admin() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const currentUser = useMemo(() => getStoredUser(), []);
  const languageBreakdown = stats?.languageBreakdown || [];
  const mostUsedLanguage = languageBreakdown[0]?.language || 'None yet';

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [statsResponse, usersResponse] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
      ]);

      setStats(statsResponse.data);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (err) {
      if (err.response?.status === 403) {
        navigate('/dashboard', { replace: true });
        return;
      }

      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
        return;
      }

      setError(err.response?.data?.message || 'Failed to load admin data.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      navigate('/dashboard', { replace: true });
      return;
    }

    loadAdminData();
  }, [currentUser.role, loadAdminData, navigate]);

  const handleDeleteUser = async (user) => {
    if (deletingUserId || user._id === currentUser.id || user._id === currentUser._id) {
      return;
    }

    const confirmed = window.confirm(`Delete ${user.username} and their owned projects?`);

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user._id);
    setError('');
    setSuccess('');

    try {
      await api.delete(`/api/admin/users/${user._id}`);
      setUsers((current) => current.filter((item) => item._id !== user._id));
      setSuccess(`${user.username} was deleted.`);
      const { data } = await api.get('/api/admin/stats');
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user.');
    } finally {
      setDeletingUserId('');
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <p className="admin-kicker">Platform governance</p>
            <h1>Admin Dashboard</h1>
          </div>

          <button
            className="admin-button admin-button--ghost"
            type="button"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </button>
        </header>

        {loading && <div className="admin-status">Loading admin data...</div>}
        {!loading && error && <div className="admin-message admin-message--error">{error}</div>}
        {!loading && success && <div className="admin-message admin-message--success">{success}</div>}

        {!loading && stats && (
          <>
            <section className="admin-section" aria-labelledby="overview-title">
              <div className="admin-section__header">
                <h2 id="overview-title">Platform Overview</h2>
              </div>

              <div className="admin-metrics">
                <article className="admin-metric-card">
                  <span>Total Users</span>
                  <strong>{stats.totalUsers ?? 0}</strong>
                </article>
                <article className="admin-metric-card">
                  <span>Total Projects</span>
                  <strong>{stats.totalProjects ?? 0}</strong>
                </article>
                <article className="admin-metric-card">
                  <span>Total Executions</span>
                  <strong>{stats.totalExecutions ?? 0}</strong>
                </article>
                <article className="admin-metric-card">
                  <span>Executions Today</span>
                  <strong>{stats.todayExecutions ?? 0}</strong>
                </article>
                <article className="admin-metric-card">
                  <span>Most Used Language</span>
                  <strong>{mostUsedLanguage}</strong>
                </article>
              </div>
            </section>

            <div className="admin-grid">
              <section className="admin-section" aria-labelledby="users-title">
                <div className="admin-section__header">
                  <h2 id="users-title">User Management</h2>
                  <span>{users.length} users</span>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isCurrentUser = user._id === currentUser.id || user._id === currentUser._id;

                        return (
                          <tr key={user._id}>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`admin-role admin-role--${user.role}`}>
                                {user.role}
                              </span>
                            </td>
                            <td>{formatDate(user.createdAt)}</td>
                            <td>
                              <button
                                className="admin-button admin-button--danger"
                                type="button"
                                onClick={() => handleDeleteUser(user)}
                                disabled={isCurrentUser || deletingUserId === user._id}
                                title={isCurrentUser ? 'You cannot delete your own admin account' : undefined}
                              >
                                {deletingUserId === user._id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="admin-section" aria-labelledby="language-title">
                <div className="admin-section__header">
                  <h2 id="language-title">Language Analytics</h2>
                </div>

                {languageBreakdown.length === 0 ? (
                  <div className="admin-empty">No executions have been recorded yet.</div>
                ) : (
                  <div className="language-list">
                    {languageBreakdown.map((item) => {
                      const percent = stats.totalExecutions
                        ? Math.round((item.count / stats.totalExecutions) * 100)
                        : 0;

                      return (
                        <div className="language-row" key={item.language}>
                          <div className="language-row__top">
                            <strong>{item.language}</strong>
                            <span>{item.count} runs</span>
                          </div>
                          <div className="language-meter" aria-hidden="true">
                            <span style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default Admin;
