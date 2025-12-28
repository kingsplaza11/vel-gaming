import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext'; // Import wallet context
import { potionService } from '../services/api';
import './PotionBrewingGame.css';

const MIN_STAKE = 200;

const POTIONS = [
  { value: 'healing', label: '❤️ Healing Potion', desc: 'Restores vitality' },
  { value: 'mana', label: '🔮 Mana Potion', desc: 'Replenishes energy' },
  { value: 'strength', label: '💪 Strength Potion', desc: 'Boosts power' },
  { value: 'luck', label: '🍀 Luck Potion', desc: 'Twists fate' },
];

const PotionBrewingGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const safeBalance = Number(getWalletBalance() || 0);

  /** ---------- UI STATE ---------- */
  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [potionType, setPotionType] = useState('healing');

  const [phase, setPhase] = useState('idle'); 
  // idle → ingredients → heating → brewing → result

  const [brewing, setBrewing] = useState(false);
  const [result, setResult] = useState(null);
  const timers = useRef([]);

  /** ---------- CLEANUP ---------- */
  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  /** ---------- BREW FLOW ---------- */
  const startAnimation = () => {
    timers.current = [];
    setPhase('ingredients');
    timers.current.push(setTimeout(() => setPhase('heating'), 1200));
    timers.current.push(setTimeout(() => setPhase('brewing'), 2600));
    timers.current.push(setTimeout(() => setPhase('result'), 4200));
  };

  /** ---------- START BREW ---------- */
  const handleBrew = async () => {
    // Check if wallet is still loading
    if (walletLoading) {
      alert('Please wait while your balance loads...');
      return;
    }

    if (betAmount < MIN_STAKE) {
      alert('Minimum stake is ₦200');
      return;
    }

    if (betAmount > safeBalance) {
      alert('Insufficient wallet balance');
      return;
    }

    setBrewing(true);
    setResult(null);
    setShowModal(false);
    startAnimation();

    try {
      const res = await potionService.brewPotion({
        bet_amount: betAmount,
        potion_type: potionType,
      });

      const cappedWin = Math.min(
        Number(res.data.win_amount),
        betAmount * 1.3
      );

      setResult({
        ...res.data,
        win_amount: cappedWin,
      });

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

    } catch (err) {
      alert(err.response?.data?.error || 'Brew failed');
      setPhase('idle');
    } finally {
      setBrewing(false);
    }
  };

  /** ---------- RENDER ---------- */
  return (
    <div className="potion-game">

      {/* ===== HEADER ===== */}
      <header className="game-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading balance...
            </div>
          ) : (
            `Balance: ₦${safeBalance.toLocaleString()}`
          )}
        </div>
      </header>

      {/* ===== GAME AREA ===== */}
      <div className="cauldron-area">
        <div className="cauldron">

          {phase === 'idle' && (
            <div className="cauldron-ready">
              <div className="cauldron-icon">⚗️</div>
              <p>Prepare your potion</p>
            </div>
          )}

          {phase === 'ingredients' && (
            <div className="brewing-animation">
              <p>🧄 Adding ingredients…</p>
            </div>
          )}

          {phase === 'heating' && (
            <div className="brewing-animation">
              <p>🔥 Heating cauldron…</p>
            </div>
          )}

          {phase === 'brewing' && (
            <div className="brewing-animation">
              <div className="bubbles">🫧🫧🫧</div>
              <p>🧪 Brewing magic…</p>
            </div>
          )}

          {phase === 'result' && result && (
            <div className="brew-results">
              <h3>{result.success_level.toUpperCase()}</h3>

              <div className="ingredients-grid">
                {result.ingredients_used.map((i, idx) => (
                  <div key={idx} className="ingredient-item">
                    <div className="ingredient-icon">{i.image}</div>
                    <div>{i.name}</div>
                    <div>{i.power}x</div>
                  </div>
                ))}
              </div>

              <div className="brew-stats">
                <div>
                  Multiplier: {Number(result.final_multiplier).toFixed(2)}x
                </div>

                <div className="win-amount">
                  {result.win_amount > 0
                    ? `+ ₦${Number(result.win_amount).toLocaleString()}`
                    : 'Lost stake'}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===== MODAL ===== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">

            <h3>Select Potion</h3>

            <div className="potion-types">
              {POTIONS.map(p => (
                <button
                  key={p.value}
                  className={`potion-type ${potionType === p.value ? 'active' : ''}`}
                  onClick={() => setPotionType(p.value)}
                  disabled={walletLoading}
                >
                  <strong>{p.label}</strong>
                  <small>{p.desc}</small>
                </button>
              ))}
            </div>

            <div className="stake-input-container">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                min={MIN_STAKE}
                step="100"
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                placeholder="Minimum ₦1,000"
                disabled={walletLoading}
              />
            </div>

            <button
              className="brew-button"
              onClick={handleBrew}
              disabled={walletLoading || betAmount > safeBalance || betAmount < MIN_STAKE}
            >
              {walletLoading ? "LOADING..." : "🧪 Start Brewing"}
            </button>

          </div>
        </div>
      )}

    </div>
  );
};

export default PotionBrewingGame;