'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Zona de perigo: excluir a própria conta (LGPD)
export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ownedServers, setOwnedServers] = useState<{ id: string; name: string }[]>([]);

  const close = () => { setOpen(false); setPassword(''); setConfirm(''); setError(''); setOwnedServers([]); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return setError('Digite sua senha');
    if (confirm.trim().toUpperCase() !== 'EXCLUIR') return setError('Digite EXCLUIR para confirmar');
    setBusy(true);
    try {
      await api.post('/users/@me/delete', { password, confirm });
      // Sessão já foi apagada no servidor: limpa o aparelho e volta ao login
      await useAuthStore.getState().logout().catch(() => {});
      router.replace('/auth/login?conta=excluida');
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = data?.message;
      setOwnedServers(Array.isArray(data?.servers) ? data.servers : []);
      setError(Array.isArray(msg) ? msg[0] : msg || 'Não foi possível excluir a conta agora');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#ed4245]/35 bg-[#ed4245]/[0.06] p-6 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#ff8a8f] uppercase tracking-wider">Zona de perigo</h3>
          <p className="text-[#c9a9ad] text-xs mt-1 leading-relaxed">
            Excluir a conta apaga para sempre suas mensagens, mensagens diretas, arquivos, amizades e o seu perfil.
            Não dá para desfazer.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 px-4 py-2 rounded-lg border border-[#ed4245]/60 text-[#ff8a8f] hover:bg-[#ed4245] hover:text-white text-sm font-medium transition-colors"
        >
          Excluir minha conta
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={close}>
          <form
            onSubmit={submit}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-[#ed4245]/40 bg-[var(--th-panel)] p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <button type="button" onClick={close} aria-label="Fechar"
              className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center text-muted hover:text-white hover:bg-white/5">
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#ed4245]/15 grid place-items-center">
                <AlertTriangle className="w-5 h-5 text-[#ff6b72]" />
              </span>
              <h3 className="text-white font-bold text-lg">Excluir sua conta?</h3>
            </div>
            <ul className="text-[13px] text-[#cfc6dd] space-y-1.5 list-disc pl-5">
              <li>Suas mensagens nos servidores e suas mensagens diretas serão apagadas.</li>
              <li>Seus arquivos, foto e banner saem do Nexus.</li>
              <li>Você sai de todos os servidores e perde as amizades.</li>
              <li>Se você for dono de um servidor, passe a posse antes (Configurações do servidor → Membros).</li>
            </ul>
            <div>
              <label className="text-xs text-muted uppercase tracking-wider">Sua senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                className="mt-1 w-full bg-surface-raised rounded px-3 py-2 text-white text-sm border border-border focus:border-[#ed4245] outline-none" />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wider">Digite EXCLUIR para confirmar</label>
              <input value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off"
                className="mt-1 w-full bg-surface-raised rounded px-3 py-2 text-white text-sm border border-border focus:border-[#ed4245] outline-none uppercase" />
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            {ownedServers.length > 0 && (
              <ul className="text-xs text-[#ffb070] space-y-1">
                {ownedServers.map(s => (
                  <li key={s.id}>
                    <button type="button" className="underline hover:text-white"
                      onClick={() => router.push(`/app/servers/${s.id}/settings`)}>
                      {s.name} — abrir configurações
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={close}
                className="px-4 py-2 rounded-lg bg-surface-raised hover:bg-surface-overlay text-muted hover:text-white text-sm transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={busy}
                className="px-4 py-2 rounded-lg bg-[#ed4245] hover:bg-[#d83c3e] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir para sempre
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
