'use client';

// Painel do dono → Comentários: aprova o que aparece na página inicial.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, EyeOff, Loader2, Star, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { cn, formatRelativeDate } from '@/lib/utils';

type Item = {
  id: string; texto: string; nota: number; aprovado: boolean; atualizadoEm: string;
  user: { username: string; profile: { displayName: string | null; avatarUrl: string | null } | null };
};

export function PainelDepoimentos() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Item[]>({
    queryKey: ['admin', 'depoimentos'],
    queryFn: () => api.get('/depoimentos/admin').then(r => r.data),
  });
  const moderar = useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: 'aprovar' | 'esconder' | 'apagar' }) => api.post(`/depoimentos/admin/${id}`, { acao }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'depoimentos'] }),
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>;
  const pendentes = data?.filter(d => !d.aprovado).length ?? 0;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-white font-semibold">Comentários da página inicial</h2>
        <p className="text-muted text-sm">
          Só os aprovados aparecem em nexuslink.art, com o nome e a foto de quem escreveu.
          {pendentes > 0 && <b className="text-white"> {pendentes} esperando você.</b>}
        </p>
      </div>
      {!data?.length && <p className="text-muted text-sm">Ninguém comentou ainda. O formulário fica na página de planos (botão ✨).</p>}
      {data?.map(d => {
        const nome = d.user.profile?.displayName || d.user.username;
        return (
          <div key={d.id} className={cn('rounded-xl border p-4', d.aprovado ? 'border-success/30 bg-success/5' : 'border-border bg-surface')}>
            <div className="flex items-center gap-2 text-sm">
              <b className="text-white">{nome}</b>
              <span className="text-muted">@{d.user.username} · {formatRelativeDate(d.atualizadoEm)}</span>
              <span className="ml-auto flex" aria-label={`Nota ${d.nota} de 5`}>
                {Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn('w-3.5 h-3.5', i < d.nota ? 'fill-[#ffc23d] text-[#ffc23d]' : 'text-white/20')} />)}
              </span>
            </div>
            <p className="mt-2 text-[#e3dbeb] text-sm whitespace-pre-line break-words">{d.texto}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.aprovado ? (
                <button onClick={() => moderar.mutate({ id: d.id, acao: 'esconder' })} disabled={moderar.isPending}
                  className="text-xs px-3 py-1 rounded-md bg-white/5 text-white/80 hover:bg-white/10 inline-flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5" /> Tirar da página
                </button>
              ) : (
                <button onClick={() => moderar.mutate({ id: d.id, acao: 'aprovar' })} disabled={moderar.isPending}
                  className="text-xs px-3 py-1 rounded-md bg-success/15 text-success hover:bg-success/25 inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Aprovar
                </button>
              )}
              <button
                onClick={() => { if (window.confirm(`Apagar o comentário de ${nome}? Não dá para desfazer.`)) moderar.mutate({ id: d.id, acao: 'apagar' }); }}
                disabled={moderar.isPending}
                className="text-xs px-3 py-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 inline-flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Apagar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
