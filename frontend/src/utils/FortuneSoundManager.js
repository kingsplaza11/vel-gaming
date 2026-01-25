// src/utils/FortuneSoundManager.js
class FortuneSoundManager {
  constructor() {
    this.audioContext = null;
    this.sounds = new Map();
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
      
      // Click sound (fallback)
      'click': '/sounds/mixkit-arcade-bonus-alert-767.wav',
      'stake': '/sounds/mixkit-game-bonus-reached-2065.wav'
    };
  }

  // Initialize Web Audio API
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context created, state:', this.audioContext.state);
        
        // Set up auto-resume
        this.setupAutoResume();
        
        // Preload important sounds
        this.preloadSounds();
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
    
    // Remove existing listeners first
    document.removeEventListener('click', resumeAudio);
    document.removeEventListener('touchstart', resumeAudio);
    document.removeEventListener('keydown', resumeAudio);
    
    // Add new listeners
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

  // Preload important sounds
  async preloadSounds() {
    if (this.isInitialized) return;
    
    console.log('Preloading sounds...');
    const soundsToPreload = ['click', 'goodTap', 'badTap', 'wrongAnswer'];
    
    for (const soundKey of soundsToPreload) {
      await this.loadSound(soundKey);
    }
    
    this.isInitialized = true;
    console.log('Sounds preloaded');
  }

  // Load a sound file
  async loadSound(soundKey) {
    if (this.sounds.has(soundKey)) return this.sounds.get(soundKey);
    
    const url = this.soundFiles[soundKey];
    if (!url) {
      console.error('Sound URL not found for:', soundKey);
      return null;
    }
    
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.sounds.set(soundKey, audioBuffer);
      console.log('Loaded sound:', soundKey);
      return audioBuffer;
    } catch (error) {
      console.error('Failed to load sound:', soundKey, error);
      return null;
    }
  }

  // Play a sound by key
  async playSound(soundKey, options = {}) {
    if (this.isMuted || !this.audioContext) return null;
    
    this.init();
    
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
      // Load sound if not already loaded
      let audioBuffer = this.sounds.get(soundKey);
      if (!audioBuffer) {
        audioBuffer = await this.loadSound(soundKey);
        if (!audioBuffer) return null;
      }
      
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
      
      // Set up cleanup
      const soundId = Date.now() + Math.random();
      const soundEntry = { source, gainNode, isPlaying: true };
      
      source.onended = () => {
        soundEntry.isPlaying = false;
        this.cleanupSound(soundId);
        if (onEnded) onEnded();
      };
      
      this.sounds.set(soundId, soundEntry);
      
      return { soundId, source, gainNode };
    } catch (error) {
      console.error('Failed to play sound:', soundKey, error);
      return null;
    }
  }

  // Play click sound
  playClick() {
    if (this.isMuted) return;
    this.playSound('click', { volume: 0.5 * this.masterVolume });
  }

  // Play stake sound
  playStake() {
    if (this.isMuted) return;
    this.playSound('stake', { volume: 0.6 * this.masterVolume });
  }

  // Generate tile reveal sound based on result
  playTileSound(resultType) {
    if (this.isMuted) return;
    
    switch (resultType) {
      case 'safe':
      case 'carrot_bonus':
        this.playGoodTap();
        break;
      case 'small_win':
        this.playGoodTap();
        break;
      case 'penalty':
        this.playBadTap();
        break;
      case 'major_penalty':
        this.playVeryBadTap();
        break;
      case 'reset':
        this.playResetTap();
        break;
      case 'trap':
        this.playGameOverSound();
        break;
      case 'auto_cashout':
        this.playCashoutSound();
        break;
      default:
        this.playClick();
    }
  }

  // Good tap sound
  playGoodTap() {
    if (this.isMuted) return;
    this.playSound('goodTap', { volume: 0.6 * this.masterVolume });
  }

  // Reset tap sound
  playResetTap() {
    if (this.isMuted) return;
    this.playSound('resetTap', { volume: 0.5 * this.masterVolume });
  }

  // Bad tap sound
  playBadTap() {
    if (this.isMuted) return;
    // Play both bad tap sounds with slight delay
    this.playSound('badTap', { volume: 0.5 * this.masterVolume });
    this.playSound('electricBuzz', { 
      volume: 0.4 * this.masterVolume,
      delay: 0.1 
    });
  }

  // Very bad tap sound
  playVeryBadTap() {
    if (this.isMuted) return;
    this.playSound('wrongAnswer', { volume: 0.6 * this.masterVolume });
  }

  // Cashout sound - plays winning sounds together
  playCashoutSound() {
    if (this.isMuted) return;
    
    // Play applause for longer duration
    this.playSound('applause', { 
      volume: 0.7 * this.masterVolume,
      loop: false 
    });
    
    // Play bonus sound with slight delay
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('bonus', { volume: 0.6 * this.masterVolume });
      }
    }, 300);
    
    // Play level complete sound with more delay
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('levelComplete', { volume: 0.5 * this.masterVolume });
      }
    }, 600);
  }

  // Game over sound - plays losing sounds together
  playGameOverSound() {
    if (this.isMuted) return;
    
    // Play first laugh
    this.playSound('laugh1', { 
      volume: 0.6 * this.masterVolume,
      loop: false 
    });
    
    // Play second laugh with delay
    setTimeout(() => {
      if (!this.isMuted) {
        this.playSound('laugh2', { 
          volume: 0.6 * this.masterVolume,
          loop: false 
        });
      }
    }, 800);
    
    // Play very bad tap sound after laughs
    setTimeout(() => {
      if (!this.isMuted) {
        this.playVeryBadTap();
      }
    }, 1600);
  }

  // Get count of active sounds
  getActiveSoundCount() {
    let count = 0;
    for (const [key, sound] of this.sounds) {
      if (typeof key === 'string') continue; // Skip buffer entries
      if (sound.isPlaying) count++;
    }
    return count;
  }

  // Cleanup individual sound
  cleanupSound(soundId) {
    const sound = this.sounds.get(soundId);
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
      this.sounds.delete(soundId);
    }
  }

  // Cleanup all playing sounds
  cleanupAllSounds() {
    for (const [key, sound] of this.sounds) {
      if (typeof key === 'string') continue; // Skip buffer entries
      this.cleanupSound(key);
    }
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('fortune_muted', this.isMuted);
    
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
    for (const [key] of this.sounds) {
      if (typeof key === 'string') {
        bufferKeys.push(key);
      }
    }
    bufferKeys.forEach(key => this.sounds.delete(key));
    
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