'use client';

// Como os itens da loja aparecem: moldura em volta da foto, ícone ao lado do
// nome e placa atrás do nome. Item desconhecido simplesmente não aparece.
import { MOLDURAS, MOLDURA_ARTE, MOLDURA_FX, ICONES, PLACAS, PLACAS_ARTE, arteDoIcone, type FxMoldura } from '@/lib/itens';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Anel por cima da foto. O pai precisa ser "relative" e do tamanho da foto. */
export function Moldura({ id, espessura: base = 3 }: { id?: string | null; espessura?: number }) {
  // Brilho e glitch usam a arte como máscara: só entram depois que ela carregar
  const [carregou, setCarregou] = useState<string | null>(null);
  const m = id ? MOLDURAS[id] : undefined;
  if (!m) return null;
  const arte = MOLDURA_ARTE[id!];
  // Fotos pequenas (lista de membros) ficam paradas, como no Discord
  const fx: FxMoldura[] = base >= 3 ? MOLDURA_FX[id!] ?? [] : [];
  const pronta = carregou === id;
  if (arte) {
    // Arte 3D: a foto fica no furo do meio (medido em lib/itens.ts)
    const url = `/itens/molduras/${id}.webp`;
    const cx = (0.5 - arte.x) / arte.escala, cy = (0.5 - arte.y) / arte.escala, furo = 0.5 / arte.escala;
    const anim = fx.flatMap(f => (ANIM_IMG[f] ? [ANIM_IMG[f]] : [])).join(', ');
    const img = (extra?: string, style?: React.CSSProperties) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" draggable={false} className={cn('absolute inset-0 w-full h-full max-w-none', extra)} style={style} />
    );
    return (
      <span aria-hidden className={cn('pointer-events-none select-none absolute z-[1] nx-fx', fx.length > 0 && 'isolate')}
        style={{ width: `${arte.escala * 100}%`, height: `${arte.escala * 100}%`, left: `${arte.x * 100}%`, top: `${arte.y * 100}%`,
          filter: m.brilho && base >= 3 ? `drop-shadow(0 0 ${base + 2}px ${m.brilho}88)` : undefined }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" draggable={false} onLoad={() => setCarregou(id!)}
          className="absolute inset-0 w-full h-full max-w-none" style={anim ? { animation: anim } : undefined} />
        {pronta && fx.includes('glitch') && <>
          {img('nx-fx-glitch-a opacity-60 mix-blend-screen', { filter: 'hue-rotate(90deg)' })}
          {img('nx-fx-glitch-b opacity-50 mix-blend-screen', { filter: 'hue-rotate(-120deg)' })}
        </>}
        {pronta && fx.includes('brilho') && (
          // Luz correndo só por cima da arte (a própria imagem é a máscara)
          <span className="absolute inset-0 overflow-hidden mix-blend-screen"
            style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
            <span className="absolute -inset-1/2 nx-fx-brilho" />
          </span>
        )}
        {fx.includes('faisca') && <Faiscas cx={cx} cy={cy} r0={furo * 1.15} cor={m.brilho ?? '#fff'} />}
        {fx.includes('chama') && <Brasas cx={cx} cy={cy} r={furo * 1.25} />}
        {fx.includes('raio') && <Raios cx={cx} cy={cy} r0={furo * 1.05} r1={0.5} cor={m.brilho ?? '#8ab4ff'} />}
      </span>
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
      {fx.includes('raio') && <Raios cx={0.5} cy={0.5} r0={0.44} r1={0.66} cor={m.brilho ?? '#ffd000'} />}
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

// Animações da própria arte (podem somar: cada uma mexe numa propriedade)
const ANIM_IMG: Partial<Record<FxMoldura, string>> = {
  arco: 'nx-fx-arco 8s linear infinite',
  pulso: 'nx-fx-pulso 2.6s ease-in-out infinite',
  chama: 'nx-fx-chama 1.3s ease-in-out infinite',
};
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
// Número "aleatório" fixo por índice: o desenho é sempre igual (sem pular entre renders)
const sorte = (i: number) => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;

/** Brilhinhos de 4 pontas aparecendo em volta do anel. Medidas em fração da caixa. */
function Faiscas({ cx, cy, r0, cor }: { cx: number; cy: number; r0: number; cor: string }) {
  return <>{Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + 0.4, r = r0 + sorte(i) * Math.max(0.02, 0.47 - r0), t = 0.07 + sorte(i + 9) * 0.06;
    return (
      <span key={i} className="absolute nx-fx-faisca nx-fx-part"
        style={{ left: pct(cx + Math.cos(a) * r), top: pct(cy + Math.sin(a) * r), width: pct(t), height: pct(t), marginLeft: pct(-t / 2), marginTop: pct(-t / 2),
          animationDelay: `${(i * 0.41).toFixed(2)}s`, background: `radial-gradient(circle, #fff 0 18%, ${cor} 42%, transparent 70%)` }} />
    );
  })}</>;
}

/** Brasas subindo do anel (moldura de fogo). */
function Brasas({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <>{Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI * (0.15 + sorte(i + 3) * 0.7) + (i % 2 ? Math.PI : 0), t = 0.025 + sorte(i + 5) * 0.02;
    return (
      // A caixa inteira sobe (translate em % = % da caixa); a brasa fica no ponto de saída
      <span key={i} className="absolute inset-0 nx-fx-brasa nx-fx-part" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s`, animationDuration: `${(1.8 + sorte(i) * 0.9).toFixed(2)}s` }}>
        <span className="absolute rounded-full"
          style={{ left: pct(cx + Math.cos(a) * r), top: pct(cy + Math.sin(a) * r * 0.9), width: pct(t), height: pct(t),
            background: i % 3 ? '#ffb000' : '#ff5a00', boxShadow: '0 0 6px 2px rgba(255,120,0,0.75)' }} />
      </span>
    );
  })}</>;
}

/** Raios saindo do anel e piscando em tempos diferentes. */
function Raios({ cx, cy, r0, r1, cor }: { cx: number; cy: number; r0: number; r1: number; cor: string }) {
  const raios = Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + 0.5 + sorte(i) * 0.6;
    const pts: string[] = [];
    for (let k = 0; k <= 4; k++) {
      const r = r0 + ((r1 - r0) * k) / 4, desvio = k === 0 ? 0 : (sorte(i * 7 + k) - 0.5) * 0.09;
      pts.push(`${((cx + Math.cos(a) * r - Math.sin(a) * desvio) * 100).toFixed(1)},${((cy + Math.sin(a) * r + Math.cos(a) * desvio) * 100).toFixed(1)}`);
    }
    return pts.join(' ');
  });
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full overflow-visible nx-fx-part" style={{ filter: `drop-shadow(0 0 2px ${cor})` }}>
      {raios.map((p, i) => (
        <g key={i} className="nx-fx-raio" style={{ animationDelay: `${(i * 0.63).toFixed(2)}s` }}>
          <polyline points={p} fill="none" stroke={cor} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={p} fill="none" stroke="#fff" strokeWidth={0.9} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
    </svg>
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
