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
import toast from "react-hot-toast";
import "./fortune.css";

const GRID_SIZE = 25; // Rabbit has larger grid
const MINIMUM_STAKE = 100;

export default function FortuneRabbit() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance  } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [gameConfig, setGameConfig] = useState({
    title: "Fortune Rabbit",
    icon: "🐰",
    grid_size: GRID_SIZE,
    min_stake: MINIMUM_STAKE,
    risk_level: "low",
  });

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);
  const [carrotBonus, setCarrotBonus] = useState(false);
  const [carrotsCollected, setCarrotsCollected] = useState(0);

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
      hasCarrot: false,
    }))
  );

  /* =========================
     REFS
  ========================= */
  const tapLock = useRef(false);
  const lastTileRef = useRef(null);
  const unlockTimeoutRef = useRef(null);

  /* =========================
     GAME RESULTS CONFIGURATION
     Updated to match backend probabilities (40% above 1.5x)
  ========================= */
  const resultConfig = useMemo(() => ({
    // 40% chance above 1.5x - Good wins
    "safe": {
      icon: "💰",
      label: "Bonus",
      color: "var(--success)",
      effect: "effect-boost",
      sound: "win"
    },
    "carrot_bonus": {
      icon: "🥕",
      label: "Carrot Bonus",
      color: "var(--success)",
      effect: "effect-carrot-bonus",
      sound: "bonus"
    },
    
    // 30% chance below 1.5x - Small wins
    "small_win": {
      icon: "💸",
      label: "Small Win",
      color: "var(--warning)",
      effect: "effect-small-win",
      sound: "small-win"
    },
    
    // 15% chance penalty
    "penalty": {
      icon: "⚠️",
      label: "Penalty",
      color: "var(--warning)",
      effect: "effect-penalty",
      sound: "penalty"
    },
    
    // 10% chance trap
    "trap": {
      icon: "💣",
      label: "Trap",
      color: "var(--danger)",
      effect: "effect-game_over",
      sound: "trap"
    },
    
    // 5% chance reset
    "reset": {
      icon: "🔄",
      label: "Reset",
      color: "var(--info)",
      effect: "effect-reset",
      sound: "reset"
    },
    
    "auto_cashout": {
      icon: "⏰",
      label: "Auto Cashout",
      color: "var(--success)",
      effect: "effect-cashout",
      sound: "cashout"
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
        hasCarrot: false,
      }))
    );

    tapLock.current = false;
    lastTileRef.current = null;
    setStageEffect("");
    setShake(false);
    setCarrotBonus(false);
    setCarrotsCollected(0);
    setActiveSessionId(null);
    
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
      
      const gridSize = res.data.grid_size || GRID_SIZE;
      setTiles(
        Array.from({ length: gridSize }, (_, i) => ({
          id: i,
          revealed: false,
          kind: null,
          hasCarrot: (i + 1) % 5 === 0, // Every 5th tile starts with a carrot
        }))
      );
      
      refreshWallet();
      
      toast.success("Rabbit game started! Collect carrots for bonuses!");
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
      const wasCarrotTile = tiles[id]?.hasCarrot;
      const isCarrotBonus = resultType === "carrot_bonus";
      
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: resultType }
            : t
        )
      );

      // Apply visual effect based on result
      setStageEffect(resultInfo.effect || "");
      setTimeout(() => setStageEffect(""), 500);

      // Update carrot count
      if (wasCarrotTile || isCarrotBonus) {
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

        // Show result toast
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

        refreshWallet();

        // Show success toast
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
      
      // Show result toast based on type
      if (resultType === "safe" || resultType === "carrot_bonus") {
        toast.success(`${resultInfo.label}! +${(parseFloat(res.data.current_multiplier) - parseFloat(game.current_multiplier)).toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "small_win") {
        toast(`${resultInfo.label} +${(parseFloat(res.data.current_multiplier) - parseFloat(game.current_multiplier)).toFixed(2)}x`, {
          icon: resultInfo.icon,
          duration: 2000,
        });
      } else if (resultType === "penalty") {
        toast.error(`${resultInfo.label} ${(parseFloat(game.current_multiplier) - parseFloat(res.data.current_multiplier)).toFixed(2)}x`, {
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
      refreshWallet();
      
      toast.dismiss("cashout");
      toast.success(`Happy rabbit! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);

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
          
          toast.success("Recovered Rabbit game session");
        } else {
          localStorage.removeItem('fortune_rabbit_active_session');
        }
      } catch (e) {
        localStorage.removeItem('fortune_rabbit_active_session');
      }
    }
  }, []);

  /* =========================
     EFFECTS
  ========================= */
  
  useEffect(() => {
    checkExistingSession();
    
    return () => {
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

  return (
    <div
      className={`fortune-stage rabbit-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      } ${carrotBonus ? "carrot-bonus-active" : ""}`}
    >
      {/* HEADER */}
      <div className="fortune-header">
        <div className="fortune-brand">
          <div className="vault-orb rabbit pulse" />
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Rabbit</div>
            <div className="fortune-sub">Carrot collection adventure</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value highlight rabbit-highlight">
              {parseFloat(game.current_multiplier).toFixed(2)}x
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">{game.step_index}</div>
          </div>

          <div className="hud-card">
            <div className="hud-label">CARROTS</div>
            <div className="hud-value carrot-count">{carrotsCollected}</div>
          </div>
          
          {/* Last Result Display */}
          {resultInfo && game.status === "active" && (
            <div className="hud-card last-result" style={{ color: resultInfo.color }}>
              <div className="hud-label">LAST</div>
              <div className="hud-value">
                {resultInfo.icon} {resultInfo.label}
              </div>
            </div>
          )}

          <button
            className={`hud-cashout rabbit-cashout ${
              !activeSessionId || game.status !== "active" ? "disabled" : ""
            }`}
            onClick={cashout}
            disabled={!activeSessionId || game.status !== "active" || tapLock.current}
          >
            CASH OUT
          </button>

          <button className="hud-exit" onClick={() => navigate("/")}>
            EXIT
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
                } ${tile.hasCarrot ? "has-carrot" : ""} ${
                  game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""
                }`}
                disabled={tile.revealed || game.status !== "active" || tapLock.current}
                onClick={() => pickTile(tile.id)}
                style={tileResultInfo && tile.revealed ? {
                  borderColor: tileResultInfo.color,
                  boxShadow: `0 0 10px ${tileResultInfo.color}40`
                } : {}}
              >
                <div className="tile-face">
                  {!tile.revealed ? (
                    <>
                      <span className="tile-glyph">🥕</span>
                      {tile.hasCarrot && !tile.revealed && (
                        <div className="carrot-glow" />
                      )}
                    </>
                  ) : (
                    <div className="tile-revealed">
                      <span className="tile-icon">
                        {tileResultInfo?.icon || "?"}
                      </span>
                      {tile.kind === "safe" || tile.kind === "carrot_bonus" ? (
                        <div className="tile-sparkle"></div>
                      ) : null}
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
        
        {tapLock.current && game.status === "active" && (
          <div className="game-overlay processing">
            <div className="overlay-content">
              <div className="spinner large"></div>
              <div className="overlay-title">Rabbit is hopping...</div>
              <div className="overlay-subtitle">Please wait</div>
            </div>
          </div>
        )}
      </div>

      {/* STAKE MODAL */}
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
                  "Start Game"
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
      
      {/* Provably Fair Button */}
      {game.status === "cashed_out" && (
        <div className="provably-fair-section">
          <button 
            className="provably-fair-btn"
            onClick={async () => {
              try {
                const res = await fortuneService.revealSeed(activeSessionId);
                toast.success(
                  <div>
                    <div>Server Seed: {res.data.server_seed}</div>
                    <div>Client Seed: {res.data.client_seed}</div>
                    <div>Hash: {res.data.server_seed_hash}</div>
                  </div>,
                  { duration: 10000 }
                );
              } catch (e) {
                toast.error("Failed to reveal seeds");
              }
            }}
          >
            Verify Fairness
          </button>
        </div>
      )}
    </div>
  );
}