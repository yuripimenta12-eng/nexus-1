'use client';

import { cn } from '@/lib/utils';

// Moeda Nex: arte 3D em public/itens/moeda-nex.webp.
export function MoedaNex({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/itens/moeda-nex.webp" alt={titulo ?? ''} aria-hidden={titulo ? undefined : true} title={titulo} draggable={false}
      className={cn('inline-block shrink-0 object-contain select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]', className)} />
  );
}

/** "1.234" com ponto de milhar. */
export const formatarNex = (n: number) => n.toLocaleString('pt-BR');
/** Curto para a barra: 999, 1,2 mil, 12 mil. */
export const nexCurto = (n: number) => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : `${Math.floor(n / 1000)} mil`);
