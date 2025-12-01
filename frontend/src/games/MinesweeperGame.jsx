import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { minesweeperService } from '../services/api';
import './MinesweeperGame.css';

const MinesweeperGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [gridSize, setGridSize] = useState(5);
  const [minesCount, setMinesCount] = useState(5);
  const [currentGame, setCurrentGame] = useState(null);
  const [grid, setGrid] = useState([]);
  const [gameState, setGameState] = useState('idle'); // idle, playing, won, lost, cashed_out
  const [multiplier, setMultiplier] = useState(1.00);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const difficultyLevels = [
    { size: 5, mines: 3, label: 'Easy', color: '#4CAF50' },
    { size: 5, mines: 5, label: 'Medium', color: '#FF9800' },
    { size: 5, mines: 7, label: 'Hard', color: '#F44336' },
    { size: 8, mines: 10, label: 'Expert', color: '#9C27B0' },
  ];

  useEffect(() => {
    loadStats();
    loadHistory();
  }, []);

  const initializeGrid = (size) => {
    return Array(size).fill(null).map(() => 
      Array(size).fill({ revealed: false, isMine: false, adjacentMines: 0 })
    );
  };

  const loadStats = async () => {
    try {
      const response = await minesweeperService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await minesweeperService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleStartGame = async () => {
    try {
      const response = await minesweeperService.start({
        bet_amount: betAmount,
        grid_size: gridSize,
        mines_count: minesCount
      });

      const { game_id, new_balance } = response.data;
      
      setCurrentGame({ id: game_id, gridSize, minesCount });
      setGrid(initializeGrid(gridSize));
      setGameState('playing');
      setMultiplier(1.00);
      onBalanceUpdate({ ...user, balance: new_balance });
      
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.response?.data?.error || 'Error starting minesweeper game');
    }
  };

  const handleRevealCell = async (row, col) => {
    if (gameState !== 'playing') return;
    
    try {
      const response = await minesweeperService.reveal({
        game_id: currentGame.id,
        row: row,
        col: col
      });

      const { hit_mine, revealed_cells, multiplier: newMultiplier, status, win_amount, new_balance, mines_positions } = response.data;
      
      setMultiplier(newMultiplier);
      
      if (hit_mine) {
        // Game over - hit a mine
        setGameState('lost');
        revealAllMines(mines_positions);
      } else {
        // Update grid with revealed cells
        const newGrid = [...grid];
        revealed_cells.forEach(([r, c]) => {
          if (newGrid[r] && newGrid[r][c]) {
            newGrid[r][c] = { ...newGrid[r][c], revealed: true };
          }
        });
        setGrid(newGrid);
        
        if (status === 'won') {
          setGameState('won');
          onBalanceUpdate({ ...user, balance: new_balance });
          loadStats();
          loadHistory();
        }
      }
      
      if (win_amount > 0) {
        onBalanceUpdate({ ...user, balance: new_balance });
        loadStats();
        loadHistory();
      }
      
    } catch (error) {
      console.error('Error revealing cell:', error);
      alert(error.response?.data?.error || 'Error revealing cell');
    }
  };

  const handleCashOut = async () => {
    if (gameState !== 'playing') return;
    
    try {
      const response = await minesweeperService.cashout({
        game_id: currentGame.id
      });

      const { win_amount, new_balance } = response.data;
      
      setGameState('cashed_out');
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      loadHistory();
      
      alert(`Cashed out! You won $${win_amount.toFixed(2)}`);
      
    } catch (error) {
      console.error('Error cashing out:', error);
      alert(error.response?.data?.error || 'Error cashing out');
    }
  };

  const revealAllMines = (minesPositions) => {
    const newGrid = [...grid];
    minesPositions.forEach(([row, col]) => {
      if (newGrid[row] && newGrid[row][col]) {
        newGrid[row][col] = { ...newGrid[row][col], isMine: true, revealed: true };
      }
    });
    setGrid(newGrid);
  };

  const getMultiplierColor = () => {
    if (multiplier < 2) return '#ff4444';
    if (multiplier < 5) return '#ffaa00';
    if (multiplier < 10) return '#aaff00';
    return '#00ff00';
  };

  const getCellContent = (cell, row, col) => {
    if (!cell.revealed) {
      return '❓'; // Hidden cell
    }
    
    if (cell.isMine) {
      return '💣'; // Mine
    }
    
    return '✅'; // Safe cell (in real minesweeper you'd show adjacent mine count)
  };

  const getCellClass = (cell, row, col) => {
    let className = 'minesweeper-cell';
    
    if (cell.revealed) {
      if (cell.isMine) {
        className += ' mine';
      } else {
        className += ' safe';
      }
    } else {
      className += ' hidden';
    }
    
    return className;
  };

  const selectedDifficulty = difficultyLevels.find(d => d.size === gridSize && d.mines === minesCount);

  return (
    <div className="minesweeper-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="minesweeper-container">
        <div className="game-controls">
          <div className="difficulty-selection">
            <h3>Choose Difficulty</h3>
            <div className="difficulty-levels">
              {difficultyLevels.map((level, index) => (
                <div 
                  key={index}
                  className={`difficulty-level ${
                    gridSize === level.size && minesCount === level.mines ? 'active' : ''
                  }`}
                  onClick={() => {
                    setGridSize(level.size);
                    setMinesCount(level.mines);
                  }}
                  style={{ borderColor: level.color }}
                >
                  <div className="level-info">
                    <div className="level-label">{level.label}</div>
                    <div className="level-details">
                      {level.size}x{level.size} grid • {level.mines} mines
                    </div>
                  </div>
                  <div className="level-color" style={{ backgroundColor: level.color }}></div>
                </div>
              ))}
            </div>
          </div>

          <div className="bet-controls">
            <label>Bet Amount:</label>
            <input 
              type="number" 
              value={betAmount} 
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="1"
              max={user.balance}
              disabled={gameState === 'playing'}
            />
            <div className="bet-buttons">
              {[10, 25, 50, 100].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  disabled={gameState === 'playing'}
                  className={betAmount === amount ? 'active' : ''}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {gameState === 'idle' ? (
            <button 
              onClick={handleStartGame} 
              disabled={betAmount > user.balance}
              className="start-button"
              style={{ backgroundColor: selectedDifficulty?.color }}
            >
              🎮 Start Minesweeper
            </button>
          ) : gameState === 'playing' ? (
            <button 
              onClick={handleCashOut}
              className="cashout-button"
            >
              💰 Cash Out {multiplier.toFixed(2)}x
            </button>
          ) : (
            <button 
              onClick={() => {
                setGameState('idle');
                setCurrentGame(null);
                setGrid([]);
              }}
              className="play-again-button"
            >
              🔄 Play Again
            </button>
          )}
        </div>

        <div className="game-display">
          <div className="game-info">
            <div className="multiplier-display" style={{ color: getMultiplierColor() }}>
              {multiplier.toFixed(2)}x
            </div>
            <div className="game-status">
              {gameState === 'idle' && 'Ready to play!'}
              {gameState === 'playing' && 'Find safe cells!'}
              {gameState === 'won' && '🎉 You won!'}
              {gameState === 'lost' && '💥 Game Over!'}
              {gameState === 'cashed_out' && '💰 Cashed Out!'}
            </div>
          </div>

          <div className="minesweeper-grid">
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} className="grid-row">
                {row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={getCellClass(cell, rowIndex, colIndex)}
                    onClick={() => handleRevealCell(rowIndex, colIndex)}
                  >
                    {getCellContent(cell, rowIndex, colIndex)}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {gameState === 'idle' && (
            <div className="game-instructions">
              <h4>How to Play:</h4>
              <ul>
                <li>Click cells to reveal them</li>
                <li>Avoid mines (💣) to increase your multiplier</li>
                <li>Cash out at any time to secure your winnings</li>
                <li>Reveal all safe cells for maximum payout!</li>
              </ul>
            </div>
          )}
        </div>

        <div className="game-info-panels">
          <div className="stats-panel">
            <h3>Minesweeper Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Games:</span>
                  <span>{stats.total_games}</span>
                </div>
                <div className="stat-item">
                  <span>Total Won:</span>
                  <span>${stats.total_won?.toFixed(2)}</span>
                </div>
                <div className="stat-item">
                  <span>Highest Multiplier:</span>
                  <span>{stats.highest_multiplier?.toFixed(2)}x</span>
                </div>
                <div className="stat-item">
                  <span>Player Level:</span>
                  <span>{stats.player_level}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {history.slice(0, 5).map((game, index) => (
                <div key={index} className={`history-item ${game.status}`}>
                  <span className="game-info">
                    {game.grid_size}x{game.grid_size} • {game.mines_count}💣
                  </span>
                  <span className={`status ${game.status}`}>
                    {game.status === 'won' && '🎉'}
                    {game.status === 'lost' && '💥'}
                    {game.status === 'cashed_out' && '💰'}
                  </span>
                  <span className="multiplier">{game.multiplier?.toFixed(2)}x</span>
                  <span className="win-amount">
                    {game.win_amount > 0 ? `+$${game.win_amount.toFixed(2)}` : '$0'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MinesweeperGame;