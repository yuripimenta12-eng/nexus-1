// Zoeiras: itens de usar uma vez na call, clicando na pessoa.
// Leves: só efeito visual. Pesadas: mexem na call de quem recebe (o dono do
// servidor precisa ligar). Escudo: deixa você imune por 1 hora.
export interface Zoeira { id: string; nome: string; emoji: string; preco: number; pesada: boolean; duracaoMs: number; desc: string; todos?: boolean; propria?: boolean }

export const ZOEIRAS: Zoeira[] = [
  { id: 'tomate', nome: 'Tomate', emoji: '🍅', preco: 20, pesada: false, duracaoMs: 3000, desc: 'Um tomate bem na cara' },
  { id: 'torta', nome: 'Torta na cara', emoji: '🥧', preco: 35, pesada: false, duracaoMs: 3500, desc: 'Tortada na foto, todo mundo vê' },
  { id: 'confete', nome: 'Confete', emoji: '🎉', preco: 30, pesada: false, duracaoMs: 4000, desc: 'Chuva de confete para a pessoa', },
  { id: 'holofote', nome: 'Holofote', emoji: '🔦', preco: 40, pesada: false, duracaoMs: 10000, desc: 'Holofote em cima da pessoa por 10 s' },
  { id: 'coroa', nome: 'Coroa', emoji: '👑', preco: 60, pesada: false, duracaoMs: 10 * 60_000, desc: 'Coroa na foto da pessoa por 10 min' },
  { id: 'terremoto', nome: 'Terremoto', emoji: '💥', preco: 80, pesada: false, duracaoMs: 1200, desc: 'A tela da call inteira treme', todos: true },
  { id: 'calar', nome: 'Cala a boca', emoji: '🤐', preco: 150, pesada: true, duracaoMs: 15_000, desc: 'A pessoa fica muda por 15 s' },
  { id: 'tampao', nome: 'Tampão', emoji: '🙉', preco: 120, pesada: true, duracaoMs: 10_000, desc: 'A pessoa não ouve a call por 10 s' },
  { id: 'apelido', nome: 'Batismo', emoji: '🏷️', preco: 200, pesada: true, duracaoMs: 5 * 60_000, desc: 'Apelido engraçado (da lista) por 5 min' },
  { id: 'escudo', nome: 'Escudo', emoji: '🛡️', preco: 150, pesada: false, duracaoMs: 60 * 60_000, desc: 'Nenhuma zoeira pega em você por 1 hora', propria: true },
];

// Apelidos prontos (ninguém escreve: evita ofensa)
export const APELIDOS = [
  'Bagre Ensaboado', 'Rei do Lag', 'Mestre do AFK', 'Capivara Gamer', 'Sem Mira', 'Pão de Queijo',
  'Mão de Alface', 'Campeão de Nada', 'Bot Disfarçado', 'Cria da Lan House', 'Ping 999', 'Chorão do Patch',
];

export const zoeiraPorId = (id: string) => ZOEIRAS.find(z => z.id === id);
export const ESPERA_LEVE_MS = 4000;      // entre zoeiras leves do mesmo autor
export const ESPERA_PESADA_MS = 60_000;  // entre pesadas do mesmo autor
export const ESPERA_ALVO_PESADA_MS = 120_000; // a mesma pessoa só leva pesada de novo depois disso
