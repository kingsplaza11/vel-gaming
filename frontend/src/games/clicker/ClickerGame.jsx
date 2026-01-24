import React, { useEffect, useMemo, useRef, useState } from "react";
import { clickerService } from "../../services/api";
import { burst, shake } from "./fx";
import "../crash/CrashGame.css"; // optional if you want shared theme
import "./ClickerGame.css";
import AlertModal from "../../components/ui/AlertModal";

export default function ClickerGame({ user, onBalanceUpdate }) {
  const tapBtnRef = useRef(null);
  const burstRef = useRef(null);

  const [state, setState] = useState(null);
  const [combo, setCombo] = useState(1.0);
  const [comboTimer, setComboTimer] = useState(0); // ms remaining
  const [pendingTaps, setPendingTaps] = useState(0);

  const [alert, setAlert] = useState({ open: false, type: "info", title: "", message: "" });
  const showAlert = (type, title, message) => setAlert({ open: true, type, title, message });

  // load initial state
  useEffect(() => {
    (async () => {
      try {
        const res = await clickerService.getStats?.() || clickerService.getState?.(); // if you named it differently
        // Your service currently has start/click endpoints; adapt:
        // Best: implement clickerService.getState = () => api.get('/clicker/state/')
        const data = res?.data || {};
        setState(data);
      } catch {
        showAlert("error", "Load Failed", "Could not load clicker state.");
      }
    })();
  }, []);

  // combo decay loop
  useEffect(() => {
    const id = setInterval(() => {
      setComboTimer((t) => Math.max(0, t - 100));
    }, 100);
    return () => clearInterval(id);
  }, []);

  // combo logic
  useEffect(() => {
    if (comboTimer <= 0) {
      setCombo(1.0);
    }
  }, [comboTimer]);

  // batch send taps to backend (smooth mobile)
  useEffect(() => {
    if (pendingTaps <= 0) return;

    const id = setTimeout(async () => {
      const tapsToSend = pendingTaps;
      setPendingTaps(0);

      try {
        const res = await clickerService.registerClick({
          taps: tapsToSend,
          combo: combo,
          device_fp: localStorage.getItem("device_fp") || "",
        });

        const data = res.data;
        setState((prev) => ({
          ...(prev || {}),
          points_balance: data.points_balance,
          energy: data.energy,
          level: data.level,
          xp: data.xp,
          daily_points_earned: data.daily_points_earned,
          daily_points_cap: data.daily_points_cap,
          max_energy: data.max_energy,
        }));

        // “Win event” dopamine
        if (data.win_event) {
          burst(burstRef.current, 20);
          showAlert("success", "Combo Bonus!", `You won +${data.win_bonus_points} bonus points 🎁`);
        }
      } catch (e) {
        const msg = e?.response?.data?.detail || "Tap failed.";
        showAlert("error", "Action Blocked", msg);
      }
    }, 350); // ✅ slow, smooth batching
    return () => clearTimeout(id);
  }, [pendingTaps, combo]);

  const progressPct = useMemo(() => {
    if (!state) return 0;
    const cap = state.daily_points_cap || 1;
    const earned = state.daily_points_earned || 0;
    return Math.min(100, Math.floor((earned / cap) * 100));
  }, [state]);

  const onTap = () => {
    if (!state) return;
    if (state.energy <= 0) {
      shake(tapBtnRef.current);
      showAlert("info", "Out of Energy", "Wait a bit for energy to recharge.");
      return;
    }

    // haptic-like feedback (mobile)
    if (navigator.vibrate) navigator.vibrate(10);

    shake(tapBtnRef.current);
    burst(burstRef.current, 10);

    // combo increases if you keep tapping within window
    setComboTimer(1400); // 1.4s window
    setCombo((c) => {
      const next = Math.min(10, +(c + 0.05).toFixed(2));
      return next;
    });

    // queue taps
    setPendingTaps((t) => Math.min(30, t + 1)); // cap burst size
  };

  const convertPoints = async () => {
    const points = Math.min(2000, state?.points_balance || 0);
    if (points <= 0) return showAlert("info", "No Points", "Earn points first.");

    try {
      const res = await clickerService.convert?.({ points });
      const data = res.data;

      setState((prev) => ({ ...(prev || {}), points_balance: data.points_balance }));

      // optionally update wallet on UI (if backend returns wallet balance)
      // onBalanceUpdate?.( ... )

      showAlert("success", "Converted", `Converted ${data.converted_points} points → ₦${data.credited_amount}`);
    } catch (e) {
      showAlert("error", "Convert Failed", e?.response?.data?.detail || "Conversion failed.");
    }
  };

  if (!state) {
    return <div className="clicker-page">Loading…</div>;
  }

  return (
    <div className="clicker-page">
      <div className="clicker-top">
        <div className="clicker-title">Clicker</div>
        <div className="clicker-balance">
          <div className="lbl">Wallet</div>
          <div className="val">₦{Number(user?.wallet_balance || 0).toLocaleString()}</div>
        </div>
      </div>

      <div className="clicker-stats">
        <div className="card">
          <div className="k">Points</div>
          <div className="v">{Number(state.points_balance || 0).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="k">Energy</div>
          <div className="v">{state.energy}/{state.max_energy}</div>
        </div>
        <div className="card">
          <div className="k">Combo</div>
          <div className="v">{combo.toFixed(2)}x</div>
        </div>
      </div>

      <div className="daily-wrap">
        <div className="daily-head">
          <span>Daily Progress</span>
          <span className="muted">{progressPct}%</span>
        </div>
        <div className="bar">
          <div className="fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="muted small">
          Earned {Number(state.daily_points_earned || 0).toLocaleString()} / {Number(state.daily_points_cap || 0).toLocaleString()}
        </div>
      </div>

      <div className="tap-zone" ref={burstRef}>
        <button ref={tapBtnRef} className="tap-btn" onClick={onTap}>
          TAP
          <span className="tap-sub">Keep tapping to stack combo</span>
        </button>
      </div>

      <div className="actions-row">
        <button className="convert" onClick={convertPoints}>
          Convert Points → Wallet
        </button>
      </div>

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
