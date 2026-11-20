'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

// Fone mutado (ensurdecido) com volume: arco e conchas em gradiente, brilho,
// contorno escuro e sombra. Vetor, então fica nítido em qualquer tamanho.
export function HeadphoneOff({ className, 'aria-label': ariaLabel }: { className?: string; 'aria-label'?: string }) {
  const id = useId().replace(/:/g, '');
  const url = (n: string) => `url(#${id}${n})`;
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('inline-block shrink-0 drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.7)]', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {ariaLabel && <title>{ariaLabel}</title>}
      <defs>
        <linearGradient id={`${id}arco`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc2ca" />
          <stop offset=".45" stopColor="#ff5c72" />
          <stop offset="1" stopColor="#a80f28" />
        </linearGradient>
        <radialGradient id={`${id}concha`} cx=".35" cy=".28" r=".85">
          <stop offset="0" stopColor="#ffd0d6" />
          <stop offset=".32" stopColor="#ff4d66" />
          <stop offset="1" stopColor="#7d0a1d" />
        </radialGradient>
        <linearGradient id={`${id}risco`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffc9d1" />
        </linearGradient>
      </defs>
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="#4a0410" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke={url('arco')} strokeWidth="3" strokeLinecap="round" />
      <path d="M5.6 10.4a6.6 6.6 0 0 1 4.6-5.1" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth=".7" strokeLinecap="round" />
      <rect x="2.4" y="12.4" width="5.6" height="8.4" rx="2.5" fill={url('concha')} stroke="#4a0410" strokeWidth=".8" />
      <rect x="16" y="12.4" width="5.6" height="8.4" rx="2.5" fill={url('concha')} stroke="#4a0410" strokeWidth=".8" />
      <ellipse cx="4.3" cy="14.6" rx=".8" ry="1.3" fill="#fff" opacity=".6" />
      <ellipse cx="17.9" cy="14.6" rx=".8" ry="1.3" fill="#fff" opacity=".6" />
      <path d="M4.2 4.2 19.8 19.8" stroke="#3a030d" strokeWidth="2.7" strokeLinecap="round" />
      <path d="M4.2 4.2 19.8 19.8" stroke={url('risco')} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
