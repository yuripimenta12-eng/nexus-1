'use client';

// Selo do perfil (STAFF, BETA NEXT, NEXUS+, NEXUS PRO) com fundo "líquido" animado,
// cada um na sua cor. No Modo leve o líquido fica parado.
import { useEffect, useState, type ReactNode } from 'react';
import { Liquid, type Colors } from '@/components/ui/button-1';
import { menosMovimento } from '@/lib/movimento';
import { cn } from '@/lib/utils';

type Tons = { claro: string; medio: string; forte: string; escuro: string; acento: string };

// Mesma distribuição de tons do botão de referência (branco, quase-brancos, claros, fortes e escuros)
function paleta(t: Tons): Colors {
  return {
    color1: '#FFFFFF', color2: t.escuro, color3: t.medio, color4: '#FCFCFE', color5: '#F9F9FD',
    color6: t.claro, color7: t.escuro, color8: t.forte, color9: t.forte, color10: t.medio,
    color11: t.escuro, color12: t.claro, color13: t.acento, color14: t.claro, color15: t.claro,
    color16: t.acento, color17: t.forte,
  };
}

export const CORES_SELO = {
  staff: { tons: paleta({ claro: '#ecdcff', medio: '#c08bff', forte: '#a64dff', escuro: '#5b1fe0', acento: '#ff9a1f' }), brilho: '#a64dff' },
  beta: { tons: paleta({ claro: '#ffe0ea', medio: '#ff8aa8', forte: '#ff4f79', escuro: '#c2185b', acento: '#ff8a1f' }), brilho: '#ff4f79' },
  mais: { tons: paleta({ claro: '#d9f9ff', medio: '#7fe9ff', forte: '#21d4fd', escuro: '#1c56e0', acento: '#7a2cff' }), brilho: '#21d4fd' },
  pro: { tons: paleta({ claro: '#fff1cc', medio: '#ffd36b', forte: '#ffb020', escuro: '#ff6a00', acento: '#ff4f79' }), brilho: '#ffb020' },
} as const;

export function SeloLiquido({ cor, titulo, icone, children, className }: {
  cor: keyof typeof CORES_SELO; titulo?: string; icone?: ReactNode; children: ReactNode; className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [parado, setParado] = useState(false);
  useEffect(() => { setParado(menosMovimento()); }, []);
  const { tons, brilho } = CORES_SELO[cor];

  return (
    <span title={titulo} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={cn('relative inline-flex h-[26px] select-none items-center rounded-full', className)}
      style={{ boxShadow: `0 0 14px -3px ${brilho}aa, 0 0 0 1px ${brilho}66` }}>
      {/* Líquido animado, recortado no formato do selo */}
      <span aria-hidden className="absolute inset-0 overflow-hidden rounded-full bg-black">
        <Liquid isHovered={hover} colors={tons} parado={parado} />
        {/* Escurece o meio para o texto ler bem e dá o brilho de vidro em cima */}
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(10,6,20,0.62),rgba(10,6,20,0.25)_75%)]" />
        <span className="absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
      </span>
      <span className="relative inline-flex items-center gap-1.5 pl-1.5 pr-3">
        {icone}
        <span className="text-[10.5px] font-black uppercase leading-none tracking-[0.14em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]">
          {children}
        </span>
      </span>
    </span>
  );
}
