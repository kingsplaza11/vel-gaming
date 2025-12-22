// src/layouts/BaseLayout.jsx
import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Icon } from "@iconify/react";
import { useWallet } from "../contexts/WalletContext";
import "./BaseLayout.css";

const BaseLayout = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wallet, loading: walletLoading } = useWallet();

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
    else if (path.includes("games")) setActiveNavItem("games");
    else if (path.includes("wallet")) setActiveNavItem("wallet");
    else if (path.includes("profile")) setActiveNavItem("profile");
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
                <div className="profile-balance">
                  <Icon icon="mdi:currency-ngn" className="balance-icon" />
                  <span className="balance-amount">{formatBalance(displayBalance)}</span>
                </div>
              </div>
            </div>

            <nav className="sidebar-nav">
              {[
                { id: "home", label: "Home", icon: "mdi:home", path: "/" },
                { id: "games", label: "Games", icon: "mdi:gamepad-variant", path: "/games" },
                { id: "wallet", label: "Wallet", icon: "mdi:wallet", path: "/wallet" },
                { id: "profile", label: "Profile", icon: "mdi:account", path: "/profile" },
                { id: "transactions", label: "Transactions", icon: "mdi:history", path: "/transactions" },
                { id: "support", label: "Support", icon: "mdi:headset", path: "/support" },
                { id: "tournaments", label: "Tournaments", icon: "mdi:trophy", path: "/tournaments" },
                { id: "leaderboard", label: "Leaderboard", icon: "mdi:podium", path: "/leaderboard" },
                { id: "friends", label: "Friends", icon: "mdi:account-group", path: "/friends" },
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
            <span className="balance-text">{formatBalance(displayBalance)}</span>
          </button>
        </header>

        {/* MOBILE SIDEBAR */}
        <div className={`mobile-sidebar ${isMobileMenuOpen ? "open" : ""}`}>
          <div className="mobile-sidebar-header">
            <div className="mobile-user-profile">
              <div className="mobile-avatar">
                <Icon icon="mdi:account-circle" />
              </div>
              <div className="mobile-user-info">
                <h3>{user?.username || "Guest"}</h3>
                <button 
                  className="mobile-user-balance-btn"
                  onClick={() => {
                    navigate("/wallet");
                    setIsMobileMenuOpen(false);
                  }}
                >
                  <Icon icon="mdi:currency-ngn" />
                  {formatBalance(displayBalance)}
                </button>
              </div>
            </div>
            <button
              className="close-mobile-sidebar"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <Icon icon="mdi:close" />
            </button>
          </div>

          <nav className="mobile-nav">
            {[
              { label: "Home", path: "/", icon: "mdi:home" },
              { label: "Games", path: "/games", icon: "mdi:gamepad-variant" },
              { label: "Wallet", path: "/wallet", icon: "mdi:wallet" },
              { label: "Profile", path: "/profile", icon: "mdi:account" },
              { label: "Transactions", path: "/transactions", icon: "mdi:history" },
              { label: "Support", path: "/support", icon: "mdi:headset" },
              { label: "Tournaments", path: "/tournaments", icon: "mdi:trophy" },
              { label: "Leaderboard", path: "/leaderboard", icon: "mdi:podium" },
              { label: "Friends", path: "/friends", icon: "mdi:account-group" },
              { label: "Settings", path: "/settings", icon: "mdi:cog" },
            ].map((item) => (
              <button
                key={item.label}
                className={`mobile-nav-item ${activeNavItem === item.label.toLowerCase() ? "active" : ""}`}
                onClick={() => {
                  setActiveNavItem(item.label.toLowerCase());
                  navigate(item.path);
                  setIsMobileMenuOpen(false);
                }}
              >
                <Icon icon={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mobile-sidebar-footer">
            <div className="mobile-theme-switch">
              <button
                className={!isDarkMode ? "active" : ""}
                onClick={() => toggleTheme(false)}
              >
                <Icon icon="mdi:weather-sunny" />
              </button>
              <button
                className={isDarkMode ? "active" : ""}
                onClick={() => toggleTheme(true)}
              >
                <Icon icon="mdi:weather-night" />
              </button>
            </div>
            <button className="mobile-logout-btn" onClick={handleLogout}>
              <Icon icon="mdi:logout" />
              Logout
            </button>
          </div>
        </div>

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

        {/* BOTTOM MENU MODAL */}
        <div className={`bottom-menu-modal ${isBottomMenuOpen ? "open" : ""}`}>
          <div className="modal-backdrop" onClick={() => setIsBottomMenuOpen(false)}></div>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Menu</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsBottomMenuOpen(false)}
              >
                <Icon icon="mdi:close" />
              </button>
            </div>
            <div className="modal-actions">
              <button
                className="modal-action-btn"
                onClick={() => {
                  navigate("/transactions");
                  setIsBottomMenuOpen(false);
                }}
              >
                <Icon icon="mdi:history" />
                <span>Transactions</span>
              </button>
              <button
                className="modal-action-btn"
                onClick={() => {
                  navigate("/support");
                  setIsBottomMenuOpen(false);
                }}
              >
                <Icon icon="mdi:headset" />
                <span>Support</span>
              </button>
              <button
                className="modal-action-btn"
                onClick={() => {
                  navigate("/tournaments");
                  setIsBottomMenuOpen(false);
                }}
              >
                <Icon icon="mdi:trophy" />
                <span>Tournaments</span>
              </button>
              <button
                className="modal-action-btn logout-action"
                onClick={handleLogout}
              >
                <Icon icon="mdi:logout" />
                <span>Logout</span>
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