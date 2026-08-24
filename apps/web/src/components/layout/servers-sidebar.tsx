'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Settings, X, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
}

export function ServersSidebar() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [servers, setServers] = useState<Server[]>([]);
  const params = useParams();
  const activeServerId = params?.serverId as string;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    api.get('/users/@me/servers').then(({ data }) => {
      setServers(data.map((m: any) => m.server));
    });
  }, []);

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await api.post('/servers', { name: newServerName.trim() });
      setServers(prev => [...prev, data]);
      setShowCreateModal(false);
      setNewServerName('');
      router.push(`/app/servers/${data.id}`);
    } catch (e: any) {
      setCreateError(e?.response?.data?.message || 'Erro ao criar servidor');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-[76px] h-full flex flex-col items-center py-4 gap-3 bg-[var(--th-rail)] border-r border-[var(--th-line-2)] overflow-y-auto shrink-0">
      {/* Marca Nexus */}
      <button
        onClick={() => router.push('/app/me')}
        title="Mensagens Diretas"
        className="w-12 h-12 rounded-2xl text-white text-xl font-black
                   bg-gradient-to-br from-orange to-accent shadow-[0_0_28px_rgba(122,44,255,0.35)]
                   transition-transform hover:scale-105 active:scale-95"
      >
        N
      </button>

      {/* Divisor */}
      <div className="w-8 h-px bg-[#30223d]" />

      {/* Servidores */}
      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          label={server.name}
          isActive={activeServerId === server.id}
          onClick={() => router.push(`/app/servers/${server.id}`)}
        >
          {server.iconUrl ? (
            <Image src={server.iconUrl} alt={server.name} width={48} height={48} className="object-cover" />
          ) : (
            <span className="text-sm font-bold">{getInitials(server.name)}</span>
          )}
        </ServerIcon>
      ))}

      {/* Criar servidor */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex items-center justify-center
                   text-success hover:border-success hover:-translate-y-0.5"
        title="Criar servidor"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Modal criar servidor */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">Criar servidor</h2>
              <button onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-muted text-sm mb-4">Dê um nome ao seu servidor. Você sempre pode mudá-lo depois.</p>
            <input
              autoFocus
              value={newServerName}
              onChange={e => setNewServerName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateServer(); if (e.key === 'Escape') setShowCreateModal(false); }}
              placeholder="Nome do servidor"
              className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2.5
                         text-white text-sm placeholder:text-muted focus:border-accent outline-none transition-colors mb-2"
            />
            {createError && <p className="text-destructive text-xs mb-2">{createError}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-surface-raised text-muted hover:text-white text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreateServer}
                disabled={!newServerName.trim() || creating}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                           transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar servidor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Config */}
      <button
        onClick={() => router.push('/app/me/settings')}
        className="w-[46px] h-[46px] rounded-2xl border border-transparent transition-all duration-200
                   flex items-center justify-center text-muted hover:text-white hover:bg-[#1c1227] hover:border-[#362146]"
        title="Configurações"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Eu */}
      <div
        title={user?.profile?.displayName || user?.username || ''}
        className="relative w-[43px] h-[43px] rounded-2xl grid place-items-center font-extrabold text-white text-xs
                   bg-gradient-to-br from-[#ff7d20] to-[#6424cc]"
      >
        {getInitials(user?.profile?.displayName || user?.username || '?')}
        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-success border-[3px] border-[#0c0911]" />
      </div>
    </div>
  );
}

function ServerIcon({
  children,
  label,
  isActive,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative group">
      {/* Indicador ativo */}
      <motion.div
        animate={{ scaleY: isActive ? 1 : 0 }}
        initial={false}
        className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-1 h-7 bg-orange rounded-r-md"
      />

      <button
        onClick={onClick}
        title={label}
        className={cn(
          'w-[46px] h-[46px] flex items-center justify-center overflow-hidden rounded-2xl border',
          'transition-all duration-200 cursor-pointer font-extrabold',
          isActive
            ? 'border-[#8b48ff] text-white bg-gradient-to-br from-[#26143c] to-[#1b1028] -translate-y-0.5'
            : 'border-[var(--th-line-2)] bg-[#171121] text-[#cfc6dd] hover:border-[#8b48ff] hover:text-white hover:-translate-y-0.5',
        )}
      >
        {children}
      </button>

      {/* Tooltip */}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none
                      opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="bg-surface-overlay border border-border rounded-md px-3 py-1.5 shadow-xl whitespace-nowrap">
          <p className="text-white text-sm font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}
