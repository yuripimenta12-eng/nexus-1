'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { useVoiceStore } from '@/stores/voice.store';

// Chamada direta 1:1 pela DM. Usa o mesmo motor de voz das salas
// (microfone com redução de ruído, áudio global), numa sala só da dupla.
export interface CallPartner { id: string; displayName: string; avatarUrl?: string | null }
type Phase = 'idle' | 'outgoing' | 'incoming' | 'active';

interface DmCallState {
  phase: Phase;
  partner: CallPartner | null;
  startedAt: number | null;
  notice: string | null;
  call: (partner: CallPartner) => Promise<void>;
  ring: (from: CallPartner) => void;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  hangup: (reason?: string) => Promise<void>;
  remoteAccepted: (by: string) => void;
  remoteEnded: (from: string, reason?: string) => void;
  handledElsewhere: (partnerId: string) => void;
  clearNotice: () => void;
}

const RING_TIMEOUT = 45_000;
let ringTimer: ReturnType<typeof setTimeout> | null = null;
const clearRing = () => { if (ringTimer) clearTimeout(ringTimer); ringTimer = null; };

const ENDED_TEXT: Record<string, string> = {
  declined: 'recusou a chamada',
  busy: 'está em outra chamada',
  timeout: 'não atendeu',
  cancelled: 'cancelou a chamada',
  ended: 'encerrou a chamada',
};

async function connectTo(partner: CallPartner, data: any) {
  await useVoiceStore.getState().connect(
    data.livekitUrl, data.token, `dm:${partner.id}`, `Chamada com ${partner.displayName}`, undefined,
  );
}

export const useDmCall = create<DmCallState>((set, get) => ({
  phase: 'idle',
  partner: null,
  startedAt: null,
  notice: null,

  call: async (partner) => {
    if (get().phase !== 'idle') return;
    set({ phase: 'outgoing', partner, startedAt: null, notice: null });
    try {
      const { data } = await api.post(`/dms/${partner.id}/call`);
      if (get().phase !== 'outgoing') return; // cancelou enquanto conectava
      await connectTo(partner, data);
      clearRing();
      ringTimer = setTimeout(() => {
        if (get().phase === 'outgoing') get().hangup('timeout');
      }, RING_TIMEOUT);
    } catch (e: any) {
      set({ phase: 'idle', partner: null, notice: e?.response?.data?.message || 'Não foi possível ligar agora' });
      try { await useVoiceStore.getState().disconnect(); } catch { /* ok */ }
    }
  },

  ring: (from) => {
    const { phase, partner } = get();
    if (phase !== 'idle') {
      // Já em chamada: avisa quem ligou que está ocupado
      if (partner?.id !== from.id) api.post(`/dms/${from.id}/call/end`, { reason: 'busy' }).catch(() => {});
      return;
    }
    set({ phase: 'incoming', partner: from, notice: null });
    clearRing();
    ringTimer = setTimeout(() => {
      if (get().phase === 'incoming' && get().partner?.id === from.id) set({ phase: 'idle', partner: null });
    }, RING_TIMEOUT + 5_000);
  },

  accept: async () => {
    const { partner, phase } = get();
    if (!partner || phase !== 'incoming') return;
    clearRing();
    // Já marca como em chamada: o aviso "atendido" que o servidor manda para
    // os meus aparelhos não pode encerrar este aqui
    set({ phase: 'active', startedAt: Date.now() });
    try {
      const { data } = await api.post(`/dms/${partner.id}/call/accept`);
      await connectTo(partner, data);
    } catch (e: any) {
      set({ phase: 'idle', partner: null, notice: e?.response?.data?.message || 'Não foi possível atender' });
    }
  },

  decline: async () => {
    const { partner } = get();
    clearRing();
    set({ phase: 'idle', partner: null });
    if (partner) api.post(`/dms/${partner.id}/call/end`, { reason: 'declined' }).catch(() => {});
  },

  hangup: async (reason) => {
    const { partner, phase } = get();
    clearRing();
    set({ phase: 'idle', partner: null, startedAt: null });
    if (partner) {
      const why = reason || (phase === 'outgoing' ? 'cancelled' : 'ended');
      api.post(`/dms/${partner.id}/call/end`, { reason: why }).catch(() => {});
      if (why === 'timeout') set({ notice: `${partner.displayName} não atendeu` });
    }
    const v = useVoiceStore.getState();
    if (v.voiceRoomId?.startsWith('dm:')) { try { await v.disconnect(); } catch { /* ok */ } }
  },

  remoteAccepted: (by) => {
    const { partner, phase } = get();
    if (phase !== 'outgoing' || partner?.id !== by) return;
    clearRing();
    set({ phase: 'active', startedAt: Date.now() });
  },

  remoteEnded: (from, reason) => {
    const { partner, phase } = get();
    if (phase === 'idle' || partner?.id !== from) return;
    clearRing();
    const name = partner.displayName;
    set({ phase: 'idle', partner: null, startedAt: null, notice: `${name} ${ENDED_TEXT[reason || 'ended'] || ENDED_TEXT.ended}` });
    const v = useVoiceStore.getState();
    if (v.voiceRoomId?.startsWith('dm:')) v.disconnect().catch(() => {});
  },

  handledElsewhere: (partnerId) => {
    const { partner, phase } = get();
    // Atendi/recusei em outro aparelho: este para de tocar
    if (phase === 'incoming' && partner?.id === partnerId) { clearRing(); set({ phase: 'idle', partner: null }); }
  },

  clearNotice: () => set({ notice: null }),
}));
