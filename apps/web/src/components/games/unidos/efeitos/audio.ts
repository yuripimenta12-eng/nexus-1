'use client';

import { useConfigUnidos } from './config';

// Sons do UNidos — todos sintetizados na hora (originais, sem arquivos e
// sem custo de download). Três canais com volume separado: interface,
// efeitos e música, respeitando o "mudo".

export type NomeSom =
  | 'selecionar' | 'jogar' | 'impacto' | 'comprar' | 'invalido' | 'vez' | 'tique'
  | 'mais2' | 'mais4' | 'inverter' | 'bloqueio' | 'conexao' | 'call' | 'todosunidos'
  | 'escolherCor' | 'ultimaCarta' | 'gritar' | 'vitoria' | 'derrota' | 'reconectar' | 'distribuir';

type Canal = 'interface' | 'efeitos' | 'musica';

const CANAL: Record<NomeSom, Canal> = {
  selecionar: 'interface', invalido: 'interface', vez: 'interface', tique: 'interface', escolherCor: 'interface',
  jogar: 'efeitos', impacto: 'efeitos', comprar: 'efeitos', mais2: 'efeitos', mais4: 'efeitos', inverter: 'efeitos',
  bloqueio: 'efeitos', conexao: 'efeitos', call: 'efeitos', todosunidos: 'efeitos', ultimaCarta: 'efeitos',
  gritar: 'efeitos', vitoria: 'efeitos', derrota: 'efeitos', reconectar: 'interface', distribuir: 'efeitos',
};

interface Tom { f: number; ini: number; dur: number; tipo?: OscillatorType; vol?: number; ate?: number; ataque?: number }
interface Ruido { ini: number; dur: number; vol?: number; filtro?: BiquadFilterType; de?: number; ate?: number; q?: number }

class GerenciadorAudio {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  private canais: Partial<Record<Canal, GainNode>> = {};
  private ruidoBuf: AudioBuffer | null = null;
  private musicaTimer: ReturnType<typeof setInterval> | null = null;
  private ultimo: Partial<Record<NomeSom, number>> = {};
  private mesaAberta = false;

  private garantir(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.mestre = this.ctx.createGain();
        this.mestre.connect(this.ctx.destination);
        for (const c of ['interface', 'efeitos', 'musica'] as Canal[]) {
          const g = this.ctx.createGain();
          g.connect(this.mestre);
          this.canais[c] = g;
        }
        // Ruído branco reaproveitado (whoosh, batida da carta)
        const n = this.ctx.sampleRate;
        this.ruidoBuf = this.ctx.createBuffer(1, n, n);
        const d = this.ruidoBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        this.aplicarVolumes();
        useConfigUnidos.subscribe(() => this.aplicarVolumes());
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch { return null; }
  }

  aplicarVolumes() {
    if (!this.ctx || !this.mestre) return;
    const c = useConfigUnidos.getState();
    const t = this.ctx.currentTime;
    this.mestre.gain.setTargetAtTime(c.mudo ? 0 : 1, t, 0.02);
    this.canais.interface?.gain.setTargetAtTime(c.volInterface, t, 0.02);
    this.canais.efeitos?.gain.setTargetAtTime(c.volEfeitos, t, 0.02);
    this.canais.musica?.gain.setTargetAtTime(c.volMusica * 0.5, t, 0.05);
    if (this.mesaAberta && c.volMusica > 0 && !c.mudo) this.iniciarMusica(); else this.pararMusica();
  }

  // A música só toca com a mesa aberta na tela
  mesa(aberta: boolean) {
    this.mesaAberta = aberta;
    if (aberta) { if (this.ctx) this.aplicarVolumes(); } else this.pararMusica();
  }

  // Chamar num clique (o navegador só libera áudio depois de um gesto)
  destravar() { this.garantir(); }

  private tom(destino: AudioNode, t0: number, { f, ini, dur, tipo = 'triangle', vol = 0.2, ate, ataque = 0.008 }: Tom) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t0 + ini);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t0 + ini + dur);
    g.gain.setValueAtTime(0.0001, t0 + ini);
    g.gain.exponentialRampToValueAtTime(vol, t0 + ini + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
    o.connect(g).connect(destino);
    o.start(t0 + ini);
    o.stop(t0 + ini + dur + 0.05);
  }

  private ruido(destino: AudioNode, t0: number, { ini, dur, vol = 0.2, filtro = 'bandpass', de = 1200, ate, q = 1 }: Ruido) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.ruidoBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = filtro; fl.Q.value = q;
    fl.frequency.setValueAtTime(de, t0 + ini);
    if (ate) fl.frequency.exponentialRampToValueAtTime(ate, t0 + ini + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0 + ini);
    g.gain.exponentialRampToValueAtTime(vol, t0 + ini + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
    s.connect(fl).connect(g).connect(destino);
    s.start(t0 + ini, Math.random() * 0.5);
    s.stop(t0 + ini + dur + 0.05);
  }

  tocar(nome: NomeSom) {
    // Mesa fechada (minimizada ou saiu): nenhum som do jogo
    if (!this.mesaAberta) return;
    const ctx = this.garantir();
    if (!ctx || useConfigUnidos.getState().mudo) return;
    // Não empilha o mesmo som disparado várias vezes no mesmo instante
    const agora = performance.now();
    if (agora - (this.ultimo[nome] || 0) < 45) return;
    this.ultimo[nome] = agora;
    const d = this.canais[CANAL[nome]]!;
    const t = ctx.currentTime + 0.01;
    const T = (x: Tom) => this.tom(d, t, x);
    const R = (x: Ruido) => this.ruido(d, t, x);
    switch (nome) {
      case 'selecionar': T({ f: 880, ate: 1180, ini: 0, dur: 0.06, tipo: 'sine', vol: 0.12 }); break;
      case 'jogar':
        R({ ini: 0, dur: 0.07, vol: 0.22, de: 2200, q: 0.8 });
        T({ f: 170, ate: 80, ini: 0, dur: 0.1, tipo: 'sine', vol: 0.3 });
        break;
      case 'impacto': T({ f: 120, ate: 55, ini: 0, dur: 0.14, tipo: 'sine', vol: 0.35 }); R({ ini: 0, dur: 0.05, vol: 0.12, de: 900 }); break;
      case 'comprar':
        R({ ini: 0, dur: 0.09, vol: 0.14, filtro: 'highpass', de: 2500 });
        T({ f: 520, ate: 640, ini: 0.02, dur: 0.07, tipo: 'sine', vol: 0.08 });
        break;
      case 'distribuir': for (let i = 0; i < 4; i++) R({ ini: i * 0.07, dur: 0.06, vol: 0.1, filtro: 'highpass', de: 2800 }); break;
      case 'invalido': T({ f: 220, ini: 0, dur: 0.08, tipo: 'square', vol: 0.05 }); T({ f: 175, ini: 0.08, dur: 0.12, tipo: 'square', vol: 0.05 }); break;
      case 'vez': T({ f: 784, ini: 0, dur: 0.12, tipo: 'sine', vol: 0.14 }); T({ f: 1175, ini: 0.09, dur: 0.2, tipo: 'sine', vol: 0.12 }); break;
      case 'tique': T({ f: 1500, ini: 0, dur: 0.025, tipo: 'sine', vol: 0.06 }); break;
      case 'mais2':
        T({ f: 440, ate: 660, ini: 0, dur: 0.16, tipo: 'sawtooth', vol: 0.05 });
        [0.2, 0.32].forEach(ini => T({ f: 150, ate: 70, ini, dur: 0.1, tipo: 'sine', vol: 0.3 }));
        break;
      case 'mais4': {
        // Subida crescente + 4 batidas
        const ctxF = ctx.createBiquadFilter();
        ctxF.type = 'lowpass';
        ctxF.frequency.setValueAtTime(300, t);
        ctxF.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
        ctxF.connect(d);
        this.tom(ctxF, t, { f: 110, ate: 440, ini: 0, dur: 0.5, tipo: 'sawtooth', vol: 0.1, ataque: 0.2 });
        this.tom(ctxF, t, { f: 165, ate: 660, ini: 0, dur: 0.5, tipo: 'sawtooth', vol: 0.06, ataque: 0.2 });
        [0.52, 0.64, 0.76, 0.88].forEach((ini, i) => T({ f: 160 + i * 20, ate: 70, ini, dur: 0.1, tipo: 'sine', vol: 0.32 }));
        break;
      }
      case 'inverter': R({ ini: 0, dur: 0.45, vol: 0.2, de: 350, ate: 3200, q: 2.5 }); R({ ini: 0.18, dur: 0.3, vol: 0.12, de: 3000, ate: 500, q: 2.5 }); break;
      case 'bloqueio':
        T({ f: 1250, ini: 0, dur: 0.035, tipo: 'square', vol: 0.05 });
        T({ f: 940, ini: 0.06, dur: 0.035, tipo: 'square', vol: 0.05 });
        T({ f: 150, ate: 90, ini: 0.12, dur: 0.12, tipo: 'sine', vol: 0.28 });
        R({ ini: 0.12, dur: 0.05, vol: 0.1, de: 1800 });
        break;
      case 'conexao': [660, 880, 1320, 1760].forEach((f, i) => T({ f, ini: i * 0.07, dur: 0.35, tipo: 'sine', vol: 0.09, ataque: 0.03 })); break;
      case 'call':
        [0, 0.22].forEach(ini => { T({ f: 740, ini, dur: 0.16, tipo: 'sine', vol: 0.12 }); T({ f: 988, ini: ini + 0.06, dur: 0.14, tipo: 'sine', vol: 0.08 }); });
        break;
      case 'todosunidos':
        [523, 659, 784, 988].forEach((f, i) => T({ f, ini: 0.02 * i, dur: 0.9, tipo: 'triangle', vol: 0.07, ataque: 0.25 }));
        [1568, 2093, 2637].forEach((f, i) => T({ f, ini: 0.35 + i * 0.08, dur: 0.3, tipo: 'sine', vol: 0.05 }));
        R({ ini: 0, dur: 0.6, vol: 0.08, de: 500, ate: 4000, q: 1.5 });
        break;
      case 'escolherCor': T({ f: 600, ate: 900, ini: 0, dur: 0.09, tipo: 'sine', vol: 0.12 }); break;
      case 'ultimaCarta': [0, 0.18].forEach(ini => { T({ f: 988, ini, dur: 0.09, tipo: 'triangle', vol: 0.12 }); T({ f: 1319, ini: ini + 0.08, dur: 0.1, tipo: 'triangle', vol: 0.1 }); }); break;
      case 'gritar': [880, 1320, 1760].forEach((f, i) => T({ f, ini: i * 0.08, dur: 0.12, tipo: 'square', vol: 0.05 })); break;
      case 'vitoria':
        [523, 659, 784, 1047].forEach((f, i) => T({ f, ini: i * 0.13, dur: i === 3 ? 0.6 : 0.2, tipo: 'triangle', vol: 0.15 }));
        [1319, 1568].forEach((f, i) => T({ f, ini: 0.52 + i * 0.02, dur: 0.6, tipo: 'sine', vol: 0.06 }));
        break;
      case 'derrota': [523, 440, 349].forEach((f, i) => T({ f, ini: i * 0.16, dur: 0.24, tipo: 'triangle', vol: 0.1 })); break;
      case 'reconectar': T({ f: 440, ate: 880, ini: 0, dur: 0.22, tipo: 'sine', vol: 0.1 }); break;
    }
  }

  // Música ambiente bem baixinha (desligada por padrão): acordes lentos
  private iniciarMusica() {
    if (this.musicaTimer || !this.ctx) return;
    const acordes = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]];
    let i = 0;
    const tocarAcorde = () => {
      if (!this.ctx || !this.canais.musica) return;
      const t = this.ctx.currentTime + 0.05;
      const fl = this.ctx.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 900;
      fl.connect(this.canais.musica);
      for (const f of acordes[i % acordes.length]) this.tom(fl, t, { f, ini: 0, dur: 3.9, tipo: 'sine', vol: 0.05, ataque: 1.2 });
      i++;
    };
    tocarAcorde();
    this.musicaTimer = setInterval(tocarAcorde, 3800);
  }

  pararMusica() {
    if (this.musicaTimer) clearInterval(this.musicaTimer);
    this.musicaTimer = null;
  }
}

export const audio = new GerenciadorAudio();

// Vibração curta no celular (onde o navegador permite)
export function vibrar(padrao: number | number[]) {
  try {
    if (!useConfigUnidos.getState().vibracao) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(padrao);
  } catch { /* sem vibração */ }
}
