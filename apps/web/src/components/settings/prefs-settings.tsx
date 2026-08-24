'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, BellRing, Loader2, ShieldOff, Volume2 } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { usePrefsStore, ACCENT_THEMES, AccentTheme } from '@/stores/prefs.store';
import { playPing, showDesktopNotification } from '@/lib/notify';
import api from '@/lib/api';

/* ── Aparência ─────────────────────────────────────────────────── */
export function AppearanceSettings() {
  const { accent, setAccent } = usePrefsStore();

  return (
    <div className="space-y-6">
      <section>
        <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">
          Tema de acento
        </p>
        <p className="text-[#92879f] text-sm mb-4">
          Muda as cores de destaque do Nexus inteiro — botões, gradientes e indicadores. Aplica na hora.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(Object.keys(ACCENT_THEMES) as AccentTheme[]).map((key) => {
            const t = ACCENT_THEMES[key];
            const active = accent === key;
            return (
              <button
                key={key}
                onClick={() => setAccent(key)}
                className={cn(
                  'relative rounded-2xl border p-4 text-left transition-all',
                  active
                    ? 'border-[#8b48ff] bg-[#1a1226] shadow-[0_0_24px_rgba(122,44,255,0.15)]'
                    : 'border-[#292039] bg-[#120d19] hover:border-[#4d3560]',
                )}
              >
                <span
                  className="block h-14 rounded-xl mb-3"
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                />
                <b className="text-sm text-white">{t.label}</b>
                {key === 'nexus' && <small className="block text-[10px] text-[#92879f]">Padrão</small>}
                {active && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white grid place-items-center">
                    <Check className="w-3 h-3 text-black" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ── Toggle reutilizável ───────────────────────────────────────── */
function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <b className="block text-sm text-[#cfc6dd]">{label}</b>
        <small className="block text-xs text-[#92879f] mt-0.5">{desc}</small>
      </div>
      <span className={cn(
        'relative w-11 h-6 rounded-full shrink-0 transition-all duration-200',
        checked ? 'bg-gradient-to-r from-orange to-accent' : 'bg-[#2a2138]',
      )}>
        <span className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200',
          checked ? 'left-[22px]' : 'left-0.5',
        )} />
      </span>
    </button>
  );
}

/* ── Notificações ──────────────────────────────────────────────── */
export function NotificationSettings() {
  const { notifDesktop, notifSound, setNotifDesktop, setNotifSound } = usePrefsStore();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const handleDesktopToggle = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') { setNotifDesktop(false); return; }
    }
    setNotifDesktop(on);
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">
          Mensagens novas
        </p>
        <div className="rounded-2xl border border-[#292039] bg-[#120d19] divide-y divide-[#231a30]">
          <ToggleRow
            label="Notificações na área de trabalho"
            desc="Mostra um aviso do sistema quando chega mensagem e a janela não está em foco"
            checked={notifDesktop}
            onChange={handleDesktopToggle}
          />
          <ToggleRow
            label="Som de nova mensagem"
            desc="Toca um toque curto quando chega mensagem com a janela fora de foco"
            checked={notifSound}
            onChange={setNotifSound}
          />
        </div>

        {permission === 'denied' && (
          <p className="text-destructive text-xs mt-2">
            O navegador bloqueou as notificações — libere no cadeado da barra de endereço.
          </p>
        )}

        <button
          onClick={() => {
            if (notifSound) playPing();
            if (notifDesktop) showDesktopNotification('Nexus', 'As notificações estão funcionando! 🟠🟣');
          }}
          className="mt-4 h-10 px-4 rounded-xl text-sm font-extrabold flex items-center gap-2 text-white
                     bg-gradient-to-r from-orange to-accent shadow-[0_5px_18px_rgba(255,90,0,0.25)]
                     active:scale-95 transition-all"
        >
          <BellRing className="w-4 h-4" /> Testar notificação
        </button>
      </section>
    </div>
  );
}

/* ── Privacidade & Segurança ───────────────────────────────────── */
interface BlockEntry {
  id: string;
  blockedId: string;
  blocked: {
    id: string;
    username: string;
    profile: { displayName: string; avatarUrl: string | null } | null;
  };
}

export function PrivacySettings() {
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get('/moderation/blocks')
      .then(({ data }) => setBlocks(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const unblock = async (b: BlockEntry) => {
    setBusy(b.blockedId);
    try {
      await api.delete(`/moderation/block/${b.blockedId}`);
      setBlocks(prev => prev.filter(x => x.blockedId !== b.blockedId));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">
          Usuários bloqueados
        </p>
        <p className="text-[#92879f] text-sm mb-4">
          Pessoas bloqueadas não podem te enviar mensagens diretas. Para bloquear alguém,
          use o menu do participante em uma chamada ou o perfil da pessoa.
        </p>

        <div className="rounded-2xl border border-[#292039] bg-[#120d19] divide-y divide-[#1d1626]">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-accent animate-spin" />
            </div>
          )}

          {!loading && blocks.length === 0 && (
            <div className="text-center py-8">
              <ShieldOff className="w-8 h-8 text-[#3d3450] mx-auto mb-2" />
              <p className="text-[#92879f] text-sm">Você não bloqueou ninguém.</p>
            </div>
          )}

          {blocks.map(b => (
            <div key={b.id} className="flex items-center gap-3 p-3.5">
              <div className="w-9 h-9 rounded-xl grid place-items-center font-black text-[11px] text-white shrink-0
                              bg-gradient-to-br from-[#766b85] to-[#312a3b]">
                {getInitials(b.blocked.profile?.displayName || b.blocked.username)}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block text-sm text-white truncate">
                  {b.blocked.profile?.displayName || b.blocked.username}
                </b>
                <small className="text-[#92879f] text-xs">@{b.blocked.username}</small>
              </div>
              <button
                onClick={() => unblock(b)}
                disabled={busy === b.blockedId}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-[#cfc6dd] bg-[#1d1626]
                           border border-[#312640] hover:border-accent hover:text-white transition-colors
                           disabled:opacity-50"
              >
                {busy === b.blockedId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desbloquear'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
