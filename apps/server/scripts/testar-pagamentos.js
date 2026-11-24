// Testes das regras de preço do Pix (sem banco e sem Efí).
// Uso: node scripts/testar-pagamentos.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const ler = (f) => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
const js = ts.transpileModule(ler('pagamentos/pagamentos.regras.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const PACOTES = [{ id: 'pp-200', prismas: 200, bonus: 10, reais: '9.90' }];
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, (x) => (x === '../loja/loja.prisma' ? { PACOTES_PRISMA: PACOTES } : require(x)));
const { produto, reaisParaCentavos, centavosParaPix, ErroPagamento } = m.exports;
const erro = (fn, msg) => assert.throws(fn, (e) => e instanceof ErroPagamento && msg.test(e.message));

// Planos: preço e dias vêm do servidor
assert.deepStrictEqual(produto('plano', 'mais-mes'), { tipo: 'plano', item: 'mais-mes', centavos: 990, nome: 'Nexus+ por 1 mês', plano: 'mais', dias: 30 });
assert.strictEqual(produto('plano', 'pro-ano').centavos, 19900);
assert.strictEqual(produto('plano', 'pro-ano').dias, 365);
erro(() => produto('plano', 'gratis'), /Plano inválido/);
erro(() => produto('plano', '__proto__'), /Plano inválido/);
// O valor mandado pelo navegador é ignorado fora da doação
assert.strictEqual(produto('plano', 'mais-mes', 1).centavos, 990);

// Prisma: soma o bônus
assert.deepStrictEqual(produto('prisma', 'pp-200'), { tipo: 'prisma', item: 'pp-200', centavos: 990, nome: '210 Prisma', prismas: 210 });
erro(() => produto('prisma', 'pp-999'), /Pacote inválido/);

// Doação: inteiro em centavos, de R$ 1 a R$ 500
assert.strictEqual(produto('doacao', 'x', 350).centavos, 350);
assert.strictEqual(produto('doacao', undefined, '100').centavos, 100);
for (const v of [99, 50001, 1.5, -100, 'abc', null, undefined, NaN]) erro(() => produto('doacao', 'doacao', v), /entre R\$ 1 e R\$ 500/);

erro(() => produto('outro', 'x'), /Tipo de pagamento inválido/);

// Conversões
assert.strictEqual(reaisParaCentavos('4.90'), 490);
assert.strictEqual(reaisParaCentavos('49.90'), 4990);
assert.throws(() => reaisParaCentavos('4,90'));
assert.strictEqual(centavosParaPix(990), '9.90');
assert.strictEqual(centavosParaPix(100), '1.00');
assert.strictEqual(centavosParaPix(19900), '199.00');

// Todos os pacotes de verdade têm preço bem escrito
for (const [, reais] of ler('loja/loja.prisma.ts').matchAll(/reais: '([^']+)'/g)) reaisParaCentavos(reais);

console.log('OK: regras do Pix');
