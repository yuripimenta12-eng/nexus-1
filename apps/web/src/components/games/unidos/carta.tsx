'use client';

import { MicOff, Repeat2, Shuffle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Carta, Cor } from './unidos.store';

// Quando as artes oficiais chegarem (public/unidos/cartas/*.png), basta
// colocar true aqui: cada carta passa a usar a imagem com o nome combinado
// (laranja-7.png, roxo-mutado.png, portal.png, verso.png...).
export const ARTE_PERSONALIZADA = false;

export const COR_HEX: Record<Cor, { base: string; claro: string; escuro: string; nome: string }> = {
  laranja: { base: '#FF6A00', claro: '#FFB27D', escuro: '#9C3D00', nome: 'Laranja' },
  roxo: { base: '#7A2CFF', claro: '#CBB3FF', escuro: '#3F1291', nome: 'Roxo' },
  ciano: { base: '#0EA5C6', claro: '#8EE6F7', escuro: '#075E72', nome: 'Ciano' },
  verde: { base: '#1FB57A', claro: '#8DF0C4', escuro: '#0D6343', nome: 'Verde' },
};

export const NOME_TIPO: Record<Carta['tipo'], string> = {
  numero: 'Número', mutado: 'Mutado', eco: 'Eco', mais2: 'Ping +2', troca: 'Troca', portal: 'Portal', tempestade: 'Tempestade +4',
};

export function nomeCarta(c: Carta) {
  if (c.tipo === 'numero') return `${c.valor} ${COR_HEX[c.cor!].nome.toLowerCase()}`;
  if (!c.cor) return NOME_TIPO[c.tipo];
  return `${NOME_TIPO[c.tipo]} ${COR_HEX[c.cor].nome.toLowerCase()}`;
}

function arquivo(c: Carta) {
  if (c.tipo === 'portal' || c.tipo === 'tempestade') return `/unidos/cartas/${c.tipo}.png`;
  const sufixo = c.tipo === 'numero' ? String(c.valor) : c.tipo;
  return `/unidos/cartas/${c.cor}-${sufixo}.png`;
}

function Simbolo({ c, grande }: { c: Carta; grande?: boolean }) {
  const tam = grande ? 'w-[46%] h-[46%]' : 'w-[60%] h-[60%]';
  switch (c.tipo) {
    case 'numero': return <span className="leading-none">{c.valor}</span>;
    case 'mutado': return <MicOff className={tam} strokeWidth={2.6} />;
    case 'eco': return <Repeat2 className={tam} strokeWidth={2.6} />;
    case 'troca': return <Shuffle className={tam} strokeWidth={2.6} />;
    case 'mais2': return <span className="leading-none">+2</span>;
    case 'tempestade': return <span className="leading-none">+4</span>;
    case 'portal': return <Zap className={tam} strokeWidth={2.6} />;
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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={arquivo(carta)} alt={nomeCarta(carta)} draggable={false}
        className={cn('select-none', apagada && 'opacity-45 saturate-[.7]', className)}
        style={{ width: tamanho, height: altura, borderRadius: raio,
          boxShadow: jogavel ? '0 0 0 3px #fff, 0 10px 24px rgba(0,0,0,.45)' : '0 6px 16px rgba(0,0,0,.4)' }} />
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
            background: preta ? 'conic-gradient(#FF6A00 0 25%, #7A2CFF 0 50%, #0EA5C6 0 75%, #1FB57A 0)' : '#0a0713',
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
    return <img src="/unidos/cartas/verso.png" alt="" draggable={false} className={cn('select-none', className)} style={{ width: tamanho, height: altura, borderRadius: raio }} />;
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
