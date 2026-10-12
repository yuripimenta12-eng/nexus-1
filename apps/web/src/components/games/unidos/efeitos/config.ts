'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';

// Preferências do UNidos (ficam só neste aparelho). Volumes de 0 a 1.
export interface ConfigUnidos {
  volMusica: number;
  volInterface: number;   // cliques, selecionar, vez
  volEfeitos: number;     // jogadas, especiais, vitória
  mudo: boolean;
  reduzido: boolean;      // efeitos reduzidos: animações curtas, poucas partículas, sem tremor
  semTremor: boolean;     // tira só a tremida da tela
  vibracao: boolean;      // vibração no celular
  umClique: boolean;      // joga a carta no primeiro clique (sem confirmar)
}

const PADRAO: ConfigUnidos = {
  volMusica: 0, volInterface: 0.6, volEfeitos: 0.8, mudo: false,
  reduzido: false, semTremor: false, vibracao: true, umClique: false,
};
const CHAVE = 'nexus:unidos:config';

function ler(): ConfigUnidos {
  if (typeof window === 'undefined') return PADRAO;
  try {
    const s = window.localStorage.getItem(CHAVE);
    return s ? { ...PADRAO, ...JSON.parse(s) } : PADRAO;
  } catch { return PADRAO; }
}

export const useConfigUnidos = create<ConfigUnidos & { mudar: (p: Partial<ConfigUnidos>) => void }>((set, get) => ({
  ...ler(),
  mudar: (p) => {
    set(p);
    try {
      const { mudar: _m, ...c } = get();
      window.localStorage.setItem(CHAVE, JSON.stringify(c));
    } catch { /* navegador sem armazenamento: vale só nesta visita */ }
  },
}));

// "Reduzir movimento" do sistema operacional
function sistemaPedeMenosMovimento() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function usePrefereMenosMovimento() {
  const [r, setR] = useState(false);
  useEffect(() => {
    let m: MediaQueryList;
    try { m = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return; }
    setR(m.matches);
    const f = (e: MediaQueryListEvent) => setR(e.matches);
    m.addEventListener?.('change', f);
    return () => m.removeEventListener?.('change', f);
  }, []);
  return r;
}

export interface ModoEfeitos {
  reduzido: boolean;  // versão curta e calma de cada efeito
  tremor: boolean;    // pode tremer a tela
  movimento: boolean; // false = o sistema pediu menos movimento (sem voos nem giros)
}

// Para componentes React
export function useModoEfeitos(): ModoEfeitos {
  const sistema = usePrefereMenosMovimento();
  const reduzidoCfg = useConfigUnidos(s => s.reduzido);
  const semTremor = useConfigUnidos(s => s.semTremor);
  const reduzido = sistema || reduzidoCfg;
  return { reduzido, tremor: !reduzido && !semTremor, movimento: !sistema };
}

// Para código fora do React (controlador, fila, partículas)
export function modoAtual(): ModoEfeitos {
  const c = useConfigUnidos.getState();
  const sistema = typeof window !== 'undefined' && sistemaPedeMenosMovimento();
  const reduzido = sistema || c.reduzido;
  return { reduzido, tremor: !reduzido && !c.semTremor, movimento: !sistema };
}
