'use client';

// Aura animada das molduras especiais: partículas num canvas em volta da foto.
// Cada tipo tem movimento próprio (nenhum parece com o outro). Tudo é medido em
// R = raio da foto, então funciona em qualquer tamanho. O meio (a foto) nunca é
// coberto. Um único requestAnimationFrame toca todas as auras da tela.
import { menosMovimento } from '@/lib/movimento';
import { useEffect, useRef } from 'react';
import type { TipoAura } from '@/lib/itens';

export type Desenho = (ctx: CanvasRenderingContext2D | null, R: number, dt: number, t: number) => void;

// ---------- utilidades ----------
const TAU = Math.PI * 2;
const ale = (a: number, b: number) => a + Math.random() * (b - a);
const umDe = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];

// Bolinha de luz pré-desenhada por cor (drawImage é bem mais leve que gradiente por partícula)
const sprites = new Map<string, HTMLCanvasElement>();
function sprite(cor: string) {
  let s = sprites.get(cor);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const c = s.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, cor); g.addColorStop(0.3, cor + 'aa'); g.addColorStop(1, cor + '00');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    sprites.set(cor, s);
  }
  return s;
}
function luz(ctx: CanvasRenderingContext2D, cor: string, x: number, y: number, raio: number, alfa: number) {
  if (alfa <= 0 || raio <= 0) return;
  ctx.globalAlpha = Math.min(1, alfa);
  ctx.drawImage(sprite(cor), x - raio, y - raio, raio * 2, raio * 2);
}
function linha(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}
/** Raio quebrado (deslocamento do meio). */
function zigue(x1: number, y1: number, x2: number, y2: number, d: number, n: number): [number, number][] {
  if (n === 0) return [[x1, y1], [x2, y2]];
  const mx = (x1 + x2) / 2 + ale(-d, d), my = (y1 + y2) / 2 + ale(-d, d);
  return [...zigue(x1, y1, mx, my, d / 2, n - 1), ...zigue(mx, my, x2, y2, d / 2, n - 1).slice(1)];
}
function estrela4(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.25 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

interface P { x: number; y: number; vx: number; vy: number; vida: number; max: number; tam: number; cor: string; a: number; extra?: number }
function particulas() {
  let ps: P[] = [];
  return {
    get lista() { return ps; },
    nasce(p: Partial<P> & { x: number; y: number }) { ps.push({ vx: 0, vy: 0, vida: 0, max: 1, tam: 1, cor: '#ffffff', a: 0, ...p }); },
    anda(dt: number, gravidade = 0) {
      for (const p of ps) { p.vida += dt; p.vy += gravidade * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      ps = ps.filter(p => p.vida < p.max);
    },
  };
}

// ---------- os 8 tipos ----------
export function criarAura(tipo: TipoAura, cores?: string[]): Desenho {
  switch (tipo) {
    // Labaredas subindo do anel (esticadas na vertical) + brasas voando
    case 'fogo': {
      const chamas = particulas(), brasas = particulas();
      const FASES = ['#ffd27a', '#ff9a2e', '#ff6a1a', '#e8400c', '#a81e00'];
      return (ctx, R, dt, t) => {
        for (let n = Math.round(ale(0, 1) + dt * 140); n > 0; n--) {
          const a = ale(0, TAU), r = R * ale(1.12, 1.42);
          chamas.nasce({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(a) * R * 0.3, vy: -R * ale(1, 1.9), max: ale(0.45, 0.9), tam: R * ale(0.11, 0.2), a });
        }
        if (Math.random() < dt * 14) { const a = ale(0, TAU); brasas.nasce({ x: Math.cos(a) * R * 1.25, y: Math.sin(a) * R * 1.25, vx: ale(-0.4, 0.4) * R, vy: -R * ale(1.6, 2.6), max: ale(0.9, 1.5), tam: R * ale(0.02, 0.035), a: ale(0, 6) }); }
        chamas.anda(dt); brasas.anda(dt);
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        for (const p of chamas.lista) {
          const k = p.vida / p.max;
          const cor = FASES[Math.min(FASES.length - 1, Math.floor(k * FASES.length))];
          const s = p.tam * (k < 0.25 ? 0.6 + k * 1.6 : 1 - (k - 0.25) * 1.1);
          const x = p.x + Math.sin(t * 9 + p.a * 5) * R * 0.04;
          ctx.save(); ctx.translate(x, p.y); ctx.scale(0.6, 1.8);
          luz(ctx, cor, 0, 0, s, 0.55 * (1 - k * 0.5));
          ctx.restore();
        }
        for (const p of brasas.lista) luz(ctx, '#ffd27a', p.x + Math.sin(t * 6 + p.a) * R * 0.08, p.y, p.tam * 2.5, 1 - p.vida / p.max);
      };
    }

    // Cristais de neve nascendo no anel, brilhando e quebrando em estilhaços que caem; névoa fria
    case 'gelo': {
      const nevoa = particulas(), cacos = particulas(), brilhos = particulas();
      const cristais = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * TAU + ale(-0.3, 0.3), t: -i * 0.55, tam: ale(0.22, 0.32) }));
      const CICLO = 3.4;
      const floco = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, giro: number) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(giro);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * TAU) / 6, cx = Math.cos(a), cy = Math.sin(a);
          ctx.moveTo(0, 0); ctx.lineTo(cx * s, cy * s);
          for (const f of [0.45, 0.72]) { // galhinhos
            const bx = cx * s * f, by = cy * s * f, g = s * 0.28 * (1 - f * 0.4);
            ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a + 0.7) * g, by + Math.sin(a + 0.7) * g);
            ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a - 0.7) * g, by + Math.sin(a - 0.7) * g);
          }
        }
        ctx.stroke(); ctx.restore();
      };
      return (ctx, R, dt, t) => {
        if (Math.random() < dt * 10) { const a = ale(0, TAU), r = R * ale(1.1, 1.4); nevoa.nasce({ x: Math.cos(a) * r, y: Math.sin(a) * r, vx: Math.cos(a) * R * 0.08, vy: R * ale(0.1, 0.25), max: ale(1.8, 2.8), tam: R * ale(0.25, 0.4) }); }
        if (Math.random() < dt * 5) { const a = ale(0, TAU), r = R * ale(1.1, 1.45); brilhos.nasce({ x: Math.cos(a) * r, y: Math.sin(a) * r, max: ale(0.35, 0.6), tam: R * ale(0.06, 0.1) }); }
        for (const c of cristais) {
          const antes = c.t; c.t += dt;
          if (antes < CICLO && c.t >= CICLO) { // quebra
            const x = Math.cos(c.a) * R * 1.3, y = Math.sin(c.a) * R * 1.3;
            for (let i = 0; i < 7; i++) { const d = ale(0, TAU), v = R * ale(0.5, 1.2); cacos.nasce({ x, y, vx: Math.cos(d) * v, vy: Math.sin(d) * v - R * 0.4, max: ale(0.6, 1), tam: R * ale(0.04, 0.08), a: ale(0, 6), extra: ale(-8, 8) }); }
          }
          if (c.t > CICLO + 0.4) { c.t = 0; c.a = ale(0, TAU); c.tam = ale(0.22, 0.32); }
        }
        nevoa.anda(dt); cacos.anda(dt, R * 2.6); brilhos.anda(dt);
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        for (const p of nevoa.lista) { const k = p.vida / p.max; luz(ctx, '#a9e6ff', p.x, p.y, p.tam * (0.7 + k * 0.6), 0.22 * Math.sin(k * Math.PI)); }
        ctx.lineCap = 'round';
        for (const c of cristais) {
          if (c.t < 0 || c.t > CICLO) continue;
          const cresce = Math.min(1, c.t / 0.7), s = R * c.tam * (1 - Math.pow(1 - cresce, 3));
          const x = Math.cos(c.a) * R * 1.3, y = Math.sin(c.a) * R * 1.3;
          const brilho = c.t > CICLO - 0.5 ? 1 + Math.sin(c.t * 40) * 0.3 : 0.85 + Math.sin(t * 3 + c.a) * 0.15;
          luz(ctx, '#7fd8ff', x, y, s * 1.6, 0.35 * brilho);
          ctx.globalAlpha = Math.min(1, brilho); ctx.strokeStyle = '#e8f9ff'; ctx.lineWidth = Math.max(1, R * 0.022);
          floco(ctx, x, y, s, c.a + c.t * 0.3);
        }
        ctx.fillStyle = '#dff6ff';
        for (const p of cacos.lista) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a + p.vida * (p.extra ?? 0));
          ctx.globalAlpha = 1 - p.vida / p.max;
          ctx.beginPath(); ctx.moveTo(0, -p.tam); ctx.lineTo(p.tam * 0.45, 0); ctx.lineTo(0, p.tam); ctx.lineTo(-p.tam * 0.45, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#ffffff';
        for (const p of brilhos.lista) { const k = Math.sin((p.vida / p.max) * Math.PI); ctx.globalAlpha = k; estrela4(ctx, p.x, p.y, p.tam * k); }
      };
    }

    // Lâmpadas coloridas no fio em volta, com 3 padrões de pisca que se revezam
    case 'natal': {
      const N = 16, CORES = ['#ff2e3b', '#2ee06b', '#ffd000', '#2d8cff'];
      const neve = particulas();
      return (ctx, R, dt, t) => {
        if (Math.random() < dt * 3) neve.nasce({ x: ale(-R * 2, R * 2), y: -R * 2.1, vy: R * ale(0.25, 0.45), max: 9, tam: R * ale(0.02, 0.04), a: ale(0, 6) });
        neve.anda(dt);
        if (!ctx) return;
        const rr = R * 1.36, modo = Math.floor(t / 4) % 3;
        // Fio entre as lâmpadas (cai um pouco entre uma e outra)
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 0.9; ctx.strokeStyle = '#1d5e2c'; ctx.lineWidth = Math.max(1, R * 0.03);
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * TAU - Math.PI / 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (!i) { ctx.moveTo(x, y); continue; }
          const am = ((i - 0.5) / N) * TAU - Math.PI / 2, rc = rr * 1.07;
          ctx.quadraticCurveTo(Math.cos(am) * rc, Math.sin(am) * rc, x, y);
        }
        ctx.stroke();
        for (let i = 0; i < N; i++) {
          const a = (i / N) * TAU - Math.PI / 2, x = Math.cos(a) * rr, y = Math.sin(a) * rr, cor = CORES[i % 4];
          const aceso = modo === 0 ? ((i + Math.floor(t * 6)) % 4 < 2 ? 1 : 0.12) // corre em volta
            : modo === 1 ? (i % 2 === Math.floor(t * 2.5) % 2 ? 1 : 0.12) // alterna par/ímpar
              : 0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + i * 0.4)); // onda suave
          ctx.globalCompositeOperation = 'lighter';
          luz(ctx, cor, x, y, R * 0.42, 0.75 * aceso);
          ctx.globalCompositeOperation = 'source-over';
          ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
          ctx.globalAlpha = 1; ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-R * 0.03, -R * 0.1, R * 0.06, R * 0.05); // soquete
          ctx.globalAlpha = 0.35 + 0.65 * aceso; ctx.fillStyle = cor;
          ctx.beginPath(); ctx.ellipse(0, R * 0.02, R * 0.055, R * 0.085, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 0.8 * aceso; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(-R * 0.018, 0, R * 0.015, R * 0.03, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = '#ffffff';
        for (const p of neve.lista) { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(p.x + Math.sin(t + p.a) * R * 0.1, p.y, p.tam, 0, TAU); ctx.fill(); }
      };
    }

    // Fitas de plasma onduladas girando em sentidos opostos + partículas sugadas em espiral
    case 'energia-roxa': {
      const motes = particulas();
      const FITAS = [
        { cor: '#b04bff', vel: 1.1, fase: 0, larg: 1.6 },
        { cor: '#ff4fd8', vel: -0.8, fase: 2.1, larg: 1.2 },
        { cor: '#7a2cff', vel: 1.6, fase: 4.2, larg: 1.9 },
      ];
      return (ctx, R, dt, t) => {
        if (Math.random() < dt * 26) motes.nasce({ x: 0, y: 0, max: ale(0.9, 1.4), tam: R * ale(0.03, 0.06), a: ale(0, TAU), cor: umDe(['#e9b6ff', '#ff8be6', '#b77bff']), extra: R * ale(1.8, 2.1) });
        motes.anda(dt);
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        // Anel respirando
        ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 3); ctx.strokeStyle = '#9b4dff'; ctx.lineWidth = R * 0.3;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.22, 0, TAU); ctx.stroke();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const f of FITAS) {
          const ini = t * f.vel + f.fase, tam = TAU * 0.62, pts: [number, number][] = [];
          for (let k = 0; k <= 48; k++) {
            const a = ini + (tam * k) / 48;
            const r = R * (1.2 + 0.13 * Math.sin(a * 3 + t * 4 + f.fase) + 0.06 * Math.sin(a * 7 - t * 6));
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
          }
          // Cauda fina e cabeça grossa: desenha em pedaços
          for (let s = 0; s < 4; s++) {
            const pedaco = pts.slice(s * 12, s * 12 + 13), k = (s + 1) / 4;
            linha(ctx, pedaco);
            ctx.globalAlpha = 0.18 * k; ctx.strokeStyle = f.cor; ctx.lineWidth = R * 0.16 * f.larg * k; ctx.stroke();
            ctx.globalAlpha = 0.55 * k; ctx.lineWidth = R * 0.05 * f.larg * k; ctx.stroke();
            ctx.globalAlpha = 0.85 * k; ctx.strokeStyle = '#ffe9ff'; ctx.lineWidth = Math.max(0.8, R * 0.014 * f.larg); ctx.stroke();
          }
        }
        for (const p of motes.lista) {
          const k = p.vida / p.max, r = (p.extra ?? R * 2) - ((p.extra ?? R * 2) - R * 1.15) * k * k, a = p.a + k * 2.2;
          luz(ctx, p.cor, Math.cos(a) * r, Math.sin(a) * r, p.tam * 3, Math.sin(k * Math.PI));
        }
      };
    }

    // Cometas de energia orbitando com rastro + ondas de choque saindo do anel + faíscas subindo
    case 'energia': {
      const ondas = particulas(), faiscas = particulas();
      let espera = 0;
      const COMETAS = [{ vel: 2.6, fase: 0, r: 1.2 }, { vel: 2.6, fase: Math.PI, r: 1.2 }, { vel: -1.7, fase: 1, r: 1.42 }];
      return (ctx, R, dt, t) => {
        espera -= dt;
        if (espera <= 0) { espera = 1.5; ondas.nasce({ x: 0, y: 0, max: 0.9 }); ondas.nasce({ x: 0, y: 0, max: 0.9, vida: -0.14 }); }
        if (Math.random() < dt * 18) { const a = ale(0, TAU); faiscas.nasce({ x: Math.cos(a) * R * 1.25, y: Math.sin(a) * R * 1.25, vx: Math.cos(a) * R * 0.3, vy: -R * ale(0.5, 1), max: ale(0.6, 1.1), tam: R * ale(0.025, 0.045), a }); }
        ondas.anda(dt); faiscas.anda(dt);
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        for (const o of ondas.lista) {
          if (o.vida < 0) continue;
          const k = o.vida / o.max, r = R * (1.1 + k * 1.0);
          ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = R * 0.07 * (1 - k) + 0.6;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        }
        for (const c of COMETAS) {
          const a0 = t * c.vel + c.fase;
          for (let k = 18; k >= 0; k--) { // rastro: posições de antes, cada vez menores
            const a = a0 - Math.sign(c.vel) * k * 0.07, x = Math.cos(a) * R * c.r, y = Math.sin(a) * R * c.r, f = 1 - k / 19;
            luz(ctx, k < 2 ? '#ffffff' : '#ffb347', x, y, R * (0.06 + 0.16 * f * f), 0.85 * f);
          }
        }
        for (const p of faiscas.lista) { const k = p.vida / p.max; luz(ctx, '#ffe7a8', p.x + Math.sin(t * 5 + p.a) * R * 0.06, p.y, p.tam * 2.2, 1 - k); }
      };
    }

    // Relâmpagos saltando entre pontos do anel e para fora, com galhos e faíscas caindo
    case 'raios': {
      const [c1, c2] = cores ?? ['#6fa8ff', '#cfe3ff'];
      const raios = particulas(), faiscas = particulas();
      const desenhos = new Map<P, [number, number][][]>();
      let espera = 0, chiado: [number, number][][] = [], trocaChiado = 0;
      return (ctx, R, dt) => {
        espera -= dt; trocaChiado -= dt;
        // Chiado elétrico curtinho correndo no anel (troca de forma 16x por segundo)
        if (trocaChiado <= 0) {
          trocaChiado = 0.06;
          chiado = Array.from({ length: 3 }, () => {
            const a = ale(0, TAU), b = a + ale(0.25, 0.5), ro = R * 1.27;
            return zigue(Math.cos(a) * ro, Math.sin(a) * ro, Math.cos(b) * ro, Math.sin(b) * ro, R * 0.09, 3);
          });
        }
        if (espera <= 0) {
          espera = ale(0.1, 0.32);
          const a = ale(0, TAU), caminhos: [number, number][][] = [];
          let fim: [number, number];
          if (Math.random() < 0.55) { // arco por fora do anel
            const b = a + ale(0.6, 1.5), am = (a + b) / 2, ro = R * 1.25;
            const meio: [number, number] = [Math.cos(am) * R * ale(1.5, 1.8), Math.sin(am) * R * ale(1.5, 1.8)];
            caminhos.push([...zigue(Math.cos(a) * ro, Math.sin(a) * ro, meio[0], meio[1], R * 0.18, 3), ...zigue(meio[0], meio[1], Math.cos(b) * ro, Math.sin(b) * ro, R * 0.18, 3).slice(1)]);
            fim = [Math.cos(b) * ro, Math.sin(b) * ro];
          } else { // raio saindo para fora
            const de: [number, number] = [Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2];
            fim = [Math.cos(a + ale(-0.3, 0.3)) * R * ale(1.9, 2.15), Math.sin(a + ale(-0.3, 0.3)) * R * ale(1.9, 2.15)];
            const p = zigue(de[0], de[1], fim[0], fim[1], R * 0.3, 4);
            caminhos.push(p);
            const m = p[Math.floor(p.length / 2)], d = a + ale(-0.9, 0.9);
            caminhos.push(zigue(m[0], m[1], m[0] + Math.cos(d) * R * 0.5, m[1] + Math.sin(d) * R * 0.5, R * 0.12, 3));
          }
          const raio = { x: 0, y: 0, vx: 0, vy: 0, vida: 0, max: ale(0.2, 0.34), tam: 1, cor: c1, a: 0 };
          raios.lista.push(raio); desenhos.set(raio, caminhos);
          for (let i = 0; i < 5; i++) faiscas.nasce({ x: fim[0], y: fim[1], vx: ale(-1, 1) * R, vy: ale(-1.2, 0.2) * R, max: ale(0.3, 0.6), tam: R * ale(0.02, 0.035) });
        }
        raios.anda(dt); faiscas.anda(dt, R * 4);
        for (const k of desenhos.keys()) if (!raios.lista.includes(k)) desenhos.delete(k);
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const c of chiado) {
          linha(ctx, c);
          ctx.globalAlpha = 0.3; ctx.strokeStyle = c1; ctx.lineWidth = R * 0.07; ctx.stroke();
          ctx.globalAlpha = 0.85; ctx.strokeStyle = c2; ctx.lineWidth = Math.max(0.7, R * 0.015); ctx.stroke();
        }
        for (const r of raios.lista) {
          const k = 1 - r.vida / r.max, pisca = r.vida % 0.06 < 0.035 ? 1 : 0.5;
          if (r.vida < 0.05) luz(ctx, c1, 0, 0, R * 2.1, 0.12);
          for (const c of desenhos.get(r) ?? []) {
            linha(ctx, c);
            ctx.globalAlpha = 0.25 * k * pisca; ctx.strokeStyle = c1; ctx.lineWidth = R * 0.12; ctx.stroke();
            ctx.globalAlpha = 0.7 * k * pisca; ctx.strokeStyle = c2; ctx.lineWidth = R * 0.04; ctx.stroke();
            ctx.globalAlpha = k * pisca; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(0.8, R * 0.015); ctx.stroke();
          }
        }
        for (const p of faiscas.lista) luz(ctx, c2, p.x, p.y, p.tam * 2.5, 1 - p.vida / p.max);
      };
    }

    // Nebulosa colorida girando devagar, constelação se desenhando e um cometa em órbita
    case 'cosmo': {
      const nuvens = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: ale(1.35, 1.75), tam: ale(0.7, 1.1), cor: ['#ff5fa8', '#3dd6ff', '#8a5bff'][i % 3], f: ale(0, 6) }));
      const constel = Array.from({ length: 7 }, (_, i) => ({ a: -2.4 + i * 0.42 + ale(-0.08, 0.08), r: ale(1.45, 1.9) }));
      const poeira = Array.from({ length: 34 }, () => ({ a: ale(0, TAU), r: ale(1.15, 2.1), f: ale(0, 6), tam: ale(0.012, 0.03) }));
      return (ctx, R, _dt, t) => {
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        for (const n of nuvens) {
          const a = n.a + t * 0.12;
          luz(ctx, n.cor, Math.cos(a) * R * n.r, Math.sin(a) * R * n.r, R * n.tam * (0.9 + 0.1 * Math.sin(t + n.f)), 0.28);
        }
        ctx.fillStyle = '#ffffff';
        for (const p of poeira) { ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + p.f)); ctx.beginPath(); ctx.arc(Math.cos(p.a) * R * p.r, Math.sin(p.a) * R * p.r, Math.max(0.6, R * p.tam), 0, TAU); ctx.fill(); }
        // Constelação: as linhas aparecem uma a uma e somem juntas (ciclo de 6 s)
        const ciclo = t % 6, pts = constel.map(c => [Math.cos(c.a) * R * c.r, Math.sin(c.a) * R * c.r] as [number, number]);
        const some = ciclo > 4.8 ? 1 - (ciclo - 4.8) / 1.2 : 1;
        ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = Math.max(0.7, R * 0.012);
        for (let i = 0; i < pts.length - 1; i++) {
          const p = Math.min(1, Math.max(0, ciclo * 1.6 - i));
          if (p <= 0) break;
          ctx.globalAlpha = 0.6 * some; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * p, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * p); ctx.stroke();
        }
        for (const [x, y] of pts) { luz(ctx, '#cfe8ff', x, y, R * 0.12, 0.9); ctx.globalAlpha = 1; estrela4(ctx, x, y, R * 0.05); }
        // Cometa: cauda de poeira curva (atrás na órbita) e cauda de íons reta (para fora)
        const a0 = t * 0.9, rc = R * 1.55;
        for (let k = 22; k >= 1; k--) { const a = a0 - k * 0.045, f = 1 - k / 23; luz(ctx, '#ffd9a8', Math.cos(a) * rc, Math.sin(a) * rc, R * 0.1 * f, 0.5 * f); }
        const cx = Math.cos(a0) * rc, cy = Math.sin(a0) * rc;
        const g = ctx.createLinearGradient(cx, cy, cx * 1.5, cy * 1.5);
        g.addColorStop(0, '#7fd8ffcc'); g.addColorStop(1, '#7fd8ff00');
        ctx.globalAlpha = 1; ctx.strokeStyle = g; ctx.lineWidth = R * 0.05;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx * 1.45, cy * 1.45); ctx.stroke();
        luz(ctx, '#9dffcf', cx, cy, R * 0.18, 0.7); luz(ctx, '#ffffff', cx, cy, R * 0.07, 1);
      };
    }

    // Galáxia em espiral: estrelas em dois braços girando (as de dentro mais rápido)
    case 'galaxia': {
      const estrelas = Array.from({ length: 320 }, (_, i) => {
        const braco = i % 2, d = Math.pow(Math.random(), 0.8), espalha = (Math.random() + Math.random() - 1) * 0.45;
        const nuvem = Math.random() < 0.06;
        return { d, a0: braco * Math.PI + d * 4.4 + espalha, tam: nuvem ? ale(0.05, 0.08) : ale(0.008, 0.022), cor: nuvem ? '#ff7ac8' : d < 0.3 ? '#ffe2b0' : Math.random() < 0.7 ? '#9fc4ff' : '#ffffff', f: ale(0, 6), nuvem };
      });
      return (ctx, R, _dt, t) => {
        if (!ctx) return;
        ctx.globalCompositeOperation = 'lighter';
        luz(ctx, '#8a5bff', 0, 0, R * 2.15, 0.35);
        luz(ctx, '#ffcf8a', 0, 0, R * 1.5, 0.25 + 0.05 * Math.sin(t * 2));
        for (const s of estrelas) {
          const r = R * (1.08 + s.d * 1.0), a = s.a0 + t * (0.55 / (0.6 + s.d * 1.4));
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          if (s.nuvem) { luz(ctx, s.cor, x, y, R * s.tam * 3, 0.5); continue; }
          ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 2 + s.f)); ctx.fillStyle = s.cor;
          ctx.beginPath(); ctx.arc(x, y, Math.max(0.6, R * s.tam), 0, TAU); ctx.fill();
        }
      };
    }
  }
}

// ---------- um relógio só para todas as auras ----------
const assinantes = new Set<(agora: number) => void>();
let rafGlobal = 0;
function tique(agora: number) {
  assinantes.forEach(f => f(agora));
  rafGlobal = assinantes.size ? requestAnimationFrame(tique) : 0;
}
function assinar(f: (agora: number) => void) {
  assinantes.add(f);
  if (!rafGlobal) rafGlobal = requestAnimationFrame(tique);
  return () => { assinantes.delete(f); };
}

/**
 * Canvas 3× o tamanho da foto, centrado nela. O pai é o quadrado da foto ("relative").
 * escala: tamanho da arte da moldura (MOLDURA_ARTE) — a aura cresce junto para nascer na borda dela.
 */
export function AuraMoldura({ tipo, cores, escala = 1.45 }: { tipo: TipoAura; cores?: string[]; escala?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chaveCores = cores?.join(',');
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const desenho = criarAura(tipo, chaveCores ? chaveCores.split(',') : undefined);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let lado = 0, ultimo = 0;
    const inicio = performance.now();
    const medir = () => { lado = cv.getBoundingClientRect().width; cv.width = cv.height = Math.max(1, Math.round(lado * dpr)); };
    const quadro = (dt: number, t: number) => {
      if (!lado) return;
      const R = lado / 6, m = lado / 2, k = escala / 1.45;
      ctx.setTransform(dpr, 0, 0, dpr, m * dpr, m * dpr);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(-m, -m, lado, lado);
      ctx.save();
      ctx.beginPath(); ctx.rect(-m, -m, lado, lado); ctx.arc(0, 0, R * 0.98, 0, TAU, true); ctx.clip(); // a foto fica limpa
      ctx.scale(k, k); // desenhos pensados para um anel de ~1,45R
      desenho(ctx, R, dt, t);
      ctx.restore();
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(cv);
    if (menosMovimento()) {
      const R = lado / 6;
      for (let i = 0; i < 60; i++) desenho(null, R, 1 / 30, i / 30);
      quadro(0, 2);
      return () => ro.disconnect();
    }
    let sair: (() => void) | null = null;
    const passo = (agora: number) => {
      const dt = ultimo ? Math.min(0.05, (agora - ultimo) / 1000) : 0;
      ultimo = agora;
      quadro(dt, (agora - inicio) / 1000);
    };
    // Só anima o que está na tela
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !sair) { ultimo = 0; sair = assinar(passo); }
      else if (!e.isIntersecting && sair) { sair(); sair = null; }
    });
    io.observe(cv);
    return () => { sair?.(); io.disconnect(); ro.disconnect(); };
  }, [tipo, chaveCores, escala]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute z-[2]" style={{ left: '-100%', top: '-100%', width: '300%', height: '300%' }} />;
}
