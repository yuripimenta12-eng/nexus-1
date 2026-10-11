// Teste das regras do UNidos (motor do jogo, sem rede).
// Roda dentro do container (usa o código compilado em dist/) ou localmente
// com UNIDOS_ENGINE apontando para o unidos.engine.js compilado.
const path = require('path');
const J = require(process.env.UNIDOS_ENGINE || path.join(__dirname, '../../dist/games/unidos/unidos.engine'));

let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const lanca = (fn, trecho) => { try { fn(); return false; } catch (e) { return e instanceof J.ErroJogo && (!trecho || e.message.includes(trecho)); } };

// Aleatório previsível para o teste
let semente = 42;
const rng = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };

const pessoa = (id) => ({ id, nome: id.toUpperCase(), avatarUrl: null });
function mesa(n) {
  const e = J.novaPartida('p1', 'sala1', pessoa('a'));
  for (const id of ['b', 'c', 'd'].slice(0, n - 1)) J.entrar(e, pessoa(id));
  J.iniciar(e, rng, 0, 30_000);
  return e;
}
const carta = (id, cor, tipo, valor) => ({ id, cor, tipo, ...(valor !== undefined ? { valor } : {}) });
// Prepara uma situação exata: de quem é a vez, carta da mesa e mãos
function cena(e, vez, topoCarta, maos) {
  e.vez = vez; e.descarte = [topoCarta]; e.corAtual = topoCarta.cor ?? 'laranja';
  e.acumulado = 0; e.comprada = null; e.sentido = 1;
  maos.forEach((m, i) => { e.jogadores[i].mao = m; e.jogadores[i].gritou = false; });
}

console.log('● Baralho e início');
const b = J.criarBaralho();
const conta = (f) => b.filter(f).length;
check('112 cartas', b.length === 112, String(b.length));
check('76 números, 8 Mutado, 8 Eco, 8 Ping +2, 4 Troca', conta(c => c.tipo === 'numero') === 76 && conta(c => c.tipo === 'mutado') === 8
  && conta(c => c.tipo === 'eco') === 8 && conta(c => c.tipo === 'mais2') === 8 && conta(c => c.tipo === 'troca') === 4);
check('4 Portal e 4 Tempestade, sem cor', conta(c => c.tipo === 'portal' && !c.cor) === 4 && conta(c => c.tipo === 'tempestade' && !c.cor) === 4);
check('ids únicos', new Set(b.map(c => c.id)).size === 112);

let e = mesa(3);
check('cada um começa com 7', e.jogadores.every(p => p.mao.length === 7));
check('primeira carta da mesa é número', J.topo(e).tipo === 'numero' && e.corAtual === J.topo(e).cor);
check('monte com o resto (112 - 21 - 1)', e.monte.length === 90, String(e.monte.length));
check('ninguém fica sem as cartas contadas', e.monte.length + e.descarte.length + e.jogadores.reduce((s, p) => s + p.mao.length, 0) === 112);
check('não começa com 1 jogador só', lanca(() => J.iniciar(J.novaPartida('x', 's', pessoa('a')), rng), 'pelo menos 2'));

console.log('● Combinar cartas');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[], [], []]);
check('mesma cor serve', J.podeJogar(e, carta('x', 'roxo', 'numero', 2)));
check('mesmo número serve', J.podeJogar(e, carta('x', 'verde', 'numero', 5)));
check('cor e número diferentes não servem', !J.podeJogar(e, carta('x', 'verde', 'numero', 2)));
check('preta sempre serve', J.podeJogar(e, carta('x', null, 'portal')) && J.podeJogar(e, carta('x', null, 'tempestade')));
cena(e, 0, carta('t', 'roxo', 'mutado'), [[], [], []]);
check('mesmo símbolo de outra cor serve', J.podeJogar(e, carta('x', 'verde', 'mutado')));

console.log('● Vez e jogadas inválidas');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('a1', 'roxo', 'numero', 1), carta('a2', 'verde', 'numero', 9)], [carta('b1', 'roxo', 'numero', 3)], [carta('c1', 'ciano', 'numero', 4)]]);
check('fora da vez é recusado', lanca(() => J.jogar(e, 'b', 'b1', {}, rng), 'Não é a sua vez'));
check('carta que não está na mão é recusada', lanca(() => J.jogar(e, 'a', 'b1', {}, rng), 'não está na sua mão'));
check('carta que não combina é recusada', lanca(() => J.jogar(e, 'a', 'a2', {}, rng), 'não combina'));
J.jogar(e, 'a', 'a1', {}, rng);
check('jogada válida passa a vez', J.daVez(e).id === 'b' && J.topo(e).id === 'a1');

console.log('● Especiais');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('m', 'roxo', 'mutado'), carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
J.jogar(e, 'a', 'm', {}, rng);
check('Mutado pula o próximo', J.daVez(e).id === 'c');

cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('e1', 'roxo', 'eco'), carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
J.jogar(e, 'a', 'e1', {}, rng);
check('Eco inverte o sentido (3 jogadores)', e.sentido === -1 && J.daVez(e).id === 'c');

let dois = mesa(2);
cena(dois, 0, carta('t', 'roxo', 'numero', 5), [[carta('e2', 'roxo', 'eco'), carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)]]);
J.jogar(dois, 'a', 'e2', {}, rng);
check('Eco com 2 jogadores: joga de novo', J.daVez(dois).id === 'a');

cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('p', null, 'portal'), carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
check('Portal exige escolher a cor', lanca(() => J.jogar(e, 'a', 'p', {}, rng), 'Escolha uma cor'));
check('cor inventada é recusada', lanca(() => J.jogar(e, 'a', 'p', { cor: 'rosa' }, rng), 'Escolha uma cor'));
J.jogar(e, 'a', 'p', { cor: 'ciano' }, rng);
check('Portal muda a cor', e.corAtual === 'ciano' && J.daVez(e).id === 'b');

console.log('● Acumular +2 e +4');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [
  [carta('d1', 'roxo', 'mais2'), carta('z', 'verde', 'numero', 1)],
  [carta('d2', 'verde', 'mais2'), carta('b9', 'roxo', 'numero', 5)],
  [carta('c9', 'ciano', 'numero', 4)],
]);
J.jogar(e, 'a', 'd1', {}, rng);
check('Ping +2 acumula 2', e.acumulado === 2 && J.daVez(e).id === 'b');
check('com +2 na mesa, carta comum não vale', lanca(() => J.jogar(e, 'b', 'b9', {}, rng), 'compre 2'));
J.jogar(e, 'b', 'd2', {}, rng);
check('+2 em cima de +2 soma 4', e.acumulado === 4 && J.daVez(e).id === 'c');
const antes = e.jogadores[2].mao.length;
J.comprar(e, 'c', rng);
check('quem não tem compra tudo e perde a vez', e.jogadores[2].mao.length === antes + 4 && e.acumulado === 0 && J.daVez(e).id === 'a');

cena(e, 0, carta('t', 'roxo', 'numero', 5), [
  [carta('t1', null, 'tempestade'), carta('z', 'verde', 'numero', 1)],
  [carta('t2', null, 'tempestade'), carta('w', 'verde', 'numero', 1)],
  [carta('c9', 'ciano', 'numero', 4)],
]);
J.jogar(e, 'a', 't1', { cor: 'verde' }, rng);
J.jogar(e, 'b', 't2', { cor: 'roxo' }, rng);
check('Tempestade em cima de Tempestade soma 8', e.acumulado === 8 && e.corAtual === 'roxo');

console.log('● Troca');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [
  [carta('tr', 'roxo', 'troca'), carta('a2', 'verde', 'numero', 1)],
  [carta('b1', 'ciano', 'numero', 1), carta('b2', 'ciano', 'numero', 2), carta('b3', 'ciano', 'numero', 3)],
  [carta('c1', 'ciano', 'numero', 4)],
]);
check('Troca exige escolher com quem', lanca(() => J.jogar(e, 'a', 'tr', {}, rng), 'trocar'));
check('não troca consigo mesmo', lanca(() => J.jogar(e, 'a', 'tr', { alvoId: 'a' }, rng), 'trocar'));
J.jogar(e, 'a', 'tr', { alvoId: 'b' }, rng);
check('Troca troca as mãos inteiras', e.jogadores[0].mao.map(c => c.id).join() === 'b1,b2,b3' && e.jogadores[1].mao.map(c => c.id).join() === 'a2');

console.log('● Comprar e passar');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
check('não passa sem comprar', lanca(() => J.passar(e, 'a'), 'Compre'));
e.monte.unshift(carta('boa', 'roxo', 'numero', 7));
J.comprar(e, 'a', rng);
check('comprou carta que serve: continua na vez', J.daVez(e).id === 'a' && e.comprada === 'boa');
check('não compra duas vezes', lanca(() => J.comprar(e, 'a', rng), 'já comprou'));
check('só pode jogar a carta comprada', lanca(() => J.jogar(e, 'a', 'z', {}, rng)));
J.passar(e, 'a');
check('pode passar depois de comprar', J.daVez(e).id === 'b');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
e.monte.unshift(carta('ruim', 'verde', 'numero', 8));
J.comprar(e, 'a', rng);
check('comprou carta que não serve: passa sozinho', J.daVez(e).id === 'b' && !e.comprada);

console.log('● UNidos!');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('a1', 'roxo', 'numero', 1), carta('a2', 'verde', 'numero', 9)], [carta('x', 'verde', 'numero', 2), carta('x2', 'verde', 'numero', 6), carta('x3', 'verde', 'numero', 7)], [carta('y', 'verde', 'numero', 3)]]);
check('não grita com muitas cartas', lanca(() => J.gritar(e, 'b'), '1 ou 2'));
J.jogar(e, 'a', 'a1', {}, rng);
check('com 1 carta sem gritar, fica exposto', J.visao(e, 'b').jogadores[0].esqueceu === true);
J.pegar(e, 'b', 'a', rng);
check('foi pego: compra 2', e.jogadores[0].mao.length === 3);
check('não dá para pegar quem não esqueceu', lanca(() => J.pegar(e, 'b', 'a', rng), 'não esqueceu'));
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('a1', 'roxo', 'numero', 1), carta('a2', 'verde', 'numero', 9)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
J.gritar(e, 'a');
J.jogar(e, 'a', 'a1', {}, rng);
check('gritou antes: não pode ser pego', lanca(() => J.pegar(e, 'b', 'a', rng), 'não esqueceu'));

console.log('● Fim de jogo, tempo e saída');
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('ult', 'roxo', 'mais2')], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
J.jogar(e, 'a', 'ult', {}, rng);
check('última carta vence (mesmo sendo +2)', e.status === 'fim' && e.vencedorId === 'a');
check('depois do fim ninguém joga', lanca(() => J.comprar(e, 'b', rng), 'não está rolando'));

e = mesa(3);
cena(e, 1, carta('t', 'roxo', 'numero', 5), [[carta('a1', 'verde', 'numero', 1)], [carta('b1', 'verde', 'numero', 1)], [carta('c1', 'verde', 'numero', 1)]]);
e.monte.unshift(carta('qq', 'verde', 'numero', 4));
J.tempoEsgotado(e, rng);
check('tempo esgotado: compra por ele e passa', e.jogadores[1].mao.length === 2 && J.daVez(e).id === 'c');

e = mesa(3);
e.vez = 2;
J.sair(e, 'b');
check('alguém sai: a mesa continua', e.status === 'jogando' && e.jogadores.length === 2 && J.daVez(e).id === 'c');
J.sair(e, 'c');
check('sobrou 1: ele vence', e.status === 'fim' && e.vencedorId === 'a');

e = mesa(3);
e.monte = [];
cena(e, 0, carta('t', 'roxo', 'numero', 5), [[carta('z', 'verde', 'numero', 1)], [carta('x', 'verde', 'numero', 2)], [carta('y', 'verde', 'numero', 3)]]);
e.descarte = [carta('v1', 'ciano', 'numero', 1), carta('v2', 'ciano', 'numero', 2), carta('t', 'roxo', 'numero', 5)];
J.comprar(e, 'a', rng);
check('monte vazio: embaralha o descarte (menos a de cima)', e.jogadores[0].mao.length === 2 && J.topo(e).id === 't');

console.log('● Privacidade');
e = mesa(3);
const v = J.visao(e, 'a');
check('vejo a minha mão', v.minhaMao.length === 7);
check('dos outros vejo só quantas cartas têm', v.jogadores.every(p => p.mao === undefined && typeof p.cartas === 'number'));
check('o monte não é revelado', !Array.isArray(v.monte) && typeof v.monte === 'number');
check('quem está fora da mesa não vê mão nenhuma', J.visao(e, 'intruso').minhaMao.length === 0);

console.log(`\nResultado: ${ok} ok, ${falhas} falha(s).`);
process.exit(falhas ? 1 : 0);
