'use client';

import { useState } from 'react';
import { Loader2, MailCheck, RefreshCw, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Conta nova sem e-mail confirmado: pede a confirmação antes de entrar no app
export function VerifyEmailGate({ email }: { email: string }) {
  const router = useRouter();
  const { refreshUser, logout } = useAuthStore();
  const [busy, setBusy] = useState<'resend' | 'check' | null>(null);
  const [msg, setMsg] = useState('');

  const resend = async () => {
    setBusy('resend'); setMsg('');
    try {
      const { data } = await api.post('/auth/resend-verification');
      setMsg(data?.message || 'Link reenviado.');
    } catch (e: any) {
      setMsg(e?.response?.status === 429 ? 'Você já pediu vários links. Espere uns minutos.' : 'Não foi possível reenviar agora.');
    } finally { setBusy(null); }
  };

  const check = async () => {
    setBusy('check'); setMsg('');
    await refreshUser().catch(() => {});
    setBusy(null);
    if (!useAuthStore.getState().user?.isVerified) setMsg('Ainda não confirmado. Abra o link que enviamos por e-mail.');
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-[#0a0713]">
      <div className="w-full max-w-lg rounded-2xl border border-[#392454] bg-[#14101a] p-8 shadow-2xl
                      flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mascote-notif.webp" alt="" className="h-40 w-auto"
             style={{ filter: 'drop-shadow(0 12px 30px rgba(122,44,255,0.45))', animation: 'nx-flutua 3s ease-in-out infinite' }} />
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[1.5px] text-[#ffb070] mb-2">
            <MailCheck className="w-4 h-4" /> Falta só um passo
          </div>
          <h1 className="text-white text-xl font-bold mb-1.5">Confirme seu e-mail</h1>
          <p className="text-[#afa4bb] text-sm leading-relaxed mb-5">
            Enviamos um link para <b className="text-white break-all">{email}</b>. Abra o e-mail e clique em
            “Confirmar meu e-mail”. Não achou? Olhe também no spam.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={check} disabled={!!busy}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] disabled:opacity-60 flex items-center justify-center gap-2">
              {busy === 'check' && <Loader2 className="w-4 h-4 animate-spin" />} Já confirmei
            </button>
            <button onClick={resend} disabled={!!busy}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#d9cfdf] border border-[#38294a] bg-[#171020] hover:border-[#7a2cff] disabled:opacity-60 flex items-center justify-center gap-2">
              {busy === 'resend' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reenviar link
            </button>
          </div>
          {msg && <p className="text-xs text-[#cfc6dd] mt-3">{msg}</p>}
          <button onClick={async () => { await logout().catch(() => {}); router.replace('/auth/login'); }}
            className="mt-4 text-xs text-[#8a7f98] hover:text-white inline-flex items-center gap-1.5">
            <LogOut className="w-3.5 h-3.5" /> Sair e usar outra conta
          </button>
        </div>
      </div>
    </div>
  );
}
