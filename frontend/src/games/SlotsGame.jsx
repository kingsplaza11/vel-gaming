import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { slotsService } from "../services/api";
import "./SlotsGame.css";

/* ===============================
   GAME CONSTANTS
================================ */
const MIN_STAKE = 100;

const SYMBOLS = {
  classic: ["seven", "bar", "bell", "cherry", "orange", "lemon"],
  fruit: ["watermelon", "grapes", "orange", "cherry", "lemon", "plum"],
  diamond: ["diamond", "ruby", "emerald", "sapphire", "gold", "silver"],
  ancient: ["scarab", "pyramid", "sphinx", "ankh", "eye", "pharaoh"],
};

const THEME_INFO = {
  classic: { name: "Classic", color: "#FFD700", icon: "🎰" },
  fruit: { name: "Fruit", color: "#FF6B6B", icon: "🍒" },
  diamond: { name: "Diamond", color: "#00FFFF", icon: "💎" },
  ancient: { name: "Ancient", color: "#CD7F32", icon: "🏺" },
};

const THEME_OPTIONS = Object.entries(THEME_INFO).map(([key, value]) => ({
  value: key,
  label: value.name,
  icon: value.icon,
  color: value.color
}));

const IMAGE_PATHS = {
  classic: {
    seven: "/images/slots/classic/seven.png",
    bar: "/images/slots/classic/bar.png",
    bell: "/images/slots/classic/bell.png",
    cherry: "/images/slots/classic/cherry.png",
    orange: "/images/slots/classic/orange.png",
    lemon: "/images/slots/classic/lemon.png"
  },
  fruit: {
    watermelon: "/images/slots/fruit/watermelon.png",
    grapes: "/images/slots/fruit/grapes.png",
    orange: "/images/slots/fruit/orange.png",
    cherry: "/images/slots/fruit/cherry.png",
    lemon: "/images/slots/fruit/lemon.png",
    plum: "/images/slots/fruit/plum.png"
  },
  diamond: {
    diamond: "/images/slots/diamond/diamond.png",
    ruby: "/images/slots/diamond/ruby.png",
    emerald: "/images/slots/diamond/emerald.png",
    sapphire: "/images/slots/diamond/sapphire.png",
    gold: "/images/slots/diamond/gold.png",
    silver: "/images/slots/diamond/silver.png"
  },
  ancient: {
    scarab: "/images/slots/ancient/scarab.png",
    pyramid: "/images/slots/ancient/pyramid.png",
    sphinx: "/images/slots/ancient/sphinx.png",
    ankh: "/images/slots/ancient/ankh.png",
    eye: "/images/slots/ancient/eye.png",
    pharaoh: "/images/slots/ancient/pharaoh.png"
  }
};

const SYMBOL_EMOJIS = {
  seven: "7️⃣",
  bar: "🥇",
  bell: "🔔",
  cherry: "🍒",
  orange: "🍊",
  lemon: "🍋",
  watermelon: "🍉",
  grapes: "🍇",
  plum: "🫐",
  diamond: "💎",
  ruby: "🔴",
  emerald: "🟢",
  sapphire: "🔵",
  gold: "🟡",
  silver: "⚪",
  scarab: "🐞",
  pyramid: "🔺",
  sphinx: "🦁",
  ankh: "☥",
  eye: "👁️",
  pharaoh: "👑"
};

/* ===============================
   FORMATTING UTILS
================================ */
const formatNGN = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  })}`;

/* ===============================
   SYMBOL DISPLAY COMPONENT
================================ */
const SymbolDisplay = React.memo(({ symbol, theme, isSpinning, themeColor }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset states when symbol or theme changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [symbol, theme]);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const imagePath = IMAGE_PATHS[theme]?.[symbol] || '';
  const fallbackEmoji = SYMBOL_EMOJIS[symbol] || symbol.charAt(0).toUpperCase();

  if (imageError || !imagePath) {
    return (
      <div className="symbol-fallback" style={{ color: themeColor }}>
        {fallbackEmoji}
      </div>
    );
  }

  return (
    <>
      {!imageLoaded && (
        <div className="symbol-loading" style={{ color: themeColor }}>
          <div className="loading-spinner"></div>
        </div>
      )}
      <img
        src={imagePath}
        alt={symbol}
        className={`symbol ${isSpinning ? 'blur' : ''} ${imageLoaded ? 'loaded' : 'loading'}`}
        draggable={false}
        onError={handleImageError}
        onLoad={handleImageLoad}
        loading="lazy"
        style={{ opacity: imageLoaded ? 1 : 0 }}
      />
    </>
  );
});

SymbolDisplay.displayName = 'SymbolDisplay';

/* ===============================
   MAIN SLOTS GAME COMPONENT
================================ */
const SlotsGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  /* ===============================
     STATE MANAGEMENT
  ================================ */
  const [showSetup, setShowSetup] = useState(true);
  const [theme, setTheme] = useState("classic");
  const [betAmount, setBetAmount] = useState(MIN_STAKE.toString());
  const [reels, setReels] = useState(Array(12).fill("seven"));
  const [spinning, setSpinning] = useState(false);
  const [spinningReels, setSpinningReels] = useState([false, false, false, false]);
  const [lastWin, setLastWin] = useState(0);
  const [winAnimation, setWinAnimation] = useState(false);
  const [jackpotPulse, setJackpotPulse] = useState(false);
  const [error, setError] = useState("");
  const [spinHistory, setSpinHistory] = useState([]);
  const [failedImages, setFailedImages] = useState({});

  const spinSound = useRef(null);
  const winSound = useRef(null);
  const clickSound = useRef(null);
  const reelStopSound = useRef(null);
  const bigWinSound = useRef(null);
  const spinTimeoutRef = useRef(null);
  const spinAnimationRef = useRef(null);

  /* ===============================
     SOUND MANAGEMENT
  ================================ */
  useEffect(() => {
    // Initialize sounds
    try {
      spinSound.current = new Audio("/sounds/spin.mp3");
      winSound.current = new Audio("/sounds/win.mp3");
      clickSound.current = new Audio("/sounds/click.mp3");
      reelStopSound.current = new Audio("/sounds/reel-stop.mp3");
      bigWinSound.current = new Audio("/sounds/big-win.mp3");

      spinSound.current.volume = 0.3;
      winSound.current.volume = 0.7;
      clickSound.current.volume = 0.4;
      reelStopSound.current.volume = 0.5;
      bigWinSound.current.volume = 0.8;
    } catch (err) {
      console.log("Audio initialization failed:", err);
    }

    return () => {
      // Cleanup
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (spinAnimationRef.current) cancelAnimationFrame(spinAnimationRef.current);
      
      [spinSound, winSound, clickSound, reelStopSound, bigWinSound].forEach(sound => {
        if (sound.current) {
          sound.current.pause();
          sound.current.currentTime = 0;
        }
      });
    };
  }, []);

  /* ===============================
     HELPER FUNCTIONS
  ================================ */
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const isStakeValid = useCallback(() => {
    const amount = Number(betAmount);
    return Number.isFinite(amount) && amount >= MIN_STAKE && amount <= balance;
  }, [betAmount, balance]);

  const selectedTheme = THEME_INFO[theme];

  /* ===============================
     ANIMATION FUNCTIONS
  ================================ */
  const getRandomSymbol = () => {
    const list = SYMBOLS[theme];
    return list[Math.floor(Math.random() * list.length)];
  };

  const animateReelSpin = (reelIndex, duration = 2000) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (elapsed < duration) {
          // Update symbols in this column
          setReels(prev => {
            const newReels = [...prev];
            for (let row = 0; row < 3; row++) {
              const index = row * 4 + reelIndex;
              newReels[index] = getRandomSymbol();
            }
            return newReels;
          });
          
          spinAnimationRef.current = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      spinAnimationRef.current = requestAnimationFrame(animate);
    });
  };

  const stopReelSequentially = async (finalReels) => {
    for (let col = 0; col < 4; col++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Update final symbols for this column
      setReels(prev => {
        const newReels = [...prev];
        for (let row = 0; row < 3; row++) {
          const index = row * 4 + col;
          newReels[index] = finalReels[index];
        }
        return newReels;
      });

      // Play stop sound
      if (reelStopSound.current) {
        try {
          reelStopSound.current.currentTime = 0;
          reelStopSound.current.play().catch(() => {});
        } catch (err) {
          console.log("Sound play failed:", err);
        }
      }
    }
  };

  /* ===============================
     SPIN HANDLER
  ================================ */
  const handleSpin = async () => {
    if (spinning) return;
    
    const amount = Number(betAmount);

    // Validation
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid stake amount");
      return;
    }

    if (amount < MIN_STAKE) {
      setError(`Minimum stake is ₦${MIN_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    if (amount > balance) {
      setError("Insufficient balance");
      return;
    }

    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    setError("");
    setSpinning(true);
    setLastWin(0);
    setWinAnimation(false);
    setJackpotPulse(false);

    // Play click sound
    if (clickSound.current) {
      try {
        clickSound.current.currentTime = 0;
        clickSound.current.play().catch(() => {});
      } catch (err) {
        console.log("Click sound failed:", err);
      }
    }

    // Start all reels spinning
    setSpinningReels([true, true, true, true]);

    // Start spin sound
    if (spinSound.current) {
      try {
        spinSound.current.loop = true;
        spinSound.current.currentTime = 0;
        spinSound.current.play().catch(() => {});
      } catch (err) {
        console.log("Spin sound failed:", err);
      }
    }

    try {
      // Start spinning animations
      const spinPromises = [];
      for (let col = 0; col < 4; col++) {
        const delay = col * 100;
        spinPromises.push(
          new Promise(resolve => {
            setTimeout(() => animateReelSpin(col, 2000).then(resolve), delay);
          })
        );
      }

      // Make API call
      const spinPromise = slotsService.spin({
        bet_amount: amount,
        theme,
      });

      // Wait for API response
      const res = await spinPromise;
      const finalReels = res.data.reels;
      const winAmount = res.data.win_amount || 0;

      // Wait for animations to complete
      await Promise.all(spinPromises);

      // Stop spin sound
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }

      // Stop reels sequentially with final results
      await stopReelSequentially(finalReels);

      // Update state with results
      setLastWin(winAmount);
      
      if (winAmount > 0) {
        // Big win celebration
        setWinAnimation(true);
        setJackpotPulse(true);
        
        // Play win sound
        try {
          if (winAmount > amount * 10 && bigWinSound.current) {
            bigWinSound.current.currentTime = 0;
            bigWinSound.current.play().catch(() => {});
          } else if (winSound.current) {
            winSound.current.currentTime = 0;
            winSound.current.play().catch(() => {});
          }
        } catch (err) {
          console.log("Win sound failed:", err);
        }

        // Auto-hide pulse after delay
        setTimeout(() => setJackpotPulse(false), 3000);
      }

      // Update wallet
      if (refreshWallet) {
        await refreshWallet();
      }

      // Add to history
      setSpinHistory(prev => [{
        bet: amount,
        win: winAmount,
        timestamp: new Date().toLocaleTimeString(),
        reels: finalReels
      }, ...prev.slice(0, 9)]);

    } catch (err) {
      console.error("Spin failed:", err);
      setError(err.response?.data?.detail || "Spin failed. Please try again.");
      
      // Emergency stop
      setSpinningReels([false, false, false, false]);
      
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }
    } finally {
      setSpinning(false);
      
      // Ensure all reels are stopped
      setTimeout(() => {
        setSpinningReels([false, false, false, false]);
      }, 500);
    }
  };

  /* ===============================
     EVENT HANDLERS
  ================================ */
  const handleQuickBet = (amount) => {
    setBetAmount(amount.toString());
    playClickSound();
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    // Reset reels to first symbol of new theme
    setReels(Array(12).fill(SYMBOLS[newTheme][0]));
    playClickSound();
  };

  const playClickSound = () => {
    if (clickSound.current) {
      try {
        clickSound.current.currentTime = 0;
        clickSound.current.play().catch(() => {});
      } catch (err) {
        console.log("Click sound failed:", err);
      }
    }
  };

  const quickBets = [100, 500, 1000, 5000];

  /* ===============================
     RENDER
  ================================ */
  return (
    <div className="arcade-slots">
      {/* ================= ARCADE HEADER ================= */}
      <header className="arcade-header">
        <button 
          onClick={() => navigate("/")} 
          className="arcade-back-btn"
          onMouseEnter={playClickSound}
          type="button"
        >
          <span className="btn-glow">◄</span>
          <span className="btn-text">ARCADE</span>
        </button>
        
        <div className="arcade-title">
          <div className="title-glow">NEON SLOTS</div>
          <div className="title-sub">ARCADE EDITION</div>
        </div>
        
        <div className={`arcade-balance ${walletLoading ? 'loading' : ''}`}>
          <div className="balance-label">CREDITS</div>
          <div className="balance-value">
            {walletLoading ? (
              <div className="balance-loading">
                <div className="loading-bars">
                  <div className="bar"></div>
                  <div className="bar"></div>
                  <div className="bar"></div>
                </div>
                <span>SYNCING...</span>
              </div>
            ) : (
              <>
                <span className="currency">₦</span>
                {balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================= SETUP MODAL ================= */}
      {showSetup && (
        <div className="arcade-modal-overlay">
          <div className="arcade-modal">
            <div className="modal-header">
              <div className="modal-title">
                <h2>SLOT MACHINE</h2>
              </div>
            </div>

            <div className="modal-section">
              <div className="section-header">
                <span className="section-icon">💰</span>
                <h3>STAKE AMOUNT</h3>
              </div>
              
              <div className="stake-input-container">
                <div className="input-label">Enter Stake (₦)</div>
                <div className="input-wrapper">
                  <span className="input-prefix">₦</span>
                  <input
                    type="number"
                    min={MIN_STAKE}
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    disabled={walletLoading}
                    placeholder={MIN_STAKE.toString()}
                    className="arcade-input"
                    inputMode="decimal"
                  />
                </div>

                {/* Stake validation */}
                {!isStakeValid() && betAmount.trim() !== '' && (
                  <div className="stake-validation">
                    <span className="validation-icon">⚠️</span>
                    Minimum stake is ₦{MIN_STAKE.toLocaleString("en-NG")}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-section">
              <div className="section-header">
                <span className="section-icon">🎨</span>
                <h3>THEME SELECTION</h3>
              </div>
              
              <div className="theme-select-container">
                <div className="theme-buttons">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className={`theme-btn ${theme === option.value ? 'active' : ''}`}
                      onClick={() => handleThemeChange(option.value)}
                      style={{ 
                        '--theme-color': option.color,
                        '--theme-color-rgb': option.color.replace('#', '')
                      }}
                      disabled={walletLoading}
                      type="button"
                    >
                      <span className="theme-icon">{option.icon}</span>
                      <span className="theme-label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="error-display">
                <span className="error-icon">🚫</span>
                {error}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="arcade-btn secondary"
                onClick={() => navigate("/")}
                disabled={walletLoading}
                onMouseEnter={playClickSound}
                type="button"
              >
                EXIT ARCADE
              </button>
              <button
                className={`arcade-btn primary ${!isStakeValid() ? 'disabled' : ''}`}
                onClick={() => {
                  if (isStakeValid()) {
                    setShowSetup(false);
                    playClickSound();
                  }
                }}
                disabled={walletLoading || !isStakeValid()}
                type="button"
              >
                {walletLoading ? (
                  <div className="btn-loading">
                    <div className="spinner"></div>
                    LOADING...
                  </div>
                ) : (
                  <>
                    <span className="btn-icon">▶️</span>
                    LAUNCH GAME
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SLOT MACHINE ================= */}
      {!showSetup && (
        <div className="arcade-machine">
          {/* Machine Frame */}
          <div className="machine-frame">
            <div className="frame-top">
              <div className="machine-title">
                <span className="title-glow">SLOT MASTER</span>
                <span className="title-version">PRO</span>
              </div>
              <div className="machine-stats">
                <div className="stat">
                  <span className="stat-label">THEME</span>
                  <span className="stat-value" style={{ color: selectedTheme.color }}>
                    {selectedTheme.icon} {selectedTheme.name}
                  </span>
                </div>
                <div className="stat">
                  <span className="stat-label">STAKE</span>
                  <span className="stat-value">{formatNGN(betAmount)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">BALANCE</span>
                  <span className="stat-value">{formatNGN(balance)}</span>
                </div>
              </div>
            </div>

            {/* Reels Display */}
            <div className="reels-display">
              <div className="display-frame">
                <div className="reels-grid">
                  {reels.map((symbol, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const isSpinning = spinningReels[col];
                    
                    return (
                      <div 
                        key={i} 
                        className={`reel-cell ${isSpinning ? 'spinning' : ''} row-${row} col-${col}`}
                        data-spinning={isSpinning}
                      >
                        <div className="reel-inner">
                          <div className="reel-content">
                            <SymbolDisplay 
                              symbol={symbol}
                              theme={theme}
                              isSpinning={isSpinning}
                              themeColor={selectedTheme.color}
                            />
                          </div>
                          <div className="reel-overlay"></div>
                          {isSpinning && <div className="spin-glow"></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Grid Lines */}
                <div className="grid-lines">
                  <div className="vertical-line v1"></div>
                  <div className="vertical-line v2"></div>
                  <div className="vertical-line v3"></div>
                  <div className="horizontal-line h1"></div>
                  <div className="horizontal-line h2"></div>
                </div>
                
                {/* Frame Glow */}
                <div className="frame-glow"></div>
                
                {/* Win Lines Overlay */}
                <div className={`win-lines ${winAnimation ? 'visible' : ''}`}>
                  <div className="win-line line1"></div>
                  <div className="win-line line2"></div>
                  <div className="win-line line3"></div>
                </div>
              </div>
            </div>

            {/* Control Panel */}
            <div className="control-panel">
              <div className="win-display-section">
                {lastWin > 0 ? (
                  <div className={`win-display ${winAnimation ? 'animate' : ''}`}>
                    <div className="win-glow"></div>
                    <div className="win-content">
                      <span className="win-icon">💰</span>
                      <span className="win-text">Winner!</span>
                      <span className="win-amount">{formatNGN(lastWin)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="win-placeholder">
                    <div className="placeholder-text">SPIN TO WIN!</div>
                    <div className="placeholder-sub">Match 3+ symbols</div>
                  </div>
                )}
              </div>

              <div className="spin-controls">
                <button
                  className={`spin-btn ${spinning ? 'spinning' : ''} ${jackpotPulse ? 'jackpot' : ''}`}
                  onClick={handleSpin}
                  disabled={walletLoading || spinning || !isStakeValid()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    playClickSound();
                  }}
                  type="button"
                >
                  <div className="spin-btn-glow"></div>
                  <div className="spin-btn-content">
                    <span className="spin-icon">🎰</span>
                    <span className="spin-text">
                      {spinning ? 'SPINNING...' : 'SPIN REELS'}
                    </span>
                  </div>
                  <div className="spin-btn-lights">
                    <div className="light"></div>
                    <div className="light"></div>
                    <div className="light"></div>
                    <div className="light"></div>
                  </div>
                  <div className="spin-btn-pulse"></div>
                </button>
              </div>
              
              {/* Quick Stats */}
              <div className="quick-stats">
                <div className="stat-item">
                  <span className="stat-icon">🎯</span>
                  <span className="stat-label">Last Win</span>
                  <span className="stat-value">{formatNGN(lastWin)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">📈</span>
                  <span className="stat-label">Spins</span>
                  <span className="stat-value">{spinHistory.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🏆</span>
                  <span className="stat-label">Best</span>
                  <span className="stat-value">
                    {spinHistory.length > 0 
                      ? formatNGN(Math.max(...spinHistory.map(s => s.win)))
                      : formatNGN(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotsGame;