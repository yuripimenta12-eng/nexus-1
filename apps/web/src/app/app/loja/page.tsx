'use client';

// Loja Nexus: gasta os Nex ganhos na presença, roleta e missões.
// Quem decide preço, saldo e posse é o servidor (/loja); aqui só mostra.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Check, Lock, Loader2, X, Crown, Play, Palette, Gem } from 'lucide-react';
import Link from 'next/link';
import { SecaoBaus, BannerEvento } from '@/components/nex/baus';
import { playSomEntrada } from '@/lib/sounds';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { useNex } from '@/lib/nex';
import { RARIDADE, SONS, SONS_ARTE, TEMAS, arteDaZoeira, arteDoTema, type Raridade, type TipoItem } from '@/lib/itens';
import { Avatar } from '@/components/ui/avatar';
import { ArteIcone, NomeComItens } from '@/components/nex/itens-visuais';
import { MoedaNex, formatarNex } from '@/components/nex/moeda-nex';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

interface ItemLoja { id: string; tipo: TipoItem; nome: string; raridade: Raridade; preco: number | null; soPro?: boolean; incluiPlano?: 'mais' | 'pro'; possui: boolean }
interface DadosLoja { saldo: number; plano: string; equipados: Partial<Record<TipoItem, string | null>>; itens: ItemLoja[] }

// arte: ícone 3D da seção (public/itens/secoes/<arte>.webp)
const SECOES = [
  { id: 'destaques', nome: 'Destaques', arte: 'destaques' },
  { id: 'baus', nome: 'Baús', arte: 'baus' },
  { id: 'moldura', nome: 'Molduras', arte: 'molduras' },
  { id: 'icone', nome: 'Ícones', arte: 'icone' },
  { id: 'placa', nome: 'Placas do nome', arte: 'placa' },
  { id: 'som', nome: 'Sons de entrada', arte: 'som' },
  { id: 'tema', nome: 'Temas de servidor', arte: 'tema' },
  { id: 'zoeiras', nome: 'Zoeiras', arte: 'zoeiras' },
  { id: 'meus', nome: 'Meus itens', arte: 'meus' },
] as const;
type Secao = (typeof SECOES)[number]['id'];
const ORDEM: Raridade[] = ['comum', 'rara', 'epica', 'lendaria'];

export default function LojaPage() {
  const { user, refreshUser } = useAuthStore();
  const [dados, setDados] = useState<DadosLoja | null>(null);
  const [secao, setSecao] = useState<Secao>('destaques');
  const [provando, setProvando] = useState<ItemLoja | null>(null);
  const [comprando, setComprando] = useState<ItemLoja | null>(null);
  const [aplicando, setAplicando] = useState<ItemLoja | null>(null);
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
                className={cn('group shrink-0 flex items-center gap-2.5 h-11 pl-1.5 pr-3 rounded-[12px] text-sm font-bold transition-colors',
                  secao === s.id ? 'bg-[#2a1c45] text-white' : 'text-[#a99fc0] hover:bg-white/5 hover:text-white')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/itens/secoes/${s.arte}.webp`} alt="" aria-hidden draggable={false}
                  className={cn('w-8 h-8 object-contain transition-transform group-hover:scale-110 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]', s.arte === 'tema' && 'rounded-lg object-cover', secao === s.id && 'scale-110')} />
                {s.nome}
              </button>
            ))}
          </nav>

          {/* Vitrine */}
          <section>
            {secao === 'destaques' && <BannerEvento onAbrir={() => setSecao('baus')} />}
            {secao === 'zoeiras' ? (
              <SecaoZoeiras onMudou={() => { carregar(); useNex.getState().carregar(); }} />
            ) : secao === 'baus' ? (
              <SecaoBaus onMudou={() => { carregar(); useNex.getState().carregar(); }} />
            ) : !dados ? (
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
                        {i.incluiPlano && <span className={cn('absolute top-2 right-2 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full', i.incluiPlano === 'pro' ? 'bg-[#ffc23d]/15 text-[#ffc23d]' : 'bg-[#3ee0ff]/15 text-[#8ff0ff]')}>{i.incluiPlano === 'pro' ? <Crown className="w-3 h-3" /> : <Gem className="w-3 h-3" />} Grátis no {i.incluiPlano === 'pro' ? 'Pro' : 'Nexus+'}</span>}
                      </div>
                      <div className="px-3 pb-3 flex-1 flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: r.cor }}>◆ {r.nome}</span>
                        <b className="text-white text-sm leading-tight mt-0.5">{i.nome}</b>
                        <div className="mt-auto pt-2.5">
                          {i.possui && i.tipo === 'tema' ? (
                            <button onClick={() => setAplicando(i)}
                              className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 bg-[#3ddc84]/15 text-[#3ddc84] hover:bg-[#3ddc84]/25">
                              <Palette className="w-3.5 h-3.5" /> Aplicar num servidor
                            </button>
                          ) : i.possui ? (
                            <button disabled={ocupado} onClick={() => equipar(i, !usando)}
                              className={cn('w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 transition-colors',
                                usando ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#3ddc84]/15 text-[#3ddc84] hover:bg-[#3ddc84]/25')}>
                              {usando ? 'Tirar' : <><Check className="w-3.5 h-3.5" /> Usar</>}
                            </button>
                          ) : bloqueado ? (
                            <span className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 bg-black/30 text-[#a99fc0]">
                              <Lock className="w-3.5 h-3.5" /> Só com Pro
                            </span>
                          ) : i.incluiPlano ? (
                            <Link href="/app/planos" className="w-full h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1.5 bg-black/30 text-[#a99fc0] hover:text-white">
                              <Lock className="w-3.5 h-3.5" /> Vem com o {i.incluiPlano === 'pro' ? 'Pro' : 'Nexus+'}
                            </Link>
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

      {aplicando && <AplicarTema tema={aplicando} onFechar={() => setAplicando(null)} />}

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

/** Escolhe em qual servidor (seu ou onde é admin) o tema vai valer. */
function AplicarTema({ tema, onFechar }: { tema: ItemLoja; onFechar: () => void }) {
  const { user } = useAuthStore();
  const [servidores, setServidores] = useState<{ id: string; name: string; tema: string | null }[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  useEffect(() => {
    api.get('/users/@me/servers').then(({ data }) => setServidores(
      data.filter((m: any) => m.server?.ownerId === user?.id || m.role === 'OWNER' || m.role === 'ADMIN')
        .map((m: any) => ({ id: m.server.id, name: m.server.name, tema: m.server.tema ?? null })),
    )).catch(() => setServidores([]));
  }, [user?.id]);
  const aplicar = async (id: string, usar: boolean) => {
    setOcupado(id);
    try {
      await api.put('/loja/tema', { serverId: id, itemId: usar ? tema.id : null });
      setServidores(s => s?.map(x => (x.id === id ? { ...x, tema: usar ? tema.id : null } : x)) ?? null);
      toast(usar ? `${tema.nome} aplicado! Quem entrar no servidor vê o tema.` : 'Tema tirado', 'success');
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu agora', 'error'); }
    setOcupado(null);
  };
  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onFechar}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Aplicar tema"
        className="w-full max-w-[400px] rounded-[22px] border border-[#3a2a4d] bg-[#120d1c] p-5 relative">
        <button onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 text-[#a99fc0] hover:text-white"><X className="w-4 h-4" /></button>
        <h3 className="text-white text-lg font-black">Aplicar {tema.nome}</h3>
        <p className="text-sm text-[#a99fc0] mt-1">Escolha o servidor. Todo mundo que entrar nele vê o tema.</p>
        <div className="mt-4 space-y-2 max-h-[320px] overflow-y-auto">
          {servidores === null ? <div className="h-16 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-[#8b48ff]" /></div>
            : servidores.length === 0 ? <p className="text-sm text-[#a99fc0]">Você não é dono nem admin de nenhum servidor.</p>
            : servidores.map(s => {
              const ativo = s.tema === tema.id;
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-[#2e2340] bg-[#1a1326] p-3">
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{s.name}</span>
                  <button disabled={ocupado === s.id} onClick={() => aplicar(s.id, !ativo)}
                    className={cn('h-8 px-3 rounded-[10px] text-xs font-black', ativo ? 'bg-white/10 text-white' : 'bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] text-white')}>
                    {ocupado === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : ativo ? 'Tirar' : 'Aplicar'}
                  </button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

interface ZoeiraLoja { id: string; nome: string; emoji: string; preco: number; pesada: boolean; desc: string; qtd: number; propria?: boolean }

/** Zoeiras: compra em quantidade e usa na call clicando na pessoa. */
function SecaoZoeiras({ onMudou }: { onMudou: () => void }) {
  const [dados, setDados] = useState<{ saldo: number; receberZoeiras: boolean; zoeiras: ZoeiraLoja[] } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const carregar = () => api.get('/zoeiras').then(({ data }) => setDados(data)).catch(() => {});
  useEffect(() => { carregar(); }, []);
  const comprar = async (z: ZoeiraLoja, qtd: number) => {
    setOcupado(z.id + qtd);
    try {
      await api.post(`/zoeiras/comprar/${z.id}`, { qtd });
      toast(`+${qtd} ${z.nome} no seu estoque`, 'success');
      await carregar(); onMudou();
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu para comprar', 'error'); }
    setOcupado(null);
  };
  const alternar = async () => {
    if (!dados) return;
    try {
      await api.put('/zoeiras/preferencia', { receber: !dados.receberZoeiras });
      setDados({ ...dados, receberZoeiras: !dados.receberZoeiras });
    } catch { toast('Não deu agora', 'error'); }
  };
  if (!dados) return <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-[200px] rounded-2xl nx-skeleton" />)}</div>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-[#2e2340] bg-[#140f1e] p-4">
        <span className="text-2xl" aria-hidden>🎯</span>
        <div className="flex-1 min-w-0">
          <b className="block text-sm text-white">Receber zoeiras</b>
          <small className="block text-xs text-[#92879f]">A galera pode usar zoeiras em você na call. As pesadas só valem se o dono do servidor liberar.</small>
        </div>
        <button onClick={alternar} role="switch" aria-checked={dados.receberZoeiras} aria-label="Receber zoeiras"
          className={cn('w-12 h-7 rounded-full p-1 transition-colors shrink-0', dados.receberZoeiras ? 'bg-[#7a2cff]' : 'bg-[#3a2a4d]')}>
          <span className={cn('block w-5 h-5 rounded-full bg-white transition-transform', dados.receberZoeiras && 'translate-x-5')} />
        </button>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        {dados.zoeiras.map(z => (
          <div key={z.id} className="relative rounded-2xl border border-white/10 p-3 flex flex-col"
            style={{ background: z.pesada ? 'linear-gradient(180deg,#3a1630,#170f1c)' : 'linear-gradient(180deg,#1d1828,#15111d)' }}>
            {z.pesada && <span className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#ff4d6d]/15 text-[#ff7a92]">Pesada</span>}
            {z.qtd > 0 && <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full bg-white/10 text-white">Tem {z.qtd}</span>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={arteDaZoeira(z.id)} alt="" aria-hidden className="w-20 h-20 mx-auto object-contain mt-3 mb-1 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)]" />
            <b className="text-white text-sm">{z.nome}</b>
            <small className="text-[11px] text-[#92879f] leading-snug">{z.desc}</small>
            <div className="mt-auto pt-3 flex gap-1.5">
              <button disabled={!!ocupado} onClick={() => comprar(z, 1)}
                className="flex-1 h-9 rounded-[11px] text-xs font-black flex items-center justify-center gap-1 bg-black/35 text-white hover:bg-black/50 border border-white/10 disabled:opacity-60">
                <MoedaNex className="w-4 h-4" /> {formatarNex(z.preco)}
              </button>
              {!z.propria && (
                <button disabled={!!ocupado} onClick={() => comprar(z, 5)} title={`5 por ${formatarNex(z.preco * 5)} Nex`}
                  className="h-9 px-2.5 rounded-[11px] text-xs font-black bg-[#2a1c45] text-[#c9a6ff] hover:bg-[#33204f] disabled:opacity-60">×5</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8d82a0]">Para usar: na call, passe o mouse no quadro da pessoa e clique em <b className="text-[#ffb3e6]">Zoeira</b>. O Escudo você usa em você mesmo e fica imune por 1 hora.</p>
    </div>
  );
}

/** Miniatura do item no cartão: moldura na sua foto, ícone grande ou placa no seu nome. */
function PreviaItem({ item, nome, avatar }: { item: ItemLoja; nome: string; avatar?: string | null }) {
  if (item.tipo === 'moldura') return <Avatar src={avatar} name={nome} size="xl" moldura={item.id} />;
  if (item.tipo === 'icone') return <ArteIcone id={item.id} tamanho={72} className="drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110" />;
  if (item.tipo === 'tema') {
    const t = TEMAS[item.id];
    if (!t) return null;
    return (
      <div className="relative w-[160px] h-[90px] rounded-xl overflow-hidden border border-white/10 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={arteDoTema(item.id)} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" />
        <div className="absolute left-0 inset-y-0 w-6" style={{ background: `${t.lado}cc` }} />
        <div className="absolute left-7 right-2 bottom-2 h-1.5 rounded-full" style={{ background: t.brilho }} />
      </div>
    );
  }
  if (item.tipo === 'som') return (
    <span className="flex items-center gap-3">
      {SONS_ARTE.has(item.id)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/itens/sons/${item.id}.webp`} alt="" className="w-16 h-16 object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
        : <span className="text-[46px] leading-none drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]">{SONS[item.id]}</span>}
      <button onClick={(e) => { e.stopPropagation(); playSomEntrada(item.id); }} aria-label={`Ouvir ${item.nome}`}
        className="w-9 h-9 rounded-full grid place-items-center bg-white/10 hover:bg-white/20 text-white"><Play className="w-4 h-4 ml-0.5" /></button>
    </span>
  );
  return <NomeComItens nome={nome} placa={item.id} className="text-white text-base font-black max-w-[90%]" />;
}
