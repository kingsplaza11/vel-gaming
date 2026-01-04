import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { pyramidService } from "../services/api";
import "./PyramidAdventureGame.css";

const MIN_STAKE = 100;

const PyramidAdventureGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  // Get combined balance (wallet + spot_balance)
  const getCombinedBalance = useCallback(() => {
    if (!wallet) return user?.balance || 0;
    const balance = wallet.balance || 0;
    const spot_balance = wallet.spot_balance || 0;
    return balance + spot_balance;
  }, [wallet, user]);

  // Get spot balance only
  const getSpotBalance = useCallback(() => {
    if (!wallet) return 0;
    return wallet.spot_balance || 0;
  }, [wallet]);

  /** ---------- STATE ---------- */
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [exploring, setExploring] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(true);
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [revealedChambers, setRevealedChambers] = useState([]);
  const [revealedArtifacts, setRevealedArtifacts] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  const animationTimers = useRef([]);
  const isMounted = useRef(true);

  /** ---------- BALANCE ---------- */
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  /** ---------- CLEANUP ---------- */
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      animationTimers.current.forEach(clearTimeout);
    };
  }, []);

  /** ---------- DEEP REFRESH ---------- */
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      setLastRun(null);
      setRevealedChambers([]);
      setRevealedArtifacts([]);
      setShowResultModal(false);
      setError("");
      
      if (refreshWallet) {
        await refreshWallet();
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      console.error("Deep refresh error:", error);
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
        setShowStakeModal(true);
        setPhase("idle");
        setExploring(false);
      }
    }
  }, [refreshWallet]);

  /** ---------- PROGRESSIVE REVEAL ---------- */
  const revealChambersProgressively = (chambers) => {
    setRevealedChambers([]);
    
    if (!chambers || chambers.length === 0) {
      setTimeout(() => {
        setShowResultModal(true);
      }, 1500);
      return;
    }
    
    chambers.forEach((chamber, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedChambers(prev => [...prev, chamber]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          if (index === chambers.length - 1) {
            // After all chambers revealed, reveal artifacts if any
            if (lastRun?.artifacts_found?.length > 0) {
              setTimeout(() => {
                revealArtifactsProgressively(lastRun.artifacts_found);
              }, 1000);
            } else {
              setTimeout(() => {
                setShowResultModal(true);
              }, 1000);
            }
          }
        }
      }, (index + 1) * 1000);
    });
  };

  const revealArtifactsProgressively = (artifacts) => {
    setRevealedArtifacts([]);
    
    artifacts.forEach((artifact, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedArtifacts(prev => [...prev, artifact]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          if (index === artifacts.length - 1) {
            setTimeout(() => {
              setShowResultModal(true);
            }, 1000);
          }
        }
      }, (index + 1) * 800);
    });
  };

  /** ---------- ANIMATIONS ---------- */
  const startExplorationAnimation = () => {
    animationTimers.current = [];
    setPhase("entering");
    animationTimers.current.push(setTimeout(() => setPhase("exploring"), 2000));
    animationTimers.current.push(setTimeout(() => setPhase("chambers"), 4000));
    animationTimers.current.push(setTimeout(() => setPhase("treasure"), 6000));
    animationTimers.current.push(setTimeout(() => setPhase("result"), 8000));
  };

  /** ---------- START EXPEDITION ---------- */
  const startAdventure = async () => {
    if (exploring || refreshing) return;

    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    if (betAmount < MIN_STAKE) {
      setError(`Minimum stake is ₦${MIN_STAKE}`);
      return;
    }

    if (betAmount > combinedBalance) {
      setError("Insufficient wallet balance");
      return;
    }

    setError("");
    setExploring(true);
    setShowStakeModal(false);
    setShowResultModal(false);
    setRevealedChambers([]);
    setRevealedArtifacts([]);
    startExplorationAnimation();

    try {
      const res = await pyramidService.explorePyramid({
        bet_amount: betAmount,
      });

      const data = res.data;
      setLastRun(data);

      // Start progressive reveal
      setTimeout(() => {
        revealChambersProgressively(data.chambers_explored || []);
      }, 8500);

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (e) {
      setError(e.response?.data?.error || "Expedition failed");
      setShowStakeModal(true);
      setPhase("idle");
    } finally {
      setTimeout(() => {
        if (isMounted.current) {
          setExploring(false);
        }
      }, 9000);
    }
  };

  /** ---------- MODAL HANDLERS ---------- */
  const handleContinue = async () => {
    setShowResultModal(false);
    await deepRefresh();
  };

  /** ---------- RENDER ---------- */
  return (
    <div className="pyramid-game">
      {/* Background ambient animation */}
      <div className="ambient-animation"></div>
      
      {/* ===== HEADER ===== */}
      <div className="top-bar animated-slideUp">
        <button 
          className="back-button" 
          onClick={() => navigate("/")}
          disabled={refreshing}
        >
          ← Back
        </button>
      </div>

      {/* ===== STAKE MODAL ===== */}
      {showStakeModal && (
        <div className="pyramid-modal-overlay animated-fadeIn">
          <div className="pyramid-modal-card animated-slideUp">
            <div className="modal-header-glow" style={{background: 'linear-gradient(90deg, #D2691E, #8B4513)'}}>
              <h3>Prepare Expedition</h3>
            </div>

            <div className="pyramid-modal-info">
              <div className="risk-level animated-pulse">
                <span>Risk Level:</span>
                <strong className="risk-extreme">EXTREME</strong>
              </div>
              <div className="modal-tip">
                <small>Ancient curses await... choose your stake wisely!</small>
              </div>
            </div>

            <div className="stake-input-container">
              <label>Stake Amount (₦)</label>
              <div className="stake-input-wrapper animated-pulse">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  min={MIN_STAKE}
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={walletLoading || refreshing}
                />
                <div className="input-glow"></div>
              </div>
            </div>

            {error && <div className="error-banner animated-shake">{error}</div>}

            <button
              className="explore-button animated-pulse-glow"
              onClick={startAdventure}
              disabled={walletLoading || refreshing || betAmount > combinedBalance || betAmount < MIN_STAKE}
            >
              {refreshing ? "REFRESHING..." : walletLoading ? "LOADING..." : "🚀 ENTER PYRAMID"}
            </button>
          </div>
        </div>
      )}

      {/* ===== GAME SCREEN ===== */}
      {!showStakeModal && (
        <div className="pyramid-display">
          <div className={`pyramid-stage pyramid-stage--${phase}`}>
            
            {phase === "entering" && (
              <div className="exploration-animation animated-fadeIn">
                <div className="sand-storm">
                  <div className="sand-particle"></div>
                  <div className="sand-particle"></div>
                  <div className="sand-particle"></div>
                </div>
                <div className="pyramid-entrance">
                  <div className="pyramid-icon">🏜️</div>
                  <div className="explorer-icon animated-bounce">🧭</div>
                </div>
                <p className="animated-wave">Approaching ancient pyramid...</p>
              </div>
            )}

            {phase === "exploring" && (
              <div className="exploration-animation animated-fadeIn">
                <div className="torch-animation">
                  <div className="torch-flame"></div>
                  <div className="torch-flame"></div>
                  <div className="torch-flame"></div>
                </div>
                <div className="explorer-moving">
                  <div className="explorer">🧭</div>
                  <div className="footprints">👣👣👣</div>
                </div>
                <p className="animated-pulse">Venturing into dark corridors...</p>
              </div>
            )}

            {phase === "chambers" && (
              <div className="chambers-reveal-container">
                <div className="overlay-title animated-fadeIn">
                  🚪 Chambers Discovered
                </div>
                
                <div className="chambers-grid-reveal">
                  {revealedChambers.map((chamber, index) => (
                    <div 
                      key={index} 
                      className={`chamber-card-reveal animated-zoomIn ${
                        pulseAnimation ? 'pulse-once' : ''
                      }`}
                      style={{
                        animationDelay: `${index * 0.3}s`,
                        borderColor: chamber.color
                      }}
                    >
                      <div className="chamber-icon-reveal">
                        {chamber.image}
                      </div>
                      <div className="chamber-name-reveal">
                        {chamber.name}
                      </div>
                      <div className="chamber-stats">
                        <div className="chamber-danger" title="Danger Level">
                          ⚠️ {Math.round(chamber.danger * 100)}%
                        </div>
                        <div className="chamber-treasure" title="Treasure Chance">
                          💰 {Math.round(chamber.treasure_chance * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {revealedChambers.length < (lastRun?.chambers_count || 0) && (
                    <div className="reveal-shimmer">
                      <div className="shimmer-dot"></div>
                      <div className="shimmer-dot"></div>
                      <div className="shimmer-dot"></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "treasure" && revealedArtifacts.length > 0 && (
              <div className="artifacts-reveal-container">
                <div className="overlay-title animated-fadeIn">
                  💎 Artifacts Found
                </div>
                
                <div className="artifacts-grid-reveal">
                  {revealedArtifacts.map((artifact, index) => (
                    <div 
                      key={index} 
                      className={`artifact-card-reveal animated-zoomIn ${
                        pulseAnimation ? 'pulse-once' : ''
                      }`}
                      style={{animationDelay: `${index * 0.2}s`}}
                    >
                      <div className="artifact-icon-reveal">
                        {artifact.image}
                      </div>
                      <div className="artifact-name-reveal">
                        {artifact.name}
                      </div>
                      <div className="artifact-rarity" data-rarity={artifact.rarity}>
                        {artifact.rarity}
                      </div>
                      <div className="artifact-value">
                        {artifact.value}x
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === "result" && (
              <div className="expedition-summary animated-fadeIn">
                <div className="summary-header">
                  <h3>Expedition Complete!</h3>
                  {lastRun?.expedition_rank && (
                    <div className={`expedition-rank rank-${lastRun.expedition_rank}`}>
                      {lastRun.expedition_rank.toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="expedition-stats">
                  <div className="stat-row">
                    <span>Chambers Explored:</span>
                    <span>{lastRun?.chambers_count || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span>Traps Triggered:</span>
                    <span>{lastRun?.traps_encountered || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span>Artifacts Found:</span>
                    <span>{lastRun?.artifact_count || 0}</span>
                  </div>
                  <div className="stat-row">
                    <span>Survival Rate:</span>
                    <span>{lastRun?.survival_rate ? `${lastRun.survival_rate.toFixed(1)}%` : '0%'}</span>
                  </div>
                </div>
                
                <div className="expedition-multiplier">
                  <div className="multiplier-label">Final Multiplier</div>
                  <div className="multiplier-value">
                    {lastRun?.final_multiplier ? `${lastRun.final_multiplier.toFixed(2)}x` : '0x'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== RESULT MODAL ===== */}
      {showResultModal && lastRun && (
        <div className={`modal-overlay result-modal-overlay animated-fadeIn`}>
          <div className={`result-modal-content animated-slideUp ${lastRun.win_tier}`}>
            <div className="result-modal-header">
              {lastRun.win_amount > 0 ? (
                <>
                  <div className="confetti"></div>
                  <div className="confetti"></div>
                  <div className="confetti"></div>
                  <div className="result-icon">🏆</div>
                  <h2>Expedition Successful!</h2>
                  <p className="result-subtitle">{lastRun.expedition_rank?.toUpperCase() || 'COMPLETED'}</p>
                </>
              ) : (
                <>
                  <div className="result-icon">💀</div>
                  <h2>Pharaoh's Curse!</h2>
                  <p className="result-subtitle">Expedition Failed</p>
                </>
              )}
            </div>
            
            <div className="result-amount-display animated-pulse-glow">
              {lastRun.win_amount > 0 ? (
                <>
                  <span className="result-amount-label">You Discovered</span>
                  <span className="result-amount">
                    {formatNaira(lastRun.win_amount)}
                  </span>
                </>
              ) : (
                <>
                  <span className="result-amount-label">Expedition Cost</span>
                  <span className="result-amount loss">
                    {formatNaira(betAmount)}
                  </span>
                  <p className="result-note">Lost to the ancient curse</p>
                </>
              )}
            </div>
            
            {lastRun.win_amount > 0 && (
              <div className="expedition-details">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span>Chambers:</span>
                    <span>{lastRun.chambers_count || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span>Artifacts:</span>
                    <span>{lastRun.artifact_count || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span>Legendary:</span>
                    <span>{lastRun.legendary_count || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span>Traps:</span>
                    <span>{lastRun.traps_encountered || 0}</span>
                  </div>
                </div>
                
                <div className="bonus-summary">
                  <div className="bonus-item">
                    <span>Survival Rate:</span>
                    <span>{lastRun.survival_rate ? `${lastRun.survival_rate.toFixed(1)}%` : '0%'}</span>
                  </div>
                </div>
              </div>
            )}
            
            <button
              className="continue-expedition-button animated-pulse"
              onClick={handleContinue}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="loading-spinner-small" />
                  Refreshing...
                </>
              ) : lastRun.win_amount > 0 ? (
                "🏜️ Continue Exploring"
              ) : (
                "⚰️ Try Again"
              )}
            </button>
            
            <p className="result-footer-note">
              {lastRun.win_amount > 0 
                ? "The desert holds more secrets..."
                : "The pyramid's curses are legendary..."
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PyramidAdventureGame;