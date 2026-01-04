import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { potionService } from '../services/api';
import './PotionBrewingGame.css';

const MIN_STAKE = 100;

const POTIONS = [
  { value: 'healing', label: '❤️ Healing Potion', desc: 'Restores vitality', color: '#EF4444' },
  { value: 'mana', label: '🔮 Mana Potion', desc: 'Replenishes energy', color: '#3B82F6' },
  { value: 'strength', label: '💪 Strength Potion', desc: 'Boosts power', color: '#10B981' },
  { value: 'luck', label: '🍀 Luck Potion', desc: 'Twists fate', color: '#8B5CF6' },
];

const PotionBrewingGame = ({ user }) => {
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

  /** ---------- UI STATE ---------- */
  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [potionType, setPotionType] = useState('healing');
  const [phase, setPhase] = useState('idle');
  const [brewing, setBrewing] = useState(false);
  const [result, setResult] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [revealedIngredients, setRevealedIngredients] = useState([]);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);

  const timers = useRef([]);
  const isMounted = useRef(true);

  /** ---------- BALANCE ---------- */
  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString("en-NG")}`;

  /** ---------- FETCH GAME INFO ---------- */
  const fetchGameInfo = useCallback(async () => {
    try {
      const res = await potionService.getGameInfo();
      setGameInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch game info:", err);
    }
  }, []);

  /** ---------- CLEANUP ---------- */
  useEffect(() => {
    isMounted.current = true;
    fetchGameInfo();
    
    return () => {
      isMounted.current = false;
      timers.current.forEach(clearTimeout);
    };
  }, [fetchGameInfo]);

  /** ---------- DEEP REFRESH ---------- */
  const deepRefresh = useCallback(async () => {
    if (!isMounted.current) return;
    
    setRefreshing(true);
    
    try {
      setResult(null);
      setRevealedIngredients([]);
      setShowWinModal(false);
      setShowLossModal(false);
      
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
        setBrewing(false);
      }
    }
  }, [refreshWallet]);

  /** ---------- INGREDIENT REVEAL ---------- */
  const revealIngredientsProgressively = useCallback((ingredients, resultData) => {
    if (!isMounted.current) return;
    
    setRevealedIngredients([]);
    
    if (!ingredients || ingredients.length === 0) {
      setTimeout(() => {
        if (isMounted.current) {
          setShowLossModal(true);
        }
      }, 1500);
      return;
    }
    
    // Reveal ingredients one by one
    ingredients.forEach((ingredient, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedIngredients(prev => [...prev, ingredient]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          // After all ingredients are revealed, show appropriate modal
          if (index === ingredients.length - 1) {
            setTimeout(() => {
              if (isMounted.current && resultData) {
                const hasWon = resultData.win_amount > 0;
                const isCursed = resultData.was_cursed;
                
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
  }, []);

  /** ---------- BREW FLOW ---------- */
  const startAnimation = () => {
    timers.current = [];
    setPhase('ingredients');
    timers.current.push(setTimeout(() => setPhase('heating'), 1800));
    timers.current.push(setTimeout(() => setPhase('brewing'), 3600));
    timers.current.push(setTimeout(() => setPhase('result'), 5400));
  };

  /** ---------- GET WIN TIER ---------- */
  const getWinTier = (multiplier) => {
    if (multiplier <= 0) return "loss";
    if (multiplier <= 1.5) return "small";
    if (multiplier <= 2.5) return "good";
    if (multiplier <= 3.0) return "great";
    return "perfect";
  };

  const getWinTierColor = (tier) => {
    switch(tier) {
      case "small": return "#10B981";
      case "good": return "#3B82F6";
      case "great": return "#8B5CF6";
      case "perfect": return "#F59E0B";
      default: return "#6B7280";
    }
  };

  const getWinTierName = (tier) => {
    switch(tier) {
      case "small": return "Small Brew";
      case "good": return "Good Brew";
      case "great": return "Great Brew";
      case "perfect": return "Perfect Brew";
      default: return "Failed Brew";
    }
  };

  /** ---------- START BREW ---------- */
  const handleBrew = async () => {
    if (brewing || refreshing) return;

    if (walletLoading) {
      alert('Please wait while your balance loads...');
      return;
    }

    if (betAmount < MIN_STAKE) {
      alert('Minimum stake is ₦100');
      return;
    }

    if (betAmount > combinedBalance) {
      alert('Insufficient wallet balance');
      return;
    }

    setBrewing(true);
    setResult(null);
    setRevealedIngredients([]);
    setShowModal(false);
    setShowWinModal(false);
    setShowLossModal(false);
    startAnimation();

    try {
      const res = await potionService.brewPotion({
        bet_amount: betAmount,
        potion_type: potionType,
      });

      const data = res.data;
      console.log("Brew result:", data); // Debug log
      setResult(data);

      // Start progressive ingredient reveal AFTER animations complete
      setTimeout(() => {
        if (isMounted.current) {
          revealIngredientsProgressively(data.ingredients || [], data);
        }
      }, 7000); // Increased delay to ensure animations complete

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (err) {
      console.error("Brew error:", err);
      alert(err.response?.data?.error || 'Brew failed');
      if (isMounted.current) {
        setPhase('idle');
        setBrewing(false);
        setShowModal(true);
      }
    } finally {
      setTimeout(() => {
        if (isMounted.current) {
          setBrewing(false);
        }
      }, 6000);
    }
  };

  /** ---------- MODAL HANDLERS ---------- */
  const handleContinue = async () => {
    setShowWinModal(false);
    await deepRefresh();
  };

  const handleTryAgain = async () => {
    setShowLossModal(false);
    await deepRefresh();
  };

  /** ---------- CALCULATE POTENTIAL WIN ---------- */
  const potentialMinWin = betAmount * 0.5; // 0.5x multiplier
  const potentialMaxWin = betAmount * 3.5; // 3.5x multiplier
  const winTier = result ? getWinTier(result.visual_multiplier || 0) : null;

  /** ---------- RENDER ---------- */
  return (
    <div className="potion-game">
      {/* Background ambient animation */}
      <div className="ambient-animation"></div>
      
      {/* ===== HEADER ===== */}
      <header className="game-header">
        <button className="back-button" onClick={() => navigate('/')} disabled={refreshing}>
          ← Back
        </button>
      </header>

      {/* ===== GAME AREA ===== */}
      <div className="cauldron-area">
        <div className={`cauldron cauldron--${phase}`}>
          
          {phase === 'idle' && (
            <div className="cauldron-ready">
              <div className="cauldron-icon animated-bounce">⚗️</div>
            </div>
          )}

          {phase === 'ingredients' && (
            <div className="brewing-animation animated-fadeIn">
              <div className="ingredient-drop">
                <span className="ingredient-falling">🌙</span>
                <span className="ingredient-falling">💎</span>
                <span className="ingredient-falling">🪶</span>
              </div>
              <p className="animated-pulse">🧄 Adding mystical ingredients…</p>
            </div>
          )}

          {phase === 'heating' && (
            <div className="brewing-animation animated-fadeIn">
              <div className="fire-animation">
                <div className="flame"></div>
                <div className="flame"></div>
                <div className="flame"></div>
              </div>
              <p className="animated-wave">🔥 Heating cauldron…</p>
            </div>
          )}

          {phase === 'brewing' && (
            <div className="brewing-animation animated-fadeIn">
              <div className="bubble-animation">
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
                <div className="bubble"></div>
              </div>
              <p className="animated-bounce">🧪 Brewing ancient magic…</p>
            </div>
          )}

          {phase === 'result' && (
            <div className="brew-reveal-container">
              <div className="overlay-title animated-fadeIn">
                {result?.win_amount > 0 ? '✨ Brew Complete!' : result?.was_cursed ? '💀 Cursed Brew!' : '📭 Brew Failed'}
              </div>
              
              <div className="ingredients-grid-reveal">
                {revealedIngredients.map((ingredient, index) => (
                  <div 
                    key={index} 
                    className={`ingredient-card-reveal animated-zoomIn ${
                      pulseAnimation ? 'pulse-once' : ''
                    } ${ingredient.rarity === 'cursed' ? 'cursed-ingredient' : ''}`}
                    style={{animationDelay: `${index * 0.2}s`}}
                  >
                    <div className="ingredient-icon-reveal">
                      {ingredient.emoji}
                    </div>
                    <div className="ingredient-name-reveal">
                      {ingredient.name}
                    </div>
                    <div className="ingredient-rarity" data-rarity={ingredient.rarity}>
                      {ingredient.rarity}
                    </div>
                    <div className="ingredient-power">
                      {ingredient.power >= 0 ? '+' : ''}{ingredient.power}x
                    </div>
                  </div>
                ))}
                
                {/* Show shimmer effect while revealing */}
                {revealedIngredients.length < (result?.ingredients?.length || 0) && (
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

      {/* ===== START MODAL ===== */}
      {showModal && (
        <div className="modal-overlay animated-fadeIn">
          <div className="modal-card animated-slideUp">

            <div className="potion-types">
              {POTIONS.map(p => (
                <button
                  key={p.value}
                  className={`potion-type animated-bounceIn ${potionType === p.value ? 'active pulse' : ''}`}
                  style={{animationDelay: `${POTIONS.indexOf(p) * 0.1}s`}}
                  onClick={() => setPotionType(p.value)}
                  disabled={walletLoading || refreshing}
                >
                  <strong>{p.label}</strong>
                  <small>{p.desc}</small>
                </button>
              ))}
            </div>

            <div className="stake-input-container">
              <label>Stake Amount (₦)</label>
              <div className="stake-input-wrapper animated-pulse">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  min={MIN_STAKE}
                  step="100"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  placeholder={`Minimum ₦${MIN_STAKE}`}
                  disabled={walletLoading || refreshing}
                />
                <div className="input-glow"></div>
              </div>
            </div>

            <button
              className="brew-button animated-pulse-glow"
              onClick={handleBrew}
              disabled={walletLoading || refreshing || betAmount > combinedBalance || betAmount < MIN_STAKE}
            >
              {refreshing ? "REFRESHING..." : walletLoading ? "LOADING..." : "⚗️ Start Brewing"}
            </button>

          </div>
        </div>
      )}

      {/* ===== WIN MODAL ===== */}
      {showWinModal && result && result.win_amount > 0 && (
        <div className="modal-overlay win-modal-overlay animated-fadeIn">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="confetti"></div>
              <div className="confetti"></div>
              <div className="confetti"></div>
              
              {/* Win Tier Badge */}
              {winTier && winTier !== "loss" && (
                <div 
                  className="win-tier-badge"
                  style={{backgroundColor: getWinTierColor(winTier)}}
                >
                  {getWinTierName(winTier)}
                </div>
              )}
              
              <div className="win-icon">🏆</div>
              <h2>Brew Success!</h2>
              <p className="win-subtitle">{result.success_level?.toUpperCase()} Brew</p>
            </div>
            
            <div className="win-amount-display animated-pulse-glow">
              <span className="win-amount-label">You brewed</span>
              <span className="win-amount">
                {formatNaira(result.win_amount)}
              </span>
            </div>
            
            <div className="brew-bonus-summary">
              <h4>Brew Details:</h4>
              <div className="bonus-grid">
                {result.base_multiplier > 0 && (
                  <div className="bonus-item">
                    <span>Base Multiplier:</span>
                    <span>{result.base_multiplier?.toFixed(2)}x</span>
                  </div>
                )}
                {result.ingredient_power > 0 && (
                  <div className="bonus-item">
                    <span>Ingredient Power:</span>
                    <span>{result.ingredient_power?.toFixed(2)}x</span>
                  </div>
                )}
                {(result.legendary_count || 0) > 0 && (
                  <div className="bonus-item">
                    <span>Legendary Ingredients:</span>
                    <span>{result.legendary_count || 0}</span>
                  </div>
                )}
                {(result.preferred_matches || 0) > 0 && (
                  <div className="bonus-item">
                    <span>Preferred Matches:</span>
                    <span>{result.preferred_matches || 0}</span>
                  </div>
                )}
                {(result.cursed_count || 0) > 0 && (
                  <div className="bonus-item cursed">
                    <span>Cursed Ingredients:</span>
                    <span>{result.cursed_count}</span>
                  </div>
                )}
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
                "⚗️ Brew Again"
              )}
            </button>
            
          </div>
        </div>
      )}

      {/* ===== LOSS MODAL ===== */}
      {showLossModal && (
        <div className="modal-overlay loss-modal-overlay animated-fadeIn">
          <div className="loss-modal-content animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon">{result?.was_cursed ? '💀' : '💔'}</div>
              <h2>{result?.was_cursed ? 'Cursed Brew!' : 'Brew Failed'}</h2>
              <p className="loss-subtitle">
                {result?.was_cursed ? 'Cursed ingredient ruined the potion!' : 'The potion exploded!'}
              </p>
            </div>
            
            <div className="loss-message animated-fadeIn">
              <div className="broken-cauldron">
                {result?.was_cursed ? '🧪' : '💥'}
              </div>
              <p className="loss-encouragement">
                {result?.was_cursed 
                  ? "Bad ingredients can ruin any brew! (30% chance)"
                  : "Even the best alchemists have failed brews!"
                }
                <br />
                <span className="loss-tip">
                  {result?.was_cursed 
                    ? "Tip: You have a 70% chance of successful brews!"
                    : "Tip: Try different ingredients for better results!"
                  }
                </span>
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake:</span>
                <span>{formatNaira(betAmount)}</span>
              </div>
              <div className="stat-item">
                <span>Potion Type:</span>
                <span>{POTIONS.find(p => p.value === potionType)?.label}</span>
              </div>
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
                "⚗️ Try Again"
              )}
            </button>
            
          </div>
        </div>
      )}
    </div>
  );
};

export default PotionBrewingGame;