import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { fortuneService } from "../../services/api";
import { fortuneSound } from "../../utils/FortuneSoundManager";
import toast from "react-hot-toast";
import "./fortunemouse.css";

const GRID_SIZE = 20;
const MINIMUM_STAKE = 100;

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

  const [game, setGame] = useState({
    status: "idle", // idle | active | lost | cashed_out
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

  /* =========================
     GAME RESULTS CONFIGURATION
     REMOVED: "safe" and "carrot_bonus" (bonus tiles)
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
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
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
  }, []);

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
      
      // Start background music
      fortuneSound.playBackgroundMusic();
      
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
        fortuneSound.stopBackgroundMusic();

        toast.error(`Trap! ${resultInfo.label} - Game Over`, {
          icon: resultInfo.icon,
          duration: 3000,
        });

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1400);
        
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
        fortuneSound.stopBackgroundMusic();
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

      // Show result toast
      const oldMultiplier = parseFloat(game.current_multiplier);
      const newMultiplier = parseFloat(res.data.current_multiplier);
      const multiplierChange = newMultiplier - oldMultiplier;
      
      // REMOVED: Bonus tile toasts ("safe" and "carrot_bonus")
      
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
      fortuneSound.stopBackgroundMusic();
      refreshWallet();
      
      toast.dismiss("cashout");
      toast.success(`Cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);

      setTimeout(() => {
        resetGame();
        setStakeOpen(true);
      }, 1500);
      
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
  }, [activeSessionId, game.status, refreshWallet, resetGame]);

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
            fortuneSound.playBackgroundMusic();
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
    };
  }, []);

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