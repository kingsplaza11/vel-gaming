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
import { rabbitSound } from "../../utils/RabbitSoundManager";
import toast from "react-hot-toast";
import "./fortunerabbit.css"; // We'll create this CSS file

const GRID_SIZE = 16; // Changed to 4x4 like Tiger
const MINIMUM_STAKE = 100;

export default function FortuneRabbit() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [muteState, setMuteState] = useState(rabbitSound.getMuteState());
  const [gameConfig, setGameConfig] = useState({
    title: "Fortune Rabbit",
    icon: "🐰",
    grid_size: GRID_SIZE,
    min_stake: MINIMUM_STAKE,
    risk_level: "low"
  });

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);
  const [carrotBonus, setCarrotBonus] = useState(false);
  const [carrotsCollected, setCarrotsCollected] = useState(0);
  const [highlightTile, setHighlightTile] = useState(null);

  const [game, setGame] = useState({
    status: "idle",
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
    session_id: null,
    game_type: "fortune_rabbit",
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
  const unlockTimeoutRef = useRef(null);

  /* =========================
     AUDIO CONTROLS
  ========================= */
  const toggleMute = () => {
    const { bgMuted, gameMuted } = rabbitSound.toggleMute();
    setMuteState({ backgroundMusicMuted: bgMuted, gameSoundsMuted: gameMuted });
    
    const bgText = bgMuted ? "Background music muted" : "Background music unmuted";
    const gameText = gameMuted ? "Game sounds muted" : "Game sounds active";
    
    toast(
      <div>
        <div>{bgText}</div>
        <div>{gameText}</div>
      </div>,
      {
        icon: bgMuted && gameMuted ? "🔇" : bgMuted ? "🎵" : gameMuted ? "🔊" : "🐰"
      }
    );
  };

  /* =========================
     GAME RESULTS CONFIGURATION
  ========================= */
  const resultConfig = useMemo(() => ({
    "safe": {
      icon: "💰",
      label: "Bonus",
      color: "#10b981", // Green
      effect: "effect-small-win",
    },
    "carrot_bonus": {
      icon: "🥕",
      label: "Carrot Bonus",
      color: "#fbbf24", // Yellow
      effect: "effect-small-win",
    },
    "small_win": {
      icon: "💸",
      label: "Small Win",
      color: "#f59e0b", // Orange
      effect: "effect-small-win",
    },
    "penalty": {
      icon: "⚠️",
      label: "Penalty",
      color: "#f97316", // Orange
      effect: "effect-penalty",
    },
    "trap": {
      icon: "💣",
      label: "Trap",
      color: "#ef4444", // Red
      effect: "effect-game_over",
    },
    "reset": {
      icon: "🔄",
      label: "Reset",
      color: "#8b5cf6", // Purple
      effect: "effect-reset",
    },
    "auto_cashout": {
      icon: "⏰",
      label: "Auto Cashout",
      color: "#10b981", // Green
      effect: "effect-cashout",
    }
  }), []);

  /* =========================
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
    console.log("[FortuneRabbit] Resetting game");
    setGame({
      status: "idle",
      step_index: 0,
      current_multiplier: "1.00",
      payout_amount: "0.00",
      session_id: null,
      game_type: "fortune_rabbit",
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
    setCarrotBonus(false);
    setCarrotsCollected(0);
    setActiveSessionId(null);
    setHighlightTile(null);
    
    rabbitSound.stopBackgroundMusic();
    
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
  }, []);

  /* =========================
     GAME ACTIONS
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

    console.log("[FortuneRabbit] Starting game with bet:", betAmount);
    setStarting(true);
    
    // Play stake sound (game sound, not background music)
    rabbitSound.playStake();
    
    try {
      const res = await fortuneService.startSession({
        game: "fortune_rabbit",
        bet_amount: betAmount.toFixed(2),
        client_seed: `fortune_rabbit:${Date.now()}:${Math.random()}`,
      });

      console.log("[FortuneRabbit] Game started:", res.data);
      
      resetGame();
      
      setGame({
        status: "active",
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
        payout_amount: "0.00",
        session_id: res.data.session_id,
        game_type: "fortune_rabbit",
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
      
      // Start rabbit background music if not muted
      if (!muteState.backgroundMusicMuted) {
        rabbitSound.playBackgroundMusic();
      }
      
      refreshWallet();
      
      // Rabbit happy hop effect (game sound)
      rabbitSound.playHappyHop();
      
      // Randomly highlight a tile (visual cue)
      setTimeout(() => {
        const randomTile = Math.floor(Math.random() * GRID_SIZE);
        setHighlightTile(randomTile);
        setTimeout(() => setHighlightTile(null), 2000);
      }, 1000);
      
      toast.success("Rabbit game started! Collect carrots for bonuses!", {
        icon: "🐰",
        duration: 2000
      });
    } catch (e) {
      console.error("[FortuneRabbit] Failed to start game:", e);
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

    tapLock.current = true;
    lastTileRef.current = id;

    console.log("[FortuneRabbit] Taking step for tile:", id);
    
    // Play rabbit hop sound (game sound)
    rabbitSound.playHop();
    
    try {
      const res = await fortuneService.takeStep(activeSessionId, {
        tile_id: id,
        msg_id: crypto.randomUUID(),
      });

      console.log("[FortuneRabbit] Step result:", res.data);
      
      if (res.data.type === "duplicate") {
        tapLock.current = false;
        return;
      }
      
      const resultType = res.data.result;
      const resultInfo = resultConfig[resultType] || { icon: "?", label: "Unknown" };
      
      // Check for carrot bonus
      const isCarrotBonus = resultType === "carrot_bonus";
      
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: resultType }
            : t
        )
      );

      // Play tile reveal sound (game sound)
      rabbitSound.playTileSound(resultType);

      // Apply visual effect based on result
      setStageEffect(resultInfo.effect || "");
      setTimeout(() => setStageEffect(""), 500);

      // Update carrot count for carrot bonus
      if (isCarrotBonus) {
        setCarrotsCollected(prev => prev + 1);
        setCarrotBonus(true);
        setTimeout(() => setCarrotBonus(false), 1000);
      }

      // Handle game over (trap)
      if (resultType === "trap") {
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
          step_index: res.data.step_index,
          current_multiplier: res.data.current_multiplier,
        }));

        setShake(true);
        
        // Play game over sound (game sound)
        rabbitSound.playGameOverSound();
        rabbitSound.stopBackgroundMusic();

        toast.error(`${resultInfo.label}! Game Over!`, {
          icon: resultInfo.icon,
          duration: 3000,
        });

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1400);
        
        return;
      }
      
      // Handle auto-cashout
      if (resultType === "auto_cashout") {
        setGame((g) => ({
          ...g,
          status: "cashed_out",
          payout_amount: res.data.payout_amount,
          current_multiplier: res.data.current_multiplier,
          step_index: res.data.step_index,
        }));

        setStageEffect("effect-cashout");
        rabbitSound.playCashoutSound();
        rabbitSound.stopBackgroundMusic();
        refreshWallet();

        toast.success(`Auto-cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`, {
          duration: 3000,
        });

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1500);
        
        return;
      }

      // Handle other results
      console.log("[FortuneRabbit] Tile result:", resultType);
      
      const oldMultiplier = parseFloat(game.current_multiplier);
      const newMultiplier = parseFloat(res.data.current_multiplier);
      const multiplierChange = newMultiplier - oldMultiplier;
      
      if (resultType === "safe" || resultType === "carrot_bonus") {
        toast.success(`${resultInfo.label}! +${multiplierChange.toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "small_win") {
        toast(`${resultInfo.label} +${multiplierChange.toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "penalty") {
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
      
      // Randomly highlight next tile every 2 steps
      if (game.step_index % 2 === 0) {
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
      console.error("[FortuneRabbit] Failed to take step:", e);
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
  }, [activeSessionId, game, tiles, refreshWallet, resetGame, resultConfig]);

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
    
    // Play rabbit hop sound (game sound)
    rabbitSound.playHop();
    
    toast.loading("Processing cashout...", { id: "cashout" });

    try {
      const res = await fortuneService.cashout(activeSessionId);
      
      console.log("[FortuneRabbit] Cashout successful:", res.data);
      
      setGame((g) => ({
        ...g,
        status: "cashed_out",
        payout_amount: res.data.payout_amount,
        current_multiplier: res.data.current_multiplier,
        step_index: res.data.step_index,
      }));

      setStageEffect("effect-cashout");
      rabbitSound.playCashoutSound();
      rabbitSound.stopBackgroundMusic();
      refreshWallet();
      
      toast.dismiss("cashout");
      
      const finalMultiplier = parseFloat(res.data.current_multiplier).toFixed(2);
      const winAmount = parseFloat(res.data.payout_amount).toLocaleString("en-NG");
      toast.success(
        `Happy rabbit! Won ₦${winAmount} (${finalMultiplier}x)`,
        { 
          icon: '🏆',
          duration: 3000
        }
      );

      setTimeout(() => {
        resetGame();
        setStakeOpen(true);
      }, 1500);
      
    } catch (e) {
      console.error("[FortuneRabbit] Failed to cashout:", e);
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
  }, [activeSessionId, game.status, refreshWallet, resetGame]);

  /* =========================
     SESSION RECOVERY
  ========================= */
  
  const checkExistingSession = useCallback(async () => {
    const savedSessionId = localStorage.getItem('fortune_rabbit_active_session');
    if (savedSessionId) {
      try {
        const res = await fortuneService.getSessionState(savedSessionId);
        
        if (res.data.status === "active" && res.data.game === "fortune_rabbit") {
          setActiveSessionId(savedSessionId);
          setGame({
            status: "active",
            step_index: res.data.step_index,
            current_multiplier: res.data.current_multiplier,
            payout_amount: res.data.payout_amount,
            session_id: savedSessionId,
            game_type: "fortune_rabbit",
          });
          setStakeOpen(false);
          
          // Start rabbit background music if not muted
          if (!muteState.backgroundMusicMuted) {
            rabbitSound.playBackgroundMusic();
          }
          
          try {
            const configRes = await fortuneService.getGameConfig("fortune_rabbit");
            setGameConfig(prev => ({ ...prev, ...configRes.data }));
          } catch (e) {
            console.log("Could not load game config:", e);
          }
          
          toast.success("Recovered Rabbit game session", {
            icon: "🐰"
          });
        } else {
          localStorage.removeItem('fortune_rabbit_active_session');
        }
      } catch (e) {
        localStorage.removeItem('fortune_rabbit_active_session');
      }
    }
  }, [muteState.backgroundMusicMuted]);

  /* =========================
     EFFECTS
  ========================= */
  
  useEffect(() => {
    checkExistingSession();
    
    return () => {
      rabbitSound.cleanup();
      resetGame();
    };
  }, [checkExistingSession, resetGame]);

  useEffect(() => {
    if (activeSessionId && game.status === "active") {
      localStorage.setItem('fortune_rabbit_active_session', activeSessionId);
    } else if (game.status !== "active") {
      localStorage.removeItem('fortune_rabbit_active_session');
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

  const allMuted = muteState.backgroundMusicMuted && muteState.gameSoundsMuted;
  const bgMutedOnly = muteState.backgroundMusicMuted && !muteState.gameSoundsMuted;
  const gameMutedOnly = !muteState.backgroundMusicMuted && muteState.gameSoundsMuted;

  return (
    <div
      className={`fortune-stage rabbit-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      } ${carrotBonus ? "carrot-bonus-active" : ""}`}
    >
      {/* HEADER - Single Row on Desktop */}
      <div className="fortune-header rabbit-header">
        <div className="fortune-brand">
          <div className="vault-orb rabbit pulse" />
          <div className="fortune-brand-text">
            <div className="fortune-name rabbit-name">Fortune Rabbit</div>
            <div className="fortune-sub rabbit-sub">Carrot collection adventure</div>
          </div>
        </div>

        <div className="fortune-hud rabbit-hud">
          <div className="hud-card rabbit-hud-card">
            <div className="hud-label rabbit-label">MULTI</div>
            <div className="hud-value highlight rabbit-highlight">
              {parseFloat(game.current_multiplier).toFixed(2)}x
            </div>
          </div>

          <div className="hud-card rabbit-hud-card">
            <div className="hud-label rabbit-label">STEPS</div>
            <div className="hud-value rabbit-value">{game.step_index}</div>
          </div>

          <button
            className={`hud-cashout rabbit-cashout ${
              !activeSessionId || game.status !== "active" ? "disabled" : ""
            }`}
            onClick={cashout}
            disabled={!activeSessionId || game.status !== "active" || tapLock.current}
          >
            CASH OUT
          </button>

          <button className="hud-exit rabbit-exit" onClick={() => navigate("/")}>
            EXIT
          </button>
          
          {/* Audio Control Button */}
          <button className="audio-control rabbit-audio" onClick={toggleMute}>
            {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🐰"}
          </button>
        </div>
      </div>
      
      {/* BOARD */}
      <div className="fortune-board rabbit-board">
        <div className="fortune-grid rabbit-grid">
          {tiles.map((tile) => {
            const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
            return (
              <button
                key={tile.id}
                className={`fortune-tile rabbit-tile ${
                  tile.revealed ? tile.kind : ""
                } ${highlightTile === tile.id ? 'highlight-tile' : ''} ${
                  game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""
                }`}
                disabled={tile.revealed || game.status !== "active" || tapLock.current}
                onClick={() => pickTile(tile.id)}
                style={tileResultInfo && tile.revealed ? {
                  borderColor: tileResultInfo.color,
                  boxShadow: `0 0 15px ${tileResultInfo.color}60`
                } : {}}
              >
                <div className="tile-face">
                  {!tile.revealed ? (
                    <>
                      <span className="tile-glyph">🥕</span>
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
        
        {/* Game status overlays */}
        {game.status === "lost" && (
          <div className="game-overlay rabbit-lost">
            <div className="overlay-content">
              <div className="overlay-icon">💣</div>
              <div className="overlay-title">Rabbit Trap!</div>
              <div className="overlay-subtitle">Game Over</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
              <div className="overlay-carrots">
                Carrots collected: {carrotsCollected}
              </div>
            </div>
          </div>
        )}
        
        {game.status === "cashed_out" && (
          <div className="game-overlay rabbit-cashed">
            <div className="overlay-content">
              <div className="overlay-icon">🏆</div>
              <div className="overlay-title">Happy Rabbit!</div>
              <div className="overlay-subtitle">Won ₦{parseFloat(game.payout_amount).toLocaleString("en-NG")}</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
              <div className="overlay-carrots">
                Carrots collected: {carrotsCollected}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* STAKE MODAL with Line Breaker */}
      {stakeOpen && (
        <div className="fortune-stake-backdrop">
          <div className="fortune-stake-modal rabbit-modal">
            <div className="stake-top">
              <div className="stake-badge">🐰</div>
              <div className="stake-title">
                <div className="t1">Fortune Rabbit</div>
                <div className="t2">Collect carrots for bonus multipliers</div>
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
              <div className="line-text">Ready to Hop?</div>
              <div className="line-right"></div>
            </div>

            <div className="stake-actions">
              <button
                className={`stake-btn gold rabbit-btn ${
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
        className="floating-audio-control rabbit-floating" 
        onClick={toggleMute}
        aria-label={allMuted ? "Unmute all sounds" : "Mute all sounds"}
        title={allMuted ? "Unmute all sounds" : "Mute all sounds"}
      >
        {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🐰"}
      </button>
    </div>
  );
}