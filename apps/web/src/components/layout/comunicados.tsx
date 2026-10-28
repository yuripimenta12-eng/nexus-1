'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { Megaphone, X } from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { playMention } from '@/lib/sounds';
import { textoComLinks } from '@/components/chat/links-mensagem';
import { cn } from '@/lib/utils';

// Comunicados do dono do Nexus para todo mundo:
//  - aparecem em destaque (um por vez) até a pessoa clicar em "Entendi";
//  - chegam na hora para quem está com o Nexus aberto (socket);
//  - ficam guardados no botão do megafone, na barra da esquerda.
export interface Comunicado {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  pending: boolean;
}

interface ComunicadosState {
  itens: Comunicado[];
  carregado: boolean;
  listaAberta: boolean;
  carregar: () => Promise<void>;
  marcarLido: (id: string) => void;
  abrirLista: (v: boolean) => void;
}

export const useComunicados = create<ComunicadosState>((set, get) => ({
  itens: [],
  carregado: false,
  listaAberta: false,
  carregar: async () => {
    try {
      const { data } = await api.get('/announcements');
      if (Array.isArray(data)) set({ itens: data, carregado: true });
    } catch { /* sem conexão: tenta de novo na próxima abertura */ }
  },
  marcarLido: (id) => {
    set({ itens: get().itens.map(a => (a.id === id ? { ...a, read: true, pending: false } : a)) });
    api.post(`/announcements/${id}/read`).catch(() => { /* volta a aparecer no próximo carregamento */ });
  },
  abrirLista: (v) => {
    set({ listaAberta: v });
    // Abrir a lista conta como ter visto os que ainda não estavam lidos
    if (v) get().itens.filter(a => !a.read && !a.pending).forEach(a => get().marcarLido(a.id));
  },
}));

const quando = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Fica montado no layout do app: carrega, escuta os novos e mostra o destaque
export function ComunicadosHost() {
  const { itens, carregar, marcarLido, listaAberta, abrirLista } = useComunicados();

  useEffect(() => {
    carregar();
    const socket = getSocket();
    const onNovo = (a: Comunicado) => {
      if (!a?.id) return;
      const atual = useComunicados.getState().itens;
      if (atual.some(x => x.id === a.id)) return;
      useComunicados.setState({ itens: [{ ...a, read: false, pending: true }, ...atual] });
      try { playMention(); } catch { /* autoplay bloqueado */ }
    };
    const onApagado = ({ id }: { id: string }) => {
      useComunicados.setState({ itens: useComunicados.getState().itens.filter(x => x.id !== id) });
    };
    // Reconectou (internet caiu, PC acordou): pode ter perdido algum
    const onConnect = () => carregar();
    socket.on('announcement:new', onNovo);
    socket.on('announcement:deleted', onApagado);
    socket.on('connect', onConnect);
    return () => {
      socket.off('announcement:new', onNovo);
      socket.off('announcement:deleted', onApagado);
      socket.off('connect', onConnect);
    };
  }, [carregar]);

  // O mais antigo primeiro: a pessoa lê na ordem em que foram enviados
  const pendentes = itens.filter(a => a.pending).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const atual = pendentes[0];

  return (
    <>
      {atual && (
        // Sem fechar clicando fora nem com Esc: só some no "Entendi"
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="comunicado-titulo">
          <div className="w-full max-w-[480px] max-h-[85vh] flex flex-col rounded-2xl border border-[#7a2cff]/50 shadow-2xl overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1e1630, #0f0c1a)' }}>
            <div className="px-5 pt-5 pb-3 flex items-center gap-3">
              <span className="w-11 h-11 shrink-0 rounded-xl grid place-items-center text-white"
                style={{ background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
                <Megaphone className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-wider text-[#ffb070]">
                  Comunicado do Nexus{pendentes.length > 1 ? ` · 1 de ${pendentes.length}` : ''}
                </p>
                <p className="text-[11px] text-[#a99fc0]">{quando(atual.createdAt)}</p>
              </div>
            </div>
            <div className="px-5 pb-4 overflow-y-auto">
              <h2 id="comunicado-titulo" className="text-white text-lg font-extrabold leading-snug break-words">{atual.title}</h2>
              <p className="mt-2 text-[14px] text-[#ddd5e8] whitespace-pre-wrap break-words leading-relaxed">{textoComLinks(atual.body)}</p>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end">
              <button autoFocus onClick={() => marcarLido(atual.id)}
                className="h-10 px-6 rounded-xl font-black text-white bg-[#7a2cff] hover:bg-[#8f42ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {listaAberta && <ListaComunicados itens={itens} onFechar={() => abrirLista(false)} />}
    </>
  );
}

function ListaComunicados({ itens, onFechar }: { itens: Comunicado[]; onFechar: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-[85] bg-black/60 flex items-center justify-center p-4" onClick={onFechar} role="dialog" aria-modal="true" aria-label="Comunicados">
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-[520px] max-h-[80vh] flex flex-col rounded-2xl border border-[var(--th-line-2)] bg-[#120d1c] shadow-2xl">
        <div className="px-5 py-4 flex items-center gap-2 border-b border-white/10">
          <Megaphone className="w-5 h-5 text-[#ffb070]" />
          <h2 className="text-white font-bold flex-1">Comunicados do Nexus</h2>
          <button onClick={onFechar} className="text-muted hover:text-white" aria-label="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2">
          {!itens.length && <p className="text-muted text-sm text-center py-10">Nenhum comunicado ainda.</p>}
          {itens.map(a => (
            <div key={a.id} className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-2">
                <p className="text-white font-bold text-[14px] flex-1 min-w-0 break-words">{a.title}</p>
                <span className="text-[11px] text-[#a99fc0] shrink-0">{quando(a.createdAt)}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[#cfc6dc] whitespace-pre-wrap break-words">{textoComLinks(a.body)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Botão do megafone na barra da esquerda (com o número de não lidos)
export function BotaoComunicados() {
  const { itens, abrirLista } = useComunicados();
  const naoLidos = itens.filter(a => !a.read).length;
  return (
    <button
      onClick={() => abrirLista(true)}
      className="relative w-[46px] h-[46px] rounded-2xl border border-transparent transition-all duration-200
                 flex items-center justify-center text-muted hover:text-white hover:bg-[#1c1227] hover:border-[#362146]"
      title="Comunicados do Nexus"
      aria-label={naoLidos ? `Comunicados do Nexus: ${naoLidos} não lido(s)` : 'Comunicados do Nexus'}
    >
      <Megaphone className="w-5 h-5" />
      {naoLidos > 0 && (
        <span className={cn('absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center',
          'text-[10px] font-black text-white bg-[#ed4245] border-2 border-[#0c0911]')}>
          {naoLidos > 9 ? '9+' : naoLidos}
        </span>
      )}
    </button>
  );
}
