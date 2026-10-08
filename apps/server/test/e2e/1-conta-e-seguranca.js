// Teste de ponta a ponta da etapa 1 (roda DENTRO do container de teste, porta 3005).
// Cria contas temporárias de teste direto no banco e apaga tudo no final.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
authenticator.options = { window: 1 };
const prisma = new PrismaClient();
const API = `http://${HOST}/api`;
const O = { 'content-type': 'application/json', Origin: 'https://www.nexuslink.art' };
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const call = async (method, path, body, token) => {
  const r = await fetch(API + path, { method, headers: { ...O, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);
async function criarUsuario(sufixo) {
  return prisma.user.create({
    data: {
      email: `teste-${rnd}-${sufixo}@exemplo.invalid`, username: `teste_${rnd}_${sufixo}`,
      passwordHash: await argon2.hash(SENHA), isVerified: false,
      profile: { create: { displayName: `Teste ${sufixo}` } },
    },
  });
}

(async () => {
  const u1 = await criarUsuario('a');
  const u2 = await criarUsuario('b');
  let serverId = null;
  try {
    console.log('● Login e dados seguros');
    let r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    check('login sem 2FA devolve sessão', r.status === 200 && !!r.data?.accessToken, JSON.stringify(r.data));
    let tok = r.data?.accessToken;
    r = await call('GET', '/auth/me', null, tok);
    check('/auth/me não expõe hash nem segredo do 2FA', r.status === 200 && !('passwordHash' in r.data) && !('twoFactorSecret' in r.data) && !('twoFactorRecovery' in r.data));
    check('conta nova começa NÃO confirmada', r.data?.isVerified === false);

    console.log('● Confirmação de e-mail');
    const token = 'tok' + rnd.repeat(5) + 'abcdefghijklmnopqrstuvwxyz';
    await prisma.emailVerification.create({ data: { userId: u1.id, token, expiresAt: new Date(Date.now() + 3600e3) } });
    r = await call('POST', '/auth/verify-email', { token });
    check('link válido confirma', r.status === 200);
    r = await call('GET', '/auth/me', null, tok);
    check('conta passa a confirmada', r.data?.isVerified === true);
    r = await call('POST', '/auth/verify-email', { token });
    check('link usado não vale de novo', r.status === 400);
    r = await call('POST', '/auth/verify-email', { token: 'x'.repeat(40) });
    check('link inventado é recusado', r.status === 400);

    console.log('● Verificação em duas etapas');
    r = await call('POST', '/auth/2fa/setup', null, tok);
    check('setup devolve QR e chave', r.status === 200 && r.data?.qrDataUrl?.startsWith('data:image/png') && !!r.data?.manualKey);
    const secret = (r.data?.manualKey || '').replace(/\s/g, '');
    r = await call('POST', '/auth/2fa/enable', { code: '000000' }, tok);
    check('código errado não liga', r.status === 400);
    r = await call('POST', '/auth/2fa/enable', { code: authenticator.generate(secret) }, tok);
    check('código certo liga e devolve 8 códigos', r.status === 200 && r.data?.recoveryCodes?.length === 8);
    const recovery = r.data?.recoveryCodes || [];
    const dbU = await prisma.user.findUnique({ where: { id: u1.id } });
    check('segredo guardado cifrado (não é o segredo puro)', dbU.twoFactorSecret && !dbU.twoFactorSecret.includes(secret));
    check('códigos guardados só como hash', dbU.twoFactorRecovery.length === 8 && !dbU.twoFactorRecovery.includes(recovery[0]));
    r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    check('senha certa com 2FA NÃO entrega sessão', r.status === 200 && r.data?.twoFactorRequired === true && !r.data?.accessToken);
    const ticket = r.data?.ticket;
    r = await call('POST', '/auth/login/2fa', { ticket, code: '123456' });
    check('código errado no login é recusado', r.status === 401);
    r = await call('POST', '/auth/login/2fa', { ticket, code: authenticator.generate(secret) });
    check('código certo entra', r.status === 200 && !!r.data?.accessToken);
    tok = r.data?.accessToken;
    r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    const t2 = r.data?.ticket;
    r = await call('POST', '/auth/login/2fa', { ticket: t2, code: recovery[0] });
    check('código de recuperação entra', r.status === 200 && !!r.data?.accessToken);
    r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    r = await call('POST', '/auth/login/2fa', { ticket: r.data?.ticket, code: recovery[0] });
    check('código de recuperação só vale uma vez', r.status === 401);
    r = await call('POST', '/auth/login/2fa', { ticket: 'bilhete.falso.qualquer', code: authenticator.generate(secret) });
    check('bilhete falso é recusado', r.status === 401);
    r = await call('POST', '/auth/2fa/disable', { password: 'errada', code: authenticator.generate(secret) }, tok);
    check('desligar com senha errada falha', r.status === 400);
    r = await call('POST', '/auth/2fa/disable', { password: SENHA, code: authenticator.generate(secret) }, tok);
    check('desligar com senha + código funciona', r.status === 200);
    r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    check('sem 2FA o login volta a ser direto', !!r.data?.accessToken);
    tok = r.data?.accessToken;

    console.log('● Passar a posse do servidor');
    r = await call('POST', '/servers', { name: `Servidor teste ${rnd}` }, tok);
    serverId = r.data?.id;
    check('servidor de teste criado', r.status === 201 && !!serverId, JSON.stringify(r.data));
    await prisma.serverMember.create({ data: { serverId, userId: u2.id } });
    await prisma.user.update({ where: { id: u2.id }, data: { isVerified: true } });
    r = await call('POST', '/users/@me/delete', { password: SENHA, confirm: 'EXCLUIR' }, tok);
    check('dono não consegue excluir a conta', r.status === 409 && r.data?.servers?.length === 1);
    r = await call('PATCH', `/servers/${serverId}/owner`, { newOwnerId: u2.id }, tok);
    check('posse transferida', r.status === 200);
    const s = await prisma.server.findUnique({ where: { id: serverId } });
    const m1 = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: u1.id } } });
    const m2 = await prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId: u2.id } } });
    check('novo dono e cargos corretos', s.ownerId === u2.id && m2.role === 'OWNER' && m1.role === 'ADMIN');

    console.log('● Excluir a própria conta');
    await prisma.message.create({ data: { channelId: (await prisma.channel.findFirst({ where: { serverId } })).id, authorId: u1.id, content: 'mensagem de teste' } });
    await prisma.directMessage.create({ data: { senderId: u1.id, receiverId: u2.id, content: 'dm de teste' } });
    r = await call('POST', '/users/@me/delete', { password: 'errada', confirm: 'EXCLUIR' }, tok);
    check('senha errada não exclui', r.status === 400);
    r = await call('POST', '/users/@me/delete', { password: SENHA, confirm: 'apagar' }, tok);
    check('sem digitar EXCLUIR não exclui', r.status === 400);
    r = await call('POST', '/users/@me/delete', { password: SENHA, confirm: 'excluir' }, tok);
    check('exclusão funciona', r.status === 200, JSON.stringify(r.data));
    const tomb = await prisma.user.findUnique({ where: { id: u1.id }, include: { profile: true } });
    check('e-mail e nome apagados', !tomb.email.includes('teste-') && tomb.profile.displayName === 'Conta removida' && tomb.isSuspended);
    check('mensagens e DMs apagadas', (await prisma.message.count({ where: { authorId: u1.id } })) === 0 && (await prisma.directMessage.count({ where: { senderId: u1.id } })) === 0);
    check('saiu dos servidores e sem sessões', (await prisma.serverMember.count({ where: { userId: u1.id } })) === 0 && (await prisma.session.count({ where: { userId: u1.id } })) === 0);
    r = await call('POST', '/auth/login', { email: u1.email, password: SENHA });
    check('não consegue mais entrar', r.status === 401);
    r = await call('GET', '/auth/me', null, tok);
    check('sessão antiga parou de valer', r.status === 401);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(() => {});
    for (const id of [u1.id, u2.id]) {
      await prisma.directMessage.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas de teste apagadas.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
