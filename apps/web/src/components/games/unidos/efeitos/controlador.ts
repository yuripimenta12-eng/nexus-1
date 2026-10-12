import { COR_HEX } from '../carta';
import type { Carta } from '../unidos.store';
import { audio, vibrar } from './audio';
import { modoAtual } from './config';
import type { Acontecimento } from './derivar';
import { useFilaEfeitos } from './fila';
import { particulas, PALETAS } from './particulas';
import { pontoDe, pontoJogador, pontoMesa } from './posicoes';
import { voos } from './voos';

// Controlador das animações: recebe o que aconteceu (derivar.ts) e dispara
// sons, partículas, voos e os efeitos grandes da fila. A carta jogada voando
// até a pilha fica na própria pilha (pilha.tsx), que chama impactoNaPilha.

export interface Contexto {
  meuId: string;
  seq: number;
  nome: (id?: string | null) => string;
}

// Carta especial → efeito grande registrado
const ESPECIAL: Partial<Record<Carta['tipo'], string>> = {
  bloqueio: 'bloqueio', troca: 'troca', mais2: 'mais2', call: 'call', conexao: 'conexao', todosunidos: 'todosunidos',
};

const timers = new Set<ReturnType<typeof setTimeout>>();
function depois(ms: number, fn: () => void) {
  const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
  timers.add(t);
}

export function cancelarTudo() {
  timers.forEach(clearTimeout);
  timers.clear();
  useFilaEfeitos.getState().limpar();
  particulas.limpar();
}

export function corDaCarta(c: Carta | null | undefined, corEscolhida?: string | null) {
  if (c?.cor) return COR_HEX[c.cor].base;
  if (corEscolhida && COR_HEX[corEscolhida as keyof typeof COR_HEX]) return COR_HEX[corEscolhida as keyof typeof COR_HEX].base;
  return '#A56BFF';
}

// A carta pousou na pilha: batida, partículas na cor da carta
export function impactoNaPilha(c: Carta, corAtual: string | null) {
  audio.tocar(c.tipo === 'numero' ? 'jogar' : 'impacto');
  const p = pontoMesa();
  const especial = c.tipo !== 'numero';
  const cor = corDaCarta(c, corAtual);
  particulas.explodir(p.x, p.y, {
    cores: especial ? (c.cor ? [cor, ...PALETAS.especial.slice(0, 2)] : PALETAS.multicor) : [cor, '#ffffff', cor],
    qtd: especial ? 26 : 14, velocidade: especial ? 300 : 220, vida: 0.6, espalhar: p.w * 0.3, gravidade: 200,
  });
}

export function reagir(acs: Acontecimento[], ctx: Contexto) {
  const { meuId, nome } = ctx;
  const modo = modoAtual();
  for (const a of acs) {
    switch (a.tipo) {
      case 'inicio': {
        audio.tocar('distribuir');
        // Cartas voando do monte para cada adversário (a minha mão anima sozinha)
        const monte = pontoDe('monte');
        document.querySelectorAll('[data-unidos-alvo^="jogador:"]').forEach((el, k) => {
          const id = el.getAttribute('data-unidos-alvo')!.slice(8);
          if (id === meuId) return;
          for (let n = 0; n < 3; n++) voos.carta(monte, pontoJogador(id), { larg: 40, largFinal: 20, atraso: k * 0.08 + n * 0.12, duracao: 0.4 });
        });
        break;
      }
      case 'jogou': {
        const chave = ESPECIAL[a.carta.tipo];
        if (a.jogadorId === meuId) vibrar(12);
        if (!chave) break;
        // O efeito grande começa com a carta ainda no ar
        const alvoId = chave === 'bloqueio' ? a.bloqueadoId
          : chave === 'call' ? a.alvoId
            : chave === 'mais2' || chave === 'todosunidos' ? a.vezId
              : null;
        depois(modo.reduzido ? 60 : 180, () => useFilaEfeitos.getState().adicionar(chave, ctx.seq, {
          jogadorId: a.jogadorId, alvoId, carta: a.carta, cor: a.cor, sentido: a.sentido,
          doisJogadores: a.doisJogadores, qtd: a.acumulado,
        }, modo.reduzido));
        break;
      }
      case 'comprou': {
        const alvo = pontoJogador(a.jogadorId);
        if (a.jogadorId !== meuId) {
          // Verso voando do monte até a pessoa (ninguém vê a carta dos outros)
          const monte = pontoDe('monte');
          const n = Math.min(a.qtd, 6);
          for (let k = 0; k < n; k++) {
            voos.carta(monte, alvo, { larg: 44, largFinal: 22, atraso: k * 0.11, duracao: 0.42, aoChegar: k < 3 ? () => audio.tocar('comprar') : undefined });
          }
        } else {
          // A minha mão anima a chegada; aqui só o som de cada carta, em sequência
          for (let k = 0; k < Math.min(a.qtd, 6); k++) depois(k * 120 + 80, () => audio.tocar('comprar'));
          if (a.penalidade) vibrar([30, 40, 30]);
        }
        if (a.penalidade) {
          voos.texto(alvo, a.pego ? 'PEGO!' : `+${a.penalidade}`, { sub: a.pego ? 'esqueceu de gritar: +2' : undefined, cor: a.penalidade >= 4 ? '#F2C35B' : '#FF6A00', tamanho: 34, acima: (alvo?.h || 60) / 2 + 12, atraso: 0.25 });
          depois(250, () => audio.tocar('impacto'));
        }
        break;
      }
      case 'vez': {
        const para = pontoJogador(a.para);
        const de = a.de ? pontoJogador(a.de) : pontoMesa();
        voos.linha(de, para, '#FF8F3D', modo.reduzido ? 0.3 : 0.55);
        if (a.para === meuId) { audio.tocar('vez'); vibrar(20); }
        break;
      }
      case 'gritou': {
        const p = pontoJogador(a.jogadorId);
        voos.texto(p, 'UNidos!', { cor: '#FFB27D', tamanho: 30, acima: (p?.h || 60) / 2 + 10 });
        if (p) particulas.explodir(p.x, p.y, { cores: PALETAS.energia, qtd: 24, velocidade: 260, vida: 0.7 });
        audio.tocar('gritar');
        break;
      }
      case 'ultimaCarta': {
        const p = pontoJogador(a.jogadorId);
        voos.texto(p, 'ÚLTIMA CARTA!', { cor: '#F2C35B', tamanho: 22, acima: (p?.h || 60) / 2 + 14, duracao: 1.6, atraso: 0.3, sub: a.jogadorId === meuId ? 'Grite UNidos!' : nome(a.jogadorId) });
        voos.pulso(p, '#F2C35B', { atraso: 0.3, duracao: 0.9 });
        depois(300, () => audio.tocar('ultimaCarta'));
        break;
      }
      case 'ausente': {
        const p = pontoJogador(a.jogadorId);
        voos.texto(p, 'caiu da chamada', { cor: '#a99cb8', tamanho: 13, acima: (p?.h || 60) / 2 + 8, duracao: 1.6 });
        break;
      }
      case 'voltou': {
        const p = pontoJogador(a.jogadorId);
        voos.pulso(p, '#7CFFB2', { duracao: 0.8 });
        voos.texto(p, 'voltou!', { cor: '#7CFFB2', tamanho: 15, acima: (p?.h || 60) / 2 + 8 });
        audio.tocar('reconectar');
        break;
      }
      case 'fim': {
        // Espera a última carta pousar na pilha antes da festa
        depois(modo.reduzido ? 100 : 420, () => useFilaEfeitos.getState().adicionar('vitoria', ctx.seq, {
          vencedorId: a.vencedorId, pontos: a.pontos, duracaoPartida: a.duracao,
        }, modo.reduzido));
        break;
      }
      case 'saiu': break;
    }
  }
}
