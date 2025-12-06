import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import './ResetPassword.css';

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const verifyToken = useCallback(async () => {
    try {
      const response = await api.get(`/auth/verify-reset-token/${token}`);
      setValidToken(response.data.valid);
    } catch (err) {
      setValidToken(false);
      setError('This reset link is invalid or has expired.');
    }
    setVerifying(false);
  }, [token]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }

    setLoading(false);
  };

  if (verifying) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-content glass-card">
          <div className="loading-spinner"></div>
          <p className="verifying-text">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-content glass-card">
          <div className="error-icon">✕</div>
          <h2 className="reset-password-title">Link Expired</h2>
          <p className="reset-password-message">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/forgot-password" className="request-new-link-btn">
            Request a New Link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-content glass-card">
          <div className="success-icon">✓</div>
          <h2 className="reset-password-title">Password Reset!</h2>
          <p className="reset-password-message">
            Your password has been updated successfully.
          </p>
          <p className="redirect-notice">Redirecting to login...</p>
          <Link to="/login" className="back-to-login-btn">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <div className="reset-password-content glass-card">
        <div className="lock-icon">🔐</div>
        <h2 className="reset-password-title">Set New Password</h2>
        <p className="reset-password-subtitle">
          Enter your new password below.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="reset-password-form">
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="form-submit">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <p className="reset-password-footer">
          Remember your password? <Link to="/login" className="text-link">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;