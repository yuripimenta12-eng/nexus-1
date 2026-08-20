'use client';

import { useEffect, useRef } from 'react';
import {
  Settings, UserPlus, Bell, BellOff, LogOut,
  Shield, Hash, Volume2, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════
   NEXUS LINK — ServerContextMenu (Design System v2)

   Uso (no servers-sidebar):
     onContextMenu={e => { e.preventDefault(); openMenu(e, server); }}
     <ServerContextMenu
       x={menuPos.x} y={menuPos.y}
       server={server}
       isAdmin={user.isAdmin}
       onClose={() => setMenuOpen(false)}
       onInvite={() => { setMenuOpen(false); setShowInvite(true); }}
       onSettings={() => router.push(`/app/servers/${server.id}/settings`)}
       onLeave={async () => { await api.delete(`/servers/${server.id}/members/me`); ... }}
     />
══════════════════════════════════════════════ */

interface ServerContextMenuProps {
  x:          number;
  y:          number;
  server:     { id: string; name: string };
  isAdmin?:   boolean;
  onClose:    () => void;
  onInvite?:  () => void;
  onSettings?:() => void;
  onLeave?:   () => void;
}

type ItemVariant = 'normal' | 'danger' | 'muted';

interface MenuItem {
  icon:    React.ReactNode;
  label:   string;
  onClick: () => void;
  variant?: ItemVariant;
  dividerAfter?: boolean;
}

function ContextItem({ item }: { item: MenuItem }) {
  const colorMap: Record<ItemVariant, string> = {
    normal: '#b8b0cc',
    danger: '#ff6060',
    muted:  '#7a748e',
  };
  const hoverBgMap: Record<ItemVariant, string> = {
    normal: 'rgba(124,90,240,0.14)',
    danger: 'rgba(255,68,68,0.14)',
    muted:  'rgba(255,255,255,0.05)',
  };
  const variant = item.variant ?? 'normal';

  return (
    <>
      <button
        onClick={item.onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          width: '100%', textAlign: 'left',
          padding: '8px 12px',
          background: 'transparent', border: 'none',
          color: colorMap[variant],
          fontSize: 13, fontWeight: 600,
          cursor: 'pointer', borderRadius: 6,
          transition: 'background 0.1s, color 0.1s',
          margin: '1px 0',
        }}
        onMouseEnter={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = hoverBgMap[variant];
          btn.style.color = variant === 'danger' ? '#ff8080' : variant === 'muted' ? '#b8b0cc' : '#ede8f8';
        }}
        onMouseLeave={e => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = 'transparent';
          btn.style.color = colorMap[variant];
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>{item.icon}</span>
        {item.label}
      </button>
      {item.dividerAfter && (
        <div style={{ height: 1, background: '#1e1630', margin: '4px 0' }} />
      )}
    </>
  );
}

export function ServerContextMenu({
  x, y, server, isAdmin, onClose, onInvite, onSettings, onLeave,
}: ServerContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  /* Close on outside click or Escape */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  /* Constrain to viewport */
  const menuW = 200;
  const menuH = 260;
  const safeX = Math.min(x, window.innerWidth  - menuW - 8);
  const safeY = Math.min(y, window.innerHeight - menuH - 8);

  const items: MenuItem[] = [
    ...(onInvite ? [{
      icon: <UserPlus style={{ width: 14, height: 14 }} />,
      label: 'Convidar pessoas',
      onClick: () => { onClose(); onInvite(); },
      dividerAfter: true,
    }] : []),
    {
      icon: <Hash style={{ width: 14, height: 14 }} />,
      label: 'Criar canal',
      onClick: onClose,
    },
    {
      icon: <Volume2 style={{ width: 14, height: 14 }} />,
      label: 'Criar sala de voz',
      onClick: onClose,
      dividerAfter: true,
    },
    {
      icon: <Bell style={{ width: 14, height: 14 }} />,
      label: 'Notificações',
      onClick: onClose,
    },
    ...(isAdmin ? [{
      icon: <Settings style={{ width: 14, height: 14 }} />,
      label: 'Configurações',
      onClick: () => { onClose(); onSettings?.(); },
      dividerAfter: true,
    }] : []),
    {
      icon: <LogOut style={{ width: 14, height: 14 }} />,
      label: 'Sair do servidor',
      onClick: () => { onClose(); onLeave?.(); },
      variant: 'danger' as ItemVariant,
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit   ={{ opacity: 0, scale: 0.94, y: -6 }}
        transition={{ duration: 0.12 }}
        style={{
          position: 'fixed',
          left: safeX, top: safeY,
          width: menuW,
          zIndex: 99999,
          background: '#131020',
          border: '1px solid #2a1f40',
          borderRadius: 12,
          padding: 6,
          boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* Server name label */}
        <div style={{ padding: '6px 12px 8px' }}>
          <p style={{
            fontSize: 11, fontWeight: 800, color: '#4a4560',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {server.name}
          </p>
        </div>
        <div style={{ height: 1, background: '#1e1630', marginBottom: 4 }} />
        {items.map((item, i) => <ContextItem key={i} item={item} />)}
      </motion.div>
    </AnimatePresence>
  );
}
