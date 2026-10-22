// Efeitos sintetizados com Web Audio: nada a baixar, e o jogo segue funcionando sem áudio.
let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
let ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

export function setMuted(m: boolean): void {
  muted = m;
  if (m) stopAmbience();
}
export const isMuted = () => muted;

/** Só cria o contexto depois de um gesto do usuário (política de autoplay dos navegadores). */
function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ctx;
  } catch {
    return null;
  }
}

function env(a: AudioContext, peak: number, attack: number, decay: number, at = a.currentTime): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.connect(a.destination);
  return g;
}

function tone(type: OscillatorType, from: number, to: number, peak: number, attack: number, decay: number, delay = 0): void {
  const a = audio();
  if (!a) return;
  const at = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
  o.connect(env(a, peak, attack, decay, at));
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}

function burst(filter: BiquadFilterType, freq: number, peak: number, attack: number, decay: number, q = 1, delay = 0): void {
  const a = audio();
  if (!a || !noise) return;
  const at = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(env(a, peak, attack, decay, at));
  src.start(at, Math.random());
  src.stop(at + attack + decay + 0.05);
}

export const sfx = {
  click: () => tone('triangle', 900, 600, 0.08, 0.005, 0.06),
  select: () => tone('triangle', 520, 700, 0.06, 0.005, 0.05),
  kick: () => {
    tone('sine', 160, 45, 0.6, 0.004, 0.16);
    burst('bandpass', 1800, 0.25, 0.002, 0.05, 2);
  },
  post: () => {
    for (const [f, p] of [[880, 0.22], [1320, 0.12], [2210, 0.07]] as const) tone('sine', f, f * 0.98, p, 0.002, 0.9);
    burst('highpass', 3000, 0.15, 0.001, 0.08);
  },
  save: () => {
    tone('sine', 120, 60, 0.35, 0.003, 0.12);
    burst('lowpass', 900, 0.35, 0.003, 0.15);
  },
  goal: () => {
    burst('bandpass', 700, 0.5, 0.25, 2.4, 0.6);
    burst('bandpass', 1500, 0.25, 0.3, 2.0, 0.8, 0.05);
  },
  groan: () => burst('lowpass', 500, 0.35, 0.15, 1.2, 0.7),
  whistle: () => {
    tone('square', 2700, 2650, 0.05, 0.01, 0.18);
    tone('square', 2700, 2600, 0.05, 0.01, 0.45, 0.25);
  },
  transition: () => tone('sine', 340, 520, 0.05, 0.02, 0.12),
};

export function startAmbience(): void {
  const a = audio();
  if (!a || !noise || ambience) return;
  const src = a.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 600;
  f.Q.value = 0.5;
  const gain = a.createGain();
  gain.gain.value = 0.035;
  src.connect(f).connect(gain).connect(a.destination);
  src.start();
  ambience = { src, gain };
}

export function stopAmbience(): void {
  ambience?.src.stop();
  ambience = null;
}
