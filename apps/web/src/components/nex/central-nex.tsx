'use client';

// Central de recompensas Nex: Presença Nexus (7 dias), Roleta do dia e Missões.
// O servidor decide tudo (dia, prêmio, missão cumprida); aqui só mostra e anima.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, Flame, Gift, Store } from 'lucide-react';
import { useNex, type MissaoNex } from '@/lib/nex';
import { MoedaNex, formatarNex } from '@/components/nex/moeda-nex';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const ABAS = [
  { id: 'presenca', nome: 'Presença' },
  { id: 'roleta', nome: 'Roleta' },
  { id: 'missoes', nome: 'Missões' },
] as const;

export function CentralNex() {
  const { dados, aberta, aba, fechar } = useNex();
  const [ganho, setGanho] = useState<{ nex: number; em: number } | null>(null);
  const comemorar = (nex: number) => { setGanho({ nex, em: Date.now() }); setTimeout(() => setGanho(null), 1800); };

  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberta, fechar]);

  const avisoAba = (id: string) => {
    if (!dados) return false;
    if (id === 'presenca') return !dados.presenca.pegouHoje;
    if (id === 'roleta') return dados.roleta.girosRestantes > 0;
    return dados.missoes.some(m => !m.resgatada && m.progresso >= m.meta);
  };

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={fechar}>
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-label="Recompensas Nex"
            className="relative w-full max-w-[720px] max-h-[calc(100dvh-24px)] overflow-y-auto nx-no-scrollbar rounded-[24px] border border-[#3a2a4d] bg-[#110c1a] shadow-[0_30px_90px_rgba(0,0,0,0.65)]"
          >
            {/* Topo: abas + saldo */}
            <div className="sticky top-0 z-10 flex items-center gap-2 p-3 border-b border-[#241a33] bg-[#110c1a]/95 backdrop-blur">
              <div className="flex gap-1 p-1 rounded-[14px] bg-[#1a1326]" role="tablist">
                {ABAS.map(a => (
                  <button key={a.id} role="tab" aria-selected={aba === a.id}
                    onClick={() => useNex.setState({ aba: a.id })}
                    className={cn('relative px-3.5 sm:px-4 py-2 rounded-[10px] text-[13px] font-black transition-colors',
                      aba === a.id ? 'bg-[#2a1c45] text-white' : 'text-[#a99fc0] hover:text-white')}>
                    {a.nome}
                    {avisoAba(a.id) && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ff8a3d]" />}
                  </button>
                ))}
              </div>
              <a href="/app/loja" onClick={fechar}
                className="ml-auto hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-black text-[#c9a6ff] border border-[#4d3560] hover:text-white hover:border-[#8b48ff]">
                <Store className="w-3.5 h-3.5" /> Loja
              </a>
              <div className="ml-auto sm:ml-0 flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-full bg-[#1a1326] border border-[#2e2340]">
                <MoedaNex className="w-6 h-6" />
                <b className="text-white text-sm tabular-nums">{dados ? formatarNex(dados.saldo) : '…'}</b>
                <span className="text-[11px] text-[#a99fc0] font-bold">Nex</span>
              </div>
              <button onClick={fechar} aria-label="Fechar" className="w-9 h-9 rounded-full grid place-items-center text-[#a99fc0] hover:text-white hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!dados ? (
              <div className="h-[380px] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-[#8b48ff]" /></div>
            ) : aba === 'presenca' ? (
              <Presenca onGanhou={comemorar} />
            ) : aba === 'roleta' ? (
              <Roleta onGanhou={comemorar} />
            ) : (
              <Missoes onGanhou={comemorar} />
            )}

            {/* "+20 Nex" subindo quando ganha */}
            <AnimatePresence>
              {ganho && (
                <motion.div key={ganho.em} aria-live="polite"
                  initial={{ opacity: 0, y: 20, scale: 0.8 }} animate={{ opacity: 1, y: -10, scale: 1 }} exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.5 }}
                  className="pointer-events-none absolute z-20 inset-x-0 top-[22%] mx-auto w-max flex flex-col items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/itens/mascote-recompensa.webp" alt="" className="w-40 h-40 object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.5)] -mb-4" />
                  <span className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-xl font-black shadow-[0_12px_40px_rgba(255,106,0,0.35)]"
                    style={{ background: 'linear-gradient(90deg, #ff6a00, #7a2cff)' }}>
                    <MoedaNex className="w-7 h-7" /> +{formatarNex(ganho.nex)} Nex
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Cartão "Presença de hoje" para a tela inicial: some depois de pegar. */
export function BannerPresenca() {
  const { dados, pegarPresenca, abrir } = useNex();
  const [pegando, setPegando] = useState(false);
  const [ganhou, setGanhou] = useState<number | null>(null);
  if (!dados || (dados.presenca.pegouHoje && ganhou === null)) return null;
  const p = dados.presenca;
  const valor = ganhou ?? p.valores[p.dia - 1];
  const pegar = async () => {
    setPegando(true);
    try { setGanhou(await pegarPresenca()); setTimeout(() => setGanhou(null), 2500); } catch (e: any) { toast(e.message, 'error'); }
    setPegando(false);
  };
  return (
    <div className="px-3 sm:px-5 pt-4 shrink-0">
      <div className="relative overflow-hidden rounded-[20px] flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-white/10"
        style={{ background: 'linear-gradient(110deg, #7a2cff 0%, #b142f5 45%, #ff6a00 100%)' }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_120%,rgba(0,0,0,0.35),transparent_55%)]" />
        <MoedaNex className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0" />
        <div className="relative min-w-0 flex-1">
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[1.5px] text-white/85">Presença de hoje · dia {p.dia} de 7</p>
          <p className="text-white text-2xl sm:text-3xl font-black leading-tight">+{valor} <span className="text-base sm:text-lg">Nex</span></p>
          <div className="flex items-center gap-1 mt-1" aria-hidden>
            {p.valores.map((_, i) => (
              <span key={i} className={cn('rounded-full', i + 1 === p.dia ? 'w-2.5 h-2.5 bg-white' : i + 1 < p.dia ? 'w-2 h-2 bg-white/80' : 'w-2 h-2 bg-white/30')} />
            ))}
            <button onClick={() => abrir('presenca')} className="ml-2 text-[11px] font-bold text-white/90 hover:text-white underline-offset-2 hover:underline">
              Cada dia vale mais
            </button>
          </div>
        </div>
        <button onClick={pegar} disabled={pegando || ganhou !== null}
          className="relative shrink-0 h-11 px-5 rounded-full bg-[#110c1a] text-white text-sm font-black hover:bg-black active:scale-95 transition disabled:opacity-80">
          {pegando ? <Loader2 className="w-4 h-4 animate-spin" /> : ganhou !== null ? 'Pegou!' : 'Pegar'}
        </button>
      </div>
    </div>
  );
}

function BonusPlano() {
  const dados = useNex(s => s.dados)!;
  return dados.plano === 'gratis'
    ? <span className="text-[12px] text-[#a99fc0]">Nexus+ ganha <b className="text-white">+25%</b> e Pro <b className="text-white">+50%</b> em presença e missões</span>
    : <span className="text-[12px] text-[#ffb070] font-bold">Seu bônus {dados.plano === 'pro' ? 'Pro' : 'Nexus+'}: +{Math.round((dados.bonus - 1) * 100)}% já incluído</span>;
}

function Presenca({ onGanhou }: { onGanhou: (n: number) => void }) {
  const { dados, pegarPresenca } = useNex();
  const [pegando, setPegando] = useState(false);
  const p = dados!.presenca;
  const pegar = async () => {
    setPegando(true);
    try { onGanhou(await pegarPresenca()); } catch (e: any) { toast(e.message, 'error'); }
    setPegando(false);
  };
  const proximoValor = p.valores[p.pegouHoje ? (p.dia % 7) : p.dia - 1];

  return (
    <div className="px-4 sm:px-6 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/itens/banner-presenca.webp" alt="Presença Nexus: sua presença vale Nex" className="w-full max-w-[520px] mx-auto aspect-[16/9] object-cover rounded-[18px] border border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.45)]" />
      <h2 className="text-center text-3xl font-black text-white mt-4">Dia {p.dia} de 7</h2>
      <p className="text-center text-sm text-[#a99fc0] mt-1.5 max-w-[460px] mx-auto">
        Apareça todo dia: cada dia seguido vale mais e o sétimo é o grande. Faltou um dia, recomeça do 1.
      </p>
      {p.sequencia > 0 && (
        <p className="flex items-center justify-center gap-1.5 text-sm font-black text-[#ff8a3d] mt-2">
          <Flame className="w-4 h-4" /> {p.sequencia} {p.sequencia === 1 ? 'dia seguido' : 'dias seguidos'}
        </p>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mt-5">
        {p.valores.map((v, i) => {
          const n = i + 1;
          const feito = n < p.dia || (n === p.dia && p.pegouHoje);
          const hoje = n === p.dia && !p.pegouHoje;
          const grande = n === 7;
          return (
            <div key={n} className={cn(
              'relative rounded-[16px] border text-center py-3 px-1 transition-all',
              grande && 'col-span-4 sm:col-span-1',
              hoje ? 'border-[#ff8a3d] bg-gradient-to-b from-[#2d1638] to-[#1a1326] shadow-[0_0_24px_rgba(255,106,0,0.2)]'
                : grande ? 'border-[#8b48ff] bg-gradient-to-b from-[#2e1a4d] to-[#1a1326]'
                : 'border-[#2e2340] bg-[#1a1326]',
              feito && 'opacity-55',
            )}>
              <div className={cn('text-[10px] font-black uppercase tracking-wider', hoje ? 'text-white' : grande ? 'text-[#c9a6ff]' : 'text-[#8d82a0]')}>
                {hoje ? 'Hoje' : `Dia ${n}`}
              </div>
              <div className="my-2 flex justify-center">
                {feito ? <span className="w-9 h-9 rounded-full grid place-items-center bg-[#2a1c45] text-[#3ddc84]"><Check className="w-5 h-5" /></span>
                  : grande ? <span className="relative"><MoedaNex className="w-11 h-11" /><Gift className="w-4 h-4 absolute -right-2 -bottom-1 text-[#ffb070]" /></span>
                  : <MoedaNex className="w-9 h-9" />}
              </div>
              <b className={cn('text-[15px] tabular-nums', grande ? 'text-[#ffd08a]' : 'text-white')}>+{v}</b>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-2 mt-6">
        <button onClick={pegar} disabled={p.pegouHoje || pegando}
          className="h-12 min-w-[240px] px-6 rounded-[14px] text-[15px] font-black text-white flex items-center justify-center gap-2
                     bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:brightness-110 active:scale-[0.98] transition
                     disabled:opacity-50 disabled:active:scale-100">
          {pegando ? <Loader2 className="w-5 h-5 animate-spin" /> : <MoedaNex className="w-6 h-6" />}
          {p.pegouHoje ? `Volte amanhã: +${proximoValor} Nex` : `Pegar +${proximoValor} Nex`}
        </button>
        <BonusPlano />
      </div>
    </div>
  );
}

// Fatias da roleta: cada prêmio aparece em mais fatias quanto maior a chance
const FATIAS_POR_CHANCE = (chance: number) => (chance >= 25 ? 3 : chance >= 13 ? 2 : 1);
const CORES = ['#241a33', '#2a1c45', '#1f1630'];

function Roleta({ onGanhou }: { onGanhou: (n: number) => void }) {
  const { dados, girar, carregar } = useNex();
  const r = dados!.roleta;
  const [rot, setRot] = useState(0);
  const [girando, setGirando] = useState(false);
  const [resultado, setResultado] = useState<string>('');
  const fim = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fim.current), []);

  const fatias = useMemo(() => {
    const lista: { premio: number; nex: number }[] = [];
    r.premios.forEach((p, i) => { for (let k = 0; k < FATIAS_POR_CHANCE(p.chance); k++) lista.push({ premio: i, nex: p.nex }); });
    // espalha: intercala para os iguais não ficarem juntos
    const out: typeof lista = [];
    const grupos = r.premios.map((_, i) => lista.filter(f => f.premio === i));
    while (grupos.some(g => g.length)) grupos.forEach(g => { const f = g.shift(); if (f) out.push(f); });
    return out;
  }, [r.premios]);

  const N = fatias.length, R = 96;
  const girarAgora = async () => {
    setGirando(true); setResultado('');
    try {
      const { indice, ganhou } = await girar();
      const opcoes = fatias.map((f, i) => (f.premio === indice ? i : -1)).filter(i => i >= 0);
      const alvo = opcoes[Math.floor(Math.random() * opcoes.length)];
      const centro = ((alvo + 0.5) / N) * 360;
      const proxima = rot - (rot % 360) + 360 * 6 + (360 - centro);
      setRot(proxima);
      fim.current = setTimeout(() => {
        setGirando(false);
        setResultado(`Saiu +${ganhou} Nex!`);
        onGanhou(ganhou);
        carregar();
      }, 4700);
    } catch (e: any) { setGirando(false); toast(e.message, 'error'); }
  };

  return (
    <div className="px-4 sm:px-6 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/itens/banner-roleta.webp" alt="Roleta do dia: seu giro, sua recompensa" className="w-full max-w-[520px] mx-auto aspect-[16/9] object-cover rounded-[18px] border border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.45)]" />
      <p className="text-center text-sm text-[#a99fc0] mt-3">
        {r.giros > 1 ? `${r.giros} giros grátis por dia (Pro).` : 'Um giro grátis por dia. Pro gira 2 vezes.'} A roleta nunca é vendida.
      </p>

      <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] mx-auto mt-5">
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]" />
        <svg viewBox="0 0 200 200" className="w-full h-full" aria-label="Roleta">
          <defs>
            <linearGradient id="nx-roleta-aro" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff6a00" /><stop offset="1" stopColor="#7a2cff" />
            </linearGradient>
          </defs>
          <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: '100px 100px', transition: girando ? 'transform 4.6s cubic-bezier(.15,.7,.1,1)' : 'none' }}>
            {fatias.map((f, i) => {
              const a0 = (i / N) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / N) * 2 * Math.PI - Math.PI / 2;
              const x0 = 100 + R * Math.cos(a0), y0 = 100 + R * Math.sin(a0), x1 = 100 + R * Math.cos(a1), y1 = 100 + R * Math.sin(a1);
              const am = (a0 + a1) / 2, raro = f.nex >= 150;
              return (
                <g key={i}>
                  <path d={`M100 100 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={raro ? (f.nex >= 300 ? '#ff6a00' : '#7a2cff') : CORES[i % 3]} stroke="#110c1a" strokeWidth="1.2" />
                  <image href="/itens/moeda-nex.webp" x={100 + 84 * Math.cos(am) - 4.5} y={100 + 84 * Math.sin(am) - 4.5} width="9" height="9" />
                  <text x={100 + 62 * Math.cos(am)} y={100 + 62 * Math.sin(am)} fill="#fff" fontSize={raro ? 12 : 11} fontWeight={900}
                    textAnchor="middle" dominantBaseline="central" transform={`rotate(${(am * 180) / Math.PI + 90} ${100 + 62 * Math.cos(am)} ${100 + 62 * Math.sin(am)})`}>
                    {f.nex}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r={R} fill="none" stroke="url(#nx-roleta-aro)" strokeWidth="4" />
          </g>
          <circle cx="100" cy="100" r="17" fill="#110c1a" stroke="url(#nx-roleta-aro)" strokeWidth="3" />
        </svg>
        <MoedaNex className="w-9 h-9 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="flex flex-col items-center gap-2 mt-5">
        <button onClick={girarAgora} disabled={girando || r.girosRestantes <= 0}
          className="h-12 min-w-[220px] px-6 rounded-[14px] text-[15px] font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50">
          {girando ? 'Girando…' : r.girosRestantes > 0 ? `Girar a roleta${r.giros > 1 ? ` (${r.girosRestantes})` : ''}` : 'Próximo giro amanhã'}
        </button>
        <p className="h-6 text-[15px] font-black text-[#ffb070]" aria-live="polite">{resultado}</p>
        <details className="text-[12px] text-[#8d82a0] max-w-[420px] text-center">
          <summary className="cursor-pointer hover:text-white">Como funciona o sorteio</summary>
          <p className="mt-1.5">O sorteio é feito no servidor do Nexus. Chances: {r.premios.map(p => `${p.nex} Nex ${p.chance}%`).join(' · ')}.</p>
        </details>
      </div>
    </div>
  );
}

// Ícone 3D de cada missão (public/itens/icones); missão nova sem arte usa o emoji do servidor
const ARTE_MISSAO: Record<string, string> = {
  'call-1h': 'i-microfone', 'chat-10': 'i-chat', 'unidos-dia': 'i-gamepad', foto: 'i-camera', amigo: 'i-telefone',
  servidor: 'i-monitor', 'primeira-call': 'i-mic', 'presenca-7': 'i-fogo', 'unidos-10': 'i-taca', maratona: 'i-velocimetro',
};

function Missoes({ onGanhou }: { onGanhou: (n: number) => void }) {
  const { dados, resgatar } = useNex();
  const [resgatando, setResgatando] = useState<string | null>(null);
  const dia = dados!.missoes.filter(m => m.tipo === 'dia');
  const sempre = dados!.missoes.filter(m => m.tipo === 'sempre');
  const pegar = async (m: MissaoNex) => {
    setResgatando(m.id);
    try { onGanhou(await resgatar(m.id)); } catch (e: any) { toast(e.message, 'error'); }
    setResgatando(null);
  };
  const Lista = ({ itens }: { itens: MissaoNex[] }) => (
    <div className="grid gap-2">
      {itens.map(m => {
        const pronta = m.progresso >= m.meta;
        return (
          <div key={m.id} className={cn('flex items-center gap-3 rounded-[16px] border p-3',
            pronta && !m.resgatada ? 'border-[#ff8a3d]/60 bg-gradient-to-r from-[#2a1638] to-[#1a1326]' : 'border-[#2e2340] bg-[#1a1326]')}>
            <span className="w-11 h-11 rounded-[12px] grid place-items-center text-lg bg-[#2a1c45] shrink-0" aria-hidden>
              {ARTE_MISSAO[m.id]
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/itens/icones/${ARTE_MISSAO[m.id]}.webp`} alt="" className="w-8 h-8 object-contain drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]" />
                : m.icone}
            </span>
            <div className="flex-1 min-w-0">
              <b className={cn('block text-sm', m.resgatada ? 'text-[#8d82a0]' : 'text-white')}>{m.titulo}</b>
              <small className="block text-[11px] text-[#8d82a0]">{m.desc}</small>
              <div className="h-1.5 mt-1.5 rounded-full bg-[#2e2340] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]" style={{ width: `${Math.round((m.progresso / m.meta) * 100)}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              {m.resgatada ? (
                <span className="flex items-center gap-1 text-[12px] font-black text-[#3ddc84]"><Check className="w-4 h-4" /> Feita</span>
              ) : pronta ? (
                <button onClick={() => pegar(m)} disabled={resgatando === m.id}
                  className="h-9 px-3 rounded-[11px] text-[12px] font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] flex items-center gap-1.5 disabled:opacity-60">
                  {resgatando === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MoedaNex className="w-4 h-4" />} +{m.nex}
                </button>
              ) : (
                <span className="flex flex-col items-end">
                  <span className="flex items-center gap-1 text-[12px] font-black text-[#c9a6ff]"><MoedaNex className="w-4 h-4" /> +{m.nex}</span>
                  <span className="text-[11px] text-[#8d82a0] tabular-nums">{m.progresso}/{m.meta}</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-[1.5px] text-[#ffb070]">Hoje</p>
          <span className="text-[11px] text-[#8d82a0]">Renova à meia-noite</span>
        </div>
        <Lista itens={dia} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black uppercase tracking-[1.5px] text-[#ffb070]">Pra sempre</p>
          <span className="text-[11px] text-[#8d82a0]">Uma vez só</span>
        </div>
        <Lista itens={sempre} />
      </div>
      <div className="flex justify-center"><BonusPlano /></div>
    </div>
  );
}
