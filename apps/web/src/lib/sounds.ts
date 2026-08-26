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

/** Alguém entrou na chamada (inclusive você) — duas notas subindo */
export function playCallJoin() {
  tone(523.25, 0, 0.16, 'sine');      // C5
  tone(659.25, 0.11, 0.22, 'sine');   // E5
}

/** Alguém saiu da chamada — duas notas descendo */
export function playCallLeave() {
  tone(659.25, 0, 0.16, 'sine');      // E5
  tone(440.0, 0.11, 0.24, 'sine');    // A4
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
