'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUnidos } from './unidos.store';
import { UnidosMesa } from './unidos-mesa';

// Vive no layout do app: liga o UNidos à chamada em que a pessoa está
// (de servidor; chamada 1:1 da DM não tem mesa) e mostra o atalho para
// voltar à partida quando a janela do jogo está minimizada.
export function UnidosHost() {
  const isConnected = useVoiceStore(s => s.isConnected);
  const voiceRoomId = useVoiceStore(s => s.voiceRoomId);
  const sala = isConnected && voiceRoomId && !voiceRoomId.startsWith('dm:') ? voiceRoomId : null;
  const { partida, aberta, setAberta } = useUnidos();
  const meuId = useAuthStore(s => s.user?.id);
  const salaAnterior = useRef<string | null>(null);

  useEffect(() => {
    // Saiu da chamada (ou trocou de sala) no meio da partida: sai da mesa
    if (salaAnterior.current && salaAnterior.current !== sala && useUnidos.getState().partida) {
      useUnidos.getState().sair();
    }
    salaAnterior.current = sala;
    if (!sala) return;
    return useUnidos.getState().ouvir(sala);
  }, [sala]);

  const minhaVez = partida?.status === 'jogando' && partida.vezId === meuId;

  return (
    <>
      <AnimatePresence>{aberta && partida && <UnidosMesa key="mesa" />}</AnimatePresence>
      <AnimatePresence>
        {partida && !aberta && (
          <motion.button
            key="voltar"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            onClick={() => setAberta(true)}
            className="fixed z-[60] left-3 sm:left-auto sm:right-5 bottom-[calc(env(safe-area-inset-bottom)+84px)] sm:bottom-24
                       h-11 px-4 rounded-full font-black text-[13px] text-white flex items-center gap-2 shadow-2xl border border-white/10"
            style={{ background: minhaVez ? 'linear-gradient(135deg,#ff6a00,#7a2cff)' : 'rgba(30,22,48,0.96)' }}
            title="Voltar para a mesa de UNidos"
          >
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#ffb27d] to-[#cbb3ff]">UN</span>idos
            <span className="font-semibold text-white/80">
              {partida.status === 'lobby' ? '· esperando' : partida.status === 'fim' ? '· fim de jogo' : minhaVez ? '· sua vez!' : '· voltar'}
            </span>
            {minhaVez && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
