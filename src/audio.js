// Sound that reacts to the journey.
// The song plays through a filter that starts almost shut (muffled, far away) and opens
// chapter by chapter until it is fully clear at the end. Scrolling fast ducks the filter,
// pushes the mids and adds reverb, so movement feels punchy. On top: wind when flying,
// a low hum, and short hits for doors, take-offs, tags, hovers and clicks.

// how open the song's filter is at the start of each stage (Hz): intro, then chapters 1-6
const CUTOFF = [420, 760, 1500, 560, 1300, 2600, 16000];

export function createAudio({ src, button }) {
  let ctx = null;
  let n = null; // the audio nodes
  let playing = false;
  const last = {};
  let lastState = {};

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
    }
    return buf;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0;
    const squash = ctx.createDynamicsCompressor();
    squash.threshold.value = -20;
    squash.knee.value = 24;
    squash.ratio.value = 3;
    squash.attack.value = 0.05;
    squash.release.value = 0.4;
    master.connect(squash).connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.8, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet).connect(master);

    // effects bus: dry to the master, plus a copy into the reverb
    const bus = ctx.createGain();
    const busDry = ctx.createGain();
    busDry.gain.value = 0.7;
    bus.connect(busDry).connect(master);
    bus.connect(reverb);

    // the song
    const el = new Audio(src);
    el.loop = true;
    el.preload = 'auto';
    const songF = ctx.createBiquadFilter();
    songF.type = 'lowpass';
    songF.frequency.value = CUTOFF[0];
    songF.Q.value = 0.9;
    const punch = ctx.createBiquadFilter();
    punch.type = 'peaking';
    punch.frequency.value = 900;
    punch.Q.value = 1.6;
    punch.gain.value = 0;
    const songG = ctx.createGain();
    songG.gain.value = 0.85;
    const send = ctx.createGain();
    send.gain.value = 0.1;
    ctx.createMediaElementSource(el).connect(songF).connect(punch).connect(songG);
    songG.connect(master);
    songG.connect(send).connect(reverb);

    // soft noise, reused for wind and for sweeps
    const noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = noise.getChannelData(0);
    let a = 0, b = 0, c = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      a = 0.997 * a + w * 0.029;
      b = 0.985 * b + w * 0.032;
      c = 0.95 * c + w * 0.048;
      d[i] = (a + b + c + w * 0.02) * 0.9;
    }
    const noiseSrc = () => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(0, Math.random() * 2.5);
      return s;
    };
    const airF = ctx.createBiquadFilter();
    airF.type = 'lowpass';
    airF.frequency.value = 300;
    const airG = ctx.createGain();
    airG.gain.value = 0;
    noiseSrc().connect(airF).connect(airG).connect(bus);

    const hum = ctx.createOscillator();
    hum.frequency.value = 41.2;
    const humG = ctx.createGain();
    humG.gain.value = 0;
    hum.connect(humG).connect(bus);
    hum.start();

    n = { master, el, songF, punch, songG, send, airF, airG, humG, bus, noiseSrc };
  }

  /* ---------- one-shot sounds ---------- */

  const env = (g, t, attack, peak, decay) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  function tone(freq, { type = 'sine', a = 0.005, d = 0.25, peak = 0.08, to = null, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    const g = ctx.createGain();
    env(g, t, a, peak, d);
    o.connect(g).connect(n.bus);
    o.start(t);
    o.stop(t + a + d + 0.05);
  }
  function sweep({ from = 300, to = 2400, back = 400, a = 0.35, d = 0.9, peak = 0.2, q = 1.4 } = {}) {
    const t = ctx.currentTime;
    const s = n.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + a);
    f.frequency.exponentialRampToValueAtTime(back, t + a + d);
    const g = ctx.createGain();
    env(g, t, a, peak, d);
    s.connect(f).connect(g).connect(n.bus);
    s.stop(t + a + d + 0.1);
  }

  const SFX = {
    enter: () => {
      tone(52, { a: 0.02, d: 2.2, peak: 0.32, to: 30 });
      sweep({ from: 200, to: 2600, back: 300, a: 0.5, d: 1.6, peak: 0.16, q: 0.9 });
    },
    chapter: () => {
      tone(523.3, { a: 0.02, d: 1.1, peak: 0.03 });
      tone(784, { a: 0.02, d: 1.3, peak: 0.02, at: 0.09 });
      tone(64, { a: 0.01, d: 0.9, peak: 0.18, to: 38 });
    },
    tag: (i = 0) => {
      const f = [880, 988, 1175, 1319, 1568][i % 5];
      tone(f, { d: 0.35, peak: 0.05 });
      tone(f * 2, { d: 0.12, peak: 0.015 });
    },
    project: () => {
      tone(1320, { type: 'triangle', d: 0.09, peak: 0.03 });
      tone(90, { a: 0.01, d: 0.5, peak: 0.12, to: 50 });
    },
    lift: () => {
      tone(70, { a: 0.01, d: 0.6, peak: 0.26, to: 36 });
      sweep({ from: 150, to: 1900, back: 500, a: 0.7, d: 1.4, peak: 0.18 });
    },
    land: () => {
      tone(86, { a: 0.005, d: 0.5, peak: 0.26, to: 34 });
      sweep({ from: 900, to: 240, back: 140, a: 0.05, d: 0.6, peak: 0.07, q: 1.1 });
    },
    door: () => {
      tone(55, { a: 0.02, d: 1.6, peak: 0.32, to: 30 });
      sweep({ from: 3000, to: 400, back: 120, a: 0.2, d: 1.5, peak: 0.16, q: 0.8 });
    },
    open: () => {
      tone(420, { d: 0.35, peak: 0.07, to: 840 });
      sweep({ from: 500, to: 3000, back: 900, a: 0.12, d: 0.35, peak: 0.07 });
    },
    close: () => {
      tone(760, { d: 0.3, peak: 0.05, to: 380 });
      sweep({ from: 2600, to: 700, back: 300, a: 0.08, d: 0.3, peak: 0.05 });
    },
    hover: () => tone(2100, { d: 0.05, peak: 0.012 }),
    click: () => tone(900, { d: 0.08, peak: 0.03, to: 600 }),
  };
  function sfx(name, arg) {
    if (!ctx || !playing || !SFX[name]) return;
    const now = performance.now();
    if (now - (last[name] || 0) < 60) return;
    last[name] = now;
    SFX[name](arg);
  }

  /* ---------- on / off ---------- */

  function show() {
    if (!button) return;
    button.setAttribute('aria-pressed', String(playing));
    button.classList.toggle('on', playing);
    const s = button.querySelector('span');
    if (s) s.textContent = playing ? 'on' : 'off';
  }
  function start() {
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    playing = true;
    n.el.play().catch(() => {});
    n.master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.6); // fades up slowly
    show();
  }
  function stop() {
    if (!ctx) return;
    n.master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    playing = false;
    setTimeout(() => !playing && n.el.pause(), 900);
    show();
  }
  const toggle = () => (playing ? stop() : start());
  button?.addEventListener('click', toggle);

  let hovered = null;
  addEventListener('pointerover', (e) => {
    const t = e.target.closest?.('a, button');
    if (t && t !== hovered) sfx('hover');
    hovered = t;
  });
  addEventListener('click', (e) => e.target.closest?.('a, button') && sfx('click'), true);
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      ctx.suspend();
      n.el.pause();
    } else if (playing) {
      ctx.resume();
      n.el.play().catch(() => {});
    }
  });

  /* ---------- every frame ---------- */
  // stage: 0 = intro, 1..6 = chapters, with a fraction for how far through
  // speed: 0..1 how hard the visitor is scrolling. fly: 0 running .. 1 flying.
  function update({ stage = 0, speed = 0, fly = 0, modal = false, footer = 0, tags = false, project = -1, door = false }) {
    if (!ctx || !playing) return;
    const t = ctx.currentTime;
    const top = CUTOFF.length - 1;
    const i = Math.floor(Math.max(0, Math.min(top, stage)));
    const j = Math.min(top, i + 1);
    const f = Math.max(0, Math.min(1, stage - i));
    let cut = Math.exp(Math.log(CUTOFF[i]) * (1 - f) + Math.log(CUTOFF[j]) * f);

    cut *= 1 + fly * 0.25; // a little brighter in the air
    cut *= 1 - speed * 0.6; // moving fast ducks it...
    n.punch.gain.setTargetAtTime(speed * 9, t, 0.12); // ...and pushes the mids
    n.punch.frequency.setTargetAtTime(500 + speed * 2200, t, 0.15);
    n.send.gain.setTargetAtTime(0.1 + speed * 0.9, t, 0.15); // and throws it into the room

    const level = modal ? 0.3 : 1;
    if (modal) cut = Math.min(cut, 420); // a project is open: music steps back
    cut = Math.min(cut, 20000 - footer * 19300); // the last words: it settles down
    n.songF.frequency.setTargetAtTime(Math.max(120, Math.min(19000, cut)), t, 0.18);
    n.songG.gain.setTargetAtTime(0.85 * level * (1 - footer * 0.3), t, 0.4);

    n.airG.gain.setTargetAtTime((fly * 0.12 + speed * 0.09) * level, t, 0.35);
    n.airF.frequency.setTargetAtTime(260 + fly * 240 + speed * 900, t, 0.3);
    n.humG.gain.setTargetAtTime((1 - fly) * 0.035 * level, t, 0.6);

    // moments
    const s = lastState;
    if (Math.floor(stage) !== s.stageI && s.stageI !== undefined && Math.floor(stage) > 0) sfx('chapter');
    if (tags && !s.tags) [0, 1, 2, 3, 4].forEach((k) => setTimeout(() => sfx('tag', k), k * 130));
    if (project !== s.project && project >= 0) sfx('project');
    if (fly > 0.5 && s.fly <= 0.5) sfx('lift');
    if (fly < 0.5 && s.fly >= 0.5) sfx('land');
    if (door && !s.door) sfx('door');
    if (modal !== s.modal && s.modal !== undefined) sfx(modal ? 'open' : 'close');
    lastState = { stageI: Math.floor(stage), tags, project, fly, door, modal };
  }

  return {
    update,
    sfx,
    toggle,
    enter(withSound) {
      if (!withSound) return show();
      start();
      sfx('enter');
    },
    get on() {
      return playing;
    },
  };
}
