'use client';

// Efeito de perfil (loja Nex): partículas num canvas por cima do cartão do perfil.
// O pai precisa ser "relative". Para quando sai da tela; com "reduzir animações"
// do sistema desenha um quadro parado.
import { useEffect, useMemo, useRef } from 'react';
import { EFEITOS, type TipoEfeito } from '@/lib/itens';
import { cn } from '@/lib/utils';

interface P { x: number; y: number; vx: number; vy: number; vida: number; max: number; t: number; cor: string; fase: number; pts?: [number, number][] }
type Motor = (ctx: CanvasRenderingContext2D | null, w: number, h: number, dt: number, tempo: number) => void;

const ale = (a: number, b: number) => a + Math.random() * (b - a);
const umDe = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

function estrela(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
function coracao(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.35, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.35, x, y + s * 0.35);
  ctx.fill();
}
function floco(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = giro + (i * Math.PI) / 3, c = Math.cos(a), s = Math.sin(a);
    ctx.moveTo(x, y); ctx.lineTo(x + c * r, y + s * r);
    // galhinhos em V a 60% do braço
    const bx = x + c * r * 0.6, by = y + s * r * 0.6;
    for (const d of [-0.6, 0.6]) { ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + d) * r * 0.35, by + Math.sin(a + d) * r * 0.35); }
  }
  ctx.stroke();
}
/** Raio quebrado do ponto A ao B (deslocamento do meio, como relâmpago de verdade). */
function zigue(x1: number, y1: number, x2: number, y2: number, desvio: number, nivel: number): [number, number][] {
  if (nivel === 0) return [[x1, y1], [x2, y2]];
  const mx = (x1 + x2) / 2 + ale(-desvio, desvio), my = (y1 + y2) / 2 + ale(-desvio, desvio) * 0.4;
  return [...zigue(x1, y1, mx, my, desvio / 2, nivel - 1), ...zigue(mx, my, x2, y2, desvio / 2, nivel - 1).slice(1)];
}

function criarMotor(tipo: TipoEfeito, cores: string[]): Motor {
  let ps: P[] = [];
  let espera = 0; // para os eventos de tempo em tempo (raio, estrela cadente)
  let fixos: P[] | null = null;
  let fixosW = -1; // recria as partículas fixas quando o cartão muda de tamanho
  const refazer = (w: number) => { if (fixos && fixosW === Math.round(w)) return false; fixosW = Math.round(w); return true; };
  const nasce = (p: Partial<P> & { x: number; y: number }) => ps.push({ vx: 0, vy: 0, vida: 0, max: 1, t: 2, cor: umDe(cores), fase: Math.random() * 6.28, ...p });
  const anda = (dt: number) => {
    for (const p of ps) { p.vida += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    ps = ps.filter(p => p.vida < p.max);
  };
  const quantos = (w: number, h: number, por: number, max: number) => Math.min(max, Math.round((w * h) / por));

  switch (tipo) {
    case 'faiscas': return (ctx, w, h, dt) => {
      if (Math.random() < dt * 16) nasce({ x: ale(0, w), y: ale(0, h), vy: ale(-14, -4), max: ale(0.7, 1.5), t: ale(2.5, 5.5) });
      anda(dt);
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        const k = Math.sin((p.vida / p.max) * Math.PI);
        ctx.globalAlpha = k; ctx.fillStyle = p.cor; estrela(ctx, p.x, p.y, p.t * (0.4 + k * 0.8));
      }
    };
    case 'neve': return (ctx, w, h, dt, tempo) => {
      while (ps.length < quantos(w, h, 2200, 70)) nasce({ x: ale(0, w), y: ale(-h, h), vy: ale(14, 40), max: 1e9, t: ale(0.8, 2.6) });
      anda(dt);
      if (!ctx) return;
      ctx.fillStyle = cores[0];
      for (const p of ps) {
        p.x += Math.sin(tempo * 0.9 + p.fase) * 10 * dt;
        if (p.y > h + 4) { p.y = -4; p.x = ale(0, w); }
        ctx.globalAlpha = 0.45 + p.t / 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 6.283); ctx.fill();
      }
    };
    case 'coracoes': return (ctx, w, h, dt, tempo) => {
      if (Math.random() < dt * 3.2) nasce({ x: ale(0, w), y: h + 10, vy: ale(-55, -28), max: ale(2.5, 4), t: ale(5, 10) });
      anda(dt);
      if (!ctx) return;
      for (const p of ps) {
        const k = Math.min(1, (p.max - p.vida) / 0.8);
        ctx.globalAlpha = 0.85 * k; ctx.fillStyle = p.cor;
        coracao(ctx, p.x + Math.sin(tempo * 2 + p.fase) * 8, p.y, p.t);
      }
    };
    case 'brasas': return (ctx, w, h, dt, tempo) => {
      if (Math.random() < dt * 22) nasce({ x: ale(0, w), y: h + 2, vx: ale(-8, 8), vy: ale(-90, -35), max: ale(1.4, 3), t: ale(0.8, 2.4) });
      anda(dt);
      if (!ctx) return;
      // Calor subindo do fundo do cartão
      const g = ctx.createLinearGradient(0, h, 0, h * 0.55);
      g.addColorStop(0, cores[0] + '55'); g.addColorStop(1, cores[0] + '00');
      ctx.globalAlpha = 0.75 + Math.sin(tempo * 7) * 0.12 + Math.sin(tempo * 13) * 0.08; ctx.fillStyle = g; ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        ctx.globalAlpha = 1 - p.vida / p.max; ctx.fillStyle = p.cor;
        ctx.beginPath(); ctx.arc(p.x + Math.sin(tempo * 3 + p.fase) * 6, p.y, p.t, 0, 6.283); ctx.fill();
      }
    };
    case 'nevoa': return (ctx, w, h, dt, tempo) => {
      if (refazer(w)) fixos = Array.from({ length: 7 }, (_, i) => ({ x: ale(0, w), y: ale(0, h), vx: ale(-10, 10), vy: ale(-6, 6), vida: 0, max: 1, t: ale(0.35, 0.6), cor: cores[i % cores.length], fase: ale(0, 6) }));
      if (!ctx || !fixos) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of fixos) {
        p.x += (p.vx + Math.sin(tempo * 0.3 + p.fase) * 8) * dt; p.y += p.vy * dt;
        if (p.x < -w * 0.3 || p.x > w * 1.3) p.vx *= -1;
        if (p.y < -h * 0.3 || p.y > h * 1.3) p.vy *= -1;
        const r = p.t * Math.max(w, h);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, p.cor + '40'); g.addColorStop(1, p.cor + '00');
        ctx.globalAlpha = 0.8 + Math.sin(tempo + p.fase) * 0.2; ctx.fillStyle = g; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    };
    case 'raios': return (ctx, w, h, dt) => {
      espera -= dt;
      if (espera <= 0) {
        espera = ale(0.7, 2);
        const x = ale(w * 0.1, w * 0.9);
        const pts = zigue(x, -5, x + ale(-w * 0.3, w * 0.3), ale(h * 0.45, h), w * 0.22, 5);
        // Galho saindo do meio
        const m = pts[Math.floor(pts.length / 2)];
        const galho = zigue(m[0], m[1], m[0] + ale(-w * 0.25, w * 0.25), m[1] + ale(h * 0.1, h * 0.3), w * 0.1, 4);
        nasce({ x: 0, y: 0, max: 0.45, pts, cor: cores[0] });
        nasce({ x: 0, y: 0, max: 0.3, pts: galho, cor: cores[2] ?? cores[0] });
        // Faíscas onde o raio termina
        const fim = pts[pts.length - 1];
        for (let i = 0; i < 6; i++) nasce({ x: fim[0], y: fim[1], vx: ale(-80, 80), vy: ale(-90, 10), max: ale(0.3, 0.6), t: ale(1, 2.2), cor: cores[1] });
      }
      anda(dt);
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        const k = 1 - p.vida / p.max;
        if (!p.pts) { ctx.globalAlpha = k; ctx.fillStyle = p.cor; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 6.283); ctx.fill(); continue; }
        if (p.max > 0.4 && p.vida < 0.08) { ctx.globalAlpha = 0.18; ctx.fillStyle = p.cor; ctx.fillRect(0, 0, w, h); } // clarão
        const pisca = p.vida % 0.12 < 0.05 ? 1 : 0.55;
        ctx.globalAlpha = k * pisca; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.shadowColor = p.cor; ctx.shadowBlur = 14; ctx.strokeStyle = p.cor; ctx.lineWidth = 3.2; ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.1; ctx.stroke();
      }
    };
    case 'estrelas': return (ctx, w, h, dt, tempo) => {
      if (refazer(w)) fixos = Array.from({ length: quantos(w, h, 1400, 60) }, () => ({ x: ale(0, w), y: ale(0, h), vx: 0, vy: 0, vida: 0, max: 1, t: ale(0.5, 1.6), cor: umDe(cores), fase: ale(0, 6) }));
      espera -= dt;
      if (espera <= 0) { espera = ale(0.9, 2.4); nasce({ x: ale(w * 0.2, w * 1.1), y: ale(-10, h * 0.4), vx: -ale(260, 380), vy: ale(110, 170), max: ale(0.6, 0.9), t: ale(40, 70), cor: cores[0] }); }
      anda(dt);
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const s of fixos ?? []) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(tempo * 1.4 + s.fase)); ctx.fillStyle = s.cor; ctx.beginPath(); ctx.arc(s.x, s.y, s.t, 0, 6.283); ctx.fill(); }
      for (const p of ps) {
        const k = Math.sin((p.vida / p.max) * Math.PI), n = Math.hypot(p.vx, p.vy);
        const tx = p.x - (p.vx / n) * p.t, ty = p.y - (p.vy / n) * p.t;
        const g = ctx.createLinearGradient(p.x, p.y, tx, ty);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = k; ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
      }
    };
    case 'energia': return (ctx, w, h, dt, tempo) => {
      // Energia em volta do objeto do meio (baú): nasce no anel de fora (lados e em cima, nunca na frente),
      // sobe girando, e três orbes dão a volta por fora. O brilho do chão fica por conta do pai (CSS).
      const cx = w / 2, cy = h * 0.56, rx = w * 0.47, ry = h * 0.36;
      if (Math.random() < dt * 46) {
        let a = ale(0, 6.283);
        if (Math.sin(a) > 0.25) a = -a; // parte de baixo/frente vira parte de cima
        nasce({ x: cx + Math.cos(a) * rx * ale(0.92, 1.06), y: cy + Math.sin(a) * ry * ale(0.92, 1.06), vy: ale(-50, -18), max: ale(1, 2), t: ale(1.2, 3), fase: a });
      }
      anda(dt);
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      for (const p of ps) {
        p.x += Math.cos(tempo * 2.4 + p.fase) * 14 * dt;
        const k = Math.sin((p.vida / p.max) * Math.PI);
        ctx.fillStyle = p.cor;
        ctx.globalAlpha = k * 0.3; ctx.beginPath(); ctx.arc(p.x, p.y, p.t * 3.4, 0, 6.283); ctx.fill();
        ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 6.283); ctx.fill();
      }
      for (let i = 0; i < 3; i++) {
        const cor = cores[i % cores.length];
        for (let r = 0; r < 8; r++) {
          const a = tempo * 1.2 + (i * 6.283) / 3 - r * 0.06;
          const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
          const tam = (r ? 2.3 : 3.6) * (1 - r / 10);
          ctx.fillStyle = cor;
          ctx.globalAlpha = (r ? 0.55 : 1) * (1 - r / 8); ctx.beginPath(); ctx.arc(x, y, tam, 0, 6.283); ctx.fill();
          if (!r) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(x, y, tam * 4, 0, 6.283); ctx.fill(); }
        }
      }
    };
    case 'natal': return (ctx, w, h, dt, tempo) => {
      // Neve caindo + flocos grandes girando devagar
      while (ps.length < quantos(w, h, 1100, 90)) nasce({ x: ale(0, w), y: ale(-10, h), vy: ale(16, 42), max: 1e9, t: ale(1, 2.6) });
      if (refazer(w)) fixos = Array.from({ length: Math.max(6, quantos(w, h, 7000, 14)) }, () => ({ x: ale(0, w), y: ale(0, h), vx: 0, vy: ale(10, 22), vida: 0, max: 1, t: ale(4, 8), cor: cores[0], fase: ale(0, 6) }));
      anda(dt);
      if (!ctx) return;
      ctx.fillStyle = cores[0];
      for (const p of ps) {
        p.x += Math.sin(tempo * 0.9 + p.fase) * 10 * dt;
        if (p.y > h + 4) { p.y = -4; p.x = ale(0, w); }
        ctx.globalAlpha = 0.45 + p.t / 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.t, 0, 6.283); ctx.fill();
      }
      ctx.strokeStyle = cores[1] ?? cores[0]; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      for (const f of fixos ?? []) {
        f.y += f.vy * dt; f.x += Math.sin(tempo * 0.6 + f.fase) * 12 * dt;
        if (f.y > h + 12) { f.y = -12; f.x = ale(0, w); }
        ctx.globalAlpha = 0.9; floco(ctx, f.x, f.y, f.t, tempo * 0.5 + f.fase);
      }
    };
    case 'aurora': return (ctx, w, h, _dt, tempo) => {
      if (!ctx) return;
      ctx.globalCompositeOperation = 'lighter';
      cores.forEach((cor, b) => {
        // Faixas no alto do cartão (perto da capa), sumindo para baixo
        const base = h * (0.06 + b * 0.07), fundo = base + h * 0.28;
        ctx.beginPath(); ctx.moveTo(0, fundo);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, base + Math.sin(x * 0.012 + tempo * 0.6 + b * 2) * 14 + Math.sin(x * 0.031 - tempo * 0.9 + b) * 6);
        ctx.lineTo(w, fundo); ctx.closePath();
        const g = ctx.createLinearGradient(0, base - 20, 0, fundo);
        g.addColorStop(0, cor + '00'); g.addColorStop(0.25, cor + '50'); g.addColorStop(1, cor + '00');
        ctx.globalAlpha = 0.7 + Math.sin(tempo * 0.8 + b) * 0.3; ctx.fillStyle = g; ctx.fill();
      });
    };
  }
}

/** id = efeito da loja; ou tipo + cores direto (baús). */
export function EfeitoPerfil({ id, tipo, cores, className }: { id?: string | null; tipo?: TipoEfeito; cores?: string[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chaveCores = cores?.join(',');
  const ef = useMemo(() => (id ? EFEITOS[id] : tipo ? { tipo, cores: chaveCores ? chaveCores.split(',') : ['#ffffff'] } : undefined), [id, tipo, chaveCores]);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx || !ef) return;
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, visivel = true, ultimo = performance.now();
    const inicio = ultimo;
    const motor = criarMotor(ef.tipo, ef.cores);
    const medir = () => {
      const r = cv.getBoundingClientRect();
      w = r.width; h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    };
    const quadro = (dt: number, tempo: number) => {
      if (!w || !h) return; // ainda sem tamanho
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.clearRect(0, 0, w, h);
      motor(ctx, w, h, dt, tempo);
    };
    const passo = (agora: number) => {
      raf = 0;
      quadro(Math.min(0.05, (agora - ultimo) / 1000), (agora - inicio) / 1000);
      ultimo = agora;
      if (visivel) raf = requestAnimationFrame(passo);
    };
    medir();
    const ro = new ResizeObserver(() => { medir(); if (parado) quadro(0, 3); });
    ro.observe(cv);
    if (parado) {
      for (let i = 0; i < 90; i++) motor(null, w, h, 1 / 30, i / 30); // já com partículas espalhadas
      quadro(0, 3);
      return () => ro.disconnect();
    }
    const io = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting;
      if (visivel && !raf) { ultimo = performance.now(); raf = requestAnimationFrame(passo); }
    });
    io.observe(cv);
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [ef]);

  if (!ef) return null;
  return <canvas ref={ref} aria-hidden className={cn('pointer-events-none absolute inset-0 w-full h-full z-[2]', className)} />;
}
