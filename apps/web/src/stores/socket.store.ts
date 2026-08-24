import { create } from 'zustand';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { notifyIncomingMessage } from '@/lib/notify';
import { useAuthStore } from '@/stores/auth.store';
import type { Socket } from 'socket.io-client';

/* ── DM types ───────────────────────────────────── */
export interface DmMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  createdAt: string;
  editedAt: string | null;
  edited: boolean;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

/* ── Store interface ────────────────────────────── */
interface SocketStore {
  socket: Socket | null;
  connected: boolean;

  // DM real-time state
  dmMessages: Map<string, DmMessage[]>;
  dmUnread: Map<string, number>;

  // Connection
  init: (token: string) => void;
  disconnect: () => void;

  // Channel
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;

  // Generic socket helpers (used pelo channel page)
  on: (event: string, handler: (...args: any[]) => void) => () => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;

  // DM helpers
  addDmMessage: (partnerId: string, msg: DmMessage) => void;
  updateDmMessage: (partnerId: string, msg: DmMessage) => void;
  deleteDmMessage: (partnerId: string, messageId: string) => void;
  setDmMessages: (partnerId: string, msgs: DmMessage[]) => void;
  markDmRead: (partnerId: string) => void;
  incrementUnread: (partnerId: string) => void;
}

/* ── Store ──────────────────────────────────────── */
export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  connected: false,
  dmMessages: new Map(),
  dmUnread: new Map(),

  /* ── init ──────────────────────────────────────── */
  init: (token: string) => {
    const existing = get().socket;
    if (existing?.connected) return;

    const socket = connectSocket(token);

    socket.on('connect', () => {
      set({ socket, connected: true });
    });

    socket.on('disconnect', () => {
      set({ connected: false });
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error:', err.message);
    });

    /* ── DM events ──────────────────────────────── */
    socket.on('dm:new', (msg: DmMessage) => {
      const { dmMessages, dmUnread } = get();
      const msgs = new Map(dmMessages);

      // Atualiza thread do senderId
      const threadS = msgs.get(msg.senderId) ?? [];
      if (!threadS.some(m => m.id === msg.id)) {
        msgs.set(msg.senderId, [...threadS, msg]);
      }
      // Atualiza thread do receiverId
      const threadR = msgs.get(msg.receiverId) ?? [];
      if (!threadR.some(m => m.id === msg.id)) {
        msgs.set(msg.receiverId, [...threadR, msg]);
      }

      // Incrementa não lidas para o remetente
      const unread = new Map(dmUnread);
      unread.set(msg.senderId, (unread.get(msg.senderId) ?? 0) + 1);

      set({ dmMessages: msgs, dmUnread: unread });

      // Som + notificação de desktop (respeita as preferências do usuário)
      const myId = useAuthStore.getState().user?.id;
      if (msg.senderId !== myId) {
        notifyIncomingMessage(msg.sender?.displayName || msg.sender?.username || 'alguém', msg.content);
      }
    });

    socket.on('dm:updated', (msg: DmMessage) => {
      const msgs = new Map(get().dmMessages);
      for (const [key, thread] of msgs.entries()) {
        const idx = thread.findIndex(m => m.id === msg.id);
        if (idx !== -1) {
          const updated = [...thread];
          updated[idx] = msg;
          msgs.set(key, updated);
        }
      }
      set({ dmMessages: msgs });
    });

    socket.on('dm:deleted', ({ messageId }: { messageId: string; partnerId: string }) => {
      const msgs = new Map(get().dmMessages);
      for (const [key, thread] of msgs.entries()) {
        const filtered = thread.filter(m => m.id !== messageId);
        if (filtered.length !== thread.length) msgs.set(key, filtered);
      }
      set({ dmMessages: msgs });
    });

    set({ socket });
  },

  /* ── disconnect ─────────────────────────────────── */
  disconnect: () => {
    disconnectSocket();
    set({ socket: null, connected: false });
  },

  /* ── joinChannel ────────────────────────────────── */
  joinChannel: (channelId: string) => {
    const { socket } = get();
    if (!socket?.connected) return;
    socket.emit('channel:join', { channelId });
  },

  /* ── leaveChannel ───────────────────────────────── */
  leaveChannel: (channelId: string) => {
    const { socket } = get();
    if (!socket?.connected) return;
    socket.emit('channel:leave', { channelId });
  },

  /* ── on ─────────────────────────────────────────── */
  on: (event: string, handler: (...args: any[]) => void) => {
    const { socket } = get();
    if (socket) {
      socket.on(event, handler);
    }
    // Retorna função de cleanup (offNew = on(...))
    return () => {
      const s = get().socket;
      if (s) s.off(event, handler);
    };
  },

  /* ── off ─────────────────────────────────────────── */
  off: (event: string, handler: (...args: any[]) => void) => {
    const { socket } = get();
    if (socket) socket.off(event, handler);
  },

  /* ── emit ────────────────────────────────────────── */
  emit: (event: string, ...args: any[]) => {
    const { socket } = get();
    if (socket?.connected) socket.emit(event, ...args);
  },

  /* ── DM helpers ─────────────────────────────────── */
  addDmMessage: (partnerId, msg) => {
    set(state => {
      const msgs = new Map(state.dmMessages);
      const thread = msgs.get(partnerId) ?? [];
      if (thread.some(m => m.id === msg.id)) return state;
      msgs.set(partnerId, [...thread, msg]);
      return { dmMessages: msgs };
    });
  },

  updateDmMessage: (partnerId, msg) => {
    set(state => {
      const msgs = new Map(state.dmMessages);
      const thread = msgs.get(partnerId) ?? [];
      msgs.set(partnerId, thread.map(m => m.id === msg.id ? msg : m));
      return { dmMessages: msgs };
    });
  },

  deleteDmMessage: (partnerId, messageId) => {
    set(state => {
      const msgs = new Map(state.dmMessages);
      const thread = msgs.get(partnerId) ?? [];
      msgs.set(partnerId, thread.filter(m => m.id !== messageId));
      return { dmMessages: msgs };
    });
  },

  setDmMessages: (partnerId, newMsgs) => {
    set(state => {
      const msgs = new Map(state.dmMessages);
      msgs.set(partnerId, newMsgs);
      return { dmMessages: msgs };
    });
  },

  markDmRead: (partnerId) => {
    set(state => {
      const unread = new Map(state.dmUnread);
      unread.set(partnerId, 0);
      return { dmUnread: unread };
    });
  },

  incrementUnread: (partnerId) => {
    set(state => {
      const unread = new Map(state.dmUnread);
      unread.set(partnerId, (unread.get(partnerId) ?? 0) + 1);
      return { dmUnread: unread };
    });
  },
}));
