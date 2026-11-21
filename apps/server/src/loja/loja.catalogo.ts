// Catálogo da loja Nex. O visual de cada item fica no site (apps/web/src/lib/itens.ts),
// com o mesmo id. Preço null = não vende direto (só baú, evento ou roleta).
export type TipoItem = 'moldura' | 'icone' | 'placa' | 'som';
/** Onde cada tipo fica guardado no perfil quando equipado. */
export const CAMPO_PERFIL = { moldura: 'moldura', icone: 'icone', placa: 'placa', som: 'somEntrada' } as const;
export type Raridade = 'comum' | 'rara' | 'epica' | 'lendaria';
export interface Item { id: string; tipo: TipoItem; nome: string; raridade: Raridade; preco: number | null; soPro?: boolean }

const PRECO = {
  moldura: { comum: 1000, rara: 2000, epica: 4000, lendaria: 8000 },
  icone: { comum: 500, rara: 1000, epica: 2000, lendaria: 3000 },
  placa: { comum: 800, rara: 1500, epica: 2500, lendaria: 4000 },
  som: { comum: 2000, rara: 3000, epica: 4000, lendaria: 5000 },
} as const;
const it = (tipo: TipoItem, id: string, nome: string, raridade: Raridade, extra: Partial<Item> = {}): Item =>
  ({ id, tipo, nome, raridade, preco: PRECO[tipo][raridade], ...extra });

export const CATALOGO: Item[] = [
  // Molduras: o contorno da foto em todo lugar
  it('moldura', 'm-neon-roxo', 'Neon Roxo', 'comum'),
  it('moldura', 'm-neon-laranja', 'Neon Laranja', 'comum'),
  it('moldura', 'm-limao', 'Limão', 'comum'),
  it('moldura', 'm-gelo', 'Gelo', 'comum'),
  it('moldura', 'm-holografica', 'Holográfica', 'rara'),
  it('moldura', 'm-por-do-sol', 'Pôr do Sol', 'rara'),
  it('moldura', 'm-oceano', 'Oceano', 'rara'),
  it('moldura', 'm-brasil', 'Brasil', 'rara'),
  it('moldura', 'm-fogo', 'Em Chamas', 'epica'),
  it('moldura', 'm-raio', 'Tempestade', 'epica'),
  it('moldura', 'm-glitch', 'Glitch', 'epica'),
  it('moldura', 'm-galaxia', 'Galáxia', 'epica'),
  it('moldura', 'm-aurora', 'Aurora Nexus', 'lendaria'),
  it('moldura', 'm-coroa', 'Realeza', 'lendaria', { soPro: true }),
  // Ícones: ao lado do nome, na lista, no chat e na call
  it('icone', 'i-controle', 'Controle', 'comum'),
  it('icone', 'i-fantasma', 'Fantasma', 'comum'),
  it('icone', 'i-gato', 'Gato', 'comum'),
  it('icone', 'i-pizza', 'Pizza', 'comum'),
  it('icone', 'i-caveira', 'Caveira', 'rara'),
  it('icone', 'i-foguete', 'Foguete', 'rara'),
  it('icone', 'i-arara', 'Arara', 'rara'),
  it('icone', 'i-bola', 'Bola de Futebol', 'rara'),
  it('icone', 'i-fogo', 'Fogo', 'epica'),
  it('icone', 'i-raio', 'Raio', 'epica'),
  it('icone', 'i-coroa', 'Coroa', 'lendaria'),
  it('icone', 'i-diamante', 'Diamante', 'lendaria'),
  // Placas: a faixa de cor atrás do nome
  it('placa', 'p-violeta', 'Violeta', 'comum'),
  it('placa', 'p-brasa', 'Brasa', 'comum'),
  it('placa', 'p-oceano', 'Oceano', 'comum'),
  it('placa', 'p-brasil', 'Brasil', 'rara'),
  it('placa', 'p-chiclete', 'Chiclete', 'rara'),
  it('placa', 'p-carbono', 'Carbono', 'rara'),
  it('placa', 'p-ouro', 'Ouro', 'epica'),
  it('placa', 'p-neon', 'Neon', 'epica'),
  it('placa', 'p-galaxia', 'Galáxia', 'lendaria'),
  // Sons de entrada: tocam para a sala quando você entra na call
  it('som', 's-moeda', 'Moedinha', 'comum'),
  it('som', 's-sino', 'Sininho', 'comum'),
  it('som', 's-laser', 'Laser', 'rara'),
  it('som', 's-arcade', 'Fliperama', 'rara'),
  it('som', 's-tambor', 'Rufar', 'epica'),
  it('som', 's-raio', 'Trovão', 'epica'),
  it('som', 's-fanfarra', 'Fanfarra', 'lendaria'),
];

export const itemPorId = (id: string) => CATALOGO.find(i => i.id === id);
