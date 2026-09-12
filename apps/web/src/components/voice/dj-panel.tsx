'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Music, Play, Pause, SkipForward, Square, Trash2, X, LogOut, Loader2, ListMusic, Search,
} from 'lucide-react';
import { useVoiceStore, DJ_IDENTITY, type DjTrack } from '@/stores/voice.store';
import { cn } from '@/lib/utils';

function fmt(sec: number) {
  if (!sec || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Painel do DJ Nexus: cole um link do YouTube (ou digite o nome) e a música
// toca na call para todo mundo. Qualquer pessoa na sala pode controlar.
export function DjPanel({ onClose, notify }: { onClose: () => void; notify: (msg: string) => void }) {
  const { djState, djBusy, djSummon, djCommand, participants } = useVoiceStore();
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const djInRoom = participants.has(DJ_IDENTITY);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Se o DJ já está na sala mas ainda não recebemos o estado, busca uma vez
  useEffect(() => {
    if (djInRoom && !djState) djSummon().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [djInRoom]);

  const run = async (fn: () => Promise<void>, okMsg?: string) => {
    setSending(true);
    try {
      await fn();
      if (okMsg) notify(okMsg);
    } catch (e: any) {
      notify(`🎵 ${e?.message || 'O DJ não respondeu.'}`);
    } finally {
      setSending(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setQuery('');
    run(() => djCommand('play', { query: q }), '🎵 Música adicionada à fila');
  };

  const busy = sending || djBusy;
  const cur = djState?.current ?? null;
  const queue = djState?.queue ?? [];
  const progress = cur && cur.duration ? Math.min(100, ((cur.positionSec ?? 0) / cur.duration) * 100) : 0;

  return (
    <>
      {/* clique fora fecha */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ duration: 0.18 }}
      className="fixed bottom-[100px] left-1/2 -translate-x-1/2 w-[min(440px,calc(100vw-24px))] z-50
                 rounded-2xl border border-[var(--th-line-2)] bg-[#14101a]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--th-line-2)]">
        <div className="w-8 h-8 rounded-xl grid place-items-center text-white"
             style={{ background: 'linear-gradient(145deg, #ff6a00, #7a2cff)' }}>
          <Music className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-extrabold leading-tight">DJ Nexus</div>
          <div className="text-[11px] text-[#8a7f98] truncate">
            {djInRoom
              ? (cur ? (djState?.paused ? 'Pausado' : 'Tocando na call') : 'Na sala, esperando música')
              : 'Cole um link do YouTube ou digite o nome da música'}
          </div>
        </div>
        {djInRoom && (
          <button
            title="Tirar o DJ da sala"
            onClick={() => run(() => djCommand('leave'), '🎵 DJ saiu da sala')}
            className="w-8 h-8 rounded-lg grid place-items-center text-[#8a7f98] hover:text-white hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
        <button onClick={onClose} className="w-8 h-8 rounded-lg grid place-items-center text-[#8a7f98] hover:text-white hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Entrada */}
      <form onSubmit={submit} className="flex gap-2 p-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a7f98]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Link do YouTube ou nome da música"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--th-panel-2)] border border-[var(--th-line-2)] text-sm text-white
                       placeholder:text-[#6f6580] focus:outline-none focus:border-[#7842a0]"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !query.trim()}
          className={cn(
            'h-10 px-4 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 transition-all',
            'disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5',
          )}
          style={{ background: 'linear-gradient(110deg, #ff6a00, #7a2cff)' }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Tocar
        </button>
      </form>

      {djState?.error && (
        <div className="mx-3 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[11px]">
          {djState.error}
        </div>
      )}

      {/* Tocando agora */}
      {cur && (
        <div className="mx-3 mb-3 rounded-xl border border-[#5a2e8a]/60 bg-[#1d1428] p-3">
          <div className="flex gap-3">
            {cur.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cur.thumbnail} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg grid place-items-center bg-[#2a1b3d] text-[#c59bff] flex-shrink-0">
                <Music className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-bold truncate" title={cur.title}>{cur.title}</div>
              <div className="text-[11px] text-[#a89cb4] truncate">
                {cur.uploader ? `${cur.uploader} · ` : ''}pedido por {cur.requestedBy}
                {(cur as any).fallback && <span className="text-[#ffb070]"> · via SoundCloud</span>}
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-1000"
                     style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #ff6a00, #7a2cff)' }} />
              </div>
              <div className="flex justify-between text-[10px] text-[#8a7f98] mt-1">
                <span>{fmt(cur.positionSec ?? 0)}</span>
                <span>{fmt(cur.duration)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Ctl title={djState?.paused ? 'Continuar' : 'Pausar'} disabled={busy}
                 onClick={() => run(() => djCommand(djState?.paused ? 'resume' : 'pause'))}>
              {djState?.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Ctl>
            <Ctl title="Pular" disabled={busy} onClick={() => run(() => djCommand('skip'), '⏭️ Pulando')}>
              <SkipForward className="w-4 h-4" />
            </Ctl>
            <Ctl title="Parar e limpar a fila" disabled={busy} onClick={() => run(() => djCommand('stop'), '⏹️ Parado')}>
              <Square className="w-4 h-4" />
            </Ctl>
            <span className="ml-auto text-[10px] text-[#8a7f98]">
              Volume do DJ: clique nele na grade
            </span>
          </div>
        </div>
      )}

      {/* Fila */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-black text-[#8a7f98] mb-1.5">
          <ListMusic className="w-3.5 h-3.5" /> Fila ({queue.length})
        </div>
        {queue.length === 0 ? (
          <div className="text-[11px] text-[#6f6580] py-2">
            {cur ? 'Nada na fila. Adicione a próxima!' : 'A fila está vazia.'}
          </div>
        ) : (
          <ul className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {queue.map((t: DjTrack, i: number) => (
              <li key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 group">
                <span className="w-5 text-[10px] text-[#6f6580] text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-white truncate" title={t.title}>{t.title}</div>
                  <div className="text-[10px] text-[#8a7f98] truncate">{fmt(t.duration)} · {t.requestedBy}</div>
                </div>
                <button
                  title="Remover da fila"
                  disabled={busy}
                  onClick={() => run(() => djCommand('remove', { id: t.id }))}
                  className="w-7 h-7 rounded-md grid place-items-center text-[#8a7f98] opacity-0 group-hover:opacity-100 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
    </>
  );
}

function Ctl({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="w-9 h-9 rounded-lg grid place-items-center border border-[var(--th-line-2)] bg-[var(--th-panel-2)]
                 text-[#d1c6da] hover:text-white hover:border-[#7842a0] disabled:opacity-50 transition-colors"
    >
      {children}
    </button>
  );
}
