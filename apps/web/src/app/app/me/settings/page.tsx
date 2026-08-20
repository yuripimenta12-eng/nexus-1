'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Mic, Volume2, Video, Shield, Bell,
  LogOut, ChevronRight, Check, X, Camera,
  Upload, Eye, EyeOff, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth.store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════
   NEXUS LINK — Settings Page (Design System v2)
══════════════════════════════════════════════ */

type Tab = 'perfil' | 'audio' | 'video' | 'notificacoes' | 'privacidade';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'perfil',        label: 'Meu Perfil',      icon: <User       style={{ width: 15, height: 15 }} /> },
  { id: 'audio',         label: 'Voz & Áudio',     icon: <Mic        style={{ width: 15, height: 15 }} /> },
  { id: 'video',         label: 'Vídeo',            icon: <Video      style={{ width: 15, height: 15 }} /> },
  { id: 'notificacoes',  label: 'Notificações',     icon: <Bell       style={{ width: 15, height: 15 }} /> },
  { id: 'privacidade',   label: 'Privacidade',      icon: <Shield     style={{ width: 15, height: 15 }} /> },
];

/* ── Section wrapper ─────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <p style={{
        fontSize: 11, fontWeight: 800, color: '#4a4560',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        margin: '0 0 12px',
      }}>
        {title}
      </p>
      <div style={{
        background: '#131020',
        border: '1px solid #2a1f40',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── Setting row ─────────────────────────────── */
function SettingRow({
  label, sublabel, children, border = true,
}: { label: string; sublabel?: string; children: React.ReactNode; border?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px',
      borderBottom: border ? '1px solid #1e1630' : 'none',
      gap: 16,
    }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: '#ede8f8', fontSize: 14, fontWeight: 600, margin: 0 }}>{label}</p>
        {sublabel && <p style={{ color: '#7a748e', fontSize: 12, margin: '2px 0 0' }}>{sublabel}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/* ── Toggle switch ───────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? 'linear-gradient(135deg,#7c5af0,#b142f5)' : '#2a1f40',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
        boxShadow: on ? '0 0 12px rgba(124,90,240,0.35)' : 'none',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  );
}

/* ── Volume slider ───────────────────────────── */
function VolumeSlider({
  value, onChange, label,
}: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#b8b0cc', fontSize: 13 }}>{label}</span>
        <span style={{ color: '#7c5af0', fontSize: 13, fontWeight: 700 }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 4, borderRadius: 2,
          accentColor: '#7c5af0',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

/* ── Status selector ─────────────────────────── */
const STATUSES = [
  { value: 'ONLINE',  label: 'Online',    color: '#2dd67b' },
  { value: 'AWAY',    label: 'Ausente',   color: '#f59e0b' },
  { value: 'BUSY',    label: 'Ocupado',   color: '#ff4444' },
  { value: 'OFFLINE', label: 'Invisível', color: '#4a4560' },
];

/* ═══════════════════════════════════════════════
   TABS
══════════════════════════════════════════════ */

function TabPerfil() {
  const { user, setUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.profile?.displayName ?? '');
  const [bio,         setBio        ] = useState(user?.profile?.bio ?? '');
  const [status,      setStatus     ] = useState(user?.profile?.status ?? 'ONLINE');
  const [customStatus,setCustomStatus] = useState(user?.profile?.customStatus ?? '');
  const [saving,      setSaving     ] = useState(false);
  const [saved,       setSaved      ] = useState(false);
  const [showOldPw,   setShowOldPw  ] = useState(false);
  const [showNewPw,   setShowNewPw  ] = useState(false);
  const [oldPw,       setOldPw      ] = useState('');
  const [newPw,       setNewPw      ] = useState('');
  const [pwSaving,    setPwSaving   ] = useState(false);
  const [pwMsg,       setPwMsg      ] = useState('');

  const avatarUrl = user?.profile?.avatarUrl;
  const name      = displayName || user?.username || '?';

  const saveProfile = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/@me/profile', { displayName, bio, customStatus });
      // Also emit status via socket so other members see the change
      if (status !== (user?.profile?.status ?? 'ONLINE')) {
        const { useSocketStore } = await import('@/stores/socket.store');
        useSocketStore.getState().emit('user:status', { status });
      }
      setUser({ ...user!, profile: { ...(data.profile ?? data), status } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!oldPw || !newPw) return;
    setPwSaving(true); setPwMsg('');
    try {
      await api.patch('/auth/change-password', { oldPassword: oldPw, newPassword: newPw });
      setPwMsg('Senha alterada!');
      setOldPw(''); setNewPw('');
    } catch (e: any) {
      setPwMsg(e?.response?.data?.message ?? 'Erro ao alterar senha.');
    } finally { setPwSaving(false); }
  };

  return (
    <div>
      {/* Avatar */}
      <Section title="Foto de perfil">
        <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: avatarUrl ? 'transparent' : 'linear-gradient(135deg,#7c5af0,#b142f5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900, color: '#fff',
              overflow: 'hidden',
              border: '3px solid #2a1f40',
            }}>
              {avatarUrl
                ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : getInitials(name)
              }
            </div>
          </div>
          <div>
            <p style={{ color: '#ede8f8', fontWeight: 700, fontSize: 16, margin: '0 0 4px' }}>{name}</p>
            <p style={{ color: '#7a748e', fontSize: 13, margin: '0 0 10px' }}>@{user?.username}</p>
            <button style={{
              padding: '7px 14px', borderRadius: 8,
              background: 'rgba(124,90,240,0.12)',
              border: '1px solid rgba(124,90,240,0.3)',
              color: '#9b6dff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,90,240,0.22)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,90,240,0.12)'; }}
            >
              <Upload style={{ width: 13, height: 13 }} />
              Alterar foto
            </button>
          </div>
        </div>
      </Section>

      {/* Status */}
      <Section title="Status">
        <SettingRow label="Status de presença" sublabel="Como você aparece para outros membros">
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUSES.map(s => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value as any)}
                title={s.label}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: s.color,
                  border: status === s.value ? `3px solid #fff` : '3px solid transparent',
                  cursor: 'pointer',
                  boxShadow: status === s.value ? `0 0 10px ${s.color}` : 'none',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        </SettingRow>
        <SettingRow label="Status personalizado" sublabel="Texto exibido abaixo do seu nome" border={false}>
          <input
            value={customStatus}
            onChange={e => setCustomStatus(e.target.value)}
            placeholder="Ex: Codando 🚀"
            maxLength={128}
            style={{
              background: '#0d0a16', border: '1px solid #2a1f40', borderRadius: 8,
              color: '#ede8f8', fontSize: 13, padding: '7px 12px', width: 200, outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
          />
        </SettingRow>
      </Section>

      {/* Info */}
      <Section title="Informações pessoais">
        <SettingRow label="Nome de exibição">
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={64}
            style={{
              background: '#0d0a16', border: '1px solid #2a1f40', borderRadius: 8,
              color: '#ede8f8', fontSize: 13, padding: '7px 12px', width: 200, outline: 'none',
              transition: 'border-color 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
          />
        </SettingRow>
        <SettingRow label="Bio" sublabel="Até 256 caracteres" border={false}>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={256}
            rows={3}
            style={{
              background: '#0d0a16', border: '1px solid #2a1f40', borderRadius: 8,
              color: '#ede8f8', fontSize: 13, padding: '7px 12px', width: 200,
              outline: 'none', resize: 'none',
              transition: 'border-color 0.2s',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
            onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
          />
        </SettingRow>
      </Section>

      {/* Save button */}
      <button
        onClick={saveProfile}
        disabled={saving}
        style={{
          padding: '12px 32px', borderRadius: 10,
          background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
          border: 'none', color: '#fff', fontWeight: 800, fontSize: 14,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 16px rgba(124,90,240,0.3)',
          transition: 'opacity 0.15s, transform 0.15s',
          marginBottom: 24,
        }}
        onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; }}
      >
        {saving
          ? <><Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> Salvando…</>
          : saved
            ? <><Check style={{ width: 15, height: 15 }} /> Salvo!</>
            : 'Salvar alterações'
        }
      </button>

      {/* Change password */}
      <Section title="Segurança da conta">
        <SettingRow label="Senha atual">
          <div style={{ position: 'relative' }}>
            <input
              type={showOldPw ? 'text' : 'password'}
              value={oldPw}
              onChange={e => setOldPw(e.target.value)}
              placeholder="••••••••"
              style={{
                background: '#0d0a16', border: '1px solid #2a1f40', borderRadius: 8,
                color: '#ede8f8', fontSize: 13, padding: '7px 36px 7px 12px',
                width: 200, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
            />
            <button
              onClick={() => setShowOldPw(v => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7a748e' }}
            >
              {showOldPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
            </button>
          </div>
        </SettingRow>
        <SettingRow label="Nova senha" border={false}>
          <div style={{ position: 'relative' }}>
            <input
              type={showNewPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={{
                background: '#0d0a16', border: '1px solid #2a1f40', borderRadius: 8,
                color: '#ede8f8', fontSize: 13, padding: '7px 36px 7px 12px',
                width: 200, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#7c5af0'; }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#2a1f40'; }}
            />
            <button
              onClick={() => setShowNewPw(v => !v)}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#7a748e' }}
            >
              {showNewPw ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
            </button>
          </div>
        </SettingRow>
        {pwMsg && (
          <p style={{ padding: '8px 18px', fontSize: 12, color: pwMsg.includes('!') ? '#2dd67b' : '#ff6060', margin: 0 }}>
            {pwMsg}
          </p>
        )}
        <div style={{ padding: '12px 18px' }}>
          <button
            onClick={changePassword}
            disabled={!oldPw || !newPw || pwSaving}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: oldPw && newPw ? 'rgba(124,90,240,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(124,90,240,0.3)',
              color: oldPw && newPw ? '#9b6dff' : '#4a4560',
              fontSize: 13, fontWeight: 700, cursor: oldPw && newPw ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {pwSaving ? 'Salvando…' : 'Alterar senha'}
          </button>
        </div>
      </Section>
    </div>
  );
}

function TabAudio() {
  const [inputVol,  setInputVol ] = useState(80);
  const [outputVol, setOutputVol] = useState(100);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [noiseSuppression,  setNoiseSuppression ] = useState(true);
  const [autoGain,          setAutoGain         ] = useState(true);
  const [voiceDetect,       setVoiceDetect      ] = useState(true);

  return (
    <div>
      <Section title="Volumes">
        <div style={{ padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <VolumeSlider value={inputVol}  onChange={setInputVol}  label="Volume do microfone" />
          <VolumeSlider value={outputVol} onChange={setOutputVol} label="Volume dos fones" />
        </div>
      </Section>

      <Section title="Processamento de voz">
        <SettingRow label="Cancelamento de eco"   sublabel="Remove eco do alto-falante">
          <Toggle on={echoCancellation} onChange={setEchoCancellation} />
        </SettingRow>
        <SettingRow label="Supressão de ruído"    sublabel="Filtra sons de ambiente">
          <Toggle on={noiseSuppression} onChange={setNoiseSuppression} />
        </SettingRow>
        <SettingRow label="Ganho automático"      sublabel="Normaliza o nível do microfone">
          <Toggle on={autoGain} onChange={setAutoGain} />
        </SettingRow>
        <SettingRow label="Detecção de voz (VAD)" sublabel="Muta automaticamente quando há silêncio" border={false}>
          <Toggle on={voiceDetect} onChange={setVoiceDetect} />
        </SettingRow>
      </Section>
    </div>
  );
}

function TabVideo() {
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [frameRate,  setFrameRate ] = useState<30 | 60>(30);
  const [mirrorCam,  setMirrorCam ] = useState(false);

  const BtnGroup = ({ options, value, onChange }: {
    options: { label: string; value: any }[];
    value: any;
    onChange: (v: any) => void;
  }) => (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(o => (
        <button
          key={o.label}
          onClick={() => onChange(o.value)}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', border: 'none',
            background: value === o.value ? 'linear-gradient(135deg,#7c5af0,#b142f5)' : 'rgba(255,255,255,0.06)',
            color: value === o.value ? '#fff' : '#7a748e',
            transition: 'background 0.15s',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <Section title="Qualidade da câmera">
        <SettingRow label="Resolução" sublabel="Qualidade do vídeo enviado">
          <BtnGroup
            options={[{ label: '720p', value: '720p' }, { label: '1080p', value: '1080p' }]}
            value={resolution}
            onChange={setResolution}
          />
        </SettingRow>
        <SettingRow label="Taxa de quadros" border={false}>
          <BtnGroup
            options={[{ label: '30 fps', value: 30 }, { label: '60 fps', value: 60 }]}
            value={frameRate}
            onChange={setFrameRate}
          />
        </SettingRow>
      </Section>
      <Section title="Exibição">
        <SettingRow label="Espelhar minha câmera" sublabel="Apenas para você" border={false}>
          <Toggle on={mirrorCam} onChange={setMirrorCam} />
        </SettingRow>
      </Section>
    </div>
  );
}

function TabNotificacoes() {
  const [msgs,  setMsgs ] = useState(true);
  const [calls, setCalls] = useState(true);
  const [sound, setSound] = useState(true);

  return (
    <Section title="Notificações">
      <SettingRow label="Novas mensagens" sublabel="Notificar ao receber mensagens diretas">
        <Toggle on={msgs} onChange={setMsgs} />
      </SettingRow>
      <SettingRow label="Chamadas de voz" sublabel="Notificar quando alguém entrar em uma sala">
        <Toggle on={calls} onChange={setCalls} />
      </SettingRow>
      <SettingRow label="Sons do app" sublabel="Efeitos sonoros de UI" border={false}>
        <Toggle on={sound} onChange={setSound} />
      </SettingRow>
    </Section>
  );
}

function TabPrivacidade() {
  const router  = useRouter();
  const { logout } = useAuthStore();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace('/auth/login');
  };

  return (
    <div>
      <Section title="Sessão">
        <div style={{ padding: '16px 18px' }}>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: 'rgba(255,68,68,0.1)',
              border: '1px solid rgba(255,68,68,0.25)',
              color: '#ff6060', fontWeight: 700, fontSize: 14,
              cursor: loggingOut ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loggingOut) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,68,68,0.1)'; }}
          >
            <LogOut style={{ width: 15, height: 15 }} />
            {loggingOut ? 'Saindo…' : 'Sair da conta'}
          </button>
        </div>
      </Section>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main settings page
══════════════════════════════════════════════ */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');

  const CONTENT: Record<Tab, React.ReactNode> = {
    perfil:       <TabPerfil />,
    audio:        <TabAudio />,
    video:        <TabVideo />,
    notificacoes: <TabNotificacoes />,
    privacidade:  <TabPrivacidade />,
  };

  return (
    <div style={{
      flex: 1, display: 'flex', height: '100%', overflow: 'hidden',
      background: '#09070d',
    }}>
      {/* Sidebar de navegação */}
      <div style={{
        width: 220, flexShrink: 0, height: '100%',
        borderRight: '1px solid #1e1630',
        background: '#0b0816',
        display: 'flex', flexDirection: 'column',
        padding: '24px 10px',
        gap: 2,
        overflowY: 'auto',
      }}>
        <p style={{
          fontSize: 11, fontWeight: 800, color: '#4a4560',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          padding: '0 8px', marginBottom: 8, marginTop: 0,
        }}>
          Configurações
        </p>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', borderRadius: 9,
              border: 'none', cursor: 'pointer',
              background: activeTab === tab.id
                ? 'rgba(124,90,240,0.18)'
                : 'transparent',
              color: activeTab === tab.id ? '#ede8f8' : '#7a748e',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 13,
              transition: 'background 0.15s, color 0.15s',
              textAlign: 'left',
              position: 'relative',
            }}
            onMouseEnter={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (activeTab !== tab.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {/* Active indicator */}
            {activeTab === tab.id && (
              <span style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                width: 2.5, height: 18, borderRadius: '0 2px 2px 0',
                background: 'linear-gradient(180deg,#ff6a00,#7c5af0)',
              }} />
            )}
            <span style={{ color: activeTab === tab.id ? '#9b6dff' : '#7a748e', display: 'flex' }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '32px 40px',
        scrollbarWidth: 'thin', scrollbarColor: '#2a1f40 transparent',
      }}>
        <h2 style={{ color: '#ede8f8', fontWeight: 900, fontSize: 22, margin: '0 0 24px', letterSpacing: -0.5 }}>
          {TABS.find(t => t.id === activeTab)?.label}
        </h2>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {CONTENT[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
