'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Send, Paperclip, Smile, AtSign, X, Reply, Edit2, Trash2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { formatMessageDate, cn, isImageMime, formatFileSize } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import Image from 'next/image';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  edited: boolean;
  deleted: boolean;
  authorId: string;
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
  const [content, setContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<NodeJS.Timeout>();
  const socket = getSocket();

  // ── Carrega mensagens ─────────────────────────────────────────
  useEffect(() => {
    if (!channelId) return;
    setIsLoading(true);
    api.get(`/channels/${channelId}/messages`)
      .then(({ data }) => {
        setMessages(data.messages);
        setIsLoading(false);
        scrollToBottom();
      });
  }, [channelId]);

  // ── Eventos Socket.IO ─────────────────────────────────────────
  useEffect(() => {
    if (!channelId || !socket) return;

    socket.emit('channel:join', { channelId });

    socket.on('message:new', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
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
    if (!content.trim()) return;

    socket.emit('message:send', {
      channelId,
      content: content.trim(),
      replyToId: replyTo?.id,
    });

    setContent('');
    setReplyTo(null);
    textareaRef.current?.focus();
  }, [content, channelId, replyTo, socket]);

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
    if (!confirm('Deletar esta mensagem?')) return;
    socket.emit('message:delete', { messageId: msg.id, channelId });
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
    <div className="flex flex-col h-full bg-background">
      {/* Header do canal */}
      <div className="h-12 flex items-center gap-2 px-4 border-b border-border bg-background-secondary shrink-0">
        <Hash className="w-5 h-5 text-muted" />
        <h2 className="font-semibold text-white text-sm">
          {/* O nome vem do servidor já carregado */}
          canal
        </h2>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
              <Hash className="w-8 h-8 text-muted" />
            </div>
            <h3 className="text-white font-semibold text-xl mb-1">Seja o primeiro a escrever!</h3>
            <p className="text-muted text-sm">Este é o início deste canal.</p>
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
          'flex items-end gap-2 bg-surface-raised rounded-xl px-3 py-2 border border-border',
          replyTo && 'rounded-t-none border-t-0',
        )}>
          <button className="text-muted hover:text-white p-1 rounded transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>

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
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                content.trim()
                  ? 'bg-accent text-white hover:bg-accent-hover'
                  : 'text-muted cursor-not-allowed',
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Componente de mensagem ─────────────────────────────────────
function MessageRow({
  msg, isOwn, isConsecutive, onReply, onEdit, onDelete, onReaction,
  editingId, editContent, setEditContent, onSaveEdit, onCancelEdit,
  groupedReactions, currentUserId,
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
          <p className={cn('text-sm leading-relaxed break-words', msg.deleted && 'text-muted italic')}>
            {msg.content}
            {msg.edited && !msg.deleted && (
              <span className="text-muted text-[10px] ml-1">(editado)</span>
            )}
          </p>
        )}

        {/* Attachments */}
        {msg.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {msg.attachments.map((att: any) => (
              isImageMime(att.mimeType) ? (
                <div key={att.id} className="rounded-lg overflow-hidden max-w-xs">
                  <Image src={att.url} alt={att.fileName} width={300} height={200} className="object-cover" />
                </div>
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
