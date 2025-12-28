import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { treasureService } from "../services/api";
import "./TreasureHuntGame.css";

const MIN_STAKE = 100; // ₦100
const MAX_WIN_RATIO = 0.48; // 30%

const MAP_LEVELS = [
  { level: 1, name: "Beginner Island", icon: "🏝️", risk: "Low" },
  { level: 2, name: "Ancient Forest", icon: "🌲", risk: "Medium" },
  { level: 3, name: "Dragon Mountain", icon: "⛰️", risk: "High" },
  { level: 4, name: "Phantom Desert", icon: "🏜️", risk: "Very High" },
  { level: 5, name: "Celestial Realm", icon: "🌌", risk: "Extreme" },
];

const TreasureHuntGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* ---------------- HELPER FUNCTIONS ---------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  /* ---------------- STATE ---------------- */
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [mapLevel, setMapLevel] = useState(1);
  const [phase, setPhase] = useState("idle"); // idle | sailing | scanning | digging | revealing
  const [hunting, setHunting] = useState(false);
  const [lastHunt, setLastHunt] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showStartModal, setShowStartModal] = useState(true);

  const animationTimers = useRef([]);

  /* ---------------- WALLET ---------------- */
  const walletBalance = Number(getWalletBalance() || 0);

  const formatNaira = (v) =>
    `₦${Number(v || 0).toLocaleString("en-NG")}`;

  const selectedMap = MAP_LEVELS.find((m) => m.level === mapLevel);
  const levelMultiplier = mapLevel * 1.5;
  const totalCost = betAmount * levelMultiplier;

  /* ---------------- ANIMATION ---------------- */
  const clearTimers = () => {
    animationTimers.current.forEach(clearTimeout);
    animationTimers.current = [];
  };

  const startAnimation = () => {
    clearTimers();
    setPhase("sailing");
    animationTimers.current.push(
      setTimeout(() => setPhase("scanning"), 2200),
      setTimeout(() => setPhase("digging"), 4200),
      setTimeout(() => setPhase("revealing"), 6200)
    );
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  /* ---------------- START HUNT ---------------- */
  const startHunt = async () => {
    if (hunting) return;

    // Check if wallet is still loading
    if (walletLoading) {
      setErrorMessage("Please wait while your balance loads...");
      return;
    }

    if (betAmount < MIN_STAKE) {
      setErrorMessage("Minimum stake is ₦1,000");
      return;
    }

    if (totalCost > walletBalance) {
      setErrorMessage("Insufficient wallet balance");
      return;
    }

    setErrorMessage(null);
    setShowStartModal(false);
    setHunting(true);
    setLastHunt(null);
    startAnimation();

    try {
      const res = await treasureService.startHunt({
        bet_amount: betAmount,
        map_level: mapLevel,
      });

      const data = res.data;

      setLastHunt({
        ...data,
        capped_win:
          Math.min(data.win_amount, betAmount * MAX_WIN_RATIO),
      });

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || "Expedition failed"
      );
      setShowStartModal(true);
      clearTimers();
      setPhase("idle");
    } finally {
      setHunting(false);
    }
  };

  /* ---------------- RESET ---------------- */
  const resetGame = () => {
    setLastHunt(null);
    setPhase("idle");
    setShowStartModal(true);
  };

  /* ================= RENDER ================= */
  return (
    <div className="treasure-hunt-game">
      {/* ================= HEADER ================= */}
      <header className="treasure-game-header">
        <button className="back-button" onClick={() => navigate("/")}>
          ← Back
        </button>

        <div className="game-title">
          <span className="game-title-icon">🧭</span>
          <div className="game-title-text">
            <h1>Treasure Expedition</h1>
            <p>Choose a map, stake ₦1,000+, and hunt.</p>
          </div>
        </div>

        <div className="balance-pill">
          <span className="balance-label">Wallet Balance</span>
          <span className="balance-amount">
            {walletLoading ? (
              <div className="balance-loading-inline">
                <span className="loading-spinner-small" />
                Loading...
              </div>
            ) : (
              formatNaira(walletBalance)
            )}
          </span>
        </div>
      </header>

      {/* ================= START MODAL ================= */}
      {showStartModal && (
        <div className="modal-overlay">
          <div className="panel-card">
            <h2 className="panel-title">Select Map & Stake</h2>

            <div className="map-level-grid">
              {MAP_LEVELS.map((map) => (
                <button
                  key={map.level}
                  className={`map-level-card ${
                    map.level === mapLevel ? "active" : ""
                  }`}
                  onClick={() => !walletLoading && setMapLevel(map.level)}
                  disabled={walletLoading}
                >
                  <div className="map-level-header">
                    <span className="map-level-icon">
                      {map.icon}
                    </span>
                    <div>
                      <div className="map-level-name">
                        Lv {map.level} · {map.name}
                      </div>
                      <div className="map-level-risk">
                        Risk: <strong>{map.risk}</strong>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="stake-input-container mt-2">
              <label className="stake-label">Stake Amount (₦)</label>
              <div className="stake-input-wrapper">
                <span className="stake-currency">₦</span>
                <input
                  type="number"
                  min={MIN_STAKE}
                  step="100"
                  value={betAmount}
                  onChange={(e) =>
                    setBetAmount(Number(e.target.value))
                  }
                  disabled={walletLoading}
                />
              </div>
            </div>

            <div className="cost-summary mt-2">
              <div className="cost-item">
                <span>Total Cost</span>
                <span className="cost-value total">
                  {formatNaira(totalCost)}
                </span>
              </div>
            </div>

            {errorMessage && (
              <div className="error-banner mt-1">
                {errorMessage}
              </div>
            )}

            <button
              className="hunt-button mt-2"
              onClick={startHunt}
              disabled={walletLoading || totalCost > walletBalance || betAmount < MIN_STAKE}
            >
              {walletLoading ? "LOADING..." : "🚀 Start Expedition"}
            </button>
          </div>
        </div>
      )}

      {/* ================= GAME SCREEN ================= */}
      {!showStartModal && (
        <section className="game-screen-section">
          <div className={`map-screen map-screen--${phase}`}>
            <div className="map-overlay">
              {phase === "sailing" && (
                <div className="overlay-title">
                  Sailing to {selectedMap.name}...
                </div>
              )}
              {phase === "scanning" && (
                <div className="overlay-title">
                  Scanning for treasure...
                </div>
              )}
              {phase === "digging" && (
                <div className="overlay-title">
                  Digging deep...
                </div>
              )}
              {phase === "revealing" && lastHunt && (
                <div className="overlay-title">
                  Expedition Complete
                </div>
              )}
            </div>
          </div>

          {/* ================= RESULT ================= */}
          {lastHunt && (
            <div className="results-panel">
              <div className="panel-card">
                <h2 className="panel-title">Expedition Result</h2>

                <div className="treasures-grid">
                  {lastHunt.treasures_found.map((t, i) => (
                    <div key={i} className="treasure-card">
                      <div className="treasure-icon">
                        {t.image}
                      </div>
                      <div className="treasure-name">
                        {t.name}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hunt-summary">
                  <div className="summary-item">
                    <span>Winnings</span>
                    <span className="summary-value win">
                      {formatNaira(
                        Math.min(
                          lastHunt.win_amount,
                          betAmount * MAX_WIN_RATIO
                        )
                      )}
                    </span>
                  </div>
                </div>

                <button
                  className="hunt-button mt-2"
                  onClick={resetGame}
                >
                  🔁 Play Again
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default TreasureHuntGame;