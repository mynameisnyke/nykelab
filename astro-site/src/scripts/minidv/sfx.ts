// The desk's sounds, synthesized (no audio files): the drawer sliding, a cassette picked up, the deck's tray clunk, its motor, a beep.
// The AudioContext is only created after the first click, so nothing plays before the visitor has asked for something.
let ctx: AudioContext | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function burst(c: AudioContext, opts: { dur: number; type: BiquadFilterType; from: number; to: number; q?: number; gain: number; attack?: number }) {
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const f = c.createBiquadFilter();
  f.type = opts.type;
  f.Q.value = opts.q ?? 1;
  f.frequency.setValueAtTime(opts.from, t);
  f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, t + (opts.attack ?? 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random(), opts.dur + 0.05);
}

function tone(c: AudioContext, opts: { dur: number; from: number; to: number; gain: number; type?: OscillatorType }) {
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(opts.from, t);
  o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + opts.dur + 0.02);
}

export const sfx = {
  setMuted(m: boolean) {
    muted = m;
  },
  get muted() {
    return muted;
  },
  /** call from a click handler so the context exists before the first sound is needed */
  unlock() {
    ac();
  },
  drawer(opening: boolean) {
    const c = ac();
    if (!c) return;
    burst(c, { dur: 0.75, type: "bandpass", from: opening ? 260 : 700, to: opening ? 700 : 260, q: 0.8, gain: 0.16, attack: 0.18 });
    window.setTimeout(() => tone(c, { dur: 0.12, from: 150, to: 70, gain: 0.18 }), 700);
  },
  pick() {
    const c = ac();
    if (!c) return;
    burst(c, { dur: 0.09, type: "highpass", from: 2400, to: 1200, gain: 0.12, attack: 0.005 });
    tone(c, { dur: 0.08, from: 520, to: 380, gain: 0.05, type: "triangle" });
  },
  slide() {
    const c = ac();
    if (!c) return;
    burst(c, { dur: 0.5, type: "bandpass", from: 1100, to: 500, q: 1.5, gain: 0.1, attack: 0.1 });
  },
  clunk() {
    const c = ac();
    if (!c) return;
    tone(c, { dur: 0.22, from: 110, to: 42, gain: 0.5 });
    burst(c, { dur: 0.1, type: "lowpass", from: 900, to: 200, gain: 0.2, attack: 0.005 });
  },
  /** the loading motor: a low whine that rises and settles */
  whirr(seconds = 1.3) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(58, t);
    o.frequency.linearRampToValueAtTime(96, t + seconds * 0.4);
    o.frequency.linearRampToValueAtTime(70, t + seconds);
    const lfo = c.createOscillator();
    lfo.frequency.value = 23;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 9;
    lfo.connect(lfoGain).connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 520;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t);
    lfo.start(t);
    o.stop(t + seconds + 0.05);
    lfo.stop(t + seconds + 0.05);
  },
  beep() {
    const c = ac();
    if (!c) return;
    tone(c, { dur: 0.09, from: 1760, to: 1760, gain: 0.07, type: "square" });
  },
};
