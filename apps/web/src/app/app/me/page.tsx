'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare, UserPlus, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSocketStore } from '@/stores/socket.store';
import api from '@/lib/api';

/* ── Types ───────────────────────────────────── */
interface Conversation {
  partner: {
    id: string;
    username: string;
    profile?: { displayName?: string; avatarUrl?: string; status?: string } | null;
  };
  lastMessage: { content: string; createdAt: string; fromSelf: boolean };
  unread: number;
}

interface SearchUser {
  id: string;
  username: string;
  profile?: { displayName?: string; avatarUrl?: string; status?: string } | null;
}

/* ── Helpers ─────────────────────────────────── */
function statusColor(s?: string) {
  return s === 'ONLINE' ? '#43e3a3' : s === 'AWAY' ? '#f0b429' : s === 'BUSY' ? '#ff4d6d' : '#4a4560';
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function UserAvatar({ name, avatarUrl, size = 44 }: { name: string; avatarUrl?: string | null; size?: number }) {
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

/* ── Main page ───────────────────────────────── */
export default function MePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { dmUnread } = useSocketStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversations
  useEffect(() => {
    api.get('/dms/conversations')
      .then(({ data }) => setConversations(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [searchQuery]);

  const openDm = (partnerId: string) => {
    router.push(`/app/dms/${partnerId}`);
  };

  const showSearch = searchQuery.trim().length >= 2;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: '#0d0a16', overflow: 'hidden', color: '#ede8f8',
    }}>
      {/* ── Header ─────────────────────────────── */}
      <div style={{
        height: 48, display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 20px', borderBottom: '1px solid #1e1630', flexShrink: 0,
        background: '#0f0c1a',
      }}>
        <MessageSquare style={{ width: 18, height: 18, color: '#7c5af0' }} />
        <span style={{ fontWeight: 800, fontSize: 15, color: '#ede8f8' }}>Mensagens Diretas</span>
      </div>

      {/* ── Search bar ─────────────────────────── */}
      <div style={{ padding: '16px 20px 8px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, color: '#4a4560', pointerEvents: 'none',
          }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar ou iniciar nova conversa..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 36px 10px 36px',
              borderRadius: 10,
              border: '1px solid #2a1f40',
              background: '#0b0816',
              color: '#ede8f8',
              fontSize: 13,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); }}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', color: '#4a4560', cursor: 'pointer',
                display: 'flex', alignItems: 'center',
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px', scrollbarWidth: 'thin', scrollbarColor: '#2a1f40 transparent' }}>

        {/* Search results */}
        <AnimatePresence mode="wait">
          {showSearch ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#4a4560', letterSpacing: '0.07em', padding: '8px 8px 4px', textTransform: 'uppercase' }}>
                {searching ? 'Buscando…' : `Resultados para "${searchQuery}"`}
              </p>
              {!searching && searchResults.length === 0 && (
                <p style={{ color: '#4a4560', fontSize: 13, padding: '8px 8px' }}>Nenhum usuário encontrado.</p>
              )}
              {searchResults.map(u => {
                const name = u.profile?.displayName || u.username;
                return (
                  <motion.button
                    key={u.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openDm(u.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 10px', borderRadius: 10, border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s', marginBottom: 2,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <UserAvatar name={name} avatarUrl={u.profile?.avatarUrl} size={40} />
                      <span style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 11, height: 11, borderRadius: '50%',
                        background: statusColor(u.profile?.status),
                        border: '2px solid #0d0a16',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#ede8f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#4a4560' }}>@{u.username}</p>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(124,90,240,0.12)', border: '1px solid rgba(124,90,240,0.2)',
                      borderRadius: 8, padding: '4px 10px', color: '#9b6dff', fontSize: 12, fontWeight: 700,
                    }}>
                      <MessageSquare style={{ width: 12, height: 12 }} />
                      Mensagem
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="convs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Conversations */}
              <p style={{ fontSize: 11, fontWeight: 800, color: '#4a4560', letterSpacing: '0.07em', padding: '8px 8px 4px', textTransform: 'uppercase' }}>
                Mensagens Recentes
              </p>

              {loading && (
                <p style={{ color: '#4a4560', fontSize: 13, padding: '8px 8px' }}>Carregando…</p>
              )}

              {!loading && conversations.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <MessageSquare style={{ width: 40, height: 40, color: '#2a1f40', margin: '0 auto 12px' }} />
                  <p style={{ color: '#4a4560', fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                    Nenhuma conversa ainda.<br />
                    Use a busca acima para encontrar alguém.
                  </p>
                </div>
              )}

              {!loading && conversations.map(conv => {
                const name = conv.partner.profile?.displayName || conv.partner.username;
                const preview = (conv.lastMessage.fromSelf ? 'Você: ' : '') + conv.lastMessage.content;
                const unreadCount = dmUnread.get(conv.partner.id) ?? conv.unread;
                return (
                  <motion.button
                    key={conv.partner.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => openDm(conv.partner.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 10px', borderRadius: 10, border: 'none',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.15s', marginBottom: 2,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <UserAvatar name={name} avatarUrl={conv.partner.profile?.avatarUrl} size={44} />
                      <span style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 12, height: 12, borderRadius: '50%',
                        background: statusColor(conv.partner.profile?.status),
                        border: '2px solid #0d0a16',
                      }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: unreadCount > 0 ? 800 : 600, color: '#ede8f8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                        <span style={{ fontSize: 11, color: '#4a4560', flexShrink: 0 }}>{timeAgo(conv.lastMessage.createdAt)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: unreadCount > 0 ? '#c0b8d4' : '#4a4560', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview.length > 40 ? preview.slice(0, 40) + '…' : preview}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <span style={{ background: '#7c5af0', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
