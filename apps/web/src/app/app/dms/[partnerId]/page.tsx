'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ArrowLeft, Pencil, Trash2, X, Phone, Search, Paperclip, Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSocketStore, type DmMessage } from '@/stores/socket.store';
import { useDmCall } from '@/stores/dm-call.store';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { MessageSkeleton } from '@/components/ui/message-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { AttachmentView, GifView, isGifUrl } from '@/components/chat/media';
import { VoiceRecorderButton } from '@/components/chat/voice-recorder';
import { GifButton } from '@/components/chat/gif-picker';
import api from '@/lib/api';

/* ── Types ───────────────────────────────────── */
interface Partner {
  id: string;
  username: string;
  profile?: { displayName?: string; avatarUrl?: string; status?: string } | null;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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
    // eslint-disable-next-line @next/next/no-img-element
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

// Destaca o termo buscado no resultado
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark style={{ background: 'rgba(176,92,255,0.35)', color: '#fff', borderRadius: 3, padding: '0 2px' }}>{text.slice(i, i + term.length)}</mark>
      {text.slice(i + term.length)}
    </>
  );
}

/* ── Main component ──────────────────────────── */
export default function DmPage() {
  const params   = useParams();
  const router   = useRouter();
  const partnerId = params?.partnerId as string;

  const { user }   = useAuthStore();
  const { on, connected, dmMessages, setDmMessages, addDmMessage, updateDmMessage, deleteDmMessage, markDmRead } = useSocketStore();
  const { phase: callPhase, partner: callPartner, call } = useDmCall();

  const [partner,    setPartner   ] = useState<Partner | null>(null);
  const [input,      setInput     ] = useState('');
  const [sending,    setSending   ] = useState(false);
  const [editingId,  setEditingId ] = useState<string | null>(null);
  const [editValue,  setEditValue ] = useState('');
  const [menuMsgId,  setMenuMsgId ] = useState<string | null>(null);
  const [loadingMore,setLoadingMore] = useState(false);
  const [hasMore,    setHasMore   ] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false); // primeira carga (mostra silhuetas)
  const [uploading,  setUploading ] = useState(false);
  const [notice,     setNotice    ] = useState('');
  const [lightbox,   setLightbox  ] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ,    setSearchQ   ] = useState('');
  const [results,    setResults   ] = useState<DmMessage[] | null>(null);
  const [searching,  setSearching ] = useState(false);
  const [flashId,    setFlashId   ] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);

  const messages: DmMessage[] = dmMessages.get(partnerId) ?? [];

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 4500);
  }, []);

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
    setHistoryLoaded(false);
    setSearchOpen(false); setResults(null); setSearchQ('');
    api.get(`/dms/${partnerId}/messages?limit=50`)
      .then(({ data }) => {
        const msgs: DmMessage[] = Array.isArray(data) ? data : [];
        setDmMessages(partnerId, msgs);
        setHasMore(msgs.length === 50);
        // Mark as read
        markDmRead(partnerId);
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
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
      const { data } = await api.get(`/dms/${partnerId}/messages?limit=50&before=${encodeURIComponent(oldest)}`);
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
  const sendText = useCallback(async (content: string) => {
    await api.post(`/dms/${partnerId}/send`, { content });
    // Message will arrive via dm:new socket event
  }, [partnerId]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    try {
      await sendText(content);
    } catch (err: any) {
      setInput(content); // restore on error
      flash(err?.response?.data?.message || 'Não foi possível enviar');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, sendText, flash]);

  // ── Arquivo / foto / mensagem de voz ──────────
  const sendFile = useCallback(async (file: Blob, fileName: string, caption = '') => {
    const form = new FormData();
    form.append('file', file, fileName);
    if (caption) form.append('content', caption);
    await api.post(`/dms/${partnerId}/attachment`, form);
  }, [partnerId]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { flash('Arquivo muito grande (máximo 50 MB)'); return; }
    setUploading(true);
    try {
      await sendFile(file, file.name, input.trim());
      setInput('');
    } catch (err: any) {
      flash(err?.response?.data?.message || 'Não foi possível enviar o arquivo');
    } finally {
      setUploading(false);
    }
  };

  // ── Edit message ──────────────────────────────
  const confirmEdit = async () => {
    if (!editingId || !editValue.trim()) return;
    try {
      await api.put(`/dms/messages/${editingId}`, { content: editValue.trim() });
      // Will arrive via dm:updated
    } catch (err: any) {
      flash(err?.response?.data?.message || 'Não foi possível editar');
    }
    setEditingId(null);
    setEditValue('');
  };

  // ── Delete message ────────────────────────────
  const confirmDelete = async (messageId: string) => {
    if (!window.confirm('Apagar esta mensagem para os dois?')) return;
    try {
      await api.delete(`/dms/messages/${messageId}`);
      // Will arrive via dm:deleted
    } catch {}
    setMenuMsgId(null);
  };

  // ── Reações ───────────────────────────────────
  const toggleReaction = async (msg: DmMessage, emoji: string) => {
    const mine = msg.reactions?.some(r => r.userId === user?.id && r.emoji === emoji);
    try {
      if (mine) await api.delete(`/dms/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}`);
      else await api.post(`/dms/messages/${msg.id}/reactions/${encodeURIComponent(emoji)}`);
    } catch (err: any) {
      flash(err?.response?.data?.message || 'Não foi possível reagir');
    }
  };

  // ── Busca ─────────────────────────────────────
  useEffect(() => {
    if (!searchOpen) return;
    const term = searchQ.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.get(`/dms/${partnerId}/search`, { params: { q: term } })
        .then(({ data }) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen, partnerId]);

  const jumpTo = (id: string) => {
    const el = document.getElementById(`dm-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1800);
      setSearchOpen(false);
    } else {
      flash('Essa mensagem é mais antiga — role para cima para carregar.');
    }
  };

  const name = partner?.profile?.displayName || partner?.username || '...';
  const inCallHere = callPhase !== 'idle' && callPartner?.id === partnerId;
  const busy = sending || uploading;

  // ── Group messages by date ────────────────────
  const grouped: { date: string; msgs: DmMessage[] }[] = [];
  for (const msg of messages) {
    const d = formatDate(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  const headerBtn: React.CSSProperties = {
    background: 'none', border: 'none', color: '#8a82a3', cursor: 'pointer',
    display: 'flex', padding: 8, borderRadius: 8,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0a16', overflow: 'hidden', position: 'relative' }}>
      {/* ── Header ─────────────────────────────── */}
      <div className="!h-14 sm:!h-12 !px-3 sm:!px-4" style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', borderBottom: '1px solid #1e1630', flexShrink: 0,
        background: '#0f0c1a',
      }}>
        <MobileMenuButton />
        <button
          onClick={() => router.back()}
          aria-label="Voltar"
          className="[@media(hover:none)]:!p-2.5"
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
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#ede8f8', lineHeight: 1.2 }} className="truncate">{name}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#4a4560', lineHeight: 1 }} className="truncate">@{partner.username}</p>
            </div>
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
          {partner && partner.id !== user?.id && (
            <button
              onClick={() => call({ id: partner.id, displayName: name, avatarUrl: partner.profile?.avatarUrl })}
              disabled={callPhase !== 'idle'}
              title={inCallHere ? 'Em chamada' : 'Ligar'}
              className="hover:!text-white hover:bg-white/5 disabled:opacity-50"
              style={{ ...headerBtn, color: inCallHere ? '#43e3a3' : headerBtn.color }}
            >
              <Phone style={{ width: 18, height: 18 }} />
            </button>
          )}
          <button
            onClick={() => setSearchOpen(v => !v)}
            title="Buscar na conversa"
            className="hover:!text-white hover:bg-white/5"
            style={{ ...headerBtn, color: searchOpen ? '#fff' : headerBtn.color }}
          >
            <Search style={{ width: 18, height: 18 }} />
          </button>
        </div>
      </div>

      {/* ── Busca ──────────────────────────────── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 right-3 top-[62px] sm:top-[54px] w-[min(380px,calc(100%-24px))] rounded-xl border border-[#2a1f40] shadow-2xl"
            style={{ background: '#140f22' }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#2a1f40]">
              <Search className="w-4 h-4 text-[#8a82a3]" />
              <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder={`Buscar na conversa com ${name}`} maxLength={100}
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#5d5674]" />
              <button onClick={() => setSearchOpen(false)} className="text-[#8a82a3] hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto">
              {searching && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#8a82a3]" /></div>}
              {!searching && results === null && (
                <p className="text-[#5d5674] text-sm text-center py-6 px-4">Digite pelo menos 2 letras</p>
              )}
              {!searching && results?.length === 0 && (
                <p className="text-[#5d5674] text-sm text-center py-6 px-4">Nada encontrado</p>
              )}
              {!searching && results?.map(r => (
                <button key={r.id} onClick={() => jumpTo(r.id)}
                  className="w-full text-left px-3 py-2.5 hover:bg-white/5 border-b border-[#1e1630] last:border-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold text-[#c9a8ff] truncate">
                      {r.senderId === user?.id ? 'Você' : name}
                    </span>
                    <span className="text-[11px] text-[#5d5674] shrink-0">{formatDate(r.createdAt)} · {formatTime(r.createdAt)}</span>
                  </div>
                  <p className="text-[13px] text-[#d6d0e0] line-clamp-2 break-words"><Highlight text={r.content} term={searchQ.trim()} /></p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

        {messages.length === 0 && !historyLoaded && <MessageSkeleton />}

        {messages.length === 0 && historyLoaded && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <EmptyState
              image="/mascote-notif.webp"
              title={`Início da sua conversa com ${name}`}
              text="Mande a primeira mensagem — só vocês dois veem esta conversa."
              actionLabel="Dizer oi 👋"
              onAction={() => {
                setInput('Oi! 👋');
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            />
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
              const gif = isGifUrl(msg.content) && !msg.attachments?.length;
              const hasBubble = !!msg.content && !gif;
              // Reações agrupadas por emoji
              const reactionGroups = Object.entries(
                (msg.reactions || []).reduce<Record<string, string[]>>((acc, r) => {
                  (acc[r.emoji] ||= []).push(r.userId); return acc;
                }, {}),
              );

              return (
                <div
                  key={msg.id}
                  id={`dm-${msg.id}`}
                  style={{
                    position: 'relative', marginTop: grouped_with_prev ? 2 : 12,
                    borderRadius: 12, transition: 'background 0.4s',
                    background: flashId === msg.id ? 'rgba(176,92,255,0.14)' : 'transparent',
                  }}
                  onMouseEnter={() => setMenuMsgId(msg.id)}
                  onMouseLeave={() => setMenuMsgId(null)}
                  // Celular: tocar na mensagem abre/fecha o menu (reagir/editar/apagar)
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, textarea, input, audio, video')) return;
                    setMenuMsgId(id => (id === msg.id ? null : msg.id));
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    {!grouped_with_prev && !isMe && (
                      <UserAvatar name={name} avatarUrl={partner?.profile?.avatarUrl} size={30} />
                    )}
                    {!grouped_with_prev && isMe && <div style={{ width: 30, flexShrink: 0 }} />}
                    {grouped_with_prev && <div style={{ width: 30, flexShrink: 0 }} />}

                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
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
                            maxLength={4000}
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
                        <>
                          {gif && <GifView url={msg.content.trim()} onClick={() => setLightbox(msg.content.trim())} />}
                          {hasBubble && (
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
                              whiteSpace: 'pre-wrap',
                            }}>
                              {msg.content}
                              {msg.edited && (
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>(editado)</span>
                              )}
                            </div>
                          )}
                          {!!msg.attachments?.length && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: hasBubble ? 6 : 0, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                              {msg.attachments.map((a, k) => (
                                <AttachmentView key={a.id || k} att={a} mine={isMe} onImageClick={setLightbox} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {reactionGroups.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          {reactionGroups.map(([emoji, users]) => {
                            const mine = users.includes(user?.id || '');
                            return (
                              <button key={emoji} onClick={() => toggleReaction(msg, emoji)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999,
                                  fontSize: 13, cursor: 'pointer',
                                  background: mine ? 'rgba(124,90,240,0.22)' : '#1a1629',
                                  border: `1px solid ${mine ? 'rgba(176,92,255,0.55)' : '#2a1f40'}`,
                                  color: mine ? '#e6d8ff' : '#a99fc0',
                                }}>
                                <span>{emoji}</span>{users.length > 1 && <span style={{ fontSize: 11 }}>{users.length}</span>}
                              </button>
                            );
                          })}
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
                          position: 'absolute', top: -14, right: isMe ? 40 : undefined, left: isMe ? undefined : 40,
                          display: 'flex', gap: 2, alignItems: 'center',
                          background: '#1a1629', border: '1px solid #2a1f40',
                          borderRadius: 10, padding: '3px 5px',
                          zIndex: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                        }}
                      >
                        {QUICK_REACTIONS.map(e => (
                          <button key={e} onClick={() => toggleReaction(msg, e)} title={`Reagir ${e}`}
                            className="hover:bg-white/10 [@media(hover:none)]:!p-1.5"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, fontSize: 15, lineHeight: 1 }}>
                            {e}
                          </button>
                        ))}
                        {isMe && msg.content && !gif && <span style={{ width: 1, height: 16, background: '#2a1f40', margin: '0 2px' }} />}
                        {isMe && msg.content && !gif && (
                          <button
                            onClick={() => { setEditingId(msg.id); setEditValue(msg.content); }}
                            className="[@media(hover:none)]:!p-2.5" style={{ background: 'none', border: 'none', color: '#7a748e', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            title="Editar"
                          >
                            <Pencil className="[@media(hover:none)]:!w-4 [@media(hover:none)]:!h-4" style={{ width: 12, height: 12 }} />
                          </button>
                        )}
                        {isMe && (
                          <button
                            onClick={() => confirmDelete(msg.id)}
                            className="[@media(hover:none)]:!p-2.5" style={{ background: 'none', border: 'none', color: '#ff4d6d', cursor: 'pointer', padding: '2px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                            title="Apagar"
                          >
                            <Trash2 className="[@media(hover:none)]:!w-4 [@media(hover:none)]:!h-4" style={{ width: 12, height: 12 }} />
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
        {notice && (
          <p style={{ color: '#ff8098', fontSize: 12, margin: '0 4px 6px' }}>{notice}</p>
        )}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 6,
          background: '#1a1629', border: '1px solid #2a1f40',
          borderRadius: 14, padding: '8px 8px 8px 6px',
          transition: 'border-color 0.2s',
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#7c5af0'; }}
          onBlurCapture={e  => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2a1f40'; }}
        >
          <input ref={fileRef} type="file" hidden onChange={onPickFile}
            accept="image/*,video/mp4,video/webm,audio/*,.pdf,.txt,.zip,.doc,.docx,.xls,.xlsx" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Enviar foto ou arquivo"
            className="text-[#8a82a3] hover:text-white disabled:opacity-40"
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
          >
            {uploading ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Paperclip style={{ width: 16, height: 16 }} />}
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder={`Mensagem para ${name}`}
            rows={1}
            maxLength={4000}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: '#ede8f8', fontSize: 14, outline: 'none',
              resize: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              maxHeight: 120, overflowY: 'auto', padding: '5px 2px',
            }}
          />
          <GifButton disabled={busy} onPick={(url) => sendText(url).catch((e: any) => flash(e?.response?.data?.message || 'Não foi possível enviar o GIF'))} />
          {input.trim() ? (
            <button
              onClick={sendMessage}
              disabled={sending}
              title="Enviar"
              style={{
                width: 32, height: 32, borderRadius: 9, border: 'none',
                background: !sending ? 'linear-gradient(135deg,#7c5af0,#b142f5)' : 'rgba(255,255,255,0.04)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: !sending ? 'pointer' : 'not-allowed',
                flexShrink: 0, transition: 'all 0.2s',
              }}
            >
              <Send style={{ width: 14, height: 14 }} />
            </button>
          ) : (
            <VoiceRecorderButton
              disabled={busy}
              onError={flash}
              onSend={(blob, fileName) => sendFile(blob, fileName)}
            />
          )}
        </div>
      </div>

      {/* Foto/GIF em tela cheia */}
      {lightbox && (
        <div className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setLightbox(null)} title="Fechar"><X className="w-6 h-6" /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

