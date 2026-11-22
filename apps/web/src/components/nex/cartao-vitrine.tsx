'use client';

// Card "Vitrine" da loja: moldura externa chanfrada, cabeçalho em relevo,
// vitrine rebaixada com luz roxa, painel de informações e botão em relevo.
// Só desenha: compra, uso e prévia continuam na página da loja.
import Link from 'next/link';
import { Check, Eye, Lock } from 'lucide-react';
import { RARIDADE, type Raridade } from '@/lib/itens';
import { cn } from '@/lib/utils';

// Cantos cortados (chanfro) da moldura externa e do miolo
const chanfro = (c: number) =>
  `polygon(${c}px 0, calc(100% - ${c}px) 0, 100% ${c}px, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, ${c}px 100%, 0 calc(100% - ${c}px), 0 ${c}px)`;

export function CartaoVitrine({
  raridade, nome, selo, condicao, previa, usando, destacado, verPrevia, onAbrir, onPassar, children,
}: {
  raridade: Raridade;
  nome: string;
  selo?: { texto: string; cor: string } | null; // ex.: "Nexus+" no canto direito
  condicao: string; // como se consegue: "Incluída no Nexus+", "Compra com Nex"...
  previa: React.ReactNode;
  usando?: boolean;
  destacado?: boolean; // é o que está sendo provado no painel ao lado
  verPrevia?: boolean; // clique abre a janela grande
  onAbrir?: () => void;
  onPassar?: () => void;
  children: React.ReactNode; // o botão (BotaoVitrine)
}) {
  const r = RARIDADE[raridade];
  return (
    <div
      onMouseEnter={onPassar} onFocus={onPassar}
      onClick={e => { if (verPrevia && !(e.target as HTMLElement).closest('button,a')) onAbrir?.(); }}
      className={cn('group relative transition-transform duration-200 hover:-translate-y-1', verPrevia && 'cursor-pointer')}
      style={{ filter: usando ? 'drop-shadow(0 0 14px rgba(255,138,61,0.45))' : 'drop-shadow(0 12px 18px rgba(0,0,0,0.55))' }}
    >
      {/* Moldura externa chanfrada (o "aro" do card) */}
      <div className="p-[2px] h-full" style={{
        clipPath: chanfro(14),
        background: usando
          ? 'linear-gradient(160deg,#ffb070,#ff6a00 35%,#7a2cff 75%,#c9a6ff)'
          : destacado
            ? 'linear-gradient(160deg,#8a6bb5,#3a2852 45%,#5a3d82)'
            : 'linear-gradient(160deg,#5a4478,#241935 45%,#3a2852)',
      }}>
        <div className="relative h-full flex flex-col" style={{
          clipPath: chanfro(13),
          background: 'linear-gradient(180deg,#221934 0%,#171024 55%,#120c1c 100%)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
        }}>
          {/* Reflexo discreto no alto */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.06] to-transparent" />

          {/* 1. Cabeçalho em relevo */}
          <div className="relative flex items-center justify-between gap-2 px-3 pt-2.5 pb-2"
            style={{ boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04)' }}>
            <span className="text-[10px] font-black uppercase tracking-[1.5px] truncate" style={{ color: r.cor, textShadow: `0 0 10px ${r.cor}55` }}>{r.nome}</span>
            {selo && (
              <span className="shrink-0 text-[10px] font-black px-2 py-[3px] rounded-[7px] border border-white/15"
                style={{ color: selo.cor, background: 'linear-gradient(180deg,#3d2c57,#22172f)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 0 rgba(0,0,0,0.5)' }}>
                {selo.texto}
              </span>
            )}
          </div>

          {/* 2. Vitrine rebaixada */}
          <div className="relative mx-2 mt-1 h-[124px] sm:h-[140px] rounded-[12px] grid place-items-center overflow-hidden"
            style={{
              background: 'radial-gradient(ellipse at 50% 38%, rgba(140,70,255,0.38), rgba(90,40,170,0.12) 45%, transparent 70%), linear-gradient(180deg,#0c0814,#110a1b)',
              boxShadow: 'inset 0 8px 16px rgba(0,0,0,0.75), inset 0 -2px 6px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06)',
            }}>
            {/* Pedestal: sombra e luz debaixo do item */}
            <span aria-hidden className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[62%] h-4 rounded-[50%] bg-black/70 blur-[6px]" />
            <span aria-hidden className="absolute bottom-[14px] left-1/2 -translate-x-1/2 w-[46%] h-[3px] rounded-full bg-[#b366ff]/50 blur-[3px]" />
            <div className="relative z-[1] drop-shadow-[0_10px_14px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:scale-[1.04]">{previa}</div>
            {verPrevia && (
              <span className="absolute bottom-1.5 right-2 z-[2] flex items-center gap-1 text-[10px] font-bold text-white/70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <Eye className="w-3 h-3" /> Ver
              </span>
            )}
          </div>

          {/* Divisória iluminada */}
          <span aria-hidden className="mx-3 mt-2.5 h-px" style={{ background: 'linear-gradient(90deg,transparent,#7a2cff,#ff8a3d,#7a2cff,transparent)', boxShadow: '0 0 8px rgba(255,138,61,0.5)' }} />

          {/* 3. Informações */}
          <div className="px-3 pt-2.5 pb-2">
            <b className="block text-white text-[15px] font-black leading-tight truncate" title={nome}>{nome}</b>
            <span className="block mt-1 text-[11px] text-[#a99fc0] leading-snug truncate" title={condicao}>{condicao}</span>
          </div>
          <span aria-hidden className="mx-3 h-px bg-white/[0.07]" />

          {/* 4. Botão */}
          <div className="mt-auto p-3 pt-2.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

type Variante = 'primario' | 'uso' | 'bloqueado';
const ESTILO: Record<Variante, { cls: string; style: React.CSSProperties }> = {
  primario: {
    cls: 'text-white hover:brightness-110 active:translate-y-[2px]',
    style: {
      background: 'linear-gradient(180deg,#a066ff 0%,#7a2cff 55%,#5a1fc4 100%)',
      border: '1px solid rgba(214,180,255,0.55)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 3px 0 #3a1380, 0 8px 16px rgba(122,44,255,0.35)',
    },
  },
  uso: {
    cls: 'text-[#ffd2a8] active:translate-y-[2px]',
    style: {
      background: 'linear-gradient(180deg,#3b2350,#24152f)',
      border: '1px solid rgba(255,138,61,0.7)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 3px 0 #160c1d, 0 0 14px rgba(255,138,61,0.3)',
    },
  },
  bloqueado: {
    cls: 'text-[#8d82a0]',
    style: {
      background: 'linear-gradient(180deg,#1d1529,#150f1f)',
      border: '1px solid rgba(255,255,255,0.07)',
      boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.55)',
    },
  },
};

/** Botão em relevo do card. Com href vira link (ex.: planos). */
export function BotaoVitrine({ variante, onClick, href, disabled, titulo, children }: {
  variante: Variante; onClick?: () => void; href?: string; disabled?: boolean; titulo?: string; children: React.ReactNode;
}) {
  const e = ESTILO[variante];
  const cls = cn('group/b w-full h-10 rounded-[11px] text-[13px] font-black flex items-center justify-center gap-1.5 transition-[filter,transform] disabled:opacity-60', e.cls);
  if (href) return <Link href={href} title={titulo} className={cls} style={e.style}>{children}</Link>;
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={titulo} className={cls} style={e.style}>
      {children}
    </button>
  );
}

/** Conteúdo do botão "em uso": mostra "✓ Em uso" e, passando o mouse, "Tirar". */
export function EmUso() {
  return (
    <>
      <span className="flex items-center gap-1.5 group-hover/b:hidden"><Check className="w-4 h-4" /> Em uso</span>
      <span className="hidden group-hover/b:inline">Tirar</span>
    </>
  );
}

export { Lock };
