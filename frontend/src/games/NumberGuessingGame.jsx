import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { guessingService } from "../services/api";
import "./NumberGuessingGame.css";

const MIN_STAKE = 200;

const NumberGuessingGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  /* -------------------- HELPER FUNCTIONS -------------------- */
  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const [stake, setStake] = useState(MIN_STAKE);
  const [maxNumber, setMaxNumber] = useState(100);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [guess, setGuess] = useState("");
  const [game, setGame] = useState(null);
  const [showModal, setShowModal] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const format = (v) => `₦${Number(v).toLocaleString()}`;

  const startGame = async () => {
    // Check if wallet is still loading
    if (walletLoading) {
      alert("Please wait while your balance loads...");
      return;
    }

    const res = await guessingService.startGame({
      bet_amount: stake,
      max_number: maxNumber,
      max_attempts: maxAttempts,
    });

    setGame({ id: res.data.game_id });

    // Update wallet balance
    if (refreshWallet) {
      await refreshWallet();
    }

    setShowModal(false);
    setFeedback(null);
  };

  const submitGuess = async () => {
    if (!guess) return;

    const res = await guessingService.makeGuess({
      game_id: game.id,
      guess: Number(guess),
    });

    if (res.data.status === "won") {
      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      setFeedback(`🎉 You won ${format(res.data.win_amount)}!`);
      setTimeout(() => setShowModal(true), 1500);
      setGame(null);
    } else if (res.data.status === "lost") {
      setFeedback(`💀 Lost! Number was ${res.data.target_number}`);
      setTimeout(() => setShowModal(true), 1500);
      setGame(null);
    } else {
      setFeedback(`Try ${res.data.hint.toUpperCase()}`);
    }

    setGuess("");
  };

  return (
    <div className="guessing-game">

      {/* HEADER */}
      <div className="game-header">
        <button onClick={() => navigate("/")}>←</button>
        <span>🎯 Number Guess</span>
        <span className="balance-display">
          {walletLoading ? (
            <div className="balance-loading">
              <span className="loading-spinner-small" />
              Loading...
            </div>
          ) : (
            format(balance)
          )}
        </span>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>Start Guessing</h3>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  format(balance)
                )}
              </span>
            </div>

            <label>Stake (₦)</label>
            <input
              type="number"
              value={stake}
              min={MIN_STAKE}
              onChange={(e) => setStake(Number(e.target.value))}
              disabled={walletLoading}
            />

            <div className="quick-stakes">
              {[1000, 2000, 5000, 10000].map(v => (
                <button 
                  key={v} 
                  onClick={() => !walletLoading && setStake(v)}
                  disabled={walletLoading}
                >
                  ₦{v.toLocaleString()}
                </button>
              ))}
            </div>

            <label>Difficulty</label>
            <div className="quick-stakes">
              <button 
                onClick={() => {
                  if (!walletLoading) {
                    setMaxNumber(50);
                    setMaxAttempts(10);
                  }
                }}
                disabled={walletLoading}
              >
                Easy
              </button>
              <button 
                onClick={() => {
                  if (!walletLoading) {
                    setMaxNumber(100);
                    setMaxAttempts(10);
                  }
                }}
                disabled={walletLoading}
              >
                Medium
              </button>
              <button 
                onClick={() => {
                  if (!walletLoading) {
                    setMaxNumber(200);
                    setMaxAttempts(8);
                  }
                }}
                disabled={walletLoading}
              >
                Hard
              </button>
            </div>
            <button
              className="start-btn"
              disabled={stake < MIN_STAKE || stake > balance || walletLoading}
              onClick={startGame}
            >
              {walletLoading ? "LOADING..." : "START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* GAMEPLAY */}
      {game && (
        <div className="guess-stage">
          <div className="guess-input">
            <input
              type="number"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder={`1 - ${maxNumber}`}
            />
            <button onClick={submitGuess}>GUESS</button>
          </div>

          {feedback && <div className="guess-feedback">{feedback}</div>}
        </div>
      )}
    </div>
  );
};

export default NumberGuessingGame;