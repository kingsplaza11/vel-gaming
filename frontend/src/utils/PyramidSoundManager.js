// src/utils/PyramidSoundManager.js
class PyramidSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('pyramid_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('pyramid_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.ambienceInterval = null;
    this.windInterval = null;
    this.sandInterval = null;
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
  
  // Play desert background music
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Moonlight_On_Quiet_Sheets.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.09 * this.masterVolume;
      
      // Handle autoplay restrictions
      const playPromise = this.backgroundAudio.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.log('Pyramid background music play failed:', e);
          this.backgroundAudio = null;
          // Fallback to generated desert ambience
          this.playGeneratedDesert();
        });
      }
    } catch (error) {
      console.warn('Failed to load pyramid background music:', error);
      // Fallback to generated desert ambience
      this.playGeneratedDesert();
    }
  }

  // Generate desert ambience sounds
  playGeneratedDesert() {
    if (this.backgroundMusicMuted || this.ambienceInterval) return;
    
    // Initialize audio context if needed
    if (!this.init()) return;
    
    // Create desert wind sounds
    const playWindSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime + 2);
        oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime + 4);
        
        gainNode.gain.setValueAtTime(0.03 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.04 * this.masterVolume, this.audioContext.currentTime + 1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 6);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 6);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(soundId);
        }, 6000);
      });
    };
    
    // Play wind sounds continuously
    playWindSound();
    this.windInterval = setInterval(playWindSound, 8000 + Math.random() * 4000);
    
    // Start sand sounds
    this.startSandSounds();
  }

  // Play sand shifting sounds
  startSandSounds() {
    if (this.backgroundMusicMuted || this.sandInterval) return;
    
    const playSandSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(250, this.audioContext.currentTime + 1);
        
        gainNode.gain.setValueAtTime(0.02 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 1);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => this.cleanupOscillator(soundId), 1000);
      });
    };
    
    playSandSound();
    this.sandInterval = setInterval(playSandSound, 3000 + Math.random() * 2000);
  }

  // Play torch sounds (for exploration phase)
  playTorchSounds() {
    if (this.backgroundMusicMuted) return;
    
    const playTorchSound = () => {
      if (this.backgroundMusicMuted) return;
      
      this.safePlay(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.03 * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.5);
        
        const id = Date.now();
        this.oscillators.set(id, { oscillator, gainNode });
        
        setTimeout(() => this.cleanupOscillator(id), 500);
      });
    };
    
    // Play torch sound continuously
    playTorchSound();
    return setInterval(playTorchSound, 600 + Math.random() * 400);
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
    
    if (this.windInterval) {
      clearInterval(this.windInterval);
      this.windInterval = null;
    }
    
    if (this.sandInterval) {
      clearInterval(this.sandInterval);
      this.sandInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('pyramid_bg_muted', this.backgroundMusicMuted);
    
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
    localStorage.setItem('pyramid_muted', this.isMuted);
    
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
  
  // Button click sound
  playButtonClick() {
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

  // Stake placing sound
  playStakeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(350, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(550, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Start expedition sound
  playStartExpeditionSound() {
    this.safePlay(() => {
      // Epic adventure start sound
      const frequencies = [293.66, 369.99, 440.00]; // D4, F#4, A4
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 300);
          });
        }, index * 150);
      });
    });
  }

  // Sandstorm sound
  playSandstormSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(250, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 1);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime + 0.5);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 1.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 1500);
    });
  }

  // Pyramid entrance sound
  playPyramidEntrance() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 500);
    });
  }

  // Footstep sounds
  playFootstepSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  // Chamber discovery sound
  playChamberDiscovery() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.14 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
    });
  }

  // Artifact reveal sound
  playArtifactReveal(rarity = 'common') {
    this.safePlay(() => {
      let frequency;
      switch(rarity) {
        case 'legendary':
          frequency = 1200;
          break;
        case 'epic':
          frequency = 900;
          break;
        case 'rare':
          frequency = 700;
          break;
        default:
          frequency = 500;
      }
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.3, this.audioContext.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.16 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.25);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 250);
    });
  }

  // Trap trigger sound
  playTrapSound() {
    this.safePlay(() => {
      // Sudden, sharp sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.3);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 300);
    });
  }

  // Success sound (treasure found)
  playSuccessSound() {
    this.safePlay(() => {
      // Victory fanfare
      const frequencies = [659.25, 783.99, 987.77, 1318.51]; // E5, G5, B5, E6
      const durations = [0.2, 0.2, 0.25, 0.3];
      
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
        }, index * 120);
      });
    });
  }

  // Big win sound (epic expedition)
  playBigWinSound() {
    this.safePlay(() => {
      // Epic victory fanfare
      const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5, E5, G5, C6, E6, G6
      const durations = [0.15, 0.15, 0.15, 0.2, 0.25, 0.3];
      
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
        }, index * 80);
      });
    });
  }

  // Failure sound (curse)
  playFailureSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(350, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.5);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 500);
    });
  }

  // Ancient curse sound
  playCurseSound() {
    this.safePlay(() => {
      // Discordant, eerie sound
      const oscillator1 = this.audioContext.createOscillator();
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator1.type = 'square';
      oscillator2.type = 'sawtooth';
      oscillator1.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator2.frequency.setValueAtTime(310, this.audioContext.currentTime); // Dissonance
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(this.audioContext.currentTime + 0.8);
      oscillator2.stop(this.audioContext.currentTime + 0.8);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator: oscillator1, oscillator2, gainNode });
      
      setTimeout(() => {
        try {
          oscillator1.stop();
          oscillator2.stop();
          oscillator1.disconnect();
          oscillator2.disconnect();
          gainNode.disconnect();
        } catch (e) {}
        this.oscillators.delete(id);
      }, 800);
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
      oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.16 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
    });
  }

  // Danger warning sound
  playDangerSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.14 * this.masterVolume, this.audioContext.currentTime);
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
      this.backgroundAudio.volume = 0.09 * this.masterVolume;
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
export const pyramidSound = new PyramidSoundManager();