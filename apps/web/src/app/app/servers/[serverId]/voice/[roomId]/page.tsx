'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, Volume2, VolumeX, Users, MessageSquare, Loader2,
} from 'lucide-react';
import { Track } from 'livekit-client';
import { useVoiceStore, VoiceParticipant } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

/* ── Video tile: attaches the real camera track ───────────── */
function VideoTile({ vp, isLocal }: { vp: VoiceParticipant; isLocal: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Attach/detach video track
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const pub = Array.from(vp.participant.trackPublications.values()).find(
      p => p.source === Track.Source.Camera && p.track && !p.isMuted,
    );
    if (!pub?.track) return;
    pub.track.attach(el);
    return () => { pub.track?.detach(el); };
  });

  // Attach/detach audio track (remote only)
  useEffect(() => {
    if (isLocal) return;
    const el = audioRef.current;
    if (!el) return;
    const pub = Array.from(vp.participant.trackPublications.values()).find(
      p => p.source === Track.Source.Microphone && p.track,
    );
    if (!pub?.track) return;
    pub.track.attach(el);
    return () => { pub.track?.detach(el); };
  });

  const name = vp.displayName || vp.identity;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <motion.div
      animate={{
        boxShadow: vp.isSpeaking
          ? '0 0 0 2px #7c5af0, 0 0 24px rgba(124,90,240,0.35)'
          : '0 0 0 1px #2c1e40',
      }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'relative', borderRadius: 16, overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 38%,#1a1030 0,#0d0a16 100%)',
        minHeight: 180, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Video element (hidden when cam off) */}
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal}
        playsInline
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          display: vp.camEnabled ? 'block' : 'none',
        }}
      />

      {/* Audio element (remote only) */}
      {!isLocal && <audio ref={audioRef} autoPlay style={{ display: 'none' }} />}

      {/* Avatar fallback (when cam off) */}
      {!vp.camEnabled && (
        <div style={{
          width: 72, height: 72, borderRadius: 24, flexShrink: 0,
          background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 24, color: '#fff',
          boxShadow: vp.isSpeaking ? '0 0 24px rgba(124,90,240,0.6)' : 'none',
        }}>
          {initials}
        </div>
      )}

      {/* Speaking waves */}
      {vp.isSpeaking && (
        <div style={{ position: 'absolute', bottom: 44, display: 'flex', gap: 3, alignItems: 'flex-end' }}>
          {[0, 0.1, 0.2, 0.1, 0].map((delay, i) => (
            <div key={i} style={{
              width: 3, background: '#7c5af0', borderRadius: 3,
              animation: `voiceBar 0.6s ease-in-out ${delay}s infinite`,
            }} />
          ))}
        </div>
      )}

      {/* Nameplate */}
      <div style={{
        position: 'absolute', left: 10, bottom: 10,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 700,
      }}>
        <span style={{ color: vp.micEnabled ? '#43e3a3' : '#ff4d6d', fontSize: 10 }}>
          {vp.micEnabled ? '●' : '⊘'}
        </span>
        {name}{isLocal ? ' (você)' : ''}
      </div>

      {/* Muted locally badge */}
      {vp.isMutedLocally && (
        <div style={{
          position: 'absolute', right: 10, top: 10,
          background: 'rgba(0,0,0,0.75)', borderRadius: 6,
          padding: '4px 8px', fontSize: 10, color: '#ff9f40',
        }}>
          Silenciado
        </div>
      )}

      <style>{`
        @keyframes voiceBar {
          0%,100% { height:5px }
          50% { height:22px }
        }
      `}</style>
    </motion.div>
  );
}

/* ── Screen share tile ────────────────────────────────────── */
function ScreenShareTile({ vp }: { vp: VoiceParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const pub = Array.from(vp.participant.trackPublications.values()).find(
      p => p.source === Track.Source.ScreenShare && p.track,
    );
    if (!pub?.track) return;
    pub.track.attach(el);
    return () => { pub.track?.detach(el); };
  });

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', borderRadius: 12 }}
    />
  );
}

/* ── Control button ──────────────────────────────────────── */
function ControlBtn({
  icon, label, active, danger, onClick, disabled,
}: {
  icon: React.ReactNode; label?: string; active?: boolean;
  danger?: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={disabled ? {} : { y: -2, scale: 1.04 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        height: 48, padding: '0 16px',
        minWidth: 48,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderRadius: 14, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: danger ? '#cc3348' : active ? 'rgba(124,90,240,0.25)' : '#18111f',
        color: danger ? '#fff' : active ? '#c0a0ff' : '#c8bdd8',
        outline: active ? '1px solid rgba(124,90,240,0.5)' : '1px solid #2c1e40',
        opacity: disabled ? 0.5 : 1,
        fontSize: label ? 12 : 18, fontWeight: label ? 700 : 400,
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      {icon}
      {label && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
    </motion.button>
  );
}

/* ── Main page ───────────────────────────────────────────── */
export default function VoiceRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    room, participants, isConnected, isConnecting, error,
    localMicEnabled, localCamEnabled, localScreenSharing,
    toggleMic, toggleCam, startScreenShare, stopScreenShare,
    disconnect, toggleMuteLocally, setParticipantVolume,
  } = useVoiceStore();

  const [roomName, setRoomName] = useState('Sala de voz');
  const [sideTab, setSideTab] = useState<'people' | 'chat'>('people');
  const [chatMsg, setChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState<{ id: string; author: string; text: string }[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const serverId = params?.serverId as string | undefined;
  const roomId = params?.roomId as string | undefined;

  /* ── Join on mount ── */
  useEffect(() => {
    if (!roomId || isConnected || isConnecting) return;

    setJoining(true);
    setJoinError(null);

    api.post(`/voice/rooms/${roomId}/join`)
      .then(({ data }) => {
        const { token, livekitUrl, voiceRoom: vr } = data;
        const displayName = vr?.name ?? 'Sala de voz';
        setRoomName(displayName);
        return useVoiceStore.getState().connect(livekitUrl, token, roomId, displayName);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? err.message ?? 'Erro ao entrar na sala';
        setJoinError(msg);
      })
      .finally(() => setJoining(false));
  }, [roomId]);

  /* ── Leave on unmount ── */
  useEffect(() => {
    return () => {
      if (roomId) {
        api.post(`/voice/rooms/${roomId}/leave`).catch(() => {});
      }
      disconnect();
    };
  }, [roomId]);

  /* ── Sync room name ── */
  useEffect(() => {
    if (room && useVoiceStore.getState().roomName) {
      setRoomName(useVoiceStore.getState().roomName!);
    }
  }, [room]);

  /* ── Clock ── */
  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  /* ── Scroll chat ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function fmtTime(s: number) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  function handleLeave() {
    if (roomId) api.post(`/voice/rooms/${roomId}/leave`).catch(() => {});
    disconnect();
    router.push(serverId ? `/app/servers/${serverId}` : '/app/me');
  }

  function handleSendChat() {
    if (!chatMsg.trim()) return;
    const name = user?.username ?? 'Você';
    setChatMessages(prev => [...prev, { id: Date.now().toString(), author: name, text: chatMsg.trim() }]);
    setChatMsg('');
  }

  /* ── Derive participant list ── */
  const localIdentity = room?.localParticipant.identity;
  const participantList = Array.from(participants.values());
  const screenSharer = participantList.find(p => p.screenSharing);

  /* ── Grid columns based on count ── */
  const count = participantList.length;
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;

  /* ── Loading / error states ── */
  if (joining || isConnecting) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0d0a16', color: '#ede8f8', gap: 16,
      }}>
        <Loader2 style={{ width: 40, height: 40, color: '#7c5af0', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 15, color: '#9b8cba' }}>Entrando na sala…</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (joinError) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#0d0a16', color: '#ede8f8', gap: 16,
      }}>
        <p style={{ color: '#ff4d6d', fontSize: 15 }}>Erro: {joinError}</p>
        <button
          onClick={() => router.push(serverId ? `/app/servers/${serverId}` : '/app/me')}
          style={{
            background: '#7c5af0', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700,
          }}
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#08060c', color: '#f0ecff',
      fontFamily: 'Inter,system-ui,sans-serif', overflow: 'hidden',
    }}>
      {/* ── Top bar ── */}
      <header style={{
        height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        borderBottom: '1px solid #1e1630', background: '#0f0b1a', flexShrink: 0,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(124,90,240,0.15)', border: '1px solid rgba(124,90,240,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#9b6dff', flexShrink: 0,
        }}>
          🎙
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#ede8f8' }}>{roomName}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#6b5d80' }}>
            {count} participante{count !== 1 ? 's' : ''} · {fmtTime(seconds)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setSideTab('people')}
            style={{
              background: sideTab === 'people' ? 'rgba(124,90,240,0.15)' : 'transparent',
              border: '1px solid ' + (sideTab === 'people' ? 'rgba(124,90,240,0.3)' : '#2a1f40'),
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: sideTab === 'people' ? '#9b6dff' : '#6b5d80', fontSize: 12,
            }}
          >
            <Users style={{ width: 14, height: 14, display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {count}
          </button>
          <button
            onClick={() => setSideTab('chat')}
            style={{
              background: sideTab === 'chat' ? 'rgba(124,90,240,0.15)' : 'transparent',
              border: '1px solid ' + (sideTab === 'chat' ? 'rgba(124,90,240,0.3)' : '#2a1f40'),
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: sideTab === 'chat' ? '#9b6dff' : '#6b5d80', fontSize: 12,
            }}
          >
            <MessageSquare style={{ width: 14, height: 14, display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Chat
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Stage area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Screen share view */}
          {screenSharer && (
            <div style={{ flex: 1, padding: 12, minHeight: 0 }}>
              <ScreenShareTile vp={screenSharer} />
            </div>
          )}

          {/* Participant grid */}
          <div style={{
            flex: screenSharer ? '0 0 auto' : 1,
            padding: 12, minHeight: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${screenSharer ? Math.min(count, 6) : cols}, 1fr)`,
            gap: 10,
            overflowY: 'auto',
            maxHeight: screenSharer ? 180 : undefined,
          }}>
            {participantList.map(vp => (
              <VideoTile
                key={vp.identity}
                vp={vp}
                isLocal={vp.identity === localIdentity}
              />
            ))}

            {participantList.length === 0 && (
              <div style={{
                gridColumn: '1/-1', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#4a4560', gap: 12, padding: 40,
              }}>
                <p style={{ fontSize: 14, margin: 0 }}>Conectando à sala…</p>
              </div>
            )}
          </div>

          {/* ── Controls ── */}
          <footer style={{
            height: 80, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            borderTop: '1px solid #1e1630', background: '#0c0a14', flexShrink: 0, padding: '0 16px',
          }}>
            <ControlBtn
              icon={localMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              label={localMicEnabled ? 'Microfone' : 'Mudo'}
              active={!localMicEnabled}
              onClick={toggleMic}
            />
            <ControlBtn
              icon={localCamEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              label={localCamEnabled ? 'Câmera' : 'Câmera off'}
              active={!localCamEnabled}
              onClick={toggleCam}
            />
            <ControlBtn
              icon={localScreenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
              label={localScreenSharing ? 'Parar' : 'Tela'}
              active={localScreenSharing}
              onClick={localScreenSharing ? stopScreenShare : () => startScreenShare('1080p30')}
            />
            <div style={{ width: 1, height: 32, background: '#2a1f40', margin: '0 4px' }} />
            <ControlBtn
              icon={<PhoneOff size={18} />}
              label="Sair"
              danger
              onClick={handleLeave}
            />
          </footer>
        </div>

        {/* ── Side panel ── */}
        <AnimatePresence>
          {(sideTab === 'people' || sideTab === 'chat') && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              style={{
                borderLeft: '1px solid #1e1630', background: '#0d0a16',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
              }}
            >
              {/* Tabs */}
              <div style={{
                display: 'flex', borderBottom: '1px solid #1e1630', flexShrink: 0,
              }}>
                {(['people', 'chat'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSideTab(tab)}
                    style={{
                      flex: 1, height: 44, border: 0, background: 'transparent',
                      color: sideTab === tab ? '#c0a0ff' : '#6b5d80',
                      fontWeight: 700, cursor: 'pointer', fontSize: 12,
                      borderBottom: sideTab === tab ? '2px solid #7c5af0' : '2px solid transparent',
                    }}
                  >
                    {tab === 'people' ? `Pessoas (${count})` : 'Chat'}
                  </button>
                ))}
              </div>

              {/* People list */}
              {sideTab === 'people' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
                  {participantList.map(vp => {
                    const name = vp.displayName || vp.identity;
                    const isLocal = vp.identity === localIdentity;
                    return (
                      <div
                        key={vp.identity}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 8px', borderRadius: 10,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                          background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: 13, color: '#fff',
                        }}>
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ede8f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {name}{isLocal ? ' (você)' : ''}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: '#6b5d80' }}>
                            {vp.isSpeaking ? '🎙 Falando' : vp.micEnabled ? 'Conectado' : '🔇 Mudo'}
                          </p>
                        </div>
                        {!isLocal && (
                          <button
                            onClick={() => toggleMuteLocally(vp.identity)}
                            title={vp.isMutedLocally ? 'Ativar som' : 'Silenciar localmente'}
                            style={{
                              background: 'transparent', border: 'none', cursor: 'pointer',
                              color: vp.isMutedLocally ? '#ff9f40' : '#4a4560',
                              padding: 4,
                            }}
                          >
                            {vp.isMutedLocally ? <VolumeX size={14} /> : <Volume2 size={14} />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Chat */}
              {sideTab === 'chat' && (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chatMessages.length === 0 && (
                      <p style={{ color: '#4a4560', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
                        Sem mensagens ainda.
                      </p>
                    )}
                    {chatMessages.map(msg => (
                      <div key={msg.id} style={{
                        background: '#18111f', padding: '8px 10px', borderRadius: 10, fontSize: 12,
                      }}>
                        <p style={{ margin: '0 0 3px', color: '#9b6dff', fontWeight: 700, fontSize: 11 }}>{msg.author}</p>
                        <p style={{ margin: 0, color: '#d4cce8' }}>{msg.text}</p>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ padding: '0 10px 10px', flexShrink: 0 }}>
                    <input
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                      placeholder="Mensagem na sala…"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#18111f', border: '1px solid #2a1f40',
                        borderRadius: 10, padding: '9px 12px', color: '#ede8f8',
                        fontSize: 12, outline: 'none',
                      }}
                    />
                  </div>
                </>
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
