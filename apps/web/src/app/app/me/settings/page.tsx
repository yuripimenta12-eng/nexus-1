'use client';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { User, Bell, Shield, Palette, Mic, LogOut, Check, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { VoiceVideoSettings } from '@/components/settings/voice-video-settings';

const sections = [
  { id: 'profile', label: 'Minha Conta', icon: User },
  { id: 'voice', label: 'Voz e vídeo', icon: Mic },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'privacy', label: 'Privacidade & Segurança', icon: Shield },
  { id: 'appearance', label: 'Aparência', icon: Palette },
];

function EditableField({
  label, value, onSave,
}: { label: string; value: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (val === value) { setEditing(false); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(val);
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setVal(value);
    setEditing(false);
    setError('');
  };

  return (
    <div>
      <label className="text-xs text-muted uppercase tracking-wider">{label}</label>
      {editing ? (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              className="flex-1 bg-surface-raised rounded px-3 py-2 text-white text-sm
                         border border-border focus:border-accent outline-none transition-colors"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-lg bg-surface-raised hover:bg-surface-overlay text-muted hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-1 bg-surface-raised rounded px-3 py-2">
          <span className="text-white text-sm">{value || '—'}</span>
          <button
            onClick={() => setEditing(true)}
            className="text-accent text-xs hover:underline"
          >
            Editar
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const [saveSuccess, setSaveSuccess] = useState('');

  const handleLogout = async () => {
    const { logout } = useAuthStore.getState();
    await logout();
    router.push('/auth/login');
  };

  const showSuccess = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => setSaveSuccess(''), 3000);
  };

  const saveDisplayName = async (displayName: string) => {
    await api.patch('/users/@me/profile', { displayName });
    setUser({ ...user!, profile: { ...user!.profile!, displayName } });
    showSuccess('Nome de exibição atualizado!');
  };

  const saveBio = async (bio: string) => {
    await api.patch('/users/@me/profile', { bio });
    setUser({ ...user!, profile: { ...user!.profile!, bio } });
    showSuccess('Bio atualizada!');
  };

  const saveCustomStatus = async (customStatus: string) => {
    await api.patch('/users/@me/profile', { customStatus });
    setUser({ ...user!, profile: { ...user!.profile!, customStatus } });
    showSuccess('Status personalizado atualizado!');
  };

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar de configurações */}
      <div className="w-60 bg-surface border-r border-border flex flex-col p-3 gap-1 shrink-0">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider px-2 py-1 mt-2">
          Configurações de Usuário
        </p>
        {sections.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveSection(id)}
            className={`sidebar-item ${activeSection === id ? 'active' : ''}`}>
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
        <div className="mt-auto pt-3 border-t border-border">
          <button onClick={handleLogout}
            className="sidebar-item w-full text-destructive hover:text-red-400 hover:bg-red-500/10">
            <LogOut size={16} /><span>Sair</span>
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl relative">
        {/* Toast de sucesso */}
        {saveSuccess && (
          <div className="fixed top-4 right-4 bg-success/90 text-white px-4 py-2 rounded-lg
                          shadow-lg flex items-center gap-2 text-sm z-50 animate-in fade-in slide-in-from-top-2">
            <Check className="w-4 h-4" />
            {saveSuccess}
          </div>
        )}

        {activeSection === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Minha Conta</h2>

            {/* Avatar + info */}
            <div className="bg-surface rounded-lg p-6 border border-border space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl font-bold text-white">
                    {user?.profile?.displayName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>
                <div>
                  <p className="text-white font-semibold">{user?.profile?.displayName || user?.username || 'Usuário'}</p>
                  <p className="text-muted text-sm">@{user?.username}</p>
                  <p className="text-muted text-xs">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Campos editáveis */}
            <div className="bg-surface rounded-lg p-6 border border-border space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Informações da Conta</h3>
              <div className="space-y-4">
                <EditableField
                  label="Nome de Exibição"
                  value={user?.profile?.displayName || ''}
                  onSave={saveDisplayName}
                />
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">Nome de Usuário</label>
                  <div className="flex items-center justify-between mt-1 bg-surface-raised rounded px-3 py-2">
                    <span className="text-white text-sm">@{user?.username}</span>
                    <span className="text-muted text-xs">Não editável</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">E-mail</label>
                  <div className="flex items-center justify-between mt-1 bg-surface-raised rounded px-3 py-2">
                    <span className="text-white text-sm">{user?.email}</span>
                    <span className="text-muted text-xs">Não editável</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Perfil adicional */}
            <div className="bg-surface rounded-lg p-6 border border-border space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Perfil</h3>
              <div className="space-y-4">
                <EditableField
                  label="Bio"
                  value={user?.profile?.bio || ''}
                  onSave={saveBio}
                />
                <EditableField
                  label="Status personalizado"
                  value={user?.profile?.customStatus || ''}
                  onSave={saveCustomStatus}
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'voice' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Voz e vídeo</h2>
              <p className="text-[#92879f] text-sm mt-1">
                Dispositivos, volumes e processamento usados nas chamadas. As mudanças valem na hora, até em chamada ativa.
              </p>
            </div>
            <VoiceVideoSettings />
          </div>
        )}

        {activeSection !== 'profile' && activeSection !== 'voice' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">
              {sections.find(s => s.id === activeSection)?.label}
            </h2>
            <div className="bg-surface rounded-lg p-6 border border-border">
              <p className="text-muted text-sm">Em breve.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
