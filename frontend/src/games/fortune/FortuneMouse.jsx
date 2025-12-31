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
import { useFortuneWS } from "./useFortuneWS";
import "./fortune.css";

const GRID_SIZE = 20;
const MINIMUM_STAKE = 100;

export default function FortuneMouse() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [wsToken, setWsToken] = useState(null);

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);

  const [game, setGame] = useState({
    status: "idle", // idle | active | lost | cashed_out
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
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
  const messageQueue = useRef([]);

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
    setWsToken(null);
  }, []);

  /* =========================
     WEBSOCKET EVENTS HANDLER
  ========================= */
  const onEvent = useCallback((msg) => {
    console.log("[FortuneMouse] WebSocket message:", msg.type, msg);
    
    // Handle authentication
    if (msg.type === "joined") {
      console.log("[FortuneMouse] Successfully joined game session");
      setGame(prev => ({
        ...prev,
        status: msg.status === "active" ? "active" : prev.status,
        step_index: msg.step_index || prev.step_index,
        current_multiplier: msg.current_multiplier || prev.current_multiplier,
      }));
      return;
    }
    
    // Handle step results
    if (msg.type === "step_result") {
      // Always unlock tap lock when we get a response
      tapLock.current = false;
      
      const tileId = lastTileRef.current;
      if (tileId !== null) {
        setTiles(prev =>
          prev.map((t) =>
            t.id === tileId
              ? { ...t, revealed: true, kind: msg.result }
              : t
          )
        );
      }

      // Handle game over (trap)
      if (msg.result === "trap") {
        console.log("[FortuneMouse] Game over - hit a trap");
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
        }));

        setStageEffect("effect-game_over");
        setShake(true);

        // Reset after delay
        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1400);

        return;
      }

      // Handle safe tile
      console.log("[FortuneMouse] Safe tile - multiplier updated:", msg.current_multiplier);
      setStageEffect("effect-boost");
      setGame((g) => ({
        ...g,
        status: "active",
        step_index: msg.step_index,
        current_multiplier: msg.current_multiplier,
      }));
      return;
    }

    // Handle cashout
    if (msg.type === "cashout_result") {
      console.log("[FortuneMouse] Cashout successful:", msg.payout_amount);
      setGame((g) => ({
        ...g,
        status: "cashed_out",
        payout_amount: msg.payout_amount,
        current_multiplier: msg.current_multiplier,
      }));

      setStageEffect("effect-cashout");

      setTimeout(() => {
        resetGame();
        setStakeOpen(true);
      }, 1500);
      return;
    }

    // Handle state updates (for reconnection)
    if (msg.type === "state") {
      console.log("[FortuneMouse] State update:", msg.status);
      setGame((g) => ({
        ...g,
        status: msg.status,
        step_index: msg.step_index || g.step_index,
        current_multiplier: msg.current_multiplier || g.current_multiplier,
        payout_amount: msg.payout_amount || g.payout_amount,
      }));
      return;
    }

    // Handle errors
    if (msg.type === "error") {
      console.error("[FortuneMouse] WebSocket error:", msg);
      
      // If it's an authentication error, reset the session
      if (msg.code === "auth_failed" || msg.code === "session_not_found") {
        alert("Session expired. Please start a new game.");
        resetGame();
        setStakeOpen(true);
      }
      
      // Always unlock on error
      tapLock.current = false;
      return;
    }
    
    // Handle duplicate messages
    if (msg.type === "duplicate") {
      console.log("[FortuneMouse] Duplicate message ignored");
      tapLock.current = false;
      return;
    }
    
    // Handle pong (heartbeat response)
    if (msg.type === "pong") {
      return;
    }
    
    // Handle connection established
    if (msg.type === "connected") {
      console.log("[FortuneMouse] WebSocket connected");
      return;
    }
  }, [resetGame]);

  /* =========================
     WEBSOCKET HOOK
  ========================= */
  const { connected, authenticated, send, lastError } = useFortuneWS({
    wsToken,
    onEvent,
  });

  /* =========================
     START GAME
  ========================= */
  const walletBalance = Number(wallet?.balance || 0);
  const betAmount = Number(bet);

  const isStakeValid = useMemo(() => {
    return (
      Number.isFinite(betAmount) &&
      betAmount >= MINIMUM_STAKE &&
      betAmount <= walletBalance
    );
  }, [betAmount, walletBalance]);

  const startGame = async () => {
    if (!isStakeValid || walletLoading) {
      console.log("[FortuneMouse] Cannot start game: invalid stake or wallet loading");
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

      console.log("[FortuneMouse] Game started, WS token:", res.data.ws_token);
      
      // Reset game state
      resetGame();
      setGame(prev => ({ ...prev, status: "active" }));
      setWsToken(res.data.ws_token);
      setStakeOpen(false);
      
      // Clear any previous tiles
      setTiles(
        Array.from({ length: GRID_SIZE }, (_, i) => ({
          id: i,
          revealed: false,
          kind: null,
        }))
      );
    } catch (e) {
      console.error("[FortuneMouse] Failed to start game:", e);
      alert(`Failed to start game: ${e.response?.data?.detail || e.message}`);
    } finally {
      setStarting(false);
    }
  };

  /* =========================
     TILE PICK
  ========================= */
  const pickTile = useCallback((id) => {
    console.log("[FortuneMouse] Picking tile:", id, {
      authenticated,
      tapLock: tapLock.current,
      gameStatus: game.status,
      tileRevealed: tiles[id]?.revealed
    });
    
    if (!authenticated) {
      console.warn("[FortuneMouse] Cannot pick tile: not authenticated");
      return;
    }
    
    if (tapLock.current) {
      console.warn("[FortuneMouse] Cannot pick tile: tap locked");
      return;
    }
    
    if (game.status !== "active") {
      console.warn("[FortuneMouse] Cannot pick tile: game not active, status is", game.status);
      return;
    }
    
    if (tiles[id]?.revealed) {
      console.warn("[FortuneMouse] Cannot pick tile: already revealed");
      return;
    }

    // Lock to prevent multiple clicks
    tapLock.current = true;
    lastTileRef.current = id;

    console.log("[FortuneMouse] Sending step message for tile:", id);
    const success = send({
      type: "step",
      msg_id: crypto.randomUUID(),
      action: "tile_pick",
      choice: String(id),
      client_ts_ms: Date.now(),
    });

    if (!success) {
      console.error("[FortuneMouse] Failed to send step message");
      tapLock.current = false;
      return;
    }

    // Failsafe unlock after timeout
    const unlockTimeout = setTimeout(() => {
      if (tapLock.current) {
        console.warn("[FortuneMouse] Failsafe: unlocking tap lock");
        tapLock.current = false;
      }
    }, 3000);

    // Clean up timeout
    return () => clearTimeout(unlockTimeout);
  }, [authenticated, game.status, tiles, send]);

  /* =========================
     CASHOUT
  ========================= */
  const cashout = useCallback(() => {
    console.log("[FortuneMouse] Attempting cashout");
    
    if (!authenticated) {
      console.warn("[FortuneMouse] Cannot cashout: not authenticated");
      return;
    }
    
    if (game.status !== "active") {
      console.warn("[FortuneMouse] Cannot cashout: game not active");
      return;
    }

    const success = send({
      type: "cashout",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
    });

    if (!success) {
      console.error("[FortuneMouse] Failed to send cashout message");
    }
  }, [authenticated, game.status, send]);

  /* =========================
     EFFECTS
  ========================= */
  
  // Reset game when component unmounts
  useEffect(() => {
    return () => {
      console.log("[FortuneMouse] Component unmounting, cleaning up");
      resetGame();
    };
  }, [resetGame]);

  // Log game state changes
  useEffect(() => {
    console.log("[FortuneMouse] Game state updated:", game);
  }, [game]);

  // Log WebSocket connection status
  useEffect(() => {
    console.log("[FortuneMouse] WebSocket status:", {
      connected,
      authenticated,
      lastError,
      wsToken: wsToken ? "present" : "missing"
    });
  }, [connected, authenticated, lastError, wsToken]);

  /* =========================
     RENDER
  ========================= */
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
            className={`hud-cashout ${!authenticated || game.status !== "active" ? "disabled" : ""}`}
            onClick={cashout}
            disabled={!authenticated || game.status !== "active"}
          >
            CASH OUT
          </button>

          <button className="hud-exit" onClick={() => navigate("/")}>
            EXIT
          </button>
        </div>
      </div>

      {/* SCENE */}
      <div className="fortune-scene">
        <div className="vault-bg" />
        <div className="mouse-runner idle" />
        
        {/* Connection status indicator */}
        <div className="connection-status">
          {!wsToken ? (
            <div className="status-idle">Ready to start</div>
          ) : !connected ? (
            <div className="status-connecting">Connecting...</div>
          ) : !authenticated ? (
            <div className="status-authenticating">Authenticating...</div>
          ) : (
            <div className="status-connected">Connected ✓</div>
          )}
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
              } ${game.status !== "active" || tile.revealed ? "disabled" : ""}`}
              disabled={tile.revealed || game.status !== "active"}
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
            </div>
          </div>
        )}
        
        {game.status === "cashed_out" && (
          <div className="game-overlay cashed">
            <div className="overlay-content">
              <div className="overlay-icon">💰</div>
              <div className="overlay-title">Cashed Out!</div>
              <div className="overlay-subtitle">Won ₦{parseFloat(game.payout_amount).toLocaleString("en-NG")}</div>
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
              <span className="label">Balance</span>
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
                placeholder="Enter amount"
                type="text"
                inputMode="decimal"
              />
              <div className="stake-quick-buttons">
                {[100, 500, 1000, 5000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    className="quick-amount"
                    onClick={() => setBet(amount.toString())}
                    disabled={amount > walletBalance}
                  >
                    ₦{amount}
                  </button>
                ))}
              </div>
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
                {starting ? "Starting..." : "Start Game"}
              </button>
              <button
                className="stake-btn secondary"
                onClick={() => navigate("/")}
              >
                Cancel
              </button>
            </div>

            <div className="stake-footnote">
              <span className="spark" />
              Provably fair • High risk
            </div>
          </div>
        </div>
      )}

      {/* Connection error display */}
      {lastError && (
        <div className="connection-error">
          <div className="error-icon">⚠️</div>
          <div className="error-text">
            Connection issue: {lastError}
            {lastError.includes("auth") && (
              <button 
                className="error-retry" 
                onClick={() => {
                  resetGame();
                  setStakeOpen(true);
                }}
              >
                Start New Game
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}