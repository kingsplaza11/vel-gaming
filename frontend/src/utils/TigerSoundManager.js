// src/utils/TigerSoundManager.js
class TigerSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('tiger_muted') === 'true';
    this.backgroundMusicMuted = localStorage.getItem('tiger_bg_muted') === 'true';
    this.backgroundAudio = null;
    this.masterVolume = 0.7;
    this.lastTigerRoar = 0;
    this.ROAR_COOLDOWN = 2000; // 2 seconds between roars
    this.jungleInterval = null;
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
  
  // Play jungle/forest background music for tiger
  playBackgroundMusic() {
    if (this.backgroundMusicMuted || this.backgroundAudio) return;
    
    try {
      this.backgroundAudio = new Audio('/sounds/Eye_of_the_Tiger.mp3');
      this.backgroundAudio.loop = true;
      this.backgroundAudio.volume = 0.15 * this.masterVolume;
      this.backgroundAudio.play().catch(e => {
        console.log('Tiger background music play failed:', e);
        this.backgroundAudio = null;
        // Fallback to generated jungle sounds
        this.playGeneratedJungle();
      });
    } catch (error) {
      console.warn('Failed to load tiger background music:', error);
      // Fallback to generated jungle sounds
      this.playGeneratedJungle();
    }
  }

  // Generate jungle background sounds if audio file fails
  playGeneratedJungle() {
    if (this.backgroundMusicMuted || this.jungleInterval) return;
    
    this.init();
    
    // Create multiple oscillators for jungle ambiance
    const playJungleSound = () => {
      if (this.backgroundMusicMuted) return;
      
      // Random jungle sounds
      const sounds = [
        { freq: 80, type: 'sine', duration: 3, volume: 0.02 }, // Deep jungle rumble
        { freq: 2000, type: 'triangle', duration: 0.5, volume: 0.015 }, // Bird chirp
        { freq: 400, type: 'sine', duration: 1, volume: 0.01 }, // Wind
        { freq: 120, type: 'sawtooth', duration: 2, volume: 0.01 }, // Animal sound
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
      }, Math.random() * 5000); // Random delay
    };
    
    // Play immediately and schedule repeats
    playJungleSound();
    this.jungleInterval = setInterval(playJungleSound, 8000 + Math.random() * 4000);
  }

  // Stop background music
  stopBackgroundMusic() {
    if (this.backgroundAudio) {
      this.backgroundAudio.pause();
      this.backgroundAudio.currentTime = 0;
      this.backgroundAudio = null;
    }
    
    if (this.jungleInterval) {
      clearInterval(this.jungleInterval);
      this.jungleInterval = null;
    }
  }

  /* =========================
     SOUND CONTROL METHODS
  ========================= */
  
  // Toggle only background music
  toggleBackgroundMusic() {
    this.backgroundMusicMuted = !this.backgroundMusicMuted;
    localStorage.setItem('tiger_bg_muted', this.backgroundMusicMuted);
    
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
    localStorage.setItem('tiger_muted', this.isMuted);
    
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
  
  // Generate tiger paw tap sound
  playTap() {
    if (this.isMuted) return;
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square'; // Different from mouse's sine
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.08);
    
    gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.08);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.08);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, timeout: null });
    
    const timeout = setTimeout(() => {
      this.cleanupOscillator(id);
    }, 80);
    
    this.oscillators.get(id).timeout = timeout;
  }

  // Generate stake sound for tiger (deeper)
  playStake() {
    if (this.isMuted) return;
    this.init();
    
    // Play two sounds: coin drop + tiger growl
    this.playCoinDrop();
    setTimeout(() => this.playGrowl(), 100);
  }

  playCoinDrop() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  playGrowl() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted) return;
    this.init();
    
    switch (resultType) {
      case 'small_win':
        this.playSmallWinSound();
        break;
      case 'penalty':
        this.playPenaltySound();
        break;
      case 'major_penalty':
        this.playMajorPenaltySound();
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
        this.playTap();
    }
  }

  // Small win sound (purr)
  playSmallWinSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.2);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 200);
  }

  // Penalty sound (snarl)
  playPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  // Major penalty sound (angry growl)
  playMajorPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, this.audioContext.currentTime + 0.4);
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 400);
  }

  // Reset sound
  playResetSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, this.audioContext.currentTime + 0.25);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.25);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.25);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 250);
  }

  // Trap sound (roar + impact)
  playTrapSound() {
    if (this.isMuted) return;
    
    this.playAngryRoar();
    setTimeout(() => this.playImpact(), 300);
  }

  playAngryRoar() {
    if (this.isMuted) return;
    
    const now = Date.now();
    if (now - this.lastTigerRoar < this.ROAR_COOLDOWN) return;
    
    this.lastTigerRoar = now;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(90, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.6);
    
    gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.6);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.6);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 600);
  }

  playImpact() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(60, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  // Cashout sound (victory roar sequence)
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play ascending victory notes
    const frequencies = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    const durations = [0.2, 0.2, 0.2, 0.3];
    
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playVictoryNote(freq, durations[index]);
      }, index * 150);
    });
    
    // Play roar after notes
    setTimeout(() => this.playVictoryRoar(), 600);
  }

  playVictoryNote(frequency, duration) {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
    
    const id = Date.now() + frequency;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), duration * 1000);
  }

  playVictoryRoar() {
    if (this.isMuted) return;
    
    const now = Date.now();
    if (now - this.lastTigerRoar < this.ROAR_COOLDOWN) return;
    
    this.lastTigerRoar = now;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(70, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0.22 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 800);
  }

  // Game over sound (sad whimper)
  playGameOverSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.5);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 500);
  }

  // Play tiger roar (for special events)
  playRoar() {
    if (this.isMuted) return;
    
    const now = Date.now();
    if (now - this.lastTigerRoar < this.ROAR_COOLDOWN) return;
    
    this.lastTigerRoar = now;
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 0.7);
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.7);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.7);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 700);
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
      this.backgroundAudio.volume = 0.15 * this.masterVolume;
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
export const tigerSound = new TigerSoundManager();