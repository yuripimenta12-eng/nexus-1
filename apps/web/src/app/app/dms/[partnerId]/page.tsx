'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ArrowLeft, MoreHorizontal, Pencil, Trash2, X, Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSocketStore, type DmMessage } from '@/stores/socket.store';
import api from '@/lib/api';

/* ── Types ───────────────────────────────────── */
interface Partner {
  id: string;
  username: string;
  profile?: { displayName?: string; avatarUrl?: string; status?: string } | null;
}

/* ── Helpers ─────────────────────────────────── */
function statusColor(s?: string) {
  return s === 'ONLINE' ? '#43e3a3' : s === 'AWAY' ? '#f0b429' : s === 'BUSY' ? '#ff4d6d' : '#4a4560';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoje';
  if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function UserAvatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl?: string | null; size?: number }) {
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: size * 0.3, color: '#fff',
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/* ── Main component ──────────────────────────── */
export default function DmPage() {
  const params   = useParams();
  const router   = useRouter();
  const partnerId = params?.partnerId as string;

  const { user }   = useAuthStore();
  const { on, emit, connected, dmMessages, setDmMessages, addDmMessage, updateDmMessage, deleteDmMessage, markDmRead } = useSocketStore();

  const [partner,    setPartner   ] = useState<Partner | null>(null);
  const [input,      setInput     ] = useState('');
  const [sending,    setSending   ] = useState(false);
  const [editingId,  setEditingId ] = useState<string | null>(null);
  const [editValue,  setEditValue ] = useState('');
  const [menuMsgId,  setMenuMsgId ] = useState<string | null>(null);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,    setHasMore   ] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const messages: DmMessage[] = dmMessages.get(partnerId) ?? [];

  // ── Load partner profile ──────────────────────
  useEffect(() => {
    if (!partnerId) return;
    api.get(`/users/${partnerId}`)
      .then(({ data }) => setPartner(data))
      .catch(() => {});
  }, [partnerId]);

  // ── Load message history ──────────────────────
  useEffect(() => {
    if (!partnerId) return;
    api.get(`/dms/${partnerId}/messages?limit=50`)
      .then(({ data }) => {
        const msgs: DmMessage[] = Array.isArray(data) ? data : [];
        setDmMessages(partnerId, msgs);
        setHasMore(msgs.length === 50);
        // Mark as read
        markDmRead(partnerId);
      })
      .catch(() => {});
  }, [partnerId]);

  // ── Scroll to bottom on new messages ──────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Real-time socket events ───────────────────
  useEffect(() => {
    if (!connected) return;

    const offNew = on('dm:new', (msg: DmMessage) => {
      if (msg.senderId !== partnerId && msg.receiverId !== partnerId) return;
      addDmMessage(partnerId, msg);
      // If we're the receiver, mark as read immediately
      if (msg.senderId === partnerId) {
        markDmRead(partnerId);
        // Notify backend we've read it
        api.get(`/dms/${partnerId}/messages?limit=1`).catch(() => {});
      }
    });

    const offUpdated = on('dm:updated', (msg: DmMessage) => {
      if (msg.senderId !== partnerId && msg.receiverId !== partnerId) return;
      updateDmMessage(partnerId, msg);
    });

    const offDeleted = on('dm:deleted', ({ messageId }: { messageId: string; partnerId: string }) => {
      deleteDmMessage(partnerId, messageId);
    });

    return () => {
      offNew();
      offUpdated();
      offDeleted();
    };
  }, [connected, partnerId, on, addDmMessage, updateDmMessage, deleteDmMessage, markDmRead]);

  // ── Load more (pagination) ────────────────────
  const loadMore = async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0].createdAt;
      const { data } = await api.get(`/dms/${partnerId}/messages?limit=50&before=${oldest}`);
      const older: DmMessage[] = Array.isArray(data) ? data : [];
      if (older.length > 0) {
        setDmMessages(partnerId, [...older, ...messages]);
        setHasMore(older.length === 50);
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Send message ──────────────────────────────
  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    try {
      await api.post(`/dms/${partnerId}/send`, { content });
      // Message will arrive via dm:new socket event
    } catch (err) {
      setInput(content); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, partnerId]);

  // ── Edit message ──────────────────────────────
  const confirmEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    try {
      await api.put(`/dms/messages/${editingId}`, { content: editValue.trim() });
      // Will arrive via dm:updated
    } catch {}
    setEditingId(null);
    setEditValue('');
  };

  // ── Delete message ────────────────────────────
  const confirmDelete = async (messageId: string) => {
    try {
      await api.delete(`/dms/messages/${messageId}`);
      // Will arrive via dm:deleted
    } catch {}
    setMenuMsgId(null);
  };

  const name = partner?.profile?.displayName || partner?.username || '...';

  // ── Group messages by date ────────────────────
  const grouped: { date: string; msgs: DmMessage[] }[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0a16', overflow: 'hidden' }}>
      {/* ── Header ─────────────────────────────── */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', borderBottom: '1px solid #1e1630', flexShrink: 0,
        background: '#0f0c1a',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#4a4560', cursor: 'pointer', display: 'flex', padding: 4 }}
        >
          <ArrowLeft style={{ width: 18, height: 18 }} />
        </button>

        {partner && (
          <>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <UserAvatar name={name} avatarUrl={partner.profile?.avatarUrl} size={28} />
              <span style={{
                position: 'absolute', bottom: -1, right: -1,
                width: 9, height: 9, borderRadius: '50%',
                background: statusColor(partner.profile?.status),
                border: '2px solid #0f0c1a',
              }} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#ede8f8', lineHeight: 1.2 }}>{name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#4a4560', lineHeight: 1 }}>@{partner.username}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Messages ───────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={e => {
          if ((e.currentTarget as HTMLDivElement).scrollTop < 60) loadMore();
        }}
        style={{
          flex: 1, overflowY: 'auto', padding: '16px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 0,
          scrollbarWidth: 'thin', scrollbarColor: '#2a1f40 transparent',
        }}
      >
        {loadingMore && (
          <p style={{ color: '#4a4560', fontSize: 12, textAlign: 'center', margin: '8px 0' }}>Carregando mais…</p>
        )}

        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {partner && <UserAvatar name={name} avatarUrl={partner.profile?.avatarUrl} size={64} />}
            <p style={{ color: '#ede8f8', fontWeight: 800, fontSize: 18, margin: 0 }}>{name}</p>
            <p style={{ color: '#4a4560', fontSize: 13, margin: 0 }}>Início da sua conversa com {name}.</p>
          </div>
        )}

        {grouped.map(({ date, msgs }) => (
          <div key={date}>
            {/* Date divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0 8px' }}>
              <div style={{ flex: 1, height: 1, background: '#1e1630' }} />
              <span style={{ color: '#4a4560', fontSize: 11, fontWeight: 700 }}>{date}</span>
              <div style={{ flex: 1, height: 1, background: '#1e1630' }} />
            </div>

            {msgs.map((msg, i) => {
              const isMe = msg.senderId === user?.id;
              const prev = msgs[i - 1];
              const grouped_with_prev = prev && prev.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;

              return (
                <div
                  key={msg.id}
                  style={{ position: 'relative', marginTop: grouped_with_prev ? 2 : 12 }}
                  onMouseEnter={() => setMenuMsgId(msg.id)}
                  onMouseLeave={() => setMenuMsgId(null)}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    {!grouped_with_prev && !isMe && (
                      <UserAvatar name={name} avatarUrl={partner?.profile?.avatarUrl} size={30} />
                    )}
                    {!grouped_with_prev && isMe && <div style={{ width: 30, flexShrink: 0 }} />}
                    {grouped_with_prev && <div style={{ width: 30, flexShrink: 0 }} />}

                    <div style={{ maxWidth: '70%' }}>
                      {!grouped_with_prev && !isMe && (
                        <p style={{ margin: '0 0 3px 2px', fontSize: 12, fontWeight: 700, color: '#7c5af0' }}>{name}</p>
                      )}
                      {editingId === msg.id ? (
                        <div style={{
                          background: '#1a1629', border: '1px solid #7c5af0',
                          borderRadius: 12, padding: '8px 12px',
                          display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200,
                        }}>
                          <textarea
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                              if (e.key === 'Escape') { setEditingId(null); }
                            }}
                            rows={3}
                            style={{
                              resize: 'none', background: 'transparent', border: 'none',
                              color: '#ede8f8', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button onClick={() => setEditingId(null)}
                              style={{ background: 'none', border: '1px solid #2a1f40', color: '#7a748e', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12 }}>
                              Cancelar
                            </button>
                            <button onClick={confirmEdit}
                              style={{ background: '#7c5af0', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{
                          background: isMe
                            ? 'linear-gradient(135deg,#7c5af0,#b142f5)'
                            : '#1e1630',
                          color: '#ede8f8',
                          padding: '8px 14px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: 14,
                          lineHeight: 1.5,
                          wordBreak: 'break-word',
                        }}>
                          {msg.content}
                          {msg.edited && (
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>(editado)</span>
                          )}
                        </div>
                      )}
                      <p style={{ margin: '2px 4px 0', fontSize: 10, color: '#4a4560', textAlign: isMe ? 'right' : 'left' }}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Message action menu */}
                  <AnimatePresence>
                    {menuMsgId === msg.id && editingId !== msg.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        style={{
                          position: 'absolute', top: -6, right: isMe ? 40 : undefined, left: isMe ? undefined : 40,
                          display: 'flex', gap: 4,
                          background: '#1a1629', border: '1px solid #2a1f40',
                          borderRadius: 10, padding: '4px 6px',
                          zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                        }}
                      >
                        {isMe && (
                          <button
                            onClick={() => { setEditingId(msg.id); setEditValue(msg.content); }}
                            style={{ background: 'none', border: 'none', color: '#7a748e', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            title="Editar"
                          >
                            <Pencil style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                        {isMe && (
                          <button
                            onClick={() => confirmDelete(msg.id)}
                            style={{ background: 'none', border: 'none', color: '#ff4d6d', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            title="Deletar"
                          >
                            <Trash2 style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input ──────────────────────────────── */}
      <div style={{ padding: '8px 16px 16px', flexShrink: 0, borderTop: '1px solid #1e1630' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 10,
          background: '#1a1629', border: '1px solid #2a1f40',
          borderRadius: 14, padding: '10px 12px',
          transition: 'border-color 0.2s',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#7c5af0'; }}
          onBlurCapture={e  => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2a1f40'; }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={`Mensagem para ${name}`}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#ede8f8', fontSize: 14, outline: 'none',
              resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              maxHeight: 120, overflowY: 'auto',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            style={{
              width: 32, height: 32, borderRadius: 9, border: 'none',
              background: input.trim() && !sending
                ? 'linear-gradient(135deg,#7c5af0,#b142f5)'
                : 'rgba(255,255,255,0.04)',
              color: input.trim() && !sending ? '#fff' : '#4a4560',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              flexShrink: 0, transition: 'all 0.2s',
            }}
          >
            <Send style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
