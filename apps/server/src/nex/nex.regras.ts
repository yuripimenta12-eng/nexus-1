// Regras da economia Nex, sem dependências (testadas em scripts/testar-nex.js).
// Valores de propósito mais difíceis: conseguir visual na loja leva semanas.
import type { Plano } from '../planos/planos.regras';

/** Presença Nexus: o que cada dia seguido vale (o 7º é o grande). */
export const PRESENCA = [10, 15, 20, 25, 30, 40, 100];

/** Roleta do dia: só Nex por enquanto; peso = chance em %. */
export const ROLETA = [
  { nex: 5, peso: 30 },
  { nex: 10, peso: 25 },
  { nex: 20, peso: 20 },
  { nex: 35, peso: 13 },
  { nex: 60, peso: 8 },
  { nex: 150, peso: 3 },
  { nex: 300, peso: 1 },
];
export const GIROS_POR_DIA: Record<Plano, number> = { gratis: 1, mais: 1, pro: 2 };

/** Bônus do plano em presença e missões (a roleta não muda: chances iguais para todos). */
export const BONUS: Record<Plano, number> = { gratis: 1, mais: 1.25, pro: 1.5 };
export const comBonus = (nex: number, plano: Plano) => Math.round(nex * BONUS[plano]);

export interface Missao { id: string; tipo: 'dia' | 'sempre'; titulo: string; desc: string; meta: number; nex: number; icone: string }
export const MISSOES: Missao[] = [
  { id: 'call-1h', tipo: 'dia', titulo: 'Fique 1 hora em call', desc: 'Somando o dia todo (minutos)', meta: 60, nex: 15, icone: '🎧' },
  { id: 'chat-10', tipo: 'dia', titulo: 'Converse no chat', desc: 'Mande 10 mensagens hoje', meta: 10, nex: 5, icone: '💬' },
  { id: 'unidos-dia', tipo: 'dia', titulo: 'Ganhe 1 partida de UNidos', desc: 'Com pelo menos mais uma pessoa', meta: 1, nex: 20, icone: '🃏' },
  { id: 'foto', tipo: 'sempre', titulo: 'Cara nova', desc: 'Ponha uma foto no perfil', meta: 1, nex: 30, icone: '🖼️' },
  { id: 'amigo', tipo: 'sempre', titulo: 'Primeiro parceiro', desc: 'Faça a primeira amizade', meta: 1, nex: 30, icone: '🤝' },
  { id: 'servidor', tipo: 'sempre', titulo: 'Na área', desc: 'Entre ou crie um servidor', meta: 1, nex: 30, icone: '🏠' },
  { id: 'primeira-call', tipo: 'sempre', titulo: 'Primeira call', desc: 'Entre numa sala de voz', meta: 1, nex: 30, icone: '🔊' },
  { id: 'presenca-7', tipo: 'sempre', titulo: 'Presença de ferro', desc: 'Pegue os 7 dias seguidos', meta: 7, nex: 100, icone: '🔥' },
  { id: 'unidos-10', tipo: 'sempre', titulo: 'Mão boa', desc: 'Ganhe 10 partidas de UNidos', meta: 10, nex: 150, icone: '🏆' },
  { id: 'maratona', tipo: 'sempre', titulo: 'Maratona', desc: 'Some 24 horas em call (horas)', meta: 24, nex: 200, icone: '⏱️' },
];

/** Dia de hoje em Brasília (AAAA-MM-DD). */
export function diaBR(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
/** Meia-noite de hoje em Brasília (sem horário de verão desde 2019). */
export function inicioDoDiaBR(agora = new Date()): Date {
  return new Date(`${diaBR(agora)}T00:00:00-03:00`);
}
export function ontemBR(agora = new Date()): string {
  return diaBR(new Date(inicioDoDiaBR(agora).getTime() - 12 * 3_600_000));
}

/**
 * Próximo dia da Presença. Pegou ontem: continua (depois do 7 volta ao 1);
 * pulou um dia ou nunca pegou: recomeça do 1. Pegou hoje: null.
 */
export function proximoDiaPresenca(ultimoDia: number, ultimaData: string | null, agora = new Date()): number | null {
  const hoje = diaBR(agora);
  if (ultimaData === hoje) return null;
  if (ultimaData === ontemBR(agora) && ultimoDia >= 1 && ultimoDia < 7) return ultimoDia + 1;
  return 1;
}

/** Sorteia um prêmio da roleta com um número inteiro de 0 a 99. */
export function premioDaRoleta(sorteio: number): number {
  let r = sorteio;
  for (let i = 0; i < ROLETA.length; i++) {
    if (r < ROLETA[i].peso) return i;
    r -= ROLETA[i].peso;
  }
  return 0;
}
