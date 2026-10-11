'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LogOut, Play, RotateCw, RotateCcw, Crown, Loader2, Trophy, Hand, Minimize2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { CartaView, CartaVerso, COR_HEX, nomeCarta, precarregarCartas } from './carta';
import { useUnidos, type Carta, type Cor, type JogadorVisao, type Partida } from './unidos.store';

// ── Sons curtos do jogo (gerados na hora, sem arquivos) ───────────────
let ctx: AudioContext | null = null;
function bip(notas: [number, number, number][], tipo: OscillatorType = 'triangle', vol = 0.12) {
  try {
    ctx = ctx || new AudioContext();
    const t0 = ctx.currentTime + 0.01;
    for (const [f, ini, dur] of notas) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = tipo; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + ini);
      g.gain.exponentialRampToValueAtTime(vol, t0 + ini + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + ini + dur);
      o.connect(g).connect(ctx.destination); o.start(t0 + ini); o.stop(t0 + ini + dur + 0.05);
    }
  } catch { /* sem áudio */ }
}
const som = {
  jogar: () => bip([[660, 0, 0.09], [990, 0.05, 0.12]]),
  comprar: () => bip([[420, 0, 0.1]], 'sine', 0.1),
  vez: () => bip([[784, 0, 0.12], [1175, 0.1, 0.18]], 'sine', 0.14),
  gritar: () => bip([[880, 0, 0.1], [1320, 0.08, 0.1], [1760, 0.16, 0.2]], 'square', 0.06),
  vitoria: () => bip([[523, 0, 0.2], [659, 0.15, 0.2], [784, 0.3, 0.2], [1047, 0.45, 0.45]], 'triangle', 0.14),
};

function textoUltima(p: Partida, meuId: string) {
  const u = p.ultima;
  if (!u) return '';
  const nome = (id?: string) => (id === meuId ? 'Você' : p.jogadores.find(j => j.id === id)?.nome || 'Alguém');
  switch (u.acao) {
    case 'inicio': return `A partida começou! ${nome(u.jogadorId)} joga primeiro.`;
    case 'jogou': {
      const c = u.carta!;
      if (c.tipo === 'call') return `${nome(u.jogadorId)} jogou Call e chamou ${nome(u.alvoId) === 'Você' ? 'você' : nome(u.alvoId)} para jogar`;
      if (c.tipo === 'troca') return `${nome(u.jogadorId)} jogou Troca: o sentido inverteu`;
      if (c.tipo === 'conexao' || c.tipo === 'todosunidos') return `${nome(u.jogadorId)} jogou ${nomeCarta(c)} e escolheu ${COR_HEX[p.corAtual!]?.nome.toLowerCase()}`;
      return `${nome(u.jogadorId)} jogou ${nomeCarta(c)}`;
    }
    case 'comprou': return `${nome(u.jogadorId)} comprou ${u.qtd} carta${u.qtd === 1 ? '' : 's'}`;
    case 'passou': return `${nome(u.jogadorId)} passou a vez`;
    case 'gritou': return `${nome(u.jogadorId)} gritou UNidos!`;
    case 'pegou': return `${nome(u.jogadorId)} pegou ${nome(u.alvoId)} sem gritar: +2 cartas`;
    case 'saiu': return `${nome(u.jogadorId)} saiu da mesa`;
    default: return '';
  }
}

function Avatar({ j, tamanho = 44 }: { j: { nome: string; avatarUrl: string | null }; tamanho?: number }) {
  return j.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={j.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: tamanho, height: tamanho }} />
  ) : (
    <div className="rounded-full grid place-items-center font-black text-white" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36, background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
      {j.nome.slice(0, 2).toUpperCase()}
    </div>
  );
}

function useRestante(prazo: number, ativo: boolean) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [ativo]);
  return Math.max(0, Math.ceil((prazo - agora) / 1000));
}

function Adversario({ j, daVez, prazo, onPegar, host }: { j: JogadorVisao; daVez: boolean; prazo: number; onPegar: () => void; host: boolean }) {
  const restante = useRestante(prazo, daVez);
  return (
    <div className={cn('relative flex flex-col items-center gap-1.5 px-2 py-2 rounded-2xl min-w-[86px] transition-colors', daVez && 'bg-white/[0.06]')}>
      <div className={cn('relative rounded-full p-[3px]', daVez ? 'bg-gradient-to-br from-[#ff6a00] to-[#7a2cff]' : 'bg-transparent')}>
        <div className={cn(j.ausente && 'opacity-40 grayscale')}><Avatar j={j} tamanho={42} /></div>
        {daVez && (
          <span className="absolute -bottom-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-[#0a0713] border border-[#ff6a00] text-[11px] font-black text-white grid place-items-center tabular-nums">
            {restante}
          </span>
        )}
        {host && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 text-[#ffcc4d]" />}
      </div>
      <span className="text-[12px] font-semibold text-white max-w-[90px] truncate">{j.nome}</span>
      <div className="flex items-center gap-1">
        <div className="relative h-[26px]" style={{ width: Math.min(j.cartas, 6) * 6 + 14 }}>
          {Array.from({ length: Math.min(j.cartas, 6) }).map((_, i) => (
            <div key={i} className="absolute top-0" style={{ left: i * 6 }}><CartaVerso tamanho={17} /></div>
          ))}
        </div>
        <span className="text-[12px] font-black text-[#cbb3ff] tabular-nums">{j.cartas}</span>
      </div>
      {j.gritou && j.cartas <= 2 && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-[#0a0713] bg-gradient-to-r from-[#ffb27d] to-[#ff6a00]">UNidos!</span>
      )}
      {j.esqueceu && (
        <button onClick={onPegar}
          className="text-[11px] font-black px-2.5 py-1 rounded-full text-white bg-[#ed4245] hover:bg-[#ff5a5d] animate-pulse">
          Pegar! (+2)
        </button>
      )}
      {j.ausente && <span className="text-[10px] text-[#a99cb8]">saiu da chamada</span>}
    </div>
  );
}

export function UnidosMesa() {
  const { partida: p, aberta, erro, setAberta, acao, sair, limparErro } = useUnidos();
  const { user } = useAuthStore();
  const meuId = user?.id || '';
  const [escolherCor, setEscolherCor] = useState<Carta | null>(null);
  const [escolherAlvo, setEscolherAlvo] = useState<Carta | null>(null);
  const [enviando, setEnviando] = useState(false);
  const minhaVez = !!p && p.status === 'jogando' && p.vezId === meuId;
  const restante = useRestante(p?.prazoLocal || 0, minhaVez);

  // Baixa as artes das cartas ao abrir a mesa (sem piscar quando uma carta aparece)
  useEffect(() => { precarregarCartas(); }, []);

  // Erro some sozinho
  useEffect(() => {
    if (!erro) return;
    const t = setTimeout(limparErro, 3500);
    return () => clearTimeout(t);
  }, [erro, limparErro]);

  // Sons: minha vez, vitória
  const vezAnterior = useRef<string | null>(null);
  const statusAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (!p) return;
    if (p.vezId === meuId && vezAnterior.current !== meuId && p.status === 'jogando') som.vez();
    if (p.status === 'fim' && statusAnterior.current === 'jogando') som.vitoria();
    vezAnterior.current = p.vezId;
    statusAnterior.current = p.status;
  }, [p, meuId]);

  // Adversários na ordem da mesa, começando depois de mim
  const adversarios = useMemo(() => {
    if (!p) return [];
    const i = p.jogadores.findIndex(j => j.id === meuId);
    const ord = i < 0 ? p.jogadores : [...p.jogadores.slice(i + 1), ...p.jogadores.slice(0, i)];
    return ord.filter(j => j.id !== meuId);
  }, [p, meuId]);

  if (!p || !aberta) return null;
  const eu = p.jogadores.find(j => j.id === meuId);
  const souHost = p.hostId === meuId;
  const jogaveis = new Set(p.jogaveis);

  const fazer = async (evento: string, dados?: Record<string, unknown>) => {
    if (enviando) return;
    setEnviando(true);
    const ok = await acao(evento, dados);
    setEnviando(false);
    return ok;
  };

  const tocarCarta = async (c: Carta) => {
    if (!minhaVez || !jogaveis.has(c.id)) return;
    if (c.tipo === 'conexao' || c.tipo === 'todosunidos') { setEscolherCor(c); return; }
    if (c.tipo === 'call') { setEscolherAlvo(c); return; }
    if (await fazer('jogar', { cartaId: c.id })) som.jogar();
  };

  const tamanhoMao = typeof window !== 'undefined' && window.innerWidth < 640 ? 64 : 88;
  const sobreposicao = Math.max(-tamanhoMao * 0.55, Math.min(8, (Math.min(typeof window !== 'undefined' ? window.innerWidth : 1200, 1100) - 40 - tamanhoMao) / Math.max(1, p.minhaMao.length - 1) - tamanhoMao));
  const vencedor = p.jogadores.find(j => j.id === p.vencedorId);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[65] flex flex-col text-white nx-safe-top nx-safe-bottom"
      style={{ background: 'radial-gradient(ellipse at 50% 45%, #2a1550 0%, #120a22 55%, #07050d 100%)' }}
      role="dialog" aria-label="UNidos"
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0 border-b border-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/unidos/cartas/logo.webp" alt="UNidos" className="h-9 w-auto select-none" draggable={false} />
        <span className="text-[12px] text-[#a99cb8] hidden sm:inline">
          {p.status === 'lobby' ? 'Esperando jogadores' : p.status === 'jogando' ? `${p.monte} cartas no monte` : 'Fim de partida'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setAberta(false)} title="Voltar para a chamada (a partida continua)"
            className="h-9 px-3 rounded-lg text-[13px] text-[#cfc6dd] hover:bg-white/10 flex items-center gap-1.5">
            <Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">Ver a chamada</span>
          </button>
          <button onClick={() => { if (p.status !== 'jogando' || window.confirm('Sair da partida? Suas cartas voltam para o monte.')) sair(); }}
            title="Sair da mesa" className="h-9 px-3 rounded-lg text-[13px] text-[#ff8098] hover:bg-[#ed4245]/15 flex items-center gap-1.5">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* Lobby */}
      {p.status === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="flex -space-x-6">
            {[{ id: 'a', cor: 'laranja', tipo: 'numero', valor: 0 }, { id: 'b', cor: null, tipo: 'todosunidos' }, { id: 'c', cor: 'roxo', tipo: 'numero', valor: 3 }].map((c, i) => (
              <motion.div key={c.id} initial={{ y: 30, opacity: 0, rotate: 0 }} animate={{ y: 0, opacity: 1, rotate: (i - 1) * 12 }} transition={{ delay: i * 0.08 }}>
                <CartaView carta={c as Carta} tamanho={86} />
              </motion.div>
            ))}
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/unidos/cartas/logo.webp" alt="UNidos" className="h-20 sm:h-24 w-auto mx-auto mb-1 select-none" draggable={false} />
            <p className="text-[#a99cb8] text-sm mt-1">Quem está na chamada vê o botão <b className="text-white">Entrar</b>. De 2 a 8 jogadores.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-xl">
            {p.jogadores.map(j => (
              <div key={j.id} className="flex flex-col items-center gap-1 w-20">
                <div className="relative"><Avatar j={j} tamanho={52} />{j.id === p.hostId && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-[#ffcc4d]" />}</div>
                <span className="text-[12px] truncate max-w-full">{j.id === meuId ? 'Você' : j.nome}</span>
              </div>
            ))}
          </div>
          {souHost ? (
            <button onClick={() => fazer('iniciar')} disabled={enviando}
              className="h-12 px-8 rounded-2xl font-black text-[15px] flex items-center gap-2 disabled:opacity-60 shadow-[0_10px_30px_rgba(122,44,255,.35)]"
              style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
              {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} Começar partida
            </button>
          ) : (
            <p className="text-[#a99cb8] text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Esperando quem abriu a mesa começar…</p>
          )}
          <div className="text-left text-[12.5px] text-[#a99cb8] max-w-md rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 space-y-1">
            <p><b className="text-white">Como jogar:</b> jogue uma carta da mesma cor ou do mesmo número/símbolo da mesa.</p>
            <p><b className="text-white">Bloqueio</b> pula o próximo · <b className="text-white">Troca</b> inverte o sentido · <b className="text-white">Call</b> escolhe quem joga · <b className="text-white">+2</b> e <b className="text-white">Todos Unidos (+4)</b> acumulam · <b className="text-white">Conexão</b> muda a cor.</p>
            <p>Com 1 carta, aperte <b className="text-white">UNidos!</b> — se esquecer e alguém pegar, você compra 2.</p>
          </div>
        </div>
      )}

      {/* Partida */}
      {p.status !== 'lobby' && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Adversários */}
          <div className="flex justify-center gap-1 sm:gap-3 px-2 pt-3 overflow-x-auto nx-no-scrollbar shrink-0">
            {adversarios.map(j => (
              <Adversario key={j.id} j={j} daVez={p.vezId === j.id} prazo={p.prazoLocal || 0} host={j.id === p.hostId}
                onPegar={async () => { if (await fazer('pegar', { alvoId: j.id })) som.comprar(); }} />
            ))}
          </div>

          {/* Mesa */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-6 sm:gap-10">
              {/* Monte */}
              <button
                onClick={async () => { if (minhaVez && !p.comprada && await fazer('comprar')) som.comprar(); }}
                disabled={!minhaVez || !!p.comprada}
                className={cn('relative transition-transform', minhaVez && !p.comprada && 'hover:-translate-y-1 cursor-pointer')}
                title={minhaVez ? (p.acumulado ? `Comprar ${p.acumulado}` : 'Comprar uma carta') : 'Monte'}
              >
                <div className="absolute top-1 left-1"><CartaVerso tamanho={tamanhoMao + 8} /></div>
                <div className="absolute top-0.5 left-0.5"><CartaVerso tamanho={tamanhoMao + 8} /></div>
                <div className="relative"><CartaVerso tamanho={tamanhoMao + 8} /></div>
                {minhaVez && !p.comprada && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black px-2.5 py-1 rounded-full bg-white text-[#120a22]">
                    {p.acumulado ? `Comprar ${p.acumulado}` : 'Comprar'}
                  </span>
                )}
              </button>

              {/* Carta da mesa */}
              <div className="relative">
                {p.corAtual && (
                  <div className="absolute -inset-4 rounded-[28px] blur-xl opacity-60 transition-colors duration-500" style={{ background: COR_HEX[p.corAtual].base }} />
                )}
                <AnimatePresence mode="popLayout">
                  {p.topo && (
                    <motion.div key={p.topo.id}
                      initial={{ scale: 1.25, rotate: -14, opacity: 0, y: 40 }} animate={{ scale: 1, rotate: 0, opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 22 }} className="relative">
                      <CartaView carta={p.topo} tamanho={tamanhoMao + 22} corEscolhida={p.corAtual} />
                    </motion.div>
                  )}
                </AnimatePresence>
                {p.acumulado > 0 && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="absolute -top-3 -right-4 text-[13px] font-black px-2.5 py-1 rounded-full bg-[#ed4245] text-white shadow-lg">
                    +{p.acumulado}
                  </motion.span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[13px] text-[#cfc6dd] min-h-[22px] px-4 text-center">
              {p.status === 'jogando' && (p.sentido === 1 ? <RotateCw className="w-4 h-4 text-[#a99cb8] shrink-0" /> : <RotateCcw className="w-4 h-4 text-[#a99cb8] shrink-0" />)}
              <span>{textoUltima(p, meuId)}</span>
            </div>
          </div>

          {/* Minha área */}
          {eu && p.status === 'jogando' && (
            <div className="shrink-0 pb-5">
              <div className="flex items-center justify-center gap-2 mb-2 px-3 min-h-[40px] flex-wrap">
                {minhaVez ? (
                  <span className="text-[13px] font-black px-3 py-1.5 rounded-full text-white flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
                    Sua vez <span className="tabular-nums bg-black/30 rounded-full px-1.5">{restante}s</span>
                  </span>
                ) : (
                  <span className="text-[12.5px] text-[#a99cb8]">Vez de {p.jogadores.find(j => j.id === p.vezId)?.nome}</span>
                )}
                {minhaVez && p.comprada && (
                  <button onClick={() => fazer('passar')} className="h-9 px-4 rounded-full text-[13px] font-bold bg-white/10 hover:bg-white/15">Passar a vez</button>
                )}
                {p.minhaMao.length <= 2 && !eu.gritou && (
                  <motion.button initial={{ scale: 0.8 }} animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
                    onClick={async () => { if (await fazer('gritar')) som.gritar(); }}
                    className="h-10 px-5 rounded-full text-[15px] font-black text-[#0a0713] shadow-[0_6px_20px_rgba(255,106,0,.45)]"
                    style={{ background: 'linear-gradient(135deg,#ffcf8a,#ff6a00)' }}>
                    UNidos!
                  </motion.button>
                )}
                {eu.gritou && p.minhaMao.length <= 2 && <span className="text-[12px] font-black text-[#ffb27d]">Você gritou UNidos!</span>}
              </div>
              {/* Mão */}
              <div className="flex justify-center px-4 overflow-x-auto nx-no-scrollbar pt-4">
                <div className="flex items-end">
                  <AnimatePresence initial={false} mode="popLayout">
                    {p.minhaMao.map((c, i) => {
                      const pode = minhaVez && jogaveis.has(c.id);
                      return (
                        <motion.button
                          key={c.id} layout
                          initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0, scale: 0.8 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          onClick={() => tocarCarta(c)}
                          disabled={!pode || enviando}
                          className={cn('relative shrink-0 transition-transform duration-150', pode ? 'hover:-translate-y-4 cursor-pointer' : 'cursor-default')}
                          style={{ marginLeft: i === 0 ? 0 : sobreposicao, zIndex: i }}
                          title={nomeCarta(c)}
                        >
                          <CartaView carta={c} tamanho={tamanhoMao} jogavel={pode} apagada={minhaVez && !pode} />
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
          {!eu && p.status === 'jogando' && (
            <p className="text-center text-[13px] text-[#a99cb8] pb-6">Você está assistindo esta partida.</p>
          )}
        </div>
      )}

      {/* Fim */}
      <AnimatePresence>
        {p.status === 'fim' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 p-6 text-center" style={{ background: 'linear-gradient(160deg,#2a1550,#120a22)' }}>
              <Trophy className="w-12 h-12 mx-auto text-[#ffcc4d]" />
              {vencedor && <div className="mt-3 flex justify-center"><Avatar j={vencedor} tamanho={64} /></div>}
              <h3 className="text-2xl font-black mt-3">{vencedor ? (vencedor.id === meuId ? 'Você venceu!' : `${vencedor.nome} venceu!`) : 'Fim de partida'}</h3>
              <p className="text-[#a99cb8] text-sm mt-1">{vencedor?.id === meuId ? 'Zerou a mão primeiro. Que jogada!' : 'Bora a revanche?'}</p>
              <div className="flex gap-2 mt-5">
                {souHost ? (
                  <button onClick={() => fazer('revanche')} disabled={enviando}
                    className="flex-1 h-11 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
                    <Play className="w-4 h-4" /> Jogar de novo
                  </button>
                ) : (
                  <p className="flex-1 text-[12.5px] text-[#a99cb8] self-center">Quem abriu a mesa pode começar outra.</p>
                )}
                <button onClick={() => sair()} className="h-11 px-4 rounded-xl font-bold bg-white/10 hover:bg-white/15">Sair</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escolher a cor (Conexão / Todos Unidos) */}
      <AnimatePresence>
        {escolherCor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-4" onClick={() => setEscolherCor(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
              className="rounded-3xl border border-white/10 p-5 text-center bg-[#140d22]">
              <p className="font-black text-lg mb-4">Escolha a cor</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(COR_HEX) as Cor[]).map(cor => (
                  <button key={cor} onClick={async () => { const c = escolherCor; setEscolherCor(null); if (await fazer('jogar', { cartaId: c.id, cor })) som.jogar(); }}
                    className="w-32 h-20 rounded-2xl font-black text-[15px] hover:scale-105 transition-transform border-2 border-white/10"
                    style={{ background: `linear-gradient(150deg, ${COR_HEX[cor].claro} -40%, ${COR_HEX[cor].base} 50%, ${COR_HEX[cor].escuro} 140%)`,
                      color: cor === 'prata' || cor === 'dourado' ? '#1a1406' : '#fff' }}>
                    {COR_HEX[cor].nome}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Escolher quem joga agora (Call) */}
      <AnimatePresence>
        {escolherAlvo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-4" onClick={() => setEscolherAlvo(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
              className="rounded-3xl border border-white/10 p-5 w-full max-w-sm bg-[#140d22]">
              <p className="font-black text-lg mb-1 text-center">Quem joga agora?</p>
              <p className="text-[12.5px] text-[#a99cb8] mb-4 text-center">A vez pula direto para a pessoa que você escolher.</p>
              <div className="space-y-2">
                {adversarios.map(j => (
                  <button key={j.id} onClick={async () => { const c = escolherAlvo; setEscolherAlvo(null); if (await fazer('jogar', { cartaId: c.id, alvoId: j.id })) som.jogar(); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.09] text-left">
                    <Avatar j={j} tamanho={38} />
                    <span className="flex-1 font-semibold truncate">{j.nome}</span>
                    <span className="text-[13px] font-black text-[#cbb3ff] flex items-center gap-1"><Hand className="w-3.5 h-3.5" /> {j.cartas}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso de erro */}
      <AnimatePresence>
        {erro && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute z-30 bottom-[calc(env(safe-area-inset-bottom)+16px)] inset-x-0 mx-auto w-max max-w-[90vw] px-4 py-2.5 rounded-xl text-sm bg-[#3a1220] border border-[#ed4245]/40 text-[#ffd0d8] flex items-center gap-2">
            {erro}
            <button onClick={limparErro} className="text-white/70 hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
