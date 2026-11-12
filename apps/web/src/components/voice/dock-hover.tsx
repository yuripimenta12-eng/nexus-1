'use client';

// Efeito "dock" do painel lateral da chamada: o item sob o mouse cresce e salta
// um pouco; os vizinhos reagem menos conforme a distância do cursor.
// Só mouse: no toque, com "reduzir movimento" ou no Modo leve, nada se mexe.
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';

type Eixo = 'x' | 'y';
const DockCtx = createContext<{ pos: MotionValue<number>; eixo: Eixo } | null>(null);
const MOLA = { mass: 0.1, stiffness: 170, damping: 12 };

export function DockArea({ eixo, className, children }: { eixo: Eixo; className?: string; children: ReactNode }) {
  const pos = useMotionValue(Infinity);
  const reduzir = useReducedMotion();
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || reduzir || document.documentElement.classList.contains('nx-leve')) return;
        pos.set(eixo === 'x' ? e.clientX : e.clientY);
      }}
      onPointerLeave={() => pos.set(Infinity)}
    >
      <DockCtx.Provider value={{ pos, eixo }}>{children}</DockCtx.Provider>
    </div>
  );
}

/** Dentro de um DockArea. No ponto mais perto do cursor: escala `escala`, desloca `x`/`y` px. */
export function DockItem({
  children, className, escala = 1, x = 0, y = 0, alcance = 90,
}: { children: ReactNode; className?: string; escala?: number; x?: number; y?: number; alcance?: number }) {
  const ctx = useContext(DockCtx);
  const ref = useRef<HTMLDivElement>(null);
  const fallback = useMotionValue(Infinity);
  const pos = ctx?.pos ?? fallback;
  // 0 = longe, 1 = cursor no centro do item
  const perto = useSpring(
    useTransform(pos, (v) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r || !Number.isFinite(v)) return 0;
      const centro = ctx?.eixo === 'x' ? r.left + r.width / 2 : r.top + r.height / 2;
      return Math.max(0, 1 - Math.abs(v - centro) / alcance);
    }),
    MOLA,
  );
  const s = useTransform(perto, [0, 1], [1, escala]);
  const tx = useTransform(perto, [0, 1], [0, x]);
  const ty = useTransform(perto, [0, 1], [0, y]);
  return (
    <motion.div ref={ref} className={className} style={{ scale: s, x: tx, y: ty }}>
      {children}
    </motion.div>
  );
}
