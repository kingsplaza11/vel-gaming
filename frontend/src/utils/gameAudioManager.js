// src/utils/gameAudioManager.js
class GameAudioManager {
  constructor() {
    this.sounds = {};
    this.currentBackground = null;
    this.isMuted = localStorage.getItem('game_muted') === 'true';
    this.masterVolume = 0.6; // 60% volume
    
    // Load sounds
    this.initSounds();
  }

  initSounds() {
    // Background music tracks
    this.sounds.backgrounds = {
      fortune: new Audio('https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-waiting-667.mp3'),
      ambient: new Audio('https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3'),
      chill: new Audio('https://assets.mixkit.co/music/preview/mixkit-chill-abstract-loop-229.mp3')
    };

    // Game action sounds
    this.sounds.actions = {
      click: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-select-click-1109.mp3'),
      stake: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-casino-chips-759.mp3'),
      tileReveal: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-unlock-game-notification-253.mp3'),
      winSmall: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3'),
      winBig: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2016.mp3'),
      lose: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-fail-notification-946.mp3'),
      trap: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-bomb-explosion-in-earth-1992.mp3'),
      cashout: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-coins-handling-1938.mp3'),
      bonus: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-achievement-bell-600.mp3'),
      reset: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-ui-pop-up-991.mp3'),
      penalty: new Audio('https://assets.mixkit.co/sfx/preview/mixkit-wrong-answer-bass-tone-957.mp3')
    };

    // Configure all sounds
    Object.values(this.sounds.backgrounds).forEach(sound => {
      sound.loop = true;
      sound.volume = 0.15 * this.masterVolume; // 15% volume for background
    });

    Object.values(this.sounds.actions).forEach(sound => {
      sound.volume = 0.3 * this.masterVolume; // 30% volume for actions
    });

    // Set specific volumes
    this.sounds.actions.winBig.volume = 0.4 * this.masterVolume;
    this.sounds.actions.cashout.volume = 0.35 * this.masterVolume;
    this.sounds.actions.trap.volume = 0.25 * this.masterVolume;
  }

  // Play background music
  playBackground(type = 'fortune') {
    if (this.isMuted || !this.sounds.backgrounds[type]) return;
    
    if (this.currentBackground) {
      this.currentBackground.pause();
      this.currentBackground.currentTime = 0;
    }
    
    this.currentBackground = this.sounds.backgrounds[type];
    this.currentBackground.play().catch(e => console.log('Background play failed:', e));
  }

  // Stop background music
  stopBackground() {
    if (this.currentBackground) {
      this.currentBackground.pause();
      this.currentBackground.currentTime = 0;
      this.currentBackground = null;
    }
  }

  // Play action sound
  playSound(soundName) {
    if (this.isMuted || !this.sounds.actions[soundName]) return;
    
    const sound = this.sounds.actions[soundName];
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Sound play failed:', e));
  }

  // Play tile reveal sound based on result
  playTileSound(resultType) {
    const soundMap = {
      'safe': 'winSmall',
      'carrot_bonus': 'bonus',
      'small_win': 'winSmall',
      'penalty': 'penalty',
      'major_penalty': 'penalty',
      'reset': 'reset',
      'trap': 'trap',
      'auto_cashout': 'cashout'
    };

    if (soundMap[resultType]) {
      this.playSound(soundMap[resultType]);
    }
  }

  // Toggle mute
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('game_muted', this.isMuted);
    
    if (this.isMuted) {
      this.stopBackground();
    } else if (this.currentBackground) {
      this.playBackground();
    }
    
    return this.isMuted;
  }

  // Set volume
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    
    // Update all sound volumes
    Object.values(this.sounds.backgrounds).forEach(sound => {
      sound.volume = 0.15 * this.masterVolume;
    });

    Object.values(this.sounds.actions).forEach(sound => {
      sound.volume = 0.3 * this.masterVolume;
    });
    
    this.sounds.actions.winBig.volume = 0.4 * this.masterVolume;
    this.sounds.actions.cashout.volume = 0.35 * this.masterVolume;
    this.sounds.actions.trap.volume = 0.25 * this.masterVolume;
  }

  // Cleanup
  cleanup() {
    this.stopBackground();
    Object.values(this.sounds.actions).forEach(sound => {
      sound.pause();
      sound.currentTime = 0;
    });
  }
}

export const gameAudio = new GameAudioManager();