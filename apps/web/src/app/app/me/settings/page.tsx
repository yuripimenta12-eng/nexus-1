'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { User, Bell, Shield, Palette, Mic, LogOut, Check, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { VoiceVideoSettings } from '@/components/settings/voice-video-settings';
import { AppearanceSettings, NotificationSettings, PrivacySettings } from '@/components/settings/prefs-settings';
import { ProfileCard } from '@/components/settings/profile-card';

const sections = [
  { id: 'profile', label: 'Minha Conta', icon: User },
  { id: 'voice', label: 'Voz e vídeo', icon: Mic },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'privacy', label: 'Privacidade & Segurança', icon: Shield },
  { id: 'appearance', label: 'Aparência', icon: Palette },
];

// Mascote decorativo de cada seção (aparece à direita em telas largas)
const SECTION_MASCOTS: Record<string, string> = {
  profile: '/mascote-conta.webp',
  voice: '/mascote-voz.webp',
  notifications: '/mascote-notif.webp',
  privacy: '/mascote-priv.webp',
  appearance: '/mascote-aparencia.webp',
};

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

  // Abre direto numa seção via ?section=voice (usado pelo popover da chamada)
  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get('section');
    if (section && sections.some(s => s.id === section)) setActiveSection(section);
  }, []);

  // Fechar: volta para onde estava (ESC ou botão X)
  const handleClose = () => {
    if (window.history.length > 1) router.back();
    else router.push('/app');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="flex h-full nx-page-bg">
      {/* Sidebar de configurações */}
      <div className="w-60 bg-[var(--th-side)] border-r border-[var(--th-line)] flex flex-col p-3 gap-1 shrink-0">
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

      {/* Mascote da seção, com luzes pulsando atrás */}
      <div
        className="hidden xl:block fixed right-[3vw] bottom-0 z-0 pointer-events-none"
        aria-hidden
      >
        <div
          className="nx-blob"
          style={{ width: 380, height: 380, left: '50%', top: '48%', transform: 'translate(-50%,-50%)', background: 'rgba(122,44,255,0.4)' }}
        />
        <div
          className="nx-blob"
          style={{ width: 260, height: 260, left: '30%', top: '72%', transform: 'translate(-50%,-50%)', background: 'rgba(255,106,0,0.28)', animationDelay: '2.4s' }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeSection}
          src={SECTION_MASCOTS[activeSection]}
          alt=""
          draggable={false}
          className="relative select-none animate-in fade-in zoom-in-95 duration-300"
          style={{
            maxHeight: 'min(58vh, 540px)',
            maxWidth: 'min(30vw, 560px)',
            width: 'auto',
            height: 'auto',
            filter: 'drop-shadow(0 18px 44px rgba(122,44,255,0.45)) drop-shadow(0 6px 18px rgba(255,106,0,0.22))',
          }}
        />
      </div>

      {/* Botão fechar (X · ESC) */}
      <div className="fixed top-5 right-5 z-40 flex flex-col items-center gap-1">
        <button
          onClick={handleClose}
          title="Fechar configurações (Esc)"
          className="w-10 h-10 rounded-full border-2 border-[#4d3560] text-[#a99cb8]
                     hover:border-accent hover:text-white flex items-center justify-center
                     transition-colors active:scale-95 bg-[var(--th-panel)]"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-[9px] font-extrabold text-[#5c5468] tracking-wider">ESC</span>
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
            <div>
              <h2 className="text-xl font-semibold text-white">Minha Conta</h2>
              <p className="text-[#92879f] text-sm mt-1">
                Assim é como as outras pessoas veem seu perfil no Nexus.
              </p>
            </div>

            {/* Prévia do perfil (banner + avatar), editável */}
            <ProfileCard />

            {/* Campos editáveis */}
            <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Informações da conta</h3>
              <div className="space-y-4">
                <EditableField
                  label="Nome de Exibição"
                  value={user?.profile?.displayName || ''}
                  onSave={saveDisplayName}
                />
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">Nome de Usuário</label>
                  <div className="flex items-center justify-between mt-1 bg-[var(--th-panel-2)] rounded px-3 py-2">
                    <span className="text-white text-sm">@{user?.username}</span>
                    <span className="text-muted text-xs">Não editável</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">E-mail</label>
                  <div className="flex items-center justify-between mt-1 bg-[var(--th-panel-2)] rounded px-3 py-2">
                    <span className="text-white text-sm">{user?.email}</span>
                    <span className="text-muted text-xs">Não editável</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Perfil adicional */}
            <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Sobre você</h3>
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

        {activeSection === 'appearance' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Aparência</h2>
            <AppearanceSettings />
          </div>
        )}

        {activeSection === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Notificações</h2>
            <NotificationSettings />
          </div>
        )}

        {activeSection === 'privacy' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Privacidade & Segurança</h2>
            <PrivacySettings />
          </div>
        )}
      </div>
    </div>
  );
}
