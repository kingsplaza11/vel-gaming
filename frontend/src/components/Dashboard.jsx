import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(true);
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
    { id: 'slots', name: 'Golden Slots', path: '/slots', img: '/images/games/slot.png', popular: false },
    { id: 'crash', name: 'Crash', path: '/crash', img: '/images/games/crash.png', popular: true },
    { id: 'fishing', name: 'Deep Sea Fishing', path: '/fishing', img: '/images/games/fishing.jpg', popular: false },
    { id: 'treasure', name: 'Treasure Hunt', path: '/treasure', img: '/images/games/treasure.jpg', popular: true },
    { id: 'dragon', name: 'Dragon Arena', path: '/dragon', img: '/images/games/dragon.png', popular: true },
    { id: 'miner', name: 'Crypto Miner', path: '/miner', img: '/images/games/miner.png', popular: false },
    { id: 'space', name: 'Space Explorer', path: '/space', img: '/images/games/space.png', popular: false },
    { id: 'potion', name: 'Potion Brewing', path: '/potion', img: '/images/games/potion.png', popular: false },
    { id: 'pyramid', name: 'Pyramid Adventure', path: '/pyramid', img: '/images/games/pyramid.png', popular: false },
    { id: 'heist', name: 'Cyber Heist', path: '/heist', img: '/images/games/heist.png', popular: false },
    { id: 'minesweeper', name: 'Minesweeper Treasure', path: '/minesweeper', img: '/images/games/minesweeper.png', popular: false },
    { id: 'tower', name: 'Tower Builder', path: '/tower', img: '/images/games/tower.png', popular: false },
    { id: 'cards', name: 'Card Matcher', path: '/cards', img: '/images/games/cards.png', popular: false },
    { id: 'guessing', name: 'Number Guesser', path: '/guessing', img: '/images/games/guessing.png', popular: false },
    { id: 'clicker', name: 'Speed Clicker', path: '/clicker', img: '/images/games/clicker.png', popular: false },
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

  return (
    <>
      <div className={`dashboard ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
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

          <div className="sidebar-balance">
            <div className="sidebar-balance-label">
              <Icon icon="mdi:wallet" className="balance-icon" />
              <span>Balance</span>
            </div>
            <div className="sidebar-balance-amount">
              ₦{parseFloat(user.balance).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
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
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'wallet' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('wallet'); navigate('/wallet'); }}
            >
              <Icon icon="mdi:credit-card-multiple" className="nav-icon" />
              <span className="nav-text">Wallet</span>
            </button>
            
            <button 
              className={`sidebar-nav-item ${activeNavItem === 'transactions' ? 'active' : ''}`}
              onClick={() => { setActiveNavItem('transactions'); navigate('/transactions'); }}
            >
              <Icon icon="mdi:history" className="nav-icon" />
              <span className="nav-text">Transactions</span>
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
            <div className="mobile-logo" onClick={() => navigate('/')}>
              <div className="mobile-logo-symbol">
                <Icon icon="mdi:crown" className="mobile-logo-icon" />
              </div>
              <span className="mobile-logo-text">Veltora</span>
            </div>
            
            <div className="mobile-header-right">
              {/* Balance Display - Top Right Corner on Mobile */}
              <div className="mobile-balance-display" onClick={() => navigate('/wallet')}>
                <div className="mobile-balance-currency">₦</div>
                <div className="mobile-balance-amount">
                  {parseFloat(user.balance).toLocaleString('en-NG', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </div>
              </div>
              
              <button className="mobile-menu-btn" onClick={() => setIsBottomMenuOpen(true)}>
                <Icon icon="mdi:menu" className="mobile-menu-icon" />
              </button>
            </div>
          </div>
        </header>

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
          <button className="footer-btn" onClick={() => { navigate('/'); setActiveNavItem('home'); }}>
            <Icon icon="mdi:home" className="footer-icon" />
            <span className="footer-text">Home</span>
          </button>
          
          <button className="footer-btn" onClick={() => { navigate('/games'); setActiveNavItem('games'); }}>
            <Icon icon="mdi:gamepad-variant" className="footer-icon" />
            <span className="footer-text">Games</span>
          </button>
          
          <button className="footer-btn" onClick={() => { navigate('/profile'); setActiveNavItem('profile'); }}>
            <Icon icon="mdi:account" className="footer-icon" />
            <span className="footer-text">Profile</span>
          </button>
          
          <button className="footer-btn" onClick={() => setIsBottomMenuOpen(true)}>
            <Icon icon="mdi:menu" className="footer-icon" />
            <span className="footer-text">More</span>
          </button>
        </footer>

        {/* Bottom Menu Sidebar - Mobile (Styled like Desktop Sidebar) */}
        <div className={`bottom-menu-sidebar ${isBottomMenuOpen ? 'open' : ''}`}>
          <div className="bottom-menu-header">
            <div className="bottom-menu-title">
              <div className="bottom-menu-logo">
                <div className="bottom-menu-logo-symbol">
                  <Icon icon="mdi:crown" className="bottom-menu-logo-icon" />
                </div>
                <div className="bottom-menu-logo-text">
                  <h3>Veltora</h3>
                  <p className="bottom-menu-logo-subtitle">Premium Gaming</p>
                </div>
              </div>
            </div>
            <button className="close-bottom-menu" onClick={() => setIsBottomMenuOpen(false)}>
              <Icon icon="mdi:close" />
            </button>
          </div>
          
          <div className="bottom-menu-content">
            <div className="bottom-menu-balance-section">
              <div className="bottom-menu-balance-label">
                <Icon icon="mdi:wallet" className="bottom-menu-balance-icon" />
                <span>Your Balance</span>
              </div>
              <div className="bottom-menu-balance-amount">
                ₦{parseFloat(user.balance).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </div>
            </div>

            <div className="bottom-menu-nav">
              <button 
                className="bottom-menu-nav-item" 
                onClick={() => { navigate('/wallet'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:credit-card-plus" className="bottom-menu-nav-icon" />
                <span>Deposit</span>
                <Icon icon="mdi:chevron-right" className="bottom-menu-nav-arrow" />
              </button>
              
              <button 
                className="bottom-menu-nav-item" 
                onClick={() => { navigate('/withdrawal'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:credit-card-minus" className="bottom-menu-nav-icon" />
                <span>Withdraw</span>
                <Icon icon="mdi:chevron-right" className="bottom-menu-nav-arrow" />
              </button>
              
              <button 
                className="bottom-menu-nav-item" 
                onClick={() => { navigate('/transactions'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:history" className="bottom-menu-nav-icon" />
                <span>Transaction History</span>
                <Icon icon="mdi:chevron-right" className="bottom-menu-nav-arrow" />
              </button>
              
              <button 
                className="bottom-menu-nav-item" 
                onClick={() => { navigate('/wallets'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:wallet" className="bottom-menu-nav-icon" />
                <span>Wallets</span>
                <Icon icon="mdi:chevron-right" className="bottom-menu-nav-arrow" />
              </button>
              
              <button 
                className="bottom-menu-nav-item" 
                onClick={() => { navigate('/support'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:help-circle" className="bottom-menu-nav-icon" />
                <span>Support</span>
                <Icon icon="mdi:chevron-right" className="bottom-menu-nav-arrow" />
              </button>
            </div>

            <div className="bottom-menu-theme-section">
              <div className="bottom-menu-theme-label">
                <Icon icon="mdi:theme-light-dark" className="bottom-menu-theme-icon" />
                <span>Theme</span>
              </div>
              <div className="bottom-menu-theme-switch">
                <button 
                  className={`bottom-menu-theme-option ${!isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(false)}
                >
                  <Icon icon="mdi:weather-sunny" className="bottom-menu-theme-option-icon" />
                  <span>Light</span>
                </button>
                <button 
                  className={`bottom-menu-theme-option ${isDarkMode ? 'active' : ''}`}
                  onClick={() => setIsDarkMode(true)}
                >
                  <Icon icon="mdi:weather-night" className="bottom-menu-theme-option-icon" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div className="bottom-menu-legal-section">
              <button 
                className="bottom-menu-legal-item" 
                onClick={() => { navigate('/policy'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:shield-lock" className="bottom-menu-legal-icon" />
                <span>Privacy Policy</span>
              </button>
              
              <button 
                className="bottom-menu-legal-item" 
                onClick={() => { navigate('/terms'); setIsBottomMenuOpen(false); }}
              >
                <Icon icon="mdi:file-document" className="bottom-menu-legal-icon" />
                <span>Terms & Conditions</span>
              </button>
            </div>

            <button 
              className="bottom-menu-logout-btn" 
              onClick={handleLogout}
            >
              <Icon icon="mdi:logout" className="bottom-menu-logout-icon" />
              <span>Logout</span>
            </button>
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