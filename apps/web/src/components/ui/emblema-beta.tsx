import { useId } from 'react';
import { cn } from '@/lib/utils';

// Emblema BETA NEXT: de quem criou conta enquanto o Nexus estava em beta.
// Hexágono laranja → roxo com um "β"; o selo é o emblema + o nome.
export const BETA_DICA = 'BETA NEXT · Testou o Nexus desde o começo';

export function EmblemaBeta({ size = 16, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn('shrink-0', className)}
      role="img" aria-label={BETA_DICA}>
      <title>{BETA_DICA}</title>
      <defs>
        <linearGradient id={`bn-g-${id}`} x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff8a1f" />
          <stop offset="0.55" stopColor="#ff4f79" />
          <stop offset="1" stopColor="#7a2cff" />
        </linearGradient>
        <linearGradient id={`bn-b-${id}`} x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd9b0" />
          <stop offset="1" stopColor="#b98cff" />
        </linearGradient>
      </defs>
      {/* Hexágono com borda clara e um brilho em cima */}
      <path d="M12 1.6 21.2 6.9v10.2L12 22.4 2.8 17.1V6.9Z" fill={`url(#bn-g-${id})`}
        stroke={`url(#bn-b-${id})`} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M12 3.4 19.6 7.8 12 12.1 4.4 7.8Z" fill="#fff" opacity="0.14" />
      {/* β */}
      <path d="M9.6 18.4V8.6c0-1.9 1.3-3.1 3-3.1 1.7 0 2.9 1.1 2.9 2.6 0 1.1-.6 1.9-1.6 2.3 1.4.4 2.2 1.4 2.2 2.8 0 1.9-1.5 3.2-3.4 3.2-.9 0-1.6-.3-2.1-.8"
        fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      {/* Faísca */}
      <path d="M19.3 1.2l.45 1.15 1.15.45-1.15.45-.45 1.15-.45-1.15-1.15-.45 1.15-.45Z" fill="#ffe7c2" />
    </svg>
  );
}

// Selo com o nome, para o perfil
export function SeloBeta({ className }: { className?: string }) {
  return (
    <span title={BETA_DICA}
      className={cn('inline-flex items-center gap-1.5 rounded-full p-[1px] select-none', className)}
      style={{ background: 'linear-gradient(110deg, #ff8a1f, #ff4f79 55%, #7a2cff)' }}>
      <span className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-[3px] bg-[#130d1d]">
        <EmblemaBeta size={18} />
        <span className="text-[10.5px] font-black tracking-[0.14em] leading-none bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #ffb070, #ff7aa0 50%, #c49bff)' }}>
          BETA NEXT
        </span>
      </span>
    </span>
  );
}
