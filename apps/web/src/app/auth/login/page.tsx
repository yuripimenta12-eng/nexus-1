'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await login(data.email, data.password);
      router.push('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao entrar. Tente novamente.');
    }
  }

  return (
    <div
      className="login-grid relative min-h-screen overflow-x-hidden"
      style={{
        background: 'radial-gradient(circle at 14% 15%,#ff6a0025 0,transparent 30%),radial-gradient(circle at 86% 18%,#7a2cff35 0,transparent 32%),#09070d',
        display: 'grid',
        gridTemplateColumns: 'minmax(380px,1.12fr) minmax(430px,.88fr)',
      }}
    >

      {/* ── LADO ESQUERDO: marketing copy ──────────────────────── */}
      <section
        className="relative flex flex-col justify-between min-h-screen"
        style={{ padding: '42px clamp(35px,6vw,92px)' }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 0 30px #7a2cff55',
            }}
          >
            <img
              src="/nexus-logo.png"
              alt="Nexus Link"
              style={{
                width: 52,
                height: 52,
                objectFit: 'cover',
                objectPosition: '50% 18%',
              }}
            />
          </div>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: 1 }}>
            NEXUS <span style={{ color: '#ff6a00' }}>LINK</span>
          </span>
        </div>

        {/* Copy */}
        <div className="max-w-[680px] my-16">
          {/* Eyebrow */}
          <div className="flex items-center gap-2.5 mb-4">
            <span
              className="inline-block w-8 h-0.5"
              style={{ background: 'linear-gradient(90deg,#ff6a00,#7a2cff)' }}
            />
            <span className="text-[#d2c5df] uppercase tracking-[2px] font-black text-[11px]">
              Sua comunidade começa aqui
            </span>
          </div>

          {/* H1 */}
          <h1
            className="font-black leading-[.98] tracking-[-4px] mb-4"
            style={{ fontSize: 'clamp(44px,5.6vw,82px)' }}
          >
            Conecte sua voz.
            <em
              className="block not-italic"
              style={{
                color: 'transparent',
                background: 'linear-gradient(90deg,#ff6a00,#ffaf45 35%,#7a2cff)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              Compartilhe seu mundo.
            </em>
          </h1>

          <p className="text-[#b3a8bf] text-[17px] max-w-[570px]">
            Entre em chamadas, abra sua câmera, compartilhe a tela e viva cada momento
            com seus amigos em um só lugar.
          </p>

          {/* Pulse */}
          <div className="flex items-center gap-3 mt-8 text-[#d7cfdf]">
            <span
              className="w-[11px] h-[11px] rounded-full flex-shrink-0"
              style={{
                background: '#47e5a4',
                boxShadow: '0 0 0 0 #47e5a480',
                animation: 'pulseDot 1.8s infinite',
              }}
            />
            <span className="text-sm">Mais de 2.400 pessoas conectadas agora</span>
          </div>
        </div>

        {/* Feature chips + legal */}
        <div>
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              ['Áudio', 'cristalino'],
              ['Vídeo', 'em alta qualidade'],
              ['Tela', 'sem complicação'],
              ['Chat', 'em tempo real'],
            ].map(([bold, rest]) => (
              <span
                key={bold}
                className="px-3 py-2 rounded-full text-[12px] text-[#a99db5]"
                style={{ border: '1px solid #2e2339', background: '#ffffff05' }}
              >
                <strong className="text-[#eee6f7]">{bold}</strong> {rest}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[#655c70]">© 2026 Nexus Link. Conexões que aproximam.</p>
        </div>

        {/* Orbit decoration */}
        <div
          style={{
            position: 'absolute',
            left: '49%',
            top: '49%',
            width: 250,
            height: 250,
            border: '1px solid #7a2cff35',
            borderRadius: '50%',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
            animation: 'orbitSpin 18s linear infinite',
          }}
        >
          <span
            style={{
              position: 'absolute',
              width: 12, height: 12,
              borderRadius: '50%',
              background: '#ff6a00',
              boxShadow: '0 0 20px #ff6a00',
              left: 18, top: 42,
            }}
          />
          <span
            style={{
              position: 'absolute',
              width: 9, height: 9,
              borderRadius: '50%',
              background: '#7a2cff',
              boxShadow: '0 0 20px #7a2cff',
              right: 5, bottom: 70,
            }}
          />
        </div>
      </section>

      {/* ── LADO DIREITO: form de login ─────────────────────────── */}
      <section
        className="min-h-screen grid place-items-center"
        style={{
          padding: 36,
          borderLeft: '1px solid #281c35',
          background: '#0d0912aa',
          backdropFilter: 'blur(18px)',
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{
            width: 'min(100%,470px)',
            padding: 40,
            border: '1px solid #332441',
            borderRadius: 24,
            background: 'linear-gradient(145deg,#181021f2,#100b16f5)',
            boxShadow: '0 35px 90px #0008,0 0 0 1px #ffffff05 inset',
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 28, letterSpacing: -0.5, lineHeight: 1.1, margin: '0 0 6px' }}>
              Que bom ver você novamente!
            </h2>
            <p style={{ color: '#9a90a8', margin: 0 }}>
              Use seu e-mail e senha para acessar suas comunidades.
            </p>
          </div>

          {/* E-mail */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cfc5d8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            E-mail
          </label>
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                width: '100%', borderRadius: 13, border: `1px solid ${errors.email ? '#ff5872' : '#332640'}`,
                background: '#0b0810', color: '#fff', padding: '14px', fontSize: 14,
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
              onFocus={e => { if (!errors.email) e.currentTarget.style.borderColor = '#7a2cff'; }}
              onBlur={e => { if (!errors.email) e.currentTarget.style.borderColor = '#332640'; }}
            />
          </div>
          {errors.email && (
            <p style={{ fontSize: 11, color: '#ff5872', marginBottom: 8, marginTop: 2 }}>{errors.email.message}</p>
          )}

          {/* Senha */}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#cfc5d8', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 16, marginBottom: 6 }}>
            Senha
          </label>
          <div style={{ position: 'relative', marginBottom: 4 }}>
            <input
              {...register('password')}
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: '100%', borderRadius: 13, border: `1px solid ${errors.password ? '#ff5872' : '#332640'}`,
                background: '#0b0810', color: '#fff', padding: '14px', paddingRight: 44, fontSize: 14,
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
              onFocus={e => { if (!errors.password) e.currentTarget.style.borderColor = '#7a2cff'; }}
              onBlur={e => { if (!errors.password) e.currentTarget.style.borderColor = '#332640'; }}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9689a4', padding: 4, display: 'flex', alignItems: 'center',
              }}
            >
              {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          {errors.password && (
            <p style={{ fontSize: 11, color: '#ff5872', marginBottom: 8, marginTop: 2 }}>{errors.password.message}</p>
          )}

          {/* Opções */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 20, fontSize: 12, color: '#92869e' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" style={{ accentColor: '#7a2cff' }} />
              Manter conectado
            </label>
            <Link href="/auth/forgot-password" style={{ color: '#92869e', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#ff9650'}
              onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = '#92869e'}
            >
              Esqueceu a senha?
            </Link>
          </div>

          {/* Erro global */}
          {error && (
            <div
              style={{ marginBottom: 16, padding: '12px', borderRadius: 10, fontSize: 14, color: '#ff5872', background: 'rgba(255,88,114,0.08)', border: '1px solid rgba(255,88,114,0.2)' }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%', border: 'none', borderRadius: 13, padding: '14px', color: '#fff', fontWeight: 900,
              cursor: isLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(110deg,#ff6a00,#ff4458 48%,#7a2cff)',
              boxShadow: '0 10px 30px rgba(122,44,255,0.17)',
              fontSize: 15, letterSpacing: 0.5,
              opacity: isLoading ? 0.65 : 1,
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!isLoading) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 14px 35px rgba(122,44,255,0.27)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = ''; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 30px rgba(122,44,255,0.17)'; }}
          >
            {isLoading ? (
              <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> CONECTANDO...</>
            ) : (
              'ENTRAR NO NEXUS →'
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0', fontSize: 11, color: '#675d71' }}>
            <span style={{ height: 1, flex: 1, background: '#30243b' }} />
            NOVO POR AQUI?
            <span style={{ height: 1, flex: 1, background: '#30243b' }} />
          </div>

          {/* Register */}
          <Link href="/auth/register" style={{ textDecoration: 'none', display: 'block' }}>
            <button
              type="button"
              style={{
                width: '100%', borderRadius: 13, padding: '14px', color: '#d9cfdf', fontWeight: 700,
                cursor: 'pointer', border: '1px solid #38294a', background: '#171020',
                fontSize: 14, transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7a2cff'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#38294a'; (e.currentTarget as HTMLButtonElement).style.color = '#d9cfdf'; }}
            >
              Criar meu Nexus ID
            </button>
          </Link>

          {/* Security */}
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#6f6478' }}>
            🔒 Sua conexão é protegida e criptografada.
          </p>

          {/* Demo credentials */}
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: '#17101e', border: '1px solid #2a1d35' }}>
            <p style={{ color: '#786e83', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginTop: 0 }}>
              Credenciais de demonstração
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, color: '#9a90a8', fontSize: 11 }}>
              <div>
                <span style={{ color: '#cfc5d8', fontWeight: 600 }}>Admin:</span>
                <p style={{ margin: '2px 0', fontFamily: 'monospace' }}>admin@nexus.local</p>
                <p style={{ margin: 0, fontFamily: 'monospace' }}>Admin@123456</p>
              </div>
              <div>
                <span style={{ color: '#cfc5d8', fontWeight: 600 }}>Demo:</span>
                <p style={{ margin: '2px 0', fontFamily: 'monospace' }}>demo@nexus.local</p>
                <p style={{ margin: 0, fontFamily: 'monospace' }}>Demo@123456</p>
              </div>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
