import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { towerService } from '../services/api';
import './TowerGame.css';

const TowerGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [targetHeight, setTargetHeight] = useState(10);
  const [currentGame, setCurrentGame] = useState(null);
  const [building, setBuilding] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [stats, setStats] = useState(null);

  const heightOptions = [5, 10, 15, 20, 25];

  const handleStartTower = async () => {
    if (currentGame) return;
    
    try {
      const response = await towerService.startTower({ 
        bet_amount: betAmount, 
        target_height: targetHeight 
      });
      const { game_id, target_height, new_balance } = response.data;
      
      setCurrentGame({
        id: game_id,
        currentHeight: 0,
        targetHeight: target_height,
        multiplier: 1.0,
        status: 'building'
      });
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      
    } catch (error) {
      console.error('Error starting tower:', error);
      alert(error.response?.data?.error || 'Error starting tower game');
    }
  };

  const handleBuildLevel = async () => {
    if (!currentGame || building || currentGame.status !== 'building') return;
    
    setBuilding(true);
    
    try {
      const response = await towerService.buildLevel({ 
        game_id: currentGame.id 
      });
      const { success, current_height, multiplier, status, win_amount, new_balance, crash_chance } = response.data;
      
      if (success) {
        if (status === 'completed') {
          setCurrentGame(prev => ({
            ...prev,
            currentHeight: current_height,
            multiplier: multiplier,
            status: 'completed'
          }));
          onBalanceUpdate({ ...user, balance: new_balance });
          alert(`🏆 Tower Completed! You won $${win_amount.toFixed(2)}!`);
          setCurrentGame(null);
        } else if (status === 'crashed') {
          setCurrentGame(prev => ({
            ...prev,
            status: 'crashed'
          }));
          setTimeout(() => {
            alert('💥 Tower Crashed! Better luck next time.');
            setCurrentGame(null);
          }, 500);
        } else {
          setCurrentGame(prev => ({
            ...prev,
            currentHeight: current_height,
            multiplier: multiplier,
            crashChance: crash_chance
          }));
        }
      }
      
    } catch (error) {
      console.error('Error building level:', error);
      alert(error.response?.data?.error || 'Error building tower level');
    } finally {
      setBuilding(false);
    }
  };

  const handleCashOut = async () => {
    if (!currentGame || currentGame.status !== 'building') return;
    
    try {
      const response = await towerService.cashOut({ 
        game_id: currentGame.id 
      });
      const { win_amount, multiplier, height_reached, new_balance } = response.data;
      
      onBalanceUpdate({ ...user, balance: new_balance });
      setCurrentGame(null);
      alert(`💰 Cashed Out! Reached level ${height_reached} with ${multiplier.toFixed(2)}x multiplier and won $${win_amount.toFixed(2)}!`);
      loadStats();
      
    } catch (error) {
      console.error('Error cashing out:', error);
      alert(error.response?.data?.error || 'Error cashing out');
    }
  };

  const loadStats = async () => {
    try {
      const response = await towerService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await towerService.getHistory();
      setGameHistory(response.data.history || []);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  useEffect(() => {
    loadStats();
    loadHistory();
  }, []);

  const renderTower = () => {
    if (!currentGame) return null;

    const levels = [];
    for (let i = currentGame.targetHeight; i >= 1; i--) {
      const isBuilt = i <= currentGame.currentHeight;
      const isCurrent = i === currentGame.currentHeight + 1;
      const isTarget = i === currentGame.targetHeight;
      
      levels.push(
        <div 
          key={i}
          className={`tower-level ${isBuilt ? 'built' : ''} ${isCurrent ? 'current' : ''} ${isTarget ? 'target' : ''}`}
        >
          <div className="level-number">Level {i}</div>
          {isBuilt && <div className="level-multiplier">{(1 + (i * 0.2)).toFixed(1)}x</div>}
          {isTarget && <div className="target-flag">🎯</div>}
        </div>
      );
    }

    return (
      <div className="tower-container">
        <div className="tower">{levels}</div>
      </div>
    );
  };

  const getCrashChance = (height) => {
    return Math.min(10 + (height * 5), 80);
  };

  return (
    <div className="tower-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="tower-container-main">
        <div className="game-controls">
          <div className="game-info">
            <h3>🏗️ Tower Builder</h3>
            <p>Build your tower as high as you can! Each level increases your multiplier but also the crash risk.</p>
          </div>

          {!currentGame ? (
            <>
              <div className="bet-controls">
                <label>Construction Fund:</label>
                <input 
                  type="number" 
                  value={betAmount} 
                  onChange={(e) => setBetAmount(Number(e.target.value))}
                  min="1"
                  max={user.balance}
                />
                <div className="bet-buttons">
                  {[10, 25, 50, 100].map(amount => (
                    <button 
                      key={amount}
                      onClick={() => setBetAmount(amount)}
                      className={betAmount === amount ? 'active' : ''}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>

              <div className="height-selection">
                <label>Target Height:</label>
                <div className="height-options">
                  {heightOptions.map(height => (
                    <button
                      key={height}
                      className={`height-btn ${targetHeight === height ? 'active' : ''}`}
                      onClick={() => setTargetHeight(height)}
                    >
                      {height} Levels
                      <span className="height-multiplier">{1 + (height * 0.2)}x</span>
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleStartTower} 
                disabled={betAmount > user.balance}
                className="start-button"
              >
                🏗️ Start Building
              </button>
            </>
          ) : (
            <div className="building-controls">
              <div className="current-stats">
                <div className="stat">
                  <span>Current Level:</span>
                  <span>{currentGame.currentHeight}</span>
                </div>
                <div className="stat">
                  <span>Multiplier:</span>
                  <span>{currentGame.multiplier.toFixed(2)}x</span>
                </div>
                <div className="stat">
                  <span>Crash Chance:</span>
                  <span>{currentGame.crashChance || getCrashChance(currentGame.currentHeight)}%</span>
                </div>
                <div className="stat">
                  <span>Potential Win:</span>
                  <span>${(betAmount * currentGame.multiplier).toFixed(2)}</span>
                </div>
              </div>

              <div className="action-buttons">
                <button 
                  onClick={handleBuildLevel} 
                  disabled={building || currentGame.status !== 'building'}
                  className="build-button"
                >
                  {building ? '🏗️ Building...' : '⬆️ Build Next Level'}
                </button>
                
                <button 
                  onClick={handleCashOut}
                  disabled={currentGame.status !== 'building' || currentGame.currentHeight === 0}
                  className="cashout-button"
                >
                  💰 Cash Out
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="tower-display">
          {currentGame ? (
            <div className="active-tower">
              <div className="tower-header">
                <h3>Tower Progress</h3>
                <div className="progress-info">
                  <span>Level {currentGame.currentHeight} / {currentGame.targetHeight}</span>
                  <span>{((currentGame.currentHeight / currentGame.targetHeight) * 100).toFixed(0)}% Complete</span>
                </div>
              </div>
              {renderTower()}
            </div>
          ) : (
            <div className="tower-preview">
              <div className="preview-tower">
                {heightOptions.map(height => (
                  <div 
                    key={height}
                    className={`preview-level ${targetHeight === height ? 'active' : ''}`}
                    onClick={() => setTargetHeight(height)}
                  >
                    <span>Level {height}</span>
                    <span>{(1 + (height * 0.2)).toFixed(1)}x</span>
                  </div>
                ))}
              </div>
              <div className="preview-info">
                <h3>How to Play</h3>
                <ul>
                  <li>🎯 Choose a target height and bet amount</li>
                  <li>🏗️ Build levels one by one</li>
                  <li>📈 Each level increases your multiplier</li>
                  <li>⚡ Crash chance increases with height</li>
                  <li>💰 Cash out anytime to secure your winnings</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="game-info">
          <div className="stats-panel">
            <h3>Tower Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Games:</span>
                  <span>{stats.total_games || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Total Won:</span>
                  <span>${stats.total_won?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="stat-item">
                  <span>Highest Tower:</span>
                  <span>{stats.highest_tower || 0} levels</span>
                </div>
                <div className="stat-item">
                  <span>Success Rate:</span>
                  <span>
                    {stats.total_games ? 
                      `${((stats.total_won / (stats.total_games * betAmount)) * 100).toFixed(1)}%` : 
                      '0%'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {gameHistory.slice(0, 5).map((game, index) => (
                <div key={index} className={`history-item ${game.status}`}>
                  <span className="height">🏗️{game.current_height}L</span>
                  <span className="multiplier">{game.multiplier?.toFixed(1)}x</span>
                  <span className={`status ${game.status}`}>
                    {game.status === 'completed' ? '🎯' : 
                     game.status === 'cashed_out' ? '💰' : '💥'}
                  </span>
                  <span className="win-amount">
                    {game.win_amount > 0 ? `+$${game.win_amount?.toFixed(2)}` : '$0'}
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

export default TowerGame;