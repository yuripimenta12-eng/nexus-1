// Planos do Nexus: o que cada um libera. Os preços são do site (o dono muda aqui).
export type Plano = 'gratis' | 'mais' | 'pro';

export const NOME_PLANO: Record<Plano, string> = { gratis: 'Grátis', mais: 'Nexus+', pro: 'Nexus Pro' };

/** Plano que vale agora (pago só até a validade). Igual ao do servidor. */
export function planoAtivo(u: { plano?: string | null; planoAte?: string | Date | null } | null | undefined): Plano {
  const p = u?.plano;
  if (p !== 'mais' && p !== 'pro') return 'gratis';
  // Perfil de outra pessoa vem sem a data: o servidor já zera o plano vencido
  if (u?.planoAte === undefined) return p;
  return u.planoAte && new Date(u.planoAte).getTime() > Date.now() ? p : 'gratis';
}

// O que cada plano libera (igual a BENEFICIOS em apps/server/src/planos/planos.regras.ts)
export const BENEFICIOS: Record<Plano, { arquivoMB: number; avatarAnimado: boolean; corNome: boolean; filaDj: number }> = {
  gratis: { arquivoMB: 50, avatarAnimado: false, corNome: false, filaDj: 15 },
  mais: { arquivoMB: 100, avatarAnimado: true, corNome: true, filaDj: 25 },
  pro: { arquivoMB: 200, avatarAnimado: true, corNome: true, filaDj: 50 },
};

/** Cor do nome escolhida (só vale com Nexus+ ou Pro ativo). */
export function corNomeDe(u: { plano?: string | null; planoAte?: string | Date | null; profile?: { corNome?: string | null } | null } | null | undefined): string | null {
  const c = u?.profile?.corNome;
  return c && BENEFICIOS[planoAtivo(u)].corNome ? c : null;
}

// Live de tela: quem define é o plano de quem transmite
export const LIVE_POR_PLANO: Record<Plano, { width: number; height: number; frameRate: number; maxBitrate: number; rotulo: string }> = {
  gratis: { width: 960, height: 540, frameRate: 60, maxBitrate: 2_500_000, rotulo: '540p 60fps' },
  mais: { width: 1280, height: 720, frameRate: 60, maxBitrate: 4_500_000, rotulo: '720p 60fps' },
  // 6 Mbps (antes 8): com a cópia 720p, 8+3 Mbps de envio cortava a voz de quem tem internet fraca
  pro: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 6_000_000, rotulo: '1080p 60fps' },
};

// Preços mostrados no site (página de planos e página inicial)
export const PRECO_PLANO: Record<'mais' | 'pro', { mes: string; ano: string }> = {
  mais: { mes: 'R$ 9,90', ano: 'R$ 99' },
  pro: { mes: 'R$ 19,90', ano: 'R$ 199' },
};
