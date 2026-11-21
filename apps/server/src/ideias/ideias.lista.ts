// Ideias da página "Em breve". Para pôr, tirar ou marcar como "chegou",
// é só editar esta lista (os votos ficam guardados pelo id).
export interface Ideia { id: string; emoji: string; titulo: string; desc: string }

export const IDEIAS_EM_VOTACAO: Ideia[] = [
  { id: 'mesa-sons', emoji: '🔊', titulo: 'Mesa de sons', desc: 'Sons de meme tocando para a sala toda, na hora certa.' },
  { id: 'telao', emoji: '📺', titulo: 'Telão', desc: 'Cola um link do YouTube e a call assiste junto. Pausou, pausou para todos.' },
  { id: 'procura-squad', emoji: '🎮', titulo: 'Procura squad', desc: 'Um mural para postar o jogo, o rank e quantos faltam.' },
  { id: 'dj-abaixa', emoji: '🎵', titulo: 'DJ que abaixa sozinho', desc: 'A música do DJ baixa quando alguém fala e volta depois.' },
  { id: 'impulso', emoji: '⚡', titulo: 'Impulso de servidor', desc: 'Dê força pro servidor que você curte: ele sobe de nível e libera coisas para todos.' },
  { id: 'entrada-paga', emoji: '🎟️', titulo: 'Servidor com entrada paga', desc: 'Streamer ou coach cobra a entrada por Pix, direto no Nexus.' },
  { id: 'campeonatos', emoji: '🏆', titulo: 'Campeonatos', desc: 'Inscrição, chaveamento e transmissão para a galera assistir.' },
  { id: 'perfil-jogos', emoji: '🎮', titulo: 'Perfil gamer', desc: 'Seus jogos, rank, horário e o selo "Procurando duo" no perfil.' },
  { id: 'celular', emoji: '📱', titulo: 'App para celular', desc: 'Nexus no Android e no iPhone, com avisos e call de tela apagada.' },
];

// O que já chegou (aparece em cima, sem votação)
export const JA_CHEGOU: Ideia[] = [
  { id: 'nex', emoji: '🪙', titulo: 'Nex: presença, roleta e missões', desc: 'Ganhe Nex todo dia e gaste na loja.' },
  { id: 'loja', emoji: '🛍️', titulo: 'Loja Nexus e baús', desc: 'Molduras, ícones, placas, sons de entrada e temas.' },
  { id: 'zoeiras', emoji: '🍅', titulo: 'Zoeiras na call', desc: 'Tomate, torta, coroa, terremoto e mais.' },
  { id: 'reacoes', emoji: '😂', titulo: 'Reações e piscada na call', desc: 'Emojis voando e o quadro do amigo tremendo.' },
  { id: 'boas-vindas', emoji: '🚀', titulo: 'Servidor pronto em 1 clique', desc: 'Modelo Gamer BR e primeiros passos para quem cria.' },
  { id: 'dj', emoji: '🎧', titulo: 'DJ Nexus', desc: 'Música do YouTube e SoundCloud tocando na call.' },
  { id: 'unidos', emoji: '🃏', titulo: 'UNidos na call', desc: 'Jogo de cartas com quem está na sala.' },
];
