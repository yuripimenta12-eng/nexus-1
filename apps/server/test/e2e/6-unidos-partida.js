// Teste de ponta a ponta do UNidos pela rede (tempo real), como o site usa.
// Cria contas/servidor temporários e apaga tudo no final.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const WS = require('ws');
const prisma = new PrismaClient();
const ORIGIN = 'https://www.nexuslink.art';
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const call = async (method, path, body, token) => {
  const r = await fetch(`http://${HOST}/api${path}`, { method, headers: { 'content-type': 'application/json', Origin: ORIGIN, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 7);
const criar = async (x) => prisma.user.create({ data: { email: `teste-${rnd}-${x}@exemplo.invalid`, username: `teste_${rnd}_${x}`, passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: 'Jogador ' + x.toUpperCase() } } } });
const entrar = async (u) => (await call('POST', '/auth/login', { email: u.email, password: SENHA })).data?.accessToken;

// Cliente Socket.IO mínimo com resposta (ack)
function socket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN } });
    let n = 1;
    const acks = new Map();
    const s = {
      ev: [],
      emit: (e, d) => ws.send('42' + JSON.stringify([e, d])),
      pedir: (e, d) => new Promise((res) => { const id = n++; acks.set(id, res); ws.send('42' + id + JSON.stringify([e, d])); setTimeout(() => { if (acks.has(id)) { acks.delete(id); res({ ok: false, erro: 'sem resposta' }); } }, 4000); }),
      ultimo: (e) => [...s.ev].reverse().find(x => x[0] === e)?.[1],
      close: () => { try { ws.close(); } catch {} },
    };
    const t = setTimeout(() => reject(new Error('socket não conectou')), 6000);
    ws.on('message', (b) => {
      const m = b.toString();
      if (m[0] === '0') ws.send('40' + JSON.stringify({ token }));
      else if (m === '2') ws.send('3');
      else if (m.startsWith('40')) { clearTimeout(t); setTimeout(() => resolve(s), 400); }
      else if (m.startsWith('43')) { const mm = m.slice(2).match(/^(\d+)(.*)$/); const cb = acks.get(+mm[1]); if (cb) { acks.delete(+mm[1]); cb(JSON.parse(mm[2])[0]); } }
      else if (m.startsWith('42')) { try { s.ev.push(JSON.parse(m.slice(2))); } catch {} }
    });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}

(async () => {
  const A = await criar('a'), B = await criar('b'), C = await criar('c'), F = await criar('fora');
  let serverId = null; const socks = [];
  try {
    const [tA, tB, tC, tF] = [await entrar(A), await entrar(B), await entrar(C), await entrar(F)];
    serverId = (await call('POST', '/servers', { name: `Teste UNidos ${rnd}` }, tA)).data?.id;
    for (const u of [B, C]) await prisma.serverMember.create({ data: { serverId, userId: u.id } });
    const sala = await prisma.voiceRoom.findFirst({ where: { serverId } })
      || await prisma.voiceRoom.create({ data: { serverId, name: 'Sala teste', livekitRoom: `teste-${rnd}` } });

    const [sA, sB, sC, sF] = [await socket(tA), await socket(tB), await socket(tC), await socket(tF)];
    socks.push(sA, sB, sC, sF);
    for (const s of [sA, sB]) s.emit('voice:join', { voiceRoomId: sala.id, serverId });
    await sleep(600);

    console.log('● Mesa');
    let r = await sC.pedir('unidos:abrir', { voiceRoomId: sala.id });
    check('quem não está na chamada não abre mesa', r.ok === false && /chamada/.test(r.erro), JSON.stringify(r));
    r = await sA.pedir('unidos:abrir', { voiceRoomId: sala.id });
    check('quem está na chamada abre a mesa', r.ok && r.partida?.status === 'lobby' && r.partida.hostId === A.id, JSON.stringify(r));
    const pid = r.partida?.id;
    await sleep(400);
    check('a chamada fica sabendo da mesa (botão Entrar)', sB.ultimo('unidos:sala')?.id === pid);
    r = await sA.pedir('unidos:iniciar', { partidaId: pid });
    check('não começa sozinho', r.ok === false && /2 jogadores/.test(r.erro));
    r = await sF.pedir('unidos:entrar', { partidaId: pid });
    check('quem não é do servidor/chamada não entra', r.ok === false);
    r = await sB.pedir('unidos:entrar', { partidaId: pid });
    check('B entra', r.ok && r.partida?.jogadores.length === 2);
    sC.emit('voice:join', { voiceRoomId: sala.id, serverId });
    await sleep(500);
    r = await sC.pedir('unidos:entrar', { partidaId: pid });
    check('C entra depois de entrar na chamada', r.ok && r.partida?.jogadores.length === 3);
    r = await sB.pedir('unidos:iniciar', { partidaId: pid });
    check('só quem abriu começa', r.ok === false && /abriu a mesa/.test(r.erro));

    console.log('● Partida');
    r = await sA.pedir('unidos:iniciar', { partidaId: pid });
    check('partida começa', r.ok, JSON.stringify(r));
    await sleep(500);
    const estados = [sA, sB, sC].map(s => s.ultimo('unidos:estado'));
    check('cada um recebe 7 cartas', estados.every(e => e?.minhaMao?.length === 7), JSON.stringify(estados.map(e => e?.minhaMao?.length)));
    const idsA = new Set(estados[0].minhaMao.map(c => c.id));
    check('as mãos são diferentes (ninguém recebe a do outro)', estados[1].minhaMao.every(c => !idsA.has(c.id)) && estados[2].minhaMao.every(c => !idsA.has(c.id)));
    const bruto = JSON.stringify(sB.ev.filter(x => x[0] === 'unidos:estado'));
    check('nenhuma carta de A aparece no que B recebe', [...idsA].every(id => !bruto.includes(`"id":"${id}"`)));
    check('o intruso não recebe nada da partida', !sF.ev.some(x => x[0] === 'unidos:estado'));

    const vez = estados[0].vezId;
    const sVez = { [A.id]: sA, [B.id]: sB, [C.id]: sC }[vez];
    const sOutro = [sA, sB, sC].find(s => s !== sVez);
    const eOutro = sOutro.ultimo('unidos:estado');
    r = await sOutro.pedir('unidos:jogar', { partidaId: pid, cartaId: eOutro.minhaMao[0].id, cor: 'roxo' });
    check('fora da vez é recusado', r.ok === false && /vez/.test(r.erro));
    const eVez = sVez.ultimo('unidos:estado');
    r = await sVez.pedir('unidos:jogar', { partidaId: pid, cartaId: 'carta-inventada' });
    check('carta inventada é recusada', r.ok === false);
    const seqAntes = eVez.seq;
    if (eVez.jogaveis.length) {
      const c = eVez.minhaMao.find(x => x.id === eVez.jogaveis[0]);
      const alvoId = c.tipo === 'call' ? eOutro.jogadores.find(p => p.id !== vez).id : undefined;
      r = await sVez.pedir('unidos:jogar', { partidaId: pid, cartaId: c.id, cor: 'roxo', alvoId });
      await sleep(400);
      check('jogada válida chega para todos', r.ok && sOutro.ultimo('unidos:estado').topo.id === c.id, JSON.stringify(r));
    } else {
      r = await sVez.pedir('unidos:comprar', { partidaId: pid });
      await sleep(400);
      check('sem carta para jogar, compra', r.ok && sOutro.ultimo('unidos:estado').seq > seqAntes, JSON.stringify(r));
    }
    r = await sB.pedir('unidos:gritar', { partidaId: pid });
    check('não grita com 7 cartas', r.ok === false && /1 ou 2/.test(r.erro));

    console.log('● Saída e encerramento');
    r = await sC.pedir('unidos:sair', { partidaId: pid });
    await sleep(400);
    check('C sai e a partida continua com 2', r.ok && sA.ultimo('unidos:estado').jogadores.length === 2 && sA.ultimo('unidos:estado').status === 'jogando');
    r = await sB.pedir('unidos:encerrar', { partidaId: pid });
    check('só quem abriu encerra', r.ok === false);
    r = await sA.pedir('unidos:encerrar', { partidaId: pid });
    await sleep(400);
    check('mesa encerrada some para todos', r.ok && sB.ev.some(x => x[0] === 'unidos:encerrada') && sB.ultimo('unidos:sala') === null);
    r = await sA.pedir('unidos:consultar', { voiceRoomId: sala.id });
    check('depois de encerrar não sobra mesa', r.ok && r.sala === null);

    console.log('● Mesa na chamada direta (DM)');
    const chaveDm = 'dm:' + [A.id, B.id].sort().join(':');
    r = await sC.pedir('unidos:abrir', { voiceRoomId: chaveDm });
    check('quem não é da dupla não abre mesa na DM', r.ok === false, JSON.stringify(r));
    r = await sA.pedir('unidos:abrir', { voiceRoomId: 'dm:' + [B.id, A.id].sort().reverse().join(':') });
    check('chave fora de ordem é recusada', r.ok === false);
    r = await sA.pedir('unidos:abrir', { voiceRoomId: chaveDm });
    check('A abre mesa na DM com B', r.ok && r.partida?.status === 'lobby', JSON.stringify(r));
    await sleep(400);
    check('B fica sabendo da mesa da DM', sB.ultimo('unidos:sala')?.voiceRoomId === chaveDm);
    check('C não fica sabendo', sC.ultimo('unidos:sala')?.voiceRoomId !== chaveDm);
    r = await sC.pedir('unidos:entrar', { partidaId: r.partida.id });
    check('C não entra na mesa da DM', r.ok === false);
    const pidDm = sB.ultimo('unidos:sala')?.id;
    r = await sB.pedir('unidos:entrar', { partidaId: pidDm });
    check('B entra na mesa da DM', r.ok && r.partida?.jogadores.length === 2);
    r = await sA.pedir('unidos:iniciar', { partidaId: pidDm });
    check('partida da DM começa', r.ok);
    await sA.pedir('unidos:encerrar', { partidaId: pidDm });
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.stack || e.message);
  } finally {
    socks.forEach(s => s.close());
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(() => {});
    for (const u of [A, B, C, F]) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
