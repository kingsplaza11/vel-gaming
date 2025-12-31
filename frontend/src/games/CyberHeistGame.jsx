import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { heistService } from '../services/api';
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
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [revealedHacks, setRevealedHacks] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  const animationTimers = useRef([]);
  const isMounted = useRef(true);

  const banks = [
    { name: "Quantum Bank", security: 3, image: "🔒", difficulty: "easy", color: "#10B981", multiplier: "1.5x" },
    { name: "Neo Financial", security: 5, image: "💳", difficulty: "medium", color: "#3B82F6", multiplier: "1.8x" },
    { name: "Cyber Trust", security: 7, image: "🖥️", difficulty: "hard", color: "#8B5CF6", multiplier: "2.2x" },
    { name: "Digital Vault", security: 9, image: "🏦", difficulty: "expert", color: "#EF4444", multiplier: "3.0x" },
  ];

  // Get balance values
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);
  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  // Cleanup
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      animationTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Deep refresh function
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      setResult(null);
      setRevealedHacks([]);
      setShowWinModal(false);
      setShowLossModal(false);
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
  const revealHacksProgressively = (hacks) => {
    setRevealedHacks([]);
    
    if (!hacks || hacks.length === 0) {
      setTimeout(() => {
        setShowLossModal(true);
      }, 1500);
      return;
    }
    
    hacks.forEach((hack, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedHacks(prev => [...prev, hack]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          if (index === hacks.length - 1) {
            setTimeout(() => {
              if (isMounted.current) {
                const hasWon = result?.escape_success;
                if (hasWon) {
                  setShowWinModal(true);
                } else {
                  setShowLossModal(true);
                }
              }
            }, 1000);
          }
        }
      }, (index + 1) * 800);
    });
  };

  // Heist animation sequence
  const startHeistAnimation = () => {
    animationTimers.current = [];
    setPhase('scanning');
    animationTimers.current.push(setTimeout(() => setPhase('infiltrating'), 1800));
    animationTimers.current.push(setTimeout(() => setPhase('hacking'), 3600));
    animationTimers.current.push(setTimeout(() => setPhase('escaping'), 5400));
    animationTimers.current.push(setTimeout(() => setPhase('result'), 7200));
  };

  // Start heist
  const startHeist = async () => {
    if (heisting || refreshing) return;

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
    setShowWinModal(false);
    setShowLossModal(false);
    
    startHeistAnimation();

    try {
      const res = await heistService.startHeist({
        bet_amount: betAmount,
        target_bank: targetBank,
      });

      const data = res.data;
      setResult(data);

      // Start progressive hack reveal
      setTimeout(() => {
        revealHacksProgressively(data.hacks_used || []);
      }, 7500);

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (err) {
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
    setShowWinModal(false);
    await deepRefresh();
  };

  const handleTryAgain = async () => {
    setShowLossModal(false);
    await deepRefresh();
  };

  const getWinTierColor = (tier) => {
    switch(tier) {
      case 'small': return '#10B981';
      case 'medium': return '#3B82F6';
      case 'large': return '#8B5CF6';
      case 'epic': return '#F59E0B';
      case 'legendary': return '#EF4444';
      case 'ultimate': return '#EC4899';
      default: return '#6B7280';
    }
  };

  const getWinTierName = (tier) => {
    switch(tier) {
      case 'small': return 'Small Heist';
      case 'medium': return 'Medium Heist';
      case 'large': return 'Large Heist';
      case 'epic': return 'Epic Heist';
      case 'legendary': return 'Legendary Heist';
      case 'ultimate': return 'Ultimate Heist';
      default: return 'Failed';
    }
  };

  return (
    <div className="cyber-heist-game">
      {/* Ambient animation */}
      <div className="ambient-animation"></div>
      
      {/* HEADER */}
      <div className="cyber-header">
        <button 
          onClick={() => navigate("/")} 
          className="cyber-back-btn"
          disabled={refreshing}
        >
          ← Back to Mainframe
        </button>
        
        <div className="cyber-title">
          <span className="cyber-title-icon">🕶️</span>
          <h1>CYBER HEIST</h1>
          <p>Hack the system, claim your prize</p>
        </div>
        
        <div className="cyber-balance-display">
          {walletLoading || refreshing ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              {refreshing ? "Refreshing..." : "Loading..."}
            </div>
          ) : (
            <div className="cyber-balance-details">
              <div className="balance-total">
                {formatNaira(combinedBalance)}
              </div>
              <div className="balance-breakdown">
                <span className="balance-main">Main: {formatNaira(wallet?.balance || 0)}</span>
                <span className="balance-spot">Spot: {formatNaira(spotBalance)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAKE + TARGET MODAL */}
      {showModal && (
        <div className="cyber-modal-overlay animated-fadeIn">
          <div className="cyber-modal-card animated-slideUp">
            <div className="cyber-modal-header" style={{background: banks.find(b => b.name === targetBank)?.color}}>
              <h3>PLAN YOUR HEIST</h3>
              <p>Select target and prepare infiltration</p>
            </div>

            <div className="modal-section">
              <label className="cyber-label">TARGET BANK</label>
              <div className="cyber-bank-grid">
                {banks.map((bank) => (
                  <div
                    key={bank.name}
                    className={`cyber-bank-card animated-bounceIn ${targetBank === bank.name ? 'active pulse' : ''}`}
                    style={{animationDelay: `${banks.indexOf(bank) * 0.1}s`}}
                    onClick={() => !walletLoading && !refreshing && setTargetBank(bank.name)}
                  >
                    <div className="bank-card-header">
                      <span className="bank-icon">{bank.image}</span>
                      <div>
                        <strong>{bank.name}</strong>
                        <div className="bank-details">
                          <span className="bank-difficulty" data-difficulty={bank.difficulty}>
                            {bank.difficulty}
                          </span>
                          <span>Sec: {bank.security}/10</span>
                          <span className="bank-multiplier">{bank.multiplier}</span>
                        </div>
                      </div>
                    </div>
                    <div className="bank-card-glow" style={{background: bank.color}}></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label className="cyber-label">STAKE AMOUNT (₦)</label>
              <div className="cyber-stake-input-wrapper animated-pulse">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  value={betAmount}
                  min={MIN_STAKE}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  disabled={walletLoading || refreshing}
                  placeholder={`Minimum ₦${MIN_STAKE}`}
                />
                <div className="input-glow"></div>
              </div>
              
              {/* Quick bet options */}
              <div className="cyber-quick-bet-row">
                {[1000, 5000, 10000, 25000, 50000].map((amount) => (
                  <button
                    key={amount}
                    className={`cyber-quick-bet-btn ${betAmount === amount ? 'active' : ''}`}
                    onClick={() => !refreshing && setBetAmount(amount)}
                    disabled={walletLoading || refreshing}
                    type="button"
                  >
                    ₦{amount.toLocaleString()}
                  </button>
                ))}
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
        <div className="cyber-terminal">
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
                  {result?.escape_success ? '💸 MISSION COMPLETE' : '🚨 ALERT: TRACE DETECTED'}
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
                        {(hack.success_rate * 100).toFixed(0)}% success
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

      {/* WIN MODAL */}
      {showWinModal && result && (
        <div className="cyber-modal-overlay win-modal-overlay animated-fadeIn">
          <div className="cyber-win-modal animated-slideUp">
            <div className="win-modal-header">
              <div className="cyber-confetti"></div>
              <div className="cyber-confetti"></div>
              <div className="cyber-confetti"></div>
              <div className="win-icon">💰</div>
              <h2 style={{color: getWinTierColor(result.win_tier)}}>
                {getWinTierName(result.win_tier).toUpperCase()}
              </h2>
              <p className="win-subtitle">Successful infiltration</p>
            </div>
            
            <div className="win-amount-display animated-pulse-glow">
              <span className="win-amount-label">You hacked</span>
              <span className="win-amount">
                {formatNaira(result.win_amount)}
              </span>
              <p className="win-note">Added to your Spot Balance</p>
              <div className="win-multiplier">
                Multiplier: {result.win_ratio?.toFixed(2)}x
              </div>
            </div>
            
            <div className="heist-bonus-summary">
              <h4>Heist Analysis:</h4>
              <div className="bonus-grid">
                <div className="bonus-item">
                  <span>Successful Hacks:</span>
                  <span>{result.successful_hacks || 0}/3</span>
                </div>
                <div className="bonus-item">
                  <span>Hack Bonus:</span>
                  <span>+{(result.hack_bonus * 100).toFixed(1)}%</span>
                </div>
                <div className="bonus-item">
                  <span>Target Security:</span>
                  <span>{result.target_bank?.security}/10</span>
                </div>
              </div>
            </div>
            
            <button
              className="cyber-continue-btn animated-pulse"
              onClick={handleContinue}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="loading-spinner-small" />
                  Refreshing...
                </>
              ) : (
                "🔄 RUN NEXT HEIST"
              )}
            </button>
          </div>
        </div>
      )}

      {/* LOSS MODAL */}
      {showLossModal && (
        <div className="cyber-modal-overlay loss-modal-overlay animated-fadeIn">
          <div className="cyber-loss-modal animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon">💥</div>
              <h2>HEIST FAILED</h2>
              <p className="loss-subtitle">Trace detected by security</p>
            </div>
            
            <div className="loss-message animated-fadeIn">
              <div className="security-alert">🚨</div>
              <p className="loss-encouragement">
                The firewall detected your intrusion!
                <br />
                <span className="loss-tip">Tip: Try different hacks or lower security targets!</span>
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake Lost:</span>
                <span>{formatNaira(betAmount)}</span>
              </div>
              <div className="stat-item">
                <span>Target:</span>
                <span>{targetBank}</span>
              </div>
            </div>
            
            <button
              className="cyber-try-again-btn animated-pulse"
              onClick={handleTryAgain}
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
          </div>
        </div>
      )}
    </div>
  );
};

export default CyberHeistGame;