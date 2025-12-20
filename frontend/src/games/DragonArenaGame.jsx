import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dragonService } from '../services/api';
import './DragonArenaGame.css';

const DragonArenaGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [element, setElement] = useState('fire');
  const [battling, setBattling] = useState(false);
  const [lastBattle, setLastBattle] = useState(null);

  const elements = [
    { value: 'fire', label: '🔥 Fire', color: '#FF4444' },
    { value: 'water', label: '💧 Water', color: '#4444FF' },
    { value: 'earth', label: '🌍 Earth', color: '#44AA44' },
    { value: 'air', label: '💨 Air', color: '#AAAAAA' },
  ];

  const handleStartBattle = async () => {
    if (battling) return;
    
    setBattling(true);
    
    try {
      const response = await dragonService.startBattle({ 
        bet_amount: betAmount, 
        element: element 
      });
      const { outcome, opponent_dragon, battle_details, win_amount, new_balance } = response.data;
      
      setLastBattle({ outcome, opponent_dragon, battle_details, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      
    } catch (error) {
      console.error('Error in dragon battle:', error);
      alert(error.response?.data?.error || 'Error starting battle');
    } finally {
      setBattling(false);
    }
  };

  return (
    <div className="dragon-arena-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="dragon-container">
        <div className="element-selection">
          <label>Choose Your Element:</label>
          <div className="element-buttons">
            {elements.map(elem => (
              <button
                key={elem.value}
                className={`element-btn ${element === elem.value ? 'active' : ''}`}
                onClick={() => setElement(elem.value)}
                style={{ borderColor: elem.color }}
              >
                {elem.label}
              </button>
            ))}
          </div>
        </div>

        <div className="arena">
          {battling ? (
            <div className="battle-in-progress">⚔️ Battling...</div>
          ) : (
            <div className="arena-display">🐉 Ready for Battle</div>
          )}
          
          {lastBattle && (
            <div className={`battle-result ${lastBattle.outcome}`}>
              <h3>{lastBattle.outcome === 'victory' ? 'Victory!' : 'Defeat!'}</h3>
              <div className="opponent-dragon">
                <span className="dragon-icon">{lastBattle.opponent_dragon.image}</span>
                <span>{lastBattle.opponent_dragon.name}</span>
              </div>
              <p>Power: You {lastBattle.battle_details.user_power} vs {lastBattle.battle_details.opponent_power}</p>
              {lastBattle.battle_details.critical && <p className="critical">Critical Hit!</p>}
              {lastBattle.battle_details.element_advantage && <p className="advantage">Element Advantage!</p>}
              {lastBattle.win_amount > 0 && <p>You won: ${lastBattle.win_amount.toFixed(2)}</p>}
            </div>
          )}
        </div>

        <div className="battle-controls">
          <div className="bet-controls">
            <label>Battle Cost:</label>
            <input 
              type="number" 
              value={betAmount} 
              onChange={(e) => setBetAmount(Number(e.target.value))}
              min="1"
              max={user.balance}
            />
          </div>

          <button 
            onClick={handleStartBattle} 
            disabled={battling || betAmount > user.balance}
            className="battle-button"
          >
            {battling ? 'Battling...' : '⚔️ Start Battle'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DragonArenaGame;