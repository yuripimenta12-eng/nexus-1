'use client';

// Itens que correm ao longo de um caminho SVG (offset-path). A rolagem da
// página acelera e inverte o sentido; passar o mouse desacelera; dá para
// arrastar. Com "reduzir movimento" os itens ficam parados no caminho.
import { Children, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  motion, useAnimationFrame, useMotionValue, useReducedMotion, useScroll, useSpring,
  useTransform, useVelocity, type MotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';

const embrulhar = (v: number) => ((v % 100) + 100) % 100;

function ItemNoCaminho({ base, posicao, caminho, oculto, children, aoEntrar, aoSair }: {
  base: MotionValue<number>; posicao: number; caminho: string; oculto: boolean; children: ReactNode;
  aoEntrar: () => void; aoSair: () => void;
}) {
  const distancia = useTransform(base, (v) => embrulhar(v + posicao));
  const offsetDistance = useTransform(distancia, (d) => `${d}%`);
  // Quem está mais adiante no caminho fica por cima
  const zIndex = useTransform(distancia, (d) => 1 + Math.floor(d / 10));
  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ offsetPath: `path('${caminho}')`, offsetDistance, zIndex, willChange: 'offset-distance' }}
      aria-hidden={oculto || undefined}
      onMouseEnter={aoEntrar}
      onMouseLeave={aoSair}
    >
      {children}
    </motion.div>
  );
}

export default function MarqueeAlongSvgPath({
  children, className, caminho, viewBox, velocidade = 5, repetir = 2, desacelerarNoMouse = true, arrastavel = true,
}: {
  children: ReactNode; className?: string; caminho: string; viewBox: string;
  velocidade?: number; repetir?: number; desacelerarNoMouse?: boolean; arrastavel?: boolean;
}) {
  const reduzir = useReducedMotion();
  const caixa = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const base = useMotionValue(0);

  // O palco tem o tamanho do viewBox e é escalado para caber na caixa
  const [, , vbL, vbA] = viewBox.split(' ').map(Number);
  useEffect(() => {
    const ajustar = () => {
      const c = caixa.current, p = palco.current;
      if (!c || !p) return;
      const escala = Math.min(c.clientWidth / vbL, c.clientHeight / vbA);
      p.style.width = `${vbL}px`;
      p.style.height = `${vbA}px`;
      p.style.transformOrigin = 'top left';
      p.style.transform = `translate(${(c.clientWidth - vbL * escala) / 2}px, ${(c.clientHeight - vbA * escala) / 2}px) scale(${escala})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    if (caixa.current) ro.observe(caixa.current);
    return () => ro.disconnect();
  }, [vbL, vbA]);

  const itens = useMemo(() => {
    const lista = Children.toArray(children);
    return Array.from({ length: repetir }, (_, r) => lista.map((filho, i) => ({ filho, chave: `${r}-${i}`, oculto: r > 0 }))).flat();
  }, [children, repetir]);

  // Rolagem da página: quanto mais rápido, mais rápido o marquee (e no sentido dela)
  const { scrollY } = useScroll();
  const velRolagem = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const fatorRolagem = useTransform(velRolagem, [0, 1000], [0, 5], { clamp: false });
  const sentido = useRef(1);
  const mouseEm = useRef(false);
  const fatorMouse = useSpring(1, { damping: 50, stiffness: 400 });
  const arrastando = useRef(false);
  const velArraste = useRef(0);
  const ultimoX = useRef(0);

  useAnimationFrame((_, delta) => {
    if (reduzir) return;
    fatorMouse.set(mouseEm.current && desacelerarNoMouse ? 0.3 : 1);
    const f = fatorRolagem.get();
    if (f < 0) sentido.current = -1; else if (f > 0) sentido.current = 1;
    let passo = sentido.current * velocidade * (delta / 1000) * fatorMouse.get();
    passo += sentido.current * passo * f;
    if (arrastando.current) { passo = velArraste.current; velArraste.current *= 0.6; }
    else velArraste.current *= 0.92;
    base.set(base.get() + passo + (arrastando.current ? 0 : velArraste.current));
  });

  return (
    <div
      ref={caixa}
      className={cn('relative touch-pan-y', arrastavel && 'cursor-grab active:cursor-grabbing', className)}
      onPointerDown={(e) => { if (!arrastavel) return; arrastando.current = true; ultimoX.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (!arrastando.current) return; velArraste.current = (e.clientX - ultimoX.current) * 0.1; ultimoX.current = e.clientX; }}
      onPointerUp={(e) => { arrastando.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
      onPointerCancel={() => { arrastando.current = false; }}
    >
      <div ref={palco} className="absolute left-0 top-0" style={{ contain: 'layout style' }}>
        <svg viewBox={viewBox} className="h-full w-full overflow-visible" aria-hidden>
          <path d={caminho} fill="none" stroke="url(#nx-trilho)" strokeWidth={2} strokeDasharray="4 10" strokeLinecap="round" opacity={0.5} />
          <defs>
            <linearGradient id="nx-trilho" x1="0" x2="1">
              <stop offset="0" stopColor="#7a2cff" /><stop offset="0.5" stopColor="#ff4f79" /><stop offset="1" stopColor="#ff6a00" />
            </linearGradient>
          </defs>
        </svg>
        {itens.map((it, i) => (
          <ItemNoCaminho
            key={it.chave} base={base} posicao={(i * 100) / itens.length} caminho={caminho} oculto={it.oculto}
            aoEntrar={() => { mouseEm.current = true; }} aoSair={() => { mouseEm.current = false; }}
          >
            {it.filho}
          </ItemNoCaminho>
        ))}
      </div>
    </div>
  );
}
