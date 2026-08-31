import React from 'react';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  return (
    <div>
      <div className="brutalist-card">
        <div className="brutalist-card-header">
          <h1 className="brutalist-card-title">Candidate Mission Control</h1>
          <span className="brutalist-badge brutalist-badge-red">Live Status</span>
        </div>
        <p style={{ marginBottom: '16px' }}>
          Real-time tracking of active job applications, ghosting detection intervals, and multi-agent fit evaluations.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', margin: '20px 0' }}>
          <div className="brutalist-card" style={{ margin: 0, background: '#fdfcee' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Active Applications</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0' }}>9</div>
            <span className="brutalist-badge brutalist-badge-outline">4 Platforms</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#ffebe8' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Ghosting Detected</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0', color: 'var(--accent-red)' }}>2</div>
            <span className="brutalist-badge brutalist-badge-red">&gt;21 Days Stale</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#e8f9ff' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Verified Analyses</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '8px 0' }}>18</div>
            <span className="brutalist-badge brutalist-badge-cyan">v2 Multi-Agent</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Link to="/applications/demo" className="brutalist-btn brutalist-btn-primary">
            Run Application Fit Analysis
          </Link>
          <Link to="/resumes/demo/insights" className="brutalist-btn">
            View Resume Pattern Memory
          </Link>
        </div>
      </div>
    </div>
  );
}
