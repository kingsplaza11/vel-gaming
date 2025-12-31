import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { cardService } from '../services/api';
import './CardMatchingGame.css';

const MIN_BET = 100;

const CardMatchingGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  /* =========================
     HELPER FUNCTIONS
  ========================== */
  const getCombinedBalance = () => {
    if (!wallet) return user?.balance || 0;
    const balance = wallet.balance || 0;
    const spot_balance = wallet.spot_balance || 0;
    return balance + spot_balance;
  };

  const getSpotBalance = () => {
    if (!wallet) return 0;
    return wallet.spot_balance || 0;
  };

  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNGN = (v) =>
    `₦${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  /* =========================
     UI STATE
  ========================== */
  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState('1000');
  const [gridSize, setGridSize] = useState(16);
  const [error, setError] = useState('');
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /* =========================
     GAME STATE
  ========================== */
  const [gameId, setGameId] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [attempts, setAttempts] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle');
  const [locked, setLocked] = useState(false);

  const symbols = ['💎','🔥','⚡','🎯','🌟','👑','🧿','🚀','🎭','🔮','🌈','⭐','🎨','💫','✨','🌠','🎖️','🏅','🥇','💍'];

  const difficulties = [
    { size: 16, label: 'Normal', mines: 8 },
    { size: 20, label: 'Hard', mines: 10 },
    { size: 24, label: 'Expert', mines: 12 },
  ];

  const numericBet = Number(betAmount);

  const isStakeValid = () => {
    return Number.isFinite(numericBet) && numericBet >= MIN_BET;
  };

  const canStart = 
    isStakeValid() &&
    numericBet <= combinedBalance &&
    !walletLoading &&
    !refreshing;

  /* =========================
     DEEP REFRESH
  ========================== */
  const deepRefresh = async () => {
    setRefreshing(true);
    setShowModal(true);
    setGameStatus('idle');
    setCards([]);
    setGameId(null);
    setLastWin(null);
    setShowWinModal(false);
    setShowLossModal(false);
    
    if (refreshWallet) {
      await refreshWallet();
    }
    
    setRefreshing(false);
  };

  /* =========================
     START GAME
  ========================== */
  const startGame = async () => {
    setError('');

    if (!Number.isFinite(numericBet) || numericBet <= 0) {
      setError('Enter a valid stake amount');
      return;
    }

    if (numericBet < MIN_BET) {
      setError(`Minimum stake is ₦${MIN_BET.toLocaleString("en-NG")}`);
      return;
    }

    if (numericBet > combinedBalance) {
      setError('Insufficient balance');
      return;
    }

    if (walletLoading) {
      setError('Please wait while your balance loads...');
      return;
    }

    try {
      const res = await cardService.startGame({
        bet_amount: numericBet,
        grid_size: gridSize,
      });

      console.log("Game started:", res.data);

      setGameId(res.data.game_id);
      setCards(
        Array(res.data.cards_count).fill(null).map((_, i) => ({
          id: i,
          value: null,
          isRevealed: false,
          isMatched: false,
        }))
      );

      setMatchedPairs(0);
      setMultiplier(1);
      setAttempts(0);
      setSelectedCards([]);
      setGameStatus('playing');
      setShowModal(false);
      setLastWin(null);

      if (refreshWallet) {
        await refreshWallet();
      }

    } catch (err) {
      console.error("Game start error:", err);
      setError(err.response?.data?.error || 'Failed to start game');
    }
  };

  /* =========================
     CARD CLICK
  ========================== */
  const handleCardClick = async (index) => {
    if (locked || refreshing) return;
    if (gameStatus !== 'playing') return;
    if (!gameId) return;
    if (selectedCards.length === 2) return;
    if (cards[index].isMatched || cards[index].isRevealed) return;

    setLocked(true);

    try {
      const res = await cardService.revealCard({
        game_id: gameId,
        card_index: index,
      });

      const updated = [...cards];
      updated[index].value = res.data.card_value;
      updated[index].isRevealed = true;
      setCards(updated);

      const picks = [...selectedCards, index];
      setSelectedCards(picks);

      /* FIRST PICK */
      if (res.data.match_found === null) {
        setLocked(false);
        return;
      }

      /* SECOND PICK - MATCH FOUND */
      if (res.data.match_found === true) {
        setTimeout(() => {
          picks.forEach(i => updated[i].isMatched = true);
          setCards([...updated]);
          setSelectedCards([]);
          setMatchedPairs(res.data.matches_found);
          setMultiplier(res.data.multiplier);
          setLocked(false);
        }, 500);
      } else {
        /* SECOND PICK - NO MATCH */
        setAttempts(prev => prev + 1);

        setTimeout(() => {
          picks.forEach(i => {
            updated[i].isRevealed = false;
            updated[i].value = null;
          });
          setCards([...updated]);
          setSelectedCards([]);
          setLocked(false);
        }, 900);
      }

      /* GAME FAILED */
      if (res.data.status === 'failed') {
        setGameStatus('failed');
        setTimeout(() => {
          setShowLossModal(true);
        }, 1200);
      }

      /* GAME COMPLETED */
      if (res.data.status === 'completed') {
        setGameStatus('completed');
        setLastWin({
          win_amount: res.data.win_amount,
          win_ratio: res.data.win_ratio,
          win_tier: res.data.win_tier,
          multiplier: res.data.multiplier,
          matches_found: res.data.matches_found,
        });

        if (refreshWallet) {
          await refreshWallet();
        }

        // Show win modal for significant wins
        setTimeout(() => {
          if (res.data.win_ratio > 0.5) {
            setShowWinModal(true);
          }
        }, 800);
      }

    } catch (err) {
      console.error("Card reveal error:", err);
      setLocked(false);
    }
  };

  /* =========================
     CASH OUT EARLY
  ========================== */
  const cashOutEarly = async () => {
    if (!gameId || gameStatus !== 'playing' || refreshing) return;

    try {
      const res = await cardService.cashOut({
        game_id: gameId,
      });

      setGameStatus('cashed_out');
      setLastWin({
        win_amount: res.data.win_amount,
        win_ratio: res.data.win_ratio,
        win_tier: 'partial',
      });

      if (refreshWallet) {
        await refreshWallet();
      }

      alert(`Cashed out ${formatNGN(res.data.win_amount)}`);

    } catch (err) {
      console.error("Cash out error:", err);
    }
  };

  /* =========================
     GET WIN TIER COLOR
  ========================== */
  const getWinTierColor = (tier) => {
    switch(tier) {
      case "low": return "#FFA726";
      case "normal": return "#4CAF50";
      case "high": return "#2196F3";
      case "jackpot": return "#9C27B0";
      case "mega_jackpot": return "#F44336";
      case "partial": return "#FF9800";
      default: return "#666";
    }
  };

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="card-matching-game">

      {/* AMBIENT ANIMATION */}
      <div className="ambient-animation"></div>

      {/* HEADER */}
      <div className="game-header">
        <button onClick={() => navigate('/')} className="back-button">
          ← Back
        </button>
        <div className="balance-details">
          <div className="balance-total">
            {walletLoading || refreshing ? (
              <div className="balance-loading">
                <span className="loading-spinner-small" />
                {refreshing ? "Refreshing..." : "Loading..."}
              </div>
            ) : (
              formatNGN(combinedBalance)
            )}
          </div>
          <div className="balance-breakdown">
            <span className="balance-main">Main: {formatNGN(wallet?.balance || 0)}</span>
            <span className="balance-spot">Spot: {formatNGN(spotBalance)}</span>
          </div>
        </div>
      </div>

      {/* STAKE MODAL */}
      {showModal && (
        <div className="stake-modal-overlay animated-fadeIn">
          <div className="stake-modal animated-slideUp">
            <div className="panel-header-glow">
              <h3>🎴 Card Matching</h3>
            </div>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading || refreshing ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    {refreshing ? "Refreshing..." : "Loading..."}
                  </div>
                ) : (
                  formatNGN(combinedBalance)
                )}
              </span>
            </div>

            <div className="game-description">
              <p>Match all card pairs before running out of attempts!</p>
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Difficulty Level</label>
                <div className="option-buttons">
                  {difficulties.map(d => (
                    <button
                      key={d.size}
                      className={gridSize === d.size ? "active" : ""}
                      onClick={() => setGridSize(d.size)}
                      disabled={walletLoading || refreshing}
                    >
                      {d.label} ({d.size} cards)
                    </button>
                  ))}
                </div>
                <small className="risk-indicator">
                  Attempts: {gridSize === 16 ? "3" : gridSize === 20 ? "4" : "5"} fails allowed
                </small>
              </div>
            </div>

            <div className="stake-input-group">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                placeholder="1000"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                disabled={walletLoading || refreshing}
                min={MIN_BET}
                step={100}
              />
            </div>

            {!isStakeValid() && betAmount.trim() !== '' && (
              <div className="error-banner">
                Minimum stake is ₦{MIN_BET.toLocaleString("en-NG")}
              </div>
            )}

            {error && <div className="error-banner">{error}</div>}

            <button
              className="start-btn"
              disabled={!canStart}
              onClick={startGame}
            >
              {refreshing ? "REFRESHING..." : 
               walletLoading ? "LOADING..." : 
               "🎮 Start Game"}
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      {!showModal && (
        <div className="game-board-section">
          <div className="game-info-bar">
            <div className="info-item">
              <span>Matches</span>
              <strong>{matchedPairs}/{gridSize / 2}</strong>
            </div>
            <div className="info-item">
              <span>Multiplier</span>
              <strong className="multiplier-display">{multiplier.toFixed(2)}x</strong>
            </div>
            <div className="info-item">
              <span>Attempts Left</span>
              <strong>{3 - attempts}</strong>
            </div>
          </div>

          {gameStatus === 'playing' && (
            <div className="action-buttons">
              <button className="cashout-btn" onClick={cashOutEarly}>
                💰 Cash Out Early
              </button>
            </div>
          )}

          <div className="grid-container">
            <div 
              className="cards-grid"
              style={{ 
                gridTemplateColumns: `repeat(${Math.sqrt(gridSize)}, 1fr)`,
                maxWidth: gridSize === 24 ? '600px' : gridSize === 20 ? '500px' : '400px'
              }}
            >
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={`card ${card.isRevealed ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''}`}
                  onClick={() => handleCardClick(index)}
                >
                  <div className="card-front">
                    <span className="card-back-text">?</span>
                  </div>
                  <div className="card-back">
                    {card.isRevealed && symbols[card.value - 1]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {(gameStatus === 'failed' || gameStatus === 'cashed_out') && (
            <div className="result-section">
              <div className="result-message">
                {gameStatus === 'failed' ? (
                  <>
                    <div className="result-icon">💥</div>
                    <h3>Game Over!</h3>
                    <p>You ran out of attempts!</p>
                  </>
                ) : (
                  <>
                    <div className="result-icon">💰</div>
                    <h3>Cashed Out!</h3>
                    <p>Winnings added to spot balance</p>
                  </>
                )}
              </div>
              
              {lastWin && (
                <div className="win-details">
                  <div className="win-amount-display">
                    <span className="win-label">You Won</span>
                    <span className="win-amount">{formatNGN(lastWin.win_amount)}</span>
                    <span className="win-ratio">
                      ({lastWin.win_ratio > 0 ? (lastWin.win_ratio * 100).toFixed(1) : '0'}% of stake)
                    </span>
                  </div>
                </div>
              )}

              <button
                className="restart-btn"
                onClick={deepRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <>
                    <span className="loading-spinner-small" />
                    Refreshing...
                  </>
                ) : (
                  "🔁 Play Again"
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && lastWin && (
        <div className="modal-overlay win-modal-overlay animated-fadeIn">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="win-icon">🏆</div>
              <h2>Perfect Match!</h2>
              <p className="win-subtitle">All pairs found!</p>
            </div>
            
            <div className="win-amount-display">
              <span className="win-amount-label">You won</span>
              <span 
                className="win-amount" 
                style={{color: getWinTierColor(lastWin.win_tier)}}
              >
                {formatNGN(lastWin.win_amount)}
              </span>
              <p className="win-note">
                {lastWin.win_tier === "mega_jackpot" ? "MEGA JACKPOT!" : 
                 lastWin.win_tier === "jackpot" ? "JACKPOT WIN!" : 
                 "Excellent performance!"}
              </p>
            </div>
            
            <div className="win-stats">
              <div className="stat-item">
                <span>Matches Found:</span>
                <span>{lastWin.matches_found}/{gridSize / 2}</span>
              </div>
              <div className="stat-item">
                <span>Win Ratio:</span>
                <span>{(lastWin.win_ratio * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item">
                <span>Multiplier:</span>
                <span>{lastWin.multiplier.toFixed(2)}x</span>
              </div>
              <div className="stat-item">
                <span>Win Tier:</span>
                <span style={{color: getWinTierColor(lastWin.win_tier), textTransform: 'capitalize'}}>
                  {lastWin.win_tier.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <button
              className="continue-button"
              onClick={() => {
                setShowWinModal(false);
                deepRefresh();
              }}
              disabled={refreshing}
            >
              {refreshing ? (
                <>
                  <span className="loading-spinner-small" />
                  Refreshing...
                </>
              ) : (
                "🎮 Continue Playing"
              )}
            </button>
          </div>
        </div>
      )}

      {/* LOSS MODAL */}
      {showLossModal && (
        <div className="modal-overlay loss-modal-overlay animated-fadeIn">
          <div className="loss-modal-content animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon">💔</div>
              <h2>Out of Attempts</h2>
              <p className="loss-subtitle">Better luck next time!</p>
            </div>
            
            <div className="loss-message">
              <div className="loss-encouragement">
                You matched <strong>{matchedPairs} pairs</strong>!
                <br />
                <span className="loss-tip">Try Normal difficulty first for easier wins!</span>
              </div>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake:</span>
                <span>{formatNGN(numericBet)}</span>
              </div>
              <div className="stat-item">
                <span>Grid Size:</span>
                <span>{gridSize} cards</span>
              </div>
              <div className="stat-item">
                <span>Attempts Made:</span>
                <span>{attempts}</span>
              </div>
            </div>
            
            <button
              className="try-again-button"
              onClick={() => {
                setShowLossModal(false);
                deepRefresh();
              }}
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

export default CardMatchingGame;