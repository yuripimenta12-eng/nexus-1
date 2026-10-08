'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Server, Flag, Activity, Shield, Search, CheckCircle, Loader2, ShieldCheck, MailCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { cn, formatRelativeDate } from '@/lib/utils';

// Textos em português para status e motivos que vêm do servidor em inglês
const REPORT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Pendente', cls: 'bg-warning/10 text-warning' },
  RESOLVED: { label: 'Resolvida', cls: 'bg-success/10 text-success' },
  DISMISSED: { label: 'Dispensada', cls: 'bg-white/5 text-muted' },
  REVIEWING: { label: 'Em análise', cls: 'bg-accent/10 text-accent' },
};
const REPORT_REASON: Record<string, string> = {
  SPAM: 'Spam', HARASSMENT: 'Assédio', HATE: 'Discurso de ódio', HATE_SPEECH: 'Discurso de ódio',
  EXPLICIT_CONTENT: 'Conteúdo adulto', VIOLENCE: 'Violência', SCAM: 'Golpe', IMPERSONATION: 'Se passando por outra pessoa',
  OTHER: 'Outro',
};
const isRemoved = (u: any) => typeof u?.email === 'string' && u.email.endsWith('@removido.nexus.invalid');

function Loading() {
  return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'metrics' | 'users' | 'servers' | 'reports' | 'logs'>('metrics');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    if (!user?.isAdmin) router.push('/app');
  }, [user]);

  const { data: metrics } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api.get('/admin/metrics').then(r => r.data),
    enabled: tab === 'metrics',
  });

  const { data: users } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => api.get('/admin/users', { params: { search } }).then(r => r.data),
    enabled: tab === 'users',
  });

  const { data: reports } = useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: () => api.get('/admin/reports').then(r => r.data),
    enabled: tab === 'reports',
  });

  const { data: serversData } = useQuery({
    queryKey: ['admin', 'servers'],
    queryFn: () => api.get('/admin/servers').then(r => r.data),
    enabled: tab === 'servers',
  });

  const { data: logsData } = useQuery({
    queryKey: ['admin', 'logs'],
    queryFn: () => api.get('/admin/audit-logs').then(r => r.data),
    enabled: tab === 'logs',
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean; name?: string }) =>
      api.post(`/admin/users/${id}/${suspend ? 'suspend' : 'unsuspend'}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const resolveReport = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'reports'] }),
  });

  const TABS = [
    { id: 'metrics', label: 'Métricas', icon: <Activity className="w-4 h-4" /> },
    { id: 'users', label: 'Usuários', icon: <Users className="w-4 h-4" /> },
    { id: 'servers', label: 'Servidores', icon: <Server className="w-4 h-4" /> },
    { id: 'reports', label: 'Denúncias', icon: <Flag className="w-4 h-4" /> },
    { id: 'logs', label: 'Auditoria', icon: <Shield className="w-4 h-4" /> },
  ] as const;

  if (!user?.isAdmin) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="h-14 flex items-center gap-2 md:gap-3 px-3 md:px-6 border-b border-border bg-background-secondary shrink-0">
        <MobileMenuButton />
        <span className="w-8 h-8 rounded-lg grid place-items-center text-white"
          style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
          <Shield className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h1 className="text-white font-bold leading-tight">Painel do dono</h1>
          <p className="text-[11px] text-muted leading-tight">Visão geral e moderação do Nexus</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Nav lateral — no celular vira faixa de abas roláveis */}
        <div className="w-full md:w-48 border-b md:border-b-0 md:border-r border-border p-2 md:p-3 shrink-0
                        flex md:block gap-1 md:space-y-0.5 overflow-x-auto nx-no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={(e) => { setTab(t.id as any); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }}
              className={cn(
                'sidebar-item shrink-0 w-auto md:w-full whitespace-nowrap',
                tab === t.id && 'active',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-h-0 overflow-auto p-3 md:p-6">
          {/* Métricas */}
          {tab === 'metrics' && !metrics && <Loading />}
          {tab === 'metrics' && metrics && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Visão Geral</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Usuários" value={metrics.users} icon={<Users className="w-5 h-5" />} color="text-accent" />
                <MetricCard label="Servidores" value={metrics.servers} icon={<Server className="w-5 h-5" />} color="text-accent-blue" />
                <MetricCard label="Mensagens" value={metrics.messages} icon={<Activity className="w-5 h-5" />} color="text-success" />
                <MetricCard label="Ativos hoje" value={metrics.activeToday} icon={<CheckCircle className="w-5 h-5" />} color="text-warning" />
              </div>

              {/* Cadastros por dia (14 dias) */}
              {metrics.signupsByDay && (
                <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white font-semibold text-sm">Cadastros por dia</h3>
                    <span className="text-muted text-xs">
                      últimos 14 dias · {metrics.signupsByDay.reduce((a: number, d: any) => a + d.count, 0)} novos
                    </span>
                  </div>
                  {(() => {
                    const max = Math.max(1, ...metrics.signupsByDay.map((d: any) => d.count));
                    return (
                      <div className="flex items-end gap-1.5 h-28">
                        {metrics.signupsByDay.map((d: any) => (
                          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                            <span className={cn('text-[10px] text-white font-bold transition-opacity tabular-nums sm:opacity-0 sm:group-hover:opacity-100', d.count === 0 && 'opacity-0')}>
                              {d.count}
                            </span>
                            <div
                              className="w-full rounded-t-md bg-gradient-to-t from-accent to-orange transition-all"
                              style={{ height: `${Math.max(3, (d.count / max) * 100)}%`, opacity: d.count === 0 ? 0.18 : 1 }}
                              title={`${d.date}: ${d.count} cadastro(s)`}
                            />
                            <span className="text-[9px] text-muted tabular-nums">{d.date.slice(8, 10)}<span className="hidden sm:inline">/{d.date.slice(5, 7)}</span></span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Usuários */}
          {tab === 'users' && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-white font-semibold text-lg">Usuários</h2>
                <div className="flex items-center gap-2 ml-auto bg-surface border border-border rounded-lg px-3 py-1.5">
                  <Search className="w-4 h-4 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-transparent text-white text-sm focus:outline-none w-40"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface-raised">
                    <tr>
                      <th className="text-left text-muted px-4 py-3 font-medium">Usuário</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">E-mail</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Status</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Servidores</th>
                      <th className="text-right text-muted px-4 py-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!users && (
                      <tr><td colSpan={5}><Loading /></td></tr>
                    )}
                    {users?.users?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {u.profile?.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.profile.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-black text-white shrink-0"
                                style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
                                {(u.profile?.displayName || u.username || '?').slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="text-white font-medium flex items-center gap-1.5">
                                {u.profile?.displayName || u.username}
                                {u.twoFactorEnabled && <span title="Verificação em duas etapas ligada"><ShieldCheck className="w-3.5 h-3.5 text-success" /></span>}
                                {u.isVerified && !isRemoved(u) && <span title="E-mail confirmado"><MailCheck className="w-3.5 h-3.5 text-accent-blue" /></span>}
                              </p>
                              <p className="text-muted text-xs">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{isRemoved(u) ? '—' : u.email}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            isRemoved(u)
                              ? 'bg-white/5 text-muted'
                              : u.isSuspended
                              ? 'bg-destructive/10 text-destructive'
                              : u.isAdmin
                                ? 'bg-accent/10 text-accent'
                                : 'bg-success/10 text-success',
                          )}>
                            {isRemoved(u) ? 'Conta excluída' : u.isSuspended ? 'Suspenso' : u.isAdmin ? 'Admin' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{u._count?.memberships ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          {!isRemoved(u) && <button
                            onClick={() => {
                              const nome = u.profile?.displayName || u.username;
                              const ok = window.confirm(u.isSuspended
                                ? `Reativar a conta de ${nome}?`
                                : `Suspender ${nome}? A pessoa não consegue mais entrar até ser reativada.`);
                              if (ok) suspendMutation.mutate({ id: u.id, suspend: !u.isSuspended });
                            }}
                            disabled={u.id === user.id || suspendMutation.isPending}
                            className={cn(
                              'text-xs px-3 py-1 rounded-md transition-colors disabled:opacity-30',
                              u.isSuspended
                                ? 'bg-success/10 text-success hover:bg-success hover:text-white'
                                : 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white',
                            )}
                          >
                            {u.isSuspended ? 'Ativar' : 'Suspender'}
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users && !users.users?.length && (
                  <p className="text-muted text-sm text-center py-8">Ninguém encontrado</p>
                )}
              </div>
            </div>
          )}

          {/* Servidores */}
          {tab === 'servers' && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Servidores</h2>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-surface-raised">
                    <tr>
                      <th className="text-left text-muted px-4 py-3 font-medium">Servidor</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Dono</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Membros</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Canais</th>
                      <th className="text-left text-muted px-4 py-3 font-medium">Criado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {!serversData && (
                      <tr><td colSpan={5}><Loading /></td></tr>
                    )}
                    {serversData?.servers?.map((s: any) => (
                      <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            {s.iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={s.iconUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
                            ) : (
                              <span className="w-8 h-8 rounded-lg bg-accent/15 text-accent grid place-items-center text-xs font-black">
                                {s.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            <p className="text-white font-medium">{s.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {s.owner ? `${s.owner.profile?.displayName || s.owner.username} (@${s.owner.username})` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted">{s._count?.members ?? 0}</td>
                        <td className="px-4 py-3 text-muted">{s._count?.channels ?? 0}</td>
                        <td className="px-4 py-3 text-muted">{formatRelativeDate(s.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {serversData && !serversData.servers?.length && (
                  <p className="text-muted text-sm text-center py-8">Nenhum servidor ainda</p>
                )}
              </div>
            </div>
          )}

          {/* Auditoria */}
          {tab === 'logs' && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Auditoria</h2>
              <div className="space-y-2">
                {!logsData && <Loading />}
                {logsData?.logs?.map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                    <Shield className="w-4 h-4 text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium">{l.action}</p>
                      <p className="text-muted text-xs">
                        Por {l.actor?.profile?.displayName || l.actor?.username || 'sistema'}
                        {l.targetType ? ` · alvo: ${l.targetType} ${l.targetId || ''}` : ''}
                      </p>
                    </div>
                    <span className="text-muted text-xs shrink-0">{formatRelativeDate(l.createdAt)}</span>
                  </div>
                ))}
                {logsData && !logsData.logs?.length && (
                  <p className="text-muted text-sm text-center py-8">
                    Nenhum registro ainda — ações de moderação (suspender, banir, kick) aparecem aqui.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Denúncias */}
          {tab === 'reports' && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Denúncias</h2>
              <div className="space-y-3">
                {!reports && <Loading />}
                {reports?.reports?.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-xl bg-surface border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            (REPORT_STATUS[r.status] || REPORT_STATUS.DISMISSED).cls,
                          )}>
                            {REPORT_STATUS[r.status]?.label || r.status}
                          </span>
                          <span className="text-muted text-xs">{REPORT_REASON[r.reason] || r.reason}</span>
                          <span className="text-muted text-xs">· {formatRelativeDate(r.createdAt)}</span>
                        </div>
                        <p className="text-white text-sm">{r.description || 'Sem descrição'}</p>
                        <p className="text-muted text-xs mt-1">
                          Por <span className="text-muted-foreground">{r.reporter?.profile?.displayName || r.reporter?.username || 'alguém'}</span>
                          {' '}→ <span className="text-muted-foreground">{r.targetUser?.profile?.displayName || 'Alvo desconhecido'}</span>
                        </p>
                      </div>
                      {r.status === 'PENDING' && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => resolveReport.mutate({ id: r.id, status: 'RESOLVED' })}
                            className="btn-ghost text-xs text-success"
                          >
                            Resolver
                          </button>
                          <button
                            onClick={() => resolveReport.mutate({ id: r.id, status: 'DISMISSED' })}
                            className="btn-ghost text-xs text-muted"
                          >
                            Dispensar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {reports && !reports.reports?.length && (
                  <p className="text-muted text-sm text-center py-8">Nenhuma denúncia pendente</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, color }: any) {
  return (
    <div className="relative p-5 rounded-2xl bg-surface border border-border overflow-hidden group hover:border-[#4a3566] transition-colors">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-[0.07] group-hover:opacity-[0.12] transition-opacity"
        style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }} />
      <div className={cn('mb-3 w-9 h-9 rounded-xl grid place-items-center bg-white/5', color)}>{icon}</div>
      <p className="text-3xl font-extrabold text-white tabular-nums">{(value ?? 0).toLocaleString('pt-BR')}</p>
      <p className="text-muted text-sm mt-1">{label}</p>
    </div>
  );
}
