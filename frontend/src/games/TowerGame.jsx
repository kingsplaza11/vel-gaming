import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext"; // Import wallet context
import { towerService } from "../services/api";
import "./TowerGame.css";

const MIN_STAKE = 1000;

const TowerGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet(); // Get wallet data

  // Get wallet balance with fallback to user.balance
  const getWalletBalance = () => {
    return wallet?.balance !== undefined ? wallet.balance : (user?.balance || 0);
  };

  const balance = Number(getWalletBalance() || 0);

  const [stake, setStake] = useState(MIN_STAKE);
  const [targetHeight, setTargetHeight] = useState(10);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const format = (v) => `₦${Number(v || 0).toLocaleString()}`;

  const startGame = async () => {
    if (stake < MIN_STAKE || stake > balance) return;

    // Check if wallet is still loading
    if (walletLoading) {
      alert("Please wait while your balance loads...");
      return;
    }

    try {
      const res = await towerService.startTower({
        bet_amount: stake,
        target_height: targetHeight,
      });

      setGame({
        id: res.data.game_id,
        height: 0,
        multiplier: 1,
        status: "building",
      });

      // Update wallet balance
      if (refreshWallet) {
        await refreshWallet();
      }

      setShowModal(false);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to start");
    }
  };

  const buildNext = async () => {
    if (!game || loading) return;
    setLoading(true);

    try {
      const res = await towerService.buildLevel({ game_id: game.id });

      if (res.data.status === "crashed") {
        setGame({ ...game, status: "crashed" });
        setTimeout(() => setShowModal(true), 1200);
      } else if (res.data.status === "completed") {
        // Update wallet balance
        if (refreshWallet) {
          await refreshWallet();
        }
        setGame({ ...game, status: "completed" });
        setTimeout(() => setShowModal(true), 1200);
      } else {
        setGame({
          ...game,
          height: res.data.current_height,
          multiplier: res.data.multiplier,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const cashOut = async () => {
    if (!game) return;

    const res = await towerService.cashOut({ game_id: game.id });
    
    // Update wallet balance
    if (refreshWallet) {
      await refreshWallet();
    }
    
    setGame(null);
    setShowModal(true);
  };

  return (
    <div className="tower-game">

      {/* HEADER */}
      <div className="game-header">
        <button onClick={() => navigate("/")}>←</button>
        <span>🏗️ Tower Builder</span>
        <span>
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

      {/* STAKE MODAL */}
      {showModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>Build Your Tower</h3>

            <label>Stake Amount (₦)</label>
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

            <label>Target Height</label>
            <div className="quick-stakes">
              {[5, 10, 15, 20].map(h => (
                <button 
                  key={h} 
                  onClick={() => !walletLoading && setTargetHeight(h)}
                  disabled={walletLoading}
                >
                  {h} Floors
                </button>
              ))}
            </div>
            <button
              className="start-btn"
              disabled={walletLoading || stake < MIN_STAKE || stake > balance}
              onClick={startGame}
            >
              {walletLoading ? "LOADING..." : "START BUILDING"}
            </button>
          </div>
        </div>
      )}

      {/* GAMEPLAY */}
      {game && (
        <div className={`tower-stage ${game.status}`}>
          <div className="tower-height">
            Height: {game.height} / {targetHeight}
          </div>

          <div className="tower-multiplier">
            {game.multiplier.toFixed(2)}x
          </div>

          <div className="tower-actions">
            <button onClick={buildNext} disabled={loading}>
              ⬆️ BUILD
            </button>
            <button onClick={cashOut} disabled={game.height === 0}>
              💰 CASH OUT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerGame;