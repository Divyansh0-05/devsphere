import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { getAuthToken } from './api/client';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ProjectEditorPage from './pages/ProjectEditorPage';
import Register from './pages/Register';
import './App.css';

function RequireAuth({ children }) {
  return getAuthToken() ? children : <Navigate to="/login" replace />;
}

function PublicOnly({ children }) {
  return getAuthToken() ? <Navigate to="/dashboard" replace /> : children;
}

function getStoredUserRole() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role;
  } catch {
    return undefined;
  }
}

function RequireAdmin({ children }) {
  if (!getAuthToken()) {
    return <Navigate to="/login" replace />;
  }

  return getStoredUserRole() === 'admin'
    ? children
    : <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={(
            <PublicOnly>
              <Login />
            </PublicOnly>
          )}
        />
        <Route
          path="/register"
          element={(
            <PublicOnly>
              <Register />
            </PublicOnly>
          )}
        />
        <Route
          path="/dashboard"
          element={(
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          )}
        />
        <Route
          path="/projects/:id"
          element={(
            <RequireAuth>
              <ProjectEditorPage />
            </RequireAuth>
          )}
        />
        <Route
          path="/admin"
          element={(
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          )}
        />
        <Route path="/" element={<Navigate to={getAuthToken() ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={getAuthToken() ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
