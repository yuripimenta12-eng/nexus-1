// Testes da parte lógica dos efeitos do UNidos (sem navegador):
//   - derivar.ts: o que aconteceu entre dois estados do servidor
//   - fila.ts: prioridade, interrupção, descarte de efeito velho
//   - registro.ts: durações dentro dos limites
//   - partida simulada inteira: todo mundo vê os mesmos acontecimentos, na mesma ordem
// Uso: node scripts/testar-unidos-efeitos.js   (dentro de apps/web)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const raiz = path.join(__dirname, '..', 'src', 'components', 'games', 'unidos');
const tmp = path.join(__dirname, '..', '.teste-unidos-efeitos');
fs.rmSync(tmp, { recursive: true, force: true });
for (const arq of ['efeitos/derivar.ts', 'efeitos/fila.ts', 'efeitos/registro.ts', 'demo/simulador.ts']) {
  const src = fs.readFileSync(path.join(raiz, arq), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const dest = path.join(tmp, arq.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}

let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };

try {
  const { derivar } = require(path.join(tmp, 'efeitos/derivar.js'));
  const F = require(path.join(tmp, 'efeitos/fila.js'));
  const { REGISTRO, duracaoDe } = require(path.join(tmp, 'efeitos/registro.js'));
  const S = require(path.join(tmp, 'demo/simulador.js'));

  // Estado base de 3 jogadores (a, b, c), vez de a
  const J = (id, cartas, extra = {}) => ({ id, nome: id.toUpperCase(), avatarUrl: null, cartas, gritou: false, ausente: false, esqueceu: false, ...extra });
  const base = (o = {}) => ({
    id: 'p', voiceRoomId: 's', hostId: 'a', status: 'jogando', seq: 10,
    jogadores: [J('a', 7), J('b', 7), J('c', 7)], topo: { id: 't0', cor: 'roxo', tipo: 'numero', valor: 5 },
    corAtual: 'roxo', vezId: 'a', sentido: 1, acumulado: 0, monte: 50, comprada: null, vencedorId: null,
    prazo: 0, ultima: null, minhaMao: [], jogaveis: [], ...o,
  });
  const carta = (id, cor, tipo, valor) => ({ id, cor, tipo, ...(valor !== undefined ? { valor } : {}) });
  const tipos = (acs) => acs.map(a => a.tipo).join(',');
  const seq = (p, n, o) => ({ ...p, seq: p.seq + n, ...o });

  console.log('● derivar: o que aconteceu');
  check('primeiro estado não anima nada', derivar(null, base()).length === 0);
  check('estado repetido (mesmo seq) não anima', derivar(base(), base()).length === 0);
  check('estado velho fora de ordem é ignorado', derivar(base({ seq: 12 }), base({ seq: 11 })).length === 0);
  check('outra partida não anima', derivar(base(), base({ id: 'q', seq: 20 })).length === 0);
  let a = derivar(base({ status: 'lobby' }), base({ seq: 11 }));
  check('lobby → jogando: distribui e mostra de quem é a vez', tipos(a) === 'inicio,vez', tipos(a));

  let ant = base();
  let nova = seq(ant, 1, { topo: carta('x1', 'roxo', 'numero', 3), jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'b', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('x1', 'roxo', 'numero', 3) } });
  a = derivar(ant, nova);
  check('jogou número: jogada + troca de vez, sem compra', tipos(a) === 'jogou,vez' && a[0].jogadorId === 'a', tipos(a));

  nova = seq(ant, 1, { topo: carta('b1', 'roxo', 'bloqueio'), jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'c', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('b1', 'roxo', 'bloqueio') } });
  a = derivar(ant, nova);
  check('bloqueio: quem perdeu a vez é o próximo de quem jogou', a[0].bloqueadoId === 'b', JSON.stringify(a[0]));
  nova = seq(ant, 1, { sentido: -1, topo: carta('b2', 'roxo', 'bloqueio'), jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'b', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('b2', 'roxo', 'bloqueio') } });
  check('bloqueio no sentido inverso pula o outro lado', derivar(ant, nova)[0].bloqueadoId === 'c');

  const dois = base({ jogadores: [J('a', 7), J('b', 7)] });
  nova = seq(dois, 1, { sentido: -1, topo: carta('tr', 'roxo', 'troca'), jogadores: [J('a', 6), J('b', 7)], vezId: 'a', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('tr', 'roxo', 'troca') } });
  a = derivar(dois, nova);
  check('troca com 2 jogadores: marca "joga de novo" e a vez não muda', a[0].doisJogadores === true && !a.some(x => x.tipo === 'vez'), tipos(a));

  nova = seq(ant, 1, { topo: carta('m2', 'roxo', 'mais2'), acumulado: 2, jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'b', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('m2', 'roxo', 'mais2') } });
  a = derivar(ant, nova);
  check('+2: o alvo é quem joga em seguida', a[0].vezId === 'b' && a[0].acumulado === 2);
  const depois = seq(nova, 1, { acumulado: 0, jogadores: [J('a', 6), J('b', 9), J('c', 7)], vezId: 'c', ultima: { jogadorId: 'b', acao: 'comprou', qtd: 2 } });
  a = derivar(nova, depois);
  check('comprar o acumulado vira penalidade (+2) para quem comprou', a.some(x => x.tipo === 'comprou' && x.jogadorId === 'b' && x.qtd === 2 && x.penalidade === 2), JSON.stringify(a));

  nova = seq(ant, 1, { topo: carta('tu', null, 'todosunidos'), corAtual: 'dourado', acumulado: 4, jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'b', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('tu', null, 'todosunidos') } });
  a = derivar(ant, nova);
  check('Todos Unidos: leva a cor escolhida e o alvo (+4)', a[0].cor === 'dourado' && a[0].vezId === 'b' && a[0].acumulado === 4);

  nova = seq(ant, 1, { topo: carta('cl', 'roxo', 'call'), jogadores: [J('a', 6), J('b', 7), J('c', 7)], vezId: 'c', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('cl', 'roxo', 'call'), alvoId: 'c' } });
  check('Call: guarda quem foi chamado', derivar(ant, nova)[0].alvoId === 'c');

  nova = seq(ant, 1, { jogadores: [J('a', 8), J('b', 7), J('c', 7)], ultima: { jogadorId: 'a', acao: 'comprou', qtd: 1 } });
  a = derivar(ant, nova);
  check('compra comum: 1 carta, sem penalidade', a.length === 1 && a[0].tipo === 'comprou' && a[0].qtd === 1 && a[0].penalidade === 0, JSON.stringify(a));

  nova = seq(ant, 1, { topo: carta('z', 'roxo', 'numero', 1), jogadores: [J('a', 1), J('b', 7), J('c', 7)], vezId: 'b', ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('z', 'roxo', 'numero', 1) } });
  check('ficou com 1 carta: aviso de última carta', derivar(base({ jogadores: [J('a', 2), J('b', 7), J('c', 7)] }), nova).some(x => x.tipo === 'ultimaCarta' && x.jogadorId === 'a'));

  nova = seq(ant, 1, { jogadores: [J('a', 2, { gritou: true }), J('b', 7), J('c', 7)], ultima: { jogadorId: 'a', acao: 'gritou' } });
  check('gritou UNidos!', derivar(base({ jogadores: [J('a', 2), J('b', 7), J('c', 7)] }), nova).some(x => x.tipo === 'gritou'));

  nova = seq(ant, 1, { jogadores: [J('a', 3), J('b', 7), J('c', 7)], ultima: { jogadorId: 'b', acao: 'pegou', alvoId: 'a', qtd: 2 } });
  a = derivar(base({ jogadores: [J('a', 1), J('b', 7), J('c', 7)] }), nova);
  check('foi pego sem gritar: +2 marcado como "pego"', a.some(x => x.tipo === 'comprou' && x.pego && x.penalidade === 2), JSON.stringify(a));

  nova = seq(ant, 1, { jogadores: [J('a', 7), J('b', 7), J('c', 7, { ausente: true })] });
  check('caiu da chamada', tipos(derivar(ant, nova)) === 'ausente');
  check('voltou para a chamada', tipos(derivar(nova, seq(nova, 1, { jogadores: [J('a', 7), J('b', 7), J('c', 7)] }))) === 'voltou');

  nova = seq(ant, 1, { status: 'fim', vencedorId: 'a', vezId: null, pontos: 42, duracao: 90000, topo: carta('f', 'roxo', 'numero', 2), jogadores: [J('a', 0), J('b', 7), J('c', 7)], ultima: { jogadorId: 'a', acao: 'jogou', carta: carta('f', 'roxo', 'numero', 2) } });
  a = derivar(ant, nova);
  check('vitória: última carta + fim com pontos e duração (sem troca de vez)', tipos(a) === 'jogou,fim' && a[1].pontos === 42 && a[1].duracao === 90000, tipos(a));

  console.log('● fila de efeitos');
  const ef = (id, chave, seqN = 1, criadoEm = 0) => ({ id, chave, seq: seqN, criadoEm, duracao: 500, dados: {} });
  let f = F.filaAdicionar({ atual: null, fila: [] }, ef(1, 'bloqueio'));
  check('fila vazia: o efeito começa na hora', f.atual?.id === 1);
  f = F.filaAdicionar(f, ef(2, 'todosunidos'));
  check('mais importante corta um efeito interrompível', f.atual?.id === 2 && f.fila.length === 0);
  f = F.filaAdicionar(f, ef(3, 'mais2'));
  check('Todos Unidos não é cortado: o +2 espera', f.atual?.id === 2 && f.fila[0]?.id === 3);
  f = F.filaAdicionar(f, ef(4, 'vitoria'));
  check('vitória entra na frente da fila', f.fila[0]?.id === 4);
  check('concluir com id errado não muda nada', F.filaConcluir(f, 99, 0) === f);
  let g = F.filaConcluir(f, 2, 100);
  check('concluir puxa o próximo da fila', g.atual?.id === 4);
  g = F.filaConcluir({ atual: ef(1, 'troca'), fila: [ef(2, 'mais2', 1, 0), ef(3, 'vitoria', 2, 0)] }, 1, F.MAX_ESPERA + 10);
  check('efeito velho é descartado, a vitória nunca', g.atual?.id === 3);
  let h = { atual: ef(1, 'todosunidos'), fila: [] };
  for (let i = 2; i < 9; i++) h = F.filaAdicionar(h, ef(i, 'troca', i));
  check(`fila nunca passa de ${F.MAX_FILA} esperando`, h.fila.length === F.MAX_FILA);
  check('efeito sem registro é ignorado', F.filaAdicionar({ atual: null, fila: [] }, ef(1, 'inexistente')).atual === null);

  console.log('● registro dos especiais');
  const chaves = ['bloqueio', 'troca', 'mais2', 'call', 'conexao', 'todosunidos', 'vitoria'];
  check('todas as especiais registradas', chaves.every(k => REGISTRO[k]));
  check('nenhum efeito passa de 1,2 s', Object.values(REGISTRO).every(d => duracaoDe(d, false) <= 1200 && duracaoDe(d, true) <= 1200));
  check('especiais comuns entre 500 e 950 ms', ['bloqueio', 'troca', 'mais2', 'call', 'conexao'].every(k => REGISTRO[k].duracao >= 500 && REGISTRO[k].duracao <= 950));
  check('modo reduzido é sempre mais curto', Object.values(REGISTRO).every(d => d.duracaoReduzida <= d.duracao));
  check('fases somam 100%', Object.values(REGISTRO).every(d => Math.abs(d.fases.entrada + d.fases.impacto + d.fases.saida - 1) < 1e-9));

  console.log('● partida simulada inteira');
  let erros = 0, iguais = true, jogadas = 0, especiais = 0, fins = 0, nada = 0;
  for (let partida = 0; partida < 30; partida++) {
    let s = S.criarSim({ id: 'eu', nome: 'Eu', avatarUrl: null }, 2 + (partida % 4));
    const ids = s.jogadores.map(j => j.id);
    let visoes = ids.map(id => S.visaoSim(s, id));
    for (let k = 0; k < 400 && s.status === 'jogando'; k++) {
      const antes = s;
      s = S.jogadaDoBot(s);
      if (s === antes) { nada++; break; }
      const novas = ids.map(id => S.visaoSim(s, id));
      let ref = null;
      novas.forEach((v, i) => {
        let acs;
        try { acs = derivar(visoes[i], v); } catch (e) { erros++; return; }
        const txt = JSON.stringify(acs);
        if (ref === null) ref = txt; else if (ref !== txt) iguais = false;
        for (const x of acs) {
          if (x.tipo === 'jogou') { if (i === 0) { jogadas++; if (x.carta.tipo !== 'numero') especiais++; } if (x.carta.id !== v.topo.id) erros++; }
          if (x.tipo === 'comprou' && !(x.qtd > 0)) erros++;
          if (x.tipo === 'fim' && i === 0) fins++;
        }
      });
      visoes = novas;
    }
  }
  check('nenhum erro ao ler 30 partidas simuladas', erros === 0, `erros=${erros}`);
  check('todo mundo vê os mesmos acontecimentos, na mesma ordem', iguais);
  check(`jogadas viraram animação (${jogadas} jogadas, ${especiais} especiais, ${fins} vitórias)`, jogadas > 100 && especiais > 10 && fins > 0, `nada=${nada}`);
} catch (e) {
  falhas++;
  console.log('ERRO no teste:', e.stack || e.message);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nResultado: ${ok} ok, ${falhas} falha(s).`);
  process.exit(falhas ? 1 : 0);
}
