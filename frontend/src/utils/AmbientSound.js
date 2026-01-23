export class SoothingAmbient {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContext();
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 0.18; // lower starting master volume
    this.masterGain.connect(this.audioCtx.destination);

    this.isPlaying = false;
    this.pads = [];
    this.chimeTimer = null;

    // Softer, more meditative scale (closer to just intonation feel)
    this.scale = [
      220.00,    // A3
      246.94,    // B3   ≈ 9/8 from A
      293.66,    // D4
      329.63,    // E4
      369.99,    // F#4 ≈ 5/4 from D
      440.00     // A4 (octave)
    ];
  }

  async initialize() {
    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  setVolume(value) {
    this.masterGain.gain.value = value * 0.7; // scale down a bit for safety
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Start 3–4 very slow, overlapping background pads
    const padFreqs = [this.scale[0], this.scale[2], this.scale[4], this.scale[0] * 2];
    padFreqs.forEach(freq => {
      this.pads.push(this.createPad(freq));
    });

    // Very sparse, soft chimes every 12–25 seconds
    this.chimeTimer = setInterval(() => {
      const note = this.scale[Math.floor(Math.random() * this.scale.length)];
      this.playSoftChime(note * (Math.random() > 0.6 ? 2 : 1)); // occasional octave
    }, 12000 + Math.random() * 13000);
  }

  pause() {
    this.stop();
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    // Very gentle fade-out for pads (5–8 seconds)
    this.pads.forEach(pad => {
      pad.gain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      pad.gain.gain.setValueAtTime(pad.gain.gain.value, this.audioCtx.currentTime);
      pad.gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 6 + Math.random() * 2);
      setTimeout(() => {
        pad.osc.stop();
        pad.osc.disconnect();
      }, 8500);
    });

    this.pads = [];
    clearInterval(this.chimeTimer);
  }

  createPad(baseFreq) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();
    const detuneOsc = this.audioCtx.createOscillator(); // subtle chorus-like detune

    osc.type = "sine";           // warmest, purest
    osc.frequency.value = baseFreq;
    osc.detune.value = -8;       // tiny centering

    // Second slightly detuned oscillator for gentle chorusing
    detuneOsc.type = "sine";
    detuneOsc.frequency.value = baseFreq;
    detuneOsc.detune.value = 12 + Math.random() * 8; // 12–20 cents detune
    const detuneGain = this.audioCtx.createGain();
    detuneGain.gain.value = 0.6; // quieter second voice

    filter.type = "lowpass";
    filter.frequency.value = 420 + Math.random() * 180; // 420–600 Hz → very warm/dark
    filter.Q.value = 0.8;

    // Very slow attack: 12–24 seconds fade in
    gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(
      0.055 + Math.random() * 0.03, // very low peak volume
      this.audioCtx.currentTime + 14 + Math.random() * 10
    );

    // Connect everything
    osc.connect(filter);
    detuneOsc.connect(detuneGain);
    detuneGain.connect(filter);

    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    detuneOsc.start();

    return { osc, detuneOsc, gain, filter };
  }

  playSoftChime(freq) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    const filter = this.audioCtx.createBiquadFilter();

    osc.type = "triangle";       // softer than square, still bell-like
    osc.frequency.value = freq;

    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;

    // Very gentle pluck → long natural decay
    gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.065, this.audioCtx.currentTime + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.00008, this.audioCtx.currentTime + 9 + Math.random() * 5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 12);
  }
}