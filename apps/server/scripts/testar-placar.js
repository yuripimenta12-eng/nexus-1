// Testes das contas do placar da call (sem banco).
// Uso: node scripts/testar-placar.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'placar', 'placar.regras.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', js)(m, m.exports);
const { segundosACreditar, horaDeBrasilia } = m.exports;

const t0 = new Date('2026-11-12T12:00:00Z');
const depois = (s) => new Date(t0.getTime() + s * 1000);
let ok = 0;
const caso = (nome, real, esperado) => { assert.strictEqual(real, esperado, nome); ok++; console.log('  ✔', nome); };

caso('primeiro batimento não conta nada', segundosACreditar(null, t0), 0);
caso('um minuto normal conta 60 s', segundosACreditar(t0, depois(60)), 60);
caso('atraso pequeno conta no máximo 75 s', segundosACreditar(t0, depois(120)), 75);
caso('mais de 150 s sem batimento recomeça do zero', segundosACreditar(t0, depois(151)), 0);
caso('relógio para trás não conta', segundosACreditar(t0, depois(-5)), 0);
caso('batimentos seguidos não inflam', segundosACreditar(t0, depois(1)), 1);
caso('05:30 UTC é 2h em Brasília (Coruja)', horaDeBrasilia(new Date('2026-11-12T05:30:00Z')), 2);
caso('15:00 UTC é 12h em Brasília', horaDeBrasilia(new Date('2026-11-12T15:00:00Z')), 12);
console.log(`\nResultado: ${ok} ok.`);
