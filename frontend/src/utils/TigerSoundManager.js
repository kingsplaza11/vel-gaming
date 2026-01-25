// src/utils/TigerSoundManager.js
class TigerSoundManager {
  constructor() {
    this.audioContext = null;
    this.audioBuffers = new Map(); // Store loaded audio buffers
    this.activeSources = new Map(); // Store active audio sources
    this.isMuted = localStorage.getItem('tiger_muted') === 'true';
    this.masterVolume = 0.7;
    this.MAX_SIMULTANEOUS_SOUNDS = 8;
    this.isInitialized = false;
    this.isResumed = false;
    this.lastTigerRoar = 0;
    this.ROAR_COOLDOWN = 2000;
    
    // Sound file paths (update these to match your actual file paths)
    this.soundFiles = {
      // New stake sound (monster growl)
      'stake': '/sounds/mixkit-monster-calm-growl-1956.wav',
      
      // Click/tap sounds
      'click': '/sounds/mixkit-arcade-bonus-alert-767.wav',
      
      // Game over sounds (keep existing)
      'defeatedWhimper': '/sounds/mixkit-evil-dwarf-laugh-421.wav',
      'mockingLaughter': '/sounds/mixkit-dwarf-creature-laugh-420.wav',
      
      // Tile reveal sounds
      'smallWin': '/sounds/mixkit-positive-interface-beep-221.wav', // CHANGED THIS
      'penalty': '/sounds/mixkit-sci-fi-error-alert-898.wav',
      'majorPenalty': '/sounds/mixkit-electric-low-buzzer-2961.wav',
      'reset': '/sounds/mixkit-police-short-whistle-615.wav',
      'trap': '/sounds/mixkit-wrong-answer-bass-buzzer-948.wav',
      
      // Victory sounds (NEW - using applause like Fortune Mouse)
      'applause': '/sounds/mixkit-conference-audience-clapping-strongly-476.wav',
      'birthdayCheer': '/sounds/mixkit-birthday-crowd-party-cheer-531.wav',
      'victoryBonus': '/sounds/mixkit-game-bonus-reached-2065.wav',
      'levelComplete': '/sounds/mixkit-completion-of-a-level-2063.wav'
    };
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Tiger Audio context created, state:', this.audioContext.state);
        
        // Set up auto-resume
        this.setupAutoResume();
        
        // Preload all sounds on initialization
        this.preloadAllSounds();
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    }
    
    // Ensure context is resumed if suspended
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.resumeAudioContext();
    }
  }

  // Setup auto-resume on user interaction
  setupAutoResume() {
    const resumeAudio = () => {
      console.log('User interaction detected, resuming audio context');
      if (!this.isResumed && this.audioContext && this.audioContext.state === 'suspended') {
        this.resumeAudioContext();
      }
    };
    
    // Add listeners for multiple interaction types
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, resumeAudio, { 
        once: true,
        passive: true 
      });
    });
  }

  // Resume audio context
  resumeAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('Audio context resumed successfully');
        this.isResumed = true;
      }).catch(error => {
        console.error('Failed to resume audio context:', error);
      });
    }
  }

  // Preload all sounds
  async preloadAllSounds() {
    if (this.isInitialized) return;
    
    console.log('Preloading all tiger sounds...');
    const soundKeys = Object.keys(this.soundFiles);
    
    // Load sounds in parallel but limit concurrency
    const batchSize = 3;
    for (let i = 0; i < soundKeys.length; i += batchSize) {
      const batch = soundKeys.slice(i, i + batchSize);
      await Promise.all(batch.map(key => this.loadSoundBuffer(key)));
    }
    
    this.isInitialized = true;
    console.log('All tiger sounds preloaded');
  }

  // Load a sound file into buffer
  async loadSoundBuffer(soundKey) {
    if (this.audioBuffers.has(soundKey)) return this.audioBuffers.get(soundKey);
    
    const url = this.soundFiles[soundKey];
    if (!url) {
      console.error('Sound URL not found for:', soundKey);
      return null;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.audioBuffers.set(soundKey, audioBuffer);
      console.log('Loaded tiger sound:', soundKey);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load tiger sound:', soundKey, error);
      return null;
    }
  }

  // Play a sound by key (synchronous - returns immediately)
  playSound(soundKey, options = {}) {
    if (this.isMuted || !this.audioContext) return null;
    
    this.init();
    
    // Check if sound is loaded
    const audioBuffer = this.audioBuffers.get(soundKey);
    if (!audioBuffer) {
      console.warn('Tiger sound not loaded yet:', soundKey);
      // Try to load it in background but don't wait
      this.loadSoundBuffer(soundKey).catch(() => {});
      return null;
    }
    
    // Check sound count limit
    if (this.getActiveSoundCount() >= this.MAX_SIMULTANEOUS_SOUNDS) {
      console.log('Too many sounds playing, skipping:', soundKey);
      return null;
    }
    
    const {
      volume = this.masterVolume,
      loop = false,
      playbackRate = 1.0,
      delay = 0,
      onEnded = null
    } = options;
    
    try {
      // Create source node
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = audioBuffer;
      source.loop = loop;
      source.playbackRate.value = playbackRate;
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Set volume
      gainNode.gain.value = volume;
      
      // Play with optional delay
      const startTime = this.audioContext.currentTime + delay;
      source.start(startTime);
      
      // Generate unique ID for this sound instance
      const soundId = `${soundKey}_${Date.now()}_${Math.random()}`;
      
      // Set up cleanup on ended
      source.onended = () => {
        this.cleanupSoundSource(soundId);
        if (onEnded) onEnded();
      };
      
      // Store active source
      this.activeSources.set(soundId, { source, gainNode });
      
      return soundId;
    } catch (error) {
      console.error('Failed to play tiger sound:', soundKey, error);
      return null;
    }
  }

  // Play tiger tap sound
  playTap() {
    if (this.isMuted) return;
    this.playSound('click', { volume: 0.6 * this.masterVolume });
  }

  // Play stake sound - USING MONSTER GROWL
  playStake() {
    if (this.isMuted) return;
    console.log('Playing monster growl for stake');
    this.playSound('stake', { 
      volume: 0.8 * this.masterVolume,
      playbackRate: 0.9 // Slightly slower for more menacing effect
    });
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted) return;
    
    // Play sounds with minimal delay to prevent blocking
    setTimeout(() => {
      switch (resultType) {
        case 'small_win':
          this.playSound('smallWin', { 
            volume: 0.7 * this.masterVolume,
            playbackRate: 1.0 
          });
          console.log('Playing positive interface beep for small win');
          break;
        case 'penalty':
          this.playSound('penalty', { 
            volume: 0.6 * this.masterVolume,
            playbackRate: 1.0 
          });
          break;
        case 'major_penalty':
          this.playSound('majorPenalty', { 
            volume: 0.7 * this.masterVolume,
            playbackRate: 0.9 // Slightly slower for more ominous feel
          });
          break;
        case 'reset':
          this.playSound('reset', { 
            volume: 0.5 * this.masterVolume,
            playbackRate: 1.2 // Slightly faster for alert feel
          });
          break;
        case 'trap':
          this.playGameOverSound();
          break;
        case 'auto_cashout':
          this.playCashoutSound();
          break;
        default:
          this.playTap();
      }
    }, 0);
  }

  // Cashout sound - ENHANCED WITH APPLAUSE AND BIRTHDAY CHEER
  playCashoutSound() {
    if (this.isMuted) return;
    
    console.log('Playing enhanced cashout celebration');
    
    // Play applause for longer duration (like Fortune Mouse)
    this.playSound('applause', { 
      volume: 0.8 * this.masterVolume,
      loop: false 
    });
    
    // Play birthday cheer with slight delay (overlaps with applause)
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('birthdayCheer', { 
          volume: 0.9 * this.masterVolume,
          delay: 0.1 
        });
      }
    }, 500);
    
    // Play victory bonus sound
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('victoryBonus', { 
          volume: 0.6 * this.masterVolume,
          delay: 0 
        });
      }
    }, 1500);
    
    // Play level complete sound
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('levelComplete', { 
          volume: 0.5 * this.masterVolume,
          delay: 0 
        });
      }
    }, 2500);
  }

  // Game over sound - USING DWARF LAUGHTERS
  playGameOverSound() {
    if (this.isMuted) return;
    
    console.log('Playing game over with dwarf laughter');
    
    // Play first dwarf laugh
    this.playSound('defeatedWhimper', { 
      volume: 0.7 * this.masterVolume,
      loop: false 
    });
    
    // Play second dwarf laugh with delay
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('mockingLaughter', { 
          volume: 0.7 * this.masterVolume,
          loop: false 
        });
      }
    }, 1000);
    
    // Play trap sound after laughs
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('trap', { 
          volume: 0.8 * this.masterVolume,
          loop: false 
        });
      }
    }, 2000);
  }

  // Play tiger roar (for special events)
  playRoar() {
    if (this.isMuted) return;
    
    const now = Date.now();
    if (now - this.lastTigerRoar < this.ROAR_COOLDOWN) return;
    
    this.lastTigerRoar = now;
    
    // Fallback to a synthesized roar if no audio file
    this.playSynthesizedRoar();
  }

  // Fallback synthesized roar (if no audio file available)
  playSynthesizedRoar() {
    if (this.isMuted || !this.audioContext) return;
    
    try {
      const oscillator1 = this.audioContext.createOscillator();
      const oscillator2 = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator1.connect(gainNode);
      oscillator2.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator1.type = 'sawtooth';
      oscillator2.type = 'sawtooth';
      
      oscillator1.frequency.setValueAtTime(85, this.audioContext.currentTime);
      oscillator1.frequency.exponentialRampToValueAtTime(55, this.audioContext.currentTime + 1.2);
      
      oscillator2.frequency.setValueAtTime(120, this.audioContext.currentTime);
      oscillator2.frequency.exponentialRampToValueAtTime(75, this.audioContext.currentTime + 1.2);
      
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.25 * this.masterVolume, this.audioContext.currentTime + 0.2);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 1.2);
      
      oscillator1.start();
      oscillator2.start();
      oscillator1.stop(this.audioContext.currentTime + 1.2);
      oscillator2.stop(this.audioContext.currentTime + 1.2);
      
      const soundId = `roar_${Date.now()}`;
      this.activeSources.set(soundId, { 
        source: oscillator1, 
        gainNode,
        oscillator2 
      });
      
      setTimeout(() => {
        this.cleanupSoundSource(soundId);
      }, 1200);
      
    } catch (error) {
      console.error('Failed to play synthesized roar:', error);
    }
  }

  // Get count of active sounds
  getActiveSoundCount() {
    let count = 0;
    for (const [key, sound] of this.activeSources) {
      if (sound.source) count++;
    }
    return count;
  }

  // Cleanup individual sound source
  cleanupSoundSource(soundId) {
    const sound = this.activeSources.get(soundId);
    if (sound) {
      try {
        if (sound.source && sound.source.stop) {
          sound.source.stop(0);
        }
        if (sound.source && sound.source.disconnect) {
          sound.source.disconnect();
        }
        if (sound.gainNode && sound.gainNode.disconnect) {
          sound.gainNode.disconnect();
        }
        if (sound.oscillator2 && sound.oscillator2.stop) {
          sound.oscillator2.stop(0);
        }
        if (sound.oscillator2 && sound.oscillator2.disconnect) {
          sound.oscillator2.disconnect();
        }
      } catch (e) {
        // Sound already stopped
      }
      this.activeSources.delete(soundId);
    }
  }

  // Cleanup all playing sounds
  cleanupAllSounds() {
    for (const [soundId] of this.activeSources) {
      this.cleanupSoundSource(soundId);
    }
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('tiger_muted', this.isMuted);
    
    if (this.isMuted) {
      // Cleanup all playing sounds when muted
      this.cleanupAllSounds();
    }
    
    return this.isMuted;
  }

  // Set volume
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // Cleanup everything
  cleanup() {
    this.cleanupAllSounds();
    
    // Clear audio buffers
    const bufferKeys = [];
    for (const [key] of this.audioBuffers) {
      bufferKeys.push(key);
    }
    bufferKeys.forEach(key => this.audioBuffers.delete(key));
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore errors
      }
      this.audioContext = null;
    }
    
    this.isInitialized = false;
    this.isResumed = false;
  }
}

// Export singleton instance
export const tigerSound = new TigerSoundManager();