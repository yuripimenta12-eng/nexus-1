'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig, useAnimationControls } from 'framer-motion';
import { X, LogOut, Play, RotateCw, RotateCcw, Crown, Loader2, Minimize2, Volume2, VolumeX, Settings2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { CartaView, COR_HEX, nomeCarta, precarregarCartas } from './carta';
import { useUnidos, type Carta, type Cor, type Partida } from './unidos.store';
import { audio } from './efeitos/audio';
import { useConfigUnidos, useModoEfeitos } from './efeitos/config';
import { cancelarTudo, impactoNaPilha, reagir } from './efeitos/controlador';
import { derivar } from './efeitos/derivar';
import { CamadaEspeciais } from './efeitos/especiais';
import { CamadaParticulas } from './efeitos/particulas';
import { lembrarOrigem } from './efeitos/posicoes';
import { useTremor } from './efeitos/tremor';
import { CamadaVoos, useVoos } from './efeitos/voos';
import { Ajustes } from './mesa/ajustes';
import { Adversario, Avatar, AvatarMesa, useRestanteMs } from './mesa/jogadores';
import { Mao, type EstadoArrasto } from './mesa/mao';
import { Monte, Pilha } from './mesa/pilha';
import { SeletorAlvo, SeletorCor } from './mesa/seletores';
import { PainelFim } from './mesa/vitoria';

function textoUltima(p: Partida, meuId: string) {
  const u = p.ultima;
  if (!u) return '';
  const nome = (id?: string) => (id === meuId ? 'Você' : p.jogadores.find(j => j.id === id)?.nome || 'Alguém');
  switch (u.acao) {
    case 'inicio': return `A partida começou! ${nome(u.jogadorId)} joga primeiro.`;
    case 'jogou': {
      const c = u.carta!;
      if (c.tipo === 'call') return `${nome(u.jogadorId)} jogou Call e chamou ${nome(u.alvoId) === 'Você' ? 'você' : nome(u.alvoId)} para jogar`;
      if (c.tipo === 'troca') return p.jogadores.length === 2 ? `${nome(u.jogadorId)} jogou Troca e joga de novo` : `${nome(u.jogadorId)} jogou Troca: o sentido inverteu`;
      if (c.tipo === 'bloqueio') return `${nome(u.jogadorId)} jogou Bloqueio: o próximo perdeu a vez`;
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

function useLarguraTela() {
  const [w, setW] = useState(typeof window === 'undefined' ? 1200 : window.innerWidth);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return w;
}

type Seletor = { tipo: 'cor' | 'alvo'; carta: Carta; el: HTMLElement; resolver: (ok: boolean) => void };

export function UnidosMesa() {
  const { partida: p, aberta, erro, setAberta, acao, sair, limparErro } = useUnidos();
  const { user } = useAuthStore();
  const meuId = user?.id || '';
  const umClique = useConfigUnidos(s => s.umClique);
  const mudo = useConfigUnidos(s => s.mudo);
  const mudarConfig = useConfigUnidos(s => s.mudar);
  const modo = useModoEfeitos();
  const [seletor, setSeletor] = useState<Seletor | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [arrasto, setArrasto] = useState<EstadoArrasto>('nao');
  const [ajustes, setAjustes] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const minhaVez = !!p && p.status === 'jogando' && p.vezId === meuId;
  const restanteMs = useRestanteMs(p?.prazoLocal || 0, !!p && p.status === 'jogando');
  const largura = useLarguraTela();
  const tamanhoMao = largura < 640 ? 66 : 92;
  const palco = useAnimationControls();
  const fimAoAbrir = useRef(p?.status === 'fim');

  const nome = useMemo(() => {
    const mapa = new Map((p?.jogadores || []).map(j => [j.id, j.nome]));
    return (id?: string | null) => (id === meuId ? 'Você' : (id && mapa.get(id)) || 'Alguém');
  }, [p?.jogadores, meuId]);

  // Ao abrir: baixa as artes, liga a música (se ativada). Ao fechar: cancela tudo.
  useEffect(() => {
    precarregarCartas();
    audio.mesa(true);
    return () => { audio.mesa(false); cancelarTudo(); useVoos.getState().limpar(); };
  }, []);

  // Libera o áudio no primeiro toque (regra dos navegadores)
  useEffect(() => {
    const f = () => audio.destravar();
    window.addEventListener('pointerdown', f, { once: true });
    return () => window.removeEventListener('pointerdown', f);
  }, []);

  // Cada estado novo do servidor vira animação (sempre depois da confirmação)
  const anterior = useRef<Partida | null>(null);
  useEffect(() => {
    if (!p) return;
    const acs = derivar(anterior.current, p);
    anterior.current = p;
    if (acs.length) reagir(acs, { meuId, seq: p.seq, nome });
  }, [p, meuId, nome]);

  // Tremida da mesa (Todos Unidos, +2) — respeita "sem tremor"
  const tremor = useTremor(s => s.n);
  useEffect(() => {
    if (!tremor) return;
    const f = useTremor.getState().forca * 3;
    palco.start({ x: [0, -f, f, -f * 0.6, f * 0.6, 0], y: [0, f * 0.4, -f * 0.4, 0], transition: { duration: 0.35 } });
  }, [tremor, palco]);

  // Tique discreto nos últimos 5 segundos da minha vez
  const segundos = Math.ceil(restanteMs / 1000);
  useEffect(() => {
    if (minhaVez && segundos > 0 && segundos <= 5) audio.tocar('tique');
  }, [segundos, minhaVez]);

  // Avisos somem sozinhos
  useEffect(() => {
    if (!erro) return;
    const t = setTimeout(limparErro, 3500);
    return () => clearTimeout(t);
  }, [erro, limparErro]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 1600);
    return () => clearTimeout(t);
  }, [aviso]);

  // Adversários na ordem da mesa, começando depois de mim
  const adversarios = useMemo(() => {
    if (!p) return [];
    const i = p.jogadores.findIndex(j => j.id === meuId);
    const ord = i < 0 ? p.jogadores : [...p.jogadores.slice(i + 1), ...p.jogadores.slice(0, i)];
    return ord.filter(j => j.id !== meuId);
  }, [p, meuId]);

  const jogaveis = useMemo(() => new Set(p?.jogaveis || []), [p?.jogaveis]);

  if (!p || !aberta) return null;
  const eu = p.jogadores.find(j => j.id === meuId);
  const souHost = p.hostId === meuId;

  // Manda a ação e espera o servidor. Demorando, mostra "Processando…"
  const fazer = async (evento: string, dados?: Record<string, unknown>) => {
    if (enviando) return false;
    setEnviando(true);
    const t = setTimeout(() => setProcessando(true), 300);
    const ok = await acao(evento, dados);
    clearTimeout(t);
    setProcessando(false);
    setEnviando(false);
    if (!ok) audio.tocar('invalido');
    return ok;
  };

  // Jogar uma carta: curingas pedem a cor, Call pede quem joga. A carta só
  // sai da mão quando o servidor confirmar (o estado novo chega sem ela).
  const aoJogar = (c: Carta, el: HTMLElement) => new Promise<boolean>(resolve => {
    if (c.tipo === 'conexao' || c.tipo === 'todosunidos') { setSeletor({ tipo: 'cor', carta: c, el, resolver: resolve }); return; }
    if (c.tipo === 'call') { setSeletor({ tipo: 'alvo', carta: c, el, resolver: resolve }); return; }
    lembrarOrigem(c.id, el);
    fazer('jogar', { cartaId: c.id }).then(resolve);
  });

  const concluirSeletor = async (dados: { cor?: Cor; alvoId?: string }) => {
    const s = seletor;
    if (!s) return false;
    lembrarOrigem(s.carta.id, s.el);
    const ok = await fazer('jogar', { cartaId: s.carta.id, ...dados });
    s.resolver(ok);
    setSeletor(null);
    return ok;
  };
  const cancelarSeletor = () => { seletor?.resolver(false); setSeletor(null); };

  const vencedor = p.jogadores.find(j => j.id === p.vencedorId);
  const vezDe = p.jogadores.find(j => j.id === p.vezId);
  const host = p.jogadores.find(j => j.id === p.hostId);

  return (
    <MotionConfig reducedMotion={modo.movimento ? 'never' : 'always'}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[65] flex flex-col text-white nx-safe-top nx-safe-bottom overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, #2a1550 0%, #120a22 55%, #07050d 100%)' }}
        role="dialog" aria-label="UNidos"
      >
        {/* Cabeçalho */}
        <div className="relative z-[52] flex items-center gap-2 px-3 sm:px-4 h-14 shrink-0 border-b border-white/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/unidos/cartas/logo.webp" alt="UNidos" className="h-9 w-auto select-none" draggable={false} />
          <span className="text-[12px] text-[#a99cb8] hidden sm:inline">
            {p.status === 'lobby' ? 'Esperando jogadores' : p.status === 'jogando' ? `${p.monte} cartas no monte` : 'Fim de partida'}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => { mudarConfig({ mudo: !mudo }); audio.destravar(); }} title={mudo ? 'Ligar o som' : 'Tirar o som'} aria-pressed={mudo}
              className="w-9 h-9 rounded-lg grid place-items-center text-[#cfc6dd] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              {mudo ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={() => setAjustes(a => !a)} title="Ajustes de som e efeitos" aria-expanded={ajustes}
              className="w-9 h-9 rounded-lg grid place-items-center text-[#cfc6dd] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <Settings2 className="w-4 h-4" />
            </button>
            <button onClick={() => setAberta(false)} title="Voltar para a chamada (a partida continua)"
              className="h-9 px-3 rounded-lg text-[13px] text-[#cfc6dd] hover:bg-white/10 flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <Minimize2 className="w-4 h-4" /> <span className="hidden sm:inline">Ver a chamada</span>
            </button>
            <button onClick={() => { if (p.status !== 'jogando' || window.confirm('Sair da partida? Suas cartas voltam para o monte.')) sair(); }}
              title="Sair da mesa" className="h-9 px-3 rounded-lg text-[13px] text-[#ff8098] hover:bg-[#ed4245]/15 flex items-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Lobby */}
        {p.status === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 text-center overflow-y-auto">
            <div className="flex -space-x-6">
              {[{ id: 'a', cor: 'laranja', tipo: 'numero', valor: 0 }, { id: 'b', cor: null, tipo: 'todosunidos' }, { id: 'c', cor: 'roxo', tipo: 'numero', valor: 3 }].map((c, i) => (
                <motion.div key={c.id} initial={{ y: 30, opacity: 0, rotate: 0 }} animate={{ y: [30, 0, -4, 0], opacity: 1, rotate: (i - 1) * 12 }} transition={{ delay: i * 0.08, duration: 0.7 }}>
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
              <AnimatePresence>
                {p.jogadores.map(j => (
                  <motion.div key={j.id} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                    className="flex flex-col items-center gap-1 w-20">
                    <div className="relative"><Avatar j={j} tamanho={52} />{j.id === p.hostId && <Crown className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 text-[#ffcc4d]" />}</div>
                    <span className="text-[12px] truncate max-w-full">{j.id === meuId ? 'Você' : j.nome}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {souHost ? (
              <button onClick={() => fazer('iniciar')} disabled={enviando}
                className="h-12 px-8 rounded-2xl font-black text-[15px] flex items-center gap-2 disabled:opacity-60 shadow-[0_10px_30px_rgba(122,44,255,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />} Começar partida
              </button>
            ) : (
              <p className="text-[#a99cb8] text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Esperando quem abriu a mesa começar…</p>
            )}
            <div className="text-left text-[12.5px] text-[#a99cb8] max-w-md rounded-2xl bg-white/[0.04] border border-white/[0.06] px-4 py-3 space-y-1">
              <p><b className="text-white">Como jogar:</b> jogue uma carta da mesma cor ou do mesmo número/símbolo da mesa. Clique para escolher e clique de novo (ou arraste até a mesa) para jogar.</p>
              <p><b className="text-white">Bloqueio</b> pula o próximo · <b className="text-white">Troca</b> inverte o sentido · <b className="text-white">Call</b> escolhe quem joga · <b className="text-white">+2</b> e <b className="text-white">Todos Unidos (+4)</b> acumulam · <b className="text-white">Conexão</b> muda a cor.</p>
              <p>Com 1 carta, aperte <b className="text-white">UNidos!</b> — se esquecer e alguém pegar, você compra 2.</p>
            </div>
          </div>
        )}

        {/* Partida */}
        {p.status !== 'lobby' && (
          <motion.div animate={palco} className="flex-1 min-h-0 flex flex-col">
            {/* Adversários */}
            <div className="flex justify-center gap-1 sm:gap-3 px-2 pt-2 overflow-x-auto nx-no-scrollbar shrink-0">
              {adversarios.map(j => (
                <Adversario key={j.id} j={j} daVez={p.status === 'jogando' && p.vezId === j.id} prazo={p.prazoLocal || 0} host={j.id === p.hostId}
                  onPegar={() => { fazer('pegar', { alvoId: j.id }); }} />
              ))}
            </div>

            {/* Mesa */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-5">
              <div className="flex items-center gap-8 sm:gap-14">
                <Monte tamanho={tamanhoMao + 8} pode={minhaVez && !p.comprada && !enviando} acumulado={p.acumulado} total={p.monte}
                  onComprar={() => { audio.destravar(); fazer('comprar'); }} />
                <Pilha topo={p.topo} corAtual={p.corAtual} acumulado={p.acumulado} tamanho={tamanhoMao + 22}
                  jogadorId={p.ultima?.acao === 'jogou' ? p.ultima.jogadorId : null} meuId={meuId} modo={modo}
                  arrasto={arrasto} processando={processando}
                  onPouso={c => impactoNaPilha(c, p.corAtual)} />
              </div>

              <div className="flex items-center gap-2 text-[13px] text-[#cfc6dd] min-h-[22px] px-4 text-center mt-4">
                {p.status === 'jogando' && (
                  <motion.span key={p.sentido} initial={{ rotate: p.sentido === 1 ? -180 : 180, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                    title={p.sentido === 1 ? 'Sentido horário' : 'Sentido anti-horário'} className="shrink-0">
                    {p.sentido === 1 ? <RotateCw className="w-4 h-4 text-[#a99cb8]" aria-label="sentido horário" /> : <RotateCcw className="w-4 h-4 text-[#ffb27d]" aria-label="sentido anti-horário" />}
                  </motion.span>
                )}
                <span>{textoUltima(p, meuId)}</span>
              </div>
            </div>

            {/* Minha área */}
            {eu && p.status === 'jogando' && (
              <div className="shrink-0 pb-3 relative">
                <div className="flex items-center justify-center gap-2.5 mb-1 px-3 min-h-[44px] flex-wrap">
                  <AvatarMesa j={eu} tamanho={34} daVez={minhaVez} restanteMs={restanteMs} alvo={`jogador:${meuId}`} />
                  {minhaVez ? (
                    <span className={cn('text-[13px] font-black px-3 py-1.5 rounded-full text-white flex items-center gap-2 transition-colors', segundos <= 6 && 'animate-pulse')}
                      style={{ background: segundos <= 6 ? 'linear-gradient(135deg,#ff4d6d,#b3204a)' : 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
                      Sua vez <span className="tabular-nums bg-black/30 rounded-full px-1.5">{segundos}s</span>
                    </span>
                  ) : (
                    <span className="text-[12.5px] text-[#a99cb8]">Vez de <b className="text-white">{vezDe?.nome}</b></span>
                  )}
                  {minhaVez && p.comprada && (
                    <button onClick={() => fazer('passar')} disabled={enviando}
                      className="h-9 px-4 rounded-full text-[13px] font-bold bg-white/10 hover:bg-white/15 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">Passar a vez</button>
                  )}
                  {p.minhaMao.length <= 2 && !eu.gritou && (
                    <motion.button initial={{ scale: 0.8 }} animate={modo.reduzido ? { scale: 1 } : { scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
                      onClick={() => { fazer('gritar'); }}
                      className="h-10 px-5 rounded-full text-[15px] font-black text-[#0a0713] shadow-[0_6px_20px_rgba(255,106,0,.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                      style={{ background: 'linear-gradient(135deg,#ffcf8a,#ff6a00)' }}>
                      UNidos!
                    </motion.button>
                  )}
                  {eu.gritou && p.minhaMao.length <= 2 && <span className="text-[12px] font-black text-[#ffb27d]">Você gritou UNidos!</span>}
                </div>
                <Mao cartas={p.minhaMao} jogaveis={jogaveis} minhaVez={minhaVez} ocupado={enviando} umClique={umClique}
                  modo={modo} tamanho={tamanhoMao} distribuir={!!anterior.current && anterior.current.status !== 'jogando'} aoJogar={aoJogar} aoArrastar={setArrasto} avisar={setAviso} />
                <AnimatePresence>
                  {aviso && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="absolute left-1/2 -translate-x-1/2 top-12 z-[20] px-3 py-1.5 rounded-full text-[12.5px] font-semibold bg-black/75 border border-white/10 whitespace-nowrap pointer-events-none"
                      role="status">
                      {aviso}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {!eu && p.status === 'jogando' && (
              <p className="text-center text-[13px] text-[#a99cb8] pb-6">Você está assistindo esta partida.</p>
            )}
          </motion.div>
        )}

        {/* Fim de partida */}
        {p.status === 'fim' && (
          <PainelFim key={p.seq} vencedor={vencedor} meuId={meuId} pontos={p.pontos ?? 0} duracao={p.duracao ?? 0}
            souHost={souHost} hostNome={host?.nome || 'quem abriu a mesa'} enviando={enviando}
            atraso={fimAoAbrir.current ? 0 : modo.reduzido ? 600 : 1350}
            onRevanche={() => { fimAoAbrir.current = false; fazer('revanche'); }} onVoltar={() => setAberta(false)} onSair={() => sair()} />
        )}

        {/* Escolher a cor / quem joga */}
        <AnimatePresence>
          {seletor?.tipo === 'cor' && (
            <SeletorCor key="cor" carta={seletor.carta} aoEscolher={cor => concluirSeletor({ cor })} aoCancelar={cancelarSeletor} />
          )}
          {seletor?.tipo === 'alvo' && (
            <SeletorAlvo key="alvo" jogadores={adversarios} aoEscolher={alvoId => concluirSeletor({ alvoId })} aoCancelar={cancelarSeletor} />
          )}
        </AnimatePresence>

        <AnimatePresence>{ajustes && <Ajustes onFechar={() => setAjustes(false)} />}</AnimatePresence>

        {/* Aviso de erro do servidor (a carta já voltou para a mão) */}
        <AnimatePresence>
          {erro && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="absolute z-[60] bottom-[calc(env(safe-area-inset-bottom)+16px)] inset-x-0 mx-auto w-max max-w-[90vw] px-4 py-2.5 rounded-xl text-sm bg-[#3a1220] border border-[#ed4245]/40 text-[#ffd0d8] flex items-center gap-2"
              role="alert">
              {erro}
              <button onClick={limparErro} className="text-white/70 hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camadas dos efeitos (não bloqueiam cliques) */}
        <CamadaEspeciais meuId={meuId} nome={nome} />
        <CamadaVoos />
        <CamadaParticulas />

        {/* Leitor de tela: o que acabou de acontecer */}
        <p className="sr-only" aria-live="polite">{p.status === 'jogando' ? textoUltima(p, meuId) : ''}{minhaVez ? '. Sua vez.' : ''}</p>
      </motion.div>
    </MotionConfig>
  );
}
