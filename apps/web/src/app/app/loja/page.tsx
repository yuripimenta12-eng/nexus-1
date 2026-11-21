'use client';

// Loja Nexus: gasta os Nex ganhos na presença, roleta e missões.
// Quem decide preço, saldo e posse é o servidor (/loja); aqui só mostra.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Sparkles, Frame, Smile, Tag, Backpack, Check, Lock, Loader2, X, Crown } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { useNex } from '@/lib/nex';
import { RARIDADE, ICONES, type Raridade, type TipoItem } from '@/lib/itens';
import { Avatar } from '@/components/ui/avatar';
import { NomeComItens } from '@/components/nex/itens-visuais';
import { MoedaNex, formatarNex } from '@/components/nex/moeda-nex';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

interface ItemLoja { id: string; tipo: TipoItem; nome: string; raridade: Raridade; preco: number | null; soPro?: boolean; possui: boolean }
interface DadosLoja { saldo: number; plano: string; equipados: Record<TipoItem, string | null>; itens: ItemLoja[] }

const SECOES = [
  { id: 'destaques', nome: 'Destaques', icone: Sparkles },
  { id: 'moldura', nome: 'Molduras', icone: Frame },
  { id: 'icone', nome: 'Ícones', icone: Smile },
  { id: 'placa', nome: 'Placas do nome', icone: Tag },
  { id: 'meus', nome: 'Meus itens', icone: Backpack },
] as const;
type Secao = (typeof SECOES)[number]['id'];
const ORDEM: Raridade[] = ['comum', 'rara', 'epica', 'lendaria'];

export default function LojaPage() {
  const { user, refreshUser } = useAuthStore();
  const [dados, setDados] = useState<DadosLoja | null>(null);
  const [secao, setSecao] = useState<Secao>('destaques');
  const [provando, setProvando] = useState<ItemLoja | null>(null);
  const [comprando, setComprando] = useState<ItemLoja | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => api.get('/loja').then(({ data }) => setDados(data)).catch(() => setDados(d => d ?? { saldo: 0, plano: 'gratis', equipados: { moldura: null, icone: null, placa: null }, itens: [] }));
  useEffect(() => { carregar(); }, []);

  const lista = useMemo(() => {
    if (!dados) return [];
    const its = dados.itens;
    if (secao === 'destaques') return its.filter(i => i.raridade === 'lendaria' || i.raridade === 'epica').slice(0, 12);
    if (secao === 'meus') return its.filter(i => i.possui);
    return its.filter(i => i.tipo === secao).sort((a, b) => ORDEM.indexOf(a.raridade) - ORDEM.indexOf(b.raridade));
  }, [dados, secao]);

  // Prévia: o que está equipado + o item que está "provando"
  const visual = {
    moldura: provando?.tipo === 'moldura' ? provando.id : dados?.equipados.moldura,
    icone: provando?.tipo === 'icone' ? provando.id : dados?.equipados.icone,
    placa: provando?.tipo === 'placa' ? provando.id : dados?.equipados.placa,
  };
  const nome = user?.profile?.displayName || user?.username || 'Você';

  const comprar = async (item: ItemLoja) => {
    setOcupado(true);
    try {
      await api.post(`/loja/comprar/${item.id}`);
      toast(`${item.nome} é seu! Já pode usar.`, 'success');
      setComprando(null);
      await carregar();
      useNex.getState().carregar();
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu para comprar agora', 'error'); }
    setOcupado(false);
  };
  const equipar = async (item: ItemLoja, usar: boolean) => {
    setOcupado(true);
    try {
      await api.put('/loja/equipar', { tipo: item.tipo, itemId: usar ? item.id : null });
      await carregar();
      refreshUser().catch(() => {});
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu agora', 'error'); }
    setOcupado(false);
  };

  return (
    <div className="h-full overflow-y-auto nx-page-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        {/* Topo */}
        <div className="flex flex-wrap items-center gap-3">
          <MobileMenuButton />
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-white">
            <Store className="size-7 text-[#ffb070]" /> Loja <span className="text-[#c9a6ff]">Nexus</span>
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 h-10 pl-2 pr-3.5 rounded-full bg-[#1a1326] border border-[#2e2340]">
              <MoedaNex className="w-7 h-7" />
              <b className="text-white tabular-nums">{dados ? formatarNex(dados.saldo) : '…'}</b>
              <span className="text-xs font-bold text-[#a99fc0]">Nex</span>
            </div>
            <button onClick={() => useNex.getState().abrir('presenca')}
              className="h-10 px-4 rounded-full text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:brightness-110">
              Ganhar Nex
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#a99cb8]">
          Gaste os Nex que você ganha na presença, na roleta e nas missões. Comprou, é seu para sempre. Os Nex nunca são vendidos por dinheiro.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr_280px]">
          {/* Seções */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto nx-no-scrollbar -mx-1 px-1" aria-label="Seções da loja">
            {SECOES.map(s => (
              <button key={s.id} onClick={() => { setSecao(s.id); setProvando(null); }}
                className={cn('shrink-0 flex items-center gap-2.5 h-10 px-3 rounded-[12px] text-sm font-bold transition-colors',
                  secao === s.id ? 'bg-[#2a1c45] text-white' : 'text-[#a99fc0] hover:bg-white/5 hover:text-white')}>
                <s.icone className="w-4 h-4" /> {s.nome}
              </button>
            ))}
          </nav>

          {/* Vitrine */}
          <section>
            {!dados ? (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-[230px] rounded-2xl nx-skeleton" />)}</div>
            ) : lista.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#3a2a4d] p-8 text-center text-sm text-[#a99fc0]">
                {secao === 'meus' ? 'Você ainda não tem itens. Junte Nex e escolha o primeiro!' : 'Nada por aqui ainda.'}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                {lista.map(i => {
                  const r = RARIDADE[i.raridade];
                  const usando = dados.equipados[i.tipo] === i.id;
                  const bloqueado = i.soPro && dados.plano !== 'pro' && !i.possui;
                  return (
                    <div key={i.id}
                      onMouseEnter={() => setProvando(i)} onFocus={() => setProvando(i)}
                      className={cn('group relative rounded-2xl border overflow-hidden flex flex-col transition-transform hover:-translate-y-0.5',
                        provando?.id === i.id ? 'border-white/30' : 'border-white/10')}
                      style={{ background: r.fundo }}>
                      <div className="h-[118px] grid place-items-center relative">
                        <PreviaItem item={i} nome={nome} avatar={user?.profile?.avatarUrl} />
                        {usando && <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#3ddc84]/15 text-[#3ddc84]">Usando</span>}
                        {i.soPro && <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#ffc23d]/15 text-[#ffc23d]"><Crown className="w-3 h-3" /> Pro</span>}
                      </div>
                      <div className="px-3 pb-3 flex-1 flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: r.cor }}>◆ {r.nome}</span>
                        <b className="text-white text-sm leading-tight mt-0.5">{i.nome}</b>
                        <div className="mt-auto pt-2.5">
                          {i.possui ? (
                            <button disabled={ocupado} onClick={() => equipar(i, !usando)}
                              className={cn('w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 transition-colors',
                                usando ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#3ddc84]/15 text-[#3ddc84] hover:bg-[#3ddc84]/25')}>
                              {usando ? 'Tirar' : <><Check className="w-3.5 h-3.5" /> Usar</>}
                            </button>
                          ) : bloqueado ? (
                            <span className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 bg-black/30 text-[#a99fc0]">
                              <Lock className="w-3.5 h-3.5" /> Só com Pro
                            </span>
                          ) : i.preco !== null ? (
                            <button onClick={() => setComprando(i)}
                              className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 bg-black/35 text-white hover:bg-black/50 border border-white/10">
                              <MoedaNex className="w-4 h-4" /> {formatarNex(i.preco)}
                            </button>
                          ) : (
                            <span className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center bg-black/30 text-[#a99fc0]">Só em baú</span>
                          )}
                        </div>
                      </div>
                      <span className="absolute bottom-0 inset-x-0 h-[3px]" style={{ background: r.cor }} />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Prévia: como fica em você */}
          <aside className="lg:sticky lg:top-6 self-start rounded-2xl border border-[#2e2340] bg-[#140f1e] p-4">
            <p className="text-[11px] font-black uppercase tracking-[1.5px] text-[#ffb070]">Como fica em você</p>
            <div className="mt-4 flex flex-col items-center gap-3">
              <Avatar src={user?.profile?.avatarUrl} name={nome} size="xl" moldura={visual.moldura} />
              <NomeComItens nome={nome} icone={visual.icone} placa={visual.placa} className="text-white text-lg font-black" />
            </div>
            <div className="mt-5 rounded-xl bg-black/25 p-3 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#8d82a0]">Na lista de membros</p>
              <div className="flex items-center gap-2.5">
                <Avatar src={user?.profile?.avatarUrl} name={nome} size="sm" moldura={visual.moldura} />
                <NomeComItens nome={nome} icone={visual.icone} placa={visual.placa} className="text-sm font-bold text-[#e6dff0]" />
              </div>
            </div>
            {provando && !provando.possui && <p className="mt-3 text-[11px] text-[#a99fc0]">Provando: <b className="text-white">{provando.nome}</b></p>}
          </aside>
        </div>
      </div>

      {/* Confirmar compra */}
      <AnimatePresence>
        {comprando && dados && (
          <motion.div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !ocupado && setComprando(null)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()} role="dialog" aria-label="Confirmar compra"
              className="w-full max-w-[380px] rounded-[22px] border border-[#3a2a4d] bg-[#120d1c] p-5 relative">
              <button onClick={() => setComprando(null)} aria-label="Fechar" className="absolute right-3 top-3 text-[#a99fc0] hover:text-white"><X className="w-4 h-4" /></button>
              <div className="h-[110px] grid place-items-center rounded-xl" style={{ background: RARIDADE[comprando.raridade].fundo }}>
                <PreviaItem item={comprando} nome={nome} avatar={user?.profile?.avatarUrl} />
              </div>
              <p className="mt-3 text-[10px] font-black uppercase tracking-wider" style={{ color: RARIDADE[comprando.raridade].cor }}>◆ {RARIDADE[comprando.raridade].nome}</p>
              <h3 className="text-white text-lg font-black">Comprar {comprando.nome}?</h3>
              <div className="mt-3 rounded-xl bg-black/30 p-3 text-sm space-y-1">
                <div className="flex justify-between text-[#a99fc0]"><span>Preço</span><b className="text-white flex items-center gap-1"><MoedaNex className="w-4 h-4" /> {formatarNex(comprando.preco!)}</b></div>
                <div className="flex justify-between text-[#a99fc0]"><span>Seu saldo depois</span>
                  <b className={dados.saldo >= comprando.preco! ? 'text-white' : 'text-[#ff6b7f]'}>{formatarNex(dados.saldo - comprando.preco!)}</b></div>
              </div>
              {dados.saldo < comprando.preco! ? (
                <button onClick={() => { setComprando(null); useNex.getState().abrir('missoes'); }}
                  className="mt-4 w-full h-11 rounded-[13px] text-sm font-black text-white bg-[#2a1c45] border border-[#4d3560]">
                  Faltam {formatarNex(comprando.preco! - dados.saldo)} Nex · Ganhar mais
                </button>
              ) : (
                <button disabled={ocupado} onClick={() => comprar(comprando)}
                  className="mt-4 w-full h-11 rounded-[13px] text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] flex items-center justify-center gap-2 disabled:opacity-60">
                  {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar compra
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Miniatura do item no cartão: moldura na sua foto, ícone grande ou placa no seu nome. */
function PreviaItem({ item, nome, avatar }: { item: ItemLoja; nome: string; avatar?: string | null }) {
  if (item.tipo === 'moldura') return <Avatar src={avatar} name={nome} size="xl" moldura={item.id} />;
  if (item.tipo === 'icone') return <span className="text-[52px] leading-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]">{ICONES[item.id]}</span>;
  return <NomeComItens nome={nome} placa={item.id} className="text-white text-base font-black max-w-[90%]" />;
}
