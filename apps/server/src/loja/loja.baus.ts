// Baús: abertos SÓ com Nex (que nunca é vendido por dinheiro). Chances à mostra.
// Item repetido vira metade do valor em Nex. De propósito, na média o baú
// devolve menos do que custa: é para gastar Nex, não para multiplicar.
export interface PremioBau { item?: string; nex?: number; peso: number }
export interface Bau { id: string; nome: string; preco: number; cor: string; desc: string; ate?: string; premios: PremioBau[] }

export const BAUS: Bau[] = [
  {
    id: 'bau-estreia', nome: 'Baú Estreia', preco: 600, cor: '#3b9bff',
    desc: 'O primeiro de todo mundo. Sai placa, ícone ou Nex; com sorte, uma moldura.',
    premios: [
      { nex: 150, peso: 30 }, { nex: 300, peso: 22 }, { item: 'p-violeta', peso: 12 }, { item: 'p-brasa', peso: 10 },
      { item: 'i-controle', peso: 10 }, { item: 'i-alien', peso: 8 }, { item: 'm-sakura', peso: 6 }, { nex: 1200, peso: 2 },
    ],
  },
  {
    id: 'bau-neon', nome: 'Baú Neon', preco: 1800, cor: '#b366ff',
    desc: 'Molduras de verdade começam aqui. Pixel e Cristal só saem dele.',
    premios: [
      { nex: 500, peso: 26 }, { item: 'm-neon-roxo', peso: 18 }, { item: 'm-limao', peso: 16 }, { item: 'm-holografica', peso: 12 },
      { item: 'm-sakura', peso: 10 }, { item: 'p-arco-iris', peso: 8 }, { item: 'm-pixel', peso: 7 }, { item: 'm-cristal', peso: 3 },
    ],
  },
  {
    id: 'bau-som', nome: 'Baú do Som', preco: 2000, cor: '#ff8a3d',
    desc: 'Sons de entrada na call. A Buzina e o Rugido do Dragão só saem aqui.',
    premios: [
      { nex: 400, peso: 34 }, { item: 's-moeda', peso: 18 }, { item: 's-sino', peso: 16 }, { item: 's-buzina', peso: 14 },
      { item: 's-laser', peso: 9 }, { item: 's-tambor', peso: 6 }, { item: 's-dragao', peso: 3 },
    ],
  },
  {
    id: 'bau-natal', nome: 'Baú de Natal', preco: 2500, cor: '#ff3b3b', ate: '2027-01-07T03:00:00.000Z',
    desc: 'Só até o Dia de Reis. Guirlanda, Pisca-pisca, gorro e boneco de neve só saem aqui.',
    premios: [
      { nex: 400, peso: 30 }, { item: 'i-gorro', peso: 22 }, { item: 'i-boneco', peso: 22 }, { item: 'p-natal', peso: 12 },
      { item: 'm-guirlanda', peso: 10 }, { item: 'm-pisca-pisca', peso: 4 },
    ],
  },
];

export const bauPorId = (id: string) => BAUS.find(b => b.id === id);
export const bauAtivo = (b: Bau, agora = new Date()) => !b.ate || new Date(b.ate).getTime() > agora.getTime();

/** Escolhe o prêmio com um número de 0 a (soma dos pesos - 1). */
export function sortearPremio(b: Bau, sorteio: number): number {
  let r = sorteio;
  for (let i = 0; i < b.premios.length; i++) {
    if (r < b.premios[i].peso) return i;
    r -= b.premios[i].peso;
  }
  return 0;
}
export const somaPesos = (b: Bau) => b.premios.reduce((t, p) => t + p.peso, 0);
