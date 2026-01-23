// src/utils/FortuneSoundManager.js
class FortuneSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('fortune_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  // Play background music from your sounds folder
  playBackgroundMusic() {
    if (this.isMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/backroads_loading_screen.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.2 * this.masterVolume; // 20% volume
      this.backgroundAudio.play().catch(e => {
        console.log('Background music play failed:', e);
        this.backgroundAudio = null;
      });
    } catch (error) {
      console.warn('Failed to load background music:', error);
      this.backgroundAudio = null;
    }
  }

  // Stop background music
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
  }

  // Generate click sound using Web Audio API
  playClick() {
    if (this.isMuted) return;
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 100);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Generate stake sound
  playStake() {
    if (this.isMuted) return;
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 300);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted) return;
    this.init();
    
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
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(1046.50, this.audioContext.currentTime + 0.5); // C6
    
    gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 500);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Small win sound
  playSmallWinSound() {
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(392.00, this.audioContext.currentTime); // G4
    oscillator.frequency.exponentialRampToValueAtTime(523.25, this.audioContext.currentTime + 0.3); // C5
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 300);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Penalty sound
  playPenaltySound() {
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(349.23, this.audioContext.currentTime); // F4
    oscillator.frequency.exponentialRampToValueAtTime(261.63, this.audioContext.currentTime + 0.4); // C4
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 400);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Reset sound
  playResetSound() {
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.3); // A3
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 300);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Trap sound
  playTrapSound() {
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 500);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Cashout sound
  playCashoutSound() {
    this.init();
    
    const times = [0, 0.1, 0.2, 0.3];
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const volumes = [0.2, 0.25, 0.3, 0.35];
    
    times.forEach((time, i) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequencies[i], this.audioContext.currentTime + time);
      
      gainNode.gain.setValueAtTime(volumes[i] * this.masterVolume, this.audioContext.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + time + 0.2);
      
      oscillator.start(this.audioContext.currentTime + time);
      oscillator.stop(this.audioContext.currentTime + time + 0.2);
      
      const id = Date.now() + i;
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, time * 1000 + 200);
      
      this.oscillators.get(id).timeout = timeout;
    });
  }

  // Game over sound
  playGameOverSound() {
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 800);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Cleanup individual oscillator
  cleanupOscillator(id) {
    const sound = this.oscillators.get(id);
    if (sound) {
      try {
        sound.oscillator.stop();
        sound.oscillator.disconnect();
        sound.gainNode.disconnect();
      } catch (e) {
        // Sound already stopped
      }
      clearTimeout(sound.timeout);
      this.oscillators.delete(id);
    }
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('fortune_muted', this.isMuted);
    
    if (this.isMuted) {
      this.stopBackgroundMusic();
      // Cleanup all oscillators
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
    } else {
      this.playBackgroundMusic();
    }
    
    return this.isMuted;
  }

  // Set volume
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.backgroundAudio) {
      this.backgroundAudio.volume = 0.2 * this.masterVolume;
    }
  }

  // Cleanup everything
  cleanup() {
    this.stopBackgroundMusic();
    this.oscillators.forEach((sound, id) => {
      this.cleanupOscillator(id);
    });
    this.oscillators.clear();
  }
}

// Export singleton instance
export const fortuneSound = new FortuneSoundManager();