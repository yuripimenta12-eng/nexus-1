// Teste de ponta a ponta das correções da auditoria de segurança: lista de
// membros só para membros, hierarquia de cargos, banimento que vale na hora,
// edição bloqueada para banidos/bloqueados, teto do histórico, e-mail não
// confirmado, origem do login, logout sem cookie, links de senha e push.
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
  // O login tem limite por minuto e este teste entra com 7 contas: espera a janela do teste anterior
  await sleep(61000);
  const O_ = await criarUsuario('dono');   // dono do servidor
  const A = await criarUsuario('admin');   // ADMIN fixo
  const M = await criarUsuario('mod');     // tem só "Gerenciar cargos" + banir
  const B = await criarUsuario('membro');  // membro comum
  const X = await criarUsuario('fora');    // não é membro
  const U = await criarUsuario('naoconf'); // e-mail não confirmado
  await prisma.user.update({ where: { id: U.id }, data: { isVerified: false } });
  let serverId = null;
  try {
    const tO = await entrar(O_), tA = await entrar(A), tM = await entrar(M), tB = await entrar(B), tX = await entrar(X), tU = await entrar(U);
    let r = await call('POST', '/servers', { name: `Seg ${rnd}` }, tO);
    serverId = r.data?.id;
    for (const u of [A, M, B]) await prisma.serverMember.create({ data: { serverId, userId: u.id } });
    await prisma.serverMember.update({ where: { serverId_userId: { serverId, userId: A.id } }, data: { role: 'ADMIN' } });
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];

    console.log('● Lista de membros e servidor só para membros');
    r = await call('GET', `/servers/${serverId}/members`, null, tX);
    check('quem não é membro não lista membros', r.status === 403, `status ${r.status}`);
    r = await call('GET', `/servers/${serverId}/members`, null, tB);
    check('membro lista normalmente', r.status === 200 && Array.isArray(r.data));

    console.log('● Hierarquia de cargos');
    r = await call('POST', `/servers/${serverId}/roles`, { name: 'moderacao' }, tO);
    const cargoM = r.data;
    await call('PATCH', `/servers/${serverId}/roles/${cargoM.id}`, { permissions: ['manage_roles', 'ban_members'] }, tO);
    await call('PUT', `/servers/${serverId}/roles/${cargoM.id}/members/${M.id}`, null, tO);
    r = await call('POST', `/servers/${serverId}/roles`, { name: 'baixo' }, tM);
    const baixo = r.data;
    check('quem gerencia cargos cria cargo abaixo do seu', r.status === 201 && baixo.position < cargoM.position, JSON.stringify(r.data));
    r = await call('PATCH', `/servers/${serverId}/roles/${baixo.id}`, { permissions: ['administrator'] }, tM);
    check('não consegue dar "administrador"', r.status === 403, `status ${r.status}`);
    r = await call('PATCH', `/servers/${serverId}/roles/${baixo.id}`, { permissions: ['kick_members'] }, tM);
    check('não concede permissão que não tem', r.status === 403, `status ${r.status}`);
    r = await call('PATCH', `/servers/${serverId}/roles/${cargoM.id}`, { permissions: ['manage_roles', 'ban_members', 'administrator'] }, tM);
    check('não mexe no próprio cargo (mesma altura)', r.status === 403, `status ${r.status}`);
    r = await call('PATCH', `/servers/${serverId}/roles/${baixo.id}`, { color: 'url(//x.tk/a)' }, tO);
    check('cor de cargo só aceita #RRGGBB', r.status === 400, `status ${r.status}`);
    r = await call('PATCH', `/servers/${serverId}/roles/${baixo.id}`, { color: '#ff6a00' }, tO);
    check('cor hex funciona', r.status === 200 && r.data?.color === '#ff6a00');

    console.log('● Moderação protege dono e admins');
    r = await call('DELETE', `/moderation/servers/${serverId}/ban/${O_.id}`, null, tA);
    check('desbanir não remove o dono', r.status === 404 || r.status === 403, `status ${r.status}`);
    check('dono continua no servidor', !!(await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: O_.id } } })));
    r = await call('POST', `/moderation/servers/${serverId}/ban/${A.id}`, { reason: 'x' }, tM);
    check('quem não é dono não bane admin', r.status === 403, `status ${r.status}`);
    r = await call('POST', `/moderation/servers/${serverId}/ban/${O_.id}`, { reason: 'x' }, tA);
    check('ninguém bane o dono', r.status === 403, `status ${r.status}`);

    console.log('● Banimento vale de verdade');
    await call('POST', `/channels/${ch.id}/messages`, { content: 'antes do ban ' + rnd }, tB);
    const msgB = await prisma.message.findFirst({ where: { authorId: B.id, channelId: ch.id } });
    const sB = await socket(tB);
    sB.emit('channel:join', { channelId: ch.id }); sB.emit('server:join', { serverId });
    await sleep(500);
    r = await call('POST', `/moderation/servers/${serverId}/ban/${B.id}`, { reason: 'teste' }, tO);
    check('dono bane membro', r.status === 200 || r.status === 201, `status ${r.status}`);
    await sleep(500); sB.clear();
    await call('POST', `/channels/${ch.id}/messages`, { content: 'depois do ban ' + rnd }, tO);
    const sO = await socket(tO); sO.emit('channel:join', { channelId: ch.id }); await sleep(400);
    sO.emit('message:send', { channelId: ch.id, content: 'socket depois do ban ' + rnd }); await sleep(800);
    check('banido sai das salas na hora (não recebe mensagem nova)', !sB.got('message:new') && !sB.got('channel:activity'));
    sO.close(); sB.close();
    r = await call('PATCH', `/channels/${ch.id}/messages/${msgB.id}`, { content: 'editado depois do ban' }, tB);
    check('banido não edita mensagem antiga', r.status === 403, `status ${r.status}`);
    r = await call('GET', `/servers/${serverId}`, null, tB);
    check('banido não carrega o servidor', r.status === 403, `status ${r.status}`);
    r = await call('DELETE', `/servers/${serverId}/leave`, null, tB);
    check('banido não "sai" para apagar o banimento', r.status === 403, `status ${r.status}`);
    r = await call('POST', `/moderation/servers/${serverId}/kick/${B.id}`, {}, tA);
    check('expulsar não desfaz banimento', r.status === 403, `status ${r.status}`);
    const rowB = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: B.id } } });
    check('banimento continua gravado', !!rowB?.banned);

    console.log('● Histórico com teto');
    r = await call('GET', `/channels/${ch.id}/messages?limit=1000000`, null, tO);
    check('limit gigante é cortado em 100', r.status === 200 && (r.data?.messages || r.data || []).length <= 100);

    console.log('● DM: bloqueio vale na edição');
    r = await call('POST', `/dms/${X.id}/send`, { content: 'oi ' + rnd }, tA);
    const dmId = r.data?.id;
    await call('POST', `/moderation/block/${A.id}`, {}, tX);
    if (!(await prisma.block.findFirst({ where: { blockerId: X.id, blockedId: A.id } }))) await prisma.block.create({ data: { blockerId: X.id, blockedId: A.id } });
    r = await call('PUT', `/dms/messages/${dmId}`, { content: 'editado depois do bloqueio' }, tA);
    check('bloqueado não edita DM antiga', r.status === 403, `status ${r.status}`);

    console.log('● Conta e sessão');
    r = await call('POST', `/servers`, { name: 'nao confirmado' }, tU);
    check('e-mail não confirmado não usa a API', r.status === 403, `status ${r.status}`);
    r = await call('GET', '/auth/me', null, tU);
    check('mas consegue ver os próprios dados para confirmar', r.status === 200);
    r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://site-malicioso.example' }, body: JSON.stringify({ email: B.email, password: SENHA }) });
    check('login vindo de outro site é recusado', r.status === 403, `status ${r.status}`);
    const lg = await call('POST', '/auth/login', { email: X.email, password: SENHA });
    const rt = lg.data?.refreshToken;
    r = await call('POST', '/auth/logout', { refreshToken: rt });
    check('logout sem cookie revoga a sessão enviada', r.status === 204 && !(await prisma.session.findUnique({ where: { refreshToken: rt } })), `status ${r.status}`);
    await call('POST', '/auth/forgot-password', { email: X.email });
    await call('POST', '/auth/forgot-password', { email: X.email });
    const pend = await prisma.passwordReset.count({ where: { userId: X.id, usedAt: null } });
    check('só o link de redefinição mais recente vale', pend === 1, `pendentes ${pend}`);
    r = await call('POST', '/push/subscribe', { endpoint: 'https://203.0.113.9/x', keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' } }, tX);
    check('push só para serviços conhecidos', r.status === 400, `status ${r.status}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [O_, A, M, B, X, U]) {
      await prisma.directMessage.deleteMany({ where: { OR: [{ senderId: u.id }, { receiverId: u.id }] } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
