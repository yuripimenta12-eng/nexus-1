'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, LogIn, User, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const schema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, isAuthenticated, hasHydrated } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [invited,  setInvited]  = useState(false);
  useEffect(() => {
    setInvited(!!localStorage.getItem('nexus_pending_invite'));
  }, []);

  // Quem já tem sessão válida volta para o app (ou para o convite pendente)
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      const pending = localStorage.getItem('nexus_pending_invite');
      if (pending) {
        localStorage.removeItem('nexus_pending_invite');
        router.replace(`/invite/${pending}`);
      } else {
        router.replace('/app');
      }
    }
  }, [hasHydrated, isAuthenticated, router]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError('');
    try {
      await login(data.email, data.password);
      const pending = localStorage.getItem('nexus_pending_invite');
      if (pending) {
        localStorage.removeItem('nexus_pending_invite');
        router.push(`/invite/${pending}`);
      } else {
        router.push('/app');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao entrar. Tente novamente.');
    }
  }

  return (
    <div
      className="login-grid relative min-h-screen overflow-x-hidden grid
                 grid-cols-1 md:grid-cols-[minmax(380px,1.12fr)_minmax(430px,.88fr)]
                 xl:grid-cols-[minmax(340px,1fr)_minmax(360px,620px)_minmax(430px,520px)]"
      style={{
        background:
          'radial-gradient(circle at 14% 15%,#ff6a0014 0,transparent 30%),' +
          'radial-gradient(circle at 86% 18%,#7a2cff20 0,transparent 32%),' +
          '#0a0713',
      }}
    >

      {/* ── LADO ESQUERDO: marketing copy ──────────────────────── */}
      <section
        className="relative flex flex-col justify-between min-h-screen"
        style={{ padding: '42px clamp(35px,6vw,92px)' }}
      >
        {/* Brand — logo completo com brilho */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nexus-logo-full.png"
            alt="Nexus Link"
            style={{
              height: 104,
              width: 'auto',
              filter: 'drop-shadow(0 6px 22px rgba(122,44,255,0.45)) drop-shadow(0 2px 8px rgba(255,106,0,0.25))',
            }}
          />
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
            Chamadas, vídeo, tela compartilhada e conversas em um só lugar.
          </p>

          {/* Prova social com avatares grandes (Photoshop do usuário) */}
          <div className="flex items-center gap-4 mt-9">
            <div className="flex -space-x-4">
              {[1, 2, 3].map(n => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={n}
                  src={`/avatar-${n}.webp`}
                  alt=""
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-[#0a0713] select-none"
                  draggable={false}
                />
              ))}
            </div>
            <div className="flex items-start gap-2">
              <span
                className="w-[10px] h-[10px] rounded-full flex-shrink-0 mt-1.5"
                style={{ background: '#47e5a4', animation: 'pulseDot 1.8s infinite' }}
              />
              <span className="text-white text-base leading-snug">
                Mais de 1.688 pessoas<br />conectadas agora!
              </span>
            </div>
          </div>
        </div>

        {/* Feature cards + legal */}
        <div>
          <div className="flex flex-wrap gap-2.5 mb-6">
            {['audio', 'video', 'tela', 'chat'].map(k => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={k}
                src={`/card-${k}.webp`}
                alt={k}
                className="h-[70px] w-auto select-none transition-transform hover:-translate-y-0.5"
                draggable={false}
                style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.45))' }}
              />
            ))}
          </div>
          <p className="text-[11px] text-[#655c70]">© 2026 Nexus Link. Conexões que aproximam.</p>
        </div>

      </section>

      {/* ── CENTRO: mascote com efeitos (só em telas grandes) ──── */}
      <section className="relative hidden xl:flex items-end justify-center overflow-hidden pb-3" aria-hidden>
        {/* Luzes roxo/laranja pulsando entre o personagem */}
        <div className="nx-blob" style={{ width: 260, height: 260, top: '14%', left: '2%', background: 'rgba(122,44,255,0.34)' }} />
        <div className="nx-blob" style={{ width: 300, height: 300, bottom: '8%', right: '0%', background: 'rgba(255,106,0,0.26)', animationDelay: '1.8s' }} />
        <div className="nx-blob" style={{ width: 200, height: 200, top: '48%', left: '6%', background: 'rgba(255,77,141,0.22)', animationDelay: '3.2s' }} />
        <div className="nx-blob" style={{ width: 220, height: 220, top: '6%', right: '8%', background: 'rgba(176,92,255,0.28)', animationDelay: '4.4s' }} />

        {/* Mascote GRANDE, pés perto do rodapé (como no mockup) */}
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mascote-cena.webp"
            alt=""
            className="select-none"
            draggable={false}
            style={{
              height: '94vh',
              width: 'auto',
              maxWidth: 'none',
              WebkitMaskImage:
                'radial-gradient(ellipse 64% 70% at 50% 50%, #000 52%, transparent 84%)',
              maskImage:
                'radial-gradient(ellipse 64% 70% at 50% 50%, #000 52%, transparent 84%)',
            }}
          />
          {/* Reflexo varrendo os óculos */}
          <div className="nx-glare" style={{ left: '43.8%', top: '25.6%', width: '26.5%', height: '8%' }} />

          {/* Fagulhas de luz subindo AO REDOR do personagem */}
          {[
            { l: '26%', b: '14%', h: 18, c: '#ff6a00', d: 0, t: 4.6 },
            { l: '31%', b: '8%', h: 14, c: '#ffd166', d: 1.6, t: 5.4 },
            { l: '36%', b: '18%', h: 20, c: '#b05cff', d: 3.0, t: 4.2 },
            { l: '41%', b: '6%', h: 13, c: '#ff4d8d', d: 0.7, t: 5.8 },
            { l: '46%', b: '10%', h: 16, c: '#ff6a00', d: 2.2, t: 4.9 },
            { l: '56%', b: '8%', h: 15, c: '#b05cff', d: 4.1, t: 5.2 },
            { l: '62%', b: '15%', h: 19, c: '#ffd166', d: 1.1, t: 4.4 },
            { l: '67%', b: '7%', h: 14, c: '#ff6a00', d: 2.9, t: 5.6 },
            { l: '72%', b: '12%', h: 17, c: '#ff4d8d', d: 0.3, t: 4.7 },
            { l: '76%', b: '18%', h: 15, c: '#b05cff', d: 3.6, t: 5.0 },
            { l: '29%', b: '32%', h: 13, c: '#7a2cff', d: 5.0, t: 4.3 },
            { l: '73%', b: '34%', h: 13, c: '#ffd166', d: 5.6, t: 4.8 },
            { l: '44%', b: '22%', h: 12, c: '#ffb27d', d: 6.2, t: 5.1 },
            { l: '60%', b: '26%', h: 12, c: '#ff6a00', d: 6.8, t: 4.5 },
          ].map((p, i) => (
            <span
              key={i}
              className="nx-particle"
              style={{
                left: p.l,
                bottom: p.b,
                width: 4,
                height: p.h,
                borderRadius: 4,
                background: `linear-gradient(to top, transparent, ${p.c})`,
                boxShadow: `0 0 10px ${p.c}`,
                animationDelay: `${p.d}s`,
                animationDuration: `${p.t}s`,
              }}
            />
          ))}

          {/* Ícones flutuantes COLADOS no personagem (como no mockup) */}
          {[
            { src: '/icon-video.webp', top: '13%', left: '2%', size: 84, delay: 0 },
            { src: '/icon-mic.webp', top: '7%', right: '3%', size: 88, delay: 1.4 },
            { src: '/icon-chat.webp', top: '44%', left: '0%', size: 78, delay: 2.6 },
            { src: '/icon-tela.webp', top: '51%', right: '0%', size: 96, delay: 0.8 },
          ].map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={f.src}
              alt=""
              className="nx-float select-none"
              draggable={false}
              style={{
                top: f.top,
                left: (f as any).left,
                right: (f as any).right,
                width: f.size,
                height: f.size,
                filter: 'drop-shadow(0 8px 22px rgba(255,106,0,0.5))',
                animationDelay: `${f.delay}s`,
                zIndex: 2,
              }}
            />
          ))}
        </div>
      </section>

      {/* ── LADO DIREITO: form de login ─────────────────────────── */}
      <section
        className="min-h-screen flex flex-col items-center justify-center"
        style={{
          padding: 36,
          borderLeft: '1px solid #281c35',
          background: '#0d0912aa',
          backdropFilter: 'blur(18px)',
        }}
      >
        {/* Selo de status acima do card */}
        <div
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-full self-center"
          style={{ border: '1px solid #2e2339', background: '#100b16cc' }}
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: '#47e5a4', animation: 'pulseDot 1.8s infinite' }}
          />
          <span className="text-[#cfc5d8] text-xs font-semibold">Servidores online</span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          style={{
            position: 'relative',
            width: 'min(100%,470px)',
            padding: 40,
            border: '1px solid #7a2cff55',
            borderRadius: 24,
            background: 'linear-gradient(145deg,#181021f2,#100b16f5)',
            boxShadow: '0 35px 90px #0008, 0 0 40px #7a2cff22, 0 0 0 1px #ffffff05 inset',
          }}
        >
          {/* Aviso de convite */}
          {invited && (
            <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 12, background: 'rgba(122,44,255,0.12)', border: '1px solid rgba(122,44,255,0.4)', color: '#eee6f7', fontSize: 13 }}>
              🎉 Você foi convidado! Entre com sua conta para participar — ou{' '}
              <Link href="/auth/register" style={{ color: '#ff9650', fontWeight: 700 }}>crie uma agora</Link>.
            </div>
          )}

          {/* Ícone do app (canto do card, como no Photoshop) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nexus-app-icon.webp"
            alt=""
            style={{ position: 'absolute', top: 22, right: 22, width: 56, height: 56,
                     filter: 'drop-shadow(0 4px 14px rgba(122,44,255,0.5))' }}
          />

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
            <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                           width: 16, height: 16, color: '#8a7f98', pointerEvents: 'none', zIndex: 1 }} />
            <input
              {...register('email')}
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              style={{
                width: '100%', borderRadius: 13, border: `1px solid ${errors.email ? '#ff5872' : '#332640'}`,
                background: '#0b0810', color: '#fff', padding: '14px 14px 14px 40px', fontSize: 14,
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
              <><LogIn style={{ width: 17, height: 17 }} /> ENTRAR NO NEXUS</>
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
              <User style={{ width: 15, height: 15, display: 'inline', verticalAlign: '-2px', marginRight: 7 }} />Criar meu Nexus ID
            </button>
          </Link>

          {/* Security */}
          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 11, color: '#6f6478' }}>
            🔒 Sua conexão é protegida e criptografada.
          </p>
        </form>
      </section>
    </div>
  );
}
