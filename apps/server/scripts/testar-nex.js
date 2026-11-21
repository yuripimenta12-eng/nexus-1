// Testes das regras da economia Nex (sem banco).
// Uso: node scripts/testar-nex.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'nex', 'nex.regras.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { PRESENCA, ROLETA, comBonus, diaBR, ontemBR, inicioDoDiaBR, proximoDiaPresenca, premioDaRoleta, MISSOES } = m.exports;

let ok = 0;
const caso = (nome, real, esperado) => { assert.deepStrictEqual(real, esperado, nome); ok++; console.log('  ✔', nome); };

// 23h30 de Brasília = 02h30 UTC do dia seguinte: o "dia" é o de Brasília
const noite = new Date('2026-11-22T02:30:00Z');
caso('23h30 em Brasília ainda é o dia 21', diaBR(noite), '2026-11-21');
caso('ontem de 21 é 20', ontemBR(noite), '2026-11-20');
caso('meia-noite de Brasília = 03h UTC', inicioDoDiaBR(noite).toISOString(), '2026-11-21T03:00:00.000Z');
const madrugada = new Date('2026-11-22T03:05:00Z'); // 00h05 de Brasília
caso('00h05 já é o dia 22', diaBR(madrugada), '2026-11-22');

caso('nunca pegou: começa no dia 1', proximoDiaPresenca(0, null, noite), 1);
caso('pegou ontem o dia 3: hoje é o 4', proximoDiaPresenca(3, '2026-11-20', noite), 4);
caso('pegou hoje: nada a pegar', proximoDiaPresenca(3, '2026-11-21', noite), null);
caso('pulou um dia: recomeça do 1', proximoDiaPresenca(5, '2026-11-19', noite), 1);
caso('depois do dia 7 volta ao 1', proximoDiaPresenca(7, '2026-11-20', noite), 1);

caso('7 dias de presença', PRESENCA.length, 7);
caso('o 7º é o maior', Math.max(...PRESENCA), PRESENCA[6]);
caso('chances da roleta somam 100%', ROLETA.reduce((t, p) => t + p.peso, 0), 100);
caso('sorteio 0 é o primeiro prêmio', premioDaRoleta(0), 0);
caso('sorteio 99 é o prêmio mais raro', premioDaRoleta(99), ROLETA.length - 1);
const cont = ROLETA.map(() => 0);
for (let i = 0; i < 100; i++) cont[premioDaRoleta(i)]++;
caso('cada prêmio sai na proporção da chance', cont, ROLETA.map(p => p.peso));

caso('grátis sem bônus', comBonus(100, 'gratis'), 100);
caso('Nexus+ ganha 25%', comBonus(100, 'mais'), 125);
caso('Pro ganha 50%', comBonus(10, 'pro'), 15);
caso('missões com ids únicos', new Set(MISSOES.map(x => x.id)).size, MISSOES.length);

console.log(`\n${ok} testes ok`);
