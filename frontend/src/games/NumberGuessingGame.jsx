import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { guessingService } from '../services/api';
import './NumberGuessingGame.css';

const NumberGuessingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [maxNumber, setMaxNumber] = useState(100);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [currentGame, setCurrentGame] = useState(null);
  const [guess, setGuess] = useState('');
  const [gameState, setGameState] = useState('setup'); // setup, playing, won, lost
  const [attempts, setAttempts] = useState([]);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const difficultyLevels = [
    { level: 'easy', maxNumber: 50, maxAttempts: 10, color: '#4CAF50' },
    { level: 'medium', maxNumber: 100, maxAttempts: 10, color: '#FF9800' },
    { level: 'hard', maxNumber: 200, maxAttempts: 8, color: '#F44336' },
    { level: 'expert', maxNumber: 500, maxAttempts: 6, color: '#9C27B0' },
  ];

  useEffect(() => {
    loadStats();
    loadHistory();
  }, []);

  const loadStats = async () => {
    try {
      const response = await guessingService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await guessingService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleStartGame = async () => {
    try {
      const response = await guessingService.startGame({
        bet_amount: betAmount,
        max_number: maxNumber,
        max_attempts: maxAttempts
      });
      
      const { game_id, new_balance } = response.data;
      setCurrentGame({ id: game_id, maxNumber, maxAttempts });
      setGameState('playing');
      setAttempts([]);
      setGuess('');
      onBalanceUpdate({ ...user, balance: new_balance });
      
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.response?.data?.error || 'Error starting game');
    }
  };

  const handleMakeGuess = async () => {
    if (!guess || isNaN(guess)) {
      alert('Please enter a valid number');
      return;
    }

    const guessNum = parseInt(guess);
    if (guessNum < 1 || guessNum > maxNumber) {
      alert(`Please enter a number between 1 and ${maxNumber}`);
      return;
    }

    try {
      const response = await guessingService.makeGuess({
        game_id: currentGame.id,
        guess: guessNum
      });

      const { correct, hint, attempts: attemptCount, status, win_amount, new_balance, multiplier, target_number } = response.data;

      // Add attempt to history
      const newAttempt = {
        guess: guessNum,
        hint: hint,
        correct: correct
      };
      setAttempts(prev => [...prev, newAttempt]);

      if (status === 'won') {
        setGameState('won');
        onBalanceUpdate({ ...user, balance: new_balance });
        loadStats();
        loadHistory();
        
        setTimeout(() => {
          alert(`🎉 Correct! You won $${win_amount.toFixed(2)} with ${multiplier.toFixed(2)}x multiplier!`);
        }, 500);
        
      } else if (status === 'lost') {
        setGameState('lost');
        onBalanceUpdate({ ...user, balance: new_balance });
        loadStats();
        loadHistory();
        
        setTimeout(() => {
          alert(`💀 Game Over! The number was ${target_number}.`);
        }, 500);
        
      } else {
        // Still playing
        setGuess('');
      }

    } catch (error) {
      console.error('Error making guess:', error);
      alert(error.response?.data?.error || 'Error making guess');
    }
  };

  const handleSetDifficulty = (level) => {
    setMaxNumber(level.maxNumber);
    setMaxAttempts(level.maxAttempts);
  };

  const resetGame = () => {
    setGameState('setup');
    setCurrentGame(null);
    setAttempts([]);
    setGuess('');
  };

  const getHintColor = (hint) => {
    return hint === 'higher' ? '#4CAF50' : '#F44336';
  };

  const getRemainingAttempts = () => {
    return currentGame ? currentGame.maxAttempts - attempts.length : 0;
  };

  const selectedDifficulty = difficultyLevels.find(
    level => level.maxNumber === maxNumber && level.maxAttempts === maxAttempts
  ) || difficultyLevels[1];

  return (
    <div className="guessing-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="guessing-container">
        <div className="game-controls">
          <div className="difficulty-selection">
            <h3>Difficulty Level</h3>
            <div className="difficulty-buttons">
              {difficultyLevels.map(level => (
                <button
                  key={level.level}
                  className={`difficulty-btn ${maxNumber === level.maxNumber && maxAttempts === level.maxAttempts ? 'active' : ''}`}
                  onClick={() => handleSetDifficulty(level)}
                  style={{ borderColor: level.color }}
                >
                  <span className="level-name">{level.level.toUpperCase()}</span>
                  <span className="level-details">1-{level.maxNumber}</span>
                  <span className="level-attempts">{level.maxAttempts} attempts</span>
                </button>
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
              disabled={gameState !== 'setup'}
            />
            <div className="bet-buttons">
              {[10, 25, 50, 100].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={betAmount === amount ? 'active' : ''}
                  disabled={gameState !== 'setup'}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {gameState === 'setup' && (
            <button 
              onClick={handleStartGame} 
              disabled={betAmount > user.balance}
              className="start-button"
              style={{ backgroundColor: selectedDifficulty.color }}
            >
              🎯 Start Guessing Game
            </button>
          )}

          {(gameState === 'won' || gameState === 'lost') && (
            <button 
              onClick={resetGame}
              className="play-again-button"
              style={{ backgroundColor: selectedDifficulty.color }}
            >
              🔄 Play Again
            </button>
          )}
        </div>

        <div className="game-area">
          <div className="game-board" style={{ borderColor: selectedDifficulty.color }}>
            {gameState === 'setup' && (
              <div className="setup-screen">
                <div className="target-icon">🎯</div>
                <h2>Number Guessing Game</h2>
                <p>Guess the number between 1 and {maxNumber}</p>
                <p>You have {maxAttempts} attempts to win!</p>
                <div className="difficulty-info" style={{ color: selectedDifficulty.color }}>
                  {selectedDifficulty.level.toUpperCase()} MODE
                </div>
              </div>
            )}

            {gameState === 'playing' && (
              <div className="playing-screen">
                <div className="game-header">
                  <h3>Guess the Number!</h3>
                  <div className="attempts-counter">
                    Attempts: {attempts.length}/{currentGame.maxAttempts}
                  </div>
                </div>

                <div className="guess-input">
                  <input
                    type="number"
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder={`Enter number (1-${maxNumber})`}
                    min="1"
                    max={maxNumber}
                    autoFocus
                  />
                  <button onClick={handleMakeGuess} className="guess-button">
                    Guess
                  </button>
                </div>

                <div className="attempts-history">
                  <h4>Your Guesses:</h4>
                  {attempts.map((attempt, index) => (
                    <div key={index} className="attempt-item">
                      <span className="guess-number">#{index + 1}: {attempt.guess}</span>
                      {!attempt.correct && (
                        <span 
                          className="hint"
                          style={{ color: getHintColor(attempt.hint) }}
                        >
                          {attempt.hint.toUpperCase()}
                        </span>
                      )}
                      {attempt.correct && (
                        <span className="correct">🎉 CORRECT!</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${(attempts.length / currentGame.maxAttempts) * 100}%`,
                      backgroundColor: selectedDifficulty.color 
                    }}
                  ></div>
                </div>
              </div>
            )}

            {(gameState === 'won' || gameState === 'lost') && (
              <div className={`result-screen ${gameState}`}>
                <div className="result-icon">
                  {gameState === 'won' ? '🎉' : '💀'}
                </div>
                <h2>{gameState === 'won' ? 'Congratulations!' : 'Game Over'}</h2>
                <p>
                  {gameState === 'won' 
                    ? `You guessed the number in ${attempts.length} attempts!`
                    : `The number was ${attempts[attempts.length - 1]?.hint === 'higher' ? 'higher' : 'lower'} than your last guess.`
                  }
                </p>
                {gameState === 'won' && attempts.length > 0 && (
                  <div className="win-details">
                    <div className="multiplier">
                      Multiplier: {((1 + ((currentGame.maxAttempts - attempts.length) / currentGame.maxAttempts) * 5)).toFixed(2)}x
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="game-info">
          <div className="stats-panel">
            <h3>Guessing Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Games:</span>
                  <span>{stats.total_games}</span>
                </div>
                <div className="stat-item">
                  <span>Games Won:</span>
                  <span>{stats.games_won}</span>
                </div>
                <div className="stat-item">
                  <span>Win Rate:</span>
                  <span>{stats.win_rate}%</span>
                </div>
                <div className="stat-item">
                  <span>Total Won:</span>
                  <span>${stats.total_won?.toFixed(2)}</span>
                </div>
                <div className="stat-item">
                  <span>Player Rank:</span>
                  <span>{stats.player_rank}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {history.slice(0, 5).map((game, index) => (
                <div key={index} className={`history-item ${game.status}`}>
                  <span className="game-status">{game.status === 'won' ? '✅' : '❌'}</span>
                  <span className="game-attempts">{game.attempts}/{game.max_attempts}</span>
                  <span className="game-bet">${game.bet_amount}</span>
                  <span className="game-win">
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

export default NumberGuessingGame;