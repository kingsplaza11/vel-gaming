import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { crashService } from "../services/api";
import "./CrashGame.css";

const CrashGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [currentGame, setCurrentGame] = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [gameActive, setGameActive] = useState(false);
  const [cashedOut, setCashedOut] = useState(false);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const candlesRef = useRef([]);

  useEffect(() => {
    loadStats();
    loadHistory();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const loadStats = async () => {
    try {
      const res = await crashService.getStats();
      setStats(res.data);
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await crashService.getHistory();
      setHistory(res.data);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const drawCandles = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    candlesRef.current.forEach((candle, index) => {
      const { open, close, high, low } = candle;

      // Wider candles with more spacing and much taller scale
      const x = index * 25;      // increased spacing for wider candles
      const width = 20;           // increased from 4 to 8 for wider candles
      const scale = 95;          // significantly increased from 12 to 35 for much taller candles

      const openY = 220 - open * scale;
      const closeY = 220 - close * scale;
      const highY = 220 - high * scale;
      const lowY = 220 - low * scale;

      const isBullish = close >= open;
      const color = isBullish ? "#5CFFB3" : "#FF5C7A";

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + width / 2, highY);
      ctx.lineTo(x + width / 2, lowY);
      ctx.stroke();

      // Body - much wider and taller
      ctx.fillStyle = color;
      const bodyHeight = Math.max(Math.abs(closeY - openY), 6);
      ctx.fillRect(x, Math.min(openY, closeY), width, bodyHeight);
    });
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const startMultiplierRun = (crashPoint) => {
    candlesRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);

    const durationMs = 20000 + Math.random() * 5000; // 20–25 seconds
    const startTime = Date.now();
    let prev = 1.0;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      let t = elapsed / durationMs;
      if (t > 1) t = 1;

      // Smooth curve from 1 → crashPoint
      const base = 1 + (crashPoint - 1) * easeOutCubic(t);

      // Gentle up/down volatility
      const noisePercent = (Math.random() - 0.5) * 0.10; // -5% to +5%
      let next = base * (1 + noisePercent);

      // Clamp
      next = Math.max(1.0, Math.min(next, crashPoint));

      const high = next + Math.random() * 0.06;
      const low = next - Math.random() * 0.06;

      candlesRef.current.push({
        open: prev,
        close: next,
        high,
        low,
      });

      if (candlesRef.current.length > 55) { // Reduced from 80 to show fewer but wider candles
        candlesRef.current.shift();
      }

      setMultiplier(Number(next.toFixed(2)));
      drawCandles();
      prev = next;

      const pulse = document.getElementById("multiplierPulse");
      if (pulse) {
        pulse.style.textShadow = `0 0 ${Math.min(next * 7, 45)}px #5CFFB3`;
      }

      if (t >= 1) {
        handleCrash();
      }
    }, 90);
  };

  const placeBet = async () => {
    try {
      const res = await crashService.placeBet({ bet_amount: betAmount });
      const { game_id, crash_point, countdown, balance } = res.data;

      setCurrentGame({ id: game_id, crashPoint: crash_point });
      onBalanceUpdate({ ...user, balance });
      setCountdown(countdown);
      setCashedOut(false);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) {
            clearInterval(timer);
            return null;
          }
          if (prev <= 1) {
            clearInterval(timer);
            setGameActive(true);
            startMultiplierRun(crash_point);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error placing bet:", err);
      alert(err.response?.data?.error || "Error placing bet");
    }
  };

  const handleCrash = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setGameActive(false);

    if (!currentGame || !currentGame.id) {
      console.warn("Crash event but no active game");
      return;
    }

    if (!cashedOut) {
      try {
        await crashService.gameCrashed({ game_id: currentGame.id });
      } catch (err) {
        console.error("Error reporting crash:", err);
      }
    }

    loadStats();
    loadHistory();

    const fx = document.getElementById("crashExplosion");
    if (fx) {
      fx.classList.add("explode");
      setTimeout(() => fx.classList.remove("explode"), 800);
    }
  };

  const cashOut = async () => {
    if (!gameActive || cashedOut || !currentGame) return;

    try {
      const res = await crashService.cashOut({
        game_id: currentGame.id,
        cash_out_point: multiplier,
      });

      if (intervalRef.current) clearInterval(intervalRef.current);
      setCashedOut(true);
      setGameActive(false);

      onBalanceUpdate({ ...user, balance: res.data.new_balance });
      loadStats();
      loadHistory();
    } catch (err) {
      console.error("Error cashing out:", err);
      alert(err.response?.data?.error || "Error cashing out");
    }
  };

  return (
    <div className="crash-wrapper">
      <div className="crash-inner">
        <header className="crash-header">
          <button className="back-btn" onClick={() => navigate("/")}>
            ← Back
          </button>
          <div className="balance-box">
            Balance: ${parseFloat(user.balance).toFixed(2)}
          </div>
        </header>

        <div className="crash-board">
          <canvas
            ref={canvasRef}
            width={770} 
            height={280} 
            className="candlestick-chart"
          />
          <div className="multiplier-value" id="multiplierPulse">
            <span id="crashExplosion"></span>
            {countdown !== null
              ? `Starting in ${countdown}`
              : `${multiplier.toFixed(2)}x`}
          </div>
        </div>

        <div className="controls">
          <div className="bet-panel">
            <label className="bet-label">Bet Amount</label>
            <div className="bet-input-container">
              <input
                type="number"
                min={1}
                value={betAmount}
                disabled={gameActive || countdown !== null}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="bet-input"
              />
            </div>
          </div>

          <div className="action-panel">
            {!gameActive ? (
              <button
                className="bet-btn"
                onClick={placeBet}
                disabled={betAmount > user.balance || countdown !== null}
              >
                PLACE BET
              </button>
            ) : (
              <button
                className="cash-btn"
                onClick={cashOut}
                disabled={cashedOut}
              >
                {cashedOut ? "CASHED OUT" : "CASH OUT"}
              </button>
            )}
          </div>
        </div>

        <div className="lower-section">
          <div className="stats-box">
            <h3>Your Stats</h3>
            {stats && (
              <div className="stats-grid">
                <span>Total Games: {stats.total_games}</span>
                <span>Total Bet: ${stats.total_bet.toFixed(2)}</span>
                <span>Total Won: ${stats.total_won.toFixed(2)}</span>
                <span>
                  Highest Multiplier: {stats.highest_multiplier.toFixed(2)}x
                </span>
              </div>
            )}
          </div>

          <div className="history-box">
            <h3>Recent Rounds</h3>
            <div className="history-bar">
              {history.map((h, i) => (
                <span
                  key={i}
                  className="history-pill"
                  data-status={h.status}
                >
                  {h.status === "cashed_out"
                    ? `${h.cash_out_point}x`
                    : `${h.crash_point}x`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrashGame;