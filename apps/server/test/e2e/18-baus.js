// Teste de ponta a ponta dos baús: chances, abrir com Nex, repetido vira
// reembolso, aberturas simultâneas. Apaga tudo no final.
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
  const U = await criarUsuario('bau');
  try {
    const t = await entrar(U);

    console.log('● Vitrine dos baús');
    let r = await call('GET', '/loja/baus', null, t);
    const estreia = r.data?.find?.(b => b.id === 'bau-estreia');
    check('lista os baús com as chances', r.status === 200 && !!estreia && estreia.premios.length > 3);
    const soma = estreia.premios.reduce((s, p) => s + p.chance, 0);
    check('chances somam 100%', Math.abs(soma - 100) < 0.5, `soma ${soma}`);

    console.log('● Abrir');
    r = await call('POST', '/loja/baus/bau-estreia/abrir', null, t);
    check('sem Nex não abre', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/loja/baus/inventado/abrir', null, t);
    check('baú que não existe: 404', r.status === 404, `status ${r.status}`);
    // Já tem todos os itens do Baú Estreia: qualquer item que sair é repetido
    const itens = estreia.premios.filter(p => p.item).map(p => p.item.id);
    for (const itemId of itens) await prisma.itemPosse.create({ data: { userId: U.id, itemId, origem: 'teste' } });
    await prisma.carteira.upsert({ where: { userId: U.id }, create: { userId: U.id, saldo: 1000 }, update: { saldo: 1000 } });
    r = await call('POST', '/loja/baus/bau-estreia/abrir', null, t);
    const ok1 = r.status === 200 || r.status === 201;
    check('abre o baú (600 Nex)', ok1 && !!r.data?.premio, JSON.stringify(r.data));
    if (ok1) {
      const ehItem = r.data.premio.tipo === 'item';
      check('item que já tem vira repetido com reembolso', ehItem ? r.data.repetido === true && r.data.reembolso > 0 : r.data.repetido === false);
      const esperado = 1000 - 600 + (r.data.premio.nex || 0) + (r.data.reembolso || 0);
      check('saldo bate com preço, prêmio e reembolso', r.data.saldo === esperado, `saldo ${r.data.saldo}, esperado ${esperado}`);
    }
    // Saldo para um baú só, dois pedidos juntos
    await prisma.carteira.update({ where: { userId: U.id }, data: { saldo: 600 } });
    const dois = await Promise.all([call('POST', '/loja/baus/bau-estreia/abrir', null, t), call('POST', '/loja/baus/bau-estreia/abrir', null, t)]);
    check('dois baús juntos com saldo para um: só um abre', dois.filter(x => x.status === 200 || x.status === 201).length === 1);
    const mov = await prisma.nexMovimento.count({ where: { userId: U.id, motivo: { startsWith: 'Abriu' } } });
    check('extrato registra cada abertura', mov === 2, `aberturas ${mov}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    await prisma.user.delete({ where: { id: U.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Conta de teste apagada.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
