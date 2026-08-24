'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Video, VideoOff, Monitor,
  PhoneOff, Volume2, VolumeX, Maximize2, Minimize2,
  WifiOff, ShieldCheck, UserPlus, Users, Sliders,
  MessageSquare, PhoneMissed, UserX, Ban, Copy, ChevronDown, ShieldOff,
  MessageCircle, Send, Headphones, Settings, ChevronRight,
} from 'lucide-react';
import {
  Track,
  ConnectionQuality,
  Participant,
  LocalParticipant,
} from 'livekit-client';
import { useVoiceStore } from '@/stores/voice.store';
import { useMediaStore } from '@/stores/media.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn, getInitials } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

// Gradientes por participante (paleta da referência nexus-call)
const AVATAR_GRADIENTS: [string, string][] = [
  ['#ff7620', '#6d27d9'],
  ['#bc4cff', '#3d1c82'],
  ['#17a9cf', '#2f427c'],
  ['#ff558d', '#7b2dac'],
  ['#ffb02e', '#c2410c'],
  ['#42e6a4', '#0f766e'],
];

const CARD_GLOWS = ['#2b1a3c', '#332216', '#132934', '#2c1832', '#33270f', '#12312a'];

function hashIdentity(identity: string): number {
  let h = 0;
  for (let i = 0; i < identity.length; i++) h = (h * 31 + identity.charCodeAt(i)) >>> 0;
  return h;
}

function gradientFor(identity: string): [string, string] {
  return AVATAR_GRADIENTS[hashIdentity(identity) % AVATAR_GRADIENTS.length];
}

function glowFor(identity: string): string {
  return CARD_GLOWS[hashIdentity(identity) % CARD_GLOWS.length];
}

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
    participants, quality, voiceRoomId, roomName,
    isDeafened, toggleDeafen,
  } = useVoiceStore();

  const askScreenQuality = useMediaStore(s => s.askScreenQuality);
  const [screenQuality, setScreenQuality] = useState<'720p30' | '1080p30' | '1080p60'>(
    () => useMediaStore.getState().screenQuality,
  );
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false); // painel lateral no celular
  const [audioPopover, setAudioPopover] = useState(false); // popover de áudio rápido
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [sideTab, setSideTab] = useState<'people' | 'chat' | 'audio'>('people');

  // ── Chat efêmero da sala (vive só enquanto a chamada dura) ────
  interface CallChatMsg { userId: string; content: string; ts: number; }
  const [chatMessages, setChatMessages] = useState<CallChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sideTabRef = useRef(sideTab);
  sideTabRef.current = sideTab;

  useEffect(() => {
    const socket = getSocket();
    const onChat = (msg: CallChatMsg) => {
      setChatMessages(prev => [...prev.slice(-199), msg]);
      if (sideTabRef.current !== 'chat') setChatUnread(n => n + 1);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };
    socket.on('voice:chat', onChat);
    return () => { socket.off('voice:chat', onChat); };
  }, [roomId]);

  const sendChat = () => {
    const content = chatInput.trim();
    if (!content) return;
    getSocket().emit('voice:chat', { voiceRoomId: roomId, content });
    setChatInput('');
  };

  const chatNameFor = (id: string) => {
    const p = participants.get(id);
    return p?.participant?.name || (id === user?.id ? 'Você' : id.slice(0, 8));
  };
  const [toast, setToast] = useState<string | null>(null);

  // Cargos dos membros (para o menu de moderação por participante)
  const [membersMeta, setMembersMeta] = useState<Record<string, { role: string; mutedBy: boolean }>>({});
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}/members`)
      .then(({ data }) => {
        const map: Record<string, { role: string; mutedBy: boolean }> = {};
        data.forEach((m: any) => { map[m.userId] = { role: m.role, mutedBy: m.mutedBy }; });
        setMembersMeta(map);
      })
      .catch(() => {});
  }, [serverId]);

  const ROLE_RANK: Record<string, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 };
  const myRole = membersMeta[user?.id || '']?.role || 'MEMBER';
  const canModerate = myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'MODERATOR';
  const canModerateTarget = (identity: string) =>
    canModerate && identity !== user?.id &&
    (ROLE_RANK[membersMeta[identity]?.role || 'MEMBER'] > ROLE_RANK[myRole]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

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
      await connect(data.livekitUrl, data.token, roomId, data.voiceRoom.name, serverId);
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
      // Sem "perguntar antes", usa a qualidade padrão das configurações
      await startScreenShare(askScreenQuality ? screenQuality : undefined);
    }
  };

  const handleInvite = async () => {
    try {
      const { data } = await api.post(`/invites/servers/${serverId}`, { expiresInHours: 168 });
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.code}`);
      notify('Link de convite copiado!');
    } catch {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
      notify('Link da sala copiado!');
    }
  };

  // ── Moderação a partir da chamada ────────────────────────────
  const modMute = async (identity: string, muted: boolean) => {
    try {
      await api.patch(`/moderation/servers/${serverId}/mute/${identity}`, { muted });
      setMembersMeta(prev => ({ ...prev, [identity]: { ...prev[identity], mutedBy: muted } }));
      notify(muted ? 'Silenciado no servidor' : 'Microfone liberado no servidor');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const modVoiceKick = async (identity: string) => {
    try {
      await api.post(`/voice/rooms/${roomId}/kick/${identity}`);
      notify('Participante desconectado da sala');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const modKick = async (identity: string) => {
    try {
      await api.post(`/moderation/servers/${serverId}/kick/${identity}`, {});
      notify('Membro expulso do servidor');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const modBan = async (identity: string) => {
    try {
      await api.post(`/moderation/servers/${serverId}/ban/${identity}`, {});
      notify('Membro banido do servidor');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const participantsList = Array.from(participants.values());
  const screenSharers = participantsList.filter(p => p.screenSharing);
  const primaryScreenSharer = focusedParticipant
    ? participantsList.find(p => p.identity === focusedParticipant && p.screenSharing)
    : screenSharers[0];

  if (isConnecting || isJoining) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--th-bg)]">
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
      <div className="flex-1 flex items-center justify-center bg-[var(--th-bg)]">
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
    <div className={cn('flex flex-col nx-stage-bg', isFullscreen ? 'fixed inset-0 z-50' : 'flex-1')}>
      {/* Renderizador de áudio remoto (oculto) */}
      <AudioRenderer />

      <div className="flex-1 flex overflow-hidden">
        {/* Palco */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <div className="h-[70px] flex items-center px-5 border-b border-[var(--th-line-2)] bg-[var(--th-rail)] backdrop-blur-md shrink-0">
            <div className="w-[38px] h-[38px] grid place-items-center rounded-xl bg-[#22142f] text-[#c887ff] mr-3">
              <Volume2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white text-[15px] font-semibold truncate">{roomName || 'Sala de Voz'}</h1>
              <p className="text-[#92879f] text-[11px]">
                {participantsList.length} participante{participantsList.length !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="ml-auto hidden sm:flex items-center gap-1.5 text-[#8bdcb9] text-[11px] border border-[#26523f] rounded-full px-2.5 py-1.5">
              <ShieldCheck className="w-3 h-3" /> Conexão protegida
            </span>
            <CallTimer connected={isConnected} />
            {/* Abre o painel Pessoas/Chat/Áudio no celular */}
            <button
              onClick={() => { setPanelOpen(true); setChatUnread(0); }}
              className="lg:hidden relative ml-2 text-muted hover:text-white p-1.5 rounded-lg transition-colors"
              title="Pessoas e chat"
            >
              <Users className="w-4 h-4" />
              {chatUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange text-white
                                 text-[8px] font-black grid place-items-center">
                  {chatUnread > 9 ? '+' : chatUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="ml-2 text-muted hover:text-white p-1.5 rounded-lg transition-colors"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Área principal */}
          {primaryScreenSharer ? (
            <div className="flex-1 relative bg-black overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoTrackRenderer
                  participant={primaryScreenSharer.participant}
                  source={Track.Source.ScreenShare}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-2 text-white text-xs bg-[#09070d]/75 backdrop-blur px-2.5 py-1.5 rounded-lg font-semibold">
                <Monitor className="w-3.5 h-3.5 text-[#c887ff]" />
                {primaryScreenSharer.participant.name || primaryScreenSharer.identity}
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
                        className="relative w-32 h-20 rounded-lg overflow-hidden bg-black border-2 border-[var(--th-line-2)] hover:border-accent transition-colors"
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
                      'w-28 h-20 rounded-lg overflow-hidden bg-[#14101a] border-2',
                      p.isSpeaking ? 'border-[#8f42ff]' : 'border-[var(--th-line-2)]',
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
            /* Grid de participantes */
            <div className="flex-1 overflow-auto p-[18px]">
              <div className={cn(
                'grid gap-3 h-full content-stretch',
                participantsList.length === 1 && 'grid-cols-1 max-w-2xl mx-auto',
                participantsList.length === 2 && 'grid-cols-1 sm:grid-cols-2',
                participantsList.length > 2 && participantsList.length <= 4 && 'grid-cols-1 sm:grid-cols-2',
                participantsList.length > 4 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
              )}>
                {participantsList.map(p => (
                  <ParticipantTile key={p.identity} voiceParticipant={p} />
                ))}
              </div>
            </div>
          )}

          {/* Controles */}
          <div className="h-[84px] flex items-center justify-center gap-1.5 sm:gap-2.5 border-t border-[var(--th-line-2)] bg-[var(--th-rail)] shrink-0 px-2 sm:px-3 overflow-x-auto">
            <ControlButton
              onClick={toggleMic}
              danger={!localMicEnabled}
              title={localMicEnabled ? 'Desativar microfone' : 'Ativar microfone'}
            >
              {localMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </ControlButton>

            <ControlButton
              onClick={toggleDeafen}
              danger={isDeafened}
              title={isDeafened ? 'Reativar áudio da chamada' : 'Silenciar tudo (não ouvir ninguém)'}
            >
              {isDeafened ? <VolumeX className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
            </ControlButton>

            {/* Áudio rápido: dispositivo de saída + volume geral */}
            <div className="relative">
              <ControlButton
                onClick={() => setAudioPopover(v => !v)}
                active={audioPopover}
                title="Áudio da chamada"
              >
                <Volume2 className="w-5 h-5" />
              </ControlButton>
              <AnimatePresence>
                {audioPopover && (
                  <QuickAudioPopover onClose={() => setAudioPopover(false)} />
                )}
              </AnimatePresence>
            </div>

            <ControlButton
              onClick={toggleCam}
              active={localCamEnabled}
              title={localCamEnabled ? 'Desativar câmera' : 'Ativar câmera'}
            >
              {localCamEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </ControlButton>

            <button
              onClick={handleScreenShare}
              title={localScreenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
              className={cn(
                'h-12 px-4 rounded-[15px] border text-xs font-extrabold flex items-center gap-2 transition-all',
                'hover:-translate-y-0.5',
                localScreenSharing
                  ? 'bg-[#2a173e] text-[#dcaaff] border-[#8849bf]'
                  : 'bg-[var(--th-panel-2)] text-[#d1c6da] border-[var(--th-line-2)] hover:border-[#7842a0] hover:bg-[#21152c]',
              )}
            >
              <Monitor className="w-[17px] h-[17px]" />
              <span className="hidden md:inline">{localScreenSharing ? 'Parar tela' : 'Compartilhar tela'}</span>
            </button>

            {!localScreenSharing && askScreenQuality && (
              <select
                value={screenQuality}
                onChange={(e) => setScreenQuality(e.target.value as any)}
                className="h-12 text-xs bg-[var(--th-panel-2)] border border-[var(--th-line-2)] rounded-[15px] px-2 text-[#d1c6da] focus:outline-none focus:border-[#7842a0]"
              >
                <option value="720p30">720p 30fps</option>
                <option value="1080p30">1080p 30fps</option>
                <option value="1080p60">1080p 60fps</option>
              </select>
            )}

            <button
              onClick={handleLeave}
              title="Sair da chamada"
              className="w-[66px] h-12 rounded-[15px] bg-[#ff405b] hover:bg-red-600 text-white
                         flex items-center justify-center transition-all active:scale-95 ml-2"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Fundo escurecido atrás do painel (só mobile) */}
        {panelOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setPanelOpen(false)} />
        )}

        {/* Painel lateral: fixo no desktop, gaveta pela direita no celular */}
        <aside className={cn(
          'flex-col border-l border-[var(--th-line-2)] bg-[var(--th-side)] shrink-0',
          'lg:flex lg:static lg:w-[280px] lg:z-auto lg:shadow-none',
          panelOpen
            ? 'flex fixed inset-y-0 right-0 z-50 w-[min(320px,85vw)] shadow-2xl'
            : 'hidden',
        )}>
          <div className="h-[70px] flex items-end px-3.5 border-b border-[var(--th-line-2)] shrink-0">
            <button
              onClick={() => setSideTab('people')}
              className={cn(
                'h-[45px] flex-1 font-extrabold text-sm flex items-center justify-center gap-1.5 transition-colors',
                sideTab === 'people' ? 'text-white border-b-2 border-orange' : 'text-[#81758d] hover:text-white',
              )}
            >
              <Users className="w-3.5 h-3.5" /> Pessoas · {participantsList.length}
            </button>
            <button
              onClick={() => { setSideTab('chat'); setChatUnread(0); }}
              className={cn(
                'relative h-[45px] flex-1 font-extrabold text-sm flex items-center justify-center gap-1.5 transition-colors',
                sideTab === 'chat' ? 'text-white border-b-2 border-orange' : 'text-[#81758d] hover:text-white',
              )}
            >
              <MessageCircle className="w-3.5 h-3.5" /> Chat
              {chatUnread > 0 && sideTab !== 'chat' && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-orange text-white
                                 text-[9px] font-black grid place-items-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setSideTab('audio')}
              className={cn(
                'h-[45px] flex-1 font-extrabold text-sm flex items-center justify-center gap-1.5 transition-colors',
                sideTab === 'audio' ? 'text-white border-b-2 border-orange' : 'text-[#81758d] hover:text-white',
              )}
            >
              <Sliders className="w-3.5 h-3.5" /> Áudio
            </button>
          </div>

          {sideTab === 'people' ? (
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-[11px] text-[#786e83] uppercase tracking-[1.2px] font-bold mb-3">
                Na chamada agora
              </h3>
              {participantsList.map((p: any) => {
                const [c1, c2] = gradientFor(p.identity);
                const isMe = p.participant instanceof LocalParticipant;
                const expanded = expandedMember === p.identity;
                const role = membersMeta[p.identity]?.role;
                const serverMuted = membersMeta[p.identity]?.mutedBy;
                return (
                  <div key={p.identity} className={cn('rounded-xl transition-colors', expanded && 'bg-[var(--th-panel-2)] border border-[var(--th-line-2)]')}>
                    <button
                      onClick={() => setExpandedMember(expanded ? null : p.identity)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[var(--th-panel-2)] text-left"
                    >
                      <div
                        className="w-9 h-9 rounded-xl grid place-items-center font-black text-[11px] text-white shrink-0"
                        style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
                      >
                        {getInitials(p.participant.name || p.identity)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <b className="block text-white text-xs truncate">
                          {p.participant.name || p.identity}{isMe ? ' (você)' : ''}
                          {role && role !== 'MEMBER' && (
                            <span className="ml-1.5 text-[9px] font-extrabold text-[#d3a8ef]">
                              {role === 'OWNER' ? '👑' : role === 'ADMIN' ? '🛡️' : '⚖️'}
                            </span>
                          )}
                        </b>
                        <small className={cn('text-[10px]', serverMuted ? 'text-destructive' : 'text-[#92879f]')}>
                          {serverMuted ? 'Silenciado no servidor'
                            : p.isSpeaking ? 'Falando...'
                            : p.micEnabled ? 'Conectado' : 'Microfone desligado'}
                        </small>
                      </div>
                      <span className={cn(
                        'w-[7px] h-[7px] rounded-full shrink-0',
                        p.isSpeaking ? 'bg-success shadow-[0_0_8px_#42e6a4]' : p.micEnabled ? 'bg-success/60' : 'bg-[#5c5468]',
                      )} />
                      <ChevronDown className={cn('w-3.5 h-3.5 text-[#5c5468] shrink-0 transition-transform', expanded && 'rotate-180')} />
                    </button>

                    {/* Ações do participante */}
                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 pt-1 space-y-1">
                            {!isMe && (
                              <>
                                <MenuAction
                                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                                  label="Enviar mensagem"
                                  onClick={() => router.push(`/app/dms/${p.identity}`)}
                                />
                                {/* Volume individual */}
                                <div className="px-2 py-1.5">
                                  <div className="flex items-center justify-between mb-1">
                                    <small className="text-[10px] text-[#92879f] font-bold uppercase tracking-wider">Volume do usuário</small>
                                    <span className="text-[10px] text-white font-black tabular-nums">
                                      {p.isMutedLocally ? 0 : (p.localVolume ?? 100)}%
                                    </span>
                                  </div>
                                  <input
                                    type="range" min={0} max={100}
                                    value={p.isMutedLocally ? 0 : (p.localVolume ?? 100)}
                                    disabled={p.isMutedLocally}
                                    onChange={(e) => useVoiceStore.getState().setParticipantVolume(p.identity, Number(e.target.value))}
                                    className="nx-range"
                                    style={{ ['--fill' as any]: `${p.isMutedLocally ? 0 : (p.localVolume ?? 100)}%` }}
                                  />
                                </div>
                                <MenuAction
                                  icon={p.isMutedLocally ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                                  label={p.isMutedLocally ? 'Reativar áudio para mim' : 'Silenciar para mim'}
                                  onClick={() => useVoiceStore.getState().toggleMuteLocally(p.identity)}
                                />
                                <MenuAction
                                  icon={<ShieldOff className="w-3.5 h-3.5" />}
                                  label="Bloquear usuário"
                                  danger
                                  onClick={async () => {
                                    try {
                                      await api.post(`/moderation/block/${p.identity}`);
                                      notify('Usuário bloqueado — gerencie em Privacidade & Segurança');
                                    } catch {
                                      notify('Não foi possível bloquear');
                                    }
                                  }}
                                />
                              </>
                            )}

                            {canModerateTarget(p.identity) && (
                              <>
                                <div className="border-t border-[var(--th-line-2)] my-1.5" />
                                <p className="px-2 text-[9px] text-[#786e83] font-extrabold uppercase tracking-wider">Moderação</p>
                                <MenuAction
                                  icon={serverMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                                  label={serverMuted ? 'Liberar microfone no servidor' : 'Silenciar no servidor'}
                                  danger={!serverMuted}
                                  onClick={() => modMute(p.identity, !serverMuted)}
                                />
                                <MenuAction
                                  icon={<PhoneMissed className="w-3.5 h-3.5" />}
                                  label="Desconectar da sala"
                                  danger
                                  onClick={() => modVoiceKick(p.identity)}
                                />
                                <MenuAction
                                  icon={<UserX className="w-3.5 h-3.5" />}
                                  label="Expulsar do servidor"
                                  danger
                                  onClick={() => modKick(p.identity)}
                                />
                                <MenuAction
                                  icon={<Ban className="w-3.5 h-3.5" />}
                                  label="Banir do servidor"
                                  danger
                                  onClick={() => modBan(p.identity)}
                                />
                              </>
                            )}

                            <MenuAction
                              icon={<Copy className="w-3.5 h-3.5" />}
                              label="Copiar ID do usuário"
                              onClick={() => { navigator.clipboard.writeText(p.identity); notify('ID copiado'); }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              <button
                onClick={handleInvite}
                className="w-full mt-4 border border-dashed border-[#4d3560] rounded-[13px] p-3 text-[#b99dcf]
                           text-sm text-center bg-[var(--th-panel-2)] hover:border-accent hover:text-white transition-colors
                           flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Convidar amigos
              </button>
            </div>
          ) : sideTab === 'chat' ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-[#786e83] text-xs text-center py-8">
                    Converse por texto sem sair da chamada.
                    <br />As mensagens somem quando a sala esvazia.
                  </p>
                )}
                {chatMessages.map((m, i) => {
                  const mine = m.userId === user?.id;
                  const [c1, c2] = gradientFor(m.userId);
                  const prevSame = i > 0 && chatMessages[i - 1].userId === m.userId;
                  return (
                    <div key={`${m.ts}-${i}`} className={cn('flex gap-2', prevSame && '-mt-1')}>
                      {!prevSame ? (
                        <div
                          className="w-7 h-7 rounded-lg grid place-items-center font-black text-[9px] text-white shrink-0 mt-0.5"
                          style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
                        >
                          {getInitials(chatNameFor(m.userId))}
                        </div>
                      ) : (
                        <div className="w-7 shrink-0" />
                      )}
                      <div className="min-w-0">
                        {!prevSame && (
                          <b className={cn('block text-[11px]', mine ? 'text-orange' : 'text-[#d3a8ef]')}>
                            {chatNameFor(m.userId)}
                          </b>
                        )}
                        <p className="text-[#d2cadb] text-xs leading-relaxed break-words bg-[var(--th-panel-2)]
                                      rounded-lg px-2.5 py-1.5 inline-block max-w-full">
                          {m.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-[var(--th-line-2)] shrink-0">
                <div className="flex items-center gap-2 bg-[var(--th-panel-2)] border border-[var(--th-line-2)]
                                rounded-xl px-3 py-2 focus-within:border-accent transition-colors">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                    placeholder="Mensagem para a sala..."
                    maxLength={1000}
                    className="flex-1 bg-transparent text-white text-xs focus:outline-none placeholder:text-[#786e83]"
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    className={cn(
                      'w-7 h-7 rounded-lg grid place-items-center transition-all active:scale-95 shrink-0',
                      chatInput.trim()
                        ? 'bg-gradient-to-br from-orange to-accent text-white'
                        : 'text-[#786e83]',
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <VoiceAudioPanel />
          )}
        </aside>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[100px] z-50 px-4 py-2.5 rounded-xl
                       bg-[#1a1024] border border-[#6f36a1] text-white text-sm shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Popover de áudio rápido (dispositivo de saída + volume geral) ─
function QuickAudioPopover({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ms = useMediaStore();
  const { switchAudioOutput, applyOutputVolume, isDeafened, toggleDeafen } = useVoiceStore();
  const [speakers, setSpeakers] = useState<{ deviceId: string; label: string }[]>([]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => {
        setSpeakers(
          devices
            .filter(d => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Saída ${i + 1}` })),
        );
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {/* clique fora fecha */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-50 w-[280px]
                   bg-[var(--th-panel-2)] border border-[var(--th-line-2)] rounded-2xl shadow-2xl p-4"
      >
        {/* Dispositivo de saída */}
        <label className="block">
          <b className="block text-white text-sm mb-0.5">Dispositivo de saída</b>
          <div className="flex items-center gap-1 text-[#92879f]">
            <select
              value={ms.audioOutputId}
              onChange={(e) => switchAudioOutput(e.target.value)}
              className="flex-1 bg-transparent text-xs focus:outline-none cursor-pointer py-1
                         [&>option]:bg-[var(--th-panel-2)] text-[#b8b0cc]"
            >
              <option value="">Padrão do sistema</option>
              {speakers.map(s => (
                <option key={s.deviceId} value={s.deviceId}>{s.label}</option>
              ))}
            </select>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </label>

        <div className="h-px bg-[var(--th-line-2)] my-3" />

        {/* Volume de saída */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <b className="text-white text-sm">Volume de saída</b>
            <span className="text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full text-white
                             bg-gradient-to-r from-orange to-accent">
              {isDeafened ? 0 : ms.outputVolume}%
            </span>
          </div>
          <input
            type="range" min={0} max={100}
            value={isDeafened ? 0 : ms.outputVolume}
            disabled={isDeafened}
            onChange={(e) => { ms.setOutputVolume(Number(e.target.value)); applyOutputVolume(); }}
            className="nx-range"
            style={{ ['--fill' as any]: `${isDeafened ? 0 : ms.outputVolume}%` }}
          />
        </div>

        {/* Silenciar tudo */}
        <button
          onClick={toggleDeafen}
          className={cn(
            'w-full mt-3 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors',
            isDeafened
              ? 'bg-destructive/15 text-destructive'
              : 'text-[#cfc6dd] hover:bg-[#21152c] hover:text-white',
          )}
        >
          {isDeafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
          {isDeafened ? 'Reativar áudio da chamada' : 'Silenciar toda a chamada'}
        </button>

        <div className="h-px bg-[var(--th-line-2)] my-3" />

        {/* Configurações completas */}
        <button
          onClick={() => router.push('/app/me/settings?section=voice')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold
                     text-[#cfc6dd] hover:bg-[#21152c] hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" /> Configurações de voz
        </button>
      </motion.div>
    </>
  );
}

// ── Item de ação no menu do participante ─────────────────────────
function MenuAction({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
        danger
          ? 'text-[#ff8598] hover:bg-destructive/15 hover:text-destructive'
          : 'text-[#cfc6dd] hover:bg-[#21152c] hover:text-white',
      )}
    >
      {icon} {label}
    </button>
  );
}

// ── Timer da chamada ──────────────────────────────────────────────
function CallTimer({ connected }: { connected: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!connected) { setSeconds(0); return; }
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);

  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');

  return (
    <span className="ml-2.5 px-2.5 py-1.5 text-[#b4a7c0] bg-[var(--th-panel-2)] rounded-full text-[11px] tabular-nums">
      {h}:{m}:{s}
    </span>
  );
}

// ── Painel de áudio: volume e mute local por participante ────────
function VoiceAudioPanel() {
  const { participants, room, setParticipantVolume, toggleMuteLocally } = useVoiceStore();
  const localIdentity = room?.localParticipant.identity;
  const remotes = Array.from(participants.values()).filter(p => p.identity !== localIdentity);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      <h3 className="text-[11px] text-[#786e83] uppercase tracking-[1.2px] font-bold mb-1">
        Áudio dos participantes
      </h3>

      {remotes.length === 0 && (
        <p className="text-[#92879f] text-xs text-center py-6">
          Ninguém mais na chamada ainda.
        </p>
      )}

      {remotes.map((p: any) => {
        const [c1, c2] = gradientFor(p.identity);
        return (
          <div key={p.identity} className="bg-[var(--th-panel)] border border-[var(--th-line)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-lg grid place-items-center font-black text-[10px] text-white shrink-0"
                style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
              >
                {getInitials(p.participant.name || p.identity)}
              </div>
              <span className="text-white text-sm font-medium truncate flex-1">
                {p.participant.name || p.identity}
              </span>
              <button
                onClick={() => toggleMuteLocally(p.identity)}
                title={p.isMutedLocally ? 'Reativar áudio para mim' : 'Silenciar para mim'}
                className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                  p.isMutedLocally
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white'
                    : 'text-muted hover:text-white hover:bg-[#21152c]',
                )}
              >
                {p.isMutedLocally ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={p.isMutedLocally ? 0 : (p.localVolume ?? 100)}
                disabled={p.isMutedLocally}
                onChange={(e) => setParticipantVolume(p.identity, Number(e.target.value))}
                className="flex-1 accent-[#7a2cff] disabled:opacity-40"
              />
              <span className="text-muted text-xs w-10 text-right tabular-nums">
                {p.isMutedLocally ? '0' : (p.localVolume ?? 100)}%
              </span>
            </div>
          </div>
        );
      })}
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
function AudioRenderer() {
  const { participants } = useVoiceStore() as any;
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    participants.forEach((vp: any) => {
      const { participant, identity } = vp;

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
            const ms = useMediaStore.getState();
            if (ms.audioOutputId) (el as any).setSinkId?.(ms.audioOutputId)?.catch?.(() => {});
            container.appendChild(el);
            pub.track.attach(el);
            attachedRef.current.set(key, el);
            // Volume centralizado (individual × geral × silenciar tudo)
            useVoiceStore.getState().applyOutputVolume();
          }
        }
      });
    });

    attachedRef.current.forEach((el, key) => {
      const identity = key.split(':')[0];
      if (!participants.has(identity)) {
        el.remove();
        attachedRef.current.delete(key);
      }
    });
  }, [participants]);

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
  const hasCam = voiceParticipant.camEnabled;
  const identity = voiceParticipant.identity;
  const name = voiceParticipant.participant.name || identity;
  const [c1, c2] = gradientFor(identity);
  const glow = glowFor(identity);
  const speaking = voiceParticipant.isSpeaking;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative rounded-[19px] overflow-hidden min-h-[190px] border transition-all duration-300',
        speaking
          ? 'border-[#8f42ff] shadow-[inset_0_0_0_2px_rgba(255,106,0,0.4),0_0_32px_rgba(122,44,255,0.2)] -translate-y-px'
          : 'border-[var(--th-line-2)]',
      )}
      style={{ background: `radial-gradient(circle at 50% 38%, ${glow} 0, #14101a 53%, #100c15 100%)` }}
    >
      {hasCam ? (
        <VideoTrackRenderer
          participant={voiceParticipant.participant}
          source={Track.Source.Camera}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-content-center text-center">
          <div
            className={cn(
              'w-[82px] h-[82px] mx-auto grid place-items-center rounded-[28px] text-[25px] font-black text-white',
              'shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-shadow',
              speaking && 'ring-1 ring-[#b565ff] ring-offset-4 ring-offset-transparent shadow-[0_0_22px_rgba(255,106,0,0.4)]',
            )}
            style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
          >
            {getInitials(name)}
          </div>

          {/* Ondas de voz */}
          <div className={cn(
            'h-7 mt-2.5 flex items-center justify-center gap-[3px] transition-opacity',
            speaking ? 'opacity-100' : 'opacity-20',
          )}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <span
                key={i}
                className="block w-[3px] h-[5px] rounded"
                style={{
                  background: 'linear-gradient(#ff6a00, #7a2cff)',
                  animation: speaking ? `nx-voice 0.72s ease-in-out infinite` : 'none',
                  animationDelay: `${[0, 0.12, 0.24, 0.36, 0.24, 0.12, 0][i]}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Selo "falando agora" */}
      {speaking && (
        <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-[#100b16]/85 border border-[#6c35a2]
                         text-[#d8aefe] text-[9px] uppercase tracking-wider font-black">
          Falando agora
        </span>
      )}

      {/* Nameplate */}
      <div className="absolute left-3 bottom-3 flex items-center gap-2 px-2.5 py-1.5 rounded-[10px]
                      bg-[#09070d]/75 backdrop-blur font-bold text-white text-sm">
        <span className="truncate max-w-[140px]">{name}</span>
        {voiceParticipant.micEnabled ? (
          <Mic className="w-3 h-3 text-[#a89cb4]" />
        ) : (
          <MicOff className="w-3 h-3 text-[#ff6b7f]" />
        )}
        {voiceParticipant.screenSharing && <Monitor className="w-3 h-3 text-[#c887ff]" />}
      </div>

      {/* Qualidade de rede */}
      <span className="absolute right-3.5 bottom-3.5">
        <ConnectionQualityBars quality={voiceParticipant.connectionQuality} />
      </span>
    </motion.div>
  );
}

function ConnectionQualityBars({ quality }: { quality: ConnectionQuality }) {
  const color = {
    [ConnectionQuality.Excellent]: '#4ce0a2',
    [ConnectionQuality.Good]: '#4ce0a2',
    [ConnectionQuality.Poor]: '#f59e0b',
    [ConnectionQuality.Lost]: '#ff405b',
    [ConnectionQuality.Unknown]: '#5c5468',
  }[quality] || '#5c5468';

  const active = {
    [ConnectionQuality.Excellent]: 3,
    [ConnectionQuality.Good]: 2,
    [ConnectionQuality.Poor]: 1,
    [ConnectionQuality.Lost]: 0,
    [ConnectionQuality.Unknown]: 0,
  }[quality] ?? 0;

  return (
    <span className="flex items-end gap-[2px]">
      {[4, 7, 10].map((h, i) => (
        <span
          key={i}
          className="block w-[3px] rounded-sm"
          style={{ height: h, background: i < active ? color : '#3a3145' }}
        />
      ))}
    </span>
  );
}

function ControlButton({
  children, onClick, title, active, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'min-w-[48px] h-12 rounded-[15px] border flex items-center justify-center transition-all',
        'hover:-translate-y-0.5 active:scale-95',
        danger
          ? 'bg-destructive/10 text-destructive border-destructive/40 hover:bg-destructive hover:text-white hover:border-destructive'
          : active
            ? 'bg-[#2a173e] text-[#dcaaff] border-[#8849bf]'
            : 'bg-[var(--th-panel-2)] text-[#d1c6da] border-[var(--th-line-2)] hover:border-[#7842a0] hover:bg-[#21152c]',
      )}
    >
      {children}
    </button>
  );
}
