'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
  Crown, Shield, Gavel, User, MicOff, Mic, UserX, Ban,
  Copy, Loader2, UserPlus, Search, X,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

/* ── Tipos ─────────────────────────────────────── */
type MemberRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

interface ServerMember {
  id: string;
  userId: string;
  role: MemberRole;
  mutedBy: boolean;
  joinedAt: string;
  user: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl: string | null; status?: string } | null;
  };
}

const ROLE_META: Record<MemberRole, { label: string; icon: any; badge: string; desc: string }> = {
  OWNER: {
    label: 'Dono', icon: Crown,
    badge: 'text-white bg-gradient-to-r from-orange to-accent',
    desc: 'Controle total: canais, cargos, moderação e exclusão do servidor.',
  },
  ADMIN: {
    label: 'Admin', icon: Shield,
    badge: 'text-[#ffb27d] bg-[#3a2113] border border-[#6b3a1c]',
    desc: 'Gerencia canais e salas, silencia, expulsa e bane membros, muda cargos abaixo do dele.',
  },
  MODERATOR: {
    label: 'Moderador', icon: Gavel,
    badge: 'text-[#d3a8ef] bg-[#2a1937] border border-[#54306e]',
    desc: 'Mantém a ordem: silencia membros e remove participantes das salas de voz.',
  },
  MEMBER: {
    label: 'Membro', icon: User,
    badge: 'text-[#a99cb8] bg-[var(--th-panel-2)] border border-[var(--th-line-2)]',
    desc: 'Conversa, entra em chamadas, abre câmera e compartilha a tela.',
  },
};

const ROLE_ORDER: MemberRole[] = ['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'];

function gradientFor(id: string): [string, string] {
  const palette: [string, string][] = [
    ['#ff7620', '#6d27d9'], ['#bc4cff', '#3d1c82'], ['#17a9cf', '#2f427c'],
    ['#ff558d', '#7b2dac'], ['#ffb02e', '#c2410c'], ['#42e6a4', '#0f766e'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function ServerSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;
  const { user } = useAuthStore();

  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState<{ action: 'kick' | 'ban'; member: ServerMember } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const myRole: MemberRole = members.find(m => m.userId === user?.id)?.role || 'MEMBER';
  const canModerate = myRole === 'OWNER' || myRole === 'ADMIN' || myRole === 'MODERATOR';
  const canManageRoles = myRole === 'OWNER' || myRole === 'ADMIN';

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  const loadMembers = useCallback(async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}/members`);
      setMembers(data);
    } catch {
      notify('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // Fechar: volta para o servidor (ESC ou botão X)
  const handleClose = () => router.push(`/app/servers/${serverId}`);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverId]);

  // ── Ações de moderação ─────────────────────────────────────────
  const changeRole = async (m: ServerMember, role: MemberRole) => {
    setBusy(m.userId);
    try {
      await api.patch(`/moderation/servers/${serverId}/role/${m.userId}`, { role });
      setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, role } : x));
      notify(`${m.user.profile?.displayName || m.user.username} agora é ${ROLE_META[role].label}`);
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão para mudar este cargo');
    } finally {
      setBusy(null);
    }
  };

  const toggleMute = async (m: ServerMember) => {
    setBusy(m.userId);
    try {
      await api.patch(`/moderation/servers/${serverId}/mute/${m.userId}`, { muted: !m.mutedBy });
      setMembers(prev => prev.map(x => x.userId === m.userId ? { ...x, mutedBy: !m.mutedBy } : x));
      notify(m.mutedBy ? 'Microfone liberado no servidor' : 'Silenciado no servidor');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setBusy(null);
    }
  };

  const doConfirmedAction = async () => {
    if (!confirm) return;
    const { action, member } = confirm;
    setBusy(member.userId);
    try {
      await api.post(`/moderation/servers/${serverId}/${action}/${member.userId}`, {});
      setMembers(prev => prev.filter(x => x.userId !== member.userId));
      notify(action === 'kick' ? 'Membro expulso do servidor' : 'Membro banido do servidor');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const copyInvite = async () => {
    try {
      const { data } = await api.post(`/invites/servers/${serverId}`, { expiresInHours: 168 });
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.code}`);
      notify('Link de convite copiado!');
    } catch {
      notify('Sem permissão para criar convites');
    }
  };

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    return !q ||
      m.user.username.toLowerCase().includes(q) ||
      (m.user.profile?.displayName || '').toLowerCase().includes(q);
  });

  return (
    <div className="h-full overflow-y-auto text-white nx-page-bg">
      {/* Header */}
      <div className="px-7 pt-6 pb-4 border-b border-[var(--th-line)] bg-[var(--th-side)] backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-orange text-[10px] font-extrabold uppercase tracking-[1.5px]">Administração</p>
            <h1 className="text-xl font-bold mt-0.5">Membros e cargos</h1>
            <p className="text-[#92879f] text-xs mt-1">
              Controle quem participa e o que cada pessoa pode fazer na sua comunidade.
            </p>
          </div>
          <button
            onClick={copyInvite}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white
                       bg-gradient-to-r from-orange to-accent shadow-[0_5px_18px_rgba(255,90,0,0.2)]
                       hover:opacity-90 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Convidar
          </button>
          <div className="flex flex-col items-center gap-1 ml-1">
            <button
              onClick={handleClose}
              title="Fechar (Esc)"
              className="w-10 h-10 rounded-full border-2 border-[#4d3560] text-[#a99cb8]
                         hover:border-accent hover:text-white flex items-center justify-center
                         transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
            <span className="text-[9px] font-extrabold text-[#5c5468] tracking-wider">ESC</span>
          </div>
        </div>
      </div>

      <div className="p-7 max-w-4xl space-y-8">
        {/* ── Cargos do Nexus ───────────────────────────────── */}
        <section>
          <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">
            Cargos do servidor
          </p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {ROLE_ORDER.map(r => {
              const meta = ROLE_META[r];
              const Icon = meta.icon;
              const count = members.filter(m => m.role === r).length;
              return (
                <div key={r} className="flex items-start gap-3 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4">
                  <span className={cn(
                    'w-10 h-10 rounded-xl grid place-items-center shrink-0',
                    r === 'OWNER' ? 'bg-gradient-to-br from-orange to-accent text-white' : 'bg-[var(--th-panel-2)] text-[#8c5dcc]',
                  )}>
                    <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-sm">{meta.label}</b>
                      <span className="text-[10px] text-[#92879f]">{count} membro{count !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="text-xs text-[#92879f] mt-0.5 leading-relaxed">{meta.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Membros ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px]">
              Membros — {members.length}
            </p>
            <div className="ml-auto relative">
              <Search className="w-3.5 h-3.5 text-[#92879f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar membro..."
                className="bg-[var(--th-rail)] border border-[var(--th-line)] rounded-xl pl-9 pr-3 py-2 text-sm text-white
                           placeholder:text-[#5c5468] focus:outline-none focus:border-accent w-56"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <p className="text-[#92879f] text-sm text-center py-8">Nenhum membro encontrado.</p>
            )}

            {filtered.map(m => {
              const [c1, c2] = gradientFor(m.userId);
              const meta = ROLE_META[m.role];
              const isMe = m.userId === user?.id;
              const targetBelowMe = ROLE_ORDER.indexOf(m.role) > ROLE_ORDER.indexOf(myRole);
              const isBusy = busy === m.userId;

              return (
                <div key={m.id} className="flex items-center gap-3 p-3.5 hover:bg-white/[0.02] transition-colors">
                  <div
                    className="w-10 h-10 rounded-xl grid place-items-center font-black text-xs text-white shrink-0"
                    style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}
                  >
                    {getInitials(m.user.profile?.displayName || m.user.username)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <b className="text-sm truncate">{m.user.profile?.displayName || m.user.username}</b>
                      {isMe && <span className="text-[10px] text-[#92879f]">(você)</span>}
                      {m.mutedBy && (
                        <span className="flex items-center gap-1 text-[10px] text-destructive">
                          <MicOff className="w-3 h-3" /> silenciado
                        </span>
                      )}
                    </div>
                    <small className="text-[#92879f] text-xs">@{m.user.username}</small>
                  </div>

                  {/* Cargo */}
                  {canManageRoles && !isMe && m.role !== 'OWNER' && targetBelowMe ? (
                    <select
                      value={m.role}
                      disabled={isBusy}
                      onChange={(e) => changeRole(m, e.target.value as MemberRole)}
                      className={cn(
                        'text-xs font-bold rounded-full px-3 py-1.5 cursor-pointer focus:outline-none',
                        'bg-[var(--th-panel-2)] border border-[var(--th-line-2)] text-[#d3a8ef] hover:border-accent',
                      )}
                    >
                      {myRole === 'OWNER' && <option value="ADMIN">Admin</option>}
                      <option value="MODERATOR">Moderador</option>
                      <option value="MEMBER">Membro</option>
                    </select>
                  ) : (
                    <span className={cn('text-[11px] font-extrabold rounded-full px-3 py-1.5 flex items-center gap-1.5', meta.badge)}>
                      <meta.icon className="w-3 h-3" /> {meta.label}
                    </span>
                  )}

                  {/* Ações de moderação */}
                  {canModerate && !isMe && m.role !== 'OWNER' && targetBelowMe && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMute(m)}
                        disabled={isBusy}
                        title={m.mutedBy ? 'Liberar microfone no servidor' : 'Silenciar no servidor'}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                          m.mutedBy
                            ? 'bg-destructive/15 text-destructive hover:bg-destructive hover:text-white'
                            : 'text-[#92879f] hover:text-white hover:bg-[#21152c]',
                        )}
                      >
                        {m.mutedBy ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirm({ action: 'kick', member: m })}
                        disabled={isBusy}
                        title="Expulsar do servidor"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#92879f]
                                   hover:text-warning hover:bg-[#21152c] transition-colors"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirm({ action: 'ban', member: m })}
                        disabled={isBusy}
                        title="Banir do servidor"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#92879f]
                                   hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(m.userId); notify('ID copiado'); }}
                        title="Copiar ID do usuário"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#92879f]
                                   hover:text-white hover:bg-[#21152c] transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {isBusy && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
                </div>
              );
            })}
          </div>

          {!canModerate && !loading && (
            <p className="text-[#5c5468] text-xs mt-3">
              Só o dono, admins e moderadores podem gerenciar membros.
            </p>
          )}
        </section>
      </div>

      {/* Modal de confirmação */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
            onClick={() => setConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
              onClick={e => e.stopPropagation()}
              className="bg-[var(--th-panel)] border border-[#392454] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            >
              <h3 className="font-bold text-lg mb-1">
                {confirm.action === 'kick' ? 'Expulsar' : 'Banir'}{' '}
                {confirm.member.user.profile?.displayName || confirm.member.user.username}?
              </h3>
              <p className="text-[#92879f] text-sm mb-6">
                {confirm.action === 'kick'
                  ? 'A pessoa sai do servidor mas pode voltar com um novo convite.'
                  : 'A pessoa é removida e não consegue mais entrar, mesmo com convite.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirm(null)}
                  className="px-4 py-2 rounded-xl bg-[var(--th-panel-2)] text-[#a99cb8] hover:text-white text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={doConfirmedAction}
                  className="px-4 py-2 rounded-xl bg-destructive hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  {confirm.action === 'kick' ? 'Expulsar' : 'Banir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 px-4 py-2.5 rounded-xl
                       bg-[#1a1024] border border-[#6f36a1] text-white text-sm shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
