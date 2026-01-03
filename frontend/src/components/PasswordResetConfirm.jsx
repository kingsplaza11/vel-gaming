import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import { Icon } from '@iconify/react';
import './Auth.css';

const PasswordResetConfirm = () => {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [formData, setFormData] = useState({
    uid: uid || '',
    token: token || '',
    new_password1: '',
    new_password2: '',
  });
  
  const [showPassword, setShowPassword] = useState({
    new_password1: false,
    new_password2: false,
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState(false);

  useEffect(() => {
    // Check if we have uid and token from URL params
    if (uid && token) {
      setFormData(prev => ({
        ...prev,
        uid,
        token
      }));
      setValidToken(true);
    } else {
      // Try to get from query string
      const searchParams = new URLSearchParams(location.search);
      const uidFromQuery = searchParams.get('uid');
      const tokenFromQuery = searchParams.get('token');
      
      if (uidFromQuery && tokenFromQuery) {
        setFormData(prev => ({
          ...prev,
          uid: uidFromQuery,
          token: tokenFromQuery
        }));
        setValidToken(true);
      }
    }
  }, [uid, token, location.search]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field],
    });
  };

  const validatePassword = () => {
    if (!formData.new_password1 || !formData.new_password2) {
      setError('Both password fields are required');
      return false;
    }
    
    if (formData.new_password1 !== formData.new_password2) {
      setError('Passwords do not match');
      return false;
    }
    
    if (formData.new_password1.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!validatePassword()) {
      setLoading(false);
      return;
    }

    try {
      const response = await authService.resetPasswordConfirm(
        formData.uid,
        formData.token,
        formData.new_password1,
        formData.new_password2
      );
      
      if (response.detail) {
        setSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else if (response.error) {
        setError(response.error);
        if (response.errors) {
          // Handle specific field errors
          const errorMessages = Object.values(response.errors).join(', ');
          setError(`Password validation failed: ${errorMessages}`);
        }
      } else {
        setError('Failed to reset password. Please try again.');
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setError(error.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!validToken) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h2>Invalid Reset Link</h2>
            <p className="auth-subtitle">The password reset link is invalid or has expired.</p>
            <button 
              className="auth-button" 
              onClick={() => navigate('/password-reset')}
            >
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h2>Set New Password</h2>
          <p className="auth-subtitle">Enter your new password</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Hidden fields for uid and token */}
          <input type="hidden" name="uid" value={formData.uid} />
          <input type="hidden" name="token" value={formData.token} />
          
          <div className="form-group">
            <label htmlFor="new_password1">New Password</label>
            <div className="input-container">
              <Icon icon="mdi:lock" className="input-icon" />
              <input
                id="new_password1"
                type={showPassword.new_password1 ? 'text' : 'password'}
                name="new_password1"
                value={formData.new_password1}
                onChange={handleChange}
                placeholder="Enter new password (min. 8 characters)"
                required
                minLength="8"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('new_password1')}
                tabIndex="-1"
              >
                <Icon icon={showPassword.new_password1 ? 'mdi:eye-off' : 'mdi:eye'} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="new_password2">Confirm New Password</label>
            <div className="input-container">
              <Icon icon="mdi:lock-check" className="input-icon" />
              <input
                id="new_password2"
                type={showPassword.new_password2 ? 'text' : 'password'}
                name="new_password2"
                value={formData.new_password2}
                onChange={handleChange}
                placeholder="Confirm new password"
                required
                minLength="8"
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('new_password2')}
                tabIndex="-1"
              >
                <Icon icon={showPassword.new_password2 ? 'mdi:eye-off' : 'mdi:eye'} />
              </button>
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
              <span className="auth-loading">Resetting Password...</span>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PasswordResetConfirm;