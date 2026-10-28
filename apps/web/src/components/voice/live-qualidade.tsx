'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, X } from 'lucide-react';
import {
  LocalVideoTrack, Participant, RemoteTrackPublication, RemoteVideoTrack, Track, VideoQuality,
} from 'livekit-client';
import { cn } from '@/lib/utils';

// Qualidade real das lives de tela:
//  - selo "1080p · 58 fps" (o que está saindo, para quem transmite; o que
//    está chegando, para quem assiste)
//  - aviso para quem transmite quando o PC ou a internet estão no limite
//  - escolha de qualidade para quem assiste (Automática / Leve)

export interface QualidadeLive {
  altura: number;
  largura: number;
  fps: number;
  limite: 'cpu' | 'bandwidth' | null; // só para quem transmite
  // Diagnóstico de quem transmite: quadros que a captura entrega e quem
  // comprime o vídeo (a placa de vídeo é leve; o processador disputa com o jogo)
  fpsCaptura?: number;
  codificador?: 'placa de vídeo' | 'processador' | null;
}

async function diagnosticoEnvio(track: LocalVideoTrack) {
  let fpsCaptura = 0;
  let codificador: QualidadeLive['codificador'] = null;
  try {
    const rel = await track.sender?.getStats();
    rel?.forEach((r: any) => {
      if (r.type === 'media-source' && r.kind === 'video') fpsCaptura = Math.round(r.framesPerSecond || 0);
      if (r.type === 'outbound-rtp' && r.kind === 'video' && !codificador && (r.encoderImplementation || r.powerEfficientEncoder !== undefined)) {
        codificador = r.powerEfficientEncoder === true
          || (r.powerEfficientEncoder === undefined && !/OpenH264|libvpx|libaom/i.test(r.encoderImplementation || ''))
          ? 'placa de vídeo' : 'processador';
      }
    });
  } catch { /* navegador sem essas estatísticas */ }
  return { fpsCaptura, codificador };
}

function pubTela(p: Participant) {
  return Array.from(p.trackPublications.values()).find(x => x.source === Track.Source.ScreenShare && x.track);
}

// Lê as estatísticas da live a cada 2 s (só enquanto o componente está na tela)
export function useQualidadeLive(p: Participant | null | undefined): QualidadeLive | null {
  const [q, setQ] = useState<QualidadeLive | null>(null);
  const anterior = useRef<{ quadros: number; t: number } | null>(null);
  useEffect(() => {
    if (!p) return;
    let vivo = true;
    anterior.current = null;
    const ler = async () => {
      const track = pubTela(p)?.track;
      if (!track) { if (vivo) setQ(null); return; }
      try {
        if (track instanceof LocalVideoTrack) {
          // Quem transmite: a camada mais alta que está saindo
          const camadas = await track.getSenderStats();
          const alta = camadas.reduce<typeof camadas[number] | null>((m, s) => (!m || (s.frameWidth || 0) > (m.frameWidth || 0) ? s : m), null);
          if (!alta || !vivo) return;
          const motivo = camadas.map(c => c.qualityLimitationReason).find(r => r === 'cpu' || r === 'bandwidth') as 'cpu' | 'bandwidth' | undefined;
          const diag = await diagnosticoEnvio(track);
          if (!vivo) return;
          setQ({ largura: alta.frameWidth || 0, altura: alta.frameHeight || 0, fps: Math.round(alta.framesPerSecond || 0), limite: motivo || null, ...diag });
        } else if (track instanceof RemoteVideoTrack) {
          // Quem assiste: o que está chegando de verdade
          const s = await track.getReceiverStats();
          if (!s || !vivo) return;
          const a = anterior.current;
          const fps = a && s.timestamp > a.t ? ((s.framesDecoded - a.quadros) * 1000) / (s.timestamp - a.t) : 0;
          anterior.current = { quadros: s.framesDecoded, t: s.timestamp };
          if (a) setQ({ largura: s.frameWidth || 0, altura: s.frameHeight || 0, fps: Math.max(0, Math.round(fps)), limite: null });
        }
      } catch { /* estatística indisponível neste navegador */ }
    };
    ler();
    const t = setInterval(ler, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, [p]);
  return q;
}

// Selo "1080p · 58 fps"
export function SeloQualidade({ participante, pequeno }: { participante: Participant; pequeno?: boolean }) {
  const q = useQualidadeLive(participante);
  if (!q || !q.altura) return null;
  const engasgando = q.fps > 0 && q.fps < 20;
  // Quem transmite: o motivo aparece ao passar o mouse (ajuda a achar o gargalo)
  const detalhes = q.fpsCaptura !== undefined
    ? [
        q.fpsCaptura ? `Captura da tela: ${q.fpsCaptura} fps` : null,
        `Enviando: ${q.fps} fps`,
        q.codificador ? `Compressão: ${q.codificador}` : null,
        q.limite === 'cpu' ? 'Limite: processador do PC' : q.limite === 'bandwidth' ? 'Limite: internet de envio' : 'Sem limite agora',
      ].filter(Boolean).join(' · ')
    : null;
  return (
    <span
      title={detalhes || (engasgando ? 'Poucos quadros por segundo: a imagem pode parecer travada' : 'Qualidade real da live agora')}
      className={cn('tabular-nums font-bold rounded-md', pequeno ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5',
        engasgando ? 'bg-[#ffce73]/20 text-[#ffce73]' : 'bg-white/10 text-[#d9d2e3]')}
    >
      {q.altura}p · {q.fps} fps
    </span>
  );
}

// Escolha de quem assiste: Automática (o melhor que a internet aguenta) ou Leve
const escolhas = new Map<string, 'auto' | 'leve'>(); // vale enquanto a página está aberta
export function SeletorQualidadeLive({ participante }: { participante: Participant }) {
  const [modo, setModo] = useState<'auto' | 'leve'>(escolhas.get(participante.identity) || 'auto');
  const pub = pubTela(participante) as RemoteTrackPublication | undefined;
  useEffect(() => {
    // Reaplica se a live recomeçar (nova trilha)
    pub?.setVideoQuality(modo === 'leve' ? VideoQuality.LOW : VideoQuality.HIGH);
  }, [pub, modo]);
  if (!pub) return null;
  const mudar = (m: 'auto' | 'leve') => { escolhas.set(participante.identity, m); setModo(m); };
  return (
    <div onClick={e => e.stopPropagation()} role="radiogroup" aria-label="Qualidade da live"
      className="flex items-center gap-0.5 text-[11px] font-bold bg-[#09070d]/75 backdrop-blur rounded-lg p-0.5"
      title="Leve: imagem menor (540p) e mais estável — use se a live travar para você">
      <Gauge className="w-3.5 h-3.5 text-[#c887ff] mx-1" aria-hidden />
      {(['auto', 'leve'] as const).map(m => (
        <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => mudar(m)}
          className={cn('px-2 py-1 rounded-md transition-colors', modo === m ? 'bg-[#7a2cff] text-white' : 'text-[#c9c2d2] hover:bg-white/10')}>
          {m === 'auto' ? 'Automática' : 'Leve'}
        </button>
      ))}
    </div>
  );
}

// Aviso para quem transmite: PC ou internet no limite (a live pode travar)
export function AvisoLimiteLive({ participante }: { participante: Participant }) {
  const q = useQualidadeLive(participante);
  const seguidas = useRef(0);
  const [mostrar, setMostrar] = useState<'cpu' | 'bandwidth' | null>(null);
  const [ignorarAte, setIgnorarAte] = useState(0);
  const [aplicado, setAplicado] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;
    // Só avisa se continuar limitado por ~6 s (evita alarme por um soluço)
    seguidas.current = q.limite ? seguidas.current + 1 : 0;
    if (seguidas.current >= 3 && Date.now() > ignorarAte) setMostrar(q.limite);
    else if (!q.limite) setMostrar(null);
  }, [q, ignorarAte]);

  useEffect(() => {
    if (!aplicado) return;
    const t = setTimeout(() => setAplicado(null), 4000);
    return () => clearTimeout(t);
  }, [aplicado]);

  const track = pubTela(participante)?.track;
  const cfg = track?.mediaStreamTrack?.getSettings?.() || {};
  const altura = (cfg.height as number) || q?.altura || 0;
  const fpsCaptura = (cfg.frameRate as number) || 0;

  // Baixa a captura sem parar a live (não precisa escolher a tela de novo)
  const baixar = async () => {
    const mst = track?.mediaStreamTrack;
    if (!mst) return;
    try {
      if (altura > 720) {
        await mst.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: fpsCaptura || 60 } });
        setAplicado('Live ajustada para 720p');
      } else {
        await mst.applyConstraints({ frameRate: { ideal: 30 } });
        setAplicado('Live ajustada para 30 fps');
      }
    } catch { setAplicado('Não foi possível ajustar agora'); }
    seguidas.current = 0;
    setMostrar(null);
    setIgnorarAte(Date.now() + 30_000);
  };

  if (aplicado) {
    return (
      <div role="status" className="fixed z-[60] top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#1c1128] border border-[#7a2cff]/40 shadow-xl">
        {aplicado}
      </div>
    );
  }
  if (!mostrar) return null;
  const podeBaixar = altura > 720 || fpsCaptura > 30;
  return (
    <div role="alert" className="fixed z-[60] top-16 left-1/2 -translate-x-1/2 w-[min(92vw,460px)] flex items-start gap-3 px-4 py-3 rounded-2xl text-white bg-[#2a1520] border border-[#ffce73]/40 shadow-2xl">
      <Gauge className="w-5 h-5 text-[#ffce73] shrink-0 mt-0.5" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px]">
          {mostrar === 'cpu' ? 'Seu PC está no limite' : 'Sua internet de envio está no limite'}
        </p>
        <p className="text-[12.5px] text-[#d9cfe0] mt-0.5">
          {mostrar === 'cpu'
            ? 'A live pode travar para quem assiste. Baixar a qualidade alivia o processador.'
            : 'A live pode travar para quem assiste. Baixar a qualidade usa menos internet.'}
          {q && q.altura ? ` Agora: ${q.altura}p a ${q.fps} fps.` : ''}
        </p>
        {podeBaixar && (
          <button onClick={baixar}
            className="mt-2 h-8 px-3 rounded-lg text-[12.5px] font-black text-[#1a1406] bg-[#ffce73] hover:bg-[#ffd98f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
            {altura > 720 ? 'Baixar para 720p' : 'Baixar para 30 fps'}
          </button>
        )}
      </div>
      <button onClick={() => { setMostrar(null); setIgnorarAte(Date.now() + 120_000); }} title="Ignorar por 2 minutos"
        className="text-white/70 hover:text-white shrink-0" aria-label="Fechar aviso">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
