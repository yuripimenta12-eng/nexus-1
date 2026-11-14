'use client';

// Cartões dos planos (Grátis, Nexus+, Pro): usados na página de planos do app e na página inicial.
import Link from 'next/link';
import { Check, Crown, Gem, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LIVE_POR_PLANO, PRECO_PLANO, type Plano } from '@/lib/planos';

type Beneficio = { texto: string; emBreve?: boolean };
export type Cartao = {
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
export const PARA_VOCE: Cartao[] = [
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

// visitante: quem vê na página inicial sem estar logado (o Grátis vira "Criar conta grátis")
export function CartaoPlano({ c, atual, visitante }: { c: Cartao; atual?: Plano; visitante?: boolean }) {
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
          {visitante && c.plano === 'gratis' ? (
            <Link href="/auth/register" className="w-full rounded-full bg-[#c8f53b] py-2.5 text-center text-sm font-extrabold text-[#18131f] hover:brightness-110">
              Criar conta grátis
            </Link>
          ) : (
            <button
              type="button" disabled
              className={cn(
                'w-full rounded-full py-2.5 text-sm font-bold transition-colors',
                ehAtual ? 'bg-white/10 text-white/60' : 'bg-white/15 text-white/70 backdrop-blur-sm',
              )}
            >
              {ehAtual ? 'Plano atual' : c.plano === 'gratis' ? 'Incluído' : 'Pagamento em breve'}
            </button>
          )}
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
