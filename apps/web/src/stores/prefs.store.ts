'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccentTheme = 'nexus' | 'ember' | 'violet' | 'ocean' | 'emerald';

export const ACCENT_THEMES: Record<AccentTheme, {
  label: string; desc: string;
  from: string; to: string;      // gradiente de acento
  bg: string; glow: string;      // ambientação (fundo + brilho)
  panel: string; line: string;   // painéis e bordas
}> = {
  nexus: {
    label: 'Nexus', desc: 'Roxo profundo com brasas laranja — a identidade original.',
    from: '#ff6a00', to: '#7c5af0',
    bg: '#08060c', glow: '#28124c', panel: '#120d19', line: '#292039',
  },
  ember: {
    label: 'Brasa', desc: 'Noite quente em tons de vinho, rosa e fogo.',
    from: '#ff9345', to: '#ff4f79',
    bg: '#0d0609', glow: '#4c1226', panel: '#190d13', line: '#392029',
  },
  violet: {
    label: 'Violeta', desc: 'Imersão total no roxo, elétrica e vibrante.',
    from: '#b142f5', to: '#7a2cff',
    bg: '#0a0616', glow: '#331a66', panel: '#140d22', line: '#2c2049',
  },
  ocean: {
    label: 'Oceano', desc: 'Azul-marinho sereno com ciano brilhando no fundo.',
    from: '#22d3ee', to: '#3b82f6',
    bg: '#05090f', glow: '#0d2b4d', panel: '#0c131d', line: '#1c2b3d',
  },
  emerald: {
    label: 'Esmeralda', desc: 'Verde-mata escuro com energia de neon.',
    from: '#42e6a4', to: '#17a9cf',
    bg: '#050e0b', glow: '#0d3b31', panel: '#0b1713', line: '#1a3129',
  },
};

interface PrefsState {
  accent: AccentTheme;
  notifDesktop: boolean;
  notifSound: boolean;

  setAccent: (a: AccentTheme) => void;
  setNotifDesktop: (on: boolean) => void;
  setNotifSound: (on: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      accent: 'nexus',
      notifDesktop: false,
      notifSound: true,

      setAccent: (accent) => set({ accent }),
      setNotifDesktop: (notifDesktop) => set({ notifDesktop }),
      setNotifSound: (notifSound) => set({ notifSound }),
    }),
    { name: 'nexus-prefs' },
  ),
);

// Aplica o tema de acento no documento (usado pelo Providers e pela tela de Aparência)
export function applyAccent(accent: AccentTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (accent === 'nexus') {
    root.removeAttribute('data-accent');
  } else {
    root.setAttribute('data-accent', accent);
  }
}
