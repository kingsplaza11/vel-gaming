import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { heistService } from '../services/api';
import './CyberHeistGame.css';

const CyberHeistGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [targetBank, setTargetBank] = useState('Quantum Bank');
  const [heisting, setHeisting] = useState(false);
  const [lastHeist, setLastHeist] = useState(null);
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);

  const banks = [
    { 
      name: 'Quantum Bank', 
      security: 3, 
      base_multiplier: 3.0, 
      image: '🔒',
      color: '#2196F3',
      description: 'Basic security systems'
    },
    { 
      name: 'Neo Financial', 
      security: 5, 
      base_multiplier: 5.0, 
      image: '💳',
      color: '#9C27B0',
      description: 'Advanced encryption'
    },
    { 
      name: 'Cyber Trust', 
      security: 7, 
      base_multiplier: 8.0, 
      image: '🖥️',
      color: '#FF9800',
      description: 'Military-grade security'
    },
    { 
      name: 'Digital Vault', 
      security: 9, 
      base_multiplier: 12.0, 
      image: '🏦',
      color: '#F44336',
      description: 'Quantum resistance'
    },
  ];

  const hacks = [
    { name: 'Phishing Attack', success_rate: 0.7, image: '🎣' },
    { name: 'Brute Force', success_rate: 0.5, image: '🔨' },
    { name: 'SQL Injection', success_rate: 0.6, image: '💉' },
    { name: 'Zero Day Exploit', success_rate: 0.9, image: '🕵️' },
    { name: 'Social Engineering', success_rate: 0.8, image: '👥' },
  ];

  const handleStartHeist = async () => {
    if (heisting) return;
    
    setHeisting(true);
    setLastHeist(null);
    
    try {
      const response = await heistService.startHeist({ 
        bet_amount: betAmount, 
        target_bank: targetBank
      });
      const { target_bank, hacks_used, escape_success, final_multiplier, win_amount, new_balance } = response.data;
      
      setLastHeist({ target_bank, hacks_used, escape_success, final_multiplier, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      loadStats();
      loadHistory();
      
    } catch (error) {
      console.error('Error in cyber heist:', error);
      alert(error.response?.data?.error || 'Error starting heist');
    } finally {
      setHeisting(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await heistService.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await heistService.getHistory();
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const selectedBank = banks.find(b => b.name === targetBank);

  return (
    <div className="heist-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="heist-container">
        <div className="game-controls">
          <div className="bank-selection">
            <h3>Choose Target</h3>
            <div className="bank-options">
              {banks.map(bank => (
                <div 
                  key={bank.name}
                  className={`bank-option ${targetBank === bank.name ? 'active' : ''}`}
                  onClick={() => setTargetBank(bank.name)}
                  style={{ borderColor: bank.color }}
                >
                  <div className="bank-icon">{bank.image}</div>
                  <div className="bank-info">
                    <div className="bank-name">{bank.name}</div>
                    <div className="bank-security">Security: {bank.security}/10</div>
                    <div className="bank-multiplier">{bank.base_multiplier}x Base</div>
                    <div className="bank-desc">{bank.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bet-controls">
            <label>Heist Investment:</label>
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
            onClick={handleStartHeist} 
            disabled={heisting || betAmount * (selectedBank.security / 2) > user.balance}
            className="heist-button"
            style={{ background: `linear-gradient(45deg, ${selectedBank.color}, #26C6DA)` }}
          >
            {heisting ? '💻 Hacking...' : `💻 Hack ${selectedBank.name}`}
          </button>
        </div>

        <div className="heist-display">
          <div className="terminal" style={{ borderColor: selectedBank.color }}>
            {heisting ? (
              <div className="hacking-animation">
                <div className="hacker">👨‍💻</div>
                <div className="code-lines">
                  <div className="code-line">$ sudo hack --target {selectedBank.name}</div>
                  <div className="code-line"> Bypassing security protocols...</div>
                  <div className="code-line"> Accessing mainframe...</div>
                </div>
                <p>Cyber heist in progress...</p>
              </div>
            ) : lastHeist ? (
              <div className={`heist-results ${lastHeist.escape_success ? 'success' : 'failure'}`}>
                <div className="result-header">
                  <h2>{lastHeist.escape_success ? '💸 HEIST SUCCESSFUL!' : '🚨 HEIST FAILED'}</h2>
                </div>
                
                <div className="target-info">
                  <div className="target-bank">
                    <span className="bank-icon">{selectedBank.image}</span>
                    <span className="bank-name">{lastHeist.target_bank}</span>
                  </div>
                </div>

                <div className="hacks-used">
                  <h4>Hacking Attempts:</h4>
                  <div className="hacks-grid">
                    {lastHeist.hacks_used.map((hack, index) => (
                      <div key={index} className="hack-item">
                        <div className="hack-icon">{hack.image}</div>
                        <div className="hack-name">{hack.name}</div>
                        <div className="hack-success">{(hack.success_rate * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="escape-result">
                  {lastHeist.escape_success ? (
                    <div className="escape-success">
                      <div className="success-icon">🎉</div>
                      <div className="success-text">Clean escape! Security bypassed.</div>
                    </div>
                  ) : (
                    <div className="escape-failure">
                      <div className="failure-icon">🚓</div>
                      <div className="failure-text">Caught by cybersecurity!</div>
                    </div>
                  )}
                </div>

                {lastHeist.win_amount > 0 && (
                  <div className="heist-rewards">
                    <div className="reward-multiplier">{lastHeist.final_multiplier.toFixed(2)}x Multiplier</div>
                    <div className="reward-amount">+${lastHeist.win_amount.toFixed(2)}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="terminal-ready">
                <div className="terminal-icon">💻</div>
                <h3>Cyber Heist Terminal</h3>
                <p>Select a target and initiate the digital heist!</p>
                <div className="selected-target" style={{ color: selectedBank.color }}>
                  Target: {selectedBank.name} | Security: {selectedBank.security}/10
                </div>
                <div className="risk-warning">
                  ⚠️ Higher security = Higher cost & reward
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="game-info">
          <div className="stats-panel">
            <h3>Heist Stats</h3>
            {stats && (
              <div className="stats-grid">
                <div className="stat-item">
                  <span>Total Heists:</span>
                  <span>{stats.total_heists || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Successful:</span>
                  <span>{stats.successful_heists || 0}</span>
                </div>
                <div className="stat-item">
                  <span>Success Rate:</span>
                  <span>{stats.success_rate ? `${(stats.success_rate * 100).toFixed(1)}%` : '0%'}</span>
                </div>
                <div className="stat-item">
                  <span>Total Loot:</span>
                  <span>${stats.total_loot?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}
          </div>

          <div className="history-panel">
            <h3>Recent Heists</h3>
            <div className="history-list">
              {history.slice(0, 5).map((heist, index) => (
                <div key={index} className={`history-item ${heist.escape_success ? 'success' : 'failure'}`}>
                  <span className="target">{heist.target_bank}</span>
                  <span className={`status ${heist.escape_success ? 'success' : 'failure'}`}>
                    {heist.escape_success ? '✅' : '❌'}
                  </span>
                  <span className="hacks">{heist.hacks_used?.length || 0} hacks</span>
                  <span className="win-amount">
                    {heist.win_amount > 0 ? `+$${heist.win_amount.toFixed(2)}` : '$0'}
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

export default CyberHeistGame;