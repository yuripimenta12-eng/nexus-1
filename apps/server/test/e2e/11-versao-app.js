// Teste de ponta a ponta da versão do app de PC: entrar pelo app anota a
// versão (o dono vê no painel quem já atualizou), entrar pelo navegador não
// apaga, user agent esquisito é ignorado e a versão não vaza para os outros.
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
function socket(token, ua) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN, ...(ua ? { 'User-Agent': ua } : {}) } });
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
  const A = await criarUsuario('pc');
  const B = await criarUsuario('outro');
  let serverId = null;
  const versao = async () => (await prisma.user.findUnique({ where: { id: A.id }, select: { desktopVersion: true, desktopSeenAt: true } }));
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Electron/44.0.0 Safari/537.36';
  try {
    const tA = await entrar(A), tB = await entrar(B);

    console.log('● Entrar pelo app de PC anota a versão');
    let s = await socket(tA, UA + ' NexusDesktop/1.6.0'); await sleep(500); s.close();
    let v = await versao();
    check('versão do app anotada', v.desktopVersion === '1.6.0' && !!v.desktopSeenAt, JSON.stringify(v));
    s = await socket(tA, UA + ' NexusDesktop/1.7.2'); await sleep(500); s.close();
    v = await versao();
    check('versão nova substitui a antiga', v.desktopVersion === '1.7.2', JSON.stringify(v));

    console.log('● Navegador e user agent esquisito não mexem');
    s = await socket(tA, 'Mozilla/5.0 (Windows NT 10.0) Chrome/140 Safari/537.36'); await sleep(500); s.close();
    v = await versao();
    check('entrar pelo navegador não apaga a versão', v.desktopVersion === '1.7.2', JSON.stringify(v));
    s = await socket(tA, UA + ' NexusDesktop/<script>alert(1)</script>'); await sleep(500); s.close();
    s = await socket(tA, UA + ' NexusDesktop/1.6.0' + 'x'.repeat(300)); await sleep(500); s.close();
    v = await versao();
    check('texto estranho no lugar da versão é ignorado', v.desktopVersion === '1.7.2', JSON.stringify(v));
    s = await socket(tB); await sleep(500); s.close();
    const vB = await prisma.user.findUnique({ where: { id: B.id }, select: { desktopVersion: true } });
    check('quem nunca usou o app fica sem versão', vB.desktopVersion === null);

    console.log('● Só o dono do Nexus vê');
    let r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    r = await call('GET', `/users/${A.id}/profile`, null, tB);
    check('perfil público não mostra a versão', r.status === 200 && !('desktopVersion' in r.data) && !('desktopSeenAt' in r.data));
    r = await call('GET', `/servers/${serverId}/members`, null, tB);
    const membro = r.data?.find(m => m.userId === A.id)?.user || {};
    check('lista de membros não mostra a versão', r.status === 200 && !('desktopVersion' in membro));
    r = await call('GET', '/admin/users', null, tB);
    check('usuário comum não vê o painel', r.status === 403);
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
