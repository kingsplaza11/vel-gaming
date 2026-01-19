import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { fishingService } from "../services/api";
import "./FishingGame.css";

const MINIMUM_STAKE = 100; // Minimum stake of 100 naira

const FishingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet, availableBalance } = useWallet();

  /* ---------------- STATE ---------------- */
  const [betAmount, setBetAmount] = useState(1000); // Start with default stake
  const [isCasting, setIsCasting] = useState(false);

  const [lastCatch, setLastCatch] = useState(null);
  const [roundResult, setRoundResult] = useState(null);

  const [showStakeModal, setShowStakeModal] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const getWalletBalance = () => {
    return availableBalance !== undefined ? availableBalance : availableBalance;
  };

  const safeBalance = Number(getWalletBalance() || 0);

  const formatMoney = (v) => Number(v || 0).toFixed(2);

  const isStakeValid = () => {
    const amt = Number(betAmount);
    return Number.isFinite(amt) && amt >= MINIMUM_STAKE;
  };

  /* ---------------- START GAME ---------------- */
  const startGame = () => {
    setErrorMessage("");
    const amt = Number(betAmount);

    if (!Number.isFinite(amt) || amt <= 0) {
      setErrorMessage("Enter a valid stake amount");
      return;
    }

    if (amt < MINIMUM_STAKE) {
      setErrorMessage(`Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    if (amt > safeBalance) {
      setErrorMessage("Insufficient wallet balance");
      return;
    }

    if (walletLoading) {
      setErrorMessage("Please wait while your balance loads...");
      return;
    }

    setShowStakeModal(false);
  };

  /* ---------------- CAST LINE ---------------- */
  const handleCastLine = async () => {
    if (isCasting) return;

    setIsCasting(true);
    setLastCatch(null);
    setRoundResult(null);

    try {
      const response = await fishingService.castLine({
        bet_amount: betAmount,
      });

      const data = response.data;

      // Sync animation timing
      setTimeout(() => {
        setLastCatch(data.catch);
        setRoundResult(data);
        setShowResultModal(true);
      }, 1200);

      // Update wallet balance by refreshing from backend
      if (refreshWallet) {
        await refreshWallet();
      }

      // Also update parent component if needed
      if (onBalanceUpdate) {
        const newBalance = data.new_balance || (safeBalance - Number(betAmount) + Number(data.profit || 0));
        onBalanceUpdate({
          ...user,
          balance: newBalance,
        });
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || "Something went wrong"
      );
      setShowStakeModal(true);
    } finally {
      setTimeout(() => setIsCasting(false), 1500);
    }
  };

  /* ---------------- RESET ---------------- */
  const resetGame = () => {
    setLastCatch(null);
    setRoundResult(null);
    setShowResultModal(false);
    setShowStakeModal(true);
  };

  /* ---------------- RETURN TO GAMES ---------------- */
  const returnToGames = () => {
    navigate("/games");
  };

  /* ================= RENDER ================= */
  return (
    <div className="fishing-game mobile">
      {/* ================= HEADER ================= */}
      <div className="top-bar">
        <button onClick={returnToGames}>←</button>
        <span>🎣 Deep Sea Fishing</span>
      </div>

      {/* ================= STAKE MODAL ================= */}
      {showStakeModal && (
        <div className="modal-overlay">
          <div className="modal stake-modal">
            <h3>DEEP SEA FISHING</h3>
            <p className="game-description">
              Cast your line and see what you catch!
            </p>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  `₦${formatMoney(safeBalance)}`
                )}
              </span>
            </div>

            <input
              type="number"
              min={MINIMUM_STAKE}
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              disabled={walletLoading}
              placeholder="1000"
            />

            <div className="quick-row">
              {[100, 500, 1000, 2000].map((v) => (
                <button 
                  key={v} 
                  onClick={() => setBetAmount(v)}
                  disabled={walletLoading}
                  className={betAmount === v ? "active" : ""}
                >
                  ₦{v.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Stake validation message */}
            {!isStakeValid() && betAmount > 0 && (
              <div className="stake-validation-error">
                Minimum stake is ₦{MINIMUM_STAKE.toLocaleString("en-NG")}
              </div>
            )}

            {errorMessage && <p className="error">{errorMessage}</p>}

            <button 
              className="primary" 
              onClick={startGame}
              disabled={walletLoading || !isStakeValid()}
            >
              {walletLoading ? "LOADING..." : "START FISHING"}
            </button>
          </div>
        </div>
      )}

      {/* ================= GAME SCREEN ================= */}
      {!showStakeModal && !showResultModal && (
        <div className="game-screen">
          <div className="game-header">
            <h2>Deep Sea Fishing</h2>
            <p className="game-tip">Tap CAST to throw your line!</p>
          </div>

          <div className={`ocean ${isCasting ? "casting" : ""}`}>
            {/* Fishing line */}
            <div className={`fishing-line ${isCasting ? "throw" : ""}`} />
            <div className="hook">🪝</div>

            {/* Catch reveal */}
            {lastCatch && (
              <div className="catch pop">
                {lastCatch.emoji}
              </div>
            )}
          </div>

          <button
            className="cast-btn"
            onClick={handleCastLine}
            disabled={isCasting}
          >
            {isCasting ? "CASTING..." : "🎣 CAST"}
          </button>
        </div>
      )}

      {/* ================= RESULT MODAL ================= */}
      {showResultModal && roundResult && (
        <div className="modal-overlay">
          <div className="modal result-modal">
            <h3>
              {roundResult.profit > 0 ? "YOU CAUGHT A FISH! 🎣" : "YOU GOT A TRAP! 💀"}
            </h3>

            <div className="result-emoji" style={{ fontSize: '4rem' }}>
              {roundResult.catch?.emoji || "💀"}
            </div>

            <p className="result-title">
              {roundResult.catch?.name || "Unknown"}
            </p>

            <div className="financial-summary">
              <div className="financial-row">
                <span>Stake:</span>
                <span>₦{formatMoney(roundResult.bet_amount)}</span>
              </div>
              
              <div className="financial-row">
                <span>Payout:</span>
                <span>₦{formatMoney(roundResult.win_amount)}</span>
              </div>
              
              <div className="financial-row total" style={{ 
                color: roundResult.profit > 0 ? '#4CAF50' : '#F44336'
              }}>
                <span>Result:</span>
                <span>
                  {roundResult.profit > 0 
                    ? `+₦${formatMoney(roundResult.profit)}`
                    : `-₦${formatMoney(roundResult.bet_amount - roundResult.win_amount)}`}
                </span>
              </div>
            </div>

            <div className="new-balance">
              <span>New Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Updating...
                  </div>
                ) : (
                  `₦${formatMoney(getWalletBalance())}`
                )}
              </span>
            </div>

            <div className="result-actions">
              <button className="primary" onClick={resetGame}>
                PLAY AGAIN
              </button>
              <button className="secondary" onClick={returnToGames}>
                BACK TO GAMES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FishingGame;