import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fishingService } from "../services/api";
import "./FishingGame.css";

const FishingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();

  const [betAmount, setBetAmount] = useState(10);
  const [isCasting, setIsCasting] = useState(false);
  const [lastCatch, setLastCatch] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("stats");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const safeBalance = Number(user?.balance || 0);

  const loadStats = async () => {
    try {
      const response = await fishingService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fishingService.getHistory();
      setHistory(response.data.history || []);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  useEffect(() => {
    loadStats();
    loadHistory();
  }, []);

  const formatMoney = (value) => Number(value || 0).toFixed(2);

  const rarityClass = (rarity) => (rarity ? rarity.toLowerCase() : "");

  const handleCastLine = async () => {
    setErrorMessage("");
    setInfoMessage("");
    setLastCatch(null);

    if (isCasting) return;

    const numericBet = Number(betAmount);
    if (!numericBet || numericBet <= 0) {
      setErrorMessage("Enter a valid bet amount.");
      return;
    }
    if (numericBet > safeBalance) {
      setErrorMessage("Insufficient balance for this bet.");
      return;
    }

    setIsCasting(true);

    try {
      const response = await fishingService.castLine({ bet_amount: numericBet });
      const { catch: fishCatch, new_balance, profit } = response.data;

      // Delay reveal to sync with animations
      setTimeout(() => {
        setLastCatch(fishCatch);
        setInfoMessage(
          profit >= 0
            ? `Great catch! Profit: $${profit.toFixed(2)}`
            : `You lost $${Math.abs(profit).toFixed(2)} on this cast.`
        );
      }, 1600);

      if (onBalanceUpdate) {
        onBalanceUpdate({ ...user, balance: new_balance });
      }

      loadStats();
      loadHistory();
    } catch (error) {
      console.error("Error fishing:", error);
      setErrorMessage(error.response?.data?.error || "Error casting line.");
    } finally {
      setTimeout(() => setIsCasting(false), 2000);
    }
  };

  return (
    <div className="fishing-game">
      <div className="arcade-shell">
        {/* Arcade Marquee / Top */}
        <div className="arcade-top">
          <button className="back-button" onClick={() => navigate("/")}>
            ← Back
          </button>

          <div className="marquee">
            <span className="marquee-title">Deep Sea Fishing</span>
            {/* <span className="marquee-subtitle">Arcade Edition</span> */}
          </div>

          <div className="balance-display">
            <span className="balance-label">CREDITS</span>
            <span className="balance-value">${formatMoney(user?.balance)}</span>
          </div>
        </div>

        {/* Arcade Body */}
        <div className="arcade-body">
          {/* Screen Area */}
          <div className="arcade-screen">
            {/* Bezel / screen frame */}
            <div className="screen-inner">
              <div className={`water ${isCasting ? "casting" : ""}`}>
                {/* Wave layers */}
                <div className="wave-layer wave-1"></div>
                <div className="wave-layer wave-2"></div>
                <div className="wave-layer wave-3"></div>
                
                {/* Bubble particles */}
                <div className="bubble-layer">
                  {[...Array(14)].map((_, i) => (
                    <div
                      key={i}
                      className="bubble"
                      style={{
                        left: `${5 + i * 6}%`,
                        animationDelay: `${i * 0.4}s`,
                      }}
                    ></div>
                  ))}
                </div>

                {/* Splash circle */}
                {isCasting && <div className="splash-circle"></div>}

                {/* Boat, rod & line */}
                <div className="boat">
                  <span className="boat-emoji">⛵</span>
                  <div className={`rod ${isCasting ? "rod-cast" : ""}`}>
                    <div className={`line ${isCasting ? "line-tension" : ""}`}>
                      <span className="hook">🪝</span>
                    </div>
                  </div>
                </div>

                {/* Bite effect */}
                {isCasting && <div className="bite-spot">💥</div>}

                {/* Fish reveal */}
                {lastCatch && !isCasting && (
                  <div className={`catch-reveal ${rarityClass(lastCatch.rarity)}`}>
                    <div className="fish-jump">{lastCatch.emoji}</div>
                  </div>
                )}
              </div>

              {/* In-screen HUD / info bar */}
              <div className="screen-hud">
                <div className="hud-section">
                  <span className="hud-label">Last Catch</span>
                  {lastCatch ? (
                    <span className="hud-value">
                      {lastCatch.size} {lastCatch.name} · {lastCatch.multiplier}x ·{" "}
                      {lastCatch.rarity}
                    </span>
                  ) : (
                    <span className="hud-value">None yet — cast your line!</span>
                  )}
                </div>
                <div className="hud-section">
                  <span className="hud-label">Status</span>
                  <span className="hud-value">
                    {isCasting ? "Casting..." : infoMessage || "Ready"}
                  </span>
                </div>
              </div>
            </div>

            {/* Control Panel (arcade buttons) */}
            <div className="control-panel">
              <div className="bet-control">
                <label className="bet-label">Bet Amount</label>
                <input
                  type="number"
                  min="1"
                  className="bet-input"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                />
                <div className="quick-bet-row">
                  <button onClick={() => setBetAmount(10)}>10</button>
                  <button onClick={() => setBetAmount(25)}>25</button>
                  <button onClick={() => setBetAmount(50)}>50</button>
                  <button
                    onClick={() => setBetAmount(Math.max(1, Math.floor(safeBalance / 2)))}
                  >
                    ½
                  </button>
                  <button
                    onClick={() => setBetAmount(Math.max(1, Math.floor(safeBalance)))}
                  >
                    MAX
                  </button>
                </div>
                <p className="bet-hint">Min 1 · Max 1000 · Don&apos;t over-fish your credits.</p>
              </div>

              {errorMessage && <div className="message error-message">{errorMessage}</div>}
              {infoMessage && !errorMessage && (
                <div className="message info-message">{infoMessage}</div>
              )}

              <div className="arcade-buttons-row">
                <button
                  className="cast-button arcade-button main-button"
                  onClick={handleCastLine}
                  disabled={isCasting || betAmount <= 0 || betAmount > safeBalance}
                >
                  {isCasting ? "CASTING..." : "🎣 CAST LINE"}
                </button>
              </div>

              <div className="rarity-legend">
                <span className="legend common">● Common</span>
                <span className="legend rare">● Rare</span>
                <span className="legend epic">● Epic</span>
                <span className="legend legendary">● Legendary</span>
              </div>
            </div>
          </div>

          {/* Side Panel (Stats / History) */}
          <div className="arcade-side-panel">
            <div className="panel-tabs">
              <button
                className={`tab-btn ${activeTab === "stats" ? "active" : ""}`}
                onClick={() => setActiveTab("stats")}
              >
                Stats
              </button>
              <button
                className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                onClick={() => setActiveTab("history")}
              >
                History
              </button>
            </div>

            {activeTab === "stats" && (
              <div className="stats-panel">
                {stats ? (
                  <>
                    <div className="stat-item">
                      <span>Fishing Level</span>
                      <strong>{stats.fishing_level}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Total Sessions</span>
                      <strong>{stats.total_sessions}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Total Won</span>
                      <strong>${formatMoney(stats.total_won)}</strong>
                    </div>
                    <div className="stat-item">
                      <span>Biggest Catch</span>
                      <strong>{stats.biggest_catch}</strong>
                    </div>
                  </>
                ) : (
                  <div className="panel-placeholder">Loading stats...</div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="history-panel">
                {history.length === 0 ? (
                  <div className="panel-placeholder">
                    No sessions yet. Cast a line to build your log.
                  </div>
                ) : (
                  <div className="history-list">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className={`history-item ${rarityClass(
                          item.catch_result?.rarity
                        )}`}
                      >
                        <span className="fish-icon">
                          {item.catch_result?.emoji || "🐟"}
                        </span>
                        <div className="history-text">
                          <strong>
                            {item.catch_result?.size
                              ? `${item.catch_result.size} `
                              : ""}
                            {item.catch_result?.name || "Unknown"}
                          </strong>
                          <small>
                            {item.catch_result?.rarity || "Common"} ·{" "}
                            {item.catch_result?.multiplier || 1}x
                          </small>
                        </div>
                        <span
                          className={`win-value ${
                            item.profit >= 0 ? "profit-positive" : "profit-negative"
                          }`}
                        >
                          {item.profit >= 0 ? "+" : "-"}$
                          {formatMoney(Math.abs(item.profit))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Decorative lights at bottom of side panel */}
            <div className="side-panel-lights">
              <span className="light-dot red"></span>
              <span className="light-dot yellow"></span>
              <span className="light-dot green"></span>
            </div>
          </div>
        </div>

        {/* Arcade Bottom / Foot controls */}
        <div className="arcade-footer">
          <div className="footer-lights-row">
            <span className="footer-light"></span>
            <span className="footer-light"></span>
            <span className="footer-light"></span>
            <span className="footer-light"></span>
          </div>
          <div className="footer-label">INSERT COIN · PRESS CAST TO PLAY</div>
        </div>
      </div>
    </div>
  );
};

export default FishingGame;