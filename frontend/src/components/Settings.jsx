import React, { useState } from "react";
import { settingsService } from "../services/api";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import "./Settings.css";

const Settings = ({ user }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    username: user?.username || "",
    email: user?.email || "",
    phone: user?.phone || "",
    fullName: user?.fullName || "",
  });

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsNotifications: false,
    twoFactorAuth: false,
    soundEffects: true,
    darkMode: true,
    autoPlayVideos: false,
  });

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");

  const updateProfile = async () => {
    if (!profile.username.trim() || !profile.email.trim()) {
      setError("Please fill in all required fields");
      return;
    }

    setLoadingProfile(true);
    setError(null);
    setMessage(null);

    try {
      await settingsService.updateProfile(profile);
      setMessage({
        type: "success",
        text: "Profile updated successfully",
        icon: "mdi:check-circle"
      });
    } catch {
      setError("Failed to update profile. Please try again.");
    } finally {
      setLoadingProfile(false);
    }
  };

  const changePassword = async () => {
    if (passwords.new_password !== passwords.confirm_password) {
      setError("New passwords do not match");
      return;
    }

    if (passwords.new_password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoadingPassword(true);
    setError(null);
    setMessage(null);

    try {
      await settingsService.changePassword({
        old_password: passwords.current_password,
        new_password: passwords.new_password
      });
      setMessage({
        type: "success",
        text: "Password changed successfully",
        icon: "mdi:lock-reset"
      });
      setPasswords({ 
        current_password: "", 
        new_password: "", 
        confirm_password: "" 
      });
    } catch {
      setError("Failed to change password. Please check your current password.");
    } finally {
      setLoadingPassword(false);
    }
  };

  const updatePreferences = async () => {
    setLoadingPreferences(true);
    setError(null);
    setMessage(null);

    try {
      await settingsService.updatePreferences(preferences);
      setMessage({
        type: "success",
        text: "Preferences saved successfully",
        icon: "mdi:cog-check"
      });
    } catch {
      setError("Failed to save preferences");
    } finally {
      setLoadingPreferences(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: "mdi:account" },
    { id: "security", label: "Security", icon: "mdi:shield" },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        
        <div className="header-content">
          <div className="header-title">
            <div className="title-icon-wrapper">
              <Icon icon="mdi:cog" className="title-icon" />
              <div className="title-glow"></div>
            </div>
            <h1>Settings</h1>
            <div className="title-decoration"></div>
          </div>
          <p className="header-subtitle">Manage your account settings and preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      {message && (
        <div className={`message-alert ${message.type}`}>
          <Icon icon={message.icon} />
          <span>{message.text}</span>
          <button 
            className="message-close"
            onClick={() => setMessage(null)}
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
      )}

      {error && (
        <div className="error-alert">
          <Icon icon="mdi:alert-circle" />
          <span>{error}</span>
          <button 
            className="error-close"
            onClick={() => setError(null)}
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="settings-content">
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="profile-tab">
            <div className="settings-card">
              <div className="card-header">
                <div className="card-title">
                  <Icon icon="mdi:account-edit" />
                  <h3>Personal Information</h3>
                </div>
                <p className="card-subtitle">Update your personal details</p>
              </div>

              <div className="card-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:account" />
                      <span>Username</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter username"
                        value={profile.username}
                        onChange={(e) =>
                          setProfile({ ...profile, username: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:email" />
                      <span>Email Address</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="email"
                        className="form-input"
                        placeholder="Enter email address"
                        value={profile.email}
                        onChange={(e) =>
                          setProfile({ ...profile, email: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:phone" />
                      <span>Phone Number</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Enter phone number"
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:card-account-details" />
                      <span>Full Name</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Enter your full name"
                        value={profile.fullName}
                        onChange={(e) =>
                          setProfile({ ...profile, fullName: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                  </div>
                </div>

                <div className="form-hint">
                  <Icon icon="mdi:information" />
                  <span>Fields marked with * are required</span>
                </div>
              </div>

              <div className="card-footer">
                <button 
                  className="secondary-btn"
                  onClick={() => setProfile({
                    username: user?.username || "",
                    email: user?.email || "",
                    phone: user?.phone || "",
                    fullName: user?.fullName || "",
                  })}
                >
                  <Icon icon="mdi:refresh" />
                  Reset
                </button>
                <button 
                  className="primary-btn"
                  onClick={updateProfile}
                  disabled={loadingProfile || !profile.username.trim() || !profile.email.trim()}
                >
                  {loadingProfile ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:content-save" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="security-tab">
            <div className="settings-card">
              <div className="card-header">
                <div className="card-title">
                  <Icon icon="mdi:lock-reset" />
                  <h3>Change Password</h3>
                </div>
                <p className="card-subtitle">Update your login password</p>
              </div>

              <div className="card-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:lock" />
                      <span>Current Password</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter current password"
                        value={passwords.current_password}
                        onChange={(e) =>
                          setPasswords({ ...passwords, current_password: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:lock-plus" />
                      <span>New Password</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Enter new password"
                        value={passwords.new_password}
                        onChange={(e) =>
                          setPasswords({ ...passwords, new_password: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                    <div className="password-hint">
                      Must be at least 6 characters long
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <Icon icon="mdi:lock-check" />
                      <span>Confirm Password</span>
                      <span className="required">*</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        type="password"
                        className="form-input"
                        placeholder="Confirm new password"
                        value={passwords.confirm_password}
                        onChange={(e) =>
                          setPasswords({ ...passwords, confirm_password: e.target.value })
                        }
                      />
                      <div className="input-decoration"></div>
                    </div>
                    {passwords.new_password && passwords.confirm_password && (
                      <div className={`password-match ${
                        passwords.new_password === passwords.confirm_password ? 'match' : 'mismatch'
                      }`}>
                        <Icon icon={
                          passwords.new_password === passwords.confirm_password 
                            ? "mdi:check-circle" 
                            : "mdi:close-circle"
                        } />
                        <span>
                          {passwords.new_password === passwords.confirm_password 
                            ? "Passwords match" 
                            : "Passwords do not match"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="security-tips">
                  <div className="tip-header">
                    <Icon icon="mdi:lightbulb-on" />
                    <h4>Password Tips</h4>
                  </div>
                  <ul className="tips-list">
                    <li>Use a mix of uppercase and lowercase letters</li>
                    <li>Include numbers and special characters</li>
                    <li>Avoid using personal information</li>
                    <li>Don't reuse passwords from other sites</li>
                  </ul>
                </div>
              </div>

              <div className="card-footer">
                <button 
                  className="secondary-btn"
                  onClick={() => setPasswords({ 
                    current_password: "", 
                    new_password: "", 
                    confirm_password: "" 
                  })}
                >
                  <Icon icon="mdi:close" />
                  Clear All
                </button>
                <button 
                  className="primary-btn"
                  onClick={changePassword}
                  disabled={loadingPassword || 
                    !passwords.current_password || 
                    !passwords.new_password || 
                    !passwords.confirm_password ||
                    passwords.new_password.length < 6 ||
                    passwords.new_password !== passwords.confirm_password}
                >
                  {loadingPassword ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:lock-reset" />
                      Change Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;