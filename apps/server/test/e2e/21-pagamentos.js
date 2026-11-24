// Teste de ponta a ponta do pagamento por Pix (Efí em HOMOLOGAÇÃO: sem dinheiro de verdade;
// lá, cobranças até R$ 10 são pagas sozinhas). Confere que o plano e a Prisma chegam,
// que a doação não entrega nada e que um não vê o pedido do outro. Apaga tudo no final.
// Roda DENTRO do container de teste (porta 3005). Sem credenciais do Efí, só testa as recusas.
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
async function criarUsuario(sufixo) {
  return prisma.user.create({
    data: {
      email: `teste-${rnd}-${sufixo}@exemplo.invalid`, username: `teste_${rnd}_${sufixo}`,
      passwordHash: await argon2.hash(SENHA), isVerified: true,
      profile: { create: { displayName: `Teste ${sufixo}` } },
    },
  });
}
const entrar = async (u) => (await call('POST', '/auth/login', { email: u.email, password: SENHA })).data?.accessToken;

// Espera o Efí de homologação confirmar (pergunta como o site pergunta)
async function esperarPago(id, token) {
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const r = await call('GET', `/pagamentos/pix/${id}`, null, token);
    if (r.data?.status === 'pago') return r.data;
  }
  return null;
}

(async () => {
  await sleep(30000);
  const U = await criarUsuario('paga');
  const V = await criarUsuario('outro');
  try {
    const t = await entrar(U), tv = await entrar(V);

    console.log('● Recusas');
    let r = await call('POST', '/pagamentos/pix', { tipo: 'plano', item: 'mais-mes' });
    check('sem login não cria pedido', r.status === 401, `status ${r.status}`);
    const disp = (await call('GET', '/pagamentos/disponivel', null, t)).data;
    check('diz se o Pix está ligado', typeof disp?.ligado === 'boolean', JSON.stringify(disp));
    if (!disp?.ligado) {
      r = await call('POST', '/pagamentos/pix', { tipo: 'plano', item: 'mais-mes' }, t);
      check('sem Efí configurado responde indisponível', r.status === 503, `status ${r.status}`);
      console.log('  (Efí não configurado nesta cópia: pulando os pagamentos)');
      return;
    }
    check('a cópia de teste usa o Efí de homologação', disp.teste === true, JSON.stringify(disp));
    r = await call('POST', '/pagamentos/pix', { tipo: 'plano', item: 'gratis' }, t);
    check('plano que não existe é recusado', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/pagamentos/pix', { tipo: 'doacao', valorCentavos: 99 }, t);
    check('doação abaixo de R$ 1 é recusada', r.status === 400, `status ${r.status}`);
    r = await call('POST', '/pagamentos/pix', { tipo: 'doacao', valorCentavos: 50001 }, t);
    check('doação acima de R$ 500 é recusada', r.status === 400, `status ${r.status}`);

    console.log('● Nexus+ por 1 mês (R$ 9,90)');
    r = await call('POST', '/pagamentos/pix', { tipo: 'plano', item: 'mais-mes', valorCentavos: 1 }, t);
    check('cria o Pix com QR Code e copia e cola', r.status === 201 && r.data?.copiaECola?.startsWith('000201') && r.data?.qrImagem?.startsWith('data:image'), `status ${r.status} ${r.data?.message ?? ''}`);
    check('o preço vem do servidor (ignora o valor mandado)', r.data?.valorCentavos === 990, String(r.data?.valorCentavos));
    const plano = r.data;
    r = await call('GET', `/pagamentos/pix/${plano?.id}`, null, tv);
    check('outra pessoa não vê o pedido', r.status === 404, `status ${r.status}`);
    const pago = plano?.id ? await esperarPago(plano.id, t) : null;
    check('o Pix é confirmado', pago?.status === 'pago', JSON.stringify(pago));
    const u1 = await prisma.user.findUnique({ where: { id: U.id }, select: { plano: true, planoAte: true } });
    const dias = u1?.planoAte ? (u1.planoAte.getTime() - Date.now()) / 86_400_000 : 0;
    check('o plano Nexus+ chega com 30 dias', u1?.plano === 'mais' && dias > 29.9 && dias <= 30, `${u1?.plano} ${dias.toFixed(2)}`);
    // Perguntar de novo não entrega de novo
    await call('GET', `/pagamentos/pix/${plano.id}`, null, t);
    const u1b = await prisma.user.findUnique({ where: { id: U.id }, select: { planoAte: true } });
    check('não entrega duas vezes', u1b?.planoAte?.getTime() === u1?.planoAte?.getTime());

    console.log('● 100 Prisma (R$ 4,90)');
    r = await call('POST', '/pagamentos/pix', { tipo: 'prisma', item: 'pp-100' }, t);
    check('cria o Pix da Prisma', r.status === 201 && r.data?.valorCentavos === 490, `status ${r.status}`);
    const pPrisma = r.data?.id ? await esperarPago(r.data.id, t) : null;
    const c = await prisma.carteira.findUnique({ where: { userId: U.id }, select: { prismas: true } });
    check('a Prisma chega', pPrisma?.status === 'pago' && c?.prismas === 100, `prismas=${c?.prismas}`);
    const mov = await prisma.prismaMovimento.count({ where: { userId: U.id, motivo: 'Compra por Pix', valor: 100 } });
    check('aparece no extrato da Prisma', mov === 1, String(mov));

    console.log('● Doação de R$ 2,50');
    r = await call('POST', '/pagamentos/pix', { tipo: 'doacao', valorCentavos: 250 }, tv);
    check('cria o Pix da doação com o valor escolhido', r.status === 201 && r.data?.valorCentavos === 250, `status ${r.status}`);
    const pDoacao = r.data?.id ? await esperarPago(r.data.id, tv) : null;
    const v1 = await prisma.user.findUnique({ where: { id: V.id }, select: { plano: true } });
    const cv = await prisma.carteira.findUnique({ where: { userId: V.id }, select: { prismas: true } });
    check('doação é confirmada e não dá nada em troca', pDoacao?.status === 'pago' && v1?.plano !== 'mais' && v1?.plano !== 'pro' && !cv?.prismas, `${v1?.plano} ${cv?.prismas}`);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    // Dar plano pode gravar auditoria; os pedidos somem junto com a conta
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: [U.id, V.id] } }, { targetId: { in: [U.id, V.id] } }] } }).catch(() => {});
    for (const u of [U, V]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
