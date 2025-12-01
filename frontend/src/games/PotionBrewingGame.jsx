import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { potionService } from '../services/api';
import './PotionBrewingGame.css';

const PotionBrewingGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [potionType, setPotionType] = useState('healing');
  const [brewing, setBrewing] = useState(false);
  const [lastBrew, setLastBrew] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const potionTypes = [
    { value: 'healing', label: '❤️ Healing Potion', color: '#FF6B6B', description: 'Restores health and vitality' },
    { value: 'mana', label: '🔮 Mana Potion', color: '#4FC3F7', description: 'Replenishes magical energy' },
    { value: 'strength', label: '💪 Strength Potion', color: '#FFA726', description: 'Enhances physical power' },
    { value: 'luck', label: '🍀 Luck Potion', color: '#66BB6A', description: 'Increases fortune and chance' },
  ];

  const handleBrewPotion = async () => {
    if (brewing) return;
    
    setBrewing(true);
    setLastBrew(null);
    
    try {
      const response = await potionService.brewPotion({ 
        bet_amount: betAmount, 
        potion_type: potionType 
      });
      const { potion_type, ingredients_used, success_level, final_multiplier, win_amount, new_balance } = response.data;
      
      setLastBrew({ potion_type, ingredients_used, success_level, final_multiplier, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      loadHistory();
      
    } catch (error) {
      console.error('Error brewing potion:', error);
      alert(error.response?.data?.error || 'Error brewing potion');
    } finally {
      setBrewing(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await potionService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await potionService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const selectedPotion = potionTypes.find(p => p.value === potionType);

  const getSuccessColor = (level) => {
    switch (level) {
      case 'perfect': return '#4CAF50';
      case 'good': return '#FF9800';
      case 'failed': return '#F44336';
      default: return '#607D8B';
    }
  };

  return (
    <div className="potion-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="potion-container">
        <div className="game-controls">
          <div className="potion-selection">
            <h3>Choose Potion Type</h3>
            <div className="potion-types">
              {potionTypes.map(potion => (
                <div 
                  key={potion.value}
                  className={`potion-type ${potionType === potion.value ? 'active' : ''}`}
                  onClick={() => setPotionType(potion.value)}
                  style={{ borderColor: potion.color }}
                >
                  <div className="potion-icon">{potion.label.split(' ')[0]}</div>
                  <div className="potion-info">
                    <div className="potion-name">{potion.label}</div>
                    <div className="potion-desc">{potion.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bet-controls">
            <label>Brewing Cost:</label>
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

          <button 
            onClick={handleBrewPotion} 
            disabled={brewing || betAmount > user.balance}
            className="brew-button"
            style={{ background: `linear-gradient(45deg, ${selectedPotion.color}, #d4af37)` }}
          >
            {brewing ? '🧪 Brewing...' : `🧪 Brew ${selectedPotion.label}`}
          </button>
        </div>

        <div className="cauldron-area">
          <div className="cauldron" style={{ borderColor: selectedPotion.color }}>
            {brewing ? (
              <div className="brewing-animation">
                <div className="bubbles">🫧</div>
                <div className="cauldron-icon">⚗️</div>
                <p>Brewing in progress...</p>
              </div>
            ) : lastBrew ? (
              <div className="brew-results">
                <h3>Potion Complete!</h3>
                <div 
                  className="success-level"
                  style={{ backgroundColor: getSuccessColor(lastBrew.success_level) }}
                >
                  {lastBrew.success_level.toUpperCase()}
                </div>
                
                <div className="ingredients-used">
                  <h4>Ingredients:</h4>
                  <div className="ingredients-grid">
                    {lastBrew.ingredients_used.map((ingredient, index) => (
                      <div key={index} className="ingredient-item">
                        <div className="ingredient-icon">{ingredient.image}</div>
                        <div className="ingredient-name">{ingredient.name}</div>
                        <div className="ingredient-power">{ingredient.power}x</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="brew-stats">
                  <div className="stat-item">
                    <span>Final Multiplier:</span>
                    <span>{lastBrew.final_multiplier.toFixed(2)}x</span>
                  </div>
                  {lastBrew.win_amount > 0 && (
                    <div className="stat-item">
                      <span>You Earned:</span>
                      <span className="win-amount">${lastBrew.win_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="cauldron-ready">
                <div className="cauldron-icon">⚗️</div>
                <h3>Magic Cauldron</h3>
                <p>Ready to brew {selectedPotion.label.toLowerCase()}</p>
                <div className="selected-potion" style={{ color: selectedPotion.color }}>
                  {selectedPotion.description}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="game-info">
          <div className="stats-panel">
            <h3>Brewing Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Brews:</span>
                  <span>{stats.total_brews || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Perfect Brews:</span>
                  <span>{stats.perfect_brews || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Total Earned:</span>
                  <span>${stats.total_earned?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Brews</h3>
            <div className="history-list">
              {history.slice(0, 5).map((brew, index) => (
                <div key={index} className="history-item">
                  <span className="potion-icon">⚗️</span>
                  <span className="potion-type">{brew.potion_result.potion_type}</span>
                  <span 
                    className="success-level"
                    style={{ color: getSuccessColor(brew.success_level) }}
                  >
                    {brew.success_level}
                  </span>
                  <span className="win-amount">+${brew.win_amount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PotionBrewingGame;