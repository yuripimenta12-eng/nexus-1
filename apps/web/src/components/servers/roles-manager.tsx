'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, ChevronLeft, Plus, Search, Loader2, Trash2, Users, Check, Pencil, Shield,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import api from '@/lib/api';

/* ── Permissões (espelho do backend) ─────────────────────────── */
interface PermDef { key: string; label: string; desc: string; }
interface PermGroup { title: string; perms: PermDef[]; }

const PERM_GROUPS: PermGroup[] = [
  {
    title: 'Permissões gerais do servidor',
    perms: [
      { key: 'view_channels', label: 'Ver canais', desc: 'Permite que os membros vejam os canais (exceto canais privados).' },
      { key: 'manage_channels', label: 'Gerenciar canais', desc: 'Permite que os membros criem, editem ou excluam canais.' },
      { key: 'manage_roles', label: 'Gerenciar cargos', desc: 'Permite criar novos cargos e editar ou excluir cargos abaixo do cargo mais alto deles.' },
      { key: 'create_expressions', label: 'Criar expressões', desc: 'Permite que os membros adicionem emojis, figurinhas e sons personalizados neste servidor.' },
      { key: 'manage_expressions', label: 'Gerenciar expressões', desc: 'Permite que os membros editem ou removam emojis, figurinhas e sons personalizados.' },
      { key: 'manage_webhooks', label: 'Gerenciar webhooks', desc: 'Permite que os membros criem, editem ou excluam webhooks.' },
      { key: 'manage_server', label: 'Gerenciar servidor', desc: 'Permite que os membros mudem o nome do servidor e vejam todos os convites.' },
    ],
  },
  {
    title: 'Permissões da assinatura',
    perms: [
      { key: 'create_invite', label: 'Criar convite', desc: 'Permite que os membros convidem pessoas novas para este servidor.' },
      { key: 'change_nickname', label: 'Alterar apelido', desc: 'Permite que os membros mudem seus próprios apelidos neste servidor.' },
      { key: 'manage_nicknames', label: 'Gerenciar apelidos', desc: 'Permite que os membros mudem os apelidos de outros membros.' },
      { key: 'kick_members', label: 'Expulsar, aprovar e rejeitar membros', desc: 'Expulsar permite remover membros; expulsos podem voltar com novo convite.' },
      { key: 'ban_members', label: 'Banir membros', desc: 'Permite banir permanentemente e apagar o histórico de mensagens de outros membros.' },
      { key: 'timeout_members', label: 'Membros de castigo', desc: 'De castigo, o membro não envia mensagens, não reage e não fala em canais de voz.' },
    ],
  },
  {
    title: 'Permissões de canal de texto',
    perms: [
      { key: 'send_messages', label: 'Enviar mensagens e criar postagens', desc: 'Permite mandar mensagens em canais de texto e criar postagens.' },
      { key: 'send_messages_in_threads', label: 'Enviar mensagens em tópicos e postagens', desc: 'Permite mandar mensagens em tópicos e postagens.' },
      { key: 'create_public_threads', label: 'Criar tópicos públicos', desc: 'Permite criar tópicos que todos em um canal podem visualizar.' },
      { key: 'create_private_threads', label: 'Criar tópicos privados', desc: 'Permite criar tópicos controlados por convite.' },
      { key: 'embed_links', label: 'Inserir links', desc: 'Links compartilhados mostram conteúdo integrado em canais de texto.' },
      { key: 'attach_files', label: 'Anexar arquivos', desc: 'Permite enviar arquivos ou mídia em canais de texto.' },
      { key: 'add_reactions', label: 'Adicionar reações', desc: 'Permite adicionar novas reações de emoji a uma mensagem.' },
      { key: 'use_external_emojis', label: 'Usar emojis externos', desc: 'Permite usar emojis de outros servidores.' },
      { key: 'use_external_stickers', label: 'Usar figurinhas externas', desc: 'Permite usar figurinhas de outros servidores.' },
      { key: 'mention_everyone', label: 'Mencionar @everyone, @here e todos os cargos', desc: 'Permite usar @everyone, @here e mencionar todos os cargos.' },
      { key: 'manage_messages', label: 'Gerenciar mensagens', desc: 'Permite excluir ou remover anexos de mensagens de outros membros.' },
      { key: 'pin_messages', label: 'Fixar mensagens', desc: 'Permite fixar ou desafixar qualquer mensagem.' },
      { key: 'bypass_slowmode', label: 'Ignorar modo lento', desc: 'Permite enviar mensagens sem serem afetados pelo modo lento.' },
      { key: 'manage_threads', label: 'Gerenciar tópicos e postagens', desc: 'Permite renomear, excluir, fechar e ativar modo lento de tópicos.' },
      { key: 'read_message_history', label: 'Ver histórico de mensagens', desc: 'Permite ler mensagens anteriores enviadas nos canais.' },
      { key: 'send_tts', label: 'Enviar mensagens em Texto-para-voz', desc: 'Permite enviar mensagens /tts, ouvidas por todos no canal.' },
      { key: 'send_voice_messages', label: 'Enviar mensagens de voz', desc: 'Permite que os membros enviem mensagens de voz.' },
      { key: 'create_polls', label: 'Criar Enquetes', desc: 'Permite que os membros criem enquetes.' },
    ],
  },
  {
    title: 'Permissões de canal de voz',
    perms: [
      { key: 'speak', label: 'Falar', desc: 'Permite falar em canais de voz. Sem esta permissão, o membro fica silenciado.' },
      { key: 'video', label: 'Vídeo', desc: 'Permite compartilhar tela, abrir a câmera e transmitir neste servidor.' },
      { key: 'use_soundboard', label: 'Usar efeitos sonoros', desc: 'Permite mandar sons do painel de efeitos do servidor.' },
      { key: 'use_external_sounds', label: 'Usar sons externos', desc: 'Permite usar sons de outros servidores.' },
      { key: 'use_vad', label: 'Usar Detecção de voz', desc: 'Sem esta permissão, o membro precisa usar Apertar para Falar.' },
      { key: 'priority_speaker', label: 'Voz prioritária', desc: 'O volume dos outros é reduzido automaticamente quando este membro fala.' },
      { key: 'mute_members', label: 'Silenciar membros', desc: 'Permite silenciar outros membros para todos em um canal de voz.' },
      { key: 'deafen_members', label: 'Ensurdecer membros', desc: 'Permite desativar o áudio de outros membros em canais de voz.' },
      { key: 'move_members', label: 'Mover membros', desc: 'Permite desconectar ou mover membros entre canais de voz.' },
      { key: 'set_voice_status', label: 'Definir status do canal de voz', desc: 'Permite criar e editar o status do canal de voz.' },
    ],
  },
];

const ADMIN_PERM: PermDef = {
  key: 'administrator',
  label: 'Administrador',
  desc: 'Membros com esta permissão terão todas as outras e ignoram restrições de canais. Pense bem antes de conceder.',
};

/* Paleta de cores (imagem de referência) */
const ROLE_COLORS = [
  '#43b581', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b',
  '#11806a', '#1f8b4c', '#206694', '#71368a', '#ad1457', '#c27c0e', '#a84300', '#992d22', '#979c9f', '#546e7a',
];

interface Role {
  id: string;
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
  permissions: string; // JSON array
  position: number;
  isDefault: boolean;
  _count?: { assignments: number };
}

interface Member {
  userId: string;
  user: { username: string; profile: { displayName: string; avatarUrl: string | null } | null };
}

function gradFor(id: string): [string, string] {
  const p: [string, string][] = [
    ['#ff7620', '#6d27d9'], ['#bc4cff', '#3d1c82'], ['#17a9cf', '#2f427c'],
    ['#ff558d', '#7b2dac'], ['#ffb02e', '#c2410c'], ['#42e6a4', '#0f766e'],
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return p[h % p.length];
}

export function RolesManager({ serverId, notify }: { serverId: string; notify: (m: string) => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Role | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/servers/${serverId}/roles`);
      setRoles(data);
    } catch {
      notify('Erro ao carregar cargos');
    } finally {
      setLoading(false);
    }
  }, [serverId, notify]);

  useEffect(() => { load(); }, [load]);

  const createRole = async () => {
    try {
      const { data } = await api.post(`/servers/${serverId}/roles`, {});
      await load();
      setEditing(data);
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão para criar cargos');
    }
  };

  if (editing) {
    return (
      <RoleEditor
        serverId={serverId}
        role={editing}
        notify={notify}
        onBack={() => { setEditing(null); load(); }}
      />
    );
  }

  const everyone = roles.find(r => r.isDefault);
  const custom = roles
    .filter(r => !r.isDefault)
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white">Cargos</h2>
        <p className="text-[#92879f] text-sm mt-1">Use cargos para agrupar os membros do servidor e dar permissões.</p>
      </div>

      {/* Permissões padrão (@everyone) */}
      {everyone && (
        <button
          onClick={() => setEditing(everyone)}
          className="w-full flex items-center gap-3 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)]
                     p-4 hover:border-accent transition-colors text-left"
        >
          <span className="w-10 h-10 rounded-xl grid place-items-center bg-[var(--th-panel-2)] text-[#8c5dcc]">
            <Users className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <b className="text-white text-sm">Permissões padrão</b>
            <p className="text-[#92879f] text-xs">@everyone · vale para todos os membros do servidor</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[#5c5468]" />
        </button>
      )}

      {/* Busca + criar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#92879f] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cargos"
            className="w-full bg-[var(--th-rail)] border border-[var(--th-line)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white
                       placeholder:text-[#5c5468] focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={createRole}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white
                     bg-accent hover:bg-accent-hover active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" /> Criar cargo
        </button>
      </div>

      <p className="text-[#92879f] text-xs">
        Os membros usam a cor do cargo mais alto que eles possuem nesta lista.
      </p>

      {/* Lista */}
      <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
        <div className="flex items-center px-4 py-2 text-[10px] font-extrabold uppercase tracking-wider text-[#786e83]">
          <span>Cargos — {custom.length}</span>
          <span className="ml-auto">Membros</span>
        </div>

        {loading && (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
        )}

        {!loading && custom.length === 0 && (
          <p className="text-[#92879f] text-sm text-center py-8">Nenhum cargo ainda. Crie o primeiro!</p>
        )}

        {custom.map(r => (
          <button
            key={r.id}
            onClick={() => setEditing(r)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
          >
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: r.color }} />
            <b className="text-white text-sm truncate flex-1" style={{ color: r.color }}>{r.name}</b>
            <span className="flex items-center gap-1.5 text-[#92879f] text-xs">
              {r._count?.assignments ?? 0} <Users className="w-3.5 h-3.5" />
            </span>
            <Pencil className="w-3.5 h-3.5 text-[#5c5468]" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Editor de um cargo ───────────────────────────────────────── */
function RoleEditor({ serverId, role, notify, onBack }: {
  serverId: string; role: Role; notify: (m: string) => void; onBack: () => void;
}) {
  const [tab, setTab] = useState<'display' | 'perms' | 'members'>(role.isDefault ? 'perms' : 'display');
  const [name, setName] = useState(role.name);
  const [color, setColor] = useState(role.color);
  const [hoist, setHoist] = useState(role.hoist);
  const [mentionable, setMentionable] = useState(role.mentionable);
  const [perms, setPerms] = useState<Set<string>>(() => new Set(JSON.parse(role.permissions || '[]')));
  const [saving, setSaving] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  const dirty = useMemo(() => {
    const orig = new Set<string>(JSON.parse(role.permissions || '[]'));
    const sameSet = orig.size === perms.size && Array.from(perms).every(p => orig.has(p));
    return name !== role.name || color !== role.color || hoist !== role.hoist ||
      mentionable !== role.mentionable || !sameSet;
  }, [name, color, hoist, mentionable, perms, role]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/servers/${serverId}/roles/${role.id}`, {
        name, color, hoist, mentionable, permissions: Array.from(perms),
      });
      role.name = name; role.color = color; role.hoist = hoist;
      role.mentionable = mentionable; role.permissions = JSON.stringify(Array.from(perms));
      notify('Cargo salvo!');
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async () => {
    if (!window.confirm(`Excluir o cargo "${role.name}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/roles/${role.id}`);
      notify('Cargo excluído');
      onBack();
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const togglePerm = (key: string) => {
    setPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const groups = PERM_GROUPS.map(g => ({
    ...g,
    perms: g.perms.filter(p =>
      !permSearch ||
      p.label.toLowerCase().includes(permSearch.toLowerCase()) ||
      p.desc.toLowerCase().includes(permSearch.toLowerCase())),
  })).filter(g => g.perms.length > 0);

  return (
    <div className="space-y-4 pb-24">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-xl grid place-items-center text-[#a99cb8] hover:text-white hover:bg-white/5 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="w-4 h-4 rounded-full" style={{ background: role.isDefault ? '#99aab5' : color }} />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white truncate">
            {role.isDefault ? 'Permissões padrão' : `Editar cargo — ${name}`}
          </h2>
          {role.isDefault && (
            <p className="text-[#92879f] text-xs">@everyone · vale para todos os membros do servidor</p>
          )}
        </div>
        {!role.isDefault && (
          <button
            onClick={removeRole}
            title="Excluir cargo"
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-destructive
                       hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Excluir
          </button>
        )}
      </div>

      {/* Abas */}
      {!role.isDefault && (
        <div className="flex gap-1 border-b border-[var(--th-line)]">
          {([['display', 'Exibição'], ['perms', 'Permissões'], ['members', 'Membros']] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                'px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px',
                tab === k ? 'text-white border-accent' : 'text-[#81758d] border-transparent hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── Exibição ── */}
      {tab === 'display' && !role.isDefault && (
        <div className="space-y-6 max-w-xl">
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-2">
              Nome do cargo <span className="text-destructive">*</span>
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={64}
              className="nexus-input w-full"
            />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1">
              Cor do cargo <span className="text-destructive">*</span>
            </label>
            <p className="text-[#92879f] text-xs mb-3">
              Os membros usam a cor do cargo mais alto que possuem na lista de cargos.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setColor('#99aab5')}
                className={cn('w-12 h-9 rounded-lg grid place-items-center bg-[#99aab5] text-white', color === '#99aab5' && 'ring-2 ring-white')}
                title="Padrão"
              >
                {color === '#99aab5' && <Check className="w-4 h-4" />}
              </button>
              <label
                className="w-12 h-9 rounded-lg grid place-items-center bg-[var(--th-panel-2)] border border-[var(--th-line-2)] cursor-pointer"
                title="Cor personalizada"
              >
                <Pencil className="w-3.5 h-3.5 text-[#a99cb8]" />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="sr-only" />
              </label>
              {ROLE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-md', color === c && 'ring-2 ring-white')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <ToggleRow
            label="Exibir membros do cargo separadamente dos membros conectados"
            checked={hoist}
            onChange={setHoist}
          />
          <ToggleRow
            label="Permitir que qualquer um @mencione este cargo"
            desc={'Nota: membros com a permissão "Mencionar @everyone, @here e todos os cargos" podem mencionar este cargo.'}
            checked={mentionable}
            onChange={setMentionable}
          />
        </div>
      )}

      {/* ── Permissões ── */}
      {tab === 'perms' && (
        <div className="space-y-6 max-w-2xl">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#92879f] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={permSearch}
                onChange={e => setPermSearch(e.target.value)}
                placeholder="Buscar permissões"
                className="w-full bg-[var(--th-rail)] border border-[var(--th-line)] rounded-xl pl-9 pr-3 py-2 text-sm text-white
                           placeholder:text-[#5c5468] focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => setPerms(new Set())}
              className="text-xs text-[#92879f] hover:text-white font-bold px-2 py-1.5 transition-colors"
            >
              Limpar permissões
            </button>
          </div>

          {groups.map(g => (
            <section key={g.title}>
              <h3 className="text-white font-bold text-sm mb-1">{g.title}</h3>
              <div className="divide-y divide-[var(--th-line)]">
                {g.perms.map(p => (
                  <PermRow key={p.key} def={p} checked={perms.has(p.key)} onToggle={() => togglePerm(p.key)} />
                ))}
              </div>
            </section>
          ))}

          {(!permSearch || ADMIN_PERM.label.toLowerCase().includes(permSearch.toLowerCase())) && (
            <section>
              <h3 className="text-white font-bold text-sm mb-1">Permissões avançadas</h3>
              <PermRow def={ADMIN_PERM} checked={perms.has('administrator')} onToggle={() => togglePerm('administrator')} highlight />
            </section>
          )}
        </div>
      )}

      {/* ── Membros do cargo ── */}
      {tab === 'members' && !role.isDefault && (
        <RoleMembers serverId={serverId} roleId={role.id} roleColor={color} notify={notify} />
      )}

      {/* Barra de salvar */}
      {dirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl
                        bg-[#120c1a] border border-[var(--th-line-2)] shadow-2xl px-4 py-3">
          <span className="text-[#cfc5d8] text-sm">Cuidado — você tem alterações não salvas!</span>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-extrabold text-white
                       bg-success hover:opacity-90 disabled:opacity-60 transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar alterações
          </button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-white text-sm font-medium">{label}</p>
        {desc && <p className="text-[#92879f] text-xs mt-0.5">{desc}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function PermRow({ def, checked, onToggle, highlight }: {
  def: PermDef; checked: boolean; onToggle: () => void; highlight?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', highlight ? 'text-[#ffb27d]' : 'text-white')}>{def.label}</p>
        <p className="text-[#92879f] text-xs mt-0.5 leading-relaxed">{def.desc}</p>
      </div>
      <Toggle checked={checked} onChange={onToggle} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors shrink-0 mt-0.5',
        checked ? 'bg-success' : 'bg-[#4a4356]',
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
        checked ? 'left-[18px]' : 'left-0.5',
      )} />
    </button>
  );
}

/* ── Membros de um cargo ─────────────────────────────────────── */
function RoleMembers({ serverId, roleId, roleColor, notify }: {
  serverId: string; roleId: string; roleColor: string; notify: (m: string) => void;
}) {
  const [assigned, setAssigned] = useState<any[]>([]);
  const [all, setAll] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([
        api.get(`/servers/${serverId}/roles/${roleId}/members`),
        api.get(`/servers/${serverId}/members`),
      ]);
      setAssigned(a.data);
      setAll(m.data);
    } catch {
      notify('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  }, [serverId, roleId, notify]);

  useEffect(() => { load(); }, [load]);

  const assignedIds = new Set(assigned.map((a: any) => a.member.userId));
  const candidates = all.filter(m => !assignedIds.has(m.userId));

  const add = async (userId: string) => {
    try {
      await api.put(`/servers/${serverId}/roles/${roleId}/members/${userId}`);
      setAdding(false);
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  const remove = async (userId: string) => {
    try {
      await api.delete(`/servers/${serverId}/roles/${roleId}/members/${userId}`);
      load();
    } catch (e: any) {
      notify(e?.response?.data?.message || 'Sem permissão');
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>;

  return (
    <div className="space-y-3 max-w-xl">
      <button
        onClick={() => setAdding(v => !v)}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold text-white
                   bg-accent hover:bg-accent-hover active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" /> Adicionar membros
      </button>

      {adding && (
        <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
          {candidates.length === 0 && (
            <p className="text-[#92879f] text-sm text-center py-5">Todos os membros já têm este cargo.</p>
          )}
          {candidates.map(m => {
            const [c1, c2] = gradFor(m.userId);
            return (
              <button
                key={m.userId}
                onClick={() => add(m.userId)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
              >
                <span className="w-8 h-8 rounded-lg grid place-items-center font-black text-[10px] text-white shrink-0"
                  style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}>
                  {getInitials(m.user.profile?.displayName || m.user.username)}
                </span>
                <span className="text-white text-sm truncate">{m.user.profile?.displayName || m.user.username}</span>
                <Plus className="w-4 h-4 text-[#5c5468] ml-auto" />
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)] overflow-hidden">
        {assigned.length === 0 && (
          <p className="text-[#92879f] text-sm text-center py-6">Nenhum membro com este cargo ainda.</p>
        )}
        {assigned.map((a: any) => {
          const m = a.member;
          const [c1, c2] = gradFor(m.userId);
          const name = m.user?.profile?.displayName || m.user?.username || m.userId;
          return (
            <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 h-8 rounded-lg grid place-items-center font-black text-[10px] text-white shrink-0"
                style={{ background: `linear-gradient(145deg, ${c1}, ${c2})` }}>
                {getInitials(name)}
              </span>
              <span className="text-sm truncate font-medium" style={{ color: roleColor }}>{name}</span>
              <button
                onClick={() => remove(m.userId)}
                title="Remover cargo deste membro"
                className="ml-auto w-7 h-7 rounded-lg grid place-items-center text-[#92879f]
                           hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
