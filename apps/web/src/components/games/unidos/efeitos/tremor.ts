import { create } from 'zustand';
import { modoAtual } from './config';

// Pedido de tremida da mesa (a mesa escuta e anima). Respeita "sem tremor",
// efeitos reduzidos e o "reduzir movimento" do sistema.
export const useTremor = create<{ n: number; forca: number; tremer: (forca?: number) => void }>((set, get) => ({
  n: 0,
  forca: 0,
  tremer: (forca = 1) => {
    if (!modoAtual().tremor || forca <= 0) return;
    set({ n: get().n + 1, forca });
  },
}));
