// Prisma: a moeda AZUL, comprada com dinheiro (Pix). Separada do Nex de propósito:
// não vira Nex, Nex não vira Prisma, não passa para outra pessoa e não abre baú de sorte.
// As caixas Prisma mostram tudo o que vem dentro, sem sorteio: caixa de recompensa
// paga com sorteio é proibida em jogo que menor de idade usa (ECA Digital, Lei 15.211/2025).
import { itemPorId } from './loja.catalogo';

// Preço em reais com ponto ("4.90"), como a cobrança Pix pede
export interface PacotePrisma { id: string; prismas: number; bonus: number; reais: string }
export const PACOTES_PRISMA: PacotePrisma[] = [
  { id: 'pp-100', prismas: 100, bonus: 0, reais: '4.90' },
  { id: 'pp-200', prismas: 200, bonus: 10, reais: '9.90' },
  { id: 'pp-500', prismas: 500, bonus: 50, reais: '24.90' },
  { id: 'pp-1000', prismas: 1000, bonus: 150, reais: '49.90' },
];

export interface CaixaPrisma { id: string; nome: string; preco: number; cor: string; desc: string; itens: string[] }
export const CAIXAS_PRISMA: CaixaPrisma[] = [
  { id: 'cx-realeza', nome: 'Caixa Realeza', preco: 450, cor: '#ffc23d', desc: 'Molduras Paladino e Rainha e o ícone Diamante.', itens: ['m-paladino', 'm-rainha', 'i-diamante'] },
  { id: 'cx-dragao', nome: 'Caixa do Dragão', preco: 350, cor: '#9b5cff', desc: 'Moldura Dragão Ametista e o efeito Aurora.', itens: ['m-dragao', 'e-aurora'] },
];
export const caixaPorId = (id: string) => CAIXAS_PRISMA.find(c => c.id === id);

/** Quem já tem parte da caixa paga só a parte que falta, com o mesmo desconto. */
export function precoCaixa(c: CaixaPrisma, tem: (itemId: string) => boolean) {
  const valor = (id: string) => itemPorId(id)?.precoPrisma ?? 0;
  const total = c.itens.reduce((t, id) => t + valor(id), 0);
  const falta = c.itens.filter(id => !tem(id)).reduce((t, id) => t + valor(id), 0);
  return total ? Math.ceil((c.preco * falta) / total) : c.preco;
}
