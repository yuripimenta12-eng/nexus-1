'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Hand, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartaView, COR_HEX, IconeCor } from '../carta';
import type { Carta, Cor, JogadorVisao } from '../unidos.store';
import { audio } from '../efeitos/audio';
import { particulas, PALETAS } from '../efeitos/particulas';
import { Avatar } from './jogadores';

const CORES = Object.keys(COR_HEX) as Cor[];
const textoEscuro = (c: Cor) => c === 'prata' || c === 'dourado';

// Seletor circular de cor (Conexão / Todos Unidos). Mostra a carta com a cor
// em prévia; só fecha quando o servidor confirmar a jogada.
export function SeletorCor({ carta, aoEscolher, aoCancelar }: {
  carta: Carta; aoEscolher: (cor: Cor) => Promise<boolean>; aoCancelar: () => void;
}) {
  const [previa, setPrevia] = useState<Cor | null>(null);
  const [enviando, setEnviando] = useState<Cor | null>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const raio = 104;

  useEffect(() => { botoes.current[0]?.focus(); }, []);

  const escolher = async (cor: Cor, el: HTMLElement | null) => {
    if (enviando) return;
    setEnviando(cor);
    setPrevia(cor);
    audio.tocar('escolherCor');
    if (el) particulas.noRect(el.getBoundingClientRect(), { cores: [COR_HEX[cor].base, COR_HEX[cor].claro, ...PALETAS.multicor.slice(0, 2)], qtd: 30, velocidade: 280, vida: 0.7 });
    const ok = await aoEscolher(cor);
    if (!ok) setEnviando(null);
  };

  const onTecla = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !enviando) { e.preventDefault(); aoCancelar(); return; }
    const i = botoes.current.findIndex(b => b === document.activeElement);
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); botoes.current[(i + 1) % 4]?.focus(); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); botoes.current[(i + 3) % 4]?.focus(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 4) escolher(CORES[n - 1], botoes.current[n - 1]);
  };

  const cor = previa ? COR_HEX[previa].base : '#7A2CFF';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[50] bg-black/60 flex items-center justify-center p-4"
      onClick={() => !enviando && aoCancelar()} onKeyDown={onTecla}
      role="dialog" aria-modal="true" aria-label="Escolha a nova cor">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={e => e.stopPropagation()} className="relative flex flex-col items-center">
        <p className="font-black text-lg mb-3 text-center">Escolha a cor <span className="block text-[12px] font-semibold text-[#a99cb8]">teclas 1–4 ou setas · Esc cancela</span></p>
        <div className="relative" style={{ width: raio * 2 + 96, height: raio * 2 + 96 }}>
          {/* Fundo com a cor em prévia */}
          <motion.div className="absolute inset-[18%] rounded-full blur-2xl" animate={{ background: cor, opacity: previa ? 0.7 : 0.35 }} transition={{ duration: 0.25 }} />
          <div className="absolute inset-[14%] rounded-full border border-white/10" />
          {/* Carta no meio com a cor escolhida */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div animate={{ rotate: previa ? [0, -3, 3, 0] : 0 }} transition={{ duration: 0.3 }} className="relative">
              <CartaView carta={carta} tamanho={88} corEscolhida={previa} />
              {enviando && (
                <span className="absolute inset-0 grid place-items-center rounded-[8px] bg-black/40" aria-label="Confirmando">
                  <Loader2 className="w-7 h-7 animate-spin text-white" />
                </span>
              )}
            </motion.div>
          </div>
          {CORES.map((c, i) => {
            const ang = -Math.PI / 2 + (i * Math.PI) / 2;
            const x = Math.cos(ang) * raio;
            const y = Math.sin(ang) * raio;
            const ativo = previa === c;
            return (
              <motion.button key={c} ref={el => { botoes.current[i] = el; }}
                type="button"
                onClick={e => escolher(c, e.currentTarget)}
                onMouseEnter={() => !enviando && setPrevia(c)}
                onFocus={() => !enviando && setPrevia(c)}
                disabled={!!enviando && enviando !== c}
                whileHover={{ scale: 1.14 }} whileTap={{ scale: 0.95 }}
                animate={{ scale: ativo ? 1.12 : 1 }}
                className={cn('absolute w-[84px] h-[84px] -ml-[42px] -mt-[42px] rounded-full font-black text-[12px] flex flex-col items-center justify-center gap-0.5 border-[3px] transition-[box-shadow,border-color] disabled:opacity-40',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white',
                  ativo ? 'border-white' : 'border-black/40')}
                style={{
                  left: '50%', top: '50%', x, y,
                  background: `radial-gradient(circle at 35% 30%, ${COR_HEX[c].claro}, ${COR_HEX[c].base} 55%, ${COR_HEX[c].escuro})`,
                  color: textoEscuro(c) ? '#1a1406' : '#fff',
                  boxShadow: ativo ? `0 0 30px 6px ${COR_HEX[c].base}` : `0 8px 18px rgba(0,0,0,.45)`,
                }}
                aria-label={`${COR_HEX[c].nome} (tecla ${i + 1})`}
              >
                <IconeCor cor={c} className="w-5 h-5" />
                {COR_HEX[c].nome}
              </motion.button>
            );
          })}
        </div>
        <button type="button" onClick={aoCancelar} disabled={!!enviando}
          className="mt-1 h-9 px-4 rounded-full text-[13px] font-bold bg-white/10 hover:bg-white/15 disabled:opacity-40 flex items-center gap-1.5">
          <X className="w-4 h-4" /> Cancelar
        </button>
      </motion.div>
    </motion.div>
  );
}

// Call: escolher quem joga agora
export function SeletorAlvo({ jogadores, aoEscolher, aoCancelar }: {
  jogadores: JogadorVisao[]; aoEscolher: (id: string) => Promise<boolean>; aoCancelar: () => void;
}) {
  const [enviando, setEnviando] = useState<string | null>(null);
  const primeiro = useRef<HTMLButtonElement>(null);
  useEffect(() => { primeiro.current?.focus(); }, []);
  const escolher = async (id: string, el: HTMLElement) => {
    if (enviando) return;
    setEnviando(id);
    audio.tocar('selecionar');
    particulas.noRect(el.getBoundingClientRect(), { cores: PALETAS.especial, qtd: 20, velocidade: 220, vida: 0.6 });
    const ok = await aoEscolher(id);
    if (!ok) setEnviando(null);
  };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-[50] bg-black/60 flex items-center justify-center p-4"
      onClick={() => !enviando && aoCancelar()}
      onKeyDown={e => { if (e.key === 'Escape' && !enviando) aoCancelar(); }}
      role="dialog" aria-modal="true" aria-label="Quem joga agora?">
      <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
        className="rounded-3xl border border-[#A56BFF]/30 p-5 w-full max-w-sm bg-[#140d22] shadow-[0_0_40px_rgba(122,44,255,.25)]">
        <p className="font-black text-lg mb-1 text-center">Quem joga agora?</p>
        <p className="text-[12.5px] text-[#a99cb8] mb-4 text-center">A vez pula direto para a pessoa que você escolher.</p>
        <div className="space-y-2">
          {jogadores.map((j, i) => (
            <button key={j.id} ref={i === 0 ? primeiro : undefined} type="button"
              onClick={e => escolher(j.id, e.currentTarget)} disabled={!!enviando}
              className={cn('w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-colors disabled:opacity-50',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#A56BFF]',
                enviando === j.id ? 'bg-[#7A2CFF]/30' : 'bg-white/[0.04] hover:bg-white/[0.09]')}>
              <Avatar j={j} tamanho={38} />
              <span className="flex-1 font-semibold truncate">{j.nome}</span>
              {enviando === j.id ? <Loader2 className="w-4 h-4 animate-spin" />
                : <span className="text-[13px] font-black text-[#cbb3ff] flex items-center gap-1"><Hand className="w-3.5 h-3.5" aria-hidden /> {j.cartas}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={aoCancelar} disabled={!!enviando}
          className="mt-3 w-full h-9 rounded-full text-[13px] font-bold bg-white/10 hover:bg-white/15 disabled:opacity-40">Cancelar</button>
      </motion.div>
    </motion.div>
  );
}
