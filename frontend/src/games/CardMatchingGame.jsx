import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext'; // Import wallet context
import { cardService } from '../services/api';
import './CardMatchingGame.css';

const MIN_BET = 1000; // Updated to 1000 naira minimum

const CardMatchingGame = ({ user, onBalanceUpdate = () => {} }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* =========================
     HELPER FUNCTIONS
  ========================== */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const walletBalance = Number(getWalletBalance() || 0);

  /* =========================
     UI STATE
  ========================== */
  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState('1000'); // Start with minimum stake
  const [gridSize, setGridSize] = useState(16);
  const [error, setError] = useState('');

  /* =========================
     GAME STATE
  ========================== */
  const [gameId, setGameId] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [attempts, setAttempts] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle'); // idle | playing | failed | completed
  const [locked, setLocked] = useState(false);

  // Removed Easy mode, kept Normal and Hard
  const difficulties = [
    { size: 16, label: 'Normal' },
    { size: 20, label: 'Hard' },
  ];

  const symbols = ['💎','🔥','⚡','🎯','🌟','👑','🧿','🚀','🎭','🔮'];

  const numericBet = Number(betAmount);

  // Validate stake
  const isStakeValid = () => {
    return Number.isFinite(numericBet) && numericBet >= MIN_BET;
  };

  const canStart = 
    isStakeValid() &&
    numericBet <= walletBalance &&
    !walletLoading;

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

    if (numericBet > walletBalance) {
      setError('Insufficient wallet balance');
      return;
    }

    // Check if wallet is still loading
    if (walletLoading) {
      setError('Please wait while your balance loads...');
      return;
    }

    try {
      const res = await cardService.startGame({
        bet_amount: numericBet,
        grid_size: gridSize,
      });

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

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({
        ...user,
        balance: res.data.new_balance || (walletBalance - numericBet),
      });

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start game');
    }
  };

  /* =========================
     CARD CLICK
  ========================== */
  const handleCardClick = async (index) => {
    if (locked) return;
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

      /* SECOND PICK */
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

      /* FAIL */
      if (res.data.status === 'failed') {
        setGameStatus('failed');
        setTimeout(() => setShowModal(true), 1200);
      }

      /* WIN */
      if (res.data.status === 'completed') {
        setGameStatus('completed');

        // Update wallet balance
        if (refreshWallet) {
          await refreshWallet();
        }

        onBalanceUpdate({
          ...user,
          balance: res.data.new_balance || (walletBalance - numericBet + Number(res.data.win_amount || 0)),
        });

        setTimeout(() => {
          alert(`🎉 You won ₦${Number(res.data.win_amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`);
          setShowModal(true);
        }, 800);
      }

    } catch (err) {
      setLocked(false);
    }
  };

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="cmg-root">

      {/* HUD */}
      <div className="cmg-hud">
        <button onClick={() => navigate('/')} className="cmg-back">←</button>
        <div className="cmg-balance">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            `₦${walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
          )}
        </div>
      </div>

      {/* GAME */}
      <div className="cmg-card">
        {gameStatus === 'playing' && (
          <>
            <div className="cmg-info">
              <span>{matchedPairs}/{gridSize / 2} pairs</span>
              <span>{multiplier.toFixed(2)}x</span>
              <span>{2 - attempts} tries left</span>
            </div>

            <div
              className="cmg-grid"
              style={{ gridTemplateColumns: `repeat(${Math.sqrt(gridSize)}, 1fr)` }}
            >
              {cards.map((c, i) => (
                <div
                  key={i}
                  className={`cmg-tile ${c.isRevealed ? 'flip' : ''} ${c.isMatched ? 'matched' : ''}`}
                  onClick={() => handleCardClick(i)}
                >
                  <div className="front">?</div>
                  <div className="back">{c.isRevealed && symbols[c.value - 1]}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {(gameStatus === 'idle' || gameStatus === 'failed') && (
          <button className="cmg-restart" onClick={() => setShowModal(true)}>
            🎴 Start Game
          </button>
        )}
      </div>

      {/* STAKE MODAL */}
      {showModal && (
        <div className="cmg-modal-overlay">
          <div className="cmg-modal">
            <h3>Place Your Bet</h3>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  `₦${walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                )}
              </span>
            </div>

            <label>Bet Amount (₦{MIN_BET.toLocaleString("en-NG")} minimum)</label>
            <input
              type="number"
              placeholder="1000"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={walletLoading}
              min={MIN_BET}
            />

            {/* Quick bet options */}
            <div className="quick-bet-row">
              {[1000, 2000, 5000, 10000].map((amount) => (
                <button
                  key={amount}
                  className={`quick-bet-btn ${numericBet === amount ? 'active' : ''}`}
                  onClick={() => setBetAmount(amount.toString())}
                  disabled={walletLoading}
                  type="button"
                >
                  ₦{amount.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Stake validation message */}
            {!isStakeValid() && betAmount.trim() !== '' && (
              <div className="stake-validation-error">
                Minimum stake is ₦{MIN_BET.toLocaleString("en-NG")}
              </div>
            )}

            {error && <p className="cmg-error">{error}</p>}

            <div className="cmg-difficulty">
              {difficulties.map(d => (
                <button
                  key={d.size}
                  className={gridSize === d.size ? 'active' : ''}
                  onClick={() => setGridSize(d.size)}
                  disabled={walletLoading}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <button
              className="cmg-confirm"
              disabled={!canStart}
              onClick={startGame}
            >
              {walletLoading ? 'LOADING...' : 'Start Game'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardMatchingGame;