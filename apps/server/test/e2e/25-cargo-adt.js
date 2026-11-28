// Teste de ponta a ponta da restrição "Volume mínimo de 10%" (limit_volume), usada no cargo ADT.
// A trava de som em si roda no navegador; aqui conferimos o que o servidor entrega ao cliente.
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
const call = async (method, path, body, token) => {
  const r = await fetch(API + path, {
    method, headers: { Origin: ORIGIN, 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);
const criar = async (s) => prisma.user.create({
  data: {
    email: `teste-${rnd}-${s}@exemplo.invalid`, username: `teste_${rnd}_${s}`,
    passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: `Teste ${s}` } },
  },
});
const entrar = async (u) => (await call('POST', '/auth/login', { email: u.email, password: SENHA })).data?.accessToken;

(async () => {
  const A = await criar('dono'), B = await criar('adt'), C = await criar('membro');
  let serverId = null;
  try {
    const tA = await entrar(A), tB = await entrar(B), tC = await entrar(C);
    serverId = (await call('POST', '/servers', { name: `Teste ${rnd}` }, tA)).data?.id;
    await prisma.serverMember.createMany({ data: [{ serverId, userId: B.id }, { serverId, userId: C.id }] });
    const meu = async (t) => (await call('GET', `/servers/${serverId}/roles/@me`, null, t)).data?.permissions || [];

    console.log('● Cargo ADT');
    const adt = (await call('POST', `/servers/${serverId}/roles`, { name: 'ADT' }, tA)).data;
    await call('PATCH', `/servers/${serverId}/roles/${adt.id}`, { permissions: ['limit_volume'] }, tA);
    const salvo = await prisma.role.findUnique({ where: { id: adt.id } });
    check('restrição é aceita ao salvar o cargo', salvo?.permissions.includes('limit_volume'), salvo?.permissions);

    const r = await call('PUT', `/servers/${serverId}/roles/${adt.id}/members/${B.id}`, null, tA);
    check('dono dá o cargo ADT', r.status < 300, JSON.stringify(r.data));
    check('quem tem ADT fica com a restrição', (await meu(tB)).includes('limit_volume'));
    check('membro sem ADT não fica travado', !(await meu(tC)).includes('limit_volume'));
    check('dono nunca fica travado', !(await meu(tA)).includes('limit_volume'));

    const membros = (await call('GET', `/servers/${serverId}/members`, null, tB)).data;
    const lista = Array.isArray(membros) ? membros : membros?.members || [];
    const eu = lista.find((m) => m.userId === B.id || m.user?.id === B.id);
    check('lista de membros leva a restrição para o app aplicar', !!eu?.roles?.some((r) => r.permissions?.includes('limit_volume')), JSON.stringify(eu?.roles));

    const r2 = await call('PUT', `/servers/${serverId}/roles/${adt.id}/members/${A.id}`, null, tC);
    check('membro comum não consegue dar o cargo', r2.status === 403, String(r2.status));

    console.log('● Administrador');
    await call('PATCH', `/servers/${serverId}/roles/${adt.id}`, { permissions: ['administrator'] }, tA);
    check('cargo administrador sem a marca não trava', !(await meu(tB)).includes('limit_volume'));
    await call('PATCH', `/servers/${serverId}/roles/${adt.id}`, { permissions: ['administrator', 'limit_volume'] }, tA);
    check('cargo administrador com a marca trava', (await meu(tB)).includes('limit_volume'));
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch((e) => console.log('limpeza:', e.message));
    for (const u of [A, B, C]) await prisma.user.delete({ where: { id: u.id } }).catch((e) => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
