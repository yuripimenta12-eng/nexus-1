'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Loader2, MessageSquare, User, AtSign, Mail, Lock, Eye, EyeOff } from 'lucide-react';
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
  confirmPassword: z.string(),
  terms: z.literal(true, { errorMap: () => ({ message: 'Você precisa aceitar os termos' }) }),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const FIELD_STYLE = 'w-full rounded-xl border border-[#332441] bg-[#0d0913] text-white text-sm ' +
  'py-3 pl-10 pr-4 outline-none placeholder:text-[#5c5468] focus:border-accent transition-colors';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  // Detecta se o usuário chegou por um link de convite (para mostrar o aviso)
  const [invited, setInvited] = useState(false);
  useEffect(() => {
    setInvited(!!localStorage.getItem('nexus_pending_invite'));
  }, []);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Barra de força da senha (4 regras = 4 segmentos)
  const senha = watch('password') || '';
  const forca = useMemo(() => [
    senha.length >= 8,
    /[A-Z]/.test(senha),
    /[a-z]/.test(senha),
    /\d/.test(senha),
  ].filter(Boolean).length, [senha]);

  async function onSubmit(data: FormData) {
    setError('');
    try {
      const { confirmPassword, terms, ...payload } = data as any;
      await registerUser(payload);
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
    <div
      className="min-h-screen flex items-center justify-center p-4 py-8"
      style={{ background: "url('/cadastro-bg.webp') center/cover no-repeat #0a0713" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[520px]"
      >
        {/* Personagem com o logo, acima do cadastro */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote-logo.webp"
            alt="Nexus Link"
            draggable={false}
            className="mx-auto select-none"
            style={{
              height: 230,
              width: 'auto',
              filter: 'drop-shadow(0 10px 30px rgba(122,44,255,0.45))',
            }}
          />
          <p className="mt-3 text-[11px] font-black uppercase tracking-[3px] text-orange">
            Bem-vindo à Nexus Link
          </p>
          <h1 className="text-white text-3xl font-black mt-1">Crie sua conta</h1>
          <p className="text-[#b3a8bf] text-sm mt-1">Conecte-se. Converse. Compartilhe.</p>
        </div>

        {invited && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3">
            <MessageSquare className="w-5 h-5 text-accent shrink-0" />
            <p className="text-sm text-white">
              Você foi convidado! Crie sua conta para entrar no servidor — é rápido e grátis.
            </p>
          </div>
        )}

        {/* Card do cadastro */}
        <div
          className="mt-5 rounded-3xl p-7"
          style={{
            border: '1px solid #7a2cff55',
            background: 'linear-gradient(160deg, rgba(30,19,44,0.85), rgba(14,9,22,0.92))',
            boxShadow: '0 30px 80px rgba(0,0,0,0.55), 0 0 46px rgba(122,44,255,0.14)',
            backdropFilter: 'blur(14px)',
          }}
        >
          <h2 className="text-white font-bold text-lg mb-5">Cadastro</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1.5">
                  Nome de exibição
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8a7f98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input {...register('displayName')} className={FIELD_STYLE} placeholder="Seu nome" />
                </div>
                {errors.displayName && <p className="text-destructive text-xs mt-1">{errors.displayName.message}</p>}
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1.5">
                  Nexus ID
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-[#8a7f98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input {...register('username')} className={FIELD_STYLE} placeholder="@seuusuario" />
                </div>
                {errors.username && <p className="text-destructive text-xs mt-1">{errors.username.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8a7f98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input {...register('email')} type="email" className={FIELD_STYLE} placeholder="voce@email.com" />
              </div>
              {errors.email && <p className="text-destructive text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8a7f98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input {...register('password')} type={showPass ? 'text' : 'password'}
                  className={FIELD_STYLE + ' pr-11'} placeholder="••••••••••" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a7f98] hover:text-white">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mb-1.5">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8a7f98] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input {...register('confirmPassword')} type={showPass2 ? 'text' : 'password'}
                  className={FIELD_STYLE + ' pr-11'} placeholder="••••••••••" />
                <button type="button" onClick={() => setShowPass2(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a7f98] hover:text-white">
                  {showPass2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            {/* Força da senha */}
            <div>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <span key={i} className="h-1 flex-1 rounded-full transition-colors"
                    style={{ background: i < forca ? 'linear-gradient(90deg,#ff6a00,#ff8d3a)' : '#2b2138' }} />
                ))}
              </div>
              <p className="text-[#8a8095] text-[11px] mt-1.5">
                Mínimo de 8 caracteres, uma maiúscula, uma minúscula e um número.
              </p>
            </div>

            {/* Termos */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" {...register('terms')}
                className="mt-0.5 w-4 h-4 rounded accent-[#ff6a00]" />
              <span className="text-[#cfc5d8] text-xs leading-relaxed">
                Li e aceito os <span className="text-orange font-semibold">Termos de Uso</span> e
                a <span className="text-orange font-semibold">Política de Privacidade</span>.
              </span>
            </label>
            {errors.terms && <p className="text-destructive text-xs -mt-2">{errors.terms.message}</p>}

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-destructive text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white text-sm font-extrabold
                         tracking-wide bg-gradient-to-r from-orange via-[#ff4458] to-accent
                         hover:opacity-95 disabled:opacity-60 active:scale-[0.98] transition-all
                         shadow-[0_12px_32px_rgba(255,106,0,0.22)]"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              CRIAR CONTA
            </button>
          </form>

          <p className="text-center text-[#a99cb8] text-sm mt-5">
            Já tem uma conta?{' '}
            <Link href="/auth/login" className="text-orange font-bold hover:underline">Entrar</Link>
          </p>
          <p className="text-center text-[#6f6478] text-[11px] mt-3">
            🔒 Seus dados são protegidos e criptografados.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
