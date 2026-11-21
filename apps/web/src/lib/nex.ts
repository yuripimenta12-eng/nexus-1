import { create } from 'zustand';
import api from '@/lib/api';

// Economia Nex no navegador: só mostra e pede ao servidor (quem conta é ele).
export interface MissaoNex {
  id: string; tipo: 'dia' | 'sempre'; titulo: string; desc: string; icone: string;
  meta: number; nex: number; progresso: number; resgatada: boolean;
}
export interface ResumoNex {
  saldo: number; plano: 'gratis' | 'mais' | 'pro'; bonus: number;
  presenca: { dia: number; pegouHoje: boolean; valores: number[]; sequencia: number };
  roleta: { girosRestantes: number; giros: number; premios: { nex: number; chance: number }[] };
  missoes: MissaoNex[];
}

interface NexState {
  dados: ResumoNex | null;
  aberta: boolean;
  aba: 'presenca' | 'roleta' | 'missoes';
  carregar: () => Promise<void>;
  abrir: (aba?: NexState['aba']) => void;
  fechar: () => void;
  pegarPresenca: () => Promise<number>;
  girar: () => Promise<{ indice: number; ganhou: number }>;
  resgatar: (id: string) => Promise<number>;
}

const erro = (e: any) => new Error(e?.response?.data?.message || 'Não deu agora. Tente de novo.');

export const useNex = create<NexState>((set, get) => ({
  dados: null,
  aberta: false,
  aba: 'presenca',
  carregar: async () => {
    try { const { data } = await api.get('/nex'); set({ dados: data }); } catch { /* sem conexão */ }
  },
  abrir: (aba) => { set({ aberta: true, ...(aba ? { aba } : {}) }); get().carregar(); },
  fechar: () => set({ aberta: false }),
  pegarPresenca: async () => {
    try {
      const { data } = await api.post('/nex/presenca');
      await get().carregar();
      return data.ganhou;
    } catch (e) { throw erro(e); }
  },
  girar: async () => {
    try {
      const { data } = await api.post('/nex/roleta');
      // Saldo atualiza depois da animação (quem chama recarrega)
      return { indice: data.indice, ganhou: data.ganhou };
    } catch (e) { throw erro(e); }
  },
  resgatar: async (id) => {
    try {
      const { data } = await api.post(`/nex/missoes/${id}`);
      await get().carregar();
      return data.ganhou;
    } catch (e) { throw erro(e); }
  },
}));
