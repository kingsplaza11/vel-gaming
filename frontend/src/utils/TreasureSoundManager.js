// src/utils/TreasureSoundManager.js
class TreasureSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('treasure_muted') === 'true';
    this.masterVolume = 0.5; // Reduced from 0.7 for more subtle sounds
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
     CALM & SUBTLE GAME SOUNDS
  ========================= */
  
  // Map selection sound (gentle click with soft tone)
  playMapSelectSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.1); // C5
      
      gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime); // Reduced volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  // Stake placement sound (soft chime)
  playStakeSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(392.00, this.audioContext.currentTime); // G4
      oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.15); // C5
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.15);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 150);
    });
  }

  // Expedition start sound (gentle launch)
  playExpeditionStartSound() {
    this.safePlay(() => {
      // Gentle rising tone
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine'; // Changed from sawtooth for softer sound
      oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3
      oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.6); // A4
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 600);
    });
  }

  // Sailing phase sound (gentle waves)
  playSailingSound() {
    this.safePlay(() => {
      // Soft wave-like sounds
      const frequencies = [120, 180, 220];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine'; // Always sine for calmness
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(freq * 0.9, this.audioContext.currentTime + 0.8);
            
            gainNode.gain.setValueAtTime((0.06 - index * 0.015) * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.8);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), 800);
          });
        }, index * 250);
      });
    });
  }

  // Scanning phase sound (soft radar ping)
  playScanningSound() {
    this.safePlay(() => {
      // Gentle radar ping
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(660, this.audioContext.currentTime); // E5
      oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.08); // A5
      oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.16); // C5
      
      gainNode.gain.setValueAtTime(0.09 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.12, this.audioContext.currentTime + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.16);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.16);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 160);
      
      // Play every 1.2 seconds for gentle radar effect
      this.scanInterval = setInterval(() => {
        if (!this.isMuted) this.playScanningSound();
      }, 1200);
    });
  }

  // Stop scanning sound
  stopScanningSound() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  // Digging phase sound (gentle digging)
  playDiggingSound() {
    this.safePlay(() => {
      // Soft digging sound
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine'; // Changed from square for softer sound
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
      oscillator.frequency.setValueAtTime(160, this.audioContext.currentTime + 0.12);
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime + 0.24);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.36);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.36);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 360);
      
      // Play digging sound every 0.6 seconds (slower, gentler)
      this.digInterval = setInterval(() => {
        if (!this.isMuted) this.playDiggingSound();
      }, 600);
    });
  }

  // Stop digging sound
  stopDiggingSound() {
    if (this.digInterval) {
      clearInterval(this.digInterval);
      this.digInterval = null;
    }
  }

  // Treasure reveal sound (calm chimes based on tier)
  playTreasureRevealSound(tier) {
    this.safePlay(() => {
      const frequencies = {
        small: [523.25, 659.25, 783.99], // C5, E5, G5
        low: [659.25, 783.99, 880.00],   // E5, G5, A5
        normal: [783.99, 987.77, 1174.66], // G5, B5, D6
        high: [1046.50, 1318.51, 1567.98], // C6, E6, G6
        great: [1567.98, 1975.53, 2637.02], // G6, B6, E7
        loss: [174.61, 155.56, 138.59] // F3, D#3, C#3 - soft descending
      };
      
      const currentFreqs = frequencies[tier] || frequencies.small;
      const durations = tier === 'loss' ? [0.4, 0.4, 0.6] : [0.2, 0.2, 0.4];
      
      // Soft chest opening sound for wins
      if (tier !== 'loss') {
        const chestOscillator = this.audioContext.createOscillator();
        const chestGain = this.audioContext.createGain();
        
        chestOscillator.connect(chestGain);
        chestGain.connect(this.audioContext.destination);
        
        chestOscillator.type = 'sine'; // Softer than sawtooth
        chestOscillator.frequency.setValueAtTime(130.81, this.audioContext.currentTime); // C3
        chestOscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.5);
        
        chestGain.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
        chestGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
        
        chestOscillator.start();
        chestOscillator.stop(this.audioContext.currentTime + 0.5);
        
        const chestId = Date.now();
        this.oscillators.set(chestId, { oscillator: chestOscillator, gainNode: chestGain });
        
        setTimeout(() => this.cleanupOscillator(chestId), 500);
      }
      
      // Calm chimes with delays
      setTimeout(() => {
        currentFreqs.forEach((freq, index) => {
          setTimeout(() => {
            this.safePlay(() => {
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);
              
              oscillator.type = 'triangle'; // Always triangle for calm chimes
              oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
              
              gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + durations[index]);
              
              oscillator.start();
              oscillator.stop(this.audioContext.currentTime + durations[index]);
              
              const id = Date.now() + freq + index;
              this.oscillators.set(id, { oscillator, gainNode });
              
              setTimeout(() => this.cleanupOscillator(id), durations[index] * 1000);
            });
          }, index * (tier === 'loss' ? 300 : 150)); // Slower pacing
        });
      }, tier === 'loss' ? 100 : 200);
    });
  }

  // Individual treasure found sound (soft bell)
  playTreasureFoundSound(valueMultiplier) {
    this.safePlay(() => {
      const baseFreq = 440; // A4
      const multiplierFreq = baseFreq * (1 + (valueMultiplier * 0.08)); // Less dramatic variation
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(baseFreq, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(multiplierFreq, this.audioContext.currentTime + 0.25);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.25);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 250);
    });
  }

  // Gold/coin collection sound (soft tinkle)
  playCoinSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1046.50, this.audioContext.currentTime); // C6
      oscillator.frequency.exponentialRampToValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.11 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.2);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => this.cleanupOscillator(id), 200);
    });
  }

  // Win celebration (gentle fanfare)
  playBigWinCelebration() {
    this.safePlay(() => {
      // Gentle ascending arpeggio
      const frequencies = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C4, E4, G4, C5, E5, G5
      const durations = [0.15, 0.15, 0.15, 0.2, 0.25, 0.3];
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine'; // Changed to sine for softer sound
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            // Add subtle vibrato for musical quality
            if (durations[index] > 0.2) {
              const vibrato = this.audioContext.createOscillator();
              const vibratoGain = this.audioContext.createGain();
              
              vibrato.connect(vibratoGain);
              vibratoGain.connect(oscillator.frequency);
              
              vibrato.type = 'sine';
              vibrato.frequency.setValueAtTime(6, this.audioContext.currentTime);
              vibratoGain.gain.setValueAtTime(freq * 0.01, this.audioContext.currentTime);
              
              vibrato.start();
              vibrato.stop(this.audioContext.currentTime + durations[index]);
              
              setTimeout(() => {
                vibrato.disconnect();
                vibratoGain.disconnect();
              }, durations[index] * 1000);
            }
            
            gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + durations[index]);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + durations[index]);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            
            setTimeout(() => this.cleanupOscillator(id), durations[index] * 1000);
          });
        }, index * 100); // Slower pacing
      });
      
      // Gentle sparkle sounds
      setTimeout(() => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => {
            this.safePlay(() => {
              const oscillator = this.audioContext.createOscillator();
              const gainNode = this.audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(this.audioContext.destination);
              
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(1567.98 + (i * 100), this.audioContext.currentTime); // G6 and up
              oscillator.frequency.exponentialRampToValueAtTime(1046.50, this.audioContext.currentTime + 0.15); // Down to C6
              
              gainNode.gain.setValueAtTime(0.07 * this.masterVolume, this.audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
              
              oscillator.start();
              oscillator.stop(this.audioContext.currentTime + 0.15);
              
              const id = Date.now() + i;
              this.oscillators.set(id, { oscillator, gainNode });
              
              setTimeout(() => this.cleanupOscillator(id), 150);
            });
          }, i * 80);
        }
      }, 600);
    });
  }

  // Ambient wind sound (optional, can be called separately)
  playAmbientWind() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 4);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
      filter.Q.setValueAtTime(1, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.04 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 4);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 4);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode, filter });
      
      setTimeout(() => this.cleanupOscillator(id), 4000);
    });
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle mute for game sounds
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('treasure_muted', this.isMuted);
    
    if (this.isMuted) {
      // Stop all active sounds when muted
      this.stopScanningSound();
      this.stopDiggingSound();
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
    }
    
    return this.isMuted;
  }

  // Get current mute state
  getMuteState() {
    return {
      gameSoundsMuted: this.isMuted
    };
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
        if (sound.filter) {
          sound.filter.disconnect();
        }
      } catch (e) {
        // Sound already stopped
      }
      this.oscillators.delete(id);
    }
  }

  // Set master volume (reduced range for subtlety)
  setVolume(volume) {
    this.masterVolume = Math.max(0.1, Math.min(0.7, volume)); // Cap at 0.7 for subtlety
  }

  // Cleanup everything
  cleanup() {
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