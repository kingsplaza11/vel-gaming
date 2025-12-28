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
    phone_number: "",
    full_name: "",
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
          phone_number: profileRes.data.phone_number || "",
          full_name: profileRes.data.full_name || "",
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => (mounted = false);
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
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await api.put("/accounts/profile/", {
        username: formData.username,
        phone_number: formData.phone_number,
        full_name: formData.full_name,
      });

      setUser((prev) => ({
        ...prev,
        username: formData.username,
        phone_number: formData.phone_number,
        full_name: formData.full_name,
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
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* BACKGROUND */}
      <div className="profile-bg-effects">
        <div className="bg-orb orb-1"></div>
        <div className="bg-orb orb-2"></div>
        <div className="bg-orb orb-3"></div>
        <div className="bg-grid"></div>
      </div>

      {/* HEADER */}
      <div className="profile-header">
        <div className="header-content">
          <div className="header-title">
            <div className="title-orb">
              <Icon icon="mdi:account" className="title-icon" />
              <div className="title-glow"></div>
            </div>
            <h1>
              <span className="title-gradient">MY PROFILE</span>
              <div className="title-underline"></div>
            </h1>
          </div>
          <p className="header-subtitle">Your gaming identity, elevated</p>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="profile-main-card">
        <div className="profile-avatar-section">
          <div className="avatar-container">
            <div className="avatar-orb">
              <Icon icon="mdi:account-circle" className="avatar-icon" />
            </div>

            <div className="avatar-info">
              <h2 className="avatar-name">{user.full_name || user.username}</h2>

              <div className="avatar-badges">
                <span className="badge uid">
                  <Icon icon="mdi:identifier" />
                  UID: {user.user_uid}
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
            <Icon icon={isEditing ? "mdi:close" : "mdi:pencil"} />
            <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
          </button>
        </div>

        {/* WALLET */}
        <div className="wallet-display">
          <Icon icon="mdi:wallet" className="wallet-icon" />
          <div className="wallet-info">
            <span>Available Balance</span>
            <strong>₦{formatBalance(wallet?.balance)}</strong>
          </div>
          <button onClick={() => navigate("/wallet")}>Go to Wallet</button>
        </div>

        {/* FORM */}
        <div className="profile-form-section">
          <div className="form-grid">
            {/* USERNAME */}
            <div className="form-group">
              <label>Username</label>
              {isEditing ? (
                <input
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formData.username}</span>
              )}
            </div>

            {/* EMAIL */}
            <div className="form-group">
              <label>Email</label>
              <span>{formData.email}</span>
            </div>

            {/* PHONE */}
            <div className="form-group">
              <label>Phone Number</label>
              {isEditing ? (
                <input
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formData.phone_number || "Not set"}</span>
              )}
            </div>

            {/* FULL NAME */}
            <div className="form-group">
              <label>Full Name</label>
              {isEditing ? (
                <input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formData.full_name || "Not set"}</span>
              )}
            </div>
          </div>

          {isEditing && (
            <button className="save-changes-btn" onClick={handleSave}>
              <Icon icon="mdi:content-save" />
              Save Changes
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default Profile;
