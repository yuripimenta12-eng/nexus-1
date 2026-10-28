'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { installAppUpdate, watchAppUpdate } from '@/lib/desktop';
import { useVoiceStore } from '@/stores/voice.store';

// App de PC: a versão nova já foi baixada em segundo plano. Ela entra
// sozinha quando a pessoa fecha o Nexus; aqui dá para instalar na hora.
// "Depois" esconde até a próxima vez que o app abrir.
export function AtualizacaoApp() {
  const [versao, setVersao] = useState<string | null>(null);
  const [fechado, setFechado] = useState(false);
  const emCall = useVoiceStore(s => s.isConnected);

  useEffect(() => watchAppUpdate(setVersao), []);

  return (
    <AnimatePresence>
      {versao && !fechado && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
          className="fixed z-[60] bottom-5 right-5 w-[340px] max-w-[calc(100vw-40px)] rounded-2xl border border-[rgba(124,90,240,0.35)] shadow-2xl p-4"
          style={{ background: 'linear-gradient(160deg, rgba(30,22,48,0.97), rgba(15,12,26,0.97))' }}
          role="dialog" aria-label="Atualização do app"
        >
          <div className="flex gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm">Nova versão do app pronta ({versao})</p>
              <p className="text-[12px] text-[#a99fc0] mt-0.5">
                {emCall
                  ? 'Ela entra quando você fechar o Nexus. Reiniciar agora tira você da call por alguns segundos.'
                  : 'Ela entra quando você fechar o Nexus, ou reinicie agora (leva alguns segundos).'}
              </p>
            </div>
            <button onClick={() => setFechado(true)} className="text-muted hover:text-white self-start" title="Depois" aria-label="Depois">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setFechado(true)}
              className="h-8 px-3 rounded-lg text-[12.5px] font-bold text-[#c9c2d2] hover:bg-white/10">
              Depois
            </button>
            <button onClick={installAppUpdate}
              className="h-8 px-3 rounded-lg text-[12.5px] font-black text-white bg-[#7a2cff] hover:bg-[#8f42ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              Reiniciar agora
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
