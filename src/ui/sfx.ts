// Small synthesized sound effects, so the prototype has weight without
// shipping audio files. Everything is built from oscillators and filtered
// noise on one shared AudioContext, which starts on the first click.

type Sfx =
  | 'click' | 'hover' | 'select' | 'place' | 'ready' | 'whoosh' | 'hit' | 'crit' | 'heal'
  | 'buff' | 'death' | 'shield' | 'spell' | 'victory' | 'defeat' | 'summon';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try { muted = localStorage.getItem('mercs:muted') === '1'; } catch { /* storage unavailable */ }

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m: boolean) {
  muted = m;
  try { localStorage.setItem('mercs:muted', m ? '1' : '0'); } catch { /* ignore */ }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, opts: { freq?: number; q?: number; gain?: number; delay?: number; type?: BiquadFilterType } = {}) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + (opts.delay ?? 0);
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 1200;
  f.Q.value = opts.q ?? 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function play(s: Sfx) {
  switch (s) {
    case 'hover': return tone(1800, 0.04, { type: 'triangle', gain: 0.03 });
    case 'click': return tone(660, 0.07, { type: 'triangle', gain: 0.12 }), noise(0.03, { freq: 4000, gain: 0.08 });
    case 'select': return tone(520, 0.09, { type: 'triangle', gain: 0.14 }), tone(780, 0.12, { type: 'triangle', gain: 0.1, delay: 0.05 });
    case 'place': return tone(140, 0.18, { gain: 0.35, slide: 0.6 }), noise(0.12, { freq: 500, gain: 0.25 });
    case 'ready':
      tone(196, 0.9, { type: 'triangle', gain: 0.22 });
      tone(294, 0.9, { type: 'triangle', gain: 0.14, delay: 0.04 });
      tone(392, 1.1, { type: 'sine', gain: 0.12, delay: 0.08 });
      return noise(0.25, { freq: 2500, gain: 0.1 });
    case 'whoosh': return noise(0.28, { freq: 900, q: 1.5, gain: 0.22, type: 'bandpass' });
    case 'hit': return tone(110, 0.22, { gain: 0.45, slide: 0.5 }), noise(0.14, { freq: 1600, gain: 0.35 });
    case 'crit':
      tone(90, 0.35, { gain: 0.55, slide: 0.45, type: 'square' });
      noise(0.25, { freq: 2200, gain: 0.45 });
      return tone(1320, 0.18, { type: 'triangle', gain: 0.1, delay: 0.02 });
    case 'shield': return tone(1200, 0.25, { type: 'triangle', gain: 0.12 }), tone(1800, 0.3, { gain: 0.08, delay: 0.05 });
    case 'heal':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.45, { type: 'sine', gain: 0.1, delay: i * 0.06 }));
      return;
    case 'buff': return tone(330, 0.25, { type: 'triangle', gain: 0.14, slide: 2 }), tone(660, 0.2, { gain: 0.06, delay: 0.1 });
    case 'spell': return tone(520, 0.4, { type: 'sine', gain: 0.1, slide: 1.8 }), noise(0.35, { freq: 3000, q: 3, gain: 0.1 });
    case 'summon': return tone(260, 0.5, { type: 'sine', gain: 0.14, slide: 3 }), noise(0.4, { freq: 1800, q: 4, gain: 0.08 });
    case 'death':
      tone(220, 0.8, { type: 'sawtooth', gain: 0.12, slide: 0.25 });
      return noise(0.6, { freq: 300, gain: 0.3, type: 'lowpass' });
    case 'victory':
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.9, { type: 'triangle', gain: 0.16, delay: i * 0.14 }));
      return;
    case 'defeat':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.9, { type: 'triangle', gain: 0.14, delay: i * 0.2 }));
      return;
  }
}
