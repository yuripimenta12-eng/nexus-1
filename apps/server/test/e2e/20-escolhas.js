// Teste de ponta a ponta do par ou ímpar e da votação da call (tempo real).
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
  const A = await criar('a'), B = await criar('b'), C = await criar('c');
  let serverId = null; const socks = [];
  try {
    const [tA, tB, tC] = [await entrar(A), await entrar(B), await entrar(C)];
    serverId = (await call('POST', '/servers', { name: `Teste Escolhas ${rnd}` }, tA)).data?.id;
    for (const u of [B, C]) await prisma.serverMember.create({ data: { serverId, userId: u.id } });
    const sala = await prisma.voiceRoom.findFirst({ where: { serverId } })
      || await prisma.voiceRoom.create({ data: { serverId, name: 'Sala teste', livekitRoom: `teste-${rnd}` } });
    const [sA, sB, sC] = [await socket(tA), await socket(tB), await socket(tC)];
    socks.push(sA, sB, sC);
    for (const s of [sA, sB]) s.emit('voice:join', { voiceRoomId: sala.id, serverId });
    await sleep(600);

    console.log('● Par ou ímpar');
    let r = await sA.pedir('parimpar:desafiar', { voiceRoomId: sala.id, alvoId: C.id, lado: 'par', numero: 2 });
    check('não desafia quem está fora da chamada', r.ok === false && /não está na chamada/.test(r.erro), JSON.stringify(r));
    r = await sA.pedir('parimpar:desafiar', { voiceRoomId: sala.id, alvoId: B.id, lado: 'par', numero: 9 });
    check('número fora de 0 a 5 é recusado', r.ok === false && /0 a 5/.test(r.erro), JSON.stringify(r));
    r = await sA.pedir('parimpar:desafiar', { voiceRoomId: sala.id, alvoId: B.id, lado: 'par', numero: 2 });
    check('A desafia B', r.ok && r.desafio?.para === B.id, JSON.stringify(r));
    const id = r.desafio?.id;
    await sleep(400);
    const visto = sB.ultimo('parimpar:desafio');
    check('B recebe o desafio', visto?.id === id);
    check('o número de A não vaza', visto && !('num' in visto) && !('numero' in visto), JSON.stringify(visto));
    r = await sA.pedir('parimpar:responder', { id, numero: 1 });
    check('A não responde o próprio desafio', r.ok === false);
    r = await sB.pedir('parimpar:responder', { id, numero: 3 });
    check('B responde', r.ok, JSON.stringify(r));
    await sleep(400);
    const res = sA.ultimo('parimpar:resultado');
    check('2 + 3 = 5, ímpar: B ganha', res?.soma === 5 && res.saiu === 'impar' && res.vencedor === B.id, JSON.stringify(res));
    r = await sB.pedir('parimpar:responder', { id, numero: 3 });
    check('não responde duas vezes', r.ok === false);

    console.log('● Votação');
    r = await sC.pedir('votacao:criar', { voiceRoomId: sala.id, pergunta: 'Qual jogo?', opcoes: ['Valorant', 'CS2'], duracaoS: 60 });
    check('quem está fora da chamada não cria votação', r.ok === false);
    r = await sB.pedir('votacao:criar', { voiceRoomId: sala.id, pergunta: 'Qual jogo?', opcoes: ['Valorant', 'CS2', 'LoL'], duracaoS: 60 });
    check('B cria a votação', r.ok, JSON.stringify(r));
    await sleep(400);
    const v = sA.ultimo('votacao:estado');
    check('a chamada vê a votação', v?.pergunta === 'Qual jogo?' && v.opcoes.length === 3 && !v.encerrada, JSON.stringify(v));
    r = await sA.pedir('votacao:criar', { voiceRoomId: sala.id, pergunta: 'Outra?', opcoes: ['a', 'b'], duracaoS: 60 });
    check('só uma votação por vez', r.ok === false && /rolando/.test(r.erro), JSON.stringify(r));
    await sA.pedir('votacao:votar', { voiceRoomId: sala.id, id: v.id, opcao: 1 });
    await sB.pedir('votacao:votar', { voiceRoomId: sala.id, id: v.id, opcao: 0 });
    await sB.pedir('votacao:votar', { voiceRoomId: sala.id, id: v.id, opcao: 1 }); // trocou de ideia
    r = await sA.pedir('votacao:votar', { voiceRoomId: sala.id, id: v.id, opcao: 7 });
    check('opção que não existe é recusada', r.ok === false);
    r = await sA.pedir('votacao:encerrar', { voiceRoomId: sala.id });
    check('só quem criou encerra', r.ok === false);
    r = await sB.pedir('votacao:encerrar', { voiceRoomId: sala.id });
    check('B encerra', r.ok);
    await sleep(400);
    const fim = sA.ultimo('votacao:estado');
    check('CS2 vence com 2 votos (troca de voto conta uma vez)', fim?.encerrada && fim.total === 2 && fim.vencedoras.join() === '1', JSON.stringify(fim));
    r = await sA.pedir('escolhas:consultar', { voiceRoomId: sala.id });
    check('quem chega vê o resultado e o próprio voto', r.ok && r.votacao?.id === v.id && r.meuVoto === 1, JSON.stringify(r));
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.stack || e.message);
  } finally {
    socks.forEach(s => s.close());
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(() => {});
    for (const u of [A, B, C]) await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
