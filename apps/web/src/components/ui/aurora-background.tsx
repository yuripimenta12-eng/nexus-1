'use client';

// Fundo "aurora": manchas de cor que flutuam devagar e estrelinhas piscando.
// Preenche o elemento pai (que precisa ser relative). Com "reduzir movimento"
// ou no Modo leve fica parado (MotionConfig / CSS globais).
import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Estrela = { x: number; y: number; brilho: number; duracao: number; atraso: number };

export default function AuroraBackground({
  className, children, fundo, estrelas = 60,
  cores = ['rgba(122,44,255,0.28)', 'rgba(255,106,0,0.16)'],
}: { className?: string; children?: ReactNode; fundo?: ReactNode; estrelas?: number; cores?: [string, string] }) {
  // Sorteadas só no navegador: no servidor dariam outro resultado (erro de hidratação)
  const [pontos, setPontos] = useState<Estrela[]>([]);
  useEffect(() => {
    setPontos(Array.from({ length: estrelas }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      brilho: 0.3 + Math.random() * 0.6, duracao: 2 + Math.random() * 3, atraso: Math.random() * 5,
    })));
  }, [estrelas]);

  return (
    <div className={cn('relative overflow-hidden bg-[#07040d]', className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 nx-aurora-pulso"
          style={{ backgroundImage: `radial-gradient(circle at 30% 20%, ${cores[0]} 0%, transparent 60%), radial-gradient(circle at 75% 80%, ${cores[1]} 0%, transparent 60%)` }}
        />
        <motion.div className="absolute inset-0 mix-blend-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.2 }}>
          <motion.div
            className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-[#7a2cff] opacity-40 blur-3xl"
            animate={{ x: [-50, 50, -50], y: [-20, 20, -20], scale: [1, 1.2, 1] }}
            transition={{ duration: 30, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-[#ff4f79] opacity-30 blur-3xl"
            animate={{ x: [50, -50, 50], y: [20, -20, 20], scale: [1, 1.3, 1] }}
            transition={{ duration: 40, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/3 left-1/3 h-1/3 w-1/3 rounded-full bg-[#ff6a00] opacity-20 blur-3xl"
            animate={{ x: [20, -20, 20], y: [-30, 30, -30] }}
            transition={{ duration: 50, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
          />
        </motion.div>
        {pontos.map((p, i) => (
          <motion.span
            key={i}
            className="absolute h-0.5 w-0.5 rounded-full bg-white"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, p.brilho, 0] }}
            transition={{ duration: p.duracao, repeat: Infinity, delay: p.atraso }}
          />
        ))}
      </div>
      {/* Camada extra de fundo (ex.: tubos), fora do z-10 para poder se misturar com a aurora */}
      {fundo}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
