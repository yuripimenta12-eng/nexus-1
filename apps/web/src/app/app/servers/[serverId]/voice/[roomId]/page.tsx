'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Settings, Volume2, VolumeX, Maximize2, Minimize2,
  Wifi, WifiOff, Users, ChevronDown,
} from 'lucide-react';
import {
  Track,
  ConnectionQuality,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  TrackPublication,
  VideoTrack,
} from 'livekit-client';
import { VideoTrack as LKVideoTrack, useParticipants, useLocalParticipant } from '@livekit/components-react';
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
  const [showSettings, setShowSettings] = useState(false);

  // Conecta ao entrar na página
  useEffect(() => {
    if (isConnected && voiceRoomId === roomId) return;

    async function joinRoom() {
      try {
        const { data } = await api.post(`/voice/rooms/${roomId}/join`);
        await connect(data.livekitUrl, data.token, roomId, data.voiceRoom.name);
      } catch (err: any) {
        console.error('Erro ao entrar na sala:', err);
      }
    }

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

  if (isConnecting) {
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

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-white font-semibold mb-2">Erro na conexão</h3>
          <p className="text-muted text-sm mb-4">{error}</p>
          <button onClick={() => router.push(`/app/servers/${serverId}`)} className="btn-ghost">
            Voltar ao servidor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col bg-background-secondary', isFullscreen ? 'fixed inset-0 z-50' : 'flex-1')}>
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
          <span className="text-muted text-xs">{participantsList.length} participante{participantsList.length !== 1 ? 's' : ''}</span>
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
        {/* Conteúdo (vídeos/tela) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Screen share principal */}
          {primaryScreenSharer ? (
            <div className="flex-1 relative bg-black overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <ParticipantScreenShare
                  participant={primaryScreenSharer.participant}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute bottom-3 left-3 text-white text-xs bg-black/60 px-2 py-1 rounded-md">
                🖥️ {primaryScreenSharer.participant.name || primaryScreenSharer.identity}
              </div>

              {/* Outros screen shares */}
              {screenSharers.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-2">
                  {screenSharers.filter(p => p.identity !== primaryScreenSharer?.identity).map(p => (
                    <button
                      key={p.identity}
                      onClick={() => setFocusedParticipant(p.identity)}
                      className="relative w-32 h-20 rounded-lg overflow-hidden bg-black border-2 border-border hover:border-accent transition-colors"
                    >
                      <ParticipantScreenShare participant={p.participant} className="w-full h-full object-cover" />
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
                  <div key={p.identity} className={cn(
                    'w-28 h-20 rounded-lg overflow-hidden bg-surface-overlay border-2 border-border',
                    p.isSpeaking && 'border-accent speaking-ring',
                  )}>
                    <ParticipantCamera participant={p.participant} />
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

        {/* Configurações */}
        <div className="w-48 flex justify-end">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-ghost"
          >
            <Settings className="w-4 h-4 mr-1" />
            Configurações
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tile de participante ──────────────────────────────────────
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
      {/* Vídeo da câmera */}
      {hasCam ? (
        <ParticipantCamera participant={voiceParticipant.participant} className="absolute inset-0 w-full h-full object-cover" />
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
                <div key={i} className="w-1 bg-accent rounded-full animate-bounce"
                  style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.1}s` }} />
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

function ControlButton({ active, onClick, activeIcon, inactiveIcon, activeTitle, inactiveTitle, danger, accent }: any) {
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

// ── Wrappers para tracks LiveKit ───────────────────────────────
function ParticipantCamera({ participant, className }: { participant: Participant; className?: string }) {
  const camPub = Array.from(participant.trackPublications.values()).find(
    p => p.source === Track.Source.Camera && p.track,
  );

  if (!camPub?.track) return null;

  return (
    <LKVideoTrack
      trackRef={{ participant, source: Track.Source.Camera }}
      className={className}
    />
  );
}

function ParticipantScreenShare({ participant, className }: { participant: Participant; className?: string }) {
  const screenPub = Array.from(participant.trackPublications.values()).find(
    p => p.source === Track.Source.ScreenShare && p.track,
  );

  if (!screenPub?.track) return null;

  return (
    <LKVideoTrack
      trackRef={{ participant, source: Track.Source.ScreenShare }}
      className={className}
    />
  );
}
