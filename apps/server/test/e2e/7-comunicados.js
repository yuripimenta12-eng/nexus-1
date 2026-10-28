// Teste de ponta a ponta dos comunicados do dono do Nexus.
// Roda DENTRO do container de teste (porta 3005), no MESMO banco de produção:
// por isso NUNCA cria comunicado pela API (mandaria notificação para todo
// mundo). O comunicado de teste é gravado direto no banco com data do ano
// 2000 e só a conta de teste (criada "em 1999") o vê como pendente — para
// os usuários reais ele é antigo demais para aparecer em destaque.
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const prisma = new PrismaClient();
const API = `http://${HOST}/api`;
const ORIGIN = 'https://www.nexuslink.art';
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const call = async (method, path, body, token) => {
  const headers = { Origin: ORIGIN, 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);
async function criarUsuario(sufixo, createdAt) {
  return prisma.user.create({
    data: {
      email: `teste-${rnd}-${sufixo}@exemplo.invalid`, username: `teste_${rnd}_${sufixo}`,
      passwordHash: await argon2.hash(SENHA), isVerified: true,
      ...(createdAt ? { createdAt } : {}),
      profile: { create: { displayName: `Teste ${sufixo}` } },
    },
  });
}
async function entrar(u) {
  const r = await call('POST', '/auth/login', { email: u.email, password: SENHA });
  return r.data?.accessToken;
}

(async () => {
  let A, B, aviso;
  try {
    A = await criarUsuario('antigo', new Date('1999-01-01T00:00:00Z'));
    B = await criarUsuario('novo');
    const tA = await entrar(A), tB = await entrar(B);
    aviso = await prisma.announcement.create({
      data: { title: `Teste automático ${rnd}`, body: 'Comunicado de teste (apagado em seguida).', authorId: A.id, createdAt: new Date('2000-01-01T00:00:00Z') },
    });

    console.log('● Comunicados: quem pode enviar');
    const antes = await prisma.announcement.count();
    let r = await call('POST', '/announcements', { title: 'não pode', body: 'não pode' }, tB);
    check('usuário comum não envia comunicado', r.status === 403, String(r.status));
    check('nada foi gravado', (await prisma.announcement.count()) === antes);
    r = await call('GET', '/announcements/admin', null, tB);
    check('usuário comum não vê o painel de comunicados', r.status === 403, String(r.status));
    r = await call('DELETE', `/announcements/${aviso.id}`, null, tB);
    check('usuário comum não apaga comunicado', r.status === 403, String(r.status));
    r = await call('GET', '/announcements', null, null);
    check('lista exige login', r.status === 401, String(r.status));

    console.log('● Comunicados: destaque até "Entendi"');
    r = await call('GET', '/announcements', null, tA);
    let meu = Array.isArray(r.data) && r.data.find(x => x.id === aviso.id);
    check('comunicado aparece pendente para quem já tinha conta', r.status === 200 && meu && meu.pending === true && meu.read === false, JSON.stringify(meu));
    check('lista não expõe quem enviou', meu && Object.keys(meu).sort().join() === 'body,createdAt,id,pending,read,title', JSON.stringify(meu && Object.keys(meu)));
    r = await call('GET', '/announcements', null, tB);
    meu = Array.isArray(r.data) && r.data.find(x => x.id === aviso.id);
    check('conta criada depois não recebe aviso antigo em destaque', !meu || meu.pending === false, JSON.stringify(meu));
    r = await call('POST', `/announcements/${aviso.id}/read`, null, tA);
    check('"Entendi" marca como lido', r.status === 201 || r.status === 200, String(r.status));
    r = await call('POST', `/announcements/${aviso.id}/read`, null, tA);
    check('marcar de novo não dá erro', r.status === 201 || r.status === 200, String(r.status));
    r = await call('GET', '/announcements', null, tA);
    meu = Array.isArray(r.data) && r.data.find(x => x.id === aviso.id);
    check('depois de lido sai do destaque e fica na lista', meu && meu.read === true && meu.pending === false, JSON.stringify(meu));
    r = await call('POST', `/announcements/naoexiste${rnd}/read`, null, tA);
    check('comunicado inexistente dá 404', r.status === 404, String(r.status));
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (aviso) await prisma.announcement.delete({ where: { id: aviso.id } }).catch(e => console.log('limpeza comunicado:', e.message));
    for (const u of [A, B]) {
      if (u) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e comunicado de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
