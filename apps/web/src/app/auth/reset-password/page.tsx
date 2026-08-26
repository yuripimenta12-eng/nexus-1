'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import api from '@/lib/api';

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strongEnough = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!strongEnough) { setError('Mínimo 8 caracteres, com maiúscula, minúscula e número.'); return; }
    if (password !== confirm) { setError('As senhas não conferem.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setDone(true);
      setTimeout(() => router.push('/auth/login'), 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Token inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-2xl p-8">
          {!token ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 grid place-items-center mx-auto mb-4">
                <X className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-white text-xl font-bold">Link inválido</h1>
              <p className="text-muted text-sm mt-2">Este link está incompleto. Peça um novo.</p>
              <Link href="/auth/forgot-password" className="inline-block mt-5 text-accent hover:underline text-sm font-medium">
                Pedir novo link
              </Link>
            </div>
          ) : done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 grid place-items-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-success" />
              </div>
              <h1 className="text-white text-xl font-bold">Senha alterada!</h1>
              <p className="text-muted text-sm mt-2">Levando você para o login...</p>
            </div>
          ) : (
            <>
              <h1 className="text-white text-xl font-bold">Criar nova senha</h1>
              <p className="text-muted text-sm mt-1 mb-6">
                Mínimo de 8 caracteres, com maiúscula, minúscula e número.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nova senha"
                    className="nexus-input w-full pr-11"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShow(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="nexus-input w-full"
                />
                {error && <p className="text-destructive text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-extrabold
                             bg-gradient-to-r from-orange to-accent hover:opacity-95 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar nova senha
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
