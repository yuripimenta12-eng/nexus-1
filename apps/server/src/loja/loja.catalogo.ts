// Catálogo da loja Nex. O visual de cada item fica no site (apps/web/src/lib/itens.ts),
// com o mesmo id. Preço null = não vende direto (só baú, evento ou roleta).
export type TipoItem = 'moldura' | 'icone' | 'placa' | 'som' | 'tema' | 'efeito';
/** Onde cada tipo fica guardado no perfil quando equipado (tema vai no servidor). */
export const CAMPO_PERFIL = { moldura: 'moldura', icone: 'icone', placa: 'placa', som: 'somEntrada', efeito: 'efeitoPerfil' } as const;
export type TipoPerfil = keyof typeof CAMPO_PERFIL;
export type Raridade = 'comum' | 'rara' | 'epica' | 'lendaria';
// incluiPlano: vem de graça com o plano (não vende; some se o plano acabar)
// soStaff: só a equipe do Nexus (cargo Staff ou isAdmin) vê e usa; não vende nem sai em baú
// precoPrisma: exclusivo da Prisma (moeda paga, loja.prisma.ts); não vende com Nex nem sai em baú
export interface Item { id: string; tipo: TipoItem; nome: string; raridade: Raridade; preco: number | null; soPro?: boolean; incluiPlano?: 'mais' | 'pro'; soStaff?: boolean; precoPrisma?: number }

const PRECO = {
  moldura: { comum: 1000, rara: 2000, epica: 4000, lendaria: 8000 },
  icone: { comum: 500, rara: 1000, epica: 2000, lendaria: 3000 },
  placa: { comum: 800, rara: 1500, epica: 2500, lendaria: 4000 },
  som: { comum: 2000, rara: 3000, epica: 4000, lendaria: 5000 },
  tema: { comum: 4000, rara: 5000, epica: 8000, lendaria: 12000 },
  efeito: { comum: 1500, rara: 3000, epica: 5000, lendaria: 9000 },
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
  it('moldura', 'm-circuito', 'Circuito', 'rara'),
  it('moldura', 'm-portal', 'Portal', 'rara'),
  it('moldura', 'm-pulso', 'Pulso Sonoro', 'rara'),
  it('moldura', 'm-cristal-plasma', 'Cristal Plasma', 'epica'),
  it('moldura', 'm-eclipse', 'Eclipse', 'epica'),
  it('moldura', 'm-cauda-estelar', 'Cauda Estelar', 'lendaria'),
  // Incluídas nos planos
  it('moldura', 'm-mais', 'Órbita Nexus+', 'epica', { preco: null, incluiPlano: 'mais' }),
  it('moldura', 'm-pro', 'Axolote Pro', 'lendaria', { preco: null, incluiPlano: 'pro' }),
  it('moldura', 'm-pro-eletrica', 'Elétrica Pro', 'lendaria', { preco: null, incluiPlano: 'pro' }),
  // Efeitos de perfil: animação por cima do cartão do perfil
  it('efeito', 'e-faiscas', 'Faíscas', 'comum'),
  it('efeito', 'e-neve', 'Nevasca', 'comum'),
  it('efeito', 'e-coracoes', 'Corações', 'rara'),
  it('efeito', 'e-brasas', 'Brasas', 'rara'),
  it('efeito', 'e-nevoa', 'Névoa Roxa', 'rara'),
  it('efeito', 'e-raios', 'Tempestade Elétrica', 'epica'),
  it('efeito', 'e-estrelas', 'Chuva de Estrelas', 'epica'),
  it('efeito', 'e-aurora', 'Aurora', 'lendaria', { preco: null, precoPrisma: 200 }),
  it('efeito', 'e-pro', 'Trovão Pro', 'lendaria', { preco: null, incluiPlano: 'pro' }),
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
  it('icone', 'i-diamante', 'Diamante', 'lendaria', { preco: null, precoPrisma: 120 }),
  it('icone', 'i-gamepad', 'Gamepad', 'comum'),
  it('icone', 'i-chat', 'Papo', 'comum'),
  it('icone', 'i-telefone', 'Telefone', 'comum'),
  it('icone', 'i-monitor', 'Monitor', 'rara'),
  it('icone', 'i-cadeado', 'Escudo', 'rara'),
  it('icone', 'i-velocimetro', 'Turbo', 'epica'),
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
  // Molduras de 22/11 (artes novas)
  it('moldura', 'm-bronze', 'Bronze', 'comum'),
  it('moldura', 'm-prata', 'Prata', 'comum'),
  it('moldura', 'm-ouro', 'Ouro', 'rara'),
  it('moldura', 'm-perola', 'Pérola do Mar', 'rara'),
  it('moldura', 'm-quartzo-rosa', 'Quartzo Rosa', 'rara'),
  it('moldura', 'm-cerejeira', 'Cerejeira', 'rara'),
  it('moldura', 'm-vanguarda', 'Vanguarda', 'rara'),
  it('moldura', 'm-borboleta-lunar', 'Borboleta Lunar', 'epica'),
  it('moldura', 'm-esmeralda', 'Esmeralda', 'epica'),
  it('moldura', 'm-rubi', 'Rubi', 'epica'),
  it('moldura', 'm-imperial', 'Imperial', 'epica'),
  it('moldura', 'm-halloween', 'Noite das Bruxas', 'epica'),
  it('moldura', 'm-squad', 'Drop Quente', 'epica'),
  it('moldura', 'm-batida', 'Batida', 'epica'),
  // Leva de 25/11/2026 (artes do usuário)
  it('moldura', 'm-brasa', 'Brasa', 'comum'),
  it('moldura', 'm-plasma-violeta', 'Plasma Violeta', 'comum'),
  it('moldura', 'm-fita-holografica', 'Fita Holográfica', 'rara'),
  it('moldura', 'm-insignia-nexus', 'Insígnia Nexus', 'epica'),
  it('moldura', 'm-relampago-roxo', 'Relâmpago Roxo', 'epica'),
  // Exclusivas da Prisma (moeda paga)
  it('moldura', 'm-coroa-de-cristal', 'Coroa de Cristal', 'lendaria', { preco: null, precoPrisma: 220 }),
  it('moldura', 'm-paladino', 'Paladino', 'lendaria', { preco: null, precoPrisma: 250 }),
  it('moldura', 'm-rainha', 'Rainha', 'lendaria', { preco: null, precoPrisma: 250 }),
  it('moldura', 'm-dragao', 'Dragão Ametista', 'lendaria', { preco: null, precoPrisma: 250 }),
  // Só da equipe
  it('moldura', 'm-staff', 'Nexus Staff', 'lendaria', { preco: null, soStaff: true }),
  it('moldura', 'm-moderacao', 'Martelo da Ordem', 'epica', { preco: null, soStaff: true }),
  it('icone', 'i-staff', 'Nexus Staff', 'lendaria', { preco: null, soStaff: true }),
  // Temas de servidor: o dono (ou admin) veste o servidor inteiro
  it('tema', 't-neblina', 'Neblina', 'rara'),
  it('tema', 't-arcade', 'Neon Arcade', 'rara'),
  it('tema', 't-sakura', 'Sakura', 'epica'),
  it('tema', 't-mar', 'Fundo do Mar', 'epica'),
  it('tema', 't-aurora', 'Aurora Boreal', 'lendaria'),
  it('tema', 't-84', 'Pôr do Sol 84', 'lendaria'),
  // Só em baú (não vendem direto)
  it('moldura', 'm-sakura', 'Sakura', 'rara', { preco: null }),
  it('moldura', 'm-pixel', 'Pixel', 'epica', { preco: null }),
  it('moldura', 'm-cristal', 'Cristal', 'lendaria', { preco: null }),
  it('placa', 'p-arco-iris', 'Arco-íris', 'epica', { preco: null }),
  it('icone', 'i-alien', 'Alien', 'rara', { preco: null }),
  it('som', 's-buzina', 'Buzina', 'rara', { preco: null }),
  it('som', 's-dragao', 'Rugido do Dragão', 'lendaria', { preco: null }),
  // Ícones que só saem nos baús Neon (troféus e cia.) e do Som (música)
  it('icone', 'i-camera', 'Câmera', 'rara', { preco: null }),
  it('icone', 'i-tv', 'TV Retrô', 'rara', { preco: null }),
  it('icone', 'i-coruja', 'Coruja', 'epica', { preco: null }),
  it('icone', 'i-trofeu', 'Troféu', 'epica', { preco: null }),
  it('icone', 'i-taca', 'Taça de Campeão', 'lendaria', { preco: null }),
  it('icone', 'i-nota', 'Nota Musical', 'comum', { preco: null }),
  it('icone', 'i-cd', 'CD', 'comum', { preco: null }),
  it('icone', 'i-vinil', 'Vinil', 'rara', { preco: null }),
  it('icone', 'i-mic', 'Microfone', 'rara', { preco: null }),
  it('icone', 'i-microfone', 'Microfone de Estúdio', 'epica', { preco: null }),
  // Natal 2026 (só no Baú de Natal, até 6 de janeiro)
  it('moldura', 'm-guirlanda', 'Guirlanda', 'epica', { preco: null }),
  it('moldura', 'm-pisca-pisca', 'Pisca-pisca', 'lendaria', { preco: null }),
  it('icone', 'i-gorro', 'Papai Noel', 'rara', { preco: null }),
  it('icone', 'i-boneco', 'Boneco de Neve', 'rara', { preco: null }),
  it('placa', 'p-natal', 'Natal', 'epica', { preco: null }),
];

/** Valor de referência (para devolver metade quando sai item repetido no baú). */
// Item sem preço (baú/evento) vale o mesmo que um item da loja do mesmo tipo e raridade
export const valorDoItem = (i: Item) => i.preco ?? PRECO[i.tipo][i.raridade];

export const itemPorId = (id: string) => CATALOGO.find(i => i.id === id);
