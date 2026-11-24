// Teste de ponta a ponta do aceite dos Termos/Política com a declaração de 18+:
// cadastro sem a declaração é recusado, quem já tem conta aceita uma vez e o aceite fica gravado.
// Roda DENTRO do container de teste (porta 3005); apaga tudo no final.
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();
const API = `http://${HOST}/api`;
const ORIGIN = 'https://www.nexuslink.art';
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const call = async (method, path, body, token) => {
  const r = await fetch(API + path, {
    method, headers: { Origin: ORIGIN, 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);

(async () => {
  await sleep(30000);
  const U = await prisma.user.create({
    data: {
      email: `teste-${rnd}-termos@exemplo.invalid`, username: `teste_${rnd}_termos`,
      passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: 'Teste termos' } },
    },
  });
  try {
    console.log('● Cadastro');
    const base = { displayName: 'Teste', username: `teste_${rnd}_cad`, email: `teste-${rnd}-cad@exemplo.invalid`, password: SENHA };
    // Sem código de convite o cadastro já para antes (401); com ou sem ele, a conta não pode nascer
    const r0 = await call('POST', '/auth/register', { ...base, maior18: 'sim' });
    const criou = await prisma.user.count({ where: { email: base.email } });
    check('declaração de 18+ inválida não cria conta', r0.status >= 400 && r0.status < 500 && criou === 0, `status ${r0.status} criou=${criou}`);
    let r;

    console.log('● Quem já tem conta');
    const login = await call('POST', '/auth/login', { email: U.email, password: SENHA });
    const t = login.data?.accessToken;
    r = await call('GET', '/auth/me', null, t);
    check('conta antiga aparece sem aceite', r.status === 200 && !r.data?.termosVersao, JSON.stringify(r.data?.termosVersao));
    r = await call('POST', '/users/@me/termos', {}, t);
    check('aceitar sem declarar 18+ é recusado', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/users/@me/termos', { maior18: true }, t);
    check('aceita os termos', r.status === 200 && typeof r.data?.termosVersao === 'string', `status ${r.status}`);
    const u = await prisma.user.findUnique({ where: { id: U.id }, select: { termosVersao: true, termosAceitosEm: true } });
    check('o aceite fica gravado com data', !!u?.termosVersao && Date.now() - (u?.termosAceitosEm?.getTime() ?? 0) < 60_000);
    r = await call('POST', '/users/@me/termos', { maior18: true });
    check('sem login não aceita', r.status === 401, `status ${r.status}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    await prisma.user.delete({ where: { id: U.id } }).catch(e => console.log('limpeza:', e.message));
    await prisma.user.deleteMany({ where: { email: `teste-${rnd}-cad@exemplo.invalid` } }).catch(() => {});
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
