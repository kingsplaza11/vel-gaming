// src/pages/Support.jsx
import React, { useState } from "react";
import { supportService } from "../services/api";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import "./Support.css";

const Support = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("general");

  const categories = [
    { id: "general", label: "General Inquiry", icon: "mdi:help-circle" },
    { id: "technical", label: "Technical Issue", icon: "mdi:cog" },
    { id: "payment", label: "Payment/Billing", icon: "mdi:credit-card" },
    { id: "account", label: "Account Issue", icon: "mdi:account" },
    { id: "game", label: "Game Related", icon: "mdi:gamepad-variant" },
    { id: "security", label: "Security Concern", icon: "mdi:shield" },
  ];

  const contactMethods = [
    {
      icon: "mdi:email",
      title: "Email Support",
      details: "support@veltoragames.com",
      description: "24/7 email response",
    },
    {
      icon: "mdi:whatsapp",
      title: "WhatsApp Chat",
      details: "+1 (825) 572-0351",
      description: "Live chat support",
    },
    {
      icon: "mdi:clock",
      title: "Response Time",
      details: "< 1 hour",
      description: "Average response time",
    },
  ];

  const submitTicket = async () => {
    if (!message.trim()) {
      setError("Please enter your message");
      return;
    }

    if (message.length < 10) {
      setError("Please provide more details (minimum 10 characters)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await supportService.submitTicket({ 
        message, 
        category: selectedCategory 
      });
      setSent(true);
      setMessage("");
    } catch {
      setError("Failed to submit support request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="support-page">
      {/* Header */}
      <div className="support-header">
        
        <div className="header-content">
          <div className="header-title">
            <div className="title-icon-wrapper">
              <Icon icon="mdi:headset" className="title-icon" />
              <div className="title-glow"></div>
            </div>
            <h1>Support Center</h1>
            <div className="title-decoration"></div>
          </div>
          <p className="header-subtitle">We're here to help you 24/7</p>
        </div>
      </div>

      {/* Contact Methods */}
      <div className="contact-methods">
        {contactMethods.map((method, index) => (
          <div className="contact-card" key={index}>
            <div className="contact-icon">
              <Icon icon={method.icon} />
              <div className="icon-glow"></div>
            </div>
            <div className="contact-content">
              <h3>{method.title}</h3>
              <p className="contact-details">{method.details}</p>
              <p className="contact-description">{method.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="support-content">

        {/* Right Column - Ticket Form */}
        <div className="ticket-section">
          {sent ? (
            <div className="success-card">
              <div className="success-icon">
                <div className="success-glow"></div>
                <Icon icon="mdi:check-circle" />
              </div>
              <div className="success-content">
                <h3>Ticket Submitted Successfully!</h3>
                <p>Your support request has been received. Our team will reach out to you within 1 hour.</p>
                <p className="success-tip">
                  <Icon icon="mdi:clock" />
                  Ticket ID: #VEL-{Date.now().toString().slice(-6)}
                </p>
              </div>
              <button 
                className="new-ticket-btn"
                onClick={() => setSent(false)}
              >
                <Icon icon="mdi:plus" />
                New Ticket
              </button>
            </div>
          ) : (
            <>
              <div className="form-header">
                <Icon icon="mdi:message-text" />
                <h2>Submit Support Ticket</h2>
              </div>

              {error && (
                <div className="error-message">
                  <Icon icon="mdi:alert-circle" />
                  <span>{error}</span>
                </div>
              )}

              <div className="category-selector">
                <p className="selector-label">Select Category:</p>
                <div className="category-grid">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      className={`category-btn ${selectedCategory === category.id ? "active" : ""}`}
                      onClick={() => setSelectedCategory(category.id)}
                    >
                      <Icon icon={category.icon} />
                      <span>{category.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="message-input-container">
                <div className="input-header">
                  <Icon icon="mdi:pencil" />
                  <label>Describe your issue in detail</label>
                  <span className="char-count">{message.length}/2000</span>
                </div>
                <div className="textarea-wrapper">
                  <textarea
                    placeholder="Please provide as much detail as possible about your issue. Include any relevant transaction IDs, game names, or error messages..."
                    value={message}
                    onChange={(e) => {
                      if (e.target.value.length <= 2000) {
                        setMessage(e.target.value);
                        setError(null);
                      }
                    }}
                    disabled={loading}
                    className="message-textarea"
                    rows="8"
                  />
                  <div className="textarea-decoration"></div>
                </div>
                <div className="input-hint">
                  <Icon icon="mdi:information" />
                  <span>For faster resolution, include screenshots if applicable</span>
                </div>
              </div>

              <div className="form-footer">
                <button 
                  className="reset-btn"
                  onClick={() => {
                    setMessage("");
                    setError(null);
                  }}
                  disabled={loading || !message}
                >
                  <Icon icon="mdi:close" />
                  Clear
                </button>
                
                <button 
                  className="submit-btn"
                  onClick={submitTicket}
                  disabled={loading || !message.trim()}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:send" />
                      Submit Ticket
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Support Status */}
      <div className="support-status">
        <div className="status-header">
          <Icon icon="mdi:heart-pulse" />
          <h3>Support System Status</h3>
        </div>
        <div className="status-items">
          <div className="status-item active">
            <div className="status-indicator"></div>
            <div className="status-text">
              <span className="status-label">Live Chat</span>
              <span className="status-value">Online</span>
            </div>
          </div>
          <div className="status-item active">
            <div className="status-indicator"></div>
            <div className="status-text">
              <span className="status-label">Ticket System</span>
              <span className="status-value">Operating Normally</span>
            </div>
          </div>
          <div className="status-item">
            <div className="status-indicator"></div>
            <div className="status-text">
              <span className="status-label">Response Time</span>
              <span className="status-value">Under 1 Hour</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;