import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
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
          Unsupported Flag
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
    case 'none':
      return (
        <span
          className="brutalist-badge"
          style={{ background: '#e6f9ed', color: '#008a3e', borderColor: '#008a3e' }}
        >
          Supported
        </span>
      );
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{flagType}</span>;
  }
}

function getActionBadge(actionType) {
  switch (actionType) {
    case 'REWRITE_SUGGESTED':
      return <span className="brutalist-badge brutalist-badge-cyan">Rewrite Suggested</span>;
    case 'APPLY_WITH_CAVEAT':
      return <span className="brutalist-badge brutalist-badge-yellow">Apply With Caveat</span>;
    case 'SKIP_ROLE_RECOMMENDED':
      return <span className="brutalist-badge brutalist-badge-red">Skip Role Recommended</span>;
    default:
      return <span className="brutalist-badge brutalist-badge-outline">{actionType}</span>;
  }
}

export default function ApplicationDetail() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [showTrajectory, setShowTrajectory] = useState(false);

  const fetchApplicationDetails = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/applications/${id}`);
      setApplication(data.application);

      // If cached analysis already exists on the application record
      if (data.application && typeof data.application.fit_score === 'number') {
        setAnalysisResult({
          baseline: {
            fit_score: data.application.fit_score,
            mismatch_reasons: data.application.mismatch_reasons || [],
            cached: true,
          },
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load application details');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    fetchApplicationDetails();
  }, [fetchApplicationDetails]);

  const handleRunAgenticAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const data = await apiFetch(`/applications/${id}/analyze-v2`, {
        method: 'POST',
      });
      setAnalysisResult(data);
    } catch (err) {
      setError(err.message || 'Failed to run Agentic v2 fit analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="brutalist-card brutalist-card-lg" style={{ textAlign: 'center', margin: '40px auto', maxWidth: '580px' }}>
        <h1 className="brutalist-card-title">Authentication Required</h1>
        <p style={{ margin: '16px 0', color: 'var(--text-muted)' }}>
          Please log in to inspect application details and run multi-agent truth audits.
        </p>
        <Link to="/login" className="brutalist-btn brutalist-btn-primary">
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="brutalist-card" style={{ textAlign: 'center', padding: '48px' }}>
        <h2 style={{ fontWeight: 800 }}>LOADING APPLICATION DETAILS...</h2>
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="brutalist-alert brutalist-alert-danger">
        <strong>Error:</strong> {error}
        <div style={{ marginTop: '12px' }}>
          <Link to="/dashboard" className="brutalist-btn brutalist-btn-sm">
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const baseline = analysisResult?.baseline;
  const agentic = analysisResult?.agentic_v2;

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '16px' }}>
        <Link to="/dashboard" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '12px' }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Header Info Panel */}
      <div className="brutalist-card">
        <div className="brutalist-card-header">
          <div>
            <span className="brutalist-badge brutalist-badge-outline" style={{ marginBottom: '8px' }}>
              {application?.platform?.toUpperCase()}
            </span>
            <h1 className="brutalist-card-title" style={{ fontSize: '26px' }}>
              {application?.company_name} — {application?.role_title}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleRunAgenticAnalysis}
            disabled={analyzing}
            className="brutalist-btn brutalist-btn-primary"
            style={{ padding: '12px 24px', fontSize: '15px' }}
          >
            {analyzing ? '⚡ Running Agentic Pipeline...' : '⚡ Run Agentic Fit Audit (v2)'}
          </button>
        </div>

        {error && (
          <div className="brutalist-alert brutalist-alert-danger" style={{ marginTop: '16px' }}>
            <strong>Analysis Error:</strong> {error}
          </div>
        )}

        {/* Job Description & Linked Resume Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div style={{ background: '#ffffff', border: '2px solid #000', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Linked Resume
            </div>
            <div style={{ fontWeight: 700 }}>
              {application?.resume_name || 'Resume'}
            </div>
            {application?.resume_id && (
              <Link
                to={`/resumes/${application.resume_id}/insights`}
                style={{ fontSize: '12px', color: 'var(--accent-red)', fontWeight: 800, display: 'inline-block', marginTop: '6px' }}
              >
                View Historical Memory Insights &rarr;
              </Link>
            )}
          </div>

          <div style={{ background: '#ffffff', border: '2px solid #000', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Job Description Excerpt
            </div>
            <div style={{ fontSize: '13px', maxHeight: '70px', overflowY: 'auto', color: '#333' }}>
              {application?.job_description}
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Comparison Container */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: BASELINE (Plain Single Score) */}
        <div className="brutalist-card" style={{ background: '#ffffff', minHeight: '480px' }}>
          <div className="brutalist-card-header">
            <div>
              <span className="brutalist-badge brutalist-badge-outline" style={{ marginBottom: '4px' }}>
                Single-Prompt Gemini
              </span>
              <h2 className="brutalist-card-title">Baseline Engine</h2>
            </div>
            {baseline && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '36px', fontWeight: 800 }}>
                  {baseline.fit_score}<span style={{ fontSize: '20px' }}>%</span>
                </div>
              </div>
            )}
          </div>

          {!baseline && (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 700 }}>No baseline analysis generated yet.</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>Click "Run Agentic Fit Audit" above to compare.</p>
            </div>
          )}

          {baseline && (
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                Claimed Mismatch Reasons ({baseline.mismatch_reasons?.length || 0})
              </h3>

              {(!baseline.mismatch_reasons || baseline.mismatch_reasons.length === 0) ? (
                <div className="brutalist-alert" style={{ background: '#f5f5f5' }}>
                  No mismatch reasons claimed by baseline model.
                </div>
              ) : (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {baseline.mismatch_reasons.map((reason, idx) => (
                    <li
                      key={idx}
                      style={{
                        padding: '12px',
                        border: '2px solid #000',
                        marginBottom: '10px',
                        background: '#fafafa',
                        fontSize: '13px',
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ fontWeight: 800, marginRight: '6px' }}>#{idx + 1}</span>
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: AGENTIC PIPELINE (Verified Score, Flags, Strategist Actions) */}
        <div
          className="brutalist-card"
          style={{
            background: '#ffffff',
            borderWidth: 'var(--border-width-thick)',
            boxShadow: 'var(--shadow-offset-lg)',
            minHeight: '480px',
          }}
        >
          <div className="brutalist-card-header" style={{ borderBottomColor: 'var(--border-color)' }}>
            <div>
              <span className="brutalist-badge brutalist-badge-red" style={{ marginBottom: '4px' }}>
                4-Stage Multi-Agent
              </span>
              <h2 className="brutalist-card-title">Agentic Pipeline</h2>
            </div>
            {agentic && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent-red)' }}>
                  {agentic.verified_score}<span style={{ fontSize: '20px' }}>%</span>
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Verified Fit Score
                </div>
              </div>
            )}
          </div>

          {!agentic && (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
              <p style={{ fontWeight: 700 }}>Agentic audit ready to execute.</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>
                Click the <strong>⚡ Run Agentic Fit Audit</strong> button to trigger the Extractor &rarr; Matcher &rarr; Verifier &rarr; Strategist pipeline.
              </p>
            </div>
          )}

          {agentic && (
            <div>
              {/* Overall Strategy Banner */}
              {agentic.overall_strategy && (
                <div
                  className="brutalist-card"
                  style={{
                    margin: '0 0 20px 0',
                    background: '#fdfcee',
                    border: '2px solid #000',
                    boxShadow: 'var(--shadow-offset-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }}>
                      Overall Strategy Recommendation
                    </span>
                    <span className="brutalist-badge brutalist-badge-cyan">
                      {agentic.overall_strategy.recommendation}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#222' }}>
                    {agentic.overall_strategy.rationale}
                  </p>
                </div>
              )}

              {/* Audited Verifications & Flags List */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                  Audited Claims &amp; Verifications ({agentic.verifications?.length || 0})
                </h3>

                {(!agentic.verifications || agentic.verifications.length === 0) ? (
                  <div className="brutalist-alert" style={{ background: '#f5f5f5' }}>
                    No mismatch claims required verification.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {agentic.verifications.map((v, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '2px solid #000',
                          padding: '12px 14px',
                          background: v.flag_type === 'unsupported' ? '#ffebe8' : v.flag_type === 'phrasing_risk' ? '#fffde8' : '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px' }}>
                            {v.claim}
                          </span>
                          {getFlagBadge(v.flag_type)}
                        </div>

                        <div style={{ fontSize: '12px', background: '#ffffff', border: '1px solid #000', padding: '8px', marginTop: '6px' }}>
                          <strong>Evidence Check:</strong> {v.evidence}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Strategist Actions List with REQUIRES APPROVAL Badges */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
                  Candidate Strategist Action Plans ({agentic.strategist_actions?.length || 0})
                </h3>

                {(!agentic.strategist_actions || agentic.strategist_actions.length === 0) ? (
                  <div className="brutalist-alert" style={{ background: '#f5f5f5' }}>
                    No strategic revisions needed for this application.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {agentic.strategist_actions.map((act, idx) => (
                      <div
                        key={idx}
                        style={{
                          border: '3px solid #000',
                          padding: '14px',
                          background: '#ffffff',
                          boxShadow: 'var(--shadow-offset-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          {getActionBadge(act.action)}

                          {act.requires_human_approval && (
                            <span
                              className="brutalist-badge brutalist-badge-red"
                              style={{ background: '#ff3b1f', color: '#ffffff', animation: 'pulse 2s infinite' }}
                            >
                              REQUIRES APPROVAL
                            </span>
                          )}

                          <span className="brutalist-badge brutalist-badge-outline" style={{ fontSize: '10px' }}>
                            STATUS: {(act.status || 'PENDING').toUpperCase()}
                          </span>
                        </div>

                        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '6px' }}>
                          Claim: {act.claim}
                        </div>

                        <p style={{ fontSize: '12px', color: '#444', marginBottom: '8px' }}>
                          <strong>Reasoning:</strong> {act.reasoning}
                        </p>

                        {act.suggested_rewrite && (
                          <div style={{ background: '#e8f9ff', border: '2px dashed #000', padding: '10px', marginTop: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#005580', marginBottom: '4px' }}>
                              Proposed Resume Rephrasing (Draft Only):
                            </div>
                            <div style={{ fontSize: '13px', fontStyle: 'italic' }}>
                              "{act.suggested_rewrite}"
                            </div>
                          </div>
                        )}

                        {act.caveat_note && (
                          <div style={{ background: '#fffde8', border: '2px dashed #000', padding: '10px', marginTop: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#806600', marginBottom: '4px' }}>
                              Interview Discussion Caveat:
                            </div>
                            <div style={{ fontSize: '13px' }}>
                              {act.caveat_note}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Execution Trajectory Log Accordion */}
              {agentic.trajectory && agentic.trajectory.length > 0 && (
                <div style={{ borderTop: '2px solid #000', paddingTop: '16px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setShowTrajectory(!showTrajectory)}
                    className="brutalist-btn brutalist-btn-sm"
                    style={{ width: '100%', marginBottom: '12px' }}
                  >
                    {showTrajectory ? '▲ Hide Pipeline Trajectory Logs' : '▼ View 4-Stage Pipeline Trajectory Logs'}
                  </button>

                  {showTrajectory && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {agentic.trajectory.map((step, idx) => (
                        <div key={idx} className="brutalist-code-block" style={{ margin: 0 }}>
                          <div style={{ color: 'var(--accent-yellow)', fontWeight: 800, marginBottom: '4px' }}>
                            STAGE {idx + 1}: {step.step.toUpperCase()} ({step.duration_ms}ms)
                          </div>
                          <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify({ input: step.input, output: step.output }, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
