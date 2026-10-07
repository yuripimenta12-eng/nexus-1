'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Shield, ShieldCheck, MessageSquare, MicOff, Mic, UserX, Ban, X, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getSocket, joinServer } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
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

export function MemberList({ serverId, variant = 'sidebar', onClose }: { serverId: string; variant?: 'sidebar' | 'drawer'; onClose?: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Member | null>(null);

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
    <aside className={cn(
      'w-60 shrink-0 flex-col border-l border-[var(--th-line)] bg-[var(--th-side)]',
      variant === 'sidebar' ? 'hidden lg:flex' : 'flex h-full',
    )}>
      <div className="h-[70px] flex items-center px-4 border-b border-[var(--th-line)] shrink-0">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#9188a2]">Membros</h3>
        <span className="ml-2 text-[11px] text-[#6f6478]">{members.length}</span>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar membros"
            title="Fechar"
            className="ml-auto -mr-1 w-10 h-10 rounded-xl grid place-items-center text-[#a99cb8] hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        )}
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
                onSelect={setSelected}
              />
            ))}
            <MemberGroup title="Online" count={online.length} members={online} muted={false} onSelect={setSelected} />
            <MemberGroup title="Offline" count={offline.length} members={offline} muted onSelect={setSelected} />
          </>
        )}
      </div>

      {/* Mini-perfil do membro clicado */}
      {selected && (
        <MemberProfileCard
          member={selected}
          members={members}
          serverId={serverId}
          onClose={() => setSelected(null)}
          onChanged={() => {
            setSelected(null);
            api.get(`/servers/${serverId}/members`).then(({ data }) => setMembers(data ?? [])).catch(() => {});
          }}
        />
      )}
    </aside>
  );
}

function MemberGroup({ title, count, members, muted, onSelect }: {
  title: string; count: number; members: Member[]; muted: boolean; onSelect: (m: Member) => void;
}) {
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
            <button
              key={m.userId}
              onClick={() => onSelect(m)}
              className={cn(
                'group w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5',
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mini-perfil (clique num membro) ─────────────────────────── */
const ROLE_RANK: Record<Role, number> = { OWNER: 0, ADMIN: 1, MODERATOR: 2, MEMBER: 3 };

function MemberProfileCard({ member, members, serverId, onClose, onChanged }: {
  member: Member; members: Member[]; serverId: string; onClose: () => void; onChanged: () => void;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const name = member.user.profile?.displayName || member.user.username;
  const isMe = member.userId === user?.id;
  const myRole: Role = (members.find(m => m.userId === user?.id)?.role as Role) || 'MEMBER';
  const canModerate =
    !isMe &&
    member.role !== 'OWNER' &&
    ['OWNER', 'ADMIN', 'MODERATOR'].includes(myRole) &&
    ROLE_RANK[member.role] > ROLE_RANK[myRole];
  const topColor = nameColorOf(member) || '#7a2cff';

  // Perfil público completo (banner, bio, frase, desde quando está no Nexus)
  const [pub, setPub] = useState<{
    createdAt?: string;
    profile?: { bannerUrl?: string | null; bannerColor?: string | null; bio?: string | null; customStatus?: string | null } | null;
  } | null>(null);
  useEffect(() => {
    api.get(`/users/${member.userId}/profile`).then(({ data }) => setPub(data)).catch(() => {});
  }, [member.userId]);

  const bannerUrl = pub?.profile?.bannerUrl;
  const [bc1, bc2] = (pub?.profile?.bannerColor || '').split(',');
  const bannerBg = bannerUrl
    ? `center / cover no-repeat url(${bannerUrl})`
    : bc1 && bc2
      ? `linear-gradient(120deg, ${bc1}, ${bc2})`
      : `linear-gradient(120deg, ${topColor}, #ff6a00)`;
  const customStatus = pub?.profile?.customStatus ?? member.user.profile?.customStatus;
  const bio = pub?.profile?.bio;
  const since = pub?.createdAt
    ? new Date(pub.createdAt).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
    : null;

  const act = async (kind: 'mute' | 'kick' | 'ban') => {
    setBusy(kind);
    try {
      if (kind === 'mute') {
        await api.patch(`/moderation/servers/${serverId}/mute/${member.userId}`, { muted: !(member as any).mutedBy });
      } else {
        await api.post(`/moderation/servers/${serverId}/${kind}/${member.userId}`, {});
      }
      onChanged();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Sem permissão');
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-[320px] rounded-[18px] overflow-hidden border border-[var(--th-line-2)] bg-[var(--th-panel)]
                   shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner: imagem do perfil, o gradiente escolhido ou a cor do cargo */}
        <div className="relative h-[92px]" style={{ background: bannerBg }}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--th-panel)]/70" />
        </div>
        <div className="px-4 pb-4 -mt-11">
          <div className="relative inline-block">
            <Avatar src={member.user.profile?.avatarUrl} name={name} size="xl"
                    className="!w-[84px] !h-[84px] ring-[5px] ring-[var(--th-panel)]" />
            <span
              className="absolute bottom-0.5 right-0.5 w-[18px] h-[18px] rounded-full border-[3px] border-[var(--th-panel)]"
              style={{ background: STATUS_COLOR[member.status] }}
            />
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <b className="text-lg font-extrabold truncate" style={{ color: nameColorOf(member) || '#fff' }}>{name}</b>
            <RoleIcon role={member.role} />
          </div>
          <p className="text-[#8a8095] text-[12.5px]">
            @{member.user.username}{since ? ` · no Nexus desde ${since}` : ''}
          </p>

          {/* Frase de status e bio */}
          {(customStatus || bio) && (
            <div className="mt-3 rounded-xl bg-[var(--th-panel-2)] px-3 py-2.5 space-y-1">
              {customStatus && <p className="text-[13px] text-[#e3dbeb] break-words">{customStatus}</p>}
              {bio && <p className="text-[12px] text-[#a99cb8] whitespace-pre-line break-words">{bio}</p>}
            </div>
          )}

          {/* Cargos personalizados */}
          {(member.roles?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {member.roles!.map(r => (
                <span key={r.id}
                  className="flex items-center gap-1.5 text-[11.5px] font-bold rounded-full px-2.5 py-[3px] border"
                  style={{ color: r.color, background: `${r.color}1f`, borderColor: `${r.color}59` }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </span>
              ))}
            </div>
          )}

          {/* Ações */}
          {!isMe && (
            <div className="mt-4 space-y-1.5">
              <button
                onClick={() => router.push(`/app/dms/${member.userId}`)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold
                           text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:-translate-y-0.5 active:scale-95 transition-all
                           shadow-[0_8px_22px_rgba(122,44,255,0.28)]"
              >
                <MessageSquare className="w-4 h-4" /> Mensagem
              </button>
              {canModerate && (
                <div className="grid grid-cols-3 gap-1.5">
                  <button onClick={() => act('mute')} disabled={!!busy}
                    title={(member as any).mutedBy ? 'Liberar microfone' : 'Silenciar no servidor'}
                    className="flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold
                               text-[#a99cb8] bg-[var(--th-panel-2)] hover:text-white border border-[var(--th-line-2)] transition-colors">
                    {busy === 'mute' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                      (member as any).mutedBy ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => act('kick')} disabled={!!busy} title="Expulsar do servidor"
                    className="flex items-center justify-center py-2 rounded-xl text-xs font-bold
                               text-warning bg-[var(--th-panel-2)] hover:bg-warning/15 border border-[var(--th-line-2)] transition-colors">
                    {busy === 'kick' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => act('ban')} disabled={!!busy} title="Banir do servidor"
                    className="flex items-center justify-center py-2 rounded-xl text-xs font-bold
                               text-destructive bg-[var(--th-panel-2)] hover:bg-destructive/15 border border-[var(--th-line-2)] transition-colors">
                    {busy === 'ban' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
              {msg && <p className="text-destructive text-xs text-center">{msg}</p>}
            </div>
          )}
        </div>

        <button onClick={onClose}
          aria-label="Fechar"
          className="absolute top-2 right-2 w-9 h-9 sm:w-7 sm:h-7 rounded-full bg-black/30 hover:bg-black/50 text-white grid place-items-center">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
