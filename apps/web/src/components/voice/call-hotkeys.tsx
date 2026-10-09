'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useHotkeys, matchesHotkey, hasModifier, toAccelerator, type HotkeyAction } from '@/lib/hotkeys';

interface DesktopHotkeys {
  setHotkeys?: (map: { mute: string | null; deafen: string | null }) => Promise<{ mute: boolean; deafen: boolean }>;
  onHotkey?: (cb: (action: HotkeyAction) => void) => () => void;
}
const desktop = (): DesktopHotkeys | null =>
  (typeof window !== 'undefined' && (window as any).nexusDesktop) || null;

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

// Atalhos de teclado da chamada: silenciar microfone e ensurdecer.
// Só valem durante uma chamada. Enquanto a pessoa digita, uma tecla sem
// Ctrl/Alt é digitada normalmente (não silencia por engano).
// No app de PC, também funcionam com o jogo em primeiro plano.
export function CallHotkeys() {
  const { mute, deafen, global } = useHotkeys();
  const isConnected = useVoiceStore(s => s.isConnected);
  const [aviso, setAviso] = useState<{ icon: 'on' | 'off' | 'deaf' | 'undeaf'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const run = async (action: HotkeyAction) => {
    const v = useVoiceStore.getState() as any;
    if (!v.isConnected) return;
    if (action === 'mute') {
      const ligando = !v.localMicEnabled;
      await v.toggleMic();
      // Mostra o estado REAL (sem permissão de microfone ele continua desligado)
      const on = !!(useVoiceStore.getState() as any).localMicEnabled;
      if (ligando && !on) show('off', 'Não foi possível ligar o microfone');
      else show(on ? 'on' : 'off', on ? 'Microfone ligado' : 'Microfone desligado');
    } else {
      const ensurdecendo = !v.isDeafened;
      v.toggleDeafen();
      show(ensurdecendo ? 'deaf' : 'undeaf', ensurdecendo ? 'Áudio e microfone desligados' : 'Áudio ligado de novo');
    }
  };
  const show = (icon: 'on' | 'off' | 'deaf' | 'undeaf', text: string) => {
    setAviso({ icon, text });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAviso(null), 1400);
  };

  // App de PC: atalho do sistema (funciona com outra janela em primeiro plano).
  // Só fica reservado durante a chamada — fora dela a tecla volta ao normal.
  const [registrado, setRegistrado] = useState<{ mute: boolean; deafen: boolean }>({ mute: false, deafen: false });
  useEffect(() => {
    const d = desktop();
    if (!d?.setHotkeys || !d.onHotkey) return;
    const ativo = isConnected && global;
    d.setHotkeys({ mute: ativo ? toAccelerator(mute) : null, deafen: ativo ? toAccelerator(deafen) : null })
      .then(r => setRegistrado({ mute: !!r?.mute, deafen: !!r?.deafen }))
      .catch(() => setRegistrado({ mute: false, deafen: false }));
    if (!ativo) return;
    const off = d.onHotkey(run);
    return () => { off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, global, mute, deafen]);

  // Dentro do site/app (janela do Nexus em foco)
  useEffect(() => {
    if (!isConnected || (!mute && !deafen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      for (const [action, hk] of [['mute', mute], ['deafen', deafen]] as const) {
        if (!hk || !matchesHotkey(e, hk)) continue;
        // Com o atalho do sistema ativo no app de PC, ele já cuida (evita alternar duas vezes)
        if (registrado[action]) return;
        if (isTyping(e.target) && !hasModifier(hk)) return;
        e.preventDefault();
        run(action);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, mute, deafen, registrado]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <AnimatePresence>
      {aviso && (
        <motion.div
          key={aviso.text}
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[90] top-[calc(env(safe-area-inset-top)+14px)] inset-x-0 mx-auto w-max
                     flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white shadow-2xl
                     border border-white/10 pointer-events-none"
          style={{ background: aviso.icon === 'on' || aviso.icon === 'undeaf' ? 'rgba(20,90,62,0.95)' : 'rgba(120,24,44,0.95)' }}
          role="status"
        >
          {aviso.icon === 'on' && <Mic className="w-4 h-4" />}
          {aviso.icon === 'off' && <MicOff className="w-4 h-4" />}
          {(aviso.icon === 'deaf' || aviso.icon === 'undeaf') && <Headphones className="w-4 h-4" />}
          {aviso.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
