import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import api from "../services/api";
import "./Profile.css";

const Profile = ({ onLogout }) => {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    fullName: "",
  });

  /* =========================
     FETCH USER + WALLET
  ========================= */
  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      try {
        const [profileRes, walletRes] = await Promise.all([
          api.get("/accounts/profile/"),
          api.get("/wallet/balance/"),
        ]);

        if (!mounted) return;

        setUser(profileRes.data);
        setWallet(walletRes.data);

        setFormData({
          username: profileRes.data.username || "",
          email: profileRes.data.email || "",
          phone: profileRes.data.phone_number || "",
          fullName: profileRes.data.full_name || "",
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     HELPERS
  ========================= */
  const formatBalance = (balance) => {
    if (!balance) return "0.00";
    return Number(balance).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await api.put("/accounts/profile/", {
        username: formData.username,
        phone_number: formData.phone,
        full_name: formData.fullName,
      });

      setUser((prev) => ({
        ...prev,
        username: formData.username,
      }));

      setIsEditing(false);
    } catch {
      alert("Failed to update profile");
    }
  };

  /* =========================
     LOADING & ERROR STATES
  ========================= */
  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-orb">
          <div className="orb-glow"></div>
          <Icon icon="mdi:account" className="loading-icon" />
        </div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error">
        <div className="error-orb">
          <Icon icon="mdi:alert-circle" />
        </div>
        <h3>Oops! Something went wrong</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* ANIMATED BACKGROUND ELEMENTS */}
      <div className="profile-bg-effects">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
        <div className="bg-grid"></div>
      </div>

      {/* HEADER SECTION */}
      <div className="profile-header">
        <div className="header-content">
          <div className="header-title">
            <div className="title-orb">
              <Icon icon="mdi:account" className="title-icon" />
              <div className="title-glow"></div>
              <div className="title-sparkle"></div>
              <div className="title-sparkle"></div>
              <div className="title-sparkle"></div>
            </div>
            <h1>
              <span className="title-gradient">MY PROFILE</span>
              <div className="title-underline"></div>
            </h1>
          </div>
          <p className="header-subtitle">Your gaming identity, elevated</p>
        </div>
      </div>

      {/* MAIN PROFILE CARD */}
      <div className="profile-main-card">
        <div className="card-shine-effect"></div>
        <div className="card-glow-effect"></div>
        
        {/* AVATAR SECTION */}
        <div className="profile-avatar-section">
          <div className="avatar-container">
            <div className="avatar-orb">
              <div className="avatar-glow"></div>
              <Icon icon="mdi:account-circle" className="avatar-icon" />
              <div className="avatar-ring"></div>
              <div className="avatar-status">
                <div className="status-pulse"></div>
                <div className="status-dot"></div>
              </div>
            </div>
            <div className="avatar-info">
              <h2 className="avatar-name">{formData.username}</h2>
              <div className="avatar-badges">
                <span className="badge premium">
                  <Icon icon="mdi:crown" />
                  Premium Player
                </span>
                <span className="badge verified">
                  <Icon icon="mdi:check-decagram" />
                  Verified
                </span>
              </div>
            </div>
          </div>

          <button 
            className={`edit-toggle-btn ${isEditing ? "active" : ""}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            <div className="toggle-glow"></div>
            <Icon icon={isEditing ? "mdi:close" : "mdi:pencil"} />
            <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
          </button>
        </div>

        {/* WALLET DISPLAY */}
        <div className="wallet-display">
          <div className="wallet-orb">
            <div className="wallet-glow"></div>
            <Icon icon="mdi:wallet" className="wallet-icon" />
          </div>
          <div className="wallet-info">
            <div className="wallet-label">
              <Icon icon="mdi:currency-ngn" />
              <span>Available Balance</span>
            </div>
            <div className="wallet-balance">
              <span className="currency">₦</span>
              <span className="amount">{formatBalance(wallet?.balance)}</span>
            </div>
          </div>
          <button 
            className="wallet-action-btn"
            onClick={() => navigate("/wallet")}
          >
            <div className="action-glow"></div>
            <Icon icon="mdi:arrow-right" />
            <span>Go to Wallet</span>
          </button>
        </div>

        {/* PROFILE FORM */}
        <div className="profile-form-section">
          <div className="form-grid">
            <div className="form-group">
              <div className="form-label">
                <div className="label-icon">
                  <Icon icon="mdi:account" />
                </div>
                <span>Username</span>
              </div>
              {isEditing ? (
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter username"
                  />
                  <div className="input-glow"></div>
                </div>
              ) : (
                <div className="form-display">
                  <span>{formData.username}</span>
                  <Icon icon="mdi:content-copy" className="copy-icon" />
                </div>
              )}
            </div>

            <div className="form-group">
              <div className="form-label">
                <div className="label-icon">
                  <Icon icon="mdi:email" />
                </div>
                <span>Email Address</span>
              </div>
              <div className="form-display email-display">
                <span>{formData.email}</span>
                <span className="verified-tag">Verified</span>
              </div>
            </div>

            <div className="form-group">
              <div className="form-label">
                <div className="label-icon">
                  <Icon icon="mdi:phone" />
                </div>
                <span>Phone Number</span>
              </div>
              {isEditing ? (
                <div className="input-wrapper">
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter phone number"
                  />
                  <div className="input-glow"></div>
                </div>
              ) : (
                <div className="form-display">
                  <span>{formData.phone_number || "Not set"}</span>
                  {formData.phone_number && (
                    <Icon icon="mdi:content-copy" className="copy-icon" />
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <div className="form-label">
                <div className="label-icon">
                  <Icon icon="mdi:card-account-details" />
                </div>
                <span>Full Name</span>
              </div>
              {isEditing ? (
                <div className="input-wrapper">
                  <input
                    type="text"
                    name="fullName"
                    value={formData.full_name}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Enter full name"
                  />
                  <div className="input-glow"></div>
                </div>
              ) : (
                <div className="form-display">
                  <span>{formData.full_name || "Not set"}</span>
                </div>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="form-actions">
              <button className="save-changes-btn" onClick={handleSave}>
                <div className="save-glow"></div>
                <Icon icon="mdi:content-save" />
                <span>Save Changes</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="quick-actions-section">
        <div className="section-header">
          <Icon icon="mdi:lightning-bolt" />
          <h3>Quick Actions</h3>
        </div>
        <div className="actions-grid">
          <button 
            className="action-btn deposit-btn"
            onClick={() => navigate("/wallet?tab=deposit")}
          >
            <div className="btn-glow"></div>
            <Icon icon="mdi:credit-card-plus" className="btn-icon" />
            <div className="btn-content">
              <span className="btn-title">Deposit</span>
              <span className="btn-subtitle">Add funds instantly</span>
            </div>
            <Icon icon="mdi:arrow-right" className="btn-arrow" />
          </button>

          <button 
            className="action-btn withdraw-btn"
            onClick={() => navigate("/wallet?tab=withdraw")}
          >
            <div className="btn-glow"></div>
            <Icon icon="mdi:credit-card-minus" className="btn-icon" />
            <div className="btn-content">
              <span className="btn-title">Withdraw</span>
              <span className="btn-subtitle">Cash out winnings</span>
            </div>
            <Icon icon="mdi:arrow-right" className="btn-arrow" />
          </button>

          <button 
            className="action-btn support-btn"
            onClick={() => navigate("/support")}
          >
            <div className="btn-glow"></div>
            <Icon icon="mdi:headset" className="btn-icon" />
            <div className="btn-content">
              <span className="btn-title">Support</span>
              <span className="btn-subtitle">Get help 24/7</span>
            </div>
            <Icon icon="mdi:arrow-right" className="btn-arrow" />
          </button>

          <button 
            className="action-btn logout-btn"
            onClick={onLogout}
          >
            <div className="btn-glow"></div>
            <Icon icon="mdi:logout" className="btn-icon" />
            <div className="btn-content">
              <span className="btn-title">Logout</span>
              <span className="btn-subtitle">Secure sign out</span>
            </div>
            <Icon icon="mdi:arrow-right" className="btn-arrow" />
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="profile-footer">
        <div className="footer-content">
          <Icon icon="mdi:shield-check" className="footer-icon" />
          <p>Your account is protected with bank-level security</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;