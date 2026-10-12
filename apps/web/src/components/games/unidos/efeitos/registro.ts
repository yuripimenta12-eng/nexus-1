import type { NomeSom } from './audio';
import type { Paleta } from './particulas';

// Registro dos efeitos especiais do UNidos. Cada carta especial (e a vitória)
// tem aqui os dados do efeito; a animação em si fica em `especiais.tsx`, num
// componente com o mesmo nome de chave.
//
// Para criar um especial novo:
//   1. adicione a definição em REGISTRO (ou chame registrarEfeito)
//   2. crie o componente em especiais.tsx e coloque em COMPONENTES com a mesma chave
//   3. em controlador.ts, faça a carta (ou o acontecimento) disparar essa chave

export interface DefinicaoEfeito {
  nome: string;
  corPrincipal: string;
  duracao: number;            // ms (efeito completo)
  duracaoReduzida: number;    // ms (efeitos reduzidos / menos movimento)
  // Fases do efeito, em fração da duração: entrada → impacto → saída
  fases: { entrada: number; impacto: number; saida: number };
  paleta: Paleta;
  particulas: number;         // quantidade no impacto (antes do ajuste de qualidade)
  som: NomeSom;
  vibrar?: number[];
  escurecer: boolean;         // escurece a mesa enquanto roda
  tremer: number;             // 0 = não treme; 1–3 = intensidade (só com tremor ligado)
  prioridade: number;         // maior passa na frente na fila
  interrompivel: boolean;     // pode ser cortado por um efeito mais importante
  // No modo reduzido: mostra só o aviso curto, sem voos, giros nem tremor
  reduzido: 'aviso' | 'nenhum';
}

export const REGISTRO: Record<string, DefinicaoEfeito> = {
  bloqueio: {
    nome: 'Bloqueio', corPrincipal: '#C9C9D1', duracao: 850, duracaoReduzida: 650,
    fases: { entrada: 0.25, impacto: 0.35, saida: 0.4 },
    paleta: 'bloqueio', particulas: 34, som: 'bloqueio', vibrar: [18, 40, 18],
    escurecer: false, tremer: 0, prioridade: 20, interrompivel: true, reduzido: 'aviso',
  },
  troca: {
    nome: 'Troca', corPrincipal: '#7A2CFF', duracao: 900, duracaoReduzida: 650,
    fases: { entrada: 0.25, impacto: 0.35, saida: 0.4 },
    paleta: 'especial', particulas: 30, som: 'inverter', vibrar: [20],
    escurecer: false, tremer: 0, prioridade: 20, interrompivel: true, reduzido: 'aviso',
  },
  mais2: {
    nome: '+2', corPrincipal: '#FF6A00', duracao: 750, duracaoReduzida: 600,
    fases: { entrada: 0.3, impacto: 0.4, saida: 0.3 },
    paleta: 'energia', particulas: 34, som: 'mais2', vibrar: [25, 40, 25],
    escurecer: false, tremer: 1, prioridade: 25, interrompivel: true, reduzido: 'aviso',
  },
  call: {
    nome: 'Call', corPrincipal: '#A56BFF', duracao: 950, duracaoReduzida: 650,
    fases: { entrada: 0.3, impacto: 0.35, saida: 0.35 },
    paleta: 'especial', particulas: 30, som: 'call', vibrar: [15, 30, 15],
    escurecer: true, tremer: 0, prioridade: 25, interrompivel: true, reduzido: 'aviso',
  },
  conexao: {
    nome: 'Conexão', corPrincipal: '#FF8F3D', duracao: 950, duracaoReduzida: 650,
    fases: { entrada: 0.35, impacto: 0.3, saida: 0.35 },
    paleta: 'multicor', particulas: 44, som: 'conexao', vibrar: [20],
    escurecer: true, tremer: 0, prioridade: 30, interrompivel: true, reduzido: 'aviso',
  },
  todosunidos: {
    nome: 'Todos Unidos', corPrincipal: '#F2C35B', duracao: 1200, duracaoReduzida: 750,
    fases: { entrada: 0.3, impacto: 0.4, saida: 0.3 },
    paleta: 'multicor', particulas: 70, som: 'mais4', vibrar: [30, 50, 30, 50, 60],
    escurecer: true, tremer: 2, prioridade: 40, interrompivel: false, reduzido: 'aviso',
  },
  vitoria: {
    nome: 'Vitória', corPrincipal: '#F2C35B', duracao: 1100, duracaoReduzida: 600,
    fases: { entrada: 0.3, impacto: 0.4, saida: 0.3 },
    paleta: 'multicor', particulas: 90, som: 'vitoria', vibrar: [40, 60, 40, 60, 120],
    escurecer: false, tremer: 0, prioridade: 100, interrompivel: false, reduzido: 'aviso',
  },
};

export function registrarEfeito(chave: string, def: DefinicaoEfeito) {
  REGISTRO[chave] = def;
}

export function duracaoDe(def: DefinicaoEfeito, reduzido: boolean) {
  // Nunca segura a mesa por mais de 1,2 s
  return Math.min(1200, reduzido ? def.duracaoReduzida : def.duracao);
}
