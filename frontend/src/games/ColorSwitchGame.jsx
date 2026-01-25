import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { colorSwitchService } from "../services/api";
import { towerSound } from "../utils/TowerSoundManager";
import "./ColorSwitchGame.css";

const ColorSwitchGame = ({ user }) => {
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

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`;

  const COLORS = [
    { key: "red", emoji: "🔴", className: "color-red", color: "#EF4444" },
    { key: "blue", emoji: "🔵", className: "color-blue", color: "#3B82F6" },
    { key: "green", emoji: "🟢", className: "color-green", color: "#10B981" },
    { key: "yellow", emoji: "🟡", className: "color-yellow", color: "#F59E0B" },
    { key: "purple", emoji: "🟣", className: "color-purple", color: "#8B5CF6" },
    { key: "orange", emoji: "🟠", className: "color-orange", color: "#F97316" },
  ];

  /* -------------------- STATE -------------------- */
  const [stake, setStake] = useState(1000);
  const [sequenceLength, setSequenceLength] = useState(5);
  const [gameId, setGameId] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [multiplier, setMultiplier] = useState(1);
  const [potentialWinRatio, setPotentialWinRatio] = useState(0);
  const [potentialWinTier, setPotentialWinTier] = useState("playing");
  const [status, setStatus] = useState("idle");
  const [showModal, setShowModal] = useState(true);
  const [showSequence, setShowSequence] = useState(false);
  const [error, setError] = useState("");
  const [lastWin, setLastWin] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(
    localStorage.getItem('tower_sounds_muted') === 'true'
  );

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

  const playSequenceSelectSound = () => {
    towerSound.playHeightSelect(); // Reusing height select sound
  };

  const playGameStartSound = () => {
    towerSound.safePlay(() => {
      // Colorful startup sound
      const colors = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      colors.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.15);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.15);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 100);
      });
    });
  };

  const playColorClickSound = (colorIndex) => {
    const colorFrequencies = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00]; // Different tones for each color
    
    towerSound.safePlay(() => {
      const oscillator = towerSound.audioContext.createOscillator();
      const gainNode = towerSound.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(towerSound.audioContext.destination);
      
      const baseFreq = colorFrequencies[colorIndex % colorFrequencies.length];
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(baseFreq, towerSound.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, towerSound.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(towerSound.audioContext.currentTime + 0.1);
      
      towerSound.registerSound(oscillator, gainNode);
    });
  };

  const playSequenceRevealSound = (index) => {
    const notes = [261.63, 329.63, 392.00, 493.88, 587.33]; // C4, E4, G4, B4, D5
    
    setTimeout(() => {
      towerSound.safePlay(() => {
        const oscillator = towerSound.audioContext.createOscillator();
        const gainNode = towerSound.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(towerSound.audioContext.destination);
        
        const noteIndex = index % notes.length;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(notes[noteIndex], towerSound.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0.25 * towerSound.masterVolume, towerSound.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.4);
        
        oscillator.start();
        oscillator.stop(towerSound.audioContext.currentTime + 0.4);
        
        towerSound.registerSound(oscillator, gainNode);
      });
    }, index * 400); // Adjust timing to match visual animation
  };

  const playCorrectSequenceSound = () => {
    towerSound.safePlay(() => {
      // Happy ascending scale for correct sequence
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.2);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 150);
      });
    });
  };

  const playWrongSequenceSound = () => {
    towerSound.safePlay(() => {
      // Sad descending scale for wrong sequence
      const notes = [523.25, 466.16, 415.30, 349.23]; // C5, A#4, G#4, F4
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.25 * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.25);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.25);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 100);
      });
    });
  };

  const playGameCompleteSound = (tier) => {
    const tierVolumes = {
      'low': 0.2,
      'normal': 0.25,
      'high': 0.3,
      'jackpot': 0.35,
      'mega_jackpot': 0.4
    };
    
    const volume = tierVolumes[tier] || 0.25;
    
    towerSound.safePlay(() => {
      // Victory fanfare for completing the game
      const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          towerSound.safePlay(() => {
            const oscillator = towerSound.audioContext.createOscillator();
            const gainNode = towerSound.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(towerSound.audioContext.destination);
            
            oscillator.type = ['sine', 'triangle', 'square', 'sawtooth', 'sine'][index % 5];
            oscillator.frequency.setValueAtTime(freq, towerSound.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(volume * towerSound.masterVolume, towerSound.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, towerSound.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(towerSound.audioContext.currentTime + 0.3);
            
            towerSound.registerSound(oscillator, gainNode);
          });
        }, index * 150);
      });
    });
  };

  const playCashOutSound = () => {
    towerSound.playCashOut();
  };

  const playErrorSound = () => {
    towerSound.playWarningSound();
  };

  /* -------------------- DEEP REFRESH -------------------- */
  const deepRefresh = async () => {
    setShowModal(true);
    setStatus("idle");
    setSequence([]);
    setPlayerSequence([]);
    setGameId(null);
    setLastWin(null);
    setShowWinModal(false);
    setShowLossModal(false);
    
    if (refreshWallet) {
      await refreshWallet();
    }
  };

  /* -------------------- START GAME -------------------- */
  const startGame = async () => {
    playButtonClickSound();
    setError("");

    if (stake < 100) {
      setError("Minimum stake is ₦100");
      playErrorSound();
      return;
    }

    if (stake > combinedBalance) {
      setError("Insufficient balance");
      playErrorSound();
      return;
    }

    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    try {
      console.log("Starting game with:", {
        bet_amount: stake,
        sequence_length: sequenceLength,
        combinedBalance,
        spotBalance,
        walletBalance: wallet?.balance
      });

      const res = await colorSwitchService.startGame({
        bet_amount: stake,
        sequence_length: sequenceLength,
      });

      console.log("Game started successfully:", res.data);

      setGameId(res.data.game_id);
      setSequence(res.data.sequence);
      setPlayerSequence([]);
      setMultiplier(1);
      setPotentialWinRatio(0);
      setPotentialWinTier("playing");
      setStatus("showing");
      setShowModal(false);

      // Play game start sound
      playGameStartSound();

      if (refreshWallet) {
        await refreshWallet();
      }

      // Show animated sequence with sounds
      setShowSequence(true);
      setIsAnimating(true);
      
      // Play reveal sounds for each color in sequence
      res.data.sequence.forEach((_, index) => {
        playSequenceRevealSound(index);
      });
      
      setTimeout(() => {
        setShowSequence(false);
        setIsAnimating(false);
        setStatus("playing");
      }, res.data.sequence.length * 700 + 800);
    } catch (err) {
      console.error("Game start error:", err);
      console.error("Error response:", err.response);
      console.error("Error data:", err.response?.data);
      console.error("Error status:", err.response?.status);
      
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to start game";
      
      setError(`Error: ${errorMessage}\n\nCheck console for details (F12 → Console)`);
      playErrorSound();
    }
  };

  /* -------------------- COLOR CLICK -------------------- */
  const handleColorClick = (colorKey, colorIndex) => {
    if (status !== "playing" || isAnimating) return;

    // Play color-specific sound
    playColorClickSound(colorIndex);

    const next = [...playerSequence, colorKey];
    setPlayerSequence(next);

    if (next.length === sequence.length) {
      submitSequence(next);
    }
  };

  /* -------------------- SUBMIT SEQUENCE -------------------- */
  const submitSequence = async (playerSeq) => {
    try {
      const res = await colorSwitchService.submitSequence({
        game_id: gameId,
        player_sequence: playerSeq,
      });

      const data = res.data;

      if (data.status === "lost" || !data.correct) {
        playWrongSequenceSound();
        setStatus("lost");
        setTimeout(() => {
          setShowLossModal(true);
        }, 1000);
        return;
      }

      // Play correct sequence sound
      playCorrectSequenceSound();

      setMultiplier(data.multiplier);
      setPotentialWinRatio(data.potential_win_ratio || 0);
      setPotentialWinTier(data.potential_win_tier || "playing");
      setSequence(data.next_sequence);
      setPlayerSequence([]);
      setStatus("showing");

      setShowSequence(true);
      setIsAnimating(true);
      
      // Play reveal sounds for next sequence
      data.next_sequence.forEach((_, index) => {
        playSequenceRevealSound(index);
      });
      
      setTimeout(() => {
        setShowSequence(false);
        setIsAnimating(false);
        setStatus("playing");
      }, data.next_sequence.length * 700 + 800);
    } catch (err) {
      playWrongSequenceSound();
      setStatus("lost");
      setTimeout(() => {
        setShowLossModal(true);
      }, 1000);
    }
  };

  /* -------------------- CASH OUT -------------------- */
  const cashOut = async () => {
    playButtonClickSound();
    
    try {
      const res = await colorSwitchService.cashOut({
        game_id: gameId,
      });

      setLastWin({
        win_amount: res.data.win_amount,
        win_ratio: res.data.win_ratio,
        win_tier: res.data.win_tier,
        multiplier: res.data.multiplier,
        sequence_length: res.data.sequence_length,
      });

      // Play cash out sound
      playCashOutSound();

      if (refreshWallet) {
        await refreshWallet();
      }

      // Play game complete sound for big wins
      if (res.data.win_ratio > 0.5) {
        playGameCompleteSound(res.data.win_tier);
        setTimeout(() => {
          setShowWinModal(true);
        }, 500);
      }

      setStatus("cashed_out");
    } catch (err) {
      console.error("Cash out error:", err);
      playErrorSound();
      alert("Cash out failed");
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

  /* -------------------- RENDER -------------------- */
  return (
    <div className="color-switch-game">
      {/* HEADER */}
      <header className="game-header">
        <button 
          onClick={() => {
            playButtonClickSound();
            navigate("/");
          }}
        >
          ← Back
        </button>
        <div className="game-title">
          <span className="game-icon">🎨</span>
          <h2>Color Switch</h2>
        </div>
        
        {/* Sound Toggle Button */}
        <button 
          className="sound-toggle"
          onClick={toggleSound}
        >
          {isSoundMuted ? "🔇" : "🔊"}
        </button>
        
        <div className="balance-details">
          <div className="balance-total">
            {walletLoading ? (
              <div className="balance-loading">
                <span className="loading-spinner-small" />
                Loading...
              </div>
            ) : (
              formatNaira(combinedBalance)
            )}
          </div>
          <div className="balance-breakdown">
            <span className="balance-main">Main: {formatNaira(wallet?.balance || 0)}</span>
            <span className="balance-spot">Spot: {formatNaira(spotBalance)}</span>
          </div>
        </div>
      </header>

      {/* STAKE MODAL */}
      {showModal && (
        <div className="modal-overlay stake-modal-overlay">
          <div className="stake-modal animated-slideUp">
            <div className="modal-header">
              <h3>🎨 Color Switch</h3>
            </div>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  formatNaira(combinedBalance)
                )}
              </span>
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Sequence Length</label>
                <div className="option-buttons">
                  {[5, 6, 7].map(length => (
                    <button
                      key={length}
                      className={sequenceLength === length ? "active" : ""}
                      onClick={() => {
                        playSequenceSelectSound();
                        setSequenceLength(length);
                      }}
                      disabled={walletLoading}
                      onMouseEnter={playButtonClickSound}
                    >
                      {length} Colors
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
                min={100}
                step={100}
                onChange={(e) => {
                  playStakeSelectSound();
                  setStake(Number(e.target.value));
                }}
                onFocus={playButtonClickSound}
                disabled={walletLoading}
              />
            </div>

            {error && <div className="error-banner">{error}</div>}

            <button
              className="start-btn animated-pulse"
              onClick={startGame}
              disabled={walletLoading || stake > combinedBalance}
              onMouseEnter={playButtonClickSound}
            >
              {walletLoading ? "LOADING..." : "🎮 START CHALLENGE"}
            </button>
          </div>
        </div>
      )}

      {/* GAME AREA */}
      {!showModal && (
        <div className="game-area">
          <div className="game-info-bar">
            <div className="info-item">
              <span>Multiplier</span>
              <strong className="multiplier-display">{multiplier.toFixed(2)}x</strong>
            </div>
            <div className="info-item">
              <span>Sequence</span>
              <strong>{sequence.length} Colors</strong>
            </div>
            <div className="info-item">
              <span>Potential Win</span>
              <strong style={{color: getWinTierColor(potentialWinTier)}}>
                {potentialWinTier === "playing" ? "Calculating..." : 
                 `${(potentialWinRatio * 100).toFixed(1)}%`}
              </strong>
            </div>
          </div>

          {showSequence && (
            <div className="sequence-show animated-fadeIn">
              <h3>Memorize This Sequence:</h3>
              <div className="sequence-display">
                {sequence.map((colorKey, index) => {
                  const color = COLORS.find(c => c.key === colorKey);
                  return (
                    <div 
                      key={index} 
                      className={`sequence-color animated-bounceIn`}
                      style={{
                        animationDelay: `${index * 0.3}s`,
                        backgroundColor: color?.color,
                        borderColor: color?.color
                      }}
                    >
                      {color?.emoji}
                    </div>
                  );
                })}
              </div>
              <p className="sequence-hint">Watch carefully, then repeat!</p>
            </div>
          )}

          {status === "playing" && !showSequence && (
            <div className="game-play-area">
              <h3>Your Turn: Repeat the Sequence</h3>
              <div className="player-progress">
                <div className="progress-text">
                  {playerSequence.length} / {sequence.length} Colors
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{width: `${(playerSequence.length / sequence.length) * 100}%`}}
                  />
                </div>
              </div>
              
              <div className="color-grid">
                {COLORS.map((color, index) => (
                  <button
                    key={color.key}
                    className={`color-btn ${color.className} animated-pulse`}
                    style={{backgroundColor: color.color}}
                    onClick={() => handleColorClick(color.key, index)}
                    disabled={isAnimating}
                    onMouseEnter={playButtonClickSound}
                  >
                    <span className="color-emoji">{color.emoji}</span>
                  </button>
                ))}
              </div>
              
              <div className="player-sequence">
                <h4>Your Sequence:</h4>
                <div className="sequence-preview">
                  {playerSequence.map((colorKey, index) => {
                    const color = COLORS.find(c => c.key === colorKey);
                    return (
                      <div 
                        key={index} 
                        className="sequence-preview-color"
                        style={{backgroundColor: color?.color}}
                      >
                        {color?.emoji}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {(status === "playing" || status === "showing") && !showSequence && (
            <div className="action-buttons">
              <button 
                className="cashout-btn animated-pulse-glow" 
                onClick={cashOut}
                onMouseEnter={playButtonClickSound}
              >
                💰 CASH OUT 
                <span className="cashout-amount">
                  {formatNaira(stake * multiplier)}
                </span>
              </button>
            </div>
          )}

          {(status === "lost" || status === "cashed_out") && !showSequence && (
            <div className="result-section animated-fadeIn">
              <div className="result-message">
                {status === "lost" ? (
                  <>
                    <div className="result-icon">💥</div>
                    <h3>Sequence Wrong!</h3>
                    <p>You made a mistake in the sequence.</p>
                  </>
                ) : (
                  <>
                    <div className="result-icon">💰</div>
                    <h3>Cashed Out Successfully!</h3>
                    <p>Winnings added to your spot balance</p>
                  </>
                )}
              </div>
              
              {lastWin && status === "cashed_out" && (
                <div className="win-details">
                  <div className="win-amount-display">
                    <span className="win-label">You Won</span>
                    <span className="win-amount">{formatNaira(lastWin.win_amount)}</span>
                    <span className="win-ratio">
                      ({lastWin.win_ratio > 0 ? (lastWin.win_ratio * 100).toFixed(1) : '0'}% of stake)
                    </span>
                  </div>
                </div>
              )}

              <button 
                className="restart-btn" 
                onClick={() => {
                  playButtonClickSound();
                  deepRefresh();
                }}
                onMouseEnter={playButtonClickSound}
              >
                🔁 PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && lastWin && (
        <div className="modal-overlay win-modal-overlay">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="win-icon">🏆</div>
              <h2>Color Master!</h2>
              <p className="win-subtitle">Perfect memory skills!</p>
            </div>
            
            <div className="win-amount-display">
              <span className="win-amount-label">You won</span>
              <span className="win-amount" style={{color: getWinTierColor(lastWin.win_tier)}}>
                {formatNaira(lastWin.win_amount)}
              </span>
              <p className="win-note">
                {lastWin.win_tier === "mega_jackpot" ? "MEGA COLOR JACKPOT!" : 
                 lastWin.win_tier === "jackpot" ? "COLOR JACKPOT!" : 
                 "Amazing memory!"}
              </p>
            </div>
            
            <div className="win-stats">
              <div className="stat-item">
                <span>Win Ratio:</span>
                <span>{(lastWin.win_ratio * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item">
                <span>Multiplier:</span>
                <span>{lastWin.multiplier.toFixed(2)}x</span>
              </div>
              <div className="stat-item">
                <span>Sequence Length:</span>
                <span>{lastWin.sequence_length} Colors</span>
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
              onMouseEnter={playButtonClickSound}
            >
              🎮 Play Again
            </button>
          </div>
        </div>
      )}

      {/* LOSS MODAL */}
      {showLossModal && (
        <div className="modal-overlay loss-modal-overlay">
          <div className="loss-modal-content animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon">💔</div>
              <h2>Memory Failed</h2>
              <p className="loss-subtitle">Wrong sequence!</p>
            </div>
            
            <div className="loss-message">
              <p className="loss-encouragement">
                Color sequences can be tricky!
                <br />
                <span className="loss-tip">Try shorter sequences first!</span>
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake:</span>
                <span>{formatNaira(stake)}</span>
              </div>
              <div className="stat-item">
                <span>Sequence Length:</span>
                <span>{sequence.length} Colors</span>
              </div>
              <div className="stat-item">
                <span>Multiplier:</span>
                <span>{multiplier.toFixed(2)}x</span>
              </div>
            </div>
            
            <button
              className="try-again-button"
              onClick={() => {
                playButtonClickSound();
                setShowLossModal(false);
                deepRefresh();
              }}
              onMouseEnter={playButtonClickSound}
            >
              🔁 Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorSwitchGame;