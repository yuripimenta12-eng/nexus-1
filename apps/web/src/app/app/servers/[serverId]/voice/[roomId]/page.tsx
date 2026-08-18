'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  Plus, MoreHorizontal, UserPlus, ChevronLeft, Shield,
  MessageSquare, Users,
} from 'lucide-react';
import {
  LiveKitRoom,
  useLocalParticipant,
  useParticipants,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import api from '@/lib/api';

/* ── Cores e helpers ───────────────────────────────────── */
const AVATAR_COLORS = [
  'linear-gradient(135deg,#ff6a00,#7a2cff)',
  'linear-gradient(135deg,#0070f3,#00d4aa)',
  'linear-gradient(135deg,#7928ca,#ff0080)',
  'linear-gradient(135deg,#f5a623,#f53a3a)',
  'linear-gradient(135deg,#00b4d8,#7b2ff7)',
];
function avatarGrad(identity: string) {
  const idx = Math.abs(identity.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function initials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ── Página principal ──────────────────────────────────── */
export default function VoiceRoomPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params?.serverId as string;
  const roomId   = params?.roomId   as string;

  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl,   setLivekitUrl]   = useState<string | null>(null);
  const [roomName,     setRoomName]     = useState('Sala de Voz');
  const [serverName,   setServerName]   = useState('');
  const [hasError,     setHasError]     = useState(false);

  const joinRoom = useCallback(async () => {
    setHasError(false);
    setLivekitToken(null);
    setLivekitUrl(null);
    try {
      const { data } = await api.post(`/voice/rooms/${roomId}/join`);
      setLivekitToken(data.token);
      setLivekitUrl(data.livekitUrl);
      setRoomName(data.voiceRoom?.name || 'Sala de Voz');

      // Tenta pegar nome do servidor
      if (serverId) {
        api.get(`/servers/${serverId}`).then(r => setServerName(r.data?.name || ''));
      }
    } catch {
      setHasError(true);
    }
  }, [roomId, serverId]);

  useEffect(() => { if (roomId) joinRoom(); }, [roomId]);

  async function handleLeave() {
    await api.post(`/voice/rooms/${roomId}/leave`).catch(() => {});
    router.push(`/app/servers/${serverId}`);
  }

  if (hasError) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0812' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#9a90a8', fontSize: 14, marginBottom: 16 }}>Não foi possível conectar à sala.</p>
        <button onClick={joinRoom} style={{ padding: '8px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(110deg,#ff6a00,#7a2cff)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
          Tentar novamente
        </button>
      </div>
    </div>
  );

  if (!livekitToken || !livekitUrl) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0812', position: 'relative', overflow: 'hidden' }}>
      {/* partículas de fundo no loading */}
      {[
        { w:120, h:120, l:'15%', t:'20%', bg:'rgba(122,44,255,0.06)', dur:'9s', delay:'0s' },
        { w:80,  h:80,  l:'70%', t:'60%', bg:'rgba(255,106,0,0.05)',  dur:'7s', delay:'2s' },
        { w:60,  h:60,  l:'40%', t:'80%', bg:'rgba(122,44,255,0.04)', dur:'11s',delay:'1s' },
      ].map((p,i) => (
        <div key={i} className="voice-bg-particle" style={{
          width: p.w, height: p.h, left: p.l, top: p.t,
          background: `radial-gradient(circle, ${p.bg}, transparent 70%)`,
          ['--dur' as any]: p.dur, ['--delay' as any]: p.delay,
        }} />
      ))}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Spinner com glow */}
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 16px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid rgba(122,44,255,0.15)',
            borderTopColor: '#7a2cff',
            animation: 'spin 0.9s linear infinite',
            boxShadow: '0 0 20px rgba(122,44,255,0.3)',
          }} />
          <div style={{
            position: 'absolute', inset: 6,
            borderRadius: '50%',
            border: '2px solid rgba(255,106,0,0.2)',
            borderBottomColor: '#ff6a00',
            animation: 'spin 1.4s linear infinite reverse',
          }} />
        </div>
        <p style={{ color: '#b568ff', fontSize: 14, fontWeight: 600 }}>Conectando à sala...</p>
        <p style={{ color: '#4a3e5a', fontSize: 12, marginTop: 4 }}>Estabelecendo conexão segura</p>
      </div>
    </div>
  );

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={livekitToken}
      connect={true}
      audio={true}
      video={false}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0812', overflow: 'hidden' }}
      onDisconnected={handleLeave}
    >
      <VoiceRoomInner
        roomName={roomName}
        serverName={serverName}
        serverId={serverId}
        roomId={roomId}
        onLeave={handleLeave}
      />
    </LiveKitRoom>
  );
}

/* ── Interior da sala ──────────────────────────────────── */
function VoiceRoomInner({ roomName, serverName, serverId, roomId, onLeave }: {
  roomName: string; serverName: string; serverId: string; roomId: string; onLeave: () => void;
}) {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [rightTab, setRightTab] = useState<'pessoas' | 'chat'>('pessoas');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const micEnabled    = localParticipant?.isMicrophoneEnabled ?? false;
  const cameraEnabled = localParticipant?.isCameraEnabled ?? false;
  const screenSharing = localParticipant?.isScreenShareEnabled ?? false;

  // Tracks de screen share de TODOS os participantes
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const hasScreenShare = screenShareTracks.length > 0;
  const activeScreenShare = screenShareTracks[0]; // o primeiro ativo

  const toggleMic    = async () => localParticipant?.setMicrophoneEnabled(!micEnabled);
  const toggleCamera = async () => localParticipant?.setCameraEnabled(!cameraEnabled);
  const toggleScreen = async () => {
    try {
      await localParticipant?.setScreenShareEnabled(!screenSharing);
    } catch (e) {
      // Usuário cancelou o picker de tela — ignora
    }
  };

  // Grid: 1, 2 ou 4 colunas (só usado sem screen share)
  const cols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* ── Partículas de fundo ── */}
      {[
        { w:200, h:200, l:'-5%',  t:'-5%',  bg:'rgba(122,44,255,0.05)',  dur:'12s', delay:'0s' },
        { w:150, h:150, l:'80%',  t:'10%',  bg:'rgba(255,106,0,0.04)',   dur:'9s',  delay:'3s' },
        { w:100, h:100, l:'50%',  t:'70%',  bg:'rgba(122,44,255,0.04)',  dur:'15s', delay:'1s' },
        { w:80,  h:80,  l:'20%',  t:'60%',  bg:'rgba(66,230,164,0.03)',  dur:'10s', delay:'5s' },
      ].map((p,i) => (
        <div key={i} className="voice-bg-particle" style={{
          width: p.w, height: p.h, left: p.l, top: p.t,
          background: `radial-gradient(circle, ${p.bg}, transparent 70%)`,
          ['--dur' as any]: p.dur, ['--delay' as any]: p.delay,
        }} />
      ))}

      {/* ── Top bar ─────────────────────────────── */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', borderBottom: '1px solid #1c1628',
        background: 'rgba(13,10,22,0.95)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0, position: 'relative', zIndex: 2,
      }}>
        {/* Esquerda: voltar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { onLeave(); }}
            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#1a1228', color: '#9a90a8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <div>
            <p style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 15, margin: 0 }}>{roomName}</p>
            <p style={{ color: '#6b6278', fontSize: 12, margin: 0 }}>{serverName} · {participants.length} participante{participants.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Direita: conexão + timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="voice-active-glow" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(66,230,164,0.08)', border: '1px solid rgba(66,230,164,0.2)', borderRadius: 20, padding: '4px 12px' }}>
            <Shield style={{ width: 12, height: 12, color: '#42e6a4' }} />
            <span style={{ color: '#42e6a4', fontSize: 12, fontWeight: 600 }}>Conexão protegida</span>
          </div>
          <span style={{ color: '#9a90a8', fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(elapsed)}
          </span>
        </div>
      </div>

      {/* ── Conteúdo: grid + painel direito ─────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Área principal ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

          {hasScreenShare && activeScreenShare ? (
            /* ── MODO SCREEN SHARE: tela grande + thumbnails em baixo ── */
            <>
              {/* Tela compartilhada */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, position: 'relative', background: '#07050f' }}>
                {/* Badge de quem está compartilhando */}
                <div style={{
                  position: 'absolute', top: 16, left: 16, zIndex: 10,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(13,10,22,0.85)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(122,44,255,0.4)',
                  borderRadius: 20, padding: '5px 14px',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7a2cff', animation: 'pulseDot 1.8s infinite' }} />
                  <span style={{ color: '#b568ff', fontSize: 12, fontWeight: 700 }}>
                    {activeScreenShare.participant.identity === (localParticipant as any)?.identity
                      ? 'Você está compartilhando'
                      : `${activeScreenShare.participant.name || activeScreenShare.participant.identity} está compartilhando`}
                  </span>
                </div>

                {/* Vídeo da tela */}
                <div style={{
                  width: '100%', height: '100%', maxHeight: 'calc(100% - 8px)',
                  borderRadius: 16, overflow: 'hidden',
                  border: '1px solid rgba(122,44,255,0.25)',
                  boxShadow: '0 0 40px rgba(122,44,255,0.15)',
                  background: '#0a0812',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <VideoTrack
                    trackRef={activeScreenShare}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>

              {/* Thumbnails dos participantes */}
              <div style={{
                height: 110, flexShrink: 0, display: 'flex', alignItems: 'center',
                gap: 8, padding: '8px 12px',
                borderTop: '1px solid #1c1628', background: 'rgba(13,10,22,0.9)',
                overflowX: 'auto',
              }}>
                {participants.map((p, i) => (
                  <ParticipantThumb key={p.identity} participant={p} />
                ))}
              </div>
            </>
          ) : (
            /* ── MODO NORMAL: grid de participantes ── */
            <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'flex', alignItems: participants.length <= 2 ? 'center' : 'flex-start', justifyContent: 'center' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 12,
                width: '100%',
                maxWidth: participants.length <= 1 ? 480 : '100%',
              }}>
                {participants.map((p, i) => (
                  <ParticipantCard key={p.identity} participant={p} colorIdx={i} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Painel direito */}
        <div style={{ width: 280, borderLeft: '1px solid #1c1628', background: '#0d0a16', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1c1628', padding: '0 16px', gap: 4 }}>
            {(['pessoas', 'chat'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                style={{
                  padding: '14px 12px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: rightTab === tab ? '#f0eaf7' : '#6b6278', fontSize: 14, fontWeight: 600,
                  borderBottom: rightTab === tab ? '2px solid #ff6a00' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'pessoas' ? `Pessoas • ${participants.length}` : 'Chat'}
              </button>
            ))}
          </div>

          {rightTab === 'pessoas' && (
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 12px' }}>
              <p style={{ color: '#6b6278', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 8px 4px' }}>NA CHAMADA AGORA</p>

              {participants.map((p, i) => {
                const isLocal = p.identity === (localParticipant as any)?.identity;
                const role = isLocal ? 'Organizador' : p.isMicrophoneEnabled ? 'Conectado' : 'Microfone desligado';
                return (
                  <div key={p.identity} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: avatarGrad(p.identity), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {initials(p.name || p.identity)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#f0eaf7', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name || p.identity}
                      </p>
                      <p style={{ color: p.isMicrophoneEnabled ? '#42e6a4' : '#6b6278', fontSize: 11, margin: 0 }}>{role}</p>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ba55d', flexShrink: 0 }} />
                  </div>
                );
              })}

              {/* Convidar */}
              <button style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                marginTop: 12, padding: '10px 12px', borderRadius: 10,
                border: '1px dashed #2e2040', background: 'transparent', color: '#9a90a8',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7a2cff'; (e.currentTarget as HTMLButtonElement).style.color = '#b568ff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2e2040'; (e.currentTarget as HTMLButtonElement).style.color = '#9a90a8'; }}
              >
                <UserPlus style={{ width: 14, height: 14 }} />
                + Convidar amigos
              </button>
            </div>
          )}

          {rightTab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <MessageSquare style={{ width: 32, height: 32, color: '#2e2040', margin: '0 auto 12px' }} />
                <p style={{ color: '#6b6278', fontSize: 13 }}>Chat da chamada em breve</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controles ───────────────────────────── */}
      <div style={{
        height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderTop: '1px solid #1c1628', background: '#0d0a16', flexShrink: 0, padding: '0 24px',
      }}>
        {/* Mic */}
        <CtrlBtn active={micEnabled} onClick={toggleMic} danger={!micEnabled} title={micEnabled ? 'Silenciar' : 'Ativar mic'}>
          {micEnabled ? <Mic style={{ width: 18, height: 18 }} /> : <MicOff style={{ width: 18, height: 18 }} />}
        </CtrlBtn>

        {/* Câmera */}
        <CtrlBtn active={cameraEnabled} onClick={toggleCamera} danger={!cameraEnabled} title={cameraEnabled ? 'Desligar câmera' : 'Ligar câmera'}>
          {cameraEnabled ? <Video style={{ width: 18, height: 18 }} /> : <VideoOff style={{ width: 18, height: 18 }} />}
        </CtrlBtn>

        {/* Compartilhar tela — com texto */}
        <button
          onClick={toggleScreen}
          style={{
            height: 44, padding: '0 18px', borderRadius: 12,
            border: `1px solid ${screenSharing ? '#7a2cff' : '#2e2040'}`,
            background: screenSharing
              ? 'linear-gradient(135deg,rgba(122,44,255,0.25),rgba(122,44,255,0.1))'
              : '#17101f',
            color: screenSharing ? '#b568ff' : '#9a90a8',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
            boxShadow: screenSharing ? '0 0 16px rgba(122,44,255,0.2)' : 'none',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = '#7a2cff'; b.style.color = '#b568ff';
            if (!screenSharing) b.style.background = '#1e1438';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = screenSharing ? '#7a2cff' : '#2e2040';
            b.style.color = screenSharing ? '#b568ff' : '#9a90a8';
            if (!screenSharing) b.style.background = '#17101f';
          }}
        >
          <Monitor style={{ width: 16, height: 16 }} />
          {screenSharing ? 'Parar compartilhamento' : 'Compartilhar tela'}
          {screenSharing && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#b568ff', animation: 'pulseDot 1.5s infinite', marginLeft: 2 }} />
          )}
        </button>

        {/* + */}
        <CtrlBtn active={false} onClick={() => {}} title="Mais opções">
          <Plus style={{ width: 18, height: 18 }} />
        </CtrlBtn>

        {/* ... */}
        <CtrlBtn active={false} onClick={() => {}} title="Opções">
          <MoreHorizontal style={{ width: 18, height: 18 }} />
        </CtrlBtn>

        {/* Encerrar */}
        <button
          onClick={onLeave}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: '#ff4e6a', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.15s', marginLeft: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#e0334d'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ff4e6a'; (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
        >
          <PhoneOff style={{ width: 18, height: 18 }} />
        </button>
      </div>
    </div>
  );
}

/* ── Card de participante ───────────────────────────────── */
function ParticipantCard({ participant, colorIdx }: { participant: any; colorIdx: number }) {
  const speaking = participant.isSpeaking;
  const hasMic   = participant.isMicrophoneEnabled;

  return (
    <div
      className={speaking ? 'speaking-card' : ''}
      style={{
        borderRadius: 18,
        background: speaking
          ? 'radial-gradient(ellipse at 50% 80%, rgba(255,106,0,0.18) 0%, #110d1a 70%)'
          : 'radial-gradient(ellipse at 50% 80%, rgba(122,44,255,0.08) 0%, #0e0b18 70%)',
        border: `2px solid ${speaking ? '#ff6a00cc' : '#231a33'}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        position: 'relative',
        transition: 'border-color 0.3s, background 0.3s',
        animation: 'fadeInUp 0.25s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* Badge FALANDO AGORA */}
      {speaking && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,106,0,0.2)', border: '1px solid rgba(255,106,0,0.4)',
          borderRadius: 20, padding: '3px 10px',
          color: '#ff9a3d', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        }}>
          FALANDO AGORA
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: 80, height: 80, borderRadius: 22,
        background: avatarGrad(participant.identity),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, fontWeight: 800, color: '#fff',
        boxShadow: speaking ? '0 0 20px rgba(255,106,0,0.35)' : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.25s',
        marginBottom: 14,
      }}>
        {initials(participant.name || participant.identity)}
      </div>

      {/* Ondas de voz */}
      {speaking && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 14, height: 24 }}>
          {[
            { d: '0s',    minH: 4,  maxH: 20 },
            { d: '0.1s',  minH: 6,  maxH: 24 },
            { d: '0.22s', minH: 3,  maxH: 18 },
            { d: '0.05s', minH: 8,  maxH: 22 },
            { d: '0.17s', minH: 4,  maxH: 20 },
            { d: '0.28s', minH: 5,  maxH: 16 },
            { d: '0.12s', minH: 6,  maxH: 22 },
          ].map((b, i) => (
            <div key={i} style={{
              width: 3, borderRadius: 3,
              background: `linear-gradient(180deg, #ff9a3d, #ff6a00)`,
              animation: `voiceBar 0.6s cubic-bezier(0.4,0,0.6,1) ${b.d} infinite`,
              boxShadow: '0 0 6px rgba(255,106,0,0.5)',
            }} />
          ))}
        </div>
      )}

      {/* Nome e mic (fundo do card) */}
      <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ba55d', display: 'inline-block' }} />
          <span style={{ color: '#e0d8f0', fontSize: 13, fontWeight: 600 }}>{participant.name || participant.identity}</span>
        </div>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: hasMic ? 'rgba(66,230,164,0.15)' : 'rgba(255,78,106,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {hasMic
            ? <Mic style={{ width: 13, height: 13, color: '#42e6a4' }} />
            : <MicOff style={{ width: 13, height: 13, color: '#ff4e6a' }} />}
        </div>
      </div>
    </div>
  );
}

/* ── Thumbnail de participante (modo screen share) ───────── */
function ParticipantThumb({ participant }: { participant: any }) {
  const speaking = participant.isSpeaking;
  const hasMic   = participant.isMicrophoneEnabled;
  return (
    <div style={{
      width: 84, height: 84, borderRadius: 14, flexShrink: 0,
      background: speaking
        ? 'radial-gradient(ellipse at 50% 100%, rgba(255,106,0,0.25), #110d1a)'
        : 'radial-gradient(ellipse at 50% 100%, rgba(122,44,255,0.12), #0e0b18)',
      border: `2px solid ${speaking ? '#ff6a00cc' : '#231a33'}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', gap: 4,
      transition: 'border-color 0.25s',
      boxShadow: speaking ? '0 0 12px rgba(255,106,0,0.25)' : 'none',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: avatarGrad(participant.identity),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff',
      }}>
        {initials(participant.name || participant.identity)}
      </div>
      <span style={{ color: '#c0b8d0', fontSize: 10, fontWeight: 600, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
        {participant.name || participant.identity}
      </span>
      {/* Ícone mic */}
      <div style={{ position: 'absolute', bottom: 4, right: 4 }}>
        {hasMic
          ? <Mic style={{ width: 10, height: 10, color: '#42e6a4' }} />
          : <MicOff style={{ width: 10, height: 10, color: '#ff4e6a' }} />}
      </div>
      {/* Ondas de voz mini */}
      {speaking && (
        <div style={{ position: 'absolute', top: 4, left: 6, display: 'flex', gap: 1.5, alignItems: 'center', height: 10 }}>
          {[0, 0.15, 0.3].map((d, i) => (
            <div key={i} style={{ width: 2, borderRadius: 2, background: '#ff6a00', animation: `voiceBar 0.7s ease-in-out ${d}s infinite` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Botão de controle ──────────────────────────────────── */
function CtrlBtn({ children, active, onClick, danger = false, title }: {
  children: React.ReactNode; active?: boolean; onClick: () => void; danger?: boolean; title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 44, height: 44, borderRadius: 12, border: `1px solid ${danger ? 'rgba(255,78,106,0.3)' : active || hov ? '#3a2650' : '#2e2040'}`,
        background: danger ? (hov ? '#ff4e6a' : 'rgba(255,78,106,0.12)') : hov ? '#231a32' : active ? '#1e1438' : '#17101f',
        color: danger ? (hov ? '#fff' : '#ff4e6a') : active || hov ? '#f0eaf7' : '#9a90a8',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
