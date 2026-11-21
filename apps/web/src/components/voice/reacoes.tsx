'use client';

// Reações na call: emojis que voam do quadro de quem mandou e "piscada"
// (o quadro do amigo treme e, na tela dele, a call inteira chacoalha com um som).
// Tudo passa pelo canal de dados do LiveKit: não toca o servidor do Nexus.

import { useEffect } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client';
import { Zap } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { usePrefsStore } from '@/stores/prefs.store';
import { playPiscada } from '@/lib/sounds';
import { cn } from '@/lib/utils';

export const EMOJIS_REACAO = ['😂', '🔥', '💀', '👏', '😮', '❤️', '😡', '🎉'];
const TOPICO_REACAO = 'nx-reacao';
const TOPICO_PISCADA = 'nx-piscada';
const ESPERA_PISCADA_MS = 6000;     // quem pisca espera isso entre uma e outra
const MAX_REACOES = 6;              // por pessoa a cada 4 s (o resto é ignorado)

interface Voo { id: number; identity: string; emoji: string; x: number }
interface ReacoesState {
  voos: Voo[];
  piscadas: Record<string, number>;           // identity → quando o quadro deve tremer
  aviso: { nome: string; em: number } | null; // "Fulano piscou pra você"
  ultimaPiscadaEnviada: number;
}

export const useReacoes = create<ReacoesState>(() => ({
  voos: [], piscadas: {}, aviso: null, ultimaPiscadaEnviada: 0,
}));

let seq = 0;
function voar(identity: string, emoji: string) {
  const v: Voo = { id: ++seq, identity, emoji, x: 18 + Math.random() * 64 };
  useReacoes.setState(s => ({ voos: [...s.voos.slice(-30), v] }));
  setTimeout(() => useReacoes.setState(s => ({ voos: s.voos.filter(x => x.id !== v.id) })), 1800);
}
function tremer(identity: string) {
  useReacoes.setState(s => ({ piscadas: { ...s.piscadas, [identity]: Date.now() } }));
}

const sala = (): Room | null => useVoiceStore.getState().room;
const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

export function enviarReacao(emoji: string) {
  const room = sala();
  if (!room || !EMOJIS_REACAO.includes(emoji)) return;
  voar(room.localParticipant.identity, emoji);
  room.localParticipant.publishData(enc({ e: emoji }), { reliable: false, topic: TOPICO_REACAO }).catch(() => {});
}

/** Pisca para alguém. Devolve false se ainda está no intervalo de espera. */
export function enviarPiscada(alvo: string): boolean {
  const room = sala();
  if (!room || alvo === room.localParticipant.identity) return false;
  const agora = Date.now();
  if (agora - useReacoes.getState().ultimaPiscadaEnviada < ESPERA_PISCADA_MS) return false;
  useReacoes.setState({ ultimaPiscadaEnviada: agora });
  tremer(alvo);
  room.localParticipant.publishData(enc({ alvo }), { reliable: true, topic: TOPICO_PISCADA }).catch(() => {});
  return true;
}

// Teto do que chega de cada pessoa: ninguém trava a call dos outros com spam
const recebidas = new Map<string, number[]>();
function dentroDoLimite(chave: string, max: number, janelaMs: number) {
  const agora = Date.now();
  const lista = (recebidas.get(chave) || []).filter(t => agora - t < janelaMs);
  if (lista.length >= max) { recebidas.set(chave, lista); return false; }
  lista.push(agora);
  recebidas.set(chave, lista);
  return true;
}

/** Liga a escuta das reações enquanto a página da call está aberta. */
export function useEscutarReacoes() {
  const room = useVoiceStore(s => s.room);
  useEffect(() => {
    if (!room) return;
    const onData = (payload: Uint8Array, p?: RemoteParticipant, _k?: unknown, topic?: string) => {
      if (!p || (topic !== TOPICO_REACAO && topic !== TOPICO_PISCADA)) return;
      let msg: any;
      try { msg = JSON.parse(new TextDecoder().decode(payload)); } catch { return; }
      if (topic === TOPICO_REACAO) {
        if (typeof msg?.e !== 'string' || !EMOJIS_REACAO.includes(msg.e)) return;
        if (!dentroDoLimite('r:' + p.identity, MAX_REACOES, 4000)) return;
        voar(p.identity, msg.e);
        return;
      }
      const alvo = msg?.alvo;
      if (typeof alvo !== 'string' || alvo.length > 64) return;
      if (!dentroDoLimite('p:' + p.identity, 1, ESPERA_PISCADA_MS - 500)) return;
      const eu = room.localParticipant.identity;
      if (alvo !== eu && !room.remoteParticipants.has(alvo)) return;
      tremer(alvo);
      if (alvo === eu && usePrefsStore.getState().receberPiscadas) {
        useReacoes.setState({ aviso: { nome: p.name || 'Alguém', em: Date.now() } });
        try { playPiscada(); } catch { /* sem áudio liberado */ }
        const palco = document.querySelector('[data-nx-palco]');
        palco?.classList.remove('nx-chacoalha');
        void (palco as HTMLElement | null)?.offsetWidth;
        palco?.classList.add('nx-chacoalha');
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => { room.off(RoomEvent.DataReceived, onData); };
  }, [room]);
}

/** Emojis voando por cima do quadro de uma pessoa ("*" = de todos, por cima da live). */
export function VoosDoQuadro({ identity }: { identity: string }) {
  const voos = useReacoes(useShallow(s => s.voos.filter(v => identity === '*' || v.identity === identity)));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <AnimatePresence>
        {voos.map(v => (
          <motion.span
            key={v.id}
            className="absolute bottom-10 text-[34px] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            style={{ left: `${v.x}%` }}
            initial={{ y: 0, opacity: 0, scale: 0.5 }}
            animate={{ y: -150, opacity: [0, 1, 1, 0], scale: [0.5, 1.25, 1, 0.9], rotate: [0, -8, 8, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
          >
            {v.emoji}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Envolve o quadro: treme quando alguém pisca para essa pessoa. */
export function QuadroTremendo({ identity, children }: { identity: string; children: React.ReactNode }) {
  const quando = useReacoes(s => s.piscadas[identity]);
  const controles = useAnimationControls();
  useEffect(() => {
    if (!quando) return;
    controles.start({ x: [0, -9, 9, -7, 7, -4, 4, 0], rotate: [0, -1.2, 1.2, -1, 1, 0, 0, 0], transition: { duration: 0.55 } });
  }, [quando, controles]);
  return <motion.div animate={controles} className="h-full">{children}</motion.div>;
}

/** Botão que aparece no quadro de outra pessoa (ao passar o mouse; no celular, sempre). */
export function BotaoPiscar({ identity, nome }: { identity: string; nome: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); enviarPiscada(identity); }}
      title={`Piscar para ${nome}`}
      aria-label={`Piscar para ${nome}`}
      className={cn(
        'absolute left-3 top-3 z-20 h-8 px-2.5 rounded-[10px] flex items-center gap-1.5 text-[11px] font-black',
        'bg-black/45 backdrop-blur border border-white/10 text-[#ffd27a] transition-all',
        'opacity-0 group-hover/quadro:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
        'hover:border-[#ff8a3d] hover:text-white',
      )}
    >
      <Zap className="w-3.5 h-3.5" /> Piscar
    </button>
  );
}

/** Bandeja de emojis que abre acima do botão de reações. */
export function PainelReacoes({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  // fixed: a barra de controles rola na horizontal e cortaria um popover absoluto
  return (
    <>
    <div className="fixed inset-0 z-40" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed bottom-[96px] inset-x-0 mx-auto z-50 p-2 rounded-2xl border border-[#4d3560]
                 bg-[#160f20]/95 backdrop-blur shadow-[0_18px_40px_rgba(0,0,0,0.55)] grid grid-cols-4 gap-1 w-[204px]"
      role="menu"
      aria-label="Reações"
    >
      {EMOJIS_REACAO.map(e => (
        <button
          key={e}
          role="menuitem"
          onClick={() => enviarReacao(e)}
          className="h-11 rounded-xl text-[24px] hover:bg-white/10 active:scale-90 transition-transform"
          aria-label={`Reagir com ${e}`}
        >
          {e}
        </button>
      ))}
    </motion.div>
    </>
  );
}

/** Aviso flutuante "Fulano piscou pra você". */
export function AvisoPiscada() {
  const aviso = useReacoes(s => s.aviso);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => useReacoes.setState({ aviso: null }), 2600);
    return () => clearTimeout(t);
  }, [aviso]);
  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.em}
          initial={{ opacity: 0, y: -12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute top-20 inset-x-0 mx-auto w-max z-40 px-4 py-2 rounded-full text-sm font-black text-white
                     border border-[#ff8a3d]/60 shadow-[0_10px_30px_rgba(255,106,0,0.25)]"
          style={{ background: 'linear-gradient(90deg, #ff6a00, #7a2cff)' }}
          role="status"
        >
          ⚡ {aviso.nome} piscou pra você
        </motion.div>
      )}
    </AnimatePresence>
  );
}
