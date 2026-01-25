import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { guessingService } from "../services/api";
import { towerSound } from "../utils/TowerSoundManager";
import "./NumberGuessingGame.css";

const MIN_STAKE = 100;

const NumberGuessingGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();
  const soundInitialized = useRef(false);

  /* -------------------- HELPER FUNCTIONS -------------------- */
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

  const formatNGN = (v) => `₦${Number(v || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

  /* -------------------- STATE -------------------- */
  const [stake, setStake] = useState(MIN_STAKE);
  const [maxNumber, setMaxNumber] = useState(100);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [guess, setGuess] = useState("");
  const [game, setGame] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [proximityHint, setProximityHint] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState(10);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [isSoundMuted, setIsSoundMuted] = useState(
    localStorage.getItem('tower_sounds_muted') === 'true'
  );

  const difficulties = [
    { label: "Hard", maxNumber: 200, maxAttempts: 8, description: "1-200, 8 attempts" },
    { label: "Expert", maxNumber: 500, maxAttempts: 6, description: "1-500, 6 attempts" },
    { label: "Master", maxNumber: 1000, maxAttempts: 5, description: "1-1000, 5 attempts" },
  ];

  const numericStake = Number(stake);

  const canStart = 
    numericStake >= MIN_STAKE &&
    numericStake <= combinedBalance &&
    !walletLoading &&
    !refreshing;

  /* -------------------- SOUND INITIALIZATION -------------------- */
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

  /* -------------------- SOUND CONTROL FUNCTIONS -------------------- */
  const toggleSound = () => {
    const muted = towerSound.toggleMute();
    setIsSoundMuted(muted);
  };

  const playButtonClickSound = () => {
    towerSound.playButtonClick();
  };

  const playStakeSelectSound = () => {
    towerSound.playStakeSelect();
  };

  const playDifficultySelectSound = () => {
    towerSound.playHeightSelect(); // Reusing height select sound
  };

  const playGameStartSound = () => {
    towerSound.safePlay(() => {
      // Number selection sound - ascending scale
      const notes = [523.25, 587.33, 659.25, 698.46, 783.99]; // C5, D5, E5, F5, G5
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.15 * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.1);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 80);
      });
    });
  };

  const playGuessSubmitSound = () => {
    towerSound.safePlay(() => {
      const oscillator = towerSound.audioContext.createOscillator();
      const gainNode = towerSound.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(towerSound.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, towerSound.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, towerSound.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(towerSound.audioContext.currentTime + 0.1);
      
      towerSound.registerSound(oscillator, gainNode);
    });
  };

  const playCorrectGuessSound = (tier) => {
    const tierVolumes = {
      'low': 0.2,
      'normal': 0.25,
      'high': 0.3,
      'jackpot': 0.35,
      'mega_jackpot': 0.4
    };
    
    const volume = tierVolumes[tier] || 0.25;
    
    towerSound.safePlay(() => {
      // Victory fanfare
      const notes = [659.25, 783.99, 1046.50, 1318.51]; // E5, G5, C6, E6
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = ['sine', 'triangle', 'square', 'sawtooth'][index % 4];
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(volume * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.3);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 200);
      });
    });
  };

  const playWrongGuessSound = (proximity) => {
    const proximitySounds = {
      'Very Hot': 700, // High pitch for hot
      'Hot': 600,
      'Warm': 500,
      'Cool': 400,
      'Cold': 300  // Low pitch for cold
    };
    
    const baseFreq = proximitySounds[proximity] || 400;
    
    towerSound.safePlay(() => {
      const oscillator = towerSound.audioContext.createOscillator();
      const gainNode = towerSound.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(towerSound.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFreq, towerSound.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, towerSound.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.18 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(towerSound.audioContext.currentTime + 0.2);
      
      towerSound.registerSound(oscillator, gainNode);
    });
  };

  const playHintSound = () => {
    towerSound.safePlay(() => {
      const oscillator1 = towerSound.audioContext.createOscillator();
      const gainNode1 = towerSound.audioContext.createGain();
      const oscillator2 = towerSound.audioContext.createOscillator();
      const gainNode2 = towerSound.audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(towerSound.audioContext.destination);
      oscillator2.connect(gainNode2);
      gainNode2.connect(towerSound.audioContext.destination);
      
      oscillator1.type = 'triangle';
      oscillator1.frequency.setValueAtTime(800, towerSound.audioContext.currentTime);
      oscillator2.type = 'triangle';
      oscillator2.frequency.setValueAtTime(1200, towerSound.audioContext.currentTime);
      
      gainNode1.gain.setValueAtTime(0.15 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
      gainNode2.gain.setValueAtTime(0.15 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(towerSound.audioContext.currentTime + 0.3);
      oscillator2.stop(towerSound.audioContext.currentTime + 0.3);
      
      towerSound.registerSound(oscillator1, gainNode1);
      towerSound.registerSound(oscillator2, gainNode2);
    });
  };

  const playGameOverSound = () => {
    towerSound.playTowerCrash();
  };

  const playErrorSound = () => {
    towerSound.playWarningSound();
  };

  /* -------------------- DEEP REFRESH -------------------- */
  const deepRefresh = async () => {
    setRefreshing(true);
    setShowModal(true);
    setGame(null);
    setLastWin(null);
    setShowWinModal(false);
    setShowLossModal(false);
    setFeedback(null);
    setProximityHint("");
    
    if (refreshWallet) {
      await refreshWallet();
    }
    
    setRefreshing(false);
  };

  /* -------------------- START GAME -------------------- */
  const startGame = async () => {
    playButtonClickSound();

    if (walletLoading) {
      alert("Please wait while your balance loads...");
      return;
    }

    if (numericStake < MIN_STAKE) {
      alert(`Minimum stake is ₦${MIN_STAKE.toLocaleString("en-NG")}`);
      playErrorSound();
      return;
    }

    if (numericStake > combinedBalance) {
      alert("Insufficient balance");
      playErrorSound();
      return;
    }

    try {
      const res = await guessingService.startGame({
        bet_amount: numericStake,
        max_number: maxNumber,
        max_attempts: maxAttempts,
      });

      setGame({ id: res.data.game_id });
      setRemainingAttempts(maxAttempts);
      setAttemptsUsed(0);
      setFeedback(null);
      setProximityHint("");
      setShowModal(false);
      setLastWin(null);

      // Play game start sound
      playGameStartSound();

      if (refreshWallet) {
        await refreshWallet();
      }

      // Add to game history
      setGameHistory(prev => [{
        type: 'start',
        stake: numericStake,
        maxNumber,
        maxAttempts,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev.slice(0, 9)]);

    } catch (err) {
      console.error("Game start error:", err);
      alert(err.response?.data?.error || "Failed to start game");
      playErrorSound();
    }
  };

  /* -------------------- SUBMIT GUESS -------------------- */
  const submitGuess = async () => {
    if (!guess || !game || refreshing) return;

    playGuessSubmitSound();

    const guessNum = Number(guess);
    if (isNaN(guessNum) || guessNum < 1 || guessNum > maxNumber) {
      setFeedback(`Please enter a number between 1 and ${maxNumber}`);
      playErrorSound();
      return;
    }

    try {
      const res = await guessingService.makeGuess({
        game_id: game.id,
        guess: guessNum,
      });

      setAttemptsUsed(prev => prev + 1);
      setRemainingAttempts(res.data.remaining_attempts || maxAttempts - (attemptsUsed + 1));

      if (res.data.status === "won") {
        setLastWin({
          win_amount: res.data.win_amount,
          win_ratio: res.data.win_ratio,
          win_tier: res.data.win_tier,
          multiplier: res.data.multiplier,
          attempts_used: res.data.attempts_used,
          target_number: res.data.target_number,
        });

        // Play win sound based on tier
        playCorrectGuessSound(res.data.win_tier);

        if (refreshWallet) {
          await refreshWallet();
        }

        // Show win modal for significant wins
        setTimeout(() => {
          if (res.data.win_ratio > 0.5) {
            setShowWinModal(true);
          }
        }, 800);

        // Add to game history
        setGameHistory(prev => [{
          type: 'win',
          stake: numericStake,
          win_amount: res.data.win_amount,
          win_ratio: res.data.win_ratio,
          attempts: res.data.attempts_used,
          target: res.data.target_number,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 9)]);

      } else if (res.data.status === "lost") {
        // Play game over sound
        playGameOverSound();
        
        setTimeout(() => {
          setShowLossModal(true);
        }, 800);

        // Add to game history
        setGameHistory(prev => [{
          type: 'loss',
          stake: numericStake,
          target: res.data.target_number,
          attempts: attemptsUsed + 1,
          timestamp: new Date().toLocaleTimeString()
        }, ...prev.slice(0, 9)]);

      } else {
        // Still playing - play proximity-based sound
        const proximity = res.data.proximity_hint || '';
        if (proximity) {
          playWrongGuessSound(proximity);
        }
        
        setFeedback(`${res.data.hint.toUpperCase()} - ${res.data.proximity_hint}`);
        setProximityHint(res.data.proximity_hint);
      }

      setGuess("");

    } catch (err) {
      console.error("Guess error:", err);
      setFeedback(err.response?.data?.error || "Guess failed");
      playErrorSound();
    }
  };

  /* -------------------- GET HINT -------------------- */
  const getHint = async () => {
    if (!game || refreshing) return;

    playHintSound();

    try {
      const res = await guessingService.getHint({
        game_id: game.id,
      });

      setFeedback(res.data.hint);
      
      // Could deduct a small fee for hint here
      // if (res.data.cost > 0) {
      //   // Update balance
      // }

    } catch (err) {
      console.error("Hint error:", err);
      playErrorSound();
    }
  };

  /* -------------------- GET WIN TIER COLOR -------------------- */
  const getWinTierColor = (tier) => {
    switch(tier) {
      case "low": return "#FFA726";
      case "normal": return "#4CAF50";
      case "high": return "#2196F3";
      case "jackpot": return "#9C27B0";
      case "mega_jackpot": return "#F44336";
      default: return "#666";
    }
  };

  /* -------------------- PROXIMITY COLOR -------------------- */
  const getProximityColor = () => {
    if (!proximityHint) return "#666";
    if (proximityHint.includes("Very Hot")) return "#FF0000";
    if (proximityHint.includes("Hot")) return "#FF5722";
    if (proximityHint.includes("Warm")) return "#FF9800";
    if (proximityHint.includes("Cool")) return "#2196F3";
    return "#607D8B";
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="number-guessing-game">

      {/* AMBIENT ANIMATION */}
      <div className="ambient-animation"></div>

      {/* HEADER */}
      <div className="game-header">
        <button 
          onClick={() => {
            playButtonClickSound();
            navigate("/");
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
              <h3>🎯 Number Guessing</h3>
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
              <p>Guess the number between 1 and your chosen maximum!</p>
              <p className="description-tip">Fewer attempts = Higher rewards!</p>
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Difficulty Level</label>
                <div className="option-buttons">
                  {difficulties.map(d => (
                    <button
                      key={d.label}
                      className={maxNumber === d.maxNumber ? "active" : ""}
                      onClick={() => {
                        playDifficultySelectSound();
                        setMaxNumber(d.maxNumber);
                        setMaxAttempts(d.maxAttempts);
                      }}
                      disabled={walletLoading || refreshing}
                      onMouseEnter={playButtonClickSound}
                    >
                      {d.label}
                      <small>{d.description}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="stake-input-group">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                value={stake}
                min={MIN_STAKE}
                step={100}
                onChange={(e) => {
                  playStakeSelectSound();
                  setStake(e.target.value);
                }}
                onFocus={playButtonClickSound}
                disabled={walletLoading || refreshing}
              />
            </div>

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

      {/* GAMEPLAY */}
      {game && (
        <div className="game-board-section">
          <div className="game-info-bar">
            <div className="info-item">
              <span>Range</span>
              <strong>1 - {maxNumber}</strong>
            </div>
            <div className="info-item">
              <span>Attempts</span>
              <strong>{attemptsUsed}/{maxAttempts}</strong>
            </div>
            <div className="info-item">
              <span>Remaining</span>
              <strong>{remainingAttempts}</strong>
            </div>
          </div>

          <div className="guess-container">
            <div className="guess-input-group">
              <input
                type="number"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder={`Enter number (1-${maxNumber})`}
                min={1}
                max={maxNumber}
                disabled={refreshing}
                onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                onFocus={playButtonClickSound}
              />
              <button 
                className="guess-button"
                onClick={submitGuess}
                disabled={!guess || refreshing}
                onMouseEnter={playButtonClickSound}
              >
                GUESS
              </button>
            </div>

            <button 
              className="hint-button"
              onClick={getHint}
              disabled={refreshing}
              onMouseEnter={playButtonClickSound}
            >
              💡 Get Hint
            </button>
          </div>

          {feedback && (
            <div className="feedback-container">
              <div className="feedback-message" style={{color: getProximityColor()}}>
                {feedback}
              </div>
              {proximityHint && (
                <div className="proximity-indicator" style={{color: getProximityColor()}}>
                  {proximityHint}
                </div>
              )}
            </div>
          )}

          {/* Game History */}
          {gameHistory.length > 0 && (
            <div className="game-history">
              <h4>Recent Game History</h4>
              <div className="history-list">
                {gameHistory.map((item, index) => (
                  <div key={index} className={`history-item ${item.type}`}>
                    <span>
                      {item.type === 'start' ? '🎮 Started' : 
                       item.type === 'win' ? '🎉 Won' : '💀 Lost'}
                    </span>
                    <span>
                      {item.type === 'start' ? `₦${item.stake}` :
                       item.type === 'win' ? `₦${item.win_amount}` : `₦${item.stake}`}
                    </span>
                    <small>{item.timestamp}</small>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && lastWin && (
        <div className="modal-overlay win-modal-overlay animated-fadeIn">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="win-icon">🎯</div>
              <h2>Correct Guess!</h2>
              <p className="win-subtitle">You found the number!</p>
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
                 "Great guess!"}
              </p>
            </div>
            
            <div className="win-stats">
              <div className="stat-item">
                <span>Target Number:</span>
                <span>{lastWin.target_number}</span>
              </div>
              <div className="stat-item">
                <span>Attempts Used:</span>
                <span>{lastWin.attempts_used}</span>
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
                playButtonClickSound();
                setShowWinModal(false);
                deepRefresh();
              }}
              disabled={refreshing}
              onMouseEnter={playButtonClickSound}
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
              <p className="loss-encouragement">
                You used <strong>{attemptsUsed} attempts</strong>
                <br />
                <span className="loss-tip">Try Easy difficulty first to build confidence!</span>
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake:</span>
                <span>{formatNGN(numericStake)}</span>
              </div>
              <div className="stat-item">
                <span>Range:</span>
                <span>1-{maxNumber}</span>
              </div>
              <div className="stat-item">
                <span>Attempts Used:</span>
                <span>{attemptsUsed}</span>
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

export default NumberGuessingGame;