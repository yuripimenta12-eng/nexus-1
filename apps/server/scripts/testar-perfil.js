// Testes das regras do perfil gamer e dos benefícios dos planos (sem banco).
// Uso: node scripts/testar-perfil.js   (dentro de apps/server)
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const assert = require('assert');

function carregar(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', rel), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', 'require', js)(m, m.exports, require);
  return m.exports;
}
const { limparJogos, limparConexoes, limparCorNome } = carregar('users/perfil-gamer.ts');
const { BENEFICIOS, planoCobre, ARQUIVO_MAX_MB } = carregar('planos/planos.regras.ts');

let ok = 0;
const caso = (nome, real, esperado) => { assert.deepStrictEqual(real, esperado, nome); ok++; console.log('  ✔', nome); };
const erro = (nome, fn) => { assert.throws(fn, undefined, nome); ok++; console.log('  ✔', nome); };

// Jogos
caso('jogo com rank e nick', limparJogos([{ jogo: 'Valorant', rank: 'Ouro 2', nick: 'kanjin#777' }]), [{ jogo: 'Valorant', rank: 'Ouro 2', nick: 'kanjin#777' }]);
caso('no máximo 6 jogos', limparJogos(Array.from({ length: 9 }, (_, i) => ({ jogo: `Jogo ${i}` }))).length, 6);
caso('jogo repetido entra uma vez só', limparJogos([{ jogo: 'CS2' }, { jogo: 'cs2' }]), [{ jogo: 'CS2' }]);
caso('jogo com HTML é descartado', limparJogos([{ jogo: '<img src=x>' }, { jogo: 'Free Fire' }]), [{ jogo: 'Free Fire' }]);
caso('rank inválido some, jogo fica', limparJogos([{ jogo: 'LoL', rank: '"><script>' }]), [{ jogo: 'LoL' }]);
caso('espaços extras somem', limparJogos([{ jogo: '  GTA   RP ' }]), [{ jogo: 'GTA RP' }]);
caso('lista vazia vira null', limparJogos([]), null);
caso('null apaga', limparJogos(null), null);
caso('nome gigante é descartado', limparJogos([{ jogo: 'x'.repeat(41) }]), null);
erro('jogos que não são lista dão erro', () => limparJogos('Valorant'));

// Conexões
caso('redes conhecidas, @ tirado', limparConexoes({ twitch: '@kanjin', steam: 'kanjin_77', riot: 'kanjin #777' }), { steam: 'kanjin_77', twitch: 'kanjin', riot: 'kanjin #777' });
caso('rede desconhecida é ignorada', limparConexoes({ orkut: 'eu', youtube: 'canal' }), { youtube: 'canal' });
caso('usuário com barra (link) é recusado', limparConexoes({ instagram: 'evil.com/x' }), null);
caso('espaço só vale em riot/xbox/psn/epic', limparConexoes({ twitch: 'a b', xbox: 'Gamer Tag' }), { xbox: 'Gamer Tag' });
caso('null apaga', limparConexoes(null), null);
erro('lista no lugar do objeto dá erro', () => limparConexoes(['x']));

// Cor do nome
caso('cor única', limparCorNome('#FF6A00'), '#ff6a00');
caso('degradê', limparCorNome('#ff6a00,#7a2cff'), '#ff6a00,#7a2cff');
caso('vazio tira a cor', limparCorNome(''), null);
erro('CSS no lugar da cor dá erro', () => limparCorNome('red;background:url(x)'));

// Planos
caso('grátis não tem cor no nome nem foto animada', [BENEFICIOS.gratis.corNome, BENEFICIOS.gratis.avatarAnimado], [false, false]);
caso('Nexus+ tem cor no nome e foto animada', [BENEFICIOS.mais.corNome, BENEFICIOS.mais.avatarAnimado], [true, true]);
caso('arquivo: grátis < Nexus+ < Pro', BENEFICIOS.gratis.arquivoMB < BENEFICIOS.mais.arquivoMB && BENEFICIOS.mais.arquivoMB < BENEFICIOS.pro.arquivoMB, true);
caso('teto do envio = limite do Pro', ARQUIVO_MAX_MB, BENEFICIOS.pro.arquivoMB);
caso('fila do DJ: Pro é a maior', BENEFICIOS.pro.filaDj > BENEFICIOS.mais.filaDj && BENEFICIOS.mais.filaDj >= BENEFICIOS.gratis.filaDj, true);
caso('Pro cobre Nexus+', planoCobre('pro', 'mais'), true);
caso('Nexus+ não cobre Pro', planoCobre('mais', 'pro'), false);
caso('grátis não cobre Nexus+', planoCobre('gratis', 'mais'), false);

// O DJ usa os mesmos números (está em outro serviço, sem importar daqui)
const dj = fs.readFileSync(path.join(__dirname, '..', '..', 'dj', 'src', 'index.mjs'), 'utf8');
const m = dj.match(/FILA_POR_PLANO = \{ gratis: (\d+), mais: (\d+), pro: (\d+) \}/);
caso('fila do DJ igual nos dois lugares', m && [Number(m[1]), Number(m[2]), Number(m[3])], [BENEFICIOS.gratis.filaDj, BENEFICIOS.mais.filaDj, BENEFICIOS.pro.filaDj]);

console.log(`\n${ok} verificações passaram.`);
