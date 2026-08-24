'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  displayName: z.string().min(2, 'Mínimo 2 caracteres').max(50),
  username: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Apenas letras minúsculas, números e _'),
  email: z.string().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)/, 'Use maiúscula, minúscula e número'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  // Detecta se o usuário chegou por um link de convite (para mostrar o aviso)
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    setInvited(!!localStorage.getItem('nexus_pending_invite'));
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await registerUser(data as Required<FormData>);
      const pending = localStorage.getItem('nexus_pending_invite');
      if (pending) {
        localStorage.removeItem('nexus_pending_invite');
        router.push(`/invite/${pending}`);
      } else {
        router.push('/app');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar conta.');
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent-blue/5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Nexus</h1>
          <p className="text-muted mt-1">Crie sua conta</p>
        </div>

        {invited && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
            <MessageSquare className="w-5 h-5 text-accent shrink-0" />
            <p className="text-sm text-white">
              Você foi convidado! Crie sua conta para entrar no servidor —
              é rápido e grátis.
            </p>
          </div>
        )}

        <div className="bg-surface border border-border rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Cadastro</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Nome de exibição
                </label>
                <input {...register('displayName')} className="nexus-input" placeholder="Seu nome" />
                {errors.displayName && (
                  <p className="text-destructive text-xs mt-1">{errors.displayName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Nome de usuário
                </label>
                <input {...register('username')} className="nexus-input" placeholder="usuario_123" />
                {errors.username && (
                  <p className="text-destructive text-xs mt-1">{errors.username.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">E-mail</label>
              <input {...register('email')} type="email" className="nexus-input" placeholder="seu@email.com" />
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">Senha</label>
              <input {...register('password')} type="password" className="nexus-input" placeholder="••••••••" />
              {errors.password && (
                <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
              )}
              <p className="text-muted text-xs mt-1">Mínimo 8 caracteres com maiúscula, minúscula e número</p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading} className="btn-primary w-full flex items-center justify-center gap-2">
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-muted text-sm">
              Já tem conta?{' '}
              <Link href="/auth/login" className="text-accent hover:underline font-medium">
                Entrar
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
