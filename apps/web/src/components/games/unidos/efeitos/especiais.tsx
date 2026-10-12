'use client';

import { useEffect, useMemo, type FC, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Shield, Headphones, Zap, Repeat2, Trophy } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { CartaView, COR_HEX, IconeCor } from '../carta';
import type { Carta, Cor } from '../unidos.store';
import { audio, vibrar } from './audio';
import { useModoEfeitos, type ModoEfeitos } from './config';
import { useFilaEfeitos, type Efeito } from './fila';
import { particulas, PALETAS } from './particulas';
import { pontoJogador, pontoMesa, type Ponto } from './posicoes';
import { REGISTRO, type DefinicaoEfeito } from './registro';
import { useTremor } from './tremor';
import { voos } from './voos';

// Animações das cartas especiais. Cada uma é um componente que recebe o
// efeito da fila e desenha por cima da mesa (sem bloquear cliques). O som,
// a vibração, a tremida e as partículas do impacto ficam no invólucro
// (CamadaEspeciais), lidos do registro.

export interface PropsEspecial {
  ef: Efeito;
  def: DefinicaoEfeito;
  modo: ModoEfeitos;
  meuId: string;
  nome: (id?: string | null) => string;
  d: number;       // duração em segundos
  centro: Ponto;   // centro da mesa (pilha)
}

const SUAVE = [0.22, 1, 0.36, 1] as const;

// ── Peças reaproveitadas ─────────────────────────────────────────────
function Escurecer({ d, forca = 0.55 }: { d: number; forca?: number }) {
  return (
    <motion.div className="fixed inset-0 bg-[#05030a]"
      initial={{ opacity: 0 }} animate={{ opacity: [0, forca, forca, 0] }}
      transition={{ duration: d, times: [0, 0.15, 0.8, 1] }} />
  );
}

function NoPonto({ p, children, className }: { p: Ponto; children: ReactNode; className?: string }) {
  return <div className={`fixed ${className || ''}`} style={{ left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}>{children}</div>;
}

function CartaHeroi({ carta, cor, d, centro, brilho }: { carta: Carta; cor?: Cor | null; d: number; centro: Ponto; brilho: string }) {
  const larg = Math.min(200, Math.round(window.innerWidth * 0.36));
  return (
    <NoPonto p={{ ...centro, y: centro.y - 10 }}>
      <motion.div className="relative"
        initial={{ scale: 0.4, opacity: 0, rotate: -8 }}
        animate={{ scale: [0.4, 1.18, 1.05, 0.85], opacity: [0, 1, 1, 0], rotate: [-8, 3, 0, 0] }}
        transition={{ duration: d, times: [0, 0.3, 0.75, 1], ease: SUAVE }}>
        <div className="absolute -inset-8 rounded-[40px] blur-2xl opacity-80" style={{ background: brilho }} />
        <CartaView carta={carta} tamanho={larg} corEscolhida={cor} />
      </motion.div>
    </NoPonto>
  );
}

function Faixa({ texto, sub, cor, d, p, atraso = 0.12, tamanho = 34 }: { texto: string; sub?: ReactNode; cor: string; d: number; p: Ponto; atraso?: number; tamanho?: number }) {
  return (
    <NoPonto p={p} className="text-center whitespace-nowrap">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 10 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.7, 1.08, 1, 1], y: [10, 0, 0, -8] }}
        transition={{ duration: d - atraso, delay: atraso, times: [0, 0.2, 0.8, 1] }}>
        <div className="font-black italic tracking-wide leading-none" style={{
          fontSize: Math.min(tamanho, window.innerWidth / 11), color: '#fff',
          textShadow: `0 0 18px ${cor}, 0 0 4px ${cor}, 0 3px 0 #0a0713`,
        }}>{texto}</div>
        {sub && <div className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold px-3 py-1 rounded-full bg-black/60 border border-white/10 text-white">{sub}</div>}
      </motion.div>
    </NoPonto>
  );
}

function ChipCor({ cor }: { cor: Cor }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-3.5 h-3.5 rounded-full grid place-items-center" style={{ background: COR_HEX[cor].base }}>
        <IconeCor cor={cor} className="w-2.5 h-2.5" style={{ color: cor === 'prata' || cor === 'dourado' ? '#1a1406' : '#fff' }} />
      </span>
      {COR_HEX[cor].nome}
    </span>
  );
}

// Versão curta (efeitos reduzidos / menos movimento): só o aviso, sem voos
function Aviso({ ef, def, d, centro, nome }: PropsEspecial) {
  const icones: Record<string, typeof Lock> = { bloqueio: Shield, troca: Repeat2, mais2: Zap, call: Headphones, conexao: Zap, todosunidos: Zap, vitoria: Trophy };
  const I = icones[ef.chave] || Zap;
  const t = textos(ef, nome);
  return (
    <NoPonto p={{ ...centro, y: centro.y - centro.h * 0.75 - 20 }} className="text-center">
      <motion.div className="inline-flex flex-col items-center gap-1 px-4 py-2 rounded-2xl bg-black/75 border"
        style={{ borderColor: def.corPrincipal }}
        initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: d, times: [0, 0.15, 0.8, 1] }}>
        <span className="flex items-center gap-2 font-black text-[16px]" style={{ color: def.corPrincipal }}><I className="w-4 h-4" aria-hidden /> {t.titulo}</span>
        {t.sub && <span className="text-[12px] text-white/85">{t.sub}</span>}
      </motion.div>
    </NoPonto>
  );
}

// Textos de cada efeito (também usados no aviso para leitor de tela)
export function textos(ef: Efeito, nome: (id?: string | null) => string): { titulo: string; sub?: string } {
  const x = ef.dados;
  const voce = (id?: string | null) => nome(id);
  switch (ef.chave) {
    case 'bloqueio': return { titulo: 'TURNO BLOQUEADO', sub: x.alvoId ? `${voce(x.alvoId)} perdeu a vez` : undefined };
    case 'troca': return x.doisJogadores
      ? { titulo: 'JOGA DE NOVO!', sub: `${voce(x.jogadorId)} inverteu o sentido` }
      : { titulo: 'SENTIDO INVERTIDO', sub: `${voce(x.jogadorId)} jogou Troca` };
    case 'mais2': return { titulo: `+${x.qtd && x.qtd > 2 ? x.qtd : 2}`, sub: x.alvoId ? `${voce(x.alvoId)} ${x.qtd && x.qtd > 2 ? 'está com o acumulado' : 'compra 2 ou devolve'}` : undefined };
    case 'call': return { titulo: 'CALL', sub: x.alvoId ? `${voce(x.jogadorId)} chamou ${voce(x.alvoId)}` : undefined };
    case 'conexao': return { titulo: 'CONEXÃO', sub: x.cor ? `Nova cor: ${COR_HEX[x.cor].nome}` : undefined };
    case 'todosunidos': return { titulo: 'TODOS UNIDOS', sub: x.alvoId ? `${voce(x.jogadorId)} → ${voce(x.alvoId)} +${x.qtd && x.qtd > 4 ? x.qtd : 4}` : undefined };
    case 'vitoria': return { titulo: 'VITÓRIA!', sub: x.vencedorId ? voce(x.vencedorId) : undefined };
    default: return { titulo: REGISTRO[ef.chave]?.nome || '' };
  }
}

// ── Bloqueio: escudo holográfico no avatar de quem foi pulado ──────────
const Bloqueio: FC<PropsEspecial> = ({ ef, d, nome }) => {
  const alvo = pontoJogador(ef.dados.alvoId);
  if (!alvo) return null;
  const tam = Math.max(96, Math.max(alvo.w, alvo.h) * 1.25);
  return (
    <>
      <NoPonto p={alvo}>
        <motion.div className="relative grid place-items-center" style={{ width: tam, height: tam }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: [0.3, 1.15, 1, 1, 0.9], opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: d, times: [0, 0.25, 0.4, 0.8, 1], ease: SUAVE }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 0 10px #C9C9D1)' }}>
            <defs>
              <linearGradient id={`bq-${ef.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#C9C9D1" /><stop offset="1" stopColor="#7A2CFF" />
              </linearGradient>
            </defs>
            <polygon points="50,4 92,27 92,73 50,96 8,73 8,27" fill="rgba(201,201,209,.16)" stroke={`url(#bq-${ef.id})`} strokeWidth="4" />
            <motion.line x1="12" x2="88" stroke="rgba(255,255,255,.7)" strokeWidth="2"
              initial={{ y1: 20, y2: 20 }} animate={{ y1: [20, 80, 20], y2: [20, 80, 20] }} transition={{ duration: d * 0.8, ease: 'easeInOut' }} />
          </svg>
          <Lock className="relative w-8 h-8 text-white" style={{ filter: 'drop-shadow(0 0 6px #fff)' }} aria-hidden />
        </motion.div>
      </NoPonto>
      <Faixa p={{ ...alvo, y: alvo.y + tam / 2 + 14 }} texto="TURNO BLOQUEADO" tamanho={18} cor="#C9C9D1" d={d}
        sub={ef.dados.alvoId ? <>{nome(ef.dados.alvoId)} perdeu a vez</> : undefined} />
    </>
  );
};

// ── Troca (inverte o sentido): setas girando e o anel em volta ─────────
const Troca: FC<PropsEspecial> = ({ ef, d, centro, nome }) => {
  const s = ef.dados.sentido === -1 ? -1 : 1;
  const tam = Math.min(220, window.innerWidth * 0.5);
  const t = textos(ef, nome);
  return (
    <>
      <NoPonto p={centro}>
        <motion.div style={{ width: tam, height: tam }} className="relative"
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1.05, 1, 1.1] }}
          transition={{ duration: d, times: [0, 0.25, 0.8, 1] }}>
          {/* Anel externo girando ao contrário */}
          <motion.svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full"
            animate={{ rotate: -s * 120 }} transition={{ duration: d, ease: 'easeOut' }}>
            <circle cx="50" cy="50" r="46" fill="none" stroke="#CBB3FF" strokeWidth="1.5" strokeDasharray="4 6" opacity=".8" />
          </motion.svg>
          {/* Duas setas curvas girando no novo sentido */}
          <motion.svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ filter: 'drop-shadow(0 0 8px #7A2CFF)' }}
            initial={{ rotate: 0 }} animate={{ rotate: s * 200 }} transition={{ duration: d * 0.85, ease: SUAVE }}>
            <g fill="none" strokeWidth="7" strokeLinecap="round" transform={s === -1 ? 'translate(100,0) scale(-1,1)' : undefined}>
              <path d="M 22 40 A 30 30 0 0 1 74 30" stroke="#FF6A00" />
              <polygon points="80,22 82,40 66,34" fill="#FF6A00" />
              <path d="M 78 60 A 30 30 0 0 1 26 70" stroke="#A56BFF" />
              <polygon points="20,78 18,60 34,66" fill="#A56BFF" />
            </g>
          </motion.svg>
        </motion.div>
      </NoPonto>
      <Faixa p={{ ...centro, y: centro.y + tam / 2 + 18 }} texto={t.titulo} sub={t.sub} cor="#7A2CFF" d={d} tamanho={30} />
    </>
  );
};

// ── +2: duas cartas holográficas voam até quem tem que comprar ─────────
const Mais2: FC<PropsEspecial> = ({ ef, d, centro, nome }) => {
  const alvo = pontoJogador(ef.dados.alvoId);
  useEffect(() => {
    if (!alvo) return;
    for (let k = 0; k < 2; k++) {
      voos.carta(centro, alvo, { face: 'holo', larg: 44, largFinal: 26, atraso: 0.08 + k * 0.12, duracao: 0.38,
        aoChegar: () => particulas.explodir(alvo.x, alvo.y, { cores: PALETAS.energia, qtd: 14, velocidade: 200, vida: 0.5 }) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!alvo) return null;
  const t = textos(ef, nome);
  return <Faixa p={{ ...alvo, y: alvo.y - alvo.h / 2 - 22 }} texto={t.titulo} sub={t.sub} cor="#FF6A00" d={d} atraso={0.35} tamanho={40} />;
};

// ── Call: axolote com headset, ondas de áudio e pulso em quem foi chamado ──
const Call: FC<PropsEspecial> = ({ ef, d, centro, nome, meuId }) => {
  const alvo = pontoJogador(ef.dados.alvoId);
  // Se quem jogou estiver falando na chamada, as ondas ficam maiores
  const falando = useVoiceStore(s => !!ef.dados.jogadorId && !!(s as any).participants?.get?.(ef.dados.jogadorId)?.isSpeaking);
  useEffect(() => {
    if (!alvo) return;
    voos.linha(centro, alvo, '#A56BFF', d * 0.5);
    for (let k = 0; k < 3; k++) voos.pulso(alvo, '#A56BFF', { atraso: d * 0.4 + k * 0.15, duracao: 0.6 });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const larg = Math.min(170, Math.round(window.innerWidth * 0.32));
  const t = textos(ef, nome);
  return (
    <>
      <Escurecer d={d} forca={0.4} />
      <NoPonto p={centro}>
        {[0, 1, 2].map(k => (
          <motion.div key={k} className="absolute rounded-full border-[3px] border-[#A56BFF]"
            style={{ width: larg * 1.2, height: larg * 1.2, left: -larg * 0.6, top: -larg * 0.6, boxShadow: '0 0 20px #7A2CFF' }}
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: [0.6, falando ? 2.6 : 2], opacity: [0.8, 0] }}
            transition={{ duration: d * 0.6, delay: 0.1 + k * 0.18, ease: 'easeOut' }} />
        ))}
      </NoPonto>
      {ef.dados.carta && <CartaHeroi carta={ef.dados.carta} d={d} centro={centro} brilho="radial-gradient(circle,#7A2CFF,transparent 70%)" />}
      <Faixa p={{ ...centro, y: centro.y + larg * 0.9 }} texto={ef.dados.alvoId === meuId ? 'VOCÊ FOI CHAMADO!' : t.titulo} sub={t.sub} cor="#A56BFF" d={d} />
    </>
  );
};

// ── Conexão: orbes laranja e roxo se unem por um feixe e viram a nova cor ──
const Conexao: FC<PropsEspecial> = ({ ef, d, centro, nome }) => {
  const dist = Math.min(180, window.innerWidth * 0.32);
  const cor = ef.dados.cor ? COR_HEX[ef.dados.cor].base : '#FF6A00';
  const t = textos(ef, nome);
  const orbe = (c: string) => ({ background: `radial-gradient(circle, #fff 0%, ${c} 35%, transparent 70%)`, boxShadow: `0 0 30px ${c}` });
  return (
    <>
      <Escurecer d={d} forca={0.45} />
      {ef.dados.carta && <CartaHeroi carta={ef.dados.carta} cor={ef.dados.cor} d={d} centro={centro} brilho={`radial-gradient(circle,${cor},transparent 70%)`} />}
      <NoPonto p={centro}>
        {/* Feixe ligando os dois orbes */}
        <motion.div className="absolute h-[6px] rounded-full" style={{ left: -dist, width: dist * 2, top: -3, background: 'linear-gradient(90deg,#FF6A00,#fff,#7A2CFF)', boxShadow: '0 0 16px #fff' }}
          initial={{ scaleX: 1, opacity: 0 }} animate={{ scaleX: [1, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: d * 0.6, delay: 0.05, times: [0, 0.3, 1] }} />
        <motion.div className="absolute w-16 h-16 rounded-full -left-8 -top-8" style={orbe('#FF6A00')}
          initial={{ x: -dist, opacity: 0 }} animate={{ x: [-dist, 0, 0], opacity: [0, 1, 0] }} transition={{ duration: d * 0.7, times: [0, 0.75, 1], ease: SUAVE }} />
        <motion.div className="absolute w-16 h-16 rounded-full -left-8 -top-8" style={orbe('#7A2CFF')}
          initial={{ x: dist, opacity: 0 }} animate={{ x: [dist, 0, 0], opacity: [0, 1, 0] }} transition={{ duration: d * 0.7, times: [0, 0.75, 1], ease: SUAVE }} />
        {/* Clarão na cor escolhida quando os orbes se encontram */}
        <motion.div className="absolute w-40 h-40 rounded-full -left-20 -top-20" style={{ background: `radial-gradient(circle, ${cor} 0%, transparent 70%)` }}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2.2], opacity: [0.9, 0] }} transition={{ duration: d * 0.45, delay: d * 0.5 }} />
      </NoPonto>
      <Faixa p={{ ...centro, y: centro.y + Math.min(170, window.innerWidth * 0.32) * 0.95 }} texto={t.titulo}
        sub={ef.dados.cor ? <>Nova cor: <ChipCor cor={ef.dados.cor} /></> : undefined} cor={cor} d={d} />
    </>
  );
};

// ── Todos Unidos (+4): os três mascotes, feixes das 4 cores e a onda ───
const TodosUnidos: FC<PropsEspecial> = ({ ef, d, centro, nome, meuId }) => {
  const alvo = pontoJogador(ef.dados.alvoId);
  const qtd = ef.dados.qtd && ef.dados.qtd > 4 ? ef.dados.qtd : 4;
  useEffect(() => {
    // Todos os avatares acendem
    document.querySelectorAll('[data-unidos-alvo^="jogador:"]').forEach((el, k) => {
      const r = el.getBoundingClientRect();
      voos.pulso({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }, ['#FF6A00', '#7A2CFF', '#C9C9D1', '#F2C35B'][k % 4], { atraso: 0.25 + k * 0.05, duracao: 0.8 });
    });
    if (alvo) for (let k = 0; k < 4; k++) {
      voos.carta(centro, alvo, { face: 'holo', larg: 44, largFinal: 26, atraso: d * 0.42 + k * 0.09, duracao: 0.36,
        aoChegar: () => particulas.explodir(alvo.x, alvo.y, { cores: PALETAS.multicor, qtd: 10, velocidade: 220, vida: 0.5 }) });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const W = window.innerWidth, H = window.innerHeight;
  const cantos = [[0, 0, '#FF6A00'], [W, 0, '#7A2CFF'], [0, H, '#C9C9D1'], [W, H, '#F2C35B']] as const;
  const t = textos(ef, nome);
  const tamOnda = Math.min(W, H) * 0.5;
  return (
    <>
      <Escurecer d={d} forca={0.62} />
      {/* 4 feixes convergindo para o centro */}
      <svg className="fixed inset-0 w-full h-full">
        {cantos.map(([x, y, c], k) => (
          <motion.line key={k} x1={x} y1={y} x2={centro.x} y2={centro.y} stroke={c} strokeWidth={4} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${c})` }}
            initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
            transition={{ duration: d * 0.55, delay: k * 0.04, times: [0, 0.6, 1], ease: 'easeIn' }} />
        ))}
      </svg>
      {/* Onda de energia multicolor */}
      <NoPonto p={centro}>
        <motion.div className="rounded-full" style={{
          width: tamOnda, height: tamOnda,
          background: 'conic-gradient(#FF6A00,#F2C35B,#C9C9D1,#7A2CFF,#FF6A00)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 60%, #000 63%, #000 69%, transparent 72%)',
          maskImage: 'radial-gradient(circle, transparent 60%, #000 63%, #000 69%, transparent 72%)',
        }}
          initial={{ scale: 0.1, opacity: 0 }} animate={{ scale: [0.1, 3], opacity: [1, 0], rotate: 90 }}
          transition={{ duration: d * 0.55, delay: d * 0.32, ease: 'easeOut' }} />
      </NoPonto>
      {ef.dados.carta && <CartaHeroi carta={ef.dados.carta} cor={ef.dados.cor} d={d} centro={centro}
        brilho="conic-gradient(from 0deg,#FF6A00,#7A2CFF,#C9C9D1,#F2C35B,#FF6A00)" />}
      <Faixa p={{ ...centro, y: centro.y + Math.min(200, W * 0.36) * 0.95 }} texto={t.titulo} cor="#F2C35B" d={d} atraso={0.2} tamanho={38}
        sub={<>{nome(ef.dados.jogadorId)} → {ef.dados.alvoId === meuId ? 'você' : nome(ef.dados.alvoId)} <b className="text-[#ffb27d]">+{qtd}</b>{ef.dados.cor && <> · <ChipCor cor={ef.dados.cor} /></>}</>} />
      {alvo && <Faixa p={{ ...alvo, y: alvo.y - alvo.h / 2 - 24 }} texto={`+${qtd}`} cor="#FF6A00" d={d} atraso={d * 0.55} tamanho={44} />}
    </>
  );
};

// ── Vitória: raios de luz no centro (o painel vem logo depois) ─────────
const Vitoria: FC<PropsEspecial> = ({ d, centro }) => (
  <NoPonto p={centro}>
    <motion.div className="rounded-full" style={{
      width: 520, height: 520,
      background: 'repeating-conic-gradient(rgba(242,195,91,.35) 0deg 8deg, transparent 8deg 22deg)',
      WebkitMaskImage: 'radial-gradient(circle, #000 20%, transparent 70%)', maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
    }}
      initial={{ opacity: 0, scale: 0.4, rotate: 0 }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 1.4], rotate: 40 }}
      transition={{ duration: d, ease: 'easeOut' }} />
  </NoPonto>
);

export const COMPONENTES: Record<string, FC<PropsEspecial>> = {
  bloqueio: Bloqueio, troca: Troca, mais2: Mais2, call: Call, conexao: Conexao, todosunidos: TodosUnidos, vitoria: Vitoria,
};

// Onde as partículas do impacto saem
function pontoImpacto(ef: Efeito, centro: Ponto): Ponto {
  if (ef.chave === 'bloqueio' || ef.chave === 'mais2') return pontoJogador(ef.dados.alvoId) || centro;
  if (ef.chave === 'vitoria') return pontoJogador(ef.dados.vencedorId) || centro;
  return centro;
}

function Executar({ ef, meuId, nome }: { ef: Efeito; meuId: string; nome: (id?: string | null) => string }) {
  const def = REGISTRO[ef.chave];
  const modo = useModoEfeitos();
  const concluir = useFilaEfeitos(s => s.concluir);
  const centro = useMemo(() => pontoMesa(), []);
  const d = ef.duracao / 1000;

  useEffect(() => {
    const som = ef.chave === 'vitoria' && ef.dados.vencedorId !== meuId ? 'derrota' : def.som;
    audio.tocar(som);
    if (def.vibrar && (ef.dados.alvoId === meuId || ef.dados.jogadorId === meuId || ef.chave === 'vitoria')) vibrar(def.vibrar);
    const tImpacto = setTimeout(() => {
      const p = pontoImpacto(ef, centro);
      particulas.explodir(p.x, p.y, { cores: PALETAS[def.paleta], qtd: def.particulas, velocidade: 320, vida: 0.9, forma: ef.chave === 'bloqueio' ? 'faisca' : 'ponto', espalhar: 10 });
      if (ef.chave === 'vitoria') {
        // Chuva de confete saindo de cima
        for (let k = 0; k < 5; k++) particulas.explodir(window.innerWidth * (0.1 + k * 0.2), -10, { cores: PALETAS.multicor, qtd: 18, velocidade: 220, gravidade: 380, vida: 1.6, direcao: Math.PI / 2, abertura: 1.2, tamanho: 4 });
      }
      if (def.tremer) useTremor.getState().tremer(def.tremer);
    }, ef.duracao * def.fases.entrada);
    const tFim = setTimeout(() => concluir(ef.id), ef.duracao);
    return () => { clearTimeout(tImpacto); clearTimeout(tFim); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const props: PropsEspecial = { ef, def, modo, meuId, nome, d, centro };
  if (modo.reduzido && def.reduzido === 'aviso') return <Aviso {...props} />;
  const C = COMPONENTES[ef.chave];
  return C ? <C {...props} /> : <Aviso {...props} />;
}

export function CamadaEspeciais({ meuId, nome }: { meuId: string; nome: (id?: string | null) => string }) {
  const atual = useFilaEfeitos(s => s.atual);
  return (
    <div className="pointer-events-none fixed inset-0 z-[30] overflow-hidden" aria-hidden>
      <AnimatePresence>
        {atual && (
          <motion.div key={atual.id} className="absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Executar ef={atual} meuId={meuId} nome={nome} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
