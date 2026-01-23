import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { heistService } from '../services/api';
import { cyberSound } from '../utils/CyberSoundManager';
import './CyberHeistGame.css';

const MIN_STAKE = 100;

const CyberHeistGame = ({ user }) => {
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

  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [targetBank, setTargetBank] = useState("Quantum Bank");
  const [phase, setPhase] = useState('idle');
  const [heisting, setHeisting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [revealedHacks, setRevealedHacks] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [isMuted, setIsMuted] = useState(cyberSound.isMuted);
  const [isBgMuted, setIsBgMuted] = useState(cyberSound.backgroundMusicMuted);

  const animationTimers = useRef([]);
  const scanningInterval = useRef(null);
  const dataStreamInterval = useRef(null);
  const isMounted = useRef(true);

  const banks = [
    { name: "Quantum Bank", security: 3, image: "🔒", difficulty: "easy", color: "#10B981" },
    { name: "Neo Financial", security: 5, image: "💳", difficulty: "medium", color: "#3B82F6" },
    { name: "Cyber Trust", security: 7, image: "🖥️", difficulty: "hard", color: "#8B5CF6" },
    { name: "Digital Vault", security: 9, image: "🏦", difficulty: "expert", color: "#EF4444" },
  ];

  // Get balance values
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);
  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  /** ---------- SOUND EFFECTS ---------- */
  useEffect(() => {
    // Start background music automatically
    if (!cyberSound.backgroundMusicMuted) {
      cyberSound.playBackgroundMusic();
    }

    return () => {
      cyberSound.cleanup();
      if (scanningInterval.current) clearInterval(scanningInterval.current);
      if (dataStreamInterval.current) clearInterval(dataStreamInterval.current);
    };
  }, []);

  // Play sounds based on phase changes
  useEffect(() => {
    if (!cyberSound.isMuted) {
      switch(phase) {
        case 'scanning':
          cyberSound.playScanningSound();
          scanningInterval.current = setInterval(() => {
            cyberSound.playScanningSound();
          }, 1200);
          break;
        case 'infiltrating':
          cyberSound.playInfiltrationSound();
          dataStreamInterval.current = setInterval(() => {
            cyberSound.playDataStreamSound();
          }, 300);
          break;
        case 'hacking':
          cyberSound.playHackingSound();
          break;
        case 'escaping':
          cyberSound.playEscapeSound();
          break;
        case 'result':
          // Clear intervals
          if (scanningInterval.current) {
            clearInterval(scanningInterval.current);
            scanningInterval.current = null;
          }
          if (dataStreamInterval.current) {
            clearInterval(dataStreamInterval.current);
            dataStreamInterval.current = null;
          }
          break;
      }
    } else {
      // Clear intervals when muted
      if (scanningInterval.current) {
        clearInterval(scanningInterval.current);
        scanningInterval.current = null;
      }
      if (dataStreamInterval.current) {
        clearInterval(dataStreamInterval.current);
        dataStreamInterval.current = null;
      }
    }
  }, [phase]);

  // Play hack reveal sounds
  useEffect(() => {
    if (revealedHacks.length > 0 && !cyberSound.isMuted) {
      cyberSound.playHackRevealSound();
    }
  }, [revealedHacks]);

  // Play win/loss sounds
  useEffect(() => {
    if (result && !cyberSound.isMuted) {
      if (result.win_amount > 0) {
        cyberSound.playSuccessSound(result.win_tier);
        cyberSound.playCoinSound();
      } else {
        cyberSound.playFailureSound();
        cyberSound.playAlarmSound();
      }
    }
  }, [result]);

  /** ---------- TOGGLE MUTE ---------- */
  const toggleMute = () => {
    const { bgMuted, gameMuted } = cyberSound.toggleMute();
    setIsMuted(gameMuted);
    setIsBgMuted(bgMuted);
    cyberSound.playButtonClick();
  };

  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      animationTimers.current.forEach(clearTimeout);
      cyberSound.cleanup();
    };
  }, []);

  // Deep refresh function
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      setResult(null);
      setRevealedHacks([]);
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
        setShowModal(true);
        setPhase('idle');
        setHeisting(false);
      }
    }
  }, [refreshWallet]);

  // Hack reveal animation
  const revealHacksProgressively = useCallback((hacks, resultData) => {
    if (!isMounted.current) return;
    
    setRevealedHacks([]);
    
    hacks.forEach((hack, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedHacks(prev => [...prev, hack]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          if (index === hacks.length - 1) {
            setTimeout(() => {
              if (isMounted.current && resultData) {
                setShowResultModal(true);
              }
            }, 1000);
          }
        }
      }, (index + 1) * 800);
    });
  }, []);

  // Heist animation sequence
  const startHeistAnimation = () => {
    animationTimers.current = [];
    setPhase('scanning');
    animationTimers.current.push(setTimeout(() => setPhase('infiltrating'), 1800));
    animationTimers.current.push(setTimeout(() => setPhase('hacking'), 3600));
    animationTimers.current.push(setTimeout(() => setPhase('escaping'), 5400));
    animationTimers.current.push(setTimeout(() => setPhase('result'), 7200));
  };

  // Get win tier functions
  const getWinTierName = (tier) => {
    switch(tier) {
      case 'small': return 'Small Hack';
      case 'medium': return 'Good Hack';
      case 'large': return 'Great Hack';
      case 'epic': return 'Epic Hack';
      default: return 'Failed Hack';
    }
  };

  const getWinTierColor = (tier) => {
    switch(tier) {
      case 'small': return '#10B981';
      case 'medium': return '#3B82F6';
      case 'large': return '#8B5CF6';
      case 'epic': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getResultEmoji = (tier) => {
    switch(tier) {
      case 'small': return '🎯';
      case 'medium': return '💸';
      case 'large': return '🏆';
      case 'epic': return '👑';
      default: return '💀';
    }
  };

  const getResultTitle = (tier) => {
    switch(tier) {
      case 'small': return 'Small Hack Success!';
      case 'medium': return 'Hack Successful!';
      case 'large': return 'Great Hack Success!';
      case 'epic': return 'Epic Hack Success!';
      default: return 'Hack Failed';
    }
  };

  // Start heist
  const startHeist = async () => {
    if (heisting || refreshing) return;

    // Play button click sound
    cyberSound.playButtonClick();

    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    if (betAmount < MIN_STAKE) {
      setError(`Minimum stake is ₦${MIN_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    if (betAmount > combinedBalance) {
      setError("Insufficient wallet balance");
      return;
    }

    setError("");
    setShowModal(false);
    setHeisting(true);
    setResult(null);
    setRevealedHacks([]);
    setShowResultModal(false);
    
    // Play start heist sound
    cyberSound.playStartHeistSound();
    
    startHeistAnimation();

    try {
      const res = await heistService.startHeist({
        bet_amount: betAmount,
        target_bank: targetBank,
      });

      const data = res.data;
      setResult(data);

      // Start progressive hack reveal AFTER animations complete
      setTimeout(() => {
        if (isMounted.current) {
          revealHacksProgressively(data.hacks_used || [], data);
        }
      }, 7500);

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (err) {
      console.error("Heist error:", err);
      setError(err.response?.data?.error || "Heist failed");
      setShowModal(true);
      animationTimers.current.forEach(clearTimeout);
      setPhase('idle');
    } finally {
      setTimeout(() => {
        if (isMounted.current) {
          setHeisting(false);
        }
      }, 8000);
    }
  };

  // Modal handlers
  const handleContinue = async () => {
    cyberSound.playButtonClick();
    setShowResultModal(false);
    await deepRefresh();
  };

  const handleReturnToGames = () => {
    cyberSound.playButtonClick();
    navigate("/");
  };

  const selectedBank = banks.find(b => b.name === targetBank);

  return (
    <div className="cyber-heist-game">
      {/* Floating Mute Button */}
      <button 
        className={`floating-mute-button ${isMuted ? 'muted' : ''}`}
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
      >
        {isMuted ? (
          <span className="mute-icon">🔇</span>
        ) : (
          <span className="speaker-icon">🔊</span>
        )}
      </button>

      {/* Ambient animation */}
      <div className="ambient-animation"></div>
      
      {/* HEADER */}
      <div className="cyber-header">
        <button 
          onClick={() => {
            cyberSound.playButtonClick();
            navigate("/games");
          }} 
          className="cyber-back-btn"
          disabled={refreshing}
        >
          ← Back to Games
        </button>
        
        <div className="cyber-title">
          <span className="cyber-title-icon">🕶️</span>
          <div className="cyber-title-text">
            <h1>CYBER HEIST</h1>
          </div>
        </div>
      </div>

      {/* STAKE + TARGET MODAL */}
      {showModal && (
        <div className="cyber-modal-overlay animated-fadeIn">
          <div className="cyber-modal-card animated-slideUp">

            <div className="modal-section">
              <label className="cyber-label">TARGET BANK</label>
              <div className="cyber-bank-grid">
                {banks.map((bank) => (
                  <div
                    key={bank.name}
                    className={`cyber-bank-card animated-bounceIn ${targetBank === bank.name ? 'active pulse' : ''}`}
                    style={{animationDelay: `${banks.indexOf(bank) * 0.1}s`}}
                    onClick={() => {
                      if (!walletLoading && !refreshing) {
                        cyberSound.playButtonClick();
                        setTargetBank(bank.name);
                      }
                    }}
                  >
                    <div className="bank-card-header">
                      <span className="bank-icon">{bank.image}</span>
                      <div className="bank-info">
                        <strong>{bank.name}</strong>
                        <div className="bank-details">
                          <span className="bank-difficulty" data-difficulty={bank.difficulty}>
                            {bank.difficulty}
                          </span>
                          <span className="bank-security">Security: {bank.security}/10</span>
                        </div>
                      </div>
                    </div>
                    <div className="bank-card-glow" style={{background: bank.color}}></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label className="cyber-label">STAKE AMOUNT</label>
              <div className="cyber-stake-input-wrapper animated-pulse">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  value={betAmount}
                  min={MIN_STAKE}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    setBetAmount(value);
                    if (value >= MIN_STAKE) {
                      cyberSound.playStakeSound();
                    }
                  }}
                  disabled={walletLoading || refreshing}
                  placeholder={`Minimum ₦${MIN_STAKE}`}
                />
                <div className="input-glow"></div>
              </div>
              
              <div className="balance-info">
                <span>Available Balance:</span>
                <span>{formatNaira(combinedBalance)}</span>
              </div>
            </div>
            
            {error && <div className="cyber-error-banner animated-shake">{error}</div>}

            <button 
              className="cyber-start-btn animated-pulse-glow"
              onClick={startHeist}
              disabled={walletLoading || refreshing || betAmount > combinedBalance || betAmount < MIN_STAKE}
            >
              {refreshing ? "REFRESHING..." : walletLoading ? "LOADING..." : "🚀 INITIATE HEIST"}
            </button>
          </div>
        </div>
      )}

      {/* GAME DISPLAY */}
      {!showModal && (
        <div className="">
          <div className={`cyber-terminal-screen cyber-screen--${phase}`}>
            
            {phase === 'scanning' && (
              <div className="terminal-animation">
                <div className="scan-lines"></div>
                <p className="animated-wave">🛰️ Scanning network defenses...</p>
                <div className="scanning-animation">
                  <div className="scan-bar"></div>
                </div>
              </div>
            )}

            {phase === 'infiltrating' && (
              <div className="terminal-animation">
                <div className="code-rain">
                  <div className="code-drop">10101010</div>
                  <div className="code-drop">01010101</div>
                  <div className="code-drop">11001100</div>
                </div>
                <p className="animated-pulse">👥 Infiltrating target system...</p>
              </div>
            )}

            {phase === 'hacking' && (
              <div className="terminal-animation">
                <div className="hack-grid">
                  <div className="hack-node"></div>
                  <div className="hack-node"></div>
                  <div className="hack-node"></div>
                </div>
                <p className="animated-bounce">💻 Executing hacks...</p>
              </div>
            )}

            {phase === 'escaping' && (
              <div className="terminal-animation">
                <div className="escape-animation">
                  <div className="data-stream"></div>
                  <div className="data-stream"></div>
                  <div className="data-stream"></div>
                </div>
                <p className="animated-shake">🏃 Covering tracks...</p>
              </div>
            )}

            {phase === 'result' && (
              <div className="heist-reveal-container">
                <div className="overlay-title animated-fadeIn">
                  {result?.win_amount > 0 ? '💸 MISSION COMPLETE' : '💀 HACK FAILED'}
                </div>
                
                <div className="hacks-grid-reveal">
                  {revealedHacks.map((hack, index) => (
                    <div 
                      key={index} 
                      className={`hack-card-reveal animated-zoomIn ${
                        pulseAnimation ? 'pulse-once' : ''
                      }`}
                      style={{animationDelay: `${index * 0.2}s`}}
                    >
                      <div className="hack-icon-reveal">
                        {hack.image}
                      </div>
                      <div className="hack-name-reveal">
                        {hack.name}
                      </div>
                      <div className="hack-success-rate">
                        Success: {Math.round((hack.success_rate || 0.5) * 100)}%
                      </div>
                    </div>
                  ))}
                  
                  {revealedHacks.length < (result?.hacks_used?.length || 0) && (
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
      )}

      {/* RESULT MODAL */}
      {showResultModal && result && (
        <div className="cyber-modal-overlay result-modal-overlay animated-fadeIn">
          <div className="cyber-result-modal animated-slideUp">
            <div className="result-modal-header">
              {/* Confetti for wins */}
              {result.win_amount > 0 && (
                <>
                  <div className="cyber-confetti"></div>
                  <div className="cyber-confetti"></div>
                  <div className="cyber-confetti"></div>
                </>
              )}
              
              {/* Result Badge */}
              {result.win_tier && (
                <div 
                  className="result-tier-badge"
                  style={{backgroundColor: getWinTierColor(result.win_tier)}}
                >
                  {getResultEmoji(result.win_tier)} {getWinTierName(result.win_tier)}
                </div>
              )}
              
              <h2>{getResultTitle(result.win_tier || "failed")}</h2>
              <p className="result-subtitle">
                {result.win_amount > 0 ? "You hacked the system!" : "Better luck next time!"}
              </p>
            </div>
            
            {/* Result Details */}
            <div className="result-details">
              <div className="financial-summary">
                <div className="financial-row">
                  <span>Stake:</span>
                  <span>{formatNaira(result.bet_amount)}</span>
                </div>
                
                <div className="financial-row">
                  <span>Payout:</span>
                  <span>{formatNaira(result.win_amount)}</span>
                </div>
                
                <div className="financial-row total" style={{ 
                  color: result.win_amount > 0 ? '#10B981' : '#EF4444'
                }}>
                </div>
              </div>
              
              {/* Hacks Used Summary */}
              {result.hacks_used && result.hacks_used.length > 0 && (
                <div className="hacks-summary">
                  <h4>Hacks Used ({result.hacks_used.length}):</h4>
                  <div className="hacks-grid-mini">
                    {result.hacks_used.map((hack, i) => (
                      <div key={i} className="hack-item-mini">
                        <span className="hack-icon-mini">{hack.image}</span>
                        <span className="hack-name-mini">{hack.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="result-actions">
              <button
                className="cyber-continue-btn primary"
                onClick={handleContinue}
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <span className="loading-spinner-small" />
                    Refreshing...
                  </>
                ) : (
                  "🔄 TRY AGAIN"
                )}
              </button>
              
              <button
                className="cyber-continue-btn secondary"
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

export default CyberHeistGame;