import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

function getFlagBadge(flagType) {
  switch (flagType) {
    case 'unsupported':
      return (
        <span
          className="brutalist-badge brutalist-badge-red"
          style={{ background: '#ff3b1f', color: '#ffffff' }}
        >
          Unsupported Screener Hallucination
        </span>
      );
    case 'phrasing_risk':
      return (
        <span
          className="brutalist-badge brutalist-badge-yellow"
          style={{ background: '#ffe600', color: '#000000' }}
        >
          Phrasing Risk
        </span>
      );
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{flagType}</span>;
  }
}

export default function ResumeInsights() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [insights, setInsights] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all user resumes to allow quick variant switching
  useEffect(() => {
    if (!isAuthenticated) return;
    apiFetch('/resumes')
      .then((data) => {
        setResumes(data.resumes || []);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const fetchInsights = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/resumes/${id}/insights`);
      setInsights(data);
    } catch (err) {
      setError(err.message || 'Failed to load resume pattern insights');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  if (!isAuthenticated) {
    return (
      <div className="brutalist-card brutalist-card-lg" style={{ textAlign: 'center', margin: '40px auto', maxWidth: '580px' }}>
        <h1 className="brutalist-card-title">Authentication Required</h1>
        <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
          Please log in to inspect resume memory intelligence and recurring evaluator pattern warnings.
        </p>
        <Link to="/login" className="brutalist-btn brutalist-btn-primary">
          Go to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/dashboard" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Resume Variant Selector Bar */}
      {resumes.length > 1 && (
        <div className="brutalist-card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Switch Resume Variant:
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {resumes.map((r) => {
              const isSelected = r.id === id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/resumes/${r.id}/insights`)}
                  className={`brutalist-btn brutalist-btn-sm ${isSelected ? 'brutalist-btn-primary' : ''}`}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Header Info Card */}
      <div className="brutalist-card">
        <div className="brutalist-card-header">
          <div>
            <span className="brutalist-badge brutalist-badge-red" style={{ marginBottom: '6px' }}>
              Memory Intelligence
            </span>
            <h1 className="brutalist-card-title" style={{ fontSize: '24px' }}>
              {insights?.resume_name || 'Resume Variant Insights'}
            </h1>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Resume ID: <code>{id}</code>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '32px', fontWeight: 800, color: (insights?.total_flags || 0) > 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
              {insights?.total_flags || 0}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Historical Audit Flags
            </div>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#333' }}>
          The Agentic Memory Service tracks recurring evaluative friction points across all job applications where this resume variant was submitted.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="brutalist-card" style={{ textAlign: 'center', padding: '48px' }}>
          <h2 style={{ fontWeight: 800 }}>ANALYZING HISTORICAL AUDIT LOGS...</h2>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Error Loading Insights:</strong> {error}
        </div>
      )}

      {/* Content Body */}
      {!loading && !error && insights && (
        <div>
          {/* Proactive Pattern Warnings Ranked List */}
          <div className="brutalist-card brutalist-card-lg" style={{ background: '#ffffff', marginBottom: '28px' }}>
            <div className="brutalist-card-header">
              <div>
                <h2 className="brutalist-card-title">Recurring Pattern Warnings (Ranked by Frequency)</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Actionable optimizations to prevent screening false-negatives and reviewer skepticism
                </div>
              </div>
              <span className="brutalist-badge brutalist-badge-outline">
                {insights.pattern_warnings?.length || 0} Patterns Identified
              </span>
            </div>

            {(!insights.pattern_warnings || insights.pattern_warnings.length === 0) ? (
              <div className="brutalist-alert" style={{ background: '#e6f9ed', borderColor: '#008a3e' }}>
                <strong style={{ color: '#008a3e' }}>Clean Evaluation Record:</strong> No recurring evaluator hallucinations or phrasing risks have been detected for this resume variant.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {insights.pattern_warnings.map((item, index) => {
                  const rank = index + 1;
                  const isUnsupported = item.flag_type === 'unsupported';

                  return (
                    <div
                      key={index}
                      style={{
                        border: '3px solid #000',
                        padding: '18px',
                        background: isUnsupported ? '#ffebe8' : '#fffde8',
                        boxShadow: 'var(--shadow-offset)',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              background: '#000000',
                              color: '#ffffff',
                              fontWeight: 800,
                              fontSize: '14px',
                              padding: '2px 8px',
                            }}
                          >
                            RANK #{rank}
                          </span>
                          <span className="brutalist-badge" style={{ background: '#000000', color: '#ffffff' }}>
                            {item.frequency}x Flagged
                          </span>
                        </div>

                        {getFlagBadge(item.flag_type)}
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '8px' }}>
                        Claim: "{item.claim_text}"
                      </div>

                      <div style={{ background: '#ffffff', border: '2px solid #000', padding: '12px', marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-red)', marginBottom: '4px' }}>
                          Actionable Pattern Guidance:
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                          {item.warning}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown Tables by Flag Type */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
            {/* Unsupported Flags Group */}
            <div className="brutalist-card" style={{ margin: 0, background: '#ffffff' }}>
              <div className="brutalist-card-header">
                <div>
                  <span className="brutalist-badge brutalist-badge-red" style={{ marginBottom: '4px' }}>
                    Type: Unsupported
                  </span>
                  <h3 className="brutalist-card-title" style={{ fontSize: '16px' }}>
                    Screener False Negatives
                  </h3>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 800 }}>
                  {insights.by_flag_type?.unsupported?.length || 0}
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Skills present on resume that ATS/evaluators hallucinated as missing.
              </p>

              {(!insights.by_flag_type?.unsupported || insights.by_flag_type.unsupported.length === 0) ? (
                <div style={{ fontSize: '12px', color: '#777', padding: '12px 0' }}>None recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {insights.by_flag_type.unsupported.map((item, i) => (
                    <div key={i} style={{ border: '2px solid #000', padding: '10px 12px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px' }}>
                        <span>{item.claim_text}</span>
                        <span className="brutalist-badge brutalist-badge-red" style={{ fontSize: '10px' }}>
                          {item.frequency}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phrasing Risk Flags Group */}
            <div className="brutalist-card" style={{ margin: 0, background: '#ffffff' }}>
              <div className="brutalist-card-header">
                <div>
                  <span className="brutalist-badge brutalist-badge-yellow" style={{ marginBottom: '4px' }}>
                    Type: Phrasing Risk
                  </span>
                  <h3 className="brutalist-card-title" style={{ fontSize: '16px' }}>
                    Overclaim Framing Triggers
                  </h3>
                </div>
                <span style={{ fontSize: '20px', fontWeight: 800 }}>
                  {insights.by_flag_type?.phrasing_risk?.length || 0}
                </span>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Truthful qualifications phrased with wording that triggered human reviewer skepticism.
              </p>

              {(!insights.by_flag_type?.phrasing_risk || insights.by_flag_type.phrasing_risk.length === 0) ? (
                <div style={{ fontSize: '12px', color: '#777', padding: '12px 0' }}>None recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {insights.by_flag_type.phrasing_risk.map((item, i) => (
                    <div key={i} style={{ border: '2px solid #000', padding: '10px 12px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '13px' }}>
                        <span>{item.claim_text}</span>
                        <span className="brutalist-badge brutalist-badge-yellow" style={{ fontSize: '10px' }}>
                          {item.frequency}x
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
