// Ideias da página "Em breve". Para pôr, tirar ou marcar como "chegou",
// é só editar esta lista (os votos ficam guardados pelo id).
export interface Ideia { id: string; emoji: string; titulo: string; desc: string }

export const IDEIAS_EM_VOTACAO: Ideia[] = [
  { id: 'mesa-sons', emoji: '🔊', titulo: 'Mesa de sons', desc: 'Sons de meme tocando para a sala toda, na hora certa.' },
  { id: 'telao', emoji: '📺', titulo: 'Telão', desc: 'Cola um link do YouTube e a call assiste junto. Pausou, pausou para todos.' },
  { id: 'procura-squad', emoji: '🎮', titulo: 'Procura squad', desc: 'Um mural para postar o jogo, o rank e quantos faltam.' },
  { id: 'dj-abaixa', emoji: '🎵', titulo: 'DJ que abaixa sozinho', desc: 'A música do DJ baixa quando alguém fala e volta depois.' },
  { id: 'impulso', emoji: '⚡', titulo: 'Impulso de servidor', desc: 'Dê força pro servidor que você curte: ele sobe de nível e libera coisas para todos.' },
  { id: 'loja', emoji: '✨', titulo: 'Loja de molduras e efeitos', desc: 'Molduras, nomes brilhantes e efeitos avulsos, sem assinatura.' },
  { id: 'entrada-paga', emoji: '🎟️', titulo: 'Servidor com entrada paga', desc: 'Streamer ou coach cobra a entrada por Pix, direto no Nexus.' },
  { id: 'campeonatos', emoji: '🏆', titulo: 'Campeonatos', desc: 'Inscrição, chaveamento e transmissão para a galera assistir.' },
  { id: 'missoes', emoji: '🎯', titulo: 'Missões e recompensas', desc: 'Missões diárias que dão moedas para gastar em visual.' },
  { id: 'celular', emoji: '📱', titulo: 'App para celular', desc: 'Nexus no Android e no iPhone, com avisos e call de tela apagada.' },
];

// O que já chegou (aparece em cima, sem votação)
export const JA_CHEGOU: Ideia[] = [
  { id: 'reacoes', emoji: '😂', titulo: 'Reações e piscada na call', desc: 'Emojis voando e o quadro do amigo tremendo.' },
  { id: 'boas-vindas', emoji: '🚀', titulo: 'Servidor pronto em 1 clique', desc: 'Modelo Gamer BR e primeiros passos para quem cria.' },
  { id: 'dj', emoji: '🎧', titulo: 'DJ Nexus', desc: 'Música do YouTube e SoundCloud tocando na call.' },
  { id: 'unidos', emoji: '🃏', titulo: 'UNidos na call', desc: 'Jogo de cartas com quem está na sala.' },
];
