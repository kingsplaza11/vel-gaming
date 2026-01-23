// src/utils/RabbitSoundManager.js
class RabbitSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('rabbit_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('rabbit_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.lastHopSound = 0;
    this.HOP_COOLDOWN = 300;
    this.gardenInterval = null;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /* =========================
     BACKGROUND MUSIC METHODS
  ========================= */
  
  // Play peaceful garden background music for rabbit
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Hop_Cute_Little_Bunny_Hop.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.1 * this.masterVolume;
      this.backgroundAudio.play().catch(e => {
        console.log('Rabbit background music play failed:', e);
        this.backgroundAudio = null;
        // Fallback to generated garden sounds
        this.playGeneratedGarden();
      });
    } catch (error) {
      console.warn('Failed to load rabbit background music:', error);
      // Fallback to generated garden sounds
      this.playGeneratedGarden();
    }
  }

  // Generate peaceful garden background sounds
  playGeneratedGarden() {
    if (this.backgroundMusicMuted || this.gardenInterval) return;
    
    this.init();
    
    // Create garden ambiance sounds
    const playGardenSound = () => {
      if (this.backgroundMusicMuted) return;
      
      // Random garden sounds (peaceful, light)
      const sounds = [
        { freq: 1200, type: 'sine', duration: 0.8, volume: 0.01 }, // Bird chirp
        { freq: 600, type: 'triangle', duration: 1, volume: 0.008 }, // Breeze
        { freq: 200, type: 'sine', duration: 1.5, volume: 0.005 }, // Gentle rumble
        { freq: 800, type: 'triangle', duration: 0.5, volume: 0.007 }, // Cricket
      ];
      
      const sound = sounds[Math.floor(Math.random() * sounds.length)];
      
      setTimeout(() => {
        if (this.backgroundMusicMuted) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(sound.volume * this.masterVolume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + sound.duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + sound.duration);
        
        const soundId = Date.now();
        this.oscillators.set(soundId, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(soundId);
        }, sound.duration * 1000);
      }, Math.random() * 8000); // Random delay
    };
    
    // Play immediately and schedule repeats
    playGardenSound();
    this.gardenInterval = setInterval(playGardenSound, 10000 + Math.random() * 5000);
  }

  // Stop background music
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
    
    if (this.gardenInterval) {
      clearInterval(this.gardenInterval);
      this.gardenInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('rabbit_bg_muted', this.backgroundMusicMuted);
    
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
    localStorage.setItem('rabbit_muted', this.isMuted);
    
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
  
  // Generate rabbit hop sound (soft, light)
  playHop() {
    if (this.isMuted) return;
    
    const now = Date.now();
    if (now - this.lastHopSound < this.HOP_COOLDOWN) return;
    
    this.lastHopSound = now;
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine'; // Soft sound
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 100);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Generate stake sound for rabbit (light coin sound)
  playStake() {
    if (this.isMuted) return;
    this.init();
    
    // Play light coin sound
    this.playCoinTinkle();
    setTimeout(() => this.playHappySqueak(), 80);
  }

  playCoinTinkle() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle'; // Light, tinkling sound
    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.15);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 150);
  }

  playHappySqueak() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.06 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted) return;
    this.init();
    
    switch (resultType) {
      case 'safe':
        this.playWinSound();
        break;
      case 'carrot_bonus':
        this.playCarrotSound();
        break;
      case 'small_win':
        this.playSmallWinSound();
        break;
      case 'penalty':
        this.playPenaltySound();
        break;
      case 'trap':
        this.playTrapSound();
        break;
      case 'reset':
        this.playResetSound();
        break;
      case 'auto_cashout':
        this.playCashoutSound();
        break;
      default:
        this.playHop();
    }
  }

  // Safe win sound (happy)
  playWinSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.15);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 150);
  }

  // Carrot bonus sound (crunchy)
  playCarrotSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  // Small win sound (light)
  playSmallWinSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.09 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 100);
  }

  // Penalty sound (sad squeak)
  playPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(500, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.25);
    
    gainNode.gain.setValueAtTime(0.11 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.25);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 250);
  }

  // Reset sound (light chime)
  playResetSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  // Trap sound (surprise squeak + thud)
  playTrapSound() {
    if (this.isMuted) return;
    
    this.playSurpriseSqueak();
    setTimeout(() => this.playThud(), 150);
  }

  playSurpriseSqueak() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  playThud() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  // Cashout sound (victory melody)
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play ascending happy notes
    const frequencies = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const durations = [0.15, 0.15, 0.15, 0.25];
    
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playVictoryNote(freq, durations[index]);
      }, index * 120);
    });
    
    // Play happy hop after notes
    setTimeout(() => this.playHappyHop(), 500);
  }

  playVictoryNote(frequency, duration) {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
    
    const id = Date.now() + frequency;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), duration * 1000);
  }

  playHappyHop() {
    if (this.isMuted) return;
    
    // Play three quick hops
    this.playHop();
    setTimeout(() => this.playHop(), 100);
    setTimeout(() => this.playHop(), 200);
  }

  // Game over sound (sad whimper)
  playGameOverSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(250, this.audioContext.currentTime + 0.4);
    
    gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.4);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 400);
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
      if (sound.timeout) {
        clearTimeout(sound.timeout);
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
  }
}

// Export singleton instance
export const rabbitSound = new RabbitSoundManager();