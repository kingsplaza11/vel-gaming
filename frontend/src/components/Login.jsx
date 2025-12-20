import React, { useState } from 'react';
import { authService } from '../services/api';
import { Icon } from '@iconify/react';
import './Auth.css';

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const response = await authService.login(formData);
      onLogin(response.data);
    } catch (error) {
      setError(error.response?.data?.error || 'Login failed. Please check your credentials.');
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
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to access premium gaming</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-container">
              <Icon icon="mdi:account" className="input-icon" />
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-container">
              <Icon icon="mdi:lock" className="input-icon" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                <Icon icon={showPassword ? 'mdi:eye-off' : 'mdi:eye'} />
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading">Signing In...</span>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="auth-switch">
            New to Veltora? <a href="/register">Create an account</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;