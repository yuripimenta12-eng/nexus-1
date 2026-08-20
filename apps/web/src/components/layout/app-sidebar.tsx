'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Hash, Volume2, ChevronDown, Plus, Settings,
  Mic, MicOff, PhoneOff, X, MessageSquarePlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useSocketStore } from '@/stores/socket.store';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

interface Conversation {
  partner: {
    id: string;
    username: string;
    profile?: { displayName?: string; avatarUrl?: string; status?: string } | null;
  };
  lastMessage: { content: string; createdAt: string; fromSelf: boolean };
  unread: number;
}
function statusColor(s?: string) {
  return s === 'ONLINE' ? '#43e3a3' : s === 'AWAY' ? '#f0b429' : s === 'BUSY' ? '#ff4d6d' : '#4a4560';
}

interface Channel  { id: string; name: string; type: string; }
interface VoiceRoom{ id: string; name: string; }
interface Server   { id: string; name: string; iconUrl: string | null; channels: Channel[]; voiceRooms: VoiceRoom[]; }

/* ── Glassmorphism card wrapper ─────────────────── */
const glass: React.CSSProperties = {
  background:    'linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))',
  backdropFilter:'blur(12px)',
  border:        '1px solid rgba(255,255,255,0.08)',
};

export function AppSidebar() {
  const params  = useParams();
  const router  = useRouter();
  const { user } = useAuthStore();
  const { isConnected, roomName, localMicEnabled, toggleMic, disconnect, voiceRoomId } = useVoiceStore();

  const serverId       = params?.serverId as string;
  const activeChannelId= params?.channelId as string;
  const activeRoomId   = params?.roomId    as string;

  const [server,          setServer         ] = useState<Server | null>(null);
  const [textOpen,        setTextOpen       ] = useState(true);
  const [voiceOpen,       setVoiceOpen      ] = useState(true);
  const [showCreateVoice, setShowCreateVoice] = useState(false);
  const [newRoomName,     setNewRoomName    ] = useState('');
  const [creating,        setCreating       ] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}`).then(({ data }) => setServer(data));
  }, [serverId]);

  const handleCreateVoiceRoom = async () => {
    if (!newRoomName.trim() || !serverId) return;
    setCreating(true);
    try {
      const { data } = await api.post(`/voice/servers/${serverId}/rooms`, { name: newRoomName.trim() });
      setServer(prev => prev ? { ...prev, voiceRooms: [...prev.voiceRooms, data] } : prev);
      setNewRoomName('');
      setShowCreateVoice(false);
    } catch (err: any) {
      console.error('Erro ao criar sala de voz:', err);
    } finally {
      setCreating(false);
    }
  };

  if (!serverId || !server) return <DMSidebar />;

  return (
    <div
      style={{
        width: 240,
        minWidth: 240,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f0c1a',
        borderRight: '1px solid #1e1630',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Server header ──────────────────────────── */}
      <button
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid #1e1630',
          cursor: 'pointer',
          transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,90,240,0.06)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
      >
        <span style={{ color: '#ede8f8', fontWeight: 800, fontSize: 14, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {server.name}
        </span>
        <ChevronDown style={{ width: 15, height: 15, color: '#7a748e', flexShrink: 0 }} />
      </button>

      {/* ── Channel list ───────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '8px 6px',
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a1f40 transparent',
        }}
      >
        {/* Text channels section */}
        <SectionHeader
          label="CANAIS DE TEXTO"
          open={textOpen}
          onToggle={() => setTextOpen(!textOpen)}
        >
          <Plus
            style={{ width: 14, height: 14 }}
            onClick={e => { e.stopPropagation(); }}
          />
        </SectionHeader>

        <AnimatePresence initial={false}>
          {textOpen && server.channels
            .filter(c => c.type === 'TEXT' || c.type === 'ANNOUNCEMENT')
            .map(ch => (
              <ChannelItem
                key={ch.id}
                icon={<Hash style={{ width: 15, height: 15, flexShrink: 0 }} />}
                label={ch.name}
                active={activeChannelId === ch.id}
                onClick={() => router.push(`/app/servers/${serverId}/channels/${ch.id}`)}
              />
            ))
          }
        </AnimatePresence>

        {/* Voice rooms section */}
        <div style={{ marginTop: 16 }}>
          <SectionHeader
            label="SALAS DE VOZ"
            open={voiceOpen}
            onToggle={() => setVoiceOpen(!voiceOpen)}
          >
            <Plus
              style={{ width: 14, height: 14 }}
              onClick={e => { e.stopPropagation(); setShowCreateVoice(true); }}
            />
          </SectionHeader>

          <AnimatePresence initial={false}>
            {voiceOpen && server.voiceRooms.map(room => {
              const isActive  = activeRoomId === room.id;
              const isInRoom  = voiceRoomId  === room.id;
              return (
                <ChannelItem
                  key={room.id}
                  icon={<Volume2 style={{ width: 15, height: 15, flexShrink: 0 }} />}
                  label={room.name}
                  active={isActive || isInRoom}
                  onClick={() => router.push(`/app/servers/${serverId}/voice/${room.id}`)}
                  badge={isInRoom
                    ? <span style={{
                        marginLeft: 'auto',
                        width: 7, height: 7,
                        borderRadius: '50%',
                        background: '#2dd67b',
                        boxShadow: '0 0 6px #2dd67b',
                        flexShrink: 0,
                        animation: 'nx-pulse-dot 1.8s infinite',
                      }} />
                    : null
                  }
                />
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── User panel ─────────────────────────────── */}
      <div style={{ borderTop: '1px solid #1e1630', flexShrink: 0 }}>

        {/* In-call banner */}
        {isConnected && (
          <div style={{ padding: '8px 8px 0' }}>
            <div
              style={{
                ...glass,
                borderRadius: 10,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(45,214,123,0.07)',
                border: '1px solid rgba(45,214,123,0.18)',
              }}
            >
              <span
                style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#2dd67b',
                  boxShadow: '0 0 6px #2dd67b',
                  flexShrink: 0,
                  animation: 'nx-pulse-dot 1.8s infinite',
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#2dd67b', fontSize: 11, fontWeight: 700, margin: 0, letterSpacing: 0.3 }}>
                  EM CHAMADA
                </p>
                <p style={{ color: '#7a748e', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {roomName}
                </p>
              </div>
              <button
                onClick={async () => { await disconnect(); router.push(`/app/servers/${serverId}`); }}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'rgba(255,68,68,0.12)',
                  border: '1px solid rgba(255,68,68,0.2)',
                  color: '#ff4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#ff4444';
                  (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.12)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#ff4444';
                }}
                title="Sair da chamada"
              >
                <PhoneOff style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
        )}

        {/* User info strip */}
        <div
          style={{
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar
              src={user?.profile?.avatarUrl}
              name={user?.profile?.displayName || user?.username || '?'}
              size="sm"
            />
            <span
              style={{
                position: 'absolute',
                bottom: -1, right: -1,
                width: 10, height: 10,
                borderRadius: '50%',
                background: '#2dd67b',
                border: '2px solid #0f0c1a',
                boxShadow: '0 0 6px #2dd67b',
              }}
            />
          </div>

          {/* Name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: '#ede8f8', fontSize: 13, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
              {user?.profile?.displayName}
            </p>
            <p style={{ color: '#7a748e', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{user?.username}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <IconBtn
              onClick={toggleMic}
              danger={!localMicEnabled}
              title={localMicEnabled ? 'Silenciar' : 'Ativar microfone'}
            >
              {localMicEnabled
                ? <Mic style={{ width: 14, height: 14 }} />
                : <MicOff style={{ width: 14, height: 14 }} />
              }
            </IconBtn>
            <IconBtn
              onClick={() => router.push('/app/me')}
              title="Configurações"
            >
              <Settings style={{ width: 14, height: 14 }} />
            </IconBtn>
          </div>
        </div>
      </div>

      {/* ── Create voice room modal ─────────────────── */}
      <AnimatePresence>
        {showCreateVoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateVoice(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit   ={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 380, margin: '0 16px',
                borderRadius: 18,
                background: 'linear-gradient(145deg,#18112a,#100d1f)',
                border: '1px solid #2a1f40',
                boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
                padding: 24,
              }}
            >
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ color: '#ede8f8', fontWeight: 900, fontSize: 18, margin: 0 }}>
                  Nova Sala de Voz
                </h3>
                <button
                  onClick={() => setShowCreateVoice(false)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid #2a1f40',
                    color: '#7a748e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#ede8f8';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.color = '#7a748e';
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Input */}
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#7a748e', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Nome da Sala
              </label>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateVoiceRoom()}
                placeholder="🔊 Geral"
                autoFocus
                maxLength={64}
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid #2a1f40',
                  background: '#0d0a16',
                  color: '#ede8f8',
                  padding: '11px 14px',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
                onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
              />

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  onClick={() => setShowCreateVoice(false)}
                  style={{
                    flex: 1, borderRadius: 10, padding: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid #2a1f40',
                    color: '#b8b0cc', fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateVoiceRoom}
                  disabled={!newRoomName.trim() || creating}
                  style={{
                    flex: 1, borderRadius: 10, padding: '10px',
                    background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
                    border: 'none',
                    color: '#fff', fontWeight: 800, fontSize: 13,
                    cursor: !newRoomName.trim() || creating ? 'not-allowed' : 'pointer',
                    opacity: !newRoomName.trim() || creating ? 0.5 : 1,
                    transition: 'opacity 0.15s, transform 0.15s',
                    boxShadow: '0 4px 16px rgba(124,90,240,0.3)',
                  }}
                  onMouseEnter={e => { if (!(!newRoomName.trim() || creating)) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
                >
                  {creating ? 'Criando...' : 'Criar Sala'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Section header ─────────────────────────────── */
function SectionHeader({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        width: '100%', padding: '4px 4px',
        background: 'transparent', border: 'none', cursor: 'pointer',
        borderRadius: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
    >
      <ChevronDown
        style={{
          width: 12, height: 12, color: '#4a4560',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 11, fontWeight: 800, color: '#4a4560', flex: 1, textAlign: 'left', letterSpacing: '0.07em', userSelect: 'none' }}>
        {label}
      </span>
      {children && (
        <span
          style={{ color: '#4a4560', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = '#7c5af0'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = '#4a4560'; }}
        >
          {children}
        </span>
      )}
    </button>
  );
}

/* ── Channel item ───────────────────────────────── */
function ChannelItem({
  icon, label, active, onClick, badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: '6px 8px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        background: active
          ? 'rgba(124,90,240,0.18)'
          : hovered
            ? 'rgba(255,255,255,0.04)'
            : 'transparent',
        transition: 'background 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Active left bar */}
      {active && (
        <span
          style={{
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            width: 2.5, height: 16, borderRadius: '0 2px 2px 0',
            background: 'linear-gradient(180deg,#ff6a00,#7c5af0)',
          }}
        />
      )}
      <span style={{ color: active ? '#9b6dff' : hovered ? '#b8b0cc' : '#4a4560', transition: 'color 0.15s', display: 'flex' }}>
        {icon}
      </span>
      <span style={{
        fontSize: 13, fontWeight: active ? 700 : 500,
        color: active ? '#ede8f8' : hovered ? '#b8b0cc' : '#7a748e',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: 1, textAlign: 'left',
        transition: 'color 0.15s',
      }}>
        {label}
      </span>
      {badge}
    </motion.button>
  );
}

/* ── Small icon button ──────────────────────────── */
function IconBtn({
  children, onClick, danger, title,
}: { children: React.ReactNode; onClick?: () => void; danger?: boolean; title?: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28, height: 28, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer',
        background: danger
          ? hovered ? '#ff4444' : 'rgba(255,68,68,0.12)'
          : hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: danger
          ? '#ff4444'
          : hovered ? '#ede8f8' : '#7a748e',
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

/* ── DM Sidebar (real conversations) ───────────── */
function DMSidebar() {
  const router   = useRouter();
  const params   = useParams();
  const { user } = useAuthStore();
  const { init, connected, dmUnread, on } = useSocketStore();

  const activePartnerId = params?.partnerId as string | undefined;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Init socket connection
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_access_token') : null;
    if (token) init(token);
  }, [init]);

  // Load conversations from API
  useEffect(() => {
    api.get('/dms/conversations')
      .then(({ data }) => setConversations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Real-time: update conversation list when new DM arrives
  useEffect(() => {
    if (!connected) return;
    const off = on('dm:new', (msg: any) => {
      const myId = user?.id;
      const partnerId = msg.senderId === myId ? msg.receiverId : msg.senderId;
      setConversations(prev => {
        const existing = prev.find(c => c.partner.id === partnerId);
        if (existing) {
          return prev.map(c =>
            c.partner.id === partnerId
              ? {
                  ...c,
                  lastMessage: {
                    content: msg.content,
                    createdAt: msg.createdAt,
                    fromSelf: msg.senderId === myId,
                  },
                  // unread driven by socket store dmUnread (rendered below)
                }
              : c
          );
        }
        // New conversation partner — refresh from API
        api.get('/dms/conversations').then(({ data }) => setConversations(data));
        return prev;
      });
    });
    return off;
  }, [connected, on, user?.id]);

  return (
    <div style={{ width: 240, minWidth: 240, height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0c1a', borderRight: '1px solid #1e1630', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #1e1630', flexShrink: 0 }}>
        <p style={{ color: '#ede8f8', fontWeight: 800, fontSize: 14, margin: 0 }}>Mensagens Diretas</p>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }} onClick={() => router.push('/app/me')}
          style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(124,90,240,0.1)', border: '1px solid #2a1f40', color: '#7c5af0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <MessageSquarePlus style={{ width: 14, height: 14 }} />
        </motion.button>
      </div>

      {/* Conversations */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px', scrollbarWidth: 'none' }}>
        {loading ? (
          <p style={{ color: '#4a4560', fontSize: 12, padding: '8px 10px', margin: 0 }}>Carregando…</p>
        ) : conversations.length === 0 ? (
          <p style={{ color: '#4a4560', fontSize: 12, padding: '12px 10px', margin: 0, lineHeight: 1.6 }}>
            Nenhuma conversa ainda.<br />Vá em Início para iniciar uma DM.
          </p>
        ) : (
          <AnimatePresence>
            {conversations.map(conv => {
              const name = conv.partner.profile?.displayName || conv.partner.username;
              const isActive = activePartnerId === conv.partner.id;
              const preview = (conv.lastMessage.fromSelf ? 'Você: ' : '') + conv.lastMessage.content;
              // Use real-time unread count from socket store, fallback to API value
              const unreadCount = dmUnread.get(conv.partner.id) ?? conv.unread;
              return (
                <motion.button key={conv.partner.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  onClick={() => router.push(`/app/dms/${conv.partner.id}`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: isActive ? 'rgba(124,90,240,0.18)' : 'transparent', marginBottom: 2, textAlign: 'left' }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7c5af0,#b142f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12, color: '#fff' }}>
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: statusColor(conv.partner.profile?.status), border: '2px solid #0f0c1a' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: unreadCount > 0 ? 800 : 600, color: unreadCount > 0 ? '#ede8f8' : '#8a80a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: unreadCount > 0 ? '#c0b8d4' : '#4a4560', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.length > 28 ? preview.slice(0, 28) + '…' : preview}</p>
                  </div>
                  {unreadCount > 0 && (
                    <span style={{ background: '#7c5af0', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 800 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* User panel */}
      <div style={{ borderTop: '1px solid #1e1630', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7c5af0,#b142f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 11, color: '#fff', flexShrink: 0 }}>
          {(user?.profile?.displayName || user?.username || '?').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#ede8f8', fontSize: 13, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.profile?.displayName}</p>
          <p style={{ color: '#4a4560', fontSize: 11, margin: 0 }}>@{user?.username}</p>
        </div>
        <motion.button whileHover={{ scale: 1.1 }} onClick={() => router.push('/app/me')}
          style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1630', color: '#4a4560', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Settings style={{ width: 13, height: 13 }} />
        </motion.button>
      </div>
    </div>
  );
}
