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

const GRID_SIZE = 16; // Tiger has smaller grid
const MINIMUM_STAKE = 500; // Higher minimum for tiger

export default function FortuneTiger() {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  /* =========================
     STATE
  ========================= */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("");
  const [starting, setStarting] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [gameConfig, setGameConfig] = useState({
    title: "Fortune Tiger",
    icon: "🐯",
    grid_size: GRID_SIZE,
    min_stake: MINIMUM_STAKE,
    risk_level: "high",
  });

  const [stageEffect, setStageEffect] = useState("");
  const [shake, setShake] = useState(false);
  const [tigerRoar, setTigerRoar] = useState(false);

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
    }))
  );

  /* =========================
     REFS
  ========================= */
  const tapLock = useRef(false);
  const lastTileRef = useRef(null);
  const unlockTimeoutRef = useRef(null);

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
      }))
    );

    tapLock.current = false;
    lastTileRef.current = null;
    setStageEffect("");
    setShake(false);
    setTigerRoar(false);
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
    const walletBalance = Number(wallet?.balance || 0);
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
        }))
      );
      
      refreshWallet();
      
      // Tiger roar effect
      setTigerRoar(true);
      setTimeout(() => setTigerRoar(false), 1000);
      
      toast.success("Tiger game started! High risk, high reward!");
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
      
      setTiles(prev =>
        prev.map((t) =>
          t.id === id
            ? { ...t, revealed: true, kind: res.data.result }
            : t
        )
      );

      // Handle game over (trap)
      if (res.data.result === "trap") {
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
          step_index: res.data.step_index,
          current_multiplier: res.data.current_multiplier,
        }));

        setStageEffect("effect-game_over");
        setShake(true);
        setTigerRoar(true);

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
          toast.error("Tiger got you! Game Over!");
        }, 1400);
        
        return;
      }
      
      // Handle auto-cashout
      if (res.data.result === "auto_cashout") {
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
          toast.success(`Tiger victory! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);
        }, 1500);
        
        return;
      }

      // Handle other results
      console.log("[FortuneTiger] Tile result:", res.data.result);
      
      // Different effects for different results
      if (res.data.result === "safe") {
        setStageEffect("effect-big-boost");
        setTigerRoar(true);
        setTimeout(() => setTigerRoar(false), 500);
      } else if (res.data.result === "major_penalty") {
        setStageEffect("effect-penalty");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        setStageEffect("effect-update");
      }
      
      setTimeout(() => setStageEffect(""), 500);
      
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
  }, [activeSessionId, game.status, tiles, refreshWallet, resetGame]);

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
      
      console.log("[FortuneTiger] Cashout successful:", res.data);
      
      setGame((g) => ({
        ...g,
        status: "cashed_out",
        payout_amount: res.data.payout_amount,
        current_multiplier: res.data.current_multiplier,
        step_index: res.data.step_index,
      }));

      setStageEffect("effect-cashout");
      setTigerRoar(true);
      refreshWallet();
      
      toast.dismiss("cashout");
      toast.success(`Tiger roars with victory! Won ₦${parseFloat(res.data.payout_amount).toLocaleString("en-NG")}`);

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
          
          // Load game config
          try {
            const configRes = await fortuneService.getGameConfig("fortune_tiger");
            setGameConfig(prev => ({ ...prev, ...configRes.data }));
          } catch (e) {
            console.log("Could not load game config:", e);
          }
          
          toast.success("Recovered Tiger game session");
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
    // Load game config
    const loadConfig = async () => {
      try {
        const res = await fortuneService.getGameConfig("fortune_tiger");
        setGameConfig(prev => ({ ...prev, ...res.data }));
      } catch (e) {
        console.log("Could not load game config:", e);
      }
    };
    
    loadConfig();
    checkExistingSession();
    
    return () => {
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
  const walletBalance = Number(wallet?.balance || 0);
  const betAmount = Number(bet);

  const isStakeValid = useMemo(() => {
    return (
      Number.isFinite(betAmount) &&
      betAmount >= gameConfig.min_stake &&
      betAmount <= walletBalance
    );
  }, [betAmount, walletBalance, gameConfig.min_stake]);

  return (
    <div
      className={`fortune-stage tiger-stage ${game.status} ${stageEffect} ${
        shake ? "shake" : ""
      } ${tigerRoar ? "tiger-roar" : ""}`}
    >
      {/* HEADER */}
      <div className="fortune-header">
        <div className="fortune-brand">
          <div className="vault-orb tiger pulse" />
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Tiger</div>
            <div className="fortune-sub">High Risk, High Reward</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value highlight tiger-highlight">
              {parseFloat(game.current_multiplier).toFixed(2)}x
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">{game.step_index}</div>
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

          <button className="hud-exit" onClick={() => navigate("/")}>
            EXIT
          </button>
        </div>
      </div>
      {/* BOARD */}
      <div className="fortune-board tiger-board">
        <div className="fortune-grid tiger-grid">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              className={`fortune-tile tiger-tile ${
                tile.revealed ? tile.kind : ""
              } ${game.status !== "active" || tile.revealed || tapLock.current ? "disabled" : ""}`}
              disabled={tile.revealed || game.status !== "active" || tapLock.current}
              onClick={() => pickTile(tile.id)}
            >
              <div className="tile-face">
                {!tile.revealed ? (
                  <span className="tile-glyph">🐾</span>
                ) : (
                  <div className="tile-revealed">
                    <span className="tile-icon">
                      {tile.kind === "trap" ? "💀" : 
                       tile.kind === "safe" ? "💰" :
                       tile.kind === "penalty" ? "⚠️" :
                       tile.kind === "major_penalty" ? "🔻" :
                       tile.kind === "reset" ? "🔄" : "?"}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
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
        
        {tapLock.current && game.status === "active" && (
          <div className="game-overlay processing">
            <div className="overlay-content">
              <div className="spinner large"></div>
              <div className="overlay-title">Tiger is thinking...</div>
              <div className="overlay-subtitle">Please wait</div>
            </div>
          </div>
        )}
      </div>

      {/* STAKE MODAL */}
      {stakeOpen && (
        <div className="fortune-stake-backdrop">
          <div className="fortune-stake-modal tiger-modal">
            <div className="stake-top">
              <div className="stake-badge">🐯</div>
              <div className="stake-title">
                <div className="t1">Fortune Tiger</div>
                <div className="t2">High stakes adventure</div>
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
                placeholder={`Min ₦${gameConfig.min_stake.toLocaleString("en-NG")}`}
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

            <div className="stake-risk-warning">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">HIGH RISK: Bigger rewards but higher chance of traps!</span>
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
                  "Start Tiger Game"
                )}
              </button>
              <button
                className="stake-btn secondary"
                onClick={() => navigate("/")}
              >
                Back to Games
              </button>
            </div>

            <div className="stake-footnote">
              <span className="spark" />
              High volatility • Big multipliers • Not for the faint-hearted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}