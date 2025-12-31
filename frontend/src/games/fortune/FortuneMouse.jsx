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

  const [tiles, setTiles] = useState([]);

  /* =========================
     REFS
  ========================= */
  const tapLock = useRef(false);
  const lastTileRef = useRef(null);

  /* =========================
     RESET GAME
  ========================= */
  const resetGame = useCallback(() => {
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
     WEBSOCKET EVENTS
  ========================= */
  const onEvent = useCallback((msg) => {
    // 🔓 ALWAYS unlock
    tapLock.current = false;

    if (msg.type === "step_result") {
      setTiles((prev) =>
        prev.map((t) =>
          t.id === lastTileRef.current
            ? { ...t, revealed: true, kind: msg.result }
            : t
        )
      );

      // 💣 LOSS
      if (msg.result === "trap") {
        setGame((g) => ({
          ...g,
          status: "lost",
          payout_amount: "0.00",
        }));

        setStageEffect("effect-game_over");
        setShake(true);

        // ⏱️ Pause → reset → stake modal
        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1400);

        return;
      }

      // ✅ SAFE
      setStageEffect("effect-boost");
      setGame((g) => ({
        ...g,
        status: "active",
        step_index: msg.step_index,
        current_multiplier: msg.current_multiplier,
      }));
      return;
    }

    if (msg.type === "cashout_result") {
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

    if (msg.type === "state") {
      setGame((g) => ({
        ...g,
        status: msg.status,
        step_index: msg.step_index,
        current_multiplier: msg.current_multiplier,
        payout_amount: msg.payout_amount || g.payout_amount,
      }));
      return;
    }

    if (msg.type === "error") {
      console.error("WS error:", msg);
    }
  }, [resetGame]);

  const { connected, send, lastError } = useFortuneWS({
    wsToken,
    onEvent,
  });

  /* =========================
     START GAME
  ========================= */
  const walletBalance = Number(wallet?.balance || 0);
  const betAmount = Number(bet);

  const isStakeValid =
    Number.isFinite(betAmount) &&
    betAmount >= MINIMUM_STAKE &&
    betAmount <= walletBalance;

  const startGame = async () => {
    if (!isStakeValid || walletLoading) return;

    setStarting(true);
    try {
      const res = await fortuneService.startSession({
        game: "fortune_mouse",
        bet_amount: betAmount.toFixed(2),
        client_seed: `fortune:${Date.now()}:${Math.random()}`,
      });

      resetGame();
      setGame((g) => ({ ...g, status: "active" }));
      setWsToken(res.data.ws_token);
      setStakeOpen(false);
    } catch (e) {
      alert("Failed to start game");
    } finally {
      setStarting(false);
    }
  };

  /* =========================
     TILE PICK
  ========================= */
  const pickTile = (id) => {
    if (!connected || tapLock.current || game.status !== "active") return;
    if (tiles[id]?.revealed) return;

    tapLock.current = true;
    lastTileRef.current = id;

    send({
      type: "step",
      msg_id: crypto.randomUUID(),
      action: "tile_pick",
      choice: String(id),
      client_ts_ms: Date.now(),
    });

    // ⛑️ failsafe
    setTimeout(() => {
      tapLock.current = false;
    }, 1200);
  };

  /* =========================
     CASHOUT
  ========================= */
  const cashout = () => {
    if (!connected || game.status !== "active") return;

    send({
      type: "cashout",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
    });
  };

  /* =========================
     UI
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
              {game.current_multiplier}x
            </div>
          </div>

          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">{game.step_index}</div>
          </div>

          <button
            className="hud-cashout"
            onClick={cashout}
            disabled={!connected || game.status !== "active"}
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
      </div>

      {/* BOARD */}
      <div className="fortune-board">
        <div className="fortune-grid enhanced">
          {tiles.map((t) => (
            <button
              key={t.id}
              className={`fortune-tile ${
                t.revealed ? t.kind : ""
              }`}
              disabled={t.revealed || game.status !== "active"}
              onClick={() => pickTile(t.id)}
            >
              <div className="tile-face">
                {!t.revealed && <span className="tile-glyph">✦</span>}
                {t.revealed && (
                  <div className="tile-revealed">
                    <span className="tile-icon">
                      {t.kind === "trap" ? "💣" : "💰"}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
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
                onChange={(e) => setBet(e.target.value)}
                placeholder="Enter amount"
              />
            </div>

            {!isStakeValid && bet && (
              <div className="stake-validation-error">
                Minimum ₦{MINIMUM_STAKE} – must not exceed balance
              </div>
            )}

            <div className="stake-actions">
              <button
                className={`stake-btn gold ${
                  starting ? "loading" : ""
                }`}
                disabled={!isStakeValid || starting}
                onClick={startGame}
              >
                Start
              </button>
            </div>

            <div className="stake-footnote">
              <span className="spark" />
              Provably fair • High risk
            </div>
          </div>
        </div>
      )}

      {lastError && (
        <div className="pill bad ws-error">{lastError}</div>
      )}
    </div>
  );
}
