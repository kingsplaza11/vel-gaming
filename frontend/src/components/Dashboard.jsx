import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useWallet } from '../contexts/WalletContext'; // Import wallet context
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading } = useWallet(); // Get wallet data from context
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBottomMenuOpen, setIsBottomMenuOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('home');
  
  // Loading state
  const [loadingGame, setLoadingGame] = useState(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('veltora-theme');
    if (savedTheme === 'light') setIsDarkMode(false);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('veltora-theme', newTheme ? 'dark' : 'light');
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleGameClick = (game) => {
    setLoadingGame({ name: game.name, img: game.img });
    setTimeout(() => {
      navigate(game.path);
    }, 2800);
  };

  const games = [
    // ✅ Fortune games — direct launch
    { id: 'fortune_mouse', name: 'Fortune Mouse', path: '/fortune/mouse', route: '/fortune/mouse', img: '/images/games/fortune-mouse.png', popular: true },
    { id: 'fortune_tiger', name: 'Fortune Tiger', path: '/fortune/tiger', route: '/fortune/tiger', img: '/images/games/fortune-tiger.png', popular: true },
    { id: 'fortune_rabbit', name: 'Fortune Rabbit', path: '/fortune/rabbit', route: '/fortune/rabbit', img: '/images/games/fortune-rabbit.png', popular: true },

    // Existing games (set popular false if you want ONLY 3 popular)
    { id: 'slots', name: 'Golden Slots', path: '/slots', img: '/images/games/slot.png', popular: false },
    { id: 'crash', name: 'Crash', path: '/crash', img: '/images/games/crash.png', popular: false },
    { id: 'fishing', name: 'Deep Sea Fishing', path: '/fishing', img: '/images/games/fishing.jpg', popular: false },
    { id: 'treasure', name: 'Treasure Hunt', path: '/treasure', img: '/images/games/treasure.jpg', popular: false },
    { id: 'potion', name: 'Potion Brewing', path: '/potion', img: '/images/games/potion.png', popular: false },
    { id: 'pyramid', name: 'Pyramid Adventure', path: '/pyramid', img: '/images/games/pyramid.png', popular: false },
    { id: 'heist', name: 'Cyber Heist', path: '/heist', img: '/images/games/heist.png', popular: false },
    { id: 'minesweeper', name: 'Minesweeper Treasure', path: '/minesweeper', img: '/images/games/minesweeper.png', popular: false },
    { id: 'tower', name: 'Tower Builder', path: '/tower', img: '/images/games/tower.png', popular: false },
    { id: 'cards', name: 'Card Matcher', path: '/cards', img: '/images/games/cards.png', popular: false },
    { id: 'guessing', name: 'Number Guesser', path: '/guessing', img: '/images/games/guessing.png', popular: false },
    { id: 'colorswitch', name: 'Color Switch', path: '/colorswitch', img: '/images/games/colorswitch.png', popular: false }
  ];

  const popularGames = games.filter(game => game.popular);
  const otherGames = games.filter(game => !game.popular && game.id !== 'slots');
  const slotGame = games.find(game => game.id === 'slots');

  const GameCard = ({ game, isPopular = false }) => (
    <div className={`game-card ${isPopular ? 'popular' : ''}`} onClick={() => handleGameClick(game)}>
      <div className="game-image-container">
        <img src={game.img} alt={game.name} className="game-image" />
        <div className="play-overlay">
          <span>PLAY NOW</span>
        </div>
        {isPopular && (
          <div className="popular-badge">
            <Icon icon="mdi:fire" className="popular-icon" />
            Popular
          </div>
        )}
      </div>
      <div className="game-name">{game.name}</div>
    </div>
  );

  // Helper function to format balance
  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return '0.00';
    return parseFloat(balance).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Get wallet balance, fallback to user.balance if wallet not loaded yet
  const displayBalance = wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);

  return (
    <>
      <div className={`dashboard ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        {/* Mobile Overlays */}
        {isMobileMenuOpen && <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>}
        {isBottomMenuOpen && <div className="bottom-menu-overlay" onClick={() => setIsBottomMenuOpen(false)}></div>}

        {/* Desktop Sidebar */}
        <aside className="desktop-sidebar">
          <div className="sidebar-logo-container">
            <div className="sidebar-logo-symbol">
              <Icon icon="mdi:crown" className="sidebar-logo-icon" />
            </div>
            <div className="sidebar-logo-text">
              <h1 className="sidebar-logo-title">V</h1>
              <h2 className="sidebar-logo-subtitle">Veltora</h2>
            </div>
          </div>

          <nav className="sidebar-nav">
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'home' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('home'); navigate('/'); }}
            >
              <Icon icon="mdi:home" className="nav-icon" />
              <span className="nav-text">Home</span>
            </button>
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'games' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('games'); navigate('/games'); }}
            >
              <Icon icon="mdi:gamepad-variant" className="nav-icon" />
              <span className="nav-text">All Games</span>
            </button>
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'popular' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('popular'); navigate('/popular'); }}
            >
              <Icon icon="mdi:fire" className="nav-icon" />
              <span className="nav-text">Popular Games</span>
            </button>
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'profile' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('profile'); navigate('/profile'); }}
            >
              <Icon icon="mdi:account" className="nav-icon" />
              <span className="nav-text">Profile</span>
            </button>
            
            {/* WALLET BUTTON */}
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'wallet' ? 'active' : ''}`}
              onClick={() => { 
                setActiveNavItem('wallet'); 
                navigate('/wallet'); 
              }}
              data-nav="wallet"
            >
              <Icon icon="mdi:wallet" className="nav-icon" />
              <span className="nav-text">Wallet</span>
            </button>
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'transactions' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('transactions'); navigate('/transactions'); }}
            >
              <Icon icon="mdi:history" className="nav-icon" />
              <span className="nav-text">Transactions</span>
            </button>

            {/* QUICK DEPOSIT BUTTON */}
            <button 
              className="sidebar-nav-item deposit-btn"
              onClick={() => { 
                navigate('/wallet'); 
              }}
            >
              <Icon icon="mdi:credit-card-plus" className="nav-icon" />
              <span className="nav-text">Quick Deposit</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <div className="theme-toggle-container">
              <span className="theme-label">Theme</span>
              <div className="theme-switch">
                <button 
                  className={`theme-option ${!isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(false)}
                >
                  <Icon icon="mdi:weather-sunny" className="theme-icon" />
                </button>
                <button 
                  className={`theme-option ${isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(true)}
                >
                  <Icon icon="mdi:weather-night" className="theme-icon" />
                </button>
              </div>
            </div>
            <button className="sidebar-logout-btn" onClick={handleLogout}>
              <Icon icon="mdi:logout" className="logout-icon" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* Header - Mobile Only */}
        <header className="mobile-header">
          <div className="mobile-header-content">
            <div className="mobile-header-right">
              {/* Balance Display - Clickable Wallet Link */}
              <div 
                className="mobile-balance-display clickable-balance" 
                onClick={() => {
                  navigate('/wallet');
                }}
                title="Go to Wallet"
              >
                <div className="mobile-balance-currency">₦</div>
                <div className="mobile-balance-amount">
                  {walletLoading ? (
                    <div className="balance-loading">
                      <Icon icon="mdi:loading" className="loading-icon" />
                      Loading...
                    </div>
                  ) : (
                    formatBalance(displayBalance)
                  )}
                </div>
              </div>
              
              <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
                <Icon icon="mdi:menu" className="mobile-menu-icon" />
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Sidebar */}
        <div className={`mobile-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
          <div className="mobile-sidebar-header">
            <div className="mobile-sidebar-logo">
              <div className="mobile-sidebar-logo-symbol">
                <Icon icon="mdi:crown" className="mobile-sidebar-logo-icon" />
              </div>
              <div className="mobile-sidebar-logo-text">
                <h2>Veltora</h2>
                <p>Premium Gaming</p>
              </div>
            </div>
            <button className="close-mobile-sidebar" onClick={() => setIsMobileMenuOpen(false)}>
              <Icon icon="mdi:close" />
            </button>
          </div>
          
          <div className="mobile-sidebar-user">
            <div className="mobile-user-avatar">
              <Icon icon="mdi:account-circle" className="mobile-avatar-icon" />
            </div>
            <div className="mobile-user-details">
              <p className="mobile-username">{user.username}</p>
              <p 
                className="mobile-user-balance clickable-balance"
                onClick={() => {
                  navigate('/wallet');
                  setIsMobileMenuOpen(false);
                }}
                title="Go to Wallet"
              >
                <Icon icon="mdi:currency-ngn" className="mobile-currency-icon" />
                {walletLoading ? (
                  <span className="balance-loading-text">Loading...</span>
                ) : (
                  formatBalance(displayBalance)
                )}
              </p>
            </div>
          </div>
          
          <div className="mobile-sidebar-menu">
            <button onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }} className="mobile-sidebar-btn">
              <Icon icon="mdi:home" className="mobile-sidebar-btn-icon" />
              <span>Home</span>
            </button>
            
            <button onClick={() => { navigate('/profile'); setIsMobileMenuOpen(false); }} className="mobile-sidebar-btn">
              <Icon icon="mdi:account" className="mobile-sidebar-btn-icon" />
              <span>Profile</span>
            </button>
            
            <button onClick={() => { navigate('/games'); setIsMobileMenuOpen(false); }} className="mobile-sidebar-btn">
              <Icon icon="mdi:gamepad-variant" className="mobile-sidebar-btn-icon" />
              <span>All Games</span>
            </button>
            
            {/* WALLET BUTTON - Mobile */}
            <button 
              onClick={() => { 
                navigate('/wallet'); 
                setIsMobileMenuOpen(false); 
              }} 
              className="mobile-sidebar-btn"
              data-nav="wallet"
            >
              <Icon icon="mdi:wallet" className="mobile-sidebar-btn-icon" />
              <span>Wallet</span>
            </button>

            {/* QUICK DEPOSIT BUTTON - Mobile */}
            <button 
              onClick={() => { 
                navigate('/wallet'); 
                setIsMobileMenuOpen(false); 
              }} 
              className="mobile-sidebar-btn deposit-btn-mobile"
            >
              <Icon icon="mdi:credit-card-plus" className="mobile-sidebar-btn-icon" />
              <span>Deposit Funds</span>
            </button>
            
            <div className="mobile-theme-toggle">
              <span className="mobile-theme-label">Theme</span>
              <div className="mobile-theme-switch">
                <button 
                  className={`mobile-theme-option ${!isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(false)}
                >
                  <Icon icon="mdi:weather-sunny" className="mobile-theme-icon" />
                  <span>Light</span>
                </button>
                <button 
                  className={`mobile-theme-option ${isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(true)}
                >
                  <Icon icon="mdi:weather-night" className="mobile-theme-icon" />
                  <span>Dark</span>
                </button>
              </div>
            </div>
            
            <button onClick={handleLogout} className="mobile-sidebar-btn logout">
              <Icon icon="mdi:logout" className="mobile-sidebar-btn-icon" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <main className="dashboard-main">
          {/* Popular Games Section */}
          <section className="popular-games-section">
            <div className="section-header">
              <h2>
                <Icon icon="mdi:fire" className="section-icon" />
                Popular Games
              </h2>
              <p className="section-subtitle">Most played by our community</p>
            </div>
            <div className="popular-games-grid">
              {popularGames.map(game => (
                <GameCard key={game.id} game={game} isPopular={true} />
              ))}
            </div>
          </section>

          {/* All Games Section */}
          <section className="all-games-section">
            <div className="section-header">
              <h2>
                <Icon icon="mdi:gamepad-variant" className="section-icon" />
                All Games
              </h2>
              <p className="section-subtitle">Explore our full game collection</p>
            </div>
            <div className="games-grid">
              {otherGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </section>
        </main>

        {/* Floating Slot Game */}
        <div className="floating-slot-game" onClick={() => handleGameClick(slotGame)}>
          <div className="floating-slot-content">
            <Icon icon="mdi:slot-machine" className="floating-slot-icon" />
            <div className="floating-slot-text">
              <span className="floating-slot-title">Golden Slots</span>
              <span className="floating-slot-subtitle">Try your luck!</span>
            </div>
            <div className="floating-slot-play">
              <Icon icon="mdi:play" className="floating-play-icon" />
            </div>
          </div>
        </div>

        {/* Fixed Footer - Mobile Only */}
        <footer className="fixed-footer">
          <button className="footer-btn" onClick={() => navigate('/')}>
            <Icon icon="mdi:home" className="footer-icon" />
            <span className="footer-text">Home</span>
          </button>
          
          <button className="footer-btn" onClick={() => navigate('/profile')}>
            <Icon icon="mdi:account" className="footer-icon" />
            <span className="footer-text">Profile</span>
          </button>
          
          <button className="footer-btn active" onClick={() => navigate('/games')}>
            <Icon icon="mdi:gamepad-variant" className="footer-icon" />
            <span className="footer-text">Games</span>
          </button>
          
          {/* WALLET BUTTON - Footer */}
          <button 
            className="footer-btn" 
            onClick={() => navigate('/wallet')}
            title="Wallet"
          >
            <Icon icon="mdi:wallet" className="footer-icon" />
            <span className="footer-text">Wallet</span>
          </button>
          
          <button className="footer-btn" onClick={() => setIsBottomMenuOpen(true)}>
            <Icon icon="mdi:menu" className="footer-icon" />
            <span className="footer-text">Menu</span>
          </button>
        </footer>

        {/* Bottom Menu Sidebar - Mobile */}
        <div className={`bottom-menu-sidebar ${isBottomMenuOpen ? 'open' : ''}`}>
          <div className="bottom-menu-header">
            <div className="bottom-menu-title">
              <Icon icon="mdi:menu" className="bottom-menu-header-icon" />
              <h3>Quick Menu</h3>
            </div>
            <button className="close-bottom-menu" onClick={() => setIsBottomMenuOpen(false)}>
              <Icon icon="mdi:close" />
            </button>
          </div>
          
          <div className="bottom-menu-content">
            <div 
              className="bottom-menu-user-info clickable-balance"
              onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}
            >
              <div className="bottom-menu-user-avatar">
                <Icon icon="mdi:account-circle" className="bottom-menu-avatar-icon" />
              </div>
              <div className="bottom-menu-user-details">
                <p className="bottom-menu-username">{user.username}</p>
                <p className="bottom-menu-balance">
                  <Icon icon="mdi:currency-ngn" className="bottom-menu-currency-icon" />
                  {walletLoading ? (
                    <span className="balance-loading-text">Loading...</span>
                  ) : (
                    formatBalance(displayBalance)
                  )}
                </p>
              </div>
              <Icon icon="mdi:chevron-right" className="bottom-menu-balance-arrow" />
            </div>
            
            <div className="bottom-menu-items">
              <button className="bottom-menu-item" onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}>
                <div className="bottom-menu-item-icon deposit">
                  <Icon icon="mdi:credit-card-plus" />
                </div>
                <div className="bottom-menu-item-content">
                  <span className="bottom-menu-item-title">Deposit Funds</span>
                  <span className="bottom-menu-item-subtitle">Add money to your wallet</span>
                </div>
                <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
              </button>
              
              <button className="bottom-menu-item" onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}>
                <div className="bottom-menu-item-icon withdrawal">
                  <Icon icon="mdi:credit-card-minus" />
                </div>
                <div className="bottom-menu-item-content">
                  <span className="bottom-menu-item-title">Withdraw</span>
                  <span className="bottom-menu-item-subtitle">Withdraw your winnings</span>
                </div>
                <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
              </button>
              
              <button className="bottom-menu-item" onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}>
                <div className="bottom-menu-item-icon wallet">
                  <Icon icon="mdi:wallet" />
                </div>
                <div className="bottom-menu-item-content">
                  <span className="bottom-menu-item-title">Wallet Management</span>
                  <span className="bottom-menu-item-subtitle">View balance & transactions</span>
                </div>
                <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
              </button>
              
              <button className="bottom-menu-item" onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}>
                <div className="bottom-menu-item-icon history">
                  <Icon icon="mdi:history" />
                </div>
                <div className="bottom-menu-item-content">
                  <span className="bottom-menu-item-title">Transaction History</span>
                  <span className="bottom-menu-item-subtitle">View all deposits & withdrawals</span>
                </div>
                <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
              </button>
              
              <button className="bottom-menu-item" onClick={() => { navigate('/support'); setIsBottomMenuOpen(false); }}>
                <div className="bottom-menu-item-icon support">
                  <Icon icon="mdi:help-circle" />
                </div>
                <div className="bottom-menu-item-content">
                  <span className="bottom-menu-item-title">Support</span>
                  <span className="bottom-menu-item-subtitle">Get help & support</span>
                </div>
                <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
              </button>
              
              <div className="bottom-menu-section">
                <h4 className="bottom-menu-section-title">Legal</h4>
                <button className="bottom-menu-item legal" onClick={() => { navigate('/policy'); setIsBottomMenuOpen(false); }}>
                  <div className="bottom-menu-item-icon">
                    <Icon icon="mdi:shield-lock" />
                  </div>
                  <span className="bottom-menu-item-text">Privacy Policy</span>
                  <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
                </button>
                
                <button className="bottom-menu-item legal" onClick={() => { navigate('/terms'); setIsBottomMenuOpen(false); }}>
                  <div className="bottom-menu-item-icon">
                    <Icon icon="mdi:file-document" />
                  </div>
                  <span className="bottom-menu-item-text">Terms & Conditions</span>
                  <Icon icon="mdi:chevron-right" className="bottom-menu-item-arrow" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Animation Overlay */}
      {loadingGame && (
        <div className="game-loading-overlay">
          <div className="loading-content">
            <img 
              src={loadingGame.img} 
              alt={loadingGame.name} 
              className="loading-game-image"
            />
            <div className="typing-container">
              <h1 className="typing-text">
                <Icon icon="mdi:gamepad-variant" className="loading-game-icon" />
                {loadingGame.name}
              </h1>
              <span className="cursor">|</span>
            </div>
            <div className="loading-bar">
              <div className="progress"></div>
            </div>
            <div className="loading-hint">
              <Icon icon="mdi:loading" className="loading-spinner" />
              <span>Loading your gaming experience...</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;