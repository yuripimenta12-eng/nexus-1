// Visual dos itens da loja Nex (mesmos ids do catálogo do servidor: src/loja/loja.catalogo.ts).
export type Raridade = 'comum' | 'rara' | 'epica' | 'lendaria';
export type TipoItem = 'moldura' | 'icone' | 'placa' | 'som' | 'tema' | 'efeito';

// Temas de servidor: cores da miniatura na loja (as de verdade ficam em globals.css)
export const TEMAS: Record<string, { fundo: string; lado: string; painel: string; brilho: string }> = {
  't-neblina': { fundo: '#0a0d12', lado: '#0d1219', painel: '#171f2b', brilho: '#23324a' },
  't-arcade': { fundo: '#07041a', lado: '#0b0620', painel: '#170f36', brilho: '#7a2cff' },
  't-sakura': { fundo: '#120810', lado: '#150a13', painel: '#241220', brilho: '#ff8cc6' },
  't-mar': { fundo: '#03100f', lado: '#051313', painel: '#0b2224', brilho: '#19c2c2' },
  't-aurora': { fundo: '#050d0c', lado: '#071211', painel: '#0f1f1e', brilho: '#3dffb0' },
  't-84': { fundo: '#12060f', lado: '#160811', painel: '#260e1f', brilho: '#ff6a3d' },
};

// Sons de entrada: emoji do cartão (o som em si é sintetizado em lib/sounds.ts)
export const SONS: Record<string, string> = {
  's-moeda': '🪙', 's-sino': '🔔', 's-laser': '🔫', 's-arcade': '🕹️', 's-tambor': '🥁', 's-raio': '🌩️', 's-fanfarra': '🎺',
  's-buzina': '📯', 's-dragao': '🐉',
};

export const RARIDADE: Record<Raridade, { nome: string; cor: string; fundo: string }> = {
  comum: { nome: 'Comum', cor: '#a7a3b8', fundo: 'linear-gradient(180deg,#1d1828,#15111d)' },
  rara: { nome: 'Rara', cor: '#4aa8ff', fundo: 'linear-gradient(180deg,#14223a,#111522)' },
  epica: { nome: 'Épica', cor: '#b366ff', fundo: 'linear-gradient(180deg,#26163d,#150f21)' },
  lendaria: { nome: 'Lendária', cor: '#ffc23d', fundo: 'linear-gradient(180deg,#3a2c12,#17120c)' },
};

// Molduras: anel por cima da foto. "anim" escolhe a animação (classes em globals.css).
// grossura: multiplica a espessura (raras mais grossas); enfeite no topo, selo no canto de baixo
export const MOLDURAS: Record<string, { anel: string; brilho?: string; anim?: 'gira' | 'pulsa' | 'glitch' | 'pisca'; enfeite?: string; selo?: string; grossura?: number }> = {
  'm-neon-roxo': { anel: '#a26bff', brilho: '#7a2cff' },
  'm-neon-laranja': { anel: '#ff8a3d', brilho: '#ff6a00' },
  'm-limao': { anel: '#c8f53b', brilho: '#9bd400' },
  'm-gelo': { anel: 'linear-gradient(135deg,#e6f6ff,#7fd0ff,#e6f6ff)', brilho: '#7fd0ff' },
  'm-holografica': { anel: 'conic-gradient(#ff6ad5,#c774e8,#ad8cff,#8795e8,#94d0ff,#ff6ad5)', brilho: '#c774e8', anim: 'gira', grossura: 1.4 },
  'm-por-do-sol': { anel: 'linear-gradient(135deg,#ffd36e,#ff6a00,#ff3d77)', brilho: '#ff6a00', grossura: 1.4 },
  'm-oceano': { anel: 'linear-gradient(135deg,#00e1ff,#0077ff,#00e1ff)', brilho: '#00a8ff', grossura: 1.4, selo: '🌊' },
  'm-brasil': { anel: 'conic-gradient(#009c3b 0 33%,#ffdf00 0 66%,#002776 0)', brilho: '#ffdf00', anim: 'gira', grossura: 1.4, selo: '⚽' },
  'm-fogo': { anel: 'conic-gradient(#ff2a00,#ff8a00,#ffd000,#ff8a00,#ff2a00)', brilho: '#ff5a00', anim: 'gira', grossura: 1.8, selo: '🔥' },
  'm-raio': { anel: 'conic-gradient(#3b5bff,#a6e3ff,#ffe600,#3b5bff)', brilho: '#5b8cff', anim: 'pisca', grossura: 1.8, selo: '⚡' },
  'm-glitch': { anel: 'conic-gradient(#00fff0,#ff00e5,#00fff0,#ff00e5,#00fff0)', brilho: '#ff00e5', anim: 'glitch', grossura: 1.8 },
  'm-galaxia': { anel: 'conic-gradient(#1a0b3d,#7a2cff,#ff4dd8,#1d4bff,#1a0b3d)', brilho: '#7a2cff', anim: 'gira', grossura: 1.8, selo: '✨' },
  'm-aurora': { anel: 'conic-gradient(#3dffb0,#7a2cff,#00d4ff,#ff6a00,#3dffb0)', brilho: '#3dffb0', anim: 'gira', grossura: 2.2, enfeite: '✦', selo: '🌌' },
  'm-coroa': { anel: 'linear-gradient(135deg,#fff1a8,#ffc23d,#b8860b,#ffc23d)', brilho: '#ffc23d', anim: 'pulsa', grossura: 2.2, enfeite: '👑', selo: '💎' },
  // Incluídas nos planos (vêm de graça com o Nexus+ / Pro)
  'm-mais': { anel: 'conic-gradient(#21d4fd,#7a2cff,#3ee0ff,#b721ff,#21d4fd)', brilho: '#3ee0ff', anim: 'gira', grossura: 1.8, selo: '💎' },
  'm-pro': { anel: 'conic-gradient(#ff6a00,#ffc23d,#ff4f79,#ffc23d,#ff6a00)', brilho: '#ff8a00', anim: 'gira', grossura: 2.2, enfeite: '👑', selo: '🔥' },
  'm-pro-eletrica': { anel: 'conic-gradient(#ffe600,#ff6a00,#fff7b0,#ff4f79,#ffe600)', brilho: '#ffd000', anim: 'pisca', grossura: 2.2, enfeite: '⚡', selo: '⚡' },
  // Novas (arte 3D)
  'm-cauda-estelar': { anel: 'conic-gradient(#7a2cff,#ff8a3d,#ffd36e,#7a2cff)', brilho: '#ff8a3d', grossura: 2.2 },
  'm-cristal-plasma': { anel: 'conic-gradient(#b721ff,#ff8a3d,#b721ff)', brilho: '#b721ff', grossura: 1.8 },
  'm-eclipse': { anel: 'conic-gradient(#3a1a66,#ff8a3d,#3a1a66)', brilho: '#ff8a3d', grossura: 1.8 },
  'm-circuito': { anel: 'conic-gradient(#7a2cff,#ff6a00,#7a2cff)', brilho: '#7a2cff', grossura: 1.4 },
  'm-portal': { anel: 'conic-gradient(#7a2cff,#ffc23d,#7a2cff)', brilho: '#ffc23d', grossura: 1.4 },
  'm-pulso': { anel: 'conic-gradient(#7a2cff,#ff8a3d,#7a2cff)', brilho: '#ff8a3d', grossura: 1.4 },
  // Só em baú
  'm-sakura': { anel: 'conic-gradient(#ffd1e8,#ff8cc6,#ffd1e8,#ff8cc6,#ffd1e8)', brilho: '#ff8cc6', grossura: 1.4, selo: '🌸' },
  'm-pixel': { anel: 'conic-gradient(#ff3b6b 0 12.5%,#ffd23b 0 25%,#3bff8a 0 37.5%,#3bc4ff 0 50%,#a23bff 0 62.5%,#ff3b6b 0 75%,#ffd23b 0 87.5%,#3bff8a 0)', brilho: '#3bc4ff', anim: 'glitch', grossura: 1.8, selo: '👾' },
  'm-cristal': { anel: 'conic-gradient(#e9ffd6,#9cff5a,#3ddc84,#e9ffd6,#9cff5a,#e9ffd6)', brilho: '#9cff5a', anim: 'pulsa', grossura: 2.2, enfeite: '💠', selo: '✨' },
  // Natal
  'm-guirlanda': { anel: 'repeating-conic-gradient(#1f8a3b 0 7%,#2db34f 7% 12%,#ff2e3b 12% 14%)', brilho: '#2db34f', grossura: 1.8, selo: '🎀' },
  'm-pisca-pisca': { anel: 'repeating-conic-gradient(#ff2e3b 0 5%,#ffd000 5% 10%,#2d8cff 10% 15%,#3ddc84 15% 20%)', brilho: '#ffd000', anim: 'pisca', grossura: 2.2, enfeite: '⭐', selo: '🎄' },
  'm-bronze': { anel: '#c8733a', brilho: '#c8733a', grossura: 1.4 },
  'm-prata': { anel: '#c9c9e0', brilho: '#c9c9e0', grossura: 1.4 },
  'm-ouro': { anel: '#ffc23d', brilho: '#ffc23d', grossura: 1.4 },
  'm-perola': { anel: '#ffc2dc', brilho: '#ffc2dc', grossura: 1.4 },
  'm-quartzo-rosa': { anel: '#ff7ab8', brilho: '#ff7ab8', grossura: 1.4 },
  'm-cerejeira': { anel: '#ff8cc6', brilho: '#ff8cc6', grossura: 1.4 },
  'm-vanguarda': { anel: '#ff2d3d', brilho: '#ff2d3d', grossura: 1.4 },
  'm-borboleta-lunar': { anel: '#b98cff', brilho: '#b98cff', grossura: 1.4 },
  'm-esmeralda': { anel: '#2ee86a', brilho: '#2ee86a', grossura: 1.4 },
  'm-rubi': { anel: '#ff2d4d', brilho: '#ff2d4d', grossura: 1.4 },
  'm-imperial': { anel: '#b04dff', brilho: '#b04dff', grossura: 1.4 },
  'm-halloween': { anel: '#ff8a1f', brilho: '#ff8a1f', grossura: 1.4 },
  'm-squad': { anel: '#ff9a1f', brilho: '#ff9a1f', grossura: 1.4 },
  'm-batida': { anel: '#a855ff', brilho: '#a855ff', grossura: 1.4 },
  'm-brasa': { anel: '#ff9a1f', brilho: '#ff9a1f', grossura: 1.4 },
  'm-plasma-violeta': { anel: '#b04dff', brilho: '#b04dff', grossura: 1.4 },
  'm-fita-holografica': { anel: 'conic-gradient(#7a2cff,#5cc8ff,#ff6a00,#7a2cff)', brilho: '#9b7bff', grossura: 1.6 },
  'm-insignia-nexus': { anel: '#ffc23d', brilho: '#ffc23d', grossura: 1.6 },
  'm-relampago-roxo': { anel: '#8b3dff', brilho: '#8b3dff', grossura: 1.6 },
  'm-coroa-de-cristal': { anel: '#5cc8ff', brilho: '#5cc8ff', grossura: 1.8 },
  'm-paladino': { anel: '#5b8cff', brilho: '#5b8cff', grossura: 1.4 },
  'm-rainha': { anel: '#c94dff', brilho: '#c94dff', grossura: 1.4 },
  'm-dragao': { anel: '#b04dff', brilho: '#b04dff', grossura: 1.4 },
  'm-staff': { anel: '#ff9a1f', brilho: '#ff9a1f', grossura: 1.4 },
  'm-moderacao': { anel: '#a855ff', brilho: '#a855ff', grossura: 1.4 },
};

export const ICONES: Record<string, string> = {
  'i-controle': '🎮', 'i-fantasma': '👻', 'i-gato': '🐱', 'i-pizza': '🍕',
  'i-caveira': '💀', 'i-foguete': '🚀', 'i-arara': '🦜', 'i-bola': '⚽',
  'i-fogo': '🔥', 'i-raio': '⚡', 'i-coroa': '👑', 'i-diamante': '💎', 'i-staff': '🛡️',
  'i-alien': '👽', 'i-gorro': '🎅', 'i-boneco': '⛄',
  // Só nos baús
  'i-camera': '📹', 'i-tv': '📺', 'i-coruja': '🦉', 'i-trofeu': '🏆', 'i-taca': '🏆',
  'i-nota': '🎵', 'i-cd': '💿', 'i-vinil': '💿', 'i-mic': '🎤', 'i-microfone': '🎙️',
  'i-monitor': '🖥️', 'i-gamepad': '🎮', 'i-chat': '💬', 'i-telefone': '📞', 'i-cadeado': '🔒', 'i-velocimetro': '⏱️',
};

// Molduras com arte 3D (public/itens/molduras/<id>.webp). Medido pelo furo do meio:
// escala = tamanho da arte em "fotos"; x/y = canto da arte em relação à foto (fração)
export const MOLDURA_ARTE: Record<string, { escala: number; x: number; y: number }> = {
  'm-aurora': { escala: 1.589, x: -0.286, y: -0.37 }, 'm-fogo': { escala: 1.729, x: -0.343, y: -0.393 },
  'm-galaxia': { escala: 1.686, x: -0.327, y: -0.346 }, 'm-glitch': { escala: 1.754, x: -0.375, y: -0.381 },
  'm-coroa': { escala: 1.659, x: -0.321, y: -0.405 }, 'm-raio': { escala: 1.602, x: -0.293, y: -0.295 },
  'm-mais': { escala: 1.581, x: -0.279, y: -0.307 }, 'm-pro': { escala: 1.691, x: -0.333, y: -0.352 },
  'm-cauda-estelar': { escala: 1.585, x: -0.276, y: -0.32 }, 'm-cristal-plasma': { escala: 1.668, x: -0.331, y: -0.329 },
  'm-eclipse': { escala: 1.529, x: -0.252, y: -0.274 }, 'm-circuito': { escala: 1.602, x: -0.293, y: -0.3 },
  'm-portal': { escala: 1.577, x: -0.287, y: -0.268 }, 'm-pulso': { escala: 1.594, x: -0.29, y: -0.312 },
  'm-brasil': { escala: 1.668, x: -0.315, y: -0.322 }, 'm-cristal': { escala: 1.514, x: -0.246, y: -0.273 },
  'm-gelo': { escala: 1.598, x: -0.303, y: -0.285 }, 'm-guirlanda': { escala: 1.92, x: -0.452, y: -0.388 },
  'm-holografica': { escala: 1.677, x: -0.324, y: -0.333 }, 'm-limao': { escala: 1.602, x: -0.298, y: -0.284 },
  'm-neon-laranja': { escala: 1.619, x: -0.298, y: -0.298 }, 'm-neon-roxo': { escala: 1.645, x: -0.309, y: -0.32 },
  'm-oceano': { escala: 1.598, x: -0.247, y: -0.304 }, 'm-pisca-pisca': { escala: 1.545, x: -0.252, y: -0.299 },
  'm-pixel': { escala: 1.589, x: -0.28, y: -0.283 }, 'm-por-do-sol': { escala: 1.585, x: -0.268, y: -0.297 },
  'm-sakura': { escala: 1.896, x: -0.418, y: -0.343 },
  'm-bronze': { escala: 1.517, x: -0.248, y: -0.263 },
  'm-prata': { escala: 1.591, x: -0.293, y: -0.293 },
  'm-ouro': { escala: 1.567, x: -0.276, y: -0.303 },
  'm-perola': { escala: 1.613, x: -0.293, y: -0.321 },
  'm-quartzo-rosa': { escala: 1.597, x: -0.296, y: -0.285 },
  'm-cerejeira': { escala: 1.519, x: -0.248, y: -0.248 },
  'm-vanguarda': { escala: 1.579, x: -0.288, y: -0.279 },
  'm-borboleta-lunar': { escala: 1.526, x: -0.253, y: -0.28 },
  'm-esmeralda': { escala: 1.569, x: -0.28, y: -0.29 },
  'm-rubi': { escala: 1.564, x: -0.275, y: -0.298 },
  'm-imperial': { escala: 1.635, x: -0.313, y: -0.319 },
  'm-halloween': { escala: 1.709, x: -0.335, y: -0.379 },
  'm-squad': { escala: 1.522, x: -0.257, y: -0.278 },
  'm-batida': { escala: 1.591, x: -0.291, y: -0.32 },
  'm-pro-eletrica': { escala: 1.63, x: -0.311, y: -0.317 },
  'm-paladino': { escala: 1.632, x: -0.311, y: -0.311 },
  'm-rainha': { escala: 1.599, x: -0.295, y: -0.334 },
  'm-dragao': { escala: 1.626, x: -0.296, y: -0.326 },
  'm-staff': { escala: 1.661, x: -0.325, y: -0.448 },
  'm-moderacao': { escala: 1.483, x: -0.24, y: -0.297 },
  'm-brasa': { escala: 1.204, x: -0.097, y: -0.108 },
  'm-plasma-violeta': { escala: 1.184, x: -0.089, y: -0.095 },
  'm-fita-holografica': { escala: 1.429, x: -0.202, y: -0.224 },
  'm-insignia-nexus': { escala: 1.369, x: -0.183, y: -0.217 },
  'm-relampago-roxo': { escala: 1.586, x: -0.282, y: -0.273 },
  'm-coroa-de-cristal': { escala: 1.538, x: -0.261, y: -0.348 },
};

// Animação por cima da arte da moldura (components/nex/itens-visuais.tsx):
// faisca = brilhinhos; chama = fogo tremendo + brasas;
// raio = raios piscando; glitch = cópias coloridas tremendo; pulso = respira; arco = cores mudando
export type FxMoldura = 'faisca' | 'chama' | 'raio' | 'glitch' | 'pulso' | 'arco';
export const MOLDURA_FX: Record<string, FxMoldura[]> = {
  'm-holografica': ['arco'], 'm-portal': ['pulso'], 'm-pulso': ['pulso'],
  'm-fogo': ['chama'], 'm-raio': ['raio'], 'm-glitch': ['glitch'], 'm-pixel': ['glitch'],
  'm-galaxia': ['faisca'], 'm-cristal-plasma': ['faisca'], 'm-eclipse': ['faisca'],
  'm-aurora': ['faisca', 'arco'], 'm-cauda-estelar': ['faisca'],
  'm-coroa': ['faisca', 'pulso'], 'm-cristal': ['faisca', 'pulso'],
  'm-mais': ['faisca'], 'm-pro': ['faisca', 'chama'], 'm-pro-eletrica': ['raio'],
  'm-sakura': ['faisca'], 'm-guirlanda': ['faisca'], 'm-pisca-pisca': ['faisca'],
  'm-perola': ['faisca'],
  'm-quartzo-rosa': ['faisca'],
  'm-cerejeira': ['faisca'],
  'm-vanguarda': ['pulso'],
  'm-borboleta-lunar': ['faisca'],
  'm-esmeralda': ['faisca'],
  'm-rubi': ['faisca'],
  'm-imperial': ['faisca'],
  'm-halloween': ['faisca'],
  'm-squad': ['chama'],
  'm-batida': ['pulso'],
  'm-relampago-roxo': ['raio'], 'm-plasma-violeta': ['pulso'], 'm-fita-holografica': ['arco'], 'm-coroa-de-cristal': ['faisca'],
  'm-paladino': ['faisca',  'pulso'],
  'm-rainha': ['faisca',  'pulso'],
  'm-dragao': ['chama',  'faisca'],
  'm-staff': ['pulso'],
  'm-moderacao': ['pulso'],
};

// Aura animada em canvas (components/nex/aura-moldura.tsx) nas molduras especiais.
// Cada tipo tem um movimento só dele. Aparece em fotos grandes (perfil, call, loja);
// nas menores fica o efeito simples de MOLDURA_FX.
export type TipoAura = 'fogo' | 'gelo' | 'natal' | 'energia-roxa' | 'energia' | 'raios' | 'cosmo' | 'galaxia';
export const MOLDURA_AURA: Record<string, { tipo: TipoAura; cores?: string[] }> = {
  'm-fogo': { tipo: 'fogo' },
  'm-gelo': { tipo: 'gelo' },
  'm-pisca-pisca': { tipo: 'natal' },
  'm-neon-roxo': { tipo: 'energia-roxa' },
  'm-circuito': { tipo: 'energia' },
  'm-raio': { tipo: 'raios' },
  'm-pro-eletrica': { tipo: 'raios', cores: ['#ffb000', '#fff3a8'] },
  'm-cauda-estelar': { tipo: 'cosmo' },
  'm-galaxia': { tipo: 'galaxia' },
};

// Efeitos de perfil: partículas desenhadas por cima do cartão (components/nex/efeito-perfil.tsx)
// energia e natal: usados em volta dos baús (não são itens à venda)
export type TipoEfeito = 'faiscas' | 'neve' | 'coracoes' | 'brasas' | 'nevoa' | 'raios' | 'estrelas' | 'aurora' | 'energia' | 'natal';
export const EFEITOS: Record<string, { tipo: TipoEfeito; cores: string[] }> = {
  'e-faiscas': { tipo: 'faiscas', cores: ['#ffffff', '#ffe28a', '#c9a6ff'] },
  'e-neve': { tipo: 'neve', cores: ['#ffffff', '#d8f1ff'] },
  'e-coracoes': { tipo: 'coracoes', cores: ['#ff4f79', '#ff8cc6', '#ffb3d1'] },
  'e-brasas': { tipo: 'brasas', cores: ['#ff6a00', '#ffb000', '#ff3d00'] },
  'e-nevoa': { tipo: 'nevoa', cores: ['#7a2cff', '#b366ff', '#3b1a73'] },
  'e-raios': { tipo: 'raios', cores: ['#7fb2ff', '#c8e2ff', '#5b6bff'] },
  'e-estrelas': { tipo: 'estrelas', cores: ['#ffffff', '#ffe28a', '#9fd8ff'] },
  'e-aurora': { tipo: 'aurora', cores: ['#3dffb0', '#7a2cff', '#00d4ff'] },
  'e-pro': { tipo: 'raios', cores: ['#ffd000', '#fff3a8', '#ff6a00'] },
};

// Placas com arte (public/itens/placas/<id>.webp, 120px de altura): o meio estica e as pontas ficam iguais
export const PLACAS_ARTE = new Set(['p-arco-iris', 'p-brasa', 'p-brasil', 'p-carbono', 'p-chiclete', 'p-galaxia', 'p-natal', 'p-neon', 'p-oceano', 'p-ouro', 'p-violeta']);
// Arte de temas, zoeiras, baús e alguns sons (o resto usa emoji/desenho)
export const arteDoTema = (id: string) => `/itens/temas/${id}.webp`;
export const arteDaZoeira = (id: string) => `/itens/zoeiras/${id}.webp`;
export const arteDoBau = (id: string) => `/itens/baus/${id}.webp`;
export const SONS_ARTE = new Set(['s-buzina', 's-dragao', 's-fanfarra', 's-arcade', 's-laser', 's-moeda', 's-tambor', 's-sino', 's-raio']);

// Arte 3D de cada ícone (public/itens/icones/<id>.webp); o emoji acima fica de reserva
export const arteDoIcone = (id: string) => (ICONES[id] ? `/itens/icones/${id}.webp` : null);

// Placas: faixa atrás do nome (fundo translúcido para o nome continuar legível)
export const PLACAS: Record<string, string> = {
  'p-violeta': 'linear-gradient(90deg,rgba(122,44,255,.55),rgba(122,44,255,.12))',
  'p-brasa': 'linear-gradient(90deg,rgba(255,77,0,.55),rgba(255,140,0,.12))',
  'p-oceano': 'linear-gradient(90deg,rgba(0,140,255,.55),rgba(0,225,255,.12))',
  'p-brasil': 'linear-gradient(90deg,rgba(0,156,59,.6),rgba(255,223,0,.35),rgba(0,39,118,.3))',
  'p-chiclete': 'linear-gradient(90deg,rgba(255,77,216,.55),rgba(177,66,245,.15))',
  'p-carbono': 'repeating-linear-gradient(135deg,rgba(255,255,255,.12) 0 4px,rgba(255,255,255,.03) 4px 8px)',
  'p-ouro': 'linear-gradient(90deg,rgba(255,194,61,.6),rgba(184,134,11,.18))',
  'p-neon': 'linear-gradient(90deg,rgba(0,255,240,.45),rgba(255,0,229,.35))',
  'p-galaxia': 'radial-gradient(circle at 20% 50%,rgba(255,255,255,.35) 0 1px,transparent 2px),linear-gradient(90deg,rgba(29,75,255,.6),rgba(122,44,255,.45),rgba(255,77,216,.3))',
  'p-arco-iris': 'linear-gradient(90deg,rgba(255,59,107,.5),rgba(255,210,59,.45),rgba(59,255,138,.4),rgba(59,196,255,.4),rgba(162,59,255,.45))',
  'p-natal': 'repeating-linear-gradient(135deg,rgba(255,46,59,.55) 0 8px,rgba(255,255,255,.25) 8px 12px,rgba(31,138,59,.5) 12px 20px)',
};
