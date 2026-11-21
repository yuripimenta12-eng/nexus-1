'use client';

// Como os itens da loja aparecem: moldura em volta da foto, ícone ao lado do
// nome e placa atrás do nome. Item desconhecido simplesmente não aparece.
import { MOLDURAS, ICONES, PLACAS } from '@/lib/itens';
import { cn } from '@/lib/utils';

/** Anel por cima da foto. O pai precisa ser "relative" e do tamanho da foto. */
export function Moldura({ id, espessura: base = 3 }: { id?: string | null; espessura?: number }) {
  const m = id ? MOLDURAS[id] : undefined;
  if (!m) return null;
  const espessura = Math.round(base * (m.grossura ?? 1));
  const anel = m.anel;
  const mascara = `radial-gradient(farthest-side, transparent calc(100% - ${espessura}px), #000 calc(100% - ${espessura}px + 1px))`;
  return (
    <span aria-hidden className="pointer-events-none absolute z-[1]" style={{ inset: -espessura - 1 }}>
      <span
        className={cn('absolute inset-0 rounded-full', m.anim && `nx-mold-${m.anim}`)}
        style={{ background: anel, WebkitMask: mascara, mask: mascara, filter: m.brilho ? `drop-shadow(0 0 ${espessura + 2}px ${m.brilho})` : undefined }}
      />
      {m.anim === 'glitch' && (
        <span className="absolute inset-0 rounded-full nx-mold-glitch2"
          style={{ background: 'conic-gradient(#ff00e5,#00fff0,#ff00e5)', WebkitMask: mascara, mask: mascara, opacity: 0.6 }} />
      )}
      {m.enfeite && (
        <span className="absolute left-1/2 -translate-x-1/2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
          style={{ top: `-${Math.max(10, espessura * 4)}px`, fontSize: `${Math.max(12, espessura * 6)}px`, lineHeight: 1 }}>
          {m.enfeite}
        </span>
      )}
      {m.selo && base >= 3 && (
        <span className="absolute drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]"
          style={{ right: `-${base}px`, bottom: `-${base}px`, fontSize: `${Math.max(11, base * 4)}px`, lineHeight: 1 }}>
          {m.selo}
        </span>
      )}
    </span>
  );
}

/** Ícone ao lado do nome. */
export function IconeNome({ id, className }: { id?: string | null; className?: string }) {
  const e = id ? ICONES[id] : undefined;
  if (!e) return null;
  return <span className={cn('shrink-0 leading-none', className)} aria-hidden>{e}</span>;
}

/** Nome com placa atrás (se tiver) e ícone ao lado. */
export function NomeComItens({ nome, icone, placa, className, style }: {
  nome: React.ReactNode; icone?: string | null; placa?: string | null; className?: string; style?: React.CSSProperties;
}) {
  const fundo = placa ? PLACAS[placa] : undefined;
  return (
    <span className={cn('inline-flex items-center gap-1 min-w-0 max-w-full', fundo && 'rounded-md px-1.5 -mx-0.5', className)}
      style={{ ...(fundo ? { background: fundo } : {}), ...style }}>
      <span className="truncate">{nome}</span>
      <IconeNome id={icone} />
    </span>
  );
}
