// Perfil gamer: limpa o que vem do editor (jogos, conexões, cor do nome).
// Sem dependências: testado em scripts/testar-perfil.js.

export const MAX_JOGOS = 6;
// Redes aceitas. O site monta o link de cada uma (as sem link só mostram o nome).
export const REDES = ['steam', 'twitch', 'youtube', 'instagram', 'tiktok', 'kick', 'riot', 'xbox', 'psn', 'epic'] as const;
export type Rede = (typeof REDES)[number];

export interface Jogo { jogo: string; rank?: string; nick?: string }

// Letras (com acento), números, espaço e . _ - # ' : + ! & — nada de < > " / ou controle
const TEXTO_OK = /^[\p{L}\p{N} ._\-#':+!&]+$/u;
// Nome de usuário em rede social: sem espaço; riot/xbox/psn/epic aceitam espaço e #
const USUARIO_OK = /^[\p{L}\p{N}._\-]+$/u;
const ID_JOGO_OK = /^[\p{L}\p{N} ._\-#]+$/u;

function texto(v: unknown, max: number, re = TEXTO_OK): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!t || t.length > max || !re.test(t)) return undefined;
  return t;
}

/** Lista de jogos: até 6, sem repetir, rank e nick opcionais. Item inválido é descartado. */
export function limparJogos(v: unknown): Jogo[] | null {
  if (v === null) return null;
  if (!Array.isArray(v)) throw new Error('Jogos inválidos');
  const out: Jogo[] = [];
  const vistos = new Set<string>();
  for (const bruto of v.slice(0, 20)) {
    if (!bruto || typeof bruto !== 'object') continue;
    const b = bruto as Record<string, unknown>;
    const jogo = texto(b.jogo, 40);
    if (!jogo || vistos.has(jogo.toLowerCase())) continue;
    vistos.add(jogo.toLowerCase());
    const item: Jogo = { jogo };
    const rank = texto(b.rank, 30); if (rank) item.rank = rank;
    const nick = texto(b.nick, 40, ID_JOGO_OK); if (nick) item.nick = nick;
    out.push(item);
    if (out.length >= MAX_JOGOS) break;
  }
  return out.length ? out : null;
}

/** Conexões: só as redes conhecidas; valor vazio apaga. */
export function limparConexoes(v: unknown): Partial<Record<Rede, string>> | null {
  if (v === null) return null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Conexões inválidas');
  const b = v as Record<string, unknown>;
  const out: Partial<Record<Rede, string>> = {};
  for (const r of REDES) {
    const comEspaco = r === 'riot' || r === 'xbox' || r === 'psn' || r === 'epic';
    const valor = texto(typeof b[r] === 'string' ? (b[r] as string).replace(/^@/, '') : b[r], 40, comEspaco ? ID_JOGO_OK : USUARIO_OK);
    if (valor) out[r] = valor;
  }
  return Object.keys(out).length ? out : null;
}

/** Cor do nome: "#rrggbb" ou degradê "#rrggbb,#rrggbb" (minúsculo). */
export function limparCorNome(v: unknown): string | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})?$/.test(v)) throw new Error('Cor do nome inválida');
  return v.toLowerCase();
}
