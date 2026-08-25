'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Shield, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { getSocket, joinServer } from '@/lib/socket';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
type Status = 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE';

interface CustomRole {
  id: string;
  name: string;
  color: string;
  hoist: boolean;
  position: number;
}

interface Member {
  id: string;
  userId: string;
  role: Role;
  status: Status;
  roles?: CustomRole[]; // cargos personalizados (mais alto primeiro)
  user: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl: string | null; customStatus?: string | null } | null;
  };
}

// Cor do nome = cor do cargo mais alto (como no Discord)
function nameColorOf(m: Member): string | undefined {
  const top = m.roles?.[0];
  return top && top.color !== '#99aab5' ? top.color : undefined;
}

const STATUS_COLOR: Record<Status, string> = {
  ONLINE: '#3ba55d',
  AWAY: '#faa61a',
  BUSY: '#ed4245',
  OFFLINE: '#747f8d',
};

function RoleIcon({ role }: { role: Role }) {
  if (role === 'OWNER') return <Crown className="w-3.5 h-3.5 text-[#ffb648]" />;
  if (role === 'ADMIN') return <ShieldCheck className="w-3.5 h-3.5 text-[#b05cff]" />;
  if (role === 'MODERATOR') return <Shield className="w-3.5 h-3.5 text-[#5cc8ff]" />;
  return null;
}

export function MemberList({ serverId }: { serverId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega os membros (com status vindo do backend)
  useEffect(() => {
    if (!serverId) return;
    let alive = true;
    setLoading(true);
    api.get(`/servers/${serverId}/members`)
      .then(({ data }) => { if (alive) setMembers(data ?? []); })
      .catch(() => { if (alive) setMembers([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [serverId]);

  // Presença em tempo real: entra na room do servidor e escuta os eventos
  useEffect(() => {
    if (!serverId) return;
    const socket = getSocket();
    joinServer(serverId); // garante que recebemos os broadcasts de presença

    const setStatus = (userId: string, status: Status) =>
      setMembers(prev => prev.map(m => (m.userId === userId ? { ...m, status } : m)));

    const onOnline = ({ userId }: { userId: string }) => setStatus(userId, 'ONLINE');
    const onOffline = ({ userId }: { userId: string }) => setStatus(userId, 'OFFLINE');
    const onStatus = ({ userId, status }: { userId: string; status: Status }) => setStatus(userId, status);

    socket.on('user:online', onOnline);
    socket.on('user:offline', onOffline);
    socket.on('user:status_changed', onStatus);

    return () => {
      socket.off('user:online', onOnline);
      socket.off('user:offline', onOffline);
      socket.off('user:status_changed', onStatus);
    };
  }, [serverId]);

  const { hoistedGroups, online, offline } = useMemo(() => {
    const on: Member[] = [];
    const off: Member[] = [];
    // Ordena: cargo (OWNER→MEMBER) e depois nome
    const rank: Record<Role, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 };
    const sorted = [...members].sort((a, b) => {
      if (rank[a.role] !== rank[b.role]) return rank[a.role] - rank[b.role];
      const an = a.user.profile?.displayName || a.user.username;
      const bn = b.user.profile?.displayName || b.user.username;
      return an.localeCompare(bn);
    });
    for (const m of sorted) (m.status !== 'OFFLINE' ? on : off).push(m);

    // Estilo Discord: membros ONLINE com um cargo "hoist" aparecem numa
    // seção própria do cargo mais alto; o resto fica em "Online".
    const byRole = new Map<string, { role: CustomRole; members: Member[] }>();
    const rest: Member[] = [];
    for (const m of on) {
      const hoisted = m.roles?.find(r => r.hoist);
      if (hoisted) {
        if (!byRole.has(hoisted.id)) byRole.set(hoisted.id, { role: hoisted, members: [] });
        byRole.get(hoisted.id)!.members.push(m);
      } else {
        rest.push(m);
      }
    }
    const groups = Array.from(byRole.values()).sort((a, b) => b.role.position - a.role.position);
    return { hoistedGroups: groups, online: rest, offline: off };
  }, [members]);

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-l border-[var(--th-line)] bg-[var(--th-side)]">
      <div className="h-[70px] flex items-center px-4 border-b border-[var(--th-line)] shrink-0">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#9188a2]">Membros</h3>
        <span className="ml-2 text-[11px] text-[#6f6478]">{members.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {loading ? (
          <div className="flex justify-center pt-6">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {hoistedGroups.map(g => (
              <MemberGroup
                key={g.role.id}
                title={g.role.name}
                count={g.members.length}
                members={g.members}
                muted={false}
              />
            ))}
            <MemberGroup title="Online" count={online.length} members={online} muted={false} />
            <MemberGroup title="Offline" count={offline.length} members={offline} muted />
          </>
        )}
      </div>
    </aside>
  );
}

function MemberGroup({ title, count, members, muted }: { title: string; count: number; members: Member[]; muted: boolean }) {
  if (count === 0) return null;
  return (
    <div>
      <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-[#6f6478]">
        {title} — {count}
      </p>
      <div className="space-y-0.5">
        {members.map(m => {
          const name = m.user.profile?.displayName || m.user.username;
          return (
            <div
              key={m.userId}
              className={cn(
                'group flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5',
                muted && 'opacity-45 hover:opacity-100',
              )}
            >
              <div className="relative shrink-0">
                <Avatar src={m.user.profile?.avatarUrl} name={name} size="sm" />
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--th-side)]"
                  style={{ background: STATUS_COLOR[m.status] }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[14px] truncate"
                    style={{ color: nameColorOf(m) || '#d7cfe0' }}
                  >
                    {name}
                  </span>
                  <RoleIcon role={m.role} />
                </div>
                {m.user.profile?.customStatus && (
                  <p className="text-[11px] text-[#8a8095] truncate">{m.user.profile.customStatus}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
