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
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* ===============================
     STATE MANAGEMENT
  ================================ */
  const [showSetup, setShowSetup] = useState(true);
  const [theme, setTheme] = useState("classic");
  const [betAmount, setBetAmount] = useState(MIN_STAKE.toString());
  const [grid, setGrid] = useState([["seven", "seven", "seven"], ["seven", "seven", "seven"], ["seven", "seven", "seven"]]);
  const [spinning, setSpinning] = useState(false);
  const [spinningReels, setSpinningReels] = useState([false, false, false]);
  const [lastWin, setLastWin] = useState(0);
  const [lastMultiplier, setLastMultiplier] = useState(0);
  const [winAnimation, setWinAnimation] = useState(false);
  const [jackpotPulse, setJackpotPulse] = useState(false);
  const [error, setError] = useState("");
  const [spinHistory, setSpinHistory] = useState([]);
  const [winningLines, setWinningLines] = useState([]);
  const [gameInfo, setGameInfo] = useState(null);

  const spinSound = useRef(null);
  const winSound = useRef(null);
  const clickSound = useRef(null);
  const reelStopSound = useRef(null);
  const bigWinSound = useRef(null);
  const spinTimeoutRef = useRef(null);
  const spinAnimationRef = useRef(null);
  const lastTouchTime = useRef(0);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  /* ===============================
     FETCH GAME INFO
  ================================ */
  const fetchGameInfo = useCallback(async () => {
    try {
      const res = await slotsService.getInfo();
      setGameInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch game info:", err);
    }
  }, []);

  /* ===============================
     INITIALIZATION
  ================================ */
  useEffect(() => {
    fetchGameInfo();
    
    // Initialize sounds
    try {
      spinSound.current = new Audio("/sounds/spin.mp3");
      winSound.current = new Audio("/sounds/win.mp3");
      clickSound.current = new Audio("/sounds/click.mp3");
      reelStopSound.current = new Audio("/sounds/reel-stop.mp3");
      bigWinSound.current = new Audio("/sounds/big-win.mp3");

      // Set volume levels
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
  }, [fetchGameInfo]);

  /* ===============================
     HELPER FUNCTIONS
  ================================ */
  const getWalletBalance = () => {
    return availableBalance !== undefined ? availableBalance : (availableBalance);
  };

  const balance = Number(getWalletBalance() || 0);

  const isStakeValid = useCallback(() => {
    const amount = Number(betAmount);
    return Number.isFinite(amount) && amount >= MIN_STAKE && amount <= balance;
  }, [betAmount, balance]);

  const selectedTheme = THEME_INFO[theme];

  /* ===============================
     MOBILE TOUCH HANDLING
  ================================ */
  const handleMobileClick = (handler) => (e) => {
    if (isMobile) {
      const now = Date.now();
      // Prevent multiple rapid taps
      if (now - lastTouchTime.current < 300) {
        e.preventDefault();
        return;
      }
      lastTouchTime.current = now;
      
      // Add visual feedback for mobile
      if (e.currentTarget) {
        e.currentTarget.classList.add('touch-active');
        setTimeout(() => {
          if (e.currentTarget) {
            e.currentTarget.classList.remove('touch-active');
          }
        }, 200);
      }
    }
    handler(e);
  };

  /* ===============================
     ANIMATION FUNCTIONS
  ================================ */
  const getRandomSymbol = () => {
    const list = SYMBOLS[theme];
    return list[Math.floor(Math.random() * list.length)];
  };

  const animateReelSpin = (reelIndex, duration = 1500) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const frames = [];
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        if (elapsed < duration) {
          // Update symbols in this column (3 rows)
          setGrid(prev => {
            const newGrid = [...prev];
            for (let row = 0; row < 3; row++) {
              newGrid[row][reelIndex] = getRandomSymbol();
            }
            return newGrid;
          });
          
          frames.push(Date.now());
          spinAnimationRef.current = requestAnimationFrame(animate);
        } else {
          // Calculate average FPS for debugging
          if (frames.length > 1) {
            const avgFrameTime = (frames[frames.length - 1] - frames[0]) / frames.length;
            console.log(`Reel ${reelIndex} avg FPS: ${Math.round(1000 / avgFrameTime)}`);
          }
          resolve();
        }
      };

      spinAnimationRef.current = requestAnimationFrame(animate);
    });
  };

  const stopReelSequentially = async (finalGrid) => {
    for (let col = 0; col < 3; col++) {
      await new Promise(resolve => setTimeout(resolve, isMobile ? 200 : 300));
      
      // Update final symbols for this column
      setGrid(prev => {
        const newGrid = [...prev];
        for (let row = 0; row < 3; row++) {
          newGrid[row][col] = finalGrid[row][col];
        }
        return newGrid;
      });

      // Update spinning state
      setSpinningReels(prev => {
        const newState = [...prev];
        newState[col] = false;
        return newState;
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
    setLastMultiplier(0);
    setWinAnimation(false);
    setJackpotPulse(false);
    setWinningLines([]);

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
    setSpinningReels([true, true, true]);

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
      for (let col = 0; col < 3; col++) {
        const delay = col * 100;
        spinPromises.push(
          new Promise(resolve => {
            setTimeout(() => animateReelSpin(col, 1500).then(resolve), delay);
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
      const finalGrid = res.data.grid || [[], [], []];
      const winAmount = res.data.win_amount || 0;
      const multiplier = res.data.multiplier || 0;
      const lines = res.data.winning_lines || [];
      const winTier = res.data.win_tier || 'loss';

      // Wait for animations to complete
      await Promise.all(spinPromises);

      // Stop spin sound
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }

      // Stop reels sequentially with final results
      await stopReelSequentially(finalGrid);

      // Update state with results
      setLastWin(winAmount);
      setLastMultiplier(multiplier);
      setWinningLines(lines);
      
      if (winAmount > 0) {
        // Win celebration
        setWinAnimation(true);
        setJackpotPulse(true);
        
        // Play appropriate win sound
        try {
          if (multiplier >= 3.0 && bigWinSound.current) {
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
        multiplier: multiplier,
        timestamp: new Date().toLocaleTimeString(),
        winTier: winTier,
        theme: theme
      }, ...prev.slice(0, 9)]);

    } catch (err) {
      console.error("Spin failed:", err);
      setError(err.response?.data?.detail || err.response?.data?.error || "Spin failed. Please try again.");
      
      // Emergency stop
      setSpinningReels([false, false, false]);
      
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }
    } finally {
      setSpinning(false);
      
      // Ensure all reels are stopped
      setTimeout(() => {
        setSpinningReels([false, false, false]);
      }, 500);
    }
  };

  /* ===============================
     EVENT HANDLERS
  ================================ */
  const handleQuickBet = handleMobileClick((amount) => {
    setBetAmount(amount.toString());
    playClickSound();
  });

  const handleThemeChange = handleMobileClick((newTheme) => {
    setTheme(newTheme);
    // Reset grid to first symbol of new theme
    const firstSymbol = SYMBOLS[newTheme][0];
    setGrid([[firstSymbol, firstSymbol, firstSymbol], 
             [firstSymbol, firstSymbol, firstSymbol], 
             [firstSymbol, firstSymbol, firstSymbol]]);
    playClickSound();
  });

  const playClickSound = () => {
    if (clickSound.current && !isMobile) { // Reduce sounds on mobile
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
     RENDER WIN TIER BADGE
  ================================ */
  const getWinTierColor = (tier) => {
    switch(tier) {
      case 'small': return '#10B981';
      case 'medium': return '#3B82F6';
      case 'good': return '#8B5CF6';
      case 'big': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getWinTierName = (tier) => {
    switch(tier) {
      case 'small': return 'Small Win';
      case 'medium': return 'Good Win';
      case 'good': return 'Great Win';
      case 'big': return 'Big Win';
      default: return 'No Win';
    }
  };

  /* ===============================
     RENDER
  ================================ */
  return (
    <div className="arcade-slots">
      {/* ================= ARCADE HEADER ================= */}
      <header className="arcade-header">
        <button 
          onClick={handleMobileClick(() => navigate("/"))} 
          className="arcade-back-btn"
          type="button"
        >
          <span className="btn-glow">◄</span>
          <span className="btn-text">ARCADE</span>
        </button>
        
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
                onClick={handleMobileClick(() => navigate("/"))}
                disabled={walletLoading}
                type="button"
              >
                EXIT ARCADE
              </button>
              <button
                className={`arcade-btn primary ${!isStakeValid() ? 'disabled' : ''}`}
                onClick={handleMobileClick(() => {
                  if (isStakeValid()) {
                    setShowSetup(false);
                    playClickSound();
                  }
                })}
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
              </div>
            </div>

            {/* Reels Display */}
            <div className="reels-display">
              <div className="display-frame">
                <div className="reels-grid">
                  {grid.map((row, rowIndex) => (
                    <div key={rowIndex} className="reels-row">
                      {row.map((symbol, colIndex) => {
                        const isSpinning = spinningReels[colIndex];
                        
                        return (
                          <div 
                            key={`${rowIndex}-${colIndex}`} 
                            className={`reel-cell ${isSpinning ? 'spinning' : ''}`}
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
                  ))}
                </div>
                
                {/* Grid Lines */}
                <div className="grid-lines">
                  <div className="vertical-line v1"></div>
                  <div className="vertical-line v2"></div>
                  <div className="horizontal-line h1"></div>
                  <div className="horizontal-line h2"></div>
                </div>
                
                {/* Frame Glow */}
                <div className="frame-glow"></div>
                
                {/* Winning Lines Overlay */}
                {winningLines.map((line, index) => {
                  let lineClass = '';
                  if (line.line === 0) lineClass = 'win-line-top';
                  if (line.line === 1) lineClass = 'win-line-middle';
                  if (line.line === 2) lineClass = 'win-line-bottom';
                  if (line.line === 3) lineClass = 'win-line-diagonal-1';
                  if (line.line === 4) lineClass = 'win-line-diagonal-2';
                  if (line.line === 'bonus') lineClass = 'win-line-bonus';
                  
                  return (
                    <div key={index} className={`win-line ${lineClass} ${winAnimation ? 'visible' : ''}`}></div>
                  );
                })}
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
                      <div className="win-details">
                        <span className="win-text">WINNER!</span>
                        <span className="win-amount">{formatNGN(lastWin)}</span>
                        
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="win-placeholder">
                  </div>
                )}
              </div>

              <div className="spin-controls">
                <button
                  className={`spin-btn ${spinning ? 'spinning' : ''} ${jackpotPulse ? 'jackpot' : ''}`}
                  onClick={handleMobileClick(handleSpin)}
                  disabled={walletLoading || spinning || !isStakeValid()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (!spinning && isStakeValid()) {
                      playClickSound();
                    }
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