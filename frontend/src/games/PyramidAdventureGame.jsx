import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { pyramidService } from "../services/api";
import "./PyramidAdventureGame.css";

const MIN_STAKE = 100;

const PyramidAdventureGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [exploring, setExploring] = useState(false);
  const [showStakeModal, setShowStakeModal] = useState(true);
  const [lastRun, setLastRun] = useState(null);
  const [error, setError] = useState("");

  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const safeBalance = Number(getWalletBalance() || 0);

  const startAdventure = async () => {
    // Check if wallet is still loading
    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    if (betAmount < MIN_STAKE)
      return setError(`Minimum stake is ₦${MIN_STAKE}`);

    if (betAmount > safeBalance)
      return setError("Insufficient wallet balance");

    setError("");
    setExploring(true);
    setShowStakeModal(false);

    try {
      const res = await pyramidService.explorePyramid({
        bet_amount: betAmount,
      });

      setLastRun(res.data);

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }
    } catch (e) {
      setError(e.response?.data?.error || "Exploration failed");
      setShowStakeModal(true);
    } finally {
      setExploring(false);
    }
  };

  return (
    <div className="pyramid-game">

      {/* HEADER */}
      <div className="top-bar">
        <button onClick={() => navigate("/")}>←</button>
        <span>🏜️ Pyramid Adventure</span>
        <span>
          {walletLoading ? (
            <div className="balance-loading-inline">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            `₦${safeBalance.toLocaleString()}`
          )}
        </span>
      </div>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="pyramid-modal-overlay">
          <div className="pyramid-modal-card">
            <h3>Prepare Expedition</h3>

            <div className="pyramid-modal-info">
              <div><span>Risk:</span><strong>EXTREME</strong></div>
            </div>

            <div className="pyramid-stake-container">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                min={MIN_STAKE}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                disabled={walletLoading}
              />
            </div>

            {error && <div className="error-banner">{error}</div>}

            <button
              className="explore-button"
              onClick={startAdventure}
              disabled={walletLoading || betAmount > safeBalance || betAmount < MIN_STAKE}
            >
              {walletLoading ? "LOADING..." : "ENTER PYRAMID"}
            </button>
          </div>
        </div>
      )}

      {/* GAME SCREEN */}
      {!showStakeModal && (
        <div className="pyramid-display">
          {exploring && (
            <div className="exploring-animation">
              <div className="torch">🔥</div>
              <div className="explorer">🧭</div>
              <p>Venturing into ancient chambers...</p>
            </div>
          )}

          {!exploring && lastRun && (
            <div className="exploration-results">
              <h3>Expedition Result</h3>

              <p>Chambers explored: {lastRun.chambers_explored.length}</p>
              <p>Traps triggered: {lastRun.traps_encountered}</p>

              <div className="win-amount">
                {lastRun.win_amount > 0
                  ? `You won ₦${lastRun.win_amount.toLocaleString()}`
                  : "You lost your stake"}
              </div>

              <button
                className="explore-button"
                onClick={() => {
                  setLastRun(null);
                  setShowStakeModal(true);
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PyramidAdventureGame;