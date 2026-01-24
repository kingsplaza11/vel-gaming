// src/utils/MinesweeperSoundManager.js
class MinesweeperSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('minesweeper_muted') === 'true';
    this.masterVolume = 0.4; // Lower volume for arcade sounds
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
     ARCADY GAME SOUNDS
  ========================= */
  
  // Button click sound (retro beep)
  playButtonClick() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square'; // Retro square wave
      oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.05);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 50);
    });
  }

  // Start game sound (arcade startup)
  playGameStart() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.3);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.6);
      
      gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.6);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 600);
    });
  }

  // Safe cell reveal sound (retro positive beep)
  playSafeReveal() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.1);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 100);
    });
  }

  // Mine hit sound (explosion)
  playMineHit() {
    this.safePlay(() => {
      // Low explosion rumble
      const oscillator1 = this.audioContext.createOscillator();
      const gainNode1 = this.audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(this.audioContext.destination);
      
      oscillator1.type = 'sawtooth';
      oscillator1.frequency.setValueAtTime(80, this.audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.5);
      
      gainNode1.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator1.start();
      oscillator1.stop(this.audioContext.currentTime + 0.5);
      
      // High explosion crackle
      setTimeout(() => {
        this.safePlay(() => {
          const oscillator2 = this.audioContext.createOscillator();
          const gainNode2 = this.audioContext.createGain();
          
          oscillator2.connect(gainNode2);
          gainNode2.connect(this.audioContext.destination);
          
          oscillator2.type = 'square';
          oscillator2.frequency.setValueAtTime(1000, this.audioContext.currentTime);
          oscillator2.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
          
          gainNode2.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
          gainNode2.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
          
          oscillator2.start();
          oscillator2.stop(this.audioContext.currentTime + 0.3);
          
          const id2 = Date.now();
          this.oscillators.set(id2, { oscillator: oscillator2, gainNode: gainNode2 });
          setTimeout(() => this.cleanupOscillator(id2), 300);
        });
      }, 50);
      
      const id1 = Date.now();
      this.oscillators.set(id1, { oscillator: oscillator1, gainNode: gainNode1 });
      setTimeout(() => this.cleanupOscillator(id1), 500);
    });
  }

  // Cash out sound (coin collection)
  playCashOut() {
    this.safePlay(() => {
      const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      frequencies.forEach((freq, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.15);
            
            const id = Date.now() + freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            setTimeout(() => this.cleanupOscillator(id), 150);
          });
        }, index * 50);
      });
    });
  }

  // Win celebration (arcade victory jingle)
  playWinCelebration() {
    this.safePlay(() => {
      const melody = [
        { freq: 523.25, duration: 0.15 }, // C5
        { freq: 659.25, duration: 0.15 }, // E5
        { freq: 783.99, duration: 0.15 }, // G5
        { freq: 1046.50, duration: 0.3 }, // C6
        { freq: 1318.51, duration: 0.3 }, // E6
        { freq: 1567.98, duration: 0.3 }, // G6
      ];
      
      melody.forEach((note, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = index < 3 ? 'square' : 'triangle'; // Mix of waves
            oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + note.duration);
            
            const id = Date.now() + note.freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            setTimeout(() => this.cleanupOscillator(id), note.duration * 1000);
          });
        }, index * 150);
      });
    });
  }

  // Loss sound (descending sad tone)
  playLossSound() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.5); // A3
      
      gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.5);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 500);
    });
  }

  // Game over sound (arcade game over)
  playGameOver() {
    this.safePlay(() => {
      const notes = [
        { freq: 392, duration: 0.2 }, // G4
        { freq: 349.23, duration: 0.2 }, // F4
        { freq: 329.63, duration: 0.2 }, // E4
        { freq: 293.66, duration: 0.4 }, // D4
      ];
      
      notes.forEach((note, index) => {
        setTimeout(() => {
          this.safePlay(() => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + note.duration);
            
            const id = Date.now() + note.freq + index;
            this.oscillators.set(id, { oscillator, gainNode });
            setTimeout(() => this.cleanupOscillator(id), note.duration * 1000);
          });
        }, index * 200);
      });
    });
  }

  // Grid selection sound (retro blip)
  playGridSelect() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.05);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.05);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 50);
    });
  }

  // Mine count selection sound (beep)
  playMineSelect() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.08);
      
      gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.08);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.08);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 80);
    });
  }

  // Tick sound (for countdown or timer)
  playTick() {
    this.safePlay(() => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.03);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.03);
      
      const id = Date.now();
      this.oscillators.set(id, { oscillator, gainNode });
      setTimeout(() => this.cleanupOscillator(id), 30);
    });
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle mute for game sounds
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('minesweeper_muted', this.isMuted);
    
    if (this.isMuted) {
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
      } catch (e) {
        // Sound already stopped
      }
      this.oscillators.delete(id);
    }
  }

  // Set master volume
  setVolume(volume) {
    this.masterVolume = Math.max(0.1, Math.min(1, volume));
  }

  // Cleanup everything
  cleanup() {
    this.oscillators.forEach((sound, id) => {
      this.cleanupOscillator(id);
    });
    this.oscillators.clear();
    
    this.isInitialized = false;
    this.audioContext = null;
  }
}

// Export singleton instance
export const minesweeperSound = new MinesweeperSoundManager();