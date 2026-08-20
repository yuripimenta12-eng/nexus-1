'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { InviteModal } from '@/components/modals/invite-modal';
import { ServerContextMenu } from '@/components/menus/server-context-menu';
import { CreateServerModal } from '@/components/modals/create-server-modal';

interface Server { id: string; name: string; iconUrl: string | null; }

/* ── Pill indicator (left side of active server) ─── */
function ActivePill({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          exit={{ scaleY: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 28,
            borderRadius: '0 3px 3px 0',
            background: 'linear-gradient(180deg,#ff6a00,#7c5af0)',
            boxShadow: '0 0 8px rgba(124,90,240,0.6)',
          }}
        />
      )}
    </AnimatePresence>
  );
}

/* ── Server orb ─────────────────────────────────── */
function ServerOrb({
  server, active, onClick,
}: { server: Server; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const show = hovered || active;

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ActivePill visible={active} />

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: 72,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#0d0a16',
              border: '1px solid #2a1f40',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              color: '#ede8f8',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            {server.name}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onClick}
        animate={{
          borderRadius: active ? '14px' : '22px',
          scale: active ? 1.05 : 1,
        }}
        whileHover={{ borderRadius: '14px', scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        style={{
          width: 44,
          height: 44,
          marginLeft: 18,
          overflow: 'hidden',
          cursor: 'pointer',
          border: 'none',
          flexShrink: 0,
          position: 'relative',
          background: server.iconUrl
            ? 'transparent'
            : active
              ? 'linear-gradient(135deg,#7c5af0,#b142f5)'
              : '#1a1629',
          boxShadow: active
            ? '0 0 0 2px #7c5af0, 0 0 16px rgba(124,90,240,0.4)'
            : show
              ? '0 0 0 2px rgba(124,90,240,0.4)'
              : '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.2s',
        }}
        title={server.name}
      >
        {server.iconUrl ? (
          <img
            src={server.iconUrl}
            alt={server.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: -0.5 }}>
            {getInitials(server.name)}
          </span>
        )}
      </motion.button>
    </div>
  );
}

/* ── Icon-only button (DM, Add server) ─────────── */
function IconOrb({
  icon, onClick, active, tooltip, gradient,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  tooltip: string;
  gradient?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ActivePill visible={!!active} />

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: 72,
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#0d0a16',
              border: '1px solid #2a1f40',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              color: '#ede8f8',
              whiteSpace: 'nowrap',
              zIndex: 100,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          >
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onClick}
        animate={{ borderRadius: active ? '14px' : '22px' }}
        whileHover={{ borderRadius: '14px', scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        style={{
          width: 44,
          height: 44,
          marginLeft: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          flexShrink: 0,
          background: gradient
            ? 'linear-gradient(135deg,#ff6a00,#7c5af0)'
            : active
              ? 'linear-gradient(135deg,#7c5af0,#b142f5)'
              : '#1a1629',
          color: gradient || active ? '#fff' : '#7c5af0',
          boxShadow: active
            ? '0 0 0 2px #7c5af0, 0 0 16px rgba(124,90,240,0.4)'
            : hovered
              ? '0 0 0 2px rgba(124,90,240,0.4)'
              : '0 2px 8px rgba(0,0,0,0.4)',
          transition: 'box-shadow 0.2s, color 0.2s, background 0.2s',
        }}
      >
        {icon}
      </motion.button>
    </div>
  );
}

export function ServersSidebar() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const activeServerId = params?.serverId as string | undefined;
  const [servers, setServers] = useState<Server[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; server: Server } | null>(null);
  const [inviteServer, setInviteServer] = useState<Server | null>(null);
  const [showCreateServer, setShowCreateServer] = useState(false);

  useEffect(() => {
    api.get('/users/@me/servers').then(({ data }) => {
      const items: any[] = Array.isArray(data) ? data : data.servers ?? [];
      // API returns ServerMember[] — each item has a nested `server` object
      setServers(items.map(item => item.server ?? item));
    });
  }, []);

  const handleContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  return (
    <div
      style={{
        width: 72,
        minWidth: 72,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 12,
        gap: 0,
        background: '#09070d',
        borderRight: '1px solid #160f24',
        overflowY: 'auto',
        overflowX: 'visible',
        scrollbarWidth: 'none',
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Logo / DM button */}
      <IconOrb
        tooltip="Mensagens Diretas"
        active={!activeServerId}
        onClick={() => router.push('/app/me')}
        icon={
          <img
            src="/nexus-logo.png"
            alt="Nexus"
            style={{ width: 26, height: 26, objectFit: 'cover', objectPosition: '50% 18%', borderRadius: 6 }}
          />
        }
      />

      {/* Divider */}
      <div
        style={{
          width: 32,
          height: 1,
          margin: '10px 0',
          borderRadius: 1,
          background: 'linear-gradient(90deg,transparent,#2a1f40,transparent)',
        }}
      />

      {/* Server list */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          width: '100%',
          alignItems: 'center',
          overflowX: 'visible',
        }}
      >
        {servers.map(server => (
          <div key={server.id} onContextMenu={e => handleContextMenu(e, server)}>
            <ServerOrb
              server={server}
              active={activeServerId === server.id}
              onClick={() => router.push(`/app/servers/${server.id}`)}
            />
          </div>
        ))}
      </div>

      {/* Add server */}
      <div style={{ marginTop: 6 }}>
        <IconOrb
          tooltip="Criar Servidor"
          gradient
          onClick={() => setShowCreateServer(true)}
          icon={<Plus style={{ width: 18, height: 18 }} />}
        />
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ServerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            server={contextMenu.server}
            isAdmin={user?.isAdmin}
            onClose={() => setContextMenu(null)}
            onInvite={() => setInviteServer(contextMenu.server)}
            onSettings={() => router.push(`/app/servers/${contextMenu.server.id}/settings`)}
            onLeave={async () => {
              await api.delete(`/servers/${contextMenu.server.id}/leave`).catch(() => {});
              setServers(prev => prev.filter(s => s.id !== contextMenu.server.id));
              router.push('/app/me');
            }}
          />
        )}
      </AnimatePresence>

      {/* Invite modal */}
      <AnimatePresence>
        {inviteServer && (
          <InviteModal
            serverId={inviteServer.id}
            serverName={inviteServer.name}
            onClose={() => setInviteServer(null)}
          />
        )}
      </AnimatePresence>

      {/* Create Server modal */}
      <AnimatePresence>
        {showCreateServer && (
          <CreateServerModal
            onClose={() => setShowCreateServer(false)}
            onCreated={(newServer) => {
              setServers(prev => [...prev, newServer]);
              setShowCreateServer(false);
              router.push(`/app/servers/${newServer.id}`);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
