// src/utils/FishingSoundManager.js
class FishingSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('fishing_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('fishing_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.waterInterval = null;
    this.boatInterval = null;
    this.seagullInterval = null;
    this.activeSounds = new Set();
    this.isInitialized = false;
  }

  // Initialize Web Audio API with user gesture
  init() {
    if (this.isInitialized) return true;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('Web Audio API not supported or initialization failed:', error);
      return false;
    }
  }

  // Safe sound play method that initializes if needed
  safePlay(callback) {
    if (this.isMuted) return;
    
    // Try to initialize if not already done
    if (!this.isInitialized) {
      if (!this.init()) {
        console.warn('Cannot play sound: AudioContext initialization failed');
        return;
      }
    }
    
    // Check if audio context is suspended (happens in browsers due to autoplay policy)
    if (this.audioContext.state === 'suspended') {
      // Try to resume the audio context
      this.audioContext.resume().then(() => {
        callback();
      }).catch(error => {
        console.warn('Failed to resume AudioContext:', error);
      });
    } else {
      callback();
    }
  }

  /* =========================
     BACKGROUND MUSIC & AMBIENCE
  ========================= */
  
  // Play ocean background music
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Sea_Sick.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.1 * this.masterVolume;
      
      // Handle autoplay restrictions
      const playPromise = this.backgroundAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Fishing background music play failed:', e);
          this.backgroundAudio = null;
          // Fallback to generated ocean sounds
          this.playGeneratedOcean();
        });
      }
    } catch (error) {
      console.warn('Failed to load fishing background music:', error);
      // Fallback to generated ocean sounds
      this.playGeneratedOcean();
    }
  }

  // Generate ocean ambiance sounds
  playGeneratedOcean() {
    if (this.backgroundMusicMuted || this.waterInterval) return;
    
    // Initialize audio context if needed
    if (!this.init()) return;
    
    // Create continuous ocean wave sounds
    const playWaveSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 2);
        
        gainNode.gain.setValueAtTime(0.05 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 2);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(soundId);
        }, 2000);
      });
    };
    
    // Play continuously with varying intervals
    playWaveSound();
    this.waterInterval = setInterval(playWaveSound, 3000 + Math.random() * 2000);
    
    // Start occasional boat sounds
    this.startBoatSounds();
    
    // Start occasional seagull sounds
    this.startSeagullSounds();
  }

  // Play occasional distant boat sounds
  startBoatSounds() {
    if (this.backgroundMusicMuted || this.boatInterval) return;
    
    const playBoatSound = () => {
      if (this.backgroundMusicMuted) return;
      
      setTimeout(() => {
        if (this.backgroundMusicMuted) return;
        
        this.safePlay(() => {
          // Boat horn (distant)
          const hornOscillator = this.audioContext.createOscillator();
          const hornGain = this.audioContext.createGain();
          
          hornOscillator.connect(hornGain);
          hornGain.connect(this.audioContext.destination);
          
          hornOscillator.type = 'sawtooth';
          hornOscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
          hornOscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.5);
          
          hornGain.gain.setValueAtTime(0.03 * this.masterVolume, this.audioContext.currentTime);
          hornGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
          
          hornOscillator.start();
          hornOscillator.stop(this.audioContext.currentTime + 0.5);
          
          const hornId = Date.now();
          this.oscillators.set(hornId, { oscillator: hornOscillator, gainNode: hornGain });
          
          setTimeout(() => this.cleanupOscillator(hornId), 500);
          
          // Boat engine rumble (very low, distant)
          setTimeout(() => {
            this.safePlay(() => {
              const engineOscillator = this.audioContext.createOscillator();
              const engineGain = this.audioContext.createGain();
              
              engineOscillator.connect(engineGain);
              engineGain.connect(this.audioContext.destination);
              
              engineOscillator.type = 'square';
              engineOscillator.frequency.setValueAtTime(60, this.audioContext.currentTime);
              engineOscillator.frequency.setValueAtTime(65, this.audioContext.currentTime + 1);
              
              engineGain.gain.setValueAtTime(0.02 * this.masterVolume, this.audioContext.currentTime);
              engineGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 2);
              
              engineOscillator.start();
              engineOscillator.stop(this.audioContext.currentTime + 2);
              
              const engineId = Date.now() + 1;
              this.oscillators.set(engineId, { oscillator: engineOscillator, gainNode: engineGain });
              
              setTimeout(() => this.cleanupOscillator(engineId), 2000);
            });
          }, 600);
        });
      }, Math.random() * 30000); // Random delay up to 30 seconds
    };
    
    playBoatSound();
    this.boatInterval = setInterval(playBoatSound, 45000 + Math.random() * 30000);
  }

  // Play occasional seagull sounds
  startSeagullSounds() {
    if (this.backgroundMusicMuted || this.seagullInterval) return;
    
    const playSeagullSound = () => {
      if (this.backgroundMusicMuted) return;
      
      setTimeout(() => {
        if (this.backgroundMusicMuted) return;
        
        this.safePlay(() => {
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.2);
          oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.4);
          
          gainNode.gain.setValueAtTime(0.04 * this.masterVolume, this.audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + 0.6);
          
          const soundId = Date.now();
          this.oscillators.set(soundId, { oscillator, gainNode });
          
          setTimeout(() => this.cleanupOscillator(soundId), 600);
        });
      }, Math.random() * 15000); // Random delay up to 15 seconds
    };
    
    playSeagullSound();
    this.seagullInterval = setInterval(playSeagullSound, 20000 + Math.random() * 15000);
  }

  // Stop all background sounds
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
    
    if (this.waterInterval) {
      clearInterval(this.waterInterval);
      this.waterInterval = null;
    }
    
    if (this.boatInterval) {
      clearInterval(this.boatInterval);
      this.boatInterval = null;
    }
    
    if (this.seagullInterval) {
      clearInterval(this.seagullInterval);
      this.seagullInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('fishing_bg_muted', this.backgroundMusicMuted);
    
    if (this.backgroundMusicMuted) {
      this.stopBackgroundMusic();
    } else {
      this.playBackgroundMusic();
    }
    
    return this.backgroundMusicMuted;
  }

  // Toggle all game sounds (not background music)
  toggleGameSounds() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('fishing_muted', this.isMuted);
    
    if (this.isMuted) {
      // Cleanup all oscillators (game sounds)
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
    }
    
    return this.isMuted;
  }

  // Toggle both background music and game sounds
  toggleMute() {
    const bgMuted = this.toggleBackgroundMusic();
    const gameMuted = this.toggleGameSounds();
    
    return { bgMuted, gameMuted };
  }

  // Get current mute states
  getMuteState() {
    return {
      backgroundMusicMuted: this.backgroundMusicMuted,
      gameSoundsMuted: this.isMuted
    };
  }

  /* =========================
     GAME SOUND EFFECTS
     These only check this.isMuted (not backgroundMusicMuted)
  ========================= */
  
  // Casting sound - line throwing with splash
  playCastSound() {
    this.safePlay(() => {
      // Line reel out sound
      this.playReelSound();
      
      // Splash sound after delay
      setTimeout(() => this.playSplashSound(), 300);
    });
  }

  playReelSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 300);
    });
  }

  playSplashSound() {
    this.safePlay(() => {
      // Create multiple oscillators for splash effect
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = i % 2 === 0 ? 'square' : 'sine';
            oscillator.frequency.setValueAtTime(200 + i * 50, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100 + i * 30, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime((0.1 - i * 0.02) * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
            
            const id = Date.now() + i;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 200);
          });
        }, i * 30);
      }
    });
  }

  // Reeling in sound
  playReelInSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 500);
    });
  }

  // Catch success sound (good fish)
  playCatchSuccessSound() {
    this.safePlay(() => {
      // Happy chime sequence
      const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5
      const durations = [0.2, 0.2, 0.3];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + durations[index]);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + durations[index]);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), durations[index] * 1000);
          });
        }, index * 150);
      });
    });
  }

  // Catch trap sound (bad catch)
  playCatchTrapSound() {
    this.safePlay(() => {
      // Unpleasant sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.4);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.4);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 400);
    });
  }

  // Big win sound (rare catch)
  playBigWinSound() {
    this.safePlay(() => {
      // Victory fanfare
      const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6
      const durations = [0.15, 0.15, 0.15, 0.2, 0.3];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + durations[index]);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + durations[index]);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), durations[index] * 1000);
          });
        }, index * 100);
      });
    });
  }

  // Coin sound for winnings
  playCoinSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Stake placing sound
  playStakeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  /* =========================
     UTILITY METHODS
  ========================= */
  
  // Cleanup individual oscillator
  cleanupOscillator(id) {
    const sound = this.oscillators.get(id);
    if (sound) {
      try {
        if (sound.oscillator) {
          sound.oscillator.stop();
          sound.oscillator.disconnect();
        }
        if (sound.gainNode) {
          sound.gainNode.disconnect();
        }
      } catch (e) {
        // Sound already stopped
      }
      this.oscillators.delete(id);
    }
  }

  // Set master volume (affects both background music and game sounds)
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = 0.1 * this.masterVolume;
    }
  }

  // Cleanup everything
  cleanup() {
    this.stopBackgroundMusic();
    this.oscillators.forEach((sound, id) => {
      this.cleanupOscillator(id);
    });
    this.oscillators.clear();
    
    // Reset initialization state
    this.isInitialized = false;
    this.audioContext = null;
  }
}

// Export singleton instance
export const fishingSound = new FishingSoundManager();