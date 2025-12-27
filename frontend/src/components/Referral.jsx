import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { referralService } from "../services/api";
import "./Referral.css";

const Referral = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareText, setShareText] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchReferralData = async () => {
      try {
        const res = await referralService.getDashboard();
        if (mounted) {
          setData(res.data);
          // Generate share text with user's referral code
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
      } catch {
        if (mounted) setError("Failed to load referral data");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchReferralData();
    return () => (mounted = false);
  }, []);

  const copyLink = () => {
    if (!data?.referral_link) return;
    navigator.clipboard.writeText(data.referral_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCode = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyShareText = () => {
    if (!shareText) return;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
    <div className="">
      <div className="">
        {/* HEADER SECTION */}
        <div className="referral-header">
          <div className="referral-header-content">
            <div className="logo-container" style={{ marginBottom: "15px" }}>
              <div className="logo-symbol" style={{ animation: "float 6s ease-in-out infinite" }}>
                <Icon icon="mdi:account-group" width="30" />
              </div>
              <h1 className="logo-text" style={{ fontSize: "2.2rem" }}>REFERRAL PROGRAM</h1>
            </div>
            <p className="auth-subtitle">
              Invite friends and earn rewards for every successful referral
            </p>
          </div>

          <div className="referral-stats-card">
            <div className="stat-item">
              <div className="stat-icon" style={{ background: "rgba(255, 215, 0, 0.1)" }}>
                <Icon icon="mdi:account-multiple" color="var(--veltora-gold)" width="28" />
              </div>
              <div className="stat-info">
                <div className="stat-value">{data.referrals.length}</div>
                <div className="stat-label">Total Referrals</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon" style={{ background: "rgba(76, 175, 80, 0.1)" }}>
                <Icon icon="mdi:cash-multiple" color="#4CAF50" width="28" />
              </div>
              <div className="stat-info">
                <div className="stat-value">₦{Number(data.total_earnings || 0).toLocaleString()}</div>
                <div className="stat-label">Total Earnings</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon" style={{ background: "rgba(33, 150, 243, 0.1)" }}>
                <Icon icon="mdi:trending-up" color="#2196F3" width="28" />
              </div>
              <div className="stat-info">
                <div className="stat-value">{data.pending_referrals || 0}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="referral-content">
          {/* LEFT COLUMN: SHARE & PROMOTE */}
          <div className="referral-left">
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
                    value={data.referral_link}
                    readOnly
                    className="referral-link-input"
                  />
                </div>
                <button 
                  className="copy-button"
                  onClick={copyLink}
                  style={{ minWidth: "120px" }}
                >
                  <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width="18" />
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>

              {/* REFERRAL CODE ONLY */}
              <div className="referral-code-section">
                <h4 style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "15px" }}>
                  <Icon icon="mdi:tag" style={{ marginRight: "8px" }} />
                  Your Referral Code
                </h4>
                <div className="referral-code-box">
                  <div className="referral-code-display">
                    <span className="code-text">{data.referral_code}</span>
                  </div>
                  <button 
                    className="copy-button secondary"
                    onClick={copyCode}
                  >
                    <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} width="16" />
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
                <button 
                  className="social-share-btn whatsapp"
                  onClick={() => shareToPlatform("whatsapp")}
                >
                  <Icon icon="mdi:whatsapp" width="28" />
                  <span>WhatsApp</span>
                </button>

                <button 
                  className="social-share-btn telegram"
                  onClick={() => shareToPlatform("telegram")}
                >
                  <Icon icon="mdi:telegram" width="28" />
                  <span>Telegram</span>
                </button>

                <button 
                  className="social-share-btn facebook"
                  onClick={() => shareToPlatform("facebook")}
                >
                  <Icon icon="mdi:facebook" width="28" />
                  <span>Facebook</span>
                </button>

                <button 
                  className="social-share-btn twitter"
                  onClick={() => shareToPlatform("twitter")}
                >
                  <Icon icon="mdi:twitter" width="28" />
                  <span>Twitter</span>
                </button>

                <button 
                  className="social-share-btn email"
                  onClick={() => shareToPlatform("email")}
                >
                  <Icon icon="mdi:email" width="28" />
                  <span>Email</span>
                </button>
              </div>

              <div className="copy-share-text-section">
                <h4 style={{ color: "rgba(255, 255, 255, 0.8)", marginBottom: "15px" }}>
                  <Icon icon="mdi:text-box" style={{ marginRight: "8px" }} />
                  Copy Ready-Made Message
                </h4>
                <div className="share-text-preview">
                  <p>{shareText.substring(0, 200)}...</p>
                </div>
                <button 
                  className="copy-button"
                  onClick={copyShareText}
                  style={{ width: "100%", marginTop: "15px" }}
                >
                  <Icon icon="mdi:content-copy" width="16" style={{ marginRight: "8px" }} />
                  Copy Full Message
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: REFERRALS TABLE & PROMOTION */}
          <div className="referral-right">
            {/* PROMOTION CONTENT CARD */}
            <div className="auth-card" style={{ marginBottom: "25px" }}>
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
                    YOUR CODE: <strong>{data.referral_code}</strong>
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
                  Share this link: <strong>{data.referral_link}</strong>
                  <br />
                  Or share this code: <strong className="highlight-code">{data.referral_code}</strong>
                </p>
              </div>
            </div>

            {/* REFERRALS TABLE CARD */}
            <div className="auth-card referrals-table-card">
              <div className="table-header">
                <h3 style={{ color: "var(--veltora-gold)", margin: 0 }}>
                  <Icon icon="mdi:account-group" style={{ marginRight: "10px" }} />
                  Your Referrals
                </h3>
                <span className="table-count">{data.referrals.length} users</span>
              </div>

              {data.referrals.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">
                    <Icon icon="mdi:account-plus-outline" width="48" />
                  </div>
                  <h4 style={{ color: "rgba(255, 255, 255, 0.9)", margin: "15px 0 10px" }}>
                    No Referrals Yet
                  </h4>
                  <p style={{ color: "rgba(255, 255, 255, 0.6)", textAlign: "center", maxWidth: "300px" }}>
                    Share your referral link to start earning rewards!
                  </p>
                  <button 
                    className="copy-button"
                    onClick={copyLink}
                    style={{ marginTop: "20px", padding: "12px 24px" }}
                  >
                    <Icon icon="mdi:share" width="18" style={{ marginRight: "8px" }} />
                    Copy Referral Link
                  </button>
                </div>
              ) : (
                <>
                  <div className="referrals-table">
                    <div className="table-row header">
                      <div className="table-cell">User</div>
                      <div className="table-cell">Total Earned</div>
                      <div className="table-cell">Daily</div>
                      <div className="table-cell">Weekly</div>
                      <div className="table-cell">Monthly</div>
                      <div className="table-cell">Status</div>
                    </div>

                    {data.referrals.map((ref) => (
                      <div key={ref.username} className="table-row">
                        <div className="table-cell user-cell">
                          <div className="user-avatar">
                            <Icon icon="mdi:account-circle" width="24" />
                          </div>
                          <span className="username">{ref.username}</span>
                        </div>
                        <div className="table-cell total-cell">
                          <span className="amount">₦{Number(ref.total).toLocaleString()}</span>
                        </div>
                        <div className="table-cell">
                          ₦{Number(ref.daily).toLocaleString()}
                        </div>
                        <div className="table-cell">
                          ₦{Number(ref.weekly).toLocaleString()}
                        </div>
                        <div className="table-cell">
                          ₦{Number(ref.monthly).toLocaleString()}
                        </div>
                        <div className="table-cell">
                          <span className={`status-badge ${ref.status === 'active' ? 'active' : 'pending'}`}>
                            <Icon icon={ref.status === 'active' ? 'mdi:check-circle' : 'mdi:clock'} width="14" />
                            {ref.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="table-footer">
                    <div className="footer-stat">
                      <span className="stat-label">Total Referrals:</span>
                      <span className="stat-value">{data.referrals.length}</span>
                    </div>
                    <div className="footer-stat">
                      <span className="stat-label">Total Earnings:</span>
                      <span className="stat-value">₦{Number(data.total_earnings || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* COPY SUCCESS TOAST */}
        {copied && (
          <div className="copy-success-toast">
            <Icon icon="mdi:check-circle" width="20" style={{ marginRight: "8px" }} />
            Copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
};

export default Referral;