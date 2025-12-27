import React, { useEffect, useState } from "react";
import { authService } from "../services/api";
import { useSearchParams, Link } from "react-router-dom";
import './Auth.css';

const Register = ({ onLogin }) => {
  const [params] = useSearchParams();
  const refFromLink = params.get("ref");
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showRef, setShowRef] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    full_name: "",
    phone_number: "",
    referral_code_input: "",
  });

  useEffect(() => {
    if (refFromLink) {
      setShowRef(true);
      setForm((p) => ({ ...p, referral_code_input: refFromLink }));
    }
  }, [refFromLink]);

  const validateForm = () => {
    if (!form.full_name.trim()) {
      setError("Full name is required");
      return false;
    }
    if (!form.username.trim()) {
      setError("Username is required");
      return false;
    }
    if (!form.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!form.password) {
      setError("Password is required");
      return false;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const res = await authService.register(form);
      setSuccess("Registration successful! Redirecting...");
      onLogin(res.data);
    } catch (err) {
      const data = err.response?.data;

      if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstError = data[firstKey]?.[0];
        setError(firstError || "Registration failed");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      submit();
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative Elements */}
      <div className="decorative-cards"></div>
      <div className="decorative-cards"></div>
      <div className="decorative-cards"></div>
      <div className="decorative-chip"></div>
      <div className="decorative-chip"></div>

      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <div className="logo-container">
            <div className="logo-symbol">V</div>
            <div className="logo-text">VELTORA</div>
          </div>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join our premium platform today</p>
        </div>

        {/* Error/Success Messages */}
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

        {/* Registration Form */}
        <div className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-container">
              <span className="input-icon">👤</span>
              <input 
                type="text"
                placeholder="Enter your full name"
                value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username</label>
            <div className="input-container">
              <span className="input-icon">@</span>
              <input 
                type="text"
                placeholder="Choose a username"
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-container">
              <span className="input-icon">✉️</span>
              <input 
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Phone Number</label>
            <div className="input-container">
              <span className="input-icon">📱</span>
              <input 
                type="tel"
                placeholder="Enter your phone number"
                value={form.phone_number}
                onChange={e => setForm({...form, phone_number: e.target.value})}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-container">
              <span className="input-icon">🔒</span>
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <button 
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {/* Referral Code Section */}
          {!showRef ? (
            <div className="auth-switch" style={{ margin: "20px 0" }}>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  setShowRef(true);
                }}
                style={{ fontSize: "0.9rem" }}
              >
                Have a referral code? Click here
              </a>
            </div>
          ) : (
            <div className="form-group">
              <label>Referral Code (Optional)</label>
              <div className="input-container">
                <span className="input-icon">🎁</span>
                <input 
                  type="text"
                  placeholder="Enter referral code if you have one"
                  value={form.referral_code_input}
                  onChange={e => setForm({...form, referral_code_input: e.target.value})}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          <div className="terms-group">
            <input 
              type="checkbox" 
              id="terms"
              defaultChecked
            />
            <label htmlFor="terms">
              I agree to the <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
            </label>
          </div>

          {/* Submit Button */}
          <button 
            className="auth-button"
            onClick={submit}
            disabled={loading}
          >
            {loading ? (
              <div className="auth-loading">
                Processing...
              </div>
            ) : (
              "Create Account"
            )}
          </button>

          {/* Switch to Login */}
          <div className="auth-switch">
            Already have an account? <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;