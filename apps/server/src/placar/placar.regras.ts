// Contas do placar sem dependências (testadas em scripts/testar-placar.js)

// O site manda um batimento por minuto. Só conta o tempo que passou de verdade
// desde o anterior (no máx. 75 s); depois de 150 s sem batimento a contagem
// recomeça do zero (a pessoa saiu, fechou o app ou caiu).
export function segundosACreditar(ultimo: Date | null | undefined, agora: Date): number {
  if (!ultimo) return 0;
  const passou = (agora.getTime() - ultimo.getTime()) / 1000;
  if (passou <= 0 || passou > 150) return 0;
  return Math.round(Math.min(passou, 75));
}

export function horaDeBrasilia(agora: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(agora));
}
