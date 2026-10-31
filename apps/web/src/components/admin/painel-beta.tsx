'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { SeloBeta } from '@/components/ui/emblema-beta';
import { cn } from '@/lib/utils';

// Painel do dono → Usuários: quantos têm o BETA NEXT e se contas novas ganham.
// Fechar só vale para quem cria conta depois; quem já tem continua com ele.
export function PainelBeta() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin', 'beta'],
    queryFn: () => api.get('/admin/beta').then(r => r.data as { cadastrosGanham: boolean; total: number }),
  });
  const trocar = useMutation({
    mutationFn: (v: boolean) => api.patch('/admin/beta', { cadastrosGanham: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'beta'] }),
  });
  const aberto = data?.cadastrosGanham ?? true;

  return (
    <div className="mb-4 p-4 rounded-2xl bg-surface border border-border flex flex-wrap items-center gap-3">
      <SeloBeta />
      <p className="text-sm text-muted flex-1 min-w-[220px]">
        {data ? <><b className="text-white">{data.total.toLocaleString('pt-BR')}</b> pessoa(s) com o emblema. </> : null}
        {aberto
          ? 'Quem cria conta agora também ganha.'
          : 'Fechado: contas novas não ganham mais (quem já tem continua com ele).'}
      </p>
      <button
        disabled={!data || trocar.isPending}
        onClick={() => {
          const ok = window.confirm(aberto
            ? 'Fechar o BETA NEXT? Quem criar conta a partir de agora não ganha o emblema. Quem já tem continua com ele.'
            : 'Reabrir o BETA NEXT? Contas novas voltam a ganhar o emblema.');
          if (ok) trocar.mutate(!aberto);
        }}
        className={cn('text-xs px-3 py-1.5 rounded-md font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-40',
          aberto ? 'bg-destructive/10 text-destructive hover:bg-destructive hover:text-white'
                 : 'bg-success/10 text-success hover:bg-success hover:text-white')}
      >
        {trocar.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {aberto ? 'Fechar para contas novas' : 'Reabrir para contas novas'}
      </button>
    </div>
  );
}
