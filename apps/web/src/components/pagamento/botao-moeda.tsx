'use client';

// Botão com uma moedinha que é jogada para cima e gira ao clicar (cara ou coroa);
// a ação roda quando ela cai. Referência: "Flip Coin Button" do 21st.dev.
// No Modo leve não anima: a ação roda na hora.
import { useState, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { menosMovimento } from '@/lib/movimento';

const DURACAO = 0.75;

export function MoedaReal({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-6 place-items-center rounded-full text-[9px] font-black text-[#7a4a00]', className)}
      style={{
        background: 'radial-gradient(circle at 35% 30%, #fff3b0 0%, #ffd34d 38%, #e9a300 75%, #b87800 100%)',
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 3px rgba(0,0,0,0.35)',
      }}>
      R$
    </span>
  );
}

export function BotaoMoeda({ children, onClick, disabled, className, style, moeda }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; className?: string; style?: CSSProperties; moeda?: ReactNode;
}) {
  const [voando, setVoando] = useState(false);

  const clicar = () => {
    if (voando) return;
    if (menosMovimento()) { onClick(); return; }
    setVoando(true);
    setTimeout(() => { setVoando(false); onClick(); }, DURACAO * 1000);
  };

  return (
    <button type="button" disabled={disabled} onClick={clicar} aria-busy={voando}
      className={cn('relative inline-flex items-center justify-center gap-2', className)} style={style}>
      <span>{children}</span>
      <motion.span className="inline-grid [perspective:300px]"
        animate={voando ? { y: [0, -54, -54, 0], scale: [1, 1.25, 1.25, 1] } : { y: 0, scale: 1 }}
        transition={{ duration: DURACAO, times: [0, 0.45, 0.55, 1], ease: ['easeOut', 'linear', 'easeIn'] }}>
        <motion.span className="inline-grid"
          animate={voando ? { rotateX: [0, 1080] } : { rotateX: 0 }}
          transition={{ duration: DURACAO, ease: 'easeInOut' }}>
          {moeda ?? <MoedaReal />}
        </motion.span>
      </motion.span>
    </button>
  );
}
