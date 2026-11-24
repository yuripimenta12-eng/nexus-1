'use client';

// Checkout por Pix (Efí): resumo do pedido + QR Code e copia e cola, e espera o pagamento
// cair sem sair do Nexus. Preço, validade e entrega são do servidor.
// PagarPix cuida dos dados; JanelaPix só desenha (dá para ver cada estado sem pagar).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, Copy, Crown, Gem, Heart, Loader2, Lock, QrCode, RefreshCw, Smartphone, X } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { MoedaPrisma } from '@/components/nex/moeda-prisma';

export type PedidoNovo = { tipo: 'plano' | 'prisma' | 'doacao'; item?: string; valorCentavos?: number };
export type Pedido = {
  id: string; tipo: string; item?: string; nome: string; valorCentavos: number; status: 'pendente' | 'pago' | 'expirado';
  copiaECola: string; qrImagem: string | null; expiraEm: string; pagoEm?: string | null;
};

export const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const VALIDADE_MS = 30 * 60_000; // igual ao servidor (PIX_VALIDADE_S)

let disponivelCache: Promise<{ ligado: boolean; teste: boolean }> | null = null;
/** O Pix está ligado no servidor? (pergunta uma vez por página) */
export function usePixDisponivel() {
  const [d, setD] = useState<{ ligado: boolean; teste: boolean } | null>(null);
  useEffect(() => {
    disponivelCache ??= api.get('/pagamentos/disponivel').then(r => r.data).catch(() => { disponivelCache = null; return { ligado: false, teste: false }; });
    disponivelCache.then(setD);
  }, []);
  return d;
}

export function PagarPix({ pedido, onClose, onPago }: { pedido: PedidoNovo; onClose: () => void; onPago?: () => void }) {
  const [p, setP] = useState<Pedido | null>(null);
  const [erro, setErro] = useState('');
  const [teste, setTeste] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const avisou = useRef(false);

  // Cria (ou reaproveita) o pedido
  useEffect(() => {
    let vivo = true;
    setErro(''); setP(null);
    api.get('/pagamentos/disponivel').then(r => vivo && setTeste(!!r.data?.teste)).catch(() => {});
    api.post('/pagamentos/pix', pedido)
      .then(({ data }) => vivo && setP(data))
      .catch(e => vivo && setErro(e?.response?.data?.message || 'Não deu para gerar o Pix agora. Tente de novo.'));
    return () => { vivo = false; };
  }, [pedido, tentativa]);

  // Pergunta a cada 4 s e escuta o aviso do servidor
  const id = p?.id;
  const pendente = p?.status === 'pendente';
  useEffect(() => {
    if (!id || !pendente) return;
    const ver = () => api.get(`/pagamentos/pix/${id}`).then(({ data }) => setP(data)).catch(() => {});
    const t = setInterval(ver, 4000);
    const s = getSocket();
    const aoPagar = (d: { id: string }) => { if (d?.id === id) ver(); };
    s.on('pagamento:pago', aoPagar);
    return () => { clearInterval(t); s.off('pagamento:pago', aoPagar); };
  }, [id, pendente]);

  useEffect(() => {
    if (p?.status === 'pago' && !avisou.current) { avisou.current = true; onPago?.(); }
  }, [p?.status, onPago]);

  return <JanelaPix pedido={pedido} p={p} erro={erro} teste={teste} onClose={onClose} onTentar={() => setTentativa(n => n + 1)} />;
}

// Cara de cada produto: ícone, cor de destaque e o que vale saber antes de pagar
function cara(tipo: string, item?: string) {
  if (tipo === 'plano') {
    const pro = item?.startsWith('pro');
    const ano = item?.endsWith('ano');
    return {
      cor: pro ? '#ffb547' : '#3ee0ff',
      icone: pro ? <Crown className="size-5" /> : <Gem className="size-5" />,
      linhas: [
        `Vale ${ano ? '365 dias' : '30 dias'} a partir da confirmação do Pix`,
        'Não renova sozinho: nada é cobrado depois',
        'Se você já tem o plano, os dias se somam',
      ],
    };
  }
  if (tipo === 'prisma') {
    return {
      cor: '#5cc8ff',
      icone: <MoedaPrisma className="size-6" />,
      linhas: ['Cai na sua conta assim que o Pix for confirmado', 'Use em molduras, ícones, efeitos e caixas exclusivas', 'Não vira Nex e não passa para outra pessoa'],
    };
  }
  return {
    cor: '#ff5d86',
    icone: <Heart className="size-5" />,
    linhas: ['Ajuda a pagar os servidores e a manter o Nexus no ar', 'Doação é voluntária e não dá nada em troca'],
  };
}

export function JanelaPix({ pedido, p, erro, teste, onClose, onTentar }: {
  pedido: PedidoNovo; p: Pedido | null; erro: string; teste: boolean; onClose: () => void; onTentar: () => void;
}) {
  const [agora, setAgora] = useState(Date.now());
  const [copiado, setCopiado] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    fecharRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const copiar = async () => {
    if (!p) return;
    try { await navigator.clipboard.writeText(p.copiaECola); } catch {
      const campo = document.getElementById('pix-copia') as HTMLInputElement | null;
      campo?.select(); document.execCommand?.('copy');
    }
    setCopiado(true); setTimeout(() => setCopiado(false), 2500);
  };

  const c = cara(pedido.tipo, p?.item ?? pedido.item);
  const resta = p ? Math.max(0, new Date(p.expiraEm).getTime() - agora) : VALIDADE_MS;
  const venceu = p?.status === 'expirado' || (p?.status === 'pendente' && resta === 0);
  const pago = p?.status === 'pago';
  const mmss = `${Math.floor(resta / 60000)}:${String(Math.floor((resta % 60000) / 1000)).padStart(2, '0')}`;
  const fracao = Math.min(1, resta / VALIDADE_MS);
  const nome = p?.nome ?? (pedido.tipo === 'doacao' ? 'Doação para o Nexus' : 'Carregando…');
  const etapa = pago ? 3 : p && !venceu ? 2 : 1;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="pix-titulo"
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#121018] shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:max-w-[820px] sm:rounded-2xl">

        {/* Barra do topo */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3">
          <Lock className="size-3.5 text-[#7fd99a]" />
          <span className="text-xs font-semibold tracking-wide text-[#b9b2c6]">Pagamento seguro · Nexus</span>
          {teste && <span className="rounded-md bg-[#ffc23d]/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ffc23d]">Modo teste</span>}
          <button ref={fecharRef} type="button" onClick={onClose} aria-label="Fechar"
            className="ml-auto grid size-8 place-items-center rounded-lg text-[#8d84a0] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/40">
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto sm:grid-cols-[300px_1fr]">
          {/* Resumo do pedido */}
          <aside className="relative border-b border-white/[0.07] bg-[#0e0c13] p-5 sm:border-b-0 sm:border-r sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.18]" style={{ background: `radial-gradient(ellipse at 20% 0%, ${c.cor}, transparent 70%)` }} />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.12em] text-[#8d84a0]">{pedido.tipo === 'doacao' ? 'Sua doação' : 'Resumo do pedido'}</p>
            <div className="relative mt-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10" style={{ background: `${c.cor}1f`, color: c.cor }}>{c.icone}</span>
              <div className="min-w-0">
                <h2 id="pix-titulo" className="truncate text-[15px] font-bold text-white">{nome}</h2>
                <p className="text-xs text-[#8d84a0]">{pedido.tipo === 'plano' ? 'Plano pessoal' : pedido.tipo === 'prisma' ? 'Pacote de Prisma' : 'Apoio ao Nexus'}</p>
              </div>
            </div>
            <ul className="relative mt-5 hidden space-y-2 sm:block">
              {c.linhas.map(l => (
                <li key={l} className="flex gap-2 text-xs leading-relaxed text-[#b9b2c6]">
                  <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: c.cor }} strokeWidth={3} />{l}
                </li>
              ))}
            </ul>
            <div className="relative mt-4 space-y-2 border-t border-dashed border-white/10 pt-3 text-sm sm:mt-6 sm:pt-4">
              <div className="hidden justify-between text-[#8d84a0] sm:flex"><span>Subtotal</span><span className="tabular-nums">{p ? reais(p.valorCentavos) : '—'}</span></div>
              <div className="hidden justify-between text-[#8d84a0] sm:flex"><span>Taxas</span><span>Grátis</span></div>
              <div className="flex items-baseline justify-between sm:pt-1">
                <span className="font-semibold text-white">Total</span>
                <span className="text-2xl font-black tabular-nums tracking-tight text-white">{p ? reais(p.valorCentavos) : '—'}</span>
              </div>
            </div>
          </aside>

          {/* Pagamento */}
          <section className="flex flex-col p-5 sm:p-6">
            <Etapas atual={etapa} cor={c.cor} />

            <div className="mt-5 flex flex-1 flex-col">
              {erro ? (
                <div className="my-auto flex flex-col items-center gap-3 py-8 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-300"><X className="size-6" /></span>
                  <p className="max-w-xs text-sm text-[#d9d3e3]">{erro}</p>
                  <button type="button" onClick={onTentar} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5">
                    <RefreshCw className="size-4" />Tentar de novo
                  </button>
                </div>
              ) : !p ? (
                <div className="my-auto flex flex-col items-center gap-3 py-12 text-sm text-[#8d84a0]">
                  <Loader2 className="size-7 animate-spin" style={{ color: c.cor }} />Gerando seu Pix com segurança…
                </div>
              ) : pago ? (
                <Comprovante p={p} cor={c.cor} onClose={onClose} />
              ) : venceu ? (
                <div className="my-auto flex flex-col items-center gap-3 py-8 text-center">
                  <span className="grid size-12 place-items-center rounded-full bg-white/5 text-[#b9b2c6]"><QrCode className="size-6" /></span>
                  <b className="text-white">Este Pix venceu</b>
                  <p className="max-w-xs text-sm text-[#8d84a0]">Se você já pagou, espere uns instantes: a confirmação aparece aqui. Se não, gere um novo código.</p>
                  <button type="button" onClick={onTentar} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#121018] hover:brightness-95">
                    <RefreshCw className="size-4" />Gerar novo Pix
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 rounded-full bg-[#ffc23d]/10 px-2.5 py-1 text-xs font-semibold text-[#ffcf66]">
                      <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ffc23d] opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-[#ffc23d]" /></span>
                      Aguardando pagamento
                    </span>
                    <span className={cn('text-xs tabular-nums', resta < 120_000 ? 'text-[#ff8a8a]' : 'text-[#8d84a0]')} aria-label="Tempo para pagar">Expira em <b>{mmss}</b></span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${fracao * 100}%`, background: resta < 120_000 ? '#ff6b6b' : c.cor }} />
                  </div>

                  <div className="order-last mt-5 flex flex-col items-center gap-5 sm:order-none sm:flex-row sm:items-start">
                    {p.qrImagem && (
                      <div className="relative shrink-0 rounded-2xl p-[1px]" style={{ background: `linear-gradient(140deg, ${c.cor}99, rgba(255,255,255,0.08) 45%, ${c.cor}55)` }}>
                        <div className="rounded-[15px] bg-white p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.qrImagem} alt="QR Code do Pix" className="size-44 [image-rendering:pixelated]" />
                        </div>
                      </div>
                    )}
                    <ol className="space-y-3 text-sm text-[#d9d3e3]">
                      {[
                        ['Abra o app do seu banco', 'Entre na área Pix'],
                        ['Escaneie o QR Code', 'Ou escolha "Pix copia e cola"'],
                        ['Confira e confirme', 'A confirmação aparece aqui sozinha'],
                      ].map(([t, s], i) => (
                        <li key={t} className="flex gap-3">
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-white/15 text-[11px] font-bold text-white">{i + 1}</span>
                          <span><b className="block font-semibold text-white">{t}</b><span className="text-xs text-[#8d84a0]">{s}</span></span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-5">
                    <label htmlFor="pix-copia" className="flex items-center gap-1.5 text-xs font-semibold text-[#b9b2c6]"><Smartphone className="size-3.5" />Pix copia e cola</label>
                    <div className="mt-1.5 flex overflow-hidden rounded-xl border border-white/10 bg-black/30 focus-within:border-white/25">
                      <input id="pix-copia" readOnly value={p.copiaECola} onFocus={e => e.currentTarget.select()}
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-[11px] text-[#d9d3e3] outline-none" />
                      <button type="button" onClick={copiar}
                        className={cn('flex shrink-0 items-center gap-1.5 px-4 text-sm font-bold transition-colors', copiado ? 'bg-[#7fd99a] text-[#0b2614]' : 'bg-white text-[#121018] hover:bg-white/90')}>
                        {copiado ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}{copiado ? 'Copiado!' : 'Copiar código'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Rodapé */}
        <div className="flex flex-col gap-1 border-t border-white/[0.07] bg-[#0e0c13] px-5 py-3 text-[11px] leading-snug text-[#7c748c] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5"><Lock className="size-3" />Pix processado pelo Efí Bank. O Nexus não vê os dados do seu banco.</span>
          <span>{pedido.tipo === 'doacao' ? 'Doação voluntária, sem nada em troca.' : '7 dias para se arrepender: fale com o suporte.'} Ao pagar, você aceita os <a href="/termos" target="_blank" rel="noopener" className="underline hover:text-white">Termos de Uso</a>.</span>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

function Etapas({ atual, cor }: { atual: number; cor: string }) {
  const nomes = ['Pedido', 'Pagamento', 'Confirmado'];
  return (
    <ol className="flex items-center gap-2" aria-label="Etapas do pagamento">
      {nomes.map((n, i) => {
        const feito = i + 1 < atual || atual === 3;
        const agora = i + 1 === atual && atual !== 3;
        return (
          <li key={n} className="flex flex-1 items-center gap-2" aria-current={agora ? 'step' : undefined}>
            <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-black',
              feito ? 'text-[#121018]' : agora ? 'border-2 text-white' : 'border border-white/15 text-[#6f6880]')}
              style={feito ? { background: cor } : agora ? { borderColor: cor } : undefined}>
              {feito ? <Check className="size-3" strokeWidth={4} /> : i + 1}
            </span>
            <span className={cn('text-xs font-semibold', feito || agora ? 'text-white' : 'text-[#6f6880]')}>{n}</span>
            {i < nomes.length - 1 && <span className="h-px flex-1 bg-white/10" />}
          </li>
        );
      })}
    </ol>
  );
}

function Comprovante({ p, cor, onClose }: { p: Pedido; cor: string; onClose: () => void }) {
  const quando = p.pagoEm ? new Date(p.pagoEm) : new Date();
  const ganhou = p.tipo === 'plano' ? 'Seu plano já está valendo.' : p.tipo === 'prisma' ? 'A Prisma já está na sua conta.' : 'Muito obrigado por apoiar o Nexus!';
  return (
    <div className="flex flex-col items-center py-2 text-center">
      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
        className="grid size-14 place-items-center rounded-full text-[#0b2614]" style={{ background: '#7fd99a', boxShadow: '0 0 0 8px rgba(127,217,154,0.12)' }}>
        <Check className="size-8" strokeWidth={3} />
      </motion.span>
      <b className="mt-4 text-lg text-white">Pagamento confirmado</b>
      <p className="text-sm text-[#b9b2c6]">{ganhou}</p>

      <dl className="mt-5 w-full divide-y divide-white/[0.06] rounded-xl border border-white/10 bg-black/20 text-left text-sm">
        {[
          ['Item', p.nome],
          ['Valor pago', reais(p.valorCentavos)],
          ['Data', quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })],
          ['Pedido', `#${p.id.slice(-8).toUpperCase()}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-[#8d84a0]">{k}</dt><dd className="truncate font-semibold text-white tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[#7c748c]">O comprovante completo fica no app do seu banco.</p>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-[#121018] hover:brightness-95" style={{ background: cor }}>
        Concluir
      </button>
    </div>
  );
}
