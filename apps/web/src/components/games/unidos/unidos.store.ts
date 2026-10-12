'use client';

import { create } from 'zustand';
import { getSocket } from '@/lib/socket';

// Tipos espelhados do servidor (apps/server/src/games/unidos/unidos.engine.ts)
export type Cor = 'laranja' | 'roxo' | 'prata' | 'dourado';
export type Tipo = 'numero' | 'bloqueio' | 'troca' | 'mais2' | 'call' | 'conexao' | 'todosunidos';
export interface Carta { id: string; cor: Cor | null; tipo: Tipo; valor?: number }
export interface JogadorVisao {
  id: string; nome: string; avatarUrl: string | null; cartas: number;
  gritou: boolean; ausente: boolean; esqueceu: boolean;
}
export interface Partida {
  id: string; voiceRoomId: string; hostId: string; status: 'lobby' | 'jogando' | 'fim'; seq: number;
  jogadores: JogadorVisao[]; topo: Carta | null; corAtual: Cor | null; vezId: string | null;
  sentido: 1 | -1; acumulado: number; monte: number; comprada: string | null;
  vencedorId: string | null; prazo: number; restante?: number;
  pontos?: number; duracao?: number; // vitória: pontos do vencedor e duração da partida (ms)
  prazoLocal?: number; // prazo convertido para o relógio deste aparelho
  ultima: { jogadorId: string; acao: string; carta?: Carta; alvoId?: string; qtd?: number } | null;
  minhaMao: Carta[]; jogaveis: string[];
}
export interface Sala { id: string; voiceRoomId: string; status: Partida['status']; hostNome: string; jogadores: { id: string; nome: string; avatarUrl: string | null }[] }

// O servidor manda quanto tempo falta; aqui vira um prazo no relógio deste aparelho
function comRelogio(p: Partida): Partida {
  return { ...p, prazoLocal: Date.now() + (p.restante ?? Math.max(0, p.prazo - Date.now())) };
}

type Resp = { ok: boolean; erro?: string; partida?: Partida | null; sala?: Sala | null };

async function pedir(evento: string, dados: any): Promise<Resp> {
  try {
    return await getSocket().timeout(6000).emitWithAck(evento, dados);
  } catch {
    return { ok: false, erro: 'Sem resposta do servidor. Tente de novo.' };
  }
}

interface UnidosState {
  sala: Sala | null;          // mesa aberta nesta chamada (para o botão "Entrar")
  partida: Partida | null;    // minha visão da partida (se estou na mesa)
  aberta: boolean;            // janela do jogo aberta na tela
  erro: string | null;
  voiceRoomId: string | null;
  ouvir: (voiceRoomId: string) => () => void;
  consultar: (tentativa?: number) => Promise<void>;
  abrirMesa: () => Promise<void>;
  entrarMesa: () => Promise<void>;
  acao: (evento: string, dados?: Record<string, unknown>) => Promise<boolean>;
  sair: () => Promise<void>;
  setAberta: (v: boolean) => void;
  limparErro: () => void;
}

export const useUnidos = create<UnidosState>((set, get) => ({
  sala: null,
  partida: null,
  aberta: false,
  erro: null,
  voiceRoomId: null,

  // Liga os eventos do jogo para a chamada atual (devolve a função de desligar)
  ouvir: (voiceRoomId) => {
    const socket = getSocket();
    set({ voiceRoomId });
    const onEstado = (p: Partida) => {
      if (p.voiceRoomId !== get().voiceRoomId) return;
      const atual = get().partida;
      if (atual && atual.id === p.id && atual.seq > p.seq) return; // chegou fora de ordem
      set({ partida: comRelogio(p) });
    };
    const onSala = (s: Sala | null) => {
      if (s && s.voiceRoomId !== get().voiceRoomId) return;
      set({ sala: s });
      if (!s) set({ partida: null, aberta: false });
    };
    const onEncerrada = ({ id }: { id: string }) => {
      if (get().partida?.id === id) set({ partida: null, aberta: false });
    };
    // Reconectou (internet piscou ou o servidor reiniciou): confere a mesa de novo.
    // Espera o voice:join chegar antes, senão o servidor ainda não sabe que estamos na sala.
    const onConnect = () => { setTimeout(() => get().consultar(), 1200); };
    socket.on('unidos:estado', onEstado);
    socket.on('unidos:sala', onSala);
    socket.on('unidos:encerrada', onEncerrada);
    socket.on('connect', onConnect);
    // Espera o voice:join chegar ao servidor antes de perguntar
    const t = setTimeout(() => get().consultar(), 900);
    return () => {
      clearTimeout(t);
      socket.off('unidos:estado', onEstado);
      socket.off('unidos:sala', onSala);
      socket.off('unidos:encerrada', onEncerrada);
      socket.off('connect', onConnect);
      set({ sala: null, partida: null, aberta: false, voiceRoomId: null });
    };
  },

  consultar: async (tentativa = 0) => {
    const voiceRoomId = get().voiceRoomId;
    if (!voiceRoomId) return;
    const r = await pedir('unidos:consultar', { voiceRoomId });
    if (r.ok) {
      const tinha = get().partida;
      const agora = r.partida ? comRelogio(r.partida) : null;
      // A mesa não existe mais no servidor: avisa em vez de deixar a tela parada
      if (tinha && !agora) set({ erro: 'A partida foi encerrada. Abra uma mesa nova para jogar de novo.', aberta: false });
      set({ sala: r.sala ?? null, partida: agora });
    } else if (tentativa < 4 && get().voiceRoomId === voiceRoomId) {
      // Ainda entrando na chamada depois de reconectar: tenta de novo
      setTimeout(() => get().consultar(tentativa + 1), 1500);
    }
  },

  abrirMesa: async () => {
    const voiceRoomId = get().voiceRoomId;
    if (!voiceRoomId) return;
    const r = await pedir('unidos:abrir', { voiceRoomId });
    if (r.ok && r.partida) set({ partida: comRelogio(r.partida), aberta: true, erro: null });
    else set({ erro: r.erro || 'Não foi possível abrir a mesa' });
  },

  entrarMesa: async () => {
    const sala = get().sala;
    if (!sala) return get().abrirMesa();
    if (get().partida?.id === sala.id) { set({ aberta: true }); return; }
    const r = await pedir('unidos:entrar', { partidaId: sala.id });
    if (r.ok && r.partida) set({ partida: comRelogio(r.partida), aberta: true, erro: null });
    else set({ erro: r.erro || 'Não foi possível entrar' });
  },

  acao: async (evento, dados = {}) => {
    const p = get().partida;
    if (!p) return false;
    const r = await pedir(`unidos:${evento}`, { partidaId: p.id, ...dados });
    if (!r.ok) {
      set({ erro: r.erro || 'Jogada recusada' });
      // A partida sumiu do servidor: atualiza a tela (fecha a mesa e avisa)
      if (r.erro === 'Partida não encontrada') get().consultar();
    }
    return r.ok;
  },

  sair: async () => {
    const p = get().partida;
    if (p) await pedir('unidos:sair', { partidaId: p.id });
    set({ partida: null, aberta: false });
  },

  setAberta: (aberta) => set({ aberta }),
  limparErro: () => set({ erro: null }),
}));
