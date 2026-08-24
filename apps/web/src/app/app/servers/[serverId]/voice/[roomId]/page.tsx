'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor,
  PhoneOff, Settings, Volume2, VolumeX, Maximize2, Minimize2,
  Wifi, WifiOff,
} from 'lucide-react';
import {
  Track,
  ConnectionQuality,
  Participant,
  RemoteParticipant,
  LocalParticipant,
} from 'livekit-client';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import api from '@/lib/api';

export default function VoicePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const serverId = params.serverId as string;
  const { user } = useAuthStore();

  const {
    connect, disconnect, isConnected, isConnecting, error,
    localMicEnabled, localCamEnabled, localScreenSharing,
    toggleMic, toggleCam, startScreenShare, stopScreenShare,
    participants, quality, voiceRoomId,
  } = useVoiceStore();

  const [screenQuality, setScreenQuality] = useState<'720p30' | '1080p30' | '1080p60'>('1080p30');
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  function friendlyError(msg: string): string {
    if (msg?.includes('invalid api key') || msg?.includes('invalid API key')) {
      return 'Credenciais de voz inválidas. Contate o administrador do servidor.';
    }
    if (msg?.includes('not found') || msg?.includes('404')) {
      return 'Sala de voz não encontrada.';
    }
    if (msg?.includes('forbidden') || msg?.includes('403')) {
      return 'Você não tem permissão para entrar nesta sala.';
    }
    if (msg?.includes('network') || msg?.includes('timeout') || msg?.includes('timed out')) {
      return 'Erro de rede. Verifique sua conexão e tente novamente.';
    }
    return msg || 'Erro desconhecido ao conectar.';
  }

  const joinRoom = async () => {
    if (isConnected && voiceRoomId === roomId) return;
    setJoinError(null);
    setIsJoining(true);
    try {
      const { data } = await api.post(`/voice/rooms/${roomId}/join`);
      await connect(data.livekitUrl, data.token, roomId, data.voiceRoom.name);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao conectar';
      setJoinError(friendlyError(msg));
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    joinRoom();
  }, [roomId]);

  const handleLeave = async () => {
    await api.post(`/voice/rooms/${roomId}/leave`).catch(() => {});
    await disconnect();
    router.push(`/app/servers/${serverId}`);
  };

  const handleScreenShare = async () => {
    if (localScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare(screenQuality);
    }
  };

  const participantsList = Array.from(participants.values());
  const screenSharers = participantsList.filter(p => p.screenSharing);
  const primaryScreenSharer = focusedParticipant
    ? participantsList.find(p => p.identity === focusedParticipant && p.screenSharing)
    : screenSharers[0];

  const qualityColor = {
    [ConnectionQuality.Excellent]: 'text-success',
    [ConnectionQuality.Good]: 'text-success',
    [ConnectionQuality.Poor]: 'text-warning',
    [ConnectionQuality.Lost]: 'text-destructive',
    [ConnectionQuality.Unknown]: 'text-muted',
  }[quality] || 'text-muted';

  if (isConnecting || isJoining) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white font-medium">Conectando à sala...</p>
          <p className="text-muted text-sm mt-1">Aguarde enquanto configuramos sua conexão</p>
        </div>
      </div>
    );
  }

  const displayError = joinError || error;

  if (displayError) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-white font-semibold mb-2">Erro na conexão</h3>
          <p className="text-muted text-sm mb-6">{displayError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setJoinError(null); joinRoom(); }}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
            >
              Tentar novamente
            </button>
            <button onClick={() => router.push(`/app/servers/${serverId}`)} className="btn-ghost">
              Voltar ao servidor
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col bg-background-secondary', isFullscreen ? 'fixed inset-0 z-50' : 'flex-1')}>
      {/* Renderizador de áudio remoto (oculto) */}
      <AudioRenderer />

      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 bg-background-secondary border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted" />
          <span className="text-white font-medium text-sm">Sala de Voz</span>
          <span className={cn('text-xs flex items-center gap-1', qualityColor)}>
            <Wifi className="w-3 h-3" />
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted text-xs">
            {participantsList.length} participante{participantsList.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-muted hover:text-white p-1 rounded transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Screen share principal */}
          {primaryScreenSharer ? (
            <div className="flex-1 relative bg-black overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoTrackRenderer
                  participant={primaryScreenSharer.participant}
                  source={Track.Source.ScreenShare}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute bottom-3 left-3 text-white text-xs bg-black/60 px-2 py-1 rounded-md">
                🖥️ {primaryScreenSharer.participant.name || primaryScreenSharer.identity}
              </div>

              {/* Outros screen shares */}
              {screenSharers.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-2">
                  {screenSharers
                    .filter(p => p.identity !== primaryScreenSharer?.identity)
                    .map(p => (
                      <button
                        key={p.identity}
                        onClick={() => setFocusedParticipant(p.identity)}
                        className="relative w-32 h-20 rounded-lg overflow-hidden bg-black border-2 border-border hover:border-accent transition-colors"
                      >
                        <VideoTrackRenderer
                          participant={p.participant}
                          source={Track.Source.ScreenShare}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-1 left-1 text-white text-[10px] bg-black/60 px-1 rounded">
                          {p.participant.name || p.identity}
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {/* Mini câmeras */}
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                {participantsList.filter(p => p.camEnabled).slice(0, 4).map(p => (
                  <div
                    key={p.identity}
                    className={cn(
                      'w-28 h-20 rounded-lg overflow-hidden bg-surface-overlay border-2 border-border',
                      p.isSpeaking && 'border-accent',
                    )}
                  >
                    <VideoTrackRenderer
                      participant={p.participant}
                      source={Track.Source.Camera}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Sem screen share: grid de participantes */
            <div className="flex-1 overflow-auto p-4">
              <div className={cn(
                'grid gap-3 h-full content-start',
                participantsList.length === 1 && 'grid-cols-1 max-w-md mx-auto',
                participantsList.length === 2 && 'grid-cols-2',
                participantsList.length <= 4 && participantsList.length > 2 && 'grid-cols-2',
                participantsList.length > 4 && 'grid-cols-3',
              )}>
                {participantsList.map(p => (
                  <ParticipantTile key={p.identity} voiceParticipant={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de controles */}
      <div className="h-20 flex items-center justify-between px-6 bg-background border-t border-border shrink-0">
        {/* Info da chamada */}
        <div className="flex items-center gap-2 min-w-0 w-48">
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">Sala de Voz</p>
            <p className={cn('text-xs', qualityColor)}>
              {quality === ConnectionQuality.Excellent && '● Excelente'}
              {quality === ConnectionQuality.Good && '● Boa'}
              {quality === ConnectionQuality.Poor && '⚠ Ruim'}
              {quality === ConnectionQuality.Lost && '✕ Sem conexão'}
              {quality === ConnectionQuality.Unknown && '○ Conectando'}
            </p>
          </div>
        </div>

        {/* Controles centrais */}
        <div className="flex items-center gap-3">
          <ControlButton
            active={localMicEnabled}
            onClick={toggleMic}
            activeIcon={<Mic className="w-5 h-5" />}
            inactiveIcon={<MicOff className="w-5 h-5" />}
            activeTitle="Desativar microfone"
            inactiveTitle="Ativar microfone"
            danger={!localMicEnabled}
          />

          <ControlButton
            active={localCamEnabled}
            onClick={toggleCam}
            activeIcon={<Video className="w-5 h-5" />}
            inactiveIcon={<VideoOff className="w-5 h-5" />}
            activeTitle="Desativar câmera"
            inactiveTitle="Ativar câmera"
          />

          <ControlButton
            active={localScreenSharing}
            onClick={handleScreenShare}
            activeIcon={<Monitor className="w-5 h-5" />}
            inactiveIcon={<Monitor className="w-5 h-5" />}
            activeTitle="Parar compartilhamento"
            inactiveTitle="Compartilhar tela"
            accent={localScreenSharing}
          />

          {/* Qualidade de screen share */}
          {!localScreenSharing && (
            <select
              value={screenQuality}
              onChange={(e) => setScreenQuality(e.target.value as any)}
              className="text-xs bg-surface border border-border rounded-md px-2 py-1 text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="720p30">720p 30fps</option>
              <option value="1080p30">1080p 30fps</option>
              <option value="1080p60">1080p 60fps</option>
            </select>
          )}

          {/* Sair */}
          <button
            onClick={handleLeave}
            className="h-11 px-5 rounded-xl bg-destructive hover:bg-red-600 text-white
                       flex items-center gap-2 transition-colors active:scale-95 font-medium text-sm"
          >
            <PhoneOff className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Espaço direito (simetria) */}
        <div className="w-48" />
      </div>
    </div>
  );
}

// ── Renderizador de vídeo bruto (sem @livekit/components-react) ──
function VideoTrackRenderer({
  participant,
  source,
  className,
}: {
  participant: Participant;
  source: Track.Source;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pega a publicação de track atual
  const pub = Array.from(participant.trackPublications.values()).find(
    p => p.source === source && p.track,
  );
  const track = pub?.track ?? null;

  useEffect(() => {
    const el = videoRef.current;
    if (!track || !el) return;

    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  if (!track) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted // vídeo é sempre mudo; áudio é tratado pelo AudioRenderer
      className={className}
    />
  );
}

// ── Renderizador de áudio para participantes remotos ─────────────
// Cria elementos <audio> fora do React DOM para não depender de
// rerender; usa data-lk-identity para que setParticipantVolume funcione.
function AudioRenderer() {
  const { participants, room } = useVoiceStore() as any;
  const containerRef = useRef<HTMLDivElement>(null);
  // Rastreia quais tracks já têm elementos de áudio
  const attachedRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    participants.forEach((vp: any) => {
      const { participant, identity } = vp;

      // Não renderiza áudio local
      if (participant instanceof LocalParticipant) return;

      Array.from(participant.trackPublications.values()).forEach((pub: any) => {
        if (
          pub.kind === Track.Kind.Audio &&
          pub.track &&
          pub.isSubscribed
        ) {
          const key = `${identity}:${pub.trackSid}`;
          if (!attachedRef.current.has(key)) {
            const el = document.createElement('audio');
            el.autoplay = true;
            el.dataset.lkIdentity = identity;
            container.appendChild(el);
            pub.track.attach(el);
            attachedRef.current.set(key, el);
          }
        }
      });
    });

    // Remove áudio de participantes que saíram
    attachedRef.current.forEach((el, key) => {
      const identity = key.split(':')[0];
      if (!participants.has(identity)) {
        el.remove();
        attachedRef.current.delete(key);
      }
    });
  }, [participants]);

  // Cleanup ao desmontar a página
  useEffect(() => {
    return () => {
      attachedRef.current.forEach(el => el.remove());
      attachedRef.current.clear();
    };
  }, []);

  return <div ref={containerRef} aria-hidden className="hidden" />;
}

// ── Tile de participante ──────────────────────────────────────────
function ParticipantTile({ voiceParticipant }: { voiceParticipant: any }) {
  const { setParticipantVolume, toggleMuteLocally } = useVoiceStore();
  const hasCam = voiceParticipant.camEnabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative rounded-xl overflow-hidden bg-surface aspect-video flex items-center justify-center',
        'border-2 transition-colors',
        voiceParticipant.isSpeaking ? 'border-accent' : 'border-border',
      )}
    >
      {hasCam ? (
        <VideoTrackRenderer
          participant={voiceParticipant.participant}
          source={Track.Source.Camera}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Avatar
            src={null}
            name={voiceParticipant.participant.name || voiceParticipant.identity}
            size="xl"
          />
          {voiceParticipant.isSpeaking && (
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1 bg-accent rounded-full animate-bounce"
                  style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-white text-xs font-medium truncate">
            {voiceParticipant.participant.name || voiceParticipant.identity}
          </span>
          <div className="flex items-center gap-1">
            {!voiceParticipant.micEnabled && (
              <MicOff className="w-3 h-3 text-destructive" />
            )}
            {voiceParticipant.screenSharing && (
              <Monitor className="w-3 h-3 text-accent" />
            )}
            <ConnectionQualityDot quality={voiceParticipant.connectionQuality} />
          </div>
        </div>
      </div>

      {/* Speaking ring */}
      {voiceParticipant.isSpeaking && (
        <div className="absolute inset-0 border-2 border-accent rounded-xl pointer-events-none animate-pulse" />
      )}
    </motion.div>
  );
}

function ConnectionQualityDot({ quality }: { quality: ConnectionQuality }) {
  const color = {
    [ConnectionQuality.Excellent]: 'bg-success',
    [ConnectionQuality.Good]: 'bg-success',
    [ConnectionQuality.Poor]: 'bg-warning',
    [ConnectionQuality.Lost]: 'bg-destructive',
    [ConnectionQuality.Unknown]: 'bg-muted',
  }[quality] || 'bg-muted';

  return <div className={cn('w-2 h-2 rounded-full', color)} />;
}

function ControlButton({
  active, onClick, activeIcon, inactiveIcon,
  activeTitle, inactiveTitle, danger, accent,
}: any) {
  return (
    <button
      onClick={onClick}
      title={active ? activeTitle : inactiveTitle}
      className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-95',
        accent
          ? 'bg-accent text-white hover:bg-accent-hover'
          : danger && !active
            ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white'
            : active
              ? 'bg-surface-raised text-white hover:bg-surface-overlay'
              : 'bg-surface-raised text-muted hover:bg-surface-overlay hover:text-white',
      )}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
