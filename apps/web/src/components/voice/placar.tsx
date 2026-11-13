'use client';

// "Quem mora na call?": placar de cada servidor (tempo em call, quem mais
// fala, DJ da mesa) e as conquistas de cada pessoa.
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ParticipantEvent } from 'livekit-client';
import api from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';

const LIMA = '#c8f53b';

export const CONQUISTAS: { chave: string; emoji: string; nome: string; meta: string }[] = [
  { chave: 'tagarela', emoji: '💬', nome: 'Tagarela', meta: '100 mensagens' },
  { chave: 'rato-de-call', emoji: '🎧', nome: 'Rato de call', meta: '10 h em call' },
  { chave: 'dj-da-mesa', emoji: '🎛️', nome: 'DJ da mesa', meta: '100 músicas' },
  { chave: 'coruja', emoji: '🦉', nome: 'Coruja', meta: '2h às 5h' },
  { chave: 'mora-na-call', emoji: '🏠', nome: 'Mora na call', meta: '100 h em call' },
  { chave: 'streamer', emoji: '📺', nome: 'Streamer', meta: '10 telas' },
  { chave: 'rosto-conhecido', emoji: '📷', nome: 'Rosto conhecido', meta: '10 h de câmera' },
  { chave: 'mil-mensagens', emoji: '📨', nome: 'Mil mensagens', meta: '1.000 msgs' },
];

// Avisa a tela (toast) quando o servidor devolve conquistas novas
function anunciar(novas: unknown) {
  if (Array.isArray(novas) && novas.length) {
    window.dispatchEvent(new CustomEvent('nx-conquista', { detail: novas }));
  }
}

/** Música pedida ao DJ (com o recibo dele) / tocada pela janela de música, ou live começada. */
export function registrarEventoPlacar(tipo: 'musica' | 'live', recibo?: string) {
  const roomId = useVoiceStore.getState().voiceRoomId;
  if (!roomId) return;
  api.post('/placar/evento', { roomId, tipo, recibo }).then(r => anunciar(r.data?.novas)).catch(() => {});
}

// Batimento a cada 45 s enquanto está numa call (o servidor só soma o tempo
// real que passou) + toast de conquista desbloqueada. Fica montado no app todo.
export function BatimentoPlacar() {
  const room = useVoiceStore(s => s.room);
  const roomId = useVoiceStore(s => s.voiceRoomId);
  const conectado = useVoiceStore(s => s.isConnected);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!room || !roomId || !conectado) return;
    const lp = room.localParticipant;
    let falando = 0;          // segundos falando desde o último batimento
    let desde = lp.isSpeaking ? Date.now() : 0;
    let ultimo = Date.now();
    const aoFalar = (sim: boolean) => {
      if (sim && !desde) desde = Date.now();
      if (!sim && desde) { falando += (Date.now() - desde) / 1000; desde = 0; }
    };
    lp.on(ParticipantEvent.IsSpeakingChanged, aoFalar);
    const bater = () => {
      const agora = Date.now();
      if (desde) { falando += (agora - desde) / 1000; desde = agora; }
      const passou = (agora - ultimo) / 1000;
      ultimo = agora;
      const body = { roomId, falando: Math.round(falando), camera: lp.isCameraEnabled ? Math.round(passou) : 0 };
      falando = 0;
      api.post('/placar/batimento', body).then(r => anunciar(r.data?.novas)).catch(() => {});
    };
    bater(); // começa a contar já na entrada
    const t = setInterval(bater, 45_000);
    return () => { clearInterval(t); lp.off(ParticipantEvent.IsSpeakingChanged, aoFalar); };
  }, [room, roomId, conectado]);

  useEffect(() => {
    const fila: string[] = [];
    let ativo = false;
    const proxima = () => {
      const c = fila.shift();
      if (!c) { ativo = false; setToast(null); return; }
      ativo = true;
      setToast(c);
      setTimeout(proxima, 5000);
    };
    const ouvir = (e: Event) => {
      fila.push(...((e as CustomEvent).detail as string[]));
      if (!ativo) proxima();
    };
    window.addEventListener('nx-conquista', ouvir);
    return () => window.removeEventListener('nx-conquista', ouvir);
  }, []);

  const c = CONQUISTAS.find(x => x.chave === toast);
  return (
    <AnimatePresence>
      {c && (
        <motion.div
          key={c.chave}
          role="status"
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="fixed z-[70] top-4 left-1/2 -translate-x-1/2 w-[min(92vw,380px)] flex items-center gap-3.5 px-4 py-3 rounded-2xl
                     bg-[#141019]/95 border shadow-2xl"
          style={{ borderColor: `${LIMA}88`, boxShadow: `0 0 24px ${LIMA}33` }}
        >
          <Hexagono emoji={c.emoji} ativo tamanho={52} />
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[2px] uppercase" style={{ color: LIMA }}>Conquista desbloqueada</p>
            <b className="block text-white text-lg leading-tight">{c.nome}</b>
            <small className="text-[#a99cb8] text-xs">{c.meta}</small>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const HEX = 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)';
function Hexagono({ emoji, ativo, tamanho = 44 }: { emoji: string; ativo: boolean; tamanho?: number }) {
  return (
    <div className="shrink-0 grid place-items-center" style={{ width: tamanho, height: tamanho * 0.9, clipPath: HEX, background: ativo ? LIMA : '#2a2433' }}>
      <div className="grid place-items-center" style={{ width: tamanho - 4, height: tamanho * 0.9 - 4, clipPath: HEX, background: ativo ? '#18131f' : '#1a1620' }}>
        <span className={cn(!ativo && 'grayscale opacity-30')} style={{ fontSize: tamanho * 0.42 }}>{emoji}</span>
      </div>
    </div>
  );
}

type Tipo = 'tempo' | 'fala' | 'dj';
const ABAS: { tipo: Tipo; nome: string }[] = [
  { tipo: 'tempo', nome: 'Tempo em call' },
  { tipo: 'fala', nome: 'Quem mais fala' },
  { tipo: 'dj', nome: 'DJ da mesa' },
];
interface Linha { userId: string; nome: string; avatarUrl: string | null; valor: number }

function formatar(tipo: Tipo, v: number) {
  if (tipo === 'dj') return `${v} ${v === 1 ? 'música' : 'músicas'}`;
  if (v < 3600) return `${Math.max(1, Math.round(v / 60))} min`;
  return `${(v / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} h`;
}

/** Aba "Placar" do painel da chamada. */
export function PainelPlacar({ serverId }: { serverId: string }) {
  const eu = useAuthStore(s => s.user?.id);
  const [tipo, setTipo] = useState<Tipo>('tempo');
  const [dados, setDados] = useState<{ itens: Linha[]; eu: { posicao: number | null; valor: number } } | null>(null);
  const [conq, setConq] = useState<Set<string>>(new Set());
  const pedido = useRef(0);

  const carregar = useCallback(() => {
    const n = ++pedido.current;
    api.get(`/placar/servidor/${serverId}`, { params: { tipo } })
      .then(r => { if (n === pedido.current) setDados(r.data); })
      .catch(() => { if (n === pedido.current) setDados({ itens: [], eu: { posicao: null, valor: 0 } }); });
  }, [serverId, tipo]);

  useEffect(() => { setDados(null); carregar(); }, [carregar]);
  useEffect(() => {
    api.get('/placar/conquistas').then(r => setConq(new Set((r.data?.desbloqueadas || []).map((c: any) => c.chave)))).catch(() => {});
  }, []);

  const max = Math.max(1, ...(dados?.itens.map(i => i.valor) || [1]));
  const euNaLista = dados?.itens.some(i => i.userId === eu);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="text-[19px] font-black leading-[1.05] text-white mb-3">
        Quem mora<br /><span style={{ color: LIMA }}>na call?</span>
      </h3>

      <div role="tablist" className="flex gap-1.5 mb-3 flex-wrap">
        {ABAS.map(a => (
          <button key={a.tipo} role="tab" aria-selected={tipo === a.tipo} onClick={() => setTipo(a.tipo)}
            className={cn('h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors',
              tipo === a.tipo ? 'text-[#14180a] border-transparent' : 'text-[#a99cb8] border-[var(--th-line-2)] hover:text-white')}
            style={tipo === a.tipo ? { background: LIMA } : undefined}>
            {a.nome}
          </button>
        ))}
      </div>

      {!dados ? (
        <p className="text-[#786e83] text-xs py-6 text-center">Carregando…</p>
      ) : dados.itens.length === 0 ? (
        <p className="text-[#786e83] text-xs py-6 text-center leading-relaxed">
          Ninguém pontuou aqui ainda.<br />O placar começa a contar a partir de agora.
        </p>
      ) : (
        <ol className="space-y-1">
          {dados.itens.map((l, i) => (
            <LinhaPlacar key={l.userId} pos={i + 1} linha={l} tipo={tipo} max={max} souEu={l.userId === eu} indice={i} />
          ))}
          {!euNaLista && dados.eu.posicao && (
            <LinhaPlacar pos={dados.eu.posicao} tipo={tipo} max={max} souEu indice={dados.itens.length}
              linha={{ userId: eu || '', nome: 'Você', avatarUrl: null, valor: dados.eu.valor }} />
          )}
        </ol>
      )}
      <p className="text-[10px] text-[#786e83] mt-2">Cada servidor tem o seu placar.</p>

      <h4 className="text-[11px] text-[#786e83] uppercase tracking-[1.2px] font-bold mt-6 mb-3">Suas conquistas</h4>
      <div className="grid grid-cols-4 gap-x-1 gap-y-3">
        {CONQUISTAS.map(c => {
          const ativo = conq.has(c.chave);
          return (
            <motion.div key={c.chave} title={`${c.nome} · ${c.meta}`} className="flex flex-col items-center text-center"
              whileHover={{ y: -3, scale: 1.06 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
              <Hexagono emoji={c.emoji} ativo={ativo} />
              <b className={cn('text-[9.5px] leading-tight mt-1', ativo ? 'text-white' : 'text-[#5c5468]')}>{c.nome}</b>
              <small className={cn('text-[8.5px] leading-tight', ativo ? 'text-[#a99cb8]' : 'text-[#4a4354]')}>{c.meta}</small>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function LinhaPlacar({ pos, linha, tipo, max, souEu, indice }: { pos: number; linha: Linha; tipo: Tipo; max: number; souEu: boolean; indice: number }) {
  const primeiro = pos === 1;
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: indice * 0.04 }}
      className={cn('flex items-center gap-2 px-2 py-2 rounded-xl', souEu && 'bg-white/[0.04] border border-[var(--th-line-2)]')}
    >
      <span className={cn('w-4 text-center text-[13px] font-black tabular-nums', primeiro ? '' : 'text-[#5c5468]')}
        style={primeiro ? { color: LIMA } : undefined}>{pos}</span>
      <div className="relative shrink-0">
        {linha.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={linha.avatarUrl} alt="" draggable={false} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-black"
            style={primeiro ? { background: LIMA, color: '#14180a' } : { background: '#3b2d52', color: '#fff' }}>
            {getInitials(linha.nome)}
          </div>
        )}
        {primeiro && <span className="absolute -top-2 -right-1.5 text-[13px] rotate-12" aria-label="Primeiro lugar">👑</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <b className="text-xs text-white truncate">{souEu ? 'Você' : linha.nome}</b>
          <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: primeiro ? LIMA : '#fff' }}>
            {formatar(tipo, linha.valor)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] mt-1.5 overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: primeiro ? LIMA : '#6b6378' }}
            initial={{ width: 0 }} animate={{ width: `${Math.min(100, (linha.valor / max) * 100)}%` }}
            transition={{ duration: 0.6, delay: 0.1 + indice * 0.04, ease: 'easeOut' }} />
        </div>
      </div>
    </motion.li>
  );
}
