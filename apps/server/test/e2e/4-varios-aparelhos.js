// Teste de ponta a ponta: a mesma conta em vários aparelhos (PC + celular).
// DMs chegam em todos; fechar um não deixa a pessoa offline.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const WS = require('ws');
const p = new PrismaClient();
const API = `http://${HOST}/api`, ORIGIN = 'https://www.nexuslink.art', SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (n, c) => { c ? (ok++, console.log('  ✔', n)) : (falhas++, console.log('  ✘', n)); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const call = async (m, path, body, tok) => { const r = await fetch(API + path, { method: m, headers: { 'content-type': 'application/json', Origin: ORIGIN, ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d = null; try { d = await r.json(); } catch {} return { status: r.status, data: d }; };
function socket(token) { return new Promise((res, rej) => { const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN } }); const s = { ev: [], ws, got: (e) => s.ev.some(x => x[0] === e), emit: (e, d) => ws.send('42' + JSON.stringify([e, d])) }; ws.on('message', b => { const m = b.toString(); if (m[0] === '0') ws.send('40' + JSON.stringify({ token })); else if (m === '2') ws.send('3'); else if (m.startsWith('40')) setTimeout(() => res(s), 400); else if (m.startsWith('42')) s.ev.push(JSON.parse(m.slice(2))); }); ws.on('error', rej); }); }
(async () => {
  const rnd = Math.random().toString(36).slice(2, 7);
  const mk = async (x) => p.user.create({ data: { email: `teste-${rnd}-${x}@exemplo.invalid`, username: `teste_${rnd}_${x}`, passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: 'T ' + x } } } });
  const A = await mk('a'), B = await mk('b');
  let serverId;
  try {
    const tA = (await call('POST', '/auth/login', { email: A.email, password: SENHA })).data.accessToken;
    const tB = (await call('POST', '/auth/login', { email: B.email, password: SENHA })).data.accessToken;
    serverId = (await call('POST', '/servers', { name: 'Teste aparelhos' }, tA)).data.id;
    await p.serverMember.create({ data: { serverId, userId: B.id } });
    const pc = await socket(tB), cel = await socket(tB), obs = await socket(tA);
    await call('POST', `/dms/${B.id}/send`, { content: 'oi nos dois aparelhos' }, tA);
    await sleep(700);
    check('DM chega no PC', pc.got('dm:new'));
    check('DM chega no celular também', cel.got('dm:new'));
    obs.emit('server:join', { serverId }); pc.emit('server:join', { serverId }); cel.emit('server:join', { serverId });
    await sleep(500);
    cel.ws.close();
    await sleep(800);
    check('fechar o celular NÃO deixa offline (PC aberto)', !obs.got('user:offline'));
    let r = await call('GET', `/servers/${serverId}/members`, null, tA);
    check('continua online na lista', r.data.find(m => m.userId === B.id)?.status === 'ONLINE');
    pc.ws.close();
    await sleep(800);
    check('fechar o último aparelho deixa offline', obs.got('user:offline'));
    r = await call('GET', `/servers/${serverId}/members`, null, tA);
    check('aparece offline na lista', r.data.find(m => m.userId === B.id)?.status === 'OFFLINE');
    obs.ws.close();
  } catch (e) { falhas++; console.log('ERRO', e.message); }
  finally {
    if (serverId) await p.server.delete({ where: { id: serverId } }).catch(() => {});
    await p.directMessage.deleteMany({ where: { OR: [{ senderId: A.id }, { senderId: B.id }] } });
    for (const u of [A, B]) await p.user.delete({ where: { id: u.id } }).catch(() => {});
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await p.$disconnect(); process.exit(falhas ? 1 : 0);
  }
})();
