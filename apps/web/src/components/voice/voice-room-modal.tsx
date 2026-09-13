'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Volume2, Lock, Users, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Role { id: string; name: string; color: string; isDefault: boolean; }
export interface VoiceRoomData { id: string; name: string; allowedRoleIds?: string[]; }

// Modal de criar/editar sala de voz: nome + quem pode entrar.
// "Todos" = sala aberta; "Somente cargos" = só quem tem um dos cargos marcados
// (dono e admins sempre entram). Quem não pode entrar nem vê a sala na lista.
export function VoiceRoomModal({
  serverId, room, onClose, onSaved, onDeleted,
}: {
  serverId: string;
  room?: VoiceRoomData | null;            // ausente = criar
  onClose: () => void;
  onSaved: (room: VoiceRoomData, created: boolean) => void;
  onDeleted?: (roomId: string) => void;
}) {
  const editing = !!room;
  const [name, setName] = useState(room?.name ?? '');
  const [restricted, setRestricted] = useState((room?.allowedRoleIds?.length ?? 0) > 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(room?.allowedRoleIds ?? []));
  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/servers/${serverId}/roles`)
      .then(({ data }) => setRoles((data as Role[]).filter(r => !r.isDefault)))
      .catch(() => setRoles([]))
      .finally(() => setLoadingRoles(false));
  }, [serverId]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) return;
    if (restricted && selected.size === 0) {
      setError('Marque pelo menos um cargo ou escolha "Todos".');
      return;
    }
    setSaving(true);
    setError(null);
    const allowedRoleIds = restricted ? [...selected] : [];
    try {
      if (editing && room) {
        const { data } = await api.patch(`/voice/rooms/${room.id}`, { name: name.trim(), allowedRoleIds });
        onSaved(data, false);
      } else {
        const { data } = await api.post(`/voice/servers/${serverId}/rooms`, { name: name.trim(), allowedRoleIds });
        onSaved(data, true);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível salvar. Verifique sua permissão.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!room) return;
    setSaving(true);
    try {
      await api.delete(`/voice/rooms/${room.id}`);
      onDeleted?.(room.id);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Não foi possível apagar a sala.');
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 w-[260px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">{editing ? 'Editar sala de voz' : 'Criar sala de voz'}</h3>
          <button onClick={onClose} className="text-muted hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="Nome da sala"
          maxLength={64}
          className="w-full bg-surface-raised border border-border rounded-lg px-3 py-2
                     text-white text-sm placeholder:text-muted focus:border-accent outline-none mb-3"
        />

        <div className="text-[10px] uppercase tracking-wider font-black text-muted mb-1.5">Quem pode entrar</div>
        <div className="space-y-1 mb-2">
          <AccessOption
            active={!restricted}
            onClick={() => setRestricted(false)}
            icon={<Users className="w-3.5 h-3.5" />}
            label="Todos do servidor"
          />
          <AccessOption
            active={restricted}
            onClick={() => setRestricted(true)}
            icon={<Lock className="w-3.5 h-3.5" />}
            label="Somente cargos escolhidos"
          />
        </div>

        {restricted && (
          <div className="mb-3 rounded-lg border border-border bg-surface-raised p-2 max-h-40 overflow-y-auto">
            {loadingRoles ? (
              <div className="flex items-center gap-2 text-muted text-xs py-1"><Loader2 className="w-3 h-3 animate-spin" /> Carregando cargos...</div>
            ) : roles.length === 0 ? (
              <div className="text-muted text-[11px] leading-snug">
                Este servidor ainda não tem cargos. Crie em <b className="text-white">Config. do servidor → Cargos</b>.
              </div>
            ) : (
              roles.map(r => (
                <label key={r.id} className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-white/5">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="accent-[#7a2cff]" />
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="text-xs text-white truncate">{r.name}</span>
                </label>
              ))
            )}
            <div className="text-[10px] text-muted mt-1.5 leading-snug">
              Dono e admins sempre entram. Quem não tem o cargo não vê a sala nem quem está nela.
            </div>
          </div>
        )}

        {error && <div className="text-red-300 text-[11px] mb-2">{error}</div>}

        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="w-full py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                     transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (restricted ? <Lock className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />)}
          {editing ? 'Salvar' : 'Criar sala'}
        </button>

        {editing && onDeleted && (
          confirmDelete ? (
            <div className="mt-2 flex gap-2">
              <button onClick={remove} disabled={saving}
                className="flex-1 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium hover:bg-red-500/30">
                Apagar mesmo
              </button>
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 rounded-lg border border-border text-muted text-xs hover:text-white">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full mt-2 py-1.5 rounded-lg text-red-300/80 hover:text-red-200 text-xs flex items-center justify-center gap-1.5">
              <Trash2 className="w-3 h-3" /> Apagar sala
            </button>
          )
        )}
      </div>
    </div>
  );
}

function AccessOption({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs text-left transition-colors',
        active ? 'border-accent bg-accent/15 text-white' : 'border-border text-muted hover:text-white hover:border-[#7842a0]',
      )}
    >
      {icon}<span>{label}</span>
    </button>
  );
}
