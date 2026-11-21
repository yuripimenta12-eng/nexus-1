// Visual dos itens da loja Nex (mesmos ids do catálogo do servidor: src/loja/loja.catalogo.ts).
export type Raridade = 'comum' | 'rara' | 'epica' | 'lendaria';
export type TipoItem = 'moldura' | 'icone' | 'placa' | 'som' | 'tema';

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
};

export const ICONES: Record<string, string> = {
  'i-controle': '🎮', 'i-fantasma': '👻', 'i-gato': '🐱', 'i-pizza': '🍕',
  'i-caveira': '💀', 'i-foguete': '🚀', 'i-arara': '🦜', 'i-bola': '⚽',
  'i-fogo': '🔥', 'i-raio': '⚡', 'i-coroa': '👑', 'i-diamante': '💎',
  'i-alien': '👽', 'i-gorro': '🎅', 'i-boneco': '⛄',
  // Só nos baús
  'i-camera': '📹', 'i-tv': '📺', 'i-coruja': '🦉', 'i-trofeu': '🏆', 'i-taca': '🏆',
  'i-nota': '🎵', 'i-cd': '💿', 'i-vinil': '💿', 'i-mic': '🎤', 'i-microfone': '🎙️',
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
};

// Placas com arte (public/itens/placas/<id>.webp, 120px de altura): o meio estica e as pontas ficam iguais
export const PLACAS_ARTE = new Set(['p-arco-iris', 'p-brasa', 'p-brasil', 'p-carbono', 'p-chiclete', 'p-galaxia', 'p-natal', 'p-neon', 'p-oceano', 'p-ouro', 'p-violeta']);
// Arte de temas, zoeiras, baús e alguns sons (o resto usa emoji/desenho)
export const arteDoTema = (id: string) => `/itens/temas/${id}.webp`;
export const arteDaZoeira = (id: string) => `/itens/zoeiras/${id}.webp`;
export const arteDoBau = (id: string) => `/itens/baus/${id}.webp`;
export const SONS_ARTE = new Set(['s-buzina', 's-dragao']);

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
