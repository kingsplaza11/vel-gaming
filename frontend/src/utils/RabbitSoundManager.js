// src/utils/RabbitSoundManager.js
class RabbitSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('rabbit_muted') === 'true';
    this.masterVolume = 0.7;
    this.lastHopSound = 0;
    this.HOP_COOLDOWN = 300;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  /* =========================
     RABBIT THEMED SOUNDS
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
    oscillator.frequency.setValueAtTime(900, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.12);
    
    gainNode.gain.setValueAtTime(0.08 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.12);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 120);
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
    oscillator.frequency.setValueAtTime(1300, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(700, this.audioContext.currentTime + 0.18);
    
    gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.18);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.18);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 180);
  }

  playHappySqueak() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1100, this.audioContext.currentTime + 0.22);
    
    gainNode.gain.setValueAtTime(0.06 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.22);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.22);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 220);
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
    oscillator.frequency.setValueAtTime(1100, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1300, this.audioContext.currentTime + 0.18);
    
    gainNode.gain.setValueAtTime(0.12 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.18);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.18);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 180);
  }

  // Carrot bonus sound (crunchy)
  playCarrotSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(350, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.25);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.25);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 250);
  }

  // Small win sound (light)
  playSmallWinSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(700, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(900, this.audioContext.currentTime + 0.12);
    
    gainNode.gain.setValueAtTime(0.09 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.12);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.12);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 120);
  }

  // Penalty sound (sad squeak)
  playPenaltySound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(550, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(320, this.audioContext.currentTime + 0.28);
    
    gainNode.gain.setValueAtTime(0.11 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.28);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.28);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 280);
  }

  // Reset sound (light chime)
  playResetSound() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(850, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(450, this.audioContext.currentTime + 0.22);
    
    gainNode.gain.setValueAtTime(0.1 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.22);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.22);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 220);
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
    oscillator.frequency.setValueAtTime(1600, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(550, this.audioContext.currentTime + 0.35);
    
    gainNode.gain.setValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.35);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.35);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 350);
  }

  playThud() {
    if (this.isMuted) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 0.25);
    
    gainNode.gain.setValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.25);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.25);
    
    const id = Date.now() + 1;
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 250);
  }

  /* =========================
     ENHANCED WINNING/LOSING SOUNDS
     Similar to FortuneSoundManager but rabbit-themed
  ========================= */

  // Cashout sound - Rabbit victory celebration with fireworks
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play victory melody
    this.playVictoryMelody();
    
    // Play fireworks sounds after melody
    setTimeout(() => this.playFireworks(), 1200);
  }

  // Victory melody for rabbit
  playVictoryMelody() {
    const notes = [
      { freq: 523.25, duration: 0.2 }, // C5
      { freq: 659.25, duration: 0.2 }, // E5
      { freq: 783.99, duration: 0.2 }, // G5
      { freq: 1046.50, duration: 0.3 }, // C6
      { freq: 783.99, duration: 0.2 }, // G5
      { freq: 1046.50, duration: 0.4 }, // C6
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
        
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(note.freq, this.audioContext.currentTime);
        
        // Add slight variation for more musical sound
        if (note.duration > 0.25) {
          const vibrato = note.freq * 0.005;
          oscillator.frequency.setValueAtTime(note.freq + vibrato, this.audioContext.currentTime + note.duration * 0.3);
        }
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime + 0.05);
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
  }

  // Fireworks sounds for winning
  playFireworks() {
    if (this.isMuted) return;
    
    // Play 4-6 firework bursts
    const fireworkCount = 4 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < fireworkCount; i++) {
      const delay = i * 300 + Math.random() * 200;
      setTimeout(() => {
        this.playFireworkBurst();
      }, delay);
    }
  }

  playFireworkBurst() {
    if (this.isMuted) return;
    this.init();
    
    // Create ascending whistle
    const whistleOscillator = this.audioContext.createOscillator();
    const whistleGain = this.audioContext.createGain();
    
    whistleOscillator.connect(whistleGain);
    whistleGain.connect(this.audioContext.destination);
    
    whistleOscillator.type = 'sine';
    whistleOscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    whistleOscillator.frequency.exponentialRampToValueAtTime(2000, this.audioContext.currentTime + 0.8);
    
    whistleGain.gain.setValueAtTime(0, this.audioContext.currentTime);
    whistleGain.gain.linearRampToValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime + 0.1);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);
    
    whistleOscillator.start();
    whistleOscillator.stop(this.audioContext.currentTime + 0.8);
    
    // Create burst explosion
    setTimeout(() => {
      if (this.isMuted) return;
      
      // Multiple burst layers
      for (let j = 0; j < 5; j++) {
        const burstDelay = j * 0.03;
        
        const burstOscillator = this.audioContext.createOscillator();
        const burstGain = this.audioContext.createGain();
        
        burstOscillator.connect(burstGain);
        burstGain.connect(this.audioContext.destination);
        
        burstOscillator.type = j % 2 === 0 ? 'sawtooth' : 'square';
        burstOscillator.frequency.setValueAtTime(150 + Math.random() * 100, this.audioContext.currentTime + burstDelay);
        burstOscillator.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + burstDelay + 0.4);
        
        burstGain.gain.setValueAtTime(0, this.audioContext.currentTime + burstDelay);
        burstGain.gain.linearRampToValueAtTime(0.2 * this.masterVolume, this.audioContext.currentTime + burstDelay + 0.02);
        burstGain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + burstDelay + 0.4);
        
        burstOscillator.start(this.audioContext.currentTime + burstDelay);
        burstOscillator.stop(this.audioContext.currentTime + burstDelay + 0.4);
        
        const id = Date.now() + j;
        this.oscillators.set(id, { oscillator: burstOscillator, gainNode: burstGain });
        
        setTimeout(() => this.cleanupOscillator(id), (burstDelay + 0.4) * 1000);
      }
    }, 800);
    
    const whistleId = Date.now();
    this.oscillators.set(whistleId, { oscillator: whistleOscillator, gainNode: whistleGain });
    
    setTimeout(() => this.cleanupOscillator(whistleId), 800 + 400);
  }

  // Game over sound - Rabbit defeated with mocking sounds
  playGameOverSound() {
    if (this.isMuted) return;
    
    // Play defeated squeak
    this.playDefeatedSqueak();
    
    // Play mocking sounds after a delay
    setTimeout(() => {
      this.playMockingSounds();
    }, 600);
  }

  playDefeatedSqueak() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(450, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(280, this.audioContext.currentTime + 0.6);
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.15 * this.masterVolume, this.audioContext.currentTime + 0.08);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.6);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.6);
    
    const id = Date.now();
    this.oscillators.set(id, { oscillator, gainNode });
    
    setTimeout(() => this.cleanupOscillator(id), 600);
  }

  // Mocking sounds (rabbit-themed)
  playMockingSounds() {
    const mockPattern = [
      { baseFreq: 500, duration: 0.18, count: 3 }, // "heh heh heh"
      { baseFreq: 450, duration: 0.22, count: 2 }, // "heh heh"
      { baseFreq: 400, duration: 0.25, count: 1 }, // "heh"
      { baseFreq: 350, duration: 0.3, count: 1 }, // "heh"
    ];
    
    let cumulativeTime = 0;
    
    mockPattern.forEach((pattern, patternIndex) => {
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
          
          const freqVariance = Math.random() * 30 - 15;
          const startFreq = pattern.baseFreq + freqVariance;
          const endFreq = pattern.baseFreq - 30 + freqVariance;
          
          oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + pattern.duration);
          
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          filter.Q.setValueAtTime(8, this.audioContext.currentTime);
          
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.22 * this.masterVolume, this.audioContext.currentTime + 0.03);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + pattern.duration);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + pattern.duration);
          
          const id = Date.now() + patternIndex * 100 + i;
          this.oscillators.set(id, { oscillator, gainNode, filter });
          
          setTimeout(() => {
            this.cleanupOscillator(id);
          }, cumulativeTime * 1000 + pattern.duration * 1000);
          
        }, cumulativeTime * 1000);
        
        cumulativeTime += pattern.duration + 0.06;
      }
      
      cumulativeTime += 0.1;
    });
    
    // Final sad squeak
    setTimeout(() => {
      if (this.isMuted) return;
      this.init();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(180, this.audioContext.currentTime + 0.9);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.18 * this.masterVolume, this.audioContext.currentTime + 0.12);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.9);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 0.9);
      
      const id = Date.now() + 1000;
      this.oscillators.set(id, { oscillator, gainNode });
      
      setTimeout(() => {
        this.cleanupOscillator(id);
      }, cumulativeTime * 1000 + 900);
      
    }, cumulativeTime * 1000);
  }

  // Play happy hop sequence
  playHappyHop() {
    if (this.isMuted) return;
    
    // Play three quick hops
    this.playHop();
    setTimeout(() => this.playHop(), 120);
    setTimeout(() => this.playHop(), 240);
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
    localStorage.setItem('rabbit_muted', this.isMuted);
    
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
export const rabbitSound = new RabbitSoundManager();