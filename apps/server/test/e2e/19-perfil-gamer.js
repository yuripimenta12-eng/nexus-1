// Teste de ponta a ponta do perfil gamer e dos benefícios dos planos: jogos,
// conexões, em comum, jogando agora, cor no nome, moldura do plano, foto
// animada, arquivos maiores e o que sai quando o plano acaba. Apaga tudo no final.
// Roda DENTRO do container de teste (porta 3005).
const HOST = process.env.E2E_HOST || '127.0.0.1:3005';
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const WS = require('ws');
const AWS = require('aws-sdk');
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


// O banco (jsonb) devolve as chaves em outra ordem: compara o conteúdo
const igual = (a, b) => { try { require('assert').deepStrictEqual(a, b); return true; } catch { return false; } };
const enviados = [];
const arquivo = (conteudo, tipo, nome) => { const f = new FormData(); f.append('file', new Blob([conteudo], { type: tipo }), nome); return f; };
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

(async () => {
  await sleep(30000);
  const A = await criarUsuario('dono');     // admin que dá os planos
  const U = await criarUsuario('gamer');    // dono do perfil
  const V = await criarUsuario('visita');   // quem olha
  const W = await criarUsuario('amigo');    // amigo dos dois
  await prisma.user.update({ where: { id: A.id }, data: { isAdmin: true } });
  let serverId = null;
  try {
    const ta = await entrar(A), t = await entrar(U), tv = await entrar(V);

    console.log('● Jogos e conexões');
    let r = await call('PATCH', '/users/@me/profile', {
      jogos: [{ jogo: 'Valorant', rank: 'Ouro 2', nick: 'kanjin#777' }, { jogo: '<b>x</b>' }, { jogo: 'CS2', rank: 'Premier 12.400' }],
      conexoes: { twitch: '@kanjin', instagram: 'site.com/x', riot: 'kanjin #777' },
      procurandoDuo: true,
    }, t);
    check('salva jogos, conexões e "procurando duo"', r.status === 200, `status ${r.status} ${JSON.stringify(r.data)}`);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    const p = r.data?.profile || {};
    check('os outros veem os jogos (sem o inválido)', igual(p.jogos, [{ jogo: 'Valorant', rank: 'Ouro 2', nick: 'kanjin#777' }, { jogo: 'CS2', rank: 'Premier 12.400' }]), JSON.stringify(p.jogos));
    check('conexões limpas (sem link estranho)', igual(p.conexoes, { twitch: 'kanjin', riot: 'kanjin #777' }), JSON.stringify(p.conexoes));
    check('"procurando duo" aparece', p.procurandoDuo === true);
    check('números vêm junto', !!r.data?.numeros && typeof r.data.numeros.horasCall === 'number' && typeof r.data.numeros.vitoriasUnidos === 'number');
    r = await call('PATCH', '/users/@me/profile', { jogos: 'Valorant' }, t);
    check('jogos que não são lista são recusados', r.status === 400, `status ${r.status}`);
    r = await call('PATCH', '/users/@me/profile', { jogos: null, conexoes: null }, t);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    check('null apaga jogos e conexões', r.data?.profile?.jogos === null && r.data?.profile?.conexoes === null);

    console.log('● Em comum');
    r = await call('POST', '/servers', { name: `Perfil ${rnd}` }, t);
    serverId = r.data?.id;
    await prisma.serverMember.create({ data: { serverId, userId: V.id } });
    await prisma.friendship.createMany({ data: [
      { requesterId: U.id, addresseeId: W.id, status: 'ACCEPTED' },
      { requesterId: W.id, addresseeId: V.id, status: 'ACCEPTED' },
    ] });
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    check('mostra o servidor em comum', r.data?.emComum?.servidores?.length === 1 && r.data.emComum.servidores[0].id === serverId, JSON.stringify(r.data?.emComum));
    check('conta 1 amigo em comum', r.data?.emComum?.amigos === 1);
    r = await call('GET', `/users/${U.id}/profile`, null, t);
    check('no próprio perfil não tem "em comum"', r.status === 200 && r.data?.emComum === null);

    console.log('● Jogando agora');
    const sU = await socket(t);
    sU.emit('user:activity', { name: 'VALORANT' });
    await sleep(600);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    const desde1 = r.data?.jogando?.desde;
    check('mostra o jogo e desde quando', r.data?.jogando?.nome === 'VALORANT' && desde1 > Date.now() - 60000, JSON.stringify(r.data?.jogando));
    sU.emit('user:activity', { name: 'VALORANT' });
    await sleep(600);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    check('mesmo jogo continua contando do início', r.data?.jogando?.desde === desde1);
    sU.emit('user:activity', { name: null });
    await sleep(600);
    r = await call('GET', `/users/${U.id}/profile`, null, tv);
    check('fechou o jogo: some', r.data?.jogando === null);
    sU.close();

    console.log('● Cor no nome e moldura do plano');
    r = await call('PATCH', '/users/@me/profile', { corNome: '#ff6a00,#7a2cff' }, t);
    check('grátis não põe cor no nome', r.status === 403, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-mais' }, t);
    check('grátis não usa a moldura do Nexus+', r.status === 403, `status ${r.status}`);
    r = await call('POST', `/admin/users/${U.id}/plano`, { plano: 'mais', dias: 1 }, ta);
    check('dono dá o Nexus+', r.status === 200 || r.status === 201, `status ${r.status}`);
    r = await call('PATCH', '/users/@me/profile', { corNome: '#FF6A00,#7A2CFF' }, t);
    check('Nexus+ põe cor no nome', r.status === 200 && r.data?.corNome === '#ff6a00,#7a2cff', JSON.stringify(r.data?.corNome));
    r = await call('PATCH', '/users/@me/profile', { corNome: 'red;background:url(x)' }, t);
    check('cor que não é cor é recusada', r.status === 400, `status ${r.status}`);
    r = await call('GET', '/loja', null, t);
    check('na loja a moldura do plano já é dele', r.data?.itens?.find(i => i.id === 'm-mais')?.possui === true && r.data.itens.find(i => i.id === 'm-pro')?.possui === false);
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-mais' }, t);
    check('Nexus+ usa a moldura do Nexus+', r.status === 200, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-pro' }, t);
    check('Nexus+ não usa a do Pro', r.status === 403, `status ${r.status}`);
    r = await call('POST', '/loja/comprar/m-pro', null, t);
    check('moldura do plano não se compra', r.status === 400, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'efeito', itemId: 'e-pro' }, t);
    check('Nexus+ não usa o efeito do Pro', r.status === 403, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'efeito', itemId: 'm-mais' }, t);
    check('moldura não entra no lugar do efeito', r.status === 400, `status ${r.status}`);
    r = await call('PUT', '/loja/equipar', { tipo: 'moldura', itemId: 'm-staff' }, t);
    check('quem não é da equipe não usa a moldura Staff', r.status === 403, `status ${r.status}`);
    r = await call('GET', '/loja', null, t);
    check('moldura Staff não aparece na loja de quem não é da equipe', Array.isArray(r.data?.itens) && !r.data.itens.some(i => i.soStaff), `status ${r.status}`);

    console.log('● Foto animada');
    r = await call('POST', '/upload/avatar', arquivo(GIF, 'image/gif', 'a.gif'), t, true);
    if (r.data?.avatarUrl) enviados.push(r.data.avatarUrl, r.data.avatarUrl.replace(/-anim\.gif$/, '-anim-estatico.webp'));
    check('com plano o GIF continua GIF', r.status === 201 && /-anim\.gif$/.test(r.data?.avatarUrl || ''), JSON.stringify(r.data));
    r = await call('POST', '/upload/avatar', arquivo(GIF, 'image/gif', 'b.gif'), tv, true);
    if (r.data?.avatarUrl) enviados.push(r.data.avatarUrl);
    check('no grátis o GIF vira imagem parada', r.status === 201 && /\.webp$/.test(r.data?.avatarUrl || ''), JSON.stringify(r.data));

    console.log('● Arquivos maiores');
    const ch = (await prisma.channel.findMany({ where: { serverId }, orderBy: { createdAt: 'asc' } }))[0];
    const grande = Buffer.alloc(51 * 1024 * 1024, 97);
    r = await call('POST', `/upload/attachment/${ch.id}`, arquivo(grande, 'text/plain', 'grande.txt'), tv, true);
    check('grátis não manda arquivo de 51 MB', r.status === 400 && /Nexus\+/.test(r.data?.message || ''), `status ${r.status} ${r.data?.message}`);
    r = await call('POST', `/upload/attachment/${ch.id}`, arquivo(grande, 'text/plain', 'grande.txt'), t, true);
    for (const a of r.data?.attachments || []) enviados.push(a.url);
    check('Nexus+ manda arquivo de 51 MB', r.status === 201, `status ${r.status} ${r.data?.message}`);

    console.log('● Plano acabou');
    await prisma.profile.update({ where: { userId: U.id }, data: { efeitoPerfil: 'e-pro' } });
    r = await call('POST', `/admin/users/${U.id}/plano`, { plano: 'gratis' }, ta);
    const perfil = await prisma.profile.findUnique({ where: { userId: U.id } });
    check('sai a cor do nome', perfil.corNome === null);
    check('sai a moldura do plano', perfil.moldura === null);
    check('sai o efeito do plano', perfil.efeitoPerfil === null);
    check('foto animada vira a cópia parada', /-anim-estatico\.webp$/.test(perfil.avatarUrl || ''), perfil.avatarUrl);
  } catch (e) {
    falhas++; console.log('ERRO no teste:', e.message);
  } finally {
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
    for (const u of [A, U, V, W]) await prisma.user.delete({ where: { id: u.id } }).catch(e => console.log('limpeza:', e.message));
    console.log(`\nResultado: ${ok} ok, ${falhas} falha(s). Contas, servidor e arquivos de teste apagados.`);
    await prisma.$disconnect();
    process.exit(falhas ? 1 : 0);
  }
})();
