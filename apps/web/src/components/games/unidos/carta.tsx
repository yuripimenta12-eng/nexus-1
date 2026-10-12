'use client';

import { Shield, Repeat2, Headphones, Zap, Flame, Gem, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Carta, Cor } from './unidos.store';

// Artes oficiais do UNidos (public/unidos/cartas/*.webp), geradas a partir das
// artes do usuário. Com false, volta para as cartas desenhadas em CSS.
export const ARTE_PERSONALIZADA = true;

export const COR_HEX: Record<Cor, { base: string; claro: string; escuro: string; nome: string }> = {
  laranja: { base: '#FF6A00', claro: '#FFB27D', escuro: '#9C3D00', nome: 'Laranja' },
  roxo: { base: '#7A2CFF', claro: '#CBB3FF', escuro: '#3F1291', nome: 'Roxo' },
  prata: { base: '#C9C9D1', claro: '#FFFFFF', escuro: '#5E5E66', nome: 'Prata' },
  dourado: { base: '#F2C35B', claro: '#FFF1CC', escuro: '#8A6420', nome: 'Dourado' },
};

// Símbolo de cada cor (além da cor em si, para quem não distingue bem as cores)
const ICONE_COR = { laranja: Flame, roxo: Gem, prata: Moon, dourado: Sun } as const;
export function IconeCor({ cor, className, style }: { cor: Cor; className?: string; style?: React.CSSProperties }) {
  const I = ICONE_COR[cor];
  return <I className={className} style={style} strokeWidth={2.6} aria-hidden />;
}

export const NOME_TIPO: Record<Carta['tipo'], string> = {
  numero: 'Número', bloqueio: 'Bloqueio', troca: 'Troca', mais2: '+2', call: 'Call', conexao: 'Conexão', todosunidos: 'Todos Unidos',
};

let precarregado = false;
export function precarregarCartas() {
  if (precarregado || !ARTE_PERSONALIZADA || typeof window === 'undefined') return;
  precarregado = true;
  const nomes = ['verso', 'conexao', 'todos-unidos', 'logo'];
  for (const cor of Object.keys(COR_HEX)) {
    for (let v = 0; v <= 9; v++) nomes.push(`${cor}-${v}`);
    for (const t of ['bloqueio', 'troca', 'mais2', 'call']) nomes.push(`${cor}-${t}`);
  }
  for (const n of nomes) { const img = new Image(); img.decoding = 'async'; img.src = `/unidos/cartas/${n}.webp`; }
}

export function nomeCarta(c: Carta) {
  if (c.tipo === 'numero') return `${c.valor} ${COR_HEX[c.cor!].nome.toLowerCase()}`;
  if (!c.cor) return NOME_TIPO[c.tipo];
  return `${NOME_TIPO[c.tipo]} ${COR_HEX[c.cor].nome.toLowerCase()}`;
}

function arquivo(c: Carta) {
  if (c.tipo === 'conexao') return '/unidos/cartas/conexao.webp';
  if (c.tipo === 'todosunidos') return '/unidos/cartas/todos-unidos.webp';
  const sufixo = c.tipo === 'numero' ? String(c.valor) : c.tipo;
  return `/unidos/cartas/${c.cor}-${sufixo}.webp`;
}

function Simbolo({ c, grande }: { c: Carta; grande?: boolean }) {
  const tam = grande ? 'w-[46%] h-[46%]' : 'w-[60%] h-[60%]';
  switch (c.tipo) {
    case 'numero': return <span className="leading-none">{c.valor}</span>;
    case 'bloqueio': return <Shield className={tam} strokeWidth={2.6} />;
    case 'troca': return <Repeat2 className={tam} strokeWidth={2.6} />;
    case 'call': return <Headphones className={tam} strokeWidth={2.6} />;
    case 'mais2': return <span className="leading-none">+2</span>;
    case 'todosunidos': return <span className="leading-none">+4</span>;
    case 'conexao': return <Zap className={tam} strokeWidth={2.6} />;
  }
}

// Carta virada para cima. `tamanho` = largura em px (altura segue 2:3).
export function CartaView({
  carta, tamanho = 84, jogavel, apagada, corEscolhida, className,
}: {
  carta: Carta; tamanho?: number; jogavel?: boolean; apagada?: boolean; corEscolhida?: Cor | null; className?: string;
}) {
  const preta = !carta.cor;
  const cor = carta.cor ? COR_HEX[carta.cor] : null;
  const altura = Math.round(tamanho * 1.5);
  const raio = Math.round(tamanho * 0.12);

  if (ARTE_PERSONALIZADA) {
    const r = Math.round(tamanho * 0.075); // canto arredondado das artes
    const especialColorida = carta.cor && carta.tipo !== 'numero';
    return (
      <div className={cn('relative shrink-0 select-none transition-opacity duration-200', apagada && 'opacity-45 saturate-[.7]', className)}
        style={{ width: tamanho, height: altura, borderRadius: r,
          boxShadow: jogavel ? '0 0 0 3px #fff, 0 10px 24px rgba(0,0,0,.5)' : '0 6px 16px rgba(0,0,0,.45)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={arquivo(carta)} alt={nomeCarta(carta)} draggable={false} className="w-full h-full" style={{ borderRadius: r }} />
        {/* Especial colorida: selo da cor no canto (dá para ver mesmo com a carta pequena) */}
        {especialColorida && (
          <span className="absolute rounded-full" style={{
            top: tamanho * 0.045, left: tamanho * 0.045, width: tamanho * 0.2, height: tamanho * 0.2,
            background: COR_HEX[carta.cor!].base, border: `${Math.max(2, tamanho * 0.025)}px solid #0a0713`,
            boxShadow: `0 0 ${tamanho * 0.08}px ${COR_HEX[carta.cor!].base}`,
          }} />
        )}
        {/* Curinga na mesa: mostra a cor escolhida */}
        {!carta.cor && corEscolhida && (
          <span className="absolute inset-x-[12%] bottom-[3%] rounded-full" style={{ height: tamanho * 0.07, background: COR_HEX[corEscolhida].base, boxShadow: `0 0 ${tamanho * 0.1}px ${COR_HEX[corEscolhida].base}` }} />
        )}
      </div>
    );
  }

  const fundo = preta
    ? 'radial-gradient(circle at 30% 20%, #2a1d44, #0a0713 70%)'
    : `linear-gradient(150deg, ${cor!.claro} -30%, ${cor!.base} 45%, ${cor!.escuro} 130%)`;

  return (
    <div
      role="img"
      aria-label={nomeCarta(carta)}
      className={cn('relative shrink-0 select-none text-white font-black overflow-hidden transition-[filter] duration-200',
        apagada && 'opacity-45 saturate-[.7]', className)}
      style={{
        width: tamanho, height: altura, borderRadius: raio, background: fundo,
        border: `${Math.max(2, Math.round(tamanho * 0.045))}px solid #0a0713`,
        boxShadow: jogavel ? '0 0 0 3px #fff, 0 12px 26px rgba(0,0,0,.5)' : '0 6px 16px rgba(0,0,0,.45)',
      }}
    >
      {/* Faixa diagonal da identidade Nexus */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(115deg, transparent 38%, rgba(255,255,255,.14) 50%, transparent 62%)' }} />
      {/* Cantos */}
      <span className="absolute flex items-center justify-center" style={{ top: tamanho * 0.05, left: tamanho * 0.08, fontSize: tamanho * 0.2, width: tamanho * 0.22, height: tamanho * 0.24 }}>
        <Simbolo c={carta} />
      </span>
      <span className="absolute flex items-center justify-center rotate-180" style={{ bottom: tamanho * 0.05, right: tamanho * 0.08, fontSize: tamanho * 0.2, width: tamanho * 0.22, height: tamanho * 0.24 }}>
        <Simbolo c={carta} />
      </span>
      {/* Centro */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center justify-center rounded-full"
          style={{
            width: tamanho * 0.72, height: tamanho * 0.72, fontSize: tamanho * 0.36,
            background: preta ? 'conic-gradient(#FF6A00 0 25%, #7A2CFF 0 50%, #C9C9D1 0 75%, #F2C35B 0)' : '#0a0713',
            color: preta ? '#fff' : cor!.claro,
            boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.12)',
          }}>
          <span className="flex items-center justify-center w-full h-full rounded-full"
            style={preta ? { background: 'rgba(10,7,19,.55)', margin: tamanho * 0.06 } : undefined}>
            <Simbolo c={carta} grande />
          </span>
        </div>
      </div>
      {/* Cor escolhida no curinga */}
      {preta && corEscolhida && (
        <div className="absolute inset-x-0 bottom-0" style={{ height: tamanho * 0.12, background: COR_HEX[corEscolhida].base }} />
      )}
    </div>
  );
}

// Verso da carta (monte e cartas dos outros)
export function CartaVerso({ tamanho = 84, className }: { tamanho?: number; className?: string }) {
  const altura = Math.round(tamanho * 1.5);
  const raio = Math.round(tamanho * 0.12);
  if (ARTE_PERSONALIZADA) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/unidos/cartas/verso.webp" alt="" draggable={false} className={cn('select-none shrink-0', className)} style={{ width: tamanho, height: altura, borderRadius: Math.round(tamanho * 0.075), boxShadow: '0 6px 16px rgba(0,0,0,.45)' }} />;
  }
  return (
    <div className={cn('relative shrink-0 select-none overflow-hidden', className)}
      style={{
        width: tamanho, height: altura, borderRadius: raio,
        background: 'radial-gradient(circle at 50% 40%, #3a1a6e, #120a22 70%)',
        border: `${Math.max(2, Math.round(tamanho * 0.045))}px solid #0a0713`,
        boxShadow: '0 6px 16px rgba(0,0,0,.45)',
      }}>
      <div className="absolute inset-[8%] rounded-[10%] border border-[#7a2cff]/50" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black leading-none bg-clip-text text-transparent"
          style={{ fontSize: tamanho * 0.42, backgroundImage: 'linear-gradient(135deg,#ff6a00,#b142f5)' }}>N</span>
        {tamanho >= 60 && (
          <span className="font-extrabold tracking-[0.18em] text-white/80 mt-1" style={{ fontSize: tamanho * 0.11 }}>UNidos</span>
        )}
      </div>
    </div>
  );
}

// As duas faces de uma carta para virar em 3D: coloque dentro de um elemento
// com transformStyle 'preserve-3d' e gire esse elemento no eixo Y
// (0° = frente, 180° = verso).
export function FacesCarta({ carta, tamanho, corEscolhida, jogavel, apagada }: {
  carta: Carta; tamanho: number; corEscolhida?: Cor | null; jogavel?: boolean; apagada?: boolean;
}) {
  const esconder = { backfaceVisibility: 'hidden' as const, WebkitBackfaceVisibility: 'hidden' as const };
  return (
    <>
      <div style={esconder}><CartaView carta={carta} tamanho={tamanho} corEscolhida={corEscolhida} jogavel={jogavel} apagada={apagada} /></div>
      <div className="absolute inset-0" style={{ ...esconder, transform: 'rotateY(180deg)' }}><CartaVerso tamanho={tamanho} /></div>
    </>
  );
}
