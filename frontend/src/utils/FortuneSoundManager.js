// src/utils/FortuneSoundManager.js
class FortuneSoundManager {
  constructor() {
    this.audioContext = null;
    this.oscillators = new Map();
    this.isMuted = localStorage.getItem('fortune_muted') === 'true';
    this.masterVolume = 0.7;
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

  // Cashout sound - plays applause/cheering
  playCashoutSound() {
    if (this.isMuted) return;
    this.init();
    
    // Play applause effect for 3 seconds
    this.playApplause();
    
    // Also play a victory fanfare
    this.playVictoryFanfare();
  }

  // Applause/cheering sound (simulated with white noise bursts)
  playApplause() {
    const duration = 3.0; // 3 seconds of applause
    const clapCount = 25; // Increased from 20 to 25 for more applause
    const clapVolume = 0.35 * this.masterVolume; // Slightly louder
    
    for (let i = 0; i < clapCount; i++) {
      // Random delay for each clap (staggered applause)
      const delay = Math.random() * duration;
      
      // Use setTimeout to schedule each clap
      setTimeout(() => {
        if (this.isMuted) return;
        this.init();
        
        // Create multiple noise bursts for a clapping sound
        for (let j = 0; j < 3; j++) {
          const clapDelay = j * 0.05; // Small offset for each burst
          
          // Create noise generator (band-limited)
          const bufferSize = this.audioContext.sampleRate * 0.05; // 50ms buffer
          const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
          const output = buffer.getChannelData(0);
          
          // Fill with random noise
          for (let k = 0; k < bufferSize; k++) {
            output[k] = Math.random() * 2 - 1;
          }
          
          // Create source and filter
          const noiseSource = this.audioContext.createBufferSource();
          const gainNode = this.audioContext.createGain();
          const filter = this.audioContext.createBiquadFilter();
          
          noiseSource.buffer = buffer;
          
          // Apply bandpass filter to make it sound more like clapping
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(800 + Math.random() * 1000, this.audioContext.currentTime);
          filter.Q.setValueAtTime(5, this.audioContext.currentTime);
          
          noiseSource.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(this.audioContext.destination);
          
          // Apply envelope
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime + clapDelay);
          gainNode.gain.linearRampToValueAtTime(clapVolume * 0.5, this.audioContext.currentTime + clapDelay + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + clapDelay + 0.05);
          
          noiseSource.start(this.audioContext.currentTime + clapDelay);
          noiseSource.stop(this.audioContext.currentTime + clapDelay + 0.05);
          
          const id = Date.now() + i * 10 + j;
          this.oscillators.set(id, { oscillator: noiseSource, gainNode, filter, timeout: null });
          
          const timeout = setTimeout(() => {
            this.cleanupOscillator(id);
          }, (delay + clapDelay) * 1000 + 50);
          
          this.oscillators.get(id).timeout = timeout;
        }
      }, delay * 1000);
    }
  }

  // Victory fanfare for winning
  playVictoryFanfare() {
    const notes = [
      { freq: 523.25, duration: 0.3 }, // C5
      { freq: 659.25, duration: 0.3 }, // E5
      { freq: 783.99, duration: 0.3 }, // G5
      { freq: 1046.50, duration: 0.5 }, // C6
      { freq: 1174.66, duration: 0.5 }, // D6
      { freq: 1318.51, duration: 0.8 }, // E6
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
        
        // Add slight vibrato on longer notes
        if (note.duration > 0.4) {
          oscillator.frequency.setValueAtTime(note.freq * 0.99, this.audioContext.currentTime + note.duration * 0.3);
          oscillator.frequency.exponentialRampToValueAtTime(note.freq * 1.01, this.audioContext.currentTime + note.duration * 0.7);
        }
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.35 * this.masterVolume, this.audioContext.currentTime + 0.05); // Slightly louder
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + note.duration);
        
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + note.duration);
        
        const id = Date.now() + i;
        this.oscillators.set(id, { oscillator, gainNode, timeout: null });
        
        const timeout = setTimeout(() => {
          this.cleanupOscillator(id);
        }, cumulativeTime * 1000 + note.duration * 1000);
        
        this.oscillators.get(id).timeout = timeout;
        
      }, cumulativeTime * 1000);
      
      cumulativeTime += note.duration;
    });
  }

  // Game over sound - plays mocking laughter
  playGameOverSound() {
    if (this.isMuted) return;
    this.init();
    
    // Play mocking laughter sequence
    this.playMockingLaughter();
  }

  // Mocking laughter sound
  playMockingLaughter() {
    // Create a sequence of "ha ha ha" sounds with descending pitch
    const laughterPattern = [
      { baseFreq: 450, duration: 0.2, count: 2 }, // "ha ha"
      { baseFreq: 420, duration: 0.25, count: 2 }, // "ha ha" (lower)
      { baseFreq: 380, duration: 0.3, count: 1 }, // "ha" (even lower)
      { baseFreq: 320, duration: 0.3, count: 1 }, // "ha" (even lower)
    ];
    
    let cumulativeTime = 0;
    
    laughterPattern.forEach((pattern, patternIndex) => {
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
          
          // Use square wave for a more "digital laugh" sound
          oscillator.type = 'square';
          
          // Slight frequency variation for each "ha"
          const freqVariance = Math.random() * 20 - 10;
          const startFreq = pattern.baseFreq + freqVariance;
          const endFreq = pattern.baseFreq - 30 + freqVariance; // More pronounced descent
          
          oscillator.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(endFreq, this.audioContext.currentTime + pattern.duration);
          
          // Filter to shape the sound
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(startFreq, this.audioContext.currentTime);
          filter.Q.setValueAtTime(12, this.audioContext.currentTime); // Sharper filter
          
          // Laughter envelope - quick attack, medium decay
          gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime + 0.03); // Louder
          gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + pattern.duration);
          
          oscillator.start();
          oscillator.stop(this.audioContext.currentTime + pattern.duration);
          
          const id = Date.now() + patternIndex * 100 + i;
          this.oscillators.set(id, { oscillator, gainNode, filter, timeout: null });
          
          const timeout = setTimeout(() => {
            this.cleanupOscillator(id);
          }, cumulativeTime * 1000 + pattern.duration * 1000);
          
          this.oscillators.get(id).timeout = timeout;
          
        }, cumulativeTime * 1000);
        
        cumulativeTime += pattern.duration + 0.1; // Small pause between laughs
      }
      
      cumulativeTime += 0.15; // Shorter pause between patterns
    });
    
    // Add a final "sad trombone" sound at the end
    setTimeout(() => {
      if (this.isMuted) return;
      this.init();
      
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime); // Slightly higher start
      oscillator.frequency.exponentialRampToValueAtTime(60, this.audioContext.currentTime + 1.0); // Longer slide
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3 * this.masterVolume, this.audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.0);
      
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + 1.0);
      
      const id = Date.now() + 1000;
      this.oscillators.set(id, { oscillator, gainNode, timeout: null });
      
      const timeout = setTimeout(() => {
        this.cleanupOscillator(id);
      }, cumulativeTime * 1000 + 1000);
      
      this.oscillators.get(id).timeout = timeout;
      
    }, cumulativeTime * 1000);
  }

  // Cleanup individual oscillator
  cleanupOscillator(id) {
    const sound = this.oscillators.get(id);
    if (sound) {
      try {
        if (sound.oscillator.stop) sound.oscillator.stop();
        if (sound.oscillator.disconnect) sound.oscillator.disconnect();
        if (sound.gainNode && sound.gainNode.disconnect) sound.gainNode.disconnect();
        if (sound.filter && sound.filter.disconnect) sound.filter.disconnect();
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
      // Cleanup all oscillators when muted
      this.oscillators.forEach((sound, id) => {
        this.cleanupOscillator(id);
      });
    }
    
    return this.isMuted;
  }

  // Set volume
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
export const fortuneSound = new FortuneSoundManager();