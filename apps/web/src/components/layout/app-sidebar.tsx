'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Hash, Volume2, ChevronDown, Plus, Settings, Mic, MicOff, Headphones, PhoneOff, X, Loader2,
  UserPlus, Bell, ShieldCheck, Pencil, LogOut, Copy, Check, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import api from '@/lib/api';
import { getSocket, joinServer } from '@/lib/socket';
import { Avatar } from '@/components/ui/avatar';

interface Channel { id: string; name: string; type: string; }
interface VoiceRoom { id: string; name: string; }
interface PresenceUser { id: string; username: string; displayName: string; avatarUrl: string | null; live?: boolean; }
interface Server { id: string; name: string; iconUrl: string | null; channels: Channel[]; voiceRooms: VoiceRoom[]; }

export function AppSidebar() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isConnected, roomName, localMicEnabled, toggleMic, disconnect, voiceRoomId } = useVoiceStore();
  const serverId = params?.serverId as string;
  const activeChannelId = params?.channelId as string;
  const activeRoomId = params?.roomId as string;
  const [server, setServer] = useState<Server | null>(null);
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [voicePresence, setVoicePresence] = useState<Record<string, PresenceUser[]>>({});
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [menuToast, setMenuToast] = useState<string | null>(null);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  // Atalho "Membros" na lista de canais (toggle em Config. → Membros)
  const [showMembersShortcut, setShowMembersShortcut] = useState(false);
  useEffect(() => {
    const read = () => setShowMembersShortcut(
      typeof window !== 'undefined' &&
      localStorage.getItem(`nexus_members_in_channels:${serverId}`) === '1',
    );
    read();
    window.addEventListener('nexus:members-page-toggle', read);
    return () => window.removeEventListener('nexus:members-page-toggle', read);
  }, [serverId]);

  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}`).then(({ data }) => setServer(data));
  }, [serverId]);

  // Presença nas salas de voz: snapshot inicial + atualizações via socket
  useEffect(() => {
    if (!serverId) return;

    let cancelled = false;
    const fetchPresence = () => {
      api.get(`/voice/servers/${serverId}/presence`)
        .then(({ data }) => { if (!cancelled) setVoicePresence(data); })
        .catch(() => {});
    };

    joinServer(serverId);
    fetchPresence();

    const socket = getSocket();
    const onPresence = (evt: { serverId: string }) => {
      // LiveKit é a fonte da verdade — o evento só sinaliza que mudou
      if (evt.serverId === serverId) fetchPresence();
    };
    socket.on('voice:presence', onPresence);
    // O socket pode conectar depois deste mount — refaz o join/snapshot
    const onConnect = () => { socket.emit('server:join', { serverId }); fetchPresence(); };
    socket.on('connect', onConnect);

    // Fallback: mantém a lista correta mesmo se algum evento se perder
    const interval = setInterval(fetchPresence, 20_000);

    return () => {
      cancelled = true;
      socket.off('voice:presence', onPresence);
      socket.off('connect', onConnect);
      clearInterval(interval);
    };
  }, [serverId]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !serverId) return;
    setCreatingChannel(true);
    try {
      const { data } = await api.post(`/servers/${serverId}/channels`, {
        name: newChannelName.trim(),
        type: 'TEXT',
      });
      setServer(prev => prev ? { ...prev, channels: [...prev.channels, data] } : prev);
      setNewChannelName('');
      setShowCreateChannel(false);
      router.push(`/app/servers/${serverId}/channels/${data.id}`);
    } catch {
      // silently fail
    } finally {
      setCreatingChannel(false);
    }
  };

  if (!serverId || !server) {
    // Sidebar de DMs (simplificado)
    return <DMSidebar />;
  }

  return (
    <div className="w-60 flex flex-col bg-[var(--th-side)] border-r border-[var(--th-line)] h-full shrink-0 relative">
      {/* Header do servidor (abre o menu) */}
      <button
        onClick={() => setServerMenuOpen(v => !v)}
        title="Opções do servidor"
        className="flex flex-col items-start gap-0.5 px-4 py-4 border-b border-[var(--th-line)]
                         hover:bg-surface-raised transition-colors text-left">
        <span className="text-orange text-[10px] font-extrabold uppercase tracking-[1.5px]">Espaço conectado</span>
        <span className="flex items-center gap-1 w-full text-white font-bold text-base">
          <span className="truncate">{server.name}</span>
          <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted transition-transform', serverMenuOpen && 'rotate-180')} />
        </span>
      </button>

      {/* Menu do servidor */}
      <AnimatePresence>
        {serverMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setServerMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="absolute left-2 right-2 top-[68px] z-50 rounded-xl border border-[var(--th-line-2)]
                         bg-[var(--th-panel)] shadow-2xl p-1.5 space-y-0.5"
            >
              <ServerMenuItem
                icon={<UserPlus className="w-4 h-4" />}
                label="Convidar para o servidor"
                onClick={async () => {
                  setServerMenuOpen(false);
                  try {
                    const { data } = await api.post(`/invites/servers/${serverId}`, { expiresInHours: 168 });
                    await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.code}`);
                    setMenuToast('Link de convite copiado!');
                  } catch {
                    setMenuToast('Sem permissão para criar convites');
                  }
                  setTimeout(() => setMenuToast(null), 2500);
                }}
              />
              <ServerMenuItem
                icon={<Settings className="w-4 h-4" />}
                label="Config. do servidor"
                onClick={() => { setServerMenuOpen(false); router.push(`/app/servers/${serverId}/settings`); }}
              />
              <div className="h-px bg-[var(--th-line)] mx-2 my-1" />
              <ServerMenuItem
                icon={<Bell className="w-4 h-4" />}
                label="Config. de notificação"
                onClick={() => { setServerMenuOpen(false); router.push('/app/me/settings?tab=notifications'); }}
              />
              <ServerMenuItem
                icon={<ShieldCheck className="w-4 h-4" />}
                label="Config. de privacidade"
                onClick={() => { setServerMenuOpen(false); router.push('/app/me/settings?tab=privacy'); }}
              />
              <div className="h-px bg-[var(--th-line)] mx-2 my-1" />
              <ServerMenuItem
                icon={<Pencil className="w-4 h-4" />}
                label="Editar perfil por servidor"
                onClick={() => { setServerMenuOpen(false); setNicknameOpen(true); }}
              />
              <div className="h-px bg-[var(--th-line)] mx-2 my-1" />
              <ServerMenuItem
                icon={<LogOut className="w-4 h-4" />}
                label="Sair do servidor"
                danger
                onClick={async () => {
                  setServerMenuOpen(false);
                  if (!window.confirm(`Sair do servidor "${server.name}"?`)) return;
                  try {
                    await api.delete(`/servers/${serverId}/leave`);
                    router.push('/app');
                  } catch (e: any) {
                    setMenuToast(e?.response?.data?.message || 'Não foi possível sair');
                    setTimeout(() => setMenuToast(null), 3000);
                  }
                }}
              />
              <ServerMenuItem
                icon={<Copy className="w-4 h-4" />}
                label="Copiar ID do servidor"
                onClick={async () => {
                  setServerMenuOpen(false);
                  await navigator.clipboard.writeText(serverId).catch(() => {});
                  setMenuToast('ID copiado!');
                  setTimeout(() => setMenuToast(null), 2000);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast do menu */}
      {menuToast && (
        <div className="absolute top-[74px] left-2 right-2 z-50 rounded-lg bg-[var(--th-panel-2)] border border-[var(--th-line-2)]
                        text-white text-xs px-3 py-2 text-center shadow-xl">
          {menuToast}
        </div>
      )}

      {/* Modal: apelido neste servidor */}
      {nicknameOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center" onClick={() => setNicknameOpen(false)}>
          <div className="bg-surface border border-border rounded-xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-sm mb-1">Perfil neste servidor</h3>
            <p className="text-muted text-xs mb-3">Como você aparece em "{server.name}".</p>
            <input
              value={nicknameDraft}
              onChange={e => setNicknameDraft(e.target.value)}
              maxLength={64}
              placeholder={user?.profile?.displayName || user?.username || 'Apelido'}
              className="nexus-input w-full mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNicknameOpen(false)} className="px-3 py-1.5 rounded-lg text-muted hover:text-white text-xs">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await api.patch(`/servers/${serverId}/members/me`, { nickname: nicknameDraft.trim() || null });
                    setMenuToast('Apelido atualizado!');
                  } catch {
                    setMenuToast('Erro ao salvar apelido');
                  }
                  setNicknameOpen(false);
                  setTimeout(() => setMenuToast(null), 2500);
                }}
                className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Canais */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* Atalho: página de membros (toggle em Config. → Membros) */}
        {showMembersShortcut && (
          <button
            onClick={() => router.push(`/app/servers/${serverId}/settings`)}
            className="sidebar-item w-full mb-1"
          >
            <Users className="w-4 h-4 shrink-0 text-[#8c5dcc]" />
            <span className="truncate">Membros</span>
          </button>
        )}

        {/* Canais de texto */}
        <SectionHeader label="CANAIS DE TEXTO" open={textOpen} onToggle={() => setTextOpen(!textOpen)}>
          <Plus className="w-3.5 h-3.5" onClick={(e) => { e.stopPropagation(); setShowCreateChannel(true); }} />
        </SectionHeader>

        <AnimatePresence>
          {textOpen && server.channels.filter(c => c.type === 'TEXT' || c.type === 'ANNOUNCEMENT').map((ch) => (
            <motion.button
              key={ch.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => router.push(`/app/servers/${serverId}/channels/${ch.id}`)}
              className={cn(
                'sidebar-item w-full',
                activeChannelId === ch.id && 'active',
              )}
            >
              <Hash className="w-4 h-4 shrink-0 text-[#8c5dcc]" />
              <span className="truncate">{ch.name}</span>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Salas de voz */}
        <div className="mt-4">
          <SectionHeader label="SALAS DE VOZ" open={voiceOpen} onToggle={() => setVoiceOpen(!voiceOpen)}>
            <Plus className="w-3.5 h-3.5" onClick={(e) => { e.stopPropagation(); }} />
          </SectionHeader>

          <AnimatePresence>
            {voiceOpen && server.voiceRooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => router.push(`/app/servers/${serverId}/voice/${room.id}`)}
                  className={cn(
                    'sidebar-item w-full',
                    (activeRoomId === room.id || voiceRoomId === room.id) && 'active',
                  )}
                >
                  <Volume2 className="w-4 h-4 shrink-0 text-[#8c5dcc]" />
                  <span className="truncate">{room.name}</span>
                  {(voicePresence[room.id]?.length ?? 0) > 0 && (
                    <span className="ml-auto text-[10px] font-extrabold text-white bg-orange rounded-full px-1.5 py-0.5 shrink-0">
                      {voicePresence[room.id].length}
                    </span>
                  )}
                  {voiceRoomId === room.id && (
                    <span className={cn('w-2 h-2 rounded-full bg-success shrink-0 animate-pulse shadow-[0_0_8px_#42e6a4]',
                      (voicePresence[room.id]?.length ?? 0) === 0 && 'ml-auto')} />
                  )}
                </button>

                {/* Quem está na sala */}
                {(voicePresence[room.id]?.length ?? 0) > 0 && (
                  <div className="pl-9 pr-2 pb-1.5 space-y-0.5">
                    {voicePresence[room.id].map((u) => (
                      <div key={u.id} className="flex items-center gap-2 py-1">
                        <span className="w-[7px] h-[7px] rounded-full bg-success shadow-[0_0_8px_#42e6a4] shrink-0" />
                        <span className={cn(
                          'text-xs truncate',
                          u.id === user?.id ? 'text-white font-medium' : 'text-[#8f859d]',
                        )}>
                          {u.displayName}
                        </span>
                        {u.live && (
                          <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-wide
                                           text-white bg-[#ed4245] rounded px-1 py-[1px] shadow-[0_0_8px_#ed424566]">
                            Live
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Modal criar canal */}
      {showCreateChannel && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-r-none"
          onClick={() => setShowCreateChannel(false)}>
          <div className="bg-surface border border-border rounded-xl p-5 w-52 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-sm">Criar canal</h3>
              <button onClick={() => setShowCreateChannel(false)} className="text-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              autoFocus
              value={newChannelName}
              onChange={e => setNewChannelName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateChannel(); if (e.key === 'Escape') setShowCreateChannel(false); }}
              placeholder="nome-do-canal"
              className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2
                         text-white text-sm placeholder:text-muted focus:border-accent outline-none mb-3"
            />
            <button
              onClick={handleCreateChannel}
              disabled={!newChannelName.trim() || creatingChannel}
              className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                         transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creatingChannel && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Painel do usuário + voz */}
      <div className="border-t border-border">
        {/* Barra de chamada ativa */}
        {isConnected && (
          <div className="px-2 pt-2">
            <div className="bg-surface-raised rounded-lg p-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-success text-xs font-medium">Em chamada</p>
                <p className="text-muted text-xs truncate">{roomName}</p>
              </div>
              <button
                onClick={async () => { await disconnect(); router.push(`/app/servers/${serverId}`); }}
                className="w-7 h-7 rounded-md bg-destructive/10 hover:bg-destructive text-destructive
                           hover:text-white flex items-center justify-center transition-colors"
                title="Sair da chamada"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Info do usuário */}
        <div className="p-2 flex items-center gap-2">
          <div className="relative">
            <Avatar
              src={user?.profile?.avatarUrl}
              name={user?.profile?.displayName || user?.username || '?'}
              size="sm"
            />
            <span className={cn('status-dot absolute -bottom-0.5 -right-0.5', STATUS_COLORS[user?.profile?.status || 'OFFLINE'])} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-tight">
              {user?.profile?.displayName}
            </p>
            <p className="text-success text-xs truncate">● Conectado</p>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={toggleMic}
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center transition-colors',
                localMicEnabled
                  ? 'text-muted hover:text-white hover:bg-surface-raised'
                  : 'text-destructive bg-destructive/10 hover:bg-destructive hover:text-white',
              )}
              title={localMicEnabled ? 'Silenciar' : 'Ativar microfone'}
            >
              {localMicEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => router.push('/app/me/settings')}
              className="w-7 h-7 rounded-md text-muted hover:text-white hover:bg-surface-raised
                         flex items-center justify-center transition-colors"
              title="Configurações"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerMenuItem({ icon, label, onClick, danger }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-left',
        danger
          ? 'text-[#ff5872] hover:bg-[#ff587218]'
          : 'text-[#cfc5d8] hover:bg-white/5 hover:text-white',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionHeader({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1 w-full px-1 py-1 group"
    >
      <ChevronDown className={cn('w-3 h-3 text-muted transition-transform', !open && '-rotate-90')} />
      <span className="text-xs font-semibold text-muted group-hover:text-muted-foreground flex-1 text-left">
        {label}
      </span>
      {children && <span className="text-muted hover:text-white ml-auto">{children}</span>}
    </button>
  );
}

function DMSidebar() {
  const { user } = useAuthStore();
  return (
    <div className="w-60 flex flex-col bg-background-secondary h-full shrink-0">
      <div className="h-12 flex items-center px-4 border-b border-border">
        <p className="text-white font-semibold text-sm">Mensagens Diretas</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2">
        <p className="text-muted text-xs px-2 py-1">Nenhuma conversa ainda</p>
      </div>
      <div className="border-t border-border p-2 flex items-center gap-2">
        <Avatar src={user?.profile?.avatarUrl} name={user?.profile?.displayName || '?'} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{user?.profile?.displayName}</p>
          <p className="text-muted text-xs truncate">@{user?.username}</p>
        </div>
      </div>
    </div>
  );
}
