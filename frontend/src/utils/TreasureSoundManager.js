// src/utils/TreasureSoundManager.js
class TreasureSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('treasure_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('treasure_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.ambientInterval = null;
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
  
  // Play treasure hunt background music
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Dust_in_the_Gold.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.12 * this.masterVolume;
      
      // Handle autoplay restrictions
      const playPromise = this.backgroundAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Treasure background music play failed:', e);
          this.backgroundAudio = null;
          // Fallback to generated adventure sounds
          this.playGeneratedAdventureAmbience();
        });
      }
    } catch (error) {
      console.warn('Failed to load treasure background music:', error);
      // Fallback to generated adventure sounds
      this.playGeneratedAdventureAmbience();
    }
  }

  // Generate adventure ambiance sounds
  playGeneratedAdventureAmbience() {
    if (this.backgroundMusicMuted || this.ambientInterval) return;
    
    // Initialize audio context if needed
    if (!this.init()) return;
    
    // Mysterious wind sounds
    const playWindSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(90, this.audioContext.currentTime + 3);
        
        gainNode.gain.setValueAtTime(0.04 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 3);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 3);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(soundId);
        }, 3000);
      });
    };
    
    // Play wind sounds periodically
    playWindSound();
    this.ambientInterval = setInterval(playWindSound, 5000 + Math.random() * 3000);
    
    // Start occasional mysterious sounds
    this.startMysteriousSounds();
  }

  // Play occasional mysterious adventure sounds
  startMysteriousSounds() {
    if (this.backgroundMusicMuted) return;
    
    const playMysterySound = () => {
      setTimeout(() => {
        if (this.backgroundMusicMuted) return;
        
        this.safePlay(() => {
          // Choose random mystery sound type
          const soundTypes = [
            { type: 'sawtooth', freq: 200, duration: 0.8 }, // Creaking
            { type: 'triangle', freq: 400, duration: 0.4 }, // Chime
            { type: 'square', freq: 150, duration: 1.2 }, // Rumble
          ];
          
          const sound = soundTypes[Math.floor(Math.random() * soundTypes.length)];
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          oscillator.type = sound.type;
          oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(sound.freq * 0.7, this.audioContext.currentTime + sound.duration);
          
          gainNode.gain.setValueAtTime(0.03 * this.masterVolume, this.audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + sound.duration);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + sound.duration);
          
          const id = Date.now();
          this.oscillators.set(id, { oscillator, gainNode });
          
          setTimeout(() => this.cleanupOscillator(id), sound.duration * 1000);
        });
      }, Math.random() * 15000 + 10000); // Every 10-25 seconds
    };
    
    // Start immediately and set interval
    playMysterySound();
    setInterval(playMysterySound, 25000 + Math.random() * 15000);
  }

  // Stop all background sounds
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
    
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('treasure_bg_muted', this.backgroundMusicMuted);
    
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
    localStorage.setItem('treasure_muted', this.isMuted);
    
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
  
  // Map selection sound
  playMapSelectSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Stake placement sound
  playStakeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  // Expedition start sound (rocket launch)
  playExpeditionStartSound() {
    this.safePlay(() => {
      // Rocket launch effect
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.8);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.8);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 800);
    });
  }

  // Sailing phase sound
  playSailingSound() {
    this.safePlay(() => {
      // Boat creaking and waves
      const frequencies = [80, 120, 200];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = index % 2 === 0 ? 'sine' : 'square';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 0.8, this.audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime((0.08 - index * 0.02) * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 500);
          });
        }, index * 200);
      });
    });
  }

  // Scanning phase sound (radar ping)
  playScanningSound() {
    this.safePlay(() => {
      // Radar ping effect
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.15, this.audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
      
      // Play every 0.8 seconds for radar effect
      this.scanInterval = setInterval(() => {
        if (!this.isMuted) this.playScanningSound();
      }, 800);
    });
  }

  // Stop scanning sound
  stopScanningSound() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  // Digging phase sound
  playDiggingSound() {
    this.safePlay(() => {
      // Shovel digging and dirt sounds
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 300);
      
      // Play digging sound every 0.4 seconds
      this.digInterval = setInterval(() => {
        if (!this.isMuted) this.playDiggingSound();
      }, 400);
    });
  }

  // Stop digging sound
  stopDiggingSound() {
    if (this.digInterval) {
      clearInterval(this.digInterval);
      this.digInterval = null;
    }
  }

  // Treasure reveal sound (chest opening)
  playTreasureRevealSound(tier) {
    this.safePlay(() => {
      const frequencies = {
        small: [523.25, 587.33, 659.25], // C, D, E
        low: [659.25, 783.99, 880.00],   // E, G, A
        normal: [783.99, 987.77, 1174.66], // G, B, D
        high: [1046.50, 1318.51, 1567.98], // C6, E6, G6
        great: [1567.98, 1975.53, 2637.02], // G6, B6, E7
        loss: [110, 104, 98] // Low, descending tones for loss
      };
      
      const currentFreqs = frequencies[tier] || frequencies.small;
      const durations = tier === 'loss' ? [0.3, 0.3, 0.5] : [0.15, 0.15, 0.3];
      
      // Chest creak opening
      const chestOscillator = this.audioContext.createOscillator();
      const chestGain = this.audioContext.createGain();
      
      chestOscillator.connect(chestGain);
      chestGain.connect(this.audioContext.destination);
      
      chestOscillator.type = 'sawtooth';
      chestOscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      chestOscillator.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 0.4);
      
      chestGain.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      chestGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
      
      chestOscillator.start();
      chestOscillator.stop(this.audioContext.currentTime + 0.4);
      
      const chestId = Date.now();
      this.oscillators.set(chestId, { oscillator: chestOscillator, gainNode: chestGain });
      
      setTimeout(() => this.cleanupOscillator(chestId), 400);
      
      // Treasure reveal chimes
      setTimeout(() => {
        currentFreqs.forEach((freq, index) => {
          setTimeout(() => {
            this.safePlay(() => {
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);
              
              oscillator.type = tier === 'loss' ? 'square' : 'triangle';
              oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
              
              gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + durations[index]);
              
              oscillator.start();
              oscillator.stop(this.audioContext.currentTime + durations[index]);
              
              const id = Date.now() + freq + index;
              this.oscillators.set(id, { oscillator, gainNode });
              
              setTimeout(() => this.cleanupOscillator(id), durations[index] * 1000);
            });
          }, index * (tier === 'loss' ? 200 : 100));
        });
      }, 200);
    });
  }

  // Individual treasure found sound
  playTreasureFoundSound(valueMultiplier) {
    this.safePlay(() => {
      const baseFreq = 400;
      const multiplierFreq = baseFreq * (1 + (valueMultiplier * 0.1));
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(multiplierFreq, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
    });
  }

  // Gold/coin collection sound
  playCoinSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.14 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Big win celebration sound
  playBigWinCelebration() {
    this.safePlay(() => {
      // Victory fanfare
      const frequencies = [523.25, 659.25, 783.99, 987.77, 1174.66, 1318.51];
      const durations = [0.12, 0.12, 0.12, 0.15, 0.2, 0.3];
      
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
        }, index * 80);
      });
      
      // Confetti pop sounds
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          setTimeout(() => {
            this.safePlay(() => {
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);
              
              oscillator.type = 'square';
              oscillator.frequency.setValueAtTime(600 + (i * 100), this.audioContext.currentTime);
              oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.1);
              
              gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
              
              oscillator.start();
              oscillator.stop(this.audioContext.currentTime + 0.1);
              
              const id = Date.now() + i;
              this.oscillators.set(id, { oscillator, gainNode });
              
              setTimeout(() => this.cleanupOscillator(id), 100);
            });
          }, i * 50);
        }
      }, 500);
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
      this.backgroundAudio.volume = 0.12 * this.masterVolume;
    }
  }

  // Cleanup everything
  cleanup() {
    this.stopBackgroundMusic();
    this.stopScanningSound();
    this.stopDiggingSound();
    
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
export const treasureSound = new TreasureSoundManager();