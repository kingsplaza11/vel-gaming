import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pyramidService } from '../services/api';
import './PyramidAdventureGame.css';

const PyramidAdventureGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [exploring, setExploring] = useState(false);
  const [lastExploration, setLastExploration] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const handleExplorePyramid = async () => {
    if (exploring) return;
    
    setExploring(true);
    setLastExploration(null);
    
    try {
      const response = await pyramidService.explorePyramid({ 
        bet_amount: betAmount
      });
      const { chambers_explored, traps_encountered, artifacts_found, survival_multiplier, final_multiplier, win_amount, new_balance } = response.data;
      
      setLastExploration({ chambers_explored, traps_encountered, artifacts_found, survival_multiplier, final_multiplier, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      loadHistory();
      
    } catch (error) {
      console.error('Error exploring pyramid:', error);
      alert(error.response?.data?.error || 'Error exploring pyramid');
    } finally {
      setExploring(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await pyramidService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await pyramidService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const getDangerColor = (danger) => {
    if (danger <= 0.3) return '#4CAF50';
    if (danger <= 0.6) return '#FF9800';
    return '#F44336';
  };

  return (
    <div className="pyramid-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="pyramid-container">
        <div className="game-controls">
          <div className="adventure-info">
            <h3>Ancient Pyramid</h3>
            <div className="info-card">
              <div className="info-item">
                <span>🏜️ Location:</span>
                <span>Sahara Desert</span>
              </div>
              <div className="info-item">
                <span>⚡ Danger Level:</span>
                <span>High</span>
              </div>
              <div className="info-item">
                <span>💎 Potential Reward:</span>
                <span>Massive</span>
              </div>
            </div>
          </div>

          <div className="bet-controls">
            <label>Expedition Fund:</label>
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
            onClick={handleExplorePyramid} 
            disabled={exploring || betAmount * 1.8 > user.balance}
            className="explore-button"
          >
            {exploring ? '🏜️ Exploring...' : '🏜️ Enter Pyramid'}
          </button>
        </div>

        <div className="pyramid-display">
          <div className="pyramid-entrance">
            {exploring ? (
              <div className="exploring-animation">
                <div className="torch">🔥</div>
                <div className="explorer">🧭</div>
                <p>Exploring ancient chambers...</p>
              </div>
            ) : lastExploration ? (
              <div className="exploration-results">
                <h3>Expedition Complete!</h3>
                
                <div className="chambers-explored">
                  <h4>Chambers Explored: {lastExploration.chambers_explored.length}</h4>
                  <div className="chambers-grid">
                    {lastExploration.chambers_explored.map((chamber, index) => (
                      <div 
                        key={index} 
                        className="chamber-item"
                        style={{ borderColor: getDangerColor(chamber.danger) }}
                      >
                        <div className="chamber-icon">{chamber.image}</div>
                        <div className="chamber-name">{chamber.name}</div>
                        <div 
                          className="danger-level"
                          style={{ color: getDangerColor(chamber.danger) }}
                        >
                          Danger: {(chamber.danger * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {lastExploration.traps_encountered > 0 && (
                  <div className="traps-encountered">
                    <div className="traps-count">
                      ⚠️ Traps Triggered: {lastExploration.traps_encountered}
                    </div>
                  </div>
                )}

                {lastExploration.artifacts_found.length > 0 && (
                  <div className="artifacts-found">
                    <h4>Artifacts Discovered:</h4>
                    <div className="artifacts-grid">
                      {lastExploration.artifacts_found.map((artifact, index) => (
                        <div key={index} className="artifact-item">
                          <div className="artifact-icon">{artifact.image}</div>
                          <div className="artifact-name">{artifact.name}</div>
                          <div className="artifact-value">{artifact.value}x</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="expedition-summary">
                  <div className="summary-item">
                    <span>Survival Multiplier:</span>
                    <span>{lastExploration.survival_multiplier.toFixed(2)}x</span>
                  </div>
                  <div className="summary-item">
                    <span>Final Multiplier:</span>
                    <span>{lastExploration.final_multiplier.toFixed(2)}x</span>
                  </div>
                  {lastExploration.win_amount > 0 && (
                    <div className="summary-item">
                      <span>Expedition Reward:</span>
                      <span className="win-amount">${lastExploration.win_amount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="pyramid-ready">
                <div className="pyramid-icon">🏜️</div>
                <h3>Ancient Egyptian Pyramid</h3>
                <p>Dare to explore the mysterious chambers filled with treasures and traps!</p>
                <div className="warning-text">
                  ⚠️ High risk, high reward adventure!
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="game-info">
          <div className="stats-panel">
            <h3>Expedition Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Expeditions:</span>
                  <span>{stats.total_expeditions || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Traps Survived:</span>
                  <span>{stats.traps_survived || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Total Artifacts:</span>
                  <span>{stats.total_artifacts || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Total Earned:</span>
                  <span>${stats.total_earned?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Expeditions</h3>
            <div className="history-list">
              {history.slice(0, 5).map((expedition, index) => (
                <div key={index} className="history-item">
                  <span className="chambers">🏛️{expedition.chambers_explored?.length || 0}</span>
                  <span className="traps">⚠️{expedition.traps_encountered || 0}</span>
                  <span className="artifacts">💎{expedition.artifacts_found?.length || 0}</span>
                  <span className="win-amount">+${expedition.win_amount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PyramidAdventureGame;