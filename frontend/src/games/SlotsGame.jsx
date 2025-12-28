import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { slotsService } from "../services/api";
import "./SlotsGame.css";

/* ===============================
   GAME CONSTANTS
================================ */
const MIN_STAKE = 200; // Minimum stake of 1000 naira

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

/* ===============================
   FORMATTING UTILS
================================ */
const formatNGN = (value) =>
  `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
  })}`;

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
  const [lastWin, setLastWin] = useState(0);
  const [winAnimation, setWinAnimation] = useState(false);
  const [jackpotPulse, setJackpotPulse] = useState(false);
  const [error, setError] = useState("");

  const spinSound = useRef(null);
  const winSound = useRef(null);
  const clickSound = useRef(null);
  const reelStopSound = useRef(null);

  /* ===============================
     SOUND MANAGEMENT
  ================================ */
  useEffect(() => {
    // Initialize sounds
    spinSound.current = new Audio("/sounds/spin.mp3");
    winSound.current = new Audio("/sounds/win.mp3");
    clickSound.current = new Audio("/sounds/click.mp3");
    reelStopSound.current = new Audio("/sounds/reel-stop.mp3");

    spinSound.current.loop = true;
    spinSound.current.volume = 0.3;
    winSound.current.volume = 0.7;
    clickSound.current.volume = 0.4;
    reelStopSound.current.volume = 0.5;

    return () => {
      // Cleanup sounds
      [spinSound, winSound, clickSound, reelStopSound].forEach(sound => {
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
    return Number.isFinite(amount) && amount >= MIN_STAKE;
  }, [betAmount]);

  const selectedTheme = THEME_INFO[theme];

  /* ===============================
     FRONTEND ANIMATION FUNCTIONS
  ================================ */
  const randomReels = () => {
    const list = SYMBOLS[theme];
    return Array.from({ length: 12 }, () =>
      list[Math.floor(Math.random() * list.length)]
    );
  };

  const playReelStopSequence = async (finalReels) => {
    const reelsPerRow = 4;
    for (let row = 0; row < 3; row++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      if (reelStopSound.current) {
        reelStopSound.current.currentTime = 0;
        reelStopSound.current.play().catch(() => {});
      }
      
      // Update one row at a time
      const updatedReels = [...reels];
      for (let col = 0; col < reelsPerRow; col++) {
        const index = row * reelsPerRow + col;
        updatedReels[index] = finalReels[index];
      }
      setReels(updatedReels);
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

    // Play click sound
    if (clickSound.current) {
      clickSound.current.currentTime = 0;
      clickSound.current.play().catch(() => {});
    }

    // Start spin sound
    if (spinSound.current) {
      spinSound.current.currentTime = 0;
      spinSound.current.play().catch(() => {});
    }

    // Frontend animation
    const spinInterval = setInterval(() => {
      setReels(randomReels());
    }, 80);

    try {
      // API call
      const res = await slotsService.spin({
        bet_amount: amount,
        theme,
      });

      clearInterval(spinInterval);
      
      // Stop spin sound
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }

      // Play reel stop sequence
      await playReelStopSequence(res.data.reels);

      const winAmount = res.data.win_amount || 0;
      setLastWin(winAmount);

      // Play win sound if won
      if (winAmount > 0 && winSound.current) {
        winSound.current.currentTime = 0;
        winSound.current.play().catch(() => {});
        setWinAnimation(true);
        setJackpotPulse(true);
        setTimeout(() => setJackpotPulse(false), 2000);
      }

      // Update wallet
      if (refreshWallet) {
        await refreshWallet();
      }

    } catch (err) {
      console.error("Spin failed:", err);
      setError(err.response?.data?.detail || "Spin failed. Please try again.");
      clearInterval(spinInterval);
      
      if (spinSound.current) {
        spinSound.current.pause();
        spinSound.current.currentTime = 0;
      }
    } finally {
      setSpinning(false);
    }
  };

  /* ===============================
     QUICK BET OPTIONS
  ================================ */
  const quickBets = [1000, 2000, 5000, 10000];

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
          onMouseEnter={() => {
            if (clickSound.current) {
              clickSound.current.currentTime = 0;
              clickSound.current.play().catch(() => {});
            }
          }}
        >
          <span className="btn-glow">◄</span>
          <span className="btn-text">ARCADE</span>
        </button>
        
        <div className="arcade-title">
          <div className="title-glow">GOLDEN ARCADE</div>
          <div className="title-sub">SLOT MASTER 3000</div>
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
                <span className="modal-icon">🎮</span>
                <h2>ARCADE CONFIG</h2>
              </div>
              <div className="modal-subtitle">Configure your gaming session</div>
            </div>

            <div className="modal-section">
              <div className="section-header">
                <span className="section-icon">💰</span>
                <h3>STAKE SELECTION</h3>
              </div>
              
              <div className="balance-display-section">
                <div className="balance-label">Available Credits</div>
                <div className="balance-amount">
                  {walletLoading ? (
                    <div className="loading-inline">
                      <div className="spinner-small"></div>
                      <span>LOADING...</span>
                    </div>
                  ) : (
                    formatNGN(balance)
                  )}
                </div>
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
                  />
                </div>

                {/* Quick bet chips */}
                <div className="quick-bet-grid">
                  {quickBets.map((amount) => (
                    <button
                      key={amount}
                      className={`quick-bet-chip ${Number(betAmount) === amount ? 'active' : ''}`}
                      onClick={() => {
                        setBetAmount(amount.toString());
                        if (clickSound.current) {
                          clickSound.current.currentTime = 0;
                          clickSound.current.play().catch(() => {});
                        }
                      }}
                      disabled={walletLoading}
                      type="button"
                    >
                      <span className="chip-amount">₦{amount.toLocaleString()}</span>
                      <span className="chip-glow"></span>
                    </button>
                  ))}
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
                <div className="select-wrapper">
                  <select
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value);
                      if (clickSound.current) {
                        clickSound.current.currentTime = 0;
                        clickSound.current.play().catch(() => {});
                      }
                    }}
                    disabled={walletLoading}
                    className="theme-select"
                    style={{ '--theme-color': selectedTheme.color }}
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.icon} {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="select-arrow">▼</div>
                </div>
                
                <div className="theme-preview">
                  <div className="preview-icon">{selectedTheme.icon}</div>
                  <div className="preview-info">
                    <div className="preview-name">{selectedTheme.name}</div>
                    <div className="preview-desc">
                      {theme === 'classic' && 'Classic casino symbols'}
                      {theme === 'fruit' && 'Fresh fruit symbols'}
                      {theme === 'diamond' && 'Precious gemstones'}
                      {theme === 'ancient' && 'Ancient Egyptian artifacts'}
                    </div>
                  </div>
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
                onMouseEnter={() => {
                  if (clickSound.current) {
                    clickSound.current.currentTime = 0;
                    clickSound.current.play().catch(() => {});
                  }
                }}
              >
                EXIT ARCADE
              </button>
              <button
                className={`arcade-btn primary ${!isStakeValid() ? 'disabled' : ''}`}
                onClick={() => {
                  if (isStakeValid()) {
                    setShowSetup(false);
                    if (clickSound.current) {
                      clickSound.current.currentTime = 0;
                      clickSound.current.play().catch(() => {});
                    }
                  }
                }}
                disabled={walletLoading || !isStakeValid()}
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
                    {selectedTheme.name}
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
                  {reels.map((symbol, i) => (
                    <div key={i} className={`reel-cell ${spinning ? 'spinning' : ''}`}>
                      <div className="reel-inner">
                        <div className="reel-content">
                          <img
                            src={`/images/slots/${symbol}.png`}
                            alt={symbol}
                            className="symbol"
                            draggable={false}
                          />
                        </div>
                        <div className="reel-overlay"></div>
                      </div>
                    </div>
                  ))}
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
                      <span className="win-text">JACKPOT!</span>
                      <span className="win-amount">{formatNGN(lastWin)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="win-placeholder">
                    <span className="placeholder-text">SPIN TO WIN</span>
                    <span className="placeholder-sub">Fortunes await!</span>
                  </div>
                )}
              </div>

              <div className="spin-controls">
                <button
                  className={`spin-btn ${spinning ? 'spinning' : ''} ${jackpotPulse ? 'jackpot' : ''}`}
                  onClick={handleSpin}
                  disabled={walletLoading || spinning || !isStakeValid()}
                  onMouseEnter={() => {
                    if (!spinning && clickSound.current) {
                      clickSound.current.currentTime = 0;
                      clickSound.current.play().catch(() => {});
                    }
                  }}
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
                  </div>
                </button>

                <button
                  className="config-btn"
                  onClick={() => {
                    setShowSetup(true);
                    if (clickSound.current) {
                      clickSound.current.currentTime = 0;
                      clickSound.current.play().catch(() => {});
                    }
                  }}
                  disabled={spinning}
                >
                  <span className="config-icon">⚙️</span>
                  CONFIG
                </button>
              </div>
            </div>
          </div>

          {/* Arcade Footer */}
          <div className="arcade-footer">
            <div className="footer-info">
              <div className="info-item">
                <span className="info-icon">🎯</span>
                <span className="info-text">MIN STAKE: {formatNGN(MIN_STAKE)}</span>
              </div>
              <div className="info-item">
                <span className="info-icon">⚡</span>
                <span className="info-text">PROVABLY FAIR</span>
              </div>
              <div className="info-item">
                <span className="info-icon">🏆</span>
                <span className="info-text">HIGH RTP</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SlotsGame;