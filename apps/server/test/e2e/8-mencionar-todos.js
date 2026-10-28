// Teste de ponta a ponta das menções @everyone/@todos e @here/@aqui.
// Roda DENTRO do container de teste (porta 3005). Cria contas e um servidor
// temporários e apaga tudo no final. As contas de teste não têm celular
// cadastrado, então nenhum aviso sai para gente de verdade.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
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
  const A = await criarUsuario('dono');
  const B = await criarUsuario('membro');
  const C = await criarUsuario('intruso');
  let serverId = null;
  const socks = [];
  try {
    const tA = await entrar(A), tB = await entrar(B), tC = await entrar(C);

    // Servidor de teste: A é dono, B é membro comum, C não participa
    let r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];
    const enviar = async (tok, content) => (await call('POST', `/channels/${ch.id}/messages`, { content }, tok)).data;

    console.log('● @everyone / @here: quem pode');
    let m = await enviar(tB, '@everyone oi ' + rnd);
    check('membro comum: @everyone vira só texto', m?.id && m.mentionAll === null, JSON.stringify(m?.mentionAll));
    r = await call('GET', `/servers/${serverId}/roles/@me`, null, tB);
    check('membro comum não tem "Mencionar todos"', r.status === 200 && !r.data.permissions.includes('mention_everyone'));
    m = await enviar(tA, 'atenção @everyone');
    check('dono: @everyone avisa todos', m?.mentionAll === 'everyone', JSON.stringify(m?.mentionAll));
    m = await enviar(tA, 'quem está @aqui.');
    check('dono: @aqui avisa quem está online', m?.mentionAll === 'here', JSON.stringify(m?.mentionAll));
    m = await enviar(tA, 'veja https://exemplo.invalid/@everyone e a@todos.com');
    check('@ dentro de link ou e-mail não conta', m?.mentionAll === null, JSON.stringify(m?.mentionAll));
    m = await enviar(tA, '@everyoneee @todosabem');
    check('palavra maior não conta', m?.mentionAll === null, JSON.stringify(m?.mentionAll));

    r = await call('POST', `/servers/${serverId}/roles`, { name: 'Avisos' }, tA);
    const avisos = r.data;
    r = await call('PATCH', `/servers/${serverId}/roles/${avisos.id}`, { permissions: ['mention_everyone'] }, tA);
    check('cargo aceita "Mencionar todos"', r.status === 200 && JSON.parse((await prisma.role.findUnique({ where: { id: avisos.id } })).permissions).includes('mention_everyone'));
    await call('PUT', `/servers/${serverId}/roles/${avisos.id}/members/${B.id}`, null, tA);
    m = await enviar(tB, 'galera @Todos');
    check('membro com o cargo: @todos avisa todos', m?.mentionAll === 'everyone', JSON.stringify(m?.mentionAll));
    r = await call('GET', `/channels/${ch.id}/messages`, null, tB);
    check('histórico traz a marcação', r.status === 200 && r.data.messages.some(x => x.content === 'galera @Todos' && x.mentionAll === 'everyone'));

    console.log('● @everyone em tempo real');
    const sA = await socket(tA), sB = await socket(tB), sC = await socket(tC);
    socks.push(sA, sB, sC);
    sA.emit('server:join', { serverId });
    sB.emit('server:join', { serverId });
    sC.emit('server:join', { serverId });
    await sleep(700);
    sA.emit('message:send', { channelId: ch.id, content: '@here reunião ' + rnd });
    await sleep(1200);
    check('membro recebe a atividade com @here', sB.got('channel:activity', d => d.channelId === ch.id && d.mentionAll === 'here'));
    check('intruso não recebe nada', !sC.got('channel:activity'));
    sB.clear();
    sB.emit('message:send', { channelId: ch.id, content: 'sem marcação ' + rnd });
    await sleep(1000);
    const atv = sA.events.find(e => e[0] === 'channel:activity' && e[1].content === 'sem marcação ' + rnd);
    check('mensagem comum chega sem marcação', !!atv && atv[1].mentionAll === null, JSON.stringify(atv && atv[1]));
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    socks.forEach(s => s.close());
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [A, B, C]) {
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
