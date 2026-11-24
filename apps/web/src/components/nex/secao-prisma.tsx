'use client';

// Seção Prisma da loja: pacotes (pagos por Pix) e caixas exclusivas sem sorteio.
// Preço, saldo e entrega são do servidor (/loja e /loja/prisma/*).
import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { RARIDADE, type Raridade, type TipoItem } from '@/lib/itens';
import { MoedaPrisma } from '@/components/nex/moeda-prisma';
import { formatarNex } from '@/components/nex/moeda-nex';
import { PagarPix, usePixDisponivel, type PedidoNovo } from '@/components/pagamento/pagar-pix';

export interface PacotePrisma { id: string; prismas: number; bonus: number; reais: string }
export interface CaixaPrisma { id: string; nome: string; preco: number; precoPraVoce: number; temTudo: boolean; cor: string; desc: string; itens: string[] }
type Info = { nome: string; tipo: TipoItem; raridade: Raridade; possui: boolean };

const TIPO: Partial<Record<TipoItem, string>> = { moldura: 'Moldura', icone: 'Ícone', efeito: 'Efeito', placa: 'Placa', som: 'Som' };
const botaoAzul = {
  background: 'linear-gradient(180deg,#5cc8ff 0%,#2a8cff 55%,#1c56e0 100%)',
  border: '1px solid rgba(190,235,255,0.6)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), 0 3px 0 #10307e, 0 8px 16px rgba(42,140,255,0.3)',
};

export function SecaoPrisma({ prismas, pacotes, caixas, info, onMudou }: {
  prismas: number; pacotes: PacotePrisma[]; caixas: CaixaPrisma[]; info: Record<string, Info>; onMudou: () => void;
}) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [pedido, setPedido] = useState<PedidoNovo | null>(null);
  const pix = usePixDisponivel();

  const abrir = async (c: CaixaPrisma) => {
    if (!window.confirm(`Abrir a ${c.nome} por ${formatarNex(c.precoPraVoce)} Prisma?`)) return;
    setOcupado(c.id);
    try {
      const { data } = await api.post(`/loja/prisma/caixa/${c.id}`);
      toast(`${c.nome} aberta! Agora é seu: ${(data.itens as string[]).map(id => info[id]?.nome ?? id).join(', ')}.`, 'success');
      onMudou();
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu para abrir agora', 'error'); }
    setOcupado(null);
  };

  return (
    <div className="mb-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#1f3d66] p-4 sm:p-5"
        style={{ background: 'radial-gradient(ellipse at 15% 0%, rgba(63,182,255,0.25), transparent 60%), linear-gradient(135deg,#0c1830,#120d1c)' }}>
        <div className="flex flex-wrap items-center gap-3">
          <MoedaPrisma className="w-12 h-12" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-black text-white">Prisma</h2>
            <p className="text-sm text-[#9cc4e8]">A moeda azul, comprada com dinheiro, para molduras, ícones, efeitos e caixas exclusivas. Não vira Nex e não passa para outra pessoa.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#7fa6c9]">Seu saldo</p>
            <b className="flex items-center gap-1 text-2xl font-black text-white tabular-nums"><MoedaPrisma className="w-6 h-6" />{formatarNex(prismas)}</b>
          </div>
        </div>
        <div className="mt-4 grid gap-3 grid-cols-2 lg:grid-cols-4">
          {pacotes.map(p => (
            <div key={p.id} className="rounded-xl border border-[#24476f] bg-[#0b1426]/80 p-3 text-center">
              <MoedaPrisma className="w-10 h-10 mx-auto" />
              <b className="block mt-1 text-lg font-black text-white tabular-nums">{formatarNex(p.prismas)} Prisma</b>
              <span className={p.bonus ? 'text-[11px] font-bold text-[#5cffb0]' : 'text-[11px] text-[#7fa6c9]'}>{p.bonus ? `+${p.bonus} de bônus` : 'Pacote inicial'}</span>
              <button style={botaoAzul}
                onClick={() => pix?.ligado
                  ? setPedido({ tipo: 'prisma', item: p.id })
                  : toast('O pagamento por Pix está sendo ligado e chega logo. Enquanto isso, a equipe do Nexus pode colocar Prisma na sua conta.', 'info')}
                className="mt-2 w-full h-9 rounded-[10px] text-sm font-black text-white hover:brightness-110 active:translate-y-[2px]">
                R$ {p.reais.replace('.', ',')}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[#7fa6c9]">{pix?.ligado ? 'Pague com Pix e a Prisma cai na hora.' : 'Pagamento por Pix em breve.'} Comprou, a Prisma é sua; os itens comprados com ela são para sempre.</p>
        {pedido && <PagarPix pedido={pedido} onClose={() => setPedido(null)} onPago={onMudou} />}
      </div>

      {caixas.length > 0 && (
        <div>
          <h3 className="text-lg font-black text-white">Caixas exclusivas</h3>
          <p className="text-sm text-[#a99fc0]">Você vê tudo o que vem dentro: sem sorteio. Se já tem parte, paga só o que falta.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {caixas.map(c => {
              const falta = prismas < c.precoPraVoce;
              return (
                <div key={c.id} className="rounded-2xl border p-4 bg-[#120d1c]" style={{ borderColor: `${c.cor}55`, boxShadow: `inset 0 0 40px ${c.cor}14` }}>
                  <b className="text-white font-black text-base" style={{ textShadow: `0 0 12px ${c.cor}66` }}>{c.nome}</b>
                  <p className="text-xs text-[#a99fc0] mt-0.5">{c.desc}</p>
                  <ul className="mt-3 space-y-1.5">
                    {c.itens.map(id => {
                      const i = info[id];
                      return (
                        <li key={id} className="flex items-center gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: i ? RARIDADE[i.raridade].cor : '#888' }} />
                          <span className="text-[#e6dff0] font-bold">{i?.nome ?? id}</span>
                          <span className="text-[11px] text-[#8d82a0]">{i ? TIPO[i.tipo] : ''}</span>
                          {i?.possui && <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#5cffb0]"><Check className="w-3 h-3" /> Já tem</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <button disabled={c.temTudo || falta || !!ocupado} onClick={() => abrir(c)} style={c.temTudo || falta ? undefined : botaoAzul}
                    className="mt-4 w-full h-10 rounded-[11px] text-[13px] font-black text-white flex items-center justify-center gap-1.5 disabled:bg-[#1d1529] disabled:text-[#8d82a0] hover:brightness-110">
                    {ocupado === c.id ? <Loader2 className="w-4 h-4 animate-spin" />
                      : c.temTudo ? 'Você já tem tudo'
                      : <><MoedaPrisma className="w-[18px] h-[18px]" /> {falta ? `Faltam ${formatarNex(c.precoPraVoce - prismas)}` : `Abrir por ${formatarNex(c.precoPraVoce)}`}
                        {c.precoPraVoce < c.preco && !falta && <s className="ml-1 text-white/60 font-bold">{formatarNex(c.preco)}</s>}</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
