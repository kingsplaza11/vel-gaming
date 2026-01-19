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
  const [showResultModal, setShowResultModal] = useState(false);
  const [revealedTreasures, setRevealedTreasures] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  const animationTimers = useRef([]);
  const isMounted = useRef(true);

  /* ---------------- WALLET ---------------- */
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  const selectedMap = MAP_LEVELS.find((m) => m.level === mapLevel);
  const levelMultiplier = mapLevel * 1.5;
  const totalCost = betAmount * levelMultiplier;

  /* ---------------- DEEP REFRESH FUNCTION ---------------- */
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      // Reset all states
      setLastHunt(null);
      setRevealedTreasures([]);
      setShowResultModal(false);
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
      // No treasures found - show result after delay
      setTimeout(() => {
        setShowResultModal(true);
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
          
          // After all treasures are revealed, show result
          if (index === treasures.length - 1) {
            setTimeout(() => {
              if (isMounted.current) {
                setShowResultModal(true);
              }
            }, 1000);
          }
        }
      }, (index + 1) * 800);
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
  }, []);

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
    setShowResultModal(false);
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
      const hasWon = data.win_amount > 0;

      setLastHunt({
        ...data,
        hasWon: hasWon,
      });

      // Start progressive treasure reveal
      setTimeout(() => {
        revealTreasuresProgressively(data.treasures_found || []);
      }, 7000);

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
    setShowResultModal(false);
    await deepRefresh();
  };

  const handleReturnToGames = () => {
    navigate("/games");
  };

  /* ---------------- WIN TIER HELPERS (FOR BACKWARD COMPATIBILITY) ---------------- */
  const getWinTierName = (tier) => {
    switch(tier) {
      case "small": return "Small Catch";
      case "low": return "Good Catch";
      case "normal": return "Great Catch";
      case "high": return "Excellent Catch";
      case "great": return "Amazing Catch";
      default: return "No Catch";
    }
  };

  const getWinTierColor = (tier) => {
    switch(tier) {
      case "small": return "#FFC107";
      case "low": return "#4CAF50";
      case "normal": return "#2196F3";
      case "high": return "#FF9800";
      case "great": return "#F44336";
      default: return "#9E9E9E";
    }
  };

  const getResultEmoji = (tier) => {
    switch(tier) {
      case "small": return "🎣";
      case "low": return "💰";
      case "normal": return "🏆";
      case "high": return "👑";
      case "great": return "🐉";
      default: return "💔";
    }
  };

  const getResultTitle = (tier) => {
    switch(tier) {
      case "small": return "Small Treasure Found!";
      case "low": return "Treasure Found!";
      case "normal": return "Great Treasure Found!";
      case "high": return "Excellent Treasure Found!";
      case "great": return "Legendary Treasure Found!";
      default: return "No Treasure Found";
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
          onClick={() => navigate("/games")}
          disabled={refreshing}
        >
          ← Back to Games
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
              <label className="stake-label">Stake Amount</label>
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
              <div className="cost-item">
                <span>Your Balance</span>
                <span className="cost-value">
                  {formatNaira(combinedBalance)}
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
                    {lastHunt?.hasWon ? "🎉 Treasure Found!" : "💔 No Treasure"}
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

      {/* ================= RESULT MODAL ================= */}
      {showResultModal && lastHunt && (
        <div className="modal-overlay result-modal-overlay animated-fadeIn">
          <div className="result-modal-content animated-slideUp">
            <div className="result-modal-header">
              {/* Confetti for wins */}
              {lastHunt.hasWon && (
                <>
                  <div className="confetti"></div>
                  <div className="confetti"></div>
                  <div className="confetti"></div>
                </>
              )}
              
              {/* Result Badge */}
              {lastHunt.win_tier && (
                <div 
                  className="result-tier-badge"
                  style={{backgroundColor: getWinTierColor(lastHunt.win_tier)}}
                >
                  {getResultEmoji(lastHunt.win_tier)} {getWinTierName(lastHunt.win_tier)}
                </div>
              )}
              
              <h2>{getResultTitle(lastHunt.win_tier || "loss")}</h2>
              <p className="result-subtitle">
                {lastHunt.hasWon ? "You found treasure!" : "Better luck next time!"}
              </p>
            </div>
            
            {/* Result Details */}
            <div className="result-details">
              <div className="financial-summary">
                <div className="financial-row">
                  <span>Stake:</span>
                  <span>{formatNaira(lastHunt.bet_amount)}</span>
                </div>
                
                <div className="financial-row">
                  <span>Payout:</span>
                  <span>{formatNaira(lastHunt.win_amount)}</span>
                </div>
                
                <div className="financial-row total" style={{ 
                  color: lastHunt.win_amount > 0 ? '#4CAF50' : '#F44336'
                }}>
                  <span>Result:</span>
                  <span>
                    {lastHunt.win_amount > lastHunt.bet_amount 
                      ? `+${formatNaira(lastHunt.win_amount - lastHunt.bet_amount)}`
                      : `-${formatNaira(lastHunt.bet_amount - lastHunt.win_amount)}`}
                  </span>
                </div>
              </div>
              
              {/* Treasures Found Summary */}
              {lastHunt.hasWon && lastHunt.treasures_found && lastHunt.treasures_found.length > 0 && (
                <div className="treasures-summary">
                  <h4>Treasures Found ({lastHunt.treasures_found.length}):</h4>
                  <div className="treasures-grid-mini">
                    {lastHunt.treasures_found.map((t, i) => (
                      <div key={i} className="treasure-item-mini">
                        <span className="treasure-icon-mini">{t.image}</span>
                        <span className="treasure-name-mini">{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="result-actions">
              <button
                className="continue-button primary"
                onClick={handleContinue}
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <span className="loading-spinner-small" />
                    Refreshing...
                  </>
                ) : (
                  "🎮 Play Again"
                )}
              </button>
              
              <button
                className="continue-button secondary"
                onClick={handleReturnToGames}
                disabled={refreshing}
              >
                Back to Games
              </button>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasureHuntGame;