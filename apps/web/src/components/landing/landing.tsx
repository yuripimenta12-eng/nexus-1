'use client';

// Página inicial do Nexus (nexuslink.art) para quem ainda não entrou.
// Efeitos de rolagem: barra de progresso, herói que sobe e some, trilho de
// itens que acelera com a rolagem, faixas de texto que andam, seção grudada
// que conta "como funciona" e cartões que aparecem ao entrar na tela.
import { useEffect, useRef, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  motion, MotionConfig, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue,
} from 'framer-motion';
import {
  ArrowRight, Crown, Download, Gem, Gift, Laptop, Lock, MessageSquare, Shield, Smartphone, Sparkles, Trophy, Users,
} from 'lucide-react';
import AuroraBackground from '@/components/ui/aurora-background';
import MarqueeAlongSvgPath from '@/components/ui/marquee-along-svg-path';
import TubesCursor from '@/components/ui/tubes-cursor';
import { Comentarios, GaleriaDetalhes, MascoteGuia, MuralLives, Perguntas, TabelaPlanos } from './secoes';
import { useAuthStore } from '@/stores/auth.store';
import { isDesktopApp } from '@/lib/desktop';
import { LIVE_POR_PLANO, PRECO_PLANO } from '@/lib/planos';

const DOWNLOAD_WINDOWS = 'https://github.com/yuripimenta12-eng/nexus-1/releases/latest/download/Nexus-Link-Setup.exe';

const LIMA = '#c8f53b';
const CAMINHO = 'M1 209.434C58.5872 255.935 387.926 325.938 482.583 209.434C600.905 63.8051 525.516 -43.2211 427.332 19.9613C329.149 83.1436 352.902 242.723 515.041 267.302C644.752 286.966 943.56 181.94 995 156.5';

// O que corre no trilho: ícones e avatares do Nexus + figurinhas de emoji animadas
const NO_TRILHO: ({ img: string; alt: string } | { emoji: string; alt: string })[] = [
  { img: '/icon-mic.webp', alt: 'Microfone' },
  { emoji: '🎧', alt: 'Fone' },
  { img: '/avatar-1.webp', alt: 'Avatar' },
  { emoji: '🎮', alt: 'Jogo' },
  { img: '/icon-tela.webp', alt: 'Live de tela' },
  { emoji: '💿', alt: 'DJ' },
  { img: '/avatar-2.webp', alt: 'Avatar' },
  { emoji: '🏆', alt: 'Troféu' },
  { img: '/icon-video.webp', alt: 'Vídeo' },
  { emoji: '🦉', alt: 'Coruja' },
  { img: '/nexus-logo-round.webp', alt: 'Nexus' },
  { emoji: '🔥', alt: 'Fogo' },
  { img: '/avatar-3.webp', alt: 'Avatar' },
  { emoji: '📺', alt: 'Live' },
  { img: '/icon-chat.webp', alt: 'Chat' },
  { emoji: '💬', alt: 'Mensagem' },
];

function Figurinha({ emoji, rotulo, atraso = 0, className }: { emoji: string; rotulo: string; atraso?: number; className?: string }) {
  return (
    <span role="img" aria-label={rotulo}
      className={`nx-figurinha grid place-items-center rounded-2xl border-2 border-white/80 bg-gradient-to-br from-[#2a1747] to-[#120b1c] shadow-[0_6px_20px_rgba(122,44,255,0.45)] ${className ?? ''}`}
      style={{ animationDelay: `${atraso}s` }}>
      {emoji}
    </span>
  );
}

function Aparecer({ children, atraso = 0, de = 'baixo', className }: { children: ReactNode; atraso?: number; de?: 'baixo' | 'esquerda' | 'direita'; className?: string }) {
  const inicio = de === 'esquerda' ? { x: -60 } : de === 'direita' ? { x: 60 } : { y: 40 };
  return (
    <motion.div className={className}
      initial={{ opacity: 0, ...inicio }} whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, delay: atraso, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function Faixa({ progresso, sentido, texto }: { progresso: MotionValue<number>; sentido: 1 | -1; texto: string }) {
  const x = useTransform(progresso, [0, 1], sentido === 1 ? ['0%', '-30%'] : ['-30%', '0%']);
  return (
    <motion.div style={{ x }} className="whitespace-nowrap text-[13vw] md:text-[8vw] font-black leading-none tracking-tighter select-none">
      {Array.from({ length: 3 }, () => texto).join(' ')}
    </motion.div>
  );
}

const PASSOS = [
  { n: '01', titulo: 'Crie sua conta', texto: 'Leva um minuto. Grátis, sem cartão.', emoji: '✨' },
  { n: '02', titulo: 'Monte o seu servidor', texto: 'Crie salas de texto e de voz, cargos e convites para a sua turma.', emoji: '🏠' },
  { n: '03', titulo: 'Chame a galera pra call', texto: 'Voz, vídeo, live de tela e o DJ tocando para todo mundo.', emoji: '🎧' },
];

const RECURSOS = [
  { Icone: MessageSquare, titulo: 'Chat e mensagens diretas', texto: 'Canais de texto, menções, reações e conversa no privado.' },
  { Icone: Users, titulo: 'Servidores com cargos', texto: 'Cada um com suas salas, cargos e permissões.' },
  { Icone: Laptop, titulo: 'App de PC com Modo jogo', texto: 'Quando um jogo abre, o Nexus fica leve para não roubar FPS.' },
  { Icone: Smartphone, titulo: 'No celular também', texto: 'Instale pelo navegador e leve a call no bolso.' },
  { Icone: Shield, titulo: 'Verificação em duas etapas', texto: 'Proteja sua conta com código no celular.' },
  { Icone: Gift, titulo: 'Indique e ganhe', texto: 'Seu link rende dias de Nexus+ quando a galera assina.' },
];

export default function Landing() {
  const router = useRouter();
  const reduzir = useReducedMotion();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  // App de PC abre direto no login; quem já entrou vai para o app
  // (?inicio deixa ver esta página mesmo logado)
  useEffect(() => {
    if (isDesktopApp()) { router.replace('/auth/login'); return; }
    if (hasHydrated && isAuthenticated && !new URLSearchParams(window.location.search).has('inicio')) router.replace('/app');
  }, [hasHydrated, isAuthenticated, router]);

  const { scrollYProgress } = useScroll();
  const barra = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

  const heroi = useRef<HTMLElement>(null);
  const { scrollYProgress: pHeroi } = useScroll({ target: heroi, offset: ['start start', 'end start'] });
  const heroiY = useTransform(pHeroi, [0, 1], [0, reduzir ? 0 : -140]);
  const heroiOpacidade = useTransform(pHeroi, [0, 0.8], [1, 0]);
  const mascoteY = useTransform(pHeroi, [0, 1], [0, reduzir ? 0 : 160]);
  const mascoteGiro = useTransform(pHeroi, [0, 1], [0, reduzir ? 0 : 12]);

  const faixas = useRef<HTMLElement>(null);
  const { scrollYProgress: pFaixas } = useScroll({ target: faixas, offset: ['start end', 'end start'] });

  const passos = useRef<HTMLElement>(null);
  const { scrollYProgress: pPassos } = useScroll({ target: passos, offset: ['start start', 'end end'] });
  const linhaPassos = useTransform(pPassos, [0, 1], ['0%', '100%']);
  const mascotePassosEscala = useTransform(pPassos, [0, 1], [0.85, reduzir ? 0.85 : 1.1]);
  const mascotePassosGiro = useTransform(pPassos, [0, 1], [reduzir ? 0 : -6, reduzir ? 0 : 6]);

  const logado = hasHydrated && isAuthenticated;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#07040d] text-white overflow-x-clip">
        {/* Barra de progresso da rolagem */}
        <motion.div className="fixed inset-x-0 top-0 z-50 h-1 origin-left" style={{ scaleX: barra, background: 'linear-gradient(90deg,#7a2cff,#ff4f79,#ff6a00)' }} />

        {/* Topo */}
        <header className="fixed inset-x-0 top-0 z-40 px-4 sm:px-8 pt-3">
          <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
            <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
              <Image src="/nexus-logo-round.webp" alt="" width={32} height={32} className="rounded-full" />
              <span>Nexus</span>
            </Link>
            <div className="hidden items-center gap-6 text-sm text-white/70 md:flex">
              <a href="#recursos" className="hover:text-white">Recursos</a>
              <a href="#lives" className="hover:text-white">Lives</a>
              <a href="#planos" className="hover:text-white">Planos</a>
              <a href="#comentarios" className="hover:text-white">Comentários</a>
              <a href="#perguntas" className="hover:text-white">Perguntas</a>
            </div>
            <div className="flex items-center gap-2">
              {logado ? (
                <Link href="/app" className="rounded-xl bg-white px-3.5 py-2 text-sm font-extrabold text-[#18131f] hover:brightness-95">Abrir o Nexus</Link>
              ) : (
                <>
                  <Link href="/auth/login" className="rounded-xl px-3 py-2 text-sm font-bold text-white/80 hover:text-white">Entrar</Link>
                  <Link href="/auth/register" className="rounded-xl px-3.5 py-2 text-sm font-extrabold text-[#18131f] hover:brightness-110" style={{ background: LIMA }}>Criar conta</Link>
                </>
              )}
            </div>
          </nav>
        </header>

        {/* Herói */}
        <section ref={heroi} id="topo" className="relative">
          <AuroraBackground className="min-h-[100svh]">
            {/* Tubos de luz seguindo o mouse (só com mouse; clique no vazio troca as cores) */}
            <TubesCursor className="absolute inset-0 z-0" />
            <div className="relative z-10 mx-auto grid min-h-[100svh] max-w-6xl items-center gap-8 px-4 pt-24 pb-16 sm:px-8 md:grid-cols-[1.1fr_.9fr]">
              <motion.div style={{ y: heroiY, opacity: heroiOpacidade }}>
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/80">
                  <Sparkles className="size-3.5" style={{ color: LIMA }} /> Calls · Lives · Comunidades
                </motion.p>
                <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8 }}
                  className="text-5xl font-black leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
                  Sua turma.<br />Sua call.<br />
                  <span className="bg-gradient-to-r from-[#b98cff] via-[#ff7aa0] to-[#ffb070] bg-clip-text text-transparent">Seu Nexus.</span>
                </motion.h1>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                  className="mt-5 max-w-md text-base text-white/70 sm:text-lg">
                  Voz, vídeo, live de tela e um DJ na call. Tudo num lugar feito para jogar e conversar com a galera.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                  className="mt-8 flex flex-wrap gap-3">
                  <Link href={logado ? '/app' : '/auth/register'}
                    className="group inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-base font-extrabold text-[#18131f] shadow-[0_10px_40px_rgba(200,245,59,0.25)] hover:brightness-110"
                    style={{ background: LIMA }}>
                    {logado ? 'Abrir o Nexus' : 'Criar conta grátis'}
                    <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  {!logado && (
                    <Link href="/auth/login" className="inline-flex items-center rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-bold hover:bg-white/10">
                      Já tenho conta
                    </Link>
                  )}
                </motion.div>
              </motion.div>

              <motion.div style={{ y: mascoteY, rotate: mascoteGiro }} className="relative mx-auto w-full max-w-[420px]">
                <div className="nx-flutuar">
                  <Image src="/mascote-logo.webp" alt="Mascote do Nexus com fone de ouvido segurando o logo" width={640} height={674} priority sizes="(min-width: 768px) 420px, 90vw" className="h-auto w-full drop-shadow-[0_30px_60px_rgba(122,44,255,0.45)]" />
                </div>
                <Figurinha emoji="🎧" rotulo="Fone" className="absolute -left-2 top-10 size-14 text-3xl" />
                <Figurinha emoji="🎮" rotulo="Jogo" atraso={0.6} className="absolute -right-1 top-1/3 size-12 text-2xl" />
                <Figurinha emoji="🔥" rotulo="Fogo" atraso={1.2} className="absolute bottom-10 left-4 size-12 text-2xl" />
              </motion.div>
            </div>
            <motion.div style={{ opacity: heroiOpacidade }} className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-[0.3em] text-white/40">
              Role para ver ↓
            </motion.div>
          </AuroraBackground>
        </section>

        {/* Trilho com as coisas do Nexus */}
        <section id="trilho" className="relative py-20">
          <Aparecer className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Tudo que rola numa call</h2>
            <p className="mt-3 text-white/60">Role a página e veja o trilho acelerar. Arraste ou passe o mouse para controlar.</p>
          </Aparecer>
          <MarqueeAlongSvgPath caminho={CAMINHO} viewBox="0 0 996 330" velocidade={5} repetir={1} className="mt-6 h-[220px] w-full sm:h-[340px]">
            {NO_TRILHO.map((it, i) => (
              <div key={i} className="-translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-150">
                {'img' in it ? (
                  <Image src={it.img} alt={it.alt} width={96} height={96} draggable={false}
                    className="size-24 sm:size-14 rounded-2xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5)] select-none" />
                ) : (
                  <Figurinha emoji={it.emoji} rotulo={it.alt} atraso={i * 0.2} className="size-24 sm:size-14 text-5xl sm:text-3xl" />
                )}
              </div>
            ))}
          </MarqueeAlongSvgPath>
        </section>

        {/* Recursos principais: cada um entra de um lado */}
        <section id="recursos" className="mx-auto max-w-6xl space-y-24 px-4 py-16 sm:px-8">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <Aparecer de="esquerda">
              <Image src="/mascote-voz.webp" alt="Mascote do Nexus falando numa call" width={818} height={760} sizes="(min-width: 768px) 460px, 90vw" className="h-auto w-full max-w-[460px] mx-auto" />
            </Aparecer>
            <Aparecer de="direita" atraso={0.1}>
              <Image src="/card-audio.webp" alt="Áudio cristalino" width={520} height={203} className="h-auto w-56" />
              <h3 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">A call que não trava</h3>
              <p className="mt-3 text-white/70">Voz e vídeo em tempo real com a sua turma. Veja quem está falando, entre e saia das salas num clique.</p>
            </Aparecer>
          </div>

          <div className="grid items-center gap-10 md:grid-cols-2">
            <Aparecer de="esquerda" className="md:order-2">
              <div className="relative mx-auto max-w-[460px] rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a0f2b] to-[#0d0814] p-6">
                <Image src="/card-tela.webp" alt="Compartilhar a tela" width={520} height={164} className="h-auto w-full" />
                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {(['gratis', 'mais', 'pro'] as const).map((p) => (
                    <div key={p} className="rounded-xl bg-white/5 px-2 py-3">
                      <p className="text-lg font-black">{LIVE_POR_PLANO[p].rotulo.split(' ')[0]}</p>
                      <p className="text-[11px] text-white/50">{p === 'gratis' ? 'Grátis' : p === 'mais' ? 'Nexus+' : 'Pro'} · 60fps</p>
                    </div>
                  ))}
                </div>
              </div>
            </Aparecer>
            <Aparecer de="direita" atraso={0.1} className="md:order-1">
              <h3 className="text-3xl font-black tracking-tight sm:text-4xl">Live de tela a 60 quadros</h3>
              <p className="mt-3 text-white/70">Mostre o jogo para a call com fluidez de verdade, com o som junto. Grátis em 540p, e até 1080p no Nexus Pro.</p>
            </Aparecer>
          </div>

          <div className="grid items-center gap-10 md:grid-cols-2">
            <Aparecer de="esquerda">
              <div className="relative mx-auto grid max-w-[420px] grid-cols-3 gap-3">
                {['💿', '🎵', '🎤', '🏆', '🦉', '📺'].map((e, i) => (
                  <Figurinha key={e} emoji={e} rotulo="Figurinha" atraso={i * 0.3} className="aspect-square w-full text-5xl" />
                ))}
              </div>
            </Aparecer>
            <Aparecer de="direita" atraso={0.1}>
              <h3 className="text-3xl font-black tracking-tight sm:text-4xl">DJ, placar e conquistas</h3>
              <p className="mt-3 text-white/70">
                Peça uma música e o DJ toca para a sala inteira. O placar mostra quem mora na call, quem mais fala e quem é o DJ da mesa,
                e as conquistas aparecem no seu perfil.
              </p>
              <p className="mt-4 inline-flex items-center gap-2 text-sm font-bold" style={{ color: LIMA }}>
                <Trophy className="size-4" /> Rato de call, Coruja, Streamer e muito mais
              </p>
            </Aparecer>
          </div>
        </section>

        <GaleriaDetalhes />

        {/* Faixas de texto que andam com a rolagem */}
        <section ref={faixas} className="space-y-2 overflow-hidden py-16" aria-hidden>
          <div className="text-white/90"><Faixa progresso={pFaixas} sentido={1} texto="VOZ • VÍDEO • LIVE • DJ •" /></div>
          <div className="bg-gradient-to-r from-[#7a2cff] via-[#ff4f79] to-[#ff6a00] bg-clip-text text-transparent">
            <Faixa progresso={pFaixas} sentido={-1} texto="PLACAR • CONQUISTAS • AMIGOS •" />
          </div>
        </section>

        <MuralLives />

        {/* Como funciona: o mascote fica parado enquanto os passos passam */}
        <section id="como-funciona" ref={passos} className="relative mx-auto max-w-6xl px-4 sm:px-8">
          <div className="grid gap-10 md:grid-cols-2">
            <div className="md:sticky md:top-0 md:flex md:h-screen md:items-center">
              <motion.div style={{ scale: mascotePassosEscala, rotate: mascotePassosGiro }} className="mx-auto w-full max-w-[380px]">
                <Image src="/mascote-cena.webp" alt="Mascote do Nexus dançando com fone de ouvido" width={760} height={807} sizes="(min-width: 768px) 380px, 90vw" className="h-auto w-full [mask-image:radial-gradient(closest-side,black_72%,transparent)]" />
              </motion.div>
            </div>
            <div className="relative py-10 md:py-[30vh]">
              <div className="absolute left-5 top-0 h-full w-0.5 bg-white/10 md:top-[30vh] md:h-[calc(100%-60vh)]">
                <motion.div className="w-full rounded-full" style={{ height: linhaPassos, background: `linear-gradient(${LIMA}, #ff4f79)` }} />
              </div>
              <h2 className="mb-10 pl-14 text-3xl font-black tracking-tight sm:text-5xl">Como funciona</h2>
              <div className="space-y-24 md:space-y-[30vh]">
                {PASSOS.map((p) => (
                  <Aparecer key={p.n} className="relative pl-14">
                    <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border-2 border-white/20 bg-[#120b1c] text-lg">{p.emoji}</span>
                    <p className="text-sm font-black tracking-[0.2em]" style={{ color: LIMA }}>{p.n}</p>
                    <h3 className="mt-1 text-2xl font-black sm:text-3xl">{p.titulo}</h3>
                    <p className="mt-2 max-w-sm text-white/70">{p.texto}</p>
                  </Aparecer>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Mais recursos */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <Aparecer><h2 className="text-center text-3xl font-black tracking-tight sm:text-5xl">E tem mais</h2></Aparecer>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r, i) => (
              <Aparecer key={r.titulo} atraso={(i % 3) * 0.08}>
                <motion.div whileHover={{ y: -6 }} className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/20">
                  <r.Icone className="size-6" style={{ color: LIMA }} />
                  <h3 className="mt-3 text-lg font-extrabold">{r.titulo}</h3>
                  <p className="mt-1 text-sm text-white/60">{r.texto}</p>
                </motion.div>
              </Aparecer>
            ))}
          </div>
        </section>

        {/* Planos */}
        <section id="planos" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <Aparecer className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="w-44 shrink-0 md:w-56">
              <Image src="/mascote-aparencia.webp" alt="Mascote do Nexus mostrando as opções de aparência" width={780} height={634} sizes="224px" className="h-auto w-full" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Grátis para sempre. Turbinado se quiser.</h2>
              <p className="mt-3 text-white/60">O Grátis já tem tudo para a call. Os planos aumentam a qualidade da live e deixam o perfil com a sua cara.</p>
            </div>
          </Aparecer>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              { nome: 'Grátis', preco: 'R$ 0', nota: 'para sempre', Icone: Users, cor: '#c9bedb', itens: ['Calls, chat e servidores', `Live em ${LIVE_POR_PLANO.gratis.rotulo}`, 'DJ, placar e conquistas'] },
              { nome: 'Nexus+', preco: PRECO_PLANO.mais.mes, nota: 'por mês', Icone: Gem, cor: '#3ee0ff', itens: ['Tudo do Grátis', `Live em ${LIVE_POR_PLANO.mais.rotulo}`, 'Emblema Nexus+ no perfil'] },
              { nome: 'Nexus Pro', preco: PRECO_PLANO.pro.mes, nota: 'por mês', Icone: Crown, cor: '#ffc23d', itens: ['Tudo do Nexus+', `Live em ${LIVE_POR_PLANO.pro.rotulo}`, 'Emblema Nexus Pro no perfil'] },
            ].map((p, i) => (
              <Aparecer key={p.nome} atraso={i * 0.1}>
                <div className="h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-6">
                  <p.Icone className="size-6" style={{ color: p.cor }} />
                  <h3 className="mt-3 text-xl font-black">{p.nome}</h3>
                  <p className="mt-2"><span className="text-3xl font-black">{p.preco}</span> <span className="text-sm text-white/50">{p.nota}</span></p>
                  <ul className="mt-4 space-y-2 text-sm text-white/75">
                    {p.itens.map((t) => <li key={t} className="flex gap-2"><span style={{ color: LIMA }}>✓</span>{t}</li>)}
                  </ul>
                </div>
              </Aparecer>
            ))}
          </div>
          <TabelaPlanos />
        </section>

        <Comentarios />
        <Perguntas />

        {/* Chamada final */}
        <section id="final" className="relative">
          <AuroraBackground className="py-28" cores={['rgba(255,79,121,0.22)', 'rgba(122,44,255,0.28)']} estrelas={40}>
            <Aparecer className="mx-auto max-w-2xl px-4 text-center">
              <div className="nx-flutuar mx-auto w-64 sm:w-80">
                <Image src="/mascote-conta.webp" alt="Mascote do Nexus de bigode segurando o logo" width={783} height={429} sizes="320px" className="h-auto w-full" />
              </div>
              <div className="mt-2 flex justify-center gap-3 text-3xl">
                {['🎧', '🎮', '🔥'].map((e, i) => <Figurinha key={e} emoji={e} rotulo="Figurinha" atraso={i * 0.4} className="size-14" />)}
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tighter sm:text-6xl">Bora pra call?</h2>
              <p className="mt-3 text-white/70">Crie sua conta e chame a galera. Leva um minuto.</p>
              <Link href={logado ? '/app' : '/auth/register'}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl px-7 py-4 text-lg font-extrabold text-[#18131f] hover:brightness-110"
                style={{ background: LIMA }}>
                {logado ? 'Abrir o Nexus' : 'Criar conta grátis'} <ArrowRight className="size-5" />
              </Link>
              <div>
                <a href={DOWNLOAD_WINDOWS} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white">
                  <Download className="size-4" /> Baixar o app para Windows
                </a>
              </div>
            </Aparecer>
          </AuroraBackground>
        </section>

        <MascoteGuia />

        <footer className="border-t border-white/10 px-4 py-8 text-center text-xs text-white/40">
          <p className="flex items-center justify-center gap-1.5"><Lock className="size-3" /> Nexus Link · nexuslink.art</p>
        </footer>
      </div>
    </MotionConfig>
  );
}
