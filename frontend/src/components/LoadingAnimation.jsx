// src/components/LoadingAnimation.jsx - UPDATED
import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { gameAudio, playGameLoadingSound } from '../utils/audioGenerator';
import './LoadingAnimation.css';

const LoadingAnimation = ({ game, progress, onComplete }) => {
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  useEffect(() => {
    // Play sound when loading starts (progress 0-10%)
    if (game && progress > 0 && progress < 10) {
      const gameType = game.loadingAnimation || 'default';
      const played = playGameLoadingSound(gameType);
      setIsAudioPlaying(played);
      
      // Set timeout to update audio playing state
      const timer = setTimeout(() => {
        setIsAudioPlaying(false);
      }, 2100); // Slightly longer than the sound duration
      
      return () => clearTimeout(timer);
    }
    
    // If progress jumps beyond sound playing range, stop audio
    if (progress >= 10 && isAudioPlaying) {
      gameAudio.stop();
      setIsAudioPlaying(false);
    }
  }, [game, progress]);

  useEffect(() => {
    // Clean up audio on unmount
    return () => {
      gameAudio.stop();
      setIsAudioPlaying(false);
    };
  }, []);

  useEffect(() => {
    // Auto-hide after completion
    if (progress >= 100) {
      const timer = setTimeout(() => {
        gameAudio.stop();
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  // Different animations based on game type
  const renderAnimation = () => {
    const animationType = game.loadingAnimation;

    switch (animationType) {
      case 'fortune':
        return (
          <div className="fortune-animation">
            <div className="fortune-wheel">
              <div className="wheel-outer"></div>
              <div className="wheel-inner">
                <img 
                  src={require('../logo.png')} 
                  alt="Veltora" 
                  className="fortune-logo" 
                />
              </div>
              <div className="wheel-glow"></div>
            </div>
            <div className="fortune-coins">
              <div className="coin coin1">
                <Icon icon="mdi:coin" />
              </div>
              <div className="coin coin2">
                <Icon icon="mdi:coin" />
              </div>
              <div className="coin coin3">
                <Icon icon="mdi:coin" />
              </div>
            </div>
          </div>
        );
      
      case 'rocket':
      case 'crash':
        return (
          <div className="rocket-animation">
            <div className="rocket-container">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="rocket-logo" 
              />
              <div className="rocket-flames">
                <div className="flame flame1"></div>
                <div className="flame flame2"></div>
                <div className="flame flame3"></div>
              </div>
            </div>
            <div className="stars">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="star"></div>
              ))}
            </div>
          </div>
        );
      
      case 'ocean':
      case 'fishing':
        return (
          <div className="ocean-animation">
            <div className="water-surface"></div>
            <div className="ocean-logo-container">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="ocean-logo" 
              />
            </div>
            <div className="fish fish1">
              <Icon icon="mdi:fish" />
            </div>
            <div className="fish fish2">
              <Icon icon="mdi:fish" />
            </div>
            <div className="bubbles">
              {[...Array(15)].map((_, i) => (
                <div key={i} className="bubble"></div>
              ))}
            </div>
          </div>
        );
      
      case 'treasure':
      case 'adventure':
        return (
          <div className="treasure-animation">
            <div className="treasure-chest">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="treasure-logo" 
              />
            </div>
            <div className="treasure-sparkles">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="sparkle"></div>
              ))}
            </div>
            <div className="coins-scatter">
              <div className="scatter-coin">
                <Icon icon="mdi:treasure-chest" />
              </div>
              <div className="scatter-coin">
                <Icon icon="mdi:gem" />
              </div>
              <div className="scatter-coin">
                <Icon icon="mdi:crystal-ball" />
              </div>
            </div>
          </div>
        );
      
      case 'magic':
      case 'potion':
        return (
          <div className="magic-animation">
            <div className="potion-container">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="potion-logo" 
              />
            </div>
            <div className="magic-sparks">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="spark"></div>
              ))}
            </div>
            <div className="magic-swirl"></div>
          </div>
        );
      
      case 'cyber':
      case 'strategy':
        return (
          <div className="cyber-animation">
            <div className="cyber-terminal">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="cyber-logo" 
              />
            </div>
            <div className="data-stream">
              {[...Array(20)].map((_, i) => (
                <div key={i} className="data-bit"></div>
              ))}
            </div>
            <div className="circuit-lines">
              <div className="circuit-line"></div>
              <div className="circuit-line"></div>
              <div className="circuit-line"></div>
            </div>
          </div>
        );
      
      case 'slot':
        return (
          <div className="slot-animation">
            <div className="slot-machine">
              <div className="slot-reel reel1">🍒</div>
              <div className="slot-reel reel2">7️⃣</div>
              <div className="slot-reel reel3">💰</div>
            </div>
            <div className="slot-logo-container">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="slot-logo" 
              />
            </div>
            <div className="slot-lights">
              <div className="slot-light"></div>
              <div className="slot-light"></div>
              <div className="slot-light"></div>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="default-animation">
            <div className="default-logo-container">
              <img 
                src={require('../logo.png')} 
                alt="Veltora" 
                className="default-logo" 
              />
              <div className="loading-spinner">
                <div className="spinner-ring"></div>
                <div className="spinner-glow"></div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="game-loading-overlay">
      <div className="loading-content">
        {/* Game background image - subtle */}
        {game.img && (
          <div className="game-background-image">
            <img 
              src={game.img} 
              alt={game.name} 
              className="background-image" 
            />
            <div className="background-overlay"></div>
          </div>
        )}
        
        <div className="loading-header">
          <h1 className="loading-title" title={game.name}>
            {game.name}
          </h1>
          <p className="loading-subtitle">Loading premium experience...</p>
        </div>
        
        <div className="animation-container">
          {renderAnimation()}
        </div>
        
        <div className="loading-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="progress-text">{progress}%</div>
          <div className="progress-hint">Game will start automatically...</div>
        </div>
        
        <div className="loading-footer">
          <div className="game-tips">
            <Icon icon="mdi:lightbulb" />
            <span>Pro tip: {getGameTip(game)}</span>
          </div>
          {isAudioPlaying && (
            <div className="audio-indicator">
              <Icon icon="mdi:volume-high" />
              <span>Ambient sound playing...</span>
            </div>
          )}
        </div>
        
        <button 
          className="cancel-loading-btn" 
          onClick={() => {
            gameAudio.stop();
            onComplete();
          }}
        >
          <Icon icon="mdi:close" />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};

// Helper function to get game-specific tips
const getGameTip = (game) => {
  const gameType = game.loadingAnimation;
  
  switch (gameType) {
    case 'fortune':
      return 'Start with smaller bets to understand the patterns';
    case 'crash':
    case 'rocket':
      return 'Cash out early to build your confidence';
    case 'fishing':
    case 'ocean':
      return 'Different fish have different values - aim for the rare ones';
    case 'treasure':
    case 'adventure':
      return 'Take your time to explore all possibilities';
    case 'magic':
    case 'potion':
      return 'Combine ingredients in different orders for better results';
    case 'cyber':
    case 'strategy':
      return 'Plan your moves ahead - strategy is key';
    case 'slot':
      return 'Bet on all paylines for maximum chance to win';
    default:
      return 'Start with practice mode to learn the game mechanics';
  }
};

export default LoadingAnimation;