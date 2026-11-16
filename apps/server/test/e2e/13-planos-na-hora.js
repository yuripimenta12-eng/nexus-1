// Teste de ponta a ponta: plano dado no painel do dono chega na hora no app
// da pessoa (aviso pelo socket) e aparece em /auth/me. Apaga tudo no final.
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
  // Espera a janela do limite de login do teste anterior
  await sleep(30000);
  const A = await criarUsuario('admin');   // dono do Nexus (temporário)
  const P = await criarUsuario('plano');   // quem ganha o plano
  await prisma.user.update({ where: { id: A.id }, data: { isAdmin: true } });
  try {
    const tA = await entrar(A), tP = await entrar(P);

    console.log('● Plano dado no painel chega na hora');
    const sP = await socket(tP);
    let r = await call('POST', `/admin/users/${P.id}/plano`, { plano: 'pro', dias: 1 }, tP);
    check('quem não é dono não dá plano', r.status === 403, `status ${r.status}`);
    r = await call('POST', `/admin/users/${P.id}/plano`, { plano: 'pro', dias: 1 }, tA);
    check('dono dá o plano Pro', (r.status === 200 || r.status === 201) && r.data?.plano === 'pro', JSON.stringify(r.data));
    await sleep(800);
    check('o app da pessoa recebe o aviso "plano:atualizado"', sP.got('plano:atualizado'));
    r = await call('GET', '/auth/me', null, tP);
    check('/auth/me já mostra o Pro', r.data?.plano === 'pro' && !!r.data?.planoAte, JSON.stringify({ plano: r.data?.plano }));
    sP.clear();
    r = await call('POST', `/admin/users/${P.id}/plano`, { plano: 'gratis' }, tA);
    await sleep(800);
    check('tirar o plano também avisa', sP.got('plano:atualizado'));
    r = await call('GET', '/auth/me', null, tP);
    check('/auth/me volta para grátis', r.data?.plano === 'gratis');
    sP.close();
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: A.id } }).catch(e => console.log('limpeza registro:', e.message));
    for (const u of [A, P]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
