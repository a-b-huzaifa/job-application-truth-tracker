import React from 'react';

export default function LoginPage() {
  return (
    <div className="brutalist-card brutalist-card-lg" style={{ maxWidth: '480px', margin: '40px auto' }}>
      <div className="brutalist-card-header">
        <h1 className="brutalist-card-title">Authentication</h1>
        <span className="brutalist-badge brutalist-badge-red">Security Gate</span>
      </div>
      <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
        Truth Tracker candidate portal. Enter credentials to manage applications, analyze fit metrics, and verify truth claims.
      </p>
      <div className="brutalist-alert brutalist-alert-danger">
        <strong>Notice:</strong> Auth forms will be activated in the next development phase.
      </div>
    </div>
  );
}
