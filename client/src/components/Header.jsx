import React from 'react';
import { NavLink, Link } from 'react-router-dom';

export default function Header() {
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
          <NavLink
            to="/applications/demo"
            className={({ isActive }) =>
              `brutalist-nav-link ${isActive ? 'active' : ''}`
            }
          >
            Analyze Fit
          </NavLink>
          <NavLink
            to="/resumes/demo/insights"
            className={({ isActive }) =>
              `brutalist-nav-link ${isActive ? 'active' : ''}`
            }
          >
            Memory Insights
          </NavLink>
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `brutalist-nav-link ${isActive ? 'active' : ''}`
            }
          >
            Login
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
