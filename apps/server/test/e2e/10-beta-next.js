// Teste de ponta a ponta do emblema BETA NEXT: aparece para os outros, só o
// dono da plataforma dá/tira e ninguém dá para si mesmo. NÃO mexe na chave
// "contas novas ganham" (isso afetaria cadastros de verdade).
// Roda DENTRO do container de teste (porta 3005); apaga tudo no final.
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const WS = require('ws');
const prisma = new PrismaClient();
const API = `http://${HOST}/api`;
const ORIGIN = 'https://www.nexuslink.art';
const O = { 'content-type': 'application/json', Origin: ORIGIN };
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const call = async (method, path, body, token, raw) => {
  const headers = { Origin: ORIGIN, ...(raw ? {} : { 'content-type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await fetch(API + path, { method, headers, body: raw ? body : (body ? JSON.stringify(body) : undefined) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);
async function criarUsuario(sufixo) {
  return prisma.user.create({
    data: {
      email: `teste-${rnd}-${sufixo}@exemplo.invalid`, username: `teste_${rnd}_${sufixo}`,
      passwordHash: await argon2.hash(SENHA), isVerified: true,
      profile: { create: { displayName: `Teste ${sufixo}` } },
    },
  });
}
async function entrar(u) {
  const r = await call('POST', '/auth/login', { email: u.email, password: SENHA });
  return r.data?.accessToken;
}

// Cliente Socket.IO mínimo (protocolo v4 sobre WebSocket)
function socket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN } });
    const s = {
      events: [], acks: new Map(), n: 1,
      emit(ev, data) { ws.send('42' + JSON.stringify([ev, data])); },
      got(ev, pred = () => true) { return s.events.some(e => e[0] === ev && pred(e[1])); },
      clear() { s.events = []; },
      close() { try { ws.close(); } catch {} },
    };
    const t = setTimeout(() => reject(new Error('socket não conectou')), 6000);
    ws.on('message', (buf) => {
      const m = buf.toString();
      if (m[0] === '0') ws.send('40' + JSON.stringify({ token }));
      else if (m === '2') ws.send('3');
      else if (m.startsWith('40')) { clearTimeout(t); setTimeout(() => resolve(s), 400); }
      else if (m.startsWith('44')) { clearTimeout(t); reject(new Error('conexão recusada')); }
      else if (m.startsWith('42')) { try { s.events.push(JSON.parse(m.slice(2))); } catch {} }
    });
    ws.on('error', (e) => { clearTimeout(t); reject(e); });
  });
}

(async () => {
  const A = await criarUsuario('beta');
  const B = await criarUsuario('comum');
  let serverId = null;
  try {
    const tA = await entrar(A), tB = await entrar(B);
    await prisma.user.update({ where: { id: A.id }, data: { isBetaTester: true } });
    let r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];
    await call('POST', `/channels/${ch.id}/messages`, { content: 'oi ' + rnd }, tA);

    console.log('● Emblema aparece para os outros');
    r = await call('GET', `/users/${A.id}/profile`, null, tB);
    check('perfil mostra o emblema', r.status === 200 && r.data.isBetaTester === true);
    r = await call('GET', `/users/${B.id}/profile`, null, tA);
    check('quem não tem aparece sem', r.status === 200 && r.data.isBetaTester === false);
    r = await call('GET', `/servers/${serverId}/members`, null, tB);
    check('lista de membros mostra o emblema', r.data?.find(m => m.userId === A.id)?.user?.isBetaTester === true);
    r = await call('GET', `/channels/${ch.id}/messages`, null, tB);
    check('mensagem mostra o emblema do autor', r.data?.messages?.[0]?.author?.isBetaTester === true);
    r = await call('GET', '/auth/me', null, tA);
    check('a pessoa vê o próprio emblema', r.status === 200 && r.data.isBetaTester === true);

    console.log('● Só o dono do Nexus dá o emblema');
    r = await call('GET', '/admin/beta', null, tB);
    check('usuário comum não vê o painel do BETA', r.status === 403);
    r = await call('PATCH', '/admin/beta', { cadastrosGanham: false }, tB);
    check('usuário comum não fecha o BETA', r.status === 403);
    r = await call('POST', `/admin/users/${B.id}/beta`, { on: true }, tB);
    check('usuário comum não se dá o emblema', r.status === 403);
    r = await call('PATCH', '/users/@me/profile', { isBetaTester: true }, tB);
    const bDb = await prisma.user.findUnique({ where: { id: B.id }, select: { isBetaTester: true } });
    check('editar o perfil não dá o emblema', bDb.isBetaTester === false, `status ${r.status}`);
    r = await call('GET', '/admin/beta');
    check('painel do BETA exige login', r.status === 401);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [A, B]) {
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
