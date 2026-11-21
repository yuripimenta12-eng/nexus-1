'use client';

// Como os itens da loja aparecem: moldura em volta da foto, ícone ao lado do
// nome e placa atrás do nome. Item desconhecido simplesmente não aparece.
import { MOLDURAS, MOLDURA_ARTE, ICONES, PLACAS, PLACAS_ARTE, arteDoIcone } from '@/lib/itens';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Anel por cima da foto. O pai precisa ser "relative" e do tamanho da foto. */
export function Moldura({ id, espessura: base = 3 }: { id?: string | null; espessura?: number }) {
  const m = id ? MOLDURAS[id] : undefined;
  if (!m) return null;
  const arte = MOLDURA_ARTE[id!];
  if (arte) {
    // Arte 3D: a foto fica no furo do meio (medido em lib/itens.ts)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/itens/molduras/${id}.webp`} alt="" aria-hidden draggable={false}
        className="pointer-events-none select-none absolute z-[1] max-w-none"
        style={{ width: `${arte.escala * 100}%`, height: `${arte.escala * 100}%`, left: `${arte.x * 100}%`, top: `${arte.y * 100}%`,
          filter: m.brilho && base >= 3 ? `drop-shadow(0 0 ${base + 2}px ${m.brilho}88)` : undefined }} />
    );
  }
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
/** Arte do ícone em qualquer tamanho (cai no emoji se a imagem não carregar). */
export function ArteIcone({ id, tamanho, className }: { id: string; tamanho: number | string; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const arte = arteDoIcone(id);
  if (!arte || falhou) return <span className={cn('leading-none', className)} style={{ fontSize: tamanho }} aria-hidden>{ICONES[id]}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={arte} alt="" aria-hidden draggable={false} onError={() => setFalhou(true)}
    className={cn('shrink-0 object-contain select-none', className)} style={{ width: tamanho, height: tamanho }} />;
}

export function IconeNome({ id, className }: { id?: string | null; className?: string }) {
  if (!id || !ICONES[id]) return null;
  return <ArteIcone id={id} tamanho="1.25em" className={cn('drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]', className)} />;
}

/** Nome com placa atrás (se tiver) e ícone ao lado. */
// corNome: "#hex" ou "#hex,#hex" (Nexus+/Pro; use corNomeDe() de lib/planos) — vence a cor do cargo
export function NomeComItens({ nome, icone, placa, corNome, className, style }: {
  nome: React.ReactNode; icone?: string | null; placa?: string | null; corNome?: string | null; className?: string; style?: React.CSSProperties;
}) {
  const arte = placa && PLACAS_ARTE.has(placa) ? placa : null;
  const fundo = placa && !arte ? PLACAS[placa] : undefined;
  const [c1, c2] = (corNome || '').split(',').map(c => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : ''));
  const corTexto: React.CSSProperties = c1 && c2
    ? { backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
    : c1 ? { color: c1 } : {};
  return (
    <span className={cn('inline-flex items-center gap-1 min-w-0 max-w-full', fundo && 'rounded-md px-1.5 -mx-0.5', arte && '-mx-1', className)}
      style={{
        ...(fundo ? { background: fundo } : {}),
        // Arte da placa: pontas fixas (40% da altura da imagem), meio esticado
        ...(arte ? { borderStyle: 'solid', borderColor: 'transparent', borderWidth: '0.45em 0.95em', borderImage: `url(/itens/placas/${arte}.webp) 45 105 fill / 0.45em 0.95em / 0 stretch`, padding: '0 0.1em' } : {}),
        ...style,
      }}>
      <span className="truncate" style={corTexto}>{nome}</span>
      <IconeNome id={icone} />
    </span>
  );
}
