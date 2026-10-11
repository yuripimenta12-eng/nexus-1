'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { useUnidos } from './unidos.store';
import { UnidosMesa } from './unidos-mesa';

// Vive no layout do app: liga o UNidos à chamada em que a pessoa está
// (sala de voz do servidor ou chamada direta da DM) e mostra o atalho para
// voltar à partida quando a janela do jogo está minimizada.
export function UnidosHost() {
  const isConnected = useVoiceStore(s => s.isConnected);
  const voiceRoomId = useVoiceStore(s => s.voiceRoomId);
  const meuId = useAuthStore(s => s.user?.id);
  // Chamada direta da DM ("dm:<parceiro>") vira a chave da dupla, com os ids em ordem
  const sala = !isConnected || !voiceRoomId ? null
    : voiceRoomId.startsWith('dm:')
      ? (meuId ? 'dm:' + [meuId, voiceRoomId.slice(3)].sort().join(':') : null)
      : voiceRoomId;
  const { partida, aberta, setAberta, erro, limparErro } = useUnidos();

  // Erro com a mesa fechada (ex.: abrir pela chamada da DM): aviso curto na tela.
  // Na sala de voz do servidor a própria página já mostra; aqui cobre o resto.
  const naPaginaDaSala = typeof window !== 'undefined' && window.location.pathname.includes('/voice/');
  useEffect(() => {
    if (!erro || aberta || naPaginaDaSala) return;
    const t = setTimeout(limparErro, 4000);
    return () => clearTimeout(t);
  }, [erro, aberta, naPaginaDaSala, limparErro]);
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
        {erro && !aberta && !naPaginaDaSala && (
          <motion.div key="erro" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed z-[70] top-[calc(env(safe-area-inset-top)+14px)] inset-x-0 mx-auto w-max max-w-[90vw] px-4 py-2.5 rounded-xl text-sm bg-[#3a1220] border border-[#ed4245]/40 text-[#ffd0d8]"
            role="alert">
            {erro}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {partida && !aberta && (
          <motion.button
            key="voltar"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            onClick={() => setAberta(true)}
            className="fixed z-[60] inset-x-0 mx-auto w-max bottom-[calc(env(safe-area-inset-bottom)+84px)] sm:bottom-24
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
