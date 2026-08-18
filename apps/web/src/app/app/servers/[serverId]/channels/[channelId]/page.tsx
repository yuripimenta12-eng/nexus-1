'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Hash, Mic, Video, Plus, Search, Bell, Pin, Users, Smile, Gift, ImageIcon, Send, Phone, Monitor, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';
import { io, Socket } from 'socket.io-client';

/* ── Types ── */
interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    profile?: { displayName?: string; avatarUrl?: string };
  };
}
interface Channel {
  id: string;
  name: string;
  topic?: string;
  serverId: string;
}
interface VoiceRoom {
  id: string;
  name: string;
}
interface OnlineUser {
  id: string;
  username: string;
  profile?: { displayName?: string; status?: string };
}
interface FeaturedRoom {
  id: string;
  name: string;
  participantCount: number;
}

/* ── Avatar gradients ── */
const AVATAR_COLORS = [
  'linear-gradient(135deg,#ff6a00,#7a2cff)',
  'linear-gradient(135deg,#0070f3,#00d4aa)',
  'linear-gradient(135deg,#7928ca,#ff0080)',
  'linear-gradient(135deg,#f5a623,#f53a3a)',
  'linear-gradient(135deg,#00b4d8,#7b2ff7)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
];
function avatarGrad(id: string) {
  const idx = Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(date: string) {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ── Status colors ── */
const STATUS_COLOR: Record<string, string> = {
  ONLINE: '#3ba55d', IDLE: '#faa81a', DND: '#ed4245', OFFLINE: '#747f8d',
};

export default function ChannelPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const serverId  = params?.serverId as string;
  const channelId = params?.channelId as string;

  const [channel,      setChannel]      = useState<Channel | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [draft,        setDraft]        = useState('');
  const [sending,      setSending]      = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([]);
  const [featuredRoom, setFeaturedRoom] = useState<FeaturedRoom | null>(null);
  const [voiceRooms,   setVoiceRooms]   = useState<VoiceRoom[]>([]);
  const [showRight,    setShowRight]    = useState(true);

  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ── Load channel ── */
  useEffect(() => {
    if (!channelId) return;
    api.get(`/channels/${channelId}`).then(({ data }) => setChannel(data)).catch(() => {});
    api.get(`/channels/${channelId}/messages`).then(({ data }) => {
      setMessages(Array.isArray(data) ? data : data.messages || []);
    }).catch(() => {});
  }, [channelId]);

  /* ── Load server voice rooms & online users (right panel) ── */
  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}`).then(({ data }) => {
      const rooms: VoiceRoom[] = data.voiceRooms || [];
      setVoiceRooms(rooms);
      if (rooms.length > 0) setFeaturedRoom({ id: rooms[0].id, name: rooms[0].name, participantCount: 0 });
    }).catch(() => {});
    api.get(`/servers/${serverId}/members`).then(({ data }) => {
      const members = Array.isArray(data) ? data : [];
      setOnlineUsers(members
        .filter((m: any) => m.user?.profile?.status === 'ONLINE' || m.user?.profile?.status === 'IDLE')
        .slice(0, 12)
        .map((m: any) => ({ id: m.user.id, username: m.user.username, profile: m.user.profile }))
      );
    }).catch(() => {});
  }, [serverId]);

  /* ── WebSocket ── */
  useEffect(() => {
    const token = localStorage.getItem('nexus_token');
    const socket: Socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.emit('join_channel', channelId);
    socket.on('new_message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => { socket.emit('leave_channel', channelId); socket.disconnect(); };
  }, [channelId]);

  /* ── Scroll to bottom ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Send message ── */
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.post(`/channels/${channelId}/messages`, { content });
    } catch {
      setDraft(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [draft, sending, channelId]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /* ── Group messages by date + consecutive author ── */
  type GroupedMsg = Message & { showHeader: boolean; dateSep?: string };
  const grouped: GroupedMsg[] = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const sameAuthor = prev && prev.author.id === msg.author.id;
    const sameMinute = prev && formatTime(prev.createdAt) === formatTime(msg.createdAt);
    const sameDay    = prev && formatDate(prev.createdAt) === formatDate(msg.createdAt);
    return {
      ...msg,
      showHeader: !sameAuthor || !sameMinute,
      dateSep:    !sameDay ? formatDate(msg.createdAt) : undefined,
    };
  });

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', background: '#0a0812' }}>

      {/* ── MAIN AREA ── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* ── TOP BAR ── */}
        <div style={{
          height: 52, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', borderBottom: '1px solid #1e1828', flexShrink: 0,
          background: '#0c0910',
        }}>
          {/* Channel name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <Hash style={{ width: 18, height: 18, color: '#7a2cff', flexShrink: 0 }} />
            <span style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {channel?.name || '…'}
            </span>
            {channel?.topic && (
              <>
                <span style={{ width: 1, height: 18, background: '#2a1e38', flexShrink: 0, margin: '0 4px' }} />
                <span style={{ color: '#6b6278', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {channel.topic}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {voiceRooms.length > 0 && (
              <TopBtn
                label="Áudio"
                icon={<Phone style={{ width: 14, height: 14 }} />}
                onClick={() => router.push(`/app/servers/${serverId}/voice/${voiceRooms[0].id}`)}
                accent
              />
            )}
            {voiceRooms.length > 0 && (
              <TopBtn
                label="Vídeo"
                icon={<Video style={{ width: 14, height: 14 }} />}
                onClick={() => router.push(`/app/servers/${serverId}/voice/${voiceRooms[0].id}`)}
              />
            )}
            <TopBtn label="+ Criar sala" onClick={() => {}} accent />
            <div style={{ width: 1, height: 18, background: '#2a1e38', margin: '0 4px' }} />
            <IconTopBtn title="Fixados" onClick={() => {}}><Pin style={{ width: 16, height: 16 }} /></IconTopBtn>
            <IconTopBtn title="Membros" onClick={() => setShowRight(v => !v)}><Users style={{ width: 16, height: 16 }} /></IconTopBtn>
            <IconTopBtn title="Buscar" onClick={() => {}}><Search style={{ width: 16, height: 16 }} /></IconTopBtn>
            <IconTopBtn title="Notificações" onClick={() => {}}><Bell style={{ width: 16, height: 16 }} /></IconTopBtn>
          </div>
        </div>

        {/* ── MESSAGES ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 8px' }}>

          {/* Welcome banner */}
          {messages.length === 0 && channel && (
            <div style={{ padding: '0 16px 32px' }}>
              <WelcomeBanner channelName={channel.name} serverId={serverId} router={router} voiceRooms={voiceRooms} />
            </div>
          )}

          {grouped.map((msg) => (
            <div key={msg.id}>
              {/* Date separator */}
              {msg.dateSep && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 8px', userSelect: 'none' }}>
                  <span className="date-sep-line" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#6b6278', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{msg.dateSep}</span>
                  <span className="date-sep-line" />
                </div>
              )}

              {/* Message row */}
              <MessageRow msg={msg} showHeader={msg.showHeader} isNew={false} />
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── MESSAGE INPUT ── */}
        <div style={{ padding: '0 16px 16px', flexShrink: 0 }}>
          <div className="msg-input-wrap" style={{
            display: 'flex', alignItems: 'flex-end', gap: 0,
            background: '#17112a', border: '1px solid #2a1e3c',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}>
            {/* Left icons */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 0 8px', flexShrink: 0, paddingBottom: 10 }}>
              <InputIcon title="Adicionar"><Plus style={{ width: 18, height: 18 }} /></InputIcon>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Mensagem em #${channel?.name || '…'}`}
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#f0eaf7', fontSize: 14, resize: 'none', padding: '13px 4px',
                lineHeight: 1.45, maxHeight: 200, fontFamily: 'inherit',
                overflowY: 'auto',
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 200) + 'px';
              }}
            />

            {/* Right icons */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', gap: 2, flexShrink: 0, paddingBottom: 10 }}>
              <InputIcon title="Gif"><Gift style={{ width: 18, height: 18 }} /></InputIcon>
              <InputIcon title="Emoji"><Smile style={{ width: 18, height: 18 }} /></InputIcon>
              <InputIcon title="Imagem"><ImageIcon style={{ width: 18, height: 18 }} /></InputIcon>

              {/* Send button */}
              <button
                onClick={send}
                disabled={!draft.trim() || sending}
                title="Enviar (Enter)"
                className={draft.trim() && !sending ? 'send-btn-active' : ''}
                style={{
                  width: 32, height: 32, borderRadius: 10, border: 'none',
                  cursor: draft.trim() && !sending ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: draft.trim() && !sending
                    ? 'linear-gradient(135deg,#ff6a00,#7a2cff)'
                    : '#2a1e3c',
                  color: draft.trim() && !sending ? '#fff' : '#4a3860',
                  transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
                  flexShrink: 0,
                  transform: draft.trim() && !sending ? 'scale(1.05)' : 'scale(1)',
                }}
              >
                <Send style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL: Amigos no Nexus ── */}
      {showRight && (
        <div style={{
          width: 260, flexShrink: 0, borderLeft: '1px solid #1e1828',
          background: '#0d0b14', display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          animation: 'slideInRight 0.2s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <div style={{ padding: '16px 12px 8px' }}>
            <p style={{ color: '#f0eaf7', fontWeight: 800, fontSize: 13, margin: '0 0 16px', letterSpacing: 0.2 }}>
              Amigos no Nexus
            </p>

            {/* SALA EM DESTAQUE */}
            {featuredRoom && (
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>SALA EM DESTAQUE</SectionLabel>
                <button
                  onClick={() => router.push(`/app/servers/${serverId}/voice/${featuredRoom.id}`)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'linear-gradient(135deg,#1a0f2e,#0f0a1e)',
                    border: '1px solid #2d1f45', borderRadius: 12, padding: '12px',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7a2cff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d1f45'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(135deg,#ff6a00,#7a2cff)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Mic style={{ width: 16, height: 16, color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {featuredRoom.name}
                      </p>
                      <p style={{ color: '#6b6278', fontSize: 11, margin: 0 }}>Sala de voz</p>
                    </div>
                    <ChevronRight style={{ width: 14, height: 14, color: '#7a2cff', flexShrink: 0 }} />
                  </div>
                  <div style={{
                    marginTop: 10, padding: '6px 10px', borderRadius: 8,
                    background: 'rgba(122,44,255,0.1)', border: '1px solid rgba(122,44,255,0.2)',
                    fontSize: 12, color: '#b568ff', fontWeight: 700, textAlign: 'center',
                  }}>
                    Entrar na sala →
                  </div>
                </button>
              </div>
            )}

            {/* Mais salas */}
            {voiceRooms.length > 1 && (
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>OUTRAS SALAS</SectionLabel>
                {voiceRooms.slice(1).map(room => (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/app/servers/${serverId}/voice/${room.id}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer', marginBottom: 2,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a1328'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#1e1530', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Mic style={{ width: 13, height: 13, color: '#6b6278' }} />
                    </div>
                    <span style={{ color: '#9a90a8', fontSize: 13, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {room.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* ONLINE AGORA */}
            <SectionLabel>ONLINE AGORA — {onlineUsers.length}</SectionLabel>
            {onlineUsers.length === 0 && (
              <p style={{ color: '#4a4255', fontSize: 12, marginTop: 8 }}>Nenhum amigo online.</p>
            )}
            {onlineUsers.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 4px', borderRadius: 8, cursor: 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#1a1328'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: avatarGrad(u.id),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {getInitials(u.profile?.displayName || u.username)}
                  </div>
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: 9, height: 9, borderRadius: '50%',
                    background: STATUS_COLOR[u.profile?.status || 'OFFLINE'],
                    border: '2px solid #0d0b14',
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#d0c8db', fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.profile?.displayName || u.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function WelcomeBanner({ channelName, serverId, router, voiceRooms }: {
  channelName: string;
  serverId: string;
  router: ReturnType<typeof useRouter>;
  voiceRooms: VoiceRoom[];
}) {
  return (
    <div className="welcome-banner" style={{
      borderRadius: 18,
      background: 'linear-gradient(135deg,#1a0c2e 0%,#0f0920 50%,#180d28 100%)',
      border: '1px solid #2d1f45',
      padding: '28px 28px 24px',
      position: 'relative',
      overflow: 'hidden',
      animation: 'fadeInUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
    }}>
      {/* Glow blob */}
      <div style={{
        position: 'absolute', right: -30, top: -30,
        width: 180, height: 180, borderRadius: '50%',
        background: 'radial-gradient(circle,#7a2cff33,transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: 20, bottom: -20,
        width: 100, height: 100, borderRadius: '50%',
        background: 'radial-gradient(circle,#ff6a0022,transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Icon */}
      <div style={{
        width: 56, height: 56, borderRadius: 18, marginBottom: 16,
        background: 'linear-gradient(135deg,#ff6a00,#7a2cff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px rgba(122,44,255,0.35)',
      }}>
        <Hash style={{ width: 26, height: 26, color: '#fff' }} />
      </div>

      <h2 style={{ color: '#f0eaf7', fontWeight: 900, fontSize: 22, margin: '0 0 8px', letterSpacing: -0.5 }}>
        Bem-vindo a #{channelName}!
      </h2>
      <p style={{ color: '#9188a2', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
        Este é o começo do canal <strong style={{ color: '#b568ff' }}>#{channelName}</strong>. Compartilhe ideias, links e conquistas com a comunidade.
      </p>

      {voiceRooms.length > 0 && (
        <button
          onClick={() => router.push(`/app/servers/${serverId}/voice/${voiceRooms[0].id}`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(110deg,#ff6a00,#7a2cff)',
            color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 6px 20px rgba(122,44,255,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
        >
          <Mic style={{ width: 15, height: 15 }} />
          Explorar salas →
        </button>
      )}
    </div>
  );
}

function MessageRow({ msg, showHeader, isNew }: { msg: Message; showHeader: boolean; isNew?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const authorId = msg.author.id;
  const displayName = msg.author.profile?.displayName || msg.author.username;

  return (
    <div
      className={`message-row${isNew ? ' msg-appear' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, padding: showHeader ? '8px 16px 2px' : '1px 16px',
        background: hovered ? 'rgba(122,44,255,0.04)' : 'transparent',
        transition: 'background 0.12s',
        borderLeft: hovered ? '2px solid rgba(122,44,255,0.15)' : '2px solid transparent',
      }}
    >
      {/* Avatar or spacer */}
      <div style={{ width: 38, flexShrink: 0 }}>
        {showHeader ? (
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: avatarGrad(authorId),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>
            {getInitials(displayName)}
          </div>
        ) : (
          hovered && (
            <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#4a3e5a', paddingTop: 2, paddingRight: 2, lineHeight: 1.2 }}>
              {formatTime(msg.createdAt)}
            </span>
          )
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
            <span style={{ color: '#f0eaf7', fontWeight: 700, fontSize: 14 }}>{displayName}</span>
            <span style={{ color: '#4a3e5a', fontSize: 11 }}>{formatTime(msg.createdAt)}</span>
          </div>
        )}
        <p style={{ color: '#c9c0d8', fontSize: 14, margin: 0, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </p>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 800, color: '#6b6278', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px 4px' }}>
      {children}
    </p>
  );
}

function TopBtn({ label, icon, onClick, accent = false }: {
  label: string; icon?: React.ReactNode; onClick: () => void; accent?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 12, fontWeight: 700,
        background: hovered
          ? (accent ? 'linear-gradient(110deg,#ff6a00,#7a2cff)' : '#1d1529')
          : (accent ? 'rgba(122,44,255,0.12)' : 'transparent'),
        color: hovered ? '#fff' : (accent ? '#b568ff' : '#9a90a8'),
        transition: 'all 0.15s',
        border: accent ? '1px solid rgba(122,44,255,0.3)' : '1px solid transparent',
      }}
    >
      {icon}{label}
    </button>
  );
}

function IconTopBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28, height: 28, borderRadius: 8, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.15s',
        background: hovered ? '#1d1529' : 'transparent',
        color: hovered ? '#f0eaf7' : '#6b6278',
      }}
    >
      {children}
    </button>
  );
}

function InputIcon({ children, title }: { children: React.ReactNode; title: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30, height: 30, borderRadius: 8, border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', background: 'transparent',
        color: hovered ? '#b568ff' : '#6b6278',
        transition: 'color 0.15s',
      }}
    >
      {children}
    </button>
  );
}
