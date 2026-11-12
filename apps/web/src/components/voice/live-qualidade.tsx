'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LocalVideoTrack, Participant, RemoteVideoTrack, Track,
} from 'livekit-client';
import { cn } from '@/lib/utils';

// Qualidade real das lives de tela:
//  - selo "1080p · 58 fps" (o que está saindo, para quem transmite; o que
//    está chegando, para quem assiste)

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
