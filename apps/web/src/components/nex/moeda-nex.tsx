'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

// Moeda Nex em "3D": disco com borda, brilho e o N do Nexus em relevo.
export function MoedaNex({ className, titulo }: { className?: string; titulo?: string }) {
  const id = useId().replace(/:/g, '');
  const u = (n: string) => `url(#${id}${n})`;
  return (
    <svg viewBox="0 0 32 32" className={cn('inline-block shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]', className)}
      role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {titulo && <title>{titulo}</title>}
      <defs>
        <linearGradient id={`${id}borda`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd08a" />
          <stop offset=".45" stopColor="#ff6a00" />
          <stop offset="1" stopColor="#7a2cff" />
        </linearGradient>
        <radialGradient id={`${id}face`} cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor="#c9a6ff" />
          <stop offset=".45" stopColor="#8b48ff" />
          <stop offset="1" stopColor="#3b1477" />
        </radialGradient>
        <linearGradient id={`${id}letra`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffd08a" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={u('borda')} />
      <circle cx="16" cy="16" r="12" fill={u('face')} stroke="#2a0e55" strokeWidth=".8" />
      <path d="M11 22V10h2.4l5.2 7.6V10H21v12h-2.4l-5.2-7.6V22z" fill="#2a0e55" transform="translate(.5 .8)" opacity=".55" />
      <path d="M11 22V10h2.4l5.2 7.6V10H21v12h-2.4l-5.2-7.6V22z" fill={u('letra')} />
      <ellipse cx="11.5" cy="9.5" rx="4" ry="2" fill="#fff" opacity=".28" transform="rotate(-30 11.5 9.5)" />
    </svg>
  );
}

/** "1.234" com ponto de milhar. */
export const formatarNex = (n: number) => n.toLocaleString('pt-BR');
/** Curto para a barra: 999, 1,2 mil, 12 mil. */
export const nexCurto = (n: number) => (n < 1000 ? String(n) : n < 10000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : `${Math.floor(n / 1000)} mil`);
