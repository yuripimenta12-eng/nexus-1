'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, Settings, X, Loader2, ShieldCheck, BellOff, Sparkles, Gamepad2, Lightbulb, Store } from 'lucide-react';
import { pedirBoasVindas } from '@/components/servers/primeiros-passos';
import { useNex } from '@/lib/nex';
import { MoedaNex, nexCurto } from '@/components/nex/moeda-nex';
import { useMutes } from '@/lib/mutes';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { imagemOtimizavel } from '@/lib/imagem';
import { cn, getInitials } from '@/lib/utils';
import { Moldura } from '@/components/nex/itens-visuais';
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
  const [modelo, setModelo] = useState<'gamer' | 'padrao'>('gamer');
  const nex = useNex(s => s.dados);
  const abrirNex = useNex(s => s.abrir);
  const temPremio = !!nex && (!nex.presenca.pegouHoje || nex.roleta.girosRestantes > 0
    || nex.missoes.some(m => !m.resgatada && m.progresso >= m.meta));
  // Saldo e avisos: ao abrir o app, ao voltar para a janela e a cada 10 min
  useEffect(() => {
    const atualizar = () => useNex.getState().carregar();
    atualizar();
    const t = setInterval(atualizar, 10 * 60_000);
    window.addEventListener('focus', atualizar);
    return () => { clearInterval(t); window.removeEventListener('focus', atualizar); };
  }, []);
  // Aba do "+": criar um servidor ou entrar num com o convite de alguém
  const [aba, setAba] = useState<'criar' | 'entrar'>('criar');
  const [conviteColado, setConviteColado] = useState('');
  const [entrando, setEntrando] = useState(false);

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
      // shortcut: servidor ainda sem o campo "modelo" recusa com 400; repete sem ele. Pode sair depois do deploy.
      const { data } = await api.post('/servers', { name: newServerName.trim(), modelo })
        .catch((e) => (e?.response?.status === 400 && /modelo/.test(JSON.stringify(e.response.data))
          ? api.post('/servers', { name: newServerName.trim() })
          : Promise.reject(e)));
      setServers(prev => [...prev, data]);
      setNewServerName('');
      // Chega no servidor com as boas-vindas abertas (convite, ícone, descrição, sala de voz)
      pedirBoasVindas(data.id);
      setShowCreateModal(false);
      setModelo('gamer');
      router.push(`/app/servers/${data.id}`);
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

      {/* Planos do Nexus e o link de indicação */}
      <button
        onClick={() => router.push('/app/planos')}
        className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex items-center justify-center
                   text-[#c8f53b] hover:border-[#c8f53b] hover:-translate-y-0.5"
        title="Planos e indicações"
        aria-label="Planos e indicações"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Nex: presença, roleta e missões (bolinha = tem prêmio para pegar) */}
      <button
        onClick={() => abrirNex()}
        className="relative w-[46px] min-h-[46px] py-1.5 rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex flex-col items-center justify-center gap-0.5
                   hover:border-[#ff8a3d] hover:-translate-y-0.5"
        title={nex ? `${nex.saldo.toLocaleString('pt-BR')} Nex · Presença, roleta e missões` : 'Recompensas Nex'}
        aria-label="Recompensas Nex"
      >
        <MoedaNex className="w-6 h-6" />
        <span className="text-[9px] font-black text-[#ffd08a] leading-none tabular-nums">{nex ? nexCurto(nex.saldo) : '…'}</span>
        {temPremio && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#ff6a00] border-2 border-[var(--th-rail)] animate-pulse" />}
      </button>

      {/* Loja Nexus: molduras, ícones e placas com Nex */}
      <button
        onClick={() => router.push('/app/loja')}
        className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex items-center justify-center
                   text-[#c9a6ff] hover:border-[#c9a6ff] hover:-translate-y-0.5"
        title="Loja Nexus"
        aria-label="Loja Nexus"
      >
        <Store className="w-5 h-5" />
      </button>

      {/* Em breve: votar no que vem por aí */}
      <button
        onClick={() => router.push('/app/em-breve')}
        className="w-[46px] h-[46px] rounded-2xl border border-[var(--th-line-2)] bg-[#171121]
                   transition-all duration-200 flex items-center justify-center
                   text-[#ffb070] hover:border-[#ffb070] hover:-translate-y-0.5"
        title="Em breve: vote no que vem por aí"
        aria-label="Em breve: vote no que vem por aí"
      >
        <Lightbulb className="w-5 h-5" />
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
                {aba === 'criar' ? 'Criar servidor' : 'Entrar num servidor'}
              </h2>
              <button onClick={fecharModal} aria-label="Fechar"
                className="text-muted hover:text-white transition-colors -m-2 p-2">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(
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
                    <p className="text-muted text-sm mb-3">Escolha como começar. Dá para mudar tudo depois.</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {([
                        { id: 'gamer', titulo: 'Gamer BR', desc: 'Squads, campeonato, Valorant, Free Fire, GTA RP, clipes', icone: Gamepad2 },
                        { id: 'padrao', titulo: 'Do zero', desc: 'Só #geral e uma sala de voz', icone: Plus },
                      ] as const).map(m => (
                        <button key={m.id} type="button" onClick={() => setModelo(m.id)} aria-pressed={modelo === m.id}
                          className={cn('text-left rounded-xl border p-3 transition-all',
                            modelo === m.id
                              ? 'border-[#8b48ff] bg-gradient-to-br from-[#26143c] to-[#160e22] shadow-[0_0_20px_rgba(122,44,255,0.15)]'
                              : 'border-border bg-surface-raised hover:border-[#4d3560]')}>
                          <span className={cn('w-8 h-8 rounded-[10px] grid place-items-center mb-2',
                            modelo === m.id ? 'bg-gradient-to-br from-orange to-accent text-white' : 'bg-[#2a1c45] text-[#c9a6ff]')}>
                            <m.icone className="w-4 h-4" />
                          </span>
                          <b className="block text-sm text-white">{m.titulo}</b>
                          <small className="block text-[11px] text-muted leading-snug mt-0.5">{m.desc}</small>
                        </button>
                      ))}
                    </div>
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
        className={cn('relative w-[43px] h-[43px] rounded-2xl grid place-items-center font-extrabold text-white text-xs transition-transform hover:scale-105 active:scale-95',
          !(user?.profile as any)?.moldura && 'bg-gradient-to-br from-[#ff7d20] to-[#6424cc]')}
      >
        {(user?.profile as any)?.moldura ? (
          // Com moldura: foto redonda e a moldura em volta
          <span className="relative w-[34px] h-[34px]">
            {user?.profile?.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={user.profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              : <span className="w-full h-full rounded-full grid place-items-center">{getInitials(user?.profile?.displayName || user?.username || '?')}</span>}
            <Moldura id={(user?.profile as any)?.moldura} espessura={3} />
          </span>
        ) : user?.profile?.avatarUrl ? (
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
