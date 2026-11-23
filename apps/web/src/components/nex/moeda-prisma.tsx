'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

// Prisma: a moeda AZUL, comprada com dinheiro. Desenhada em SVG (cristal facetado).
export function MoedaPrisma({ className, titulo }: { className?: string; titulo?: string }) {
  const id = 'nxp' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 32 32" role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}
      className={cn('inline-block shrink-0 select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]', className)}>
      {titulo && <title>{titulo}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9f4ff" />
          <stop offset="0.45" stopColor="#3fb6ff" />
          <stop offset="1" stopColor="#1a3fe0" />
        </linearGradient>
      </defs>
      <path d="M16 2 28 9v14L16 30 4 23V9z" fill={`url(#${id})`} stroke="#dff8ff" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 9l12 7 12-7M16 16v14" fill="none" stroke="#ecfcff" strokeOpacity="0.6" strokeWidth="1" />
      <path d="M16 2 10 12.5 16 16l6-3.5z" fill="#ffffff" fillOpacity="0.28" />
    </svg>
  );
}
