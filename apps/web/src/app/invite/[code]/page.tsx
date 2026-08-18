'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, Check, X, Loader2, MessageSquare } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { isAuthenticated, user } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'success' | 'error'>('loading');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Sem auth: redireciona para login com retorno
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/invite/${code}`);
      return;
    }
    setStatus('ready');
  }, [isAuthenticated, code, router]);

  const handleJoin = async () => {
    setStatus('joining');
    try {
      const { data } = await api.post(`/invites/${code}/use`);
      setServerInfo(data.server);
      setStatus('success');
      setTimeout(() => {
        router.push(`/app/servers/${data.server.id}`);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Convite inválido ou expirado.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-surface border border-border rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>

          {status === 'loading' && (
            <div>
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              <p className="text-muted mt-2">Verificando convite...</p>
            </div>
          )}

          {status === 'ready' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Você foi convidado!</h2>
              <p className="text-muted mb-6">Clique em aceitar para entrar no servidor.</p>
              <button onClick={handleJoin} className="btn-primary w-full">
                Aceitar convite
              </button>
            </div>
          )}

          {status === 'joining' && (
            <div>
              <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-2" />
              <p className="text-muted">Entrando no servidor...</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-success" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Bem-vindo!</h2>
              <p className="text-muted">Redirecionando para o servidor...</p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Ops!</h2>
              <p className="text-muted mb-4">{errorMsg}</p>
              <button onClick={() => router.push('/app')} className="btn-ghost w-full">
                Ir para o início
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
