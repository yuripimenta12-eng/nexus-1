// Testes do par ou ímpar e da votação da call (sem banco).
// Uso: node scripts/testar-escolhas.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'games', 'escolhas', 'escolhas.regras.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const R = m.exports;

let n = 0;
const caso = (nome, fn) => { fn(); n++; console.log('  ok', nome); };
const falha = (fn, msg) => assert.throws(fn, e => e instanceof R.ErroEscolha && e.message.includes(msg));

caso('2 + 3 = 5 dá ímpar', () => assert.deepStrictEqual(R.resultadoParImpar('impar', 2, 3), { soma: 5, saiu: 'impar', ganhou: 'desafiante' }));
caso('0 + 0 dá par e quem pediu ímpar perde', () => assert.strictEqual(R.resultadoParImpar('impar', 0, 0).ganhou, 'desafiado'));
caso('5 + 5 = 10 é par', () => assert.strictEqual(R.resultadoParImpar('par', 5, 5).ganhou, 'desafiante'));
caso('número fora de 0..5 recusa', () => { falha(() => R.numeroDaMao(6), '0 a 5'); falha(() => R.numeroDaMao(-1), '0 a 5'); falha(() => R.numeroDaMao(2.5), '0 a 5'); falha(() => R.numeroDaMao('3'), '0 a 5'); });
caso('lado inválido recusa', () => falha(() => R.lado('talvez'), 'par ou ímpar'));

caso('votação limpa espaços e tira repetidas', () => {
  const v = R.montarVotacao('  Qual  jogo? ', ['Valorant', ' valorant ', 'CS2', '', 'LoL'], 120);
  assert.deepStrictEqual(v, { pergunta: 'Qual jogo?', opcoes: ['Valorant', 'CS2', 'LoL'], duracaoS: 120 });
});
caso('duração estranha vira 1 minuto', () => assert.strictEqual(R.montarVotacao('a', ['x', 'y'], 99999).duracaoS, 60));
caso('precisa de 2 opções diferentes', () => falha(() => R.montarVotacao('a', ['x', 'X'], 60), 'pelo menos 2'));
caso('no máximo 6 opções', () => falha(() => R.montarVotacao('a', ['1', '2', '3', '4', '5', '6', '7'], 60), 'No máximo'));
caso('sem pergunta recusa', () => falha(() => R.montarVotacao('   ', ['x', 'y'], 60), 'pergunta'));
caso('apura votos e empate', () => {
  assert.deepStrictEqual(R.apurar(3, [0, 2, 2, 0, 1]), { contagem: [2, 1, 2], total: 5, vencedoras: [0, 2] });
  assert.deepStrictEqual(R.apurar(2, []), { contagem: [0, 0], total: 0, vencedoras: [] });
  assert.deepStrictEqual(R.apurar(2, [1, 7, -1]), { contagem: [0, 1], total: 1, vencedoras: [1] });
});
console.log(`${n} testes passaram`);
