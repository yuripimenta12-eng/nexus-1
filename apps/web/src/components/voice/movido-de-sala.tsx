'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRightLeft } from 'lucide-react';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useVoiceStore } from '@/stores/voice.store';

// Um admin/moderador arrastou você para outra sala de voz: troca de sala
// sozinho (sem pré-lobby) e mostra quem moveu. Fica montado no layout do app,
// então funciona em qualquer tela — inclusive com a call em segundo plano.
interface EventoMovido {
  serverId: string;
  fromRoomId: string;
  toRoomId: string;
  toRoomName: string;
  by: string;
}

export function MovidoDeSala() {
  const router = useRouter();
  const pathname = usePathname();
  const caminho = useRef(pathname);
  caminho.current = pathname;
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onMovido = async (e: EventoMovido) => {
      const st = useVoiceStore.getState();
      if (!e?.toRoomId || st.voiceRoomId !== e.fromRoomId) return; // já saiu dessa sala
      try {
        api.post(`/voice/rooms/${e.fromRoomId}/leave`).catch(() => {});
        const { data } = await api.post(`/voice/rooms/${e.toRoomId}/join`);
        await useVoiceStore.getState().connect(
          data.livekitUrl, data.token, e.toRoomId, data.voiceRoom.name, e.serverId, data.permissions,
        );
        // Estava olhando a sala antiga: abre a nova (já conectado, sem pré-lobby)
        if (caminho.current?.includes(`/voice/${e.fromRoomId}`)) {
          router.replace(`/app/servers/${e.serverId}/voice/${e.toRoomId}`);
        }
        setAviso(`${e.by} moveu você para ${e.toRoomName}`);
      } catch {
        setAviso('Você foi movido de sala, mas não foi possível entrar na nova. Tente entrar por ela na lista.');
      }
    };
    socket.on('voice:moved', onMovido);
    return () => { socket.off('voice:moved', onMovido); };
  }, [router]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;
  return (
    <div role="status"
      className="fixed z-[80] top-4 left-1/2 -translate-x-1/2 max-w-[92vw] flex items-center gap-2 px-4 py-2.5 rounded-xl
                 text-sm font-semibold text-white bg-[#1c1128] border border-[#7a2cff]/50 shadow-2xl">
      <ArrowRightLeft className="w-4 h-4 text-[#c887ff] shrink-0" aria-hidden />
      <span>{aviso}</span>
    </div>
  );
}
