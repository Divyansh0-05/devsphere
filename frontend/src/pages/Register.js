import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import './Auth.css';

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/api/auth/register', form);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-hero" aria-label="DevSphere">
        <div className="auth-brand">DevSphere</div>
        <h1>Write code together in real time.</h1>
        <p>Create projects, invite collaborators, run code securely, and keep every workspace moving.</p>
        <div className="auth-hero__stats" aria-label="Platform highlights">
          <span>Shared projects</span>
          <span>Realtime presence</span>
          <span>Execution history</span>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="register-title">
        <span className="auth-eyebrow">Get started</span>
        <h2 id="register-title">Create account</h2>
        <p className="auth-subtitle">Start a workspace and invite collaborators when you are ready.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}

          <label className="auth-field" htmlFor="register-username">
            Username
            <input
              id="register-username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              required
            />
          </label>

          <label className="auth-field" htmlFor="register-email">
            Email
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>

          <label className="auth-field" htmlFor="register-password">
            Password
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </label>

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

export default Register;
