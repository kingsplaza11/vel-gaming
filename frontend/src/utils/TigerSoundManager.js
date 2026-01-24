// src/utils/TigerSoundManager.js
class TigerSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('tiger_muted') === 'true';
    this.masterVolume = 0.7;
    this.lastTigerRoar = 0;
    this.ROAR_COOLDOWN = 2000;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /* =========================
     TIGER THEMED SOUNDS
  ========================= */

  // Tiger paw tap sound
  playTap() {
    if (this.isMuted) return;
    this.init();
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(350, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 100);
  }

  // Tiger stake sound (placing bet)
  playStake() {
    if (this.isMuted) return;
    this.init();
    
    // Play coin drop + tiger growl
    this.playCoinDrop();
    setTimeout(() => this.playGrowl(), 80);
  }

  playCoinDrop() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(350, this.audioContext.currentTime + 0.25);
    
    gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.25);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.25);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 250);
  }

  playGrowl() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(90, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(65, this.audioContext.currentTime + 0.4);
    
    gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 400);
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

  // Small win sound (contented purr)
  playSmallWinSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(140, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  // Penalty sound (warning growl)
  playPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 0.35);
    
    gainNode.gain.setValueAtTime(0.22 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.35);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.35);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 350);
  }

  // Major penalty sound (angry snarl)
  playMajorPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(160, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.5);
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.5);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode, filter });
    
    setTimeout(() => this.cleanupOscillator(id), 500);
  }

  // Reset sound
  playResetSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(320, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.3);
    
    gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 300);
  }

  // Trap sound
  playTrapSound() {
    if (this.isMuted) return;
    
    // Angry roar + cage slam
    this.playAngryRoar();
    setTimeout(() => this.playCageSlam(), 400);
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
    oscillator.frequency.setValueAtTime(100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.7);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.28 * this.masterVolume, this.audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.7);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.7);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 700);
  }

  playCageSlam() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(70, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(35, this.audioContext.currentTime + 0.4);
    
    gainNode.gain.setValueAtTime(0.32 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.4);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 400);
  }

  /* =========================
     ENHANCED WINNING/LOSING SOUNDS
     Similar to FortuneSoundManager but tiger-themed
  ========================= */

  // Cashout sound - Tiger victory celebration
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play victory roar sequence
    this.playVictoryFanfare();
    
    // Play jungle celebration sounds
    setTimeout(() => this.playJungleCelebration(), 1200);
  }

  // Victory fanfare for tiger
  playVictoryFanfare() {
    const notes = [
      { freq: 130.81, duration: 0.4 }, // C3 (deep)
      { freq: 164.81, duration: 0.4 }, // E3
      { freq: 196.00, duration: 0.4 }, // G3
      { freq: 261.63, duration: 0.6 }, // C4
      { freq: 329.63, duration: 0.6 }, // E4
      { freq: 392.00, duration: 1.0 }, // G4
    ];
    
    let cumulativeTime = 0;
    
    notes.forEach((note, i) => {
      setTimeout(() => {
        if (this.isMuted) return;
        this.init();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = i < 3 ? 'sawtooth' : 'triangle';
        oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime + 0.08);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + note.duration);
        
        const id = Date.now() + i;
        this.oscillators.set(id, { oscillator, gainNode });
        
        setTimeout(() => {
          this.cleanupOscillator(id);
        }, cumulativeTime * 1000 + note.duration * 1000);
        
      }, cumulativeTime * 1000);
      
      cumulativeTime += note.duration;
    });
    
    // Victory roar at the end
    setTimeout(() => {
      this.playVictoryRoar();
    }, cumulativeTime * 1000 + 200);
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
    oscillator.frequency.setValueAtTime(85, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(65, this.audioContext.currentTime + 0.9);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.9);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.9);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 900);
  }

  // Jungle celebration (animals joining in)
  playJungleCelebration() {
    if (this.isMuted) return;
    
    const animalSounds = [
      { freq: 800, type: 'triangle', duration: 0.3, delay: 0, volume: 0.15 }, // Bird 1
      { freq: 1200, type: 'triangle', duration: 0.25, delay: 150, volume: 0.12 }, // Bird 2
      { freq: 300, type: 'sine', duration: 0.4, delay: 300, volume: 0.2 }, // Monkey
      { freq: 600, type: 'sawtooth', duration: 0.35, delay: 450, volume: 0.18 }, // Exotic bird
    ];
    
    animalSounds.forEach(sound => {
      setTimeout(() => {
        if (this.isMuted) return;
        this.init();
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(sound.volume * this.masterVolume, this.audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + sound.duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + sound.duration);
        
        const id = Date.now() + sound.freq;
        this.oscillators.set(id, { oscillator, gainNode });
        
        setTimeout(() => this.cleanupOscillator(id), sound.duration * 1000);
      }, sound.delay);
    });
  }

  // Game over sound - Tiger defeated with mocking jungle sounds
  playGameOverSound() {
    if (this.isMuted) return;
    
    // Play defeated tiger whimper
    this.playDefeatedWhimper();
    
    // Play mocking hyena laughter after a delay
    setTimeout(() => {
      this.playMockingHyena();
    }, 800);
  }

  playDefeatedWhimper() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(120, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(70, this.audioContext.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 800);
  }

  // Mocking hyena laughter (tiger-themed game over)
  playMockingHyena() {
    const laughPattern = [
      { baseFreq: 380, duration: 0.25, count: 2 }, // "hee hee"
      { baseFreq: 320, duration: 0.3, count: 2 }, // "hee hee" (lower)
      { baseFreq: 280, duration: 0.35, count: 1 }, // "ha"
      { baseFreq: 240, duration: 0.4, count: 1 }, // "ha" (lower)
    ];
    
    let cumulativeTime = 0;
    
    laughPattern.forEach((pattern, patternIndex) => {
      for (let i = 0; i < pattern.count; i++) {
        setTimeout(() => {
          if (this.isMuted) return;
          this.init();
          
          const oscillator = this.audioContext.createOscillator();
          const gainNode = this.audioContext.createGain();
          const filter = this.audioContext.createBiquadFilter();
          
          oscillator.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          oscillator.type = 'square';
          
          const freqVariance = Math.random() * 25 - 12.5;
          const startFreq = pattern.baseFreq + freqVariance;
          const endFreq = pattern.baseFreq - 40 + freqVariance;
          
          oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + pattern.duration);
          
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          filter.Q.setValueAtTime(10, this.audioContext.currentTime);
          
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.28 * this.masterVolume, this.audioContext.currentTime + 0.04);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + pattern.duration);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + pattern.duration);
          
          const id = Date.now() + patternIndex * 100 + i;
          this.oscillators.set(id, { oscillator, gainNode, filter });
          
          setTimeout(() => {
            this.cleanupOscillator(id);
          }, cumulativeTime * 1000 + pattern.duration * 1000);
          
        }, cumulativeTime * 1000);
        
        cumulativeTime += pattern.duration + 0.08;
      }
      
      cumulativeTime += 0.12;
    });
    
    // Final defeated growl
    setTimeout(() => {
      if (this.isMuted) return;
      this.init();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 1.2);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.22 * this.masterVolume, this.audioContext.currentTime + 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.2);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 1.2);
      
      const id = Date.now() + 1000;
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => {
        this.cleanupOscillator(id);
      }, cumulativeTime * 1000 + 1200);
      
    }, cumulativeTime * 1000);
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
    oscillator.frequency.setValueAtTime(90, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.8);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.24 * this.masterVolume, this.audioContext.currentTime + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.8);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 800);
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

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('tiger_muted', this.isMuted);
    
    if (this.isMuted) {
      // Cleanup all oscillators when muted
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
    }
    
    return this.isMuted;
  }

  // Set master volume
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // Cleanup everything
  cleanup() {
    this.oscillators.forEach((sound, id) => {
      this.cleanupOscillator(id);
    });
    this.oscillators.clear();
  }
}

// Export singleton instance
export const tigerSound = new TigerSoundManager();