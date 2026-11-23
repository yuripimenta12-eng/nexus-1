// Par ou ímpar e votação da call: regras puras (testadas em scripts/testar-escolhas.js)

export type Lado = 'par' | 'impar';
export class ErroEscolha extends Error {}
const erro = (msg: string): never => { throw new ErroEscolha(msg); };

export const PARIMPAR_ESPERA_MS = 60_000;          // o desafiado tem 1 minuto para responder
export const VOTACAO_DURACOES_S = [30, 60, 120, 300] as const;
export const VOTACAO_MAX_OPCOES = 6;

export function lado(v: unknown): Lado {
  return v === 'par' || v === 'impar' ? v : erro('Escolha par ou ímpar');
}

/** Dedos de uma mão: 0 a 5. */
export function numeroDaMao(v: unknown): number {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 5 ? (v as number) : erro('Escolha um número de 0 a 5');
}

/** Quem ganhou: o desafiante escolheu o lado; o desafiado fica com o outro. */
export function resultadoParImpar(ladoDesafiante: Lado, numDesafiante: number, numDesafiado: number) {
  const soma = numDesafiante + numDesafiado;
  const saiu: Lado = soma % 2 === 0 ? 'par' : 'impar';
  return { soma, saiu, ganhou: saiu === ladoDesafiante ? ('desafiante' as const) : ('desafiado' as const) };
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Pergunta e opções limpas: 2 a 6 opções, sem repetidas e sem vazias. */
export function montarVotacao(pergunta: unknown, opcoes: unknown, duracaoS: unknown) {
  const p = texto(pergunta, 120);
  if (!p) erro('Escreva a pergunta');
  if (!Array.isArray(opcoes)) erro('Coloque as opções');
  const vistas = new Set<string>();
  const limpas: string[] = [];
  for (const o of opcoes as unknown[]) {
    const t = texto(o, 60);
    if (!t || vistas.has(t.toLowerCase())) continue;
    vistas.add(t.toLowerCase());
    limpas.push(t);
  }
  if (limpas.length < 2) erro('Coloque pelo menos 2 opções diferentes');
  if (limpas.length > VOTACAO_MAX_OPCOES) erro(`No máximo ${VOTACAO_MAX_OPCOES} opções`);
  const d = (VOTACAO_DURACOES_S as readonly number[]).includes(duracaoS as number) ? (duracaoS as number) : 60;
  return { pergunta: p, opcoes: limpas, duracaoS: d };
}

/** Votos por opção e quem venceu (empate: mais de um). */
export function apurar(totalOpcoes: number, votos: Iterable<number>) {
  const contagem = Array<number>(totalOpcoes).fill(0);
  for (const v of votos) if (v >= 0 && v < totalOpcoes) contagem[v]++;
  const max = Math.max(...contagem);
  const vencedoras = max > 0 ? contagem.flatMap((c, i) => (c === max ? [i] : [])) : [];
  return { contagem, total: contagem.reduce((a, b) => a + b, 0), vencedoras };
}
