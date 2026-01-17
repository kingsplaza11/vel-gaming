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
              <h5 className="logo-text" style={{ fontSize: "1.2rem" }}>REFERRAL PROGRAM</h5>
            </div>
            <p className="auth-subtitle">
              Invite friends and earn rewards for every successful referral
            </p>
          </div>

          {/* =========================
          REFERRAL STATS (4 GROUPS)
          ========================= */}
          <div className="referral-stats-grid">
            {/* TODAY */}
            <div className="stat-group">
              <h4 className="stat-group-title">Today</h4>
              <div className="stat-row-container">
                <div className="stat-item">
                  <span className="stat-label">Number of Invitations</span>
                  <strong className="stat-value">{data.stats.today.referrals}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Count</span>
                  <strong className="stat-value">{data.stats.today.successful}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.today.first_deposit_amount).toLocaleString()}
                  </strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.today.total_deposit_amount).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* YESTERDAY */}
            <div className="stat-group">
              <h4 className="stat-group-title">Yesterday</h4>
              <div className="stat-row-container">
                <div className="stat-item">
                  <span className="stat-label">Number of Invitations</span>
                  <strong className="stat-value">{data.stats.yesterday.referrals}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Count</span>
                  <strong className="stat-value">{data.stats.yesterday.successful}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.yesterday.first_deposit_amount).toLocaleString()}
                  </strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.yesterday.total_deposit_amount).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* THIS WEEK */}
            <div className="stat-group">
              <h4 className="stat-group-title">This Week</h4>
              <div className="stat-row-container">
                <div className="stat-item">
                  <span className="stat-label">Number of Invitations</span>
                  <strong className="stat-value">{data.stats.this_week.referrals}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Count</span>
                  <strong className="stat-value">{data.stats.this_week.successful}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.this_week.first_deposit_amount).toLocaleString()}
                  </strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.this_week.total_deposit_amount).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>

            {/* ALL TIME */}
            <div className="stat-group total">
              <h4 className="stat-group-title">All Time</h4>
              <div className="stat-row-container">
                <div className="stat-item">
                  <span className="stat-label">Number of Invitations</span>
                  <strong className="stat-value">{data.stats.total.referrals}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Count</span>
                  <strong className="stat-value">{data.stats.total.successful}</strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">First Time Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.total.first_deposit_amount).toLocaleString()}
                  </strong>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Recharge Amount</span>
                  <strong className="stat-value">
                    ₦{Number(data.stats.total.total_deposit_amount).toLocaleString()}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT - INDEPENDENT SECTIONS */}
        <div className="referral-layout">
          

          {/* TWO-COLUMN LAYOUT FOR OTHER SECTIONS */}
          <div className="two-column-layout">
            {/* LEFT COLUMN: SHARE & PROMOTE */}
            <div className="column-left">
              {/* Mobile Stats - Appear in a row under ref cards */}
              <div className="mobile-stats-container" style={{ display: 'none' }}>
                <div className="referral-stats-card mobile-stats">
                  <div className="stat-item">
                    <div className="stat-icon" style={{ background: "rgba(255, 215, 0, 0.1)" }}>
                      <Icon icon="mdi:account-multiple" color="var(--veltora-gold)" width="20" />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{data.total_referrals || 0}</div>
                      <div className="stat-label">Total</div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon" style={{ background: "rgba(76, 175, 80, 0.1)" }}>
                      <Icon icon="mdi:check-circle" color="#4CAF50" width="20" />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{data.successful_referrals || 0}</div>
                      <div className="stat-label">Successful</div>
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-icon" style={{ background: "rgba(255, 152, 0, 0.1)" }}>
                      <Icon icon="mdi:clock" color="#FF9800" width="20" />
                    </div>
                    <div className="stat-info">
                      <div className="stat-value">{data.pending_referrals || 0}</div>
                      <div className="stat-label">Pending</div>
                    </div>
                  </div>
                </div>
              </div>

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

            {/* RIGHT COLUMN: PROMOTION */}
            <div className="column-right">
              {/* PROMOTION CONTENT CARD */}
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