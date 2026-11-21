'use client';

// Zoeiras na call: o servidor confere tudo (estoque, escudo, permissão do dono)
// e manda o efeito para a sala pelo socket ('zoeira'). Aqui só desenhamos.
import { arteDaZoeira } from '@/lib/itens';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { motion, AnimatePresence } from 'framer-motion';
import { Laugh, Loader2, Store } from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export interface Efeito { id: string; emoji: string; de: string; deNome: string; alvo: string | null; ate: number; apelido?: string; chave: number }
interface ItemZoeira { id: string; nome: string; emoji: string; preco: number; pesada: boolean; desc: string; qtd: number; propria?: boolean; todos?: boolean }

interface ZoeirasState {
  sala: string | null;
  estoque: ItemZoeira[] | null;
  efeitos: Efeito[];
  aviso: string | null;
  carregar: () => Promise<void>;
  usar: (id: string, alvo?: string) => Promise<void>;
}

let seq = 0;
export const useZoeiras = create<ZoeirasState>((set, get) => ({
  sala: null, estoque: null, efeitos: [], aviso: null,
  carregar: async () => { try { const { data } = await api.get('/zoeiras'); set({ estoque: data.zoeiras }); } catch { /* sem rede */ } },
  usar: async (id, alvo) => {
    const sala = get().sala;
    if (!sala) return;
    try {
      const { data } = await api.post(`/zoeiras/usar/${id}`, { voiceRoomId: sala, alvoId: alvo });
      set(s => ({ estoque: s.estoque?.map(z => (z.id === id ? { ...z, qtd: data.restante } : z)) ?? null }));
    } catch (e: any) { toast(e?.response?.data?.message || 'Não deu para usar agora', 'error'); }
  },
}));

const AVISO_ALVO: Record<string, (n: string) => string> = {
  calar: n => `🤐 ${n} te calou por 15 segundos`,
  tampao: n => `🙉 ${n} pôs um tampão em você por 10 segundos`,
  apelido: n => `🏷️ ${n} te batizou por 5 minutos`,
};

/** Liga a escuta das zoeiras na sala de voz aberta. */
export function useEscutarZoeiras(voiceRoomId: string | undefined) {
  useEffect(() => {
    if (!voiceRoomId) return;
    useZoeiras.setState({ sala: voiceRoomId });
    useZoeiras.getState().carregar();
    const s = getSocket();
    const onZoeira = (e: Omit<Efeito, 'chave'>) => {
      if (!e?.id || typeof e.ate !== 'number') return;
      const efeito: Efeito = { ...e, chave: ++seq };
      useZoeiras.setState(st => ({ efeitos: [...st.efeitos.filter(x => x.ate > Date.now()).slice(-40), efeito] }));
      const dur = Math.max(0, Math.min(e.ate - Date.now(), 60 * 60_000));
      setTimeout(() => useZoeiras.setState(st => ({ efeitos: st.efeitos.filter(x => x.chave !== efeito.chave) })), dur + 200);

      const eu = useAuthStore.getState().user?.id;
      if (e.id === 'terremoto') {
        const palco = document.querySelector('[data-nx-palco]');
        palco?.classList.remove('nx-chacoalha'); void (palco as HTMLElement | null)?.offsetWidth; palco?.classList.add('nx-chacoalha');
      }
      if (e.alvo && e.alvo === eu && e.de !== eu) {
        const aviso = AVISO_ALVO[e.id]?.(e.deNome);
        if (aviso) { useZoeiras.setState({ aviso }); setTimeout(() => useZoeiras.setState({ aviso: null }), 3500); }
        const vs = useVoiceStore.getState();
        if (e.id === 'calar' && vs.localMicEnabled) {
          vs.toggleMic().catch(() => {});
          setTimeout(() => { if (!useVoiceStore.getState().localMicEnabled) useVoiceStore.getState().toggleMic().catch(() => {}); }, dur);
        }
        if (e.id === 'tampao' && !vs.isDeafened) {
          vs.toggleDeafen();
          setTimeout(() => { if (useVoiceStore.getState().isDeafened) useVoiceStore.getState().toggleDeafen(); }, dur);
        }
      }
    };
    s.on('zoeira', onZoeira);
    return () => { s.off('zoeira', onZoeira); useZoeiras.setState({ sala: null }); };
  }, [voiceRoomId]);
}

/** Apelido ativo de alguém (Batismo). */
export function useApelido(identity: string) {
  return useZoeiras(s => s.efeitos.find(e => e.id === 'apelido' && e.alvo === identity && e.ate > Date.now())?.apelido ?? null);
}

/** Efeitos desenhados por cima do quadro da pessoa. */
export function ZoeirasDoQuadro({ identity }: { identity: string }) {
  const efs = useZoeiras(useShallow(s => s.efeitos.filter(e => e.alvo === identity)));
  const tem = (id: string) => efs.find(e => e.id === id);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] overflow-hidden rounded-[19px]">
      {/* Holofote: luz vindo de cima */}
      {tem('holofote') && <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 45% 75% at 50% 0%, rgba(255,246,200,0.55), rgba(255,246,200,0.12) 55%, transparent 75%)' }} />}
      {/* Escudo: brilho azul */}
      {tem('escudo') && <><div className="absolute inset-0 rounded-[19px] shadow-[inset_0_0_40px_rgba(80,170,255,0.45)]" /><span className="absolute left-3 top-12 text-xl drop-shadow">🛡️</span></>}
      {/* Coroa por cima da foto */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {tem('coroa') && <img src={arteDaZoeira('coroa')} alt="👑" className="absolute left-1/2 -translate-x-1/2 top-[10%] w-16 h-16 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.5)]" />}
      <AnimatePresence>
        {efs.filter(e => e.id === 'tomate' || e.id === 'torta').map(e => (
          <motion.div key={e.chave} className="absolute inset-0 grid place-items-center"
            initial={{ scale: 0.2, opacity: 0, y: -120 }} animate={{ scale: [0.2, 1.4, 1.1], opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.3 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}>
            <span className="relative drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={arteDaZoeira(e.id)} alt={e.emoji} className="w-24 h-24 object-contain" draggable={false} />
              <span className="absolute -inset-10 -z-10 rounded-full blur-md opacity-70"
                style={{ background: e.id === 'tomate' ? 'radial-gradient(circle,#ff3b2f 0 30%,transparent 62%)' : 'radial-gradient(circle,#fff3d6 0 32%,transparent 62%)' }} />
            </span>
          </motion.div>
        ))}
        {efs.filter(e => e.id === 'confete').map(e => (
          <motion.div key={e.chave} className="absolute inset-0" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {Array.from({ length: 26 }, (_, i) => (
              <motion.span key={i} className="absolute top-0 w-2 h-3 rounded-[2px]"
                style={{ left: `${(i * 37) % 100}%`, background: ['#ff6a00', '#7a2cff', '#3ddc84', '#ffd000', '#ff4dd8'][i % 5] }}
                initial={{ y: -20, rotate: 0 }} animate={{ y: 260, rotate: 360 * (i % 2 ? 1 : -1) }}
                transition={{ duration: 1.6 + (i % 5) * 0.25, delay: (i % 7) * 0.08, ease: 'easeIn' }} />
            ))}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Botão no quadro de outra pessoa: abre as suas zoeiras. */
export function BotaoZoeira({ identity, nome }: { identity: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const { estoque, usar, carregar } = useZoeiras();
  const [usando, setUsando] = useState<string | null>(null);
  const minhas = (estoque || []).filter(z => z.qtd > 0 && !z.propria);
  return (
    <div className="absolute left-3 top-12 z-20" onClick={e => e.stopPropagation()}>
      <button onClick={() => { setAberto(v => !v); if (!aberto) carregar(); }}
        title={`Zoeira em ${nome}`} aria-label={`Zoeira em ${nome}`}
        className={cn('h-8 px-2.5 rounded-[10px] flex items-center gap-1.5 text-[11px] font-black bg-black/45 backdrop-blur border border-white/10 text-[#ffb3e6] transition-all',
          aberto ? 'opacity-100' : 'opacity-0 group-hover/quadro:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
          'hover:border-[#ff4dd8] hover:text-white')}>
        <Laugh className="w-3.5 h-3.5" /> Zoeira
      </button>
      {aberto && (
        <div className="absolute left-0 top-10 w-[210px] p-2 rounded-2xl border border-[#4d3560] bg-[#160f20]/95 backdrop-blur shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
          {estoque === null ? (
            <div className="h-16 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-[#8b48ff]" /></div>
          ) : minhas.length === 0 ? (
            <p className="text-[12px] text-[#a99fc0] p-2">Você não tem zoeiras. Compre na loja com Nex.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {minhas.map(z => (
                <button key={z.id} disabled={usando === z.id} title={`${z.nome}: ${z.desc}`}
                  onClick={async () => { setUsando(z.id); await usar(z.id, z.todos ? undefined : identity); setUsando(null); setAberto(false); }}
                  className="relative h-14 rounded-xl hover:bg-white/10 flex flex-col items-center justify-center disabled:opacity-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={arteDaZoeira(z.id)} alt={z.emoji} className="w-7 h-7 object-contain" />
                  <span className="text-[9px] text-[#c9c2d2] mt-1 truncate max-w-full px-0.5">{z.nome}</span>
                  <span className="absolute top-0.5 right-1 text-[9px] font-black text-[#ffb070]">{z.qtd}</span>
                </button>
              ))}
            </div>
          )}
          <a href="/app/loja" className="mt-1.5 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-black text-[#c9a6ff] hover:bg-white/5">
            <Store className="w-3.5 h-3.5" /> Comprar zoeiras
          </a>
        </div>
      )}
    </div>
  );
}

/** No seu próprio quadro: ativa o Escudo (se tiver no estoque). */
export function BotaoEscudo() {
  const escudo = useZoeiras(s => s.estoque?.find(z => z.id === 'escudo'));
  const usar = useZoeiras(s => s.usar);
  const [ativando, setAtivando] = useState(false);
  if (!escudo || escudo.qtd <= 0) return null;
  return (
    <button onClick={async (e) => { e.stopPropagation(); setAtivando(true); await usar('escudo'); setAtivando(false); }}
      disabled={ativando} title="Ativar escudo: nenhuma zoeira pega em você por 1 hora"
      className="absolute left-3 top-3 z-20 h-8 px-2.5 rounded-[10px] flex items-center gap-1.5 text-[11px] font-black bg-black/45 backdrop-blur border border-white/10 text-[#9fd3ff]
                 opacity-0 group-hover/quadro:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:border-[#50aaff] disabled:opacity-50">
      🛡️ Escudo ({escudo.qtd})
    </button>
  );
}

/** Aviso para quem levou uma zoeira pesada. */
export function AvisoZoeira() {
  const aviso = useZoeiras(s => s.aviso);
  return (
    <AnimatePresence>
      {aviso && (
        <motion.div key={aviso} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          className="absolute top-32 inset-x-0 mx-auto w-max z-40 px-4 py-2 rounded-full text-sm font-black text-white border border-[#ff4dd8]/50"
          style={{ background: 'linear-gradient(90deg, #b142f5, #ff4dd8)' }} role="status">
          {aviso}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
