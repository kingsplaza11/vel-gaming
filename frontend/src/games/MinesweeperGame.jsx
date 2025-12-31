import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { minesweeperService } from "../services/api";
import "./MinesweeperGame.css";

const MinesweeperGame = ({ user }) => {
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
  const [betAmount, setBetAmount] = useState(1000);
  const [gridSize, setGridSize] = useState(5);
  const [minesCount, setMinesCount] = useState(5);
  const [gameId, setGameId] = useState(null);
  const [grid, setGrid] = useState([]);
  const [gameState, setGameState] = useState("idle");
  const [multiplier, setMultiplier] = useState(1.0);
  const [potentialWinRatio, setPotentialWinRatio] = useState(0);
  const [potentialWinTier, setPotentialWinTier] = useState("playing");
  const [lastWin, setLastWin] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [minesPositions, setMinesPositions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const initializeGrid = (size) =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        revealed: false,
        mine: false,
        isMine: false,
      }))
    );

  /* -------------------- DEEP REFRESH -------------------- */
  const deepRefresh = async () => {
    setShowStakeModal(true);
    setGameState("idle");
    setGrid([]);
    setGameId(null);
    setLastWin(null);
    setMinesPositions([]);
    setShowWinModal(false);
    setShowLossModal(false);
    setMultiplier(1.0);
    setPotentialWinRatio(0);
    setPotentialWinTier("playing");
    setIsProcessing(false);
    
    if (refreshWallet) {
      await refreshWallet();
    }
  };

  /* -------------------- START GAME -------------------- */
  const startGame = async () => {
    if (isProcessing) return;
    
    if (betAmount < 100) {
      alert("Minimum stake is ₦100");
      return;
    }

    if (betAmount > combinedBalance) {
      alert("Insufficient balance");
      return;
    }

    if (walletLoading) {
      alert("Please wait while your balance loads...");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await minesweeperService.start({
        bet_amount: betAmount,
        grid_size: gridSize,
        mines_count: minesCount,
      });

      setGameId(res.data.game_id);
      setGrid(initializeGrid(gridSize));
      setMultiplier(1.0);
      setGameState("playing");
      setShowStakeModal(false);
      setPotentialWinRatio(0);
      setPotentialWinTier("playing");
      setMinesPositions([]);

      if (refreshWallet) {
        await refreshWallet();
      }

    } catch (err) {
      console.error("Game start error:", err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to start game";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* -------------------- REVEAL CELL -------------------- */
  const revealCell = async (row, col) => {
    if (gameState !== "playing" || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const res = await minesweeperService.reveal({
        game_id: gameId,
        row,
        col,
      });

      if (res.data.hit_mine) {
        setGameState("lost");
        setMinesPositions(res.data.mines_positions || []);
        
        // Update grid to show all mines
        const newGrid = [...grid];
        if (res.data.mines_positions) {
          res.data.mines_positions.forEach(([r, c]) => {
            if (newGrid[r] && newGrid[r][c]) {
              newGrid[r][c].mine = true;
              newGrid[r][c].revealed = true;
              newGrid[r][c].isMine = true;
            }
          });
        }
        
        // Also show revealed safe cells
        if (res.data.revealed_cells) {
          res.data.revealed_cells.forEach(([r, c]) => {
            if (newGrid[r] && newGrid[r][c] && !newGrid[r][c].isMine) {
              newGrid[r][c].revealed = true;
            }
          });
        }
        
        setGrid(newGrid);
        
        // Show loss modal after a short delay
        setTimeout(() => {
          setShowLossModal(true);
        }, 800);
        
        return;
      }

      setMultiplier(res.data.multiplier);
      setPotentialWinRatio(res.data.potential_win_ratio || 0);
      setPotentialWinTier(res.data.potential_win_tier || "playing");

      const newGrid = [...grid];
      if (res.data.revealed_cells) {
        res.data.revealed_cells.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c]) {
            newGrid[r][c].revealed = true;
            newGrid[r][c].mine = false;
          }
        });
      }
      setGrid(newGrid);
      
    } catch (err) {
      console.error("Reveal error:", err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Reveal failed";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* -------------------- CASH OUT -------------------- */
  const cashOut = async () => {
    if (gameState !== "playing" || isProcessing) return;

    setIsProcessing(true);
    try {
      const res = await minesweeperService.cashout({
        game_id: gameId,
      });

      setGameState("cashed_out");
      setLastWin({
        win_amount: res.data.win_amount,
        win_ratio: res.data.win_ratio,
        win_tier: res.data.win_tier,
        multiplier: res.data.multiplier,
      });

      if (refreshWallet) {
        await refreshWallet();
      }

      // Show win modal for big wins
      if (res.data.win_ratio > 0.5) {
        setTimeout(() => {
          setShowWinModal(true);
        }, 500);
      } else {
        alert(`💰 Cashed out ${formatNGN(res.data.win_amount)}`);
      }

    } catch (err) {
      console.error("Cashout error:", err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          "Cash out failed";
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* -------------------- GET WIN TIER COLOR -------------------- */
  const getWinTierColor = (tier) => {
    switch(tier) {
      case "low": return "#FFA726";
      case "normal": return "#4CAF50";
      case "high": return "#2196F3";
      case "jackpot": return "#9C27B0";
      case "mega_jackpot": return "#F44336";
      default: return "#666";
    }
  };

  /* -------------------- RENDER CELL CONTENT -------------------- */
  const renderCellContent = (cell) => {
    if (!cell.revealed) return null;
    if (cell.isMine) return "💣";
    if (cell.revealed && !cell.isMine) return "✅";
    return null;
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="minesweeper-game">
      {/* HEADER */}
      <header className="game-header">
        <button onClick={() => navigate("/")} disabled={isProcessing}>
          ← Back
        </button>
        <div className="balance-details">
          <div className="balance-total">
            {walletLoading ? (
              <div className="balance-loading">
                <span className="loading-spinner-small" />
                Loading...
              </div>
            ) : (
              formatNGN(combinedBalance)
            )}
          </div>
          <div className="balance-breakdown">
            <span className="balance-main">Main: {formatNGN(wallet?.balance || 0)}</span>
            <span className="balance-spot">Spot: {formatNGN(spotBalance)}</span>
          </div>
        </div>
      </header>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>💣 Minesweeper</h3>
            <p className="game-description">Avoid mines, reveal cells, cash out for winnings! First click can be a mine!</p>

            <div className="balance-summary">
              <span className="balance-label">Available Balance:</span>
              <span className="balance-amount">
                {walletLoading ? (
                  <div className="balance-loading-inline">
                    <span className="loading-spinner-small" />
                    Loading...
                  </div>
                ) : (
                  formatNGN(combinedBalance)
                )}
              </span>
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Grid Size</label>
                <div className="option-buttons">
                  {[5, 6, 8].map(size => (
                    <button
                      key={size}
                      className={gridSize === size ? "active" : ""}
                      onClick={() => setGridSize(size)}
                      disabled={walletLoading || isProcessing}
                    >
                      {size}x{size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-group">
                <label>Mines Count</label>
                <div className="option-buttons">
                  {[3, 5, 7, 10].map(count => (
                    <button
                      key={count}
                      className={minesCount === count ? "active" : ""}
                      onClick={() => setMinesCount(count)}
                      disabled={walletLoading || isProcessing || count >= gridSize * gridSize}
                    >
                      {count} Mines
                    </button>
                  ))}
                </div>
                <small className="risk-indicator">
                  Risk: {minesCount >= 7 ? "🔥 High" : minesCount >= 5 ? "⚠️ Medium" : "🟢 Low"}
                </small>
              </div>
            </div>

            <div className="stake-input-group">
              <label>Stake Amount (₦)</label>
              <input
                type="number"
                value={betAmount}
                min={100}
                step={100}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                disabled={walletLoading || isProcessing}
              />
            </div>

            <div className="quick-stakes">
              {[100, 500, 1000, 2500, 5000].map((v) => (
                <button 
                  key={v} 
                  className={betAmount === v ? "active" : ""}
                  onClick={() => !walletLoading && !isProcessing && setBetAmount(v)}
                  disabled={walletLoading || isProcessing}
                >
                  ₦{v.toLocaleString()}
                </button>
              ))}
            </div>

            <button
              className="start-btn"
              disabled={betAmount > combinedBalance || walletLoading || isProcessing || minesCount >= gridSize * gridSize}
              onClick={startGame}
            >
              {isProcessing ? "STARTING..." : walletLoading ? "LOADING..." : "🚀 START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD */}
      {!showStakeModal && (
        <div className="board-section">
          <div className="game-info-bar">
            <div className="info-item">
              <span>Potential Win</span>
              <strong style={{color: getWinTierColor(potentialWinTier)}}>
                {potentialWinTier === "playing" ? "Calculating..." : 
                 `${(potentialWinRatio * 100).toFixed(1)}%`}
              </strong>
            </div>
            <div className="info-item">
              <span>Mines</span>
              <strong>{minesCount}/{gridSize * gridSize}</strong>
            </div>
          </div>

          <div className="grid-container">
            <div className="grid">
              {grid.map((row, r) => (
                <div key={r} className="row">
                  {row.map((cell, c) => (
                    <div
                      key={`${r}-${c}`}
                      className={`cell ${
                        cell.revealed ? (cell.isMine ? "mine" : "safe") : "hidden"
                      }`}
                      onClick={() => !isProcessing && revealCell(r, c)}
                      style={{cursor: isProcessing ? 'wait' : 'pointer'}}
                    >
                      {renderCellContent(cell)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {gameState === "playing" && (
            <div className="action-buttons">
              <button 
                className="cashout-btn" 
                onClick={cashOut}
                disabled={isProcessing}
              >
                {isProcessing ? "PROCESSING..." : "💰 CASH OUT"}
              </button>
            </div>
          )}

          {(gameState === "lost" || gameState === "cashed_out") && (
            <div className="result-section">
              <div className="result-message">
                {gameState === "lost" ? (
                  <>
                    <div className="result-icon">💥</div>
                    <h3>Mine Hit!</h3>
                    <p>Better luck next time!</p>
                  </>
                ) : (
                  <>
                    <div className="result-icon">💰</div>
                    <h3>Cashed Out!</h3>
                    <p>Winnings added to spot balance</p>
                  </>
                )}
              </div>
              
              {gameState === "cashed_out" && lastWin && (
                <div className="win-details">
                  <div className="win-amount-display">
                    <span className="win-label">You Won</span>
                    <span className="win-amount">{formatNGN(lastWin.win_amount)}</span>
                    <span className="win-ratio">
                      ({lastWin.win_ratio > 0 ? (lastWin.win_ratio * 100).toFixed(1) : '0'}% of stake)
                    </span>
                  </div>
                </div>
              )}

              <button
                className="restart-btn"
                onClick={deepRefresh}
                disabled={isProcessing}
              >
                {isProcessing ? "RESETTING..." : "🔁 PLAY AGAIN"}
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
              <h2>Big Win!</h2>
              <p className="win-subtitle">Congratulations!</p>
            </div>
            
            <div className="win-amount-display">
              <span className="win-amount-label">You won</span>
              <span className="win-amount" style={{color: getWinTierColor(lastWin.win_tier)}}>
                {formatNGN(lastWin.win_amount)}
              </span>
              <p className="win-note">
                {lastWin.win_tier === "mega_jackpot" ? "🎉 MEGA JACKPOT!" : 
                 lastWin.win_tier === "jackpot" ? "💰 JACKPOT WIN!" : 
                 "🎯 Great win!"}
              </p>
            </div>
            
            <div className="win-stats">
              <div className="stat-item">
                <span>Win Ratio:</span>
                <span>{(lastWin.win_ratio * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item">
                <span>Multiplier:</span>
                <span>{lastWin.multiplier.toFixed(2)}x</span>
              </div>
              <div className="stat-item">
                <span>Win Tier:</span>
                <span style={{color: getWinTierColor(lastWin.win_tier), textTransform: 'capitalize'}}>
                  {lastWin.win_tier.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <button
              className="continue-button"
              onClick={() => {
                setShowWinModal(false);
                deepRefresh();
              }}
            >
              🎮 Continue Playing
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
              <h2>Game Over</h2>
              <p className="loss-subtitle">You hit a mine!</p>
            </div>
            
            <div className="loss-message">
              <p className="loss-encouragement">
                Oops! You opened a mine!
                <br />
                <span className="loss-tip">Try again, you might get more lucky next time!</span>
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake Lost:</span>
                <span className="loss-amount">{formatNGN(betAmount)}</span>
              </div>
              <div className="stat-item">
                <span>Mines:</span>
                <span>{minesCount}</span>
              </div>
              <div className="stat-item">
                <span>Grid:</span>
                <span>{gridSize}x{gridSize}</span>
              </div>
              <div className="stat-item">
                <span>Spot Balance:</span>
                <span className="spot-balance">{formatNGN(spotBalance)}</span>
              </div>
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
            
            <p className="loss-footer-note">
              Nothing added to your spot balance. Your stake was lost.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MinesweeperGame;