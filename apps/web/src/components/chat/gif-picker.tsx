'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import api from '@/lib/api';

interface Gif { id: string; url: string; preview: string; width: number; height: number; title: string }

// Os GIFs só aparecem quando o servidor tem a chave do GIPHY
let enabledCache: boolean | null = null;
let enabledReq: Promise<boolean> | null = null;
function gifsEnabled() {
  if (enabledCache !== null) return Promise.resolve(enabledCache);
  if (!enabledReq) {
    enabledReq = api.get('/gifs/status')
      .then(({ data }) => (enabledCache = !!data?.enabled))
      .catch(() => (enabledCache = false));
  }
  return enabledReq;
}

export function GifButton({ onPick, disabled }: { onPick: (url: string) => void; disabled?: boolean }) {
  const [enabled, setEnabled] = useState(enabledCache ?? false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { gifsEnabled().then(setEnabled); }, []);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setLoading(true);
      setErr('');
      const term = q.trim();
      (term ? api.get('/gifs/search', { params: { q: term } }) : api.get('/gifs/trending'))
        .then(({ data }) => setItems(Array.isArray(data) ? data : []))
        .catch((e) => { setItems([]); setErr(e?.response?.data?.message || 'Não foi possível buscar GIFs'); })
        .finally(() => setLoading(false));
    }, q ? 350 : 0);
    return () => clearTimeout(debounce.current);
  }, [q, open]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} disabled={disabled} title="Enviar GIF"
        className="h-8 px-1.5 shrink-0 rounded-lg flex items-center justify-center text-muted hover:text-white transition-colors text-[11px] font-black tracking-wide disabled:opacity-40">
        <span className="border border-current rounded px-1 leading-4">GIF</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-11 right-0 z-50 w-[min(340px,calc(100vw-24px))] rounded-xl border border-[var(--th-line)] bg-[var(--th-side)] shadow-2xl p-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/20 mb-2">
              <Search className="w-4 h-4 text-muted" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar GIFs"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted" maxLength={50} />
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-white" title="Fechar"><X className="w-4 h-4" /></button>
            </div>
            <div className="h-72 overflow-y-auto grid grid-cols-2 gap-1.5 content-start">
              {loading && <div className="col-span-2 flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted" /></div>}
              {!loading && err && <p className="col-span-2 text-center text-muted text-sm py-10">{err}</p>}
              {!loading && !err && items.length === 0 && <p className="col-span-2 text-center text-muted text-sm py-10">Nada encontrado</p>}
              {!loading && items.map(g => (
                <button key={g.id} type="button" title={g.title}
                  onClick={() => { onPick(g.url); setOpen(false); setQ(''); }}
                  className="rounded-lg overflow-hidden bg-black/30 hover:ring-2 hover:ring-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.preview} alt={g.title} loading="lazy" className="w-full h-28 object-cover" />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted text-right mt-1.5 pr-1">via GIPHY</p>
          </div>
        </>
      )}
    </div>
  );
}
