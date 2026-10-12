import { create } from 'zustand';
import { REGISTRO, duracaoDe } from './registro';
import type { Carta, Cor } from '../unidos.store';

// Fila dos efeitos grandes (especiais e vitória). Um por vez, na mesma ordem
// para todo mundo (a ordem dos estados do servidor). Regras:
// - prioridade maior passa na frente; se o efeito atual for "interrompível",
//   é cortado na hora por um mais importante
// - efeito que ficou esperando demais é descartado (não atrasa a partida)
// - a fila guarda no máximo 3 esperando
// - um vigia encerra o efeito se o componente não avisar que terminou

export interface DadosEfeito {
  jogadorId?: string | null;
  alvoId?: string | null;
  carta?: Carta;
  cor?: Cor | null;
  qtd?: number;
  sentido?: 1 | -1;
  doisJogadores?: boolean;
  vencedorId?: string | null;
  pontos?: number;
  duracaoPartida?: number;
}

export interface Efeito {
  id: number;
  chave: string;
  seq: number;
  criadoEm: number;
  duracao: number;
  dados: DadosEfeito;
}

export const MAX_ESPERA = 2500;
export const MAX_FILA = 3;

// Núcleo puro (testável sem React): decide o que entra, sai e é cortado
export interface EstadoFila { atual: Efeito | null; fila: Efeito[] }

export function filaAdicionar(s: EstadoFila, ef: Efeito): EstadoFila {
  const def = REGISTRO[ef.chave];
  if (!def) return s;
  if (!s.atual) return { atual: ef, fila: s.fila };
  const defAtual = REGISTRO[s.atual.chave];
  if (def.prioridade > (defAtual?.prioridade ?? 0) && defAtual?.interrompivel) {
    return { atual: ef, fila: s.fila };
  }
  let fila = [...s.fila, ef].sort((a, b) => (REGISTRO[b.chave].prioridade - REGISTRO[a.chave].prioridade) || (a.seq - b.seq) || (a.id - b.id));
  // Cheia: sai o menos importante (o último depois de ordenar)
  while (fila.length > MAX_FILA) fila = fila.slice(0, -1);
  return { atual: s.atual, fila };
}

export function filaConcluir(s: EstadoFila, id: number, agora: number): EstadoFila {
  if (!s.atual || s.atual.id !== id) return s;
  const fila = [...s.fila];
  while (fila.length) {
    const prox = fila.shift()!;
    const def = REGISTRO[prox.chave];
    // Velho demais: pula (menos a vitória, que sempre aparece)
    if (agora - prox.criadoEm > MAX_ESPERA && def.prioridade < 100) continue;
    return { atual: prox, fila };
  }
  return { atual: null, fila: [] };
}

interface FilaStore extends EstadoFila {
  adicionar: (chave: string, seq: number, dados: DadosEfeito, reduzido: boolean) => void;
  concluir: (id: number) => void;
  limpar: () => void;
}

let proximoId = 1;
let vigia: ReturnType<typeof setTimeout> | null = null;

export const useFilaEfeitos = create<FilaStore>((set, get) => {
  const vigiar = () => {
    if (vigia) clearTimeout(vigia);
    vigia = null;
    const a = get().atual;
    if (a) vigia = setTimeout(() => get().concluir(a.id), a.duracao + 500);
  };
  return {
    atual: null,
    fila: [],
    adicionar: (chave, seq, dados, reduzido) => {
      const def = REGISTRO[chave];
      if (!def) return;
      if (typeof document !== 'undefined' && document.hidden && def.prioridade < 100) return; // aba escondida: não acumula
      const ef: Efeito = { id: proximoId++, chave, seq, criadoEm: Date.now(), duracao: duracaoDe(def, reduzido), dados };
      const antes = get().atual;
      set(filaAdicionar(get(), ef));
      if (get().atual !== antes) vigiar();
    },
    concluir: (id) => {
      const antes = get().atual;
      set(filaConcluir(get(), id, Date.now()));
      if (get().atual !== antes) vigiar();
    },
    limpar: () => {
      if (vigia) clearTimeout(vigia);
      vigia = null;
      set({ atual: null, fila: [] });
    },
  };
});
