'use client';

// Seções longas da página inicial: galeria que anda de lado com a rolagem,
// mural de lives (demonstração), comentários e perguntas.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ChevronDown, Eye, Star } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const LIMA = '#c8f53b';

// ── Galeria de detalhes (rola na vertical, anda na horizontal) ──────────
const DETALHES = [
  { emoji: '🎙️', titulo: 'Voz em tempo real', texto: 'Veja quem está falando, silencie, ensurdeça e troque de sala num clique.', cor: '#7a2cff' },
  { emoji: '📹', titulo: 'Câmera', texto: 'Ligue a câmera e veja todo mundo da call ao mesmo tempo.', cor: '#21d4fd' },
  { emoji: '🖥️', titulo: 'Live de tela', texto: 'A 60 quadros e com o som do jogo. 540p grátis, até 1080p no Pro.', cor: '#ff6a00' },
  { emoji: '💿', titulo: 'DJ na call', texto: 'Diga o nome ou cole o link da música, e o DJ toca para a sala inteira.', cor: '#ff4f79' },
  { emoji: '🎮', titulo: 'Jogando agora', texto: 'Com o app de PC, seu perfil mostra o jogo que você está jogando.', cor: '#43e3a3' },
  { emoji: '🏆', titulo: 'Placar e conquistas', texto: 'Quem mora na call, quem mais fala e quem é o DJ da mesa.', cor: '#ffc23d' },
  { emoji: '💬', titulo: 'Chat com GIFs', texto: 'Canais de texto com menções, reações e GIFs.', cor: '#b98cff' },
  { emoji: '📞', titulo: 'Chamada no privado', texto: 'Ligue direto para um amigo, sem precisar de servidor.', cor: '#3ee0ff' },
  { emoji: '🛡️', titulo: 'Moderação', texto: 'Cargos e permissões, silenciar, expulsar e banir quem atrapalha.', cor: '#ff8aa8' },
  { emoji: '⚡', titulo: 'Modo jogo', texto: 'Jogo aberto? O Nexus tira as animações para não roubar FPS.', cor: LIMA },
];

export function GaleriaDetalhes() {
  const secao = useRef<HTMLElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const [distancia, setDistancia] = useState(0);
  useLayoutEffect(() => {
    const medir = () => setDistancia(Math.max(0, (trilho.current?.scrollWidth ?? 0) - window.innerWidth));
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);
  const { scrollYProgress } = useScroll({ target: secao, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distancia]);
  const barra = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const giro = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 8, -8]);

  return (
    <section ref={secao} id="detalhes" className="relative" style={{ height: `calc(100vh + ${distancia}px)` }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-8 flex w-full max-w-6xl items-end justify-between gap-4 px-4 sm:px-8">
          <div>
            <p className="text-sm font-black tracking-[0.2em]" style={{ color: LIMA }}>DETALHES</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Tudo que tem dentro</h2>
            <div className="mt-4 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full" style={{ width: barra, background: `linear-gradient(90deg, ${LIMA}, #ff4f79)` }} />
            </div>
          </div>
          <motion.div style={{ rotate: giro }} className="hidden w-28 shrink-0 sm:block lg:w-36">
            <Image src="/mascote-notif.webp" alt="Mascote do Nexus apontando para os recursos" width={607} height={760} sizes="144px" className="h-auto w-full -scale-x-100" />
          </motion.div>
        </div>
        <motion.div ref={trilho} style={{ x }} className="flex w-max gap-5 px-4 sm:px-[max(2rem,calc((100vw-72rem)/2+2rem))]">
          {DETALHES.map((d, i) => (
            <div key={d.titulo}
              className="relative flex h-[340px] w-[270px] shrink-0 flex-col justify-end overflow-hidden rounded-3xl border border-white/10 bg-[#110a1a] p-6 sm:h-[380px] sm:w-[310px]">
              <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full opacity-40 blur-3xl" style={{ background: d.cor }} />
              <span className="nx-figurinha absolute left-6 top-6 text-6xl" style={{ animationDelay: `${i * 0.25}s` }} aria-hidden>{d.emoji}</span>
              <p className="relative text-xs font-black tracking-[0.2em] text-white/40">{String(i + 1).padStart(2, '0')}</p>
              <h3 className="relative mt-1 text-2xl font-black">{d.titulo}</h3>
              <p className="relative mt-2 text-sm text-white/70">{d.texto}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── Mural de lives (demonstração) ───────────────────────────────────────
const LIVES = [
  { fundo: '/login-cena-full.webp', titulo: 'Ranqueada valendo', avatar: '/avatar-1.webp', qualidade: '1080p · 60fps', vendo: 14, reacoes: ['🔥', '😂', '👏'] },
  { fundo: '/cadastro-bg.webp', titulo: 'Construindo a base nova', avatar: '/avatar-2.webp', qualidade: '720p · 60fps', vendo: 6, reacoes: ['😍', '🔥'] },
  { fundo: '/mascote-voz.webp', titulo: 'Bate-papo da madrugada', avatar: '/avatar-3.webp', qualidade: '540p · 60fps', vendo: 9, reacoes: ['🦉', '💬'] },
  { fundo: '/login-bg.webp', titulo: 'Speedrun na sala 2', avatar: '/avatar-2.webp', qualidade: '1080p · 60fps', vendo: 21, reacoes: ['⚡', '🏆', '🔥'] },
  { fundo: '/mascote-cena.webp', titulo: 'DJ tocando o pedido da galera', avatar: '/avatar-1.webp', qualidade: '720p · 60fps', vendo: 11, reacoes: ['🎵', '💿'] },
  { fundo: '/mascote-logo.webp', titulo: 'Primeira live no Nexus', avatar: '/avatar-3.webp', qualidade: '540p · 60fps', vendo: 4, reacoes: ['👏', '🎉'] },
];

function CartaoLive({ l, i }: { l: (typeof LIVES)[number]; i: number }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#120b1c]">
      <Image src={l.fundo} alt="" fill sizes="(min-width: 768px) 33vw, 90vw" className="object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-[#ff2d55] px-2 py-0.5 text-[11px] font-black tracking-wider">
        <span className="size-1.5 rounded-full bg-white animate-pulse" /> AO VIVO
      </span>
      <span className="absolute right-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm">{l.qualidade}</span>
      {/* Reações subindo, como na live de verdade */}
      <div className="pointer-events-none absolute bottom-12 right-4 h-24 w-8" aria-hidden>
        {l.reacoes.map((r, k) => (
          <span key={k} className="nx-reacao absolute bottom-0 text-xl" style={{ animationDelay: `${(i * 0.7 + k * 1.1) % 3}s`, left: `${(k * 9) % 18}px` }}>{r}</span>
        ))}
      </div>
      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
        <Image src={l.avatar} alt="" width={28} height={28} className="size-7 rounded-full border border-white/40 object-cover" />
        <p className="min-w-0 flex-1 truncate text-sm font-bold">{l.titulo}</p>
        <span className="inline-flex items-center gap-1 text-xs text-white/80"><Eye className="size-3.5" />{l.vendo}</span>
      </div>
    </div>
  );
}

function ColunaLives({ itens, desloc, y }: { itens: number[]; desloc: number; y: MotionValue<number> }) {
  return (
    <motion.div style={{ y }} className="space-y-4">
      {itens.map((k) => <CartaoLive key={k} l={LIVES[k]} i={k + desloc} />)}
    </motion.div>
  );
}

export function MuralLives() {
  const secao = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: secao, offset: ['start end', 'end start'] });
  const y1 = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-40, 80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [100, -40]);
  return (
    <section ref={secao} id="lives" className="mx-auto max-w-6xl overflow-hidden px-4 py-24 sm:px-8">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
        <p className="text-sm font-black tracking-[0.2em]" style={{ color: LIMA }}>LIVES</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Mostre o seu jogo para a call</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/60">É assim que uma live aparece para quem está na sala, com a qualidade do seu plano e as reações da galera.</p>
      </motion.div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        <ColunaLives itens={[0, 3]} desloc={0} y={y1} />
        <ColunaLives itens={[1, 4]} desloc={2} y={y2} />
        <ColunaLives itens={[2, 5]} desloc={4} y={y3} />
      </div>
      <p className="mt-6 text-center text-xs text-white/40">Imagens de demonstração.</p>
    </section>
  );
}

// ── Comentários de quem usa (aprovados pelo dono) ────────────────────────
type Comentario = { id: string; texto: string; nota: number; nome: string; avatarUrl: string | null };

function CartaoComentario({ c }: { c: Comentario }) {
  return (
    <figure className="w-[300px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:w-[340px]">
      <div className="flex" aria-label={`Nota ${c.nota} de 5`}>
        {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn('size-4', i < c.nota ? 'fill-[#ffc23d] text-[#ffc23d]' : 'text-white/20')} />)}
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-white/85">“{c.texto}”</blockquote>
      <figcaption className="mt-4 flex items-center gap-2.5">
        {c.avatarUrl
          ? <img src={c.avatarUrl} alt="" className="size-8 rounded-full object-cover" loading="lazy" />
          : <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-[#7a2cff] to-[#ff4f79] text-xs font-black">{c.nome.slice(0, 2).toUpperCase()}</span>}
        <span className="text-sm font-bold">{c.nome}</span>
      </figcaption>
    </figure>
  );
}

export function Comentarios() {
  const [lista, setLista] = useState<Comentario[] | null>(null);
  useEffect(() => {
    api.get('/depoimentos/publicos').then(({ data }) => setLista(Array.isArray(data) ? data : [])).catch(() => setLista([]));
  }, []);
  const metade = lista ? Math.ceil(lista.length / 2) : 0;
  const fileiras = lista && lista.length >= 4 ? [lista.slice(0, metade), lista.slice(metade)] : lista?.length ? [lista] : [];

  return (
    <section id="comentarios" className="overflow-hidden py-24">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-sm font-black tracking-[0.2em]" style={{ color: LIMA }}>COMENTÁRIOS</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Quem usa, fala</h2>
        <motion.div initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ type: 'spring', bounce: 0.5 }}
          className="nx-flutuar mx-auto mt-6 w-24 sm:w-28">
          <Image src="/mascote.webp" alt="Mascote do Nexus acenando" width={860} height={1290} sizes="112px" className="h-auto w-full" />
        </motion.div>
      </motion.div>
      {fileiras.length > 0 ? (
        <div className="mt-10 space-y-4">
          {fileiras.map((f, i) => (
            <div key={i} className="group flex w-max gap-4">
              {/* Duas cópias lado a lado para a fileira girar sem emenda */}
              {[0, 1].map((c) => (
                <div key={c} aria-hidden={c === 1 || undefined}
                  className={cn('flex gap-4 group-hover:[animation-play-state:paused]', i % 2 ? 'nx-fileira-volta' : 'nx-fileira')}>
                  {/* Poucos comentários: repete até passar da largura da tela */}
                  {Array.from({ length: Math.ceil(8 / f.length) }, () => f).flat().map((cm, k) => <CartaoComentario key={`${cm.id}-${k}`} c={cm} />)}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : lista ? (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-white/15 p-6 text-center">
          <p className="text-white/70">Os primeiros comentários de quem usa o Nexus vão aparecer aqui.</p>
          <Link href="/app/planos" className="mt-4 inline-block rounded-xl px-4 py-2 text-sm font-extrabold text-[#18131f]" style={{ background: LIMA }}>
            Já usa? Deixe o seu
          </Link>
        </div>
      ) : null}
    </section>
  );
}

// ── Perguntas frequentes ─────────────────────────────────────────────────
const PERGUNTAS = [
  { p: 'O Nexus é grátis?', r: 'Sim. O Grátis tem calls de voz e vídeo, chat, servidores, DJ, placar, conquistas e live de tela em 540p 60fps. Os planos só aumentam a qualidade da live e personalizam o perfil.' },
  { p: 'Preciso baixar alguma coisa?', r: 'Não. O Nexus funciona no navegador. No Windows tem o app de PC, com Modo jogo e o "Jogando agora". No celular, dá para instalar pelo próprio navegador.' },
  { p: 'Como assino um plano?', r: 'O pagamento pelo site está chegando. Por enquanto, quem libera os planos é o dono do Nexus.' },
  { p: 'Como funciona o Indique e ganhe?', r: 'Cada pessoa tem um link próprio na página de planos. Quando alguém que entrou pelo seu link ganha o primeiro plano pago, você ganha 30 dias de Nexus+, que somam se você já tiver plano.' },
  { p: 'Como meu comentário aparece aqui?', r: 'Escreva na página de planos, dentro do app. Ele aparece aqui com o seu nome e a sua foto depois que o dono aprova.' },
  { p: 'Minha conta é segura?', r: 'A senha é guardada com argon2 (só o resumo dela, nunca a senha em si) e você pode ligar a verificação em duas etapas nas configurações.' },
];

export function Perguntas() {
  const [aberta, setAberta] = useState<number | null>(0);
  return (
    <section id="perguntas" className="mx-auto grid max-w-5xl items-start gap-10 px-4 py-24 sm:px-8 md:grid-cols-[220px_1fr]">
      <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
        className="mx-auto w-40 md:sticky md:top-28 md:w-full">
        <Image src="/mascote-priv.webp" alt="Mascote do Nexus segurando um escudo com cadeado" width={524} height={760} sizes="220px" className="h-auto w-full" />
      </motion.div>
      <div>
      <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="text-center text-3xl font-black tracking-tight sm:text-5xl md:text-left">Perguntas frequentes</motion.h2>
      <div className="mt-10 space-y-3">
        {PERGUNTAS.map((q, i) => (
          <motion.div key={q.p} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: i * 0.05 }} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <button type="button" onClick={() => setAberta(aberta === i ? null : i)} aria-expanded={aberta === i}
              className="flex w-full items-center justify-between gap-4 p-5 text-left font-bold">
              {q.p}
              <ChevronDown className={cn('size-5 shrink-0 transition-transform', aberta === i && 'rotate-180')} />
            </button>
            <AnimatePresence initial={false}>
              {aberta === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <p className="px-5 pb-5 text-sm leading-relaxed text-white/70">{q.r}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
      </div>
    </section>
  );
}

// ── Mascote guia: fica no canto e comenta a seção que está na tela ───────
const FALAS: Record<string, string> = {
  topo: 'E aí! Rola pra baixo 👇',
  trilho: 'Arrasta o trilho, vai!',
  recursos: 'Isso aqui é a call 🎧',
  detalhes: 'Olha quanta coisa!',
  lives: 'Bora de live? 📺',
  'como-funciona': 'É rapidinho, juro.',
  planos: 'O Grátis é pra sempre, viu?',
  comentarios: 'A galera curte 💜',
  perguntas: 'Ficou alguma dúvida?',
  final: 'Te vejo na call!',
};

export function MascoteGuia() {
  const [secao, setSecao] = useState('topo');
  const [escondido, setEscondido] = useState(false);
  const { scrollY } = useScroll();
  const giro = useTransform(scrollY, (v) => Math.sin(v / 140) * 8);
  useEffect(() => {
    const obs = new IntersectionObserver((entradas) => {
      const vis = entradas.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) setSecao(vis.target.id);
    }, { threshold: [0.25, 0.5] });
    Object.keys(FALAS).forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  if (escondido) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 hidden items-end gap-2 md:flex">
      <AnimatePresence mode="wait">
        <motion.p key={secao} initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
          className="mb-16 max-w-[180px] rounded-2xl rounded-br-sm bg-white px-3 py-2 text-sm font-bold text-[#18131f] shadow-xl" role="status">
          {FALAS[secao]}
        </motion.p>
      </AnimatePresence>
      <motion.button type="button" style={{ rotate: giro }} onClick={() => setEscondido(true)}
        title="Esconder o mascote" aria-label="Esconder o mascote" className="w-24 shrink-0">
        <Image src="/mascote-notif.webp" alt="" width={607} height={760} sizes="96px" className="h-auto w-full drop-shadow-[0_10px_30px_rgba(122,44,255,0.5)]" />
      </motion.button>
    </div>
  );
}
