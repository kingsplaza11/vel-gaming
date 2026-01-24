import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { minesweeperService } from "../services/api";
import { minesweeperSound } from "../utils/MinesweeperSoundManager";
import "./MinesweeperGame.css";

const MinesweeperGame = ({ user }) => {
  const navigate = useNavigate();
  const { wallet, loading: walletLoading, refreshWallet } = useWallet();

  /* -------------------- SOUND MANAGER -------------------- */
  const soundManager = minesweeperSound;
  
  // Initialize sound on first user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.init();
      window.removeEventListener('click', handleFirstInteraction);
    };
    
    window.addEventListener('click', handleFirstInteraction);
    return () => window.removeEventListener('click', handleFirstInteraction);
  }, []);

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
  const [clickedMine, setClickedMine] = useState(null);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  
  // Refs
  const soundInitRef = useRef(false);

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

  /* -------------------- SOUND FUNCTIONS -------------------- */
  const playButtonClick = () => {
    if (!soundInitRef.current) {
      soundManager.init();
      soundInitRef.current = true;
    }
    soundManager.playButtonClick();
  };

  const playGameStart = () => {
    soundManager.playGameStart();
  };

  const playSafeReveal = () => {
    soundManager.playSafeReveal();
  };

  const playMineHit = () => {
    soundManager.playMineHit();
  };

  const playCashOut = () => {
    soundManager.playCashOut();
  };

  const playWinCelebration = () => {
    soundManager.playWinCelebration();
  };

  const playLossSound = () => {
    soundManager.playLossSound();
  };

  const playGridSelect = () => {
    soundManager.playGridSelect();
  };

  const playMineSelect = () => {
    soundManager.playMineSelect();
  };

  const toggleSoundMute = () => {
    const newMuteState = soundManager.toggleMute();
    setIsSoundMuted(newMuteState);
  };

  /* -------------------- EFFECTS -------------------- */
  useEffect(() => {
    fetchGameInfo();
    const totalCells = gridSize * gridSize;
    const safeCells = totalCells - minesCount;
    setSafeCellsLeft(safeCells);
  }, [gridSize, minesCount]);

  // Initialize sound mute state
  useEffect(() => {
    setIsSoundMuted(soundManager.getMuteState().gameSoundsMuted);
  }, []);

  /* -------------------- DEEP REFRESH -------------------- */
  const deepRefresh = async () => {
    setShowStakeModal(true);
    setGameState("idle");
    setGrid([]);
    setGameId(null);
    setLastWin(null);
    setMinesPositions([]);
    setRevealedCells([]);
    setClickedMine(null);
    setCurrentMultiplier(1.0);
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
    
    playButtonClick();
    
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

    if (minesCount >= gridSize * gridSize) {
      alert("Too many mines! Mines count must be less than total cells.");
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
      
      // Initialize empty grid with correct structure
      const initialGrid = initializeGrid(gridSize);
      console.log("Initial grid created:", initialGrid);
      setGrid(initialGrid);
      
      setGameState("playing");
      setShowStakeModal(false);
      setMinesPositions([]);
      setRevealedCells([]);
      setClickedMine(null);
      setCurrentMultiplier(1.0);
      const safeCells = gridSize * gridSize - minesCount;
      setSafeCellsLeft(safeCells);

      // Play game start sound
      playGameStart();

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
    console.log("revealCell called with:", { row, col, gameState, isProcessing });
    
    if (gameState !== "playing") {
      console.log("Cannot reveal: gameState is", gameState);
      return;
    }
    
    if (isProcessing) {
      console.log("Cannot reveal: isProcessing is true");
      return;
    }
    
    // Don't reveal already revealed cells
    if (grid[row] && grid[row][col] && grid[row][col].revealed) {
      console.log("Cell already revealed at", row, col);
      return;
    }
    
    console.log("Proceeding with reveal...");
    setIsProcessing(true);
    
    try {
      const res = await minesweeperService.reveal({
        game_id: gameId,
        row,
        col,
      });

      console.log("Reveal API response:", res.data);

      if (res.data.hit_mine) {
        console.log("Mine hit!");
        setGameState("lost");
        setClickedMine([row, col]);
        
        const mines = res.data.mines_positions || [];
        console.log("Mines positions:", mines);
        setMinesPositions(mines);
        
        // Create a new grid to update
        const newGrid = initializeGrid(gridSize);
        
        // Mark all mines
        mines.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c]) {
            newGrid[r][c].isMine = true;
            newGrid[r][c].revealed = true;
          }
        });
        
        // Mark revealed safe cells
        const revealed = res.data.revealed_cells || [];
        revealed.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c] && !newGrid[r][c].isMine) {
            newGrid[r][c].revealed = true;
          }
        });
        
        setGrid(newGrid);
        
        // Play mine hit sound
        playMineHit();
        
        // Show loss modal after a short delay
        setTimeout(() => {
          setShowLossModal(true);
          playLossSound();
        }, 800);
        
        return;
      }

      // Cell is safe
      const safeCellsLeft = res.data.safe_cells_left || 0;
      const currentMultiplier = res.data.current_multiplier || 1.0;
      const allRevealed = res.data.all_revealed_cells || res.data.revealed_cells || [];
      
      console.log("Cell is safe. Data:", { safeCellsLeft, currentMultiplier, allRevealed });
      
      setSafeCellsLeft(safeCellsLeft);
      setCurrentMultiplier(currentMultiplier);
      setRevealedCells(allRevealed);

      // Update grid with all revealed cells
      const newGrid = [...grid];
      
      // Initialize grid if empty
      if (!newGrid.length) {
        console.log("Grid is empty, reinitializing");
        const reinitializedGrid = initializeGrid(gridSize);
        setGrid(reinitializedGrid);
        setIsProcessing(false);
        return;
      }
      
      allRevealed.forEach(([r, c]) => {
        if (newGrid[r] && newGrid[r][c] && !newGrid[r][c].revealed) {
          newGrid[r][c].revealed = true;
          newGrid[r][c].isMine = false;
        }
      });
      
      console.log("Setting new grid:", newGrid);
      setGrid(newGrid);
      
      // Play safe reveal sound
      playSafeReveal();
      
      // Check for win
      if (safeCellsLeft === 0) {
        console.log("All safe cells revealed! Auto-cashing out...");
        setGameState("won");
        setTimeout(() => {
          cashOut();
        }, 500);
      }
      
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
    console.log("cashOut called with state:", { gameState, isProcessing });
    
    if ((gameState !== "playing" && gameState !== "won") || isProcessing) {
      console.log("Cannot cash out:", { gameState, isProcessing });
      return;
    }

    playButtonClick();
    
    setIsProcessing(true);
    try {
      const res = await minesweeperService.cashout({
        game_id: gameId,
      });

      console.log("Cashout response:", res.data);
      
      setGameState("cashed_out");
      setLastWin({
        win_amount: res.data.win_amount,
        win_multiplier: res.data.win_multiplier,
      });

      // Reveal all cells on cash out
      const newGrid = grid.map(row => 
        row.map(cell => ({
          ...cell,
          revealed: true
        }))
      );
      
      // Also ensure mines are shown if we haven't hit one yet
      if (minesPositions.length > 0) {
        minesPositions.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c]) {
            newGrid[r][c].isMine = true;
            newGrid[r][c].revealed = true;
          }
        });
      }
      
      setGrid(newGrid);

      // Play cash out sound
      playCashOut();

      if (refreshWallet) {
        await refreshWallet();
      }

      // Show win modal after a short delay
      setTimeout(() => {
        setShowWinModal(true);
        if (res.data.win_amount > 0) {
          playWinCelebration();
        }
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
  const renderCellContent = (cell, row, col) => {
    if (!cell.revealed) return null;
    
    if (cell.isMine) {
      const isClickedMine = clickedMine && 
                           clickedMine[0] === row && 
                           clickedMine[1] === col;
      
      return isClickedMine ? (
        <span className="mine-explosion" style={{ fontSize: '18px' }}>💥</span>
      ) : (
        <span className="mine-icon" style={{ fontSize: '16px' }}>💣</span>
      );
    }
    
    return (
      <span className="safe-icon" style={{ fontSize: '14px' }}>✅</span>
    );
  };

  /* -------------------- HANDLE SETTINGS CHANGES -------------------- */
  const handleGridSizeChange = (size) => {
    setGridSize(size);
    playGridSelect();
    if (minesCount >= size * size) {
      setMinesCount(Math.max(3, size * size - 5));
    }
  };

  const handleMinesCountChange = (count) => {
    setMinesCount(count);
    playMineSelect();
  };

  const handleBetAmountChange = (e) => {
    const value = Math.max(100, Number(e.target.value));
    setBetAmount(value);
  };

  const handleQuickStake = (amount) => {
    setBetAmount(amount);
    playButtonClick();
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="minesweeper-game">
      {/* HEADER */}
      <header className="game-header">
        <button 
          onClick={() => {
            playButtonClick();
            navigate("/");
          }} 
          disabled={isProcessing}
        >
          ← Back
        </button>
        
        <div className="balance-details">
          {walletLoading ? (
            <div className="balance-loading">
              <div className="loading-spinner-small"></div>
              <span>Loading...</span>
            </div>
          ) : (
            <>
              <div className="balance-total">{formatNGN(combinedBalance)}</div>
              <div className="balance-breakdown">
                <span className="balance-main">Main: {formatNGN(wallet?.balance || 0)}</span>
                <span className="balance-spot">Spot: {formatNGN(spotBalance)}</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* STAKE MODAL */}
      {showStakeModal && (
        <div className="stake-modal-overlay">
          <div className="stake-modal animated-slideUp">
            <h3>💣 Minesweeper</h3>
            <p className="game-description">
              {gameInfo ? gameInfo.game_info.description : 
               "Reveal safe cells and avoid mines to win!"}
            </p>

            <div className="balance-summary">
              {walletLoading ? (
                <div className="balance-loading-inline">
                  <div className="loading-spinner-small"></div>
                  Loading balance...
                </div>
              ) : (
                <>
                  <span className="balance-label">Available Balance</span>
                  <div className="balance-amount">{formatNGN(combinedBalance)}</div>
                </>
              )}
            </div>

            <div className="game-settings">
              <div className="setting-group">
                <label>Grid Size</label>
                <div className="option-buttons">
                  {[5, 6, 7, 8].map(size => (
                    <button
                      key={size}
                      className={gridSize === size ? "active" : ""}
                      onClick={() => handleGridSizeChange(size)}
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
                      onClick={() => handleMinesCountChange(count)}
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
                onChange={handleBetAmountChange}
                disabled={walletLoading || isProcessing}
              />
            </div>
            
            <button
              className="start-btn animated-pulse"
              disabled={betAmount > combinedBalance || walletLoading || isProcessing || minesCount >= gridSize * gridSize}
              onClick={startGame}
            >
              {isProcessing ? "STARTING..." : walletLoading ? "LOADING..." : "🚀 START GAME"}
            </button>
          </div>
        </div>
      )}

      {/* GAME BOARD - FIXED VERSION */}
{!showStakeModal && (
  <div className="board-section animated-fadeIn">
    
    {/* DEBUG TEST GRID - FIXED CLICK HANDLER */}
    <div className="grid-container">
      <div className="grid" style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridSize}, 45px)`,
        gap: '4px',
        backgroundColor: 'rgba(0, 0, 30, 0.7)',
        padding: '10px',
        borderRadius: '10px',
        border: '4px solid #ffd700'
      }}>
        {grid.map((row, r) => (
          row.map((cell, c) => {
            const cellKey = `${r}-${c}`;
            const isRevealed = cell.revealed;
            const isMine = cell.isMine;
            
            return (
              <div
                key={cellKey}
                onClick={async () => {
                  console.log(`=== CLICK EVENT START ===`);
                  console.log(`Cell [${r}, ${c}] clicked`);
                  console.log(`Game State: ${gameState}`);
                  console.log(`Is Processing: ${isProcessing}`);
                  console.log(`Cell Revealed: ${isRevealed}`);
                  console.log(`Game ID: ${gameId}`);
                  
                  // Check conditions
                  if (gameState !== "playing") {
                    console.log(`❌ Cannot click: Game state is ${gameState}, needs to be "playing"`);
                    return;
                  }
                  
                  if (isProcessing) {
                    console.log(`❌ Cannot click: Already processing`);
                    return;
                  }
                  
                  if (isRevealed) {
                    console.log(`❌ Cannot click: Cell already revealed`);
                    return;
                  }
                  
                  if (!gameId) {
                    console.log(`❌ Cannot click: No game ID`);
                    alert("No game ID found. Please start a new game.");
                    return;
                  }
                  
                  console.log(`✅ All conditions met, calling revealCell...`);
                  
                  // Call the reveal function
                  try {
                    await revealCell(r, c);
                  } catch (error) {
                    console.error(`❌ Error in revealCell:`, error);
                  }
                  
                  console.log(`=== CLICK EVENT END ===`);
                }}
                style={{
                  width: '45px',
                  height: '45px',
                  backgroundColor: isRevealed 
                    ? (isMine ? '#f56565' : '#48bb78') 
                    : '#2d3748',
                  border: isRevealed 
                    ? (isMine ? '2px solid #c53030' : '2px solid #2f855a') 
                    : '2px solid #4a5568',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: (gameState === "playing" && !isProcessing && !isRevealed) 
                    ? 'pointer' 
                    : 'not-allowed',
                  userSelect: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (gameState === "playing" && !isProcessing && !isRevealed) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 0 10px rgba(255,255,255,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {isRevealed ? (
                  isMine ? (
                    <span style={{ animation: 'pulse 0.5s' }}>💣</span>
                  ) : (
                    <span style={{ animation: 'fadeIn 0.3s' }}>✅</span>
                  )
                ) : (
                  <span style={{ 
                    opacity: 0.3, 
                    fontSize: '10px',
                    color: '#87ceeb'
                  }}>
                    {r},{c}
                  </span>
                )}
                
                {/* Debug overlay - shows if cell is clickable */}
                {!isRevealed && gameState === "playing" && !isProcessing && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 255, 0, 0.1)',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                  }} />
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>

      {/* CASH OUT BUTTON */}
      {gameState === "playing" && (
        <div className="action-buttons">
          <button 
            className="cashout-btn animated-pulse-glow" 
            onClick={() => {
              console.log("💰 Cashout button clicked");
              cashOut();
            }}
            disabled={isProcessing}
          >
            {isProcessing ? "PROCESSING..." : "💰 CASH OUT"}
          </button>
        </div>
      )}
    </div>
    )}

      {/* WIN MODAL */}
      {showWinModal && lastWin && (
        <div className="modal-overlay win-modal-overlay">
          <div className="win-modal-content animated-slideUp">
            <div className="win-modal-header">
              <div className="win-icon animated-pulse">🏆</div>
              <h2>Cashed Out Successfully!</h2>
            </div>
            
            <div className="win-amount-display animated-pulse">
              <span className="win-amount-label">You won</span>
              <span className="win-amount">
                {formatNGN(lastWin.win_amount)}
              </span>
            </div>
            
            <button
              className="continue-button"
              onClick={() => {
                playButtonClick();
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
          <div className="loss-modal-content animated-slideUp">
            <div className="loss-modal-header">
              <div className="loss-icon animated-shake">💥</div>
              <h2>Game Over</h2>
              <p className="loss-subtitle">You hit a mine</p>
            </div>
            
            <button
              className="try-again-button"
              onClick={() => {
                playButtonClick();
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