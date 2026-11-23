'use client';

// Par ou ímpar e votação na call. O servidor guarda o número de quem desafiou
// até o outro responder e conta os votos; aqui só desenhamos.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, Vote, X, Plus, Trophy, Loader2 } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

type Lado = 'par' | 'impar';
interface Desafio { id: string; de: string; para: string; lado: Lado; expiraEm: number }
interface Resultado { id: string; de: string; para: string; lado: Lado; numDe: number; numPara: number; soma: number; saiu: Lado; vencedor: string }
interface Votacao {
  id: string; autorId: string; pergunta: string; opcoes: string[]; fimEm: number; encerrada: boolean;
  contagem: number[]; total: number; vencedoras: number[];
}
type Resposta = { ok: boolean; erro?: string; [k: string]: any };

interface EscolhasState {
  sala: string | null;
  desafios: Desafio[];
  resultados: Resultado[];
  votacao: Votacao | null;
  meuVoto: number | null;
  fechada: string | null; // votação encerrada que eu já fechei
}
export const useEscolhas = create<EscolhasState>(() => ({
  sala: null, desafios: [], resultados: [], votacao: null, meuVoto: null, fechada: null,
}));

function pedir(evento: string, dado: unknown): Promise<Resposta> {
  return new Promise(res => {
    const t = setTimeout(() => res({ ok: false, erro: 'Sem resposta do servidor, tente de novo' }), 6000);
    getSocket().emit(evento, dado, (r: Resposta) => { clearTimeout(t); res(r || { ok: false }); });
  });
}
async function pedirOuAvisar(evento: string, dado: unknown) {
  const r = await pedir(evento, dado);
  if (!r.ok) toast(r.erro || 'Não deu certo', 'error');
  return r;
}

const LADO = { par: 'Par', impar: 'Ímpar' } as const;

/** Liga a escuta do par ou ímpar e da votação na sala de voz aberta. */
export function useEscutarEscolhas(voiceRoomId: string | undefined, conectado: boolean) {
  useEffect(() => {
    if (!voiceRoomId || !conectado) return;
    useEscolhas.setState({ sala: voiceRoomId, desafios: [], resultados: [], votacao: null, meuVoto: null });
    const s = getSocket();
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const consultar = () => pedir('escolhas:consultar', { voiceRoomId }).then(r => {
      if (r.ok) useEscolhas.setState({ votacao: r.votacao, meuVoto: r.meuVoto, desafios: r.desafios || [] });
      // logo ao entrar o servidor pode ainda não ter posto o socket na sala: tenta de novo
      else if (++tentativas < 4) espera = setTimeout(consultar, 1500);
    });
    const onDesafio = (d: Desafio) => useEscolhas.setState(st => ({ desafios: [...st.desafios.filter(x => x.id !== d.id), d] }));
    const onFim = ({ id, motivo }: { id: string; motivo: string }) => {
      const st = useEscolhas.getState();
      const d = st.desafios.find(x => x.id === id);
      const eu = useAuthStore.getState().user?.id;
      if (d && d.de === eu && motivo === 'recusou') toast('Seu desafio de par ou ímpar foi recusado');
      if (d && d.de === eu && motivo === 'expirou') toast('Ninguém respondeu seu par ou ímpar a tempo');
      useEscolhas.setState({ desafios: st.desafios.filter(x => x.id !== id) });
    };
    const onResultado = (r: Resultado) => {
      useEscolhas.setState(st => ({ desafios: st.desafios.filter(x => x.id !== r.id), resultados: [...st.resultados.slice(-3), r] }));
      setTimeout(() => useEscolhas.setState(st => ({ resultados: st.resultados.filter(x => x.id !== r.id) })), 9000);
    };
    const onVotacao = (v: Votacao) => useEscolhas.setState(st => ({
      votacao: v, meuVoto: st.votacao?.id === v.id ? st.meuVoto : null,
    }));
    consultar();
    s.on('connect', consultar); // reconectou: pega o que está aberto
    s.on('parimpar:desafio', onDesafio);
    s.on('parimpar:fim', onFim);
    s.on('parimpar:resultado', onResultado);
    s.on('votacao:estado', onVotacao);
    return () => {
      clearTimeout(espera);
      s.off('connect', consultar);
      s.off('parimpar:desafio', onDesafio);
      s.off('parimpar:fim', onFim);
      s.off('parimpar:resultado', onResultado);
      s.off('votacao:estado', onVotacao);
      useEscolhas.setState({ sala: null, desafios: [], resultados: [], votacao: null });
    };
  }, [voiceRoomId, conectado]);
}

function useAgora(ativo: boolean) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);
  return agora;
}

function Maos({ onEscolher, desativado }: { onEscolher: (n: number) => void; desativado?: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {[0, 1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" disabled={desativado} onClick={() => onEscolher(n)}
          className="h-9 rounded-lg bg-white/[0.06] hover:bg-[#7a2cff] text-white font-black tabular-nums disabled:opacity-40 transition-colors">
          {n}
        </button>
      ))}
    </div>
  );
}

// ── Painel do botão da barra: criar par ou ímpar ou votação ────────
export function PainelEscolhas({ pessoas, onClose }: { pessoas: { id: string; nome: string }[]; onClose: () => void }) {
  const sala = useEscolhas(s => s.sala);
  const votacaoAberta = useEscolhas(s => !!s.votacao && !s.votacao.encerrada);
  const [aba, setAba] = useState<'parimpar' | 'votacao'>('parimpar');
  const [alvo, setAlvo] = useState(pessoas.length === 1 ? pessoas[0].id : '');
  const [lado, setLado] = useState<Lado>('par');
  const [pergunta, setPergunta] = useState('');
  const [opcoes, setOpcoes] = useState(['', '']);
  const [duracao, setDuracao] = useState(60);
  const [enviando, setEnviando] = useState(false);

  const desafiar = async (numero: number) => {
    if (!alvo) { toast('Escolha quem você quer desafiar', 'error'); return; }
    setEnviando(true);
    const r = await pedirOuAvisar('parimpar:desafiar', { voiceRoomId: sala, alvoId: alvo, lado, numero });
    setEnviando(false);
    if (r.ok) onClose();
  };
  const criarVotacao = async () => {
    setEnviando(true);
    const r = await pedirOuAvisar('votacao:criar', { voiceRoomId: sala, pergunta, opcoes, duracaoS: duracao });
    setEnviando(false);
    if (r.ok) onClose();
  };
  const opcoesValidas = opcoes.filter(o => o.trim()).length >= 2 && pergunta.trim().length > 0;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
        role="dialog" aria-label="Par ou ímpar e votação"
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        className="fixed bottom-[96px] inset-x-0 mx-auto z-50 w-[min(94vw,360px)] p-3 rounded-2xl border border-[#4d3560]
                   bg-[var(--th-panel-2)] shadow-2xl"
      >
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/25 mb-3" role="tablist">
          {([['parimpar', 'Par ou ímpar', Hand], ['votacao', 'Votação', Vote]] as const).map(([id, nome, Icone]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
              className={cn('flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors',
                aba === id ? 'bg-[#7a2cff] text-white' : 'text-[#a99cb8] hover:text-white')}>
              <Icone className="w-3.5 h-3.5" /> {nome}
            </button>
          ))}
        </div>

        {aba === 'parimpar' ? (
          pessoas.length === 0 ? (
            <p className="text-sm text-[#a99cb8] py-4 text-center">Chame mais alguém para a call para jogar.</p>
          ) : (
            <div className="space-y-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#92879f]">
                Contra quem?
                <select value={alvo} onChange={e => setAlvo(e.target.value)}
                  className="mt-1 w-full px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm normal-case font-normal tracking-normal">
                  <option value="">Escolha uma pessoa</option>
                  {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </label>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#92879f] mb-1">Você quer</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['par', 'impar'] as const).map(l => (
                    <button key={l} type="button" onClick={() => setLado(l)} aria-pressed={lado === l}
                      className={cn('py-2 rounded-lg text-sm font-black border transition-colors',
                        lado === l ? 'bg-[#ff6a00] border-[#ff6a00] text-white' : 'border-white/10 text-[#d1c6da] hover:border-[#ff6a00]/60')}>
                      {LADO[l]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#92879f] mb-1">Quantos dedos? (só aparece no final)</p>
                <Maos onEscolher={desafiar} desativado={enviando || !alvo} />
              </div>
            </div>
          )
        ) : votacaoAberta ? (
          <p className="text-sm text-[#a99cb8] py-4 text-center">Já tem uma votação rolando. Vote no cartão em cima da call.</p>
        ) : (
          <form className="space-y-2.5" onSubmit={e => { e.preventDefault(); if (opcoesValidas) criarVotacao(); }}>
            <input value={pergunta} onChange={e => setPergunta(e.target.value)} maxLength={120} autoFocus
              placeholder="Pergunta (ex.: Qual jogo agora?)" aria-label="Pergunta"
              className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm" />
            {opcoes.map((o, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={o} maxLength={60} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`}
                  onChange={e => setOpcoes(opcoes.map((x, j) => (j === i ? e.target.value : x)))}
                  className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 text-white text-sm" />
                {opcoes.length > 2 && (
                  <button type="button" onClick={() => setOpcoes(opcoes.filter((_, j) => j !== i))} aria-label={`Tirar opção ${i + 1}`}
                    className="px-2 rounded-lg text-[#92879f] hover:text-white hover:bg-white/5"><X className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
            {opcoes.length < 6 && (
              <button type="button" onClick={() => setOpcoes([...opcoes, ''])}
                className="flex items-center gap-1 text-xs font-bold text-[#c49bff] hover:text-white">
                <Plus className="w-3.5 h-3.5" /> Mais uma opção
              </button>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[#92879f] font-bold">Tempo:</span>
              {[[30, '30s'], [60, '1 min'], [120, '2 min'], [300, '5 min']].map(([s, rot]) => (
                <button key={s} type="button" onClick={() => setDuracao(s as number)} aria-pressed={duracao === s}
                  className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold border',
                    duracao === s ? 'bg-[#7a2cff] border-[#7a2cff] text-white' : 'border-white/10 text-[#a99cb8] hover:text-white')}>
                  {rot}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!opcoesValidas || enviando}
              className="w-full py-2 rounded-xl bg-[#7a2cff] hover:bg-[#8f42ff] text-white text-sm font-black disabled:opacity-40 flex items-center justify-center gap-2">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />} Começar votação
            </button>
          </form>
        )}
      </motion.div>
    </>
  );
}

// ── Cartões em cima da call: votação, desafios e resultados ─────────
export function CartoesEscolhas({ nomeDe }: { nomeDe: (id: string) => string }) {
  const eu = useAuthStore(s => s.user?.id);
  const { sala, desafios, resultados, votacao, meuVoto, fechada } = useEscolhas();
  const agora = useAgora(desafios.length > 0 || (!!votacao && !votacao.encerrada));
  const [respondendo, setRespondendo] = useState(false);
  const mostrarVotacao = votacao && fechada !== votacao.id;
  if (!sala || (!mostrarVotacao && !desafios.length && !resultados.length)) return null;

  const votar = async (opcao: number) => {
    if (!votacao || votacao.encerrada) return;
    const antes = meuVoto;
    useEscolhas.setState({ meuVoto: opcao });
    const r = await pedirOuAvisar('votacao:votar', { voiceRoomId: sala, id: votacao.id, opcao });
    if (!r.ok) useEscolhas.setState({ meuVoto: antes });
  };
  const responder = async (id: string, numero: number) => {
    setRespondendo(true);
    await pedirOuAvisar('parimpar:responder', { id, numero });
    setRespondendo(false);
  };

  return (
    <div className="absolute top-[68px] md:top-[78px] right-3 z-30 w-[300px] max-w-[calc(100%-24px)] space-y-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {mostrarVotacao && votacao && (
          <motion.div key={votacao.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto rounded-2xl bg-[#141019]/95 backdrop-blur border border-[#7a2cff]/50 shadow-2xl p-3">
            <div className="flex items-start gap-2 mb-2">
              <Vote className="w-4 h-4 text-[#c49bff] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-bold leading-snug break-words">{votacao.pergunta}</p>
                <p className="text-[10.5px] text-[#92879f]">
                  {nomeDe(votacao.autorId)} · {votacao.total} {votacao.total === 1 ? 'voto' : 'votos'} ·{' '}
                  {votacao.encerrada ? 'encerrada' : `${Math.max(0, Math.ceil((votacao.fimEm - agora) / 1000))}s`}
                </p>
              </div>
              {votacao.encerrada ? (
                <button onClick={() => useEscolhas.setState({ fechada: votacao.id })} aria-label="Fechar resultado"
                  className="text-[#92879f] hover:text-white p-0.5"><X className="w-4 h-4" /></button>
              ) : votacao.autorId === eu && (
                <button onClick={() => pedirOuAvisar('votacao:encerrar', { voiceRoomId: sala })}
                  className="text-[10.5px] font-bold text-[#ffb070] hover:text-white px-1.5 py-0.5 rounded bg-white/5">Encerrar</button>
              )}
            </div>
            <div className="space-y-1">
              {votacao.opcoes.map((o, i) => {
                const pct = votacao.total ? Math.round((votacao.contagem[i] / votacao.total) * 100) : 0;
                const venceu = votacao.vencedoras.includes(i);
                return (
                  <button key={i} disabled={votacao.encerrada} onClick={() => votar(i)} aria-pressed={meuVoto === i}
                    className={cn('relative w-full overflow-hidden rounded-lg border text-left px-2.5 py-1.5 transition-colors',
                      meuVoto === i ? 'border-[#c49bff]' : 'border-white/10',
                      !votacao.encerrada && 'hover:border-[#c49bff]/70', venceu && 'border-[#ffc23d]')}>
                    <span className="absolute inset-y-0 left-0 transition-[width] duration-500"
                      style={{ width: `${pct}%`, background: venceu ? '#ffc23d33' : '#7a2cff40' }} />
                    <span className="relative flex items-center gap-2 text-[13px]">
                      {venceu && <Trophy className="w-3.5 h-3.5 text-[#ffc23d] shrink-0" />}
                      <span className="text-white font-semibold truncate flex-1">{o}</span>
                      <span className="text-[#c9bdd6] text-[11px] font-black tabular-nums">{votacao.contagem[i]} · {pct}%</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {votacao.encerrada && (
              <p className="mt-2 text-[12px] font-bold text-[#ffc23d]">
                {votacao.vencedoras.length === 0 ? 'Ninguém votou.'
                  : votacao.vencedoras.length === 1 ? `Venceu: ${votacao.opcoes[votacao.vencedoras[0]]}`
                  : `Empate: ${votacao.vencedoras.map(i => votacao.opcoes[i]).join(', ')}. Que tal um par ou ímpar?`}
              </p>
            )}
          </motion.div>
        )}

        {desafios.map(d => {
          const seg = Math.max(0, Math.ceil((d.expiraEm - agora) / 1000));
          const outroLado = d.lado === 'par' ? 'impar' : 'par';
          return (
            <motion.div key={d.id} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
              className="pointer-events-auto rounded-2xl bg-[#141019]/95 backdrop-blur border border-[#ff6a00]/50 shadow-2xl p-3">
              {d.para === eu ? (
                <>
                  <p className="text-white text-sm font-bold flex items-center gap-1.5">
                    <Hand className="w-4 h-4 text-[#ff9a1f]" /> {nomeDe(d.de)} te desafiou no par ou ímpar!
                  </p>
                  <p className="text-[12px] text-[#a99cb8] mt-0.5 mb-2">
                    Você é <b className="text-white">{LADO[outroLado]}</b>. Quantos dedos? <span className="tabular-nums">({seg}s)</span>
                  </p>
                  <Maos onEscolher={n => responder(d.id, n)} desativado={respondendo} />
                  <button onClick={() => pedirOuAvisar('parimpar:cancelar', { id: d.id })}
                    className="mt-2 text-[11px] font-bold text-[#92879f] hover:text-white">Recusar</button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-[#ff9a1f] shrink-0" />
                  <p className="text-[12.5px] text-[#d1c6da] flex-1 min-w-0">
                    {d.de === eu ? <>Esperando <b className="text-white">{nomeDe(d.para)}</b> responder…</>
                      : <><b className="text-white">{nomeDe(d.de)}</b> desafiou <b className="text-white">{nomeDe(d.para)}</b> no par ou ímpar</>}
                    <span className="text-[#786e83] tabular-nums"> {seg}s</span>
                  </p>
                  {d.de === eu && (
                    <button onClick={() => pedirOuAvisar('parimpar:cancelar', { id: d.id })}
                      className="text-[11px] font-bold text-[#92879f] hover:text-white">Cancelar</button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}

        {resultados.map(r => (
          <motion.div key={r.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            role="status"
            className="pointer-events-auto rounded-2xl bg-[#141019]/95 backdrop-blur border border-[#ffc23d]/60 shadow-2xl p-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-[2px] text-[#ff9a1f]">Par ou ímpar</p>
            <div className="flex items-center justify-center gap-3 my-1.5 text-white">
              <span className="text-center"><b className="block text-2xl tabular-nums">{r.numDe}</b><small className="text-[10px] text-[#a99cb8]">{nomeDe(r.de)} · {LADO[r.lado]}</small></span>
              <span className="text-[#786e83] font-black">+</span>
              <span className="text-center"><b className="block text-2xl tabular-nums">{r.numPara}</b><small className="text-[10px] text-[#a99cb8]">{nomeDe(r.para)} · {LADO[r.lado === 'par' ? 'impar' : 'par']}</small></span>
              <span className="text-[#786e83] font-black">=</span>
              <b className="text-2xl tabular-nums">{r.soma}</b>
            </div>
            <p className="text-sm font-black text-[#ffc23d]">
              Deu {LADO[r.saiu].toLowerCase()}! {r.vencedor === eu ? 'Você ganhou! 🎉' : `${nomeDe(r.vencedor)} ganhou!`}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
