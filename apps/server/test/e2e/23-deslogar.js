// Teste de ponta a ponta do botão "Deslogar" do painel do dono: só admin usa, as sessões
// somem e o login automático (refresh) para de funcionar. Apaga tudo no final.
// Roda DENTRO do container de teste (porta 3005).
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
const criar = async (s, admin = false) => prisma.user.create({
  data: {
    email: `teste-${rnd}-${s}@exemplo.invalid`, username: `teste_${rnd}_${s}`, isAdmin: admin,
    passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: `Teste ${s}` } },
  },
});

(async () => {
  await sleep(30000);
  const A = await criar('dono', true);
  const U = await criar('alvo');
  try {
    const la = await call('POST', '/auth/login', { email: A.email, password: SENHA });
    const lu = await call('POST', '/auth/login', { email: U.email, password: SENHA });
    const ta = la.data?.accessToken, tu = lu.data?.accessToken, refresh = lu.data?.refreshToken;
    check('a pessoa tem sessão aberta', (await prisma.session.count({ where: { userId: U.id } })) >= 1);

    let r = await call('POST', `/admin/users/${A.id}/deslogar`, null, tu);
    check('quem não é admin não desloga ninguém', r.status === 403, `status ${r.status}`);
    r = await call('POST', `/admin/users/${U.id}/deslogar`, null, ta);
    check('o dono desloga a pessoa', r.status === 201 && r.data?.sessoes >= 1, `status ${r.status} ${JSON.stringify(r.data)}`);
    check('as sessões somem', (await prisma.session.count({ where: { userId: U.id } })) === 0);
    if (refresh) {
      const rr = await fetch(`${API}/auth/refresh`, {
        method: 'POST', headers: { Origin: ORIGIN, Authorization: `Bearer ${refresh}` },
      });
      check('o login automático para de funcionar', rr.status === 401, `status ${rr.status}`);
    }
    check('fica no histórico do painel', (await prisma.auditLog.count({ where: { actorId: A.id, action: 'ADMIN_FORCE_LOGOUT', targetId: U.id } })) === 1);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: [A.id, U.id] } } }).catch(() => {});
    for (const u of [A, U]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
