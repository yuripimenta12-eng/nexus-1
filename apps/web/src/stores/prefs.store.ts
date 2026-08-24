'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccentTheme = 'nexus' | 'ember' | 'violet' | 'ocean' | 'emerald';

export const ACCENT_THEMES: Record<AccentTheme, { label: string; from: string; to: string }> = {
  nexus:   { label: 'Nexus',    from: '#ff6a00', to: '#7c5af0' },
  ember:   { label: 'Brasa',    from: '#ff9345', to: '#ff4f79' },
  violet:  { label: 'Violeta',  from: '#b142f5', to: '#7a2cff' },
  ocean:   { label: 'Oceano',   from: '#22d3ee', to: '#3b82f6' },
  emerald: { label: 'Esmeralda', from: '#42e6a4', to: '#17a9cf' },
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
