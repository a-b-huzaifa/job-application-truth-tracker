import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (isRegisterMode && !name)) {
      setFormError('Please fill in all required fields');
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return;
      }
    }

    setFormError('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setFormError(err.message || (isRegisterMode ? 'Registration failed' : 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIsRegisterMode(false);
    setName('');
    setEmail('demo@truth-tracker.io');
    setPassword('password123');
    setConfirmPassword('');
    setFormError('');
  };

  return (
    <div className="brutalist-card brutalist-card-lg" style={{ maxWidth: '520px', margin: '40px auto' }}>
      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(false);
            setFormError('');
          }}
          className={`brutalist-btn brutalist-btn-sm ${!isRegisterMode ? 'brutalist-btn-primary' : ''}`}
          style={{ flex: 1, padding: '10px' }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(true);
            setFormError('');
          }}
          className={`brutalist-btn brutalist-btn-sm ${isRegisterMode ? 'brutalist-btn-primary' : ''}`}
          style={{ flex: 1, padding: '10px' }}
        >
          Register New Account
        </button>
      </div>

      <div className="brutalist-card-header">
        <h1 className="brutalist-card-title">
          {isRegisterMode ? 'Create Account' : 'Authentication'}
        </h1>
        <span className="brutalist-badge brutalist-badge-red">In-Memory JWT</span>
      </div>

      <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
        {isRegisterMode
          ? 'Register a new candidate profile to start tracking job applications and running truth audits.'
          : 'Sign in to access candidate mission control, evaluate agentic match verifications, and audit strategist recommendations.'}
      </p>

      {formError && (
        <div className="brutalist-alert brutalist-alert-danger">
          <strong>Auth Error:</strong> {formError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {isRegisterMode && (
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', fontSize: '12px' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Candidate Name"
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
        )}

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

        <div style={{ marginBottom: isRegisterMode ? '18px' : '24px' }}>
          <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', fontSize: '12px' }}>
            Password {isRegisterMode && <span style={{ color: 'var(--text-muted)' }}>(min 6 chars)</span>}
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

        {isRegisterMode && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 800, marginBottom: '6px', textTransform: 'uppercase', fontSize: '12px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            className="brutalist-btn brutalist-btn-primary"
            style={{ flex: '1 1 180px' }}
          >
            {loading
              ? isRegisterMode
                ? 'Creating Account...'
                : 'Authenticating...'
              : isRegisterMode
              ? 'Create New Account'
              : 'Sign In'}
          </button>

          {!isRegisterMode && (
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="brutalist-btn"
              style={{ flex: '1 1 180px', background: '#ffe600' }}
            >
              Use Demo Login
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
