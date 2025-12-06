import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './ForgotPassword.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    }

    setLoading(false);
  };

  if (sent) {
    return (
      <div className="forgot-password-container">
        <div className="forgot-password-content glass-card">
          <div className="success-icon">✉️</div>
          <h2 className="forgot-password-title">Check Your Email</h2>
          <p className="forgot-password-message">
            If an account exists for <strong>{email}</strong>, we've sent a password reset link.
          </p>
          <p className="forgot-password-hint">
            Don't see it? Check your spam folder.
          </p>
          <Link to="/login" className="back-to-login-btn">
            ← Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-content glass-card">
        <h2 className="forgot-password-title">Forgot Password?</h2>
        <p className="forgot-password-subtitle">
          No worries! Enter your email and we'll send you a reset link.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              autoFocus
            />
          </div>

          <button type="submit" disabled={loading} className="form-submit">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="forgot-password-footer">
          Remember your password? <Link to="/login" className="text-link">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ForgotPassword;