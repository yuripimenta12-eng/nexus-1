'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

// Página aberta pelo link do e-mail de confirmação
function VerifyEmailInner() {
  const router = useRouter();
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // o link vale uma vez: não reenvia no StrictMode
    ran.current = true;
    if (!token) { setState('error'); setMessage('Link incompleto. Abra o link do e-mail de novo.'); return; }
    api.post('/auth/verify-email', { token })
      .then(async () => {
        setState('ok');
        const { isAuthenticated, refreshUser } = useAuthStore.getState();
        if (isAuthenticated) {
          await refreshUser().catch(() => {});
          setTimeout(() => router.replace('/app'), 1500);
        }
      })
      .catch((e: any) => {
        setState('error');
        const msg = e?.response?.data?.message;
        setMessage(Array.isArray(msg) ? msg[0] : msg || 'Não foi possível confirmar agora.');
      });
  }, [token, router]);

  const logged = useAuthStore(s => s.isAuthenticated);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#0a0713]">
      <div className="w-full max-w-md rounded-2xl border border-[#392454] bg-[#14101a] p-8 text-center shadow-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nexus-app-icon.webp" alt="" className="w-16 h-16 mx-auto mb-5" />
        {state === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-[#c9a6ff] animate-spin mx-auto mb-3" />
            <h1 className="text-white text-xl font-bold">Confirmando seu e-mail…</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-[#42e6a4] mx-auto mb-3" />
            <h1 className="text-white text-xl font-bold mb-1">E-mail confirmado!</h1>
            <p className="text-[#afa4bb] text-sm mb-6">
              {logged ? 'Levando você para o Nexus…' : 'Agora é só entrar na sua conta.'}
            </p>
            {!logged && (
              <Link href="/auth/login?email=confirmado"
                className="inline-block px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]">
                Entrar no Nexus
              </Link>
            )}
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-[#ff6b72] mx-auto mb-3" />
            <h1 className="text-white text-xl font-bold mb-1">Não deu para confirmar</h1>
            <p className="text-[#afa4bb] text-sm mb-6">{message}</p>
            <Link href={logged ? '/app' : '/auth/login'}
              className="inline-block px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]">
              {logged ? 'Voltar ao Nexus' : 'Ir para o login'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailInner />
    </Suspense>
  );
}
