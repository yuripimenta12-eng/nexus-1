'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useDmCall } from '@/stores/dm-call.store';
import { useVoiceStore } from '@/stores/voice.store';

// Toque simples gerado na hora (sem arquivo): dois bipes a cada 2 s
function startRingtone(): () => void {
  let ctx: AudioContext | null = null;
  try { ctx = new AudioContext(); } catch { return () => {}; }
  const beep = () => {
    if (!ctx) return;
    const now = ctx.currentTime;
    [[660, 0], [880, 0.22]].forEach(([f, d]) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.16, now + d + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.2);
      o.connect(g).connect(ctx!.destination);
      o.start(now + d); o.stop(now + d + 0.22);
    });
  };
  beep();
  const t = setInterval(beep, 2000);
  return () => { clearInterval(t); ctx?.close().catch(() => {}); ctx = null; };
}

function Avatar({ name, url, size = 48, pulse }: { name: string; url?: string | null; size?: number; pulse?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {pulse && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'rgba(124,90,240,0.45)' }} />}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="relative rounded-full object-cover" style={{ width: size, height: size }} />
      ) : (
        <div className="relative rounded-full flex items-center justify-center font-black text-white"
          style={{ width: size, height: size, fontSize: size * 0.32, background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <span className="tabular-nums">{Math.floor(s / 60)}:{(s % 60).toString().padStart(2, '0')}</span>;
}

// Janela global da chamada 1:1: toca ao receber, mostra "chamando…" e a chamada ativa
export function DmCallOverlay() {
  const { phase, partner, startedAt, notice, ring, accept, decline, hangup, remoteAccepted, remoteEnded, handledElsewhere, clearNotice } = useDmCall();
  const { localMicEnabled, toggleMic, voiceRoomId, isConnected, participants } = useVoiceStore() as any;
  const wasInDm = useRef<string | null>(null);

  // Eventos de chamada vindos do servidor
  useEffect(() => {
    const socket = getSocket();
    const onRing = ({ from }: any) => { if (from?.id) ring({ id: from.id, displayName: from.displayName || from.username || 'Alguém', avatarUrl: from.avatarUrl }); };
    const onAccepted = ({ by }: any) => remoteAccepted(by);
    const onEnded = ({ from, reason }: any) => remoteEnded(from, reason);
    const onHandled = ({ partnerId }: any) => handledElsewhere(partnerId);
    socket.on('dm:call:ring', onRing);
    socket.on('dm:call:accepted', onAccepted);
    socket.on('dm:call:ended', onEnded);
    socket.on('dm:call:handled', onHandled);
    return () => {
      socket.off('dm:call:ring', onRing);
      socket.off('dm:call:accepted', onAccepted);
      socket.off('dm:call:ended', onEnded);
      socket.off('dm:call:handled', onHandled);
    };
  }, [ring, remoteAccepted, remoteEnded, handledElsewhere]);

  // Toque enquanto alguém liga para mim
  useEffect(() => {
    if (phase !== 'incoming') return;
    return startRingtone();
  }, [phase]);

  // Saiu da chamada por outro caminho (botão da barra lateral, entrou numa sala
  // de servidor, internet caiu): avisa o outro lado
  useEffect(() => {
    const inDm = isConnected && voiceRoomId?.startsWith('dm:') ? voiceRoomId : null;
    if (wasInDm.current && !inDm && (phase === 'active' || phase === 'outgoing')) hangup();
    wasInDm.current = inDm;
  }, [isConnected, voiceRoomId, phase, hangup]);

  // Aviso curto ("Fulano recusou a chamada")
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clearNotice, 4000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  const remoteSpeaking = partner ? !!participants?.get?.(partner.id)?.isSpeaking : false;
  const remoteHere = partner ? !!participants?.get?.(partner.id) : false;

  return (
    <>
      <AnimatePresence>
        {phase !== 'idle' && partner && (
          <motion.div
            key="dm-call"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed z-[70] right-3 left-3 sm:left-auto sm:right-5 bottom-[calc(env(safe-area-inset-bottom)+12px)] sm:bottom-5 sm:w-[340px] rounded-2xl border border-[rgba(124,90,240,0.35)] shadow-2xl p-4"
            style={{ background: 'linear-gradient(160deg, rgba(30,22,48,0.97), rgba(15,12,26,0.97))', backdropFilter: 'blur(12px)' }}
            role="dialog"
            aria-label="Chamada"
          >
            <div className="flex items-center gap-3">
              <div className={remoteSpeaking ? 'rounded-full ring-2 ring-[#43e3a3] ring-offset-2 ring-offset-[#140f22]' : ''}>
                <Avatar name={partner.displayName} url={partner.avatarUrl} pulse={phase === 'incoming' || phase === 'outgoing'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-[15px] truncate">{partner.displayName}</p>
                <p className="text-[12px] text-[#a99fc0]">
                  {phase === 'incoming' && 'está ligando para você…'}
                  {phase === 'outgoing' && 'Chamando…'}
                  {phase === 'active' && (
                    remoteHere
                      ? <>Em chamada · {startedAt ? <Elapsed since={startedAt} /> : '0:00'}</>
                      : 'Conectando…'
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              {phase === 'incoming' ? (
                <>
                  <button onClick={decline}
                    className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-white font-semibold bg-[#ff4d6d] hover:bg-[#ff3358] transition-colors">
                    <PhoneOff className="w-4 h-4" /> Recusar
                  </button>
                  <button onClick={accept}
                    className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[#0d0a16] font-semibold bg-[#43e3a3] hover:bg-[#2fd893] transition-colors">
                    <Phone className="w-4 h-4" /> Atender
                  </button>
                </>
              ) : (
                <>
                  {phase === 'active' && (
                    <button onClick={() => toggleMic()} title={localMicEnabled ? 'Silenciar microfone' : 'Ligar microfone'}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${localMicEnabled ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#ff4d6d]/20 text-[#ff8098]'}`}>
                      {localMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    </button>
                  )}
                  <button onClick={() => hangup()}
                    className="h-11 px-5 rounded-xl flex items-center justify-center gap-2 text-white font-semibold bg-[#ff4d6d] hover:bg-[#ff3358] transition-colors">
                    <PhoneOff className="w-4 h-4" /> {phase === 'outgoing' ? 'Cancelar' : 'Desligar'}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && phase === 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+16px)] px-4 py-2.5 rounded-xl text-sm text-white shadow-xl border border-[var(--th-line)]"
            style={{ background: 'rgba(20,15,34,0.96)' }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
