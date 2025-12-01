// src/components/TreasureHuntGame.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { treasureService } from '../services/api';
import './TreasureHuntGame.css';

const MAP_LEVELS = [
  {
    level: 1,
    name: 'Beginner Island',
    description: 'Calm shores, easy treasures, low risk.',
    icon: '🏝️',
    risk: 'Low',
  },
  {
    level: 2,
    name: 'Ancient Forest',
    description: 'Hidden relics under the trees.',
    icon: '🌲',
    risk: 'Medium',
  },
  {
    level: 3,
    name: 'Dragon Mountain',
    description: 'Hot caves, bigger rewards.',
    icon: '⛰️',
    risk: 'High',
  },
  {
    level: 4,
    name: 'Phantom Desert',
    description: 'Mirages and mythical artifacts.',
    icon: '🏜️',
    risk: 'Very High',
  },
  {
    level: 5,
    name: 'Celestial Realm',
    description: 'God-tier treasures, extreme risk.',
    icon: '🌌',
    risk: 'Extreme',
  },
];

const TreasureHuntGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();

  const [betAmount, setBetAmount] = useState(10);
  const [mapLevel, setMapLevel] = useState(1);
  const [phase, setPhase] = useState('idle'); // idle | preparing | sailing | scanning | digging | revealing
  const [hunting, setHunting] = useState(false);
  const [lastHunt, setLastHunt] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const animationTimers = useRef([]);

  const selectedMap = MAP_LEVELS.find((m) => m.level === mapLevel);
  const levelCostMultiplier = mapLevel * 1.5;
  const totalCost = betAmount > 0 ? betAmount * levelCostMultiplier : 0;

  const clearAnimationTimers = () => {
    animationTimers.current.forEach((t) => clearTimeout(t));
    animationTimers.current = [];
  };

  const startAnimationSequence = () => {
    clearAnimationTimers();
    setPhase('preparing');
    animationTimers.current.push(
      setTimeout(() => setPhase('sailing'), 700),
      setTimeout(() => setPhase('scanning'), 2600),
      setTimeout(() => setPhase('digging'), 4500),
      setTimeout(() => setPhase('revealing'), 6400),
    );
  };

  useEffect(() => {
    return () => {
      clearAnimationTimers();
    };
  }, []);

  const handleStartHunt = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (hunting) return;

    const numericBet = Number(betAmount);
    if (!numericBet || numericBet <= 0) {
      setErrorMessage('Enter a valid stake amount.');
      return;
    }

    if (totalCost > Number(user.balance)) {
      setErrorMessage('Insufficient balance for this expedition.');
      return;
    }

    setErrorMessage(null);
    setHunting(true);
    setPhase('preparing');
    startAnimationSequence();

    try {
      const response = await treasureService.startHunt({
        bet_amount: numericBet,
        map_level: mapLevel,
      });

      const {
        treasures_found,
        total_multiplier,
        win_amount,
        new_balance,
        total_cost,
      } = response.data;

      setLastHunt({
        treasures_found,
        total_multiplier,
        win_amount,
        total_cost,
        map_level: mapLevel,
      });

      if (onBalanceUpdate) {
        onBalanceUpdate({ ...user, balance: new_balance });
      }
    } catch (error) {
      console.error('Error starting treasure hunt:', error);
      setErrorMessage(
        error.response?.data?.error || 'Error starting expedition. Please try again.',
      );
      setPhase('idle');
      clearAnimationTimers();
    } finally {
      setHunting(false);
    }
  };

  const handleQuickBet = (amount) => {
    setBetAmount(amount);
    setErrorMessage(null);
  };

  const handleBetChange = (e) => {
    const value = Number(e.target.value);
    if (Number.isNaN(value)) {
      setBetAmount(0);
    } else {
      setBetAmount(value);
    }
    setErrorMessage(null);
  };

  const formattedBalance =
    user && typeof user.balance !== 'undefined'
      ? Number(user.balance).toFixed(2)
      : '0.00';

  return (
    <div className="treasure-hunt-game">
      <header className="treasure-game-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Games
        </button>

        <div className="game-title">
          <span className="game-title-icon">🧭</span>
          <div className="game-title-text">
            <h1>Treasure Expedition</h1>
            <p>Pick your map, set your stake, and sail for hidden riches.</p>
          </div>
        </div>

        <div className="balance-pill">
          <span className="balance-label">Balance</span>
          <span className="balance-amount">💰 {formattedBalance}</span>
        </div>
      </header>

      <main className="treasure-game-layout">
        {/* LEFT: Map selection panel */}
        <section className="map-selection-panel">
          <div className="panel-card">
            <h2 className="panel-title">Choose Your Map</h2>
            <div className="map-level-grid">
              {MAP_LEVELS.map((map) => {
                const isActive = map.level === mapLevel;
                return (
                  <button
                    key={map.level}
                    className={`map-level-card ${isActive ? 'active' : ''}`}
                    onClick={() => setMapLevel(map.level)}
                    disabled={hunting}
                  >
                    <div className="map-level-header">
                      <span className="map-level-icon">{map.icon}</span>
                      <div>
                        <div className="map-level-name">
                          Lv {map.level} · {map.name}
                        </div>
                        <div className="map-level-risk">
                          Risk: <strong>{map.risk}</strong>
                        </div>
                      </div>
                    </div>
                    <p className="map-level-description">{map.description}</p>
                    <div className="map-level-footer">
                      <span className="map-level-cost">
                        Expedition multiplier: x{(map.level * 1.5).toFixed(1)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* CENTER: Game screen with stake section directly below */}
        <section className="game-screen-section">
          {/* Game Animation Screen */}
          <div className={`map-screen map-screen--${phase}`}>
            {/* Background ocean & sky */}
            <div className="sky-gradient" />
            <div className="sea">
              <div className="wave wave-1" />
              <div className="wave wave-2" />
              <div className="wave wave-3" />
            </div>

            {/* Boat */}
            <div className="boat">
              <div className="boat-hull" />
              <div className="boat-sail" />
              <div className="boat-sail boat-sail-small" />
            </div>

            {/* Island */}
            <div className="island">
              <div className="island-body" />
              <div className="palm-tree">
                <div className="palm-trunk" />
                <div className="palm-leaf leaf-1" />
                <div className="palm-leaf leaf-2" />
                <div className="palm-leaf leaf-3" />
              </div>
              <div className="x-mark">X</div>
            </div>

            {/* Sonar / scan */}
            <div className="sonar sonar-1" />
            <div className="sonar sonar-2" />

            {/* Digging / chest */}
            <div className="dig-site">
              <div className="shovel" />
              <div className="chest">
                <div className="chest-lid" />
                <div className="chest-body" />
                <div className="chest-glow" />
              </div>
            </div>

            {/* Overlay text based on phase */}
            <div className="map-overlay">
              {phase === 'idle' && (
                <>
                  <div className="overlay-title">Ready for Adventure</div>
                  <div className="overlay-subtitle">
                    Choose a map and set your stake to begin the expedition.
                  </div>
                </>
              )}

              {phase === 'preparing' && (
                <>
                  <div className="overlay-title">Plotting the Course...</div>
                  <div className="overlay-subtitle">
                    Marking {selectedMap?.name || 'your map'} for hidden treasure spots.
                  </div>
                </>
              )}

              {phase === 'sailing' && (
                <>
                  <div className="overlay-title">Sailing the Open Seas...</div>
                  <div className="overlay-subtitle">
                    Your crew is heading toward the marked island.
                  </div>
                </>
              )}

              {phase === 'scanning' && (
                <>
                  <div className="overlay-title">Scanning the Island...</div>
                  <div className="overlay-subtitle">
                    Magical sonar reveals where ancient chests might be buried.
                  </div>
                </>
              )}

              {phase === 'digging' && (
                <>
                  <div className="overlay-title">Digging for Treasure...</div>
                  <div className="overlay-subtitle">
                    Shovels are in the sand—treasures are about to surface.
                  </div>
                </>
              )}

              {phase === 'revealing' && lastHunt && (
                <>
                  <div className="overlay-title">Treasure Found!</div>
                  <div className="overlay-subtitle">
                    Scroll down to see what you unearthed on this expedition.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stake Section - Now directly below the game screen */}
          <div className="stake-controls-panel">
            <div className="panel-card">
              <div className="stake-controls-grid">
                {/* Left column: Stake input */}
                <div className="stake-input-section">
                  <h2 className="panel-title">Expedition Stake</h2>
                  
                  <div className="stake-input-container">
                    <label htmlFor="betAmount" className="stake-label">
                      Enter your stake amount
                    </label>
                    <div className="stake-input-wrapper">
                      <span className="stake-currency">$</span>
                      <input
                        id="betAmount"
                        type="number"
                        min="1"
                        step="1"
                        value={betAmount}
                        onChange={handleBetChange}
                        disabled={hunting}
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>

                  <div className="quick-bet-section">
                    <span className="quick-bet-label">Quick stakes:</span>
                    <div className="quick-bet-grid">
                      {[10, 25, 50, 100, 250, 500].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className={`quick-bet-chip ${betAmount === amount ? 'selected' : ''}`}
                          onClick={() => handleQuickBet(amount)}
                          disabled={hunting}
                        >
                          ${amount}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column: Cost summary and hunt button */}
                <div className="stake-summary-section">
                  <div className="cost-summary">
                    <div className="cost-item">
                      <span className="cost-label">Selected Map:</span>
                      <span className="cost-value">{selectedMap?.name} (Lv {mapLevel})</span>
                    </div>
                    <div className="cost-item">
                      <span className="cost-label">Map Multiplier:</span>
                      <span className="cost-value highlight">x{levelCostMultiplier.toFixed(1)}</span>
                    </div>
                    <div className="cost-item total-cost">
                      <span className="cost-label">Total Cost:</span>
                      <span className="cost-value total">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>

                  {errorMessage && <div className="error-banner">{errorMessage}</div>}

                  <button
                    className="hunt-button"
                    onClick={handleStartHunt}
                    disabled={
                      hunting ||
                      !betAmount ||
                      betAmount <= 0 ||
                      totalCost > Number(user?.balance || 0)
                    }
                  >
                    {hunting ? (
                      <>
                        <span className="hunt-button-icon">⚓</span>
                        <span className="hunt-button-text">Exploring seas...</span>
                      </>
                    ) : (
                      <>
                        <span className="hunt-button-icon">🚀</span>
                        <span className="hunt-button-text">Launch Expedition</span>
                        <span className="hunt-button-badge">${totalCost.toFixed(2)}</span>
                      </>
                    )}
                  </button>

                  <div className="balance-reminder">
                    <span className="balance-label">Available Balance:</span>
                    <span className="balance-amount">${formattedBalance}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results panel */}
          {lastHunt && (
            <div className="results-panel">
              <div className="panel-card">
                <div className="results-header">
                  <h2>Last Expedition Summary</h2>
                  <span className="results-tag">
                    Lv {lastHunt.map_level} · {selectedMap?.name}
                  </span>
                </div>

                <div className="treasures-grid">
                  {lastHunt.treasures_found.map((treasure, index) => (
                    <div key={index} className="treasure-card">
                      <div className="treasure-icon">{treasure.image}</div>
                      <div className="treasure-details">
                        <div className="treasure-name">{treasure.name}</div>
                        <div className="treasure-multiplier">
                          {treasure.multiplier}x
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hunt-summary">
                  <div className="summary-item">
                    <span>Total multiplier</span>
                    <span className="summary-value">
                      {lastHunt.total_multiplier.toFixed
                        ? lastHunt.total_multiplier.toFixed(2)
                        : Number(lastHunt.total_multiplier).toFixed(2)}x
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Expedition cost</span>
                    <span className="summary-value">
                      ${lastHunt.total_cost?.toFixed
                        ? lastHunt.total_cost.toFixed(2)
                        : Number(lastHunt.total_cost || totalCost).toFixed(2)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Winnings</span>
                    <span className="summary-value win">
                      ${lastHunt.win_amount.toFixed
                        ? lastHunt.win_amount.toFixed(2)
                        : Number(lastHunt.win_amount).toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="summary-note">
                  Each expedition rolls 3 treasures from the chosen map level. Higher maps carry
                  higher risk but unlock much bigger multipliers.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default TreasureHuntGame;