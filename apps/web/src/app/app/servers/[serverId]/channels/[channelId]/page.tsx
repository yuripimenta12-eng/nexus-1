'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Send, Paperclip, Smile, AtSign, X, Reply, Edit2, Trash2, Loader2, Menu, Users, Pin, PinOff, Search, Bell, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AttachmentView, GifView, isGifUrl } from '@/components/chat/media';
import { VoiceRecorderButton } from '@/components/chat/voice-recorder';
import { GifButton } from '@/components/chat/gif-picker';
import { useMutes } from '@/lib/mutes';
import { useServerPerms } from '@/lib/perms';
import { playMention } from '@/lib/sounds';
import api from '@/lib/api';
import { getSocket, trackChannel, untrackChannel, trackServer } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { formatMessageDate, cn, isImageMime, formatFileSize } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { MemberList } from '@/components/servers/member-list';
import { MessageSkeleton } from '@/components/ui/message-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

/** Gera um ID único de cliente para deduplicação de mensagens */
function genClientMsgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Render rico: emojis customizados (:nome:) + menções (@usuario) destacadas */
function renderRich(
  text: string,
  map: Record<string, string>,
  myNames: string[], // username e displayName do usuário atual (minúsculos)
): React.ReactNode {
  if (!text) return text;
  const parts = text.split(/(:[a-z0-9_]+:|@[\wÀ-ÿ.]+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const emoji = part.match(/^:([a-z0-9_]+):$/);
    if (emoji && map[emoji[1]]) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={i} src={map[emoji[1]]} alt={part} title={part}
        className="inline-block w-6 h-6 object-contain align-text-bottom mx-0.5" />;
    }
    if (part.startsWith('@') && part.length > 1) {
      const isMe = myNames.includes(part.slice(1).toLowerCase());
      return (
        <span
          key={i}
          className="rounded px-1 py-[1px] font-medium"
          style={isMe
            ? { background: 'rgba(255,106,0,0.28)', color: '#ffb27d' }
            : { background: 'rgba(122,44,255,0.22)', color: '#c9a8ff' }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/** A mensagem menciona este usuário? (@username ou @DisplayName) */
function mentionsMe(content: string, myNames: string[]): boolean {
  if (!content || !content.includes('@')) return false;
  const low = content.toLowerCase();
  return myNames.some(n => n && low.includes('@' + n));
}

/* Emojis padrão do seletor */
const DEFAULT_EMOJIS = [
  '😀','😂','🤣','😊','😍','😘','😎','🤔','😅','🙃','😭','😤','😡','🥶','🤯','🥳',
  '👍','👎','👏','🙌','🙏','💪','🤝','✌️','🤞','👀','🔥','✨','⭐','💯','❤️','💔',
  '😱','🤗','🤫','😴','🤤','🤡','💀','👻','🎉','🎮','🎧','🎵','⚽','🏆','🍕','☕',
];

interface Message {
  id: string;
  content: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  pinned?: boolean;
  authorId: string;
  clientMsgId?: string; // ID de cliente para deduplicação (mensagens otimistas)
  pending?: boolean;    // mensagem ainda não confirmada pelo servidor
  author: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl: string | null };
  };
  reactions: Array<{ id: string; userId: string; emoji: string }>;
  attachments: Array<{ id: string; url: string; fileName: string; fileSize: number; mimeType: string }>;
  replyTo?: {
    id: string;
    content: string;
    author: { profile: { displayName: string } };
  } | null;
}

interface TypingUser {
  userId: string;
  username?: string;
}

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const serverId = params.serverId as string;
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [channelName, setChannelName] = useState<string>('');
  const [content, setContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const socket = getSocket();

  // O que meu cargo permite (só para mostrar botões; o servidor confere de novo)
  const { can } = useServerPerms(serverId);
  const canPin = can('pin_messages') || can('manage_messages');
  const canManageMessages = can('manage_messages');
  const canVoiceMsg = can('send_voice_messages');
  const router = useRouter();

  // Silenciar este canal (sem som, aviso e contador)
  const channelMuted = useMutes(s => s.channels.has(channelId));
  const serverMuted = useMutes(s => s.servers.has(serverId));
  const toggleChannelMute = useMutes(s => s.toggleChannel);

  // Busca de mensagens no servidor
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHere, setSearchHere] = useState(true);
  const [results, setResults] = useState<any[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const term = searchQ.trim();
    if (term.length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      setSearching(true);
      api.get(`/servers/${serverId}/search`, { params: { q: term, ...(searchHere ? { channelId } : {}) } })
        .then(({ data }) => setResults(Array.isArray(data) ? data : []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ, searchOpen, searchHere, serverId, channelId]);
  useEffect(() => { setSearchOpen(false); setResults(null); setSearchQ(''); }, [channelId]);
  const jumpTo = (r: any) => {
    if (r.channelId !== channelId) {
      router.push(`/app/servers/${serverId}/channels/${r.channelId}`);
      return;
    }
    const el = document.getElementById(`msg-${r.id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashId(r.id);
      setTimeout(() => setFlashId(null), 1800);
      setSearchOpen(false);
    } else flash('Essa mensagem é mais antiga que as carregadas aqui.');
  };

  // Mensagens fixadas (painel no topo do canal)
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pins, setPins] = useState<Message[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const pinsOpenRef = useRef(false);
  pinsOpenRef.current = pinsOpen;
  const loadPins = useCallback(() => {
    if (!channelId) return;
    setPinsLoading(true);
    api.get(`/channels/${channelId}/messages/pinned`)
      .then(({ data }) => setPins(Array.isArray(data) ? data : []))
      .catch(() => setPins([]))
      .finally(() => setPinsLoading(false));
  }, [channelId]);
  useEffect(() => { setPinsOpen(false); setPins([]); }, [channelId]);

  // Aviso curto quando o servidor recusa algo (ex.: cargo sem permissão)
  const flash = useCallback((msg: string) => {
    setUploadError(msg);
    setTimeout(() => setUploadError(''), 4500);
  }, []);

  // Emojis customizados do servidor (:nome: → imagem)
  const [emojiMap, setEmojiMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}/emojis`)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data.forEach((e: any) => { map[e.name] = e.url; });
        setEmojiMap(map);
      })
      .catch(() => {});
  }, [serverId]);

  // Nomes dos membros (para "Fulano está digitando..." e destacar menções)
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}/members`)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data.forEach((m: any) => { map[m.userId] = m.user?.profile?.displayName || m.user?.username || ''; });
        setMemberNames(map);
      })
      .catch(() => {});
  }, [serverId]);

  // Meus nomes (para detectar menção a mim)
  const myNames = useMemo(() => [
    (user?.username || '').toLowerCase(),
    (user?.profile?.displayName || '').toLowerCase(),
  ].filter(Boolean), [user]);

  // Seletor de emoji + lightbox de imagem + gaveta de membros (celular)
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [membersDrawer, setMembersDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setLightbox(null); setEmojiOpen(false); setMembersDrawer(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Carrega mensagens ─────────────────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    setIsLoading(true);

    // Carrega nome do canal
    api.get(`/servers/${serverId}/channels/${channelId}`)
      .then(({ data }) => {
        if (data?.name) setChannelName(data.name);
      })
      .catch(() => {
        // Tenta via rota alternativa se a acima não existir
        api.get(`/channels/${channelId}`)
          .then(({ data }) => { if (data?.name) setChannelName(data.name); })
          .catch(() => {});
      });

    // Carrega mensagens — sempre encerra o loading (sucesso ou erro)
    api.get(`/channels/${channelId}/messages`)
      .then(({ data }) => {
        setMessages(data.messages ?? []);
        scrollToBottom();
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [channelId]);

  // ── Eventos Socket.IO ─────────────────────────────────────────
  useEffect(() => {
    if (!channelId || !socket) return;

    socket.emit('channel:join', { channelId });
    trackChannel(channelId);
    if (serverId) trackServer(serverId);

    socket.on('message:new', (msg: Message & { clientMsgId?: string }) => {
      setMessages(prev => {
        // Deduplicação: substitui mensagem otimista pelo id do servidor
        if (msg.clientMsgId) {
          const idx = prev.findIndex(m => m.clientMsgId === msg.clientMsgId && m.pending);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...msg, pending: false };
            return next;
          }
        }
        // Previne duplicata caso o evento chegue duas vezes
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Som quando alguém menciona você (@seu_nome)
      if (msg.authorId !== user?.id && mentionsMe(msg.content, myNames)) {
        try { playMention(); } catch { /* autoplay bloqueado */ }
      }
      scrollToBottom();
    });

    socket.on('message:updated', (msg: Message) => {
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });

    socket.on('message:deleted', ({ messageId }: { messageId: string }) => {
      setMessages(prev => prev.map(m =>
        m.id === messageId ? { ...m, deleted: true, content: '[mensagem excluída]' } : m
      ));
    });

    socket.on('reaction:added', ({ messageId, userId, emoji }: any) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return { ...m, reactions: [...m.reactions, { id: Date.now().toString(), userId, emoji }] };
      }));
    });

    socket.on('reaction:removed', ({ messageId, userId, emoji }: any) => {
      setMessages(prev => prev.map(m => {
        if (m.id !== messageId) return m;
        return { ...m, reactions: m.reactions.filter(r => !(r.userId === userId && r.emoji === emoji)) };
      }));
    });

    socket.on('message:pinned', ({ messageId, pinned }: { messageId: string; pinned: boolean }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m));
      if (!pinned) setPins(prev => prev.filter(p => p.id !== messageId));
      else if (pinsOpenRef.current) loadPins();
    });

    // Recusa do servidor no tempo real: tira o "enviando…" e explica o motivo
    const onException = (err: any) => {
      const msg = typeof err?.message === 'string' && err.message !== 'Internal server error'
        ? err.message : 'Não foi possível concluir a ação';
      setMessages(prev => prev.filter(m => !m.pending));
      flash(msg);
    };
    socket.on('exception', onException);

    socket.on('typing:update', ({ userId, typing }: { userId: string; typing: boolean; channelId: string }) => {
      setTypingUsers(prev => {
        if (typing) {
          if (prev.find(u => u.userId === userId)) return prev;
          return [...prev, { userId }];
        }
        return prev.filter(u => u.userId !== userId);
      });
    });

    return () => {
      socket.emit('channel:leave', { channelId });
      untrackChannel(channelId);
      socket.off('message:new');
      socket.off('message:updated');
      socket.off('message:deleted');
      socket.off('reaction:added');
      socket.off('reaction:removed');
      socket.off('message:pinned');
      socket.off('exception', onException);
      socket.off('typing:update');
    };
  }, [channelId]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // ── Enviar mensagem ───────────────────────────────────────────
  const handleSend = useCallback(() => {
    if (!content.trim() || !user) return;

    const clientMsgId = genClientMsgId();
    const trimmed = content.trim();

    // Mensagem otimista: exibe imediatamente sem aguardar o servidor
    const optimistic: Message = {
      id: clientMsgId,       // ID temporário; será substituído pelo id real do servidor
      clientMsgId,
      content: trimmed,
      createdAt: new Date().toISOString(),
      edited: false,
      deleted: false,
      pending: true,
      authorId: user.id,
      author: {
        id: user.id,
        username: user.username,
        profile: {
          displayName: user.profile?.displayName || user.username,
          avatarUrl: user.profile?.avatarUrl || null,
        },
      },
      reactions: [],
      attachments: [],
      replyTo: replyTo
        ? { id: replyTo.id, content: replyTo.content, author: replyTo.author }
        : null,
    };

    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    socket.emit('message:send', {
      channelId,
      content: trimmed,
      replyToId: replyTo?.id,
      clientMsgId,
    });

    setContent('');
    setReplyTo(null);
    textareaRef.current?.focus();
  }, [content, channelId, replyTo, socket, user]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editingId) {
        handleSaveEdit();
      } else {
        handleSend();
      }
    }
    if (e.key === 'Escape') {
      setEditingId(null);
      setReplyTo(null);
    }
  };

  // ── Typing ────────────────────────────────────────────────────
  const handleTyping = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    socket.emit('typing:start', { channelId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit('typing:stop', { channelId });
    }, 3000);
  };

  // ── Editar ────────────────────────────────────────────────────
  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim() || !editingId) return;
    socket.emit('message:edit', { messageId: editingId, content: editContent.trim() });
    setEditingId(null);
  };

  // ── Deletar ───────────────────────────────────────────────────
  const handleDelete = (msg: Message) => {
    setDeleteConfirmId(msg.id);
  };

  const confirmDelete = (messageId: string) => {
    socket.emit('message:delete', { messageId, channelId });
    setDeleteConfirmId(null);
  };

  // ── Fixar ─────────────────────────────────────────────────────
  const handlePin = (msg: Message) => {
    socket.emit('message:pin', { messageId: msg.id, pinned: !msg.pinned });
  };

  // ── Reação ────────────────────────────────────────────────────
  const handleReaction = (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId);
    const hasReacted = message?.reactions.some(r => r.userId === user?.id && r.emoji === emoji);

    if (hasReacted) {
      socket.emit('reaction:remove', { messageId, channelId, emoji });
    } else {
      socket.emit('reaction:add', { messageId, channelId, emoji });
    }
  };

  // ── Agrupa reações ────────────────────────────────────────────
  const groupReactions = (reactions: Message['reactions']) => {
    const map = new Map<string, string[]>();
    reactions.forEach(r => {
      if (!map.has(r.emoji)) map.set(r.emoji, []);
      map.get(r.emoji)!.push(r.userId);
    });
    return Array.from(map.entries()).map(([emoji, users]) => ({ emoji, count: users.length, reacted: users.includes(user?.id || '') }));
  };

  return (
    <div className="flex h-full nx-page-bg">
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header do canal */}
      <div className="h-[60px] md:h-[70px] flex items-center gap-2 md:gap-3 px-3 md:px-5 border-b border-[var(--th-line)] bg-[var(--th-side)] backdrop-blur shrink-0">
        <MobileMenuButton />
        <span className="text-[#b05cff] text-2xl font-bold leading-none">#</span>
        <div className="min-w-0">
          <h2 className="font-semibold text-white text-[15px] truncate">
            {channelName || 'canal'}
          </h2>
          <p className="text-[#9188a2] text-[11px]">Canal de texto da comunidade</p>
        </div>
        {/* Busca */}
        <div className="ml-auto relative">
          <button
            onClick={() => setSearchOpen(v => !v)}
            className={cn('p-2 rounded-lg transition-colors', searchOpen ? 'text-white bg-surface-raised' : 'text-muted hover:text-white')}
            title="Buscar mensagens"
          >
            <Search className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {searchOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSearchOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-40 w-[min(400px,calc(100vw-24px))] rounded-xl border border-[var(--th-line)] bg-[var(--th-side)] shadow-2xl"
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--th-line)]">
                    <Search className="w-4 h-4 text-muted" />
                    <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} maxLength={100}
                      placeholder={searchHere ? `Buscar em #${channelName || 'canal'}` : 'Buscar no servidor'}
                      className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted" />
                    <button onClick={() => setSearchOpen(false)} className="text-muted hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-1 px-3 pt-2">
                    {[true, false].map(v => (
                      <button key={String(v)} onClick={() => setSearchHere(v)}
                        className={cn('text-[11px] px-2 py-1 rounded-full border transition-colors',
                          searchHere === v ? 'border-accent/60 text-white bg-accent/15' : 'border-[var(--th-line)] text-muted hover:text-white')}>
                        {v ? 'Neste canal' : 'Todo o servidor'}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-[55vh] overflow-y-auto py-1">
                    {searching && <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>}
                    {!searching && results === null && <p className="text-muted text-sm text-center py-6">Digite pelo menos 2 letras</p>}
                    {!searching && results?.length === 0 && <p className="text-muted text-sm text-center py-6">Nada encontrado</p>}
                    {!searching && results?.map(r => (
                      <button key={r.id} onClick={() => jumpTo(r)}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/5 flex gap-3">
                        <Avatar src={r.author?.profile?.avatarUrl} name={r.author?.profile?.displayName || r.author?.username || '?'} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-white text-[13px] font-medium truncate">{r.author?.profile?.displayName || r.author?.username}</span>
                            {!searchHere && <span className="text-[#b05cff] text-[11px] shrink-0">#{r.channel?.name}</span>}
                            <span className="text-muted text-[11px] shrink-0 ml-auto">{formatMessageDate(r.createdAt)}</span>
                          </div>
                          <p className="text-[13px] text-[#d6d0e0] line-clamp-2 break-words">{r.content}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        {/* Silenciar canal */}
        <button
          onClick={async () => {
            try { const m = await toggleChannelMute(channelId); flash(m ? 'Canal silenciado' : 'Avisos do canal reativados'); }
            catch { flash('Não foi possível mudar agora'); }
          }}
          className={cn('p-2 rounded-lg transition-colors', channelMuted ? 'text-[#ff8098]' : 'text-muted hover:text-white')}
          title={channelMuted ? 'Reativar avisos deste canal' : serverMuted ? 'O servidor inteiro está silenciado' : 'Silenciar este canal'}
        >
          {channelMuted || serverMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </button>
        {/* Mensagens fixadas */}
        <div className="relative">
          <button
            onClick={() => { if (!pinsOpen) loadPins(); setPinsOpen(!pinsOpen); }}
            className={cn('p-2 rounded-lg transition-colors', pinsOpen ? 'text-white bg-surface-raised' : 'text-muted hover:text-white')}
            title="Mensagens fixadas"
          >
            <Pin className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {pinsOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPinsOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-11 z-40 w-[min(380px,calc(100vw-24px))] max-h-[60vh] overflow-y-auto rounded-xl border border-[var(--th-line)] bg-[var(--th-side)] shadow-2xl"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--th-line)] sticky top-0 bg-[var(--th-side)]">
                    <Pin className="w-4 h-4 text-[#b05cff]" />
                    <span className="text-white text-sm font-semibold">Mensagens fixadas</span>
                    <button onClick={() => setPinsOpen(false)} className="ml-auto text-muted hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
                  </div>
                  {pinsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>
                  ) : pins.length === 0 ? (
                    <p className="text-muted text-sm text-center px-6 py-8">
                      Nenhuma mensagem fixada ainda.{canPin ? ' Passe o mouse numa mensagem e toque no alfinete.' : ''}
                    </p>
                  ) : (
                    <ul className="divide-y divide-[var(--th-line)]">
                      {pins.map(p => (
                        <li key={p.id} className="px-4 py-3 flex gap-3 group/pin">
                          <Avatar src={p.author.profile.avatarUrl} name={p.author.profile.displayName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-white text-sm font-medium truncate">{p.author.profile.displayName}</span>
                              <span className="text-muted text-[11px] shrink-0">{formatMessageDate(p.createdAt)}</span>
                            </div>
                            <p className="text-sm text-[#d6d0e0] break-words line-clamp-4">
                              {p.content
                                ? renderRich(p.content, emojiMap, myNames)
                                : (p.attachments?.length ? `📎 ${p.attachments[0].fileName}` : '')}
                            </p>
                          </div>
                          {canPin && (
                            <button
                              onClick={() => socket.emit('message:pin', { messageId: p.id, pinned: false })}
                              className="text-muted hover:text-white self-start opacity-0 group-hover/pin:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                              title="Desafixar"
                            >
                              <PinOff className="w-4 h-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        {/* Membros no celular (a lista lateral some em telas pequenas) */}
        <button
          onClick={() => setMembersDrawer(true)}
          className="lg:hidden text-muted hover:text-white p-2 rounded-lg transition-colors"
          title="Membros do servidor"
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* Gaveta de membros (celular) */}
      <AnimatePresence>
        {membersDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/60 z-40"
              onClick={() => setMembersDrawer(false)}
            />
            <motion.div
              initial={{ x: 280 }} animate={{ x: 0 }} exit={{ x: 280 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="lg:hidden fixed right-0 top-0 bottom-0 z-50 shadow-2xl max-w-[88vw] nx-safe-top nx-safe-bottom bg-[var(--th-side)]"
            >
              <MemberList serverId={serverId} variant="drawer" onClose={() => setMembersDrawer(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de confirmação de exclusão */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setDeleteConfirmId(null)}>
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-lg mb-2">Excluir mensagem</h3>
            <p className="text-muted text-sm mb-6">Tem certeza? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg bg-surface-raised text-muted hover:text-white text-sm transition-colors">
                Cancelar
              </button>
              <button onClick={() => confirmDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-lg bg-destructive hover:bg-red-600 text-white text-sm font-medium transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {isLoading ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <EmptyState
              image="/mascote-voz.webp"
              title={`Comece a conversa no #${channelName || 'canal'}`}
              text="Seja o primeiro a mandar uma mensagem. Dá até para chamar alguém com @."
              actionLabel="Mandar um oi 👋"
              onAction={() => {
                setContent('Oi, pessoal! 👋');
                setTimeout(() => textareaRef.current?.focus(), 0);
              }}
            />
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.authorId === user?.id;
            const isConsecutive = i > 0 && messages[i - 1].authorId === msg.authorId &&
              new Date(msg.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() < 5 * 60 * 1000;

            return (
              <MessageRow
                key={msg.id}
                msg={msg}
                isOwn={isOwn}
                isConsecutive={isConsecutive}
                onReply={() => setReplyTo(msg)}
                onEdit={() => startEdit(msg)}
                onDelete={() => handleDelete(msg)}
                onPin={() => handlePin(msg)}
                flash={flashId === msg.id}
                canPin={canPin}
                canManage={canManageMessages}
                onReaction={(emoji) => handleReaction(msg.id, emoji)}
                editingId={editingId}
                editContent={editContent}
                setEditContent={setEditContent}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                groupedReactions={groupReactions(msg.reactions)}
                currentUserId={user?.id || ''}
                emojiMap={emojiMap}
                myNames={myNames}
                onImageClick={setLightbox}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="px-4 py-1 flex items-center gap-2"
          >
            <div className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <span className="text-muted text-xs">
              {typingUsers.length === 1
                ? `${memberNames[typingUsers[0].userId] || 'alguém'} está digitando...`
                : typingUsers.length === 2
                  ? `${memberNames[typingUsers[0].userId] || 'alguém'} e ${memberNames[typingUsers[1].userId] || 'alguém'} estão digitando...`
                  : 'várias pessoas estão digitando...'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de input */}
      <div className="px-4 pb-4 pt-2 shrink-0">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 px-3 py-2 mb-1 bg-surface rounded-t-md border border-border"
            >
              <Reply className="w-3.5 h-3.5 text-muted shrink-0" />
              <span className="text-muted text-xs">
                Respondendo para{' '}
                <span className="text-accent font-medium">{replyTo.author.profile.displayName}</span>
                {': '}
                <span className="text-muted-foreground">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '...' : ''}</span>
              </span>
              <button onClick={() => setReplyTo(null)} className="ml-auto text-muted hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={cn(
          'flex items-end gap-2 bg-[var(--th-panel-2)] rounded-[15px] px-3 py-2 border border-[#30233e]',
          'focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(122,44,255,0.09)] transition-shadow',
          replyTo && 'rounded-t-none border-t-0',
        )}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            title="Enviar imagem ou arquivo"
            className="text-muted hover:text-white p-2 -m-1 md:p-1 md:m-0 rounded transition-colors disabled:opacity-50"
          >
            {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-accent" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,audio/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setUploadError('');
              setUploadingFile(true);
              try {
                const form = new FormData();
                form.append('file', file);
                // O texto digitado vira legenda do anexo
                form.append('content', content.trim());
                await api.post(`/upload/attachment/${channelId}`, form);
                setContent('');
                // A mensagem chega para todos (inclusive nós) via socket message:new
              } catch (err: any) {
                setUploadError(err?.response?.data?.message || 'Erro ao enviar o arquivo');
                setTimeout(() => setUploadError(''), 4000);
              } finally {
                setUploadingFile(false);
              }
            }}
          />

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder="Escrever uma mensagem..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm resize-none focus:outline-none
                       placeholder:text-muted min-h-[24px] max-h-36 leading-6 py-0.5"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = `${t.scrollHeight}px`;
            }}
          />

          <div className="flex items-center gap-1 relative">
            <GifButton
              onPick={(url) => socket.emit('message:send', { channelId, content: url, clientMsgId: genClientMsgId() })}
            />
            <button
              onClick={() => setEmojiOpen(v => !v)}
              className={cn('p-2 -m-1 md:p-1 md:m-0 rounded transition-colors', emojiOpen ? 'text-warning' : 'text-muted hover:text-warning')}
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Seletor de emojis */}
            <AnimatePresence>
              {emojiOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setEmojiOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    className="absolute bottom-11 right-0 z-50 w-72 max-h-80 overflow-y-auto rounded-2xl
                               border border-[var(--th-line-2)] bg-[var(--th-panel)] shadow-2xl p-3"
                  >
                    {Object.keys(emojiMap).length > 0 && (
                      <>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#786e83] mb-1.5">
                          Deste servidor
                        </p>
                        <div className="grid grid-cols-8 gap-1 mb-3">
                          {Object.entries(emojiMap).map(([name, url]) => (
                            <button
                              key={name}
                              title={`:${name}:`}
                              onClick={() => { setContent(c => c + `:${name}: `); setEmojiOpen(false); textareaRef.current?.focus(); }}
                              className="w-8 h-8 rounded-lg hover:bg-white/10 grid place-items-center"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt={name} className="w-6 h-6 object-contain" />
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#786e83] mb-1.5">
                      Emojis
                    </p>
                    <div className="grid grid-cols-8 gap-1">
                      {DEFAULT_EMOJIS.map(e => (
                        <button
                          key={e}
                          onClick={() => { setContent(c => c + e); setEmojiOpen(false); textareaRef.current?.focus(); }}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 text-xl leading-none grid place-items-center"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            {!content.trim() && canVoiceMsg ? (
              <VoiceRecorderButton
                disabled={uploadingFile}
                onError={flash}
                onSend={async (blob, fileName) => {
                  const form = new FormData();
                  form.append('file', blob, fileName);
                  await api.post(`/upload/attachment/${channelId}`, form);
                }}
              />
            ) : (
              <button
                onClick={handleSend}
                disabled={!content.trim()}
                title="Enviar"
                className={cn(
                  'w-9 h-9 rounded-[11px] flex items-center justify-center transition-all active:scale-95',
                  content.trim()
                    ? 'bg-gradient-to-br from-orange to-accent text-white shadow-[0_5px_18px_rgba(255,90,0,0.2)]'
                    : 'text-muted cursor-not-allowed',
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {uploadError && (
          <p className="text-destructive text-xs mt-1.5 px-1">{uploadError}</p>
        )}
      </div>
    </div>

      {/* Lista de membros (online/offline) — lado direito */}
      <MemberList serverId={serverId} />

      {/* Lightbox de imagem */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <motion.img
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              src={lightbox}
              alt="Imagem ampliada"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                         text-white grid place-items-center transition-colors"
              title="Fechar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Componente de mensagem ─────────────────────────────────────
function MessageRow({
  msg, isOwn, isConsecutive, onReply, onEdit, onDelete, onReaction, onPin, canPin, canManage, flash,
  editingId, editContent, setEditContent, onSaveEdit, onCancelEdit,
  groupedReactions, currentUserId, emojiMap, myNames, onImageClick,
}: any) {
  const isEditing = editingId === msg.id;
  const mentioned = !msg.deleted && !isOwn && mentionsMe(msg.content, myNames || []);
  // Celular (sem mouse): as ações aparecem ao TOCAR na mensagem, como no WhatsApp/Discord
  const [touchOpen, setTouchOpen] = useState(false);
  const onRowTap = (e: React.MouseEvent) => {
    if (typeof window === 'undefined' || !window.matchMedia('(hover: none)').matches) return;
    if ((e.target as HTMLElement).closest('button, a, img, video, textarea, input')) return;
    setTouchOpen(v => !v);
  };

  return (
    <div
      id={`msg-${msg.id}`}
      onClick={onRowTap}
      className={cn(
        'message-row group flex gap-3 px-2 py-0.5 rounded-lg hover:bg-surface/40 transition-colors duration-500',
        !isConsecutive && 'mt-4',
        mentioned && 'border-l-2',
        touchOpen && 'bg-surface/40',
        flash && '!bg-accent/15',
      )}
      style={mentioned ? { background: 'rgba(255,106,0,0.06)', borderLeftColor: '#ff6a00' } : undefined}
    >
      {/* Avatar */}
      <div className="w-10 shrink-0 mt-0.5">
        {!isConsecutive ? (
          <Avatar src={msg.author.profile.avatarUrl} name={msg.author.profile.displayName} size="md" />
        ) : (
          <span className="text-muted text-[10px] leading-none mt-1.5 block text-right opacity-0 group-hover:opacity-100">
            {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {/* Autor + data */}
        {!isConsecutive && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-medium text-white text-sm">{msg.author.profile.displayName}</span>
            <span className="text-muted text-xs">{formatMessageDate(msg.createdAt)}</span>
            {msg.pinned && !msg.deleted && <PinnedBadge />}
          </div>
        )}
        {isConsecutive && msg.pinned && !msg.deleted && <div className="mb-0.5"><PinnedBadge /></div>}

        {/* Reply preview */}
        {msg.replyTo && (
          <div className="flex items-center gap-1.5 mb-1 text-muted text-xs">
            <Reply className="w-3 h-3" />
            <span className="text-accent font-medium">{msg.replyTo.author.profile.displayName}</span>
            <span className="truncate">{msg.replyTo.content.slice(0, 60)}</span>
          </div>
        )}

        {/* Conteúdo da mensagem */}
        {isEditing ? (
          <div className="space-y-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSaveEdit(); }
                if (e.key === 'Escape') onCancelEdit();
              }}
              className="nexus-input text-sm resize-none w-full"
              rows={2}
              autoFocus
            />
            <div className="flex items-center gap-2 text-xs">
              <button onClick={onSaveEdit} className="text-accent hover:underline">salvar</button>
              <span className="text-muted">·</span>
              <button onClick={onCancelEdit} className="text-muted hover:text-white">cancelar</button>
            </div>
          </div>
        ) : !msg.deleted && isGifUrl(msg.content) && !msg.attachments?.length ? (
          <GifView url={msg.content.trim()} onClick={() => onImageClick?.(msg.content.trim())} />
        ) : !msg.deleted && !msg.content && msg.attachments?.length ? null : (
          <p className={cn(
            'text-sm leading-relaxed break-words',
            msg.deleted && 'text-muted italic',
            msg.pending && 'opacity-60',
          )}>
            {msg.deleted ? msg.content : renderRich(msg.content, emojiMap || {}, myNames || [])}
            {msg.edited && !msg.deleted && (
              <span className="text-muted text-[10px] ml-1">(editado)</span>
            )}
            {msg.pending && (
              <span className="text-muted text-[10px] ml-1">enviando…</span>
            )}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments?.length > 0 && !msg.deleted && (
          <div className={cn('flex flex-wrap gap-2', msg.content ? 'mt-2' : 'mt-1')}>
            {msg.attachments.map((att: any) => (
              <AttachmentView key={att.id} att={att} onImageClick={onImageClick} />
            ))}
          </div>
        )}

        {/* Reações */}
        {groupedReactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {groupedReactions.map(({ emoji, count, reacted }: any) => (
              <button
                key={emoji}
                onClick={() => onReaction(emoji)}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition-colors',
                  reacted
                    ? 'bg-accent/20 border-accent/40 text-accent'
                    : 'bg-surface border-border text-muted hover:bg-surface-raised hover:text-white',
                )}
              >
                <span>{emoji}</span>
                <span className="text-xs">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {!msg.deleted && (
        <div
          onClick={(e) => { e.stopPropagation(); setTouchOpen(false); }}
          className={cn('message-actions flex items-start gap-0.5 mt-0.5 shrink-0 transition-opacity', '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-within:opacity-100', !touchOpen && '[@media(hover:none)]:hidden')}
        >
          <ActionBtn onClick={onReply} title="Responder"><Reply className="w-3.5 h-3.5" /></ActionBtn>
          <ActionBtn onClick={() => onReaction('👍')} title="Reagir"><Smile className="w-3.5 h-3.5" /></ActionBtn>
          {canPin && !msg.pending && (
            <ActionBtn onClick={onPin} title={msg.pinned ? 'Desafixar' : 'Fixar'}>
              {msg.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </ActionBtn>
          )}
          {isOwn && (
            <ActionBtn onClick={onEdit} title="Editar"><Edit2 className="w-3.5 h-3.5" /></ActionBtn>
          )}
          {(isOwn || canManage) && !msg.pending && (
            <ActionBtn onClick={onDelete} title="Deletar" danger><Trash2 className="w-3.5 h-3.5" /></ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

function PinnedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium"
      style={{ background: 'rgba(176,92,255,0.16)', color: '#c9a8ff' }}
    >
      <Pin className="w-2.5 h-2.5" /> Fixada
    </span>
  );
}

function ActionBtn({ children, onClick, title, danger }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 [@media(hover:none)]:w-9 [@media(hover:none)]:h-9 rounded-md flex items-center justify-center transition-colors',
        danger
          ? 'text-muted hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted hover:bg-surface-raised hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
