import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let socket: Socket | null = null;

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

function attachReconnectHandlers(s: Socket) {
  s.on('connect', () => {
    // Re-join canais e servidores após reconexão automática
    activeServers.forEach(id => s.emit('server:join', { serverId: id }));
    activeChannels.forEach(id => s.emit('channel:join', { channelId: id }));
  });
}

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('nexus_access_token')
      : null;

    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    attachReconnectHandlers(socket);
  }
  return socket;
}

export function connectSocket(token: string): Socket {
  // Reutiliza a instância existente para não perder listeners já
  // registrados por componentes (ex.: presença de voz na sidebar)
  if (socket) {
    (socket.auth as { token?: string }).token = token;
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  attachReconnectHandlers(socket);
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  activeChannels.clear();
  activeServers.clear();
}
