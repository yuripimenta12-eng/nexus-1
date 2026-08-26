'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, MailCheck, KeyRound } from 'lucide-react';
import api from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-surface border border-border rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 grid place-items-center mx-auto mb-4">
                <MailCheck className="w-7 h-7 text-success" />
              </div>
              <h1 className="text-white text-xl font-bold">Verifique seu e-mail</h1>
              <p className="text-muted text-sm mt-2">
                Se <b className="text-white">{email}</b> estiver cadastrado, você vai receber um link
                para redefinir a senha. Vale por 1 hora — olhe também o spam.
              </p>
              <Link href="/auth/login" className="inline-block mt-6 text-accent hover:underline text-sm font-medium">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-accent/15 grid place-items-center mb-4">
                <KeyRound className="w-7 h-7 text-accent" />
              </div>
              <h1 className="text-white text-xl font-bold">Esqueceu a senha?</h1>
              <p className="text-muted text-sm mt-1 mb-6">
                Digite seu e-mail e enviaremos um link para criar uma senha nova.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="nexus-input w-full"
                  autoFocus
                />
                {error && <p className="text-destructive text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-extrabold
                             bg-gradient-to-r from-orange to-accent hover:opacity-95 disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enviar link de recuperação
                </button>
              </form>
              <p className="text-center mt-5">
                <Link href="/auth/login" className="text-muted hover:text-white text-sm">Voltar para o login</Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
