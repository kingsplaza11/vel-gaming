import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { fortuneService } from "../../services/api";
import { tigerSound } from "../../utils/TigerSoundManager";
import toast from "react-hot-toast";
import Confetti from "react-confetti";
import "./fortunetiger.css";

const GRID_SIZE = 16;
const MINIMUM_STAKE = 100;

// Sound durations for proper timing
const SOUND_DURATIONS = {
  GAME_OVER: 4000, // Dwarf laughter sequence
  CASHOUT: 4000, // Applause + birthday cheer + victory sounds
  ROAR: 1200, // Tiger roar
  TILE_REVEAL: 500, // Generic tile reveal
  STAKE: 2000, // Monster growl stake sound
};

export default function FortuneTiger() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [muteState, setMuteState] = useState({ gameSoundsMuted: tigerSound.isMuted });
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [gameConfig, setGameConfig] = useState({
    title: "Fortune Tiger",
    icon: "🐯",
    grid_size: GRID_SIZE,
    min_stake: MINIMUM_STAKE,
    risk_level: "high"
  });

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);
  const [tigerRoar, setTigerRoar] = useState(false);
  const [highlightTile, setHighlightTile] = useState(null);
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
    game_type: "fortune_tiger",
  });

  const [tiles, setTiles] = useState(() =>
    Array.from({ length: GRID_SIZE }, (_, i) => ({
      id: i,
      revealed: false,
      kind: null,
      multiplier_value: null,
    }))
  );

  /* =========================
     REFS
  ========================= */
  const tapLock = useRef(false);
  const lastTileRef = useRef(null);
  const confettiTimeoutRef = useRef(null);
  const resetTimeoutRef = useRef(null);
  const clickTimestamps = useRef(new Map());

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
     AUDIO INITIALIZATION
  ========================= */
  useEffect(() => {
    // Initialize audio on component mount
    tigerSound.init();
    
    // Cleanup on unmount
    return () => {
      cleanupEffects();
    };
  }, []);

  /* =========================
     CLEANUP EFFECTS FUNCTION
  ========================= */
  const cleanupEffects = useCallback(() => {
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    setShowConfetti(false);
  }, []);

  /* =========================
     AUDIO CONTROLS
  ========================= */
  const toggleMute = () => {
    const muted = tigerSound.toggleMute();
    setMuteState({ gameSoundsMuted: muted });
    
    toast(
      muted ? "Game sounds muted 🔇" : "Game sounds active 🐯",
      {
        icon: muted ? "🔇" : "🐯",
        duration: 1500
      }
    );
  };

  /* =========================
     VISUAL EFFECTS FUNCTIONS
  ========================= */
  const triggerWinEffects = useCallback(() => {
    // Clear any existing timeout
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }

    // Reset confetti key to ensure new instance
    setConfettiKey(prev => prev + 1);
    
    // Show confetti immediately
    setShowConfetti(true);
    console.log("🎉 Tiger victory confetti triggered!");

    // Hide confetti after 6 seconds
    confettiTimeoutRef.current = setTimeout(() => {
      setShowConfetti(false);
    }, 6000);
  }, []);

  /* =========================
     GAME RESULTS CONFIGURATION
  ========================= */
  const resultConfig = useMemo(() => ({
    "small_win": {
      icon: "🐅",
      label: "Small Win",
      color: "#fbbf24",
      effect: "effect-small-win",
    },
    "penalty": {
      icon: "⚠️",
      label: "Claw Scratch",
      color: "#f97316",
      effect: "effect-penalty",
    },
    "major_penalty": {
      icon: "💥",
      label: "Tiger Attack",
      color: "#ef4444",
      effect: "effect-penalty",
    },
    "reset": {
      icon: "🔄",
      label: "Reset",
      color: "#8b5cf6",
      effect: "effect-reset",
    },
    "trap": {
      icon: "💀",
      label: "Trap",
      color: "#dc2626",
      effect: "effect-game_over",
    },
    "auto_cashout": {
      icon: "⏰",
      label: "Auto Cashout",
      color: "#10b981",
      effect: "effect-cashout",
    }
  }), []);

  /* =========================
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
    console.log("[FortuneTiger] Resetting game");
    setGame({
      status: "idle",
      step_index: 0,
      current_multiplier: "1.00",
      payout_amount: "0.00",
      session_id: null,
      game_type: "fortune_tiger",
    });

    setTiles(
      Array.from({ length: GRID_SIZE }, (_, i) => ({
        id: i,
        revealed: false,
        kind: null,
        multiplier_value: null,
      }))
    );

    tapLock.current = false;
    lastTileRef.current = null;
    setStageEffect("");
    setShake(false);
    setTigerRoar(false);
    setActiveSessionId(null);
    setHighlightTile(null);
    
    // Cleanup effects
    cleanupEffects();
  }, [cleanupEffects]);

  /* =========================
     DELAYED RESET FUNCTIONS
  ========================= */
  const resetToStakeModal = useCallback(() => {
    resetGame();
    setStakeOpen(true);
  }, [resetGame]);

  const delayedResetToStakeModal = useCallback((delay = 1000) => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      resetToStakeModal();
    }, delay);
  }, [resetToStakeModal]);

  /* =========================
     GAME ACTIONS - UPDATED SOUNDS
  ========================= */
  
  const startGame = async () => {
    const walletBalance = Number(availableBalance);
    const betAmount = Number(bet);

    const isStakeValid = (
      Number.isFinite(betAmount) &&
      betAmount >= gameConfig.min_stake &&
      betAmount <= walletBalance
    );

    if (!isStakeValid || walletLoading) {
      if (betAmount < gameConfig.min_stake) {
        toast.error(`Minimum stake is ₦${gameConfig.min_stake.toLocaleString("en-NG")}`);
      } else if (betAmount > walletBalance) {
        toast.error("Insufficient balance");
      }
      return;
    }

    console.log("[FortuneTiger] Starting game with bet:", betAmount);
    setStarting(true);
    
    // Cleanup any existing effects
    cleanupEffects();
    
    // Play monster growl stake sound
    console.log("[FortuneTiger] Playing monster growl stake sound");
    tigerSound.playStake();
    
    try {
      const res = await fortuneService.startSession({
        game: "fortune_tiger",
        bet_amount: betAmount.toFixed(2),
        client_seed: `fortune_tiger:${Date.now()}:${Math.random()}`,
      });

      console.log("[FortuneTiger] Game started:", res.data);
      
      resetGame();
      
      setGame({
        status: "active",
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
        payout_amount: "0.00",
        session_id: res.data.session_id,
        game_type: "fortune_tiger",
      });
      
      setActiveSessionId(res.data.session_id);
      setStakeOpen(false);
      
      setTiles(
        Array.from({ length: res.data.grid_size || GRID_SIZE }, (_, i) => ({
          id: i,
          revealed: false,
          kind: null,
          multiplier_value: null,
        }))
      );
      
      refreshWallet();
      
      // Tiger roar effect after stake
      setTimeout(() => {
        tigerSound.playRoar();
        setTigerRoar(true);
        setTimeout(() => setTigerRoar(false), 1000);
      }, 500);
      
      // Randomly highlight a tile (visual cue)
      setTimeout(() => {
        const randomTile = Math.floor(Math.random() * GRID_SIZE);
        setHighlightTile(randomTile);
        setTimeout(() => setHighlightTile(null), 2000);
      }, 2000);
      
      toast.success("Tiger game started! High risk, high reward!", {
        icon: "🐯",
        duration: 2000
      });
    } catch (e) {
      console.error("[FortuneTiger] Failed to start game:", e);
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.error(`Failed to start game: ${errorMsg}`);
    } finally {
      setStarting(false);
    }
  };

  const pickTile = useCallback(async (id) => {
    // Early validation checks
    if (!activeSessionId) {
      toast.error("No active game session");
      return;
    }
    
    if (tapLock.current) {
      console.log('Tile click blocked: tap lock active');
      return;
    }
    
    if (game.status !== "active") {
      toast.error("Game is not active");
      return;
    }
    
    if (tiles[id]?.revealed) {
      console.log('Tile already revealed:', id);
      return;
    }

    // Debounce: prevent multiple clicks on same tile within 500ms
    const now = Date.now();
    const lastClick = clickTimestamps.current.get(id);
    if (lastClick && (now - lastClick) < 500) {
      console.log('Tile click debounced:', id);
      return;
    }
    clickTimestamps.current.set(id, now);

    // Set lock immediately
    tapLock.current = true;
    lastTileRef.current = id;

    // Update UI immediately - show tile as processing
    setTiles(prev => prev.map((t, idx) => 
      idx === id ? { ...t, processing: true } : t
    ));

    // Play tile click sound
    console.log("[FortuneTiger] Playing tile click sound");
    tigerSound.playTap();
    
    try {
      const res = await fortuneService.takeStep(activeSessionId, {
        tile_id: id,
        msg_id: crypto.randomUUID(),
      });

      console.log("[FortuneTiger] Step result:", res.data);
      
      if (res.data.type === "duplicate") {
        tapLock.current = false;
        setTiles(prev => prev.map((t, idx) => 
          idx === id ? { ...t, processing: false } : t
        ));
        return;
      }
      
      const resultType = res.data.result;
      const resultInfo = resultConfig[resultType] || { icon: "?", label: "Unknown" };
      
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: resultType, processing: false }
            : t
        )
      );

      // Play tile reveal sound
      console.log("[FortuneTiger] Playing tile sound for result:", resultType);
      tigerSound.playTileSound(resultType);

      // Apply visual effect based on result
      setStageEffect(resultInfo.effect || "");
      setTimeout(() => setStageEffect(""), 500);

      // Handle game over (trap) - WITH SOUND DELAY
      if (resultType === "trap") {
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
          step_index: res.data.step_index,
          current_multiplier: res.data.current_multiplier,
        }));

        setShake(true);
        setTigerRoar(true);
        
        // Play game over sound (dwarf laughter sequence)
        console.log("[FortuneTiger] Playing game over sound (dwarf laughter)");
        tigerSound.playGameOverSound();

        toast.error(`${resultInfo.label}! Game Over!`, {
          icon: resultInfo.icon,
          duration: SOUND_DURATIONS.GAME_OVER - 1000,
        });

        // Wait for sound to finish before resetting
        setTimeout(() => {
          setShake(false);
          setTigerRoar(false);
        }, 800);

        // Reset to stake modal after sound finishes
        delayedResetToStakeModal(SOUND_DURATIONS.GAME_OVER);
        
        tapLock.current = false;
        return;
      }
      
      // Handle auto-cashout - WITH ENHANCED CELEBRATION SOUNDS
      if (resultType === "auto_cashout") {
        setGame((g) => ({
          ...g,
          status: "cashed_out",
          payout_amount: res.data.payout_amount,
          current_multiplier: res.data.current_multiplier,
          step_index: res.data.step_index,
        }));

        setStageEffect("effect-cashout");
        
        // Play enhanced cashout sound (applause + birthday cheer + victory sounds)
        console.log("[FortuneTiger] Playing enhanced cashout celebration");
        tigerSound.playCashoutSound();
        refreshWallet();

        // Trigger confetti for auto-cashout win
        triggerWinEffects();

        toast.success(`Auto-cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`, {
          duration: SOUND_DURATIONS.CASHOUT,
        });

        // Reset to stake modal after sound finishes and confetti displays
        delayedResetToStakeModal(Math.max(SOUND_DURATIONS.CASHOUT, 3000));
        
        tapLock.current = false;
        return;
      }

      // Handle other results
      console.log("[FortuneTiger] Tile result:", resultType);
      
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
      
      // Randomly highlight another tile every 3rd step
      if (game.step_index % 3 === 0) {
        const unrevealedTiles = tiles.filter(t => !t.revealed && t.id !== id);
        if (unrevealedTiles.length > 0) {
          const randomTile = unrevealedTiles[Math.floor(Math.random() * unrevealedTiles.length)].id;
          setHighlightTile(randomTile);
          setTimeout(() => setHighlightTile(null), 1500);
        }
      }
      
      setGame((g) => ({
        ...g,
        status: res.data.status,
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
      }));
      
    } catch (e) {
      console.error("[FortuneTiger] Failed to take step:", e);
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.error(`Failed to reveal tile: ${errorMsg}`);
      
      // Reset tile processing state on error
      setTiles(prev => prev.map((t, idx) => 
        idx === id ? { ...t, processing: false } : t
      ));
      
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
  }, [activeSessionId, game, tiles, refreshWallet, resetGame, resultConfig, triggerWinEffects, delayedResetToStakeModal]);

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
      console.log('Cashout blocked: tap lock active');
      return;
    }

    tapLock.current = true;
    
    // Play tile click sound
    tigerSound.playTap();
    
    toast.loading("Processing cashout...", { id: "cashout" });

    try {
      const res = await fortuneService.cashout(activeSessionId);
      
      console.log("[FortuneTiger] Cashout successful:", res.data);
      
      setGame((g) => ({
        ...g,
        status: "cashed_out",
        payout_amount: res.data.payout_amount,
        current_multiplier: res.data.current_multiplier,
        step_index: res.data.step_index,
      }));

      setStageEffect("effect-cashout");
      
      // Play enhanced cashout sound (applause + birthday cheer + victory sounds)
      console.log("[FortuneTiger] Playing enhanced cashout celebration");
      tigerSound.playCashoutSound();
      refreshWallet();
      
      toast.dismiss("cashout");
      
      const finalMultiplier = parseFloat(res.data.current_multiplier).toFixed(2);
      const winAmount = parseFloat(res.data.payout_amount).toLocaleString("en-NG");
      toast.success(
        `Tiger victory! Won ₦${winAmount} (${finalMultiplier}x)`,
        { 
          icon: '👑',
          duration: SOUND_DURATIONS.CASHOUT,
        }
      );

      // Trigger confetti for manual cashout win
      triggerWinEffects();

      // Reset to stake modal after sound finishes and confetti displays
      delayedResetToStakeModal(Math.max(SOUND_DURATIONS.CASHOUT, 3000));
      
    } catch (e) {
      console.error("[FortuneTiger] Failed to cashout:", e);
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
  }, [activeSessionId, game.status, refreshWallet, resetGame, triggerWinEffects, delayedResetToStakeModal]);

  /* =========================
     SESSION RECOVERY
  ========================= */
  
  const checkExistingSession = useCallback(async () => {
    const savedSessionId = localStorage.getItem('fortune_tiger_active_session');
    if (savedSessionId) {
      try {
        const res = await fortuneService.getSessionState(savedSessionId);
        
        if (res.data.status === "active" && res.data.game === "fortune_tiger") {
          setActiveSessionId(savedSessionId);
          setGame({
            status: "active",
            step_index: res.data.step_index,
            current_multiplier: res.data.current_multiplier,
            payout_amount: res.data.payout_amount,
            session_id: savedSessionId,
            game_type: "fortune_tiger",
          });
          setStakeOpen(false);
          
          try {
            const configRes = await fortuneService.getGameConfig("fortune_tiger");
            setGameConfig(prev => ({ ...prev, ...configRes.data }));
          } catch (e) {
            console.log("Could not load game config:", e);
          }
          
          toast.success("Recovered Tiger game session", {
            icon: "🐯"
          });
        } else {
          localStorage.removeItem('fortune_tiger_active_session');
        }
      } catch (e) {
        localStorage.removeItem('fortune_tiger_active_session');
      }
    }
  }, []);

  /* =========================
     EFFECTS
  ========================= */
  
  useEffect(() => {
    checkExistingSession();
    
    return () => {
      tigerSound.cleanup();
      cleanupEffects();
    };
  }, [checkExistingSession, cleanupEffects]);

  useEffect(() => {
    if (activeSessionId && game.status === "active") {
      localStorage.setItem('fortune_tiger_active_session', activeSessionId);
    } else if (game.status !== "active") {
      localStorage.removeItem('fortune_tiger_active_session');
    }
  }, [activeSessionId, game.status]);

  /* =========================
     RENDER
  ========================= */
  const walletBalance = Number(availableBalance);
  const betAmount = Number(bet);

  const isStakeValid = useMemo(() => {
    return (
      Number.isFinite(betAmount) &&
      betAmount >= gameConfig.min_stake &&
      betAmount <= walletBalance
    );
  }, [betAmount, walletBalance, gameConfig.min_stake]);

  const currentResult = tiles.find(t => t.revealed && t.id === lastTileRef.current);
  const resultInfo = currentResult ? resultConfig[currentResult.kind] : null;

  return (
    <div
      className={`fortune-stage tiger-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      } ${tigerRoar ? "tiger-roar" : ""}`}
    >
      {/* CONFETTI OVERLAY - MUST BE HIGHEST Z-INDEX */}
      {showConfetti && (
        <div className="confetti-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10000,
        }}>
          <Confetti
            key={`confetti-${confettiKey}-1`}
            width={windowSize.width}
            height={windowSize.height}
            recycle={true}
            numberOfPieces={400}
            gravity={0.15}
            initialVelocityY={30}
            initialVelocityX={12}
            wind={0.05}
            colors={[
              '#fbbf24', // Tiger Gold
              '#f97316', // Tiger Orange
              '#dc2626', // Tiger Red
              '#8b5cf6', // Tiger Purple
              '#10b981', // Tiger Green
              '#3b82f6', // Tiger Blue
              '#ffffff', // White
            ]}
            confettiSource={{
              x: windowSize.width / 2,
              y: windowSize.height / 2,
              w: windowSize.width * 0.5,
              h: 10,
            }}
            drawShape={ctx => {
              const shapeType = Math.random();
              if (shapeType < 0.3) {
                // Circle
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, 2 * Math.PI);
                ctx.fill();
              } else if (shapeType < 0.6) {
                // Square
                ctx.fillRect(-7, -7, 14, 14);
              } else if (shapeType < 0.8) {
                // Triangle
                ctx.beginPath();
                ctx.moveTo(0, -10);
                ctx.lineTo(-8, 8);
                ctx.lineTo(8, 8);
                ctx.closePath();
                ctx.fill();
              } else {
                // Star
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                  const x = 8 * Math.cos(angle);
                  const y = 8 * Math.sin(angle);
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
              }
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
            initialVelocityY={20}
            initialVelocityX={8}
            wind={0.02}
            colors={[
              '#fbbf24', // Tiger Gold
              '#f97316', // Tiger Orange
              '#ffffff', // White
            ]}
            confettiSource={{
              x: windowSize.width / 2,
              y: windowSize.height,
              w: windowSize.width * 0.8,
              h: 0,
            }}
          />
          
          {/* Third layer for more celebration */}
          <Confetti
            key={`confetti-${confettiKey}-3`}
            width={windowSize.width}
            height={windowSize.height}
            recycle={true}
            numberOfPieces={150}
            gravity={0.25}
            initialVelocityY={35}
            initialVelocityX={15}
            wind={0.1}
            colors={[
              '#dc2626', // Tiger Red
              '#8b5cf6', // Tiger Purple
              '#3b82f6', // Tiger Blue
            ]}
            confettiSource={{
              x: 0,
              y: windowSize.height / 2,
              w: windowSize.width,
              h: 5,
            }}
          />
          
          {/* Glowing background effect */}
          <div className="winning-glow" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at center, rgba(251, 191, 36, 0.3) 0%, rgba(251, 191, 36, 0.15) 40%, transparent 70%)',
            pointerEvents: 'none',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          
          {/* Sparkle overlay */}
          <div className="sparkle-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
            pointerEvents: 'none',
            animation: 'sparkle 3s ease-in-out infinite',
          }} />
        </div>
      )}

      {/* HEADER - Single Row on Desktop */}
      <div className="fortune-header tiger-header">
        <div className="fortune-brand">
          <div className="vault-orb tiger pulse" />
          <div className="fortune-brand-text">
            <div className="fortune-name tiger-name">Fortune Tiger</div>
            <div className="fortune-sub tiger-sub">Small wins, high stakes</div>
          </div>
        </div>

        <div className="fortune-hud tiger-hud">
          <div className="hud-card tiger-hud-card">
            <div className="hud-label tiger-label">MULTI</div>
            <div className="hud-value highlight tiger-highlight">
              {parseFloat(game.current_multiplier).toFixed(2)}x
            </div>
          </div>

          <div className="hud-card tiger-hud-card">
            <div className="hud-label tiger-label">STEPS</div>
            <div className="hud-value tiger-value">{game.step_index}</div>
          </div>
          

          <button
            className={`hud-cashout tiger-cashout ${
              !activeSessionId || game.status !== "active" ? "disabled" : ""
            }`}
            onClick={cashout}
            disabled={!activeSessionId || game.status !== "active" || tapLock.current}
          >
            CASH OUT
          </button>

          <button className="hud-exit tiger-exit" onClick={() => navigate("/")}>
            EXIT
          </button>
          
          {/* Audio Control Button */}
          <button className="audio-control tiger-audio" onClick={toggleMute}>
            {muteState.gameSoundsMuted ? "🔇" : "🐯"}
          </button>
        </div>
      </div>
      
      {/* BOARD */}
      <div className="fortune-board tiger-board">
        <div className="fortune-grid tiger-grid">
          {tiles.map((tile) => {
            const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
            const isProcessing = tile.processing;
            const isDisabled = tile.revealed || game.status !== "active" || tapLock.current || isProcessing;
            
            return (
              <button
                key={tile.id}
                className={`fortune-tile tiger-tile ${
                  tile.revealed ? tile.kind : ""
                } ${highlightTile === tile.id ? 'highlight-tile' : ''} ${
                  game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""
                }`}
                disabled={isDisabled}
                onClick={() => pickTile(tile.id)}
                style={tileResultInfo && tile.revealed ? {
                  borderColor: tileResultInfo.color,
                  boxShadow: `0 0 15px ${tileResultInfo.color}60`
                } : {}}
              >
                <div className="tile-face">
                  {isProcessing ? (
                    <span className="tile-processing">⏳</span>
                  ) : !tile.revealed ? (
                    <>
                      <span className="tile-glyph">🐾</span>
                      {highlightTile === tile.id && (
                        <div className="tile-hint">?</div>
                      )}
                    </>
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
        
        {/* Game status overlays - These will now stay visible until sounds finish */}
        {game.status === "lost" && (
          <div className="game-overlay tiger-lost">
            <div className="overlay-content">
              <div className="overlay-icon">💀</div>
              <div className="overlay-title">Tiger Attack!</div>
              <div className="overlay-subtitle">Game Over</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
              <div className="overlay-countdown">
                Returning to stake screen...
              </div>
            </div>
          </div>
        )}
        
        {game.status === "cashed_out" && (
          <div className="game-overlay tiger-cashed">
            <div className="overlay-content">
              <div className="overlay-icon">👑</div>
              <div className="overlay-title">Tiger Victory!</div>
              <div className="overlay-subtitle">Won ₦{parseFloat(game.payout_amount).toLocaleString("en-NG")}</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
              <div className="overlay-countdown">
                <div className="countdown-spinner"></div>
                Returning to stake screen...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STAKE MODAL with Line Breaker */}
      {stakeOpen && (
        <div className="fortune-stake-backdrop">
          <div className="fortune-stake-modal tiger-modal">
            <div className="stake-top">
              <div className="stake-badge">🐯</div>
              <div className="stake-title">
                <div className="t1">Fortune Tiger</div>
                <div className="t2">Small wins, high stakes</div>
              </div>
            </div>

            <div className="stake-balance">
              <span className="label">Available Balance</span>
              <span className="value">
                ₦{walletBalance.toLocaleString("en-NG")}
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
                placeholder={`Minimum ₦${gameConfig.min_stake.toLocaleString("en-NG")}`}
                type="text"
                inputMode="decimal"
                autoFocus
              />
            </div>

            {!isStakeValid && bet && (
              <div className="stake-validation-error">
                Minimum ₦{gameConfig.min_stake.toLocaleString("en-NG")} – must not exceed balance
              </div>
            )}

            <div className="stake-quick-buttons">
              {[100, 500, 1000].map(amount => (
                <button
                  key={amount}
                  className="quick-bet-btn"
                  onClick={() => setBet(Math.min(amount, walletBalance).toString())}
                >
                  ₦{amount.toLocaleString()}
                </button>
              ))}
            </div>

            {/* LINE BREAKER */}
            <div className="stake-line-breaker">
              <div className="line-left"></div>
              <div className="line-text">Ready to Play?</div>
              <div className="line-right"></div>
            </div>

            <div className="stake-actions">
              <button
                className={`stake-btn gold tiger-btn ${
                  starting ? "loading" : ""
                }`}
                disabled={!isStakeValid || starting || walletLoading}
                onClick={startGame}
              >
                {starting ? (
                  <>
                    <div className="spinner small"></div>
                    Starting...
                  </>
                ) : (
                  `Start Game`
                )}
              </button>
              <button
                className="stake-btn secondary"
                onClick={() => navigate("/")}
              >
                Back to Games
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Audio Control */}
      <button 
        className="floating-audio-control tiger-floating" 
        onClick={toggleMute}
        aria-label={muteState.gameSoundsMuted ? "Unmute game sounds" : "Mute game sounds"}
        title={muteState.gameSoundsMuted ? "Unmute game sounds" : "Mute game sounds"}
      >
        {muteState.gameSoundsMuted ? "🔇" : "🐯"}
      </button>
    </div>
  );
}