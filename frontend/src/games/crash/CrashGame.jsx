import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../contexts/WalletContext";
import { crashService } from "../../services/api";
import { useCrashWebSocket } from "./useCrashWebSocket";
import CrashCandleChart from "./CrashCandleChart";
import LiveBetTable from "./LiveBetTable";
import AlertModal from "../../components/ui/AlertModal";
import "./CrashGame.css";

const MINIMUM_STAKE = 100; // Minimum stake of 100 naira

export default function CrashGame({ user, onBalanceUpdate, mode = "real" }) {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* ---------------- GAME STATE ---------------- */
  const [phase, setPhase] = useState("betting"); // betting | running | crashed
  const [multiplier, setMultiplier] = useState(1.0);
  const [roundId, setRoundId] = useState(null);

  /* ---------------- BET STATE ---------------- */
  const [betAmount, setBetAmount] = useState("100"); // Start with minimum stake
  const [autoCashout, setAutoCashout] = useState(2.0);
  const [useAuto, setUseAuto] = useState(true);
  const [activeBetId, setActiveBetId] = useState(null);

  /* ---------------- UI DATA ---------------- */
  const [history, setHistory] = useState([]);
  const [liveRows, setLiveRows] = useState([]);
  const [error, setError] = useState("");

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

  /* ---------------- WALLET HELPERS ---------------- */
  const getWalletBalance = () => {
    return availableBalance !== undefined ? availableBalance : (availableBalance);
  };

  const balance = Number(getWalletBalance() || 0);
  const numericBet = Number(betAmount);

  /* ---------------- STAKE VALIDATION ---------------- */
  const isStakeValid = useMemo(() => {
    return Number.isFinite(numericBet) && numericBet >= MINIMUM_STAKE && numericBet <= balance;
  }, [numericBet, balance]);

  /* ---------------- FORMATTING ---------------- */
  const formatNGN = (value) =>
    `₦${Number(value || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    })}`;

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

        // Update wallet
        if (refreshWallet) {
          await refreshWallet();
        }

        // Also update parent component if needed
        if (onBalanceUpdate && res.data?.balance != null) {
          onBalanceUpdate((prev) => ({
            ...prev,
            wallet_balance: res.data.balance,
          }));
        }
      } catch {
        // ignore – too late or already cashed
      }
    },
    [activeBetId, mode, refreshWallet, onBalanceUpdate]
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
    setError("");

    // Validate stake
    if (!Number.isFinite(numericBet) || numericBet <= 0) {
      setError("Please enter a valid bet amount");
      return;
    }

    // Check minimum stake
    if (numericBet < MINIMUM_STAKE) {
      setError(`Minimum bet is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    // Check balance
    if (numericBet > balance) {
      setError("Insufficient balance");
      return;
    }

    // Check if wallet is loading
    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    try {
      const res = await crashService.placeBet({
        amount: numericBet,
        auto_cashout: useAuto ? autoCashout : null,
        mode,
      });

      setActiveBetId(res.data.bet_id);

      // Update wallet
      if (refreshWallet) {
        await refreshWallet();
      }

      // Also update parent component if needed
      if (onBalanceUpdate && res.data?.balance != null) {
        onBalanceUpdate((prev) => ({
          ...prev,
          wallet_balance: res.data.balance,
        }));
      }
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || 
                      e?.response?.data?.error || 
                      "Failed to place bet";
      setError(errorMsg);
      showAlert("error", "Bet Failed", errorMsg);
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

      // Update wallet
      if (refreshWallet) {
        await refreshWallet();
      }

      // Also update parent component if needed
      if (onBalanceUpdate && res.data?.balance != null) {
        onBalanceUpdate((prev) => ({
          ...prev,
          wallet_balance: res.data.balance,
        }));
      }

      showAlert(
        "success",
        "Cashout Successful",
        `You cashed out at ${multiplier.toFixed(2)}x!`
      );
    } catch (e) {
      const errorMsg = e?.response?.data?.detail || 
                      "Too late to cash out. The round has already crashed.";
      showAlert("error", "Cashout Failed", errorMsg);
    }
  };

  /* ---------------- QUICK BET HANDLER ---------------- */
  const handleQuickBet = (amount) => {
    setBetAmount(amount.toString());
  };

  const quickBets = [1000, 2000, 5000, 10000];
  
  /* ---------------- QUICK AUTO CASHOUT HANDLER ---------------- */
  const handleQuickAutoCashout = (value) => {
    setAutoCashout(value);
  };

  const quickAutoCashouts = [1.5, 2.0, 3.0, 5.0, 10.0];

  /* ---------------- RENDER ---------------- */
  return (
    <div className="crash-page">
      {/* ---------- HEADER ---------- */}
      <div className="crash-header">
        <div className="brand">
          <button 
            onClick={() => navigate("/")} 
            className="back-button"
            type="button"
          >
            ←
          </button>
          <div>
            <div className="title">CRASH</div>
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
              <span className="muted">High Risk, High Reward</span>
            </div>
          </div>
        </div>

        <div className={`wallet ${walletLoading ? 'loading' : ''}`}>
          <div className="wallet-label">BALANCE</div>
          <div className="wallet-value">
            {walletLoading ? (
              <div className="balance-loading">
                <span className="loading-spinner-small" />
                LOADING...
              </div>
            ) : (
              formatNGN(balance)
            )}
          </div>
        </div>
      </div>

      {/* ---------- MAIN GRID ---------- */}
      <div className="crash-grid">
        <div className="chart-card">
          <CrashCandleChart multiplier={multiplier} phase={phase} />

          <div className="history-row">
            {history.length > 0 ? (
              history.slice(0, 5).map((v, i) => (
                <span key={i} className={`chip ${colorFor(v)}`}>
                  {v.toFixed(2)}x
                </span>
              ))
            ) : (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '12px',
                color: 'rgba(255,255,255,0.35)',
                fontSize: '12px'
              }}>
                No previous rounds yet
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-card">
            <div className="panel-title">PLACE YOUR BET</div>

            <div className="field">
              <label>Amount (₦)</label>
              <div className="input-wrapper">
                <span className="input-prefix">₦</span>
                <input
                  type="number"
                  min={MINIMUM_STAKE}
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value.replace(/[^\d.]/g, ''))}
                  onBlur={() => {
                    if (betAmount && isStakeValid) {
                      setBetAmount(numericBet.toFixed(2));
                    }
                  }}
                  disabled={walletLoading}
                  placeholder={`Min ${formatNGN(MINIMUM_STAKE)}`}
                  inputMode="decimal"
                />
              </div>
              
              <div className="quick quick-bet-container">
                {quickBets.map((amount) => (
                  <button 
                    key={amount} 
                    onClick={() => handleQuickBet(amount)}
                    className={`${numericBet === amount ? 'active' : ''}`}
                    disabled={walletLoading || amount > balance}
                    type="button"
                  >
                    ₦{amount.toLocaleString()}
                  </button>
                ))}
              </div>
              
              {/* Stake validation message */}
              {!isStakeValid && betAmount && (
                <div className="stake-validation-error">
                  Minimum bet is ₦{MINIMUM_STAKE.toLocaleString("en-NG")} – must not exceed balance
                </div>
              )}
            </div>

            {/* Auto Cashout Settings */}
            <div className="field two">
              <div className="toggle">
                <div className="panel-title" style={{ fontSize: "14px", marginBottom: "8px" }}>Auto Cashout</div>
                <div 
                  className={`pill ${useAuto ? 'on' : 'off'}`}
                  onClick={() => setUseAuto(!useAuto)}
                  style={{ cursor: (phase !== "betting" || activeBetId || walletLoading) ? 'not-allowed' : 'pointer', opacity: (phase !== "betting" || activeBetId || walletLoading) ? 0.5 : 1 }}
                >
                  {useAuto ? 'ENABLED' : 'DISABLED'}
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: "12px", color: useAuto ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)" }}>
                    Cashout at
                  </label>
                  <div style={{ fontSize: "18px", fontWeight: "bold", color: useAuto ? "#00ff99" : "rgba(255,255,255,0.35)" }}>
                    {autoCashout.toFixed(1)}x
                  </div>
                </div>
                
                <input
                  type="range"
                  min="1.1"
                  max="50"
                  step="0.1"
                  value={autoCashout}
                  onChange={(e) => setAutoCashout(parseFloat(e.target.value))}
                  disabled={!useAuto || phase !== "betting" || activeBetId || walletLoading}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    background: useAuto ? 'linear-gradient(90deg, #00ff99 0%, #ff3b3b 100%)' : 'rgba(255,255,255,0.1)',
                    outline: 'none',
                    opacity: (!useAuto || phase !== "betting" || activeBetId || walletLoading) ? 0.5 : 1,
                    cursor: (!useAuto || phase !== "betting" || activeBetId || walletLoading) ? 'not-allowed' : 'pointer'
                  }}
                />
                
                <div className="quick" style={{ marginTop: '4px' }}>
                  {quickAutoCashouts.map((value) => (
                    <button
                      key={value}
                      onClick={() => handleQuickAutoCashout(value)}
                      className={autoCashout === value ? 'active' : ''}
                      disabled={!useAuto || phase !== "betting" || activeBetId || walletLoading}
                      type="button"
                      style={{
                        fontSize: '11px',
                        padding: '6px 4px'
                      }}
                    >
                      {value.toFixed(1)}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Payout Preview */}
            {useAuto && isStakeValid && (
              <div className="field" style={{ marginTop: "-4px", marginBottom: "16px" }}>
                <div style={{ 
                  fontSize: "12px", 
                  color: "#00ff99",
                  textAlign: "center",
                  padding: "8px",
                  borderRadius: "8px",
                  background: "rgba(0,255,153,0.05)",
                  border: "1px solid rgba(0,255,153,0.15)"
                }}>
                  Auto cashout at <strong>{autoCashout.toFixed(1)}x</strong> will payout <strong>{formatNGN(numericBet * autoCashout)}</strong>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="error-display">
                <span className="error-icon">⚠️</span>
                {error}
              </div>
            )}

            <div className="actions">
              {!activeBetId ? (
                <button
                  className={`primary ${!isStakeValid || walletLoading ? 'disabled' : ''}`}
                  onClick={placeBet}
                  disabled={!connected || phase !== "betting" || !isStakeValid || walletLoading}
                  type="button"
                >
                  {walletLoading ? "LOADING..." : "PLACE BET"}
                </button>
              ) : (
                <button
                  className="danger"
                  onClick={cashOut}
                  disabled={!connected || phase !== "running" || walletLoading}
                  type="button"
                >
                  CASH OUT AT {multiplier.toFixed(2)}x
                </button>
              )}

              <div className="hint">
                {phase === "betting" && (
                  <div>
                    {isStakeValid 
                      ? "Place your bet before the round starts" 
                      : `Minimum bet: ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`}
                  </div>
                )}
                {phase === "running" && (
                  <div>
                    {activeBetId
                      ? `Flight is live! Current multiplier: ${multiplier.toFixed(2)}x`
                      : "Flight is live - watch the multiplier rise!"}
                  </div>
                )}
                {phase === "crashed" && (
                  <div>
                    Round crashed at {history[0]?.toFixed(2)}x — Next round starting soon
                  </div>
                )}
              </div>
              
              {/* Active Bet Info */}
              {activeBetId && (
                <div style={{
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "12px",
                  padding: "12px",
                  marginTop: "12px",
                  border: "1px solid rgba(0,255,153,0.2)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)" }}>Active Bet:</span>
                    <span style={{ fontSize: "14px", fontWeight: "bold", color: "#00ff99" }}>
                      {formatNGN(numericBet)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", marginRight: "8px" }}>Current:</span>
                      <span style={{ fontSize: "16px", fontWeight: "bold", color: "#00ff99" }}>
                        {multiplier.toFixed(2)}x
                      </span>
                    </div>
                    {useAuto && autoCashout && (
                      <div style={{
                        fontSize: "11px",
                        color: "#ffd36b",
                        background: "rgba(255,211,107,0.1)",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,211,107,0.2)"
                      }}>
                        {(multiplier / autoCashout * 100).toFixed(0)}% to auto
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="livebets-card">
            <div className="livebets-head">
              <span>LIVE BETS</span>
              <span className="muted">{liveRows.length} players</span>
            </div>
            <div className="livebets-scroll">
              {liveRows.length > 0 ? (
                <table className="livebets-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th className="right">Bet</th>
                      <th className="right">Multiplier</th>
                      <th className="right">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveRows.map((row) => (
                      <tr key={row.bet_id}>
                        <td className="user">{row.user || "Anonymous"}</td>
                        <td className="right">{formatNGN(row.amount)}</td>
                        <td className="right">
                          {row.multiplier ? `${row.multiplier.toFixed(2)}x` : "—"}
                        </td>
                        <td className="right">
                          {row.payout ? formatNGN(row.payout) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty">No live bets yet</div>
              )}
            </div>
          </div>
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