// Testes das contas dos planos e das indicações (sem banco).
// Uso: node scripts/testar-planos.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'planos', 'planos.regras.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { planoAtivo, estender, recompensaIndicacao, ehPlano, DIAS_POR_INDICACAO } = m.exports;

const agora = new Date('2026-11-13T12:00:00Z');
const dias = (n) => new Date(agora.getTime() + n * 86_400_000);
let ok = 0;
const caso = (nome, real, esperado) => { assert.deepStrictEqual(real, esperado, nome); ok++; console.log('  ✔', nome); };

caso('sem plano é grátis', planoAtivo(null, null, agora), 'gratis');
caso('Pro dentro da validade vale', planoAtivo('pro', dias(5), agora), 'pro');
caso('Pro vencido volta para grátis', planoAtivo('pro', dias(-1), agora), 'gratis');
caso('plano pago sem data não vale', planoAtivo('mais', null, agora), 'gratis');
caso('nome de plano inventado não vale', planoAtivo('ultra', dias(30), agora), 'gratis');
caso('ehPlano recusa "toString"', ehPlano('toString'), false);
caso('estender a partir de hoje', estender(null, 30, agora).toISOString(), dias(30).toISOString());
caso('estender soma à validade que ainda vale', estender(dias(10), 30, agora).toISOString(), dias(40).toISOString());
caso('estender validade vencida conta de hoje', estender(dias(-10), 30, agora).toISOString(), dias(30).toISOString());

const r1 = recompensaIndicacao('gratis', null, agora);
caso('quem indicou e está no grátis ganha Nexus+', r1.plano, 'mais');
caso('... por 30 dias', r1.planoAte.toISOString(), dias(DIAS_POR_INDICACAO).toISOString());
const r2 = recompensaIndicacao('pro', dias(10), agora);
caso('quem indicou e é Pro continua Pro', r2.plano, 'pro');
caso('... com 30 dias a mais', r2.planoAte.toISOString(), dias(40).toISOString());
const r3 = recompensaIndicacao('pro', dias(-3), agora);
caso('Pro vencido ganha Nexus+ de hoje', [r3.plano, r3.planoAte.toISOString()], ['mais', dias(30).toISOString()]);

console.log(`\nResultado: ${ok} ok.`);
