// Testes das regras dos baús (sem banco).
// Uso: node scripts/testar-baus.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

function carregar(arquivo, deps = {}) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'loja', arquivo), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, (n) => deps[n] || require(n));
  return m.exports;
}
const cat = carregar('loja.catalogo.ts');
const baus = carregar('loja.baus.ts');
let ok = 0;
const caso = (nome, cond) => { assert.ok(cond, nome); ok++; console.log('  ✔', nome); };

caso('ids do catálogo são únicos', new Set(cat.CATALOGO.map(i => i.id)).size === cat.CATALOGO.length);
for (const b of baus.BAUS) {
  caso(`${b.nome}: todo item do baú existe no catálogo`, b.premios.every(p => !p.item || cat.itemPorId(p.item)));
  caso(`${b.nome}: cada prêmio é item OU Nex`, b.premios.every(p => !!p.item !== !!p.nex));
  const total = baus.somaPesos(b);
  const cont = b.premios.map(() => 0);
  for (let i = 0; i < total; i++) cont[baus.sortearPremio(b, i)]++;
  caso(`${b.nome}: sorteio respeita os pesos`, cont.every((c, i) => c === b.premios[i].peso));
  // Valor médio devolvido (item vale o preço/valor de referência) não passa do preço
  const media = b.premios.reduce((t, p) => t + (p.peso / total) * (p.nex || cat.valorDoItem(cat.itemPorId(p.item))), 0);
  caso(`${b.nome}: na média devolve menos do que custa (${Math.round(media)} < ${b.preco})`, media < b.preco);
}
for (const id of ['bau-neon', 'bau-som', 'bau-natal']) {
  const b = baus.bauPorId(id);
  caso(`${b.nome}: sempre sai item (nada de só Nex)`, b.premios.every(p => p.item));
  caso(`${b.nome}: tem item que só sai dele`, b.premios.some(p => cat.itemPorId(p.item).preco === null));
}
const natal = baus.bauPorId('bau-natal');
caso('Baú de Natal vale em dezembro', baus.bauAtivo(natal, new Date('2026-12-20T12:00:00Z')));
caso('Baú de Natal some depois do Dia de Reis', !baus.bauAtivo(natal, new Date('2027-01-08T12:00:00Z')));
caso('itens de Natal não vendem direto', ['m-guirlanda', 'm-pisca-pisca', 'i-gorro', 'p-natal'].every(id => cat.itemPorId(id).preco === null));

console.log(`\n${ok} testes ok`);
