'use client';

import { useEffect, useState } from 'react';
import { Keyboard, MicOff, Headphones, X } from 'lucide-react';
import { isDesktopApp } from '@/lib/desktop';
import {
  useHotkeys, hotkeyFromEvent, formatHotkey, sameHotkey, hasModifier,
  type Hotkey, type HotkeyAction,
} from '@/lib/hotkeys';

const ACOES: { id: HotkeyAction; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'mute', label: 'Ligar / desligar microfone', desc: 'Silencia você na chamada sem precisar clicar', icon: <MicOff className="w-5 h-5" /> },
  { id: 'deafen', label: 'Ensurdecer', desc: 'Desliga o som da chamada e o seu microfone juntos', icon: <Headphones className="w-5 h-5" /> },
];

// Atalhos da chamada: cada pessoa escolhe a tecla que quiser
export function HotkeySettings() {
  const hk = useHotkeys();
  const [gravando, setGravando] = useState<HotkeyAction | null>(null);
  const [aviso, setAviso] = useState('');
  const pc = isDesktopApp();
  const pcComAtalhoGlobal = pc && typeof window !== 'undefined' && !!(window as any).nexusDesktop?.setHotkeys;

  // Esperando a pessoa apertar a tecla
  useEffect(() => {
    if (!gravando) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey) { setGravando(null); return; }
      const novo = hotkeyFromEvent(e);
      if (!novo) return; // só Ctrl/Alt/Shift: espera a tecla de verdade
      const outra = gravando === 'mute' ? hk.deafen : hk.mute;
      if (sameHotkey(novo, outra)) {
        setAviso(`${formatHotkey(novo)} já está sendo usado no outro atalho.`);
        return;
      }
      hk.setHotkey(gravando, novo);
      setAviso(!hasModifier(novo)
        ? 'Dica: enquanto você digita no chat, essa tecla escreve normalmente. Para funcionar sempre, combine com Ctrl ou Alt.'
        : '');
      setGravando(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [gravando, hk]);

  return (
    <section>
      <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">Atalhos da chamada</p>
      <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)]">
        {ACOES.map(a => {
          const atual: Hotkey | null = hk[a.id];
          const esperando = gravando === a.id;
          return (
            <div key={a.id} className="flex items-center gap-4 p-4">
              <span className="w-11 h-11 rounded-[14px] grid place-items-center shrink-0 bg-[var(--th-panel-2)] text-[#8c5dcc]">
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <b className="block text-sm text-[#cfc6dd]">{a.label}</b>
                <small className="block text-xs text-[#92879f] mt-0.5">{a.desc}</small>
              </div>
              <button
                type="button"
                onClick={() => { setAviso(''); setGravando(esperando ? null : a.id); }}
                className={`min-w-[132px] h-10 px-3 rounded-xl border text-sm font-semibold transition-colors flex items-center justify-center gap-2
                  ${esperando
                    ? 'border-accent text-white bg-accent/15 animate-pulse'
                    : atual
                      ? 'border-[#3d2b4a] text-white bg-[var(--th-rail)] hover:border-accent'
                      : 'border-dashed border-[#3d2b4a] text-[#92879f] hover:text-white hover:border-accent'}`}
                title={esperando ? 'Aperte a tecla (Esc cancela)' : 'Clique e aperte a tecla que quiser'}
              >
                <Keyboard className="w-4 h-4 shrink-0" />
                {esperando ? 'Aperte a tecla…' : atual ? formatHotkey(atual) : 'Definir tecla'}
              </button>
              {atual && !esperando && (
                <button
                  type="button"
                  onClick={() => { hk.setHotkey(a.id, null); setAviso(''); }}
                  className="w-8 h-8 rounded-lg grid place-items-center text-[#92879f] hover:text-white hover:bg-white/5"
                  title="Remover atalho"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}

        {pc && (
          <label className="flex items-center gap-4 p-4 cursor-pointer">
            <div className="min-w-0 flex-1">
              <b className="block text-sm text-[#cfc6dd]">Funcionar também dentro do jogo</b>
              <small className="block text-xs text-[#92879f] mt-0.5">
                {pcComAtalhoGlobal
                  ? 'O atalho funciona mesmo com o jogo ou outra janela na frente. Durante a chamada a tecla fica reservada para o Nexus — escolha uma que o jogo não use.'
                  : 'Atualize o app do Nexus para a versão mais nova para usar o atalho com o jogo na frente.'}
              </small>
            </div>
            <input
              type="checkbox"
              checked={hk.global}
              disabled={!pcComAtalhoGlobal}
              onChange={(e) => hk.setGlobal(e.target.checked)}
              className="w-5 h-5 accent-[#7a2cff] disabled:opacity-40"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-[#92879f] mt-2 px-1">
        {aviso || (pc
          ? 'Os atalhos valem só durante uma chamada.'
          : 'Os atalhos valem só durante uma chamada, com o Nexus aberto na tela. No app de PC eles funcionam até dentro do jogo.')}
      </p>
    </section>
  );
}
