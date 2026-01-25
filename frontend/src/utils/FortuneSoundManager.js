// src/utils/FortuneSoundManager.js
class FortuneSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    
    // Check if production environment
    const isProduction = window.location.hostname !== 'localhost' && 
                        window.location.hostname !== '127.0.0.1';
    
    // Mute by default in production to prevent issues
    this.isMuted = isProduction || localStorage.getItem('fortune_muted') === 'true';
    this.masterVolume = 0.7;
    this.MAX_OSCILLATORS = 50;
    this.clickPool = [];
    this.CLICK_POOL_SIZE = 5;
    this.isInitialized = false;
    this.isResumed = false;
  }

  // Initialize Web Audio API with resume capability
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Auto-resume on user interaction
        this.setupAutoResume();
        
        // Pre-create click sounds for performance
        if (!this.isInitialized) {
          this.precreateClickSounds();
          this.isInitialized = true;
        }
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        this.isMuted = true;
      }
    }
    
    // Ensure context is resumed
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.resumeAudioContext();
    }
  }

  // Setup auto-resume on user interaction
  setupAutoResume() {
    const resumeAudio = () => {
      if (!this.isResumed && this.audioContext && this.audioContext.state === 'suspended') {
        this.resumeAudioContext();
      }
    };
    
    // Remove existing listeners first
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('touchstart', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
    
    // Add new listeners
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudio, { 
        once: true,
        passive: true 
      });
    });
  }

  // Resume audio context
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('Audio context resumed successfully');
        this.isResumed = true;
      }).catch(error => {
        console.error('Failed to resume audio context:', error);
        this.isMuted = true;
      });
    }
  }

  // Pre-create click sounds for pooling
  precreateClickSounds() {
    if (!this.audioContext) return;
    
    for (let i = 0; i < this.CLICK_POOL_SIZE; i++) {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      gainNode.gain.value = 0;
      
      oscillator.start();
      
      this.clickPool.push({
        oscillator,
        gainNode,
        isPlaying: false,
        id: `click-${i}`
      });
    }
  }

  // Get available pooled sound
  getAvailableClickSound() {
    const now = Date.now();
    return this.clickPool.find(sound => {
      if (!sound.isPlaying) return true;
      
      // Cleanup stuck sounds (older than 1 second)
      if (sound.lastPlayed && (now - sound.lastPlayed) > 1000) {
        sound.isPlaying = false;
        return true;
      }
      return false;
    });
  }

  // Enforce oscillator limit
  enforceOscillatorLimit() {
    if (this.oscillators.size > this.MAX_OSCILLATORS) {
      const keys = Array.from(this.oscillators.keys());
      const toRemove = keys.slice(0, this.oscillators.size - this.MAX_OSCILLATORS);
      toRemove.forEach(id => this.cleanupOscillator(id));
    }
  }

  // Generate click sound using pooling
  playClick() {
    if (this.isMuted || !this.audioContext) return;
    
    this.init();
    this.enforceOscillatorLimit();
    
    const sound = this.getAvailableClickSound();
    if (sound && this.audioContext) {
      sound.isPlaying = true;
      sound.lastPlayed = Date.now();
      
      const now = this.audioContext.currentTime;
      
      try {
        // Cancel any scheduled values
        sound.oscillator.frequency.cancelScheduledValues(now);
        sound.gainNode.gain.cancelScheduledValues(now);
        
        // Set new values
        sound.oscillator.frequency.setValueAtTime(800, now);
        sound.oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        
        sound.gainNode.gain.setValueAtTime(0.15 * this.masterVolume, now);
        sound.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        // Auto-reset after play
        setTimeout(() => {
          sound.isPlaying = false;
        }, 100);
        
        return;
      } catch (error) {
        console.debug('Pooled sound failed, falling back');
      }
    }
    
    // Fallback to original method
    this.playClickFallback();
  }

  // Fallback click sound
  playClickFallback() {
    if (this.isMuted || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 100);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Sound creation failed');
    }
  }

  // Generate stake sound
  playStake() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 300);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Stake sound failed');
    }
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted || !this.audioContext) return;
    
    switch (resultType) {
      case 'safe':
      case 'carrot_bonus':
        this.playWinSound();
        break;
      case 'small_win':
        this.playSmallWinSound();
        break;
      case 'penalty':
      case 'major_penalty':
        this.playPenaltySound();
        break;
      case 'reset':
        this.playResetSound();
        break;
      case 'trap':
        this.playTrapSound();
        break;
      case 'auto_cashout':
        this.playCashoutSound();
        break;
      default:
        this.playClick();
    }
  }

  // Win sound
  playWinSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1046.50, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 500);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Win sound failed');
    }
  }

  // Small win sound
  playSmallWinSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(392.00, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 300);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Small win sound failed');
    }
  }

  // Penalty sound
  playPenaltySound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(349.23, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(261.63, this.audioContext.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.4);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 400);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Penalty sound failed');
    }
  }

  // Reset sound
  playResetSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 300);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Reset sound failed');
    }
  }

  // Trap sound
  playTrapSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    this.enforceOscillatorLimit();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    try {
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, 500);
      
      this.oscillators.get(id).timeout = timeout;
    } catch (error) {
      console.debug('Trap sound failed');
    }
  }

  // Cashout sound
  playCashoutSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    
    // Play simplified victory sound
    this.playVictoryFanfare();
  }

  // Victory fanfare for winning
  playVictoryFanfare() {
    if (this.isMuted || !this.audioContext) return;
    
    const notes = [
      { freq: 523.25, duration: 0.3 }, // C5
      { freq: 659.25, duration: 0.3 }, // E5
      { freq: 1046.50, duration: 0.5 }, // C6
    ];
    
    let cumulativeTime = 0;
    
    notes.forEach((note, i) => {
      setTimeout(() => {
        if (this.isMuted || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        try {
          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
          
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.35 * this.masterVolume, this.audioContext.currentTime + 0.05);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + note.duration);
          
          const id = Date.now() + i;
          this.oscillators.set(id, { oscillator, gainNode, timeout: null });
          
          const timeout = setTimeout(() => {
            this.cleanupOscillator(id);
          }, cumulativeTime * 1000 + note.duration * 1000);
          
          this.oscillators.get(id).timeout = timeout;
        } catch (error) {
          console.debug('Victory sound failed');
        }
      }, cumulativeTime * 1000);
      
      cumulativeTime += note.duration;
    });
  }

  // Game over sound
  playGameOverSound() {
    if (this.isMuted || !this.audioContext) return;
    this.init();
    
    this.playMockingLaughter();
  }

  // Mocking laughter sound
  playMockingLaughter() {
    if (this.isMuted || !this.audioContext) return;
    
    const laughterPattern = [
      { baseFreq: 450, duration: 0.2, count: 2 },
      { baseFreq: 380, duration: 0.3, count: 1 },
    ];
    
    let cumulativeTime = 0;
    
    laughterPattern.forEach((pattern, patternIndex) => {
      for (let i = 0; i < pattern.count; i++) {
        setTimeout(() => {
          if (this.isMuted || !this.audioContext) return;
          
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();
          
          try {
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            const startFreq = pattern.baseFreq;
            const endFreq = pattern.baseFreq - 30;
            
            oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + pattern.duration);
            
            gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime + 0.03);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + pattern.duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + pattern.duration);
            
            const id = Date.now() + patternIndex * 100 + i;
            this.oscillators.set(id, { oscillator, gainNode, timeout: null });
            
            const timeout = setTimeout(() => {
              this.cleanupOscillator(id);
            }, cumulativeTime * 1000 + pattern.duration * 1000);
            
            this.oscillators.get(id).timeout = timeout;
          } catch (error) {
            console.debug('Laughter sound failed');
          }
        }, cumulativeTime * 1000);
        
        cumulativeTime += pattern.duration + 0.1;
      }
      
      cumulativeTime += 0.15;
    });
  }

  // Cleanup individual oscillator
  cleanupOscillator(id) {
    const sound = this.oscillators.get(id);
    if (sound) {
      try {
        if (sound.oscillator && sound.oscillator.stop) {
          sound.oscillator.stop(0);
        }
        if (sound.oscillator && sound.oscillator.disconnect) {
          sound.oscillator.disconnect();
        }
        if (sound.gainNode && sound.gainNode.disconnect) {
          sound.gainNode.disconnect();
        }
        if (sound.filter && sound.filter.disconnect) {
          sound.filter.disconnect();
        }
      } catch (e) {
        // Sound already stopped
      }
      clearTimeout(sound.timeout);
      this.oscillators.delete(id);
    }
  }

  // Cleanup pooled sounds
  cleanupPooledSounds() {
    this.clickPool.forEach(sound => {
      try {
        if (sound.oscillator && sound.oscillator.stop) {
          sound.oscillator.stop(0);
        }
        if (sound.oscillator && sound.oscillator.disconnect) {
          sound.oscillator.disconnect();
        }
        if (sound.gainNode && sound.gainNode.disconnect) {
          sound.gainNode.disconnect();
        }
      } catch (e) {
        // Ignore errors
      }
    });
    this.clickPool = [];
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('fortune_muted', this.isMuted);
    
    if (this.isMuted) {
      // Cleanup all oscillators when muted
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
      this.cleanupPooledSounds();
    }
    
    return this.isMuted;
  }

  // Set volume
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // Cleanup everything
  cleanup() {
    this.oscillators.forEach((sound, id) => {
      this.cleanupOscillator(id);
    });
    this.oscillators.clear();
    this.cleanupPooledSounds();
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this.isResumed = false;
  }
}

// Export singleton instance
export const fortuneSound = new FortuneSoundManager();