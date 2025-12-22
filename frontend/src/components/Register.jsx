import React, { useState } from 'react';
import { authService } from '../services/api';
import { Icon } from '@iconify/react';
import './Auth.css';

const Register = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState({
    password: false,
    confirmPassword: false
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const validateForm = () => {
    const errors = {};
    
    if (formData.username.length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.agreeTerms) {
      errors.agreeTerms = 'You must agree to the terms and conditions';
    }
    
    return errors;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors({
        ...validationErrors,
        [name]: ''
      });
    }
    
    // Clear messages
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the errors below');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { confirmPassword, agreeTerms, ...registerData } = formData;
      const response = await authService.register(registerData);
      setSuccess('Account created successfully! Redirecting...');
      
      // Short delay before login to show success message
      setTimeout(() => {
        onLogin(response.data);
      }, 1500);
      
    } catch (error) {
      if (error.response?.data) {
        const data = error.response.data;
        const firstError =
          Object.values(data)?.[0]?.[0] || 'Registration failed';
        setError(firstError);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field]
    });
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
          <h2>Join the Gaming Revolution</h2>
          <p className="auth-subtitle">Create your account and start winning</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className={`form-group ${validationErrors.username ? 'error' : ''}`}>
            <label htmlFor="username">Username</label>
            <div className="input-container">
              <Icon icon="mdi:account" className="input-icon" />
              <input
                id="username"
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                disabled={loading}
              />
            </div>
            {validationErrors.username && (
              <span className="validation-message">{validationErrors.username}</span>
            )}
          </div>

          <div className={`form-group ${validationErrors.email ? 'error' : ''}`}>
            <label htmlFor="email">Email Address</label>
            <div className="input-container">
              <Icon icon="mdi:email" className="input-icon" />
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            {validationErrors.email && (
              <span className="validation-message">{validationErrors.email}</span>
            )}
          </div>

          <div className={`form-group ${validationErrors.password ? 'error' : ''}`}>
            <label htmlFor="password">Password</label>
            <div className="input-container">
              <Icon icon="mdi:lock" className="input-icon" />
              <input
                id="password"
                type={showPassword.password ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('password')}
                tabIndex="-1"
              >
                <Icon icon={showPassword.password ? 'mdi:eye-off' : 'mdi:eye'} />
              </button>
            </div>
            {validationErrors.password && (
              <span className="validation-message">{validationErrors.password}</span>
            )}
          </div>

          <div className={`form-group ${validationErrors.confirmPassword ? 'error' : ''}`}>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-container">
              <Icon icon="mdi:lock-check" className="input-icon" />
              <input
                id="confirmPassword"
                type={showPassword.confirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => togglePasswordVisibility('confirmPassword')}
                tabIndex="-1"
              >
                <Icon icon={showPassword.confirmPassword ? 'mdi:eye-off' : 'mdi:eye'} />
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <span className="validation-message">{validationErrors.confirmPassword}</span>
            )}
          </div>

          <div className={`terms-group ${validationErrors.agreeTerms ? 'error' : ''}`}>
            <input
              type="checkbox"
              id="agreeTerms"
              name="agreeTerms"
              checked={formData.agreeTerms}
              onChange={handleChange}
              disabled={loading}
            />
            <label htmlFor="agreeTerms">
              I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>. I confirm that I am 18 years or older.
            </label>
            {validationErrors.agreeTerms && (
              <span className="validation-message" style={{ position: 'static', marginTop: '5px' }}>
                {validationErrors.agreeTerms}
              </span>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading">Creating Account...</span>
            ) : (
              'Create Account'
            )}
          </button>

          <div className="auth-switch">
            Already have an account? <a href="/login">Sign in here</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;