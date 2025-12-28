import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { heistService } from "../services/api";
import "./CyberHeistGame.css";

const MIN_STAKE = 200;

const CyberHeistGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  const [showModal, setShowModal] = useState(true);
  const [betAmount, setBetAmount] = useState(MIN_STAKE);
  const [targetBank, setTargetBank] = useState("Quantum Bank");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  /* -------------------- HELPER FUNCTIONS -------------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  // Validate stake amount
  const isStakeValid = () => {
    return Number.isFinite(betAmount) && betAmount >= MIN_STAKE;
  };

  const banks = [
    { name: "Quantum Bank", security: 3, image: "🔒" },
    { name: "Neo Financial", security: 5, image: "💳" },
    { name: "Cyber Trust", security: 7, image: "🖥️" },
    { name: "Digital Vault", security: 9, image: "🏦" },
  ];

  const startHeist = async () => {
    // Basic validation
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      setError("Enter a valid stake amount");
      return;
    }

    // Check minimum stake
    if (betAmount < MIN_STAKE) {
      setError(`Minimum stake is ₦${MIN_STAKE.toLocaleString("en-NG")}`);
      return;
    }

    // Check balance
    if (betAmount > balance) {
      setError("Insufficient wallet balance");
      return;
    }

    // Check if wallet is still loading
    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    setError("");
    setShowModal(false);
    setRunning(true);
    setResult(null);

    try {
      const res = await heistService.startHeist({
        bet_amount: betAmount,
        target_bank: targetBank,
      });

      setResult(res.data);
      
      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({
        ...user,
        balance: res.data.new_balance || (balance - betAmount + (res.data.win_amount || 0)),
      });
    } catch (e) {
      setError(e.response?.data?.error || "Heist failed");
      setShowModal(true);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="heist-game">

      {/* HEADER */}
      <div className="top-bar">
        <button onClick={() => navigate("/")}>←</button>
        <span>🕶️ Cyber Heist</span>
        <span className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
          )}
        </span>
      </div>

      {/* STAKE + TARGET MODAL */}
      {showModal && (
        <div className="heist-modal-overlay">
          <div className="heist-modal-card">
            <h3>Plan Heist</h3>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  `₦${balance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                )}
              </span>
            </div>

            <div className="modal-section">
              <label>Target Bank</label>
              <div className="bank-grid">
                {banks.map((b) => (
                  <div
                    key={b.name}
                    className={`bank-card ${
                      targetBank === b.name ? "active" : ""
                    }`}
                    onClick={() => !walletLoading && setTargetBank(b.name)}
                  >
                    <span>{b.image}</span>
                    <small>{b.name}</small>
                    <small>Security {b.security}/10</small>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-section">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                value={betAmount}
                min={MIN_STAKE}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                disabled={walletLoading}
                placeholder="1000"
              />
              
              {/* Quick bet options */}
              <div className="quick-bet-row">
                {[1000, 2000, 5000, 10000].map((amount) => (
                  <button
                    key={amount}
                    className={`quick-bet-btn ${betAmount === amount ? "active" : ""}`}
                    onClick={() => setBetAmount(amount)}
                    disabled={walletLoading}
                    type="button"
                  >
                    ₦{amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* Stake validation message */}
              {!isStakeValid() && betAmount > 0 && (
                <div className="stake-validation-error">
                  Minimum stake is ₦{MIN_STAKE.toLocaleString("en-NG")}
                </div>
              )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            <button 
              className="heist-start-btn" 
              onClick={startHeist}
              disabled={walletLoading || !isStakeValid()}
            >
              {walletLoading ? "LOADING..." : "START HEIST"}
            </button>
          </div>
        </div>
      )}

      {/* GAME DISPLAY */}
      {!showModal && (
        <div className="heist-terminal">
          {running && (
            <div className="hack-animation">
              <p>$ sudo breach --target {targetBank}</p>
              <p>Injecting payload...</p>
              <p>Bypassing firewall...</p>
              <div className="blinker">█</div>
            </div>
          )}

          {!running && result && (
            <div className={`heist-result ${result.escape_success ? "win" : "lose"}`}>
              <h2>
                {result.escape_success ? "💸 HEIST SUCCESS" : "🚨 TRACE DETECTED"}
              </h2>
              <p>
                {result.escape_success
                  ? `You gained ₦${Number(result.win_amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                  : "You lost your entire stake"}
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
                    `₦${Number(getWalletBalance() || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                  )}
                </span>
              </div>

              <button
                onClick={() => {
                  setResult(null);
                  setShowModal(true);
                }}
              >
                RUN AGAIN
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CyberHeistGame;