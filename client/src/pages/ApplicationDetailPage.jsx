import React from 'react';
import { useParams } from 'react-router-dom';

export default function ApplicationDetailPage() {
  const { id } = useParams();

  return (
    <div>
      <div className="brutalist-card">
        <div className="brutalist-card-header">
          <h1 className="brutalist-card-title">Application Fit Audit — ID: {id}</h1>
          <span className="brutalist-badge brutalist-badge-red">Multi-Agent v2</span>
        </div>
        <p style={{ marginBottom: '16px' }}>
          Side-by-side comparison between single-prompt Baseline and 4-Stage Agentic Pipeline (Extractor &rarr; Matcher &rarr; Verifier &rarr; Strategist).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '24px' }}>
          {/* Baseline Panel */}
          <div className="brutalist-card" style={{ margin: 0, background: '#ffffff' }}>
            <div className="brutalist-card-header">
              <h2 style={{ fontSize: '15px', fontWeight: 800 }}>Baseline Engine</h2>
              <span className="brutalist-badge brutalist-badge-outline">Single Gemini</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, margin: '12px 0' }}>
              70<span style={{ fontSize: '18px' }}>%</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Unverified heuristic fit score without claim auditing.
            </p>
          </div>

          {/* Agentic v2 Panel */}
          <div className="brutalist-card" style={{ margin: 0, background: '#fdfcee', borderColor: 'var(--border-color)' }}>
            <div className="brutalist-card-header">
              <h2 style={{ fontSize: '15px', fontWeight: 800 }}>Agentic v2 Verified</h2>
              <span className="brutalist-badge brutalist-badge-red">4-Stage Pipeline</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 800, margin: '12px 0', color: 'var(--accent-red)' }}>
              85<span style={{ fontSize: '18px' }}>%</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Audited match score with fact-checking against raw resume evidence.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
