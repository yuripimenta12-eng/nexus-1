'use client';

import { useMemo, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartaVerso, CartaView, COR_HEX, FacesCarta, IconeCor } from '../carta';
import type { Carta, Cor } from '../unidos.store';
import type { ModoEfeitos } from '../efeitos/config';
import { origensJogada, pontoJogador } from '../efeitos/posicoes';

const SUAVE = [0.22, 1, 0.36, 1] as const;

// Giro "bagunçado" de cada carta na pilha, sempre o mesmo para a mesma carta
function giroDe(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return { rot: ((h % 2400) / 100) - 12, x: ((h >> 4) % 9) - 4, y: ((h >> 8) % 7) - 3 };
}

export function Monte({ tamanho, pode, acumulado, total, onComprar }: {
  tamanho: number; pode: boolean; acumulado: number; total: number; onComprar: () => void;
}) {
  return (
    <motion.button
      type="button"
      data-unidos-alvo="monte"
      onClick={onComprar}
      disabled={!pode}
      whileHover={pode ? { y: -6, rotate: -2 } : undefined}
      whileTap={pode ? { scale: 0.96 } : undefined}
      className={cn('relative rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white', pode ? 'cursor-pointer' : 'cursor-default')}
      aria-label={pode ? (acumulado ? `Comprar ${acumulado} cartas` : 'Comprar uma carta') : `Monte com ${total} cartas`}
      title={pode ? (acumulado ? `Comprar ${acumulado}` : 'Comprar uma carta') : `${total} cartas no monte`}
    >
      <div className="absolute top-1.5 left-1.5 opacity-70"><CartaVerso tamanho={tamanho} /></div>
      <div className="absolute top-[3px] left-[3px] opacity-90"><CartaVerso tamanho={tamanho} /></div>
      <div className="relative">
        <CartaVerso tamanho={tamanho} />
        {pode && <div className="absolute inset-0 rounded-[8px] unidos-holo opacity-60" style={{ borderRadius: tamanho * 0.075 }} />}
      </div>
      {pode && (
        <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className={cn('absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black px-2.5 py-1 rounded-full shadow-lg',
            acumulado ? 'bg-[#ed4245] text-white' : 'bg-white text-[#120a22]')}>
          {acumulado ? `Comprar ${acumulado}` : 'Comprar'}
        </motion.span>
      )}
    </motion.button>
  );
}

// Pilha de descarte: a carta nova voa de onde saiu (minha mão ou o avatar de
// quem jogou), gira em 3D, bate na pilha e a pilha dá uma balançada.
export function Pilha({ topo, corAtual, acumulado, tamanho, jogadorId, meuId, modo, arrasto, processando, onPouso }: {
  topo: Carta | null; corAtual: Cor | null; acumulado: number; tamanho: number;
  jogadorId: string | null; meuId: string; modo: ModoEfeitos;
  arrasto: 'nao' | 'arrastando' | 'sobre'; processando: boolean;
  onPouso: (c: Carta) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const balanco = useAnimationControls();
  const primeiro = useRef(true);

  // A de cima vira parte da pilha embaixo quando chega outra (no mesmo quadro,
  // para a carta antiga não sumir enquanto a nova ainda está voando)
  const [hist, setHist] = useState<{ topo: Carta | null; baixo: Carta[] }>({ topo, baixo: [] });
  const empilhar = (h: typeof hist) => (h.topo ? [...h.baixo.filter(x => x.id !== h.topo!.id), h.topo].slice(-3) : h.baixo);
  const mudou = (topo?.id ?? null) !== (hist.topo?.id ?? null);
  if (mudou) setHist({ topo, baixo: empilhar(hist) });
  const baixo = mudou ? empilhar(hist) : hist.baixo;

  // De onde a carta nova vem (calculado uma vez por carta)
  const entrada = useMemo(() => {
    if (!topo) return null;
    if (primeiro.current) { primeiro.current = false; return null; }
    const pilha = ref.current?.getBoundingClientRect();
    if (!pilha) return null;
    const cx = pilha.left + pilha.width / 2;
    const cy = pilha.top + pilha.height / 2;
    const minha = origensJogada.get(topo.id);
    if (minha) {
      origensJogada.delete(topo.id);
      const r = minha.rect;
      return { x: r.left + r.width / 2 - cx, y: r.top + r.height / 2 - cy, escala: r.width / tamanho, rot: minha.rot, virar: false };
    }
    const p = jogadorId && jogadorId !== meuId ? pontoJogador(jogadorId) : null;
    if (p) return { x: p.x - cx, y: p.y - cy, escala: 0.35, rot: -20, virar: true };
    return { x: 0, y: -120, escala: 0.6, rot: 0, virar: false };
  }, [topo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const especial = !!topo && topo.tipo !== 'numero';
  const giro = topo ? giroDe(topo.id) : { rot: 0, x: 0, y: 0 };
  const dur = !modo.movimento ? 0.01 : modo.reduzido ? 0.2 : especial ? 0.55 : 0.38;
  const corBrilho = corAtual ? COR_HEX[corAtual].base : '#7A2CFF';

  return (
    <div className="relative" style={{ perspective: 900 }}>
      {/* Brilho da cor atual (muda suave quando a cor troca) */}
      <div className="absolute -inset-6 rounded-[32px] blur-2xl opacity-55 transition-[background] duration-500" style={{ background: corBrilho }} />
      {/* Área de soltar: reage quando uma carta é arrastada */}
      <motion.div
        ref={ref}
        data-unidos-alvo="pilha"
        className="relative"
        style={{ width: tamanho, height: tamanho * 1.5 }}
        animate={{ scale: arrasto === 'sobre' ? 1.08 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        {arrasto !== 'nao' && (
          <div className={cn('absolute -inset-3 rounded-[18px] border-2 border-dashed transition-colors',
            arrasto === 'sobre' ? 'border-white bg-white/10' : 'border-white/40')} />
        )}
        <motion.div animate={balanco} className="absolute inset-0">
          {baixo.map(c => {
            const g = giroDe(c.id);
            return (
              <div key={c.id} className="absolute inset-0" style={{ transform: `translate(${g.x}px,${g.y}px) rotate(${g.rot}deg)` }}>
                <CartaView carta={c} tamanho={tamanho} />
              </div>
            );
          })}
        </motion.div>
        {topo && (
          <motion.div
            key={topo.id}
            className="absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
            initial={entrada ? { x: entrada.x, y: entrada.y, scale: entrada.escala, rotate: entrada.rot, rotateY: entrada.virar ? 180 : 0, rotateX: 0 } : false}
            animate={{
              x: giro.x, y: giro.y, rotate: giro.rot, rotateY: 0,
              scale: entrada && modo.movimento && !modo.reduzido ? [entrada.escala, 1.22, 1] : 1,
              rotateX: entrada && modo.movimento && !modo.reduzido ? [0, 28, 0] : 0,
            }}
            transition={{ duration: dur, ease: SUAVE }}
            onAnimationComplete={() => {
              if (!entrada) return;
              onPouso(topo);
              if (modo.movimento) balanco.start({ y: [0, 4, 0], rotate: [0, especial ? 2 : 1, 0], transition: { duration: 0.28 } });
            }}
          >
            <FacesCarta carta={topo} tamanho={tamanho} corEscolhida={corAtual} />
          </motion.div>
        )}
      </motion.div>
      {acumulado > 0 && (
        <motion.span key={acumulado} initial={{ scale: 1.6 }} animate={{ scale: 1 }}
          className="absolute -top-3 -right-4 text-[14px] font-black px-2.5 py-1 rounded-full bg-[#ed4245] text-white shadow-lg z-10">
          +{acumulado}
        </motion.span>
      )}
      {/* Cor atual com símbolo (não depende só da cor) */}
      {corAtual && (
        <motion.div key={corAtual} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold px-2.5 py-1 rounded-full bg-black/45 border border-white/10">
          <span className="w-3.5 h-3.5 rounded-full grid place-items-center" style={{ background: COR_HEX[corAtual].base }}>
            <IconeCor cor={corAtual} className="w-2.5 h-2.5" style={{ color: corAtual === 'prata' || corAtual === 'dourado' ? '#1a1406' : '#fff' }} />
          </span>
          {COR_HEX[corAtual].nome}
        </motion.div>
      )}
      {processando && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white/90 whitespace-nowrap">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Processando…
        </span>
      )}
    </div>
  );
}
