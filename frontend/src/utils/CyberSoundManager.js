// src/utils/CyberSoundManager.js
class CyberSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('cyber_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('cyber_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.ambienceInterval = null;
    this.staticInterval = null;
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
  
  // Play cyberpunk background music
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Cyber_Regular_Tuesday.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.1 * this.masterVolume;
      
      // Handle autoplay restrictions
      const playPromise = this.backgroundAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Cyber background music play failed:', e);
          this.backgroundAudio = null;
          // Fallback to generated cyber ambience
          this.playGeneratedCyberAmbience();
        });
      }
    } catch (error) {
      console.warn('Failed to load cyber background music:', error);
      // Fallback to generated cyber ambience
      this.playGeneratedCyberAmbience();
    }
  }

  // Generate cyberpunk ambience sounds
  playGeneratedCyberAmbience() {
    if (this.backgroundMusicMuted || this.ambienceInterval) return;
    
    // Initialize audio context if needed
    if (!this.init()) return;
    
    // Create cyber static/hum sounds
    const playCyberHum = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(140, this.audioContext.currentTime + 3);
        
        gainNode.gain.setValueAtTime(0.04 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 4);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 4);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(soundId);
        }, 4000);
      });
    };
    
    // Play hum sounds continuously
    playCyberHum();
    this.ambienceInterval = setInterval(playCyberHum, 5000 + Math.random() * 2000);
    
    // Start data stream/static sounds
    this.startStaticSounds();
  }

  // Play data stream/static sounds
  startStaticSounds() {
    if (this.backgroundMusicMuted || this.staticInterval) return;
    
    const playStaticSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800 + Math.random() * 400, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600 + Math.random() * 400, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.03 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.3);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => this.cleanupOscillator(soundId), 300);
      });
    };
    
    playStaticSound();
    this.staticInterval = setInterval(playStaticSound, 1000 + Math.random() * 1000);
  }

  // Stop all background sounds
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
    
    if (this.ambienceInterval) {
      clearInterval(this.ambienceInterval);
      this.ambienceInterval = null;
    }
    
    if (this.staticInterval) {
      clearInterval(this.staticInterval);
      this.staticInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('cyber_bg_muted', this.backgroundMusicMuted);
    
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
    localStorage.setItem('cyber_muted', this.isMuted);
    
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
    const gameMuted = this.toggleGameSounds();
    const bgMuted = this.toggleBackgroundMusic();
    
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
  
  // Button click sound (cyber)
  playButtonClick() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  // Stake placing sound (cyber)
  playStakeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(700, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Start heist sound
  playStartHeistSound() {
    this.safePlay(() => {
      // Cyber startup sequence
      const frequencies = [659.25, 830.61, 987.77]; // E5, G#5, B5
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 200);
          });
        }, index * 120);
      });
    });
  }

  // Network scanning sound
  playScanningSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 1);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 1000);
    });
  }

  // Infiltration sound
  playInfiltrationSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 300);
    });
  }

  // Data stream sound (for code rain)
  playDataStreamSound() {
    this.safePlay(() => {
      // Multiple quick beeps for data stream
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            const freq = 1000 + Math.random() * 500;
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.05);
            
            const id = Date.now() + i + freq;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 50);
          });
        }, i * 50);
      }
    });
  }

  // Hacking sound
  playHackingSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.14 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
    });
  }

  // Escape sound (covering tracks)
  playEscapeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.16 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 500);
    });
  }

  // Hack reveal sound
  playHackRevealSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.16 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Success sound (hack successful)
  playSuccessSound(tier = 'small') {
    this.safePlay(() => {
      // Different success sounds based on tier
      let frequencies;
      switch(tier) {
        case 'epic':
          frequencies = [830.61, 987.77, 1318.51, 1661.22, 1975.53]; // G#5, B5, E6, G#6, B6
          break;
        case 'large':
          frequencies = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
          break;
        case 'medium':
          frequencies = [523.25, 659.25, 830.61]; // C5, E5, G#5
          break;
        default:
          frequencies = [659.25, 830.61]; // E5, G#5
      }
      
      const durations = frequencies.map(() => 0.2);
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
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

  // Failure sound (hack failed)
  playFailureSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.6);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 600);
    });
  }

  // Alarm/alert sound (for failure with alarm)
  playAlarmSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => {
        this.cleanupOscillator(id);
      }, 200);
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
      oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Security breach detected sound
  playSecurityBreachSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
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
        if (sound.oscillator2) {
          sound.oscillator2.stop();
          sound.oscillator2.disconnect();
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
export const cyberSound = new CyberSoundManager();