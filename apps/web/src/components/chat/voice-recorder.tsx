'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Trash2, Send, Loader2 } from 'lucide-react';

const MAX_SECONDS = 180; // 3 minutos por mensagem de voz

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return '';
}

// Botão de microfone: toca para gravar, depois envia ou descarta.
// O microfone só é pedido quando a pessoa toca no botão.
export function VoiceRecorderButton({
  onSend, disabled, onError,
}: {
  onSend: (blob: Blob, fileName: string) => Promise<void>;
  disabled?: boolean;
  onError?: (msg: string) => void;
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval>>();
  const discard = useRef(false);

  const stopAll = () => {
    clearInterval(timer.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => { discard.current = true; try { recRef.current?.stop(); } catch {} stopAll(); }, []);

  const start = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError?.('Este navegador não grava áudio.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined);
      chunks.current = [];
      discard.current = false;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stopAll();
        if (discard.current || !chunks.current.length) { setState('idle'); return; }
        const type = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(chunks.current, { type });
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        setState('sending');
        try { await onSend(blob, `mensagem-de-voz.${ext}`); }
        catch (e: any) { onError?.(e?.response?.data?.message || 'Não foi possível enviar o áudio'); }
        finally { setState('idle'); }
      };
      recRef.current = rec;
      rec.start(250);
      setSeconds(0);
      setState('recording');
      timer.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { try { rec.stop(); } catch {} }
          return s + 1;
        });
      }, 1000);
    } catch {
      onError?.('Permita o microfone para gravar a mensagem de voz.');
      stopAll();
    }
  };

  const finish = (send: boolean) => {
    discard.current = !send;
    try { recRef.current?.stop(); } catch { stopAll(); setState('idle'); }
  };

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1 bg-[rgba(255,77,109,0.12)] border border-[rgba(255,77,109,0.35)]">
        <span className="w-2 h-2 rounded-full bg-[#ff4d6d] animate-pulse" />
        <span className="text-xs text-white tabular-nums w-10">
          {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
        </span>
        <button type="button" onClick={() => finish(false)} title="Descartar"
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-white">
          <Trash2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => finish(true)} title="Enviar áudio"
          className="w-8 h-8 rounded-full flex items-center justify-center text-white"
          style={{ background: 'linear-gradient(135deg,#7c5af0,#b142f5)' }}>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={start} disabled={disabled || state === 'sending'}
      title="Gravar mensagem de voz"
      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted hover:text-white transition-colors disabled:opacity-40">
      {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}

