// src/games/fortune/FortuneMouse.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext"; // Import wallet context
import "./fortune.css";

import { fortuneService } from "../../services/api";
import { useFortuneWS } from "./useFortuneWS";
import { createSound } from "./sound";
import AlertModal from "../../components/ui/AlertModal";

const GRID_SIZE = 20;
const MINIMUM_STAKE = 1000; // Minimum stake of 1000 naira

/* ============================================================
   STAKE MODAL
============================================================ */
function StakeModal({
  open,
  walletBalance, // Changed from balance to walletBalance
  bet,
  setBet,
  loading,
  onStart,
  onExit,
  isStakeValid, // New prop to validate stake
}) {
  if (!open) return null;

  const quick = ["1500", "2000", "2500", "5000"];

  return (
    <div className="fortune-stake-backdrop" onClick={onExit}>
      <div
        className="fortune-stake-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stake-top">
          <div className="stake-badge">🐭</div>
          <div className="stake-title">
            <div className="t1">Fortune Mouse</div>
            <div className="t2">Choose your stake to enter the vault</div>
          </div>
        </div>

        <div className="stake-balance">
          <span className="label">Balance</span>
          <span className="value">
            {walletBalance === null || walletBalance === undefined ? (
              <div className="balance-loading">
                <span className="loading-spinner-small" />
                Loading...
              </div>
            ) : (
              `₦${Number(walletBalance || 0).toLocaleString("en-NG")}`
            )}
          </span>
        </div>

        <div className="stake-input-row">
          <div className="stake-currency">₦</div>
          <input
            className="stake-input"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            placeholder="1000"
            inputMode="decimal"
            disabled={loading}
          />
        </div>

        {/* Stake validation message */}
        {!isStakeValid && bet.trim() !== "" && (
          <div className="stake-validation-error">
            Minimum stake is ₦1,000
          </div>
        )}

        <div className="stake-quick">
          {quick.map((q) => (
            <button
              key={q}
              className="stake-chip"
              onClick={() => setBet(q)}
              disabled={loading}
            >
              ₦{Number(q).toLocaleString("en-NG")}
            </button>
          ))}
        </div>

        <div className="stake-actions">
          <button className="stake-btn ghost" onClick={onExit}>
            Exit
          </button>
          <button
            className={`stake-btn gold ${loading ? "loading" : ""}`}
            onClick={onStart}
            disabled={loading || walletBalance === null || walletBalance === undefined || !isStakeValid}
          >
            {loading ? "Entering…" : "Start"}
          </button>
        </div>

        <div className="stake-footnote">
          <span className="spark" />
          Outcomes are server-decided. Play responsibly.
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN GAME
============================================================ */
export default function FortuneMouse({ user }) {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading } = useWallet(); // Get wallet data from context

  /* ------------------ STATE ------------------ */
  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("1000"); // Start with minimum stake
  const [starting, setStarting] = useState(false);
  const [startPayload, setStartPayload] = useState(null);

  const [game, setGame] = useState({
    status: "idle",
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
    server_seed_hash: "",
    revealed_server_seed: null,
  });

  const [tiles, setTiles] = useState(
    Array.from({ length: GRID_SIZE }, (_, i) => ({
      id: i,
      revealed: false,
      kind: null,
      glow: false,
    }))
  );

  const [alert, setAlert] = useState({
    open: false,
    title: "",
    message: "",
  });

  const tapLock = useRef(false);
  const lastTileRef = useRef(null);

  const [shake, setShake] = useState(false);
  const [burst, setBurst] = useState(false);
  const [vaultPulse, setVaultPulse] = useState(false);

  /* ------------------ SOUNDS ------------------ */
  const sounds = useMemo(
    () => ({
      step: createSound("/static/sfx/step.mp3", { volume: 0.55 }),
      win: createSound("/static/sfx/win.mp3", { volume: 0.85 }),
      lose: createSound("/static/sfx/lose.mp3", { volume: 0.9 }),
      click: createSound("/static/sfx/click.mp3", { volume: 0.4 }),
    }),
    []
  );

  useEffect(() => {
    return () => Object.values(sounds).forEach((s) => s.stop());
  }, [sounds]);

  useEffect(() => {
    const t = setInterval(() => setVaultPulse((v) => !v), 1400);
    return () => clearInterval(t);
  }, []);

  /* ------------------ RESET ------------------ */
  const resetGame = () => {
    setGame({
      status: "idle",
      step_index: 0,
      current_multiplier: "1.00",
      payout_amount: "0.00",
      server_seed_hash: "",
      revealed_server_seed: null,
    });

    setTiles(
      Array.from({ length: GRID_SIZE }, (_, i) => ({
        id: i,
        revealed: false,
        kind: null,
        glow: false,
      }))
    );

    setStartPayload(null);
    tapLock.current = false;
  };

  /* ------------------ WS EVENTS ------------------ */
  const onEvent = useCallback(
    (msg) => {
      if (msg.type === "joined") {
        setGame((g) => ({
          ...g,
          status: msg.status,
          step_index: msg.step_index,
          current_multiplier: msg.current_multiplier,
          server_seed_hash: msg.server_seed_hash,
        }));
        return;
      }

      if (msg.type === "step_result") {
        tapLock.current = false;

        if (msg.result === "safe") {
          sounds.step.play();
          setBurst(true);
          setTimeout(() => setBurst(false), 380);

          setTiles((prev) =>
            prev.map((t) =>
              t.id === lastTileRef.current
                ? { ...t, revealed: true, kind: "safe", glow: true }
                : t
            )
          );

          setTimeout(() => {
            setTiles((prev) =>
              prev.map((t) => (t.glow ? { ...t, glow: false } : t))
            );
          }, 420);

          setGame((g) => ({
            ...g,
            step_index: msg.step_index,
            current_multiplier: msg.current_multiplier,
            status: "active",
          }));
        } else {
          sounds.lose.play();
          setShake(true);
          setTimeout(() => setShake(false), 450);

          setTiles((prev) =>
            prev.map((t) =>
              t.id === lastTileRef.current
                ? { ...t, revealed: true, kind: "trap" }
                : t
            )
          );

          setGame((g) => ({
            ...g,
            status: "lost",
            revealed_server_seed: msg.revealed_server_seed,
          }));

          setTimeout(() => {
            resetGame();
            setStakeOpen(true);
          }, 1400);
        }
      }

      if (msg.type === "cashout_result") {
        sounds.win.play();
        setBurst(true);
        setTimeout(() => setBurst(false), 900);

        setGame((g) => ({
          ...g,
          status: "cashed_out",
          payout_amount: msg.payout_amount,
          revealed_server_seed: msg.revealed_server_seed,
        }));

        setTimeout(() => {
          resetGame();
          setStakeOpen(true);
        }, 1600);
      }
    },
    [sounds]
  );

  const { connected, lastError, send } = useFortuneWS({
    wsToken: startPayload?.ws_token,
    onEvent,
  });

  /* ------------------ HELPER FUNCTIONS ------------------ */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  // Format balance for display
  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return '0.00';
    return Number(balance).toFixed(2);
  };

  // Validate stake amount
  const isStakeValid = useMemo(() => {
    const betAmount = Number(bet);
    return Number.isFinite(betAmount) && betAmount >= MINIMUM_STAKE;
  }, [bet]);

  /* ------------------ START GAME ------------------ */
  const startGame = async () => {
    const betAmount = Number(bet);
    const walletBalance = getWalletBalance();
    const currentBalance = Number(walletBalance || 0);

    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      setAlert({
        open: true,
        title: "Invalid Stake",
        message: "Enter a valid stake amount.",
      });
      return;
    }

    // Check minimum stake
    if (betAmount < MINIMUM_STAKE) {
      setAlert({
        open: true,
        title: "Minimum Stake Required",
        message: `Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}.`,
      });
      return;
    }

    if (betAmount > currentBalance) {
      setAlert({
        open: true,
        title: "Insufficient Balance",
        message: "Fund your account and try again.",
      });
      return;
    }

    // Check if wallet is still loading
    if (walletLoading) {
      setAlert({
        open: true,
        title: "Loading Balance",
        message: "Please wait while your balance loads...",
      });
      return;
    }

    setStarting(true);
    try {
      const res = await fortuneService.startSession({
        game: "fortune_mouse",
        bet_amount: betAmount.toFixed(2),
        client_seed: `${user?.id || "user"}:${Date.now()}`,
      });

      setStartPayload(res.data);
      setStakeOpen(false);

      setGame((g) => ({
        ...g,
        status: "active",
        server_seed_hash: res.data.server_seed_hash,
      }));
    } catch (e) {
      setAlert({
        open: true,
        title: "Start Failed",
        message:
          e?.response?.data?.detail ||
          "Unable to start game. Try again.",
      });
    } finally {
      setStarting(false);
    }
  };

  /* ------------------ ACTIONS ------------------ */
  const pickTile = (id) => {
    if (!connected || tapLock.current || game.status !== "active") return;

    sounds.click.play();
    tapLock.current = true;
    lastTileRef.current = id;

    send({
      type: "step",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
      action: "tile_pick",
      choice: String(id),
    });
  };

  const cashout = () => {
    if (!connected || game.step_index <= 0) return;
    send({
      type: "cashout",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
    });
  };

  /* ------------------ UI ------------------ */
  const livePill =
    game.status === "lost"
      ? { cls: "bad", text: "TRAP" }
      : game.status === "cashed_out"
      ? {
          cls: "ok",
          text: `WIN ₦${Number(game.payout_amount).toLocaleString("en-NG")}`,
        }
      : connected
      ? { cls: "ok", text: "LIVE" }
      : { cls: "warn", text: "CONNECTING" };

  return (
    <div
      className={`fortune-stage ${
        shake ? "shake" : ""
      } ${game.status === "lost" ? "lost" : ""} ${
        game.status === "cashed_out" ? "win" : ""
      }`}
    >
      <StakeModal
        open={stakeOpen}
        walletBalance={getWalletBalance()} // Pass wallet balance
        bet={bet}
        setBet={setBet}
        loading={starting}
        onStart={startGame}
        onExit={() => navigate("/", { replace: true })}
        isStakeValid={isStakeValid} // Pass stake validation
      />

      <AlertModal
        open={alert.open}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert({ ...alert, open: false })}
      />

      <div className="fortune-header">
        <div className="fortune-brand">
          <div className={`vault-orb ${vaultPulse ? "pulse" : ""}`} />
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Mouse</div>
            <div className="fortune-sub">
              Tap tiles • Build streak
            </div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value">{game.current_multiplier}x</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">STEPS</div>
            <div className="hud-value">{game.step_index}</div>
          </div>

          <button
            className="hud-cashout"
            onClick={cashout}
            disabled={!connected || game.step_index <= 0}
          >
            CASH OUT
          </button>

          <button
            className="hud-exit"
            onClick={() => navigate("/", { replace: true })}
          >
            EXIT
          </button>
        </div>
      </div>

      <div className="fortune-scene">
        <div className="vault-bg" />
        <div className={`vault-shimmer ${vaultPulse ? "on" : ""}`} />
        <div
          className={`mouse-runner ${
            game.status !== "active" ? "idle" : ""
          }`}
        />
        <div className={`coin-rain ${burst ? "on" : ""}`}>
          <span className="coin c1" />
          <span className="coin c2" />
          <span className="coin c3" />
          <span className="coin c4" />
          <span className="coin c5" />
          <span className="coin c6" />
        </div>
      </div>

      <div className="fortune-board">
        <div className="fortune-board-top">
          <div className="pill-wrap">
            <span className={`pill ${livePill.cls}`}>
              {livePill.text}
            </span>
            {lastError && (
              <span className="pill bad">{lastError}</span>
            )}
          </div>

          {startPayload?.server_seed_hash && (
            <div className="provably">
              <span className="prov-label">Seed Hash</span>
              <span className="prov-mono">
                {startPayload.server_seed_hash}
              </span>
            </div>
          )}
        </div>

        <div className="fortune-grid">
          {tiles.map((t) => (
            <button
              key={t.id}
              className={`fortune-tile ${
                t.revealed ? t.kind : ""
              } ${t.glow ? "glow" : ""}`}
              disabled={
                stakeOpen ||
                !connected ||
                t.revealed ||
                game.status !== "active"
              }
              onClick={() => pickTile(t.id)}
            >
              <div className="tile-face">
                {!t.revealed && (
                  <span className="tile-glyph">✦</span>
                )}
                {t.revealed && t.kind === "safe" && (
                  <span className="tile-glyph safe">💰</span>
                )}
                {t.revealed && t.kind === "trap" && (
                  <span className="tile-glyph trap">☠️</span>
                )}
              </div>
              <div className="tile-glowline" />
            </button>
          ))}
        </div>

        <div className="fortune-audit">
          {game.revealed_server_seed && (
            <div className="audit-row">
              <span className="prov-label">Revealed Seed</span>
              <span className="prov-mono">
                {game.revealed_server_seed}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}