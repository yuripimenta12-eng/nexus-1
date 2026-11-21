// Teste de ponta a ponta da economia Nex: presença (sequência, um por dia,
// cliques simultâneos), roleta (giros por plano) e missões. Apaga tudo no final.
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

const diaBR = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const ontem = () => diaBR(new Date(new Date(`${diaBR()}T00:00:00-03:00`).getTime() - 12 * 3600_000));

(async () => {
  await sleep(30000);
  const U = await criarUsuario('nex');
  try {
    const t = await entrar(U);

    console.log('● Carteira e Presença Nexus');
    let r = await call('GET', '/nex', null, t);
    check('começa com 0 Nex', r.status === 200 && r.data?.saldo === 0, JSON.stringify(r.data?.saldo));
    check('presença no dia 1, ainda não pega', r.data?.presenca?.dia === 1 && r.data?.presenca?.pegouHoje === false);
    r = await call('POST', '/nex/presenca', null, t);
    check('pega a presença do dia 1 (+10)', (r.status === 200 || r.status === 201) && r.data?.ganhou === 10 && r.data?.saldo === 10, JSON.stringify(r.data));
    r = await call('POST', '/nex/presenca', null, t);
    check('não pega duas vezes no mesmo dia', r.status === 409, `status ${r.status}`);
    // Simula que pegou o dia 3 ontem: hoje vale o dia 4
    await prisma.carteira.update({ where: { userId: U.id }, data: { presencaDia: 3, presencaData: ontem() } });
    r = await call('POST', '/nex/presenca', null, t);
    check('sequência continua: dia 4 (+25)', r.data?.dia === 4 && r.data?.ganhou === 25, JSON.stringify(r.data));
    // Vários cliques ao mesmo tempo num dia novo: só um vale
    await prisma.carteira.update({ where: { userId: U.id }, data: { presencaData: ontem() } });
    const antes = (await prisma.carteira.findUnique({ where: { userId: U.id } })).saldo;
    const tentativas = await Promise.all([1, 2, 3, 4, 5].map(() => call('POST', '/nex/presenca', null, t)));
    const deram = tentativas.filter(x => x.status === 200 || x.status === 201).length;
    const depois = (await prisma.carteira.findUnique({ where: { userId: U.id } })).saldo;
    check('5 cliques juntos: só 1 pega', deram === 1 && depois - antes === 30, `deram ${deram}, ganhou ${depois - antes}`);

    console.log('● Roleta do dia');
    r = await call('POST', '/nex/roleta', null, t);
    check('gira e ganha algum prêmio', (r.status === 200 || r.status === 201) && r.data?.ganhou > 0 && typeof r.data?.indice === 'number', JSON.stringify(r.data));
    r = await call('POST', '/nex/roleta', null, t);
    check('grátis: só 1 giro por dia', r.status === 409, `status ${r.status}`);
    await prisma.user.update({ where: { id: U.id }, data: { plano: 'pro', planoAte: new Date(Date.now() + 86400_000) } });
    r = await call('POST', '/nex/roleta', null, t);
    check('Pro ganha o 2º giro', r.status === 200 || r.status === 201, `status ${r.status}`);
    r = await call('POST', '/nex/roleta', null, t);
    check('Pro: o 3º não', r.status === 409, `status ${r.status}`);

    console.log('● Missões');
    r = await call('POST', '/nex/missoes/foto', null, t);
    check('missão não cumprida é recusada', r.status === 400, `status ${r.status}`);
    await prisma.profile.update({ where: { userId: U.id }, data: { avatarUrl: 'https://arquivos.nexuslink.art/nexus-uploads/avatars/x.webp' } });
    r = await call('POST', '/nex/missoes/foto', null, t);
    check('cumpriu (foto): resgata com bônus Pro (30 → 45)', r.data?.ganhou === 45, JSON.stringify(r.data));
    r = await call('POST', '/nex/missoes/foto', null, t);
    check('não resgata duas vezes', r.status === 409, `status ${r.status}`);
    r = await call('POST', '/nex/missoes/inventada', null, t);
    check('missão que não existe é recusada', r.status === 400, `status ${r.status}`);
    r = await call('GET', '/nex', null, t);
    const foto = r.data?.missoes?.find(x => x.id === 'foto');
    check('resumo mostra a missão resgatada e o bônus', foto?.resgatada === true && r.data?.bonus === 1.5);
    r = await call('GET', '/nex/extrato', null, t);
    check('extrato registra cada entrada', Array.isArray(r.data) && r.data.length >= 6 && r.data.some(x => /Presença/.test(x.motivo)));
    r = await call('GET', '/nex');
    check('sem login não vê', r.status === 401, `status ${r.status}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    await prisma.user.delete({ where: { id: U.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Conta de teste apagada.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
