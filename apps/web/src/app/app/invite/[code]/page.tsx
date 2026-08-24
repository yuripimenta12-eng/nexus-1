'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Hash } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const { code } = params;
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthenticated'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [serverName, setServerName] = useState('');

  useEffect(() => {
    // Espera o estado persistido carregar antes de decidir
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      // Guarda o convite para retomar depois do login/cadastro
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexus_pending_invite', code);
      }
      setStatus('unauthenticated');
      return;
    }

    if (!code) return;

    // POST /invites/:code/use
    api.post(`/invites/${code}/use`)
      .then(({ data }) => {
        // Backend returns the invite record which may have a nested server
        const name = data?.server?.name ?? data?.invite?.server?.name ?? '';
        const serverId = data?.server?.id ?? data?.invite?.server?.id ?? data?.serverId ?? '';
        setServerName(name);
        setStatus('success');
        // Redirect to server after short delay
        setTimeout(() => {
          if (serverId) {
            router.replace(`/app/servers/${serverId}`);
          } else {
            router.replace('/app');
          }
        }, 1500);
      })
      .catch((err) => {
        const msg = err?.response?.data?.message ?? 'Convite inválido ou expirado.';
        setErrorMsg(msg);
        setStatus('error');
      });
  }, [code, isAuthenticated, hasHydrated]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(124,90,240,0.08) 0%, transparent 60%), #09070d',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: '#131020',
        border: '1px solid #2a1f40',
        borderRadius: 20,
        padding: 40,
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          boxShadow: '0 8px 24px rgba(124,90,240,0.35)',
        }}>
          <Hash style={{ width: 32, height: 32, color: '#fff' }} />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 style={{ width: 36, height: 36, color: '#7c5af0', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <h2 style={{ color: '#ede8f8', fontWeight: 800, fontSize: 20, margin: '0 0 8px' }}>
              Entrando no servidor…
            </h2>
            <p style={{ color: '#7a748e', fontSize: 14, margin: 0 }}>
              Verificando convite
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle style={{ width: 36, height: 36, color: '#2dd67b', marginBottom: 16 }} />
            <h2 style={{ color: '#ede8f8', fontWeight: 800, fontSize: 20, margin: '0 0 8px' }}>
              Você entrou!
            </h2>
            <p style={{ color: '#7a748e', fontSize: 14, margin: 0 }}>
              {serverName ? `Bem-vindo a ${serverName}` : 'Redirecionando…'}
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle style={{ width: 36, height: 36, color: '#ff6060', marginBottom: 16 }} />
            <h2 style={{ color: '#ede8f8', fontWeight: 800, fontSize: 20, margin: '0 0 8px' }}>
              Convite inválido
            </h2>
            <p style={{ color: '#7a748e', fontSize: 14, margin: '0 0 24px' }}>
              {errorMsg}
            </p>
            <button
              onClick={() => router.replace('/app')}
              style={{
                padding: '10px 24px', borderRadius: 10,
                background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
                border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Ir para o início
            </button>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <h2 style={{ color: '#ede8f8', fontWeight: 800, fontSize: 20, margin: '0 0 8px' }}>
              Entre para continuar
            </h2>
            <p style={{ color: '#7a748e', fontSize: 14, margin: '0 0 24px' }}>
              Você precisa estar logado para usar este convite.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => router.push('/auth/login')}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#7c5af0,#b142f5)',
                  border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Entrar
              </button>
              <button
                onClick={() => router.push('/auth/register')}
                style={{
                  padding: '10px 20px', borderRadius: 10,
                  background: 'rgba(124,90,240,0.12)',
                  border: '1px solid rgba(124,90,240,0.3)',
                  color: '#9b6dff', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Criar conta
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
