// Valores vindos de outros usuários que vão parar em CSS ou <img>.
// Texto livre em "background" vira url(...) e faz quem vê baixar de outro site
// (pixel espião que revela o IP); por isso só cores hex passam.
export function corSegura(c: string | null | undefined, padrao = '#99aab5'): string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : padrao;
}

// Capa da música do DJ: só dos sites de onde o DJ toca (YouTube/SoundCloud)
const HOSTS_CAPA = ['ytimg.com', 'sndcdn.com', 'ggpht.com', 'googleusercontent.com'];
export function capaSegura(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOSTS_CAPA.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) ? url : null;
  } catch { return null; }
}
