import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clickerService } from '../services/api';
import './ClickerGame.css';

const ClickerGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [targetClicks, setTargetClicks] = useState(30);
  const [timeLimit, setTimeLimit] = useState(10);
  const [gameActive, setGameActive] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);
  const [clicks, setClicks] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [multiplier, setMultiplier] = useState(1.0);
  const [cps, setCps] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const clickAreaRef = useRef(null);

  const difficultyLevels = [
    { level: 'Easy', target: 20, time: 15, multiplier: 1.5, color: '#4CAF50' },
    { level: 'Medium', target: 30, time: 10, multiplier: 2.0, color: '#FF9800' },
    { level: 'Hard', target: 50, time: 8, multiplier: 3.0, color: '#F44336' },
    { level: 'Expert', target: 80, time: 10, multiplier: 5.0, color: '#9C27B0' },
  ];

  useEffect(() => {
    loadStats();
    loadHistory();
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const loadStats = async () => {
    try {
      const response = await clickerService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await clickerService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const startGame = async () => {
    if (gameActive) return;

    try {
      const response = await clickerService.startGame({
        bet_amount: betAmount,
        target_clicks: targetClicks,
        time_limit: timeLimit
      });

      const { game_id, start_time, new_balance } = response.data;
      
      setCurrentGame({ id: game_id, startTime: start_time });
      setGameActive(true);
      setClicks(0);
      setMultiplier(1.0);
      setCps(0);
      setGameResult(null);
      setTimeRemaining(timeLimit);
      startTimeRef.current = start_time;
      
      onBalanceUpdate({ ...user, balance: new_balance });

      // Start timer
      timerRef.current = setInterval(updateTimer, 100);

    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.response?.data?.error || 'Error starting clicker game');
    }
  };

  const updateTimer = () => {
    if (!startTimeRef.current) return;

    const currentTime = Date.now() / 1000;
    const elapsed = currentTime - startTimeRef.current;
    const remaining = timeLimit - elapsed;

    if (remaining <= 0) {
      endGame('timeout');
      return;
    }

    setTimeRemaining(Math.max(0, remaining));
  };

  const handleClick = async () => {
    if (!gameActive || !currentGame) return;

    try {
      const currentTime = Date.now() / 1000;
      const response = await clickerService.registerClick({
        game_id: currentGame.id,
        current_time: currentTime,
        start_time: startTimeRef.current
      });

      const { clicks: newClicks, cps: newCps, multiplier: newMultiplier, status, win_amount, new_balance } = response.data;

      setClicks(newClicks);
      setCps(newCps);
      setMultiplier(newMultiplier);

      if (status === 'won') {
        endGame('won', { win_amount, new_balance });
      } else if (status === 'lost') {
        endGame('lost');
      }

      if (new_balance) {
        onBalanceUpdate({ ...user, balance: new_balance });
      }

    } catch (error) {
      console.error('Error registering click:', error);
    }
  };

  const endGame = (result, data = null) => {
    setGameActive(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (result === 'won') {
      setGameResult({
        type: 'won',
        message: '🎉 Congratulations! You Won!',
        winAmount: data.win_amount,
        clicks: clicks,
        cps: cps,
        multiplier: multiplier
      });
    } else if (result === 'lost') {
      setGameResult({
        type: 'lost',
        message: '💀 Time\'s Up! Try Again!',
        clicks: clicks,
        target: targetClicks
      });
    }

    loadStats();
    loadHistory();
  };

  const selectDifficulty = (level) => {
    setTargetClicks(level.target);
    setTimeLimit(level.time);
  };

  const resetGame = () => {
    setGameActive(false);
    setGameResult(null);
    setClicks(0);
    setTimeRemaining(0);
    setMultiplier(1.0);
    setCps(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const getProgressPercentage = () => {
    return Math.min((clicks / targetClicks) * 100, 100);
  };

  const getTimeRemainingColor = () => {
    if (timeRemaining > timeLimit * 0.6) return '#4CAF50';
    if (timeRemaining > timeLimit * 0.3) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className="clicker-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="clicker-container">
        <div className="game-controls">
          <div className="difficulty-selection">
            <h3>Select Difficulty</h3>
            <div className="difficulty-levels">
              {difficultyLevels.map((level, index) => (
                <div
                  key={index}
                  className={`difficulty-level ${
                    targetClicks === level.target && timeLimit === level.time ? 'active' : ''
                  }`}
                  onClick={() => selectDifficulty(level)}
                  style={{ borderColor: level.color }}
                >
                  <div className="level-name" style={{ color: level.color }}>
                    {level.level}
                  </div>
                  <div className="level-details">
                    <span>Target: {level.target} clicks</span>
                    <span>Time: {level.time}s</span>
                    <span>Multiplier: up to {level.multiplier}x</span>
                  </div>
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
              disabled={gameActive}
            />
            <div className="bet-buttons">
              {[10, 25, 50, 100].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  disabled={gameActive}
                  className={betAmount === amount ? 'active' : ''}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          <div className="game-info">
            <div className="info-item">
              <span>Target:</span>
              <span>{targetClicks} clicks</span>
            </div>
            <div className="info-item">
              <span>Time Limit:</span>
              <span>{timeLimit} seconds</span>
            </div>
            <div className="info-item">
              <span>Potential Win:</span>
              <span>${(betAmount * 5).toFixed(2)}</span>
            </div>
          </div>

          {!gameActive ? (
            <button 
              onClick={startGame}
              disabled={betAmount > user.balance}
              className="start-button"
            >
              🎯 Start Clicking
            </button>
          ) : (
            <button onClick={resetGame} className="reset-button">
              🔄 Reset Game
            </button>
          )}
        </div>

        <div className="game-area">
          <div className="clicker-interface">
            {gameActive ? (
              <>
                <div className="game-stats">
                  <div className="stat">
                    <span className="stat-label">Clicks:</span>
                    <span className="stat-value">{clicks}/{targetClicks}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Time:</span>
                    <span 
                      className="stat-value time-remaining"
                      style={{ color: getTimeRemainingColor() }}
                    >
                      {timeRemaining.toFixed(1)}s
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">CPS:</span>
                    <span className="stat-value">{cps.toFixed(1)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Multiplier:</span>
                    <span className="stat-value multiplier">{multiplier.toFixed(2)}x</span>
                  </div>
                </div>

                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>

                <div 
                  ref={clickAreaRef}
                  className="click-area"
                  onClick={handleClick}
                >
                  <div className="click-instruction">CLICK FAST!</div>
                  <div className="click-counter">{clicks}</div>
                  <div className="click-hint">Click anywhere in this area</div>
                </div>
              </>
            ) : gameResult ? (
              <div className={`game-result ${gameResult.type}`}>
                <div className="result-icon">
                  {gameResult.type === 'won' ? '🎉' : '💀'}
                </div>
                <h2 className="result-message">{gameResult.message}</h2>
                
                {gameResult.type === 'won' && (
                  <div className="win-details">
                    <div className="win-amount">+${gameResult.winAmount.toFixed(2)}</div>
                    <div className="performance-stats">
                      <div>Final CPS: {gameResult.cps.toFixed(1)}</div>
                      <div>Multiplier: {gameResult.multiplier.toFixed(2)}x</div>
                      <div>Total Clicks: {gameResult.clicks}</div>
                    </div>
                  </div>
                )}

                {gameResult.type === 'lost' && (
                  <div className="loss-details">
                    <div>You got {gameResult.clicks} out of {gameResult.target} clicks</div>
                    <div>Better luck next time!</div>
                  </div>
                )}

                <button onClick={resetGame} className="play-again-button">
                  Play Again
                </button>
              </div>
            ) : (
              <div className="game-ready">
                <div className="ready-icon">🎯</div>
                <h2>Speed Clicker Challenge</h2>
                <p>Click as fast as you can to reach the target before time runs out!</p>
                <div className="ready-stats">
                  <div>Target: {targetClicks} clicks</div>
                  <div>Time: {timeLimit} seconds</div>
                  <div>Bet: ${betAmount}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="game-info-panels">
          <div className="stats-panel">
            <h3>Clicker Stats</h3>
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
                  <span>Highest CPS:</span>
                  <span>{stats.highest_cps?.toFixed(1) || '0.0'}</span>
                </div>
                <div className="stat-item">
                  <span>Win Rate:</span>
                  <span>
                    {stats.win_rate ? `${(stats.win_rate * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {history.slice(0, 5).map((game, index) => (
                <div key={index} className={`history-item ${game.status}`}>
                  <span className="game-result">{game.status === 'won' ? '✅' : '❌'}</span>
                  <span className="clicks">{game.clicks_achieved}/{game.target_clicks}</span>
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

export default ClickerGame;