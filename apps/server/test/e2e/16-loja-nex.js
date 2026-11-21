// Teste de ponta a ponta da loja Nex: comprar (saldo, repetido, só Pro,
// compras simultâneas) e equipar (dono, tipo, perfil público). Apaga tudo no final.
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
  const U = await criarUsuario('loja');
  const V = await criarUsuario('vizinho');
  try {
    const t = await entrar(U), tv = await entrar(V);

    console.log('● Vitrine');
    let r = await call('GET', '/loja', null, t);
    check('lista o catálogo com preços', r.status === 200 && r.data?.itens?.length > 20 && r.data.itens.some(i => i.tipo === 'moldura' && i.preco === 1000));
    check('sem Nex e sem itens', r.data?.saldo === 0 && !r.data.itens.some(i => i.possui));

    console.log('● Comprar');
    r = await call('POST', '/loja/comprar/m-neon-roxo', null, t);
    check('sem Nex não compra', r.status === 400, `status ${r.status}`);
    await prisma.carteira.upsert({ where: { userId: U.id }, create: { userId: U.id, saldo: 1500 }, update: { saldo: 1500 } });
    r = await call('POST', '/loja/comprar/m-neon-roxo', null, t);
    check('compra a moldura comum (1.000)', (r.status === 200 || r.status === 201) && r.data?.saldo === 500, JSON.stringify(r.data));
    r = await call('POST', '/loja/comprar/m-neon-roxo', null, t);
    check('não compra o mesmo item duas vezes', r.status === 409, `status ${r.status}`);
    r = await call('POST', '/loja/comprar/i-controle', null, t);
    check('compra um ícone (500) e o saldo zera', r.data?.saldo === 0, JSON.stringify(r.data));
    r = await call('POST', '/loja/comprar/nao-existe', null, t);
    check('item que não existe: 404', r.status === 404, `status ${r.status}`);
    await prisma.carteira.update({ where: { userId: U.id }, data: { saldo: 100000 } });
    r = await call('POST', '/loja/comprar/m-coroa', null, t);
    check('item só do Pro: recusado sem Pro', r.status === 403, `status ${r.status}`);
    // Saldo para só um de dois itens, pedidos ao mesmo tempo
    await prisma.carteira.update({ where: { userId: U.id }, data: { saldo: 1000 } });
    const duas = await Promise.all([call('POST', '/loja/comprar/m-limao', null, t), call('POST', '/loja/comprar/m-gelo', null, t)]);
    const cart = await prisma.carteira.findUnique({ where: { userId: U.id } });
    check('duas compras juntas com saldo para uma: só uma passa', duas.filter(x => x.status === 200 || x.status === 201).length === 1 && cart.saldo === 0, `saldo ${cart.saldo}`);
    const mov = await prisma.nexMovimento.findMany({ where: { userId: U.id } });
    check('extrato registra as compras como saída', mov.filter(m => m.valor < 0).length === 3);

    console.log('● Equipar');
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-neon-roxo' }, t);
    check('equipa a moldura que tem', r.status === 200 && r.data?.itemId === 'm-neon-roxo', JSON.stringify(r.data));
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-galaxia' }, t);
    check('não equipa o que não tem', r.status === 403, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'placa', itemId: 'm-neon-roxo' }, t);
    check('não põe moldura no lugar da placa', r.status === 400, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'icone', itemId: 'i-controle' }, t);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    check('os outros veem a moldura e o ícone', r.data?.profile?.moldura === 'm-neon-roxo' && r.data?.profile?.icone === 'i-controle', JSON.stringify(r.data?.profile));
    r = await call('PATCH', '/users/@me/profile', { moldura: 'm-aurora' }, t);
    check('não dá para pôr item pelo perfil (sem comprar)', r.status === 400, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: null }, t);
    check('tira a moldura', r.status === 200 && r.data?.itemId === null);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    for (const u of [U, V]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
