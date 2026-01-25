// src/utils/FortuneSoundManager.js
class FortuneSoundManager {
  constructor() {
    this.audioContext = null;
    this.soundBuffers = new Map(); // Store audio buffers
    this.activeSources = new Map(); // Store active audio sources
    this.isMuted = localStorage.getItem('fortune_muted') === 'true';
    this.masterVolume = 0.7;
    this.MAX_SIMULTANEOUS_SOUNDS = 8;
    this.isInitialized = false;
    this.isResumed = false;
    
    // Sound file paths (update these to match your actual file paths)
    this.soundFiles = {
      // Losing sounds
      'laugh1': '/sounds/mixkit-evil-dwarf-laugh-421.wav',
      'laugh2': '/sounds/mixkit-dwarf-creature-laugh-420.wav',
      
      // Winning sounds
      'applause': '/sounds/mixkit-conference-audience-clapping-strongly-476.wav',
      'bonus': '/sounds/mixkit-game-bonus-reached-2065.wav',
      'levelComplete': '/sounds/mixkit-completion-of-a-level-2063.wav',
      
      // Tapping sounds
      'goodTap': '/sounds/mixkit-arcade-bonus-alert-767.wav',
      'resetTap': '/sounds/mixkit-police-short-whistle-615.wav',
      'badTap': '/sounds/mixkit-sci-fi-error-alert-898.wav',
      'electricBuzz': '/sounds/mixkit-electric-low-buzzer-2961.wav',
      'wrongAnswer': '/sounds/mixkit-wrong-answer-bass-buzzer-948.wav',
      
      // Click sound
      'click': '/sounds/mixkit-arcade-bonus-alert-767.wav',
      'stake': '/sounds/mixkit-game-bonus-reached-2065.wav'
    };
  }

  // Initialize Web Audio API synchronously
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context created, state:', this.audioContext.state);
        
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
    
    console.log('Preloading all sounds...');
    const soundKeys = Object.keys(this.soundFiles);
    
    // Load sounds in parallel but limit concurrency
    const batchSize = 3;
    for (let i = 0; i < soundKeys.length; i += batchSize) {
      const batch = soundKeys.slice(i, i + batchSize);
      await Promise.all(batch.map(key => this.loadSoundBuffer(key)));
    }
    
    this.isInitialized = true;
    console.log('All sounds preloaded');
  }

  // Load a sound file into buffer
  async loadSoundBuffer(soundKey) {
    if (this.soundBuffers.has(soundKey)) return this.soundBuffers.get(soundKey);
    
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
      
      this.soundBuffers.set(soundKey, audioBuffer);
      console.log('Loaded sound buffer:', soundKey);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load sound:', soundKey, error);
      // Return null instead of throwing to prevent crashes
      return null;
    }
  }

  // Play a sound by key (synchronous - returns immediately)
  playSound(soundKey, options = {}) {
    if (this.isMuted || !this.audioContext) return null;
    
    this.init();
    
    // Check if sound is loaded
    const audioBuffer = this.soundBuffers.get(soundKey);
    if (!audioBuffer) {
      console.warn('Sound not loaded yet:', soundKey);
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
      delay = 0
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
      };
      
      // Store active source
      this.activeSources.set(soundId, { source, gainNode });
      
      return soundId;
    } catch (error) {
      console.error('Failed to play sound:', soundKey, error);
      return null;
    }
  }

  // Play click sound (synchronous)
  playClick() {
    if (this.isMuted) return;
    this.playSound('click', { volume: 0.5 * this.masterVolume });
  }

  // Play stake sound (synchronous)
  playStake() {
    if (this.isMuted) return;
    this.playSound('stake', { volume: 0.6 * this.masterVolume });
  }

  // Play tile sound based on result (synchronous)
  playTileSound(resultType) {
    if (this.isMuted) return;
    
    // Play sounds with minimal delay to prevent blocking
    setTimeout(() => {
      switch (resultType) {
        case 'safe':
        case 'carrot_bonus':
        case 'small_win':
          this.playSound('goodTap', { volume: 0.6 * this.masterVolume });
          break;
        case 'penalty':
          // Play both bad tap sounds with slight delay
          this.playSound('badTap', { volume: 0.5 * this.masterVolume });
          setTimeout(() => {
            this.playSound('electricBuzz', { volume: 0.4 * this.masterVolume });
          }, 100);
          break;
        case 'major_penalty':
          this.playSound('wrongAnswer', { volume: 0.6 * this.masterVolume });
          break;
        case 'reset':
          this.playSound('resetTap', { volume: 0.5 * this.masterVolume });
          break;
        case 'trap':
          // Play game over sounds with delays
          this.playSound('laugh1', { volume: 0.6 * this.masterVolume });
          setTimeout(() => {
            this.playSound('laugh2', { volume: 0.6 * this.masterVolume });
          }, 800);
          setTimeout(() => {
            this.playSound('wrongAnswer', { volume: 0.6 * this.masterVolume });
          }, 1600);
          break;
        case 'auto_cashout':
          // Play winning sounds with delays
          this.playSound('applause', { volume: 0.7 * this.masterVolume });
          setTimeout(() => {
            this.playSound('bonus', { volume: 0.6 * this.masterVolume });
          }, 300);
          setTimeout(() => {
            this.playSound('levelComplete', { volume: 0.5 * this.masterVolume });
          }, 600);
          break;
        default:
          this.playClick();
      }
    }, 0); // Minimal delay to ensure UI thread isn't blocked
  }

  // Play cashout sound (synchronous wrapper)
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play winning sounds with delays
    setTimeout(() => {
      this.playSound('applause', { volume: 0.7 * this.masterVolume });
      setTimeout(() => {
        this.playSound('bonus', { volume: 0.6 * this.masterVolume });
      }, 300);
      setTimeout(() => {
        this.playSound('levelComplete', { volume: 0.5 * this.masterVolume });
      }, 600);
    }, 0);
  }

  // Play game over sound (synchronous wrapper)
  playGameOverSound() {
    if (this.isMuted) return;
    
    setTimeout(() => {
      this.playSound('laugh1', { volume: 0.6 * this.masterVolume });
      setTimeout(() => {
        this.playSound('laugh2', { volume: 0.6 * this.masterVolume });
      }, 800);
      setTimeout(() => {
        this.playSound('wrongAnswer', { volume: 0.6 * this.masterVolume });
      }, 1600);
    }, 0);
  }

  // Get count of active sounds
  getActiveSoundCount() {
    return this.activeSources.size;
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
    localStorage.setItem('fortune_muted', this.isMuted);
    
    if (this.isMuted) {
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
    this.activeSources.clear();
    this.soundBuffers.clear();
    
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
export const fortuneSound = new FortuneSoundManager();