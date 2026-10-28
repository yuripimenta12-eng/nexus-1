'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Megaphone, Send, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { textoComLinks } from '@/components/chat/links-mensagem';
import { formatRelativeDate } from '@/lib/utils';

const TITULO_MAX = 100;
const TEXTO_MAX = 2000;

// Painel do dono → Comunicados: escreve, confere a prévia e envia para todos.
// Todo mundo vê em destaque até clicar em "Entendi"; quem está com o Nexus
// fechado recebe notificação (se ativou os avisos).
export function PainelComunicados() {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');

  const { data } = useQuery({
    queryKey: ['admin', 'comunicados'],
    queryFn: () => api.get('/announcements/admin').then(r => r.data),
    refetchInterval: 30_000, // atualiza o "lido por"
  });

  const enviar = useMutation({
    mutationFn: () => api.post('/announcements', { title: titulo.trim(), body: texto.trim() }),
    onSuccess: () => {
      setTitulo(''); setTexto(''); setConfirmar(false); setErro('');
      qc.invalidateQueries({ queryKey: ['admin', 'comunicados'] });
    },
    onError: (e: any) => { setConfirmar(false); setErro(e?.response?.data?.message || 'Não foi possível enviar agora.'); },
  });

  const apagar = useMutation({
    mutationFn: (id: string) => api.delete(`/announcements/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'comunicados'] }),
  });

  const pronto = titulo.trim().length > 0 && texto.trim().length > 0;
  const total = data?.totalUsers ?? 0;

  return (
    <div className="max-w-[720px]">
      <h2 className="text-white font-semibold text-lg mb-1">Comunicados</h2>
      <p className="text-muted text-sm mb-4">
        Aparece em destaque para <b className="text-white">todos os usuários do Nexus</b> até cada pessoa clicar em &quot;Entendi&quot;,
        chega como notificação para quem está com o Nexus fechado e fica guardado no botão do megafone 📢.
      </p>

      <div className="p-4 rounded-2xl bg-surface border border-border space-y-3">
        <div>
          <label className="text-xs font-bold text-muted" htmlFor="com-titulo">Título</label>
          <input id="com-titulo" value={titulo} maxLength={TITULO_MAX} onChange={e => setTitulo(e.target.value)}
            placeholder="Ex.: Manutenção hoje às 22h"
            className="nx-input mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted" htmlFor="com-texto">Mensagem</label>
          <textarea id="com-texto" value={texto} maxLength={TEXTO_MAX} onChange={e => setTexto(e.target.value)} rows={5}
            placeholder="Escreva o aviso. Links viram clicáveis."
            className="nx-input mt-1 resize-y min-h-[110px]" />
          <p className="text-[11px] text-muted text-right">{texto.length}/{TEXTO_MAX}</p>
        </div>

        {pronto && (
          <div className="rounded-xl border border-[#7a2cff]/40 p-4" style={{ background: 'linear-gradient(160deg, #1e1630, #0f0c1a)' }}>
            <p className="text-[11px] font-black uppercase tracking-wider text-[#ffb070] mb-1">Prévia</p>
            <p className="text-white font-extrabold break-words">{titulo}</p>
            <p className="mt-1 text-[13px] text-[#ddd5e8] whitespace-pre-wrap break-words">{textoComLinks(texto)}</p>
          </div>
        )}

        {erro && <p className="text-sm text-[#ff6b6b]">{erro}</p>}

        {!confirmar ? (
          <button disabled={!pronto} onClick={() => setConfirmar(true)}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            <Send className="w-4 h-4" /> Enviar para todos
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#ffce73]/10 border border-[#ffce73]/30">
            <p className="text-sm text-[#ffce73] flex-1 min-w-[200px]">
              Enviar para <b>{total.toLocaleString('pt-BR')} pessoa(s)</b>? Não dá para desfazer a notificação depois de enviada.
            </p>
            <button onClick={() => setConfirmar(false)} className="btn-ghost text-sm">Voltar</button>
            <button onClick={() => enviar.mutate()} disabled={enviar.isPending}
              className="btn-primary text-sm inline-flex items-center gap-2">
              {enviar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Sim, enviar agora
            </button>
          </div>
        )}
      </div>

      <h3 className="text-white font-semibold mt-6 mb-3">Enviados</h3>
      <div className="space-y-2">
        {!data && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>}
        {data && !data.items?.length && <p className="text-muted text-sm text-center py-6">Nenhum comunicado enviado ainda.</p>}
        {data?.items?.map((a: any) => (
          <div key={a.id} className="p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold break-words">{a.title}</p>
                <p className="text-[13px] text-[#cfc6dc] mt-1 whitespace-pre-wrap break-words line-clamp-3">{a.body}</p>
                <p className="text-xs text-muted mt-2">
                  {formatRelativeDate(a.createdAt)} · lido por {a.reads.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => { if (confirm(`Apagar o comunicado "${a.title}"? Ele some para todo mundo.`)) apagar.mutate(a.id); }}
                className="text-muted hover:text-[#ff6b6b] p-1" title="Apagar comunicado" aria-label="Apagar comunicado">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
