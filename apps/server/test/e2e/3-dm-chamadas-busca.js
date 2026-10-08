// Teste de ponta a ponta da etapa 3 (DM completa, chamada 1:1, busca,
// silenciar, GIFs, "Jogando", mensagem de voz). Roda DENTRO do container de
// teste (porta 3005). Cria contas/servidor temporários e apaga tudo no final,
// inclusive os arquivos enviados ao armazenamento.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const WS = require('ws');
const AWS = require('aws-sdk');
const prisma = new PrismaClient();
const API = `http://${HOST}/api`;
const ORIGIN = 'https://www.nexuslink.art';
const SENHA = 'Teste#12345';
let ok = 0, falhas = 0;
const check = (nome, cond, extra = '') => { if (cond) { ok++; console.log('  ✔', nome); } else { falhas++; console.log('  ✘', nome, extra); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const call = async (method, path, body, token, raw) => {
  const headers = { Origin: ORIGIN, ...(raw ? {} : { 'content-type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) };
  const r = await fetch(API + path, { method, headers, body: raw ? body : (body !== undefined && body !== null ? JSON.stringify(body) : undefined) });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const rnd = Math.random().toString(36).slice(2, 8);
const enviados = []; // URLs de arquivos para apagar no fim
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
function socket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN } });
    const s = {
      events: [],
      emit(ev, data) { ws.send('42' + JSON.stringify([ev, data])); },
      got(ev, pred = () => true) { return s.events.find(e => e[0] === ev && pred(e[1])); },
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
const arquivo = (conteudo, tipo, nome) => { const f = new FormData(); f.append('file', new Blob([conteudo], { type: tipo }), nome); return f; };

(async () => {
  const A = await criarUsuario('a');
  const B = await criarUsuario('b');
  const C = await criarUsuario('c');
  const D = await criarUsuario('removido');
  await prisma.user.update({ where: { id: D.id }, data: { isSuspended: true } });
  let serverId = null;
  const socks = [];
  try {
    const tA = await entrar(A), tB = await entrar(B), tC = await entrar(C);

    console.log('● DM: texto validado');
    let r = await call('POST', `/dms/${B.id}/send`, { content: 'olá B, tudo bem? palavra-secreta' }, tA);
    check('DM normal chega', r.status === 201 && r.data?.content?.startsWith('olá B'), JSON.stringify(r.data));
    const dm1 = r.data;
    r = await call('POST', `/dms/${B.id}/send`, { content: '   ' }, tA);
    check('DM vazia é recusada', r.status === 400);
    r = await call('POST', `/dms/${B.id}/send`, { content: 'x'.repeat(4500) }, tA);
    check('DM gigante é recusada (sem erro 500)', r.status === 400);
    r = await call('POST', `/dms/${B.id}/send`, { content: 12345 }, tA);
    check('DM com texto inválido é recusada', r.status === 400);
    r = await call('POST', `/dms/${D.id}/send`, { content: 'oi' }, tA);
    check('não manda DM para conta removida', r.status === 403);
    r = await call('GET', `/dms/${B.id}/messages?limit=100000`, null, tA);
    check('limite de carga respeitado', r.status === 200 && Array.isArray(r.data) && r.data.length <= 100);
    r = await call('GET', `/dms/${B.id}/messages?before=ontem`, null, tA);
    check('data inválida não derruba (400)', r.status === 400);

    console.log('● DM: bloqueio');
    await prisma.block.create({ data: { blockerId: C.id, blockedId: A.id } });
    r = await call('POST', `/dms/${C.id}/send`, { content: 'oi C' }, tA);
    check('bloqueado não consegue mandar DM', r.status === 403);
    r = await call('POST', `/dms/${A.id}/send`, { content: 'oi A' }, tC);
    check('quem bloqueou também não manda', r.status === 403 && /Desbloqueie/.test(r.data?.message || ''));
    r = await call('POST', `/dms/${C.id}/attachment`, arquivo('oi', 'text/plain', 'a.txt'), tA, true);
    check('bloqueado não manda arquivo', r.status === 403);
    r = await call('POST', `/dms/${C.id}/call`, null, tA);
    check('bloqueado não consegue ligar', r.status === 403);

    console.log('● DM: arquivos e mensagem de voz');
    r = await call('POST', `/dms/${B.id}/attachment`, arquivo('conteudo de teste', 'text/plain', 'notas "x".txt'), tA, true);
    check('arquivo na DM', r.status === 201 && r.data?.attachments?.length === 1, JSON.stringify(r.data));
    if (r.data?.attachments?.[0]) enviados.push(r.data.attachments[0].url);
    r = await call('POST', `/dms/${B.id}/attachment`, arquivo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), 'audio/webm;codecs=opus', 'voz.webm'), tA, true);
    check('mensagem de voz na DM', r.status === 201 && r.data?.attachments?.[0]?.mimeType === 'audio/webm', JSON.stringify(r.data));
    if (r.data?.attachments?.[0]) enviados.push(r.data.attachments[0].url);
    r = await call('POST', `/dms/${B.id}/attachment`, arquivo('<html>', 'text/html', 'pagina.html'), tA, true);
    check('tipo perigoso (HTML) é recusado', r.status === 400);
    r = await call('GET', '/dms/conversations', null, tB);
    check('lista de conversas mostra "Mensagem de voz"', r.status === 200 && r.data?.[0]?.lastMessage?.content === '🎤 Mensagem de voz', JSON.stringify(r.data?.[0]?.lastMessage));

    console.log('● DM: reações, edição e busca');
    r = await call('POST', `/dms/messages/${dm1.id}/reactions/${encodeURIComponent('❤️')}`, null, tB);
    check('reação na DM', r.status === 201 && r.data?.added === true);
    r = await call('POST', `/dms/messages/${dm1.id}/reactions/${encodeURIComponent('😈')}`, null, tC);
    check('quem não é da conversa não reage', r.status === 404);
    r = await call('GET', `/dms/${A.id}/messages`, null, tB);
    check('reação aparece na mensagem', r.data?.find(m => m.id === dm1.id)?.reactions?.some(x => x.emoji === '❤️' && x.userId === B.id));
    r = await call('PUT', `/dms/messages/${dm1.id}`, { content: 'hackeado' }, tB);
    check('não edita DM dos outros', r.status === 403);
    r = await call('PUT', `/dms/messages/${dm1.id}`, { content: '' }, tA);
    check('edição vazia é recusada', r.status === 400);
    r = await call('GET', `/dms/${B.id}/search?q=a`, null, tA);
    check('busca exige 2 letras', r.status === 400);
    r = await call('GET', `/dms/${B.id}/search?q=PALAVRA-secreta`, null, tA);
    check('busca acha a mensagem (sem diferenciar maiúsculas)', r.status === 200 && r.data.length === 1 && r.data[0].id === dm1.id);
    r = await call('GET', `/dms/${B.id}/search?q=palavra-secreta`, null, tC);
    check('busca de outra pessoa não vê a conversa', r.status === 200 && r.data.length === 0);

    console.log('● Chamada 1:1');
    const sA = await socket(tA), sB = await socket(tB), sC = await socket(tC);
    socks.push(sA, sB, sC);
    r = await call('POST', `/dms/${B.id}/call`, null, tA);
    const sala = 'dm-' + [A.id, B.id].sort().join('-');
    check('ligar devolve a sala da dupla', r.status === 201 && r.data?.roomName === sala && !!r.data?.token);
    await sleep(700);
    check('o outro recebe o toque', !!sB.got('dm:call:ring', d => d.from?.id === A.id));
    check('ninguém mais recebe o toque', !sC.got('dm:call:ring'));
    r = await call('POST', `/dms/${A.id}/call/accept`, null, tB);
    check('atender entra na mesma sala', r.status === 201 && r.data?.roomName === sala);
    await sleep(500);
    check('quem ligou fica sabendo', !!sA.got('dm:call:accepted', d => d.by === B.id));
    const payload = JSON.parse(Buffer.from(r.data.token.split('.')[1], 'base64url').toString());
    check('token só vale para a sala da dupla', payload.video?.room === sala && payload.sub === B.id);
    r = await call('POST', `/dms/${A.id}/call/end`, { reason: 'ended' }, tB);
    await sleep(500);
    check('desligar avisa o outro', r.status === 201 && !!sA.got('dm:call:ended', d => d.from === B.id));
    r = await call('POST', `/dms/${A.id}/call`, null, tA);
    check('não liga para si mesmo', r.status === 400);

    console.log('● Servidor: busca, silenciar, voz e "Jogando"');
    r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];
    await call('POST', `/channels/${ch.id}/messages`, { content: 'combinado o churrasco no sábado' }, tA);
    r = await call('GET', `/servers/${serverId}/search?q=CHURRASCO`, null, tB);
    check('busca no servidor acha', r.status === 200 && r.data.length === 1 && r.data[0].channel?.id === ch.id);
    r = await call('GET', `/servers/${serverId}/search?q=churrasco`, null, tC);
    check('quem não é do servidor não busca', r.status === 403);
    r = await call('PUT', '/notifications/mutes', { serverId, muted: true }, tB);
    check('silenciar servidor', r.status === 200 && r.data?.muted === true);
    r = await call('PUT', '/notifications/mutes', { channelId: ch.id, muted: true }, tB);
    check('silenciar canal', r.status === 200);
    r = await call('GET', '/notifications/mutes', null, tB);
    check('lista de silenciados', r.status === 200 && r.data.length === 2);
    r = await call('PUT', '/notifications/mutes', { serverId, muted: false }, tB);
    r = await call('GET', '/notifications/mutes', null, tB);
    check('tirar do silencioso', r.data.length === 1 && r.data[0].channelId === ch.id);
    r = await call('PUT', '/notifications/mutes', { serverId, channelId: ch.id }, tB);
    check('pedido ambíguo é recusado', r.status === 400);
    r = await call('PUT', '/notifications/mutes', { serverId, muted: true }, tC);
    check('não silencia servidor dos outros', r.status === 403);

    const roles = (await call('GET', `/servers/${serverId}/roles`, null, tA)).data;
    const everyone = roles.find(x => x.isDefault);
    await call('PATCH', `/servers/${serverId}/roles/${everyone.id}`, { permissions: ['send_messages', 'attach_files', 'speak', 'video'] }, tA);
    const voz = () => arquivo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]), 'audio/webm', 'voz.webm');
    r = await call('POST', `/upload/attachment/${ch.id}`, voz(), tB, true);
    check('sem "Mensagens de voz" o áudio é recusado', r.status === 403);
    await call('PATCH', `/servers/${serverId}/roles/${everyone.id}`, { permissions: ['send_messages', 'send_voice_messages'] }, tA);
    r = await call('POST', `/upload/attachment/${ch.id}`, voz(), tB, true);
    check('com "Mensagens de voz" (mesmo sem anexos) o áudio vai', r.status === 201 && r.data?.attachments?.[0]?.mimeType === 'audio/webm', JSON.stringify(r.data));
    if (r.data?.attachments?.[0]) enviados.push(r.data.attachments[0].url);

    sA.emit('server:join', { serverId });
    sB.emit('server:join', { serverId });
    await sleep(500);
    sB.emit('user:activity', { name: 'Minecraft<script>' });
    await sleep(700);
    const ev = sA.got('user:activity_changed', d => d.userId === B.id);
    check('"Jogando" chega ao vivo e sem HTML', !!ev && ev[1].activity === 'Minecraftscript', JSON.stringify(ev));
    r = await call('GET', `/servers/${serverId}/members`, null, tA);
    check('"Jogando" aparece na lista de membros', r.data?.find(m => m.userId === B.id)?.activity === 'Minecraftscript');
    sB.emit('user:activity', { name: null });
    await sleep(500);
    check('parar de jogar limpa o status', !!sA.got('user:activity_changed', d => d.userId === B.id && d.activity === null));

    sB.clear();
    sB.emit('message:pin', { messageId: (await prisma.message.findFirst({ where: { channelId: ch.id } })).id, pinned: true });
    await sleep(600);
    const exc = sB.got('exception');
    check('recusa pelo tempo real explica o motivo', exc && /fixar/.test(exc[1]?.message || ''), JSON.stringify(exc));

    console.log('● GIFs');
    r = await call('GET', '/gifs/status', null, tA);
    check('status dos GIFs responde', r.status === 200 && typeof r.data?.enabled === 'boolean');
    if (!r.data?.enabled) {
      r = await call('GET', '/gifs/search?q=gato', null, tA);
      check('sem chave, busca avisa que não está configurado', r.status === 503);
    } else {
      r = await call('GET', '/gifs/search?q=gato', null, tA);
      check('busca de GIFs devolve links do GIPHY', r.status === 200 && r.data.every(g => g.url.startsWith('https://')));
    }
    r = await call('GET', '/gifs/status', null, null);
    check('GIFs exigem login', r.status === 401);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.stack || e.message);
  } finally {
    socks.forEach(s => s.close());
    // Apaga os arquivos enviados no armazenamento
    try {
      const s3 = new AWS.S3({ endpoint: process.env.S3_ENDPOINT, accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY, region: process.env.S3_REGION || 'us-east-1', s3ForcePathStyle: true, signatureVersion: 'v4' });
      const base = (process.env.S3_PUBLIC_URL || '') + '/';
      let n = 0;
      for (const url of enviados) {
        if (!url.startsWith(base)) continue;
        await s3.deleteObject({ Bucket: process.env.S3_BUCKET || 'nexus-uploads', Key: url.slice(base.length) }).promise().then(() => n++).catch(e => console.log('limpeza arquivo:', e.message));
      }
      console.log(`  (arquivos de teste apagados: ${n}/${enviados.length})`);
    } catch (e) { console.log('limpeza arquivos:', e.message); }
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [A, B, C, D]) {
      await prisma.directMessage.deleteMany({ where: { OR: [{ senderId: u.id }, { receiverId: u.id }] } }).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas, servidor e arquivos de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
