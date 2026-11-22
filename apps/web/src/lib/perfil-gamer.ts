// Perfil gamer: jogos, conexões e o que mais aparece no perfil.
// O servidor limpa tudo (apps/server/src/users/perfil-gamer.ts); aqui é só exibição.

export interface JogoPerfil { jogo: string; rank?: string; nick?: string }
export type Rede = 'steam' | 'twitch' | 'youtube' | 'instagram' | 'tiktok' | 'kick' | 'riot' | 'xbox' | 'psn' | 'epic';
export type Conexoes = Partial<Record<Rede, string>>;

export interface PerfilCompleto {
  id: string;
  username: string;
  createdAt?: string;
  isBetaTester?: boolean;
  plano?: string | null;
  profile?: {
    displayName?: string; avatarUrl?: string | null; bannerUrl?: string | null; bannerColor?: string | null;
    bio?: string | null; customStatus?: string | null; moldura?: string | null; icone?: string | null; placa?: string | null; efeitoPerfil?: string | null;
    corNome?: string | null; jogos?: JogoPerfil[] | null; conexoes?: Conexoes | null; procurandoDuo?: boolean;
  } | null;
  numeros?: { horasCall: number; vitoriasUnidos: number };
  emComum?: { servidores: { id: string; name: string; iconUrl: string | null }[]; amigos: number } | null;
  jogando?: { nome: string; desde: number | null } | null;
}

const enc = encodeURIComponent;
// link: só redes com perfil por endereço; as outras mostram o nome (clique copia)
export const REDES: { id: Rede; nome: string; cor: string; letra: string; dica: string; link?: (u: string) => string }[] = [
  { id: 'twitch', nome: 'Twitch', cor: '#9146ff', letra: 'Tw', dica: 'seu_canal', link: u => `https://twitch.tv/${enc(u)}` },
  { id: 'youtube', nome: 'YouTube', cor: '#ff0033', letra: 'YT', dica: 'seucanal (sem @)', link: u => `https://youtube.com/@${enc(u)}` },
  { id: 'tiktok', nome: 'TikTok', cor: '#25f4ee', letra: 'TT', dica: 'seu_user', link: u => `https://tiktok.com/@${enc(u)}` },
  { id: 'instagram', nome: 'Instagram', cor: '#e1306c', letra: 'IG', dica: 'seu_user', link: u => `https://instagram.com/${enc(u)}` },
  { id: 'kick', nome: 'Kick', cor: '#53fc18', letra: 'K', dica: 'seu_canal', link: u => `https://kick.com/${enc(u)}` },
  { id: 'steam', nome: 'Steam', cor: '#66c0f4', letra: 'St', dica: 'id do perfil', link: u => `https://steamcommunity.com/id/${enc(u)}` },
  { id: 'riot', nome: 'Riot ID', cor: '#ff4655', letra: 'R', dica: 'Nome #TAG' },
  { id: 'epic', nome: 'Epic', cor: '#d6d6d6', letra: 'E', dica: 'nome na Epic' },
  { id: 'xbox', nome: 'Xbox', cor: '#107c10', letra: 'X', dica: 'gamertag' },
  { id: 'psn', nome: 'PlayStation', cor: '#3f7cff', letra: 'PS', dica: 'ID da PSN' },
];

// Sugestões no editor (dá para digitar qualquer outro)
export const JOGOS_SUGERIDOS = [
  'Valorant', 'Counter-Strike 2', 'Free Fire', 'League of Legends', 'Fortnite', 'Minecraft', 'GTA RP', 'GTA V',
  'Roblox', 'EA FC', 'Rocket League', 'Apex Legends', 'Call of Duty', 'Warzone', 'PUBG', 'Rainbow Six Siege',
  'Dota 2', 'Overwatch 2', 'Marvel Rivals', 'Brawl Stars', 'Clash Royale', 'Genshin Impact', 'Among Us', 'Rust',
  'Dead by Daylight', 'Lethal Company', 'R.E.P.O.', 'PEAK', 'Mobile Legends', 'Teamfight Tactics',
];

/** "há 1h20" / "há 12 min" */
export function tempoDesde(desde: number | null | undefined, agora = Date.now()): string | null {
  if (!desde) return null;
  const min = Math.max(0, Math.floor((agora - desde) / 60000));
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h${String(min % 60).padStart(2, '0')}`;
}

export const mesAno = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/') : '—';
