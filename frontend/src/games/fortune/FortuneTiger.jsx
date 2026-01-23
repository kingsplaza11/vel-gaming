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
import "./fortunetiger.css";

const GRID_SIZE = 16;
const MINIMUM_STAKE = 100;

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
  const [muteState, setMuteState] = useState(tigerSound.getMuteState());
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
  const unlockTimeoutRef = useRef(null);

  /* =========================
     AUDIO CONTROLS
  ========================= */
  const toggleMute = () => {
    const { bgMuted, gameMuted } = tigerSound.toggleMute();
    setMuteState({ backgroundMusicMuted: bgMuted, gameSoundsMuted: gameMuted });
    
    const bgText = bgMuted ? "Background music muted" : "Background music unmuted";
    const gameText = gameMuted ? "Game sounds muted" : "Game sounds active";
    
    toast(
      <div>
        <div>{bgText}</div>
        <div>{gameText}</div>
      </div>,
      {
        icon: bgMuted && gameMuted ? "🔇" : bgMuted ? "🎵" : gameMuted ? "🔊" : "🐯"
      }
    );
  };

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
    
    tigerSound.stopBackgroundMusic();
    
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

    console.log("[FortuneTiger] Starting game with bet:", betAmount);
    setStarting(true);
    
    // Play stake sound (game sound, not background music)
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
      
      // Start tiger background music if not muted
      if (!muteState.backgroundMusicMuted) {
        tigerSound.playBackgroundMusic();
      }
      
      refreshWallet();
      
      // Tiger roar effect (game sound)
      tigerSound.playRoar();
      setTigerRoar(true);
      setTimeout(() => setTigerRoar(false), 1000);
      
      // Randomly highlight a tile (visual cue)
      setTimeout(() => {
        const randomTile = Math.floor(Math.random() * GRID_SIZE);
        setHighlightTile(randomTile);
        setTimeout(() => setHighlightTile(null), 2000);
      }, 1500);
      
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

    console.log("[FortuneTiger] Taking step for tile:", id);
    
    // Play tiger tap sound (game sound)
    tigerSound.playTap();
    
    try {
      const res = await fortuneService.takeStep(activeSessionId, {
        tile_id: id,
        msg_id: crypto.randomUUID(),
      });

      console.log("[FortuneTiger] Step result:", res.data);
      
      if (res.data.type === "duplicate") {
        tapLock.current = false;
        return;
      }
      
      const resultType = res.data.result;
      const resultInfo = resultConfig[resultType] || { icon: "?", label: "Unknown" };
      
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: resultType }
            : t
        )
      );

      // Play tile reveal sound (game sound)
      tigerSound.playTileSound(resultType);

      // Apply visual effect based on result
      setStageEffect(resultInfo.effect || "");
      setTimeout(() => setStageEffect(""), 500);

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
        setTigerRoar(true);
        
        // Play game over sound (game sound)
        tigerSound.playGameOverSound();
        tigerSound.stopBackgroundMusic();

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
        tigerSound.playCashoutSound();
        tigerSound.stopBackgroundMusic();
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
    
    // Play tiger tap sound (game sound)
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
      tigerSound.playCashoutSound();
      tigerSound.stopBackgroundMusic();
      refreshWallet();
      
      toast.dismiss("cashout");
      
      const finalMultiplier = parseFloat(res.data.current_multiplier).toFixed(2);
      const winAmount = parseFloat(res.data.payout_amount).toLocaleString("en-NG");
      toast.success(
        `Tiger victory! Won ₦${winAmount} (${finalMultiplier}x)`,
        { 
          icon: '👑',
          duration: 3000
        }
      );

      setTimeout(() => {
        resetGame();
        setStakeOpen(true);
      }, 1500);
      
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
  }, [activeSessionId, game.status, refreshWallet, resetGame]);

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
          
          // Start tiger background music if not muted
          if (!muteState.backgroundMusicMuted) {
            tigerSound.playBackgroundMusic();
          }
          
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
  }, [muteState.backgroundMusicMuted]);

  /* =========================
     EFFECTS
  ========================= */
  
  useEffect(() => {
    checkExistingSession();
    
    return () => {
      tigerSound.cleanup();
      resetGame();
    };
  }, [checkExistingSession, resetGame]);

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

  const allMuted = muteState.backgroundMusicMuted && muteState.gameSoundsMuted;
  const bgMutedOnly = muteState.backgroundMusicMuted && !muteState.gameSoundsMuted;
  const gameMutedOnly = !muteState.backgroundMusicMuted && muteState.gameSoundsMuted;

  return (
    <div
      className={`fortune-stage tiger-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      } ${tigerRoar ? "tiger-roar" : ""}`}
    >
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
          
          {/* Last Result Display */}
          {resultInfo && game.status === "active" && (
            <div className="hud-card tiger-hud-card last-result" style={{ color: resultInfo.color }}>
              <div className="hud-label tiger-label">LAST</div>
              <div className="hud-value tiger-value">
                {resultInfo.icon} {resultInfo.label}
              </div>
            </div>
          )}

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
            {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🐯"}
          </button>
        </div>
      </div>
      
      {/* BOARD */}
      <div className="fortune-board tiger-board">
        <div className="fortune-grid tiger-grid">
          {tiles.map((tile) => {
            const tileResultInfo = tile.revealed ? resultConfig[tile.kind] : null;
            return (
              <button
                key={tile.id}
                className={`fortune-tile tiger-tile ${
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
        
        {/* Game status overlays */}
        {game.status === "lost" && (
          <div className="game-overlay tiger-lost">
            <div className="overlay-content">
              <div className="overlay-icon">💀</div>
              <div className="overlay-title">Tiger Attack!</div>
              <div className="overlay-subtitle">Game Over</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
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
        aria-label={allMuted ? "Unmute all sounds" : "Mute all sounds"}
        title={allMuted ? "Unmute all sounds" : "Mute all sounds"}
      >
        {allMuted ? "🔇" : bgMutedOnly ? "🎵" : gameMutedOnly ? "🔊" : "🐯"}
      </button>
    </div>
  );
}