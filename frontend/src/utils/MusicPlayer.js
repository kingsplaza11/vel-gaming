export class MusicPlayer {
  constructor() {
    this.audio = new Audio();
    this.audio.loop = true;
    this.audio.volume = 0.3;
    this.currentTrack = null;
  }

  play(url) {
    if (this.audio.src !== url) {
      this.audio.src = url;
    }
    this.audio.play();
    this.currentTrack = url;
  }

  pause() {
    this.audio.pause();
  }

  setVolume(value) {
    this.audio.volume = value;
  }

  isPlaying() {
    return !this.audio.paused;
  }
}
