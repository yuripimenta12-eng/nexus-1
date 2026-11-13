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

// Live de tela: quem define é o plano de quem transmite
export const LIVE_POR_PLANO: Record<Plano, { width: number; height: number; frameRate: number; maxBitrate: number; rotulo: string }> = {
  gratis: { width: 960, height: 540, frameRate: 60, maxBitrate: 2_500_000, rotulo: '540p 60fps' },
  mais: { width: 1280, height: 720, frameRate: 60, maxBitrate: 4_500_000, rotulo: '720p 60fps' },
  pro: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000, rotulo: '1080p 60fps' },
};

// Preços mostrados no site (página de planos e página inicial)
export const PRECO_PLANO: Record<'mais' | 'pro', { mes: string; ano: string }> = {
  mais: { mes: 'R$ 9,90', ano: 'R$ 99' },
  pro: { mes: 'R$ 19,90', ano: 'R$ 199' },
};
