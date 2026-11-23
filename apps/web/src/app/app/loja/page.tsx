'use client';

// Loja Nexus: gasta os Nex ganhos na presença, roleta e missões.
// Quem decide preço, saldo e posse é o servidor (/loja); aqui só mostra.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, Check, Lock, Loader2, X, Crown, Play, Palette, Gem, Eye } from 'lucide-react';
import Link from 'next/link';
import { SecaoBaus, BannerEvento } from '@/components/nex/baus';
import { playSomEntrada } from '@/lib/sounds';
import api from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import { corSegura } from '@/lib/seguro';
import { corNomeDe } from '@/lib/planos';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { useNex } from '@/lib/nex';
import { RARIDADE, SONS, SONS_ARTE, TEMAS, arteDaZoeira, arteDoTema, type Raridade, type TipoItem } from '@/lib/itens';
import { Avatar } from '@/components/ui/avatar';
import { ArteIcone, Moldura, NomeComItens } from '@/components/nex/itens-visuais';
import { EfeitoPerfil } from '@/components/nex/efeito-perfil';
import { MoedaNex, formatarNex } from '@/components/nex/moeda-nex';
import { MoedaPrisma } from '@/components/nex/moeda-prisma';
import { SecaoPrisma, type PacotePrisma, type CaixaPrisma } from '@/components/nex/secao-prisma';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';
import { CartaoVitrine, BotaoVitrine, EmUso } from '@/components/nex/cartao-vitrine';

interface ItemLoja { id: string; tipo: TipoItem; nome: string; raridade: Raridade; preco: number | null; precoPrisma?: number; soPro?: boolean; incluiPlano?: 'mais' | 'pro'; possui: boolean }
interface DadosLoja { saldo: number; prismas: number; plano: string; equipados: Partial<Record<TipoItem, string | null>>; itens: ItemLoja[]; pacotesPrisma: PacotePrisma[]; caixasPrisma: CaixaPrisma[] }

// arte: ícone 3D da seção (public/itens/secoes/<arte>.webp)
const SECOES = [
  { id: 'destaques', nome: 'Destaques', arte: 'destaques' },
  { id: 'prisma', nome: 'Prisma', arte: 'prisma' },
  { id: 'baus', nome: 'Baús', arte: 'baus' },
  { id: 'moldura', nome: 'Molduras', arte: 'molduras' },
  { id: 'icone', nome: 'Ícones', arte: 'icone' },
  { id: 'placa', nome: 'Placas do nome', arte: 'placa' },
  { id: 'efeito', nome: 'Efeitos de perfil', arte: 'efeito' },
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
  const [vendo, setVendo] = useState<ItemLoja | null>(null); // janela grande de prévia
  const [ocupado, setOcupado] = useState(false);

  const carregar = () => api.get('/loja').then(({ data }) => setDados(data)).catch(() => setDados(d => d ?? { saldo: 0, prismas: 0, plano: 'gratis', equipados: { moldura: null, icone: null, placa: null }, itens: [], pacotesPrisma: [], caixasPrisma: [] }));
  useEffect(() => { carregar(); }, []);

  const lista = useMemo(() => {
    if (!dados) return [];
    const its = dados.itens;
    if (secao === 'destaques') return its.filter(i => i.raridade === 'lendaria' || i.raridade === 'epica').slice(0, 12);
    if (secao === 'meus') return its.filter(i => i.possui);
    if (secao === 'prisma') return its.filter(i => i.precoPrisma);
    return its.filter(i => i.tipo === secao).sort((a, b) => ORDEM.indexOf(a.raridade) - ORDEM.indexOf(b.raridade));
  }, [dados, secao]);

  // Prévia: o que está equipado + o item que está "provando"
  const visual = {
    moldura: provando?.tipo === 'moldura' ? provando.id : dados?.equipados.moldura,
    icone: provando?.tipo === 'icone' ? provando.id : dados?.equipados.icone,
    placa: provando?.tipo === 'placa' ? provando.id : dados?.equipados.placa,
    efeito: provando?.tipo === 'efeito' ? provando.id : dados?.equipados.efeito,
  };
  const nome = user?.profile?.displayName || user?.username || 'Você';

  const comprar = async (item: ItemLoja) => {
    setOcupado(true);
    try {
      await api.post(item.precoPrisma ? `/loja/prisma/comprar/${item.id}` : `/loja/comprar/${item.id}`);
      toast(`${item.nome} é seu! Já pode usar.`, 'success');
      setComprando(null);
      await carregar();
      useNex.getState().carregar();
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu para comprar agora', 'error'); }
    setOcupado(false);
  };
  // Confirmação de compra: Nex ou Prisma, conforme o item
  const emPrisma = !!comprando?.precoPrisma;
  const precoC = comprando ? (emPrisma ? comprando.precoPrisma! : comprando.preco ?? 0) : 0;
  const saldoC = emPrisma ? (dados?.prismas ?? 0) : (dados?.saldo ?? 0);
  const MoedaC = emPrisma ? MoedaPrisma : MoedaNex;

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
      <div className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-8">
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
            <button onClick={() => { setSecao('prisma'); setProvando(null); }} title="Prisma: a moeda azul, para os itens exclusivos"
              className="flex items-center gap-1.5 h-10 pl-2 pr-3.5 rounded-full bg-[#0f1a2e] border border-[#1f3d66] hover:border-[#3fb6ff] transition-colors">
              <MoedaPrisma className="w-6 h-6" />
              <b className="text-white tabular-nums">{dados ? formatarNex(dados.prismas) : '…'}</b>
              <span className="text-xs font-bold text-[#8fd3ff]">Prisma</span>
            </button>
            <button onClick={() => useNex.getState().abrir('presenca')}
              className="h-10 px-4 rounded-full text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:brightness-110">
              Ganhar Nex
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-[#a99cb8]">
          Gaste os Nex que você ganha na presença, na roleta e nas missões. Comprou, é seu para sempre. Os Nex nunca são vendidos por dinheiro; a Prisma (azul) é a moeda comprada com dinheiro, para os itens exclusivos.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[200px_1fr_280px] 2xl:grid-cols-[220px_1fr_340px]">
          {/* Seções */}
          <nav className="flex lg:flex-col gap-1 overflow-x-auto nx-no-scrollbar -mx-1 px-1" aria-label="Seções da loja">
            {SECOES.map(s => (
              <button key={s.id} onClick={() => { setSecao(s.id); setProvando(null); }}
                className={cn('group shrink-0 flex items-center gap-2.5 h-11 pl-1.5 pr-3 rounded-[12px] text-sm font-bold transition-colors',
                  secao === s.id ? 'bg-[#2a1c45] text-white' : 'text-[#a99fc0] hover:bg-white/5 hover:text-white')}>
                {s.arte === 'prisma' ? <MoedaPrisma className={cn('w-8 h-8 p-0.5 transition-transform group-hover:scale-110', secao === s.id && 'scale-110')} /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/itens/secoes/${s.arte}.webp`} alt="" aria-hidden draggable={false}
                    className={cn('w-8 h-8 object-contain transition-transform group-hover:scale-110 drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]', s.arte === 'tema' && 'rounded-lg object-cover', secao === s.id && 'scale-110')} />
                )}
                {s.nome}
              </button>
            ))}
          </nav>

          {/* Vitrine */}
          <section>
            {secao === 'destaques' && <BannerEvento onAbrir={() => setSecao('baus')} />}
            {secao === 'prisma' && dados && (
              <SecaoPrisma prismas={dados.prismas} pacotes={dados.pacotesPrisma ?? []} caixas={dados.caixasPrisma ?? []} onMudou={carregar}
                info={Object.fromEntries(dados.itens.map(i => [i.id, i]))} />
            )}
            {secao === 'zoeiras' ? (
              <SecaoZoeiras onMudou={() => { carregar(); useNex.getState().carregar(); }} />
            ) : secao === 'baus' ? (
              <SecaoBaus onMudou={() => { carregar(); useNex.getState().carregar(); }} />
            ) : !dados ? (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-[230px] rounded-2xl nx-skeleton" />)}</div>
            ) : lista.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#3a2a4d] p-8 text-center text-sm text-[#a99fc0]">
                {secao === 'meus' ? 'Você ainda não tem itens. Junte Nex e escolha o primeiro!' : 'Nada por aqui ainda.'}
              </div>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">
                {lista.map(i => {
                  const usando = dados.equipados[i.tipo] === i.id;
                  const bloqueado = i.soPro && dados.plano !== 'pro' && !i.possui;
                  const nomePlano = i.incluiPlano === 'pro' ? 'Nexus Pro' : 'Nexus+';
                  const selo = i.incluiPlano ? { texto: i.incluiPlano === 'pro' ? 'Pro' : 'Nexus+', cor: i.incluiPlano === 'pro' ? '#ffc23d' : '#8ff0ff' }
                    : i.soPro ? { texto: 'Pro', cor: '#ffc23d' } : i.precoPrisma ? { texto: 'Prisma', cor: '#5cc8ff' } : null;
                  const condicao = i.incluiPlano ? (i.possui ? `Incluída no ${nomePlano}` : `Vem com o ${nomePlano}`)
                    : usando ? 'Você está usando' : i.possui ? 'Já é sua'
                    : bloqueado ? 'Exclusiva do Nexus Pro'
                    : i.precoPrisma ? 'Exclusiva com Prisma'
                    : i.preco !== null ? 'Compra única com Nex' : 'Só sai em baú';
                  return (
                    <CartaoVitrine key={i.id} raridade={i.raridade} nome={i.nome} selo={selo} condicao={condicao}
                      previa={<PreviaItem item={i} nome={nome} avatar={user?.profile?.avatarUrl} />}
                      usando={usando} destacado={provando?.id === i.id} verPrevia={TEM_PREVIA.has(i.tipo)}
                      onAbrir={() => setVendo(i)} onPassar={() => setProvando(i)}>
                      {i.possui && i.tipo === 'tema' ? (
                        <BotaoVitrine variante="primario" onClick={() => setAplicando(i)}><Palette className="w-4 h-4" /> Aplicar</BotaoVitrine>
                      ) : i.possui && usando ? (
                        <BotaoVitrine variante="uso" disabled={ocupado} onClick={() => equipar(i, false)} titulo="Clique para tirar"><EmUso /></BotaoVitrine>
                      ) : i.possui ? (
                        <BotaoVitrine variante="primario" disabled={ocupado} onClick={() => equipar(i, true)}>{i.tipo === 'moldura' ? 'Usar borda' : 'Usar'}</BotaoVitrine>
                      ) : bloqueado ? (
                        <BotaoVitrine variante="bloqueado" href="/app/planos"><Lock className="w-4 h-4" /> Só com Pro</BotaoVitrine>
                      ) : i.incluiPlano ? (
                        <BotaoVitrine variante="bloqueado" href="/app/planos"><Lock className="w-4 h-4" /> Ver o {i.incluiPlano === 'pro' ? 'Pro' : 'Nexus+'}</BotaoVitrine>
                      ) : i.precoPrisma ? (
                        <BotaoVitrine variante="prisma" onClick={() => setComprando(i)}><MoedaPrisma className="w-[18px] h-[18px]" /> {formatarNex(i.precoPrisma)}</BotaoVitrine>
                      ) : i.preco !== null ? (
                        <BotaoVitrine variante="primario" onClick={() => setComprando(i)}><MoedaNex className="w-[18px] h-[18px]" /> {formatarNex(i.preco)}</BotaoVitrine>
                      ) : (
                        <BotaoVitrine variante="bloqueado" disabled>Só em baú</BotaoVitrine>
                      )}
                    </CartaoVitrine>
                  );
                })}
              </div>
            )}
          </section>

          {/* Prévia: como fica em você */}
          <aside className="hidden lg:block lg:sticky lg:top-6 self-start rounded-2xl border border-[#2e2340] bg-[#140f1e] p-4">
            <p className="text-[11px] font-black uppercase tracking-[1.5px] text-[#ffb070]">Como fica em você</p>
            <div className="mt-3"><CartaoPrevia visual={visual} /></div>
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

      <AnimatePresence>
        {vendo && dados && (() => {
          const it = dados.itens.find(x => x.id === vendo.id) ?? vendo;
          const usando = dados.equipados[it.tipo] === it.id;
          const v = { ...dados.equipados, [it.tipo]: it.id } as Visual;
          return (
            <PreviaGrande item={it} visual={v} onFechar={() => setVendo(null)}>
              {it.possui ? (
                <button disabled={ocupado} onClick={() => equipar(it, !usando)}
                  className={cn('w-full h-11 rounded-[13px] text-sm font-black flex items-center justify-center gap-2',
                    usando ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#3ddc84] text-[#06210f] hover:brightness-110')}>
                  {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : usando ? 'Tirar' : <><Check className="w-4 h-4" /> Usar agora</>}
                </button>
              ) : it.incluiPlano ? (
                <Link href="/app/planos" className="w-full h-11 rounded-[13px] text-sm font-black flex items-center justify-center gap-2 bg-[#2a1c45] text-white border border-[#4d3560]">
                  <Lock className="w-4 h-4" /> Vem com o {it.incluiPlano === 'pro' ? 'Nexus Pro' : 'Nexus+'}
                </Link>
              ) : it.soPro && dados.plano !== 'pro' ? (
                <span className="w-full h-11 rounded-[13px] text-sm font-black flex items-center justify-center gap-2 bg-black/30 text-[#a99fc0]"><Lock className="w-4 h-4" /> Só com Pro</span>
              ) : it.precoPrisma ? (
                <button onClick={() => { setVendo(null); setComprando(it); }}
                  className="w-full h-11 rounded-[13px] text-sm font-black text-white bg-gradient-to-b from-[#5cc8ff] to-[#1c56e0] flex items-center justify-center gap-2 hover:brightness-110">
                  Comprar por <MoedaPrisma className="w-5 h-5" /> {formatarNex(it.precoPrisma)}
                </button>
              ) : it.preco !== null ? (
                <button onClick={() => { setVendo(null); setComprando(it); }}
                  className="w-full h-11 rounded-[13px] text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] flex items-center justify-center gap-2 hover:brightness-110">
                  Comprar por <MoedaNex className="w-5 h-5" /> {formatarNex(it.preco)}
                </button>
              ) : (
                <span className="w-full h-11 rounded-[13px] text-sm font-black flex items-center justify-center bg-black/30 text-[#a99fc0]">Só sai em baú</span>
              )}
            </PreviaGrande>
          );
        })()}
      </AnimatePresence>

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
                <div className="flex justify-between text-[#a99fc0]"><span>Preço</span><b className="text-white flex items-center gap-1"><MoedaC className="w-4 h-4" /> {formatarNex(precoC)}</b></div>
                <div className="flex justify-between text-[#a99fc0]"><span>Seu saldo depois</span>
                  <b className={saldoC >= precoC ? 'text-white' : 'text-[#ff6b7f]'}>{formatarNex(saldoC - precoC)} {emPrisma ? 'Prisma' : 'Nex'}</b></div>
              </div>
              {saldoC < precoC ? (
                <button onClick={() => { setComprando(null); if (emPrisma) setSecao('prisma'); else useNex.getState().abrir('missoes'); }}
                  className="mt-4 w-full h-11 rounded-[13px] text-sm font-black text-white bg-[#2a1c45] border border-[#4d3560]">
                  Faltam {formatarNex(precoC - saldoC)} {emPrisma ? 'Prisma · Ver pacotes' : 'Nex · Ganhar mais'}
                </button>
              ) : (
                <button disabled={ocupado} onClick={() => comprar(comprando)}
                  className={cn('mt-4 w-full h-11 rounded-[13px] text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-60',
                    emPrisma ? 'bg-gradient-to-b from-[#5cc8ff] to-[#1c56e0]' : 'bg-gradient-to-r from-[#ff6a00] to-[#7a2cff]')}>
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
  if (!dados) return <div className="grid gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">{[0, 1, 2].map(i => <div key={i} className="h-[200px] rounded-2xl nx-skeleton" />)}</div>;
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
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(175px,1fr))]">
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
  if (item.tipo === 'efeito') return (
    <div className="relative w-[150px] h-[96px] rounded-xl overflow-hidden border border-white/10 bg-[#120d1c] shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
      <div className="h-9 bg-gradient-to-r from-[#7a2cff] to-[#ff6a00] opacity-80" />
      <div className="absolute left-3 top-5"><Foto src={avatar} nome={nome} tamanho={40} /></div>
      <span className="absolute left-3 bottom-2.5 h-2 w-20 rounded-full bg-white/25" />
      <EfeitoPerfil id={item.id} />
    </div>
  );
  return <NomeComItens nome={nome} placa={item.id} className="text-white text-base font-black max-w-[90%]" />;
}

type Visual = Partial<Record<TipoItem, string | null | undefined>>;
// Tipos que abrem a janela grande ao clicar (tema e som têm o próprio jeito)
const TEM_PREVIA = new Set<TipoItem>(['moldura', 'icone', 'placa', 'efeito']);

/** Foto redonda de qualquer tamanho, com a moldura por cima. */
function Foto({ src, nome, tamanho, moldura }: { src?: string | null; nome: string; tamanho: number; moldura?: string | null }) {
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="w-full h-full rounded-full object-cover" />
        : <div className="w-full h-full rounded-full grid place-items-center bg-accent text-white font-black" style={{ fontSize: tamanho * 0.36 }}>{getInitials(nome)}</div>}
      <Moldura id={moldura} espessura={Math.max(3, Math.round(tamanho / 18))} />
    </div>
  );
}

/** Seu cartão de perfil com os itens do "visual" (o que está usando + o que está provando). */
function CartaoPrevia({ visual, tamanhoFoto = 72 }: { visual: Visual; tamanhoFoto?: number }) {
  const { user } = useAuthStore();
  const pf = user?.profile;
  const nome = pf?.displayName || user?.username || 'Você';
  const [b1, b2] = (pf?.bannerColor || '').split(',').map(c => corSegura(c, ''));
  const banner = pf?.bannerUrl ? `center / cover no-repeat url(${pf.bannerUrl})` : b1 && b2 ? `linear-gradient(120deg, ${b1}, ${b2})` : 'linear-gradient(120deg, #7a2cff, #ff6a00)';
  return (
    <div className="relative w-full rounded-[16px] overflow-hidden border border-white/10 bg-[#151020] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <div className="h-[70px]" style={{ background: banner }} />
      <div className="px-3.5 pb-3.5" style={{ marginTop: -tamanhoFoto / 2 }}>
        <div className="rounded-full inline-block ring-4 ring-[#151020]"><Foto src={pf?.avatarUrl} nome={nome} tamanho={tamanhoFoto} moldura={visual.moldura} /></div>
        <div className="mt-2"><NomeComItens nome={nome} icone={visual.icone} placa={visual.placa} corNome={corNomeDe(user)} className="text-white text-lg font-black" /></div>
        <p className="text-xs text-[#8d82a0]">@{user?.username}</p>
      </div>
      <EfeitoPerfil id={visual.efeito} />
    </div>
  );
}

/** Janela grande: o item em destaque à esquerda e, à direita, seu perfil e uma mensagem já usando ele. */
function PreviaGrande({ item, visual, onFechar, children }: { item: ItemLoja; visual: Visual; onFechar: () => void; children: React.ReactNode }) {
  const { user } = useAuthStore();
  const pf = user?.profile;
  const nome = pf?.displayName || user?.username || 'Você';
  const r = RARIDADE[item.raridade];
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onFechar]);
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <motion.div className="fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-3 sm:p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onFechar}>
      <motion.div initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={e => e.stopPropagation()} role="dialog" aria-label={`Prévia de ${item.nome}`}
        className="relative w-full max-w-[860px] max-h-[92vh] overflow-y-auto nx-no-scrollbar rounded-[22px] border border-[#3a2a4d] bg-[#120d1c] grid md:grid-cols-[300px_1fr] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
        {/* Item em destaque */}
        <div className="p-6 flex flex-col">
          <div className="flex-1 min-h-[180px] grid place-items-center">
            {item.tipo === 'moldura' ? <Foto src={pf?.avatarUrl} nome={nome} tamanho={132} moldura={item.id} />
              : item.tipo === 'icone' ? <ArteIcone id={item.id} tamanho={120} className="drop-shadow-[0_10px_24px_rgba(0,0,0,0.55)]" />
              : item.tipo === 'placa' ? <NomeComItens nome={nome} placa={item.id} className="text-white text-2xl font-black" />
              : <div className="relative w-[200px] h-[150px] rounded-2xl overflow-hidden border border-white/10 bg-[#0d0915]"><EfeitoPerfil id={item.id} /></div>}
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-wider" style={{ color: r.cor }}>◆ {r.nome}</p>
          <h3 className="text-white text-2xl font-black leading-tight">{item.nome}</h3>
          <p className="text-sm text-[#a99fc0] mt-1">{DESCRICAO[item.tipo]}</p>
          <div className="mt-5">{children}</div>
        </div>
        {/* Como fica em você */}
        <div className="relative min-h-[340px] p-6 pt-14 flex flex-col items-center justify-center gap-3 overflow-hidden" style={{ background: r.fundo }}>
          <div className="absolute inset-0 opacity-60" style={{ background: `radial-gradient(60% 60% at 50% 40%, ${r.cor}33, transparent 70%)` }} />
          <span className="absolute top-4 left-4 text-[11px] font-black px-2.5 py-1 rounded-full bg-black/40 text-white/90">Como fica em você</span>
          <div className="relative w-full max-w-[300px]"><CartaoPrevia visual={visual} tamanhoFoto={80} /></div>
          <div className="relative w-full max-w-[340px] rounded-[14px] bg-[#1a1326]/95 border border-white/10 p-3 flex gap-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.45)]">
            <Foto src={pf?.avatarUrl} nome={nome} tamanho={36} moldura={visual.moldura} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <NomeComItens nome={nome} icone={visual.icone} placa={visual.placa} corNome={corNomeDe(user)} className="text-sm font-bold text-white" />
                <span className="text-[10px] text-[#8d82a0] shrink-0">{hora}</span>
              </div>
              <p className="text-[13px] text-[#e6dff0]">Olha o meu visual novo 😎</p>
            </div>
          </div>
        </div>
        <button onClick={onFechar} aria-label="Fechar" className="absolute right-3 top-3 w-9 h-9 rounded-full grid place-items-center bg-black/40 text-white hover:bg-black/60"><X className="w-4 h-4" /></button>
      </motion.div>
    </motion.div>
  );
}

const DESCRICAO: Partial<Record<TipoItem, string>> = {
  moldura: 'Fica em volta da sua foto em todo lugar.',
  icone: 'Aparece ao lado do seu nome na lista, no chat e na call.',
  placa: 'Uma faixa colorida atrás do seu nome.',
  efeito: 'Uma animação por cima do seu perfil quando alguém abre ele.',
};
