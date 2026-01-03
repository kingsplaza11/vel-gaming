// src/layouts/BaseLayout.jsx
import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet"; // Add this import
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useWallet } from "../contexts/WalletContext";
import toast from "react-hot-toast"; // Add this import
import "./BaseLayout.css";

const BaseLayout = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, loading, availableBalance, refreshWallet } = useWallet();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBottomMenuOpen, setIsBottomMenuOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState("home");
  const [loadingGame, setLoadingGame] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("veltora-theme");
    if (savedTheme === "light") setIsDarkMode(false);
    
    // Set active nav based on current path
    const path = location.pathname;
    if (path === "/") setActiveNavItem("home");
    else if (path.includes("wallet")) setActiveNavItem("wallet");
    else if (path.includes("transactions")) setActiveNavItem("transactions");
    else if (path.includes("referrals")) setActiveNavItem("referrals");
    else if (path.includes("profile")) setActiveNavItem("profile");
    else if (path.includes("settings")) setActiveNavItem("settings");
  }, [location]);

  const toggleTheme = (mode) => {
    setIsDarkMode(mode);
    localStorage.setItem("veltora-theme", mode ? "dark" : "light");
  };

  const handleLogout = async () => {
    await onLogout();
    navigate("/login");
  };

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return "0.00";
    return parseFloat(balance).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const displayBalance =
    wallet?.balance !== undefined ? wallet.balance : user?.balance || 0;

  return (
    <>
      {/* Add Helmet for SmartSupp script */}
      <Helmet>
        <script type="text/javascript">
          {`
            var _smartsupp = _smartsupp || {};
            _smartsupp.key = '6f5d1e1374f08c82f14ccf88f162e085d45e0bf1';
            _smartsupp.offsetY = 100; // move along the X axis by 100 pixels
            window.smartsupp||(function(d) {
              var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
              s=d.getElementsByTagName('script')[0];c=d.createElement('script');
              c.type='text/javascript';c.charset='utf-8';c.async=true;
              c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
            })(document);
          `}
        </script>
        <noscript>
          {` Powered by <a href="https://www.smartsupp.com" target="_blank">Smartsupp</a>`}
        </noscript>
      </Helmet>
      <div className={`dashboard ${isDarkMode ? "dark-mode" : "light-mode"}`}>
        {/* ANIMATED BACKGROUND ELEMENTS */}
        <div className="animated-bg">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
          <div className="bg-orb orb-3"></div>
          <div className="bg-grid"></div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <aside className="desktop-sidebar">
          <div className="sidebar-decoration">
            <div className="deco-line deco-top"></div>
            <div className="deco-line deco-middle"></div>
            <div className="deco-line deco-bottom"></div>
          </div>
          
          <div className="sidebar-content">
            <div className="sidebar-logo-container">
              <div className="logo-glow"></div>
              <div className="logo-icon-wrapper">
                <Icon icon="mdi:crown" className="sidebar-logo-icon" />
              </div>
              <h2 className="logo-text">
                <span className="logo-gradient">VELTORA</span>
              </h2>
              <div className="logo-subtitle">Premium Gaming</div>
            </div>

            <div className="user-profile-card">
              <div className="profile-avatar">
                <Icon icon="mdi:account-circle" className="avatar-icon" />
                <div className="status-indicator"></div>
              </div>
              <div className="profile-info">
                <h3 className="profile-username">{user?.username || "Guest"}</h3>
                <div className="profile-email" title={user?.email}>
                  {user?.email ? (
                    user.email.length > 20 ? `${user.email.substring(0, 20)}...` : user.email
                  ) : (
                    "No email"
                  )}
                </div>
                <div className="profile-balance">
                  <Icon icon="mdi:currency-ngn" className="balance-icon" />
                  <span className="balance-amount">{loading ? "Loading..." : formatBalance(availableBalance)}</span>
                </div>
              </div>
            </div>

            <nav className="sidebar-nav">
              {[
                { id: "home", label: "Home", icon: "mdi:home", path: "/" },
                { id: "wallet", label: "Wallet", icon: "mdi:wallet", path: "/wallet" },
                { id: "profile", label: "Profile", icon: "mdi:account", path: "/profile" },
                { id: "transactions", label: "Transactions", icon: "mdi:history", path: "/transactions" },

                // 🔥 NEW
                { id: "referrals", label: "Referrals", icon: "mdi:account-multiple", path: "/referrals" },
                { id: "support", label: "Support", icon: "mdi:headset", path: "/support" },
                { id: "settings", label: "Settings", icon: "mdi:cog", path: "/settings" },
              ].map((item) => (
                <button
                  key={item.id}
                  className={`sidebar-nav-item ${
                    activeNavItem === item.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveNavItem(item.id);
                    navigate(item.path);
                  }}
                >
                  <div className="nav-item-glow"></div>
                  <div className="nav-icon-wrapper">
                    <Icon icon={item.icon} className="nav-icon" />
                  </div>
                  <span className="nav-label">{item.label}</span>
                  <div className="nav-indicator"></div>
                </button>
              ))}
            </nav>

            <div className="sidebar-footer">
              <div className="theme-switch-container">
                <div className="theme-switch">
                  <button
                    className={`theme-option ${!isDarkMode ? "active" : ""}`}
                    onClick={() => toggleTheme(false)}
                    aria-label="Light mode"
                  >
                    <Icon icon="mdi:weather-sunny" />
                    <div className="theme-glow"></div>
                  </button>
                  <button
                    className={`theme-option ${isDarkMode ? "active" : ""}`}
                    onClick={() => toggleTheme(true)}
                    aria-label="Dark mode"
                  >
                    <Icon icon="mdi:weather-night" />
                    <div className="theme-glow"></div>
                  </button>
                </div>
                <div className="theme-label">Theme</div>
              </div>

              <button className="logout-btn" onClick={handleLogout}>
                <div className="logout-glow"></div>
                <Icon icon="mdi:logout" className="logout-icon" />
                <span className="logout-text">Logout</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE HEADER */}
        <header className="mobile-header">
          <div className="mobile-logo">
            <Icon icon="mdi:crown" className="mobile-logo-icon" />
            <span className="mobile-logo-text">Veltora</span>
          </div>
          
          <button 
            className="mobile-balance-btn"
            onClick={() => navigate("/wallet")}
          >
            <div className="balance-glow"></div>
            <Icon icon="mdi:currency-ngn" className="balance-icon" />
            <span className="balance-text">{formatBalance(availableBalance)}</span>
          </button>
        </header>


        {/* MAIN CONTENT */}
        <main className="dashboard-main">
          <div className="content-wrapper">
            <Outlet />
          </div>
        </main>

        {/* FIXED FOOTER (MOBILE) */}
        <footer className="fixed-footer">
            <div className="footer-nav">
                <button
                    className={`footer-nav-item ${activeNavItem === "home" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("home");
                        navigate("/");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:home" />
                    </div>
                    <span className="footer-label">Home</span>
                </button>
                
                <button
                    className={`footer-nav-item ${activeNavItem === "wallet" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("wallet");
                        navigate("/wallet");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:wallet" />
                    </div>
                    <span className="footer-label">Wallet</span>
                </button>
                
                <button
                    className={`footer-nav-item ${activeNavItem === "profile" ? "active" : ""}`}
                    onClick={() => {
                        setActiveNavItem("profile");
                        navigate("/profile");
                    }}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:account" />
                    </div>
                    <span className="footer-label">Profile</span>
                </button>
                
                <button
                    className={`footer-nav-item ${isBottomMenuOpen ? "active" : ""}`}
                    onClick={() => setIsBottomMenuOpen(true)}
                >
                    <div className="footer-icon-wrapper">
                        <Icon icon="mdi:menu" />
                    </div>
                    <span className="footer-label">Menu</span>
                </button>
            </div>
        </footer>

        {/* BOTTOM MENU MODAL - PREMIUM DESIGN */}
        <div className={`bottom-menu-modal ${isBottomMenuOpen ? "open" : ""}`}>
          <div className="modal-backdrop" onClick={() => setIsBottomMenuOpen(false)}></div>
          <div className="modal-content">
            {/* Modal Header with User Info */}
            <div className="modal-header">
              <div className="modal-user-info">
                <div className="modal-avatar">
                  <Icon icon="mdi:account-circle" />
                  <div className="modal-status"></div>
                </div>
                <div className="modal-user-details">
                  <h4 className="modal-username">{user?.username || "Guest"}</h4>
                  <p className="modal-user-email" title={user?.email}>
                    {user?.email ? (user.email.length > 25 ? `${user.email.substring(0, 25)}...` : user.email) : "No email"}
                  </p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setIsBottomMenuOpen(false)}
                aria-label="Close menu"
              >
                <Icon icon="mdi:close" />
              </button>
            </div>

            {/* Modal Body with Actions */}
            <div className="modal-body">
              <div className="modal-section">
                <h5 className="section-title">Navigation</h5>
                <div className="modal-actions">
                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/transactions");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:history" />
                    </div>
                    <span className="action-text">Transactions</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>

                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/referrals");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:account-multiple" />
                    </div>
                    <span className="action-text">Referrals</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>
                </div>
              </div>

              <div className="modal-section">
                <h5 className="section-title">Account</h5>
                <div className="modal-actions">
                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/settings");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:cog" />
                    </div>
                    <span className="action-text">Settings</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>

                  <button
                    className="modal-action-btn"
                    onClick={() => {
                      navigate("/support");
                      setIsBottomMenuOpen(false);
                    }}
                  >
                    <div className="action-icon-wrapper">
                      <Icon icon="mdi:headset" />
                    </div>
                    <span className="action-text">Support</span>
                    <Icon icon="mdi:chevron-right" className="action-arrow" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button
                className="modal-logout-btn"
                onClick={handleLogout}
              >
                <Icon icon="mdi:logout" className="logout-icon" />
                <span className="logout-text">Logout</span>
                <div className="logout-glow"></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GAME LOADING OVERLAY */}
      {loadingGame && (
        <div className="game-loading-overlay">
          <div className="loading-content">
            <div className="loading-icon-wrapper">
              <Icon icon="mdi:crown" className="loading-icon" />
              <div className="loading-glow"></div>
            </div>
            <h1 className="loading-title">{loadingGame.name}</h1>
            <p className="loading-subtitle">Loading premium experience...</p>
            <div className="loading-progress">
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
              <div className="progress-text">0%</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BaseLayout;