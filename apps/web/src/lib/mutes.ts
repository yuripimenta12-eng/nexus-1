'use client';

import { create } from 'zustand';
import api from '@/lib/api';

// Servidores e canais silenciados (sem som, sem aviso e sem destaque de não-lidas).
// Fica guardado na conta, então vale em todos os aparelhos.
interface MutesState {
  servers: Set<string>;
  channels: Set<string>;
  loaded: boolean;
  load: () => Promise<void>;
  isMuted: (serverId?: string | null, channelId?: string | null) => boolean;
  toggleServer: (serverId: string) => Promise<boolean>;
  toggleChannel: (channelId: string) => Promise<boolean>;
}

let loading: Promise<void> | null = null;

export const useMutes = create<MutesState>((set, get) => ({
  servers: new Set(),
  channels: new Set(),
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    if (!loading) {
      loading = api.get('/notifications/mutes')
        .then(({ data }) => {
          const servers = new Set<string>();
          const channels = new Set<string>();
          (Array.isArray(data) ? data : []).forEach((m: any) => {
            if (m.serverId) servers.add(m.serverId);
            if (m.channelId) channels.add(m.channelId);
          });
          set({ servers, channels, loaded: true });
        })
        .catch(() => { /* sem silenciados — segue normal */ })
        .finally(() => { loading = null; });
    }
    return loading;
  },

  isMuted: (serverId, channelId) => {
    const { servers, channels } = get();
    return (!!serverId && servers.has(serverId)) || (!!channelId && channels.has(channelId));
  },

  toggleServer: async (serverId) => {
    const muted = !get().servers.has(serverId);
    await api.put('/notifications/mutes', { serverId, muted });
    const servers = new Set(get().servers);
    if (muted) servers.add(serverId); else servers.delete(serverId);
    set({ servers });
    return muted;
  },

  toggleChannel: async (channelId) => {
    const muted = !get().channels.has(channelId);
    await api.put('/notifications/mutes', { channelId, muted });
    const channels = new Set(get().channels);
    if (muted) channels.add(channelId); else channels.delete(channelId);
    set({ channels });
    return muted;
  },
}));
