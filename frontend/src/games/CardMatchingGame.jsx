import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cardService } from '../services/api';
import './CardMatchingGame.css';

const CardMatchingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [gridSize, setGridSize] = useState(16);
  const [gameState, setGameState] = useState(null);
  const [cards, setCards] = useState([]);
  const [revealedCards, setRevealedCards] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [gameStatus, setGameStatus] = useState('idle'); // idle, playing, completed
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const gridOptions = [
    { size: 12, name: 'Easy (6 pairs)', cols: 4 },
    { size: 16, name: 'Medium (8 pairs)', cols: 4 },
    { size: 20, name: 'Hard (10 pairs)', cols: 5 },
  ];

  const cardSymbols = ['🌟', '🎯', '💎', '⚡', '🔮', '🎨', '🚀', '🌈', '🎭', '🎪', '🎲', '🎳'];

  const initializeGame = async () => {
    try {
      const response = await cardService.startGame({
        bet_amount: betAmount,
        grid_size: gridSize
      });

      const { game_id, grid_size, cards_count } = response.data;
      
      setGameState({
        id: game_id,
        gridSize: grid_size
      });
      
      // Initialize cards array with hidden state
      const initialCards = Array(cards_count).fill(null).map((_, index) => ({
        id: index,
        value: null,
        isRevealed: false,
        isMatched: false
      }));
      
      setCards(initialCards);
      setRevealedCards([]);
      setSelectedCards([]);
      setMatchedPairs(0);
      setMultiplier(1);
      setGameStatus('playing');
      onBalanceUpdate({ ...user, balance: response.data.new_balance });
      
    } catch (error) {
      console.error('Error starting game:', error);
      alert(error.response?.data?.error || 'Error starting card game');
    }
  };

  const handleCardClick = async (cardIndex) => {
    if (gameStatus !== 'playing') return;
    if (selectedCards.length >= 2) return; // Wait for previous pair to resolve
    if (cards[cardIndex].isRevealed || cards[cardIndex].isMatched) return;

    try {
      const response = await cardService.revealCard({
        game_id: gameState.id,
        card_index: cardIndex
      });

      const { card_value, match_found, matches_found, multiplier: newMultiplier, status, win_amount, new_balance } = response.data;

      // Update card state
      const updatedCards = [...cards];
      updatedCards[cardIndex] = {
        ...updatedCards[cardIndex],
        value: card_value,
        isRevealed: true
      };
      setCards(updatedCards);

      const newSelectedCards = [...selectedCards, cardIndex];
      setSelectedCards(newSelectedCards);

      if (match_found === true) {
        // Match found
        setMatchedPairs(matches_found);
        setMultiplier(newMultiplier);
        
        // Mark cards as matched
        setTimeout(() => {
          const matchedCards = [...updatedCards];
          newSelectedCards.forEach(index => {
            matchedCards[index].isMatched = true;
          });
          setCards(matchedCards);
          setSelectedCards([]);
        }, 1000);
      } else if (match_found === false) {
        // No match - hide cards after delay
        setTimeout(() => {
          const resetCards = [...updatedCards];
          newSelectedCards.forEach(index => {
            resetCards[index].isRevealed = false;
            resetCards[index].value = null;
          });
          setCards(resetCards);
          setSelectedCards([]);
        }, 1500);
      }

      if (status === 'completed') {
        setGameStatus('completed');
        setMultiplier(newMultiplier);
        onBalanceUpdate({ ...user, balance: new_balance });
        loadStats();
        loadHistory();
        
        // Show victory message
        setTimeout(() => {
          alert(`🎉 Game Completed! You won $${win_amount.toFixed(2)} with ${newMultiplier.toFixed(2)}x multiplier!`);
        }, 500);
      }

    } catch (error) {
      console.error('Error revealing card:', error);
      alert(error.response?.data?.error || 'Error revealing card');
    }
  };

  const loadStats = async () => {
    try {
      const response = await cardService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await cardService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const getCardSymbol = (value) => {
    return cardSymbols[value - 1] || '❓';
  };

  const getGridColumns = () => {
    const option = gridOptions.find(opt => opt.size === gridSize);
    return option ? option.cols : 4;
  };

  const totalPairs = gridSize / 2;
  const progress = (matchedPairs / totalPairs) * 100;

  return (
    <div className="card-matching-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="card-game-container">
        <div className="game-controls">
          <div className="difficulty-selection">
            <h3>Choose Difficulty</h3>
            <div className="difficulty-options">
              {gridOptions.map(option => (
                <div 
                  key={option.size}
                  className={`difficulty-option ${gridSize === option.size ? 'active' : ''}`}
                  onClick={() => setGridSize(option.size)}
                >
                  <div className="difficulty-name">{option.name}</div>
                  <div className="difficulty-pairs">{option.size / 2} pairs</div>
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
              disabled={gameStatus === 'playing'}
            />
            <div className="bet-buttons">
              {[10, 25, 50, 100].map(amount => (
                <button 
                  key={amount}
                  onClick={() => setBetAmount(amount)}
                  className={betAmount === amount ? 'active' : ''}
                  disabled={gameStatus === 'playing'}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          {gameStatus !== 'playing' ? (
            <button 
              onClick={initializeGame}
              disabled={betAmount > user.balance}
              className="start-button"
            >
              🎴 Start Game
            </button>
          ) : (
            <div className="game-info">
              <div className="multiplier-display">
                Multiplier: {multiplier.toFixed(2)}x
              </div>
              <div className="progress-info">
                Progress: {matchedPairs}/{totalPairs} pairs
              </div>
            </div>
          )}
        </div>

        <div className="game-board">
          {gameStatus === 'idle' ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🎴</div>
              <h2>Card Matching Game</h2>
              <p>Match all pairs to maximize your multiplier!</p>
              <div className="instructions">
                <h4>How to Play:</h4>
                <ul>
                  <li>Click cards to reveal them</li>
                  <li>Find matching pairs</li>
                  <li>Each match increases your multiplier</li>
                  <li>Complete all pairs to win!</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="card-grid" style={{ '--grid-cols': getGridColumns() }}>
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`card ${card.isRevealed ? 'revealed' : ''} ${card.isMatched ? 'matched' : ''} ${selectedCards.includes(index) ? 'selected' : ''}`}
                  onClick={() => handleCardClick(index)}
                >
                  <div className="card-front">?</div>
                  <div className="card-back">
                    {card.isRevealed && getCardSymbol(card.value)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {gameStatus === 'playing' && (
            <div className="game-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {Math.round(progress)}% Complete
              </div>
            </div>
          )}
        </div>

        <div className="game-info-panels">
          <div className="stats-panel">
            <h3>Card Game Stats</h3>
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
                  <span>Success Rate:</span>
                  <span>{stats.success_rate?.toFixed(1)}%</span>
                </div>
                <div className="stat-item">
                  <span>Fastest Time:</span>
                  <span>{stats.fastest_time || 0}s</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Games</h3>
            <div className="history-list">
              {history.slice(0, 5).map((game, index) => (
                <div key={index} className="history-item">
                  <span className="game-result">
                    {game.status === 'completed' ? '✅' : '❌'}
                  </span>
                  <span className="bet-amount">${game.bet_amount}</span>
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

export default CardMatchingGame;