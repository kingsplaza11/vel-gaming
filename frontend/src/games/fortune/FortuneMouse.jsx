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

const GRID_SIZE = 20;
const MINIMUM_STAKE = 100;

export default function FortuneMouse() {
  const navigate = useNavigate();
  const { 
    wallet, 
    loading: walletLoading, 
    refreshWallet,
    availableBalance // This now contains total balance (balance + spot_balance)
  } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);

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
  const unlockTimeoutRef = useRef(null);
  const gameStateIntervalRef = useRef(null);

  /* =========================
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
    console.log("[FortuneMouse] Resetting game");
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
    setStageEffect("");
    setShake(false);
    setActiveSessionId(null);
    
    // Clear any pending timeout
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    
    // Clear interval
    if (gameStateIntervalRef.current) {
      clearInterval(gameStateIntervalRef.current);
      gameStateIntervalRef.current = null;
    }
  }, []);

  /* =========================
     GAME ACTIONS
  ========================= */
  
  const startGame = async () => {
    // Use availableBalance instead of wallet.balance
    const totalBalance = Number(availableBalance || 0);
    const betAmount = Number(bet);

    const isStakeValid = (
      Number.isFinite(betAmount) &&
      betAmount >= MINIMUM_STAKE &&
      betAmount <= totalBalance
    );

    if (!isStakeValid || walletLoading) {
      console.log("[FortuneMouse] Cannot start game: invalid stake or wallet loading");
      if (betAmount < MINIMUM_STAKE) {
        toast.error(`Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      } else if (betAmount > totalBalance) {
        toast.error("Insufficient balance");
      }
      return;
    }

    console.log("[FortuneMouse] Starting game with bet:", betAmount);
    setStarting(true);
    
    try {
      const res = await fortuneService.startSession({
        game: "fortune_mouse",
        bet_amount: betAmount.toFixed(2),
        client_seed: `fortune:${Date.now()}:${Math.random()}`,
      });

      console.log("[FortuneMouse] Game started:", res.data);
      
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
      
      // Clear any previous tiles
      setTiles(
        Array.from({ length: GRID_SIZE }, (_, i) => ({
          id: i,
          revealed: false,
          kind: null,
        }))
      );
      
      // Refresh wallet to show updated balance
      refreshWallet();
      
      toast.success("Game started! Click tiles to reveal.");
    } catch (e) {
      console.error("[FortuneMouse] Failed to start game:", e);
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.error(`Failed to start game: ${errorMsg}`);
    } finally {
      setStarting(false);
    }
  };

  const pickTile = useCallback(async (id) => {
    if (!activeSessionId) {
      console.warn("[FortuneMouse] Cannot pick tile: no active session");
      toast.error("No active game session");
      return;
    }
    
    if (tapLock.current) {
      console.warn("[FortuneMouse] Cannot pick tile: tap locked");
      toast.error("Please wait for previous action to complete");
      return;
    }
    
    if (game.status !== "active") {
      console.warn("[FortuneMouse] Cannot pick tile: game not active, status is", game.status);
      toast.error("Game is not active");
      return;
    }
    
    if (tiles[id]?.revealed) {
      console.warn("[FortuneMouse] Cannot pick tile: already revealed");
      toast.error("This tile has already been revealed");
      return;
    }

    // Lock to prevent multiple clicks
    tapLock.current = true;
    lastTileRef.current = id;

    console.log("[FortuneMouse] Taking step for tile:", id);
    
    try {
      const res = await fortuneService.takeStep(activeSessionId, {
        tile_id: id,
        msg_id: crypto.randomUUID(),
      });

      console.log("[FortuneMouse] Step result:", res.data);
      
      // Handle duplicate response
      if (res.data.type === "duplicate") {
        console.log("[FortuneMouse] Duplicate action ignored");
        tapLock.current = false;
        return;
      }
      
      // Update tile
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: res.data.result }
            : t
        )
      );

      // Handle game over (trap)
      if (res.data.result === "trap") {
        console.log("[FortuneMouse] Game over - hit a trap");
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
          step_index: res.data.step_index,
          current_multiplier: res.data.current_multiplier,
        }));

        setStageEffect("effect-game_over");
        setShake(true);

        // Reset after delay
        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
          toast.error("Game Over! Hit a bomb tile.");
        }, 1400);
        
        return;
      }
      
      // Handle auto-cashout at max steps
      if (res.data.result === "auto_cashout") {
        console.log("[FortuneMouse] Auto-cashout at max steps:", res.data.payout_amount);
        setGame((g) => ({
          ...g,
          status: "cashed_out",
          payout_amount: res.data.payout_amount,
          current_multiplier: res.data.current_multiplier,
          step_index: res.data.step_index,
        }));

        setStageEffect("effect-cashout");
        refreshWallet();

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
          toast.success(`Auto-cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);
        }, 1500);
        
        return;
      }

      // Handle safe tile
      console.log("[FortuneMouse] Tile result:", res.data.result, "multiplier:", res.data.current_multiplier);
      setStageEffect("effect-boost");
      setTimeout(() => setStageEffect(""), 500);
      
      setGame((g) => ({
        ...g,
        status: res.data.status,
        step_index: res.data.step_index,
        current_multiplier: res.data.current_multiplier,
      }));
      
    } catch (e) {
      console.error("[FortuneMouse] Failed to take step:", e);
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.error(`Failed to reveal tile: ${errorMsg}`);
      
      // If session not found, reset game
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
  }, [activeSessionId, game.status, tiles, refreshWallet, resetGame]);

  const cashout = useCallback(async () => {
    if (!activeSessionId) {
      console.warn("[FortuneMouse] Cannot cashout: no active session");
      toast.error("No active game session");
      return;
    }
    
    if (game.status !== "active") {
      console.warn("[FortuneMouse] Cannot cashout: game not active");
      toast.error("Cannot cashout: game is not active");
      return;
    }

    if (tapLock.current) {
      console.warn("[FortuneMouse] Cannot cashout: tap locked");
      toast.error("Please wait for previous action to complete");
      return;
    }

    // Lock during cashout
    tapLock.current = true;
    
    toast.loading("Processing cashout...", { id: "cashout" });

    try {
      const res = await fortuneService.cashout(activeSessionId);
      
      console.log("[FortuneMouse] Cashout successful:", res.data);
      
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
      toast.success(`Cashed out! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);

      setTimeout(() => {
        resetGame();
        setStakeOpen(true);
      }, 1500);
      
    } catch (e) {
      console.error("[FortuneMouse] Failed to cashout:", e);
      const errorMsg = e.response?.data?.detail || e.response?.data?.message || e.message;
      toast.dismiss("cashout");
      toast.error(`Failed to cashout: ${errorMsg}`);
      
      // If session not found, reset game
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
    // Check localStorage for active session
    const savedSessionId = localStorage.getItem('fortune_active_session');
    if (savedSessionId) {
      try {
        const res = await fortuneService.getSessionState(savedSessionId);
        console.log("[FortuneMouse] Found existing session:", res.data);
        
        if (res.data.status === "active") {
          // Recover active session
          setActiveSessionId(savedSessionId);
          setGame({
            status: "active",
            step_index: res.data.step_index,
            current_multiplier: res.data.current_multiplier,
            payout_amount: res.data.payout_amount,
            session_id: savedSessionId,
          });
          setStakeOpen(false);
          toast.success("Recovered previous game session");
        } else {
          // Clear expired session
          localStorage.removeItem('fortune_active_session');
        }
      } catch (e) {
        console.log("[FortuneMouse] Failed to recover session:", e);
        localStorage.removeItem('fortune_active_session');
      }
    }
  }, []);

  /* =========================
     EFFECTS
  ========================= */
  
  // Check for existing session on mount
  useEffect(() => {
    checkExistingSession();
    
    return () => {
      resetGame();
    };
  }, [checkExistingSession, resetGame]);

  // Save active session ID to localStorage
  useEffect(() => {
    if (activeSessionId && game.status === "active") {
      localStorage.setItem('fortune_active_session', activeSessionId);
    } else if (game.status !== "active") {
      localStorage.removeItem('fortune_active_session');
    }
  }, [activeSessionId, game.status]);

  // Log game state changes
  useEffect(() => {
    console.log("[FortuneMouse] Game state updated:", game);
  }, [game]);

  /* =========================
     RENDER
  ========================= */
  const totalBalance = Number(availableBalance || 0); // Use availableBalance instead of wallet.balance
  const betAmount = Number(bet);

  const isStakeValid = useMemo(() => {
    return (
      Number.isFinite(betAmount) &&
      betAmount >= MINIMUM_STAKE &&
      betAmount <= totalBalance
    );
  }, [betAmount, totalBalance]);

  return (
    <div
      className={`fortune-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      }`}
    >
      {/* HEADER */}
      <div className="fortune-header">
        <div className="fortune-brand">
          <div className="vault-orb pulse" />
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Mouse</div>
            <div className="fortune-sub">Risk & Reward</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
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
        </div>
      </div>
      {/* BOARD */}
      <div className="fortune-board">
        <div className="fortune-grid enhanced">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              className={`fortune-tile ${
                tile.revealed ? tile.kind : ""
              } ${game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""}`}
              disabled={tile.revealed || game.status !== "active" || tapLock.current}
              onClick={() => pickTile(tile.id)}
              aria-label={`Tile ${tile.id + 1} ${tile.revealed ? `revealed as ${tile.kind}` : 'hidden'}`}
            >
              <div className="tile-face">
                {!tile.revealed ? (
                  <span className="tile-glyph">✦</span>
                ) : (
                  <div className="tile-revealed">
                    <span className="tile-icon">
                      {tile.kind === "trap" ? "💣" : 
                       tile.kind === "safe" ? "💰" :
                       tile.kind === "penalty" ? "⚠️" :
                       tile.kind === "reset" ? "🔄" : "?"}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        {/* Game status overlay */}
        {game.status === "lost" && (
          <div className="game-overlay lost">
            <div className="overlay-content">
              <div className="overlay-icon">💥</div>
              <div className="overlay-title">Game Over!</div>
              <div className="overlay-subtitle">Hit a bomb tile</div>
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
              <div className="overlay-subtitle">Won ₦{parseFloat(game.payout_amount).toLocaleString("en-NG")}</div>
              <div className="overlay-multiplier">
                Final multiplier: {parseFloat(game.current_multiplier).toFixed(2)}x
              </div>
            </div>
          </div>
        )}
        
        {tapLock.current && game.status === "active" && (
          <div className="game-overlay processing">
            <div className="overlay-content">
              <div className="spinner large"></div>
              <div className="overlay-title">Processing...</div>
              <div className="overlay-subtitle">Please wait</div>
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
                <div className="t2">Place your stake</div>
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
                Cancel
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