'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useConfigUnidos, usePrefereMenosMovimento, type ConfigUnidos } from '../efeitos/config';
import { audio } from '../efeitos/audio';

function Volume({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-[13px]">
      <span className="w-20 shrink-0 text-[#cfc6dd]">{rotulo}</span>
      <input type="range" min={0} max={100} step={5} value={Math.round(valor * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="nx-range flex-1" aria-label={`Volume: ${rotulo}`} />
      <span className="w-9 text-right tabular-nums text-[#a99cb8]">{Math.round(valor * 100)}</span>
    </label>
  );
}

function Chave({ rotulo, dica, ligado, onChange, desativado }: { rotulo: string; dica?: string; ligado: boolean; onChange: (v: boolean) => void; desativado?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} disabled={desativado} onClick={() => onChange(!ligado)}
      className="w-full flex items-center gap-3 text-left py-1.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded-lg">
      <span className="flex-1">
        <span className="block text-[13px] text-white">{rotulo}</span>
        {dica && <span className="block text-[11px] text-[#a99cb8]">{dica}</span>}
      </span>
      <span className={cn('relative w-10 h-6 rounded-full transition-colors shrink-0', ligado ? 'bg-[#7A2CFF]' : 'bg-white/15')}>
        <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', ligado ? 'left-5' : 'left-1')} />
      </span>
    </button>
  );
}

// Ajustes do jogo: volumes separados, efeitos reduzidos, tremor, vibração
export function Ajustes({ onFechar }: { onFechar: () => void }) {
  const c = useConfigUnidos();
  const sistema = usePrefereMenosMovimento();
  const mudar = (p: Partial<ConfigUnidos>) => { c.mudar(p); audio.destravar(); };
  return (
    <>
      <div className="absolute inset-0 z-[54]" onClick={onFechar} aria-hidden />
      <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="absolute z-[55] right-3 top-14 w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/10 bg-[#140d22] shadow-2xl p-4 space-y-3"
        role="dialog" aria-label="Ajustes do UNidos" onKeyDown={e => { if (e.key === 'Escape') onFechar(); }}>
        <p className="font-black text-[14px]">Som</p>
        <Chave rotulo="Sem som" ligado={c.mudo} onChange={v => mudar({ mudo: v })} />
        <div className={cn('space-y-2', c.mudo && 'opacity-50')}>
          <Volume rotulo="Música" valor={c.volMusica} onChange={v => mudar({ volMusica: v })} />
          <Volume rotulo="Interface" valor={c.volInterface} onChange={v => { mudar({ volInterface: v }); audio.tocar('selecionar'); }} />
          <Volume rotulo="Efeitos" valor={c.volEfeitos} onChange={v => { mudar({ volEfeitos: v }); audio.tocar('jogar'); }} />
        </div>
        <div className="h-px bg-white/[0.06]" />
        <p className="font-black text-[14px]">Efeitos</p>
        <Chave rotulo="Efeitos reduzidos" dica={sistema ? 'Ligado pelo seu sistema (reduzir movimento)' : 'Animações curtas e menos partículas'}
          ligado={c.reduzido || sistema} desativado={sistema} onChange={v => mudar({ reduzido: v })} />
        <Chave rotulo="Sem tremor de tela" ligado={c.semTremor} onChange={v => mudar({ semTremor: v })} />
        <Chave rotulo="Vibração" dica="No celular, quando o navegador permite" ligado={c.vibracao} onChange={v => mudar({ vibracao: v })} />
        <Chave rotulo="Jogar com um clique" dica="Sem confirmar a carta escolhida" ligado={c.umClique} onChange={v => mudar({ umClique: v })} />
      </motion.div>
    </>
  );
}
