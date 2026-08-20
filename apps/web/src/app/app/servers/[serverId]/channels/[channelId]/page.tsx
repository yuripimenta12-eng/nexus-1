'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Hash, Reply, Edit2, Trash2, SmilePlus, Loader2, ChevronDown, Plus, Send } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth.store';
import { useSocketStore } from '@/stores/socket.store';
import api from '@/lib/api';
import { getInitials } from '@/lib/utils';

/* ── Types ───────────────────────────────────────── */
interface Author {
  id: string;
  username: string;
  profile: { displayName: string; avatarUrl: string | null } | null;
}
interface Reaction { userId: string; emoji: string; }
interface Message {
  id: string;
  content: string;
  authorId: string;
  channelId: string;
  createdAt: string;
  edited: boolean;
  editedAt?: string;
  deleted: boolean;
  author: Author;
  reactions: Reaction[];
  attachments: { id: string; url: string; name: string }[];
  replyTo?: { id: string; content: string; author: Author } | null;
}

/* ── Helpers ─────────────────────────────────────── */
function avatarFor(author: Author) {
  return author.profile?.avatarUrl ?? null;
}
function displayNameFor(author: Author) {
  return author.profile?.displayName || author.username;
}
function formatDay(date: Date) {
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}
function formatTime(iso: string) {
  return format(new Date(iso), 'HH:mm');
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/* ── Avatar component ─────────────────────────────── */
function Avatar({ author, size = 36 }: { author: Author; size?: number }) {
  const url = avatarFor(author);
  const name = displayNameFor(author);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: url ? 'transparent' : 'linear-gradient(135deg,#7c5af0,#b142f5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 900, color: '#fff',
      overflow: 'hidden',
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : getInitials(name)
      }
    </div>
  );
}

/* ── Message row ─────────────────────────────────── */
function MessageRow({
  msg, isMine, onEdit, onDelete, onReact, onReply,
}: {
  msg: Message;
  isMine: boolean;
  onEdit: (msg: Message) => void;
  onDelete: (msg: Message) => void;
  onReact: (msgId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
}) {
  const [hover, setHover] = useState(false);
  const [emojiMenu, setEmojiMenu] = useState(false);

  if (msg.deleted) {
    return (
      <div style={{ padding: '4px 16px', color: '#4a4560', fontSize: 13, fontStyle: 'italic' }}>
        [mensagem excluída]
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setEmojiMenu(false); }}
      style={{
        display: 'flex', gap: 12, padding: '4px 16px',
        background: hover ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderRadius: 8, position: 'relative',
      }}
    >
      <Avatar author={msg.author} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Reply quote */}
        {msg.replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 4, opacity: 0.6,
          }}>
            <Reply style={{ width: 12, height: 12, color: '#7c5af0' }} />
            <span style={{ fontSize: 12, color: '#9b6dff' }}>
              {displayNameFor(msg.replyTo.author)}
            </span>
            <span style={{ fontSize: 12, color: '#7a748e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {msg.replyTo.content.slice(0, 60)}
            </span>
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ color: '#ede8f8', fontWeight: 700, fontSize: 14 }}>
            {displayNameFor(msg.author)}
          </span>
          <span style={{ color: '#4a4560', fontSize: 11 }}>
            {formatTime(msg.createdAt)}
            {msg.edited && ' (editado)'}
          </span>
        </div>

        {/* Content */}
        <p style={{ color: '#cdc8e0', fontSize: 14, margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {msg.content}
        </p>

        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {Object.entries(
              msg.reactions.reduce<Record<string, number>>((acc, r) => {
                acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                return acc;
              }, {})
            ).map(([emoji, count]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(124,90,240,0.12)', border: '1px solid rgba(124,90,240,0.25)',
                  borderRadius: 10, padding: '2px 8px', cursor: 'pointer',
                  fontSize: 13, color: '#cdc8e0',
                }}
              >
                {emoji} <span style={{ fontSize: 11 }}>{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {hover && (
        <div style={{
          position: 'absolute', right: 16, top: -18,
          display: 'flex', gap: 2,
          background: '#1a1428', border: '1px solid #2a1f40',
          borderRadius: 8, padding: '3px 4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 10,
        }}>
          {/* Quick emojis */}
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => onReact(msg.id, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 3px', borderRadius: 4 }}
              title={e}
            >
              {e}
            </button>
          ))}
          <div style={{ width: 1, background: '#2a1f40', margin: '2px 2px' }} />
          <button onClick={() => onReply(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a748e', padding: '2px 4px', borderRadius: 4 }} title="Responder">
            <Reply style={{ width: 14, height: 14 }} />
          </button>
          {isMine && (
            <>
              <button onClick={() => onEdit(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a748e', padding: '2px 4px', borderRadius: 4 }} title="Editar">
                <Edit2 style={{ width: 14, height: 14 }} />
              </button>
              <button onClick={() => onDelete(msg)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff6060', padding: '2px 4px', borderRadius: 4 }} title="Deletar">
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Typing indicator ────────────────────────────── */
function TypingIndicator({ users }: { users: string[] }) {
  if (!users.length) return null;
  const text = users.length === 1 ? `${users[0]} está digitando…`
    : users.length === 2 ? `${users[0]} e ${users[1]} estão digitando…`
    : 'Vários usuários estão digitando…';
  return (
    <div style={{ padding: '4px 16px 8px', color: '#7a748e', fontSize: 12 }}>
      <span style={{ fontStyle: 'italic' }}>{text}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main channel page
══════════════════════════════════════════════════ */
export default function ChannelPage() {
  const params = useParams<{ serverId: string; channelId: string }>();
  const { channelId, serverId } = params;
  const { user } = useAuthStore();
  const socket = useSocketStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottom = useRef(true);

  /* ── Scroll helpers ── */
  const scrollToBottom = (smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  /* ── Load messages ── */
  const loadMessages = useCallback(async (cursor?: string) => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (cursor) params.set('cursor', cursor);
      const { data } = await api.get(`/channels/${channelId}/messages?${params}`);
      return data as { messages: Message[]; nextCursor: string | null };
    } catch {
      return { messages: [], nextCursor: null };
    }
  }, [channelId]);

  /* ── Initial load + join channel ── */
  useEffect(() => {
    if (!channelId) return;

    setLoading(true);
    setMessages([]);
    setNextCursor(null);

    // Join socket room
    socket.emit('server:join', { serverId });
    socket.emit('channel:join', { channelId });

    // Load channel info + messages in parallel
    // Channel detail is at /servers/:serverId/channels/:channelId
    Promise.all([
      api.get(`/servers/${serverId}/channels/${channelId}`).catch(() => null),
      loadMessages(),
    ]).then(([chanRes, msgData]) => {
      if (chanRes?.data?.name) setChannelName(chanRes.data.name);
      setMessages(msgData.messages);
      setNextCursor(msgData.nextCursor);
      setLoading(false);
      setTimeout(() => scrollToBottom(), 50);
    });

    return () => {
      socket.emit('channel:leave', { channelId });
    };
  }, [channelId, serverId]);

  /* ── Socket events ── */
  useEffect(() => {
    if (!channelId) return;

    const onNew = (msg: Message) => {
      if (msg.channelId !== channelId) return;
      setMessages(prev => [...prev, msg]);
      if (isAtBottom.current) setTimeout(() => scrollToBottom(true), 30);
      else setShowScrollBtn(true);
    };
    const onUpdated = (msg: Message) => {
      if (msg.channelId !== channelId) return;
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
    };
    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, content: '[mensagem excluída]' } : m
      ));
    };
    const onTyping = ({ channelId: cId, userId, typing }: { channelId: string; userId: string; typing: boolean }) => {
      if (cId !== channelId || userId === user?.id) return;
      const name = userId.slice(0, 6); // fallback display
      setTypingUsers(prev =>
        typing ? (prev.includes(name) ? prev : [...prev, name]) : prev.filter(u => u !== name)
      );
    };

    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('message:deleted', onDeleted);
    socket.on('typing:update', onTyping);

    return () => {
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('message:deleted', onDeleted);
      socket.off('typing:update', onTyping);
    };
  }, [channelId, user?.id]);

  /* ── Scroll tracking ── */
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottom.current = distFromBottom < 80;
    setShowScrollBtn(distFromBottom > 200);

    // Load more when near top
    if (el.scrollTop < 100 && !loadingMore && nextCursor) {
      setLoadingMore(true);
      const prevHeight = el.scrollHeight;
      loadMessages(nextCursor).then(data => {
        setMessages(prev => [...data.messages, ...prev]);
        setNextCursor(data.nextCursor);
        setLoadingMore(false);
        // Restore scroll position
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight;
        });
      });
    }
  };

  /* ── Typing signal ── */
  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.trim()) {
      socket.emit('typing:start', { channelId });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        socket.emit('typing:stop', { channelId });
      }, 3000);
    } else {
      socket.emit('typing:stop', { channelId });
      if (typingTimer.current) clearTimeout(typingTimer.current);
    }
  };

  /* ── Send message (via SOCKET) ── */
  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    socket.emit('typing:stop', { channelId });
    if (typingTimer.current) clearTimeout(typingTimer.current);

    try {
      socket.emit('message:send', {
        channelId,
        content,
        replyToId: replyTo?.id,
      });
      setInput('');
      setReplyTo(null);
      isAtBottom.current = true;
      setTimeout(() => scrollToBottom(true), 50);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  /* ── Edit message ── */
  const submitEdit = () => {
    if (!editingMsg || !editContent.trim()) return;
    socket.emit('message:edit', { messageId: editingMsg.id, content: editContent.trim() });
    setEditingMsg(null);
    setEditContent('');
  };

  /* ── Delete message ── */
  const handleDelete = (msg: Message) => {
    if (!confirm('Deletar mensagem?')) return;
    socket.emit('message:delete', { messageId: msg.id, channelId });
  };

  /* ── React ── */
  const handleReact = (messageId: string, emoji: string) => {
    const existing = messages.find(m => m.id === messageId);
    const alreadyReacted = existing?.reactions.some(r => r.userId === user?.id && r.emoji === emoji);
    if (alreadyReacted) {
      socket.emit('reaction:remove', { messageId, channelId, emoji });
    } else {
      socket.emit('reaction:add', { messageId, channelId, emoji });
    }
  };

  /* ── Key handler for textarea ── */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingMsg) submitEdit();
      else sendMessage();
    }
    if (e.key === 'Escape') {
      setEditingMsg(null);
      setEditContent('');
      setReplyTo(null);
    }
  };

  /* ── Group messages by day ── */
  const grouped: { day: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const day = formatDay(new Date(msg.createdAt));
    if (!grouped.length || grouped[grouped.length - 1].day !== day) {
      grouped.push({ day, msgs: [msg] });
    } else {
      grouped[grouped.length - 1].msgs.push(msg);
    }
  }

  /* ── Render ── */
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', height: '100%',
      background: '#09070d', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 52, flexShrink: 0, borderBottom: '1px solid #1e1630',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px',
        background: '#0b0816',
      }}>
        <Hash style={{ width: 18, height: 18, color: '#7c5af0' }} />
        <span style={{ color: '#ede8f8', fontWeight: 700, fontSize: 15 }}>
          {channelName || 'canal'}
        </span>
      </div>

      {/* Messages list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px 0',
          scrollbarWidth: 'thin', scrollbarColor: '#2a1f40 transparent',
          position: 'relative',
        }}
      >
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 style={{ width: 24, height: 24, color: '#7c5af0', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {loadingMore && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <Loader2 style={{ width: 16, height: 16, color: '#7a748e', animation: 'spin 1s linear infinite' }} />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 48, color: '#4a4560' }}>
            <Hash style={{ width: 40, height: 40, marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#7a748e' }}>
              Bem-vindo a #{channelName}!
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>
              Seja o primeiro a enviar uma mensagem.
            </p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.day}>
            {/* Day separator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 16px',
            }}>
              <div style={{ flex: 1, height: 1, background: '#1e1630' }} />
              <span style={{ color: '#4a4560', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {group.day}
              </span>
              <div style={{ flex: 1, height: 1, background: '#1e1630' }} />
            </div>

            {group.msgs.map(msg => (
              <MessageRow
                key={msg.id}
                msg={msg}
                isMine={msg.authorId === user?.id}
                onEdit={m => { setEditingMsg(m); setEditContent(m.content); }}
                onDelete={handleDelete}
                onReact={handleReact}
                onReply={m => { setReplyTo(m); inputRef.current?.focus(); }}
              />
            ))}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => { scrollToBottom(true); setShowScrollBtn(false); }}
          style={{
            position: 'absolute', bottom: 90, right: 24,
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,90,240,0.4)',
          }}
        >
          <ChevronDown style={{ width: 18, height: 18, color: '#fff' }} />
        </button>
      )}

      {/* Typing indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Edit mode banner */}
      {editingMsg && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(124,90,240,0.1)',
          borderTop: '1px solid rgba(124,90,240,0.2)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#9b6dff',
        }}>
          <Edit2 style={{ width: 13, height: 13 }} />
          Editando mensagem — pressione Esc para cancelar
        </div>
      )}

      {/* Reply banner */}
      {replyTo && !editingMsg && (
        <div style={{
          padding: '8px 16px',
          background: 'rgba(124,90,240,0.08)',
          borderTop: '1px solid rgba(124,90,240,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: '#9b6dff',
        }}>
          <span>
            <Reply style={{ width: 12, height: 12, display: 'inline', marginRight: 6 }} />
            Respondendo a <strong>{displayNameFor(replyTo.author)}</strong>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            style={{ background: 'none', border: 'none', color: '#7a748e', cursor: 'pointer', padding: 2 }}
          >✕</button>
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid #1e1630',
        background: '#0b0816',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: '#131020',
          border: '1px solid #2a1f40',
          borderRadius: 12,
          padding: '10px 14px',
        }}>
          <textarea
            ref={inputRef}
            value={editingMsg ? editContent : input}
            onChange={e => editingMsg ? setEditContent(e.target.value) : handleInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={editingMsg ? 'Editar mensagem…' : `Mensagem em #${channelName}`}
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#ede8f8', fontSize: 14, lineHeight: 1.5,
              resize: 'none', fontFamily: 'Inter, system-ui, sans-serif',
              maxHeight: 120, overflowY: 'auto',
            }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={editingMsg ? submitEdit : sendMessage}
            disabled={!(editingMsg ? editContent.trim() : input.trim()) || sending}
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: (editingMsg ? editContent.trim() : input.trim())
                ? 'linear-gradient(135deg,#7c5af0,#b142f5)'
                : 'rgba(255,255,255,0.05)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <Send style={{
              width: 15, height: 15,
              color: (editingMsg ? editContent.trim() : input.trim()) ? '#fff' : '#4a4560',
            }} />
          </button>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#4a4560', paddingLeft: 2 }}>
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
