'use client';

import { useEffect, useRef } from 'react';
import { modoAtual } from './config';

// Sistema de partículas leve: um único <canvas> por cima da mesa, partículas
// reaproveitadas (pool fixo, sem criar objetos a cada quadro) e o laço só
// roda enquanto houver partícula viva. Ajusta a quantidade sozinho quando o
// aparelho não aguenta 60 fps.

export const PALETAS = {
  especial: ['#7A2CFF', '#A56BFF', '#CBB3FF', '#5B1FCC'],   // roxo: cartas especiais
  energia: ['#FF6A00', '#FF8F3D', '#FFB27D', '#FFD2A8'],    // laranja: energia
  positivo: ['#FFF1CC', '#FFE6B0', '#FFFFFF', '#F2C35B'],   // creme: ações positivas
  bloqueio: ['#E9E9F0', '#C9C9D1', '#9C9CA8', '#FFFFFF'],   // prata: bloqueio
  multicor: ['#FF6A00', '#7A2CFF', '#C9C9D1', '#F2C35B', '#FFB27D', '#CBB3FF'], // Todos Unidos e escolha de cor
} as const;
export type Paleta = keyof typeof PALETAS;

export interface OpcoesExplosao {
  cores: readonly string[];
  qtd?: number;          // antes do ajuste de qualidade
  velocidade?: number;   // px/s
  gravidade?: number;    // px/s²
  vida?: number;         // s
  tamanho?: number;      // px
  espalhar?: number;     // raio inicial
  forma?: 'ponto' | 'faisca';
  direcao?: number;      // ângulo central (rad); sem = em todas as direções
  abertura?: number;     // largura do leque (rad)
}

const MAX = 700;
interface P { x: number; y: number; vx: number; vy: number; vida: number; max: number; tam: number; cor: string; g: number; faisca: boolean; ativa: boolean }
const pool: P[] = Array.from({ length: MAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, vida: 0, max: 1, tam: 2, cor: '#fff', g: 0, faisca: false, ativa: false }));
let vivas = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let raf = 0;
let ultimoT = 0;
let dpr = 1;
// Qualidade automática: começa menor em aparelhos com poucos núcleos e cai se o fps cair
let qualidadeAuto = typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4 ? 0.6 : 1;
let mediaDt = 16;

function qualidade() {
  const m = modoAtual();
  if (!m.movimento) return 0.15;
  return (m.reduzido ? 0.35 : 1) * qualidadeAuto;
}

function quadro(t: number) {
  if (!ctx2d || !canvas) { raf = 0; return; }
  const dt = Math.min(0.05, (t - (ultimoT || t)) / 1000) || 0.016;
  ultimoT = t;
  mediaDt = mediaDt * 0.92 + dt * 1000 * 0.08;
  if (mediaDt > 24 && qualidadeAuto > 0.3) { qualidadeAuto = Math.max(0.3, qualidadeAuto * 0.85); mediaDt = 16; }
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  ctx2d.globalCompositeOperation = 'lighter';
  vivas = 0;
  for (const p of pool) {
    if (!p.ativa) continue;
    p.vida -= dt;
    if (p.vida <= 0) { p.ativa = false; continue; }
    vivas++;
    p.vy += p.g * dt;
    p.vx *= 0.985; p.vy *= 0.985;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = p.vida / p.max;
    ctx2d.globalAlpha = a;
    ctx2d.fillStyle = p.cor;
    if (p.faisca) {
      ctx2d.strokeStyle = p.cor;
      ctx2d.lineWidth = p.tam * 0.7;
      ctx2d.beginPath();
      ctx2d.moveTo(p.x, p.y);
      ctx2d.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx2d.stroke();
    } else {
      const r = p.tam * (0.4 + a * 0.6);
      ctx2d.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
  }
  ctx2d.globalAlpha = 1;
  if (vivas > 0) raf = requestAnimationFrame(quadro);
  else { raf = 0; ultimoT = 0; ctx2d.clearRect(0, 0, canvas.width, canvas.height); }
}

export const particulas = {
  explodir(x: number, y: number, o: OpcoesExplosao) {
    if (!ctx2d || (typeof document !== 'undefined' && document.hidden)) return;
    const n = Math.round((o.qtd ?? 40) * qualidade());
    const vel = o.velocidade ?? 260;
    let criadas = 0;
    for (const p of pool) {
      if (criadas >= n) break;
      if (p.ativa) continue;
      const ang = o.direcao !== undefined ? o.direcao + (Math.random() - 0.5) * (o.abertura ?? Math.PI / 2) : Math.random() * Math.PI * 2;
      const v = vel * (0.35 + Math.random() * 0.65);
      const esp = (o.espalhar ?? 0) * Math.random();
      p.x = x + Math.cos(ang) * esp; p.y = y + Math.sin(ang) * esp;
      p.vx = Math.cos(ang) * v; p.vy = Math.sin(ang) * v;
      p.max = p.vida = (o.vida ?? 0.8) * (0.6 + Math.random() * 0.4);
      p.tam = (o.tamanho ?? 3) * (0.6 + Math.random() * 0.8);
      p.cor = o.cores[Math.floor(Math.random() * o.cores.length)];
      p.g = o.gravidade ?? 260;
      p.faisca = o.forma === 'faisca';
      p.ativa = true;
      criadas++;
    }
    if (criadas && !raf) raf = requestAnimationFrame(quadro);
  },
  // Explosão no centro de um elemento da tela
  noRect(r: DOMRect | null | undefined, o: OpcoesExplosao) {
    if (r) this.explodir(r.left + r.width / 2, r.top + r.height / 2, o);
  },
  limpar() {
    for (const p of pool) p.ativa = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; ultimoT = 0;
    if (ctx2d && canvas) ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  },
  get qualidade() { return qualidade(); },
};

// O canvas que desenha as partículas (fica por cima de tudo na mesa, sem bloquear cliques)
export function CamadaParticulas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ajustar = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
    };
    ajustar();
    canvas = c;
    ctx2d = c.getContext('2d');
    window.addEventListener('resize', ajustar);
    return () => {
      window.removeEventListener('resize', ajustar);
      particulas.limpar();
      if (canvas === c) { canvas = null; ctx2d = null; }
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[40] w-full h-full" />;
}
