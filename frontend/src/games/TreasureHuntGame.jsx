import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { treasureService } from "../services/api";
import "./TreasureHuntGame.css";

const MIN_STAKE = 100;

const MAP_LEVELS = [
  { level: 1, name: "Beginner Island", icon: "🏝️", risk: "Low", color: "#4CAF50" },
  { level: 2, name: "Ancient Forest", icon: "🌲", risk: "Medium", color: "#2196F3" },
  { level: 3, name: "Dragon Mountain", icon: "⛰️", risk: "High", color: "#FF9800" },
  { level: 4, name: "Phantom Desert", icon: "🏜️", risk: "Very High", color: "#9C27B0" },
  { level: 5, name: "Celestial Realm", icon: "🌌", risk: "Extreme", color: "#F44336" },
];

const TreasureHuntGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const getCombinedBalance = useCallback(() => {
    if (!wallet) return user?.balance || 0;
    const balance = wallet.balance || 0;
    const spot_balance = wallet.spot_balance || 0;
    return balance + spot_balance;
  }, [wallet, user]);

  const getSpotBalance = useCallback(() => {
    if (!wallet) return 0;
    return wallet.spot_balance || 0;
  }, [wallet]);

  /* ---------------- STATE ---------------- */
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [mapLevel, setMapLevel] = useState(1);
  const [phase, setPhase] = useState("idle");
  const [hunting, setHunting] = useState(false);
  const [lastHunt, setLastHunt] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showStartModal, setShowStartModal] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [revealedTreasures, setRevealedTreasures] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);

  const animationTimers = useRef([]);
  const isMounted = useRef(true);

  /* ---------------- WALLET ---------------- */
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  const selectedMap = MAP_LEVELS.find((m) => m.level === mapLevel);
  const levelMultiplier = mapLevel * 1.5;
  const totalCost = betAmount * levelMultiplier;

  /* ---------------- FETCH GAME INFO ---------------- */
  const fetchGameInfo = useCallback(async () => {
    try {
      const res = await treasureService.getGameInfo();
      setGameInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch game info:", err);
    }
  }, []);

  /* ---------------- DEEP REFRESH FUNCTION ---------------- */
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      // Reset all states
      setLastHunt(null);
      setRevealedTreasures([]);
      setShowWinModal(false);
      setShowLossModal(false);
      setErrorMessage(null);
      
      // Refresh wallet data
      if (refreshWallet) {
        await refreshWallet();
      }
      
      // Small delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error("Deep refresh error:", error);
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
        setShowStartModal(true);
        setPhase("idle");
        setHunting(false);
      }
    }
  }, [refreshWallet]);

  /* ---------------- TREASURE REVEAL ANIMATION ---------------- */
  const revealTreasuresProgressively = (treasures) => {
    setRevealedTreasures([]);
    
    if (!treasures || treasures.length === 0) {
      // No treasures found - show loss after delay
      setTimeout(() => {
        setShowLossModal(true);
      }, 1500);
      return;
    }
    
    // Reveal treasures one by one with staggered timing
    treasures.forEach((treasure, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedTreasures(prev => [...prev, treasure]);
          
          // Trigger pulse animation for each reveal
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          // After all treasures are revealed, check for win
          if (index === treasures.length - 1) {
            setTimeout(() => {
              if (isMounted.current) {
                setShowWinModal(true);
              }
            }, 1000);
          }
        }
      }, (index + 1) * 800); // 800ms between each reveal
    });
  };

  /* ---------------- ENHANCED ANIMATIONS ---------------- */
  const clearTimers = () => {
    animationTimers.current.forEach(clearTimeout);
    animationTimers.current = [];
  };

  const startAnimation = () => {
    clearTimers();
    
    // Sailing phase with wave animation
    setPhase("sailing");
    document.body.classList.add("phase-sailing");
    
    animationTimers.current.push(
      setTimeout(() => {
        setPhase("scanning");
        document.body.classList.remove("phase-sailing");
        document.body.classList.add("phase-scanning");
      }, 2500),
      
      setTimeout(() => {
        setPhase("digging");
        document.body.classList.remove("phase-scanning");
        document.body.classList.add("phase-digging");
      }, 4500),
      
      setTimeout(() => {
        setPhase("revealing");
        document.body.classList.remove("phase-digging");
        document.body.classList.add("phase-revealing");
      }, 6500)
    );
  };

  /* ---------------- COMPONENT LIFECYCLE ---------------- */
  useEffect(() => {
    isMounted.current = true;
    fetchGameInfo();
    
    return () => {
      isMounted.current = false;
      clearTimers();
      document.body.classList.remove(
        "phase-sailing", 
        "phase-scanning", 
        "phase-digging", 
        "phase-revealing"
      );
    };
  }, [fetchGameInfo]);

  /* ---------------- START HUNT ---------------- */
  const startHunt = async () => {
    if (hunting || refreshing) return;

    if (walletLoading) {
      setErrorMessage("Please wait while your balance loads...");
      return;
    }

    if (betAmount < MIN_STAKE) {
      setErrorMessage("Minimum stake is ₦100");
      return;
    }

    if (totalCost > combinedBalance) {
      setErrorMessage("Insufficient wallet balance");
      return;
    }

    // Reset states
    setErrorMessage(null);
    setShowStartModal(false);
    setShowWinModal(false);
    setShowLossModal(false);
    setRevealedTreasures([]);
    setHunting(true);
    setLastHunt(null);
    
    // Start animations
    startAnimation();

    try {
      const res = await treasureService.startHunt({
        bet_amount: betAmount,
        map_level: mapLevel,
      });

      const data = res.data;
      
      // REMOVED THE WIN AMOUNT CAPPING - backend now handles 0.5x-3.5x multipliers
      const winAmount = data.win_amount; // Use the full win amount from backend
      const hasWon = winAmount > 0;

      setLastHunt({
        ...data,
        win_amount: winAmount,
        hasWon: hasWon,
        win_multiplier: data.win_multiplier || data.total_multiplier || 0
      });

      // Start progressive treasure reveal
      setTimeout(() => {
        revealTreasuresProgressively(data.treasures_found || []);
      }, 7000); // Start after animations complete

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (err) {
      setErrorMessage(err.response?.data?.error || "Expedition failed");
      setShowStartModal(true);
      clearTimers();
      setPhase("idle");
      document.body.classList.remove(
        "phase-sailing", 
        "phase-scanning", 
        "phase-digging", 
        "phase-revealing"
      );
    } finally {
      setTimeout(() => {
        if (isMounted.current) {
          setHunting(false);
        }
      }, 6000);
    }
  };

  /* ---------------- MODAL HANDLERS ---------------- */
  const handleContinue = async () => {
    setShowWinModal(false);
    await deepRefresh();
  };

  const handleTryAgain = async () => {
    setShowLossModal(false);
    await deepRefresh();
  };

  /* ---------------- CALCULATE WIN TIER ---------------- */
  const getWinTier = (multiplier) => {
    if (multiplier <= 0) return "loss";
    if (multiplier <= 1.5) return "low";
    if (multiplier <= 2.5) return "normal";
    if (multiplier <= 3.0) return "high";
    return "great";
  };

  const getWinTierColor = (tier) => {
    switch(tier) {
      case "low": return "#4CAF50";
      case "normal": return "#2196F3";
      case "high": return "#FF9800";
      case "great": return "#F44336";
      default: return "#9E9E9E";
    }
  };

  const getWinTierName = (tier) => {
    switch(tier) {
      case "low": return "Small Win";
      case "normal": return "Good Win";
      case "high": return "Great Win";
      case "great": return "Amazing Win";
      default: return "Loss";
    }
  };

  /* ================= RENDER ================= */
  return (
    <div className="treasure-hunt-game">
      {/* Background ambient animation */}
      <div className="ambient-animation"></div>
      
      {/* ================= HEADER ================= */}
      <header className="treasure-game-header">
        <button 
          className="back-button" 
          onClick={() => navigate("/")}
          disabled={refreshing}
        >
          ← Back
        </button>

        <div className="game-title">
          <span className="game-title-icon">🧭</span>
          <div className="game-title-text">
            <h1>Treasure Expedition</h1>
          </div>
        </div>
      </header>

      {/* ================= START MODAL ================= */}
      {showStartModal && (
        <div className="modal-overlay animated-fadeIn">
          <div className="panel-card animated-slideUp">
            <div className="panel-header-glow" style={{background: selectedMap.color}}>
              <h2 className="panel-title">Select Map & Stake</h2>
              
            </div>

            <div className="map-level-grid">
              {MAP_LEVELS.map((map) => (
                <button
                  key={map.level}
                  className={`map-level-card animated-bounceIn ${
                    map.level === mapLevel ? "active pulse" : ""
                  }`}
                  style={{animationDelay: `${map.level * 0.1}s`}}
                  onClick={() => !walletLoading && !refreshing && setMapLevel(map.level)}
                  disabled={walletLoading || refreshing}
                >
                  <div className="map-level-header">
                    <span className="map-level-icon">
                      {map.icon}
                    </span>
                    <div>
                      <div className="map-level-name">
                        Lv {map.level} · {map.name}
                      </div>
                      <div className="map-level-risk">
                        Risk: <strong style={{color: map.color}}>{map.risk}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="map-level-glow" style={{background: map.color}}></div>
                </button>
              ))}
            </div>

            <div className="stake-input-container mt-2">
              <label className="stake-label">Stake Amount (₦)</label>
              <div className="stake-input-wrapper animated-pulse">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  min={MIN_STAKE}
                  step="100"
                  value={betAmount}
                  onChange={(e) =>
                    !refreshing && setBetAmount(Number(e.target.value))
                  }
                  disabled={walletLoading || refreshing}
                />
                <div className="input-glow"></div>
              </div>
            </div>

            <div className="cost-summary mt-2 animated-fadeIn">
              <div className="cost-item">
                <span>Total Cost</span>
                <span className="cost-value total">
                  {formatNaira(totalCost)}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="error-banner mt-1 animated-shake">
                {errorMessage}
              </div>
            )}

            <button
              className="hunt-button mt-2 animated-pulse-glow"
              onClick={startHunt}
              disabled={walletLoading || refreshing || totalCost > combinedBalance || betAmount < MIN_STAKE}
            >
              {refreshing ? "REFRESHING..." : walletLoading ? "LOADING..." : "🚀 Start Expedition"}
            </button>
          </div>
        </div>
      )}

      {/* ================= GAME SCREEN ================= */}
      {!showStartModal && (
        <section className="game-screen-section">
          {/* Animated Map Background */}
          <div className={`map-screen map-screen--${phase}`}>
            <div className="map-overlay">
              {phase === "sailing" && (
                <>
                  <div className="overlay-title animated-wave">
                    ⛵ Sailing to {selectedMap.name}...
                  </div>
                  <div className="sailing-waves">
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                  </div>
                </>
              )}
              {phase === "scanning" && (
                <>
                  <div className="overlay-title animated-pulse">
                    🧭 Scanning for treasure...
                  </div>
                  <div className="scanning-radar">
                    <div className="radar-circle"></div>
                    <div className="radar-sweep"></div>
                  </div>
                </>
              )}
              {phase === "digging" && (
                <>
                  <div className="overlay-title animated-bounce">
                    ⛏️ Digging deep...
                  </div>
                  <div className="digging-animation">
                    <div className="shovel"></div>
                    <div className="dirt"></div>
                  </div>
                </>
              )}
              {phase === "revealing" && (
                <div className="treasure-reveal-container">
                  <div className="overlay-title animated-fadeIn">
                    🎉 Expedition Complete!
                  </div>
                  
                  {/* Progressive Treasure Reveal */}
                  <div className="treasures-grid-reveal">
                    {lastHunt?.hasWon ? (
                      revealedTreasures.map((treasure, index) => (
                        <div 
                          key={index} 
                          className={`treasure-card-reveal animated-zoomIn ${
                            pulseAnimation ? 'pulse-once' : ''
                          }`}
                          style={{animationDelay: `${index * 0.2}s`}}
                        >
                          <div className="treasure-icon-reveal">
                            {treasure.image}
                          </div>
                          <div className="treasure-name-reveal">
                            {treasure.name}
                          </div>
                          <div className="treasure-multiplier">
                            ×{treasure.multiplier}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-treasure-found animated-fadeIn">
                        <div className="empty-chest">📭</div>
                        <p>No treasures found this time...</p>
                      </div>
                    )}
                    
                    {/* Shimmer effect during reveal */}
                    {revealedTreasures.length < (lastHunt?.treasures_found?.length || 0) && (
                      <div className="reveal-shimmer">
                        <div className="shimmer-dot"></div>
                        <div className="shimmer-dot"></div>
                        <div className="shimmer-dot"></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================= WIN MODAL ================= */}
      {showWinModal && lastHunt && (
        <div className="modal-overlay win-modal-overlay animated-fadeIn">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="confetti"></div>
              <div className="confetti"></div>
              <div className="confetti"></div>
              
              {/* Win Tier Badge */}
              {lastHunt.win_tier && lastHunt.win_tier !== "loss" && (
                <div 
                  className="win-tier-badge"
                  style={{backgroundColor: getWinTierColor(lastHunt.win_tier)}}
                >
                  {getWinTierName(lastHunt.win_tier)}
                </div>
              )}
              
              <div className="win-icon">🏆</div>
              <h2>Congratulations!</h2>
              <p className="win-subtitle">You found treasure!</p>
            </div>
            
            
            <div className="win-amount-display animated-pulse-glow">
              <span className="win-amount-label">You won</span>
              <span className="win-amount">
                {formatNaira(lastHunt.win_amount)}
              </span>
            </div>
            
            <div className="win-treasures-summary">
              <h4>Treasures Found ({lastHunt.treasures_found?.length || 0}):</h4>
              <div className="mini-treasures">
                {lastHunt.treasures_found?.map((t, i) => (
                  <div key={i} className="mini-treasure">
                    <span>{t.image}</span>
                    <small>{t.name}</small>
                    <small className="treasure-mult-value">×{t.multiplier}</small>
                  </div>
                ))}
              </div>
            </div>
            
            <button
              className="continue-button animated-pulse"
              onClick={handleContinue}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="loading-spinner-small" />
                  Refreshing...
                </>
              ) : (
                "🎮 Continue Adventure"
              )}
            </button>
            
          </div>
        </div>
      )}

      {/* ================= LOSS MODAL ================= */}
      {showLossModal && (
        <div className="modal-overlay loss-modal-overlay animated-fadeIn">
          <div className="loss-modal-content animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon">💔</div>
              <h2>Oops! Hard Luck</h2>
              <p className="loss-subtitle">No treasures found this time</p>
            </div>
            
            <div className="loss-message animated-fadeIn">
              <div className="empty-chest-large">📭</div>
              <p className="loss-encouragement">
                Don't worry! You still have a chance next time!
                <br />
                <span className="loss-tip">Tip: Your luck resets on each expedition!</span>
              </p>
            </div>
            
            <button
              className="try-again-button animated-pulse"
              onClick={handleTryAgain}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="loading-spinner-small" />
                  Refreshing...
                </>
              ) : (
                "🔁 Try Again"
              )}
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasureHuntGame;