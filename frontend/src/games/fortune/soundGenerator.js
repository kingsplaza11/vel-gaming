// src/games/fortune/soundGenerator.js
import React from 'react';

class SoundGenerator {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.isInitialized = false;
    this.volume = 0.7;
    
    // Sound presets
    this.presets = {
      step: { type: 'coin', frequency: 800, duration: 0.1 },
      win: { type: 'success', frequency: 1200, duration: 0.8 },
      lose: { type: 'fail', frequency: 300, duration: 0.5 },
      click: { type: 'click', frequency: 600, duration: 0.05 },
      boost: { type: 'rise', frequency: 1000, duration: 0.4 },
      steal: { type: 'steal', frequency: 400, duration: 0.3 },
      reduce: { type: 'reduce', frequency: 350, duration: 0.4 },
      explosion: { type: 'explosion', frequency: 150, duration: 0.6 },
      mystery: { type: 'mystery', frequency: 500, duration: 0.5 },
      powerup: { type: 'powerup', frequency: 900, duration: 0.3 }
    };
  }

  async init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.volume;
      this.isInitialized = true;
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  play(soundName) {
    if (!this.isInitialized) return;
    
    const preset = this.presets[soundName];
    if (!preset) return;

    switch (preset.type) {
      case 'coin':
        this.playCoin(preset.frequency, preset.duration);
        break;
      case 'success':
        this.playSuccess(preset.frequency, preset.duration);
        break;
      case 'fail':
        this.playFail(preset.frequency, preset.duration);
        break;
      case 'click':
        this.playClick(preset.frequency, preset.duration);
        break;
      case 'rise':
        this.playRise(preset.frequency, preset.duration);
        break;
      case 'steal':
        this.playSteal(preset.frequency, preset.duration);
        break;
      case 'reduce':
        this.playReduce(preset.frequency, preset.duration);
        break;
      case 'explosion':
        this.playExplosion(preset.frequency, preset.duration);
        break;
      case 'mystery':
        this.playMystery(preset.frequency, preset.duration);
        break;
      case 'powerup':
        this.playPowerup(preset.frequency, preset.duration);
        break;
    }
  }

  setVolume(level) {
    this.volume = Math.max(0, Math.min(1, level));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  // Sound generation methods
  playCoin(freq = 800, duration = 0.1) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playSuccess(freq = 1200, duration = 0.8) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioContext.currentTime + duration * 0.5);
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, this.audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playFail(freq = 300, duration = 0.5) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq * 1.5, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq, this.audioContext.currentTime + duration);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playClick(freq = 600, duration = 0.05) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playRise(freq = 1000, duration = 0.4) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(freq * 2, this.audioContext.currentTime + duration);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + duration * 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playSteal(freq = 400, duration = 0.3) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(freq * 0.5, this.audioContext.currentTime + duration);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + duration * 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playReduce(freq = 350, duration = 0.4) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    const times = [0, 0.1, 0.2, 0.3, 0.4];
    const freqs = [freq, freq * 0.8, freq, freq * 0.7, freq * 0.6];
    
    times.forEach((time, i) => {
      oscillator.frequency.setValueAtTime(freqs[i], this.audioContext.currentTime + time);
    });
    
    oscillator.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playExplosion(freq = 150, duration = 0.6) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq * 3, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq, this.audioContext.currentTime + duration);
    oscillator.type = 'sawtooth';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.6, this.audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playMystery(freq = 500, duration = 0.5) {
    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator1.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator1.frequency.linearRampToValueAtTime(freq * 1.5, this.audioContext.currentTime + duration);
    oscillator1.type = 'sine';
    
    oscillator2.frequency.setValueAtTime(freq * 1.2, this.audioContext.currentTime);
    oscillator2.frequency.linearRampToValueAtTime(freq * 0.8, this.audioContext.currentTime + duration);
    oscillator2.type = 'triangle';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator1.start();
    oscillator2.start();
    oscillator1.stop(this.audioContext.currentTime + duration);
    oscillator2.stop(this.audioContext.currentTime + duration);
  }

  playPowerup(freq = 900, duration = 0.3) {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(freq * 1.8, this.audioContext.currentTime + duration * 0.3);
    oscillator.frequency.linearRampToValueAtTime(freq * 1.2, this.audioContext.currentTime + duration);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, this.audioContext.currentTime + duration * 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

let soundGeneratorInstance = null;

export const getSoundGenerator = () => {
  if (!soundGeneratorInstance) {
    soundGeneratorInstance = new SoundGenerator();
  }
  return soundGeneratorInstance;
};

export const useSoundGenerator = () => {
  const [isReady, setIsReady] = React.useState(false);
  const soundGeneratorRef = React.useRef(null);

  React.useEffect(() => {
    const initialize = async () => {
      soundGeneratorRef.current = getSoundGenerator();
      await soundGeneratorRef.current.init();
      setIsReady(true);
    };

    initialize();

    return () => {
      // Cleanup if needed
    };
  }, []);

  const playSound = React.useCallback((soundName) => {
    if (soundGeneratorRef.current && isReady) {
      soundGeneratorRef.current.play(soundName);
    }
  }, [isReady]);

  const setVolume = React.useCallback((level) => {
    if (soundGeneratorRef.current) {
      soundGeneratorRef.current.setVolume(level);
    }
  }, []);

  return { playSound, setVolume, isReady };
};