import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { towerService } from "../services/api";
import "./TowerGame.css";

const TowerGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  /* -------------------- HELPER FUNCTIONS -------------------- */
  const getCombinedBalance = () => {
    if (!wallet) return user?.balance || 0;
    const balance = wallet.balance || 0;
    const spot_balance = wallet.spot_balance || 0;
    return balance + spot_balance;
  };

  const getSpotBalance = () => {
    if (!wallet) return 0;
    return wallet.spot_balance || 0;
  };

  const combinedBalance = Number(getCombinedBalance() || 0);
  const spotBalance = Number(getSpotBalance() || 0);

  const formatNGN = (v) =>
    `₦${Number(v || 0).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
    })}`;

  /* -------------------- STATE -------------------- */
  const [showStakeModal, setShowStakeModal] = useState(true);
  const [stake, setStake] = useState(1000);
  const [targetHeight, setTargetHeight] = useState(10);
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [lastWin, setLastWin] = useState(null);

  /* -------------------- DEEP REFRESH -------------------- */
  const deepRefresh = async () => {
    setShowStakeModal(true);
    setGame(null);
    setLastWin(null);
    setShowWinModal(false);
    setShowLossModal(false);
    
    if (refreshWallet) {
      await refreshWallet();
    }
  };

  /* -------------------- START GAME -------------------- */
  const startGame = async () => {
    if (stake < 100) {
      alert("Minimum stake is ₦100");
      return;
    }

    if (stake > combinedBalance) {
      alert("Insufficient balance");
      return;
    }

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
        status: "building",
        targetHeight: targetHeight,
      });

      if (refreshWallet) {
        await refreshWallet();
      }

      setShowStakeModal(false);
    } catch (err) {
      console.error("Game start error:", err);
      
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to start game";
      
      alert(`Error: ${errorMessage}`);
    }
  };

  /* -------------------- BUILD LEVEL -------------------- */
  const buildNext = async () => {
    if (!game || loading || game.status !== "building") return;
    setLoading(true);

    try {
      const res = await towerService.buildLevel({ game_id: game.id });

      if (res.data.status === "crashed") {
        setGame({ ...game, status: "crashed" });
        setTimeout(() => {
          setShowLossModal(true);
        }, 1000);
      } else if (res.data.status === "completed") {
        const winData = {
          win_amount: res.data.win_amount,
          win_tier: res.data.win_tier,
          height: res.data.current_height,
        };
        
        setLastWin(winData);
        setGame({ ...game, status: "completed", height: res.data.current_height });
        
        if (refreshWallet) {
          await refreshWallet();
        }
        
        setTimeout(() => {
          setShowWinModal(true);
        }, 800);
      } else {
        setGame({
          ...game,
          height: res.data.current_height,
        });
      }
    } catch (err) {
      console.error("Build error:", err);
      alert(err.response?.data?.error || "Build failed");
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- CASH OUT -------------------- */
  const cashOut = async () => {
    if (!game || game.height === 0) return;

    try {
      const res = await towerService.cashOut({ game_id: game.id });
      
      const winData = {
        win_amount: res.data.win_amount,
        win_tier: res.data.win_tier,
        height: res.data.height_reached,
      };
      
      setLastWin(winData);
      setGame({ ...game, status: "cashed_out" });
      
      if (refreshWallet) {
        await refreshWallet();
      }
      
      setTimeout(() => {
        setShowWinModal(true);
      }, 500);
      
    } catch (err) {
      alert(err.response?.data?.error || "Cash out failed");
    }
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="tower-game">
      {/* HEADER */}
      <header className="game-header">
        <button onClick={() => navigate("/")}>← Back</button>
      </header>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>🏗️ Tower Builder</h3>
            <p className="game-description">Build your tower, avoid crashes, reach new heights!</p>

            <div className="game-settings">
              <div className="setting-group">
                <label>Target Height</label>
                <div className="option-buttons">
                  {[8, 10, 15, 20].map(height => (
                    <button
                      key={height}
                      className={targetHeight === height ? "active" : ""}
                      onClick={() => !walletLoading && setTargetHeight(height)}
                      disabled={walletLoading}
                    >
                      {height} Floors
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="stake-input-group">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                value={stake}
                min={100}
                step={100}
                onChange={(e) => setStake(Number(e.target.value))}
                disabled={walletLoading}
              />
            </div>
            <button
              className="start-btn"
              disabled={walletLoading || stake < 100 || stake > combinedBalance}
              onClick={startGame}
            >
              {walletLoading ? "LOADING..." : "🚀 START BUILDING"}
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      {game && !showStakeModal && (
        <div className="tower-game-board">
          <div className="game-info-bar">
            <div className="info-item">
              <span>Current Height</span>
              <strong className="height-display">
                {game.height} / {targetHeight}
              </strong>
            </div>
            <div className="info-item">
              <span>Stake</span>
              <strong>{formatNGN(stake)}</strong>
            </div>
          </div>

          {/* TOWER VISUALIZATION */}
          <div className="tower-visualization">
            <div className="tower-base"></div>
            {Array.from({ length: targetHeight }).map((_, index) => {
              const floorIndex = targetHeight - index - 1;
              const isBuilt = floorIndex < game.height;
              
              return (
                <div 
                  key={index}
                  className={`tower-floor ${isBuilt ? 'built' : ''}`}
                >
                  {isBuilt && (
                    <span className="floor-number">
                      {floorIndex + 1}
                    </span>
                  )}
                </div>
              );
            })}
            
            {game.status === "crashed" && (
              <div className="crash-animation">
                <div className="explosion">💥</div>
                <div className="debris">🏗️</div>
                <div className="debris">🏗️</div>
                <div className="debris">🏗️</div>
              </div>
            )}
          </div>

          {/* ACTION BUTTONS */}
          {game.status === "building" && (
            <div className="action-buttons">
              <button 
                className="build-btn"
                onClick={buildNext}
                disabled={loading}
              >
                {loading ? "BUILDING..." : `⬆️ BUILD NEXT FLOOR`}
              </button>
              
              <button 
                className="cashout-btn"
                onClick={cashOut}
                disabled={game.height === 0}
              >
                💰 CASH OUT
              </button>
            </div>
          )}

          {/* GAME RESULT */}
          {(game.status === "crashed" || game.status === "completed" || game.status === "cashed_out") && (
            <div className="result-section">
              <div className="result-message">
                {game.status === "crashed" ? (
                  <>
                    <div className="result-icon">💥</div>
                    <h3>Tower Crashed!</h3>
                    <p>Reached {game.height} floors</p>
                  </>
                ) : game.status === "completed" ? (
                  <>
                    <div className="result-icon">🏆</div>
                    <h3>Tower Complete!</h3>
                    <p>Reached target of {targetHeight} floors!</p>
                  </>
                ) : (
                  <>
                    <div className="result-icon">💰</div>
                    <h3>Cashed Out!</h3>
                    <p>Reached {game.height} floors</p>
                  </>
                )}
              </div>
              
              {lastWin && game.status !== "crashed" && (
                <div className="win-details">
                  <div className="win-amount-display">
                    <span className="win-label">You Won</span>
                    <span className="win-amount">
                      {formatNGN(lastWin.win_amount)}
                    </span>
                  </div>
                </div>
              )}

              <button
                className="restart-btn"
                onClick={deepRefresh}
              >
                🔁 BUILD NEW TOWER
              </button>
            </div>
          )}
        </div>
      )}

      {/* WIN MODAL */}
      {showWinModal && lastWin && (
        <div className="modal-overlay win-modal-overlay">
          <div className="win-modal-content">
            <div className="win-modal-header">
              <div className="win-icon">🏆</div>
              <h2>Great Job!</h2>
              <p className="win-subtitle">Your tower was successful!</p>
            </div>
            
            <div className="win-amount-display">
              <span className="win-amount-label">You won</span>
              <span className="win-amount">
                {formatNGN(lastWin.win_amount)}
              </span>
            </div>
            
            <button
              className="continue-button"
              onClick={() => {
                setShowWinModal(false);
                deepRefresh();
              }}
            >
              🏗️ Build New Tower
            </button>
          </div>
        </div>
      )}

      {/* LOSS MODAL */}
      {showLossModal && (
        <div className="modal-overlay loss-modal-overlay">
          <div className="loss-modal-content">
            <div className="loss-modal-header">
              <div className="loss-icon">💥</div>
              <h2>Tower Crashed!</h2>
              <p className="loss-subtitle">Better luck next time!</p>
            </div>
            
            <button
              className="try-again-button"
              onClick={() => {
                setShowLossModal(false);
                deepRefresh();
              }}
            >
              🔁 Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TowerGame;