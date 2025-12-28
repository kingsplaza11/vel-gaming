import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { fishingService } from "../services/api";
import "./FishingGame.css";

const MINIMUM_STAKE = 200; // Minimum stake of 200 naira

const FishingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data from context

  /* ---------------- STATE ---------------- */
  const [betAmount, setBetAmount] = useState(1000); // Start with minimum stake
  const [isCasting, setIsCasting] = useState(false);

  const [lastCatch, setLastCatch] = useState(null);
  const [roundResult, setRoundResult] = useState(null);

  const [showStakeModal, setShowStakeModal] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  /* ---------------- HELPER FUNCTIONS ---------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  // Get current balance
  const safeBalance = Number(getWalletBalance() || 0);

  const formatMoney = (v) => Number(v || 0).toFixed(2);

  // Validate stake amount
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

    // Check minimum stake
    if (amt < MINIMUM_STAKE) {
      setErrorMessage(`Minimum stake is ₦${MINIMUM_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    if (amt > safeBalance) {
      setErrorMessage("Insufficient wallet balance");
      return;
    }

    // Check if wallet is still loading
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
        // Use the new balance from response or fallback
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

  /* ================= RENDER ================= */
  return (
    <div className="fishing-game mobile">
      {/* ================= HEADER ================= */}
      <div className="top-bar">
        <button onClick={() => navigate("/")}>←</button>
        <span>🎣 Deep Sea Fishing</span>
        <span className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            `₦${formatMoney(safeBalance)}`
          )}
        </span>
      </div>

      {/* ================= STAKE MODAL ================= */}
      {showStakeModal && (
        <div className="modal-overlay">
          <div className="modal stake-modal">
            <h3>PLACE YOUR STAKE</h3>

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
              {[1000, 2000, 5000, 10000].map((v) => (
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
              {roundResult.profit > 0 ? "YOU WON" : "YOU LOST"}
            </h3>

            <div className="result-emoji">
              {roundResult.catch?.emoji || "💀"}
            </div>

            <p>Stake: ₦{formatMoney(roundResult.bet_amount)}</p>
            <p>Payout: ₦{formatMoney(roundResult.win_amount)}</p>

            <p
              className={
                roundResult.profit > 0 ? "win" : "lose"
              }
            >
              {roundResult.profit > 0
                ? `Profit +₦${formatMoney(roundResult.profit)}`
                : "Stake Lost"}
            </p>

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

            <button className="primary" onClick={resetGame}>
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FishingGame;