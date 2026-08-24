import { create } from 'zustand';
import { getSocket } from '@/lib/socket';
import { useMediaStore } from '@/stores/media.store';
import {
  Room,
  RoomEvent,
  LocalParticipant,
  RemoteParticipant,
  Participant,
  Track,
  TrackPublication,
  VideoQuality,
  ConnectionQuality,
} from 'livekit-client';

export interface VoiceParticipant {
  identity: string;
  userId?: string;
  displayName?: string;
  avatarUrl?: string;
  isSpeaking: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  connectionQuality: ConnectionQuality;
  // volume do participante LOCAL (só afeta quem está ouvindo)
  localVolume: number;
  isMutedLocally: boolean;
  participant: Participant;
}

interface VoiceStore {
  room: Room | null;
  roomName: string | null;
  voiceRoomId: string | null;
  serverId: string | null;
  participants: Map<string, VoiceParticipant>;
  localMicEnabled: boolean;
  localCamEnabled: boolean;
  localScreenSharing: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  quality: ConnectionQuality;
  error: string | null;

  connect: (url: string, token: string, voiceRoomId: string, roomName: string, serverId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  startScreenShare: (quality?: '720p30' | '1080p30' | '1080p60') => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  toggleMuteLocally: (identity: string) => void;
  updateParticipant: (p: Participant) => void;

  // ── Configurações de mídia aplicadas ao vivo ──
  setInputVolume: (volume: number) => void;
  applyOutputVolume: () => void;
  switchAudioInput: (deviceId: string) => Promise<void>;
  switchAudioOutput: (deviceId: string) => Promise<void>;
  switchVideoInput: (deviceId: string) => Promise<void>;
}

// Pipeline WebAudio do microfone: getUserMedia → GainNode → track publicado.
// Permite controlar o ganho de entrada (0–200%) em tempo real.
interface MicPipeline {
  ctx: AudioContext;
  raw: MediaStream;
  gain: GainNode;
  processed: MediaStreamTrack;
}

let micPipeline: MicPipeline | null = null;

async function buildAndPublishMic(room: Room): Promise<void> {
  const ms = useMediaStore.getState();
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: ms.audioInputId ? { exact: ms.audioInputId } : undefined,
      echoCancellation: ms.echoCancellation,
      noiseSuppression: ms.noiseSuppression,
      autoGainControl: ms.autoGainControl,
    },
  });
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(raw);
  const gain = ctx.createGain();
  gain.gain.value = ms.inputVolume / 100;
  const dst = ctx.createMediaStreamDestination();
  src.connect(gain);
  gain.connect(dst);
  const processed = dst.stream.getAudioTracks()[0];

  await room.localParticipant.publishTrack(processed, {
    source: Track.Source.Microphone,
  });
  micPipeline = { ctx, raw, gain, processed };
}

async function teardownMic(room: Room | null): Promise<void> {
  if (room && micPipeline) {
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub?.track) {
      try { room.localParticipant.unpublishTrack(pub.track as any, true); } catch { /* ok */ }
    }
  }
  micPipeline?.raw.getTracks().forEach(t => t.stop());
  micPipeline?.processed.stop();
  micPipeline?.ctx.close().catch(() => {});
  micPipeline = null;
}

// Aplica volume final (individual × global) em um elemento <audio>
function effectiveVolume(localVolume: number, mutedLocally: boolean): number {
  if (mutedLocally) return 0;
  const out = useMediaStore.getState().outputVolume;
  return Math.min(1, (localVolume / 100) * (out / 100));
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  room: null,
  roomName: null,
  voiceRoomId: null,
  serverId: null,
  participants: new Map(),
  localMicEnabled: true,
  localCamEnabled: false,
  localScreenSharing: false,
  isConnected: false,
  isConnecting: false,
  quality: ConnectionQuality.Unknown,
  error: null,

  connect: async (url, token, voiceRoomId, roomName, serverId) => {
    set({ isConnecting: true, error: null });

    try {
      const ms = useMediaStore.getState();
      const room = new Room({
        adaptiveStream: true,       // qualidade adaptativa
        dynacast: true,             // simulcast dinâmico
        videoCaptureDefaults: {
          deviceId: ms.videoInputId || undefined,
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
        audioCaptureDefaults: {
          deviceId: ms.audioInputId || undefined,
          echoCancellation: ms.echoCancellation,
          noiseSuppression: ms.noiseSuppression,
          autoGainControl: ms.autoGainControl,
        },
      });

      // ── Eventos da Room ──────────────────────────────────────
      room.on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        get().updateParticipant(p);
      });

      room.on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        set((state) => {
          const next = new Map(state.participants);
          next.delete(p.identity);
          return { participants: next };
        });
      });

      room.on(RoomEvent.TrackPublished, (pub, p) => get().updateParticipant(p));
      room.on(RoomEvent.TrackUnpublished, (pub, p) => get().updateParticipant(p));
      room.on(RoomEvent.TrackSubscribed, (_, pub, p) => get().updateParticipant(p));
      room.on(RoomEvent.TrackUnsubscribed, (_, pub, p) => get().updateParticipant(p));

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const speakingSet = new Set(speakers.map(s => s.identity));
        set((state) => {
          const next = new Map(state.participants);
          next.forEach((p, key) => {
            next.set(key, { ...p, isSpeaking: speakingSet.has(key) });
          });
          return { participants: next };
        });
      });

      room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, p: Participant) => {
        if (p.identity === room.localParticipant.identity) {
          set({ quality });
        }
        get().updateParticipant(p);
      });

      room.on(RoomEvent.LocalTrackPublished, () => {
        const lp = room.localParticipant;
        set({
          localMicEnabled: lp.isMicrophoneEnabled,
          localCamEnabled: lp.isCameraEnabled,
          localScreenSharing: lp.isScreenShareEnabled,
        });
      });

      room.on(RoomEvent.LocalTrackUnpublished, () => {
        const lp = room.localParticipant;
        set({
          localMicEnabled: lp.isMicrophoneEnabled,
          localCamEnabled: lp.isCameraEnabled,
          localScreenSharing: lp.isScreenShareEnabled,
        });
      });

      room.on(RoomEvent.Disconnected, () => {
        teardownMic(null);
        set({
          isConnected: false,
          room: null,
          participants: new Map(),
          localScreenSharing: false,
        });
      });

      // Conecta ao LiveKit
      await room.connect(url, token, {
        autoSubscribe: true,
      });

      // Adiciona participantes já presentes
      const initParticipants = new Map<string, VoiceParticipant>();
      room.remoteParticipants.forEach((p) => {
        initParticipants.set(p.identity, buildParticipant(p));
      });
      // Adiciona participante local
      initParticipants.set(
        room.localParticipant.identity,
        buildParticipant(room.localParticipant),
      );

      set({
        room,
        roomName,
        voiceRoomId,
        serverId: serverId ?? null,
        participants: initParticipants,
        isConnected: true,
        isConnecting: false,
        localMicEnabled: room.localParticipant.isMicrophoneEnabled,
        localCamEnabled: room.localParticipant.isCameraEnabled,
        localScreenSharing: room.localParticipant.isScreenShareEnabled,
      });

      // Ativa microfone automaticamente; sem permissão, entra como ouvinte
      try {
        await buildAndPublishMic(room);
        set({ localMicEnabled: true });
      } catch {
        set({ localMicEnabled: false });
      }

      // Anuncia presença via Socket.IO (sidebar de todos os membros)
      try {
        const s = getSocket();
        if (s.connected) s.emit('voice:join', { voiceRoomId, serverId });
      } catch { /* socket indisponível não impede a chamada */ }

    } catch (err: any) {
      set({ isConnecting: false, error: err.message });
      throw err;
    }
  },

  disconnect: async () => {
    const { room, voiceRoomId, serverId } = get();
    await teardownMic(room);
    if (room) {
      await room.disconnect();
    }
    if (voiceRoomId) {
      try {
        const s = getSocket();
        if (s.connected) s.emit('voice:leave', { voiceRoomId, serverId });
      } catch { /* ok */ }
    }
    set({
      room: null,
      roomName: null,
      voiceRoomId: null,
      serverId: null,
      participants: new Map(),
      isConnected: false,
      localMicEnabled: false,
      localCamEnabled: false,
      localScreenSharing: false,
    });
  },

  toggleMic: async () => {
    const { room, localMicEnabled } = get();
    if (!room) return;
    try {
      if (localMicEnabled) {
        await teardownMic(room);
        set({ localMicEnabled: false });
      } else {
        await buildAndPublishMic(room);
        set({ localMicEnabled: true });
      }
    } catch {
      // Permissão negada ou dispositivo indisponível — mantém estado real
      set({ localMicEnabled: !!micPipeline });
    }
  },

  toggleCam: async () => {
    const { room } = get();
    if (!room) return;
    const newState = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(newState);
      set({ localCamEnabled: newState });
    } catch {
      set({ localCamEnabled: room.localParticipant.isCameraEnabled });
    }
  },

  startScreenShare: async (quality) => {
    const { room } = get();
    if (!room) return;
    if (!quality) quality = useMediaStore.getState().screenQuality;

    // Configurações de qualidade para screen share
    const qualityMap = {
      '720p30':  { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_000_000 },
      '1080p30': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
      '1080p60': { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000 },
    };

    const opts = qualityMap[quality];

    await room.localParticipant.setScreenShareEnabled(true, {
      resolution: opts,
      audio: true, // captura áudio do sistema quando suportado
    });

    set({ localScreenSharing: true });
  },

  stopScreenShare: async () => {
    const { room } = get();
    if (!room) return;

    await room.localParticipant.setScreenShareEnabled(false);
    set({ localScreenSharing: false });
  },

  setParticipantVolume: (identity, volume) => {
    set((state) => {
      const next = new Map(state.participants);
      const p = next.get(identity);
      if (p) {
        // O volume final é o individual × o volume global de saída
        const audioEls = document.querySelectorAll<HTMLAudioElement>(
          `audio[data-lk-identity="${identity}"]`,
        );
        audioEls.forEach((el) => { el.volume = effectiveVolume(volume, !!p.isMutedLocally); });
        next.set(identity, { ...p, localVolume: volume });
      }
      return { participants: next };
    });
  },

  toggleMuteLocally: (identity) => {
    set((state) => {
      const next = new Map(state.participants);
      const p = next.get(identity);
      if (p) {
        const muted = !p.isMutedLocally;
        const audioEls = document.querySelectorAll<HTMLAudioElement>(
          `audio[data-lk-identity="${identity}"]`,
        );
        audioEls.forEach((el) => { el.volume = effectiveVolume(p.localVolume || 100, muted); });
        next.set(identity, { ...p, isMutedLocally: muted });
      }
      return { participants: next };
    });
  },

  // ── Configurações de mídia aplicadas ao vivo ─────────────────
  setInputVolume: (volume) => {
    useMediaStore.getState().setInputVolume(volume);
    if (micPipeline) micPipeline.gain.gain.value = volume / 100;
  },

  applyOutputVolume: () => {
    const { participants } = get();
    participants.forEach((p, identity) => {
      const els = document.querySelectorAll<HTMLAudioElement>(
        `audio[data-lk-identity="${identity}"]`,
      );
      els.forEach((el) => { el.volume = effectiveVolume(p.localVolume ?? 100, !!p.isMutedLocally); });
    });
  },

  switchAudioInput: async (deviceId) => {
    useMediaStore.getState().setAudioInputId(deviceId);
    const { room, localMicEnabled } = get();
    if (room && localMicEnabled) {
      // Reconstrói o pipeline do microfone com o novo dispositivo
      await teardownMic(room);
      try {
        await buildAndPublishMic(room);
        set({ localMicEnabled: true });
      } catch {
        set({ localMicEnabled: false });
      }
    }
  },

  switchAudioOutput: async (deviceId) => {
    useMediaStore.getState().setAudioOutputId(deviceId);
    const els = document.querySelectorAll<HTMLAudioElement>('audio[data-lk-identity]');
    for (const el of Array.from(els)) {
      try {
        await (el as any).setSinkId(deviceId || '');
      } catch { /* navegador sem suporte a setSinkId */ }
    }
  },

  switchVideoInput: async (deviceId) => {
    useMediaStore.getState().setVideoInputId(deviceId);
    const { room } = get();
    if (room && room.localParticipant.isCameraEnabled && deviceId) {
      try {
        await room.switchActiveDevice('videoinput', deviceId);
      } catch { /* dispositivo indisponível */ }
    }
  },

  // Helper interno (não exposto pelo tipo mas usado pelos callbacks)
  updateParticipant: (p: Participant) => {
    set((state) => {
      const next = new Map(state.participants);
      const existing = next.get(p.identity);
      next.set(p.identity, {
        ...buildParticipant(p),
        localVolume: existing?.localVolume ?? 100,
        isMutedLocally: existing?.isMutedLocally ?? false,
      });
      return { participants: next };
    });
  },
} as any));

// ── Helper ────────────────────────────────────────────────────
function buildParticipant(p: Participant): VoiceParticipant {
  const hasCam = Array.from(p.trackPublications.values()).some(
    pub => pub.source === Track.Source.Camera && !pub.isMuted,
  );
  const hasScreen = Array.from(p.trackPublications.values()).some(
    pub => pub.source === Track.Source.ScreenShare,
  );

  return {
    identity: p.identity,
    isSpeaking: p.isSpeaking,
    micEnabled: p.isMicrophoneEnabled,
    camEnabled: hasCam,
    screenSharing: hasScreen,
    connectionQuality: p.connectionQuality,
    localVolume: 100,
    isMutedLocally: false,
    participant: p,
  };
}
