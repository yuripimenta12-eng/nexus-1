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

// Live de tela: cada plano tem duas opções e quem transmite escolhe (planos maiores
// também podem usar as dos menores). O FPS escolhido é o teto e o alvo da live.
export interface OpcaoLive { id: string; plano: Plano; width: number; height: number; frameRate: number; maxBitrate: number; rotulo: string }
export const LIVE_OPCOES: OpcaoLive[] = [
  { id: '480p24', plano: 'gratis', width: 854, height: 480, frameRate: 24, maxBitrate: 1_200_000, rotulo: '480p 24fps' },
  { id: '480p30', plano: 'gratis', width: 854, height: 480, frameRate: 30, maxBitrate: 1_500_000, rotulo: '480p 30fps' },
  { id: '720p24', plano: 'mais', width: 1280, height: 720, frameRate: 24, maxBitrate: 2_500_000, rotulo: '720p 24fps' },
  { id: '720p30', plano: 'mais', width: 1280, height: 720, frameRate: 30, maxBitrate: 3_000_000, rotulo: '720p 30fps' },
  { id: '1080p30', plano: 'pro', width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_500_000, rotulo: '1080p 30fps' },
  // 6 Mbps: com a cópia 720p do Pro, mais que isso cortava a voz de quem tem internet fraca
  { id: '1080p60', plano: 'pro', width: 1920, height: 1080, frameRate: 60, maxBitrate: 6_000_000, rotulo: '1080p 60fps' },
];
const NIVEL_LIVE: Record<Plano, number> = { gratis: 0, mais: 1, pro: 2 };
/** O plano libera essa opção? (Pro usa todas; Nexus+ usa as dele e as do Grátis) */
export const podeUsarLive = (plano: Plano, o: OpcaoLive) => NIVEL_LIVE[plano] >= NIVEL_LIVE[o.plano];
/** A melhor opção do plano (padrão de quem nunca escolheu). */
export const melhorLive = (plano: Plano) => [...LIVE_OPCOES].reverse().find(o => o.plano === plano)!;
/** Texto para cartões e página inicial: "720p · 24 ou 30fps". */
export const rotuloLivePlano = (plano: Plano) => {
  const os = LIVE_OPCOES.filter(o => o.plano === plano);
  return `${os[0].height}p ${os.map(o => o.frameRate).join(' ou ')}fps`;
};

// Preços mostrados no site (página de planos e página inicial)
export const PRECO_PLANO: Record<'mais' | 'pro', { mes: string; ano: string }> = {
  mais: { mes: 'R$ 9,90', ano: 'R$ 99' },
  pro: { mes: 'R$ 19,90', ano: 'R$ 199' },
};
