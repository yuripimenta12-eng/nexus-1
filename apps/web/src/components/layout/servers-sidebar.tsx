'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Settings, Hash, Compass } from 'lucide-react';
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

  useEffect(() => {
    api.get('/users/@me/servers').then(({ data }) => {
      setServers(data.map((m: any) => m.server));
    });
  }, []);

  return (
    <div className="w-[72px] h-full flex flex-col items-center py-3 gap-2 bg-background overflow-y-auto shrink-0">
      {/* Home / DMs */}
      <ServerIcon
        label="Mensagens Diretas"
        isActive={!activeServerId}
        onClick={() => router.push('/app/me')}
      >
        <Hash className="w-5 h-5" />
      </ServerIcon>

      {/* Divisor */}
      <div className="w-8 h-px bg-border my-1" />

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
        onClick={() => {/* TODO: modal criar servidor */}}
        className="w-12 h-12 rounded-full bg-surface hover:bg-success hover:rounded-xl
                   transition-all duration-200 flex items-center justify-center
                   text-success hover:text-white group"
        title="Criar servidor"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Config */}
      <button
        onClick={() => router.push('/app/me/settings')}
        className="w-12 h-12 rounded-full bg-surface hover:bg-surface-raised transition-all duration-200
                   flex items-center justify-center text-muted hover:text-white"
        title="Configurações"
      >
        <Settings className="w-5 h-5" />
      </button>
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
        className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full"
      />

      <button
        onClick={onClick}
        title={label}
        className={cn(
          'w-12 h-12 flex items-center justify-center overflow-hidden',
          'transition-all duration-200 cursor-pointer',
          isActive
            ? 'rounded-xl bg-accent text-white'
            : 'rounded-full bg-surface-raised text-muted hover:rounded-xl hover:bg-accent hover:text-white',
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
