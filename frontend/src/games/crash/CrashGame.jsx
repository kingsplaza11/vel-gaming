import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { crashService } from "../../services/api";
import { useCrashWebSocket } from "./useCrashWebSocket";
import CrashCandleChart from "./CrashCandleChart";
import LiveBetTable from "./LiveBetTable";
import AlertModal from "../../components/ui/AlertModal";

import "./CrashGame.css";

const MINIMUM_STAKE = 100; // Minimum stake of 100 naira

export default function CrashGame({ user, onBalanceUpdate, mode = "real" }) {
  /* ---------------- GAME STATE ---------------- */
  const [phase, setPhase] = useState("betting"); // betting | running | crashed
  const [multiplier, setMultiplier] = useState(1.0);
  const [roundId, setRoundId] = useState(null);

  /* ---------------- BET STATE ---------------- */
  const [betAmount, setBetAmount] = useState(1000); // Start with minimum stake
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [useAuto, setUseAuto] = useState(true);
  const [activeBetId, setActiveBetId] = useState(null);

  /* ---------------- UI DATA ---------------- */
  const [history, setHistory] = useState([]);
  const [liveRows, setLiveRows] = useState([]);

  /* ---------------- ALERT MODAL ---------------- */
  const [alert, setAlert] = useState({
    open: false,
    type: "error",
    title: "",
    message: "",
  });

  const showAlert = (type, title, message) => {
    setAlert({ open: true, type, title, message });
  };

  /* ---------------- REFS ---------------- */
  const lastCashoutRef = useRef(0);

  /* ---------------- STAKE VALIDATION ---------------- */
  const isStakeValid = useMemo(() => {
    return Number.isFinite(betAmount) && betAmount >= MINIMUM_STAKE;
  }, [betAmount]);

  /* ---------------- HELPERS ---------------- */
  const colorFor = useMemo(
    () => (v) => (v < 1.5 ? "red" : v < 2.5 ? "yellow" : "green"),
    []
  );

  const pushLiveBet = useCallback((data) => {
    setLiveRows((prev) => {
      const row = {
        bet_id: data.bet_id,
        user: data.user,
        amount: data.amount,
        multiplier: data.multiplier || null,
        payout: data.payout || null,
      };
      const next = [row, ...prev.filter((p) => p.bet_id !== row.bet_id)];
      return next.slice(0, 40);
    });
  }, []);

  const updateLiveCashout = useCallback((data) => {
    setLiveRows((prev) =>
      prev.map((r) =>
        r.bet_id === data.bet_id
          ? {
              ...r,
              multiplier: data.multiplier || r.multiplier,
              payout: data.payout || r.payout,
            }
          : r
      )
    );
  }, []);

  /* ---------------- AUTO CASHOUT (SAFE) ---------------- */
  const safeAutoCashout = useCallback(
    async (m) => {
      const now = Date.now();
      if (now - lastCashoutRef.current < 400) return;
      lastCashoutRef.current = now;

      try {
        const res = await crashService.cashOut({
          bet_id: activeBetId,
          multiplier: m,
          mode,
        });

        setActiveBetId(null);

        if (res.data?.balance != null && onBalanceUpdate) {
          onBalanceUpdate((prev) => ({
            ...prev,
            wallet_balance: res.data.balance,
          }));
        }
      } catch {
        // ignore – too late or already cashed
      }
    },
    [activeBetId, mode, onBalanceUpdate]
  );

  /* ---------------- WEBSOCKET HANDLER ---------------- */
  const handleMessage = useCallback(
    (msg) => {
      const { event, data } = msg;

      if (event === "round_start") {
        setPhase("betting");
        setMultiplier(1.0);
        setRoundId(data.round_id ?? null);
        setActiveBetId(null);
        setLiveRows([]);
      }

      if (event === "round_lock_bets") {
        setPhase("running");
      }

      if (event === "multiplier_update") {
        const m = parseFloat(data.multiplier);
        if (!Number.isFinite(m)) return;

        setMultiplier(m);

        if (activeBetId && useAuto && autoCashout && m >= autoCashout) {
          safeAutoCashout(m);
        }
      }

      if (event === "round_crash") {
        setPhase("crashed");
        const cp = parseFloat(data.crash_point);
        if (Number.isFinite(cp)) {
          setHistory((prev) => [cp, ...prev].slice(0, 50));
        }
        setActiveBetId(null);
      }

      if (event === "player_bet") {
        pushLiveBet(data);
      }

      if (event === "player_cashout") {
        updateLiveCashout(data);
      }

      if (event === "bet_accepted") {
        setActiveBetId(data.bet_id);
        setRoundId(data.round_id ?? roundId);
      }

      if (event === "cashout_success") {
        updateLiveCashout({
          bet_id: data.bet_id,
          multiplier: data.multiplier,
          payout: data.payout,
        });
      }
    },
    [
      activeBetId,
      autoCashout,
      pushLiveBet,
      roundId,
      safeAutoCashout,
      updateLiveCashout,
      useAuto,
    ]
  );

  const { connected, engineAlive } = useCrashWebSocket(mode, handleMessage);

  /* ---------------- REST ACTIONS ---------------- */
  const placeBet = async () => {
    // Validate stake
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      showAlert(
        "error",
        "Invalid Stake",
        "Please enter a valid bet amount."
      );
      return;
    }

    // Check minimum stake
    if (betAmount < MINIMUM_STAKE) {
      showAlert(
        "error",
        "Minimum Stake Required",
        `Minimum bet is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}.`
      );
      return;
    }

    // Check balance
    const userBalance = Number(user?.wallet_balance || 0);
    if (betAmount > userBalance) {
      showAlert(
        "error",
        "Insufficient Balance",
        "Please deposit more funds to place this bet."
      );
      return;
    }

    try {
      const res = await crashService.placeBet({
        amount: betAmount,
        auto_cashout: useAuto ? autoCashout : null,
        mode,
      });

      setActiveBetId(res.data.bet_id);

      if (res.data?.balance != null && onBalanceUpdate) {
        onBalanceUpdate((prev) => ({
          ...prev,
          wallet_balance: res.data.balance,
        }));
      }
    } catch (e) {
      showAlert(
        "error",
        "Bet Failed",
        e?.response?.data?.detail ||
          "Insufficient funds. Please make a deposit and try again."
      );
    }
  };

  const cashOut = async () => {
    if (!activeBetId) return;

    try {
      const res = await crashService.cashOut({
        bet_id: activeBetId,
        multiplier,
        mode,
      });

      setActiveBetId(null);

      if (res.data?.balance != null && onBalanceUpdate) {
        onBalanceUpdate((prev) => ({
          ...prev,
          wallet_balance: res.data.balance,
        }));
      }

      showAlert(
        "success",
        "Cashout Successful",
        "Your winnings have been added to your balance."
      );
    } catch {
      showAlert(
        "error",
        "Cashout Failed",
        "Too late to cash out. The round has already crashed."
      );
    }
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div className="crash-page">
      {/* ---------- HEADER ---------- */}
      <div className="crash-header">
        <div className="brand">
          <span className="dot" />
          <div>
            <div className="title">Crash</div>
            <div className="sub">
              <span
                className={
                  engineAlive
                    ? "live"
                    : connected
                    ? "connecting"
                    : "offline"
                }
              >
                {engineAlive
                  ? "LIVE"
                  : connected
                  ? "CONNECTING"
                  : "OFFLINE"}
              </span>
              <span className="sep">•</span>
              <span className="muted">mode: {mode}</span>
            </div>
          </div>
        </div>

        <div className="wallet">
          <div className="wallet-label">Balance</div>
          <div className="wallet-value">
            ₦{Number(user?.wallet_balance || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* ---------- MAIN GRID ---------- */}
      <div className="crash-grid">
        <div className="chart-card">
          <CrashCandleChart multiplier={multiplier} phase={phase} />

          <div className="history-row">
            {history.slice(0, 18).map((v, i) => (
              <span key={i} className={`chip ${colorFor(v)}`}>
                {v.toFixed(2)}x
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-card">
            <div className="panel-title">Bet</div>

            <div className="field">
              <label>Amount</label>
              <input
                type="number"
                min={MINIMUM_STAKE}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
              />
              <div className="quick">
                {[1000, 2000, 5000, 10000].map((v) => (
                  <button 
                    key={v} 
                    onClick={() => setBetAmount(v)} 
                    type="button"
                    className={betAmount === v ? "active" : ""}
                  >
                    ₦{v.toLocaleString()}
                  </button>
                ))}
              </div>
              
              {/* Stake validation message */}
              {!isStakeValid && betAmount > 0 && (
                <div className="stake-validation-error">
                  Minimum bet is ₦{MINIMUM_STAKE.toLocaleString("en-NG")}
                </div>
              )}
            </div>
            <div className="actions">
              {!activeBetId ? (
                <button
                  className="primary"
                  onClick={placeBet}
                  disabled={!connected || phase !== "betting" || !isStakeValid}
                >
                  BET
                </button>
              ) : (
                <button
                  className="danger"
                  onClick={cashOut}
                  disabled={!connected || phase !== "running"}
                >
                  CASH OUT
                </button>
              )}

              <div className="hint">
                {phase === "betting" && 
                  (isStakeValid 
                    ? "Place bet before flight starts" 
                    : `Minimum bet: ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`)}
                {phase === "running" &&
                  (activeBetId
                    ? "Cash out anytime before crash"
                    : "Flight live")}
                {phase === "crashed" && "Round Completed — next round soon"}
              </div>
            </div>
          </div>

          <LiveBetTable rows={liveRows} />
        </div>
      </div>

      {/* ---------- ALERT MODAL ---------- */}
      <AlertModal
        open={alert.open}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        onClose={() => setAlert((a) => ({ ...a, open: false }))}
      />
    </div>
  );
}