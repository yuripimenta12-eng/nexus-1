// Teste de ponta a ponta das zoeiras e do som de entrada: comprar, só usar
// dentro da call, preferências, opção do dono. Apaga tudo no final.
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
  await sleep(30000);
  const U = await criarUsuario('zoeira');
  const V = await criarUsuario('alvo');
  let serverId = null;
  try {
    const t = await entrar(U), tv = await entrar(V);
    let r = await call('POST', '/servers', { name: `Zoeira ${rnd}` }, t);
    serverId = r.data?.id;
    const sala = r.data?.voiceRooms?.[0]?.id;

    console.log('● Comprar zoeiras');
    r = await call('POST', '/zoeiras/comprar/tomate', { qtd: 3 }, t);
    check('sem Nex não compra', r.status === 400, `status ${r.status}`);
    await prisma.carteira.upsert({ where: { userId: U.id }, create: { userId: U.id, saldo: 200 }, update: { saldo: 200 } });
    r = await call('POST', '/zoeiras/comprar/tomate', { qtd: 3 }, t);
    check('compra 3 tomates (60 Nex)', (r.status === 200 || r.status === 201) && r.data?.qtd === 3 && r.data?.saldo === 140, JSON.stringify(r.data));
    r = await call('POST', '/zoeiras/comprar/tomate', { qtd: 50 }, t);
    check('quantidade acima de 10 é recusada', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/zoeiras/comprar/inventada', { qtd: 1 }, t);
    check('zoeira que não existe: 404', r.status === 404, `status ${r.status}`);
    r = await call('GET', '/zoeiras', null, t);
    check('estoque mostra os 3 tomates', r.data?.zoeiras?.find(z => z.id === 'tomate')?.qtd === 3);

    console.log('● Usar só dentro da call');
    r = await call('POST', '/zoeiras/usar/tomate', { voiceRoomId: sala, alvoId: V.id }, t);
    check('fora da call não usa', r.status === 403, `status ${r.status}`);
    r = await call('GET', '/zoeiras', null, t);
    check('e o tomate não foi gasto', r.data?.zoeiras?.find(z => z.id === 'tomate')?.qtd === 3);
    r = await call('POST', '/zoeiras/usar/tomate', { voiceRoomId: sala, alvoId: V.id }, tv);
    check('quem não é do servidor não usa', r.status === 403, `status ${r.status}`);

    console.log('● Preferências');
    r = await call('PUT', '/zoeiras/preferencia', { receber: false }, tv);
    check('desliga receber zoeiras', r.status === 200 && r.data?.receberZoeiras === false);
    r = await call('PUT', '/zoeiras/preferencia', { receber: 'sim' }, tv);
    check('valor inválido é recusado', r.status === 400, `status ${r.status}`);
    r = await call('PATCH', `/servers/${serverId}`, { zoeirasPesadas: true }, t);
    check('dono libera zoeiras pesadas', r.status === 200 && r.data?.zoeirasPesadas === true, JSON.stringify(r.data?.zoeirasPesadas));
    await prisma.serverMember.create({ data: { serverId, userId: V.id } });
    r = await call('PATCH', `/servers/${serverId}`, { zoeirasPesadas: false }, tv);
    check('membro comum não mexe nisso', r.status === 403, `status ${r.status}`);

    console.log('● Som de entrada na loja');
    await prisma.carteira.update({ where: { userId: U.id }, data: { saldo: 2000 } });
    r = await call('POST', '/loja/comprar/s-moeda', null, t);
    check('compra o som de entrada (2.000)', (r.status === 200 || r.status === 201) && r.data?.saldo === 0, JSON.stringify(r.data));
    r = await call('PUT', '/loja/equipar', { tipo: 'som', itemId: 's-moeda' }, t);
    const p = await prisma.profile.findUnique({ where: { userId: U.id } });
    check('equipa: o som fica no perfil', r.status === 200 && p.somEntrada === 's-moeda');
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [U, V]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
