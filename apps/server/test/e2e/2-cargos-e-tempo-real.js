// Teste de ponta a ponta da etapa 2 (cargos de verdade + tempo real protegido).
// Roda DENTRO do container de teste (porta 3005). Cria contas e um servidor
// temporários direto no banco/API e apaga tudo no final.
// Servidor testado: E2E_HOST (padrão: container de teste na porta 3005)
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
function socket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WS(`ws://${HOST}/socket.io/?EIO=4&transport=websocket`, { headers: { Origin: ORIGIN } });
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
  const A = await criarUsuario('dono');
  const B = await criarUsuario('membro');
  const C = await criarUsuario('intruso');
  let serverId = null;
  const socks = [];
  try {
    const tA = await entrar(A), tB = await entrar(B), tC = await entrar(C);

    // Servidor de teste: A é dono, B é membro comum, C não participa
    let r = await call('POST', '/servers', { name: `Teste ${rnd}` }, tA);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: B.id } });
    const canais = await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } });
    const ch = canais[0];
    const outro = await prisma.channel.create({ data: { serverId, name: 'outro-teste', position: 99 } });
    const sala = await prisma.voiceRoom.findFirst({ where: { serverId } })
      || await prisma.voiceRoom.create({ data: { serverId, name: 'Sala teste', livekitRoom: `teste-${rnd}` } });

    r = await call('GET', `/servers/${serverId}/roles`, null, tA);
    const everyone = (r.data || []).find(x => x.isDefault);
    const setEveryone = (perms) => call('PATCH', `/servers/${serverId}/roles/${everyone.id}`, { permissions: perms }, tA);
    const BASE = ['change_nickname', 'send_messages', 'attach_files', 'add_reactions', 'send_voice_messages', 'speak', 'video'];

    console.log('● Permissões efetivas');
    r = await call('GET', `/servers/${serverId}/roles/@me`, null, tA);
    check('dono tem todas', r.status === 200 && r.data.permissions.includes('administrator') && r.data.permissions.includes('pin_messages'));
    r = await call('GET', `/servers/${serverId}/roles/@me`, null, tB);
    check('membro comum NÃO cria convite nem fixa', r.status === 200 && !r.data.permissions.includes('create_invite') && !r.data.permissions.includes('pin_messages') && r.data.permissions.includes('send_messages'), JSON.stringify(r.data));
    r = await call('GET', `/servers/${serverId}/roles/@me`, null, tC);
    check('quem não é do servidor é recusado', r.status === 403);

    console.log('● Convites e canais pelo cargo');
    r = await call('POST', `/invites/servers/${serverId}`, { expiresInHours: 1 }, tB);
    check('membro comum não cria convite', r.status === 403);
    r = await call('POST', `/servers/${serverId}/channels`, { name: 'hack', type: 'TEXT' }, tB);
    check('membro comum não cria canal', r.status === 403);
    r = await call('POST', `/servers/${serverId}/roles`, { name: 'Ajudante' }, tA);
    const ajudante = r.data;
    await call('PATCH', `/servers/${serverId}/roles/${ajudante.id}`, { permissions: ['create_invite', 'manage_channels', 'pin_messages', 'inventada_xyz'] }, tA);
    r = await call('PUT', `/servers/${serverId}/roles/${ajudante.id}/members/${B.id}`, null, tA);
    const roleDb = await prisma.role.findUnique({ where: { id: ajudante.id } });
    check('permissão inventada é descartada', !roleDb.permissions.includes('inventada_xyz') && roleDb.permissions.includes('create_invite'));
    r = await call('POST', `/invites/servers/${serverId}`, { expiresInHours: 1 }, tB);
    check('com o cargo "Ajudante" cria convite', r.status === 201 || r.status === 200, String(r.status));
    r = await call('POST', `/servers/${serverId}/channels`, { name: 'do-ajudante', type: 'TEXT' }, tB);
    check('com o cargo cria canal', r.status === 201 || r.status === 200, JSON.stringify(r.data));
    await call('DELETE', `/servers/${serverId}/roles/${ajudante.id}/members/${B.id}`, null, tA);

    console.log('● Mensagens');
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'oi do membro' }, tB);
    check('membro envia mensagem', r.status === 201, JSON.stringify(r.data));
    const msgB = r.data;
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'oi do dono' }, tA);
    const msgA = r.data;
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'oi' }, tC);
    check('intruso não envia', r.status === 403);
    await setEveryone(BASE.filter(p => p !== 'send_messages'));
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'sem permissão' }, tB);
    check('sem "Enviar mensagens" é recusado', r.status === 403);
    await setEveryone(BASE);
    const msgOutro = await prisma.message.create({ data: { channelId: outro.id, authorId: A.id, content: 'em outro canal' } });
    r = await call('POST', `/channels/${ch.id}/messages`, { content: 'resposta', replyToId: msgOutro.id }, tB);
    check('não responde mensagem de outro canal', r.status === 400);
    r = await call('DELETE', `/channels/${ch.id}/messages/${msgA.id}`, null, tB);
    check('membro não apaga mensagem do dono', r.status === 403);
    r = await call('DELETE', `/channels/${ch.id}/messages/${msgB.id}`, null, tA);
    check('dono apaga mensagem do membro', r.status === 204);

    console.log('● Reações');
    r = await call('POST', `/channels/${ch.id}/messages/${msgA.id}/reactions/${encodeURIComponent('👍')}`, null, tC);
    check('intruso não reage', r.status === 403);
    r = await call('POST', `/channels/${ch.id}/messages/${msgA.id}/reactions/${encodeURIComponent('👍')}`, null, tB);
    check('membro reage', r.status === 201 && r.data?.channelId === ch.id);
    await setEveryone(BASE.filter(p => p !== 'add_reactions'));
    r = await call('POST', `/channels/${ch.id}/messages/${msgA.id}/reactions/${encodeURIComponent('🔥')}`, null, tB);
    check('sem "Adicionar reações" é recusado', r.status === 403);
    await setEveryone(BASE);

    console.log('● Apelido e anexos');
    r = await call('PATCH', `/servers/${serverId}/members/me`, { nickname: 'Apelido' }, tB);
    check('membro troca apelido', r.status === 200);
    await setEveryone(BASE.filter(p => p !== 'change_nickname'));
    r = await call('PATCH', `/servers/${serverId}/members/me`, { nickname: 'Outro' }, tB);
    check('sem "Alterar apelido" é recusado', r.status === 403);
    await setEveryone(BASE.filter(p => p !== 'attach_files'));
    const fd = () => { const f = new FormData(); f.append('file', new Blob(['ola'], { type: 'text/plain' }), 'teste.txt'); return f; };
    r = await call('POST', `/upload/attachment/${ch.id}`, fd(), tB, true);
    check('sem "Anexar arquivos" é recusado', r.status === 403);
    await setEveryone(BASE);
    const f2 = fd(); f2.append('messageId', msgA.id);
    r = await call('POST', `/upload/attachment/${ch.id}`, f2, tB, true);
    check('não anexa arquivo na mensagem de outra pessoa', r.status === 400);
    r = await call('POST', `/upload/attachment/${ch.id}`, fd(), tC, true);
    check('intruso não envia anexo', r.status === 403);

    console.log('● Tempo real protegido');
    const sA = await socket(tA), sB = await socket(tB), sC = await socket(tC);
    socks.push(sA, sB, sC);
    sA.emit('channel:join', { channelId: ch.id });
    sB.emit('channel:join', { channelId: ch.id });
    sC.emit('channel:join', { channelId: ch.id });
    sC.emit('server:join', { serverId });
    await sleep(700);
    sA.emit('message:send', { channelId: ch.id, content: 'tempo real ' + rnd });
    await sleep(1200);
    check('membro recebe a mensagem ao vivo', sB.got('message:new', d => d.content === 'tempo real ' + rnd));
    check('intruso NÃO recebe mensagem do canal', !sC.got('message:new'));
    check('intruso NÃO recebe atividade do servidor', !sC.got('channel:activity'));
    sC.emit('typing:start', { channelId: ch.id });
    sC.emit('reaction:add', { messageId: msgA.id, channelId: ch.id, emoji: '😈' });
    await sleep(800);
    check('intruso não digita nem reage no canal', !sA.got('typing:update', d => d.userId === C.id) && !sA.got('reaction:added', d => d.emoji === '😈'));
    sB.emit('message:send', { channelId: ch.id, content: 'x'.repeat(5000) });
    await sleep(800);
    check('mensagem gigante pelo socket é recusada', sB.got('exception') && !(await prisma.message.findFirst({ where: { channelId: ch.id, content: { startsWith: 'xxxxx' } } })));
    sB.clear();
    sB.emit('message:pin', { messageId: msgA.id, pinned: true });
    await sleep(800);
    check('membro comum não fixa', sB.got('exception') && !(await prisma.message.findUnique({ where: { id: msgA.id } })).pinned);
    sB.clear();
    sA.emit('message:pin', { messageId: msgA.id, pinned: true });
    await sleep(800);
    check('dono fixa e todos veem na hora', sB.got('message:pinned', d => d.messageId === msgA.id && d.pinned === true));
    r = await call('GET', `/channels/${ch.id}/messages/pinned`, null, tB);
    check('lista de fixadas mostra a mensagem', r.status === 200 && r.data.length === 1 && r.data[0].id === msgA.id);
    r = await call('GET', `/channels/${ch.id}/messages/pinned`, null, tC);
    check('intruso não vê as fixadas', r.status === 403);
    sC.emit('voice:join', { voiceRoomId: sala.id, serverId });
    await sleep(600);
    check('intruso não entra na sala de voz', sC.got('error') && !sA.got('voice:user_joined', d => d.userId === C.id));

    console.log('● Voz pelo cargo');
    const sources = async (tok) => {
      const j = await call('POST', `/voice/rooms/${sala.id}/join`, null, tok);
      if (j.status !== 201 && j.status !== 200) return { status: j.status };
      const payload = JSON.parse(Buffer.from(j.data.token.split('.')[1], 'base64url').toString());
      await call('POST', `/voice/rooms/${sala.id}/leave`, null, tok);
      return { status: j.status, src: (payload.video?.canPublishSources || []).map(String), canPublish: payload.video?.canPublish, perms: j.data.permissions };
    };
    let v = await sources(tB);
    check('membro pode falar e transmitir', v.perms?.speak === true && v.perms?.video === true && v.src.length === 4, JSON.stringify(v));
    await setEveryone(BASE.filter(p => p !== 'speak' && p !== 'video'));
    v = await sources(tB);
    check('sem "Falar" e "Vídeo" entra só ouvindo', v.perms?.speak === false && v.perms?.video === false && v.canPublish === false, JSON.stringify(v));
    await setEveryone(BASE.filter(p => p !== 'video'));
    v = await sources(tB);
    check('com "Falar" e sem "Vídeo" só o microfone', v.perms?.speak === true && v.perms?.video === false && v.src.length === 1, JSON.stringify(v));
    await setEveryone(BASE);
    v = await sources(tC);
    check('intruso não pega token de voz', v.status === 403);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
    socks.forEach(s => s.close());
    if (serverId) await prisma.server.delete({ where: { id: serverId } }).catch(e => console.log('limpeza servidor:', e.message));
    for (const u of [A, B, C]) {
      await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    }
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas e servidor de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
