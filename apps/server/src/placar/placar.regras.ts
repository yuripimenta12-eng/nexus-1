// Contas do placar sem dependências (testadas em scripts/testar-placar.js)
import { createHmac, timingSafeEqual } from 'crypto';

// O site manda um batimento por minuto. Só conta o tempo que passou de verdade
// desde o anterior (no máx. 75 s); depois de 150 s sem batimento a contagem
// recomeça do zero (a pessoa saiu, fechou o app ou caiu).
export function segundosACreditar(ultimo: Date | null | undefined, agora: Date): number {
  if (!ultimo) return 0;
  const passou = (agora.getTime() - ultimo.getTime()) / 1000;
  if (passou <= 0 || passou > 150) return 0;
  return Math.round(Math.min(passou, 75));
}

// Conquistas de evento: só dá para ganhar dentro da janela (horário de Brasília, UTC-3 o ano todo)
export const EVENTOS: { chave: string; inicio: string; fim: string }[] = [
  { chave: 'natal-2026', inicio: '2026-12-24T00:00:00-03:00', fim: '2026-12-26T00:00:00-03:00' },
  { chave: 'virada-2027', inicio: '2026-12-31T23:30:00-03:00', fim: '2027-01-01T00:30:00-03:00' },
  // Carnaval 2027: sábado 06/02 até a terça 09/02 (a Páscoa de 2027 é 28/03)
  { chave: 'carnaval-2027', inicio: '2027-02-06T00:00:00-03:00', fim: '2027-02-10T00:00:00-03:00' },
];
export function eventosAtivos(agora: Date): string[] {
  const t = agora.getTime();
  return EVENTOS.filter(e => t >= new Date(e.inicio).getTime() && t < new Date(e.fim).getTime()).map(e => e.chave);
}
// "Nexus 2026": quem usou o Nexus no primeiro ano
export const FIM_NEXUS_2026 = new Date('2027-01-01T00:00:00-03:00');
// "Maratonista": tanto tempo seguido na mesma call
export const MARATONA_MS = 5 * 3600_000;
// Tempo de jogo: o app avisa a cada minuto; conta no máximo 1 minuto a cada 55 s (avisos repetidos não inflam)
export function contaMinutoJogo(ultimo: number | undefined, agora: number): boolean {
  return !ultimo || agora - ultimo >= 55_000;
}

export function horaDeBrasilia(agora: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(agora));
}

// Recibo que o DJ (apps/dj) entrega a cada música que alguém põe na fila,
// assinado com o mesmo segredo do LiveKit. Devolve os dados só se a assinatura
// bate e o recibo tem menos de 10 min; senão null.
export function lerReciboDj(recibo: unknown, segredo: string, agora = Date.now()): { sub: string; room: string; id: string } | null {
  if (typeof recibo !== 'string' || recibo.length > 1000 || !segredo) return null;
  const partes = recibo.split('.');
  if (partes.length !== 2) return null;
  const [p, assinatura] = partes;
  const esperado = createHmac('sha256', segredo).update('placar-dj.' + p).digest();
  const veio = Buffer.from(assinatura, 'base64url');
  if (veio.length !== esperado.length || !timingSafeEqual(veio, esperado)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (typeof d?.sub !== 'string' || typeof d.room !== 'string' || typeof d.id !== 'string' || typeof d.iat !== 'number') return null;
    if (d.iat > agora + 60_000 || agora - d.iat > 10 * 60_000) return null;
    return { sub: d.sub, room: d.room, id: d.id };
  } catch { return null; }
}
