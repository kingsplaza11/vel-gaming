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

export default function CrashGame({ user, onBalanceUpdate, mode = "real" }) {
  /* ---------------- GAME STATE ---------------- */
  const [phase, setPhase] = useState("betting"); // betting | running | crashed
  const [multiplier, setMultiplier] = useState(1.0);
  const [roundId, setRoundId] = useState(null);

  /* ---------------- BET STATE ---------------- */
  const [betAmount, setBetAmount] = useState(100);
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
                min={1}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
              />
              <div className="quick">
                {[50, 100, 250, 500].map((v) => (
                  <button key={v} onClick={() => setBetAmount(v)} type="button">
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* <div className="field two">
              <div className="toggle">
                <label>Auto cashout</label>
                <button
                  type="button"
                  className={`pill ${useAuto ? "on" : "off"}`}
                  onClick={() => setUseAuto((s) => !s)}
                >
                  {useAuto ? "ON" : "OFF"}
                </button>
              </div>

              <div className="auto">
                <label>At</label>
                <input
                  type="number"
                  step="0.01"
                  min={1.01}
                  disabled={!useAuto}
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(Number(e.target.value))}
                />
              </div>
            </div> */}

            <div className="actions">
              {!activeBetId ? (
                <button
                  className="primary"
                  onClick={placeBet}
                  disabled={!connected || phase !== "betting"}
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
                {phase === "betting" && "Place bet before flight starts"}
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
