'use client';

// "Em breve": o que vem por aí no Nexus. Cada pessoa vota Quero / Não preciso
// e as mais pedidas sobem. As ideias ficam no servidor (src/ideias/ideias.lista.ts).
import { useEffect, useState } from 'react';
import { Lightbulb, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';
import { MobileMenuButton } from '@/components/layout/mobile-menu-button';

type Voto = 'quero' | 'nao' | null;
interface Ideia { id: string; emoji: string; titulo: string; desc: string; quero: number; nao: number; meuVoto: Voto }
interface Chegou { id: string; emoji: string; titulo: string; desc: string }

export default function EmBrevePage() {
  const [ideias, setIdeias] = useState<Ideia[] | null>(null);
  const [chegou, setChegou] = useState<Chegou[]>([]);

  useEffect(() => {
    api.get('/ideias')
      .then(({ data }) => { setIdeias(data.ideias); setChegou(data.chegou); })
      .catch(() => setIdeias([]));
  }, []);

  const votar = async (id: string, tipo: 'quero' | 'nao') => {
    if (!ideias) return;
    const antes = ideias;
    const atual = ideias.find(i => i.id === id);
    if (!atual) return;
    const novo: Voto = atual.meuVoto === tipo ? null : tipo; // clicar de novo tira o voto
    // Atualiza na hora; se o servidor recusar, volta como estava
    setIdeias(ideias.map(i => {
      if (i.id !== id) return i;
      const q = i.quero - (i.meuVoto === 'quero' ? 1 : 0) + (novo === 'quero' ? 1 : 0);
      const n = i.nao - (i.meuVoto === 'nao' ? 1 : 0) + (novo === 'nao' ? 1 : 0);
      return { ...i, quero: q, nao: n, meuVoto: novo };
    }));
    try {
      await api.put(`/ideias/${id}/voto`, { tipo: novo });
    } catch {
      setIdeias(antes);
      toast('Não deu para votar agora. Tente de novo em alguns segundos.', 'error');
    }
  };

  const maisPedida = ideias && ideias.length ? Math.max(...ideias.map(i => i.quero)) : 0;

  return (
    <div className="h-full overflow-y-auto nx-page-bg">
      <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-8">
        <div className="flex items-start gap-3">
          <MobileMenuButton />
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight text-white">
              <Lightbulb className="size-7 text-[#ffb070]" /> Em breve
            </h1>
            <p className="text-sm text-[#a99cb8]">
              O que vem por aí no Nexus. Vote no que você usaria: as mais pedidas chegam primeiro. Dá para trocar o voto quando quiser.
            </p>
          </div>
        </div>

        {chegou.length > 0 && (
          <section>
            <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">Já chegou</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {chegou.map(c => (
                <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-[var(--th-line-2)] bg-[var(--th-panel)] p-3.5">
                  <span className="w-11 h-11 rounded-[14px] grid place-items-center text-xl shrink-0 bg-gradient-to-br from-[#2a1c45] to-[#1b1428]" aria-hidden>{c.emoji}</span>
                  <span className="min-w-0">
                    <b className="flex items-center gap-1.5 text-sm text-white">{c.titulo} <Check className="w-3.5 h-3.5 text-[#3ddc84]" /></b>
                    <small className="block text-xs text-[#92879f]">{c.desc}</small>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">Vote no próximo</p>
          {ideias === null ? (
            <div className="grid gap-2.5">
              {[0, 1, 2, 3].map(i => <div key={i} className="h-[76px] rounded-2xl nx-skeleton" />)}
            </div>
          ) : ideias.length === 0 ? (
            <p className="text-sm text-[#a99cb8]">Não deu para carregar as ideias agora.</p>
          ) : (
            <div className="grid gap-2.5">
              {ideias.map(i => {
                const total = i.quero + i.nao;
                const pct = total ? Math.round((i.quero / total) * 100) : 0;
                const destaque = i.quero > 0 && i.quero === maisPedida;
                return (
                  <div key={i.id} className={cn(
                    'rounded-2xl border p-3.5 sm:p-4 transition-colors',
                    destaque ? 'border-[#8b48ff] bg-gradient-to-br from-[#26143c] to-[#160e22]' : 'border-[var(--th-line-2)] bg-[var(--th-panel)]',
                  )}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-11 h-11 rounded-[14px] grid place-items-center text-xl shrink-0 bg-[var(--th-panel-2)]" aria-hidden>{i.emoji}</span>
                        <span className="min-w-0">
                          <b className="flex items-center gap-2 text-sm text-white">
                            {i.titulo}
                            {destaque && <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ff6a00]/15 text-[#ffb070]">Mais pedida</span>}
                          </b>
                          <small className="block text-xs text-[#92879f]">{i.desc}</small>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => votar(i.id, 'quero')}
                          aria-pressed={i.meuVoto === 'quero'}
                          className={cn('h-9 px-3 rounded-[11px] text-xs font-black flex items-center gap-1.5 border transition-all',
                            i.meuVoto === 'quero'
                              ? 'bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] border-transparent text-white'
                              : 'bg-[var(--th-panel-2)] border-[var(--th-line-2)] text-[#d1c6da] hover:border-[#8b48ff]')}>
                          <ThumbsUp className="w-3.5 h-3.5" /> Quero <span className="opacity-80">{i.quero}</span>
                        </button>
                        <button
                          onClick={() => votar(i.id, 'nao')}
                          aria-pressed={i.meuVoto === 'nao'}
                          className={cn('h-9 px-3 rounded-[11px] text-xs font-black flex items-center gap-1.5 border transition-all',
                            i.meuVoto === 'nao'
                              ? 'bg-[#3a2a4d] border-[#5c4573] text-white'
                              : 'bg-[var(--th-panel-2)] border-[var(--th-line-2)] text-[#a99cb8] hover:border-[#5c4573]')}>
                          <ThumbsDown className="w-3.5 h-3.5" /> Não preciso
                        </button>
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-[#2e2340] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-[#92879f] w-24 text-right">{pct}% querem</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="text-xs text-[#8d82a0]">Tem outra ideia? Mande para o dono do Nexus. As boas entram na lista.</p>
      </div>
    </div>
  );
}
