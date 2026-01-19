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
  const [lastWin, setLastWin] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [showLossModal, setShowLossModal] = useState(false);
  const [minesPositions, setMinesPositions] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [safeCellsLeft, setSafeCellsLeft] = useState(0);
  const [revealedCells, setRevealedCells] = useState([]);

  const initializeGrid = (size) =>
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        revealed: false,
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
    setRevealedCells([]);
    setShowWinModal(false);
    setShowLossModal(false);
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
      setGameState("playing");
      setShowStakeModal(false);
      setMinesPositions([]);
      setRevealedCells([]);
      const safeCells = gridSize * gridSize - minesCount;
      setSafeCellsLeft(safeCells);

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
    
    // Don't reveal already revealed cells
    if (grid[row][col].revealed) return;
    
    setIsProcessing(true);
    try {
      const res = await minesweeperService.reveal({
        game_id: gameId,
        row,
        col,
      });

      if (res.data.hit_mine) {
        setGameState("lost");
        
        // Get all mines positions
        const mines = res.data.mines_positions || [];
        setMinesPositions(mines);
        
        // Update grid to show mines and revealed cells
        const newGrid = [...grid];
        
        // First mark all mines
        mines.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c]) {
            newGrid[r][c].isMine = true;
            newGrid[r][c].revealed = true;
          }
        });
        
        // Then mark revealed safe cells from backend
        const backendRevealed = res.data.revealed_cells || [];
        backendRevealed.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c] && !newGrid[r][c].isMine) {
            newGrid[r][c].revealed = true;
          }
        });
        
        setGrid(newGrid);
        
        // Show loss modal after a short delay
        setTimeout(() => {
          setShowLossModal(true);
        }, 800);
        
        return;
      }

      // Cell is safe
      setSafeCellsLeft(res.data.safe_cells_left || 0);

      // Update revealed cells from backend
      const backendRevealed = res.data.revealed_cells || [];
      const newRevealedCells = [...revealedCells];
      
      const newGrid = [...grid];
      backendRevealed.forEach(([r, c]) => {
        if (newGrid[r] && newGrid[r][c] && !newGrid[r][c].revealed) {
          newGrid[r][c].revealed = true;
          newGrid[r][c].isMine = false;
          if (!newRevealedCells.some(cell => cell[0] === r && cell[1] === c)) {
            newRevealedCells.push([r, c]);
          }
        }
      });
      
      setGrid(newGrid);
      setRevealedCells(newRevealedCells);
      
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
      });

      // Reveal all cells on cash out
      const newGrid = [...grid];
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (!newGrid[r][c].revealed) {
            newGrid[r][c].revealed = true;
          }
        }
      }
      setGrid(newGrid);

      if (refreshWallet) {
        await refreshWallet();
      }

      // Show win modal after a short delay
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

  /* -------------------- RENDER CELL CONTENT -------------------- */
  const renderCellContent = (cell) => {
    if (!cell.revealed) return null;
    if (cell.isMine) return "💣";
    return "✅";
  };

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
               "Reveal safe cells and avoid mines to win!"}
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
              <span>Safe Cells Left</span>
              <strong>{safeCellsLeft}</strong>
            </div>
            <div className="info-item">
              <span>Mines</span>
              <strong>{minesCount}</strong>
            </div>
            <div className="info-item">
              <span>Grid</span>
              <strong>{gridSize}x{gridSize}</strong>
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
                      style={{
                        cursor: isProcessing || cell.revealed ? 'not-allowed' : 'pointer'
                      }}
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
              </p>
            </div>
            
            <div className="loss-stats">
              <div className="stat-item">
                <span>Stake Lost:</span>
                <span className="loss-amount">{formatNGN(betAmount)}</span>
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