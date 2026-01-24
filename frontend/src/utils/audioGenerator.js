// src/utils/audioGenerator.js
class GameAudioGenerator {
  constructor() {
    this.audioContext = null;
    this.currentOscillator = null;
    this.currentGainNode = null;
    this.isPlaying = false;
  }

  // Initialize audio context (requires user interaction on some browsers)
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Stop any currently playing sound
  stop() {
    if (this.currentOscillator) {
      try {
        this.currentOscillator.stop();
        this.currentOscillator.disconnect();
      } catch (e) {
        // Oscillator might have already stopped
      }
      this.currentOscillator = null;
    }
    
    if (this.currentGainNode) {
      this.currentGainNode.disconnect();
      this.currentGainNode = null;
    }
    
    this.isPlaying = false;
  }

  // Play game-specific loading sound
  playGameSound(gameType) {
    try {
      this.init();
      
      // Stop any existing sound first
      this.stop();
      
      const now = this.audioContext.currentTime;
      
      // Create oscillator and gain node
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      this.currentOscillator = oscillator;
      this.currentGainNode = gainNode;
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Configure sound based on game type
      this.configureSound(gameType, oscillator, gainNode, now);
      
      // Start playing
      oscillator.start(now);
      this.isPlaying = true;
      
      // Auto-stop after 2 seconds with fade out
      setTimeout(() => {
        this.stop();
      }, 2000);
      
    } catch (error) {
      console.warn('Audio playback failed:', error);
      this.stop();
    }
  }

  // Configure different sounds for different game types
  configureSound(gameType, oscillator, gainNode, startTime) {
    // Default subtle volume (10%)
    gainNode.gain.setValueAtTime(0.1, startTime);
    
    // Fade in quickly
    gainNode.gain.exponentialRampToValueAtTime(0.12, startTime + 0.1);
    
    // Fade out towards the end
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 1.8);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 2.0);
    
    switch (gameType) {
      case 'fortune':
        // Gentle ascending chime for fortune games
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, startTime); // A3
        oscillator.frequency.exponentialRampToValueAtTime(440, startTime + 1); // A4
        oscillator.frequency.exponentialRampToValueAtTime(330, startTime + 2); // E4
        break;
        
      case 'rocket':
      case 'crash':
        // Rising rocket/crash sound
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(110, startTime); // A2
        oscillator.frequency.exponentialRampToValueAtTime(880, startTime + 2); // A5
        break;
        
      case 'ocean':
      case 'fishing':
        // Ocean wave sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, startTime);
        // Create wave pattern
        const wavePoints = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6];
        wavePoints.forEach((time, i) => {
          const freq = 220 + (Math.sin(i * 0.5) * 30);
          oscillator.frequency.setValueAtTime(freq, startTime + time);
        });
        break;
        
      case 'treasure':
      case 'adventure':
        // Mysterious treasure sound
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(329.63, startTime); // E4
        oscillator.frequency.exponentialRampToValueAtTime(246.94, startTime + 1); // B3
        oscillator.frequency.exponentialRampToValueAtTime(196.00, startTime + 1.8); // G3
        break;
        
      case 'magic':
      case 'potion':
        // Magical sparkle sound
        oscillator.type = 'sine';
        // Create sparkle pattern
        const sparkleTimes = [0, 0.3, 0.6, 0.9, 1.2, 1.5];
        const sparkleFreqs = [523.25, 659.25, 783.99, 659.25, 523.25, 392.00];
        sparkleTimes.forEach((time, i) => {
          oscillator.frequency.setValueAtTime(sparkleFreqs[i], startTime + time);
          // Slight volume bump for each sparkle
          if (i < sparkleTimes.length - 1) {
            gainNode.gain.setValueAtTime(0.12, startTime + time);
            gainNode.gain.exponentialRampToValueAtTime(0.1, startTime + time + 0.15);
          }
        });
        break;
        
      case 'cyber':
      case 'strategy':
        // Digital tech sound
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, startTime); // A4
        
        // Create digital beep pattern
        const beepPattern = [
          { time: 0, freq: 440, volume: 0.12 },
          { time: 0.3, freq: 523.25, volume: 0.12 },
          { time: 0.6, freq: 349.23, volume: 0.12 },
          { time: 0.9, freq: 440, volume: 0.12 },
          { time: 1.2, freq: 0, volume: 0 }, // pause
          { time: 1.5, freq: 440, volume: 0.1 }
        ];
        
        beepPattern.forEach(({ time, freq, volume }) => {
          if (freq > 0) {
            oscillator.frequency.setValueAtTime(freq, startTime + time);
            gainNode.gain.setValueAtTime(volume, startTime + time);
          } else {
            gainNode.gain.setValueAtTime(0.001, startTime + time);
          }
        });
        break;
        
      case 'slot':
        // Slot machine spinning sound
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(261.63, startTime); // C4
        
        // Simulate spinning up
        for (let i = 0; i < 8; i++) {
          oscillator.frequency.setValueAtTime(
            261.63 + (i * 25), 
            startTime + (i * 0.25)
          );
        }
        break;
        
      default:
        // Default calming tone
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(392.00, startTime); // G4
        oscillator.frequency.exponentialRampToValueAtTime(523.25, startTime + 1); // C5
        oscillator.frequency.exponentialRampToValueAtTime(392.00, startTime + 1.8); // G4
        break;
    }
  }

  // Clean up audio context
  cleanup() {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
}

// Export singleton instance
export const gameAudio = new GameAudioGenerator();

// Export helper function to play sound safely
export const playGameLoadingSound = (gameType) => {
  try {
    gameAudio.playGameSound(gameType);
    return true;
  } catch (error) {
    console.warn('Failed to play game sound:', error);
    return false;
  }
};