import { io, Socket } from 'socket.io-client';
import api from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

// Auth dinâmico: chamado pelo socket.io a CADA tentativa de conexão, sempre
// lendo o access token atual do localStorage (o interceptor do axios o
// mantém renovado). Com auth estático, o socket morria de vez quando o
// token de 15 min expirava: o servidor rejeitava e derrubava a conexão.
function dynamicAuth(cb: (data: { token: string | null }) => void) {
  cb({
    token: typeof window !== 'undefined'
      ? localStorage.getItem('nexus_access_token')
      : null,
  });
}

let recovering = false;

// Recuperação: quando o SERVIDOR derruba a conexão (token expirado), o
// socket.io não religa sozinho ('io server disconnect'). Renovamos o token
// via axios (o interceptor faz o refresh) e reconectamos manualmente.
async function recoverFromServerDisconnect(s: Socket) {
  if (recovering) return;
  recovering = true;
  try {
    await api.get('/auth/me'); // 401 → interceptor renova o access token
  } catch { /* refresh falhou — sessão realmente acabou */ }
  recovering = false;
  if (!s.connected) s.connect(); // dynamicAuth lê o token novo
}

// Canais que o usuário está atualmente (para re-join após reconexão)
const activeChannels = new Set<string>();
const activeServers = new Set<string>();

export function trackChannel(channelId: string) {
  activeChannels.add(channelId);
}
export function untrackChannel(channelId: string) {
  activeChannels.delete(channelId);
}
export function trackServer(serverId: string) {
  activeServers.add(serverId);
}

// Entra na room do servidor imediatamente (e garante re-join após reconexão)
export function joinServer(serverId: string) {
  activeServers.add(serverId);
  const s = getSocket();
  if (s.connected) s.emit('server:join', { serverId });
}

// Sala de voz ativa (para presença e chat da chamada). Guardar aqui garante
// que o voice:join seja emitido mesmo se o socket ainda estiver conectando
// no momento em que a chamada abre — e re-emitido após reconexões.
let activeVoiceRoom: { voiceRoomId: string; serverId?: string | null } | null = null;

export function joinVoiceRoom(voiceRoomId: string, serverId?: string | null) {
  activeVoiceRoom = { voiceRoomId, serverId };
  const s = getSocket();
  // Sem guard de connected: o socket.io enfileira emits pré-conexão e envia
  // assim que conectar. O re-join no handler de 'connect' cobre reconexões.
  s.emit('voice:join', { voiceRoomId, serverId });
  if (typeof window !== 'undefined') {
    (window as any).__NX_SOCK = 'v2';
    (window as any).__NX_LAST_VOICE_JOIN = { voiceRoomId, connected: s.connected, at: Date.now() };
  }
}

export function leaveVoiceRoom() {
  const s = getSocket();
  if (activeVoiceRoom && s.connected) {
    s.emit('voice:leave', activeVoiceRoom);
  }
  activeVoiceRoom = null;
}

function attachReconnectHandlers(s: Socket) {
  s.on('connect', () => {
    // Re-join canais, servidores e sala de voz após (re)conexão
    activeServers.forEach(id => s.emit('server:join', { serverId: id }));
    activeChannels.forEach(id => s.emit('channel:join', { channelId: id }));
    if (activeVoiceRoom) s.emit('voice:join', activeVoiceRoom);
    if (typeof window !== 'undefined') {
      (window as any).__NX_SOCK_STATE = { connected: true, sid: s.id, voiceRoom: activeVoiceRoom };
    }
  });
  s.on('disconnect', (reason) => {
    if (typeof window !== 'undefined') {
      (window as any).__NX_SOCK_STATE = { connected: false, reason };
    }
    if (reason === 'io server disconnect') {
      recoverFromServerDisconnect(s);
    }
  });
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      auth: dynamicAuth,
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    attachReconnectHandlers(socket);
  }
  return socket;
}

export function connectSocket(_token: string): Socket {
  // Reutiliza a instância existente para não perder listeners já
  // registrados por componentes (ex.: presença de voz na sidebar).
  // O token vem sempre do dynamicAuth — o parâmetro fica por
  // compatibilidade com os chamadores.
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeChannels.clear();
  activeServers.clear();
}
