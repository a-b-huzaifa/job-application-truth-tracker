import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

function getStatusBadge(status) {
  switch (status) {
    case 'interview':
      return <span className="brutalist-badge brutalist-badge-green">Interview</span>;
    case 'response_received':
      return <span className="brutalist-badge brutalist-badge-cyan">Response</span>;
    case 'applied':
      return <span className="brutalist-badge brutalist-badge-outline">Applied</span>;
    case 'ghosted':
      return <span className="brutalist-badge brutalist-badge-red">Ghosted</span>;
    case 'rejected':
      return <span className="brutalist-badge brutalist-badge-yellow">Rejected</span>;
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{status}</span>;
  }
}

function getPlatformBadge(platform) {
  switch (platform) {
    case 'linkedin':
      return <span className="brutalist-badge" style={{ background: '#0077b5', color: '#fff' }}>LinkedIn</span>;
    case 'wellfound':
      return <span className="brutalist-badge" style={{ background: '#ff6154', color: '#fff' }}>Wellfound</span>;
    case 'direct':
      return <span className="brutalist-badge" style={{ background: '#000', color: '#fff' }}>Direct</span>;
    case 'micro1':
      return <span className="brutalist-badge" style={{ background: '#6c5ce7', color: '#fff' }}>Micro1</span>;
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{platform}</span>;
  }
}

export default function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      apiFetch('/applications'),
      apiFetch('/resumes').catch(() => ({ resumes: [] })),
    ])
      .then(([appsData, resumesData]) => {
        if (isMounted) {
          setApplications(appsData.applications || []);
          setResumes(resumesData.resumes || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load applications');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="brutalist-card brutalist-card-lg" style={{ textAlign: 'center', margin: '40px auto', maxWidth: '640px' }}>
        <div className="brutalist-card-header" style={{ justifyContent: 'center' }}>
          <h1 className="brutalist-card-title">Truth Tracker Mission Control</h1>
        </div>
        <p style={{ margin: '20px 0', fontSize: '15px', color: 'var(--text-muted)' }}>
          Please authenticate to view your tracked applications, inspect AI match verifications, and run agentic fit audits.
        </p>
        <Link to="/login" className="brutalist-btn brutalist-btn-primary" style={{ fontSize: '15px', padding: '12px 28px' }}>
          Sign In to Access Dashboard &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Overview Stats Bar */}
      <div className="brutalist-card" style={{ marginBottom: '28px' }}>
        <div className="brutalist-card-header">
          <div>
            <h1 className="brutalist-card-title">Applications Dashboard</h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Authenticated as <strong>{user?.email}</strong>
            </div>
          </div>
          <span className="brutalist-badge brutalist-badge-green">Session Active</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '16px' }}>
          <div className="brutalist-card" style={{ margin: 0, background: '#ffffff' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Total Tracked</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0' }}>{applications.length}</div>
            <span className="brutalist-badge brutalist-badge-outline">Live Registry</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#ffebe8' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Ghosted Applications</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0', color: 'var(--accent-red)' }}>
              {applications.filter((a) => a.status === 'ghosted').length}
            </div>
            <span className="brutalist-badge brutalist-badge-red">&gt;21 Days Stale</span>
          </div>

          <div className="brutalist-card" style={{ margin: 0, background: '#e8f9ff' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>Interviews & Responses</div>
            <div style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0' }}>
              {applications.filter((a) => a.status === 'interview' || a.status === 'response_received').length}
            </div>
            <span className="brutalist-badge brutalist-badge-cyan">Active Pipeline</span>
          </div>
        </div>

        {/* Resume Variants Memory Links */}
        {resumes.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '2px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>
              Resume Memory Insights:
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {resumes.map((r) => (
                <Link
                  key={r.id}
                  to={`/resumes/${r.id}/insights`}
                  className="brutalist-btn brutalist-btn-sm"
                  style={{ background: '#fdfcee' }}
                >
                  ⚡ {r.name} Insights &rarr;
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="brutalist-card" style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>FETCHING APPLICATIONS FROM DATABASE...</div>
        </div>
      )}

      {error && (
        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Error Loading Applications:</strong> {error}
        </div>
      )}

      {/* Applications Grid */}
      {!loading && !error && applications.length === 0 && (
        <div className="brutalist-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontWeight: 700 }}>No applications found in your registry.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {applications.map((app) => {
          const hasScore = typeof app.fit_score === 'number' || typeof app.baseline_score === 'number';
          const score = app.fit_score ?? app.baseline_score;

          return (
            <div key={app.id} className="brutalist-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                    {app.company_name}
                  </h2>
                  {getStatusBadge(app.status)}
                </div>

                <div style={{ fontSize: '14px', fontWeight: 700, color: '#333333', marginBottom: '14px' }}>
                  {app.role_title}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
                  {getPlatformBadge(app.platform)}
                  {app.applied_at && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Applied: {app.applied_at.split('T')[0]}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Baseline Fit Score:
                  </span>
                  {hasScore ? (
                    <span
                      className="brutalist-badge"
                      style={{
                        background: score >= 80 ? 'var(--accent-green)' : score >= 50 ? 'var(--accent-yellow)' : 'var(--accent-red)',
                        color: score < 50 ? '#ffffff' : '#000000',
                        fontSize: '13px',
                      }}
                    >
                      {score}%
                    </span>
                  ) : (
                    <span className="brutalist-badge brutalist-badge-outline" style={{ color: '#888' }}>
                      Not Analyzed
                    </span>
                  )}
                </div>

                <Link
                  to={`/applications/${app.id}`}
                  className="brutalist-btn brutalist-btn-sm"
                  style={{ width: '100%', textAlign: 'center' }}
                >
                  Inspect Application Fit &rarr;
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
