// O que dá para pagar por Pix e quanto custa. Sem dependências (testado em scripts/testar-pagamentos.js).
// O preço SEMPRE vem daqui, nunca do navegador (só a doação tem valor escolhido, dentro dos limites).
import { PACOTES_PRISMA } from '../loja/loja.prisma';

export class ErroPagamento extends Error {}

export const PLANOS_PIX: Record<string, { plano: 'mais' | 'pro'; dias: number; centavos: number; nome: string }> = {
  'mais-mes': { plano: 'mais', dias: 30, centavos: 990, nome: 'Nexus+ por 1 mês' },
  'mais-ano': { plano: 'mais', dias: 365, centavos: 9900, nome: 'Nexus+ por 1 ano' },
  'pro-mes': { plano: 'pro', dias: 30, centavos: 1990, nome: 'Nexus Pro por 1 mês' },
  'pro-ano': { plano: 'pro', dias: 365, centavos: 19900, nome: 'Nexus Pro por 1 ano' },
};

export const DOACAO_MIN_CENTAVOS = 100; // R$ 1
export const DOACAO_MAX_CENTAVOS = 50000; // R$ 500
export const PIX_VALIDADE_S = 30 * 60; // o QR Code vale 30 minutos

export type Produto =
  | { tipo: 'plano'; item: string; centavos: number; nome: string; plano: 'mais' | 'pro'; dias: number }
  | { tipo: 'prisma'; item: string; centavos: number; nome: string; prismas: number }
  | { tipo: 'doacao'; item: 'doacao'; centavos: number; nome: string };

export function produto(tipo: unknown, item: unknown, valorCentavos?: unknown): Produto {
  if (tipo === 'plano') {
    const p = typeof item === 'string' && Object.prototype.hasOwnProperty.call(PLANOS_PIX, item) ? PLANOS_PIX[item] : undefined;
    if (!p) throw new ErroPagamento('Plano inválido');
    return { tipo, item: item as string, centavos: p.centavos, nome: p.nome, plano: p.plano, dias: p.dias };
  }
  if (tipo === 'prisma') {
    const p = PACOTES_PRISMA.find(x => x.id === item);
    if (!p) throw new ErroPagamento('Pacote inválido');
    const total = p.prismas + p.bonus;
    return { tipo, item: p.id, centavos: reaisParaCentavos(p.reais), nome: `${total} Prisma`, prismas: total };
  }
  if (tipo === 'doacao') {
    const v = Number(valorCentavos);
    if (!Number.isInteger(v) || v < DOACAO_MIN_CENTAVOS || v > DOACAO_MAX_CENTAVOS) {
      throw new ErroPagamento('Escolha um valor entre R$ 1 e R$ 500');
    }
    return { tipo, item: 'doacao', centavos: v, nome: 'Doação para o Nexus' };
  }
  throw new ErroPagamento('Tipo de pagamento inválido');
}

export function reaisParaCentavos(reais: string): number {
  if (!/^\d+\.\d{2}$/.test(reais)) throw new Error(`Preço mal escrito: ${reais}`);
  return Number(reais.replace('.', ''));
}

/** "9.90" — o formato que a cobrança Pix pede. */
export const centavosParaPix = (c: number) => (c / 100).toFixed(2);
