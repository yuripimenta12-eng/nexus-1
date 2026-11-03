// Teste de ponta a ponta: dados privados de OUTRA pessoa (e-mail, hash da
// senha, 2FA, admin) nunca saem em membros, mensagens, servidor, cargos, busca
// nem no tempo real. Roda DENTRO do container de teste (porta 3005); cria
// contas e um servidor temporários e apaga tudo no final.
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

const PRIVADOS = ['email', 'passwordHash', 'twoFactorSecret', 'twoFactorRecovery', 'twoFactorEnabled', 'isAdmin', 'isSuspended', 'isVerified', 'desktopVersion', 'desktopSeenAt'];
// Procura qualquer campo privado em qualquer nível do JSON
function vazou(obj, achados = new Set()) {
  if (Array.isArray(obj)) obj.forEach(x => vazou(x, achados));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) { if (PRIVADOS.includes(k)) achados.add(k); vazou(v, achados); }
  }
  return [...achados];
}

(async () => {
  const A = await criarUsuario('dono');
  const B = await criarUsuario('membro');
  let serverId = null;
  const socks = [];
  try {
    const tA = await entrar(A), tB = await entrar(B);
    let r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];

    const sA = await socket(tA), sB = await socket(tB);
    socks.push(sA, sB);
    sB.emit('channel:join', { channelId: ch.id });
    await sleep(600);
    // Ao vivo: o envio pelo socket é o que transmite para o canal
    sA.emit('message:send', { channelId: ch.id, content: 'ao vivo ' + rnd });
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'oi ' + rnd }, tA);
    const msgId = r.data?.id;
    await call('POST', `/channels/${ch.id}/messages`, { content: 'resposta', replyToId: msgId }, tA);
    await call('POST', `/channels/${ch.id}/messages/${msgId}/reactions/${encodeURIComponent('👍')}`, null, tA);
    r = await call('POST', `/servers/${serverId}/roles`, { name: 'Cargo' }, tA);
    const cargo = r.data;
    await call('PUT', `/servers/${serverId}/roles/${cargo.id}/members/${A.id}`, null, tA);
    await sleep(800);

    console.log('● Dados privados de outra pessoa');
    const olhar = async (nome, path) => {
      const x = await call('GET', path, null, tB);
      const v = vazou(x.data);
      check(`${nome} não expõe dados privados`, x.status === 200 && v.length === 0, `status ${x.status} campos: ${v.join(',')}`);
      return x;
    };
    const mem = await olhar('lista de membros', `/servers/${serverId}/members`);
    check('lista de membros ainda traz nome e foto', mem.data?.some(m => m.user?.username === A.username && m.user?.profile?.displayName));
    const msgs = await olhar('mensagens do canal', `/channels/${ch.id}/messages`);
    check('mensagens ainda trazem o autor', msgs.data?.messages?.some(m => m.author?.username === A.username && m.author?.profile));
    await olhar('detalhes do servidor', `/servers/${serverId}`);
    await olhar('lista de servidores', `/users/@me/servers`);
    await olhar('membros do cargo', `/servers/${serverId}/roles/${cargo.id}/members`);
    await olhar('mensagens fixadas', `/channels/${ch.id}/messages/pinned`);
    await olhar('perfil público', `/users/${A.id}/profile`);
    await olhar('busca de mensagens', `/servers/${serverId}/search?q=oi`);
    const busca = await olhar('busca de usuários', `/users/search?q=${encodeURIComponent(A.username)}`);
    check('busca ainda encontra a pessoa', busca.data?.some?.(u => u.id === A.id));
    const novo = sB.events.find(e => e[0] === 'message:new' && e[1].content === 'ao vivo ' + rnd);
    check('mensagem ao vivo não expõe dados privados', !!novo && vazou(novo[1]).length === 0, novo ? vazou(novo[1]).join(',') : 'não chegou');
    r = await call('GET', '/auth/me', null, tB);
    check('a própria conta continua com o e-mail', r.status === 200 && r.data?.email === B.email);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    socks.forEach(s => s.close());
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [A, B]) {
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
