'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Settings, X, Loader2, ShieldCheck, BellOff, Copy, Check } from 'lucide-react';
import { useMutes } from '@/lib/mutes';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { imagemOtimizavel } from '@/lib/imagem';
import { cn, getInitials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { avisarServidoresMudaram, lerCodigoColado } from '@/lib/convite';
import { BotaoComunicados } from '@/components/layout/comunicados';

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
  const mutedServers = useMutes(st => st.servers);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  // Aba do "+": criar um servidor ou entrar num com o convite de alguém
  const [aba, setAba] = useState<'criar' | 'entrar'>('criar');
  const [conviteColado, setConviteColado] = useState('');
  const [entrando, setEntrando] = useState(false);
  // Depois de criar: o link de convite já pronto para mandar aos amigos
  const [criado, setCriado] = useState<{ id: string; name: string; link: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const carregar = () => api.get('/users/@me/servers').then(({ data }) => {
      setServers(data.map((m: any) => m.server));
    }).catch(() => {});
    carregar();
    // Entrou num servidor por convite (chat, link ou "+"): aparece na hora aqui
    window.addEventListener('nexus:servers-changed', carregar);
    return () => window.removeEventListener('nexus:servers-changed', carregar);
  }, []);

  const fecharModal = () => {
    setShowCreateModal(false);
    setCreateError('');
    setConviteColado('');
    setAba('criar');
    if (criado) router.push(`/app/servers/${criado.id}`);
    setCriado(null);
    setCopiado(false);
  };

  const handleJoinInvite = async () => {
    const code = lerCodigoColado(conviteColado);
    if (!code) { setCreateError('Cole o link do convite (ex.: nexuslink.art/invite/abc123) ou só o código.'); return; }
    setEntrando(true);
    setCreateError('');
    try {
      const { data } = await api.post(`/invites/${code}/use`);
      avisarServidoresMudaram();
      setShowCreateModal(false);
      setConviteColado('');
      router.push(`/app/servers/${data.server.id}`);
    } catch (e: any) {
      setCreateError(e?.response?.status === 404 ? 'Convite não encontrado. Confira o link.' : (e?.response?.data?.message || 'Não foi possível entrar'));
    } finally {
      setEntrando(false);
    }
  };

  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const { data } = await api.post('/servers', { name: newServerName.trim() });
      setServers(prev => [...prev, data]);
      setNewServerName('');
      // Já deixa um convite de 7 dias pronto para copiar
      let link: string | null = null;
      try {
        const inv = await api.post(`/invites/servers/${data.id}`, { expiresInHours: 168 });
        link = `${window.location.origin}/invite/${inv.data.code}`;
      } catch { /* sem convite: dá para criar depois no menu do servidor */ }
      setCriado({ id: data.id, name: data.name, link });
    } catch (e: any) {
      setCreateError(e?.response?.data?.message || 'Erro ao criar servidor');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-[76px] h-full flex flex-col items-center py-4 gap-3 bg-[var(--th-rail)] border-r border-[var(--th-line-2)] overflow-y-auto shrink-0">
      {/* Marca Nexus */}
      <button
        onClick={() => router.push('/app/me')}
        title="Mensagens Diretas"
        className="w-12 h-12 rounded-full shadow-[0_0_28px_rgba(122,44,255,0.35)]
                   transition-transform hover:scale-105 active:scale-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nexus-logo-round.webp"
          alt="Nexus"
          draggable={false}
          className="w-full h-full object-contain select-none"
        />
      </button>

      {/* Divisor */}
      <div className="w-8 h-px bg-[#30223d]" />

      {/* Servidores */}
      {servers.map((server) => (
        <ServerIcon
          key={server.id}
          label={server.name}
          isActive={activeServerId === server.id}
          muted={mutedServers.has(server.id)}
          onClick={() => router.push(`/app/servers/${server.id}`)}
        >
          {server.iconUrl ? (
            <Image src={server.iconUrl} alt={server.name} width={48} height={48} className="object-cover" unoptimized={!imagemOtimizavel(server.iconUrl)} />
          ) : (
            <span className="text-sm font-bold">{getInitials(server.name)}</span>
          )}
        </ServerIcon>
      ))}

      {/* Criar servidor */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex items-center justify-center
                   text-success hover:border-success hover:-translate-y-0.5"
        title="Criar ou entrar num servidor"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Painel do dono — só aparece para o admin da plataforma */}
      {(user as any)?.isAdmin && (
        <button
          onClick={() => router.push('/app/admin')}
          className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                     transition-all duration-200 flex items-center justify-center
                     text-[#ffb84d] hover:border-orange hover:-translate-y-0.5"
          title="Painel do dono"
        >
          <ShieldCheck className="w-5 h-5" />
        </button>
      )}

      {/* Modal: criar servidor / entrar com convite */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={fecharModal}>
          <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold text-lg">
                {criado ? 'Servidor criado!' : aba === 'criar' ? 'Criar servidor' : 'Entrar num servidor'}
              </h2>
              <button onClick={fecharModal} aria-label="Fechar"
                className="text-muted hover:text-white transition-colors -m-2 p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {criado ? (
              <>
                <p className="text-muted text-sm mb-4">
                  Mande este link para os seus amigos. Quem clicar entra direto em <strong className="text-white">{criado.name}</strong>.
                </p>
                {criado.link ? (
                  <div className="flex items-center gap-2 bg-surface-raised border border-border rounded-lg p-1.5 pl-3 mb-1">
                    <span className="flex-1 min-w-0 truncate text-[13px] text-[#c8b8d8] font-mono">{criado.link}</span>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(criado.link!); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem área de transferência */ }
                      }}
                      className={cn('shrink-0 px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-colors',
                        copiado ? 'bg-success/15 text-success' : 'bg-accent hover:bg-accent-hover text-white')}
                    >
                      {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                    </button>
                  </div>
                ) : (
                  <p className="text-muted text-xs mb-1">Crie o convite depois em: nome do servidor → Convidar pessoas.</p>
                )}
                <p className="text-muted text-[11px] mb-4">Vale por 7 dias. Dá para criar outros no menu do servidor.</p>
                <button onClick={fecharModal}
                  className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors">
                  Ir para o servidor
                </button>
              </>
            ) : (
              <>
                <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-surface-raised mb-4">
                  {(['criar', 'entrar'] as const).map(a => (
                    <button key={a} role="tab" aria-selected={aba === a}
                      onClick={() => { setAba(a); setCreateError(''); }}
                      className={cn('py-1.5 rounded-md text-sm font-medium transition-colors',
                        aba === a ? 'bg-accent text-white' : 'text-muted hover:text-white')}>
                      {a === 'criar' ? 'Criar' : 'Tenho um convite'}
                    </button>
                  ))}
                </div>

                {aba === 'criar' ? (
                  <>
                    <p className="text-muted text-sm mb-4">Dê um nome ao seu servidor. Você sempre pode mudá-lo depois.</p>
                    <input
                      autoFocus
                      value={newServerName}
                      onChange={e => setNewServerName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateServer(); if (e.key === 'Escape') fecharModal(); }}
                      placeholder="Nome do servidor"
                      className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2.5
                                 text-white text-sm placeholder:text-muted focus:border-accent outline-none transition-colors mb-2"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-muted text-sm mb-4">Cole o link de convite que você recebeu.</p>
                    <input
                      autoFocus
                      value={conviteColado}
                      onChange={e => setConviteColado(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleJoinInvite(); if (e.key === 'Escape') fecharModal(); }}
                      placeholder="nexuslink.art/invite/abc123"
                      className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2.5
                                 text-white text-sm placeholder:text-muted focus:border-accent outline-none transition-colors mb-2"
                    />
                  </>
                )}
                {createError && <p className="text-destructive text-xs mb-2">{createError}</p>}
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={fecharModal}
                    className="px-4 py-2 rounded-lg bg-surface-raised text-muted hover:text-white text-sm transition-colors">
                    Cancelar
                  </button>
                  {aba === 'criar' ? (
                    <button
                      onClick={handleCreateServer}
                      disabled={!newServerName.trim() || creating}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                                 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                      Criar servidor
                    </button>
                  ) : (
                    <button
                      onClick={handleJoinInvite}
                      disabled={!conviteColado.trim() || entrando}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                                 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {entrando && <Loader2 className="w-4 h-4 animate-spin" />}
                      Entrar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Comunicados do Nexus (histórico + não lidos) */}
      <BotaoComunicados />

      {/* Config */}
      <button
        onClick={() => router.push('/app/me/settings')}
        className="w-[46px] h-[46px] rounded-2xl border border-transparent transition-all duration-200
                   flex items-center justify-center text-muted hover:text-white hover:bg-[#1c1227] hover:border-[#362146]"
        title="Configurações"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Eu (foto de perfil; toque abre o perfil e as configurações) */}
      <button
        onClick={() => router.push('/app/me/settings')}
        title={user?.profile?.displayName || user?.username || ''}
        className="relative w-[43px] h-[43px] rounded-2xl grid place-items-center font-extrabold text-white text-xs
                   bg-gradient-to-br from-[#ff7d20] to-[#6424cc] transition-transform hover:scale-105 active:scale-95"
      >
        {user?.profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profile.avatarUrl} alt="" className="w-full h-full rounded-2xl object-cover" />
        ) : getInitials(user?.profile?.displayName || user?.username || '?')}
        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-success border-[3px] border-[#0c0911]" />
      </button>
    </div>
  );
}

function ServerIcon({
  children,
  label,
  isActive,
  muted,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  isActive: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  // A coluna tem rolagem própria (cortaria a dica): a dica fica em posição fixa na tela
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  return (
    <div className="relative group"
      onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ x: r.right + 12, y: r.top + r.height / 2 }); }}
      onMouseLeave={() => setTip(null)}>
      {/* Indicador ativo */}
      <motion.div
        animate={{ scaleY: isActive ? 1 : 0 }}
        initial={false}
        className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-1 h-7 bg-orange rounded-r-md"
      />
      {/* Ao passar o mouse: um tracinho menor (como no Discord) */}
      {!isActive && (
        <div className="absolute -left-[15px] top-1/2 -translate-y-1/2 w-1 h-2.5 bg-[#cfc6dd] rounded-r-md
                        scale-y-0 group-hover:scale-y-100 transition-transform duration-150" />
      )}

      <button
        onClick={onClick}
        title={label}
        className={cn(
          'w-[46px] h-[46px] flex items-center justify-center overflow-hidden rounded-2xl border',
          'transition-all duration-200 cursor-pointer font-extrabold',
          isActive
            ? 'border-[#8b48ff] text-white bg-gradient-to-br from-[#26143c] to-[#1b1028] -translate-y-0.5 shadow-[0_6px_22px_rgba(122,44,255,0.35)]'
            : 'border-[var(--th-line-2)] bg-[#171121] text-[#cfc6dd] hover:border-[#8b48ff] hover:text-white hover:-translate-y-0.5',
          muted && !isActive && 'opacity-55 hover:opacity-100',
        )}
      >
        {children}
      </button>
      {muted && (
        <span className="absolute -right-1 -bottom-1 w-[18px] h-[18px] rounded-full grid place-items-center bg-[#0c0911] text-[#a99cb8]"
          aria-label="Servidor silenciado">
          <BellOff className="w-2.5 h-2.5" />
        </span>
      )}

      {/* Tooltip */}
      {tip && <div className="fixed -translate-y-1/2 z-[100] pointer-events-none [@media(hover:none)]:hidden" style={{ left: tip.x, top: tip.y }}>
        <div className="relative bg-[#1b1524] border border-[#3a2d4d] rounded-lg px-3 py-1.5 shadow-xl whitespace-nowrap">
          <span className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-[#1b1524] border-l border-b border-[#3a2d4d]" />
          <p className="relative text-white text-sm font-semibold">{label}{muted ? ' · silenciado' : ''}</p>
        </div>
      </div>}
    </div>
  );
}
