'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Hash, Volume2, ChevronDown, Plus, Settings, Mic, MicOff, Headphones, PhoneOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, STATUS_COLORS } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import api from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';

interface Channel { id: string; name: string; type: string; }
interface VoiceRoom { id: string; name: string; }
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

  useEffect(() => {
    if (!serverId) return;
    api.get(`/servers/${serverId}`).then(({ data }) => setServer(data));
  }, [serverId]);

  if (!serverId || !server) {
    // Sidebar de DMs (simplificado)
    return <DMSidebar />;
  }

  return (
    <div className="w-60 flex flex-col bg-background-secondary h-full shrink-0">
      {/* Header do servidor */}
      <button className="h-12 flex items-center justify-between px-4 border-b border-border
                         hover:bg-surface-raised transition-colors text-white font-semibold text-sm">
        <span className="truncate">{server.name}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted" />
      </button>

      {/* Canais */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {/* Canais de texto */}
        <SectionHeader label="CANAIS DE TEXTO" open={textOpen} onToggle={() => setTextOpen(!textOpen)}>
          <Plus className="w-3.5 h-3.5" onClick={(e) => { e.stopPropagation(); /* TODO */ }} />
        </SectionHeader>

        <AnimatePresence>
          {textOpen && server.channels.filter(c => c.type === 'TEXT' || c.type === 'ANNOUNCEMENT').map((ch) => (
            <motion.button
              key={ch.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => router.push(`/app/servers/${serverId}/channels/${ch.id}`)}
              className={cn(
                'sidebar-item w-full',
                activeChannelId === ch.id && 'active',
              )}
            >
              <Hash className="w-4 h-4 shrink-0 text-muted" />
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
              <motion.button
                key={room.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => router.push(`/app/servers/${serverId}/voice/${room.id}`)}
                className={cn(
                  'sidebar-item w-full',
                  (activeRoomId === room.id || voiceRoomId === room.id) && 'active',
                )}
              >
                <Volume2 className="w-4 h-4 shrink-0 text-muted" />
                <span className="truncate">{room.name}</span>
                {voiceRoomId === room.id && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-success shrink-0 animate-pulse" />
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>

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
            <p className="text-muted text-xs truncate">@{user?.username}</p>
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
