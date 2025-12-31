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

  const timers = useRef([]);
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
      timers.current.forEach(clearTimeout);
    };
  }, []);

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
  const revealIngredientsProgressively = (ingredients) => {
    setRevealedIngredients([]);
    
    if (!ingredients || ingredients.length === 0) {
      setTimeout(() => {
        setShowLossModal(true);
      }, 1500);
      return;
    }
    
    ingredients.forEach((ingredient, index) => {
      setTimeout(() => {
        if (isMounted.current) {
          setRevealedIngredients(prev => [...prev, ingredient]);
          setPulseAnimation(true);
          setTimeout(() => setPulseAnimation(false), 300);
          
          if (index === ingredients.length - 1) {
            setTimeout(() => {
              if (isMounted.current) {
                const hasWon = result?.win_amount > 0;
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

  /** ---------- BREW FLOW ---------- */
  const startAnimation = () => {
    timers.current = [];
    setPhase('ingredients');
    timers.current.push(setTimeout(() => setPhase('heating'), 1800));
    timers.current.push(setTimeout(() => setPhase('brewing'), 3600));
    timers.current.push(setTimeout(() => setPhase('result'), 5400));
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
      setResult(data);

      // Start progressive ingredient reveal
      setTimeout(() => {
        revealIngredientsProgressively(data.ingredients || []);
      }, 5500);

      // Refresh wallet silently
      setTimeout(() => {
        if (isMounted.current && refreshWallet) {
          refreshWallet();
        }
      }, 500);

    } catch (err) {
      alert(err.response?.data?.error || 'Brew failed');
      setPhase('idle');
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
        
        <div className="balance-display">
          {walletLoading || refreshing ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              {refreshing ? "Refreshing..." : "Loading balance..."}
            </div>
          ) : (
            <div className="balance-details">
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
      </header>

      {/* ===== GAME AREA ===== */}
      <div className="cauldron-area">
        <div className={`cauldron cauldron--${phase}`}>
          
          {phase === 'idle' && (
            <div className="cauldron-ready">
              <div className="cauldron-icon animated-bounce">⚗️</div>
              <p>Prepare your magical brew</p>
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
                {result?.win_amount > 0 ? '✨ Brew Complete!' : '📭 Brew Failed'}
              </div>
              
              <div className="ingredients-grid-reveal">
                {revealedIngredients.map((ingredient, index) => (
                  <div 
                    key={index} 
                    className={`ingredient-card-reveal animated-zoomIn ${
                      pulseAnimation ? 'pulse-once' : ''
                    }`}
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
                      {ingredient.power}x
                    </div>
                  </div>
                ))}
                
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
            <div className="modal-header-glow" style={{background: POTIONS.find(p => p.value === potionType)?.color}}>
              <h3>Select Potion Type</h3>
            </div>

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
      {showWinModal && result && (
        <div className="modal-overlay win-modal-overlay animated-fadeIn">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="confetti"></div>
              <div className="confetti"></div>
              <div className="confetti"></div>
              <div className="win-icon">🏆</div>
              <h2>Brew Success!</h2>
              <p className="win-subtitle">{result.success_level.toUpperCase()} Brew</p>
            </div>
            
            <div className="win-amount-display animated-pulse-glow">
              <span className="win-amount-label">You brewed</span>
              <span className="win-amount">
                {formatNaira(result.win_amount)}
              </span>
              <p className="win-note">Added to your Spot Balance</p>
              <div className="win-multiplier">
                Multiplier: {result.visual_multiplier?.toFixed(2)}x
              </div>
            </div>
            
            <div className="brew-bonus-summary">
              <h4>Brew Bonuses:</h4>
              <div className="bonus-grid">
                <div className="bonus-item">
                  <span>Ingredient Bonus:</span>
                  <span>+{(result.ingredient_bonus * 100).toFixed(1)}%</span>
                </div>
                <div className="bonus-item">
                  <span>Legendary Ingredients:</span>
                  <span>{result.legendary_count || 0}</span>
                </div>
                <div className="bonus-item">
                  <span>Preferred Matches:</span>
                  <span>{result.preferred_matches || 0}</span>
                </div>
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
              <div className="loss-icon">💔</div>
              <h2>Brew Failed</h2>
              <p className="loss-subtitle">The potion exploded!</p>
            </div>
            
            <div className="loss-message animated-fadeIn">
              <div className="broken-cauldron">💥</div>
              <p className="loss-encouragement">
                Even the best alchemists have failed brews!
                <br />
                <span className="loss-tip">Tip: Try different ingredients for better results!</span>
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