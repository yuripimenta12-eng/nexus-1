// Testes das contas do placar da call (sem banco).
// Uso: node scripts/testar-placar.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'placar', 'placar.regras.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
const m = { exports: {} };
new Function('module', 'exports', 'require', js)(m, m.exports, require);
const { segundosACreditar, horaDeBrasilia, lerReciboDj, eventosAtivos, FIM_NEXUS_2026, contaMinutoJogo } = m.exports;

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
// Recibo do DJ: mesmo formato que apps/dj/src/index.mjs (reciboPlacar) gera
const crypto = require('crypto');
const recibo = (segredo, dados) => {
  const p = Buffer.from(JSON.stringify(dados)).toString('base64url');
  return `${p}.${crypto.createHmac('sha256', segredo).update('placar-dj.' + p).digest('base64url')}`;
};
const agora = t0.getTime();
const bom = { sub: 'u1', room: 'sala-1', id: 'm1', iat: agora - 1000 };
caso('recibo do DJ válido é aceito', JSON.stringify(lerReciboDj(recibo('seg', bom), 'seg', agora)), JSON.stringify({ sub: 'u1', room: 'sala-1', id: 'm1' }));
caso('recibo com outro segredo é recusado', lerReciboDj(recibo('outro', bom), 'seg', agora), null);
const assinatura = recibo('seg', bom).split('.')[1];
const trocado = Buffer.from(JSON.stringify({ ...bom, sub: 'u2' })).toString('base64url');
caso('recibo com dados trocados é recusado', lerReciboDj(`${trocado}.${assinatura}`, 'seg', agora), null);
caso('recibo com mais de 10 min é recusado', lerReciboDj(recibo('seg', { ...bom, iat: agora - 11 * 60_000 }), 'seg', agora), null);
caso('recibo do futuro é recusado', lerReciboDj(recibo('seg', { ...bom, iat: agora + 5 * 60_000 }), 'seg', agora), null);
caso('lixo no lugar do recibo é recusado', lerReciboDj('abc', 'seg', agora), null);
caso('sem segredo configurado nada é aceito', lerReciboDj(recibo('', bom), '', agora), null);
// Eventos (horário de Brasília)
const ev = (iso) => JSON.stringify(eventosAtivos(new Date(iso)));
caso('23/12 23h59 Brasília ainda não é Natal', ev('2026-12-24T02:59:00Z'), '[]');
caso('24/12 0h Brasília já é Natal', ev('2026-12-24T03:00:00Z'), '["natal-2026"]');
caso('25/12 23h59 Brasília ainda é Natal', ev('2026-12-26T02:59:00Z'), '["natal-2026"]');
caso('26/12 0h Brasília acabou o Natal', ev('2026-12-26T03:00:00Z'), '[]');
caso('31/12 23h29 ainda não é a virada', ev('2027-01-01T02:29:00Z'), '[]');
caso('31/12 23h45 é a virada', ev('2027-01-01T02:45:00Z'), '["virada-2027"]');
caso('01/01 0h29 ainda é a virada', ev('2027-01-01T03:29:00Z'), '["virada-2027"]');
caso('01/01 0h30 acabou a virada', ev('2027-01-01T03:30:00Z'), '[]');
caso('terça de Carnaval (09/02/2027) vale', ev('2027-02-09T20:00:00Z'), '["carnaval-2027"]');
caso('quarta de cinzas (10/02/2027) não vale', ev('2027-02-10T12:00:00Z'), '[]');
caso('Nexus 2026 acaba na meia-noite de Brasília', FIM_NEXUS_2026.toISOString(), '2027-01-01T03:00:00.000Z');
// Tempo de jogo
caso('primeiro aviso de jogo conta', contaMinutoJogo(undefined, 1000), true);
caso('aviso repetido em 10 s não conta', contaMinutoJogo(1000, 11_000), false);
caso('aviso 1 min depois conta', contaMinutoJogo(1000, 61_000), true);
console.log(`\nResultado: ${ok} ok.`);
