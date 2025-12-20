import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spaceService } from '../services/api';
import './SpaceExplorerGame.css';

const SpaceExplorerGame = ({ user, onBalanceUpdate }) => {
  const navigate = useNavigate();
  const [betAmount, setBetAmount] = useState(10);
  const [missionType, setMissionType] = useState('mining');
  const [exploring, setExploring] = useState(false);
  const [lastMission, setLastMission] = useState(null);

  const missionTypes = [
    { value: 'mining', label: '🪐 Mining', description: 'Extract valuable space minerals' },
    { value: 'exploration', label: '🔭 Exploration', description: 'Discover alien artifacts' },
    { value: 'rescue', label: '🚀 Rescue', description: 'Save stranded astronauts' },
  ];

  const handleLaunchMission = async () => {
    if (exploring) return;
    
    setExploring(true);
    setLastMission(null);
    
    try {
      const response = await spaceService.launchMission({ 
        bet_amount: betAmount, 
        mission_type: missionType 
      });
      const { mission_type, planets_visited, resources_collected, total_multiplier, win_amount, new_balance } = response.data;
      
      setLastMission({ mission_type, planets_visited, resources_collected, total_multiplier, win_amount });
      onBalanceUpdate({ ...user, balance: new_balance });
      
    } catch (error) {
      console.error('Error in space mission:', error);
      alert(error.response?.data?.error || 'Error launching mission');
    } finally {
      setExploring(false);
    }
  };

  const selectedMission = missionTypes.find(m => m.value === missionType);

  return (
    <div className="space-game">
      <header className="game-header">
        <button onClick={() => navigate('/')} className="back-button">← Back to Games</button>
        <div className="balance-display">Balance: ${parseFloat(user.balance).toFixed(2)}</div>
      </header>

      <div className="space-container">
        {/* Game controls and display similar to other games */}
        <div className="mission-controls">
          {/* Mission type selection */}
          {/* Bet amount controls */}
          <button 
            onClick={handleLaunchMission} 
            disabled={exploring || betAmount * 2 > user.balance} // Space missions cost 2x
            className="launch-button"
          >
            {exploring ? '🚀 Launching...' : '🚀 Launch Mission'}
          </button>
        </div>

        <div className="space-display">
          {exploring ? (
            <div className="mission-animation">
              <div className="spaceship">🚀</div>
              <p>Exploring the cosmos...</p>
            </div>
          ) : lastMission ? (
            <div className="mission-results">
              <h3>Mission Complete!</h3>
              {/* Display planets visited and resources collected */}
            </div>
          ) : (
            <div className="mission-ready">
              <div className="planet">🪐</div>
              <p>Ready for space exploration!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpaceExplorerGame;