'use client';
import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { User, Bell, Shield, Palette, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

const sections = [
  { id: 'profile', label: 'Minha Conta', icon: User },
  { id: 'notifications', label: 'Notificações', icon: Bell },
  { id: 'privacy', label: 'Privacidade & Segurança', icon: Shield },
  { id: 'appearance', label: 'Aparência', icon: Palette },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('profile');
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <div className="flex h-full bg-background">
      <div className="w-60 bg-surface border-r border-border flex flex-col p-3 gap-1">
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
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        {activeSection === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Minha Conta</h2>
            <div className="bg-surface rounded-lg p-6 border border-border space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-2xl font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-white font-semibold">{user?.username || 'Usuário'}</p>
                  <p className="text-muted text-sm">{user?.email || ''}</p>
                </div>
              </div>
            </div>
            <div className="bg-surface rounded-lg p-6 border border-border space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Informações da Conta</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">Nome de Usuário</label>
                  <div className="flex items-center justify-between mt-1 bg-surface-raised rounded px-3 py-2">
                    <span className="text-white text-sm">{user?.username}</span>
                    <button className="text-accent text-xs hover:underline">Editar</button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted uppercase tracking-wider">E-mail</label>
                  <div className="flex items-center justify-between mt-1 bg-surface-raised rounded px-3 py-2">
                    <span className="text-white text-sm">{user?.email}</span>
                    <button className="text-accent text-xs hover:underline">Editar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeSection !== 'profile' && (
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
