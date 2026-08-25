'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Send, Paperclip, Smile, AtSign, X, Reply, Edit2, Trash2, Loader2, Menu } from 'lucide-react';
import api from '@/lib/api';
import { getSocket, trackChannel, untrackChannel, trackServer } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { formatMessageDate, cn, isImageMime, formatFileSize } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { MemberList } from '@/components/servers/member-list';

/** Gera um ID único de cliente para deduplicação de mensagens */
function genClientMsgId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Substitui :nome: pelos emojis customizados do servidor */
function renderWithEmojis(text: string, map: Record<string, string>): React.ReactNode {
  if (!text || !text.includes(':')) return text;
  const parts = text.split(/(:[a-z0-9_]+:)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const m = part.match(/^:([a-z0-9_]+):$/);
    if (m && map[m[1]]) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img key={i} src={map[m[1]]} alt={part} title={part}
        className="inline-block w-6 h-6 object-contain align-text-bottom mx-0.5" />;
    }
    return part;
  });
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
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
      <div className="h-[70px] flex items-center gap-3 px-5 border-b border-[var(--th-line)] bg-[var(--th-side)] backdrop-blur shrink-0">
        <span className="text-[#b05cff] text-2xl font-bold leading-none">#</span>
        <div className="min-w-0">
          <h2 className="font-semibold text-white text-[15px] truncate">
            {channelName || 'canal'}
          </h2>
          <p className="text-[#9188a2] text-[11px]">Canal de texto da comunidade</p>
        </div>
      </div>

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
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div
              className="w-full max-w-2xl border border-[#392454] rounded-[18px] p-6 flex items-center gap-5"
              style={{ background: 'radial-gradient(circle at 82% 20%, rgba(122,44,255,0.24), transparent 26%), linear-gradient(135deg, #1c1128, #120d1c)' }}
            >
              <div className="w-[55px] h-[55px] rounded-[18px] grid place-items-center text-2xl font-black text-white shrink-0
                              bg-gradient-to-br from-orange to-accent">
                #
              </div>
              <div>
                <h3 className="text-white font-bold text-xl mb-1">Bem-vindo a #{channelName || 'este canal'}</h3>
                <p className="text-[#afa4bb] text-sm">
                  Este é o começo da conversa. Diga um oi e chame seus amigos! 🟠🟣
                </p>
              </div>
            </div>
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
                onReaction={(emoji) => handleReaction(msg.id, emoji)}
                editingId={editingId}
                editContent={editContent}
                setEditContent={setEditContent}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                groupedReactions={groupReactions(msg.reactions)}
                currentUserId={user?.id || ''}
                emojiMap={emojiMap}
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
              {typingUsers.length === 1 ? 'alguém está digitando...' : 'várias pessoas estão digitando...'}
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
            className="text-muted hover:text-white p-1 rounded transition-colors disabled:opacity-50"
          >
            {uploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-accent" /> : <Paperclip className="w-5 h-5" />}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx"
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

          <div className="flex items-center gap-1">
            <button className="text-muted hover:text-warning p-1 rounded transition-colors">
              <Smile className="w-5 h-5" />
            </button>
            <button
              onClick={handleSend}
              disabled={!content.trim()}
              className={cn(
                'w-9 h-9 rounded-[11px] flex items-center justify-center transition-all active:scale-95',
                content.trim()
                  ? 'bg-gradient-to-br from-orange to-accent text-white shadow-[0_5px_18px_rgba(255,90,0,0.2)]'
                  : 'text-muted cursor-not-allowed',
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        {uploadError && (
          <p className="text-destructive text-xs mt-1.5 px-1">{uploadError}</p>
        )}
      </div>
    </div>

      {/* Lista de membros (online/offline) — lado direito */}
      <MemberList serverId={serverId} />
    </div>
  );
}

// ── Componente de mensagem ─────────────────────────────────────
function MessageRow({
  msg, isOwn, isConsecutive, onReply, onEdit, onDelete, onReaction,
  editingId, editContent, setEditContent, onSaveEdit, onCancelEdit,
  groupedReactions, currentUserId, emojiMap,
}: any) {
  const isEditing = editingId === msg.id;

  return (
    <div className={cn('message-row group flex gap-3 px-2 py-0.5 rounded-lg hover:bg-surface/40', !isConsecutive && 'mt-4')}>
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
          </div>
        )}

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
        ) : (
          <p className={cn(
            'text-sm leading-relaxed break-words',
            msg.deleted && 'text-muted italic',
            msg.pending && 'opacity-60',
          )}>
            {msg.deleted ? msg.content : renderWithEmojis(msg.content, emojiMap || {})}
            {msg.edited && !msg.deleted && (
              <span className="text-muted text-[10px] ml-1">(editado)</span>
            )}
            {msg.pending && (
              <span className="text-muted text-[10px] ml-1">enviando…</span>
            )}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.attachments.map((att: any) => (
              isImageMime(att.mimeType) ? (
                <a key={att.id} href={att.url} target="_blank" rel="noreferrer"
                  className="rounded-lg overflow-hidden max-w-xs border border-[var(--th-line)]">
                  {/* img simples: next/image não aceita data URLs (fallback de storage) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.url} alt={att.fileName} className="max-w-full max-h-80 object-contain" />
                </a>
              ) : (
                <a key={att.id} href={att.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 p-2 bg-surface rounded-lg text-sm text-muted-foreground hover:text-white border border-border">
                  <Paperclip className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{att.fileName}</span>
                  <span className="text-muted text-xs shrink-0">{formatFileSize(att.fileSize)}</span>
                </a>
              )
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
        <div className="message-actions flex items-start gap-0.5 mt-0.5 shrink-0">
          <ActionBtn onClick={onReply} title="Responder"><Reply className="w-3.5 h-3.5" /></ActionBtn>
          <ActionBtn onClick={() => onReaction('👍')} title="Reagir"><Smile className="w-3.5 h-3.5" /></ActionBtn>
          {isOwn && (
            <>
              <ActionBtn onClick={onEdit} title="Editar"><Edit2 className="w-3.5 h-3.5" /></ActionBtn>
              <ActionBtn onClick={onDelete} title="Deletar" danger><Trash2 className="w-3.5 h-3.5" /></ActionBtn>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, title, danger }: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
        danger
          ? 'text-muted hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted hover:bg-surface-raised hover:text-white',
      )}
    >
      {children}
    </button>
  );
}
