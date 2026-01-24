// src/games/fortune/sound.js
export function createSound(src, { loop = false, volume = 0.9 } = {}) {
  const a = new Audio(src);
  a.loop = loop;
  a.volume = volume;

  let stopped = false;

  return {
    play() {
      if (stopped) return;
      a.currentTime = 0;
      a.play().catch(() => {});
    },
    startLoop() {
      if (stopped) return;
      a.loop = true;
      a.play().catch(() => {});
    },
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    },
    setVolume(v) {
      a.volume = Math.max(0, Math.min(1, v));
    }
  };
}
