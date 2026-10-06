// Sons de interface da chamada — sintetizados via WebAudio (sem assets).
// Curtos e discretos, no estilo Discord: entrar/sair da call e início/fim
// de transmissão de tela.

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// Toca uma nota com envelope suave (sem estalos)
function tone(
  freq: number,
  startIn: number,   // segundos a partir de agora
  dur: number,
  type: OscillatorType = 'sine',
  peak = 0.14,
) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + startIn;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Saída com um eco curto e leve (dá "ar" aos sons de entrar/sair da call)
let echoBus: GainNode | null = null;
function echo(): AudioNode | null {
  const c = ac();
  if (!c) return null;
  if (!echoBus) {
    echoBus = c.createGain();
    echoBus.gain.value = 0.9;
    const delay = c.createDelay(1);
    delay.delayTime.value = 0.13;
    const feedback = c.createGain();
    feedback.gain.value = 0.22;
    const wet = c.createGain();
    wet.gain.value = 0.25;
    echoBus.connect(c.destination);
    echoBus.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(c.destination);
  }
  return echoBus;
}

// Nota com desafinação leve e filtro passa-baixa, saindo pelo eco
function softTone(freq: number, startIn: number, dur: number, type: OscillatorType, peak: number, detune: number, lowpass: number) {
  const c = ac();
  const out = echo();
  if (!c || !out) return;
  const t0 = c.currentTime + startIn;
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.detune.value = detune;
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// "Sopro": ruído filtrado com a frequência deslizando de f1 para f2
function swoosh(startIn: number, dur: number, f1: number, f2: number, peak: number) {
  const c = ac();
  const out = echo();
  if (!c || !out) return;
  const t0 = c.currentTime + startIn;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 6;
  band.frequency.setValueAtTime(f1, t0);
  band.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + dur * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(band).connect(gain).connect(out);
  src.start(t0);
  src.stop(t0 + dur);
}

/** Alguém entrou na chamada (inclusive você) — "Neon": acorde gamer suave subindo (Mi, Sol#, Si) */
export function playCallJoin() {
  [659.25, 830.61, 987.77].forEach((f, i) => softTone(f, i * 0.05, 0.38, 'triangle', 0.08, 6, 3200));
}

/** Alguém saiu da chamada — "Portal": nota curta e um sopro que some descendo */
export function playCallLeave() {
  const c = ac();
  const out = echo();
  if (!c || !out) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
  osc.connect(gain).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.25);
  swoosh(0.06, 0.34, 3200, 350, 0.28);
}

/** Uma transmissão de tela COMEÇOU — arpejo brilhante de 3 notas */
export function playLiveStart() {
  tone(523.25, 0, 0.13, 'triangle', 0.12);   // C5
  tone(659.25, 0.09, 0.13, 'triangle', 0.12); // E5
  tone(783.99, 0.18, 0.26, 'triangle', 0.13); // G5
}

/** Uma transmissão de tela TERMINOU — descida suave */
export function playLiveEnd() {
  tone(783.99, 0, 0.13, 'triangle', 0.11);   // G5
  tone(523.25, 0.1, 0.28, 'triangle', 0.11); // C5
}

/** Alguém MENCIONOU você (@nome) — dois toques altos e rápidos */
export function playMention() {
  tone(880.0, 0, 0.09, 'sine', 0.16);    // A5
  tone(1174.7, 0.1, 0.16, 'sine', 0.16); // D6
}
