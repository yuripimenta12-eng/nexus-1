// Baús: abertos SÓ com Nex (que nunca é vendido por dinheiro). Chances à mostra.
// Item repetido vira metade do valor em Nex. De propósito, na média o baú
// devolve menos do que custa: é para gastar Nex, não para multiplicar.
export interface PremioBau { item?: string; nex?: number; peso: number }
export interface Bau { id: string; nome: string; preco: number; cor: string; desc: string; ate?: string; premios: PremioBau[] }

// Estreia é o simples (Nex e coisas comuns). Os outros dão SEMPRE item, quase
// sempre algo raro para cima, e têm coisas que só saem deles.
export const BAUS: Bau[] = [
  {
    id: 'bau-estreia', nome: 'Baú Estreia', preco: 600, cor: '#3b9bff',
    desc: 'O primeiro de todo mundo: Nex, placas e ícones simples. Com sorte, uma moldura.',
    premios: [
      { nex: 150, peso: 30 }, { nex: 300, peso: 22 }, { item: 'p-violeta', peso: 12 }, { item: 'p-brasa', peso: 10 },
      { item: 'i-controle', peso: 12 }, { item: 'i-alien', peso: 8 }, { item: 'm-neon-roxo', peso: 4 }, { nex: 1200, peso: 2 },
    ],
  },
  {
    id: 'bau-neon', nome: 'Baú Neon', preco: 2500, cor: '#b366ff',
    desc: 'Sempre sai item. Molduras raras e épicas, e Sakura, Pixel, Cristal, Troféu e Taça só saem dele.',
    premios: [
      { item: 'm-holografica', peso: 16 }, { item: 'm-oceano', peso: 14 }, { item: 'm-sakura', peso: 14 }, { item: 'i-camera', peso: 12 },
      { item: 'i-tv', peso: 10 }, { item: 'i-coruja', peso: 8 }, { item: 'p-neon', peso: 7 }, { item: 'i-trofeu', peso: 6 },
      { item: 'm-pixel', peso: 6 }, { item: 'm-glitch', peso: 3 }, { item: 'i-taca', peso: 2 }, { item: 'm-cristal', peso: 2 },
    ],
  },
  {
    id: 'bau-som', nome: 'Baú do Som', preco: 2500, cor: '#ff8a3d',
    desc: 'Sempre sai item. Sons de entrada e ícones de música; Buzina, Dragão, Vinil e Microfone só saem dele.',
    premios: [
      { item: 'i-nota', peso: 14 }, { item: 'i-cd', peso: 12 }, { item: 's-sino', peso: 12 }, { item: 'i-vinil', peso: 12 },
      { item: 'i-mic', peso: 10 }, { item: 's-buzina', peso: 11 }, { item: 's-laser', peso: 9 }, { item: 'i-microfone', peso: 7 },
      { item: 's-tambor', peso: 6 }, { item: 's-fanfarra', peso: 4 }, { item: 's-dragao', peso: 3 },
    ],
  },
  {
    id: 'bau-natal', nome: 'Baú de Natal', preco: 3000, cor: '#ff3b3b', ate: '2027-01-07T03:00:00.000Z',
    desc: 'Só até o Dia de Reis e sempre sai item: Papai Noel, Boneco de Neve, placa e molduras de Natal.',
    premios: [
      { item: 'i-gorro', peso: 24 }, { item: 'i-boneco', peso: 24 }, { item: 'p-natal', peso: 22 },
      { item: 'm-guirlanda', peso: 20 }, { item: 'm-pisca-pisca', peso: 7 }, { item: 'm-aurora', peso: 3 },
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
