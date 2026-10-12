'use client';

import { create } from 'zustand';
import { motion } from 'framer-motion';
import { CartaVerso } from '../carta';
import { modoAtual, useModoEfeitos } from './config';
import type { Ponto } from './posicoes';

// Camada das coisas que passam voando pela mesa: cartas indo do monte para
// alguém, textos flutuantes (+2, UNidos!, ÚLTIMA CARTA), a linha de energia
// da vez e pulsos nos avatares. Tudo com transform/opacity e removido sozinho.

type Base = { id: number; atraso: number; duracao: number };
export type ItemVoo =
  | (Base & { tipo: 'carta'; face: 'verso' | 'holo'; de: Ponto; para: Ponto; larg: number; largFinal?: number; rot?: number; aoChegar?: () => void })
  | (Base & { tipo: 'texto'; x: number; y: number; texto: string; sub?: string; cor: string; tamanho: number })
  | (Base & { tipo: 'linha'; de: Ponto; para: Ponto; cor: string })
  | (Base & { tipo: 'pulso'; x: number; y: number; raio: number; cor: string });

type SemId<T> = T extends any ? Omit<T, 'id'> : never;
const MAX_ITENS = 60;
let proximo = 1;

export const useVoos = create<{
  itens: ItemVoo[];
  adicionar: (i: SemId<ItemVoo>) => void;
  remover: (id: number) => void;
  limpar: () => void;
}>((set, get) => ({
  itens: [],
  adicionar: (i) => {
    if (typeof document !== 'undefined' && document.hidden) { if (i.tipo === 'carta') i.aoChegar?.(); return; }
    // Sem movimento: cartas e linhas não voam (o resultado aparece direto)
    if (!modoAtual().movimento && (i.tipo === 'carta' || i.tipo === 'linha')) { if (i.tipo === 'carta') i.aoChegar?.(); return; }
    const itens = [...get().itens, { ...i, id: proximo++ } as ItemVoo];
    set({ itens: itens.length > MAX_ITENS ? itens.slice(-MAX_ITENS) : itens });
  },
  remover: (id) => set({ itens: get().itens.filter(x => x.id !== id) }),
  limpar: () => set({ itens: [] }),
}));

// Atalhos usados pelo controlador
export const voos = {
  carta: (de: Ponto | null, para: Ponto | null, o: { larg?: number; largFinal?: number; atraso?: number; duracao?: number; face?: 'verso' | 'holo'; rot?: number; aoChegar?: () => void } = {}) => {
    if (!de || !para) { o.aoChegar?.(); return; }
    useVoos.getState().adicionar({ tipo: 'carta', face: o.face || 'verso', de, para, larg: o.larg ?? 46, largFinal: o.largFinal, rot: o.rot, atraso: o.atraso ?? 0, duracao: o.duracao ?? 0.42, aoChegar: o.aoChegar });
  },
  texto: (p: Ponto | null, texto: string, o: { sub?: string; cor?: string; tamanho?: number; atraso?: number; duracao?: number; acima?: number } = {}) => {
    if (!p) return;
    useVoos.getState().adicionar({ tipo: 'texto', x: p.x, y: p.y - (o.acima ?? 0), texto, sub: o.sub, cor: o.cor || '#fff', tamanho: o.tamanho ?? 26, atraso: o.atraso ?? 0, duracao: o.duracao ?? 1.1 });
  },
  linha: (de: Ponto | null, para: Ponto | null, cor = '#FF6A00', duracao = 0.55) => {
    if (!de || !para) return;
    useVoos.getState().adicionar({ tipo: 'linha', de, para, cor, atraso: 0, duracao });
  },
  pulso: (p: Ponto | null, cor = '#FF6A00', o: { atraso?: number; duracao?: number; raio?: number } = {}) => {
    if (!p) return;
    useVoos.getState().adicionar({ tipo: 'pulso', x: p.x, y: p.y, raio: o.raio ?? Math.max(p.w, p.h) / 2 + 6, cor, atraso: o.atraso ?? 0, duracao: o.duracao ?? 0.7 });
  },
};

const SUAVE = [0.22, 1, 0.36, 1] as const;

function Voo({ i, remover }: { i: Extract<ItemVoo, { tipo: 'carta' }>; remover: (id: number) => void }) {
  const dx = i.para.x - i.de.x;
  const dy = i.para.y - i.de.y;
  const dist = Math.hypot(dx, dy);
  const lift = Math.min(120, dist * 0.25);
  const escala = (i.largFinal ?? i.larg) / i.larg;
  const h = i.larg * 1.5;
  return (
    <motion.div
      className="fixed top-0 left-0 will-change-transform"
      style={{ x: i.de.x - i.larg / 2, y: i.de.y - h / 2, width: i.larg, height: h }}
      initial={{ opacity: 0 }}
      animate={{
        x: [i.de.x - i.larg / 2, i.de.x + dx / 2 - i.larg / 2, i.para.x - i.larg / 2],
        y: [i.de.y - h / 2, i.de.y + dy / 2 - lift - h / 2, i.para.y - h / 2],
        rotate: [i.rot ?? 0, (i.rot ?? 0) + (dx > 0 ? 14 : -14), 0],
        scale: [1, 1.08, escala],
        opacity: [0, 1, 1, 0.85],
      }}
      transition={{ duration: i.duracao, delay: i.atraso, ease: SUAVE }}
      onAnimationComplete={() => { i.aoChegar?.(); remover(i.id); }}
    >
      <div className="relative w-full h-full">
        <CartaVerso tamanho={i.larg} />
        {i.face === 'holo' && <div className="absolute inset-0 unidos-holo" style={{ borderRadius: i.larg * 0.075 }} />}
        {i.face === 'holo' && <div className="absolute -inset-2 rounded-[14px] blur-md opacity-70" style={{ background: 'linear-gradient(135deg,#FF6A00,#7A2CFF,#F2C35B)', zIndex: -1 }} />}
      </div>
    </motion.div>
  );
}

function Linha({ i, remover }: { i: Extract<ItemVoo, { tipo: 'linha' }>; remover: (id: number) => void }) {
  // Curva saindo de um jogador e chegando no outro, com um ponto de energia viajando nela
  const cx = (i.de.x + i.para.x) / 2;
  const cy = Math.min(i.de.y, i.para.y) - Math.min(140, Math.abs(i.para.x - i.de.x) * 0.35 + 30);
  const ponto = (t: number) => ({
    x: (1 - t) * (1 - t) * i.de.x + 2 * (1 - t) * t * cx + t * t * i.para.x,
    y: (1 - t) * (1 - t) * i.de.y + 2 * (1 - t) * t * cy + t * t * i.para.y,
  });
  const pts = Array.from({ length: 9 }, (_, k) => ponto(k / 8));
  const gid = `unidos-linha-${i.id}`;
  return (
    <svg className="fixed inset-0 w-full h-full pointer-events-none overflow-visible">
      <defs>
        <linearGradient id={gid} x1={i.de.x} y1={i.de.y} x2={i.para.x} y2={i.para.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={i.cor} stopOpacity="0" />
          <stop offset="1" stopColor={i.cor} />
        </linearGradient>
      </defs>
      <motion.path
        d={`M ${i.de.x} ${i.de.y} Q ${cx} ${cy} ${i.para.x} ${i.para.y}`}
        fill="none" stroke={`url(#${gid})`} strokeWidth={3} strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0.9 }}
        animate={{ pathLength: 1, opacity: [0.9, 0.9, 0] }}
        transition={{ duration: i.duracao, ease: 'easeOut', opacity: { duration: i.duracao + 0.25, times: [0, 0.7, 1] } }}
        onAnimationComplete={() => remover(i.id)}
        style={{ filter: `drop-shadow(0 0 6px ${i.cor})` }}
      />
      <motion.circle r={5} fill="#fff"
        initial={{ cx: pts[0].x, cy: pts[0].y, opacity: 1 }}
        animate={{ cx: pts.map(p => p.x), cy: pts.map(p => p.y), opacity: [1, 1, 0] }}
        transition={{ duration: i.duracao, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 8px ${i.cor}) drop-shadow(0 0 3px #fff)` }}
      />
    </svg>
  );
}

export function CamadaVoos() {
  const itens = useVoos(s => s.itens);
  const remover = useVoos(s => s.remover);
  const { reduzido } = useModoEfeitos();
  return (
    <div className="pointer-events-none fixed inset-0 z-[35] overflow-hidden" aria-hidden>
      {itens.map(i => {
        if (i.tipo === 'carta') return <Voo key={i.id} i={i} remover={remover} />;
        if (i.tipo === 'linha') return <Linha key={i.id} i={i} remover={remover} />;
        if (i.tipo === 'pulso') return (
          <motion.div key={i.id} className="fixed rounded-full"
            style={{ left: i.x - i.raio, top: i.y - i.raio, width: i.raio * 2, height: i.raio * 2, border: `3px solid ${i.cor}`, boxShadow: `0 0 18px ${i.cor}, inset 0 0 12px ${i.cor}` }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: reduzido ? 1 : [0.7, 1.05, 1.5], opacity: [0, 0.95, 0] }}
            transition={{ duration: i.duracao, delay: i.atraso, ease: 'easeOut' }}
            onAnimationComplete={() => remover(i.id)} />
        );
        return (
          <motion.div key={i.id} className="fixed text-center whitespace-nowrap"
            style={{ left: i.x, top: i.y, x: '-50%', y: '-50%' }}
            initial={{ opacity: 0, scale: reduzido ? 1 : 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: reduzido ? 1 : [0.5, 1.15, 1, 1], translateY: reduzido ? 0 : [8, 0, -10, -26] }}
            transition={{ duration: i.duracao, delay: i.atraso, times: [0, 0.18, 0.75, 1], ease: 'easeOut' }}
            onAnimationComplete={() => remover(i.id)}>
            <div className="font-black leading-none tracking-wide" style={{
              fontSize: i.tamanho, color: i.cor,
              textShadow: `0 0 14px ${i.cor}, 0 2px 0 #0a0713, 0 0 2px #0a0713`,
              WebkitTextStroke: i.tamanho >= 22 ? '1px rgba(10,7,19,.7)' : undefined,
            }}>{i.texto}</div>
            {i.sub && <div className="mt-1 text-[12px] font-bold text-white/90 px-2 py-0.5 rounded-full bg-black/55 inline-block">{i.sub}</div>}
          </motion.div>
        );
      })}
    </div>
  );
}
