import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colorSwitchService } from '../services/api';
import './ColorSwitchGame.css';

const ColorSwitchGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [gameState, setGameState] = useState('idle'); // idle, showing, playing, won, lost, cashing
  const [currentGame, setCurrentGame] = useState(null);
  const [sequence, setSequence] = useState([]);
  const [playerSequence, setPlayerSequence] = useState([]);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [sequenceLength, setSequenceLength] = useState(5);
  const [showSequence, setShowSequence] = useState(false);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const colors = {
    red: { name: 'Red', class: 'color-red', emoji: '🔴' },
    blue: { name: 'Blue', class: 'color-blue', emoji: '🔵' },
    green: { name: 'Green', class: 'color-green', emoji: '🟢' },
    yellow: { name: 'Yellow', class: 'color-yellow', emoji: '🟡' },
    purple: { name: 'Purple', class: 'color-purple', emoji: '🟣' },
    orange: { name: 'Orange', class: 'color-orange', emoji: '🟠' }
  };

  useEffect(() => {
    loadStats();
    loadHistory();
  }, []);

  const loadStats = async () => {
    try {
      const response = await colorSwitchService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await colorSwitchService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const startGame = async () => {
    try {
      const response = await colorSwitchService.startGame({
        bet_amount: betAmount,
        sequence_length: sequenceLength
      });
      
      const { game_id, sequence: newSequence, new_balance } = response.data;
      
      setCurrentGame(game_id);
      setSequence(newSequence);
      setPlayerSequence([]);
      setCurrentMultiplier(1);
      setGameState('showing');
      onBalanceUpdate({ ...user, balance: new_balance });
      
      // Show sequence to player
      setShowSequence(true);
      setTimeout(() => {
        setShowSequence(false);
        setGameState('playing');
      }, sequenceLength * 1000 + 1000); // Show sequence for 1 second per color + buffer
      
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.response?.data?.error || 'Error starting game');
    }
  };

  const handleColorClick = (color) => {
    if (gameState !== 'playing') return;
    
    const newPlayerSequence = [...playerSequence, color];
    setPlayerSequence(newPlayerSequence);
    
    // Check if sequence is complete
    if (newPlayerSequence.length === sequence.length) {
      submitSequence(newPlayerSequence);
    }
  };

  const submitSequence = async (playerSeq) => {
    try {
      const response = await colorSwitchService.submitSequence({
        game_id: currentGame,
        player_sequence: playerSeq
      });
      
      const { correct, new_sequence_length, multiplier, next_sequence, status } = response.data;
      
      if (correct) {
        // Correct sequence - continue to next round
        setSequenceLength(new_sequence_length);
        setCurrentMultiplier(multiplier);
        setSequence(next_sequence);
        setPlayerSequence([]);
        setGameState('showing');
        
        // Show new sequence
        setShowSequence(true);
        setTimeout(() => {
          setShowSequence(false);
          setGameState('playing');
        }, new_sequence_length * 1000 + 1000);
        
      } else {
        // Wrong sequence - game over
        setGameState('lost');
        loadStats();
        loadHistory();
      }
      
    } catch (error) {
      console.error('Error submitting sequence:', error);
      alert(error.response?.data?.error || 'Error submitting sequence');
    }
  };

  const cashOut = async () => {
    try {
      const response = await colorSwitchService.cashOut({
        game_id: currentGame
      });
      
      const { win_amount, multiplier, sequence_length_reached, new_balance } = response.data;
      
      setGameState('cashed');
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      loadHistory();
      
      alert(`🎉 Cashed out at ${multiplier}x! Won $${win_amount.toFixed(2)}`);
      
    } catch (error) {
      console.error('Error cashing out:', error);
      alert(error.response?.data?.error || 'Error cashing out');
    }
  };

  const resetGame = () => {
    setGameState('idle');
    setCurrentGame(null);
    setSequence([]);
    setPlayerSequence([]);
    setCurrentMultiplier(1);
    setSequenceLength(5);
    setShowSequence(false);
  };

  const getMultiplierColor = () => {
    if (currentMultiplier < 2) return '#FF4444';
    if (currentMultiplier < 4) return '#FF9800';
    if (currentMultiplier < 6) return '#4CAF50';
    return '#2196F3';
  };

  return (
    <div className="color-switch-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="color-switch-container">
        <div className="game-controls">
          <div className="bet-controls">
            <label>Bet Amount:</label>
            <input 
              type="number" 
              value={betAmount} 
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="1"
              max={user.balance}
              disabled={gameState !== 'idle'}
            />
            <div className="bet-buttons">
              {[10, 25, 50, 100].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={betAmount === amount ? 'active' : ''}
                  disabled={gameState !== 'idle'}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {gameState === 'idle' && (
            <button 
              onClick={startGame}
              disabled={betAmount > user.balance}
              className="start-button"
            >
              🎮 Start Game
            </button>
          )}

          {gameState === 'playing' && (
            <div className="game-info">
              <div className="sequence-info">
                <div>Sequence Length: {sequenceLength}</div>
                <div>Your Progress: {playerSequence.length}/{sequenceLength}</div>
              </div>
            </div>
          )}

          {(gameState === 'showing' || gameState === 'playing') && (
            <button 
              onClick={cashOut}
              className="cashout-button"
              style={{ backgroundColor: getMultiplierColor() }}
            >
              💰 Cash Out {currentMultiplier.toFixed(2)}x
            </button>
          )}

          {(gameState === 'lost' || gameState === 'cashed') && (
            <button 
              onClick={resetGame}
              className="restart-button"
            >
              🔄 Play Again
            </button>
          )}
        </div>

        <div className="game-area">
          <div className="multiplier-display" style={{ color: getMultiplierColor() }}>
            {currentMultiplier.toFixed(2)}x
          </div>

          <div className="sequence-display">
            {showSequence ? (
              <div className="sequence-showing">
                <h3>Memorize the Sequence!</h3>
                <div className="sequence-colors">
                  {sequence.map((color, index) => (
                    <div
                      key={index}
                      className={`sequence-color ${colors[color].class} active`}
                    >
                      {colors[color].emoji}
                    </div>
                  ))}
                </div>
              </div>
            ) : gameState === 'playing' ? (
              <div className="sequence-input">
                <h3>Repeat the Sequence!</h3>
                <div className="player-progress">
                  {sequence.map((_, index) => (
                    <div
                      key={index}
                      className={`progress-dot ${index < playerSequence.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>
                <div className="color-grid">
                  {Object.entries(colors).map(([colorKey, color]) => (
                    <button
                      key={colorKey}
                      className={`color-button ${color.class}`}
                      onClick={() => handleColorClick(colorKey)}
                      disabled={gameState !== 'playing'}
                    >
                      {color.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : gameState === 'lost' ? (
              <div className="game-over">
                <h2>💀 Game Over!</h2>
                <p>You reached sequence length {sequenceLength}</p>
                <p>Multiplier: {currentMultiplier.toFixed(2)}x</p>
              </div>
            ) : gameState === 'cashed' ? (
              <div className="cashout-success">
                <h2>💰 Success!</h2>
                <p>You cashed out at {currentMultiplier.toFixed(2)}x</p>
              </div>
            ) : (
              <div className="game-ready">
                <h3>Color Switch Game</h3>
                <p>Memorize the color sequence and repeat it correctly!</p>
                <p>Each correct sequence increases your multiplier</p>
                <div className="ready-icon">🎨</div>
              </div>
            )}
          </div>
        </div>

        <div className="game-info-panels">
          <div className="stats-panel">
            <h3>Memory Stats</h3>
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
                  <span>Longest Sequence:</span>
                  <span>{stats.longest_sequence}</span>
                </div>
                <div className="stat-item">
                  <span>Skill Level:</span>
                  <span>{stats.skill_level}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {history.slice(0, 5).map((game, index) => (
                <div key={index} className="history-item">
                  <span className="sequence-length">🔢{game.sequence_length}</span>
                  <span className="multiplier">🎯{game.multiplier?.toFixed(1)}x</span>
                  <span className={`status ${game.status}`}>
                    {game.status === 'cashed_out' ? '💰' : '💀'}
                  </span>
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

export default ColorSwitchGame;