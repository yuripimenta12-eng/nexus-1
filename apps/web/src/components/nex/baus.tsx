'use client';

// Baús da loja Nex: abrir só com Nex, chances à mostra, sorteio no servidor.
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, ChevronDown, Clock } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { RARIDADE, ICONES, SONS, SONS_ARTE, arteDoBau, type Raridade, type TipoItem } from '@/lib/itens';

const ARTE_BAUS = new Set(['bau-estreia', 'bau-neon', 'bau-som', 'bau-natal']);
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
  return <NomeComItens nome={nome} placa={item.id} className="text-white text-sm font-black max-w-[110px]" />;
}

const faltam = (ate: string) => Math.max(0, Math.ceil((new Date(ate).getTime() - Date.now()) / 86_400_000));

/** Banner do evento (Natal) para os destaques da loja. */
export function BannerEvento({ onAbrir }: { onAbrir: () => void }) {
  const [natal, setNatal] = useState<BauLoja | null>(null);
  useEffect(() => { api.get('/loja/baus').then(({ data }) => setNatal(data.find((b: BauLoja) => b.id === 'bau-natal') || null)).catch(() => {}); }, []);
  if (!natal?.ate) return null;
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/10 mb-4 p-5 sm:p-6 flex items-center gap-4"
      style={{ background: 'radial-gradient(circle at 85% 40%, rgba(255,59,59,0.35), transparent 55%), linear-gradient(110deg, #1d0f1a, #12301e)' }}>
      <div className="relative z-10 min-w-0 flex-1">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#ff3b3b] text-white">● Evento de Natal</span>
        <h3 className="text-white text-2xl sm:text-3xl font-black mt-2 leading-tight">O Baú de Natal chegou 🎄</h3>
        <p className="text-sm text-white/80 mt-1">Guirlanda, Pisca-pisca, gorro e boneco de neve. Só saem agora, até o Dia de Reis.</p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button onClick={onAbrir} className="h-10 px-5 rounded-full text-sm font-black text-[#120c1b] bg-[#c8f53b] hover:brightness-110">Abrir o baú</button>
          <span className="flex items-center gap-1.5 h-10 px-3 rounded-full text-xs font-black text-white border border-white/20"><Clock className="w-3.5 h-3.5" /> faltam {faltam(natal.ate)} dias</span>
        </div>
      </div>
      <BauArte id={natal.id} cor={natal.cor} className="relative z-10 w-28 h-24 sm:w-40 sm:h-32 shrink-0 drop-shadow-[0_14px_30px_rgba(255,59,59,0.35)]" />
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

  if (!baus) return <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-[260px] rounded-2xl nx-skeleton" />)}</div>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {baus.map(b => (
          <div key={b.id} className="relative rounded-2xl border border-white/10 overflow-hidden flex flex-col"
            style={{ background: `radial-gradient(circle at 50% 30%, ${b.cor}33, transparent 60%), linear-gradient(180deg,#1b1428,#130e1c)` }}>
            {b.ate && <span className="absolute top-3 left-3 text-[10px] font-black px-2 py-1 rounded-full bg-[#ff3b3b] text-white">Natal · faltam {faltam(b.ate)} dias</span>}
            <BauArte id={b.id} cor={b.cor} className="w-40 h-32 mx-auto mt-4 drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]" />
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
              <motion.div
                animate={fase === 'tremendo' ? { rotate: [0, -6, 6, -8, 8, -4, 4, 0], scale: [1, 1.04, 1, 1.06, 1] } : { scale: 0.75, y: 30, opacity: 0.6 }}
                transition={fase === 'tremendo' ? { duration: 0.8, repeat: Infinity } : { duration: 0.4 }}>
                <BauArte id={abrindo.id} cor={abrindo.cor} aberto={fase === 'revelado'} className="w-56 h-44 mx-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]" />
              </motion.div>
              {fase === 'tremendo' ? (
                <p className="text-white/80 font-black mt-2 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o {abrindo.nome}…</p>
              ) : res && (
                <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                  className="-mt-8 rounded-[22px] border p-5"
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
