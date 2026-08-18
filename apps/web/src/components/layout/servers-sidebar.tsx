'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import Image from 'next/image';
import { getInitials } from '@/lib/utils';
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
    <div
      style={{
        width: 82,
        minHeight: '100vh',
        background: '#0c0911',
        borderRight: '1px solid #1e1828',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 14,
        gap: 10,
        flexShrink: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo oficial Nexus Link */}
      <button
        onClick={() => router.push('/app/me')}
        title="Nexus Link - Início"
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'transform 0.2s',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px) scale(1.06)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
      >
        <img
          src="/nexus-logo.png"
          alt="Nexus Link"
          style={{
            width: 52,
            height: 52,
            objectFit: 'cover',
            objectPosition: '50% 18%',
          }}
        />
      </button>

      {/* Divisor */}
      <div style={{ width: 36, height: 1, background: 'linear-gradient(90deg, transparent, #3a2650, transparent)', flexShrink: 0 }} />

      {/* Servidores */}
      {servers.map((server) => (
        <OrbButton
          key={server.id}
          label={server.name}
          isActive={activeServerId === server.id}
          onClick={() => router.push(`/app/servers/${server.id}`)}
        >
          {server.iconUrl ? (
            <Image
              src={server.iconUrl}
              alt={server.name}
              width={43}
              height={43}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700 }}>{getInitials(server.name)}</span>
          )}
        </OrbButton>
      ))}

      {/* Criar servidor */}
      <OrbButton
        label="Criar servidor"
        isActive={false}
        onClick={() => {}}
        variant="add"
      >
        <Plus style={{ width: 18, height: 18 }} />
      </OrbButton>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Avatar do usuário */}
      {user && (
        <button
          onClick={() => router.push('/app/me/settings')}
          title={user.profile?.displayName || user.username}
          style={{
            width: 43,
            height: 43,
            borderRadius: 14,
            border: '1px solid #2e2040',
            background: 'linear-gradient(145deg,#26143c,#1b1028)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 700,
            color: '#cfc6dd',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = '#7a2cff';
            b.style.color = '#fff';
            b.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement;
            b.style.borderColor = '#2e2040';
            b.style.color = '#cfc6dd';
            b.style.transform = '';
          }}
        >
          {getInitials(user.profile?.displayName || user.username || '?')}
        </button>
      )}
    </div>
  );
}

function OrbButton({
  children, label, isActive, onClick, variant = 'server',
}: {
  children: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: 'server' | 'add';
}) {
  const isAdd = variant === 'add';
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {/* Indicador ativo */}
      {isActive && (
        <span style={{
          position: 'absolute',
          left: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 4,
          height: 26,
          borderRadius: '0 5px 5px 0',
          background: '#ff6a00',
        }} />
      )}

      <button
        onClick={onClick}
        title={label}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: 43,
          height: 43,
          borderRadius: hovered || isActive ? 13 : 14,
          border: `1px solid ${isActive || hovered ? (isAdd ? '#42e6a4' : '#8b48ff') : isAdd ? '#2e3d1f' : '#2e2040'}`,
          background: isActive || hovered
            ? isAdd ? '#1a2e12' : 'linear-gradient(145deg,#26143c,#1b1028)'
            : isAdd ? '#141f0e' : '#17112a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: 'pointer',
          color: isActive || hovered ? '#fff' : isAdd ? '#42e6a4' : '#9a90a8',
          fontSize: 13,
          fontWeight: 700,
          transition: 'all 0.2s',
          transform: hovered ? 'translateY(-2px)' : '',
        }}
      >
        {children}
      </button>

      {/* Tooltip animado */}
      {hovered && (
        <div className="nexus-tooltip" style={{
          position: 'absolute',
          left: '100%',
          marginLeft: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {/* Seta */}
          <div style={{
            position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: '5px solid #332441',
          }} />
          <div style={{
            background: 'linear-gradient(135deg,#231a30,#1c1428)',
            border: '1px solid #332441',
            borderRadius: 9,
            padding: '7px 13px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            <p style={{ color: '#f0eaf7', fontSize: 13, fontWeight: 600, margin: 0 }}>{label}</p>
          </div>
        </div>
      )}
    </div>
  );
}
