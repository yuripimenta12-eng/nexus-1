// Contas dos planos sem dependências (testadas em scripts/testar-planos.js)

export const PLANOS = ['gratis', 'mais', 'pro'] as const;
export type Plano = (typeof PLANOS)[number];

// Quem indicou ganha isto quando a pessoa indicada ganha o primeiro plano pago
export const DIAS_POR_INDICACAO = 30;

export function ehPlano(v: unknown): v is Plano {
  return typeof v === 'string' && (PLANOS as readonly string[]).includes(v);
}

/** Plano que vale agora: pago só até a data de validade. */
export function planoAtivo(plano: string | null | undefined, ate: Date | null | undefined, agora = new Date()): Plano {
  if (!ehPlano(plano) || plano === 'gratis') return 'gratis';
  return ate && ate.getTime() > agora.getTime() ? plano : 'gratis';
}

/** Soma dias a partir da validade atual (se ainda vale) ou de agora. */
export function estender(ate: Date | null | undefined, dias: number, agora = new Date()): Date {
  const base = ate && ate.getTime() > agora.getTime() ? ate.getTime() : agora.getTime();
  return new Date(base + dias * 86_400_000);
}

/**
 * Recompensa de quem indicou: estende o plano pago que já tem; se está no
 * grátis, ganha Nexus+ pelos dias da indicação.
 */
export function recompensaIndicacao(plano: string | null | undefined, ate: Date | null | undefined, agora = new Date()) {
  const atual = planoAtivo(plano, ate, agora);
  return {
    plano: atual === 'gratis' ? ('mais' as Plano) : atual,
    planoAte: estender(atual === 'gratis' ? null : ate, DIAS_POR_INDICACAO, agora),
  };
}
