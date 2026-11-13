'use client';

// Planos do Nexus (para você e para servidores) e o painel de afiliado.
// Por enquanto não há pagamento: o dono do Nexus libera o plano no painel.
import { useEffect, useState } from 'react';
import { Check, Copy, Crown, Gem, Gift, Rocket, Sparkles, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { LIVE_POR_PLANO, NOME_PLANO, PRECO_PLANO, type Plano } from '@/lib/planos';

type Beneficio = { texto: string; emBreve?: boolean };
type Cartao = {
  id: string;
  nome: string;
  descricao: string;
  Icone: typeof Gem;
  cores: { base: string; blobA: string; blobB: string; icone: string };
  preco: string;
  precoNota: string;
  destaque?: string;
  plano?: Plano; // cartões de plano pessoal
  beneficios: Beneficio[];
};

// shortcut: preços fixos em lib/planos; quando entrar o pagamento, passam a vir da API
const PARA_VOCE: Cartao[] = [
  {
    id: 'gratis', plano: 'gratis', nome: 'Grátis', descricao: 'Tudo o que você precisa para falar com a galera',
    Icone: Users, cores: { base: '#16121d', blobA: '#5b4a73', blobB: '#2c2438', icone: '#c9bedb' },
    preco: 'R$ 0', precoNota: 'Para sempre',
    beneficios: [
      { texto: 'Calls de voz e vídeo, chat e servidores' },
      { texto: `Live de tela em ${LIVE_POR_PLANO.gratis.rotulo}` },
      { texto: 'DJ na call, placar e conquistas' },
    ],
  },
  {
    id: 'mais', plano: 'mais', nome: 'Nexus+', descricao: 'Mais qualidade na live e um perfil que aparece',
    Icone: Gem, cores: { base: '#0f1a2a', blobA: '#21d4fd', blobB: '#7a2cff', icone: '#3ee0ff' },
    preco: PRECO_PLANO.mais.mes, precoNota: `por mês · ou ${PRECO_PLANO.mais.ano} por ano`,
    beneficios: [
      { texto: 'Tudo do Grátis' },
      { texto: `Live de tela em ${LIVE_POR_PLANO.mais.rotulo}` },
      { texto: 'Emblema Nexus+ no perfil e na lista de membros' },
      { texto: 'Avatar e banner animados (GIF)', emBreve: true },
      { texto: 'Cor ou gradiente no nome', emBreve: true },
      { texto: 'Envio de arquivos maiores', emBreve: true },
    ],
  },
  {
    id: 'pro', plano: 'pro', nome: 'Nexus Pro', descricao: 'O máximo de qualidade para quem transmite',
    Icone: Crown, cores: { base: '#24150a', blobA: '#ff6a00', blobB: '#ff4f79', icone: '#ffc23d' },
    preco: PRECO_PLANO.pro.mes, precoNota: `por mês · ou ${PRECO_PLANO.pro.ano} por ano`, destaque: 'Melhor para streamers',
    beneficios: [
      { texto: 'Tudo do Nexus+' },
      { texto: `Live de tela em ${LIVE_POR_PLANO.pro.rotulo}` },
      { texto: 'Versão mais leve da live para quem tem internet fraca' },
      { texto: 'Emblema Nexus Pro no perfil e na lista de membros' },
      { texto: 'Fila do DJ maior', emBreve: true },
      { texto: 'Moldura animada no avatar', emBreve: true },
    ],
  },
];

const PARA_SERVIDORES: Cartao[] = [
  {
    id: 'turbo-1', nome: 'Turbo 1', descricao: 'A cara do seu servidor',
    Icone: Rocket, cores: { base: '#141428', blobA: '#7a2cff', blobB: '#21d4fd', icone: '#b98cff' },
    preco: 'Em breve', precoNota: 'Qualquer membro pode turbinar',
    beneficios: [
      { texto: 'Emojis próprios do servidor', emBreve: true },
      { texto: 'Banner do servidor', emBreve: true },
      { texto: 'Mais lugares nas salas de voz', emBreve: true },
    ],
  },
  {
    id: 'turbo-2', nome: 'Turbo 2', descricao: 'Live melhor para todo mundo do servidor',
    Icone: Rocket, cores: { base: '#1d1028', blobA: '#ff4f79', blobB: '#7a2cff', icone: '#ff8aa8' },
    preco: 'Em breve', precoNota: 'Tudo do Turbo 1', destaque: 'O mais pedido',
    beneficios: [
      { texto: 'Live em 720p 60fps para todos do servidor', emBreve: true },
      { texto: 'Convite personalizado (nexuslink.art/seuservidor)', emBreve: true },
    ],
  },
  {
    id: 'turbo-3', nome: 'Turbo 3', descricao: 'Para comunidades grandes',
    Icone: Rocket, cores: { base: '#24150a', blobA: '#ffc23d', blobB: '#ff6a00', icone: '#ffc23d' },
    preco: 'Em breve', precoNota: 'Tudo do Turbo 2',
    beneficios: [
      { texto: 'Mais salas', emBreve: true },
      { texto: 'Ícone nos cargos', emBreve: true },
      { texto: 'Áudio da call em qualidade mais alta', emBreve: true },
    ],
  },
];

type Meu = {
  plano: Plano; planoAte: string | null; codigo: string | null;
  indicados: number; convertidos: number; diasGanhos: number; diasPorIndicacao: number;
};

function CartaoPlano({ c, atual }: { c: Cartao; atual?: Plano }) {
  const ehAtual = !!c.plano && c.plano === atual;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-2xl border border-[var(--th-line-2)] bg-[var(--th-panel)] p-1"
    >
      <div className="relative overflow-hidden rounded-xl border border-white/10 p-5" style={{ background: c.cores.base }}>
        <div className="pointer-events-none absolute -top-12 -right-12 size-52 rounded-full opacity-60 blur-3xl" style={{ background: c.cores.blobA }} />
        <div className="pointer-events-none absolute top-1/3 -left-8 size-60 rounded-full opacity-30 blur-3xl" style={{ background: c.cores.blobB }} />
        <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12] mix-blend-overlay">
          <filter id={`grao-${c.id}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.68" numOctaves="3" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter={`url(#grao-${c.id})`} />
        </svg>

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center size-9 rounded-[40%] bg-black/30 border border-white/10">
              <c.Icone className="size-[18px]" style={{ color: c.cores.icone }} />
            </span>
            {c.destaque && (
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold text-white/80 backdrop-blur-sm">{c.destaque}</span>
            )}
            {ehAtual && (
              <span className="ml-auto rounded-full bg-[#c8f53b] px-2.5 py-0.5 text-xs font-extrabold text-[#18131f]">Seu plano</span>
            )}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl font-extrabold tracking-tight text-white">{c.nome}</h3>
            <p className="text-sm text-white/60">{c.descricao}</p>
          </div>
          <div className="space-y-0.5">
            <span className="text-3xl font-extrabold tracking-tight text-white">{c.preco}</span>
            <p className="text-xs text-white/50">{c.precoNota}</p>
          </div>
          <button
            type="button" disabled
            className={cn(
              'w-full rounded-full py-2.5 text-sm font-bold transition-colors',
              ehAtual ? 'bg-white/10 text-white/60' : 'bg-white/15 text-white/70 backdrop-blur-sm',
            )}
          >
            {ehAtual ? 'Plano atual' : c.plano === 'gratis' ? 'Incluído' : 'Pagamento em breve'}
          </button>
        </div>
      </div>

      <ul className="space-y-2.5 px-3 pt-5 pb-4">
        {c.beneficios.map((b) => (
          <li key={b.texto} className="flex items-start gap-2 text-sm text-[#d7cfe0]">
            <Check className="mt-0.5 size-3.5 shrink-0 text-[#c8f53b]" strokeWidth={3} />
            <span className={cn(b.emBreve && 'text-[#8a8095]')}>
              {b.texto}
              {b.emBreve && (
                <span className="ml-1.5 rounded-full border border-white/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-[#8a8095]">em breve</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function PainelAfiliado({ meu }: { meu: Meu | null }) {
  const link = meu?.codigo && typeof window !== 'undefined' ? `${window.location.origin}/r/${meu.codigo}` : null;
  const copiar = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast('Link copiado!', 'success'); }
    catch { toast('Não deu para copiar. Selecione o link e copie.', 'error'); }
  };
  const numeros = [
    { rotulo: 'Entraram pelo seu link', valor: meu?.indicados ?? 0 },
    { rotulo: 'Ganharam um plano', valor: meu?.convertidos ?? 0 },
    { rotulo: 'Dias que você ganhou', valor: meu?.diasGanhos ?? 0 },
  ];
  return (
    <section className="rounded-2xl border border-[var(--th-line-2)] bg-[var(--th-panel)] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Gift className="size-5 text-[#c8f53b]" />
        <h2 className="text-lg font-extrabold text-white">Indique e ganhe</h2>
      </div>
      <p className="mt-1 text-sm text-[#a99cb8]">
        Mande o seu link para os amigos. Quando alguém que entrou por ele ganhar o primeiro plano pago,
        você ganha <b className="text-white">{meu?.diasPorIndicacao ?? 30} dias de Nexus+</b>. Se já tiver plano, os dias somam ao seu.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          readOnly value={link ?? 'Carregando…'} aria-label="Seu link de indicação"
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-[var(--th-line-2)] bg-black/30 px-3 py-2.5 text-sm text-white"
        />
        <button
          type="button" onClick={copiar} disabled={!link}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c8f53b] px-4 py-2.5 text-sm font-extrabold text-[#18131f] hover:brightness-110 disabled:opacity-40"
        >
          <Copy className="size-4" /> Copiar link
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {numeros.map((n) => (
          <div key={n.rotulo} className="rounded-xl bg-[var(--th-panel-2)] px-3 py-3">
            <p className="text-2xl font-extrabold text-white tabular-nums">{n.valor}</p>
            <p className="text-[11px] text-[#8a8095] leading-tight">{n.rotulo}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PaginaPlanos() {
  const [aba, setAba] = useState<'voce' | 'servidores'>('voce');
  const [meu, setMeu] = useState<Meu | null>(null);

  useEffect(() => {
    api.get('/planos/meu').then(({ data }) => {
      setMeu(data);
      // Mantém o plano do navegador em dia (é ele que decide a qualidade da live)
      const { user, setUser } = useAuthStore.getState();
      if (user) setUser({ ...user, plano: data.plano, planoAte: data.planoAte });
    }).catch(() => {});
  }, []);

  const cartoes = aba === 'voce' ? PARA_VOCE : PARA_SERVIDORES;
  const validade = meu?.planoAte ? new Date(meu.planoAte).toLocaleDateString('pt-BR') : null;

  return (
    <div className="h-full overflow-y-auto nx-page-bg">
      <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-white">
              <Sparkles className="size-7 text-[#c8f53b]" /> Planos do Nexus
            </h1>
            <p className="text-sm text-[#a99cb8]">
              {meu && meu.plano !== 'gratis'
                ? `Você está no ${NOME_PLANO[meu.plano]}${validade ? ` até ${validade}` : ''}.`
                : 'Sem taxas escondidas. Escolha o que combina com você.'}
            </p>
          </div>
          <div className="flex items-center gap-0.5 self-start rounded-full border border-[var(--th-line-2)] bg-black/30 p-1" role="tablist">
            {([['voce', 'Para você'], ['servidores', 'Para servidores']] as const).map(([k, rotulo]) => (
              <button
                key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-bold transition-colors',
                  aba === k ? 'bg-white text-[#18131f]' : 'text-[#a99cb8] hover:text-white',
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {cartoes.map((c) => <CartaoPlano key={c.id} c={c} atual={meu?.plano} />)}
        </div>

        <p className="text-center text-xs text-[#8a8095]">
          O pagamento pelo site chega em breve. Por enquanto, quem libera os planos é o dono do Nexus.
        </p>

        <PainelAfiliado meu={meu} />
      </div>
    </div>
  );
}
