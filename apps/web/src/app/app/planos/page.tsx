'use client';

// Planos do Nexus (para você e para servidores) e o painel de afiliado.
// Por enquanto não há pagamento: o dono do Nexus libera o plano no painel.
import { useEffect, useState } from 'react';
import { Copy, Gift, Rocket, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/auth.store';
import { NOME_PLANO, type Plano } from '@/lib/planos';
import { DepoimentoForm } from '@/components/depoimento-form';
import { CartaoPlano, PARA_VOCE, type Cartao } from '@/components/cartao-plano';

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
        <DepoimentoForm />
      </div>
    </div>
  );
}
