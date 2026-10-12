'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown, Loader2 } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { cn } from '@/lib/utils';
import { CartaVerso } from '../carta';
import type { JogadorVisao } from '../unidos.store';

export const TEMPO_VEZ = 30_000;

export function Avatar({ j, tamanho = 44 }: { j: { nome: string; avatarUrl: string | null }; tamanho?: number }) {
  return j.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={j.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: tamanho, height: tamanho }} draggable={false} />
  ) : (
    <div className="rounded-full grid place-items-center font-black text-white" style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.36, background: 'linear-gradient(135deg,#ff6a00,#7a2cff)' }}>
      {j.nome.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Milissegundos que faltam até o prazo (atualiza 4x por segundo só quando ativo)
export function useRestanteMs(prazo: number, ativo: boolean) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!ativo) return;
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, [ativo, prazo]);
  return ativo ? Math.max(0, prazo - agora) : 0;
}

// Está falando na chamada? (para as ondas em volta do avatar)
export function useFalando(id: string) {
  return useVoiceStore(s => !!(s as any).participants?.get?.(id)?.isSpeaking);
}

// Anel da vez: brilha, pulsa e vai fechando com o tempo; fica vermelho no fim
export function AnelVez({ tamanho, restanteMs, ativo }: { tamanho: number; restanteMs: number; ativo: boolean }) {
  if (!ativo) return null;
  const r = tamanho / 2 + 5;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, restanteMs / TEMPO_VEZ));
  const urgente = restanteMs <= 6000;
  const cor = urgente ? '#ff4d6d' : '#FF8F3D';
  const lado = (r + 4) * 2;
  return (
    <svg width={lado} height={lado} viewBox={`0 0 ${lado} ${lado}`} aria-hidden
      className={cn('absolute pointer-events-none unidos-pulso-vez', urgente && 'urgente')}
      style={{ left: tamanho / 2 - lado / 2, top: tamanho / 2 - lado / 2, ['--unidos-cor' as any]: cor }}>
      <defs>
        <linearGradient id="unidos-anel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF6A00" /><stop offset="1" stopColor="#7A2CFF" />
        </linearGradient>
      </defs>
      <circle cx={lado / 2} cy={lado / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth={4} />
      <circle cx={lado / 2} cy={lado / 2} r={r} fill="none" stroke={urgente ? cor : 'url(#unidos-anel)'} strokeWidth={4} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - frac)} transform={`rotate(-90 ${lado / 2} ${lado / 2})`}
        style={{ transition: 'stroke-dashoffset .25s linear, stroke .3s' }} />
    </svg>
  );
}

// Avatar com tudo em volta: anel da vez, ondas de fala, desconectado
export function AvatarMesa({ j, tamanho, daVez, restanteMs, host, alvo }: { j: JogadorVisao; tamanho: number; daVez: boolean; restanteMs: number; host?: boolean; alvo: string }) {
  const falando = useFalando(j.id) && !j.ausente;
  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }} data-unidos-alvo={alvo}>
      {falando && (
        <>
          <span className="absolute inset-0 rounded-full border-2 border-[#7CFFB2] unidos-fala" />
          <span className="absolute inset-0 rounded-full border-2 border-[#7CFFB2] unidos-fala" style={{ animationDelay: '.6s' }} />
        </>
      )}
      <AnelVez tamanho={tamanho} restanteMs={restanteMs} ativo={daVez} />
      <motion.div className="relative rounded-full overflow-hidden"
        animate={{ filter: j.ausente ? 'saturate(0.15) brightness(0.7)' : 'saturate(1) brightness(1)', scale: daVez ? 1.04 : 1 }}
        transition={{ duration: 0.4 }}>
        <Avatar j={j} tamanho={tamanho} />
      </motion.div>
      {daVez && (
        <span className={cn('absolute -bottom-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#0a0713] border text-[11px] font-black text-white grid place-items-center tabular-nums',
          restanteMs <= 6000 ? 'border-[#ff4d6d] text-[#ffb3c0]' : 'border-[#ff6a00]')}
          aria-label={`${Math.ceil(restanteMs / 1000)} segundos`}>
          {Math.ceil(restanteMs / 1000)}
        </span>
      )}
      {host && <Crown className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 text-[#ffcc4d]" aria-label="abriu a mesa" />}
      {j.ausente && (
        <span className="absolute inset-0 grid place-items-center" title="Fora da chamada (as vezes andam sozinhas)">
          <Loader2 className="w-4 h-4 text-white/80 animate-spin" aria-hidden />
        </span>
      )}
    </div>
  );
}

export function Adversario({ j, daVez, prazo, onPegar, host }: { j: JogadorVisao; daVez: boolean; prazo: number; onPegar: () => void; host: boolean }) {
  const restanteMs = useRestanteMs(prazo, daVez);
  const versos = Math.min(j.cartas, 7);
  return (
    <div className={cn('relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2 rounded-2xl min-w-[88px] transition-colors duration-300', daVez && 'bg-white/[0.07] shadow-[0_0_24px_rgba(255,106,0,.18)]')}
      aria-label={`${j.nome}: ${j.cartas} carta${j.cartas === 1 ? '' : 's'}${daVez ? ', vez dele' : ''}${j.ausente ? ', desconectado' : ''}`}>
      <AvatarMesa j={j} tamanho={42} daVez={daVez} restanteMs={restanteMs} host={host} alvo={`jogador:${j.id}`} />
      <span className={cn('text-[12px] font-semibold max-w-[92px] truncate', j.ausente ? 'text-[#a99cb8]' : 'text-white')}>{j.nome}</span>
      <div className="flex items-center gap-1">
        <div className="relative h-[26px]" style={{ width: versos * 5 + 14 }}>
          {Array.from({ length: versos }).map((_, i) => (
            <motion.div key={i} className="absolute top-0" style={{ left: i * 5, rotate: (i - versos / 2) * 4 }}
              initial={false} animate={{ y: 0 }}>
              <CartaVerso tamanho={17} />
            </motion.div>
          ))}
        </div>
        <motion.span key={j.cartas} initial={{ scale: 1.5, color: '#ffffff' }} animate={{ scale: 1, color: '#cbb3ff' }}
          className="text-[13px] font-black tabular-nums">{j.cartas}</motion.span>
      </div>
      {j.cartas === 1 && !j.gritou && !j.esqueceu && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-[#1a1406] bg-[#F2C35B] animate-pulse">ÚLTIMA CARTA</span>
      )}
      {j.gritou && j.cartas <= 2 && (
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-[#0a0713] bg-gradient-to-r from-[#ffb27d] to-[#ff6a00]">UNidos!</span>
      )}
      {j.esqueceu && (
        <button onClick={onPegar}
          className="text-[11px] font-black px-2.5 py-1 rounded-full text-white bg-[#ed4245] hover:bg-[#ff5a5d] animate-pulse focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          Pegar! (+2)
        </button>
      )}
      {j.ausente && <span className="text-[10px] text-[#a99cb8]">fora da chamada</span>}
    </div>
  );
}
