import { create } from 'zustand';
import { getSocket, joinVoiceRoom, leaveVoiceRoom } from '@/lib/socket';
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
  DisconnectReason,
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
  // volume da TRANSMISSÃO de tela dele (separado da voz do microfone)
  streamVolume?: number;
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
  // true enquanto o LiveKit tenta retomar a conexão sozinho (internet piscou)
  reconnecting: boolean;
  isConnecting: boolean;
  quality: ConnectionQuality;
  error: string | null;
  // Preenchido quando a transmissão de tela termina SEM o usuário clicar em
  // "Parar tela" — a página observa isto e mostra o motivo num toast.
  liveEndedNotice: string | null;
  clearLiveEndedNotice: () => void;

  connect: (url: string, token: string, voiceRoomId: string, roomName: string, serverId?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCam: () => Promise<void>;
  startScreenShare: (quality?: '720p30' | '720p60' | '1080p30' | '1080p60') => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setParticipantVolume: (identity: string, volume: number) => void;
  setStreamVolume: (identity: string, volume: number) => void;
  toggleMuteLocally: (identity: string) => void;
  updateParticipant: (p: Participant) => void;

  // ── Configurações de mídia aplicadas ao vivo ──
  isDeafened: boolean;
  toggleDeafen: () => void;
  // Modo reunião: silencia as VOZES da call (só para mim), mantendo o áudio da live
  isStreamFocus: boolean;
  toggleStreamFocus: () => void;
  // Transmissões que EU escolhi assistir (o áudio delas toca em qualquer tela)
  watching: Set<string>;
  setWatching: (next: Set<string>) => void;
  setInputVolume: (volume: number) => void;
  applyOutputVolume: () => void;
  switchAudioInput: (deviceId: string) => Promise<void>;
  switchAudioOutput: (deviceId: string) => Promise<void>;
  switchVideoInput: (deviceId: string) => Promise<void>;
}

// Pipeline WebAudio do microfone: getUserMedia → filtro grave → portão de
// ruído → GainNode → track publicado. Permite controlar o ganho de entrada
// (0–200%) em tempo real e cortar chiado/apito constante entre as falas.
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
  // Contexto pode nascer "suspended" (política de autoplay) = mic mudo sem erro.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const src = ctx.createMediaStreamSource(raw);
  const gain = ctx.createGain();
  gain.gain.value = ms.inputVolume / 100;
  const dst = ctx.createMediaStreamDestination();

  // Portão de ruído na THREAD DE ÁUDIO (AudioWorklet): funciona igual com a
  // aba em segundo plano/minimizada. A versão antiga usava requestAnimationFrame,
  // que o Chrome congela em abas ocultas — o mic ficava mudo "do nada" até relogar.
  // Qualquer falha aqui cai no caminho direto (sem portão): nunca muta ninguém.
  let ligouGate = false;
  if (ms.noiseGate && (ctx as any).audioWorklet) {
    try {
      const codigo = `
        class NexusGate extends AudioWorkletProcessor {
          constructor() { super(); this.gain = 1; this.segurarAte = 0; }
          process(inputs, outputs) {
            const inp = inputs[0], out = outputs[0];
            if (!inp || !inp[0] || !out || !out[0]) return true;
            const ch0 = inp[0];
            let sum = 0;
            for (let i = 0; i < ch0.length; i++) sum += ch0[i] * ch0[i];
            const rms = Math.sqrt(sum / ch0.length);
            // ~ -38dB: fala normal passa, chiado de fundo não; segura 0,4s entre palavras
            if (rms > 0.012) this.segurarAte = currentTime + 0.4;
            const alvo = currentTime < this.segurarAte ? 1 : 0;
            // abre rápido (~30ms, não come o começo da palavra), fecha suave (~250ms)
            const passo = alvo > this.gain ? 0.3 : 0.05;
            this.gain += (alvo - this.gain) * passo;
            for (let c = 0; c < inp.length; c++) {
              const ic = inp[c], oc = out[c] || out[0];
              for (let i = 0; i < ic.length; i++) oc[i] = ic[i] * this.gain;
            }
            return true;
          }
        }
        registerProcessor('nexus-gate', NexusGate);
      `;
      const blobUrl = URL.createObjectURL(new Blob([codigo], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      // Filtro passa-alta: remove zumbido grave de energia/ventilador (< 85Hz)
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 85;
      const gateNode = new AudioWorkletNode(ctx, 'nexus-gate');

      src.connect(highpass);
      highpass.connect(gateNode);
      gateNode.connect(gain);
      ligouGate = true;
    } catch {
      ligouGate = false; // navegador sem suporte ou erro no worklet — segue sem portão
    }
  }
  if (!ligouGate) {
    src.connect(gain);
  }

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
// Silenciar tudo (deafen): zera a saída da chamada sem perder os volumes
let deafened = false;
// Modo reunião: zera só a voz dos microfones; o áudio de transmissão segue normal
let streamFocus = false;

// true enquanto o PRÓPRIO usuário clica em "Parar tela" — diferencia o
// encerramento intencional de quedas externas (barrinha do Chrome, janela
// fechada, desconexão), que merecem um aviso com o motivo.
let stoppingShareByUser = false;

// Traduz o motivo de desconexão do LiveKit para o usuário
function disconnectReasonText(reason?: DisconnectReason): string {
  switch (reason) {
    case DisconnectReason.DUPLICATE_IDENTITY:
      return 'Você entrou nesta sala em outra aba ou dispositivo — esta conexão foi encerrada.';
    case DisconnectReason.PARTICIPANT_REMOVED:
      return 'Você foi removido da sala por um moderador.';
    case DisconnectReason.ROOM_DELETED:
      return 'A sala foi encerrada.';
    case DisconnectReason.SERVER_SHUTDOWN:
      return 'O servidor de voz reiniciou. Entre novamente.';
    default:
      return 'A conexão com a sala caiu. Entre novamente.';
  }
}

function effectiveVolume(localVolume: number, mutedLocally: boolean): number {
  if (mutedLocally || deafened) return 0;
  const out = useMediaStore.getState().outputVolume;
  // Teto de 1.0: sem WebAudio, o volume vai direto no <audio> (el.volume),
  // que o navegador limita em 100% — valores maiores lançariam exceção.
  return Math.min(1, (localVolume / 100) * (out / 100));
}

// ── Reforço acima de 100% SÓ para áudio de transmissão de tela ──────────
// A voz do microfone nunca passa por aqui (evita o problema de eco/AEC do
// Chrome com WebAudio). Acima de 100%, o <audio> da track é zerado e o som
// sai por um GainNode dedicado; em 100% ou menos, tudo volta ao caminho normal.
const streamBoosts = new Map<string, { src: MediaStreamAudioSourceNode; gain: GainNode }>();
let boostCtx: AudioContext | null = null;

function removeStreamBoost(sid: string) {
  const b = streamBoosts.get(sid);
  if (!b) return;
  try { b.src.disconnect(); b.gain.disconnect(); } catch { /* já desconectado */ }
  streamBoosts.delete(sid);
}

function applyStreamBoost(track: any, sid: string, gainValue: number): boolean {
  try {
    if (!track?.mediaStreamTrack) return false;
    if (!boostCtx) boostCtx = new AudioContext();
    if (boostCtx.state === 'suspended') boostCtx.resume().catch(() => {});
    let b = streamBoosts.get(sid);
    if (!b) {
      const src = boostCtx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
      const gain = boostCtx.createGain();
      src.connect(gain);
      gain.connect(boostCtx.destination);
      b = { src, gain };
      streamBoosts.set(sid, b);
    }
    b.gain.gain.value = gainValue;
    return true;
  } catch {
    return false;
  }
}

// Aplica o volume nas tracks de áudio do participante via API do LiveKit
// (track.setVolume ajusta os <audio> anexados e re-aplica sozinho quando a
// track é re-anexada — mais confiável que mexer em el.volume por fora).
// Voz (microfone) e transmissão de tela têm volumes SEPARADOS.
function applyVolumeToTracks(p: { participant?: Participant; localVolume?: number; streamVolume?: number; isMutedLocally?: boolean }) {
  if (!p.participant) return;
  // Modo reunião: vozes zeradas (o áudio da live abaixo continua normal)
  const micVol = streamFocus ? 0 : effectiveVolume(p.localVolume ?? 100, !!p.isMutedLocally);
  // Transmissão pode passar de 100% (até 120) — sem teto aqui; o excedente
  // sai pelo GainNode dedicado em applyStreamBoost.
  const out = useMediaStore.getState().outputVolume;
  const streamRaw = (!!p.isMutedLocally || deafened)
    ? 0
    : ((p.streamVolume ?? 100) / 100) * (out / 100);
  p.participant.trackPublications.forEach((pub) => {
    const track: any = pub.track;
    if (pub.kind === Track.Kind.Audio && track?.setVolume) {
      const isScreen = pub.source === Track.Source.ScreenShareAudio;
      try {
        if (!isScreen) {
          track.setVolume(micVol);
        } else if (streamRaw > 1 && applyStreamBoost(track, pub.trackSid, streamRaw)) {
          track.setVolume(0); // toca só pelo amplificador, sem duplicar o som
        } else {
          removeStreamBoost(pub.trackSid);
          track.setVolume(Math.min(1, streamRaw));
        }
      } catch { /* track ainda não pronta */ }
    }
  });
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
  reconnecting: false,
  quality: ConnectionQuality.Unknown,
  error: null,
  liveEndedNotice: null,
  clearLiveEndedNotice: () => set({ liveEndedNotice: null }),

  connect: async (url, token, voiceRoomId, roomName, serverId) => {
    set({ isConnecting: true, error: null });

    try {
      const ms = useMediaStore.getState();
      const room = new Room({
        adaptiveStream: true,       // qualidade adaptativa
        dynacast: true,             // simulcast dinâmico
        // NÃO usar webAudioMix: no Chrome, áudio tocado via WebAudio escapa
        // do cancelamento de eco (crbug 40252911) — na prática, vozes
        // duplicadas e delay para todo mundo. Com a reprodução direta nos
        // <audio>, o AEC funciona; o custo é o volume por pessoa limitar
        // em 100% (el.volume não amplifica acima de 1.0).
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
        // Atualiza também o participante local no map — sem isto a própria
        // live não aparecia na grade (quem transmitia não via a prévia).
        get().updateParticipant(lp);
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
        const lp = room.localParticipant;
        // Live caiu sem o usuário clicar em "Parar tela"? Avisa o motivo.
        if (pub?.source === Track.Source.ScreenShare && !stoppingShareByUser) {
          const ended = pub.track?.mediaStreamTrack?.readyState === 'ended';
          console.warn('[nexus-live] screen share unpublicada sem ação do usuário; track ended =', ended);
          set({
            liveEndedNotice: ended
              ? 'Sua transmissão foi encerrada pelo navegador — a janela compartilhada foi fechada ou você clicou em "Parar compartilhamento" na barra do Chrome.'
              : 'Sua transmissão de tela foi interrompida (queda de conexão de voz). Clique em "Compartilhar tela" para retomar.',
          });
        }
        set({
          localMicEnabled: lp.isMicrophoneEnabled,
          localCamEnabled: lp.isCameraEnabled,
          localScreenSharing: lp.isScreenShareEnabled,
        });
        get().updateParticipant(lp);
      });

      // Internet piscou: o LiveKit tenta retomar sozinho — avisa a UI em vez de "cair"
      room.on(RoomEvent.Reconnecting, () => set({ reconnecting: true }));
      room.on(RoomEvent.Reconnected, () => {
        set({ reconnecting: false });
        // Re-sincroniza participantes e volumes após a retomada
        room.remoteParticipants.forEach((p) => get().updateParticipant(p));
        get().updateParticipant(room.localParticipant);
        get().applyOutputVolume();
      });

      room.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        console.warn('[nexus-live] Room desconectada, reason =', reason);
        teardownMic(null);
        // Saída intencional (botão sair / troca de sala) não é erro
        const intentional = reason === DisconnectReason.CLIENT_INITIATED;
        set({
          isConnected: false,
          reconnecting: false,
          room: null,
          participants: new Map(),
          localScreenSharing: false,
          // Mostra o motivo real na tela de erro (com botão "Tentar novamente")
          error: intentional ? null : disconnectReasonText(reason),
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

      // Anuncia presença via Socket.IO ANTES do microfone: o prompt de
      // permissão do navegador pode ficar pendente por tempo indeterminado
      // e não pode segurar a entrada na sala (chat/presença).
      try {
        joinVoiceRoom(voiceRoomId, serverId);
      } catch { /* socket indisponível não impede a chamada */ }

      // Ativa microfone automaticamente; sem permissão, entra como ouvinte
      try {
        await buildAndPublishMic(room);
        set({ localMicEnabled: true });
      } catch {
        set({ localMicEnabled: false });
      }

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
        leaveVoiceRoom();
      } catch { /* ok */ }
    }
    // Desliga os amplificadores de transmissão (>100%) para não vazar nós órfãos
    streamBoosts.forEach((_, sid) => removeStreamBoost(sid));
    // Limpa o estado "ensurdecido" no servidor ao sair da sala
    if (deafened && voiceRoomId) {
      try { getSocket().emit('voice:deafen', { voiceRoomId, serverId: get().serverId, deafened: false }); } catch { /* ok */ }
    }
    deafened = false;
    streamFocus = false;
    set({
      isDeafened: false,
      isStreamFocus: false,
      watching: new Set<string>(),
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
    // Avisa as sidebars do servidor (ícone de mic mutado ao lado do nome)
    const { voiceRoomId, serverId } = get() as any;
    if (voiceRoomId && serverId) {
      try {
        getSocket().emit('voice:live', { voiceRoomId, serverId });
      } catch { /* socket fora do ar — o polling da sidebar corrige */ }
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
      '720p60':  { width: 1280, height: 720, frameRate: 60, maxBitrate: 3_500_000 },
      '1080p30': { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
      '1080p60': { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000 },
    };

    const opts = qualityMap[quality];

    await room.localParticipant.setScreenShareEnabled(
      true,
      {
        resolution: { width: opts.width, height: opts.height, frameRate: opts.frameRate },
        audio: true, // captura áudio do sistema quando suportado
      },
      {
        // O bitrate vai nas opções de PUBLICAÇÃO — antes ia junto da resolução
        // e era ignorado: toda live saía no encoding padrão (mais baixo).
        screenShareEncoding: { maxBitrate: opts.maxBitrate, maxFramerate: opts.frameRate },
      },
    );

    set({ localScreenSharing: true, liveEndedNotice: null });
  },

  stopScreenShare: async () => {
    const { room } = get();
    if (!room) return;

    stoppingShareByUser = true;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
    } finally {
      stoppingShareByUser = false;
    }
    set({ localScreenSharing: false });
  },

  setParticipantVolume: (identity, volume) => {
    set((state) => {
      const next = new Map(state.participants);
      const p = next.get(identity);
      if (p) {
        const updated = { ...p, localVolume: volume };
        applyVolumeToTracks(updated); // individual × saída global, via gainNode
        next.set(identity, updated);
      }
      return { participants: next };
    });
  },

  // Volume da TRANSMISSÃO de tela de alguém (só para mim)
  setStreamVolume: (identity: string, volume: number) => {
    volume = Math.max(0, Math.min(120, volume)); // transmissão vai até 120%
    set((state) => {
      const next = new Map(state.participants);
      const p = next.get(identity);
      if (p) {
        const updated = { ...p, streamVolume: volume };
        applyVolumeToTracks(updated);
        next.set(identity, updated);
      }
      return { participants: next };
    });
  },

  toggleMuteLocally: (identity) => {
    set((state) => {
      const next = new Map(state.participants);
      const p = next.get(identity);
      if (p) {
        const updated = { ...p, isMutedLocally: !p.isMutedLocally };
        applyVolumeToTracks(updated);
        next.set(identity, updated);
      }
      return { participants: next };
    });
  },

  // ── Configurações de mídia aplicadas ao vivo ─────────────────
  isDeafened: false,

  toggleDeafen: () => {
    deafened = !deafened;
    set({ isDeafened: deafened });
    get().applyOutputVolume();
    // Avisa a sala e as sidebars (ícone de fone mutado ao lado do nome)
    const { voiceRoomId, serverId } = get() as any;
    if (voiceRoomId) {
      try {
        getSocket().emit('voice:deafen', { voiceRoomId, serverId, deafened });
      } catch { /* sem socket agora — o polling corrige depois */ }
    }
  },

  isStreamFocus: false,
  watching: new Set<string>(),
  setWatching: (watching: Set<string>) => set({ watching }),

  toggleStreamFocus: () => {
    streamFocus = !streamFocus;
    set({ isStreamFocus: streamFocus });
    get().applyOutputVolume();
  },

  setInputVolume: (volume) => {
    useMediaStore.getState().setInputVolume(volume);
    if (micPipeline) micPipeline.gain.gain.value = volume / 100;
  },

  applyOutputVolume: () => {
    const { participants } = get();
    participants.forEach((p) => applyVolumeToTracks(p));
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
    const { room } = get();
    // Com webAudioMix o som sai pelo AudioContext — o switchActiveDevice do
    // LiveKit troca o sinkId do contexto E dos elementos (workaround Chrome).
    if (room && deviceId) {
      try {
        await room.switchActiveDevice('audiooutput', deviceId);
        return;
      } catch { /* cai no fallback abaixo */ }
    }
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
        streamVolume: existing?.streamVolume ?? 100,
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
