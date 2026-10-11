// UNidos — regras do jogo de cartas do Nexus (só o servidor executa isto).
// Funções puras sobre o estado: fáceis de testar e impossíveis de trapacear
// pelo navegador (o cliente só recebe a própria mão e a visão pública).

export type Cor = 'laranja' | 'roxo' | 'ciano' | 'verde';
export type Tipo = 'numero' | 'mutado' | 'eco' | 'mais2' | 'troca' | 'portal' | 'tempestade';

export const CORES: Cor[] = ['laranja', 'roxo', 'ciano', 'verde'];
export const MAO_INICIAL = 7;
export const MIN_JOGADORES = 2;
export const MAX_JOGADORES = 8;

export interface Carta { id: string; cor: Cor | null; tipo: Tipo; valor?: number }

export interface Jogador {
  id: string;
  nome: string;
  avatarUrl: string | null;
  mao: Carta[];
  gritou: boolean;   // apertou "UNidos!" com 1–2 cartas
  ausente: boolean;  // saiu da chamada / caiu: as vezes dele andam sozinhas
}

export interface Jogada { jogadorId: string; acao: string; carta?: Carta; alvoId?: string; qtd?: number }

export interface Estado {
  id: string;
  voiceRoomId: string;
  hostId: string;
  status: 'lobby' | 'jogando' | 'fim';
  jogadores: Jogador[];
  monte: Carta[];
  descarte: Carta[];
  corAtual: Cor | null;
  vez: number;          // índice em jogadores
  sentido: 1 | -1;
  acumulado: number;    // +2/+4 empilhados esperando alguém comprar
  comprada: string | null; // carta comprada nesta vez (só ela pode ser jogada)
  vencedorId: string | null;
  ultima: Jogada | null;
  prazo: number;        // quando acaba o tempo da vez (ms)
  seq: number;          // muda a cada jogada (o cliente ignora estados velhos)
}

export type Rng = () => number;

export class ErroJogo extends Error {}
const erro = (msg: string) => { throw new ErroJogo(msg); };

// ── Baralho: 112 cartas ─────────────────────────────────────────────
export function criarBaralho(): Carta[] {
  const cartas: Carta[] = [];
  let n = 0;
  const id = () => `c${(n++).toString(36)}`;
  for (const cor of CORES) {
    cartas.push({ id: id(), cor, tipo: 'numero', valor: 0 });
    for (let v = 1; v <= 9; v++) {
      cartas.push({ id: id(), cor, tipo: 'numero', valor: v });
      cartas.push({ id: id(), cor, tipo: 'numero', valor: v });
    }
    for (const tipo of ['mutado', 'eco', 'mais2'] as Tipo[]) {
      cartas.push({ id: id(), cor, tipo });
      cartas.push({ id: id(), cor, tipo });
    }
    cartas.push({ id: id(), cor, tipo: 'troca' });
  }
  for (let i = 0; i < 4; i++) {
    cartas.push({ id: id(), cor: null, tipo: 'portal' });
    cartas.push({ id: id(), cor: null, tipo: 'tempestade' });
  }
  return cartas;
}

export function embaralhar<T>(lista: T[], rng: Rng): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Partida ─────────────────────────────────────────────────────────
export function novaPartida(id: string, voiceRoomId: string, host: { id: string; nome: string; avatarUrl: string | null }): Estado {
  return {
    id, voiceRoomId, hostId: host.id, status: 'lobby',
    jogadores: [{ ...host, mao: [], gritou: false, ausente: false }],
    monte: [], descarte: [], corAtual: null, vez: 0, sentido: 1, acumulado: 0,
    comprada: null, vencedorId: null, ultima: null, prazo: 0, seq: 0,
  };
}

export function entrar(e: Estado, j: { id: string; nome: string; avatarUrl: string | null }) {
  if (e.status !== 'lobby') erro('A partida já começou');
  if (e.jogadores.some(p => p.id === j.id)) return;
  if (e.jogadores.length >= MAX_JOGADORES) erro(`A mesa está cheia (máximo ${MAX_JOGADORES})`);
  e.jogadores.push({ ...j, mao: [], gritou: false, ausente: false });
  e.seq++;
}

export function iniciar(e: Estado, rng: Rng, agora = Date.now(), tempoVez = 30_000) {
  if (e.status === 'jogando') erro('A partida já está rolando');
  const ativos = e.jogadores.filter(p => !p.ausente);
  if (ativos.length < MIN_JOGADORES) erro('Precisa de pelo menos 2 jogadores');
  e.jogadores = ativos;
  e.monte = embaralhar(criarBaralho(), rng);
  e.descarte = [];
  for (const p of e.jogadores) { p.mao = e.monte.splice(0, MAO_INICIAL); p.gritou = false; }
  // A primeira carta da mesa é sempre um número (especial volta para o monte)
  let topo = e.monte.shift()!;
  while (topo.tipo !== 'numero') {
    e.monte.push(topo);
    topo = e.monte.shift()!;
  }
  e.descarte.push(topo);
  e.corAtual = topo.cor;
  e.status = 'jogando';
  e.sentido = 1;
  e.acumulado = 0;
  e.comprada = null;
  e.vencedorId = null;
  e.vez = Math.floor(rng() * e.jogadores.length);
  e.ultima = { jogadorId: e.jogadores[e.vez].id, acao: 'inicio' };
  e.prazo = agora + tempoVez;
  e.seq++;
}

export const topo = (e: Estado) => e.descarte[e.descarte.length - 1];
export const daVez = (e: Estado) => e.jogadores[e.vez];

function jogadorOuErro(e: Estado, jogadorId: string) {
  const j = e.jogadores.find(p => p.id === jogadorId);
  if (!j) erro('Você não está nesta partida');
  return j!;
}

function exigirVez(e: Estado, jogadorId: string) {
  if (e.status !== 'jogando') erro('A partida não está rolando');
  if (daVez(e).id !== jogadorId) erro('Não é a sua vez');
}

// Pode jogar esta carta agora?
export function podeJogar(e: Estado, carta: Carta): boolean {
  const t = topo(e);
  if (e.acumulado > 0) {
    // Com +2/+4 acumulado só dá para empilhar o mesmo tipo
    return (t.tipo === 'mais2' && carta.tipo === 'mais2') || (t.tipo === 'tempestade' && carta.tipo === 'tempestade');
  }
  if (carta.tipo === 'portal' || carta.tipo === 'tempestade') return true;
  if (carta.cor === e.corAtual) return true;
  if (carta.tipo === 'numero') return t.tipo === 'numero' && t.valor === carta.valor;
  return carta.tipo === t.tipo;
}

function avancar(e: Estado, passos = 1) {
  const n = e.jogadores.length;
  e.vez = (((e.vez + e.sentido * passos) % n) + n) % n;
  e.comprada = null;
}

// Repõe o monte com o descarte (menos a carta de cima) quando acabar
function comprarDoMonte(e: Estado, rng: Rng, qtd: number): Carta[] {
  const out: Carta[] = [];
  for (let i = 0; i < qtd; i++) {
    if (!e.monte.length) {
      const t = e.descarte.pop()!;
      e.monte = embaralhar(e.descarte, rng);
      e.descarte = [t];
      if (!e.monte.length) break; // todas as cartas estão nas mãos
    }
    out.push(e.monte.shift()!);
  }
  return out;
}

function ajustarGrito(j: Jogador) { if (j.mao.length > 2) j.gritou = false; }

export interface OpcoesJogada { cor?: Cor; alvoId?: string }

export function jogar(e: Estado, jogadorId: string, cartaId: string, op: OpcoesJogada, rng: Rng, agora = Date.now(), tempoVez = 30_000) {
  exigirVez(e, jogadorId);
  const j = jogadorOuErro(e, jogadorId);
  const idx = j.mao.findIndex(c => c.id === cartaId);
  if (idx < 0) erro('Essa carta não está na sua mão');
  const carta = j.mao[idx];
  if (e.comprada && e.comprada !== carta.id) erro('Depois de comprar, só dá para jogar a carta que você comprou');
  if (!podeJogar(e, carta)) erro(e.acumulado > 0 ? `Jogue um ${topo(e).tipo === 'mais2' ? 'Ping +2' : 'Tempestade +4'} ou compre ${e.acumulado}` : 'Essa carta não combina com a da mesa');

  const preta = carta.tipo === 'portal' || carta.tipo === 'tempestade';
  if (preta && !CORES.includes(op.cor as Cor)) erro('Escolha uma cor');
  let alvo: Jogador | undefined;
  if (carta.tipo === 'troca') {
    alvo = e.jogadores.find(p => p.id === op.alvoId);
    if (!alvo || alvo.id === j.id) erro('Escolha com quem trocar a mão');
  }

  j.mao.splice(idx, 1);
  e.descarte.push(carta);
  e.corAtual = preta ? (op.cor as Cor) : carta.cor;
  e.ultima = { jogadorId, acao: 'jogou', carta, alvoId: alvo?.id };

  if (carta.tipo === 'troca' && alvo) {
    [j.mao, alvo.mao] = [alvo.mao, j.mao];
    j.gritou = false; alvo.gritou = false;
  }

  // Acabou a mão: venceu (mesmo que a última carta seja um +2/+4)
  if (j.mao.length === 0) {
    e.status = 'fim';
    e.vencedorId = j.id;
    e.comprada = null;
    e.prazo = 0;
    e.seq++;
    return;
  }
  ajustarGrito(j);

  const n = e.jogadores.length;
  switch (carta.tipo) {
    case 'mutado': avancar(e, 2); break;
    case 'eco':
      e.sentido = (e.sentido * -1) as 1 | -1;
      avancar(e, n === 2 ? 2 : 1); // com 2 jogadores, inverter = jogar de novo
      break;
    case 'mais2': e.acumulado += 2; avancar(e); break;
    case 'tempestade': e.acumulado += 4; avancar(e); break;
    default: avancar(e);
  }
  e.prazo = agora + tempoVez;
  e.seq++;
  void rng;
}

// Comprar: com +2/+4 acumulado leva tudo e perde a vez; senão compra 1 e,
// se ela servir, pode jogá-la (ou passar)
export function comprar(e: Estado, jogadorId: string, rng: Rng, agora = Date.now(), tempoVez = 30_000): Carta[] {
  exigirVez(e, jogadorId);
  const j = jogadorOuErro(e, jogadorId);
  if (e.comprada) erro('Você já comprou nesta vez: jogue a carta ou passe');
  if (e.acumulado > 0) {
    const cartas = comprarDoMonte(e, rng, e.acumulado);
    j.mao.push(...cartas);
    e.ultima = { jogadorId, acao: 'comprou', qtd: cartas.length };
    e.acumulado = 0;
    ajustarGrito(j);
    avancar(e);
    e.prazo = agora + tempoVez;
    e.seq++;
    return cartas;
  }
  const cartas = comprarDoMonte(e, rng, 1);
  j.mao.push(...cartas);
  ajustarGrito(j);
  e.ultima = { jogadorId, acao: 'comprou', qtd: cartas.length };
  if (cartas[0] && podeJogar(e, cartas[0])) {
    e.comprada = cartas[0].id; // pode jogar essa (ou passar)
  } else {
    avancar(e);
    e.prazo = agora + tempoVez;
  }
  e.seq++;
  return cartas;
}

export function passar(e: Estado, jogadorId: string, agora = Date.now(), tempoVez = 30_000) {
  exigirVez(e, jogadorId);
  if (!e.comprada) erro('Compre uma carta antes de passar');
  e.ultima = { jogadorId, acao: 'passou' };
  avancar(e);
  e.prazo = agora + tempoVez;
  e.seq++;
}

// "UNidos!": vale com 1 ou 2 cartas na mão (dá para avisar antes de jogar a penúltima)
export function gritar(e: Estado, jogadorId: string) {
  if (e.status !== 'jogando') erro('A partida não está rolando');
  const j = jogadorOuErro(e, jogadorId);
  if (j.mao.length > 2) erro('Só dá para gritar UNidos com 1 ou 2 cartas');
  j.gritou = true;
  e.ultima = { jogadorId, acao: 'gritou' };
  e.seq++;
}

// Pegou alguém com 1 carta que esqueceu de gritar: ele compra 2
export function pegar(e: Estado, quemId: string, alvoId: string, rng: Rng) {
  if (e.status !== 'jogando') erro('A partida não está rolando');
  jogadorOuErro(e, quemId);
  const alvo = jogadorOuErro(e, alvoId);
  if (alvo.id === quemId) erro('Você não pode pegar a si mesmo');
  if (alvo.mao.length !== 1 || alvo.gritou) erro('Essa pessoa não esqueceu de gritar');
  alvo.mao.push(...comprarDoMonte(e, rng, 2));
  ajustarGrito(alvo);
  e.ultima = { jogadorId: quemId, acao: 'pegou', alvoId: alvo.id, qtd: 2 };
  e.seq++;
}

// Tempo esgotado (ou jogador ausente): compra por ele e passa a vez
export function tempoEsgotado(e: Estado, rng: Rng, agora = Date.now(), tempoVez = 30_000) {
  if (e.status !== 'jogando') return;
  const j = daVez(e);
  if (!e.comprada) comprar(e, j.id, rng, agora, tempoVez);
  if (e.status === 'jogando' && e.comprada && daVez(e).id === j.id) passar(e, j.id, agora, tempoVez);
}

// Alguém saiu no meio: as cartas dele voltam para o fundo do monte
export function sair(e: Estado, jogadorId: string, agora = Date.now(), tempoVez = 30_000) {
  const idx = e.jogadores.findIndex(p => p.id === jogadorId);
  if (idx < 0) return;
  const [saiu] = e.jogadores.splice(idx, 1);
  if (e.status === 'jogando') {
    e.monte.push(...saiu.mao);
    if (e.jogadores.length < MIN_JOGADORES) {
      e.status = 'fim';
      e.vencedorId = e.jogadores[0]?.id ?? null;
      e.prazo = 0;
    } else {
      if (idx < e.vez) e.vez--;
      else if (idx === e.vez) { e.vez = e.vez % e.jogadores.length; e.comprada = null; e.prazo = agora + tempoVez; }
      e.vez = e.vez % e.jogadores.length;
    }
    e.ultima = { jogadorId, acao: 'saiu' };
  }
  if (e.hostId === jogadorId && e.jogadores.length) e.hostId = e.jogadores[0].id;
  e.seq++;
}

// O que cada pessoa pode ver: a própria mão + quantas cartas os outros têm
export function visao(e: Estado, quemId: string) {
  const eu = e.jogadores.find(p => p.id === quemId);
  const t = e.descarte.length ? topo(e) : null;
  const minhaVez = e.status === 'jogando' && !!eu && daVez(e).id === quemId;
  return {
    id: e.id,
    voiceRoomId: e.voiceRoomId,
    hostId: e.hostId,
    status: e.status,
    seq: e.seq,
    jogadores: e.jogadores.map(p => ({
      id: p.id, nome: p.nome, avatarUrl: p.avatarUrl, cartas: p.mao.length,
      gritou: p.gritou, ausente: p.ausente,
      esqueceu: e.status === 'jogando' && p.mao.length === 1 && !p.gritou,
    })),
    topo: t,
    corAtual: e.corAtual,
    vezId: e.status === 'jogando' ? daVez(e).id : null,
    sentido: e.sentido,
    acumulado: e.acumulado,
    monte: e.monte.length,
    comprada: minhaVez ? e.comprada : null,
    vencedorId: e.vencedorId,
    ultima: e.ultima,
    prazo: e.prazo,
    // Tempo que falta, medido no servidor (o relógio de cada PC pode estar diferente)
    restante: e.status === 'jogando' ? Math.max(0, e.prazo - Date.now()) : 0,
    minhaMao: eu ? eu.mao : [],
    jogaveis: minhaVez ? eu!.mao.filter(c => (!e.comprada || c.id === e.comprada) && podeJogar(e, c)).map(c => c.id) : [],
  };
}
export type Visao = ReturnType<typeof visao>;
