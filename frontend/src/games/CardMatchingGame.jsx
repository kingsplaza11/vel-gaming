import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { cardService } from '../services/api';
import { towerSound } from '../utils/TowerSoundManager'; // Reusing the same sound manager
import './CardMatchingGame.css';

const MIN_BET = 100;

const CardMatchingGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();
  const soundInitialized = useRef(false);

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
     SYMBOLS - LARGER EMOJIS FOR BETTER VISIBILITY
  ========================== */
  const symbols = [
    '💎','🔥','⚡','🎯','🌟','👑','🧿','🚀',
    '🎭','🔮','🌈','⭐','🎨','💫','✨','🌠',
    '🎖️','🏅','🥇','💍','🎪','🎸','🎲','🏆',
    '💵','💶','💷','💴','🪙','💰','💸','💳'
  ];

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
  const [isSoundMuted, setIsSoundMuted] = useState(
    localStorage.getItem('tower_sounds_muted') === 'true'
  );

  /* =========================
     GAME STATE
  ========================== */
  const [gameId, setGameId] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [gameStatus, setGameStatus] = useState('idle');
  const [locked, setLocked] = useState(false);

  const difficulties = [
    { size: 16, label: 'Normal' },
    { size: 20, label: 'Hard' },
    { size: 24, label: 'Expert' },
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
     SOUND INITIALIZATION
  ========================== */
  useEffect(() => {
    // Initialize sound manager on component mount
    if (!soundInitialized.current) {
      towerSound.init();
      soundInitialized.current = true;
    }

    // Cleanup on unmount
    return () => {
      towerSound.stopAllSounds();
    };
  }, []);

  /* =========================
     SOUND CONTROL FUNCTIONS
  ========================== */
  const toggleSound = () => {
    const muted = towerSound.toggleMute();
    setIsSoundMuted(muted);
  };

  const playButtonClickSound = () => {
    towerSound.playButtonClick();
  };

  const playCardFlipSound = () => {
    towerSound.safePlay(() => {
      const oscillator = towerSound.audioContext.createOscillator();
      const gainNode = towerSound.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(towerSound.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, towerSound.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, towerSound.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(towerSound.audioContext.currentTime + 0.1);
      
      towerSound.registerSound(oscillator, gainNode);
    });
  };

  const playCardMatchSound = () => {
    towerSound.safePlay(() => {
      // Play a positive match sound
      const oscillator1 = towerSound.audioContext.createOscillator();
      const gainNode1 = towerSound.audioContext.createGain();
      const oscillator2 = towerSound.audioContext.createOscillator();
      const gainNode2 = towerSound.audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(towerSound.audioContext.destination);
      oscillator2.connect(gainNode2);
      gainNode2.connect(towerSound.audioContext.destination);
      
      oscillator1.type = 'triangle';
      oscillator1.frequency.setValueAtTime(523.25, towerSound.audioContext.currentTime); // C5
      oscillator2.type = 'triangle';
      oscillator2.frequency.setValueAtTime(659.25, towerSound.audioContext.currentTime); // E5
      
      gainNode1.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
      gainNode2.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(towerSound.audioContext.currentTime + 0.3);
      oscillator2.stop(towerSound.audioContext.currentTime + 0.3);
      
      towerSound.registerSound(oscillator1, gainNode1);
      towerSound.registerSound(oscillator2, gainNode2);
    });
  };

  const playCardMismatchSound = () => {
    towerSound.safePlay(() => {
      // Play a negative mismatch sound
      const oscillator = towerSound.audioContext.createOscillator();
      const gainNode = towerSound.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(towerSound.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(400, towerSound.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, towerSound.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.15 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(towerSound.audioContext.currentTime + 0.2);
      
      towerSound.registerSound(oscillator, gainNode);
    });
  };

  const playGameStartSound = () => {
    towerSound.safePlay(() => {
      // Card shuffling sound
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(200 + Math.random() * 100, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.1 * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.05);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.05);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, i * 100);
      }
    });
  };

  const playGameCompleteSound = () => {
    towerSound.playVictoryCelebration();
  };

  const playGameOverSound = () => {
    towerSound.playTowerCrash();
  };

  const playCashOutSound = () => {
    towerSound.playCashOut();
  };

  const playErrorSound = () => {
    towerSound.playWarningSound();
  };

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
    setMatchedPairs(0);
    setAttempts(0);
    setSelectedCards([]);
    
    if (refreshWallet) {
      await refreshWallet();
    }
    
    setRefreshing(false);
  };

  /* =========================
     START GAME
  ========================== */
  const startGame = async () => {
    playButtonClickSound();
    setError('');

    if (!Number.isFinite(numericBet) || numericBet <= 0) {
      setError('Enter a valid stake amount');
      playErrorSound();
      return;
    }

    if (numericBet < MIN_BET) {
      setError(`Minimum stake is ₦${MIN_BET.toLocaleString("en-NG")}`);
      playErrorSound();
      return;
    }

    if (numericBet > combinedBalance) {
      setError('Insufficient balance');
      playErrorSound();
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

      // Initialize cards array based on grid size
      const initialCards = Array(res.data.cards_count).fill(null).map((_, i) => ({
        id: i,
        isRevealed: false,
        isMatched: false,
        value: null, // Will store the card value from backend
        symbol: null, // Will store the emoji symbol
      }));

      setGameId(res.data.game_id);
      setCards(initialCards);
      setMatchedPairs(0);
      setAttempts(0);
      setSelectedCards([]);
      setGameStatus('playing');
      setShowModal(false);
      setLastWin(null);

      // Play game start sound
      playGameStartSound();

      if (refreshWallet) {
        await refreshWallet();
      }

    } catch (err) {
      console.error("Game start error:", err);
      setError(err.response?.data?.error || 'Failed to start game');
      playErrorSound();
    }
  };

  /* =========================
     CARD CLICK - FIXED VERSION
  ========================== */
  const handleCardClick = async (index) => {
    if (locked || refreshing) return;
    if (gameStatus !== 'playing') return;
    if (!gameId) return;
    if (selectedCards.length === 2) return;
    if (cards[index].isMatched || cards[index].isRevealed) return;

    playCardFlipSound();
    setLocked(true);

    try {
      const res = await cardService.revealCard({
        game_id: gameId,
        card_index: index,
      });

      // Get the card value from backend response
      const cardValue = res.data.card_value;
      console.log('Card revealed:', { index, value: cardValue, response: res.data });
      
      // Convert numeric value to symbol (backend returns 1, 2, 3, etc.)
      const symbolIndex = (cardValue - 1) % symbols.length;
      const symbol = symbols[symbolIndex] || '❓';

      // Update the clicked card
      const updatedCards = [...cards];
      updatedCards[index] = {
        ...updatedCards[index],
        isRevealed: true,
        value: cardValue,
        symbol: symbol
      };
      setCards(updatedCards);

      const picks = [...selectedCards, index];
      setSelectedCards(picks);

      /* FIRST PICK - Wait for second pick */
      if (res.data.match_found === null) {
        console.log('First pick, waiting for second');
        setLocked(false);
        return;
      }

      /* SECOND PICK - Handle match result */
      if (res.data.match_found === true) {
        console.log('Match found!');
        // Play match sound
        playCardMatchSound();
        
        // Match found
        setTimeout(() => {
          const newCards = [...updatedCards];
          picks.forEach(i => {
            newCards[i].isMatched = true;
          });
          setCards(newCards);
          setSelectedCards([]);
          setMatchedPairs(res.data.matches_found);
          setLocked(false);
        }, 800);
      } else {
        // No match
        console.log('No match');
        playCardMismatchSound();
        setAttempts(prev => prev + 1);
        
        setTimeout(() => {
          const newCards = [...updatedCards];
          picks.forEach(i => {
            newCards[i].isRevealed = false;
            newCards[i].value = null;
            newCards[i].symbol = null;
          });
          setCards(newCards);
          setSelectedCards([]);
          setLocked(false);
        }, 1200);
      }

      /* GAME FAILED */
      if (res.data.status === 'failed') {
        console.log('Game failed');
        setGameStatus('failed');
        playGameOverSound();
        setTimeout(() => {
          setShowLossModal(true);
        }, 1500);
      }

      /* GAME COMPLETED */
      if (res.data.status === 'completed') {
        console.log('Game completed!', res.data);
        setGameStatus('completed');
        setLastWin({
          win_amount: res.data.win_amount,
          matches_found: res.data.matches_found,
        });

        // Play victory sound
        playGameCompleteSound();

        if (refreshWallet) {
          await refreshWallet();
        }

        setTimeout(() => {
          setShowWinModal(true);
        }, 1000);
      }

    } catch (err) {
      console.error("Card reveal error:", err);
      setLocked(false);
      playErrorSound();
    }
  };

  /* =========================
     CASH OUT EARLY
  ========================== */
  const cashOutEarly = async () => {
    if (!gameId || gameStatus !== 'playing' || refreshing) return;

    playButtonClickSound();

    try {
      const res = await cardService.cashOut({
        game_id: gameId,
      });

      setGameStatus('cashed_out');
      setLastWin({
        win_amount: res.data.win_amount,
      });

      // Play cash out sound
      playCashOutSound();

      if (refreshWallet) {
        await refreshWallet();
      }

      alert(`Cashed out ${formatNGN(res.data.win_amount)}`);

    } catch (err) {
      console.error("Cash out error:", err);
      playErrorSound();
    }
  };

  /* =========================
     RENDER CARD CONTENT - FIXED
  ========================== */
  const renderCardContent = (card, index) => {
    if (card.isRevealed && card.symbol) {
      return (
        <div className="card-back">
          <span>{card.symbol}</span>
        </div>
      );
    } else {
      return (
        <div className="card-front">
          <span className="card-back-text">?</span>
        </div>
      );
    }
  };

  /* =========================
     RENDER
  ========================== */
  return (
    <div className="card-matching-game">

      {/* HEADER */}
      <div className="game-header">
        <button 
          onClick={() => {
            playButtonClickSound();
            navigate('/');
          }} 
          className="back-button"
        >
          ← Back
        </button>
        
        {/* Sound Toggle Button */}
        <button 
          className="sound-toggle"
          onClick={toggleSound}
        >
          {isSoundMuted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* STAKE MODAL */}
      {showModal && (
        <div className="stake-modal-overlay animated-fadeIn">
          <div className="stake-modal animated-slideUp">
            <div className="panel-header-glow">
              <h3>🎴 Card Matching</h3>
            </div>

            <div className="game-description">
              <p>Match all card pairs to win!</p>
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Difficulty Level</label>
                <div className="option-buttons">
                  {difficulties.map(d => (
                    <button
                      key={d.size}
                      className={gridSize === d.size ? "active" : ""}
                      onClick={() => {
                        playButtonClickSound();
                        setGridSize(d.size);
                      }}
                      disabled={walletLoading || refreshing}
                      onMouseEnter={playButtonClickSound}
                    >
                      {d.label} ({d.size} cards)
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="stake-input-group">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                placeholder="1000"
                value={betAmount}
                onChange={(e) => {
                  playButtonClickSound();
                  setBetAmount(e.target.value);
                }}
                onFocus={playButtonClickSound}
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
              onMouseEnter={playButtonClickSound}
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

          {gameStatus === 'playing' && (
            <div className="action-buttons">
              <button 
                onClick={cashOutEarly}
                onMouseEnter={playButtonClickSound}
              >
                💰 Cash Out
              </button>
            </div>
          )}

          <div className="grid-container">
            <div 
              className="cards-grid"
              style={{ 
                gridTemplateColumns: `repeat(${Math.sqrt(gridSize)}, 1fr)`,
                maxWidth: gridSize === 24 ? '700px' : gridSize === 20 ? '600px' : '500px'
              }}
            >
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={`card ${card.isRevealed ? 'flipped' : ''} ${card.isMatched ? 'matched' : ''}`}
                  onClick={() => handleCardClick(index)}
                  style={{
                    cursor: (locked || card.isMatched || card.isRevealed) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {renderCardContent(card, index)}
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
                  </div>
                </div>
              )}

              <button
                className="restart-btn"
                onClick={() => {
                  playButtonClickSound();
                  deepRefresh();
                }}
                disabled={refreshing}
                onMouseEnter={playButtonClickSound}
              >
                {refreshing ? "Refreshing..." : "🔁 Play Again"}
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
              <span className="win-amount">
                {formatNGN(lastWin.win_amount)}
              </span>
            </div>
            
            <div className="win-stats">
              <div className="stat-item">
                <span>Matches Found:</span>
                <span>{lastWin.matches_found}/{gridSize / 2}</span>
              </div>
              <div className="stat-item">
                <span>Attempts Used:</span>
                <span>{attempts}</span>
              </div>
            </div>
            
            <button
              className="continue-button"
              onClick={() => {
                playButtonClickSound();
                setShowWinModal(false);
                deepRefresh();
              }}
              disabled={refreshing}
              onMouseEnter={playButtonClickSound}
            >
              {refreshing ? "Refreshing..." : "🎮 Continue Playing"}
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
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake:</span>
                <span>{formatNGN(numericBet)}</span>
              </div>
              <div className="stat-item">
                <span>Matches Found:</span>
                <span>{matchedPairs}</span>
              </div>
            </div>
            
            <button
              className="try-again-button"
              onClick={() => {
                playButtonClickSound();
                setShowLossModal(false);
                deepRefresh();
              }}
              disabled={refreshing}
              onMouseEnter={playButtonClickSound}
            >
              {refreshing ? "Refreshing..." : "🔁 Try Again"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardMatchingGame;