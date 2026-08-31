import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="brutalist-header">
      <div className="brutalist-header-inner">
        <Link to="/dashboard" className="brutalist-brand">
          <span>Truth Tracker</span>
          <span className="brutalist-brand-badge">Agentic</span>
        </Link>

        <nav className="brutalist-nav">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `brutalist-nav-link ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                {user?.email}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="brutalist-btn brutalist-btn-sm"
                style={{ background: '#ffebe8', color: 'var(--accent-red)' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `brutalist-nav-link ${isActive ? 'active' : ''}`
              }
            >
              Login
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
