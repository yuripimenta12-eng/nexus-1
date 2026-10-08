'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { enablePush, isPushEnabled, pushSupport } from '@/lib/push';

const KEY = 'nexus_push_prompt_until';

// Convite discreto para ligar os avisos no celular/navegador.
// Aparece uma vez (depois de alguns segundos de uso) e some por 14 dias se
// a pessoa fechar. O pedido de permissão do navegador só sai ao tocar em "Ativar".
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (pushSupport() !== 'ok') return;
        if (Notification.permission === 'denied') return;
        const until = Number(localStorage.getItem(KEY) || 0);
        if (until && Date.now() < until) return;
        if (await isPushEnabled()) return;
        if (!cancelled) setShow(true);
      } catch { /* sem armazenamento/sem suporte: não mostra */ }
    }, 8000);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const later = () => {
    try { localStorage.setItem(KEY, String(Date.now() + 14 * 24 * 3600 * 1000)); } catch { /* ok */ }
    setShow(false);
  };

  const activate = async () => {
    setBusy(true);
    try {
      const r = await enablePush();
      if (r === 'ok') { setMsg('Pronto! Você vai receber os avisos.'); setTimeout(() => setShow(false), 1800); }
      else if (r === 'denied') { setMsg('O navegador bloqueou. Libere nas configurações do site.'); setTimeout(later, 3500); }
      else later();
    } catch { setMsg('Não deu certo agora. Tente em Configurações → Notificações.'); setTimeout(later, 3500); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
          className="fixed z-[60] top-[calc(env(safe-area-inset-top)+10px)] left-3 right-3 sm:left-auto sm:right-5 sm:w-[360px] rounded-2xl border border-[rgba(124,90,240,0.35)] shadow-2xl p-4"
          style={{ background: 'linear-gradient(160deg, rgba(30,22,48,0.97), rgba(15,12,26,0.97))', backdropFilter: 'blur(12px)' }}
          role="dialog" aria-label="Ativar notificações"
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
              <Bell className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm">Receber avisos com o Nexus fechado?</p>
              <p className="text-[12px] text-[#a99fc0] mt-0.5">
                {msg || 'Mensagens diretas, menções e chamadas chegam no celular ou no computador.'}
              </p>
            </div>
            <button onClick={later} className="text-muted hover:text-white self-start" title="Agora não"><X className="w-4 h-4" /></button>
          </div>
          {!msg && (
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={later} className="px-3 h-9 rounded-lg text-sm text-[#a99fc0] hover:text-white">Agora não</button>
              <button onClick={activate} disabled={busy}
                className="px-4 h-9 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
                {busy ? 'Ativando…' : 'Ativar'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
