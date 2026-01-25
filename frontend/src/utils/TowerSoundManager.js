// src/utils/TowerSoundManager.js
class TowerSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('tower_sounds_muted') === 'true';
    this.masterVolume = 0.5;
    this.activeSounds = new Set();
    this.isInitialized = false;
    this.backgroundMusic = null;
    this.backgroundMusicVolume = 0.3;
  }

  // Initialize Web Audio API
  init() {
    if (this.isInitialized) return true;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      return false;
    }
  }

  // Safe sound play method
  safePlay(callback) {
    if (this.isMuted) return;
    
    if (!this.isInitialized) {
      if (!this.init()) {
        console.warn('Cannot play sound: AudioContext initialization failed');
        return;
      }
    }
    
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        callback();
      }).catch(console.warn);
    } else {
      callback();
    }
  }

  /* =========================
     CONSTRUCTION SOUNDS
  ========================= */
  
  // Button click sound
  playButtonClick() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      this.registerSound(oscillator, gainNode);
    });
  }

  // Game start sound (construction begins)
  playGameStart() {
    this.safePlay(() => {
      // Construction site ambience start
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      
      oscillator1.type = 'sawtooth';
      oscillator1.frequency.setValueAtTime(150, this.audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.5);
      
      gainNode1.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator1.start();
      oscillator1.stop(this.audioContext.currentTime + 0.5);
      
      this.registerSound(oscillator1, gainNode1);
      
      // Truck horn
      setTimeout(() => {
        this.safePlay(() => {
          const oscillator2 = this.audioContext.createOscillator();
          const gainNode2 = this.audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(this.audioContext.destination);
          
          oscillator2.type = 'square';
          oscillator2.frequency.setValueAtTime(200, this.audioContext.currentTime);
          oscillator2.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.3);
          
          gainNode2.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
          
          oscillator2.start();
          oscillator2.stop(this.audioContext.currentTime + 0.3);
          
          this.registerSound(oscillator2, gainNode2);
        });
      }, 300);
    });
  }

  // Building a floor sound
  playBuildFloor(floorNumber) {
    this.safePlay(() => {
      // Hammer sound
      const hammerOscillator = this.audioContext.createOscillator();
      const hammerGain = this.audioContext.createGain();
      
      hammerOscillator.connect(hammerGain);
      hammerGain.connect(this.audioContext.destination);
      
      hammerOscillator.type = 'square';
      hammerOscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      hammerOscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.05);
      
      hammerGain.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      hammerGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
      
      hammerOscillator.start();
      hammerOscillator.stop(this.audioContext.currentTime + 0.05);
      
      this.registerSound(hammerOscillator, hammerGain);
      
      // Crane sound for higher floors
      if (floorNumber > 5) {
        setTimeout(() => {
          this.safePlay(() => {
            const craneOscillator = this.audioContext.createOscillator();
            const craneGain = this.audioContext.createGain();
            
            craneOscillator.connect(craneGain);
            craneGain.connect(this.audioContext.destination);
            
            craneOscillator.type = 'sine';
            craneOscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
            craneOscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.2);
            
            craneGain.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
            craneGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
            
            craneOscillator.start();
            craneOscillator.stop(this.audioContext.currentTime + 0.2);
            
            this.registerSound(craneOscillator, craneGain);
          });
        }, 50);
      }
      
      // Success chime (higher pitch for higher floors)
      setTimeout(() => {
        this.safePlay(() => {
          const successOscillator = this.audioContext.createOscillator();
          const successGain = this.audioContext.createGain();
          
          successOscillator.connect(successGain);
          successGain.connect(this.audioContext.destination);
          
          const baseFreq = 400 + (floorNumber * 20);
          successOscillator.type = 'triangle';
          successOscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
          successOscillator.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, this.audioContext.currentTime + 0.1);
          
          successGain.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
          successGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
          
          successOscillator.start();
          successOscillator.stop(this.audioContext.currentTime + 0.1);
          
          this.registerSound(successOscillator, successGain);
        });
      }, 100);
    });
  }

  // Tower crash/explosion sound
  playTowerCrash() {
    this.safePlay(() => {
      // Rumbling before crash
      const rumbleOscillator = this.audioContext.createOscillator();
      const rumbleGain = this.audioContext.createGain();
      
      rumbleOscillator.connect(rumbleGain);
      rumbleGain.connect(this.audioContext.destination);
      
      rumbleOscillator.type = 'sawtooth';
      rumbleOscillator.frequency.setValueAtTime(60, this.audioContext.currentTime);
      rumbleOscillator.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.8);
      
      rumbleGain.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
      
      rumbleOscillator.start();
      rumbleOscillator.stop(this.audioContext.currentTime + 0.8);
      
      this.registerSound(rumbleOscillator, rumbleGain);
      
      // Explosion sound
      setTimeout(() => {
        this.safePlay(() => {
          const explosionOscillator = this.audioContext.createOscillator();
          const explosionGain = this.audioContext.createGain();
          
          explosionOscillator.connect(explosionGain);
          explosionGain.connect(this.audioContext.destination);
          
          explosionOscillator.type = 'square';
          explosionOscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
          explosionOscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
          
          explosionGain.gain.setValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime);
          explosionGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
          
          explosionOscillator.start();
          explosionOscillator.stop(this.audioContext.currentTime + 0.3);
          
          this.registerSound(explosionOscillator, explosionGain);
        });
      }, 400);
      
      // Debris falling
      setTimeout(() => {
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            this.safePlay(() => {
              const debrisOscillator = this.audioContext.createOscillator();
              const debrisGain = this.audioContext.createGain();
              
              debrisOscillator.connect(debrisGain);
              debrisGain.connect(this.audioContext.destination);
              
              debrisOscillator.type = 'sine';
              debrisOscillator.frequency.setValueAtTime(200 + (i * 50), this.audioContext.currentTime);
              debrisOscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.2);
              
              debrisGain.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
              debrisGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
              
              debrisOscillator.start();
              debrisOscillator.stop(this.audioContext.currentTime + 0.2);
              
              this.registerSound(debrisOscillator, debrisGain);
            });
          }, i * 150);
        }
      }, 600);
    });
  }

  // Cash out sound (coins/treasure)
  playCashOut() {
    this.safePlay(() => {
      // Coin collection sequence
      const coinFrequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      coinFrequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.15);
            
            this.registerSound(oscillator, gainNode);
          });
        }, index * 80);
      });
      
      // Cash register "cha-ching"
      setTimeout(() => {
        this.safePlay(() => {
          const registerOscillator1 = this.audioContext.createOscillator();
          const registerGain1 = this.audioContext.createGain();
          const registerOscillator2 = this.audioContext.createOscillator();
          const registerGain2 = this.audioContext.createGain();
          
          registerOscillator1.connect(registerGain1);
          registerGain1.connect(this.audioContext.destination);
          registerOscillator2.connect(registerGain2);
          registerGain2.connect(this.audioContext.destination);
          
          registerOscillator1.type = 'square';
          registerOscillator1.frequency.setValueAtTime(800, this.audioContext.currentTime);
          registerOscillator1.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.2);
          
          registerOscillator2.type = 'square';
          registerOscillator2.frequency.setValueAtTime(1200, this.audioContext.currentTime);
          registerOscillator2.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.2);
          
          registerGain1.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
          registerGain1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
          registerGain2.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
          registerGain2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
          
          registerOscillator1.start();
          registerOscillator2.start();
          registerOscillator1.stop(this.audioContext.currentTime + 0.2);
          registerOscillator2.stop(this.audioContext.currentTime + 0.2);
          
          this.registerSound(registerOscillator1, registerGain1);
          this.registerSound(registerOscillator2, registerGain2);
        });
      }, 350);
    });
  }

  // Victory celebration (tower complete)
  playVictoryCelebration() {
    this.safePlay(() => {
      // Victory fanfare
      const fanfareNotes = [
        { freq: 523.25, duration: 0.2 }, // C5
        { freq: 659.25, duration: 0.2 }, // E5
        { freq: 783.99, duration: 0.2 }, // G5
        { freq: 1046.50, duration: 0.4 }, // C6
        { freq: 1318.51, duration: 0.4 }, // E6
        { freq: 1567.98, duration: 0.4 }, // G6
        { freq: 2093.00, duration: 0.6 }, // C7
      ];
      
      fanfareNotes.forEach((note, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = index < 4 ? 'square' : 'triangle';
            oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + note.duration);
            
            this.registerSound(oscillator, gainNode);
          });
        }, index * 200);
      });
      
      // Crowd cheer
      setTimeout(() => {
        this.safePlay(() => {
          // Multiple oscillators for crowd effect
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              const crowdOscillator = this.audioContext.createOscillator();
              const crowdGain = this.audioContext.createGain();
              
              crowdOscillator.connect(crowdGain);
              crowdGain.connect(this.audioContext.destination);
              
              const freq = 400 + (Math.random() * 200);
              crowdOscillator.type = 'sawtooth';
              crowdOscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
              crowdOscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioContext.currentTime + 0.5);
              
              crowdGain.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
              crowdGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
              
              crowdOscillator.start();
              crowdOscillator.stop(this.audioContext.currentTime + 0.5);
              
              this.registerSound(crowdOscillator, crowdGain);
            }, i * 100);
          }
        });
      }, 1400);
    });
  }

  // Background construction ambience
  playConstructionAmbience() {
    this.safePlay(() => {
      if (this.backgroundMusic) {
        this.backgroundMusic.stop();
      }
      
      // Low rumble (machinery)
      const rumbleOscillator = this.audioContext.createOscillator();
      const rumbleGain = this.audioContext.createGain();
      
      rumbleOscillator.connect(rumbleGain);
      rumbleGain.connect(this.audioContext.destination);
      
      rumbleOscillator.type = 'sine';
      rumbleOscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
      
      // Add slight variation
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      lfo.connect(lfoGain);
      lfoGain.connect(rumbleOscillator.frequency);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.5, this.audioContext.currentTime);
      lfoGain.gain.setValueAtTime(5, this.audioContext.currentTime);
      
      rumbleGain.gain.setValueAtTime(0.1 * this.masterVolume * this.backgroundMusicVolume, this.audioContext.currentTime);
      
      rumbleOscillator.start();
      lfo.start();
      
      this.backgroundMusic = {
        oscillator: rumbleOscillator,
        gain: rumbleGain,
        lfo: lfo,
        lfoGain: lfoGain
      };
      
      // Occasional construction sounds
      setInterval(() => {
        if (!this.isMuted && Math.random() > 0.7) {
          this.safePlay(() => {
            const randomSound = this.audioContext.createOscillator();
            const randomGain = this.audioContext.createGain();
            
            randomSound.connect(randomGain);
            randomGain.connect(this.audioContext.destination);
            
            randomSound.type = ['sawtooth', 'square', 'triangle'][Math.floor(Math.random() * 3)];
            randomSound.frequency.setValueAtTime(100 + Math.random() * 200, this.audioContext.currentTime);
            
            randomGain.gain.setValueAtTime(0.05 * this.masterVolume * this.backgroundMusicVolume, this.audioContext.currentTime);
            randomGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
            
            randomSound.start();
            randomSound.stop(this.audioContext.currentTime + 0.1);
            
            this.registerSound(randomSound, randomGain);
          });
        }
      }, 3000);
    });
  }

  // Stop background music
  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.oscillator.stop();
      this.backgroundMusic.lfo.stop();
      this.backgroundMusic.oscillator.disconnect();
      this.backgroundMusic.gain.disconnect();
      this.backgroundMusic.lfo.disconnect();
      this.backgroundMusic.lfoGain.disconnect();
      this.backgroundMusic = null;
    }
  }

  // Height selection sound
  playHeightSelect() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(700, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      this.registerSound(oscillator, gainNode);
    });
  }

  // Stake amount selection sound
  playStakeSelect() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.08);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.08);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.08);
      
      this.registerSound(oscillator, gainNode);
    });
  }

  // Warning/risk sound
  playWarningSound() {
    this.safePlay(() => {
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode2 = this.audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      oscillator2.connect(gainNode2);
      gainNode2.connect(this.audioContext.destination);
      
      oscillator1.type = 'square';
      oscillator1.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator2.type = 'square';
      oscillator2.frequency.setValueAtTime(600, this.audioContext.currentTime);
      
      gainNode1.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      gainNode2.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(this.audioContext.currentTime + 0.3);
      oscillator2.stop(this.audioContext.currentTime + 0.3);
      
      this.registerSound(oscillator1, gainNode1);
      this.registerSound(oscillator2, gainNode2);
    });
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle mute for game sounds
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('tower_sounds_muted', this.isMuted);
    
    if (this.isMuted) {
      this.stopAllSounds();
      this.stopBackgroundMusic();
    } else {
      this.init(); // Reinitialize if needed
    }
    
    return this.isMuted;
  }

  // Set master volume (0.0 to 1.0)
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    // Update background music volume if playing
    if (this.backgroundMusic) {
      this.backgroundMusic.gain.gain.setValueAtTime(0.1 * this.masterVolume * this.backgroundMusicVolume, this.audioContext.currentTime);
    }
  }

  // Set background music volume
  setBackgroundVolume(volume) {
    this.backgroundMusicVolume = Math.max(0, Math.min(1, volume));
    
    if (this.backgroundMusic) {
      this.backgroundMusic.gain.gain.setValueAtTime(0.1 * this.masterVolume * this.backgroundMusicVolume, this.audioContext.currentTime);
    }
  }

  // Get current mute state
  getMuteState() {
    return {
      gameSoundsMuted: this.isMuted,
      masterVolume: this.masterVolume,
      backgroundVolume: this.backgroundMusicVolume
    };
  }

  /* =========================
     UTILITY METHODS
  ========================= */
  
  // Register sound for cleanup
  registerSound(oscillator, gainNode) {
    const id = Date.now() + Math.random();
    this.oscillators.set(id, { oscillator, gainNode });
    
    // Auto cleanup after reasonable time
    const duration = 1000; // 1 second default
    setTimeout(() => {
      this.cleanupSound(id);
    }, duration);
  }

  // Cleanup individual sound
  cleanupSound(id) {
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

  // Stop all active sounds
  stopAllSounds() {
    this.oscillators.forEach((sound, id) => {
      this.cleanupSound(id);
    });
    this.oscillators.clear();
  }

  // Cleanup everything
  cleanup() {
    this.stopAllSounds();
    this.stopBackgroundMusic();
    
    this.isInitialized = false;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  // Preview all sounds (for testing)
  previewAllSounds() {
    const sounds = [
      { name: 'Button Click', play: () => this.playButtonClick() },
      { name: 'Game Start', play: () => this.playGameStart() },
      { name: 'Build Floor', play: () => this.playBuildFloor(1) },
      { name: 'Height Select', play: () => this.playHeightSelect() },
      { name: 'Stake Select', play: () => this.playStakeSelect() },
      { name: 'Warning', play: () => this.playWarningSound() },
      { name: 'Cash Out', play: () => this.playCashOut() },
      { name: 'Tower Crash', play: () => this.playTowerCrash() },
      { name: 'Victory', play: () => this.playVictoryCelebration() },
    ];

    sounds.forEach((sound, index) => {
      setTimeout(() => {
        console.log(`Playing: ${sound.name}`);
        sound.play();
      }, index * 500);
    });
  }
}

// Export singleton instance
export const towerSound = new TowerSoundManager();