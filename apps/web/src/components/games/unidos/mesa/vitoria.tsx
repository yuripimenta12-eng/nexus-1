'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Crown, Loader2, LogOut, Play, Undo2 } from 'lucide-react';
import type { JogadorVisao } from '../unidos.store';
import { Avatar } from './jogadores';

function tempo(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Fim de partida: aparece depois que a última carta bate na mesa. Não trava
// a tela: dá para recolher e olhar a mesa, e os botões do topo seguem ativos.
export function PainelFim({ vencedor, meuId, pontos, duracao, souHost, hostNome, enviando, atraso, onRevanche, onVoltar, onSair }: {
  vencedor: JogadorVisao | undefined; meuId: string; pontos: number; duracao: number;
  souHost: boolean; hostNome: string; enviando: boolean; atraso: number;
  onRevanche: () => void; onVoltar: () => void; onSair: () => void;
}) {
  const [visivel, setVisivel] = useState(atraso <= 0);
  const [recolhido, setRecolhido] = useState(false);
  useEffect(() => {
    if (atraso <= 0) return;
    const t = setTimeout(() => setVisivel(true), atraso);
    return () => clearTimeout(t);
  }, [atraso]);
  if (!visivel) return null;
  const venci = vencedor?.id === meuId;

  if (recolhido) {
    return (
      <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={() => setRecolhido(false)}
        className="absolute z-[45] bottom-4 inset-x-0 mx-auto w-max h-11 px-4 rounded-full font-black text-[13px] flex items-center gap-2 bg-[#2a1550] border border-[#F2C35B]/40 shadow-xl">
        <Crown className="w-4 h-4 text-[#F2C35B]" /> {venci ? 'Você venceu!' : `${vencedor?.nome || 'Fim'} venceu`} <ChevronUp className="w-4 h-4" />
      </motion.button>
    );
  }

  return (
    <div className="absolute inset-0 z-[45] pointer-events-none flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="pointer-events-auto relative w-full max-w-sm rounded-3xl border border-[#F2C35B]/30 p-6 pt-16 text-center shadow-[0_0_60px_rgba(242,195,91,.25)]"
        style={{ background: 'linear-gradient(160deg,#2a1550,#120a22)' }}
        role="dialog" aria-label={venci ? 'Vitória' : 'Fim de partida'}>
        {/* Mascotes comemorando (arte do Todos Unidos) */}
        <motion.div className="absolute left-1/2 -top-16 -translate-x-1/2 w-32 h-32 rounded-full overflow-hidden border-4 border-[#F2C35B] shadow-[0_0_30px_#F2C35B]"
          animate={{ y: [0, -8, 0], rotate: [0, -3, 3, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/unidos/cartas/todos-unidos.webp" alt="" className="w-full h-full object-cover scale-[1.7]" style={{ objectPosition: '50% 46%' }} draggable={false} />
        </motion.div>
        <button onClick={() => setRecolhido(true)} title="Recolher para ver a mesa"
          className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10">
          <ChevronDown className="w-4 h-4" />
        </button>
        <motion.h3 initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, 1.12, 1], opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="text-[34px] font-black italic tracking-wide leading-none"
          style={{ color: '#fff', textShadow: venci ? '0 0 18px #F2C35B, 0 3px 0 #0a0713' : '0 0 14px #7A2CFF, 0 3px 0 #0a0713' }}>
          {venci ? 'VITÓRIA!' : 'FIM DE JOGO'}
        </motion.h3>
        {vencedor && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="relative">
              <div className="rounded-full p-[3px] bg-gradient-to-br from-[#F2C35B] to-[#FF6A00] shadow-[0_0_24px_rgba(242,195,91,.6)]"><Avatar j={vencedor} tamanho={58} /></div>
              <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 text-[#F2C35B]" />
            </div>
            <p className="font-black text-[17px]">{venci ? 'Você zerou a mão primeiro!' : `${vencedor.nome} venceu!`}</p>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.06] py-2">
            <p className="text-[11px] text-[#a99cb8] font-semibold">Pontos</p>
            <p className="text-[20px] font-black text-[#F2C35B] tabular-nums">{pontos}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.05] border border-white/[0.06] py-2">
            <p className="text-[11px] text-[#a99cb8] font-semibold">Duração</p>
            <p className="text-[20px] font-black tabular-nums">{duracao ? tempo(duracao) : '—'}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-5">
          {souHost ? (
            <button onClick={onRevanche} disabled={enviando}
              className="h-12 rounded-2xl font-black tracking-wide flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} JOGAR NOVAMENTE
            </button>
          ) : (
            <div className="h-12 rounded-2xl font-bold text-[13px] text-[#a99cb8] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center gap-2" aria-live="polite">
              <Loader2 className="w-4 h-4 animate-spin" /> Esperando {hostNome} começar outra
            </div>
          )}
          <button onClick={onVoltar}
            className="h-11 rounded-2xl font-black tracking-wide bg-white/10 hover:bg-white/15 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            <Undo2 className="w-4 h-4" /> VOLTAR PARA A SALA
          </button>
          <button onClick={onSair} className="h-8 text-[12px] font-semibold text-[#ff8098] hover:underline flex items-center justify-center gap-1">
            <LogOut className="w-3.5 h-3.5" /> Sair da mesa
          </button>
        </div>
      </motion.div>
    </div>
  );
}
