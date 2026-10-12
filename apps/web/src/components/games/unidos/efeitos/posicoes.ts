// Onde estão as coisas na tela (para as animações saberem de onde e para
// onde voar). Cada parte da mesa marca o elemento com data-unidos-alvo:
//   "monte", "pilha", "mao", "jogador:<id>" (o meu é a minha área da mão)

export interface Ponto { x: number; y: number; w: number; h: number }

export function rectDe(chave: string): DOMRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-unidos-alvo="${chave}"]`);
  return el ? el.getBoundingClientRect() : null;
}

export function centro(r: DOMRect | null | undefined): Ponto | null {
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
}

export const pontoDe = (chave: string) => centro(rectDe(chave));
export const pontoJogador = (id: string | null | undefined) => (id ? pontoDe(`jogador:${id}`) : null);

// Centro da mesa (a pilha); se ainda não existir, o meio da tela
export function pontoMesa(): Ponto {
  return pontoDe('pilha') || { x: window.innerWidth / 2, y: window.innerHeight / 2, w: 100, h: 150 };
}

// De onde saiu a carta que eu joguei: guardado antes de mandar a jogada,
// porque o elemento some da mão quando o servidor confirma.
export const origensJogada = new Map<string, { rect: DOMRect; rot: number }>();
export function lembrarOrigem(cartaId: string, el: Element | null, rot = 0) {
  if (!el) return;
  origensJogada.set(cartaId, { rect: el.getBoundingClientRect(), rot });
  // Não acumula para sempre
  if (origensJogada.size > 20) origensJogada.delete(origensJogada.keys().next().value as string);
}
