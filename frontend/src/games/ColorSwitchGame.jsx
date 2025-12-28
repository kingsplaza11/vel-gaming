import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { colorSwitchService } from "../services/api";
import "./ColorSwitchGame.css";

const MAX_PROFIT_RATIO = 0.4; // 30%

const ColorSwitchGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* -------------------- HELPER FUNCTIONS -------------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const [stake, setStake] = useState(1000);
  const [sequenceLength, setSequenceLength] = useState(5);

  const [gameId, setGameId] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);

  const [multiplier, setMultiplier] = useState(1);
  const [status, setStatus] = useState("idle"); 
  // idle | showing | playing | lost | cashed

  const [showModal, setShowModal] = useState(true);
  const [showSequence, setShowSequence] = useState(false);
  const [error, setError] = useState("");

  const formatNaira = (v) => `₦${Number(v || 0).toLocaleString()}`;

  const COLORS = [
    { key: "red", emoji: "🔴", className: "color-red" },
    { key: "blue", emoji: "🔵", className: "color-blue" },
    { key: "green", emoji: "🟢", className: "color-green" },
    { key: "yellow", emoji: "🟡", className: "color-yellow" },
    { key: "purple", emoji: "🟣", className: "color-purple" },
    { key: "orange", emoji: "🟠", className: "color-orange" },
  ];

  /* ---------------- START GAME ---------------- */

  const startGame = async () => {
    setError("");

    if (stake < 200) {
      setError("Minimum stake is ₦200");
      return;
    }

    if (stake > balance) {
      setError("Insufficient wallet balance");
      return;
    }

    // Check if wallet is still loading
    if (walletLoading) {
      setError("Please wait while your balance loads...");
      return;
    }

    try {
      const res = await colorSwitchService.startGame({
        bet_amount: stake,
        sequence_length: sequenceLength,
      });

      const data = res.data;

      setGameId(data.game_id);
      setSequence(data.sequence);
      setPlayerSequence([]);
      setMultiplier(1);
      setStatus("showing");
      setShowModal(false);

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({
        ...user,
        balance: data.new_balance || (balance - stake),
      });

      // Show animated sequence
      setShowSequence(true);
      setTimeout(() => {
        setShowSequence(false);
        setStatus("playing");
      }, data.sequence.length * 700 + 800);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to start game");
    }
  };

  /* ---------------- COLOR CLICK ---------------- */

  const handleColorClick = (color) => {
    if (status !== "playing") return;

    const next = [...playerSequence, color];
    setPlayerSequence(next);

    if (next.length === sequence.length) {
      submitSequence(next);
    }
  };

  /* ---------------- SUBMIT ---------------- */

  const submitSequence = async (playerSeq) => {
    try {
      const res = await colorSwitchService.submitSequence({
        game_id: gameId,
        player_sequence: playerSeq,
      });

      const data = res.data;

      if (!data.correct) {
        setStatus("lost");
        return;
      }

      // Calculate capped multiplier
      const maxProfit = stake * MAX_PROFIT_RATIO;
      const rawMultiplier = data.multiplier;
      const cappedMultiplier = Math.min(
        rawMultiplier,
        1 + MAX_PROFIT_RATIO
      );

      setMultiplier(cappedMultiplier);
      setSequence(data.next_sequence);
      setPlayerSequence([]);
      setStatus("showing");

      setShowSequence(true);
      setTimeout(() => {
        setShowSequence(false);
        setStatus("playing");
      }, data.next_sequence.length * 700 + 800);
    } catch (err) {
      setStatus("lost");
    }
  };

  /* ---------------- CASH OUT ---------------- */

  const cashOut = async () => {
    try {
      const res = await colorSwitchService.cashOut({
        game_id: gameId,
      });

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      onBalanceUpdate({
        ...user,
        balance: res.data.new_balance || (balance - stake + (stake * (multiplier - 1))),
      });

      setStatus("cashed");
    } catch {
      setStatus("lost");
    }
  };

  const resetGame = () => {
    setGameId(null);
    setSequence([]);
    setPlayerSequence([]);
    setMultiplier(1);
    setSequenceLength(5);
    setStatus("idle");
    setShowModal(true);
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="color-switch-game">
      <header className="game-header">
        <button onClick={() => navigate("/")}>←</button>
        <span>🎨 Color Switch</span>
        <span className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            formatNaira(balance)
          )}
        </span>
      </header>

      {/* -------- STAKE / TARGET MODAL -------- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal stake-modal">
            <h3>Set Your Challenge</h3>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  formatNaira(balance)
                )}
              </span>
            </div>

            <label>Stake (₦)</label>
            <input
              type="number"
              value={stake}
              min="1000"
              step="500"
              onChange={(e) => setStake(Number(e.target.value))}
              disabled={walletLoading}
            />

            <div className="quick-row">
              {[1000, 2000, 5000, 10000].map((v) => (
                <button 
                  key={v} 
                  onClick={() => setStake(v)}
                  disabled={walletLoading}
                >
                  {formatNaira(v)}
                </button>
              ))}
            </div>

            <label>Target Sequence Length</label>
            <select
              value={sequenceLength}
              onChange={(e) => setSequenceLength(Number(e.target.value))}
              disabled={walletLoading}
            >
              {[5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} Colors
                </option>
              ))}
            </select>

            {error && <p className="error">{error}</p>}

            <button 
              className="primary" 
              onClick={startGame}
              disabled={walletLoading}
            >
              {walletLoading ? "LOADING..." : "START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* -------- GAME AREA -------- */}
      {!showModal && (
        <div className="game-area">
          <div className="multiplier">
            {multiplier.toFixed(2)}x
          </div>

          {showSequence && (
            <div className="sequence-show">
              {sequence.map((c, i) => {
                const color = COLORS.find((x) => x.key === c);
                return (
                  <div key={i} className={`seq-dot ${color.className}`}>
                    {color.emoji}
                  </div>
                );
              })}
            </div>
          )}

          {status === "playing" && (
            <div className="color-grid">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  className={`color-btn ${c.className}`}
                  onClick={() => handleColorClick(c.key)}
                >
                  {c.emoji}
                </button>
              ))}
            </div>
          )}

          {(status === "playing" || status === "showing") && (
            <button className="cashout-btn" onClick={cashOut}>
              CASH OUT {formatNaira(stake * (multiplier - 1))}
            </button>
          )}

          {status === "lost" && (
            <div className="result lost">
              <h2>💀 You Lost</h2>
              <button onClick={resetGame}>PLAY AGAIN</button>
            </div>
          )}

          {status === "cashed" && (
            <div className="result win">
              <h2>💰 Cashed Out</h2>
              <p>
                Profit: {formatNaira(stake * (multiplier - 1))}
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
                    formatNaira(getWalletBalance())
                  )}
                </span>
              </div>
              <button onClick={resetGame}>PLAY AGAIN</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorSwitchGame;