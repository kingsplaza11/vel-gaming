import React, { useEffect, useState, useRef } from "react";
import { Icon } from "@iconify/react";
import { referralService } from "../services/api";
import "./Referral.css";

const Referral = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Refs for direct DOM manipulation
  const linkButtonRef = useRef(null);
  const codeButtonRef = useRef(null);
  const messageButtonRef = useRef(null);
  
  const [shareText, setShareText] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchReferralData = async () => {
      try {
        const res = await referralService.getDashboard();
        if (mounted && res?.data) {
          setData(res.data);
          setShareText(
            `🎮 JOIN VELTORA & EARN AS YOU PLAY!\n\n` +
            `Play exciting games and earn real money! Use my referral code: ${res.data.referral_code}\n\n` +
            `✨ What you get:\n` +
            `• Earn per friend referral\n` +
            `• Daily cash rewards\n` +
            `• Weekly tournaments with big prizes\n` +
            `• Instant withdrawals\n\n` +
            `Don't miss out! Register here: ${res.data.referral_link}\n\n` +
            `#EarnWhileYouPlay #GamingEarnings #VeltoraGaming`
          );
        }
      } catch (err) {
        console.error("Error fetching referral data:", err);
        if (mounted) setError("Failed to load referral data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReferralData();
    return () => (mounted = false);
  }, []);

  // Force copy function using multiple methods
  const forceCopy = (text, type) => {
    if (!text) {
      alert(`No ${type} available to copy`);
      return;
    }

    console.log(`Attempting to copy ${type}:`, text);

    // Create a temporary input element
    const tempInput = document.createElement('input');
    tempInput.value = text;
    tempInput.style.position = 'fixed';
    tempInput.style.top = '0';
    tempInput.style.left = '0';
    tempInput.style.width = '100px';
    tempInput.style.height = '30px';
    tempInput.style.opacity = '1';
    tempInput.style.zIndex = '999999';
    tempInput.style.backgroundColor = 'white';
    tempInput.style.color = 'black';
    tempInput.style.fontSize = '14px';
    tempInput.style.padding = '5px';
    tempInput.readOnly = true;
    
    document.body.appendChild(tempInput);
    
    // Select the text
    tempInput.select();
    tempInput.setSelectionRange(0, 99999);
    
    let copied = false;
    
    // Try execCommand first (most reliable)
    try {
      copied = document.execCommand('copy');
      console.log('execCommand result:', copied);
    } catch (err) {
      console.log('execCommand error:', err);
    }
    
    // If execCommand failed, try clipboard API
    if (!copied && navigator.clipboard) {
      try {
        navigator.clipboard.writeText(text).then(() => {
          copied = true;
          console.log('Clipboard API success');
        }).catch(err => {
          console.log('Clipboard API error:', err);
        });
      } catch (err) {
        console.log('Clipboard API exception:', err);
      }
    }
    
    // Clean up
    document.body.removeChild(tempInput);
    
    // Show result
    if (copied) {
      alert(`${type} copied successfully!`);
    } else {
      // Last resort - show prompt
      const userCopy = prompt(`Please copy this ${type} manually:`, text);
      if (userCopy !== null) {
        alert(`You can now paste the ${type} wherever you need it.`);
      }
    }
  };

  // Direct button click handlers
  const setupDirectClickHandlers = () => {
    // Link button
    if (linkButtonRef.current) {
      linkButtonRef.current.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        forceCopy(data?.referral_link, 'referral link');
        return false;
      };
    }
    
    // Code button
    if (codeButtonRef.current) {
      codeButtonRef.current.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        forceCopy(data?.referral_code, 'referral code');
        return false;
      };
    }
    
    // Message button
    if (messageButtonRef.current) {
      messageButtonRef.current.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        forceCopy(shareText, 'share message');
        return false;
      };
    }
  };

  // Set up handlers after data loads
  useEffect(() => {
    if (data && !loading) {
      // Small delay to ensure DOM is ready
      setTimeout(setupDirectClickHandlers, 100);
    }
  }, [data, loading, shareText]);

  const shareToPlatform = (platform) => {
    if (!data?.referral_link) return;

    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(data.referral_link);

    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodedText}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}`,
      email: `mailto:?subject=Join Veltora and Earn!&body=${encodedText}`
    };

    window.open(shareUrls[platform], "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-loading" style={{ padding: "60px 0" }}>
            Loading referral dashboard...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="error-message">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="referral-page">
      <div className="referral-container">
        {/* HEADER SECTION */}
        <div className="referral-header">
          <div className="referral-header-content">
            <div className="logo-container" style={{ marginBottom: "15px" }}>
              <div className="logo-symbol">
                <Icon icon="mdi:account-group" width="30" />
              </div>
              <h5 className="logo-text" style={{ fontSize: "1.2rem" }}>REFERRAL PROGRAM</h5>
            </div>
            <p className="auth-subtitle">
              Invite friends and earn rewards for every successful referral
            </p>
          </div>

          {/* REFERRAL STATS */}
          <div className="referral-stats-grid">
            {['today', 'yesterday', 'this_week', 'total'].map((period) => (
              <div key={period} className={`stat-group ${period === 'total' ? 'total' : ''}`}>
                <h4 className="stat-group-title">
                  {period === 'today' ? 'Today' : 
                   period === 'yesterday' ? 'Yesterday' : 
                   period === 'this_week' ? 'This Week' : 'All Time'}
                </h4>
                <div className="stat-row-container">
                  <div className="grid-stat-item">
                    <span className="grid-stat-label">Number of Invitations</span>
                    <strong className="grid-stat-value">
                      {data?.stats?.[period]?.referrals || 0}
                    </strong>
                  </div>
                  <div className="grid-stat-item">
                    <span className="grid-stat-label">First Time Recharge Count</span>
                    <strong className="grid-stat-value">
                      {data?.stats?.[period]?.successful || 0}
                    </strong>
                  </div>
                  <div className="grid-stat-item">
                    <span className="grid-stat-label">First Time Recharge Amount</span>
                    <strong className="grid-stat-value">
                      ₦{Number(data?.stats?.[period]?.first_deposit_amount || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className="grid-stat-item">
                    <span className="grid-stat-label">Total Recharge Amount</span>
                    <strong className="grid-stat-value">
                      ₦{Number(data?.stats?.[period]?.total_deposit_amount || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="referral-layout">
          <div className="two-column-layout">
            {/* LEFT COLUMN */}
            <div className="column-left">
              {/* YOUR REFERRAL LINK CARD */}
              <div className="auth-card" style={{ marginBottom: "25px" }}>
                <div className="referral-link-header">
                  <h3 style={{ color: "var(--veltora-gold)", marginBottom: "5px" }}>
                    <Icon icon="mdi:link" style={{ marginRight: "10px" }} />
                    Your Referral Link
                  </h3>
                  <p className="auth-subtitle" style={{ marginBottom: "20px" }}>
                    Share this link with friends to start earning
                  </p>
                </div>

                <div className="referral-link-box">
                  <div className="input-container">
                    <span className="input-icon">🔗</span>
                    <input
                      type="text"
                      value={data?.referral_link || ''}
                      readOnly
                      className="referral-link-input"
                      id="referral-link-input"
                    />
                  </div>
                  <button 
                    ref={linkButtonRef}
                    className="copy-button"
                    id="copy-link-button"
                    type="button"
                  >
                    <Icon icon="mdi:content-copy" width="18" />
                    Copy Link
                  </button>
                </div>

                {/* REFERRAL CODE */}
                <div className="referral-code-section">
                  <h4 style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "15px" }}>
                    <Icon icon="mdi:tag" style={{ marginRight: "8px" }} />
                    Your Referral Code
                  </h4>
                  <div className="referral-code-box">
                    <div className="referral-code-display">
                      <span className="code-text" id="referral-code-text">{data?.referral_code || ''}</span>
                    </div>
                    <button 
                      ref={codeButtonRef}
                      className="copy-button secondary"
                      id="copy-code-button"
                      type="button"
                    >
                      <Icon icon="mdi:content-copy" width="16" />
                      Copy Code
                    </button>
                  </div>
                </div>
              </div>

              {/* SOCIAL SHARING CARD */}
              <div className="auth-card">
                <h3 style={{ color: "var(--veltora-gold)", marginBottom: "5px" }}>
                  <Icon icon="mdi:share-variant" style={{ marginRight: "10px" }} />
                  Share Via Social Media
                </h3>
                <p className="auth-subtitle" style={{ marginBottom: "25px" }}>
                  Share your referral link on these platforms
                </p>

                <div className="social-share-grid">
                  {['whatsapp', 'telegram', 'facebook', 'twitter', 'email'].map((platform) => (
                    <button 
                      key={platform}
                      className={`social-share-btn ${platform}`}
                      onClick={() => shareToPlatform(platform)}
                      type="button"
                    >
                      <Icon icon={`mdi:${platform}`} width="28" />
                      <span>{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                    </button>
                  ))}
                </div>

                <div className="copy-share-text-section">
                  <h4 style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "15px" }}>
                    <Icon icon="mdi:text-box" style={{ marginRight: "8px" }} />
                    Copy Ready-Made Message
                  </h4>
                  <div className="share-text-preview">
                    <p>{shareText ? shareText.substring(0, 200) + '...' : ''}</p>
                  </div>
                  <button 
                    ref={messageButtonRef}
                    className="copy-button"
                    id="copy-message-button"
                    style={{ width: "100%", marginTop: "15px" }}
                    type="button"
                  >
                    <Icon icon="mdi:content-copy" width="16" style={{ marginRight: "8px" }} />
                    Copy Full Message
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="column-right">
              <div className="auth-card promotion-card">
                <h3 style={{ color: "var(--veltora-gold)", marginBottom: "20px" }}>
                  <Icon icon="mdi:bullhorn" style={{ marginRight: "10px" }} />
                  Why Friends Should Join
                </h3>
                
                <div className="promotion-content">
                  <div className="promo-card">
                    <div className="promo-icon">
                      <Icon icon="mdi:gamepad" width="32" />
                    </div>
                    <div className="promo-text">
                      <h4>Play Exciting Games</h4>
                      <p>Access a wide variety of fun and engaging games that actually pay you to play!</p>
                    </div>
                  </div>

                  <div className="promo-card">
                    <div className="promo-icon">
                      <Icon icon="mdi:gift" width="32" />
                    </div>
                    <div className="promo-text">
                      <h4>Earn Per Referral</h4>
                      <p>You earn for every friend who signs up and becomes active!</p>
                    </div>
                    <div className="promo-highlight">
                      YOUR CODE: <strong>{data?.referral_code || ''}</strong>
                    </div>
                  </div>

                  <div className="promo-card">
                    <div className="promo-icon">
                      <Icon icon="mdi:bank-transfer" width="32" />
                    </div>
                    <div className="promo-text">
                      <h4>Instant Withdrawals</h4>
                      <p>Withdraw your earnings instantly to your bank account or mobile wallet!</p>
                    </div>
                  </div>
                </div>

                <div className="call-to-action">
                  <h4 style={{ color: "var(--veltora-gold-light)", marginBottom: "10px" }}>
                    🎮 Ready to Start Earning?
                  </h4>
                  <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.95rem" }}>
                    Share this link: <strong>{data?.referral_link || ''}</strong>
                    <br />
                    Or share this code: <strong className="highlight-code">{data?.referral_code || ''}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Referral;