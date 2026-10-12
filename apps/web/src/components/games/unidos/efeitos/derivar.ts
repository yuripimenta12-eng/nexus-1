import type { Carta, Cor, Partida } from '../unidos.store';

// Compara dois estados confirmados pelo servidor e diz o que aconteceu entre
// eles. As animações saem daqui: nada é animado sem o servidor confirmar, e
// todo mundo vê a mesma sequência (a ordem dos estados, pelo `seq`).

export type Acontecimento =
  | { tipo: 'inicio' }
  | { tipo: 'jogou'; jogadorId: string | null; carta: Carta; alvoId?: string | null; cor: Cor | null; bloqueadoId?: string | null; sentido: 1 | -1; doisJogadores: boolean; vezId: string | null; acumulado: number }
  | { tipo: 'comprou'; jogadorId: string; qtd: number; penalidade: number; pego: boolean }
  | { tipo: 'vez'; de: string | null; para: string }
  | { tipo: 'gritou'; jogadorId: string }
  | { tipo: 'ultimaCarta'; jogadorId: string }
  | { tipo: 'ausente'; jogadorId: string }
  | { tipo: 'voltou'; jogadorId: string }
  | { tipo: 'saiu'; jogadorId: string }
  | { tipo: 'fim'; vencedorId: string | null; pontos: number; duracao: number };

export function derivar(ant: Partida | null, nova: Partida): Acontecimento[] {
  // Primeiro estado que vemos (abriu a mesa no meio): nada para animar
  if (!ant || ant.id !== nova.id) return [];
  if (nova.seq <= ant.seq) return [];
  const out: Acontecimento[] = [];

  // Começou (ou revanche): distribui as cartas
  if (nova.status === 'jogando' && ant.status !== 'jogando') {
    out.push({ tipo: 'inicio' });
    if (nova.vezId) out.push({ tipo: 'vez', de: null, para: nova.vezId });
    return out;
  }

  const u = nova.ultima;
  const antes = new Map(ant.jogadores.map(j => [j.id, j]));
  const depois = new Map(nova.jogadores.map(j => [j.id, j]));

  // Saiu da mesa
  for (const j of ant.jogadores) if (!depois.has(j.id)) out.push({ tipo: 'saiu', jogadorId: j.id });

  // Carta nova na mesa
  if (nova.topo && nova.topo.id !== ant.topo?.id) {
    const jogadorId = u?.acao === 'jogou' && u.carta?.id === nova.topo.id ? u.jogadorId : null;
    const n = nova.jogadores.length;
    let bloqueadoId: string | null = null;
    if (nova.topo.tipo === 'bloqueio' && jogadorId) {
      // Quem foi pulado: o próximo de quem jogou, no sentido atual
      const i = nova.jogadores.findIndex(j => j.id === jogadorId);
      if (i >= 0 && n > 1) bloqueadoId = nova.jogadores[((i + nova.sentido) % n + n) % n].id;
    }
    out.push({
      tipo: 'jogou', jogadorId, carta: nova.topo, alvoId: u?.acao === 'jogou' ? u.alvoId ?? null : null,
      cor: nova.corAtual, bloqueadoId, sentido: nova.sentido, doisJogadores: n === 2,
      vezId: nova.vezId, acumulado: nova.acumulado,
    });
  }

  // Compras: quem ficou com mais cartas (cobre também compra automática no fim do tempo)
  for (const j of nova.jogadores) {
    const a = antes.get(j.id);
    if (!a) continue;
    const jogouAgora = out.some(x => x.tipo === 'jogou' && x.jogadorId === j.id) ? 1 : 0;
    const qtd = j.cartas - a.cartas + jogouAgora;
    if (qtd > 0) {
      const pego = u?.acao === 'pegou' && u.alvoId === j.id;
      const penalidade = pego ? qtd : (ant.acumulado > 0 && nova.acumulado === 0 && qtd >= ant.acumulado ? ant.acumulado : 0);
      out.push({ tipo: 'comprou', jogadorId: j.id, qtd, penalidade, pego });
    }
  }

  // Gritou UNidos!
  if (u?.acao === 'gritou') {
    const a = antes.get(u.jogadorId);
    if (a && !a.gritou) out.push({ tipo: 'gritou', jogadorId: u.jogadorId });
  }

  // Ficou com 1 carta (aviso sem revelar a carta)
  for (const j of nova.jogadores) {
    const a = antes.get(j.id);
    if (a && a.cartas > 1 && j.cartas === 1 && nova.status === 'jogando') out.push({ tipo: 'ultimaCarta', jogadorId: j.id });
  }

  // Caiu / voltou para a chamada
  for (const j of nova.jogadores) {
    const a = antes.get(j.id);
    if (!a) continue;
    if (!a.ausente && j.ausente) out.push({ tipo: 'ausente', jogadorId: j.id });
    if (a.ausente && !j.ausente) out.push({ tipo: 'voltou', jogadorId: j.id });
  }

  if (nova.status === 'fim' && ant.status === 'jogando') {
    out.push({ tipo: 'fim', vencedorId: nova.vencedorId, pontos: nova.pontos ?? 0, duracao: nova.duracao ?? 0 });
    return out;
  }

  // Mudou a vez
  if (nova.status === 'jogando' && nova.vezId && nova.vezId !== ant.vezId) out.push({ tipo: 'vez', de: ant.vezId, para: nova.vezId });

  return out;
}
