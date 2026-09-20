/* =========================================================
   audio.js - Web Audio API で効果音 & BGM を合成
   ========================================================= */

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let bgmGain = null;
  let seGain = null;
  let bgmTimer = null;
  let bgmStep = 0;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(ctx.destination);

    seGain = ctx.createGain();
    seGain.gain.value = 0.55;
    seGain.connect(masterGain);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.22;
    bgmGain.connect(masterGain);
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function seShoot() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 0.08);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(seGain);
    o.start(t); o.stop(t + 0.09);
  }

  function seHit() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 800;
    src.connect(f); f.connect(g); g.connect(seGain);
    src.start(t);

    const o = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    g2.gain.setValueAtTime(0.4, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g2); g2.connect(seGain);
    o.start(t); o.stop(t + 0.16);
  }

  function seLevelUp() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      const st = t + i * 0.08;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.4, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      o.connect(g); g.connect(seGain);
      o.start(st); o.stop(st + 0.24);
    });
  }

  function seGameOver() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 392, 311.13, 261.63];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const st = t + i * 0.15;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.35, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.35);
      o.connect(g); g.connect(seGain);
      o.start(st); o.stop(st + 0.36);
    });
  }

  const MELODY = [
    659.25, 0, 783.99, 0, 880, 0, 783.99, 0,
    659.25, 0, 587.33, 0, 523.25, 0, 0, 0,
    587.33, 0, 659.25, 0, 783.99, 0, 880, 0,
    783.99, 0, 659.25, 0, 587.33, 0, 0, 0,
  ];
  const BASS = [
    130.81, 0, 0, 0, 130.81, 0, 0, 0,
    146.83, 0, 0, 0, 146.83, 0, 0, 0,
    174.61, 0, 0, 0, 174.61, 0, 0, 0,
    196.00, 0, 0, 0, 196.00, 0, 0, 0,
  ];
  const STEP_MS = 200;

  function tickBGM() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const m = MELODY[bgmStep % MELODY.length];
    const b = BASS[bgmStep % BASS.length];

    if (m > 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(bgmGain);
      o.start(t); o.stop(t + 0.2);
    }
    if (b > 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = b;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(bgmGain);
      o.start(t); o.stop(t + 0.24);
    }
    bgmStep++;
  }

  function startBGM() {
    if (!ctx) return;
    if (bgmTimer) return;
    bgmStep = 0;
    tickBGM();
    bgmTimer = setInterval(tickBGM, STEP_MS);
  }

  function stopBGM() {
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
  }

  function setBGMVolume(v) { if (bgmGain) bgmGain.gain.value = v; }
  function setSEVolume(v)  { if (seGain)  seGain.gain.value  = v; }

  return {
    init, resume,
    seShoot, seHit, seLevelUp, seGameOver,
    startBGM, stopBGM,
    setBGMVolume, setSEVolume,
  };
})();