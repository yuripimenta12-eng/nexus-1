// Teste de ponta a ponta: modelo de servidor Gamer BR e votação da página
// "Em breve" (votar, trocar, tirar, contagem). Apaga tudo no final.
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
  const U = await criarUsuario('ideias');
  let serverId = null;
  try {
    const t = await entrar(U);

    console.log('● Modelo Gamer BR');
    let r = await call('POST', '/servers', { name: `Gamer ${rnd}`, modelo: 'gamer' }, t);
    serverId = r.data?.id;
    check('cria servidor com o modelo gamer', r.status === 201 && !!serverId, `status ${r.status}`);
    const salas = (r.data?.voiceRooms || []).map(v => v.name);
    const canais = (r.data?.channels || []).map(c => c.name);
    check('vem com as salas de squad e jogos', salas.includes('Squad 1') && salas.includes('Campeonato') && salas.includes('Valorant') && salas.length === 7, salas.join(','));
    check('vem com clipes e procurando-time', canais.includes('clipes') && canais.includes('procurando-time'), canais.join(','));
    const livekits = new Set((r.data?.voiceRooms || []).map(v => v.livekitRoom));
    check('cada sala tem a sua sala de voz própria', livekits.size === salas.length);
    r = await call('POST', '/servers', { name: 'x modelo', modelo: 'hacker' }, t);
    check('modelo desconhecido é recusado', r.status === 400, `status ${r.status}`);

    console.log('● Em breve: votação');
    r = await call('GET', '/ideias', null, t);
    check('lista as ideias e o que já chegou', r.status === 200 && r.data?.ideias?.length > 0 && r.data?.chegou?.length > 0);
    const ideia = r.data.ideias.find(i => i.id === 'telao');
    const antes = ideia?.quero ?? 0;
    check('sem voto ainda', ideia?.meuVoto === null);
    r = await call('PUT', '/ideias/telao/voto', { tipo: 'quero' }, t);
    check('vota "quero"', r.status === 200 && r.data?.meuVoto === 'quero', JSON.stringify(r.data));
    r = await call('GET', '/ideias', null, t);
    let agora = r.data.ideias.find(i => i.id === 'telao');
    check('a contagem sobe e o voto aparece', agora.quero === antes + 1 && agora.meuVoto === 'quero');
    await call('PUT', '/ideias/telao/voto', { tipo: 'quero' }, t);
    r = await call('GET', '/ideias', null, t);
    check('votar de novo não conta duas vezes', r.data.ideias.find(i => i.id === 'telao').quero === antes + 1);
    await call('PUT', '/ideias/telao/voto', { tipo: 'nao' }, t);
    r = await call('GET', '/ideias', null, t);
    agora = r.data.ideias.find(i => i.id === 'telao');
    check('troca para "não preciso"', agora.quero === antes && agora.meuVoto === 'nao');
    await call('PUT', '/ideias/telao/voto', { tipo: null }, t);
    r = await call('GET', '/ideias', null, t);
    check('tira o voto', r.data.ideias.find(i => i.id === 'telao').meuVoto === null);
    r = await call('PUT', '/ideias/nao-existe/voto', { tipo: 'quero' }, t);
    check('ideia que não existe é recusada', r.status === 400, `status ${r.status}`);
    r = await call('PUT', '/ideias/telao/voto', { tipo: 'talvez' }, t);
    check('voto inválido é recusado', r.status === 400, `status ${r.status}`);
    r = await call('GET', '/ideias');
    check('sem login não vê', r.status === 401, `status ${r.status}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    await prisma.user.delete({ where: { id: U.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Conta e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
