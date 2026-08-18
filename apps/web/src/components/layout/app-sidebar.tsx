'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Hash, Volume2, ChevronDown, Settings, Mic, MicOff,
  PhoneOff, Search, Megaphone, Video, Monitor, Bell,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';

interface Channel  { id: string; name: string; type: string; }
interface VoiceRoom { id: string; name: string; }
interface Member   { userId: string; user: { profile?: { displayName?: string; status?: string; avatarUrl?: string }; username: string } }
interface Server   { id: string; name: string; iconUrl: string | null; channels: Channel[]; voiceRooms: VoiceRoom[]; members?: Member[] }

const STATUS_BG: Record<string, string> = {
  ONLINE: '#3ba55d', IDLE: '#faa81a', DND: '#ed4245', OFFLINE: '#747f8d',
};

const AVATAR_COLORS = [
  'linear-gradient(135deg,#ff6a00,#7a2cff)',
  'linear-gradient(135deg,#0070f3,#00d4aa)',
  'linear-gradient(135deg,#7928ca,#ff0080)',
  'linear-gradient(135deg,#f5a623,#f53a3a)',
];
function avatarGrad(seed: string) {
  const idx = Math.abs(seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function AppSidebar() {
  const params           = useParams();
  const router           = useRouter();
  const { user }         = useAuthStore();
  const { isConnected, roomName, localMicEnabled, toggleMic, disconnect, voiceRoomId } = useVoiceStore();

  const serverId       = params?.serverId as string;
  const activeChannelId = params?.channelId as string;
  const activeRoomId    = params?.roomId    as string;

  const [server, setServer] = useState<Server | null>(null);
  const [search, setSearch] = useState('');
  const [sections, setSections] = useState({ text: true, voice: true, live: true });

  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}`).then(({ data }) => setServer(data));
  }, [serverId]);

  if (!serverId || !server) return <DMSidebar />;

  const textChannels = server.channels.filter(
    c => (c.type === 'TEXT' || c.type === 'ANNOUNCEMENT') && c.name.toLowerCase().includes(search.toLowerCase())
  );
  // COMECE AQUI: announcements; CANAIS DE TEXTO: text
  const announceChannels = textChannels.filter(c => c.type === 'ANNOUNCEMENT');
  const regularChannels  = textChannels.filter(c => c.type === 'TEXT');
  const voiceRooms       = server.voiceRooms.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ width: 270, background: '#110d19', borderRight: '1px solid #1e1828', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>

      {/* ── Header ─── */}
      <SidebarHeader label={server.name} />

      {/* ── Busca ─── */}
      <div style={{ padding: '10px 10px 6px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: '#4a3d5a', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar canal..."
            style={{ width: '100%', background: '#0c0910', border: '1px solid #26193a', borderRadius: 8, padding: '6px 10px 6px 28px', fontSize: 12, color: '#cfc5d8', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => (e.currentTarget.style.borderColor = '#7a2cff')}
            onBlur={e => (e.currentTarget.style.borderColor = '#26193a')}
          />
        </div>
      </div>

      {/* ── Canais ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>

        {/* COMECE AQUI */}
        {announceChannels.length > 0 && (
          <>
            <SectionLabel label="COMECE AQUI" />
            {announceChannels.map(ch => (
              <ChanItem key={ch.id} label={ch.name} isActive={activeChannelId === ch.id}
                onClick={() => router.push(`/app/servers/${serverId}/channels/${ch.id}`)}
                icon={<Bell style={{ width: 15, height: 15, flexShrink: 0, color: activeChannelId === ch.id ? '#b568ff' : '#6b6278' }} />} />
            ))}
          </>
        )}

        {/* CANAIS DE TEXTO */}
        {regularChannels.length > 0 && (
          <>
            <CollapseSection label="CANAIS DE TEXTO" open={sections.text} onToggle={() => setSections(s => ({ ...s, text: !s.text }))} />
            {sections.text && regularChannels.map(ch => (
              <ChanItem key={ch.id} label={ch.name} isActive={activeChannelId === ch.id}
                onClick={() => router.push(`/app/servers/${serverId}/channels/${ch.id}`)}
                icon={<Hash style={{ width: 15, height: 15, flexShrink: 0, color: activeChannelId === ch.id ? '#b568ff' : '#6b6278' }} />} />
            ))}
          </>
        )}

        {/* NEXUS ÁUDIO */}
        {voiceRooms.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <CollapseSection label="NEXUS ÁUDIO" open={sections.voice} onToggle={() => setSections(s => ({ ...s, voice: !s.voice }))} />
            {sections.voice && voiceRooms.map(room => {
              const inRoom  = voiceRoomId === room.id;
              const isActive = activeRoomId === room.id || inRoom;
              return (
                <div key={room.id}>
                  <ChanItem
                    label={room.name}
                    isActive={isActive}
                    onClick={() => router.push(`/app/servers/${serverId}/voice/${room.id}`)}
                    icon={<Volume2 style={{ width: 15, height: 15, flexShrink: 0, color: inRoom ? '#42e6a4' : isActive ? '#b568ff' : '#6b6278' }} />}
                    suffix={inRoom ? <WaveBars /> : undefined}
                  />
                  {/* Participantes dentro da sala (quando alguém está) */}
                  {inRoom && server.members?.filter(m => m.userId === user?.id).map(m => (
                    <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 4px 28px' }}>
                      <div style={{ width: 20, height: 20, borderRadius: 6, background: avatarGrad(m.user.username), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {getInitials(m.user.profile?.displayName || m.user.username)}
                      </div>
                      <span style={{ color: '#42e6a4', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.user.profile?.displayName || m.user.username}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* NEXUS LIVE */}
        <div style={{ marginTop: 14 }}>
          <CollapseSection label="NEXUS LIVE" open={sections.live} onToggle={() => setSections(s => ({ ...s, live: !s.live }))} />
          {sections.live && (
            <>
              <ChanItem label="Sala de Vídeo" isActive={false} onClick={() => {}}
                icon={<Video style={{ width: 15, height: 15, flexShrink: 0, color: '#6b6278' }} />} />
              <ChanItem label="Compartilhar Tela" isActive={false} onClick={() => {}}
                icon={<Monitor style={{ width: 15, height: 15, flexShrink: 0, color: '#6b6278' }} />} />
            </>
          )}
        </div>
      </div>

      {/* ── Rodapé ─── */}
      <div style={{ borderTop: '1px solid #1e1828' }}>

        {/* Em chamada */}
        {isConnected && (
          <div style={{ padding: '8px 8px 0', animation: 'slideInUp 0.25s cubic-bezier(0.22,1,0.36,1) both' }}>
            <div className="voice-active-glow" style={{ background: '#0a1f12', border: '1px solid rgba(66,230,164,0.2)', borderRadius: 10, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <WaveBarsLarge />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#42e6a4', fontSize: 11, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>Em chamada · Excelente</p>
                <p style={{ color: '#7a7087', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roomName}</p>
              </div>
              <button
                onClick={async () => { await disconnect(); router.push(`/app/servers/${serverId}`); }}
                title="Sair da chamada"
                style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,78,106,0.12)', border: '1px solid rgba(255,78,106,0.25)', color: '#ff4e6a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ff4e6a'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,78,106,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#ff4e6a'; }}
              >
                <PhoneOff style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>
        )}

        {/* Usuário */}
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: avatarGrad(user?.username || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {getInitials(user?.profile?.displayName || user?.username || '?')}
            </div>
            <span
              className={user?.profile?.status === 'ONLINE' ? 'status-online' : ''}
              style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: STATUS_BG[user?.profile?.status || 'OFFLINE'], border: '2px solid #110d19' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#f0eaf7', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
              {user?.profile?.displayName || user?.username}
            </p>
            <p style={{ color: '#42e6a4', fontSize: 11, margin: 0 }}>● Conectado</p>
          </div>

          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <IconBtn title={localMicEnabled ? 'Silenciar' : 'Ativar mic'} danger={!localMicEnabled} onClick={toggleMic}>
              {localMicEnabled ? <Mic style={{ width: 14, height: 14 }} /> : <MicOff style={{ width: 14, height: 14 }} />}
            </IconBtn>
            <IconBtn title="Configurações" onClick={() => router.push('/app/me/settings')}>
              <Settings style={{ width: 14, height: 14 }} />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────── */

function SidebarHeader({ label }: { label: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ height: 52, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px', borderBottom: '1px solid #1e1828', flexShrink: 0, background: hov ? '#18122a' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}
    >
      <span style={{ color: '#6b6278', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Espaço conectado</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <span style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <ChevronDown style={{ width: 14, height: 14, color: '#9a90a8', flexShrink: 0 }} />
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p style={{ color: '#6b6278', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', margin: '12px 4px 4px', userSelect: 'none' }}>{label}</p>
  );
}

function CollapseSection({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '4px 4px', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: 4 }}>
      <ChevronDown style={{ width: 12, height: 12, color: '#6b6278', transition: 'transform 0.15s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#6b6278', flex: 1, textAlign: 'left' }}>{label}</span>
    </button>
  );
}

function ChanItem({ label, isActive, onClick, icon, suffix }: {
  label: string; isActive: boolean; onClick: () => void; icon: React.ReactNode; suffix?: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '7px 10px', borderRadius: 9, border: 'none',
        background: isActive
          ? 'linear-gradient(90deg, rgba(122,44,255,0.12), rgba(122,44,255,0.04))'
          : hov ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: isActive || hov ? '#f0eaf7' : '#9a90a8',
        cursor: 'pointer', fontSize: 14, textAlign: 'left',
        transition: 'all 0.15s cubic-bezier(0.22,1,0.36,1)',
        position: 'relative',
        boxShadow: isActive ? 'inset 0 0 20px rgba(122,44,255,0.05)' : 'none',
      }}
    >
      {/* Barra ativa animada */}
      {isActive && <span className="channel-active-bar" />}
      {icon}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {suffix}
    </button>
  );
}

function WaveBars() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, height: 16 }}>
      {[
        { d: '0s', opacity: 1 },
        { d: '0.18s', opacity: 0.9 },
        { d: '0.35s', opacity: 0.8 },
        { d: '0.12s', opacity: 1 },
      ].map((b, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 2, borderRadius: 2,
          background: 'linear-gradient(180deg,#5eebb0,#42e6a4)',
          boxShadow: '0 0 4px rgba(66,230,164,0.4)',
          opacity: b.opacity,
          animation: `voiceWave 0.9s cubic-bezier(0.4,0,0.6,1) ${b.d} infinite`,
        }} />
      ))}
    </span>
  );
}

function WaveBarsLarge() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 2, height: 20 }}>
      {[
        { d: '0s' }, { d: '0.12s' }, { d: '0.25s' }, { d: '0.37s' }, { d: '0.18s' },
      ].map((b, i) => (
        <span key={i} style={{
          display: 'inline-block', width: 3, borderRadius: 3,
          background: 'linear-gradient(180deg,#5eebb0,#42e6a4)',
          boxShadow: '0 0 6px rgba(66,230,164,0.3)',
          animation: `voiceWave 0.85s cubic-bezier(0.4,0,0.6,1) ${b.d} infinite`,
        }} />
      ))}
    </span>
  );
}

function IconBtn({ children, title, onClick, danger = false }: {
  children: React.ReactNode; title: string; onClick?: () => void; danger?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: 28, height: 28, borderRadius: 7, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', background: hov ? (danger ? '#ff4e6a' : '#231a32') : danger ? 'rgba(255,78,106,0.1)' : 'transparent', color: hov ? '#fff' : danger ? '#ff4e6a' : '#9188a2' }}
    >
      {children}
    </button>
  );
}

function DMSidebar() {
  const { user } = useAuthStore();
  return (
    <div style={{ width: 270, background: '#110d19', borderRight: '1px solid #1e1828', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #1e1828', flexShrink: 0 }}>
        <p style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 15, margin: 0 }}>Mensagens Diretas</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        <p style={{ color: '#6b6278', fontSize: 12, padding: '4px 8px' }}>Nenhuma conversa ainda</p>
      </div>
      {user && (
        <div style={{ borderTop: '1px solid #1e1828', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: 'linear-gradient(135deg,#ff6a00,#7a2cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
            {getInitials(user.profile?.displayName || user.username || '?')}
          </div>
          <div>
            <p style={{ color: '#f0eaf7', fontSize: 13, fontWeight: 600, margin: 0 }}>{user.profile?.displayName}</p>
            <p style={{ color: '#6b6278', fontSize: 11, margin: 0 }}>@{user.username}</p>
          </div>
        </div>
      )}
    </div>
  );
}
