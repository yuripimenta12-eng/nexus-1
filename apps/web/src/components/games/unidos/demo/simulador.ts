import type { Carta, Cor, Partida, Tipo } from '../unidos.store';

// Mesa simulada só para a página de demonstração (/app/unidos/demo): roda
// no navegador, sem servidor, para testar cada efeito separado. As regras de
// verdade continuam no servidor (apps/server/src/games/unidos/unidos.engine.ts);
// aqui é uma cópia simplificada só para a demo andar.

export const CORES: Cor[] = ['laranja', 'roxo', 'prata', 'dourado'];
const CURINGA = (t: Tipo) => t === 'conexao' || t === 'todosunidos';
const TEMPO = 30_000;

interface JogadorSim { id: string; nome: string; avatarUrl: string | null; mao: Carta[]; gritou: boolean; ausente: boolean }
export interface Sim {
  id: string;
  jogadores: JogadorSim[];
  topo: Carta;
  corAtual: Cor;
  vez: number;
  sentido: 1 | -1;
  acumulado: number;
  comprada: string | null;
  status: 'lobby' | 'jogando' | 'fim';
  vencedorId: string | null;
  ultima: Partida['ultima'];
  seq: number;
  prazo: number;
  inicio: number;
  fim: number;
  pontos: number;
}

let n = 0;
export function cartaAleatoria(tipo?: Tipo, cor?: Cor | null): Carta {
  const tipos: Tipo[] = ['numero', 'numero', 'numero', 'numero', 'numero', 'numero', 'bloqueio', 'troca', 'mais2', 'call', 'conexao', 'todosunidos'];
  const t = tipo || tipos[Math.floor(Math.random() * tipos.length)];
  const c = CURINGA(t) ? null : cor || CORES[Math.floor(Math.random() * 4)];
  return { id: `demo${(n++).toString(36)}`, tipo: t, cor: c, ...(t === 'numero' ? { valor: Math.floor(Math.random() * 10) } : {}) };
}

const clonar = (s: Sim): Sim => ({ ...s, jogadores: s.jogadores.map(j => ({ ...j, mao: [...j.mao] })) });

export function criarSim(eu: { id: string; nome: string; avatarUrl: string | null }, qtd = 4): Sim {
  const nomes = ['Ana', 'Beto', 'Caio', 'Duda', 'Edu'];
  const jogadores: JogadorSim[] = [{ ...eu, mao: [], gritou: false, ausente: false }];
  for (let i = 0; i < qtd - 1; i++) jogadores.push({ id: `demo-${nomes[i].toLowerCase()}`, nome: nomes[i], avatarUrl: null, mao: [], gritou: false, ausente: false });
  for (const j of jogadores) j.mao = Array.from({ length: 7 }, () => cartaAleatoria());
  const topo = cartaAleatoria('numero');
  const agora = Date.now();
  return {
    id: 'demo', jogadores, topo, corAtual: topo.cor!, vez: 0, sentido: 1, acumulado: 0, comprada: null,
    status: 'jogando', vencedorId: null, ultima: { jogadorId: eu.id, acao: 'inicio' }, seq: 1, prazo: agora + TEMPO,
    inicio: agora, fim: 0, pontos: 0,
  };
}

export function podeJogar(s: Sim, c: Carta) {
  if (s.acumulado > 0) return (s.topo.tipo === 'mais2' && c.tipo === 'mais2') || (s.topo.tipo === 'todosunidos' && c.tipo === 'todosunidos');
  if (CURINGA(c.tipo)) return true;
  if (c.cor === s.corAtual) return true;
  if (c.tipo === 'numero') return s.topo.tipo === 'numero' && s.topo.valor === c.valor;
  return c.tipo === s.topo.tipo;
}

const valor = (c: Carta) => (c.tipo === 'numero' ? c.valor ?? 0 : CURINGA(c.tipo) ? 50 : 20);

function avancar(s: Sim, passos = 1) {
  const q = s.jogadores.length;
  s.vez = (((s.vez + s.sentido * passos) % q) + q) % q;
  s.comprada = null;
  s.prazo = Date.now() + TEMPO;
}

export function visaoSim(s: Sim, meuId: string): Partida {
  const eu = s.jogadores.find(j => j.id === meuId);
  const vezId = s.status === 'jogando' ? s.jogadores[s.vez].id : null;
  const minhaVez = vezId === meuId;
  const restante = s.status === 'jogando' ? Math.max(0, s.prazo - Date.now()) : 0;
  return {
    id: s.id, voiceRoomId: 'demo', hostId: meuId, status: s.status, seq: s.seq,
    jogadores: s.jogadores.map(j => ({ id: j.id, nome: j.nome, avatarUrl: j.avatarUrl, cartas: j.mao.length, gritou: j.gritou, ausente: j.ausente, esqueceu: s.status === 'jogando' && j.mao.length === 1 && !j.gritou })),
    topo: s.topo, corAtual: s.corAtual, vezId, sentido: s.sentido, acumulado: s.acumulado, monte: 60, comprada: minhaVez ? s.comprada : null,
    vencedorId: s.vencedorId, prazo: s.prazo, restante, prazoLocal: Date.now() + restante, ultima: s.ultima,
    pontos: s.pontos, duracao: s.inicio ? (s.fim || Date.now()) - s.inicio : 0,
    minhaMao: eu ? [...eu.mao] : [],
    jogaveis: minhaVez && eu ? eu.mao.filter(c => (!s.comprada || c.id === s.comprada) && podeJogar(s, c)).map(c => c.id) : [],
  };
}

export function jogarSim(s0: Sim, jogadorId: string, cartaId: string, op: { cor?: Cor; alvoId?: string } = {}): Sim | string {
  const s = clonar(s0);
  if (s.status !== 'jogando') return 'A partida não está rolando';
  if (s.jogadores[s.vez].id !== jogadorId) return 'Não é a sua vez';
  const j = s.jogadores.find(x => x.id === jogadorId)!;
  const i = j.mao.findIndex(c => c.id === cartaId);
  if (i < 0) return 'Essa carta não está na sua mão';
  const c = j.mao[i];
  if (s.comprada && s.comprada !== c.id) return 'Depois de comprar, só dá para jogar a carta que você comprou';
  if (!podeJogar(s, c)) return 'Essa carta não combina com a da mesa';
  if (CURINGA(c.tipo) && !op.cor) return 'Escolha uma cor';
  if (c.tipo === 'call' && (!op.alvoId || op.alvoId === jogadorId)) return 'Escolha quem joga agora';
  j.mao.splice(i, 1);
  s.topo = c;
  s.corAtual = CURINGA(c.tipo) ? op.cor! : c.cor!;
  s.ultima = { jogadorId, acao: 'jogou', carta: c, alvoId: c.tipo === 'call' ? op.alvoId : undefined };
  s.seq++;
  if (!j.mao.length) {
    s.status = 'fim'; s.vencedorId = j.id; s.fim = Date.now(); s.prazo = 0;
    s.pontos = s.jogadores.filter(x => x.id !== j.id).reduce((t, x) => t + x.mao.reduce((a, b) => a + valor(b), 0), 0);
    return s;
  }
  if (j.mao.length > 2) j.gritou = false;
  const q = s.jogadores.length;
  switch (c.tipo) {
    case 'bloqueio': avancar(s, 2); break;
    case 'troca': s.sentido = (s.sentido * -1) as 1 | -1; avancar(s, q === 2 ? 2 : 1); break;
    case 'mais2': s.acumulado += 2; avancar(s); break;
    case 'todosunidos': s.acumulado += 4; avancar(s); break;
    case 'call': s.vez = s.jogadores.findIndex(x => x.id === op.alvoId); s.comprada = null; s.prazo = Date.now() + TEMPO; break;
    default: avancar(s);
  }
  return s;
}

export function comprarSim(s0: Sim, jogadorId: string): Sim | string {
  const s = clonar(s0);
  if (s.jogadores[s.vez].id !== jogadorId) return 'Não é a sua vez';
  if (s.comprada) return 'Você já comprou nesta vez: jogue a carta ou passe';
  const j = s.jogadores.find(x => x.id === jogadorId)!;
  s.seq++;
  if (s.acumulado > 0) {
    const novas = Array.from({ length: s.acumulado }, () => cartaAleatoria());
    j.mao.push(...novas);
    s.ultima = { jogadorId, acao: 'comprou', qtd: novas.length };
    s.acumulado = 0;
    j.gritou = false;
    avancar(s);
    return s;
  }
  const c = cartaAleatoria();
  j.mao.push(c);
  if (j.mao.length > 2) j.gritou = false;
  s.ultima = { jogadorId, acao: 'comprou', qtd: 1 };
  if (podeJogar(s, c)) s.comprada = c.id; else avancar(s);
  return s;
}

export function passarSim(s0: Sim, jogadorId: string): Sim | string {
  const s = clonar(s0);
  if (s.jogadores[s.vez].id !== jogadorId) return 'Não é a sua vez';
  if (!s.comprada) return 'Compre uma carta antes de passar';
  s.ultima = { jogadorId, acao: 'passou' };
  s.seq++;
  avancar(s);
  return s;
}

export function gritarSim(s0: Sim, jogadorId: string): Sim | string {
  const s = clonar(s0);
  const j = s.jogadores.find(x => x.id === jogadorId)!;
  if (j.mao.length > 2) return 'Só dá para gritar UNidos com 1 ou 2 cartas';
  j.gritou = true;
  s.ultima = { jogadorId, acao: 'gritou' };
  s.seq++;
  return s;
}

export function pegarSim(s0: Sim, jogadorId: string, alvoId: string): Sim | string {
  const s = clonar(s0);
  const a = s.jogadores.find(x => x.id === alvoId);
  if (!a || a.mao.length !== 1 || a.gritou) return 'Essa pessoa não esqueceu de gritar';
  a.mao.push(cartaAleatoria(), cartaAleatoria());
  s.ultima = { jogadorId, acao: 'pegou', alvoId, qtd: 2 };
  s.seq++;
  return s;
}

// Joga automaticamente por alguém (adversários da demo)
export function jogadaDoBot(s: Sim): Sim {
  const j = s.jogadores[s.vez];
  const carta = j.mao.find(c => (!s.comprada || c.id === s.comprada) && podeJogar(s, c));
  if (carta) {
    const outros = s.jogadores.filter(x => x.id !== j.id);
    const r = jogarSim(s, j.id, carta.id, { cor: CORES[Math.floor(Math.random() * 4)], alvoId: outros[Math.floor(Math.random() * outros.length)].id });
    if (typeof r !== 'string') return r;
  }
  if (s.comprada) { const r = passarSim(s, j.id); return typeof r === 'string' ? s : r; }
  const r = comprarSim(s, j.id);
  return typeof r === 'string' ? s : r;
}

// Para os botões da demo: faz alguém jogar uma carta específica agora
export function forcarJogada(s0: Sim, jogadorId: string, tipo: Tipo, op: { cor?: Cor; alvoId?: string } = {}): Sim {
  const s = clonar(s0);
  s.status = 'jogando';
  s.vencedorId = null;
  s.vez = s.jogadores.findIndex(x => x.id === jogadorId);
  s.comprada = null;
  s.acumulado = tipo === 'mais2' && s.topo.tipo === 'mais2' ? s.acumulado : tipo === 'todosunidos' && s.topo.tipo === 'todosunidos' ? s.acumulado : 0;
  const carta = cartaAleatoria(tipo, CURINGA(tipo) ? null : s.corAtual);
  const j = s.jogadores[s.vez];
  // Troca uma carta da mão por ela (a contagem de cartas não muda antes da jogada)
  if (j.mao.length > 1) j.mao[0] = carta; else j.mao.push(carta);
  const r = jogarSim(s, jogadorId, carta.id, { cor: op.cor || CORES[Math.floor(Math.random() * 4)], alvoId: op.alvoId });
  return typeof r === 'string' ? s0 : r;
}

export function mexer(s0: Sim, fn: (s: Sim) => void): Sim {
  const s = clonar(s0);
  fn(s);
  s.seq++;
  return s;
}
