// Teste de ponta a ponta das conquistas novas: Veterano, Rei do UNidos, Sortudo, Colecionador,
// Popular, Assinante e Tempo de jogo por nível, Nexus 2026, e o contador diário de assinante.
// Ajusta os contadores direto no banco (não dá para esperar 1 ano ou 10 vitórias num teste).
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
const criar = async (s, extra = {}) => prisma.user.create({
  data: {
    email: `teste-${rnd}-${s}@exemplo.invalid`, username: `teste_${rnd}_${s}`,
    passwordHash: await argon2.hash(SENHA), isVerified: true, profile: { create: { displayName: `Teste ${s}` } }, ...extra,
  },
});
const chaves = async (t) => new Set(((await call('GET', '/placar/conquistas', null, t)).data?.desbloqueadas || []).map(c => c.chave));

(async () => {
  await sleep(30000);
  const doisAnos = new Date(Date.now() - 731 * 86_400_000);
  const U = await criar('veio', { createdAt: doisAnos, diasAssinante: 95, minutosJogo: 1300 });
  const amigos = [];
  try {
    for (let i = 0; i < 10; i++) amigos.push(await criar(`amigo${i}`));
    await prisma.friendship.createMany({ data: amigos.map(a => ({ requesterId: U.id, addresseeId: a.id, status: 'ACCEPTED' })) });
    await prisma.carteira.create({ data: { userId: U.id, unidosVitorias: 10, parimparVitorias: 9 } });
    await prisma.itemPosse.createMany({ data: Array.from({ length: 15 }, (_, i) => ({ userId: U.id, itemId: `teste-item-${i}`, origem: 'teste' })) });
    const t = (await call('POST', '/auth/login', { email: U.email, password: SENHA })).data?.accessToken;

    let c = await chaves(t);
    console.log('● Conquistas por meta');
    check('Veterano 1 e 2 anos (conta de 2 anos)', c.has('veterano-1') && c.has('veterano-2') && !c.has('veterano-3'));
    check('Rei do UNidos com 10 vitórias', c.has('rei-do-unidos'));
    check('Sortudo ainda não com 9 vitórias', !c.has('sortudo'));
    check('Colecionador com 15 itens', c.has('colecionador'));
    check('Popular com 10 amigos', c.has('popular'));
    check('Assinante: 95 dias liberam os 3 primeiros níveis', c.has('assinante-1') && c.has('assinante-2') && c.has('assinante-3') && !c.has('assinante-4'));
    check('Tempo de jogo: 1.300 min liberam os 3 primeiros níveis', c.has('jogo-1') && c.has('jogo-2') && c.has('jogo-3') && !c.has('jogo-4'));
    if (Date.now() < new Date('2027-01-01T03:00:00Z').getTime()) check('Nexus 2026 para quem usa em 2026', c.has('nexus-2026'));
    check('Natal ainda não (só no dia)', !c.has('natal-2026') || new Date() >= new Date('2026-12-24T03:00:00Z'));

    await prisma.carteira.update({ where: { userId: U.id }, data: { parimparVitorias: 10 } });
    c = await chaves(t);
    check('Sortudo com 10 vitórias', c.has('sortudo'));

    console.log('● Contador diário de assinante');
    const A = await criar('assina', { plano: 'mais', planoAte: new Date(Date.now() + 5 * 86_400_000) });
    amigos.push(A);
    // O contador roda a cada 10 min no servidor; aqui chamamos a mesma conta direto no banco
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const rodar = () => prisma.$executeRaw`UPDATE "users" SET "diasAssinante" = "diasAssinante" + 1, "assinanteDia" = ${hoje}, "assinanteDesde" = COALESCE("assinanteDesde", ${new Date()}) WHERE "id" = ${A.id} AND "plano" <> 'gratis' AND "planoAte" > ${new Date()} AND ("assinanteDia" IS NULL OR "assinanteDia" <> ${hoje})`;
    await rodar(); await rodar();
    const a = await prisma.user.findUnique({ where: { id: A.id }, select: { diasAssinante: true, assinanteDesde: true } });
    check('conta 1 dia e não conta duas vezes no mesmo dia', a?.diasAssinante === 1 && !!a?.assinanteDesde, JSON.stringify(a));
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    for (const u of [U, ...amigos]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
