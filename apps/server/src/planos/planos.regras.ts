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

// O que cada plano libera (o site mostra o mesmo em apps/web/src/lib/planos.ts)
export const BENEFICIOS: Record<Plano, { arquivoMB: number; avatarAnimado: boolean; corNome: boolean; filaDj: number }> = {
  gratis: { arquivoMB: 50, avatarAnimado: false, corNome: false, filaDj: 15 },
  mais: { arquivoMB: 100, avatarAnimado: true, corNome: true, filaDj: 25 },
  pro: { arquivoMB: 200, avatarAnimado: true, corNome: true, filaDj: 50 },
};
/** Maior arquivo que alguém pode mandar (teto do multer). */
export const ARQUIVO_MAX_MB = BENEFICIOS.pro.arquivoMB;

const NIVEL: Record<Plano, number> = { gratis: 0, mais: 1, pro: 2 };
/** O plano atual cobre o exigido? (Pro cobre o Nexus+) */
export function planoCobre(atual: Plano, exigido: Plano): boolean {
  return NIVEL[atual] >= NIVEL[exigido];
}
