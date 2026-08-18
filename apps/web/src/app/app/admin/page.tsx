'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Server, Flag, Activity, Shield, Search, Ban, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { cn, formatRelativeDate } from '@/lib/utils';

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

  const suspendMutation = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
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
      <div className="h-12 flex items-center gap-3 px-6 border-b border-border bg-background-secondary shrink-0">
        <Shield className="w-5 h-5 text-accent" />
        <h1 className="text-white font-semibold">Painel Administrativo</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Nav lateral */}
        <div className="w-48 border-r border-border p-3 space-y-0.5 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={cn(
                'sidebar-item w-full',
                tab === t.id && 'active',
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto p-6">
          {/* Métricas */}
          {tab === 'metrics' && metrics && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Visão Geral</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Usuários" value={metrics.users} icon={<Users className="w-5 h-5" />} color="text-accent" />
                <MetricCard label="Servidores" value={metrics.servers} icon={<Server className="w-5 h-5" />} color="text-accent-blue" />
                <MetricCard label="Mensagens" value={metrics.messages} icon={<Activity className="w-5 h-5" />} color="text-success" />
                <MetricCard label="Ativos hoje" value={metrics.activeToday} icon={<CheckCircle className="w-5 h-5" />} color="text-warning" />
              </div>
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
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
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
                    {users?.users?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white font-medium">{u.profile?.displayName || u.username}</p>
                            <p className="text-muted text-xs">@{u.username}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            u.isSuspended
                              ? 'bg-destructive/10 text-destructive'
                              : u.isAdmin
                                ? 'bg-accent/10 text-accent'
                                : 'bg-success/10 text-success',
                          )}>
                            {u.isSuspended ? 'Suspenso' : u.isAdmin ? 'Admin' : 'Ativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{u._count?.memberships ?? 0}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => suspendMutation.mutate({ id: u.id, suspend: !u.isSuspended })}
                            disabled={u.id === user.id}
                            className={cn(
                              'text-xs px-3 py-1 rounded-md transition-colors disabled:opacity-30',
                              u.isSuspended
                                ? 'bg-success/10 text-success hover:bg-success hover:text-white'
                                : 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white',
                            )}
                          >
                            {u.isSuspended ? 'Ativar' : 'Suspender'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Denúncias */}
          {tab === 'reports' && (
            <div>
              <h2 className="text-white font-semibold text-lg mb-4">Denúncias</h2>
              <div className="space-y-3">
                {reports?.reports?.map((r: any) => (
                  <div key={r.id} className="p-4 rounded-xl bg-surface border border-border">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn(
                            'text-xs px-2 py-0.5 rounded-full font-medium',
                            r.status === 'PENDING' ? 'bg-warning/10 text-warning' :
                            r.status === 'RESOLVED' ? 'bg-success/10 text-success' :
                            'bg-muted/10 text-muted',
                          )}>
                            {r.status}
                          </span>
                          <span className="text-muted text-xs">{r.reason}</span>
                        </div>
                        <p className="text-white text-sm">{r.description || 'Sem descrição'}</p>
                        <p className="text-muted text-xs mt-1">
                          Por <span className="text-muted-foreground">{r.reporter.profile?.displayName}</span>
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
                {!reports?.reports?.length && (
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
    <div className="p-5 rounded-xl bg-surface border border-border">
      <div className={cn('mb-3', color)}>{icon}</div>
      <p className="text-3xl font-bold text-white">{value?.toLocaleString()}</p>
      <p className="text-muted text-sm mt-1">{label}</p>
    </div>
  );
}
