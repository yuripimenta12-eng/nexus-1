'use client';

import { useEffect, useRef } from 'react';
import { Track, LocalParticipant } from 'livekit-client';
import { useVoiceStore } from '@/stores/voice.store';
import { useMediaStore } from '@/stores/media.store';

// ── Player de áudio GLOBAL da chamada ────────────────────────────
// Vive no layout do app (não na página da sala), então o som da call
// continua tocando ao navegar para chat, configurações ou outra tela.
// `watching`: o som da TELA compartilhada só toca para quem escolheu
// assistir aquela transmissão (a voz do microfone toca sempre).
export function GlobalCallAudio() {
  const { participants, watching } = useVoiceStore() as any;
  const containerRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    // Chaves que DEVEM estar tocando neste momento
    const wanted = new Set<string>();

    participants.forEach((vp: any) => {
      const { participant, identity } = vp;

      if (participant instanceof LocalParticipant) return;

      Array.from(participant.trackPublications.values()).forEach((pub: any) => {
        if (
          pub.kind === Track.Kind.Audio &&
          pub.track &&
          pub.isSubscribed
        ) {
          const isScreenAudio = pub.source === Track.Source.ScreenShareAudio;
          if (isScreenAudio && !watching.has(identity)) return; // opt-in
          const key = `${identity}:${pub.trackSid}`;
          wanted.add(key);
          if (!attachedRef.current.has(key)) {
            const el = document.createElement('audio');
            el.autoplay = true;
            el.dataset.lkIdentity = identity;
            const ms = useMediaStore.getState();
            if (ms.audioOutputId) (el as any).setSinkId?.(ms.audioOutputId)?.catch?.(() => {});
            container.appendChild(el);
            pub.track.attach(el);
            attachedRef.current.set(key, el);
            // Volume centralizado (individual × geral × silenciar tudo)
            useVoiceStore.getState().applyOutputVolume();
          }
        }
      });
    });

    attachedRef.current.forEach((el, key) => {
      const identity = key.split(':')[0];
      // Remove o que saiu da sala OU deixou de ser desejado (parou de assistir)
      if (!participants.has(identity) || !wanted.has(key)) {
        const vp = participants.get(identity);
        if (vp) {
          Array.from(vp.participant.trackPublications.values()).forEach((pub: any) => {
            if (`${identity}:${pub.trackSid}` === key && pub.track) {
              try { pub.track.detach(el); } catch { /* ok */ }
            }
          });
        }
        el.remove();
        attachedRef.current.delete(key);
      }
    });
  }, [participants, watching]);

  useEffect(() => {
    return () => {
      attachedRef.current.forEach(el => el.remove());
      attachedRef.current.clear();
    };
  }, []);

  return <div ref={containerRef} aria-hidden className="hidden" />;
}
