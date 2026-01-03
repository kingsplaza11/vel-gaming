import React, { useState } from 'react';
import { authService } from '../services/api';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import './Auth.css';

const PasswordReset = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.requestPasswordReset(email);
      if (response.detail || response.success) {
        setSuccess('Password reset link has been sent to your email');
      } else if (response.email) {
        setError(response.email[0]);
      }
    } catch (error) {
      setError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative elements */}
      <div className="decorative-cards">
        <Icon icon="mdi:cards-playing" style={{ fontSize: '60px', color: 'rgba(255, 215, 0, 0.2)' }} />
      </div>
      <div className="decorative-chip"></div>
      <div className="decorative-chip"></div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container">
            <div className="logo-symbol">V</div>
            <div className="logo-text">Veltora</div>
          </div>
          <h2>Reset Password</h2>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-container">
              <Icon icon="mdi:email" className="input-icon" />
              <input
                id="email"
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              <Icon icon="mdi:alert-circle" className="error-icon" />
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              <Icon icon="mdi:check-circle" className="success-icon" />
              {success}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading">Sending...</span>
            ) : (
              'Send Reset Link'
            )}
          </button>

          <div className="auth-links">
            <Link to="/login" className="auth-link">
              <Icon icon="mdi:arrow-left" /> Back to Login
            </Link>
            <Link to="/register" className="auth-link">
              Create New Account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordReset;