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
import { RolesManager } from '@/components/servers/roles-manager';

/* ── Seções das configurações (referência Discord, sem os itens
      marcados em vermelho pelo usuário) ─────────────────────── */
const SECTION_GROUPS: { title?: string; items: { key: string; label: string; danger?: boolean }[] }[] = [
  {
    items: [
      { key: 'profile', label: 'Perfil do servidor' },
    ],
  },
  {
    title: 'Expressões',
    items: [
      { key: 'emoji', label: 'Emoji' },
      { key: 'stickers', label: 'Figurinhas' },
    ],
  },
  {
    title: 'Pessoas',
    items: [
      { key: 'members', label: 'Membros' },
      { key: 'roles', label: 'Cargos' },
      { key: 'invites', label: 'Convites' },
      { key: 'access', label: 'Acesso' },
    ],
  },
  {
    title: 'Apps',
    items: [
      { key: 'integrations', label: 'Integrações' },
    ],
  },
  {
    title: 'Moderação',
    items: [
      { key: 'security', label: 'Configurações de Segurança' },
      { key: 'bans', label: 'Banimentos' },
    ],
  },
  {
    items: [
      { key: 'template', label: 'Modelo do servidor' },
      { key: 'danger', label: 'Excluir servidor', danger: true },
    ],
  },
];

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

  const [section, setSection] = useState('members');
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membersInChannels, setMembersInChannels] = useState(false);
  useEffect(() => {
    setMembersInChannels(localStorage.getItem(`nexus_members_in_channels:${serverId}`) === '1');
  }, [serverId]);
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
            <h1 className="text-xl font-bold mt-0.5">Configurações do servidor</h1>
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

      <div className="p-7 flex gap-8 max-w-6xl">
        {/* ── Navegação das seções ─────────────────────────── */}
        <nav className="w-52 shrink-0 space-y-4 sticky top-28 self-start">
          {SECTION_GROUPS.map(g => (
            <div key={g.title || 'root'}>
              {g.title && (
                <p className="px-2 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-[#786e83]">{g.title}</p>
              )}
              <div className="space-y-0.5">
                {g.items.map(it => (
                  <button
                    key={it.key}
                    onClick={() => setSection(it.key)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                      it.danger
                        ? 'text-[#ff5872] hover:bg-[#ff587215]'
                        : section === it.key
                          ? 'bg-white/10 text-white'
                          : 'text-[#a99cb8] hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Conteúdo da seção ─────────────────────────────── */}
        <div className="flex-1 min-w-0">
        {section === 'profile' && <ProfileSection serverId={serverId} notify={notify} />}
        {section === 'roles' && <RolesManager serverId={serverId} notify={notify} />}
        {section === 'invites' && <InvitesSection serverId={serverId} notify={notify} />}
        {section === 'access' && <AccessSection serverId={serverId} notify={notify} />}
        {section === 'bans' && <BansSection serverId={serverId} notify={notify} />}
        {section === 'danger' && <DangerSection serverId={serverId} notify={notify} />}
        {section === 'emoji' && <EmojiSection serverId={serverId} notify={notify} />}
        {section === 'template' && <TemplateSection serverId={serverId} notify={notify} />}
        {['stickers', 'integrations', 'security'].includes(section) && (
          <ComingSoon section={section} />
        )}

        {section === 'members' && (
        <section>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">Membros do servidor</h2>
            <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4">
              <div>
                <p className="text-white text-sm font-medium">Mostrar membros na lista de canais</p>
                <p className="text-[#92879f] text-xs mt-0.5">
                  Ativar isso mostrará um atalho "Membros" na lista de canais, permitindo ver rapidamente
                  quem entrou recentemente no seu servidor.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={membersInChannels}
                onClick={() => {
                  const v = !membersInChannels;
                  setMembersInChannels(v);
                  localStorage.setItem(`nexus_members_in_channels:${serverId}`, v ? '1' : '0');
                  window.dispatchEvent(new Event('nexus:members-page-toggle'));
                }}
                className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', membersInChannels ? 'bg-success' : 'bg-[#4a4356]')}
              >
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', membersInChannels ? 'left-[18px]' : 'left-0.5')} />
              </button>
            </div>
          </div>
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
        )}
        </div>
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

/* ══ Seções ══════════════════════════════════════════════════════ */

function ProfileSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/servers/${serverId}`).then(({ data }) => {
      setName(data.name || '');
      setDescription(data.description || '');
      setTag(data.tag || '');
      setIconUrl(data.iconUrl || null);
    }).catch(() => notify('Erro ao carregar o servidor')).finally(() => setLoading(false));
  }, [serverId, notify]);

  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/upload/server-icon/${serverId}`, form);
      setIconUrl(data.iconUrl);
      notify('Ícone do servidor atualizado!');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão para mudar o ícone');
    } finally {
      setUploadingIcon(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/servers/${serverId}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        tag: tag.trim() || undefined,
      });
      notify('Perfil do servidor salvo!');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-white">Perfil do servidor</h2>
        <p className="text-[#92879f] text-sm mt-1">Nome, descrição, tag e ícone que aparecem para os membros.</p>
      </div>

      {/* Ícone do servidor */}
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Ícone do servidor</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-[var(--th-panel-2)] border border-[var(--th-line-2)] grid place-items-center shrink-0">
            {iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl} alt="Ícone do servidor" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-2xl">{getInitials(name || 'S')}</span>
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white
                              bg-accent hover:bg-accent-hover active:scale-95 transition-all cursor-pointer">
              {uploadingIcon && <Loader2 className="w-4 h-4 animate-spin" />}
              Adicionar ícone
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadIcon(f); }}
              />
            </label>
            <p className="text-[#92879f] text-xs mt-2">Recomendado: imagem quadrada de 512x512 (PNG, JPG ou GIF).</p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Nome do servidor</label>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={100} className="nexus-input w-full" />
      </div>
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Descrição</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3}
          className="nexus-input w-full resize-none" placeholder="Sobre o que é a sua comunidade?" />
      </div>
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Tag do servidor</label>
        <input value={tag} onChange={e => setTag(e.target.value)} maxLength={32} className="nexus-input w-full"
          placeholder="Ex.: NEXUS" />
        <p className="text-[#92879f] text-xs mt-1.5">Uma etiqueta curta que identifica o servidor.</p>
      </div>
      <button onClick={save} disabled={saving || name.trim().length < 2}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white
                   bg-accent hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
      </button>
    </div>
  );
}

function InvitesSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.get(`/invites/servers/${serverId}`)
      .then(({ data }) => setInvites(data))
      .catch(() => notify('Sem permissão para ver convites'))
      .finally(() => setLoading(false));
  }, [serverId, notify]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      const { data } = await api.post(`/invites/servers/${serverId}`, { expiresInHours: 168 });
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.code}`);
      notify('Convite criado e copiado!');
      load();
    } catch {
      notify('Sem permissão para criar convites');
    }
  };

  const revoke = async (code: string) => {
    try {
      await api.delete(`/invites/${code}`);
      notify('Convite revogado');
      load();
    } catch {
      notify('Sem permissão');
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Convites</h2>
          <p className="text-[#92879f] text-sm mt-1">Links ativos para entrar no servidor.</p>
        </div>
        <button onClick={create}
          className="ml-auto flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white
                     bg-accent hover:bg-accent-hover active:scale-95 transition-all">
          <UserPlus className="w-4 h-4" /> Criar convite
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>}
        {!loading && invites.length === 0 && (
          <p className="text-[#92879f] text-sm text-center py-8">Nenhum convite ativo.</p>
        )}
        {invites.map(inv => (
          <div key={inv.code} className="flex items-center gap-3 px-4 py-3">
            <code className="text-accent text-sm font-bold">{inv.code}</code>
            <span className="text-[#92879f] text-xs">
              {inv.uses ?? 0} uso{(inv.uses ?? 0) !== 1 ? 's' : ''}
              {inv.expiresAt ? ` · expira ${new Date(inv.expiresAt).toLocaleDateString('pt-BR')}` : ' · permanente'}
            </span>
            <button
              onClick={async () => { await navigator.clipboard.writeText(`${window.location.origin}/invite/${inv.code}`); notify('Link copiado!'); }}
              className="ml-auto w-8 h-8 rounded-lg grid place-items-center text-[#92879f] hover:text-white hover:bg-white/5 transition-colors"
              title="Copiar link"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => revoke(inv.code)}
              className="w-8 h-8 rounded-lg grid place-items-center text-[#92879f] hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Revogar convite"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [isPublic, setIsPublic] = useState(false);
  const [maxMembers, setMaxMembers] = useState(100);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/servers/${serverId}`).then(({ data }) => {
      setIsPublic(!!data.isPublic);
      setMaxMembers(data.maxMembers ?? 100);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [serverId]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/servers/${serverId}`, { isPublic, maxMembers });
      notify('Acesso atualizado!');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>;

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-white">Acesso</h2>
        <p className="text-[#92879f] text-sm mt-1">Quem pode encontrar e entrar no servidor.</p>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4">
        <div>
          <p className="text-white text-sm font-medium">Servidor público</p>
          <p className="text-[#92879f] text-xs mt-0.5">Público: qualquer pessoa pode encontrar. Privado: entra só com convite.</p>
        </div>
        <button role="switch" aria-checked={isPublic} onClick={() => setIsPublic(v => !v)}
          className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', isPublic ? 'bg-success' : 'bg-[#4a4356]')}>
          <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', isPublic ? 'left-[18px]' : 'left-0.5')} />
        </button>
      </div>
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Máximo de membros</label>
        <input type="number" min={2} max={500} value={maxMembers}
          onChange={e => setMaxMembers(Number(e.target.value))} className="nexus-input w-40" />
      </div>
      <button onClick={save} disabled={saving}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white
                   bg-accent hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all">
        {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
      </button>
    </div>
  );
}

function BansSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [bans, setBans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [banSearch, setBanSearch] = useState('');

  const load = useCallback(() => {
    api.get(`/servers/${serverId}/bans`)
      .then(({ data }) => setBans(data))
      .catch(() => notify('Sem permissão para ver banimentos'))
      .finally(() => setLoading(false));
  }, [serverId, notify]);

  useEffect(() => { load(); }, [load]);

  const unban = async (userId: string) => {
    try {
      await api.delete(`/moderation/servers/${serverId}/ban/${userId}`);
      notify('Banimento removido');
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const shownBans = bans.filter(b => {
    const q = banSearch.toLowerCase().trim();
    if (!q) return true;
    return b.userId.toLowerCase().includes(q) ||
      (b.user?.username || '').toLowerCase().includes(q) ||
      (b.user?.profile?.displayName || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Lista de banimentos do servidor</h2>
        <p className="text-[#92879f] text-sm mt-1">
          Pessoas banidas são removidas e não conseguem entrar de novo, mesmo com convite.
        </p>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#92879f] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={banSearch}
            onChange={e => setBanSearch(e.target.value)}
            placeholder="Procurar banimentos por ID ou nome de usuário"
            className="w-full bg-[var(--th-rail)] border border-[var(--th-line)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white
                       placeholder:text-[#5c5468] focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>}
        {!loading && shownBans.length === 0 && (
          <div className="text-center py-14">
            <p className="text-4xl mb-3">🔨</p>
            <p className="text-[#a99cb8] text-sm font-black uppercase tracking-wider">Sem banimentos</p>
            <p className="text-[#5c5468] text-xs mt-1">
              {banSearch
                ? 'Nenhum banimento corresponde à busca.'
                : 'Você ainda não baniu ninguém... mas se e quando precisar, não hesite!'}
            </p>
          </div>
        )}
        {shownBans.map(b => {
          const [c1, c2] = gradientFor(b.userId);
          const name = b.user?.profile?.displayName || b.user?.username || b.userId;
          return (
            <div key={b.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="w-9 h-9 rounded-xl grid place-items-center font-black text-[11px] text-white shrink-0"
                style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}>
                {getInitials(name)}
              </span>
              <div className="min-w-0 flex-1">
                <b className="text-white text-sm block truncate">{name}</b>
                <small className="text-[#92879f] text-xs">
                  {b.bannedAt ? `banido em ${new Date(b.bannedAt).toLocaleDateString('pt-BR')}` : ''}
                  {b.bannedReason ? ` · ${b.bannedReason}` : ''}
                </small>
              </div>
              <button onClick={() => unban(b.userId)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#a99cb8] hover:text-white
                           bg-[var(--th-panel-2)] border border-[var(--th-line-2)] hover:border-accent transition-colors">
                Remover banimento
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DangerSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const destroy = async () => {
    setBusy(true);
    try {
      await api.delete(`/servers/${serverId}`);
      router.push('/app');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Só o dono pode excluir o servidor');
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h2 className="text-xl font-bold text-white">Excluir servidor</h2>
        <p className="text-[#92879f] text-sm mt-1">
          Isto apaga canais, mensagens, cargos e membros. <b className="text-destructive">Não tem volta.</b>
        </p>
      </div>
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
        <p className="text-[#cfc5d8] text-sm">Digite <b className="text-white">EXCLUIR</b> para confirmar:</p>
        <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="nexus-input w-48" placeholder="EXCLUIR" />
        <div>
          <button
            onClick={destroy}
            disabled={confirmText !== 'EXCLUIR' || busy}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white
                       bg-destructive hover:bg-red-600 disabled:opacity-40 active:scale-95 transition-all"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Excluir servidor permanentemente
          </button>
        </div>
      </div>
    </div>
  );
}

function EmojiSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [emojis, setEmojis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(() => {
    api.get(`/servers/${serverId}/emojis`)
      .then(({ data }) => setEmojis(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [serverId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await api.post(`/upload/emoji/${serverId}`, (() => { const f = new FormData(); f.append('file', file); return f; })());
      } catch (e: any) {
        notify(e?.response?.data?.message || `Erro ao enviar ${file.name}`);
      }
    }
    setUploading(false);
    load();
  };

  const remove = async (id: string, name: string) => {
    try {
      await api.delete(`/servers/${serverId}/emojis/${id}`);
      notify(`Emoji :${name}: removido`);
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  return (
    <div
      className="space-y-4 max-w-2xl"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
    >
      <div>
        <h2 className="text-xl font-bold text-white">Emoji</h2>
        <p className="text-[#92879f] text-sm mt-1">
          Adicione até 50 emojis customizados que todos podem usar neste servidor.
          Use-os no chat digitando <code className="text-accent">:nome:</code>.
        </p>
      </div>

      <label className={cn(
        'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white cursor-pointer',
        'bg-accent hover:bg-accent-hover active:scale-95 transition-all',
      )}>
        {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
        Enviar emoji
        <input
          type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only"
          onChange={(e) => { const fs = e.target.files; if (fs?.length) upload(fs); e.target.value = ''; }}
        />
      </label>

      <p className="text-[#92879f] text-xs">
        Se você quiser enviar vários emojis ou pular o editor, arraste e solte o(s) arquivo(s) nesta página.
        Os emojis serão nomeados usando o nome do arquivo.
      </p>

      <div className={cn(
        'rounded-2xl border bg-[var(--th-panel)] overflow-hidden transition-colors',
        dragOver ? 'border-accent border-dashed' : 'border-[var(--th-line)]',
      )}>
        <div className="flex items-center px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-[#786e83]">
          Emojis — {emojis.length}/50
        </div>
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>}
        {!loading && emojis.length === 0 && (
          <p className="text-[#92879f] text-sm text-center py-8">
            {dragOver ? 'Solte aqui para enviar!' : 'Nenhum emoji ainda. Envie o primeiro!'}
          </p>
        )}
        <div className="divide-y divide-[var(--th-line)]">
          {emojis.map(e => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={e.url} alt={e.name} className="w-8 h-8 object-contain shrink-0" />
              <code className="text-white text-sm">:{e.name}:</code>
              <button
                onClick={() => remove(e.id, e.name)}
                title="Excluir emoji"
                className="ml-auto w-8 h-8 rounded-lg grid place-items-center text-[#92879f]
                           hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TemplateSection({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/servers/${serverId}/template`, { title: title.trim(), description: description.trim() || undefined });
      const url = `${window.location.origin}/app/template/${data.code}`;
      setLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      notify('Modelo gerado e link copiado!');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Modelo do servidor</h2>
        <p className="text-[#92879f] text-sm mt-1">
          Um modelo de servidor é uma maneira fácil de compartilhar a configuração do seu servidor e
          ajudar qualquer pessoa a criar um servidor instantaneamente.
        </p>
        <p className="text-[#92879f] text-sm mt-2">
          Quando alguém usa o link do seu modelo, essa pessoa cria um novo servidor já preenchido com
          os mesmos canais, cargos, permissões e configurações.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#786e83] mb-2">Modelos vão copiar:</p>
          {['Canais e salas de voz', 'Cargos e permissões', 'Configurações de servidor padrão'].map(t => (
            <p key={t} className="flex items-center gap-2 text-[#cfc5d8] text-sm py-0.5">
              <span className="w-4 h-4 rounded-full bg-success/20 text-success grid place-items-center text-[10px]">✓</span> {t}
            </p>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#786e83] mb-2">Modelos não vão copiar:</p>
          {['Mensagens ou qualquer conteúdo', 'Membros', 'O ícone do seu servidor'].map(t => (
            <p key={t} className="flex items-center gap-2 text-[#cfc5d8] text-sm py-0.5">
              <span className="w-4 h-4 rounded-full bg-destructive/20 text-destructive grid place-items-center text-[10px]">✕</span> {t}
            </p>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">
          Título do modelo <span className="text-destructive">*</span>
        </label>
        <input
          value={title} onChange={e => setTitle(e.target.value)} maxLength={100}
          placeholder="Para quem é esse servidor? Por exemplo, clube da escola ou comunidade de artistas"
          className="nexus-input w-full"
        />
      </div>
      <div>
        <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">Descrição do modelo</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)} maxLength={300} rows={3}
          placeholder="O que as pessoas podem fazer nesse servidor?"
          className="nexus-input w-full resize-none"
        />
      </div>

      <button
        onClick={generate}
        disabled={generating || title.trim().length < 2}
        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold text-white
                   bg-accent hover:bg-accent-hover disabled:opacity-50 active:scale-95 transition-all"
      >
        {generating && <Loader2 className="w-4 h-4 animate-spin" />} Gerar modelo
      </button>

      {link && (
        <div className="rounded-2xl border border-success/40 bg-success/5 p-4">
          <p className="text-[#cfc5d8] text-sm mb-2">Link do modelo (copiado!):</p>
          <div className="flex items-center gap-2">
            <code className="text-accent text-sm break-all flex-1">{link}</code>
            <button
              onClick={async () => { await navigator.clipboard.writeText(link); notify('Link copiado!'); }}
              className="w-8 h-8 rounded-lg grid place-items-center text-[#92879f] hover:text-white hover:bg-white/5 shrink-0"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComingSoon({ section }: { section: string }) {
  const titles: Record<string, string> = {
    emoji: 'Emoji', stickers: 'Figurinhas', integrations: 'Integrações',
    security: 'Configurações de Segurança', template: 'Modelo do servidor',
  };
  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-white">{titles[section] || section}</h2>
      <div className="mt-4 rounded-2xl border border-dashed border-[var(--th-line-2)] bg-[var(--th-panel)] p-10 text-center">
        <p className="text-[#a99cb8] text-sm font-medium">Em breve ✨</p>
        <p className="text-[#5c5468] text-xs mt-1">Esta seção está em desenvolvimento.</p>
      </div>
    </div>
  );
}
