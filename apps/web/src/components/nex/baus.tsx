'use client';

// Baús da loja Nex: abrir só com Nex, chances à mostra, sorteio no servidor.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, ChevronDown, Clock } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { RARIDADE, ICONES, SONS, SONS_ARTE, arteDoBau, type Raridade, type TipoItem, type TipoEfeito } from '@/lib/itens';
import { EfeitoPerfil } from '@/components/nex/efeito-perfil';

const ARTE_BAUS = new Set(['bau-estreia', 'bau-aco', 'bau-neon', 'bau-som', 'bau-natal', 'bau-joias', 'bau-real', 'bau-cosmico']);
// Energia em volta de cada baú (no cartão e na hora de abrir); o de Natal tem neve e flocos
const ENERGIA: Record<string, { tipo: TipoEfeito; cores: string[] }> = {
  'bau-estreia': { tipo: 'energia', cores: ['#ff9a3d', '#ffd27a'] },
  'bau-aco': { tipo: 'energia', cores: ['#5b8cff', '#b366ff', '#9fd8ff'] },
  'bau-neon': { tipo: 'energia', cores: ['#b366ff', '#ff8a3d'] },
  'bau-som': { tipo: 'energia', cores: ['#ff5ad8', '#9b5cff', '#7fb2ff'] },
  'bau-natal': { tipo: 'natal', cores: ['#ffffff', '#d8f1ff'] },
  'bau-joias': { tipo: 'energia', cores: ['#ff2d4d', '#ff8cc6', '#b366ff'] },
  'bau-real': { tipo: 'energia', cores: ['#ffc23d', '#fff3a8', '#b366ff'] },
  'bau-cosmico': { tipo: 'energia', cores: ['#9b5cff', '#3ee0ff', '#ff9a3d'] },
};

/** Explosão de partículas na hora que o baú abre (uma vez, tela toda). */
function Explosao({ cor }: { cor: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect(), w = r.width, h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.scale(dpr, dpr);
    const cores = [cor, '#ffffff', '#ffe28a'];
    const ps = Array.from({ length: 120 }, () => {
      const a = Math.random() * 6.283, v = 140 + Math.random() * 460;
      return { x: w / 2, y: h * 0.4, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, t: 1 + Math.random() * 3, c: cores[Math.floor(Math.random() * 3)], vida: 0, max: 0.8 + Math.random() * 1 };
    });
    let raf = 0, ult = performance.now();
    const passo = (agora: number) => {
      const dt = Math.min(0.05, (agora - ult) / 1000); ult = agora;
      ctx.clearRect(0, 0, w, h); ctx.globalCompositeOperation = 'lighter';
      let vivos = 0;
      for (const p of ps) {
        p.vida += dt; if (p.vida > p.max) continue; vivos++;
        p.vx *= 1 - 1.6 * dt; p.vy = p.vy * (1 - 1.6 * dt) + 280 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const k = 1 - p.vida / p.max;
        ctx.globalAlpha = k; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.t * (0.6 + k * 0.6), 0, 6.283); ctx.fill();
      }
      if (vivos) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [cor]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 w-full h-full z-[3]" />;
}
import { Avatar } from '@/components/ui/avatar';
import { ArteIcone, NomeComItens } from '@/components/nex/itens-visuais';
import { MoedaNex, formatarNex } from '@/components/nex/moeda-nex';

interface ItemP { id: string; nome: string; tipo: TipoItem; raridade: Raridade }
interface BauLoja { id: string; nome: string; preco: number; cor: string; desc: string; ate: string | null; premios: { item: ItemP | null; nex: number | null; chance: number }[] }
interface Resultado { premio: { tipo: 'item'; item: ItemP } | { tipo: 'nex'; nex: number }; repetido: boolean; reembolso: number; saldo: number }

/** Baú desenhado em SVG (cor de cada baú, brilho e fecho). */
export function BauArte({ cor, className, aberto, id: bauId }: { cor: string; className?: string; aberto?: boolean; id?: string }) {
  // Baú com arte 3D: aberto = cresce e brilha (a arte não abre a tampa)
  if (bauId && ARTE_BAUS.has(bauId)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={arteDoBau(bauId)} alt="" aria-hidden draggable={false}
        className={cn('object-contain select-none transition-[transform,filter] duration-300', className)}
        style={aberto ? { transform: 'scale(1.08)', filter: `drop-shadow(0 0 28px ${cor})` } : undefined} />
    );
  }
  const id = cor.replace('#', 'b');
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cor} stopOpacity=".95" /><stop offset="1" stopColor="#1a1126" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1c3d" /><stop offset="1" stopColor="#120c1b" /></linearGradient>
        <linearGradient id={`${id}o`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a8" /><stop offset=".5" stopColor="#ffc23d" /><stop offset="1" stopColor="#a86b00" /></linearGradient>
        <radialGradient id={`${id}g`} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={cor} stopOpacity=".55" /><stop offset="1" stopColor={cor} stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="60" cy="90" rx="46" ry="8" fill={`url(#${id}g)`} />
      {/* corpo */}
      <rect x="18" y="46" width="84" height="40" rx="7" fill={`url(#${id}c)`} stroke={cor} strokeOpacity=".7" strokeWidth="1.5" />
      <rect x="18" y="46" width="84" height="8" fill={cor} opacity=".35" />
      {/* tampa */}
      <g style={{ transformOrigin: '60px 46px', transform: aberto ? 'rotate(-28deg) translateY(-6px)' : 'none', transition: 'transform .35s' }}>
        <path d="M18 46 V34 Q18 20 34 18 H86 Q102 20 102 34 V46 Z" fill={`url(#${id}t)`} stroke={cor} strokeWidth="1.5" />
        <path d="M30 24 Q60 16 90 24" stroke="#fff" strokeOpacity=".35" strokeWidth="2" fill="none" />
      </g>
      {/* cintas douradas e fecho */}
      <rect x="31" y="18" width="7" height="68" fill={`url(#${id}o)`} opacity=".9" />
      <rect x="82" y="18" width="7" height="68" fill={`url(#${id}o)`} opacity=".9" />
      <rect x="50" y="40" width="20" height="18" rx="4" fill={`url(#${id}o)`} stroke="#5c3a00" strokeWidth="1" />
      <path d="M57 50 l3 -4 3 4 -3 4 z" fill="#5c3a00" />
    </svg>
  );
}

function MiniPremio({ item, nex, nome, avatar }: { item: ItemP | null; nex: number | null; nome: string; avatar?: string | null }) {
  if (!item) return <span className="flex items-center gap-1 font-black text-white"><MoedaNex className="w-7 h-7" />{formatarNex(nex || 0)}</span>;
  if (item.tipo === 'moldura') return <Avatar src={avatar} name={nome} size="lg" moldura={item.id} />;
  if (item.tipo === 'icone') return <ArteIcone id={item.id} tamanho={42} />;
  if (item.tipo === 'som' && SONS_ARTE.has(item.id)) return <img src={`/itens/sons/${item.id}.webp`} alt="" className="w-11 h-11 object-contain" />;
  if (item.tipo === 'som') return <span className="text-[34px] leading-none">{SONS[item.id]}</span>;
  if (item.tipo === 'efeito') return <span className="relative block w-28 h-20 rounded-xl overflow-hidden bg-black/30"><EfeitoPerfil id={item.id} /></span>;
  return <NomeComItens nome={nome} placa={item.id} className="text-white text-sm font-black max-w-[110px]" />;
}

const faltam = (ate: string) => Math.max(0, Math.ceil((new Date(ate).getTime() - Date.now()) / 86_400_000));

/** Banner do evento (Natal) para os destaques da loja. */
export function BannerEvento({ onAbrir }: { onAbrir: () => void }) {
  const [natal, setNatal] = useState<BauLoja | null>(null);
  useEffect(() => { api.get('/loja/baus').then(({ data }) => setNatal(data.find((b: BauLoja) => b.id === 'bau-natal') || null)).catch(() => {}); }, []);
  if (!natal?.ate) return null;
  return (
    <div className="nx-bau-card relative overflow-hidden rounded-[22px] border border-white/10 mb-4 p-5 sm:p-6 flex items-center gap-4"
      style={{ background: 'radial-gradient(circle at 85% 40%, rgba(255,59,59,0.35), transparent 55%), linear-gradient(110deg, #1d0f1a, #12301e)' }}>
      <EfeitoPerfil tipo="natal" cores={['#ffffff', '#d8f1ff']} className="z-0" />
      <div className="relative z-10 min-w-0 flex-1 sm:pr-[44%]">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#ff3b3b] text-white">● Evento de Natal</span>
        <h3 className="text-white text-2xl sm:text-3xl font-black mt-2 leading-tight">O Baú de Natal chegou 🎄</h3>
        <p className="text-sm text-white/80 mt-1">Guirlanda, Pisca-pisca, gorro e boneco de neve. Só saem agora, até o Dia de Reis.</p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={onAbrir} className="h-10 px-5 rounded-full text-sm font-black text-[#120c1b] bg-[#c8f53b] hover:brightness-110">Abrir o baú</button>
          <span className="flex items-center gap-1.5 h-10 px-3 rounded-full text-xs font-black text-white border border-white/20"><Clock className="w-3.5 h-3.5" /> faltam {faltam(natal.ate)} dias</span>
        </div>
      </div>
      {/* No computador o baú ocupa a metade direita inteira do banner */}
      <span aria-hidden className="hidden sm:block absolute z-0 right-[4%] bottom-3 w-[36%] h-6 rounded-[50%] bg-black/50 blur-[10px]" />
      <BauArte id={natal.id} cor={natal.cor} className="nx-bau-arte relative z-10 w-28 h-24 shrink-0 sm:absolute sm:right-3 sm:inset-y-2 sm:w-[43%] sm:h-auto drop-shadow-[0_14px_30px_rgba(255,59,59,0.45)]" />
    </div>
  );
}

export function SecaoBaus({ onMudou }: { onMudou: () => void }) {
  const { user } = useAuthStore();
  const nome = user?.profile?.displayName || user?.username || 'Você';
  const [baus, setBaus] = useState<BauLoja[] | null>(null);
  const [chances, setChances] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<BauLoja | null>(null);
  const [fase, setFase] = useState<'tremendo' | 'revelado'>('tremendo');
  const [res, setRes] = useState<Resultado | null>(null);

  useEffect(() => { api.get('/loja/baus').then(({ data }) => setBaus(data)).catch(() => setBaus([])); }, []);

  const abrir = async (b: BauLoja) => {
    setAbrindo(b); setFase('tremendo'); setRes(null);
    try {
      const [{ data }] = await Promise.all([api.post(`/loja/baus/${b.id}/abrir`), new Promise(r => setTimeout(r, 1600))]);
      setRes(data); setFase('revelado'); onMudou();
    } catch (e: any) {
      setAbrindo(null);
      toast(e?.response?.data?.message || 'Não deu para abrir agora', 'error');
    }
  };

  const corPremio = res ? (res.premio.tipo === 'item' ? RARIDADE[res.premio.item.raridade].cor : '#ff8a3d') : '#ffffff';
  if (!baus) return <div className="grid gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">{[0, 1, 2].map(i => <div key={i} className="h-[260px] rounded-2xl nx-skeleton" />)}</div>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {baus.map(b => (
          <div key={b.id} className="nx-bau-card relative rounded-2xl border border-white/10 overflow-hidden flex flex-col"
            style={{ background: `radial-gradient(circle at 50% 30%, ${b.cor}33, transparent 60%), linear-gradient(180deg,#1b1428,#130e1c)` }}>
            {b.ate && <span className="absolute top-3 left-3 text-[10px] font-black px-2 py-1 rounded-full bg-[#ff3b3b] text-white">Natal · faltam {faltam(b.ate)} dias</span>}
            <div className="relative h-40 mt-2">
              <span aria-hidden className="nx-bau-chao absolute left-1/2 bottom-3 w-3/4 h-8 rounded-full blur-xl" style={{ background: b.cor }} />
              {ENERGIA[b.id] && <EfeitoPerfil tipo={ENERGIA[b.id].tipo} cores={ENERGIA[b.id].cores} />}
              <BauArte id={b.id} cor={b.cor} className="nx-bau-arte relative z-[1] w-full h-full px-10 pt-8 pb-4 drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]" />
            </div>
            <div className="px-4 pb-4 flex-1 flex flex-col">
              <b className="text-white text-lg font-black">{b.nome}</b>
              <small className="text-[12px] text-[#a99fc0] leading-snug">{b.desc}</small>
              <button onClick={() => setChances(chances === b.id ? null : b.id)} className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[#c9a6ff] hover:text-white self-start">
                Ver o que sai e as chances <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', chances === b.id && 'rotate-180')} />
              </button>
              {chances === b.id && (
                <div className="mt-2 grid gap-1">
                  {b.premios.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px] rounded-lg bg-black/25 px-2.5 py-1.5">
                      <span className="flex items-center gap-2 min-w-0">
                        {p.item ? <span className="font-black text-[10px] uppercase" style={{ color: RARIDADE[p.item.raridade].cor }}>◆</span> : <MoedaNex className="w-3.5 h-3.5" />}
                        <span className="text-[#e6dff0] truncate">{p.item ? p.item.nome : `${formatarNex(p.nex || 0)} Nex`}</span>
                      </span>
                      <span className="text-[#a99fc0] tabular-nums">{p.chance}%</span>
                    </div>
                  ))}
                  <p className="text-[11px] text-[#8d82a0] mt-1">Item que você já tem vira metade do valor em Nex.</p>
                </div>
              )}
              <button onClick={() => abrir(b)}
                className="mt-auto pt-0 mt-3 h-11 rounded-[13px] text-sm font-black text-white flex items-center justify-center gap-2 border border-white/10 hover:brightness-110"
                style={{ background: `linear-gradient(90deg, ${b.cor}cc, #7a2cffcc)` }}>
                Abrir <MoedaNex className="w-5 h-5" /> {formatarNex(b.preco)}
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8d82a0]">Baús abrem só com Nex, que você ganha jogando e nunca é vendido por dinheiro. O sorteio é feito no servidor do Nexus.</p>

      <AnimatePresence>
        {abrindo && (
          <motion.div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => fase === 'revelado' && setAbrindo(null)}>
            <div className="relative w-full max-w-[360px] text-center" onClick={e => e.stopPropagation()}>
              {fase === 'revelado' && (
                <button onClick={() => setAbrindo(null)} aria-label="Fechar" className="absolute -top-2 right-0 text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
              )}
              <div className="relative h-48">
                {fase === 'tremendo' ? (
                  // Energia juntando no baú enquanto ele treme
                  <motion.div aria-hidden className="absolute left-1/2 top-1/2 w-72 h-72 rounded-full pointer-events-none"
                    style={{ x: '-50%', y: '-50%', background: `radial-gradient(circle, ${abrindo.cor}aa, ${abrindo.cor}00 65%)` }}
                    animate={{ scale: [0.5, 1.15, 0.8, 1.3], opacity: [0.3, 0.9, 0.6, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
                ) : (
                  // Raios de luz girando atrás, na cor da raridade
                  <motion.div aria-hidden className="absolute left-1/2 top-1/2 w-[560px] h-[560px] rounded-full pointer-events-none"
                    style={{ x: '-50%', y: '-50%', background: `repeating-conic-gradient(from 0deg, ${corPremio}66 0deg 7deg, transparent 7deg 22deg)`,
                      WebkitMaskImage: 'radial-gradient(circle, #000 15%, transparent 62%)', maskImage: 'radial-gradient(circle, #000 15%, transparent 62%)' }}
                    initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: 1, rotate: 360 }}
                    transition={{ rotate: { duration: 16, repeat: Infinity, ease: 'linear' }, default: { duration: 0.5 } }} />
                )}
                {ENERGIA[abrindo.id] && <EfeitoPerfil tipo={ENERGIA[abrindo.id].tipo} cores={ENERGIA[abrindo.id].cores} />}
                <motion.div className="relative z-[1] h-full"
                  animate={fase === 'tremendo' ? { rotate: [0, -6, 6, -8, 8, -4, 4, 0], scale: [1, 1.04, 1, 1.06, 1] } : { scale: 0.75, y: 30, opacity: 0.6 }}
                  transition={fase === 'tremendo' ? { duration: 0.8, repeat: Infinity } : { duration: 0.4 }}>
                  <BauArte id={abrindo.id} cor={abrindo.cor} aberto={fase === 'revelado'} className="w-full h-full px-10 py-6 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
                </motion.div>
              </div>
              {fase === 'revelado' && res && <>
                <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[2]" style={{ background: `radial-gradient(circle at 50% 40%, #ffffff, ${corPremio}88 35%, transparent 70%)` }}
                  initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                <Explosao cor={corPremio} />
              </>}
              {fase === 'tremendo' ? (
                <p className="text-white/80 font-black mt-2 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o {abrindo.nome}…</p>
              ) : res && (
                <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="relative z-[4] -mt-8 rounded-[22px] border p-5"
                  style={{
                    borderColor: res.premio.tipo === 'item' ? RARIDADE[res.premio.item.raridade].cor : '#ff8a3d',
                    background: res.premio.tipo === 'item' ? RARIDADE[res.premio.item.raridade].fundo : 'linear-gradient(180deg,#2a1638,#160f20)',
                    boxShadow: `0 0 40px ${res.premio.tipo === 'item' ? RARIDADE[res.premio.item.raridade].cor : '#ff6a00'}55`,
                  }}>
                  {res.premio.tipo === 'item' && (
                    <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: RARIDADE[res.premio.item.raridade].cor }}>◆ {RARIDADE[res.premio.item.raridade].nome}</p>
                  )}
                  <div className="h-24 grid place-items-center">
                    <MiniPremio item={res.premio.tipo === 'item' ? res.premio.item : null} nex={res.premio.tipo === 'nex' ? res.premio.nex : null} nome={nome} avatar={user?.profile?.avatarUrl} />
                  </div>
                  <b className="block text-white text-xl font-black">
                    {res.premio.tipo === 'item' ? res.premio.item.nome : `+${formatarNex(res.premio.nex)} Nex`}
                  </b>
                  {res.repetido && <p className="text-sm text-[#ffb070] mt-1">Você já tinha: virou +{formatarNex(res.reembolso)} Nex</p>}
                  {res.premio.tipo === 'item' && !res.repetido && <p className="text-sm text-[#3ddc84] mt-1">É seu! Use em Loja → Meus itens.</p>}
                  <p className="text-xs text-[#a99fc0] mt-3 flex items-center justify-center gap-1">Saldo: <MoedaNex className="w-4 h-4" /> {formatarNex(res.saldo)}</p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setAbrindo(null)} className="flex-1 h-10 rounded-[12px] text-sm font-black text-white bg-white/10 hover:bg-white/15">Fechar</button>
                    <button onClick={() => abrir(abrindo)} className="flex-1 h-10 rounded-[12px] text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]">Abrir outro</button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
