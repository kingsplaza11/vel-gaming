import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { minerService } from '../services/api';
import './CryptoMinerGame.css';

const CryptoMinerGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [cryptoType, setCryptoType] = useState('bitcoin');
  const [mining, setMining] = useState(false);
  const [lastSession, setLastSession] = useState(null);

  const cryptoCurrencies = [
    { value: 'bitcoin', label: 'Bitcoin ₿', color: '#F7931A' },
    { value: 'ethereum', label: 'Ethereum Ξ', color: '#627EEA' },
    { value: 'cardano', label: 'Cardano ADA', color: '#0033AD' },
    { value: 'solana', label: 'Solana ◎', color: '#00FFA3' },
  ];

  const handleStartMining = async () => {
    if (mining) return;
    
    setMining(true);
    setLastSession(null);
    
    try {
      const response = await minerService.startMining({ 
        bet_amount: betAmount, 
        crypto_type: cryptoType 
      });
      const { crypto, blocks_mined, bonus_multiplier, total_multiplier, win_amount, new_balance } = response.data;
      
      setLastSession({ crypto, blocks_mined, bonus_multiplier, total_multiplier, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      
    } catch (error) {
      console.error('Error mining:', error);
      alert(error.response?.data?.error || 'Error starting mining session');
    } finally {
      setMining(false);
    }
  };

  const selectedCrypto = cryptoCurrencies.find(c => c.value === cryptoType);

  return (
    <div className="miner-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="miner-container">
        <div className="game-controls">
          <div className="crypto-selection">
            <h3>Choose Cryptocurrency</h3>
            <div className="crypto-buttons">
              {cryptoCurrencies.map(crypto => (
                <button
                  key={crypto.value}
                  className={`crypto-btn ${cryptoType === crypto.value ? 'active' : ''}`}
                  onClick={() => setCryptoType(crypto.value)}
                  style={{ borderColor: crypto.color }}
                >
                  {crypto.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bet-controls">
            <label>Mining Investment:</label>
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
            onClick={handleStartMining} 
            disabled={mining || betAmount > user.balance}
            className="mine-button"
            style={{ backgroundColor: selectedCrypto?.color }}
          >
            {mining ? '⛏️ Mining...' : '⛏️ Start Mining'}
          </button>
        </div>

        <div className="mining-display">
          <div className="mining-rig">
            {mining ? (
              <div className="mining-animation">
                <div className="mining-icon">⛏️</div>
                <p>Mining {selectedCrypto?.label}...</p>
              </div>
            ) : lastSession ? (
              <div className="mining-results">
                <h3>Mining Complete!</h3>
                <div className="results-grid">
                  <div className="result-item">
                    <span>Blocks Mined:</span>
                    <span>{lastSession.blocks_mined}</span>
                  </div>
                  <div className="result-item">
                    <span>Bonus Multiplier:</span>
                    <span>{lastSession.bonus_multiplier}x</span>
                  </div>
                  <div className="result-item">
                    <span>Total Multiplier:</span>
                    <span>{lastSession.total_multiplier.toFixed(2)}x</span>
                  </div>
                  <div className="result-item">
                    <span>You Earned:</span>
                    <span className="win-amount">${lastSession.win_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mining-ready">
                <div className="rig-icon">⛏️</div>
                <h3>Crypto Mining Rig</h3>
                <p>Select a cryptocurrency and start mining!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoMinerGame;