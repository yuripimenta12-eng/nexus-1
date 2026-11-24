'use client';

// Janela de pagamento por Pix (Efí): mostra o QR Code e o copia e cola e espera o
// pagamento cair, sem sair do Nexus. Preço, validade e entrega são do servidor.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Loader2, X, Clock, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { toast } from '@/components/ui/toaster';

export type PedidoNovo = { tipo: 'plano' | 'prisma' | 'doacao'; item?: string; valorCentavos?: number };
type Pedido = {
  id: string; tipo: string; nome: string; valorCentavos: number; status: 'pendente' | 'pago' | 'expirado';
  copiaECola: string; qrImagem: string | null; expiraEm: string;
};

export const reais = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  const [agora, setAgora] = useState(Date.now());
  const [copiado, setCopiado] = useState(false);
  const avisou = useRef(false);

  // Cria (ou reaproveita) o pedido
  useEffect(() => {
    let vivo = true;
    api.get('/pagamentos/disponivel').then(r => vivo && setTeste(!!r.data?.teste)).catch(() => {});
    api.post('/pagamentos/pix', pedido)
      .then(({ data }) => vivo && setP(data))
      .catch(e => vivo && setErro(e?.response?.data?.message || 'Não deu para gerar o Pix agora. Tente de novo.'));
    return () => { vivo = false; };
  }, [pedido]);

  // Pergunta a cada 4 s e escuta o aviso do servidor
  const id = p?.id;
  const pendente = p?.status === 'pendente';
  useEffect(() => {
    if (!id || !pendente) return;
    const ver = () => api.get(`/pagamentos/pix/${id}`).then(({ data }) => setP(data)).catch(() => {});
    const t = setInterval(ver, 4000);
    const s = getSocket();
    const onPago = (d: { id: string }) => { if (d?.id === id) ver(); };
    s.on('pagamento:pago', onPago);
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(relogio); s.off('pagamento:pago', onPago); };
  }, [id, pendente]);

  useEffect(() => {
    if (p?.status === 'pago' && !avisou.current) { avisou.current = true; onPago?.(); }
  }, [p?.status, onPago]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const copiar = async () => {
    if (!p) return;
    try { await navigator.clipboard.writeText(p.copiaECola); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
    catch { toast('Não deu para copiar. Selecione o código e copie à mão.', 'error'); }
  }

  const resta = p ? Math.max(0, new Date(p.expiraEm).getTime() - agora) : 0;
  const venceu = p?.status === 'expirado' || (p?.status === 'pendente' && resta === 0);
  const mmss = `${Math.floor(resta / 60000)}:${String(Math.floor((resta % 60000) / 1000)).padStart(2, '0')}`;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="pix-titulo"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--th-line-2)] bg-[var(--th-panel)] shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg text-[#a99cb8] hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>

        <div className="border-b border-[var(--th-line)] px-5 pb-4 pt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#a99cb8]">{pedido.tipo === 'doacao' ? 'Doação' : 'Você está comprando'}</p>
          <h2 id="pix-titulo" className="mt-0.5 text-lg font-extrabold text-white">{p?.nome ?? (pedido.tipo === 'doacao' ? 'Doação para o Nexus' : '…')}</h2>
          {p && <p className="text-3xl font-black tracking-tight text-white">{reais(p.valorCentavos)}</p>}
          {teste && <p className="mt-2 rounded-lg bg-[#ffc23d]/15 px-2.5 py-1.5 text-xs font-bold text-[#ffc23d]">MODO TESTE: este Pix não cobra dinheiro de verdade.</p>}
        </div>

        <div className="px-5 py-5">
          {erro ? (
            <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{erro}</p>
          ) : !p ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-[#a99cb8]"><Loader2 className="size-6 animate-spin" />Gerando seu Pix…</div>
          ) : p.status === 'pago' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-[#c8f53b] text-[#18131f]"><Check className="size-9" strokeWidth={3} /></span>
              <b className="text-lg text-white">Pagamento confirmado!</b>
              <p className="text-sm text-[#a99cb8]">
                {p.tipo === 'plano' ? 'Seu plano já está valendo. Aproveite!' : p.tipo === 'prisma' ? 'A Prisma já está na sua conta.' : 'Muito obrigado por apoiar o Nexus! 💜'}
              </p>
              <button type="button" onClick={onClose} className="mt-1 w-full rounded-full bg-white py-2.5 text-sm font-extrabold text-[#18131f] hover:brightness-95">Fechar</button>
            </div>
          ) : venceu ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Clock className="size-10 text-[#a99cb8]" />
              <b className="text-white">Este Pix venceu</b>
              <p className="text-sm text-[#a99cb8]">Se você já pagou, espere uns instantes que ele aparece. Se não, feche e gere outro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <ol className="space-y-1 text-sm text-[#d6cde3]">
                <li>1. Abra o app do seu banco e escolha <b>Pix</b>.</li>
                <li>2. Leia o QR Code ou use o <b>copia e cola</b>.</li>
                <li>3. Confirme. A confirmação aparece aqui sozinha.</li>
              </ol>
              {p.qrImagem && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.qrImagem} alt="QR Code do Pix" className="mx-auto size-52 rounded-xl bg-white p-2" />
              )}
              <div>
                <label htmlFor="pix-copia" className="text-xs font-bold text-[#a99cb8]">Pix copia e cola</label>
                <div className="mt-1 flex gap-2">
                  <input id="pix-copia" readOnly value={p.copiaECola} onFocus={e => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-[var(--th-line-2)] bg-black/30 px-2.5 py-2 text-xs text-white" />
                  <button type="button" onClick={copiar}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#c8f53b] px-3 text-sm font-extrabold text-[#18131f] hover:brightness-110">
                    {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}{copiado ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-[#d6cde3]"><Loader2 className="size-4 animate-spin" />Esperando o pagamento…</span>
                <span className="tabular-nums text-[#a99cb8]" aria-label="Tempo para pagar">{mmss}</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1 border-t border-[var(--th-line)] px-5 py-3 text-[11px] leading-snug text-[#8a8095]">
          <p className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 shrink-0" />Pix processado pelo Efí Bank. O Nexus não vê os dados do seu banco.</p>
          {pedido.tipo === 'doacao'
            ? <p>Doação não dá nada em troca: é só um apoio para manter o Nexus no ar.</p>
            : <p>Você tem 7 dias para se arrepender e pedir o dinheiro de volta: é só falar com o suporte.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
