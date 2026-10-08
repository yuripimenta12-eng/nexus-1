'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Play, Pause, Download } from 'lucide-react';
import { formatFileSize, isImageMime } from '@/lib/utils';

// GIF enviado pelo seletor: a mensagem é só o link do GIPHY.
// Só esse domínio vira imagem (link qualquer continua texto, sem "pixel espião").
const GIPHY_RE = /^https:\/\/(media\d?|i)\.giphy\.com\/[\w/.\-?=&%]+$/i;
export function isGifUrl(text?: string | null) {
  return !!text && GIPHY_RE.test(text.trim());
}

export function GifView({ url, onClick }: { url: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="block rounded-xl overflow-hidden max-w-[280px] border border-[var(--th-line)] cursor-zoom-in mt-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="GIF" loading="lazy" className="block w-full h-auto max-h-64 object-cover" />
    </button>
  );
}

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Player de mensagem de voz: tocar/pausar, barra de progresso e tempo
export function AudioMessage({ url, mine }: { url: string; mine?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => {
      // WebM gravado no navegador às vezes vem sem duração: força o cálculo
      if (!Number.isFinite(a.duration)) {
        a.currentTime = 1e7;
        const fix = () => { a.currentTime = 0; setDur(a.duration); a.removeEventListener('timeupdate', fix); };
        a.addEventListener('timeupdate', fix);
      } else setDur(a.duration);
    };
    const onEnd = () => { setPlaying(false); setTime(0); };
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', () => setPlaying(false));
    a.addEventListener('play', () => setPlaying(true));
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      // Só uma mensagem de voz tocando por vez
      document.querySelectorAll('audio[data-nx-voice]').forEach(el => { if (el !== a) (el as HTMLAudioElement).pause(); });
      a.play().catch(() => {});
    } else a.pause();
  };

  const pct = dur > 0 ? Math.min(100, (time / dur) * 100) : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * dur;
  };

  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3 py-2 w-[240px] max-w-full"
      style={{ background: mine ? 'rgba(255,255,255,0.14)' : 'rgba(124,90,240,0.14)' }}>
      <audio ref={ref} src={url} preload="metadata" data-nx-voice />
      <button type="button" onClick={toggle} aria-label={playing ? 'Pausar' : 'Tocar mensagem de voz'}
        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white"
        style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-white/15 cursor-pointer relative" onClick={seek}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/80" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] text-white/60 mt-1 tabular-nums">
          {playing || time > 0 ? fmt(time) : fmt(dur)}
        </div>
      </div>
    </div>
  );
}

export interface AttachmentLike { id?: string; url: string; fileName: string; fileSize: number; mimeType: string }

// Mostra um anexo do jeito certo: foto, áudio, vídeo ou arquivo para baixar
export function AttachmentView({ att, mine, onImageClick }: { att: AttachmentLike; mine?: boolean; onImageClick?: (url: string) => void }) {
  if (isImageMime(att.mimeType)) {
    return (
      <button type="button" onClick={() => onImageClick?.(att.url)}
        className="rounded-xl overflow-hidden max-w-xs border border-[var(--th-line)] cursor-zoom-in hover:border-accent transition-colors">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={att.url} alt={att.fileName} loading="lazy" className="max-w-full max-h-80 object-contain" />
      </button>
    );
  }
  if (att.mimeType.startsWith('audio/')) return <AudioMessage url={att.url} mine={mine} />;
  if (att.mimeType.startsWith('video/')) {
    return (
      <video src={att.url} controls preload="metadata"
        className="rounded-xl max-w-xs max-h-80 border border-[var(--th-line)] bg-black" />
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 p-2 pr-3 bg-surface rounded-xl text-sm text-muted-foreground hover:text-white border border-border max-w-xs">
      <Paperclip className="w-4 h-4 shrink-0" />
      <span className="truncate">{att.fileName}</span>
      <span className="text-muted text-xs shrink-0">{formatFileSize(att.fileSize)}</span>
      <Download className="w-3.5 h-3.5 shrink-0 opacity-60" />
    </a>
  );
}
