// DJ Nexus — bot de música para as salas de voz do Nexus.
//
// Como funciona:
//  • Quem está numa call clica em "DJ" → o site chama POST /summon com o
//    token LiveKit do usuário (prova que ele pode estar naquela sala).
//  • O bot entra na sala como participante "DJ Nexus" e publica uma faixa de
//    áudio (PCM 48 kHz estéreo) gerada por: yt-dlp (YouTube) → ffmpeg → LiveKit.
//  • Comandos (tocar, pular, pausar, parar, remover, sair) chegam por HTTP
//    (mesma autenticação) e o estado da fila é transmitido a todos na sala por
//    mensagens de dados do LiveKit (tópico "dj-state"), em tempo real.
//  • Sai sozinho quando fica 3 min sem música ou 1 min sem ninguém na sala.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  Room, RoomEvent, AudioSource, AudioFrame, LocalAudioTrack,
  TrackPublishOptions, TrackSource, dispose,
} from '@livekit/rtc-node';
import { AccessToken, TokenVerifier } from 'livekit-server-sdk';

const PORT = Number(process.env.PORT || 4100);
const BIND = process.env.BIND || '127.0.0.1';
const LK_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';
const API_KEY = process.env.LIVEKIT_API_KEY || '';
const API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export const DJ_IDENTITY = 'dj-nexus';
const DJ_NAME = 'DJ Nexus';
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_MS = 20;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_MS) / 1000;      // 960 por canal
const FRAME_BYTES = SAMPLES_PER_FRAME * CHANNELS * 2;           // 3840 bytes (int16)
const IDLE_LEAVE_MS = 3 * 60 * 1000;
const ALONE_LEAVE_MS = 60 * 1000;
const MAX_QUEUE = 50;
const MAX_DURATION_S = 3 * 3600;
const YT_COOKIES = process.env.YT_COOKIES || '/data/yt-cookies.txt';
const YTDLP_COMMON = ['--no-playlist', '--no-warnings', '--js-runtimes', 'node'];
// IPs de datacenter costumam ser barrados pelo YouTube ("Sign in to confirm you're not a bot").
// Quando isso acontece, evitamos o YouTube por um tempo e caímos no SoundCloud.
const YT_BLOCK_COOLDOWN_MS = 30 * 60 * 1000;
let ytBlockedUntil = 0;

if (!API_KEY || !API_SECRET) {
  console.error('[dj] LIVEKIT_API_KEY / LIVEKIT_API_SECRET ausentes');
  process.exit(1);
}
const verifier = new TokenVerifier(API_KEY, API_SECRET);
const log = (...a) => console.log(new Date().toISOString(), '[dj]', ...a);

// ─────────────────────────────────────────────────────────────────────────────
// Resolução de músicas (yt-dlp)
// ─────────────────────────────────────────────────────────────────────────────
function run(cmd, args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('tempo esgotado')); }, timeoutMs);
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', e => { clearTimeout(t); reject(e); });
    p.on('close', code => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error((err || `saiu com código ${code}`).trim().split('\n').pop()));
    });
  });
}

const isUrl = (s) => /^https?:\/\//i.test(s);
const isYouTube = (s) => /(youtube\.com|youtu\.be)\//i.test(s);
const isYtBlockedError = (e) => /sign in to confirm|not a bot/i.test(e?.message || '');
const ytArgs = () => (existsSync(YT_COOKIES) ? ['--cookies', YT_COOKIES] : []);

// Pergunta ao yt-dlp os metadados de um alvo (URL ou "ytsearch1:..." / "scsearch1:...")
async function probe(target, extra = []) {
  const out = await run('yt-dlp', [
    ...YTDLP_COMMON, ...extra,
    '--print', '%(title)s\t%(duration)s\t%(webpage_url)s\t%(thumbnail)s\t%(uploader)s\t%(is_live)s\t%(extractor_key)s',
    target,
  ], { timeoutMs: 40000 });
  const line = out.trim().split('\n')[0] || '';
  const [title, duration, url, thumbnail, uploader, isLive, extractor] = line.split('\t');
  if (!url) throw new Error('Não encontrei essa música.');
  if (isLive === 'True') throw new Error('Transmissões ao vivo não são suportadas.');
  const dur = Number(duration) || 0;
  if (dur > MAX_DURATION_S) throw new Error('Música longa demais (máximo 3 horas).');
  const na = (v) => (!v || v === 'NA' ? '' : v);
  const source = /youtube/i.test(extractor || '') ? 'youtube' : /soundcloud/i.test(extractor || '') ? 'soundcloud' : 'outro';
  return { title: title || 'Sem título', duration: dur, url, thumbnail: na(thumbnail) || null, uploader: na(uploader), source };
}

// Título de um vídeo do YouTube pelo oEmbed (endpoint público, sem a checagem de robô)
async function youtubeTitle(url) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.title || null;
  } catch { return null; }
}

// Limpa o título para virar uma busca: "(Official Video)", "[Clipe Oficial]", "| Lyric" etc.
const cleanTitle = (t) => t
  .replace(/[([][^)\]]*(official|oficial|video|vídeo|clipe|lyric|letra|audio|áudio|hd|4k|remaster)[^)\]]*[)\]]/gi, '')
  .replace(/\s*[|•].*$/, '')
  .replace(/\s+/g, ' ')
  .trim();

async function resolveTrack(query) {
  const q = query.trim();
  if (!q) throw new Error('Cole um link do YouTube ou o nome da música.');

  // Link de outra fonte (SoundCloud, Bandcamp, mp3 direto...): yt-dlp resolve direto
  if (isUrl(q) && !isYouTube(q)) return probe(q);

  // Link do YouTube ou nome: tenta o YouTube (se não estiver em quarentena)
  if (Date.now() > ytBlockedUntil) {
    try {
      return await probe(isUrl(q) ? q : `ytsearch1:${q}`, ytArgs());
    } catch (e) {
      if (!isYtBlockedError(e)) throw e;
      ytBlockedUntil = Date.now() + YT_BLOCK_COOLDOWN_MS;
      log('YouTube bloqueou este IP; usando SoundCloud por 30 min');
    }
  }
  // Alternativa: a mesma música no SoundCloud (pelo título do vídeo ou pelo texto digitado)
  let termo = q;
  if (isUrl(q)) {
    const t = await youtubeTitle(q);
    if (!t) throw new Error('O YouTube bloqueou o servidor e não consegui ler o título do vídeo. Tente digitar o nome da música.');
    termo = cleanTitle(t) || t;
  }
  const item = await probe(`scsearch1:${termo}`);
  item.fallback = true;
  return item;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessão por sala
// ─────────────────────────────────────────────────────────────────────────────
const sessions = new Map();

class Session {
  constructor(roomName) {
    this.roomName = roomName;
    this.room = null;
    this.source = null;
    this.queue = [];
    this.current = null;
    this.paused = false;
    this.pauseWaiters = [];
    this.procs = [];
    this.positionSec = 0;
    this.skipRequested = false;
    this.version = 0;
    this.idleTimer = null;
    this.aloneTimer = null;
    this.tickTimer = null;
    this.connecting = null;
    this.closed = false;
    this.lastError = null;
  }

  // ── Conexão ──
  async connect() {
    if (this.room) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const at = new AccessToken(API_KEY, API_SECRET, { identity: DJ_IDENTITY, name: DJ_NAME, ttl: '12h' });
      at.addGrant({
        room: this.roomName, roomJoin: true, canPublish: true, canSubscribe: false, canPublishData: true,
        canPublishSources: [TrackSource.SOURCE_MICROPHONE],
      });
      const room = new Room();
      room.on(RoomEvent.ParticipantConnected, () => { this.clearAlone(); this.broadcast(); });
      room.on(RoomEvent.ParticipantDisconnected, () => this.checkAlone());
      room.on(RoomEvent.Disconnected, (reason) => { log(this.roomName, 'desconectado', reason); this.teardown(); });
      await room.connect(LK_URL, await at.toJwt(), { autoSubscribe: false, dynacast: false });
      this.room = room;
      this.source = new AudioSource(SAMPLE_RATE, CHANNELS, 1000);
      const track = LocalAudioTrack.createAudioTrack('musica', this.source);
      const opts = new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE, dtx: false, red: false });
      await room.localParticipant.publishTrack(track, opts);
      log(this.roomName, 'entrou na sala');
      this.armIdle();
      this.checkAlone();
      this.broadcast();
    })();
    try { await this.connecting; } finally { this.connecting = null; }
  }

  humans() {
    if (!this.room) return 0;
    let n = 0;
    for (const p of this.room.remoteParticipants.values()) if (p.identity !== DJ_IDENTITY) n++;
    return n;
  }

  checkAlone() {
    if (this.humans() > 0) return this.clearAlone();
    if (!this.aloneTimer) {
      this.aloneTimer = setTimeout(() => { log(this.roomName, 'sala vazia, saindo'); this.leave(); }, ALONE_LEAVE_MS);
    }
  }
  clearAlone() { if (this.aloneTimer) { clearTimeout(this.aloneTimer); this.aloneTimer = null; } }
  armIdle() {
    this.clearIdle();
    this.idleTimer = setTimeout(() => {
      if (!this.current && this.queue.length === 0) { log(this.roomName, 'sem música há 3 min, saindo'); this.leave(); }
    }, IDLE_LEAVE_MS);
  }
  clearIdle() { if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; } }

  // ── Comandos ──
  async play(query, requestedBy) {
    if (this.queue.length >= MAX_QUEUE) throw new Error('Fila cheia (50 músicas).');
    const item = await resolveTrack(query);
    item.requestedBy = requestedBy;
    item.id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    this.queue.push(item);
    this.lastError = null;
    this.broadcast();
    if (!this.current) this.playNext();
    return item;
  }

  skip() {
    if (!this.current) return;
    this.skipRequested = true;
    this.killProcs();
    this.resume();
  }

  pause() {
    if (!this.current || this.paused) return;
    this.paused = true;
    this.broadcast();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    const w = this.pauseWaiters; this.pauseWaiters = [];
    w.forEach(r => r());
    this.broadcast();
  }

  stop() {
    this.queue = [];
    if (this.current) { this.skipRequested = true; this.killProcs(); this.resume(); }
    else this.broadcast();
  }

  remove(id) {
    const before = this.queue.length;
    this.queue = this.queue.filter(i => i.id !== id);
    if (this.queue.length !== before) this.broadcast();
  }

  async leave() {
    if (this.closed) return;
    this.closed = true;
    this.queue = [];
    this.skipRequested = true;
    this.killProcs();
    this.resume();
    try { await this.room?.disconnect(); } catch { /* já caiu */ }
    this.teardown();
  }

  teardown() {
    this.clearIdle(); this.clearAlone();
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
    this.killProcs();
    this.room = null; this.source = null; this.current = null;
    this.closed = true;
    sessions.delete(this.roomName);
  }

  killProcs() {
    for (const p of this.procs) { try { p.kill('SIGKILL'); } catch { /* já morreu */ } }
    this.procs = [];
  }

  // ── Reprodução ──
  async playNext() {
    if (this.closed) return;
    this.current = this.queue.shift() || null;
    this.positionSec = 0;
    this.paused = false;
    this.skipRequested = false;
    if (!this.current) { this.armIdle(); this.broadcast(); return; }
    this.clearIdle();
    this.broadcast();
    log(this.roomName, 'tocando:', this.current.title);
    try {
      await this.stream(this.current.url);
    } catch (e) {
      log(this.roomName, 'erro ao tocar:', e.message);
      this.lastError = `Não consegui tocar "${this.current.title}": ${e.message}`;
    }
    if (this.closed) return;
    this.playNext();
  }

  stream(url) {
    return new Promise((resolve, reject) => {
      const yt = spawn('yt-dlp', [...YTDLP_COMMON, ...(isYouTube(url) ? ytArgs() : []), '-q', '-f', 'bestaudio/best', '-o', '-', url],
        { stdio: ['ignore', 'pipe', 'pipe'] });
      const ff = spawn('ffmpeg', [
        '-v', 'error', '-i', 'pipe:0', '-vn',
        '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), 'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.procs = [yt, ff];
      let ytErr = '', ffErr = '';
      yt.stderr.on('data', d => { ytErr += d; });
      ff.stderr.on('data', d => { ffErr += d; });
      yt.stdout.pipe(ff.stdin);
      yt.stdout.on('error', () => {});
      ff.stdin.on('error', () => {});
      yt.on('error', reject);
      ff.on('error', reject);

      const source = this.source;
      let buf = Buffer.alloc(0);
      let frames = 0;
      const pump = async () => {
        try {
          for await (const chunk of ff.stdout) {
            if (this.skipRequested || this.closed) break;
            buf = buf.length ? Buffer.concat([buf, chunk]) : chunk;
            while (buf.length >= FRAME_BYTES) {
              if (this.skipRequested || this.closed) break;
              while (this.paused && !this.skipRequested && !this.closed) {
                await new Promise(r => this.pauseWaiters.push(r));
              }
              const slice = buf.subarray(0, FRAME_BYTES);
              buf = buf.subarray(FRAME_BYTES);
              const data = new Int16Array(slice.buffer.slice(slice.byteOffset, slice.byteOffset + FRAME_BYTES));
              await source.captureFrame(new AudioFrame(data, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME));
              frames++;
              this.positionSec = Math.floor((frames * FRAME_MS) / 1000);
            }
          }
        } catch (e) {
          if (!this.skipRequested && !this.closed) throw e;
        }
      };

      this.tickTimer && clearInterval(this.tickTimer);
      this.tickTimer = setInterval(() => this.broadcast(), 5000);

      pump().then(async () => {
        clearInterval(this.tickTimer); this.tickTimer = null;
        this.killProcs();
        if (this.skipRequested) { try { source.clearQueue(); } catch { /* ok */ } resolve(); return; }
        if (frames === 0) {
          const motivo = (ytErr || ffErr).trim().split('\n').pop() || 'sem áudio';
          reject(new Error(motivo.replace(/^ERROR:\s*/i, '').slice(0, 160)));
          return;
        }
        try { await source.waitForPlayout(); } catch { /* ok */ }
        resolve();
      }).catch(e => { this.killProcs(); reject(e); });
    });
  }

  // ── Estado ──
  state() {
    return {
      type: 'dj-state',
      version: ++this.version,
      connected: !!this.room,
      paused: this.paused,
      current: this.current ? { ...this.current, positionSec: this.positionSec } : null,
      queue: this.queue,
      error: this.lastError,
      listeners: this.humans(),
    };
  }

  broadcast() {
    if (!this.room?.localParticipant) return;
    const data = new TextEncoder().encode(JSON.stringify(this.state()));
    this.room.localParticipant.publishData(data, { reliable: true, topic: 'dj-state' }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP
// ─────────────────────────────────────────────────────────────────────────────
function cors(req, res) {
  const origin = req.headers.origin || '';
  if (ORIGINS.length === 0 || ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
  res.setHeader('Access-Control-Max-Age', '600');
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const c of req) { raw += c; if (raw.length > 20000) throw new Error('corpo grande demais'); }
  return raw ? JSON.parse(raw) : {};
}

// Autentica pelo token LiveKit do próprio usuário: se ele pode entrar na sala,
// pode controlar o DJ dela. Devolve { room, identity, name }.
async function auth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) throw Object.assign(new Error('sem token'), { status: 401 });
  let claims;
  try { claims = await verifier.verify(token); }
  catch { throw Object.assign(new Error('token inválido ou expirado'), { status: 401 }); }
  const room = claims?.video?.room;
  if (!room || !claims.video?.roomJoin) throw Object.assign(new Error('token sem sala'), { status: 403 });
  return { room, identity: claims.sub, name: claims.name || claims.sub };
}

const RATE = new Map(); // identity → timestamps (anti-spam: 20 comandos/min)
function rateLimit(identity) {
  const now = Date.now();
  const arr = (RATE.get(identity) || []).filter(t => now - t < 60000);
  if (arr.length >= 20) throw Object.assign(new Error('calma, muitos comandos por minuto'), { status: 429 });
  arr.push(now); RATE.set(identity, arr);
}

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, rooms: [...sessions.keys()], uptime: Math.round(process.uptime()) });
    }
    const who = await auth(req);
    if (req.method === 'GET' && url.pathname === '/state') {
      const s = sessions.get(who.room);
      return send(res, 200, s ? s.state() : { type: 'dj-state', connected: false, current: null, queue: [], paused: false, error: null, listeners: 0 });
    }
    if (req.method !== 'POST') return send(res, 404, { message: 'rota não encontrada' });
    rateLimit(who.identity);
    const body = await readJson(req);

    if (url.pathname === '/summon') {
      let s = sessions.get(who.room);
      if (!s || s.closed) { s = new Session(who.room); sessions.set(who.room, s); }
      await s.connect();
      return send(res, 200, s.state());
    }
    if (url.pathname === '/command') {
      let s = sessions.get(who.room);
      const cmd = String(body.cmd || '');
      if (cmd === 'play') {
        if (!s || s.closed) { s = new Session(who.room); sessions.set(who.room, s); }
        await s.connect();
        const item = await s.play(String(body.query || ''), who.name);
        return send(res, 200, { ok: true, added: item, state: s.state() });
      }
      if (!s || s.closed) return send(res, 200, { ok: true, state: null });
      switch (cmd) {
        case 'skip': s.skip(); break;
        case 'pause': s.pause(); break;
        case 'resume': s.resume(); break;
        case 'stop': s.stop(); break;
        case 'remove': s.remove(String(body.id || '')); break;
        case 'leave': await s.leave(); return send(res, 200, { ok: true, state: null });
        default: return send(res, 400, { message: 'comando desconhecido' });
      }
      return send(res, 200, { ok: true, state: s.state() });
    }
    return send(res, 404, { message: 'rota não encontrada' });
  } catch (e) {
    const status = e.status || (e instanceof SyntaxError ? 400 : 500);
    if (status >= 500) log('erro', e);
    return send(res, status, { message: e.message || 'erro' });
  }
});

server.listen(PORT, BIND, () => log(`escutando em http://${BIND}:${PORT} → LiveKit ${LK_URL}`));

async function shutdown() {
  log('encerrando...');
  await Promise.all([...sessions.values()].map(s => s.leave().catch(() => {})));
  await dispose().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
