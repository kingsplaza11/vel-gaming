// src/games/fortune/FortuneRabbit.jsx
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

const MINIMUM_STAKE = 100; // Minimum stake of 100 naira

/* ============================================================
   STAKE MODAL (REUSED PATTERN)
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

  const quick = ["1500", "2000", "2500", "5000"]; // Updated quick stakes to start from 1500

  return (
    <div className="fortune-stake-backdrop" onClick={onExit}>
      <div
        className="fortune-stake-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="stake-top">
          <div className="stake-badge">🐰</div>
          <div className="stake-title">
            <div className="t1">Fortune Rabbit</div>
            <div className="t2">Choose your stake to enter the garden</div>
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
      </div>
    </div>
  );
}

/* ============================================================
   MAIN GAME
============================================================ */
export default function FortuneRabbit({ user }) {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading } = useWallet(); // Get wallet data from context

  const [stakeOpen, setStakeOpen] = useState(true);
  const [bet, setBet] = useState("1000"); // Start with minimum stake
  const [starting, setStarting] = useState(false);
  const [startPayload, setStartPayload] = useState(null);

  const [state, setState] = useState({
    status: "idle",
    step_index: 0,
    current_multiplier: "1.00",
    payout_amount: "0.00",
    server_seed_hash: "",
    revealed_server_seed: null,
  });

  const [alert, setAlert] = useState({ open: false, title: "", message: "" });
  const hopLock = useRef(false);

  /* ------------------ SOUNDS ------------------ */
  const sounds = useMemo(
    () => ({
      hop: createSound("/static/sfx/hop.mp3", { volume: 0.7 }),
      bad: createSound("/static/sfx/bad.mp3", { volume: 0.9 }),
      win: createSound("/static/sfx/win.mp3", { volume: 0.85 }),
      lose: createSound("/static/sfx/lose.mp3", { volume: 0.85 }),
    }),
    []
  );

  useEffect(() => () => Object.values(sounds).forEach((s) => s.stop()), [sounds]);

  /* ------------------ HELPER FUNCTIONS ------------------ */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  // Validate stake amount
  const isStakeValid = useMemo(() => {
    const betAmount = Number(bet);
    return Number.isFinite(betAmount) && betAmount >= MINIMUM_STAKE;
  }, [bet]);

  /* ------------------ WS EVENTS ------------------ */
  const onEvent = useCallback(
    (msg) => {
      if (msg.type === "joined") {
        setState((s) => ({
          ...s,
          status: msg.status,
          step_index: msg.step_index,
          current_multiplier: msg.current_multiplier,
          server_seed_hash: msg.server_seed_hash,
        }));
        return;
      }

      if (msg.type === "step_result") {
        hopLock.current = false;

        if (msg.result === "safe") {
          sounds.hop.play();
          setState((s) => ({
            ...s,
            step_index: msg.step_index,
            current_multiplier: msg.current_multiplier,
            status: "active",
          }));
        } else {
          sounds.bad.play();
          sounds.lose.play();
          setState((s) => ({
            ...s,
            status: "lost",
            revealed_server_seed: msg.revealed_server_seed,
          }));

          setTimeout(() => {
            resetGame();
          }, 1400);
        }
      }

      if (msg.type === "cashout_result") {
        sounds.win.play();
        setState((s) => ({
          ...s,
          status: "cashed_out",
          payout_amount: msg.payout_amount,
          revealed_server_seed: msg.revealed_server_seed,
        }));

        setTimeout(() => {
          resetGame();
        }, 1600);
      }
    },
    [sounds]
  );

  const { connected, send } = useFortuneWS({
    wsToken: startPayload?.ws_token,
    onEvent,
  });

  /* ------------------ HELPERS ------------------ */
  const resetGame = () => {
    setState({
      status: "idle",
      step_index: 0,
      current_multiplier: "1.00",
      payout_amount: "0.00",
      server_seed_hash: "",
      revealed_server_seed: null,
    });
    setStartPayload(null);
    setStakeOpen(true);
  };

  /* ------------------ START GAME ------------------ */
  const startGame = async () => {
    const betAmount = Number(bet);
    const walletBalance = getWalletBalance();
    const currentBalance = Number(walletBalance || 0);

    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      setAlert({ 
        open: true, 
        title: "Invalid Stake", 
        message: "Enter a valid stake amount." 
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
        game: "fortune_rabbit",
        bet_amount: betAmount.toFixed(2),
        client_seed: `${user?.id}:${Date.now()}`,
      });

      setStartPayload(res.data);
      setStakeOpen(false);
      setState((s) => ({
        ...s,
        status: "active",
        server_seed_hash: res.data.server_seed_hash,
      }));
    } catch (e) {
      setAlert({
        open: true,
        title: "Start Failed",
        message: e?.response?.data?.detail || "Unable to start game.",
      });
    } finally {
      setStarting(false);
    }
  };

  /* ------------------ ACTIONS ------------------ */
  const hop = () => {
    if (!connected || state.status !== "active" || hopLock.current) return;
    hopLock.current = true;

    send({
      type: "step",
      msg_id: crypto.randomUUID(),
      client_ts_ms: Date.now(),
      action: "hop",
      choice: "hop",
    });
  };

  const cashout = () => {
    if (!connected || state.step_index <= 0) return;
    send({ type: "cashout", msg_id: crypto.randomUUID(), client_ts_ms: Date.now() });
  };

  /* ------------------ UI ------------------ */
  return (
    <div className="fortune-stage">
      <StakeModal
        open={stakeOpen}
        walletBalance={getWalletBalance()} // Updated to use wallet balance
        bet={bet}
        setBet={setBet}
        loading={starting}
        onStart={startGame}
        onExit={() => navigate("/", { replace: true })} // Fixed navigation
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
          <div className="vault-orb" />
          <div className="fortune-brand-text">
            <div className="fortune-name">Fortune Rabbit</div>
            <div className="fortune-sub">Moonlit Garden Hops</div>
          </div>
        </div>

        <div className="fortune-hud">
          <div className="hud-card">
            <div className="hud-label">MULTI</div>
            <div className="hud-value">{state.current_multiplier}x</div>
          </div>
          <div className="hud-card">
            <div className="hud-label">HOPS</div>
            <div className="hud-value">{state.step_index}</div>
          </div>
          <button
            className="hud-cashout"
            onClick={cashout}
            disabled={!connected || state.step_index <= 0}
          >
            CASH OUT
          </button>
        </div>
      </div>

      <div className="fortune-scene">
        <div className="vault-bg" />
        <div className="mouse-runner idle">🐰</div>
      </div>

      <div className="fortune-board">
        <div className="fortune-board-top">
          <div className="pill-wrap">
            {state.status === "active" && <span className="pill ok">GARDEN LIVE</span>}
            {state.status === "lost" && <span className="pill bad">BAD LANTERN</span>}
            {state.status === "cashed_out" && (
              <span className="pill ok">
                WIN ₦{Number(state.payout_amount).toLocaleString("en-NG")}
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: 16, textAlign: "center" }}>
          <button
            className="hud-cashout"
            onClick={hop}
            disabled={!connected || state.status !== "active"}
          >
            HOP
          </button>
        </div>
      </div>
    </div>
  );
}