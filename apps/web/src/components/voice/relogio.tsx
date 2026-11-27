'use client';

import { useEffect, useState } from 'react';

const dois = (n: number) => String(n).padStart(2, '0');

/** Relógio com a hora atual (HH : MM : SS). Só aparece depois de montar, para não divergir do HTML do servidor. */
export function Relogio({ className = '' }: { className?: string }) {
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!agora) return <div className={`h-[42px] ${className}`} />;

  const partes = [agora.getHours(), agora.getMinutes(), agora.getSeconds()].map(dois);
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-[12px] border border-white/[0.07] bg-[#1b1b1f]/90 px-4 py-2
                  text-[19px] font-semibold leading-none text-white tabular-nums shadow-[0_6px_20px_rgba(0,0,0,0.35)] ${className}`}
      role="timer"
      aria-label={`Agora são ${partes[0]}:${partes[1]}`}
    >
      {partes.map((p, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-[13px] text-white/35">:</span>}
          {p}
        </span>
      ))}
    </div>
  );
}
