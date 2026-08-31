import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setFormError('Both email and password are required');
      return;
    }

    setFormError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail('demo@truth-tracker.io');
    setPassword('password123');
    setFormError('');
  };

  return (
    <div className="brutalist-card brutalist-card-lg" style={{ maxWidth: '520px', margin: '40px auto' }}>
      <div className="brutalist-card-header">
        <h1 className="brutalist-card-title">Authentication</h1>
        <span className="brutalist-badge brutalist-badge-red">In-Memory JWT</span>
      </div>

      <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
        Sign in to access candidate mission control, evaluate agentic match verifications, and audit strategist recommendations.
      </p>

      {formError && (
        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Auth Error:</strong> {formError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', fontSize: '12px' }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="candidate@truth-tracker.io"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              border: 'var(--border-width) solid var(--border-color)',
              boxShadow: 'var(--shadow-offset-sm)',
              background: '#ffffff',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', fontSize: '12px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              border: 'var(--border-width) solid var(--border-color)',
              boxShadow: 'var(--shadow-offset-sm)',
              background: '#ffffff',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            className="brutalist-btn brutalist-btn-primary"
            style={{ flex: '1 1 180px' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={fillDemoCredentials}
            className="brutalist-btn"
            style={{ flex: '1 1 180px', background: '#ffe600' }}
          >
            Use Demo Login
          </button>
        </div>
      </form>
    </div>
  );
}
