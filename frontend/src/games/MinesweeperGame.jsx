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
  const [potentialMultiplier, setPotentialMultiplier] = useState(0);
  const [potentialWinTier, setPotentialWinTier] = useState("playing");
  const [lastWin, setLastWin] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [minesPositions, setMinesPositions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [safeCellsLeft, setSafeCellsLeft] = useState(0);

  const initializeGrid = (size) =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        revealed: false,
        mine: false,
        isMine: false,
      }))
    );

  /* -------------------- FETCH GAME INFO -------------------- */
  const fetchGameInfo = async () => {
    try {
      const res = await minesweeperService.getGameInfo();
      setGameInfo(res.data);
    } catch (err) {
      console.error("Failed to fetch game info:", err);
    }
  };

  /* -------------------- EFFECTS -------------------- */
  useEffect(() => {
    fetchGameInfo();
    setSafeCellsLeft(gridSize * gridSize - minesCount);
  }, [gridSize, minesCount]);

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
    setPotentialMultiplier(0);
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
      setPotentialMultiplier(0);
      setPotentialWinTier("playing");
      setMinesPositions([]);
      setSafeCellsLeft(gridSize * gridSize - minesCount);

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

      setMultiplier(res.data.current_multiplier || 1.0);
      setPotentialMultiplier(res.data.potential_multiplier || 0);
      setPotentialWinTier(res.data.potential_win_tier || "playing");
      setSafeCellsLeft(res.data.safe_cells_left || 0);

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
        win_multiplier: res.data.win_multiplier,
        win_tier: res.data.win_tier,
        multiplier: res.data.current_multiplier || 1.0,
      });

      if (refreshWallet) {
        await refreshWallet();
      }

      // Show win modal
      setTimeout(() => {
        setShowWinModal(true);
      }, 500);

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
      case "small": return "#10B981";
      case "good": return "#3B82F6";
      case "great": return "#8B5CF6";
      case "perfect": return "#F59E0B";
      default: return "#666";
    }
  };

  const getWinTierName = (tier) => {
    switch(tier) {
      case "small": return "Small Win";
      case "good": return "Good Win";
      case "great": return "Great Win";
      case "perfect": return "Perfect Win";
      default: return "Playing";
    }
  };

  /* -------------------- RENDER CELL CONTENT -------------------- */
  const renderCellContent = (cell) => {
    if (!cell.revealed) return null;
    if (cell.isMine) return "💣";
    if (cell.revealed && !cell.isMine) return "✅";
    return null;
  };

  /* -------------------- CALCULATE POTENTIAL WIN -------------------- */
  const calculatePotentialWin = () => {
    if (potentialMultiplier > 0) {
      return betAmount * potentialMultiplier;
    }
    return betAmount * multiplier;
  };

  const potentialWin = calculatePotentialWin();

  /* -------------------- RENDER -------------------- */
  return (
    <div className="minesweeper-game">
      {/* HEADER */}
      <header className="game-header">
        <button onClick={() => navigate("/")} disabled={isProcessing}>
          ← Back
        </button>
        
        
      </header>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal">
            <h3>💣 Minesweeper</h3>
            <p className="game-description">
              {gameInfo ? gameInfo.game_info.description : 
               "Reveal safe cells and avoid mines to win multipliers!"}
            </p>
            

            <div className="game-settings">
              <div className="setting-group">
                <label>Grid Size</label>
                <div className="option-buttons">
                  {[5, 6, 7, 8].map(size => (
                    <button
                      key={size}
                      className={gridSize === size ? "active" : ""}
                      onClick={() => {
                        setGridSize(size);
                        if (minesCount >= size * size) {
                          setMinesCount(Math.max(3, size * size - 5));
                        }
                      }}
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
                  <br />
                  Safe Chance: {((gridSize * gridSize - minesCount) / (gridSize * gridSize) * 100).toFixed(0)}%
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
              <span>Current Multiplier</span>
              <strong style={{color: "#F59E0B"}}>
                {multiplier.toFixed(2)}x
              </strong>
            </div>
            <div className="info-item">
              <span>Potential Win</span>
              <strong style={{color: getWinTierColor(potentialWinTier)}}>
                {potentialMultiplier > 0 ? `${potentialMultiplier.toFixed(2)}x` : `${multiplier.toFixed(2)}x`}
              </strong>
            </div>
            <div className="info-item">
              <span>Safe Cells Left</span>
              <strong>{safeCellsLeft}</strong>
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
                  </>
                ) : (
                  <>
                    <div className="result-icon">💰</div>
                    <h3>Cashed Out!</h3>
                  </>
                )}
              </div>
              
              {gameState === "cashed_out" && lastWin && (
                <div className="win-details">
                  <div className="win-amount-display">
                    <span className="win-label">You Won</span>
                    <span className="win-amount">{formatNGN(lastWin.win_amount)}</span>
                    <span className="win-multiplier">
                      ({lastWin.win_multiplier?.toFixed(2) || '1.00'}x multiplier)
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
              <h2>Cashed Out!</h2>
              <p className="win-subtitle">Safe cells revealed successfully!</p>
            </div>
            
            <div className="win-amount-display">
              <span className="win-amount-label">You won</span>
              <span className="win-amount" style={{color: getWinTierColor(lastWin.win_tier)}}>
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
              <p className="loss-subtitle">You hit a mine</p>
            </div>
            
            <div className="loss-message">
              <p className="loss-encouragement">
                Oops! That was a mine.
                <br />
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

export default MinesweeperGame;