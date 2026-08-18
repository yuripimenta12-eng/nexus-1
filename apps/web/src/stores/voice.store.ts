import { create } from 'zustand';
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
  participants: Map<string, VoiceParticipant>;
  localMicEnabled: boolean;
  localCamEnabled: boolean;
  localScreenSharing: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  quality: ConnectionQuality;
  error: string | null;

  connect: (url: string, token: string, voiceRoomId: string, roomName: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  startScreenShare: (quality?: '720p30' | '1080p30' | '1080p60') => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  toggleMuteLocally: (identity: string) => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  room: null,
  roomName: null,
  voiceRoomId: null,
  participants: new Map(),
  localMicEnabled: true,
  localCamEnabled: false,
  localScreenSharing: false,
  isConnected: false,
  isConnecting: false,
  quality: ConnectionQuality.Unknown,
  error: null,

  connect: async (url, token, voiceRoomId, roomName) => {
    set({ isConnecting: true, error: null });

    try {
      const room = new Room({
        adaptiveStream: true,       // qualidade adaptativa
        dynacast: true,             // simulcast dinâmico
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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
        participants: initParticipants,
        isConnected: true,
        isConnecting: false,
        localMicEnabled: room.localParticipant.isMicrophoneEnabled,
        localCamEnabled: room.localParticipant.isCameraEnabled,
        localScreenSharing: room.localParticipant.isScreenShareEnabled,
      });

      // Ativa microfone automaticamente
      await room.localParticipant.setMicrophoneEnabled(true);

    } catch (err: any) {
      set({ isConnecting: false, error: err.message });
      throw err;
    }
  },

  disconnect: async () => {
    const { room } = get();
    if (room) {
      await room.disconnect();
    }
    set({
      room: null,
      roomName: null,
      voiceRoomId: null,
      participants: new Map(),
      isConnected: false,
      localMicEnabled: false,
      localCamEnabled: false,
      localScreenSharing: false,
    });
  },

  toggleMic: async () => {
    const { room } = get();
    if (!room) return;
    const newState = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(newState);
    set({ localMicEnabled: newState });
  },

  toggleCam: async () => {
    const { room } = get();
    if (!room) return;
    const newState = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(newState);
    set({ localCamEnabled: newState });
  },

  startScreenShare: async (quality = '1080p30') => {
    const { room } = get();
    if (!room) return;

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
        // Define volume no elemento de áudio (0-1)
        p.participant.getTrackPublications().forEach((pub) => {
          if (pub.track?.kind === 'audio') {
            (pub.track as any).setVolume?.(volume / 100);
          }
        });
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
        // Silencia o áudio localmente
        p.participant.getTrackPublications().forEach((pub) => {
          if (pub.track?.kind === 'audio') {
            (pub.track as any).setVolume?.(muted ? 0 : (p.localVolume || 100) / 100);
          }
        });
        next.set(identity, { ...p, isMutedLocally: muted });
      }
      return { participants: next };
    });
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
