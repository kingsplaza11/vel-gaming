import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { fortuneService } from "../../services/api";
import { fortuneSound } from "../../utils/FortuneSoundManager";
import toast from "react-hot-toast";
import Confetti from "react-confetti";
import "./fortunemouse.css";

const GRID_SIZE = 20;
const MINIMUM_STAKE = 100;

// Flower component for additional visual effects
const Flower = ({ x, y, size, color, rotation, delay }) => {
  return (
    <div 
      className="flower-effect"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${rotation}deg)`,
        animationDelay: `${delay}s`,
        zIndex: 9998,
      }}
    >
      <div className="flower-petal" style={{ backgroundColor: color }}></div>
      <div className="flower-petal" style={{ backgroundColor: color }}></div>
      <div className="flower-petal" style={{ backgroundColor: color }}></div>
      <div className="flower-petal" style={{ backgroundColor: color }}></div>
      <div className="flower-center" style={{ backgroundColor: '#FFD700' }}></div>
    </div>
  );
};

export default function FortuneMouse() {
  const navigate = useNavigate();
  const { 
    wallet, 
    loading: walletLoading, 
    refreshWallet,
    availableBalance
  } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isMuted, setIsMuted] = useState(fortuneSound.isMuted);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFlowers, setShowFlowers] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [game, setGame] = useState({
    status: "idle",
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
    session_id: null,
  });

  const [tiles, setTiles] = useState(() =>
    Array.from({ length: GRID_SIZE }, (_, i) => ({
      id: i,
      revealed: false,
      kind: null,
    }))
  );

  /* =========================
     REFS
  ========================= */
  const tapLock = useRef(false);
  const lastTileRef = useRef(null);
  const confettiTimeoutRef = useRef(null);
  const flowersTimeoutRef = useRef(null);
  const modalTimeoutRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  /* =========================
     GAME RESULTS CONFIGURATION
  ========================= */
  const resultConfig = useMemo(() => ({
    "small_win": {
      icon: "💸",
      label: "Small Win",
      color: "#FFC107",
    },
    "penalty": {
      icon: "⚠️",
      label: "Penalty",
      color: "#FF9800",
    },
    "major_penalty": {
      icon: "💥",
      label: "Major Penalty",
      color: "#F44336",
    },
    "reset": {
      icon: "🔄",
      label: "Reset",
      color: "#2196F3",
    },
    "trap": {
      icon: "💣",
      label: "Trap",
      color: "#9C27B0",
    },
    "auto_cashout": {
      icon: "⏰",
      label: "Auto Cashout",
      color: "#4CAF50",
    }
  }), []);

  /* =========================
     WINDOW SIZE TRACKING WITH DEBOUNCE
  ========================= */
  useEffect(() => {
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      resizeTimeoutRef.current = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  /* =========================
     AUDIO CONTEXT RESUME HANDLING
  ========================= */
  useEffect(() => {
    console.log('Setting up audio context resume');
    
    // Force audio context creation on component mount
    fortuneSound.init();
    
    // Auto-resume audio context on any user interaction
    const resumeAudioOnInteraction = () => {
      console.log('User interaction for audio resume');
      if (fortuneSound.audioContext && fortuneSound.audioContext.state === 'suspended') {
        fortuneSound.audioContext.resume().then(() => {
          console.log('Audio context resumed from component');
        }).catch(error => {
          console.error('Failed to resume audio context:', error);
        });
      }
    };

    // Add listeners for multiple interaction types
    const events = ['click', 'touchstart', 'keydown', 'mousedown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudioOnInteraction, { 
        once: true,
        passive: true 
      });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resumeAudioOnInteraction);
      });
    };
  }, []);

  /* =========================
     AUDIO CONTROLS
  ========================= */
  const toggleMute = () => {
    const muted = fortuneSound.toggleMute();
    setIsMuted(muted);
    toast(muted ? "Sound muted" : "Sound unmuted", {
      icon: muted ? "🔇" : "🔊",
      duration: 1500
    });
  };

  /* =========================
     VISUAL EFFECTS FUNCTIONS
  ========================= */
  const triggerWinEffects = useCallback(() => {
    // Clear any existing timeouts
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    if (flowersTimeoutRef.current) {
      clearTimeout(flowersTimeoutRef.current);
    }

    // Reset confetti key to ensure new instance
    setConfettiKey(prev => prev + 1);
    
    // Show confetti and flowers
    setShowConfetti(true);
    setShowFlowers(true);

    // Hide effects after 5 seconds (reduced from 6)
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    flowersTimeoutRef.current = setTimeout(() => {
      setShowFlowers(false);
    }, 5000);
  }, []);

  const cleanupEffects = useCallback(() => {
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
    if (flowersTimeoutRef.current) {
      clearTimeout(flowersTimeoutRef.current);
    }
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
    }
    setShowConfetti(false);
    setShowFlowers(false);
  }, []);

  /* =========================
     GENERATE FLOWERS (MEMOIZED)
  ========================= */
  const generateFlowers = useMemo(() => {
    if (!showFlowers) return [];
    
    const flowers = [];
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#FFD700', // Gold
      '#A29BFE', // Purple
    ];
    
    for (let i = 0; i < 10; i++) { // Reduced from 15
      flowers.push({
        id: i,
        x: Math.random() * 80 + 10,
        y: Math.random() * 80 + 10,
        size: Math.random() * 30 + 20, // Reduced size
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 1,
      });
    }
    
    return flowers;
  }, [showFlowers]);

  /* =========================
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
    // Cleanup effects
    cleanupEffects();
    
    setGame({
      status: "idle",
      step_index: 0,
      current_multiplier: "1.00",
      payout_amount: "0.00",
      session_id: null,
    });

    setTiles(
      Array.from({ length: GRID_SIZE }, (_, i) => ({
        id: i,
        revealed: false,
        kind: null,
      }))
    );

    tapLock.current = false;
    lastTileRef.current = null;
    setActiveSessionId(null);
  }, [cleanupEffects]);

  /* =========================
     RESET GAME AFTER MODAL
  ========================= */
  const resetGameAfterModal = useCallback(() => {
    if (modalTimeoutRef.current) {
      clearTimeout(modalTimeoutRef.current);
    }
    
    modalTimeoutRef.current = setTimeout(() => {
      resetGame();
      setStakeOpen(true);
    }, 3000);
  }, [resetGame]);

  /* =========================
     TILE STYLES (MEMOIZED)
  ========================= */
  const tileStyles = useMemo(() => {
    return tiles.map(tile => {
      const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
      if (tileResultInfo && tile.revealed) {
        return {
          borderColor: tileResultInfo.color,
          backgroundColor: `${tileResultInfo.color}15`
        };
      }
      return {};
    });
  }, [tiles, resultConfig]);

  /* =========================
     GAME ACTIONS
  ========================= */
  
  const startGame = async () => {
    const totalBalance = Number(availableBalance || 0);
    const betAmount = Number(bet);

    const isStakeValid = (
      Number.isFinite(betAmount) &&
      betAmount >= MINIMUM_STAKE &&
      betAmount <= totalBalance
    );

    if (!isStakeValid || walletLoading) {
      if (betAmount < MINIMUM_STAKE) {
        toast.error(`Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      } else if (betAmount > totalBalance) {
        toast.error("Insufficient balance");
      }
      return;
    }

    setStarting(true);
    
    // Cleanup any existing effects
    cleanupEffects();
    
    // Play stake sound
    console.log('Playing stake sound');
    fortuneSound.playStake();
    
    try {
      const res = await fortuneService.startSession({
        game: "fortune_mouse",
        bet_amount: betAmount.toFixed(2),
        client_seed: `fortune:${Date.now()}:${Math.random()}`,
      });
      
      // Reset game state
      resetGame();
      
      // Set new game state
      setGame({
        status: "active",
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
        payout_amount: "0.00",
        session_id: res.data.session_id,
      });
      
      setActiveSessionId(res.data.session_id);
      setStakeOpen(false);
      
      // Refresh wallet to show updated balance
      refreshWallet();
      
      toast.success("Game started! Click tiles to reveal.", {
        icon: "🎮",
        duration: 2000
      });
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message || "Network error";
      toast.error(`Failed to start game: ${errorMsg}`);
    } finally {
      setStarting(false);
    }
  };

  const pickTile = useCallback(async (id) => {
    console.log('pickTile called for id:', id);
    
    if (!activeSessionId) {
      toast.error("No active game session");
      return;
    }
    
    if (tapLock.current) {
      console.log('Tap lock active, blocking click');
      toast.error("Please wait for previous action to complete");
      return;
    }
    
    if (game.status !== "active") {
      toast.error("Game is not active");
      return;
    }
    
    if (tiles[id]?.revealed) {
      toast.error("This tile has already been revealed");
      return;
    }

    // Lock to prevent multiple clicks
    tapLock.current = true;
    lastTileRef.current = id;

    // Play click sound
    console.log('Playing click sound');
    fortuneSound.playClick();
    
    try {
      const res = await fortuneService.takeStep(activeSessionId, {
        tile_id: id,
        msg_id: crypto.randomUUID(),
      });
      
      if (res.data.type === "duplicate") {
        tapLock.current = false;
        return;
      }
      
      const resultType = res.data.result;
      const resultInfo = resultConfig[resultType] || { icon: "?", label: "Unknown" };
      
      // Update tile
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: resultType }
            : t
        )
      );

      // Play tile reveal sound
      console.log('Playing tile sound for result:', resultType);
      fortuneSound.playTileSound(resultType);

      // Handle game over (trap)
      if (resultType === "trap") {
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
          step_index: res.data.step_index,
          current_multiplier: res.data.current_multiplier,
        }));

        toast.error(`Trap! ${resultInfo.label} - Game Over`, {
          icon: resultInfo.icon,
          duration: 3000,
        });

        // 3 seconds delay for modal display
        resetGameAfterModal();
        
        tapLock.current = false;
        return;
      }
      
      // Handle auto-cashout at max steps
      if (resultType === "auto_cashout") {
        setGame((g) => ({
          ...g,
          status: "cashed_out",
          payout_amount: res.data.payout_amount,
          current_multiplier: res.data.current_multiplier,
          step_index: res.data.step_index,
        }));

        fortuneSound.playCashoutSound();
        refreshWallet();

        toast.success(`Auto-cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`, {
          duration: 3000,
        });

        // Trigger win effects for auto-cashout win
        triggerWinEffects();

        // 3 seconds delay for modal display
        resetGameAfterModal();
        
        tapLock.current = false;
        return;
      }

      // Show result toast
      const oldMultiplier = parseFloat(game.current_multiplier);
      const newMultiplier = parseFloat(res.data.current_multiplier);
      const multiplierChange = newMultiplier - oldMultiplier;
      
      if (resultType === "small_win") {
        toast(`${resultInfo.label} +${multiplierChange.toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "penalty" || resultType === "major_penalty") {
        toast.error(`${resultInfo.label} -${Math.abs(multiplierChange).toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "reset") {
        toast(`${resultInfo.label} to 1.00x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      }
      
      setGame((g) => ({
        ...g,
        status: res.data.status,
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
      }));
      
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message || "Network error";
      console.error('Error in pickTile:', errorMsg);
      toast.error(`Failed to reveal tile: ${errorMsg}`);
      
      if (e.response?.status === 404) {
        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
          toast.error("Session expired. Please start a new game.");
        }, 1000);
      }
    } finally {
      tapLock.current = false;
      console.log('pickTile completed, tap lock released');
    }
  }, [activeSessionId, game, tiles, refreshWallet, resetGame, resetGameAfterModal, resultConfig, triggerWinEffects]);

  const cashout = useCallback(async () => {
    console.log('cashout called');
    
    if (!activeSessionId) {
      toast.error("No active game session");
      return;
    }
    
    if (game.status !== "active") {
      toast.error("Cannot cashout: game is not active");
      return;
    }

    if (tapLock.current) {
      console.log('Tap lock active, blocking cashout');
      toast.error("Please wait for previous action to complete");
      return;
    }

    tapLock.current = true;
    
    // Play click sound
    console.log('Playing click sound for cashout');
    fortuneSound.playClick();
    
    toast.loading("Processing cashout...", { id: "cashout" });

    try {
      const res = await fortuneService.cashout(activeSessionId);
      
      setGame((g) => ({
        ...g,
        status: "cashed_out",
        payout_amount: res.data.payout_amount,
        current_multiplier: res.data.current_multiplier,
        step_index: res.data.step_index,
      }));

      fortuneSound.playCashoutSound();
      refreshWallet();
      
      toast.dismiss("cashout");
      toast.success(`Cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);

      // Trigger win effects for manual cashout win
      triggerWinEffects();

      // 3 seconds delay for modal display
      resetGameAfterModal();
      
    } catch (e) {
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message || "Network error";
      console.error('Error in cashout:', errorMsg);
      toast.dismiss("cashout");
      toast.error(`Failed to cashout: ${errorMsg}`);
      
      if (e.response?.status === 404) {
        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
          toast.error("Session expired. Please start a new game.");
        }, 1000);
      }
    } finally {
      tapLock.current = false;
      console.log('cashout completed, tap lock released');
    }
  }, [activeSessionId, game.status, refreshWallet, resetGame, resetGameAfterModal, triggerWinEffects]);

  /* =========================
     EFFECTS
  ========================= */
  
  useEffect(() => {
    // Check for existing session
    const savedSessionId = localStorage.getItem('fortune_active_session');
    if (savedSessionId) {
      fortuneService.getSessionState(savedSessionId)
        .then(res => {
          if (res.data.status === "active") {
            setActiveSessionId(savedSessionId);
            setGame({
              status: "active",
              step_index: res.data.step_index,
              current_multiplier: res.data.current_multiplier,
              payout_amount: res.data.payout_amount,
              session_id: savedSessionId,
            });
            setStakeOpen(false);
            toast.success("Recovered previous game session", {
              icon: "🎮",
              duration: 2000
            });
          } else {
            localStorage.removeItem('fortune_active_session');
          }
        })
        .catch(() => {
          localStorage.removeItem('fortune_active_session');
        });
    }
    
    // Cleanup on unmount
    return () => {
      cleanupEffects();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [cleanupEffects]);

  useEffect(() => {
    if (activeSessionId && game.status === "active") {
      localStorage.setItem('fortune_active_session', activeSessionId);
    } else if (game.status !== "active") {
      localStorage.removeItem('fortune_active_session');
    }
  }, [activeSessionId, game.status]);

  /* =========================
     PERFORMANCE OPTIMIZATION
  ========================= */
  const totalBalance = Number(availableBalance || 0);
  const betAmount = Number(bet);

  const isStakeValid = useMemo(() => {
    return (
      Number.isFinite(betAmount) &&
      betAmount >= MINIMUM_STAKE &&
      betAmount <= totalBalance
    );
  }, [betAmount, totalBalance]);

  const currentResult = tiles.find(t => t.revealed && t.id === lastTileRef.current);
  const resultInfo = currentResult ? resultConfig[currentResult.kind] : null;

  return (
    <div className="fortune-stage">
      {/* WINNING VISUAL EFFECTS LAYER */}
      {(showConfetti || showFlowers) && (
        <div className="winning-effects-layer">
          {/* OPTIMIZED CONFETTI */}
          {showConfetti && (
            <Confetti
              key={`confetti-${confettiKey}`}
              width={windowSize.width}
              height={windowSize.height}
              recycle={false}
              numberOfPieces={150} // Reduced for performance
              gravity={0.12}
              opacity={0.8}
              colors={['#FFD700', '#FF6B6B', '#4ECDC4', '#A29BFE']}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9997,
              }}
            />
          )}
          
          {/* COLORFUL FLOWERS */}
          {showFlowers && generateFlowers.map(flower => (
            <Flower
              key={flower.id}
              x={flower.x}
              y={flower.y}
              size={flower.size}
              color={flower.color}
              rotation={flower.rotation}
              delay={flower.delay}
            />
          ))}
          
          {/* GLOWING BACKGROUND EFFECT */}
          <div className="winning-glow" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.03) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 9995,
            animation: 'winning-pulse-glow 2s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* HEADER */}
      <div className="fortune-header">
        <div className="fortune-brand">
          <div className="vault-orb"></div>
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Mouse</div>
            <div className="fortune-sub">Reveal tiles to boost your multiplier</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTIPLIER</div>
            <div className="hud-value highlight">
              {parseFloat(game.current_multiplier).toFixed(2)}x
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">{game.step_index}</div>
          </div>

          <button
            className={`hud-cashout ${!activeSessionId || game.status !== "active" ? "disabled" : ""}`}
            onClick={cashout}
            disabled={!activeSessionId || game.status !== "active" || tapLock.current}
            aria-label="Cash out"
          >
            CASH OUT
          </button>

          <button className="hud-exit" onClick={() => navigate("/")} aria-label="Exit game">
            EXIT
          </button>
          
          <button className="audio-control" onClick={toggleMute} aria-label={isMuted ? "Unmute sound" : "Mute sound"}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>
      
      {/* BOARD */}
      <div className="fortune-board">
        <div className="fortune-grid">
          {tiles.map((tile, index) => {
            const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
            return (
              <button
                key={tile.id}
                className={`fortune-tile ${
                  tile.revealed ? tile.kind : ""
                } ${game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""}`}
                disabled={tile.revealed || game.status !== "active" || tapLock.current}
                onClick={() => pickTile(tile.id)}
                style={tileStyles[index]}
                aria-label={tile.revealed ? `Revealed tile: ${tileResultInfo?.label || 'Unknown'}` : 'Hidden tile'}
              >
                <div className="tile-face">
                  {!tile.revealed ? (
                    <span className="tile-glyph">?</span>
                  ) : (
                    <div className="tile-revealed">
                      <span className="tile-icon">
                        {tileResultInfo?.icon || "?"}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Game status overlay */}
        {game.status === "lost" && (
          <div className="game-overlay lost">
            <div className="overlay-content">
              <div className="overlay-icon">💣</div>
              <div className="overlay-title">Game Over!</div>
              <div className="overlay-subtitle">Hit a trap tile</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
            </div>
          </div>
        )}
        
        {game.status === "cashed_out" && (
          <div className="game-overlay cashed">
            <div className="overlay-content">
              <div className="overlay-icon">💰</div>
              <div className="overlay-title">Cashed Out!</div>
              <div className="overlay-subtitle">
                Won ₦{parseFloat(game.payout_amount).toLocaleString("en-NG")}
              </div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STAKE MODAL */}
      {stakeOpen && (
        <div className="fortune-stake-backdrop">
          <div className="fortune-stake-modal">
            <div className="stake-top">
              <div className="stake-badge">🐭</div>
              <div className="stake-title">
                <div className="t1">Fortune Mouse</div>
                <div className="t2">Click tiles to reveal bonuses or traps</div>
              </div>
            </div>

            <div className="stake-balance">
              <span className="label">Available Balance</span>
              <span className="value">
                ₦{totalBalance.toLocaleString("en-NG")}
              </span>
            </div>

            <div className="stake-input-row">
              <div className="stake-currency">₦</div>
              <input
                className={`stake-input ${
                  bet && !isStakeValid ? "error" : ""
                }`}
                value={bet}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^\d.]/g, '');
                  setBet(value);
                }}
                onBlur={() => {
                  if (bet && isStakeValid) {
                    setBet(parseFloat(bet).toFixed(2));
                  }
                }}
                placeholder="Enter amount"
                type="text"
                inputMode="decimal"
                autoFocus
                aria-label="Enter stake amount"
              />
            </div>

            {!isStakeValid && bet && (
              <div className="stake-validation-error">
                Minimum ₦{MINIMUM_STAKE.toLocaleString("en-NG")} – must not exceed balance
              </div>
            )}

            <div className="stake-quick-buttons">
              {[100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  className="quick-bet-btn"
                  onClick={() => setBet(Math.min(amount, totalBalance).toString())}
                  aria-label={`Set stake to ₦${amount}`}
                >
                  ₦{amount.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="stake-actions">
              <button
                className={`stake-btn gold ${
                  starting ? "loading" : ""
                }`}
                disabled={!isStakeValid || starting || walletLoading}
                onClick={startGame}
                aria-label="Start game"
              >
                {starting ? (
                  <>
                    <div className="spinner"></div>
                    Starting...
                  </>
                ) : (
                  "Start Game"
                )}
              </button>
              <button
                className="stake-btn secondary"
                onClick={() => navigate("/")}
                aria-label="Cancel and exit"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Audio Control */}
      <button 
        className="floating-audio-control" 
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute sound" : "Mute sound"}
        title={isMuted ? "Unmute sound" : "Mute sound"}
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}