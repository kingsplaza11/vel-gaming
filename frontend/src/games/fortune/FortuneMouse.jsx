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
     WINDOW SIZE TRACKING
  ========================= */
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /* =========================
     AUDIO CONTROLS
  ========================= */
  const toggleMute = () => {
    const muted = fortuneSound.toggleMute();
    setIsMuted(muted);
    toast(muted ? "Sound muted" : "Sound unmuted", {
      icon: muted ? "🔇" : "🔊"
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

    // Hide effects after 6 seconds
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 6000);

    flowersTimeoutRef.current = setTimeout(() => {
      setShowFlowers(false);
    }, 6000);
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
     GENERATE FLOWERS
  ========================= */
  const generateFlowers = useMemo(() => {
    if (!showFlowers) return [];
    
    const flowers = [];
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#FFD700', // Gold
      '#A29BFE', // Purple
      '#81ECEC', // Cyan
      '#FFEAA7', // Light Yellow
      '#55EFC4', // Mint
      '#FF9FF3', // Pink
      '#F368E0', // Magenta
      '#00D2D3', // Turquoise
    ];
    
    for (let i = 0; i < 15; i++) {
      flowers.push({
        id: i,
        x: Math.random() * 80 + 10, // 10-90% to avoid edges
        y: Math.random() * 80 + 10,
        size: Math.random() * 40 + 30, // 30-70px
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        delay: Math.random() * 1.5,
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
    }, 3000); // 3 seconds delay for modal display
  }, [resetGame]);

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
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.error(`Failed to start game: ${errorMsg}`);
    } finally {
      setStarting(false);
    }
  };

  const pickTile = useCallback(async (id) => {
    if (!activeSessionId) {
      toast.error("No active game session");
      return;
    }
    
    if (tapLock.current) {
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

        fortuneSound.playGameOverSound();

        toast.error(`Trap! ${resultInfo.label} - Game Over`, {
          icon: resultInfo.icon,
          duration: 3000,
        });

        // 3 seconds delay for modal display
        resetGameAfterModal();
        
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
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
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
    }
  }, [activeSessionId, game, tiles, refreshWallet, resetGame, resetGameAfterModal, resultConfig, triggerWinEffects]);

  const cashout = useCallback(async () => {
    if (!activeSessionId) {
      toast.error("No active game session");
      return;
    }
    
    if (game.status !== "active") {
      toast.error("Cannot cashout: game is not active");
      return;
    }

    if (tapLock.current) {
      toast.error("Please wait for previous action to complete");
      return;
    }

    tapLock.current = true;
    
    // Play click sound
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
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
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
              icon: "🎮"
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
      fortuneSound.cleanup();
      cleanupEffects();
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
     RENDER
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
          {/* ENHANCED CONFETTI */}
          {showConfetti && (
            <>
              <Confetti
                key={`confetti-${confettiKey}-1`}
                width={windowSize.width}
                height={windowSize.height}
                recycle={true}
                numberOfPieces={400}
                gravity={0.15}
                initialVelocityY={20}
                initialVelocityX={8}
                wind={0.05}
                colors={[
                  '#FFD700', // Gold
                  '#FF6B6B', // Red
                  '#4ECDC4', // Teal
                  '#FF9FF3', // Pink
                  '#F368E0', // Magenta
                  '#A29BFE', // Purple
                  '#81ECEC', // Cyan
                  '#55EFC4', // Mint
                  '#FFEAA7', // Light Yellow
                  '#00D2D3', // Turquoise
                ]}
                confettiSource={{
                  x: windowSize.width / 2,
                  y: windowSize.height / 2,
                  w: windowSize.width * 0.3,
                  h: 10,
                }}
                drawShape={ctx => {
                  const shapeType = Math.random();
                  if (shapeType < 0.25) {
                    // Circle
                    ctx.beginPath();
                    ctx.arc(0, 0, 6, 0, 2 * Math.PI);
                    ctx.fill();
                  } else if (shapeType < 0.5) {
                    // Square
                    ctx.fillRect(-5, -5, 10, 10);
                  } else if (shapeType < 0.75) {
                    // Triangle
                    ctx.beginPath();
                    ctx.moveTo(0, -7);
                    ctx.lineTo(-6, 5);
                    ctx.lineTo(6, 5);
                    ctx.closePath();
                    ctx.fill();
                  } else {
                    // Star
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                      const x = 5 * Math.cos(angle);
                      const y = 5 * Math.sin(angle);
                      if (i === 0) ctx.moveTo(x, y);
                      else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.fill();
                  }
                }}
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
              
              {/* Additional confetti layer for depth */}
              <Confetti
                key={`confetti-${confettiKey}-2`}
                width={windowSize.width}
                height={windowSize.height}
                recycle={true}
                numberOfPieces={200}
                gravity={0.08}
                initialVelocityY={15}
                initialVelocityX={5}
                wind={0.02}
                colors={[
                  '#FFFFFF', // White
                  '#FFD700', // Gold
                  '#FF6B6B', // Red
                  '#4ECDC4', // Teal
                ]}
                confettiSource={{
                  x: windowSize.width / 2,
                  y: windowSize.height,
                  w: windowSize.width * 0.5,
                  h: 0,
                }}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 9996,
                }}
              />
            </>
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
            background: 'radial-gradient(circle at center, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 50%, transparent 70%)',
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
          >
            CASH OUT
          </button>

          <button className="hud-exit" onClick={() => navigate("/")}>
            EXIT
          </button>
          
          <button className="audio-control" onClick={toggleMute}>
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>
      
      {/* BOARD */}
      <div className="fortune-board">
        <div className="fortune-grid">
          {tiles.map((tile) => {
            const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
            return (
              <button
                key={tile.id}
                className={`fortune-tile ${
                  tile.revealed ? tile.kind : ""
                } ${game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""}`}
                disabled={tile.revealed || game.status !== "active" || tapLock.current}
                onClick={() => pickTile(tile.id)}
                style={tileResultInfo && tile.revealed ? {
                  borderColor: tileResultInfo.color,
                  backgroundColor: `${tileResultInfo.color}15`
                } : {}}
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
        
        {/* Game status overlay - FIXED POSITIONING */}
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